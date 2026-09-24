const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export type TraceStreamEvent = {
  type?: "log" | "done" | "error" | string;
  message: string;
  stage?: string;
};

export type BackendTxRecord = {
  hop: number;
  direction: "inward" | "outward" | "in" | "out";
  from: string;
  to: string;
  /** Ethereum: wei string. TRON: decimal amount string (already in TRX / token units). */
  value: string;
  tx_hash: string;
  block_number: string;
  timestamp: string;
  gas_used: string;
  gas_price: string;
  is_error: string;
  source_address: string;
  // ---- optional, only set for TRON (Ethereum records never have these) ----
  network?: "ethereum" | "tron";
  asset?: string;
  transaction_type?: string;
  contract_type?: string;
  contract_address?: string;
};

export type TraceResponse = {
  address: string;
  summary: {
    inward_transactions: number;
    outward_transactions: number;
    total_transactions: number;
    max_hops: number;
  };
  inward: BackendTxRecord[];
  outward: BackendTxRecord[];
};

/* ------------------------------------------------------------------ */
/* Network helpers                                                     */
/* ------------------------------------------------------------------ */

export type TraceNetwork = "ethereum" | "tron";
export type TronAssetType = "all" | "trx" | "trc20";

export const isTronAddress = (address: string) =>
  /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address.trim());

export const isEthereumAddress = (address: string) =>
  /^0x[a-fA-F0-9]{40}$/.test(address.trim());

/* ------------------------------------------------------------------ */
/* Existing Ethereum API (unchanged)                                   */
/* ------------------------------------------------------------------ */

export async function getMaxHops(): Promise<number> {
  try {
    const res = await fetch(`${API_URL}/config`);
    if (!res.ok) return 5;
    const data = await res.json();
    return data.max_hops ?? data.maxHops ?? 5;
  } catch {
    return 5;
  }
}

export async function traceWallet(address: string, maxHops = 5): Promise<TraceResponse> {
  const res = await fetch(`${API_URL}/trace`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, max_hops: maxHops }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Trace failed (${res.status})`);
  }

  return res.json();
}

export function streamTrace(
  address: string,
  maxHops: number,
  onEvent: (e: TraceStreamEvent) => void,
  onDone: (result: TraceResponse) => void,
  onError: (msg: string) => void
): () => void {
  const url = `${API_URL}/trace/stream?address=${encodeURIComponent(address)}&max_hops=${maxHops}`;
  const es = new EventSource(url);

  es.onmessage = (evt) => {
    try {
      const parsed: TraceStreamEvent = JSON.parse(evt.data);
      if (parsed.type === "done") {
        onDone(JSON.parse(parsed.message));
        es.close();
      } else if (parsed.type === "error") {
        onError(parsed.message);
        es.close();
      } else {
        onEvent(parsed);
      }
    } catch {
      onError("Failed to parse stream event");
      es.close();
    }
  };

  es.onerror = () => {
    onError("Connection to trace stream lost");
    es.close();
  };

  return () => es.close();
}

/* ------------------------------------------------------------------ */
/* NEW: TRON API                                                       */
/* ------------------------------------------------------------------ */

type TronApiTx = {
  hop: number;
  source_address: string;
  network: string;
  transaction_type: string; // "TRX" | "TRC20"
  tx_hash: string;
  from: string;
  to: string;
  amount: string; // decimal string, e.g. "1000"
  asset: string; // "TRX" | "USDT" ...
  block_number: string | number;
  timestamp: string | number; // milliseconds since epoch
  contract_type: string;
  contract_address: string;
  decimals?: number | null;
};

type TronApiResponse = {
  source: { address: string; network: string };
  summary: { total_transactions: number; total_addresses: number; max_hops: number };
  transactions: TronApiTx[];
  // nodes / edges / supabase also exist in the response but the existing
  // graph is built from `transactions`, so we don't need them here.
};

/**
 * Convert one TRON transaction into the SAME record shape the Ethereum flow
 * uses, so the existing graph / evidence panel / hop columns work unchanged.
 */
function tronTxToRecord(tx: TronApiTx): BackendTxRecord {
  const ms = Number(tx.timestamp);
  return {
    hop: tx.hop,
    direction: "outward", // TRON tracer is outward-only
    from: tx.from,
    to: tx.to,
    value: String(tx.amount ?? "0"), // already decimal (NOT wei)
    tx_hash: tx.tx_hash,
    block_number: String(tx.block_number ?? ""),
    // Etherscan returns unix SECONDS as a string; keep the same format
    timestamp: Number.isFinite(ms) && ms > 0 ? String(Math.floor(ms / 1000)) : "",
    gas_used: "0",
    gas_price: "0",
    is_error: "0",
    source_address: tx.source_address,
    network: "tron",
    asset: tx.asset || "TRX",
    transaction_type: tx.transaction_type,
    contract_type: tx.contract_type,
    contract_address: tx.contract_address,
  };
}

export async function traceTronWallet(
  address: string,
  maxHops = 2,
  assetType: TronAssetType = "all",
  caseId?: string
): Promise<TraceResponse> {
  const res = await fetch(`${API_URL}/trace/tron`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address: address.trim(),
      max_hops: maxHops,
      asset_type: assetType,
      ...(caseId ? { case_id: caseId } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 422) {
      throw new Error("Invalid wallet address or request parameters.");
    }
    if (res.status === 500) {
      throw new Error("TRON investigation failed. Please try again.");
    }
    throw new Error(
      typeof err.detail === "string" ? err.detail : `TRON trace failed (${res.status})`
    );
  }

  const data: TronApiResponse = await res.json();
  const outward = (data.transactions ?? []).map(tronTxToRecord);

  return {
    address: data.source?.address ?? address.trim(),
    summary: {
      inward_transactions: 0,
      outward_transactions: outward.length,
      total_transactions: outward.length,
      max_hops: data.summary?.max_hops ?? maxHops,
    },
    inward: [],
    outward,
  };
}
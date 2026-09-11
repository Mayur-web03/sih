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
  value: string;
  tx_hash: string;
  block_number: string;
  timestamp: string;
  gas_used: string;
  gas_price: string;
  is_error: string;
  source_address: string;
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
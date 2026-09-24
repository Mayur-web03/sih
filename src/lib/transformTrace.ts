import type { BackendTxRecord } from "@/services/api";
import type { FlowTx } from "@/components/investigation/FundFlowGraphInner";

function weiToEth(value: string): number {
  const n = Number(value || "0");
  return n / 1e18;
}

function shortLabel(addr: string): string {
  if (!addr) return "Unknown";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// Rough placeholders — no live price feed yet, so INR values are illustrative only
const ETH_TO_INR = 280000;
const USD_TO_INR = 85; // stablecoins (USDT/USDC/...) ~ 1 USD
const TRX_TO_INR = 25; // placeholder, replace with a real price feed

const STABLECOINS = new Set(["USDT", "USDC", "USDD", "TUSD", "USDJ"]);

function amountInrOf(r: BackendTxRecord): number {
  if (r.network === "tron") {
    const amount = Number(r.value || "0") || 0; // already decimal
    const asset = (r.asset || "").toUpperCase();
    if (STABLECOINS.has(asset)) return Math.round(amount * USD_TO_INR);
    if (asset === "TRX") return Math.round(amount * TRX_TO_INR);
    return 0; // unknown token: no price available
  }
  return Math.round(weiToEth(r.value) * ETH_TO_INR);
}

export function backendRecordsToFlowTx(records: BackendTxRecord[]): FlowTx[] {
  return [...records]
    .sort((a, b) => a.hop - b.hop)
    .map((r) => {
      const isTron = r.network === "tron";
      return {
        hash: r.tx_hash,
        hop: r.hop,
        toLabel: shortLabel(r.direction === "outward" ? r.to : r.from),
        chain: (isTron ? "TRON" : "Ethereum") as "TRON" | "Ethereum",
        asset: isTron ? r.asset || "TRX" : "ETH",
        amountInr: amountInrOf(r),
        eventType: "transfer" as const,
        riskLevel: r.is_error === "1" ? ("high" as const) : undefined,
      };
    });
}
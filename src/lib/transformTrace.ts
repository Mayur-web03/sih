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

// Rough placeholder — no live INR/ETH price feed yet, so this is illustrative only
const ETH_TO_INR = 280000;

export function backendRecordsToFlowTx(records: BackendTxRecord[]): FlowTx[] {
  return [...records]
    .sort((a, b) => a.hop - b.hop)
    .map((r) => {
      const ethAmount = weiToEth(r.value);
      return {
        hash: r.tx_hash,
        hop: r.hop,
        toLabel: shortLabel(r.direction === "outward" ? r.to : r.from),
        chain: "Ethereum",
        asset: "ETH",
        amountInr: Math.round(ethAmount * ETH_TO_INR),
        eventType: "transfer" as const,
        riskLevel: r.is_error === "1" ? "high" : undefined,
      };
    });
}
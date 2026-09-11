import type { BackendTxRecord } from "@/services/api";
import { normalizeTimestamp } from "@/lib/format";

export type RiskSignal = { label: string; positive: boolean; weight: number };
export type RiskAssessment = {
  score: number; // 0-100
  level: "Low" | "Medium" | "High";
  signals: RiskSignal[];
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function calculateFanOutRisk(outgoing: number): { score: number; signal?: RiskSignal } {
  if (outgoing >= 10) return { score: 25, signal: { label: "High fan-out (many recipients)", positive: false, weight: 25 } };
  if (outgoing >= 4) return { score: 14, signal: { label: "Moderate fan-out", positive: false, weight: 14 } };
  if (outgoing >= 2) return { score: 5, signal: { label: "Multiple outgoing recipients", positive: false, weight: 5 } };
  return { score: 0 };
}

function calculateFanInRisk(incoming: number): { score: number; signal?: RiskSignal } {
  if (incoming >= 10) return { score: 20, signal: { label: "High fan-in (many senders)", positive: false, weight: 20 } };
  if (incoming >= 4) return { score: 12, signal: { label: "Moderate fan-in", positive: false, weight: 12 } };
  if (incoming >= 2) return { score: 4, signal: { label: "Multiple incoming senders", positive: false, weight: 4 } };
  return { score: 0 };
}

// FIX: timestamps from backend are ISO strings (see normalizeTimestamp usage in
// EvidencePanel.tsx), NOT epoch numbers. Number(t.timestamp) on an ISO string
// is NaN, so this signal was silently dead before. Now parsed correctly.
function calculateVelocityRisk(txs: BackendTxRecord[]): { score: number; signal?: RiskSignal } {
  if (txs.length < 2) return { score: 0 };
  const times = txs
    .map((t) => new Date(normalizeTimestamp(t.timestamp)).getTime())
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);
  if (times.length < 2) return { score: 0 };
  const gaps = times.slice(1).map((t, i) => t - times[i]);
  const avgGapMin = gaps.reduce((s, g) => s + g, 0) / gaps.length / 1000 / 60;
  if (avgGapMin < 5) return { score: 20, signal: { label: "Rapid transaction velocity (<5 min avg gap)", positive: false, weight: 20 } };
  if (avgGapMin < 30) return { score: 10, signal: { label: "Elevated transaction velocity", positive: false, weight: 10 } };
  if (avgGapMin < 120) return { score: 4, signal: { label: "Somewhat frequent transaction pattern", positive: false, weight: 4 } };
  return { score: 0 };
}

// FIX: hop 1 (direct counterparty of the traced wallet) is now treated as a
// mild baseline signal instead of always contributing 0.
function calculateHopRisk(maxHop: number): { score: number; signal?: RiskSignal } {
  if (maxHop >= 4) return { score: 15, signal: { label: "Deep multi-hop propagation", positive: false, weight: 15 } };
  if (maxHop >= 2) return { score: 8, signal: { label: "Multi-hop fund movement", positive: false, weight: 8 } };
  if (maxHop >= 1) return { score: 3, signal: { label: "Direct counterparty of traced wallet", positive: false, weight: 3 } };
  return { score: 0 };
}

function calculateErrorRisk(txs: BackendTxRecord[]): { score: number; signal?: RiskSignal } {
  const errors = txs.filter((t) => t.is_error === "1" || t.is_error === "true").length;
  if (errors > 0) return { score: 10, signal: { label: `${errors} failed transaction(s) detected`, positive: false, weight: 10 } };
  return { score: 0, signal: { label: "No transaction errors detected", positive: true, weight: 0 } };
}

// FIX: thresholds lowered — 10-50 ETH was previously scored the same as <10 ETH.
function calculateValueConcentrationRisk(ethIn: number, ethOut: number): { score: number; signal?: RiskSignal } {
  const total = ethIn + ethOut;
  if (total >= 25) return { score: 18, signal: { label: "Very large cumulative value moved", positive: false, weight: 18 } };
  if (total >= 5) return { score: 9, signal: { label: "Large cumulative value moved", positive: false, weight: 9 } };
  if (total >= 1) return { score: 3, signal: { label: "Moderate value moved", positive: false, weight: 3 } };
  return { score: 0 };
}

export class RiskEngine {
  calculateWalletRisk(params: {
    incoming: number;
    outgoing: number;
    ethIn: number;
    ethOut: number;
    hop: number;
    txs: BackendTxRecord[];
  }): RiskAssessment {
    const { incoming, outgoing, ethIn, ethOut, hop, txs } = params;

    const parts = [
      calculateFanOutRisk(outgoing),
      calculateFanInRisk(incoming),
      calculateVelocityRisk(txs),
      calculateHopRisk(Math.abs(hop)),
      calculateErrorRisk(txs),
      calculateValueConcentrationRisk(ethIn, ethOut),
    ];

    const score = clamp(parts.reduce((s, p) => s + p.score, 0), 0, 100);
    const signals = parts.map((p) => p.signal).filter(Boolean) as RiskSignal[];

    // FIX: thresholds moved down slightly (was 60/30) so Medium/High are
    // actually reachable given realistic per-node transaction volumes.
    const level: RiskAssessment["level"] = score >= 45 ? "High" : score >= 20 ? "Medium" : "Low";

    return { score, level, signals };
  }
}

export const riskEngine = new RiskEngine();
import type { BackendTxRecord } from "@/services/api";

export interface RiskSignal {
  label: string;
  positive: boolean;
  weight: number;
}

export interface RiskAssessment {
  score: number;
  level: "Low" | "Medium" | "High";
  signals: RiskSignal[];
}

function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max);
}

function calculateFanOutRisk(outgoingCount: number): { score: number; signal?: RiskSignal } {
  if (outgoingCount >= 20) return { score: 35, signal: { label: `Extreme fan-out (${outgoingCount} outward txs)`, positive: false, weight: 35 } };
  if (outgoingCount >= 8) return { score: 20, signal: { label: `High fan-out (${outgoingCount} outward txs)`, positive: false, weight: 20 } };
  if (outgoingCount >= 4) return { score: 10, signal: { label: `Moderate fan-out (${outgoingCount} outward txs)`, positive: false, weight: 10 } };
  return { score: 0 };
}

function calculateFanInRisk(incomingCount: number): { score: number; signal?: RiskSignal } {
  if (incomingCount >= 20) return { score: 25, signal: { label: `Extreme fan-in (${incomingCount} inward txs)`, positive: false, weight: 25 } };
  if (incomingCount >= 8) return { score: 15, signal: { label: `High fan-in (${incomingCount} inward txs)`, positive: false, weight: 15 } };
  if (incomingCount >= 4) return { score: 8, signal: { label: `Moderate fan-in (${incomingCount} inward txs)`, positive: false, weight: 8 } };
  return { score: 0 };
}

function calculateVelocityRisk(txs: BackendTxRecord[]): { score: number; signal?: RiskSignal } {
  if (txs.length < 3) return { score: 0 };

  const timestamps = txs
    .map((t) => new Date(t.timestamp).getTime())
    .filter((t) => !isNaN(t))
    .sort((a, b) => a - b);

  if (timestamps.length < 3) return { score: 0 };

  const totalTimeMs = timestamps[timestamps.length - 1] - timestamps[0];
  const avgDiffMinutes = totalTimeMs / (timestamps.length - 1) / 60000;

  if (avgDiffMinutes < 5) return { score: 25, signal: { label: "Rapid throughput (< 5 min avg between txs)", positive: false, weight: 25 } };
  if (avgDiffMinutes < 30) return { score: 15, signal: { label: "High transaction velocity (< 30 min avg)", positive: false, weight: 15 } };
  if (avgDiffMinutes < 120) return { score: 5, signal: { label: "Moderate velocity (< 2 hrs avg)", positive: false, weight: 5 } };

  return { score: 0 };
}

function calculateHopRisk(hop: number): { score: number; signal?: RiskSignal } {
  if (hop >= 5) return { score: 20, signal: { label: `Deep layering path (hop ${hop})`, positive: false, weight: 20 } };
  if (hop >= 3) return { score: 10, signal: { label: `Intermediate hop distance (hop ${hop})`, positive: false, weight: 10 } };
  return { score: 0 };
}

function calculateErrorRisk(txs: BackendTxRecord[]): { score: number; signal?: RiskSignal } {
  if (txs.length === 0) return { score: 0 };
  const errorCount = txs.filter((t) => t.is_error).length;
  const ratio = errorCount / txs.length;

  if (ratio > 0.4) return { score: 20, signal: { label: `High failure rate (${Math.round(ratio * 100)}% failed txs)`, positive: false, weight: 20 } };
  if (errorCount > 0) return { score: 5, signal: { label: `${errorCount} failed transaction(s) observed`, positive: false, weight: 5 } };
  return { score: 0 };
}

function calculateValueConcentrationRisk(ethIn: number, ethOut: number): { score: number; signal?: RiskSignal } {
  const total = ethIn + ethOut;
  if (total >= 100) return { score: 20, signal: { label: "Very high volume moved (≥ 100 ETH)", positive: false, weight: 20 } };
  if (total >= 10) return { score: 10, signal: { label: "High volume moved (≥ 10 ETH)", positive: false, weight: 10 } };
  if (total >= 1) return { score: 4, signal: { label: "Moderate volume moved (≥ 1 ETH)", positive: false, weight: 4 } };
  return { score: 0 };
}

// TRON: value is a raw decimal amount (TRX or USDT), never wei.
function calculateValueConcentrationRiskTron(totalIn: number, totalOut: number): { score: number; signal?: RiskSignal } {
  const total = totalIn + totalOut;
  if (total >= 1_000_000) return { score: 18, signal: { label: "Very large cumulative value moved (TRON)", positive: false, weight: 18 } };
  if (total >= 100_000) return { score: 9, signal: { label: "Large cumulative value moved (TRON)", positive: false, weight: 9 } };
  if (total >= 10_000) return { score: 3, signal: { label: "Moderate value moved (TRON)", positive: false, weight: 3 } };
  return { score: 0 };
}

// TRON: moving multiple distinct assets through the same wallet is a layering signal.
function calculateAssetDiversityRiskTron(txs: BackendTxRecord[]): { score: number; signal?: RiskSignal } {
  const assets = new Set(txs.map((t) => t.asset || "TRX"));
  if (assets.size >= 4) return { score: 10, signal: { label: `${assets.size} distinct assets moved through this wallet`, positive: false, weight: 10 } };
  if (assets.size >= 2) return { score: 4, signal: { label: `${assets.size} distinct assets moved through this wallet`, positive: false, weight: 4 } };
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
    network?: "ethereum" | "tron";
  }): RiskAssessment {
    const { incoming, outgoing, ethIn, ethOut, hop, txs, network = "ethereum" } = params;
    const isTron = network === "tron";

    const parts = [
      calculateFanOutRisk(outgoing),
      calculateFanInRisk(incoming),
      calculateVelocityRisk(txs),
      calculateHopRisk(Math.abs(hop)),
      calculateErrorRisk(txs),
      isTron ? calculateValueConcentrationRiskTron(ethIn, ethOut) : calculateValueConcentrationRisk(ethIn, ethOut),
      ...(isTron ? [calculateAssetDiversityRiskTron(txs)] : []),
    ];

    const score = clamp(parts.reduce((s, p) => s + p.score, 0), 0, 100);
    const signals = parts.map((p) => p.signal).filter((s): s is RiskSignal => Boolean(s));

    let level: "Low" | "Medium" | "High" = "Low";
    if (score >= 60) level = "High";
    else if (score >= 25) level = "Medium";

    return { score, level, signals };
  }
}

export const riskEngine = new RiskEngine();
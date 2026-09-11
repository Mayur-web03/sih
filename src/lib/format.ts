import type { Chain, RiskLevel } from "@/types";

export function formatInr(amount: number, compact = false): string {
  if (compact) {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2).replace(/\.?0+$/, "")}Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1).replace(/\.0$/, "")}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}K`;
  }
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function shortAddress(address: string, head = 6, tail = 4): string {
  if (!address) return "";
  if (address.length <= head + tail + 1) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

export function riskLevel(score: number): RiskLevel {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export function riskLabel(score: number): string {
  const l = riskLevel(score);
  return l === "high" ? "HIGH RISK" : l === "medium" ? "MEDIUM RISK" : "LOW RISK";
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

export function relativeTime(iso: string, now = new Date("2026-09-08T09:47:00+05:30")): string {
  const diff = (now.getTime() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  return `${Math.floor(diff / 86400)} d ago`;
}

export const chainMeta: Record<Chain, { short: string; symbol: string }> = {
  Ethereum: { short: "ETH", symbol: "Ξ" },
  TRON: { short: "TRX", symbol: "T" },
  Bitcoin: { short: "BTC", symbol: "₿" },
  "BNB Chain": { short: "BNB", symbol: "B" },
  Polygon: { short: "MATIC", symbol: "P" },
};

export function normalizeTimestamp(ts: string | number): string {
  if (typeof ts === "number" || /^\d+$/.test(String(ts))) {
    const num = Number(ts);
    const ms = String(num).length <= 10 ? num * 1000 : num;
    return new Date(ms).toISOString();
  }
  return new Date(ts).toISOString();
}

// ── Wei → ETH conversion (precise, BigInt-based, no float error) ──

export const weiToEth = (value: string | number | undefined | null): string => {
  const raw = String(value ?? "0").split(".")[0] || "0";
  let wei: bigint;
  try {
    wei = BigInt(raw);
  } catch {
    return "0";
  }
  const whole = wei / 1000000000000000000n;
  const fraction = wei % 1000000000000000000n;

  const fractionStr = fraction
    .toString()
    .padStart(18, "0")
    .replace(/0+$/, "");

  return fractionStr ? `${whole}.${fractionStr}` : `${whole}`;
};

export const weiToEthNumber = (value: string | number | undefined | null): number => {
  try {
    const raw = String(value ?? "0").split(".")[0] || "0";
    const wei = BigInt(raw);
    return Number(wei) / 1e18;
  } catch {
    return 0;
  }
};
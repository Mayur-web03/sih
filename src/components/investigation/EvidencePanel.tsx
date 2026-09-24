import { useState } from "react";
import { Copy, Check, ExternalLink, X, ArrowDownLeft, ArrowUpRight, ShieldAlert } from "lucide-react";
import { shortAddress, formatDateTime, normalizeTimestamp, weiToEthNumber } from "@/lib/format";
import { riskEngine, type RiskAssessment } from "@/services/risk/RiskEngine";
import { isTronAddress } from "@/services/api";
import type { BackendTxRecord } from "@/services/api";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
      style={{
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color: copied ? "#7fe0ac" : "#8798a8",
        display: "inline-flex",
        alignItems: "center",
        padding: 3,
      }}
      title="Copy"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function RiskGauge({ risk }: { risk: RiskAssessment }) {
  const color = risk.level === "High" ? "#ff5f7e" : risk.level === "Medium" ? "#e7bd74" : "#7fe0ac";
  const circumference = 2 * Math.PI * 34;
  const offset = circumference - (risk.score / 100) * circumference;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <svg width="84" height="84" viewBox="0 0 84 84">
        <circle cx="42" cy="42" r="34" fill="none" stroke="#1c2530" strokeWidth="8" />
        <circle
          cx="42"
          cy="42"
          r="34"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 42 42)"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <text x="42" y="38" textAnchor="middle" fontSize="20" fontWeight="700" fill="#e6edf3">
          {risk.score}
        </text>
        <text x="42" y="54" textAnchor="middle" fontSize="9" fill="#8798a8">
          / 100
        </text>
      </svg>
      <div>
        <span
          style={{
            display: "inline-block",
            padding: "3px 10px",
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.5,
            color,
            background: `${color}22`,
            border: `1px solid ${color}55`,
          }}
        >
          {risk.level.toUpperCase()} RISK
        </span>
        <p style={{ fontSize: 10, color: "#66757f", marginTop: 8, lineHeight: 1.4, maxWidth: 160 }}>
          Heuristic score based on observed transaction behaviour. Not a criminality determination.
        </p>
      </div>
    </div>
  );
}

const fmtNum = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 4 });

export function EvidencePanel({
  address,
  hop,
  direction,
  txs,
  onClose,
}: {
  address: string;
  hop: number;
  direction: "in" | "out" | "mixed" | any;
  txs: BackendTxRecord[];
  onClose: () => void;
}) {
  const isTron = isTronAddress(address);
  const sameAddr = (a?: string, b?: string) =>
    !!a && !!b && (isTron ? a === b : a.toLowerCase() === b.toLowerCase());

  const incoming = txs.filter((t) => sameAddr(t.to, address));
  const outgoing = txs.filter((t) => sameAddr(t.from, address));

  const amountOf = (t: BackendTxRecord) => (isTron ? Number(t.value) || 0 : weiToEthNumber(t.value));

  const ethIn = incoming.reduce((s, t) => s + amountOf(t), 0);
  const ethOut = outgoing.reduce((s, t) => s + amountOf(t), 0);

  const risk: RiskAssessment = riskEngine.calculateWalletRisk({
    incoming: incoming.length,
    outgoing: outgoing.length,
    ethIn,
    ethOut,
    hop,
    txs,
    network: isTron ? "tron" : "ethereum",
  });

  const assetTotals = new Map<string, { in: number; out: number }>();
  if (isTron) {
    txs.forEach((t) => {
      const asset = t.asset || "TRX";
      const cur = assetTotals.get(asset) ?? { in: 0, out: 0 };
      const v = Number(t.value) || 0;
      if (sameAddr(t.to, address)) cur.in += v;
      if (sameAddr(t.from, address)) cur.out += v;
      assetTotals.set(asset, cur);
    });
  }

  const sortedTxs = [...txs].sort(
    (a, b) => new Date(normalizeTimestamp(b.timestamp)).getTime() - new Date(normalizeTimestamp(a.timestamp)).getTime(),
  );

  const txUrl = (hash: string) => (isTron ? `https://tronscan.org/#/transaction/${hash}` : `https://etherscan.io/tx/${hash}`);
  const addrUrl = isTron ? `https://tronscan.org/#/address/${address}` : `https://etherscan.io/address/${address}`;
  const explorerName = isTron ? "Tronscan" : "Etherscan";

  return (
    <aside
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: 340,
        background: "#0f151b",
        borderLeft: "1px solid #283440",
        display: "flex",
        flexDirection: "column",
        zIndex: 10,
        boxShadow: "-8px 0 24px rgba(0,0,0,0.35)",
        animation: "slideIn 0.25s ease",
      }}
    >
      <style>{`@keyframes slideIn { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>

      <div style={{ padding: "14px 16px", borderBottom: "1px solid #1c2530", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#3fc7f4", letterSpacing: 0.8 }}>EVIDENCE PANEL</span>
            <span style={{ fontSize: 9, background: "#1c2530", color: "#8798a8", padding: "1px 6px", borderRadius: 4 }}>
              {isTron ? "TRON" : "ETH"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#e6edf3" }}>{shortAddress(address, 8, 6)}</span>
            <CopyButton text={address} />
            <a href={addrUrl} target="_blank" rel="noreferrer" style={{ color: "#8798a8" }} title={`View on ${explorerName}`}>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#8798a8", cursor: "pointer" }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ padding: "16px", overflowY: "auto", flex: 1 }}>
        <RiskGauge risk={risk} />
        {isTron && (
          <p style={{ fontSize: 10, color: "#66757f", lineHeight: 1.4, margin: "8px 0 0", maxWidth: 220 }}>
            TRON scoring uses a TRX/token-calibrated model (fan-in/out, velocity, hop depth, value concentration, asset diversity).
          </p>
        )}

        {risk.signals.length > 0 && (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
            {risk.signals.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: s.positive ? "#7fe0ac" : "#c7d2dc" }}>
                {s.positive ? <Check size={12} /> : <ShieldAlert size={12} />}
                {s.label}
              </div>
            ))}
          </div>
        )}

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
          <div style={{ background: "#141c24", padding: 10, borderRadius: 8, border: "1px solid #1c2530" }}>
            <div style={{ fontSize: 10, color: "#66757f" }}>Hop Distance</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#e6edf3", marginTop: 2 }}>{hop === 0 ? "Start" : `Hop ${Math.abs(hop)}`}</div>
          </div>
          <div style={{ background: "#141c24", padding: 10, borderRadius: 8, border: "1px solid #1c2530" }}>
            <div style={{ fontSize: 10, color: "#66757f" }}>Transactions</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#e6edf3", marginTop: 2 }}>{txs.length} total</div>
          </div>
        </div>

        {/* Totals */}
        <div style={{ marginTop: 16, background: "#141c24", padding: 12, borderRadius: 8, border: "1px solid #1c2530" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#8798a8", marginBottom: 8 }}>VOLUME BREAKDOWN</div>
          {isTron ? (
            Array.from(assetTotals.entries()).map(([asset, totals]) => (
              <div key={asset} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#3fc7f4" }}>{asset}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#8798a8", marginTop: 2 }}>
                  <span>In: {fmtNum(totals.in)}</span>
                  <span>Out: {fmtNum(totals.out)}</span>
                </div>
              </div>
            ))
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#e6edf3" }}>
              <span>In: {fmtNum(ethIn)} ETH</span>
              <span>Out: {fmtNum(ethOut)} ETH</span>
            </div>
          )}
        </div>

        {/* Transaction list */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#8798a8", marginBottom: 8 }}>OBSERVED TRANSACTIONS ({sortedTxs.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sortedTxs.map((t, i) => {
              const isIn = sameAddr(t.to, address);
              return (
                <div key={i} style={{ background: "#141c24", padding: 10, borderRadius: 6, border: "1px solid #1c2530", fontSize: 11 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, color: isIn ? "#7fe0ac" : "#ff5f7e", fontWeight: 600 }}>
                      {isIn ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                      {isIn ? "IN" : "OUT"}
                    </span>
                    <span style={{ color: "#e6edf3", fontWeight: 700 }}>
                      {isTron ? `${fmtNum(Number(t.value) || 0)} ${t.asset || "TRX"}` : `${fmtNum(weiToEthNumber(t.value))} ETH`}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#66757f", fontSize: 10, marginTop: 4 }}>
                    <span>{formatDateTime(normalizeTimestamp(t.timestamp))}</span>
                    <a href={txUrl(t.tx_hash)} target="_blank" rel="noreferrer" style={{ color: "#3fc7f4", textDecoration: "none" }}>
                      Hash <ExternalLink size={9} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
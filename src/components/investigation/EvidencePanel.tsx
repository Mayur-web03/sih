import { useState } from "react";
import { Copy, Check, ExternalLink, X, ArrowDownLeft, ArrowUpRight, ShieldAlert } from "lucide-react";
import { shortAddress, formatDateTime, normalizeTimestamp, weiToEth, weiToEthNumber } from "@/lib/format";
import { riskEngine, type RiskAssessment } from "@/services/risk/RiskEngine";
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
  const incoming = txs.filter((t) => t.to?.toLowerCase() === address.toLowerCase());
  const outgoing = txs.filter((t) => t.from?.toLowerCase() === address.toLowerCase());

  // Wei to ETH conversion using format utility helpers
  const ethIn = incoming.reduce((s, t) => s + weiToEthNumber(t.value), 0);
  const ethOut = outgoing.reduce((s, t) => s + weiToEthNumber(t.value), 0);

  const risk = riskEngine.calculateWalletRisk({
    incoming: incoming.length,
    outgoing: outgoing.length,
    ethIn,
    ethOut,
    hop,
    txs,
  });

  const sortedTxs = [...txs].sort(
    (a, b) => new Date(normalizeTimestamp(b.timestamp)).getTime() - new Date(normalizeTimestamp(a.timestamp)).getTime(),
  );

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
          <span style={{ fontSize: 10, letterSpacing: 1, color: "#66757f", fontWeight: 700 }}>FORENSIC EVIDENCE</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <code style={{ fontSize: 12, color: "#e6edf3" }}>{shortAddress(address, 8, 6)}</code>
            <CopyButton text={address} />
          </div>
        </div>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#66757f", cursor: "pointer" }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ padding: "16px", overflowY: "auto", flex: 1 }}>
        {/* Risk */}
        <RiskGauge risk={risk} />

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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 18 }}>
          <StatBox icon={<ArrowDownLeft size={13} color="#7fe0ac" />} label="Incoming" value={`${incoming.length} tx`} />
          <StatBox icon={<ArrowUpRight size={13} color="#e7bd74" />} label="Outgoing" value={`${outgoing.length} tx`} />
          <StatBox label="ETH In" value={`${ethIn.toFixed(4)}`} accent="#7fe0ac" />
          <StatBox label="ETH Out" value={`${ethOut.toFixed(4)}`} accent="#e7bd74" />
          <StatBox label="Net Flow" value={`${(ethIn - ethOut).toFixed(4)} ETH`} />
          <StatBox label="Hop" value={hop === 0 ? "START" : `${Math.abs(hop)}`} />
        </div>

        {/* Transaction list */}
        <div style={{ marginTop: 20 }}>
          <span style={{ fontSize: 10, letterSpacing: 1, color: "#66757f", fontWeight: 700 }}>
            TRANSACTIONS ({sortedTxs.length})
          </span>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {sortedTxs.map((tx, i) => {
              const isIncoming = tx.to?.toLowerCase() === address.toLowerCase();
              return (
                <div
                  key={tx.tx_hash ?? i}
                  style={{
                    background: "#141c24",
                    border: "1px solid #1c2530",
                    borderRadius: 6,
                    padding: "8px 10px",
                    fontSize: 11,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, color: isIncoming ? "#7fe0ac" : "#e7bd74", fontWeight: 600 }}>
                      {isIncoming ? <ArrowDownLeft size={11} /> : <ArrowUpRight size={11} />}
                      {isIncoming ? "IN" : "OUT"}
                    </span>
                    <span style={{ color: "#e6edf3", fontWeight: 600 }}>{weiToEth(tx.value)} ETH</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5, color: "#8798a8" }}>
                    <code>{shortAddress(tx.tx_hash, 8, 6)}</code>
                    <CopyButton text={tx.tx_hash} />
                    <a
                      href={`https://etherscan.io/tx/${tx.tx_hash}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#66757f", display: "inline-flex", marginLeft: "auto" }}
                      title="View on Etherscan"
                    >
                      <ExternalLink size={12} />
                    </a>
                  </div>
                  <div style={{ marginTop: 3, color: "#5a6771", fontSize: 10 }}>
                    {formatDateTime(normalizeTimestamp(tx.timestamp))} · Block {tx.block_number}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <a
          href={`https://etherscan.io/address/${address}`}
          target="_blank"
          rel="noreferrer"
          style={{
            marginTop: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "8px",
            background: "#1c2530",
            border: "1px solid #283440",
            borderRadius: 6,
            color: "#c7d2dc",
            fontSize: 11,
            textDecoration: "none",
          }}
        >
          <ExternalLink size={13} /> View wallet on Etherscan
        </a>
      </div>
    </aside>
  );
}

function StatBox({ icon, label, value, accent }: { icon?: React.ReactNode; label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: "#141c24", border: "1px solid #1c2530", borderRadius: 6, padding: "8px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "#66757f", textTransform: "uppercase" }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: accent ?? "#e6edf3", marginTop: 2 }}>{value}</div>
    </div>
  );
}
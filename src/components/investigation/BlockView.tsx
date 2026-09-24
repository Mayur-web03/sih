import { useMemo, useState } from "react";
import { AlertTriangle, Wallet } from "lucide-react";
import { shortAddress, formatInr } from "@/lib/format";
import { riskEngine } from "@/services/risk/RiskEngine";
import type { GraphNode } from "@/lib/buildGraphData";
import type { BackendTxRecord } from "@/services/api";

// NOTE: adjust this to your live ETH/INR rate source if you have one
const ETH_TO_INR_RATE = 350000;

export function BlockView({
  nodes,
  nodeInfoMap,
  onNodeClick,
}: {
  nodes: GraphNode[];
  nodeInfoMap: Map<string, { hop: number; direction: "in" | "out" | "mixed"; txs: BackendTxRecord[]; incoming: number; outgoing: number; ethIn: number; ethOut: number }>;
  onNodeClick?: (address: string, txs: BackendTxRecord[]) => void;
}) {
  const [scale, setScale] = useState(1);

  // order: start wallet first, then by absolute hop ascending
  const ordered = useMemo(() => {
    const start = nodes.find((n) => n.isStart);
    const rest = nodes
      .filter((n) => !n.isStart)
      .sort((a, b) => Math.abs(a.hop) - Math.abs(b.hop));
    return start ? [start, ...rest] : rest;
  }, [nodes]);

  const totalTx = useMemo(() => nodes.reduce((s, n) => s + n.degree, 0), [nodes]);

  const cardRisk = (node: GraphNode) => {
    if (node.isStart) return { level: "Low" as const, score: 0 };
    // Risk model is calibrated for ETH volumes -> not applied to TRON
    if (node.network === "tron") return { level: "Low" as const, score: 0 };
    const info = nodeInfoMap.get(node.id);
    if (!info) return { level: "Low" as const, score: 0 };
    return riskEngine.calculateWalletRisk({
      incoming: info.incoming,
      outgoing: info.outgoing,
      ethIn: info.ethIn,
      ethOut: info.ethOut,
      hop: info.hop,
      txs: info.txs,
    });
  };

  const riskColors = {
    High: { border: "#5c2430", bg: "#2a1418", text: "#ff8fa3", badge: "#ff5f7e" },
    Medium: { border: "#5a4420", bg: "#2a2114", text: "#f0c67a", badge: "#e8a84c" },
    Low: { border: "#1c2530", bg: "#141c24", text: "#8798a8", badge: "#43d9a3" },
  };

  return (
    <div
      style={{
        height: 620,
        display: "flex",
        flexDirection: "column",
        background: "#0b1016",
        borderBottomLeftRadius: 10,
        borderBottomRightRadius: 10,
        border: "1px solid #1c2530",
        borderTop: "none",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: 40,
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            transform: `scale(${scale})`,
            transformOrigin: "left center",
            transition: "transform 0.15s ease",
          }}
        >
          {ordered.map((node, i) => {
            const isTron = node.network === "tron";
            const risk = cardRisk(node);
            const colors = node.isStart
              ? { border: "#3fc7f4", bg: "#0f2a33", text: "#8fd8f0", badge: "#3fc7f4" }
              : riskColors[risk.level];
            const totalEth = node.ethIn + node.ethOut;
            const inr = totalEth * ETH_TO_INR_RATE;

            return (
              <div key={node.id} style={{ display: "flex", alignItems: "center" }}>
                {/* Connector (skip before first card) */}
                {i > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      width: 90,
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontSize: 9, color: "#66757f", marginBottom: 4 }}>{isTron ? "TRON" : "ETH"}</span>
                    <svg width="90" height="14" style={{ overflow: "visible" }}>
                      <line
                        x1="0"
                        y1="7"
                        x2="82"
                        y2="7"
                        stroke="#ff5f7e"
                        strokeWidth="1.5"
                        strokeDasharray="4,4"
                      />
                      <polygon points="82,3 90,7 82,11" fill="#3fc7f4" />
                    </svg>
                  </div>
                )}

                {/* Card */}
                <button
                  onClick={() => {
                    const info = nodeInfoMap.get(node.id);
                    onNodeClick?.(node.id, info?.txs ?? []);
                  }}
                  style={{
                    width: 190,
                    flexShrink: 0,
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 12,
                    padding: "16px 14px",
                    textAlign: "center",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      background: colors.border,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 10px",
                    }}
                  >
                    <Wallet size={15} color={colors.badge} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#e6edf3" }}>
                    {shortAddress(node.id, 6, 4)}
                  </div>
                  <div style={{ fontSize: 10, color: "#66757f", marginTop: 3 }}>
                    {isTron ? "TRON" : "Ethereum"} · {node.isStart ? "START" : `hop ${Math.abs(node.hop)}`}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, marginTop: 8 }}>
                    {isTron ? `${node.degree} tx` : formatInr(inr, true)}
                  </div>
                  {!node.isStart && !isTron && (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 10,
                        color: colors.badge,
                        marginTop: 6,
                      }}
                    >
                      <AlertTriangle size={11} /> {risk.level} risk
                    </div>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Header-style summary (optional, matches screenshot top-right) */}
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 16,
          fontSize: 12,
          color: "#3fc7f4",
          fontWeight: 600,
        }}
      >
        {totalTx} transactions
      </div>

      {/* Zoom controls, bottom-left, like screenshot */}
      <div
        style={{
          position: "absolute",
          bottom: 14,
          left: 14,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <button style={zoomBtnStyle} onClick={() => setScale((s) => Math.min(s + 0.15, 2.5))}>
          +
        </button>
        <button style={zoomBtnStyle} onClick={() => setScale((s) => Math.max(s - 0.15, 0.4))}>
          −
        </button>
        <button style={zoomBtnStyle} onClick={() => setScale(1)} title="Reset zoom">
          ⤢
        </button>
      </div>
    </div>
  );
}

const zoomBtnStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 6,
  background: "#141c24",
  border: "1px solid #283440",
  color: "#c7d2dc",
  fontSize: 15,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
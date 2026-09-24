import { useMemo, useRef, useCallback, useState, useEffect } from "react";
import { Focus, Maximize2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { shortAddress } from "@/lib/format";
import { buildGraphData } from "@/lib/buildGraphData";
import { EvidencePanel } from "./EvidencePanel";
import { BlockView } from "./BlockView";
import type { BackendTxRecord } from "@/services/api";

const IN_COLOR = "#43d9a3";
const OUT_COLOR = "#e8a84c";
const START_COLOR = "#3fc7f4";
const SELECTED_COLOR = "#ff5f7e";
const EDGE_IN_COLOR = "rgba(67, 217, 163, 0.45)";
const EDGE_OUT_COLOR = "rgba(232, 168, 76, 0.45)";
const EDGE_SELECTED_COLOR = "#ff5f7e";
const GRID_LINE_COLOR = "rgba(255,255,255,0.06)";
const HOP_LABEL_COLOR = "#5a6b78";

export function FundFlowGraph({
  address,
  transactions,
  onNodeClick,
  onEdgeClick,
  selectedEdgeId,
}: {
  address: string;
  transactions: BackendTxRecord[];
  onNodeClick?: (walletAddr: string, txs: BackendTxRecord[]) => void;
  onEdgeClick?: (edge: { id: string; txHashes: string[]; lastTx: BackendTxRecord }) => void;
  selectedEdgeId?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 620 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [internalSelectedEdge, setInternalSelectedEdge] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(false);
  const [directionFilter, setDirectionFilter] = useState<"all" | "in" | "out">("all");
  const [hopFilter, setHopFilter] = useState<number | "all">("all");
  const [hoveredNode, setHoveredNode] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"graph" | "block">("graph");
  const [panelNode, setPanelNode] = useState<{ address: string; hop: number; direction: any; txs: BackendTxRecord[] } | null>(null);
  const [ForceGraph2D, setForceGraph2D] = useState<any>(null);

  useEffect(() => {
    let mounted = true;

    import("react-force-graph-2d").then((mod) => {
      if (mounted) {
        setForceGraph2D(() => mod.default);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) setDimensions({ width, height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { nodes, edges, nodeInfoMap } = useMemo(
    () => buildGraphData(address, transactions),
    [address, transactions],
  );

  const availableHops = useMemo(
    () => Array.from(new Set(nodes.filter((n) => !n.isStart).map((n) => Math.abs(n.hop)))).sort((a, b) => a - b),
    [nodes],
  );

  const activeEdgeId = selectedEdgeId ?? internalSelectedEdge;

  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      if (n.isStart) return true;
      if (directionFilter !== "all" && n.direction !== directionFilter && n.direction !== "mixed") return false;
      if (hopFilter !== "all" && Math.abs(n.hop) !== hopFilter) return false;
      return true;
    });
  }, [nodes, directionFilter, hopFilter]);

  const visibleIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  const filteredEdges = useMemo(
    () => edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target)),
    [edges, visibleIds],
  );

  const graphData = useMemo(
    () => ({
      nodes: filteredNodes.map((n) => ({ ...n })),
      links: filteredEdges.map((e) => ({ ...e })),
    }),
    [filteredNodes, filteredEdges],
  );

  const hopColumns = useMemo(() => {
    const seen = new Map<number, { x: number; hop: number; direction: "in" | "out" }>();
    filteredNodes.forEach((n) => {
      if (n.isStart) return;
      const dir: "in" | "out" = n.hop < 0 ? "in" : "out";
      const key = Math.round(n.x / 10);
      if (!seen.has(key)) seen.set(key, { x: n.x, hop: Math.abs(n.hop), direction: dir });
    });
    return Array.from(seen.values()).sort((a, b) => a.x - b.x);
  }, [filteredNodes]);

  const handleNodeClick = useCallback(
    (node: any) => {
      setSelectedNodeId(node.id);
      const txs =
        nodeInfoMap.get(node.id)?.txs ??
        transactions.filter((t) => t.from?.toLowerCase() === node.id || t.to?.toLowerCase() === node.id);
      setPanelNode({ address: node.id, hop: node.hop, direction: node.direction, txs });
      onNodeClick?.(node.id, txs);
      fgRef.current?.centerAt(node.x, node.y, 500);
      fgRef.current?.zoom(2.4, 500);
    },
    [transactions, onNodeClick, nodeInfoMap],
  );

  const handleLinkClick = useCallback(
    (link: any) => {
      setInternalSelectedEdge(link.id);
      onEdgeClick?.({ id: link.id, txHashes: link.txHashes, lastTx: link.lastTx });
    },
    [onEdgeClick],
  );

  const handleFit = useCallback(() => {
    if (!filteredNodes.length || !fgRef.current) return;
    const xs = filteredNodes.map((n) => n.x);
    const ys = filteredNodes.map((n) => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const PADDING = 110;
    const boundsW = Math.max(maxX - minX, 1) + PADDING * 2;
    const boundsH = Math.max(maxY - minY, 1) + PADDING * 2;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const scale = Math.min(dimensions.width / boundsW, dimensions.height / boundsH);
    const clampedScale = Math.max(0.05, Math.min(scale, 3));

    fgRef.current.centerAt(centerX, centerY, 400);
    fgRef.current.zoom(clampedScale, 400);
  }, [filteredNodes, dimensions]);

  const handleReset = useCallback(() => {
    setSelectedNodeId(null);
    setInternalSelectedEdge(null);
    setDirectionFilter("all");
    setHopFilter("all");
    setPanelNode(null);
    setTimeout(() => handleFit(), 60);
  }, [handleFit]);

  const handleFocusStart = useCallback(() => {
    fgRef.current?.centerAt(0, 0, 500);
    fgRef.current?.zoom(1.6, 500);
    setSelectedNodeId(address.toLowerCase());
  }, [address]);

  const handleZoomIn = useCallback(() => fgRef.current?.zoom(fgRef.current.zoom() * 1.4, 300), []);
  const handleZoomOut = useCallback(() => fgRef.current?.zoom(fgRef.current.zoom() / 1.4, 300), []);

  useEffect(() => {
    const t = setTimeout(() => handleFit(), 350);
    return () => clearTimeout(t);
  }, [graphData, handleFit]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Toolbar */}
      <div style={toolbarStyle}>
        <span style={panelTitleStyle}>Fund Flow Graph</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
          {/* View mode toggle */}
          <div style={{ display: "flex", background: "#141c24", borderRadius: 6, padding: 2 }}>
            <button
              onClick={() => setViewMode("graph")}
              style={{
                border: "none",
                borderRadius: 4,
                padding: "5px 10px",
                fontSize: 11,
                cursor: "pointer",
                fontWeight: 600,
                background: viewMode === "graph" ? "#3fc7f4" : "transparent",
                color: viewMode === "graph" ? "#0b1016" : "#c7d2dc",
              }}
            >
              Graph View
            </button>
            <button
              onClick={() => setViewMode("block")}
              style={{
                border: "none",
                borderRadius: 4,
                padding: "5px 10px",
                fontSize: 11,
                cursor: "pointer",
                fontWeight: 600,
                background: viewMode === "block" ? "#3fc7f4" : "transparent",
                color: viewMode === "block" ? "#0b1016" : "#c7d2dc",
              }}
            >
              Block View
            </button>
          </div>

          <select style={selectStyle} value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value as any)}>
            <option value="all">All Directions</option>
            <option value="in">Inward only</option>
            <option value="out">Outward only</option>
          </select>
          <select
            style={selectStyle}
            value={hopFilter}
            onChange={(e) => setHopFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
          >
            <option value="all">All Hops</option>
            {availableHops.map((h) => (
              <option key={h} value={h}>
                Hop {h}
              </option>
            ))}
          </select>
          <button
            style={{ ...toggleWrapStyle, background: showLabels ? "#3fc7f4" : "#1c2530" }}
            onClick={() => setShowLabels((v) => !v)}
            title="Toggle labels"
          >
            <span style={{ ...toggleDotStyle, transform: showLabels ? "translateX(14px)" : "translateX(0)" }} />
          </button>
          <span style={{ fontSize: 11, color: "#8798a8", marginRight: 4 }}>Show Labels</span>
          <button style={btnStyle} onClick={handleFit}>
            <Maximize2 size={12} /> Fit
          </button>
          <button style={btnStyle} onClick={handleReset}>
            <RotateCcw size={12} /> Reset
          </button>
          <button style={iconBtnStyle} onClick={handleFocusStart} title="Focus start">
            <Focus size={13} />
          </button>
          <button style={iconBtnStyle} onClick={handleZoomOut} title="Zoom out">
            <ZoomOut size={13} />
          </button>
          <button style={iconBtnStyle} onClick={handleZoomIn} title="Zoom in">
            <ZoomIn size={13} />
          </button>
        </div>
      </div>

      {/* Legend row */}
      <div style={legendRowStyle}>
        <span style={legendItemStyle}>
          <span style={{ ...dotStyle, background: START_COLOR }} /> Start Wallet
        </span>
        <span style={legendItemStyle}>
          <span style={{ ...dotStyle, background: IN_COLOR }} /> Inward (Left)
        </span>
        <span style={legendItemStyle}>
          <span style={{ ...dotStyle, background: OUT_COLOR }} /> Outward (Right)
        </span>
      </div>

      {/* Wrapper to enclose both Views and Common EvidencePanel */}
      <div style={{ position: "relative", width: "100%" }}>
        {viewMode === "graph" ? (
          <div
            ref={containerRef}
            style={{
              position: "relative",
              height: 620,
              width: "100%",
              overflow: "hidden",
              background: "#0b1016",
              borderBottomLeftRadius: 10,
              borderBottomRightRadius: 10,
              border: "1px solid #1c2530",
              borderTop: "none",
            }}
          >
            {ForceGraph2D ? (
            <ForceGraph2D
              ref={fgRef}
              width={dimensions.width}
              height={dimensions.height}
              graphData={graphData}
              backgroundColor="#0b1016"
              nodeId="id"
              d3AlphaDecay={1}
              d3VelocityDecay={1}
              cooldownTicks={0}
              warmupTicks={0}
              enableNodeDrag={false}
              nodeRelSize={3}
              onNodeHover={(n: any) => setHoveredNode(n)}
              onRenderFramePre={(ctx: CanvasRenderingContext2D) => {
                if (!hopColumns.length) return;
                ctx.save();
                ctx.setLineDash([4, 5]);
                ctx.strokeStyle = GRID_LINE_COLOR;
                ctx.lineWidth = 1;
                ctx.font = "10px sans-serif";
                ctx.textAlign = "center";
                ctx.fillStyle = HOP_LABEL_COLOR;

                const ys = filteredNodes.map((n) => n.y);
                const topY = (ys.length ? Math.min(...ys) : -200) - 120;
                const botY = (ys.length ? Math.max(...ys) : 200) + 80;

                hopColumns.forEach((col) => {
                  ctx.beginPath();
                  ctx.moveTo(col.x, topY);
                  ctx.lineTo(col.x, botY);
                  ctx.stroke();
                  ctx.fillText(`Hop ${col.hop}`, col.x, topY - 8);
                });
                ctx.restore();
              }}
              nodeCanvasObject={(n: any, ctx) => {
                const r = n.isStart ? 14 : Math.min(5 + n.degree * 0.5, 11);
                const isSelected = n.id === selectedNodeId;
                const isHovered = hoveredNode?.id === n.id;
                const color = n.isStart
                  ? START_COLOR
                  : isSelected
                    ? SELECTED_COLOR
                    : n.direction === "in"
                      ? IN_COLOR
                      : n.direction === "out"
                        ? OUT_COLOR
                        : "#9aa7b4";

                if (n.isStart || isSelected) {
                  const glow = ctx.createRadialGradient(n.x, n.y, r * 0.6, n.x, n.y, r * 2.6);
                  glow.addColorStop(0, color + "55");
                  glow.addColorStop(1, "transparent");
                  ctx.fillStyle = glow;
                  ctx.beginPath();
                  ctx.arc(n.x, n.y, r * 2.6, 0, 2 * Math.PI);
                  ctx.fill();
                }

                ctx.beginPath();
                ctx.arc(n.x, n.y, r, 0, 2 * Math.PI, false);
                ctx.fillStyle = n.isStart ? color : "#0b1016";
                ctx.fill();
                ctx.lineWidth = n.isStart ? 3 : isSelected || isHovered ? 2.4 : 1.6;
                ctx.strokeStyle = color;
                ctx.stroke();

                if (n.isStart) {
                  ctx.beginPath();
                  ctx.arc(n.x, n.y, r * 0.4, 0, 2 * Math.PI, false);
                  ctx.fillStyle = "#0b1016";
                  ctx.fill();
                }

                if (n.isStart) {
                  ctx.font = "11px sans-serif";
                  ctx.fillStyle = "#e6edf3";
                  ctx.textAlign = "center";
                  ctx.fillText("START", n.x, n.y + r + 16);
                  ctx.font = "9px sans-serif";
                  ctx.fillStyle = "#8798a8";
                  ctx.fillText(shortAddress(n.id, 6, 4), n.x, n.y + r + 28);
                } else if (showLabels || isSelected || isHovered) {
                  ctx.font = "9px sans-serif";
                  ctx.fillStyle = "#c7d2dc";
                  ctx.textAlign = "center";
                  ctx.fillText(shortAddress(n.id, 5, 4), n.x, n.y - r - 6);
                }
              }}
              linkColor={(l: any) => (l.id === activeEdgeId ? EDGE_SELECTED_COLOR : l.direction === "in" ? EDGE_IN_COLOR : EDGE_OUT_COLOR)}
              linkWidth={(l: any) => (l.id === activeEdgeId ? 3 : Math.min(0.8 + l.count * 0.2, 3.5))}
              linkDirectionalArrowLength={5}
              linkDirectionalArrowRelPos={1}
              linkDirectionalParticles={(l: any) => (l.id === activeEdgeId ? 3 : 0)}
              linkDirectionalParticleWidth={1.4}
              linkDirectionalParticleColor={(l: any) => (l.direction === "in" ? IN_COLOR : OUT_COLOR)}
              linkCanvasObjectMode={() => "after"}
              linkCanvasObject={(l: any, ctx, globalScale) => {
                if (globalScale < 0.6) return;
                const start = l.source;
                const end = l.target;
                if (typeof start !== "object" || typeof end !== "object") return;
                const midX = (start.x + end.x) / 2;
                const midY = (start.y + end.y) / 2;
                const isActive = l.id === activeEdgeId;
                const text = `${l.count} tx · ${l.totalValue.toFixed(3)} ${l.asset ?? "ETH"}`;
                ctx.font = `${isActive ? 8.5 : 7.5}px sans-serif`;
                const textWidth = ctx.measureText(text).width;
                ctx.fillStyle = "rgba(11,16,22,0.9)";
                ctx.fillRect(midX - textWidth / 2 - 3, midY - 6, textWidth + 6, 11);
                ctx.fillStyle = isActive ? EDGE_SELECTED_COLOR : l.direction === "in" ? IN_COLOR : OUT_COLOR;
                ctx.textAlign = "center";
                ctx.fillText(text, midX, midY + 2.5);
              }}
              linkLabel={(l: any) =>
                `${l.direction === "in" ? "Inward" : "Outward"}\n${l.source} → ${l.target}\n${l.count} tx · ${l.totalValue.toFixed(6)} ${l.asset ?? "ETH"}`
              }
              nodeLabel={(n: any) =>
                n.isStart
                  ? `START WALLET${n.network === "tron" ? " (TRON)" : ""}\n${n.id}\n${n.degree} total tx`
                  : n.network === "tron"
                    ? // TRON wallets can hold several assets, so don't add TRX + USDT together
                      `${n.id}\nHop ${Math.abs(n.hop)} (TRON)\nIncoming: ${n.incoming} tx\nOutgoing: ${n.outgoing} tx`
                    : `${n.id}\nHop ${Math.abs(n.hop)} (${n.direction})\nIncoming: ${n.incoming} tx · ${n.ethIn.toFixed(6)} ETH\nOutgoing: ${n.outgoing} tx · ${n.ethOut.toFixed(6)} ETH`
              }
              onNodeClick={handleNodeClick}
              onLinkClick={handleLinkClick}
            />
            ) : null}
          </div>
        ) : (
          <BlockView
            nodes={filteredNodes}
            nodeInfoMap={nodeInfoMap}
            onNodeClick={(addr, txs) => {
              setPanelNode({
                address: addr,
                hop: nodes.find((n) => n.id === addr)?.hop ?? 0,
                direction: nodes.find((n) => n.id === addr)?.direction ?? "mixed",
                txs,
              });
              onNodeClick?.(addr, txs);
            }}
          />
        )}

        {/* Common Evidence Panel for Graph and Block views */}
        {panelNode && (
          <EvidencePanel
            address={panelNode.address}
            hop={panelNode.hop}
            direction={panelNode.direction}
            txs={panelNode.txs}
            onClose={() => {
              setPanelNode(null);
              setSelectedNodeId(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "12px 16px",
  background: "#0f151b",
  border: "1px solid #1c2530",
  borderTopLeftRadius: 10,
  borderTopRightRadius: 10,
  borderBottom: "none",
};

const panelTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "#e6edf3",
};

const legendRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 18,
  padding: "8px 16px",
  background: "#0f151b",
  borderLeft: "1px solid #1c2530",
  borderRight: "1px solid #1c2530",
};

const legendItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 11,
  color: "#8798a8",
};

const dotStyle: React.CSSProperties = {
  display: "inline-block",
  width: 8,
  height: 8,
  borderRadius: "50%",
};

const selectStyle: React.CSSProperties = {
  background: "#141c24",
  border: "1px solid #283440",
  borderRadius: 6,
  color: "#c7d2dc",
  fontSize: 11,
  padding: "6px 8px",
  cursor: "pointer",
};

const btnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  background: "#141c24",
  border: "1px solid #283440",
  borderRadius: 6,
  color: "#c7d2dc",
  fontSize: 11,
  padding: "6px 10px",
  cursor: "pointer",
};

const iconBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#141c24",
  border: "1px solid #283440",
  borderRadius: 6,
  color: "#c7d2dc",
  padding: "6px 8px",
  cursor: "pointer",
};

const toggleWrapStyle: React.CSSProperties = {
  width: 30,
  height: 16,
  borderRadius: 10,
  border: "none",
  position: "relative",
  cursor: "pointer",
  padding: 2,
};

const toggleDotStyle: React.CSSProperties = {
  display: "block",
  width: 12,
  height: 12,
  borderRadius: "50%",
  background: "#fff",
  transition: "transform 0.15s ease",
};
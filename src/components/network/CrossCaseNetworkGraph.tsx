import { useMemo } from "react";
import { ReactFlow, Background, Handle, Position, MarkerType, type Node, type Edge, type NodeProps } from "@xyflow/react";
import { AlertTriangle, Link2, Network as NetworkIcon } from "lucide-react";

export type NetworkCluster = {
  id: string;
  name: string;
  commonEntity: string;
  chains: string[];
  walletCount: number;
  complaintCount: number;
  confidence: number;
  caseIds: string[];
  flaggedCaseId?: string;
};

type ClusterNodeData = {
  label: string;
  sublabel?: string;
  kind: "case" | "hub" | "flagged-case";
};

function ClusterNode({ data }: NodeProps & { data: ClusterNodeData }) {
  const isHub = data.kind === "hub";
  const isFlagged = data.kind === "flagged-case";
  const border = isHub ? "var(--accent-cyan-dim)" : isFlagged ? "#965056" : "#35424e";
  const bg = isHub ? "var(--accent-cyan-bg)" : isFlagged ? "#3a252a" : "#181e26";
  const text = isHub ? "var(--accent-cyan-strong)" : isFlagged ? "#ef9290" : "#c4d0d9";
  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: 8,
        background: bg,
        border: `1px solid ${border}`,
        color: text,
        textAlign: "center",
        minWidth: 118,
        boxShadow: "0 6px 16px rgba(0,0,0,0.3)",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: isHub ? 9 : 10.5, fontWeight: 600, letterSpacing: isHub ? "0.06em" : "normal", textTransform: isHub ? "uppercase" : "none" }}>
        {isHub && <NetworkIcon size={11} />}
        {isFlagged && <AlertTriangle size={11} />}
        {data.label}
      </div>
      {data.sublabel && <div style={{ fontSize: 9, color: "#8798a8", marginTop: 3, fontFamily: "var(--font-mono)" }}>{data.sublabel}</div>}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { clusterNode: ClusterNode };

export function CrossCaseNetworkGraph({ cluster, onOpenCase }: { cluster: NetworkCluster; onOpenCase?: (caseId: string) => void }) {
  const { nodes, edges } = useMemo(() => {
    const topCases = cluster.caseIds.slice(0, 2);
    const bottomCase = cluster.caseIds[2];

    const hub: Node<ClusterNodeData> = {
      id: "hub",
      type: "clusterNode",
      position: { x: 90, y: 90 },
      data: { label: "Common wallet", sublabel: cluster.commonEntity, kind: "hub" },
    };

    const nodeList: Node<ClusterNodeData>[] = [hub];
    topCases.forEach((caseId, index) => {
      nodeList.push({
        id: caseId,
        type: "clusterNode",
        position: { x: index * 200, y: 0 },
        data: { label: caseId, sublabel: "Complaints", kind: "case" },
      });
    });
    if (bottomCase) {
      nodeList.push({
        id: bottomCase,
        type: "clusterNode",
        position: { x: 90, y: 190 },
        data: { label: bottomCase, sublabel: "Flagged", kind: cluster.flaggedCaseId === bottomCase ? "flagged-case" : "case" },
      });
    }

    const edgeList: Edge[] = nodeList
      .filter((n) => n.id !== "hub")
      .map((n) => ({
        id: `e-${n.id}`,
        source: n.data.kind === "flagged-case" ? "hub" : n.id,
        target: n.data.kind === "flagged-case" ? n.id : "hub",
        animated: true,
        style: { stroke: n.data.kind === "flagged-case" ? "#c96a6d" : "var(--accent-cyan-dim)", strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "var(--accent-cyan-strong)" },
      }));

    return { nodes: nodeList, edges: edgeList };
  }, [cluster]);

  return (
    <div style={{ height: 230, borderRadius: 8, overflow: "hidden", border: "1px solid #283440", background: "#131a21" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.35 }}
        proOptions={{ hideAttribution: true }}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        nodesDraggable={false}
        onNodeClick={(_, node) => { if (node.id !== "hub") onOpenCase?.(node.id); }}
      >
        <Background gap={22} size={1} color="#ffffff08" />
      </ReactFlow>
    </div>
  );
}

/* Helper: adapt existing mock network shape into NetworkCluster with 2-3 fake case ids
   if your mock.ts doesn't already have caseIds/flaggedCaseId fields. */
export function buildClusterFromNetwork(network: {
  id: string;
  name: string;
  commonEntity: string;
  chains: string[];
  walletCount: number;
  complaintCount: number;
  confidence: number;
}): NetworkCluster {
  return {
    ...network,
    caseIds: [`CASE #${10000 + Number(network.id.replace(/\D/g, "") || 1) * 7}`, `CASE #${10300 + Number(network.id.replace(/\D/g, "") || 1) * 3}`, `CASE #${10400 + Number(network.id.replace(/\D/g, "") || 1) * 5}`],
    flaggedCaseId: `CASE #${10400 + Number(network.id.replace(/\D/g, "") || 1) * 5}`,
  };
}
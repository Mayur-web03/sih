import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import type { BackendTxRecord } from "@/services/api";

type FundFlowGraphProps = {
  address: string;
  transactions: BackendTxRecord[];
  onNodeClick?: (walletAddr: string, txs: BackendTxRecord[]) => void;
  onEdgeClick?: (edge: { id: string; txHashes: string[]; lastTx: BackendTxRecord }) => void;
  selectedEdgeId?: string | null;
};

export function FundFlowGraph(props: FundFlowGraphProps) {
  const [Comp, setComp] = useState<ComponentType<FundFlowGraphProps> | null>(null);

  useEffect(() => {
    // Runs ONLY in the browser. Guarantees force-graph (which touches
    // `window` at module top-level) is never imported during SSR.
    let cancelled = false;
    import("./FundFlowGraphInner").then((mod) => {
      if (!cancelled) setComp(() => mod.FundFlowGraph);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Comp) {
    return (
      <div
        style={{
          height: 620,
          display: "grid",
          placeItems: "center",
          color: "#758697",
          fontSize: 12,
          border: "1px solid #283440",
          borderRadius: 8,
          background: "#0d1319",
        }}
      >
        Loading graph engine...
      </div>
    );
  }

  return <Comp {...props} />;
}
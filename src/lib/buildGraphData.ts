import dagre from "dagre";
import { weiToEthNumber } from "@/lib/format";
import type { BackendTxRecord } from "@/services/api";

export type GraphNode = {
  id: string;
  address: string;
  hop: number;
  degree: number;
  incoming: number;
  outgoing: number;
  ethIn: number;
  ethOut: number;
  isStart: boolean;
  direction: "in" | "out" | "mixed";
  network: "ethereum" | "tron";
  x: number;
  y: number;
  fx: number;
  fy: number;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  txHashes: string[];
  totalValue: number;
  /** "ETH" for Ethereum, "TRX" / "USDT" / ... for TRON */
  asset: string;
  network: "ethereum" | "tron";
  hop: number;
  direction: "in" | "out";
  count: number;
  timestamp: string;
  lastTx: BackendTxRecord;
};

type NodeInfo = {
  hop: number;
  direction: "in" | "out" | "mixed";
  txs: BackendTxRecord[];
  incoming: number;
  outgoing: number;
  ethIn: number;
  ethOut: number;
};

const isInward = (d: string) => d === "in" || d === "inward";

// TRON Base58 address. Ethereum addresses start with 0x, so this never
// matches an Ethereum address.
const TRON_ADDR_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

export function buildGraphData(address: string, transactions: BackendTxRecord[]) {
  const isTron = TRON_ADDR_RE.test(address.trim());
  const network: "ethereum" | "tron" = isTron ? "tron" : "ethereum";

  // Ethereum addresses are case-insensitive -> lowercase (existing behaviour).
  // TRON Base58 addresses are CASE-SENSITIVE -> must NOT be lowercased.
  const norm = (a?: string) => (a ? (isTron ? a.trim() : a.toLowerCase()) : a);

  // Ethereum: value is wei. TRON: value is already a decimal amount.
  const amountOf = (tx: BackendTxRecord) =>
    isTron ? Number(tx.value || 0) || 0 : weiToEthNumber(tx.value);

  const startId = norm(address) as string;

  const nodeMap = new Map<string, NodeInfo>();
  const edgeMap = new Map<string, GraphEdge>();

  transactions.forEach((tx) => {
    const direction: "in" | "out" = isInward(tx.direction) ? "in" : "out";
    const counterparty = norm(direction === "in" ? tx.from : tx.to);
    const from = norm(tx.from);
    const to = norm(tx.to);
    const value = amountOf(tx);
    const hop = Math.max(1, Number(tx.hop) || 1);
    const asset = isTron ? tx.asset || "TRX" : "ETH";

    if (counterparty && counterparty !== startId) {
      const existing = nodeMap.get(counterparty);
      const isIncomingToCounterparty = to === counterparty;
      if (existing) {
        existing.txs.push(tx);
        existing.hop = Math.min(existing.hop, hop);
        if (existing.direction !== direction) existing.direction = "mixed";
        if (isIncomingToCounterparty) {
          existing.incoming += 1;
          existing.ethIn += value;
        } else {
          existing.outgoing += 1;
          existing.ethOut += value;
        }
      } else {
        nodeMap.set(counterparty, {
          hop,
          direction,
          txs: [tx],
          incoming: isIncomingToCounterparty ? 1 : 0,
          outgoing: isIncomingToCounterparty ? 0 : 1,
          ethIn: isIncomingToCounterparty ? value : 0,
          ethOut: isIncomingToCounterparty ? 0 : value,
        });
      }
    }

    if (!from || !to) return;

    // TRON: keep TRX and each token (USDT, ...) as separate edges so
    // different assets are never added together.
    const edgeKey = isTron ? `${from}->${to}:${asset}` : `${from}->${to}`;
    const existingEdge = edgeMap.get(edgeKey);
    if (existingEdge) {
      existingEdge.txHashes.push(tx.tx_hash);
      existingEdge.totalValue += value;
      existingEdge.count += 1;
      existingEdge.hop = Math.min(existingEdge.hop, hop);
      if (new Date(existingEdge.timestamp) < new Date(tx.timestamp)) {
        existingEdge.timestamp = tx.timestamp;
        existingEdge.lastTx = tx;
      }
    } else {
      edgeMap.set(edgeKey, {
        id: edgeKey,
        source: from,
        target: to,
        txHashes: [tx.tx_hash],
        totalValue: value,
        asset,
        network,
        hop,
        direction,
        count: 1,
        timestamp: tx.timestamp,
        lastTx: tx,
      });
    }
  });

  const edges = Array.from(edgeMap.values());

  const buildSubgraph = (direction: "in" | "out") => {
    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: "LR",
      nodesep: 55,
      ranksep: 260,
      marginx: 20,
      marginy: 20,
    });
    g.setDefaultEdgeLabel(() => ({}));

    g.setNode(startId, { width: 26, height: 26 });

    nodeMap.forEach((info, addr) => {
      const dir = info.direction === "mixed" ? "out" : info.direction;
      if (dir !== direction) return;
      const size = Math.min(14 + info.txs.length * 1.5, 40);
      g.setNode(addr, { width: size, height: size });
    });

    edges
      .filter((e) => e.direction === direction)
      .forEach((e) => {
        if (g.hasNode(e.source) && g.hasNode(e.target)) g.setEdge(e.source, e.target);
      });

    dagre.layout(g);
    return g;
  };

  const inGraph = buildSubgraph("in");
  const outGraph = buildSubgraph("out");

  const startInPos = inGraph.node(startId);
  const startOutPos = outGraph.node(startId);

  const nodePos = new Map<string, { x: number; y: number }>();
  nodePos.set(startId, { x: 0, y: 0 });

  outGraph.nodes().forEach((id) => {
    if (id === startId) return;
    const p = outGraph.node(id);
    nodePos.set(id, { x: p.x - startOutPos.x, y: p.y - startOutPos.y });
  });

  inGraph.nodes().forEach((id) => {
    if (id === startId) return;
    const p = inGraph.node(id);
    nodePos.set(id, { x: -(p.x - startInPos.x), y: p.y - startInPos.y });
  });

  const nodes: GraphNode[] = [
    {
      id: startId,
      address: startId,
      hop: 0,
      degree: transactions.length,
      incoming: transactions.filter((t) => isInward(t.direction)).length,
      outgoing: transactions.filter((t) => !isInward(t.direction)).length,
      ethIn: transactions.filter((t) => isInward(t.direction)).reduce((s, t) => s + amountOf(t), 0),
      ethOut: transactions.filter((t) => !isInward(t.direction)).reduce((s, t) => s + amountOf(t), 0),
      isStart: true,
      direction: "mixed",
      network,
      x: 0,
      y: 0,
      fx: 0,
      fy: 0,
    },
  ];

  nodeMap.forEach((info, addr) => {
    const dir = info.direction === "mixed" ? "out" : info.direction;
    const pos = nodePos.get(addr) ?? { x: 0, y: 0 };
    nodes.push({
      id: addr,
      address: addr,
      hop: dir === "in" ? -info.hop : info.hop,
      degree: info.txs.length,
      incoming: info.incoming,
      outgoing: info.outgoing,
      ethIn: info.ethIn,
      ethOut: info.ethOut,
      isStart: false,
      direction: dir,
      network,
      x: pos.x,
      y: pos.y,
      fx: pos.x,
      fy: pos.y,
    });
  });

  return { nodes, edges, nodeInfoMap: nodeMap };
}
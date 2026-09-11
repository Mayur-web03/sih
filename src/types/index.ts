export type Chain = "Ethereum" | "TRON" | "Bitcoin" | "BNB Chain" | "Polygon";

export type CaseStatus = "New" | "Investigating" | "Action Required" | "Frozen" | "Closed" | "Review";
export type Priority = "Critical" | "High" | "Medium" | "Low";
export type RiskLevel = "high" | "medium" | "low";

export type NodeType = "victim" | "wallet" | "bridge" | "mixer" | "vasp" | "dex" | "contract";

export interface TraceStreamEvent {
  type: "log" | "progress" | "done" | "error";
  message: string;
}

export interface BackendTransaction {
  hop: number;
  direction: "in" | "out";
  from: string;
  to: string;
  value: string;
  tx_hash: string;
  block_number: number;
  timestamp: string | number;
  gas_used: string;
  gas_price: string;
  is_error: boolean;
  source_address: string;
}

export interface TraceResponse {
  address: string;
  summary: {
    inward_transactions: number;
    outward_transactions: number;
    total_transactions: number;
    max_hops: number;
  };
  inward: BackendTransaction[];
  outward: BackendTransaction[];
}

export interface Case {
  id: string;
  complaintId: string;
  relatedComplaintIds: string[];
  primaryWallet: string;
  chain: Chain;
  chains: Chain[];
  amountInr: number;
  riskScore: number;
  status: CaseStatus;
  priority: Priority;
  relatedCaseIds: string[];
  relatedWalletCount: number;
  assignedInvestigator: string;
  createdAt: string;
  updatedAt: string;
  victimName: string;
  fraudType: string;
  summary: string;
}

export interface Wallet {
  address: string;
  chain: Chain;
  label?: string;
  entity: string;
  entityType: NodeType;
  firstSeen: string;
  lastSeen: string;
  balanceInr: number;
  riskScore: number;
  txCount: number;
  reason: string;
  linkedCaseIds: string[];
  tags: string[];
}

export interface Transaction {
  hash: string;
  chain: Chain;
  from: string;
  fromLabel: string;
  to: string;
  toLabel: string;
  amountInr: number;
  asset: string;
  amountAsset: number;
  timestamp: string;
  hop: number;
  eventType: "transfer" | "bridge" | "mixer" | "dex" | "vasp-deposit";
  suspicious: boolean;
}

export interface VaspCandidate {
  id: string;
  name: string;
  confidence: number;
  chain: Chain;
  linkedCases: number;
  jurisdiction: string;
  registryStatus: "FIU-IND registered" | "Foreign VASP" | "Unregistered";
  evidence: { label: string; weight: number; description: string }[];
}

export interface RiskFactor {
  id: string;
  label: string;
  score: number;
  max: number;
  explanation: string;
  evidenceRef: string;
}

export interface EvidenceEvent {
  id: string;
  caseId: string;
  timestamp: string;
  event: string;
  source: string;
  evidence: string;
  evidenceType: "TxID" | "Contract" | "Cluster" | "Score" | "Complaint" | "Address";
  methodology: string;
  investigator: string;
  hash: string;
  notes: string;
}

export interface InvestigatorNote {
  id: string;
  caseId: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface GraphNodeData {
  label: string;
  type: NodeType;
  address: string;
  chain: Chain;
  riskScore?: number;
  amountInr?: number;
  sublabel?: string;
  [key: string]: unknown;
}

export interface GraphEdgeData {
  amountInr: number;
  asset: string;
  txHash: string;
  suspicious?: boolean;
  [key: string]: unknown;
}

export interface Network {
  id: string;
  name: string;
  confidence: number;
  walletCount: number;
  complaintCount: number;
  vaspCount: number;
  chains: Chain[];
  totalAmountInr: number;
  commonEntity: string;
  caseIds: string[];
}

export interface ActivityEvent {
  time: string;
  label: string;
  caseId: string;
  kind: "complaint" | "trace" | "bridge" | "risk" | "case" | "vasp" | "freeze";
}

export interface BridgeEvent {
  contract: string;
  timestamp: string;
  amountInr: number;
  sourceChain: Chain;
  destinationChain: Chain;
  confidenceBefore: number;
  confidenceAfter: number;
  protocol: string;
}

export interface MixerEvent {
  detectedAt: string;
  amountInr: number;
  txHash: string;
  service: string;
  reason: string;
  riskDelta: number;
  confidenceDelta: number;
}

export interface Investigator {
  id: string;
  name: string;
  designation: string;
  unit: string;
  email: string;
}
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  ClipboardList,
  Database,
  FileText,
  Filter,
  GitBranch,
  LayoutDashboard,
  Menu,
  Network as NetworkIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  WalletCards,
  Zap,
} from "lucide-react";

import { chainDistribution, dashboardStats, integrations, weeklyTrend } from "@/data/mock";
import { formatDate, formatDateTime, formatInr, normalizeTimestamp, shortAddress, weiToEth } from "@/lib/format";
import { RiskBadge, RiskBar } from "@/components/shared/RiskBadge";
import { FundFlowGraph } from "@/components/investigation/FundFlowGraphInner";
import { CrossCaseNetworkGraph } from "@/components/network/CrossCaseNetworkGraph";
import {
  streamTrace,
  traceTronWallet,
  isTronAddress,
  isEthereumAddress,
  type TraceNetwork,
  type TronAssetType,
} from "@/services/api";
import {
  createCase,
  listCases,
  updateCase,
  getCaseTransactions,
  type ApiCase,
} from "@/services/casesApi";
import { riskEngine, type RiskAssessment } from "@/services/risk/RiskEngine";
import { TerminalLog } from "@/components/investigation/TerminalLog";
import type { TraceResponse } from "@/types";

import { downloadCaseReport } from "@/services/reportsApi";
import {
  createFreezeRequest,
  downloadFreezeRequest,
  getCaseFreezeRequests,
  getFreezeRequestAudit,
  moveFreezeRequestToReview,
  approveFreezeRequest,
  rejectFreezeRequest,
  executeFreezeRequest,
  type FreezeRequest,
  type FreezeRequestAudit,
} from "@/services/freezeRequestsApi";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && localStorage.getItem("ct_auth") !== "true") {
      throw redirect({ to: "/login" });
    }
  },
  component: Index,
});

type View =
  | "overview"
  | "cases"
  | "trace"
  | "risk"
  | "vasp"
  | "timeline"
  | "networks"
  | "evidence"
  | "reports"
  | "integrations";
type CaseFilter = "All" | "Investigating" | "Action Required" | "Closed";
type Metric = { label: string; value: number; delta: string; icon: typeof ClipboardList; color: string };

function Index() {
  const [view, setView] = useState<View>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [caseFilter, setCaseFilter] = useState<CaseFilter>("All");
  const [drawer, setDrawer] = useState<{ title: string; body: string } | null>(null);
  const [newInvestigationOpen, setNewInvestigationOpen] = useState(false);

  const [cases, setCases] = useState<ApiCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(true);
  const [casesError, setCasesError] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");

  const fetchCases = () => {
    setCasesLoading(true);
    setCasesError("");
    listCases()
      .then((result) => {
        setCases(result);
        setSelectedCaseId((prev) => (result.some((c) => c.id === prev) ? prev : (result[0]?.id ?? "")));
      })
      .catch((err) => setCasesError(err instanceof Error ? err.message : "Failed to load cases"))
      .finally(() => setCasesLoading(false));
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const selectedCase = cases.find((item) => item.id === selectedCaseId) ?? null;

  const nav: { id: View; label: string; icon: typeof ClipboardList; count?: number }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "cases", label: "Cases", icon: ClipboardList, count: cases.length },
    { id: "trace", label: "Investigation workspace", icon: GitBranch },
    { id: "risk", label: "Risk analysis", icon: ShieldCheck },
    { id: "vasp", label: "VASP attribution", icon: Database },
    { id: "timeline", label: "Timeline", icon: Activity },
    { id: "networks", label: "Networks", icon: NetworkIcon },
    { id: "evidence", label: "Evidence", icon: FileText },
    { id: "reports", label: "Reports & requests", icon: Zap },
  ];

  const [walletInput, setWalletInput] = useState("");
  const [maxHops, setMaxHops] = useState<number>(5);
  const [traceResult, setTraceResult] = useState<TraceResponse | null>(null);
  const [tracedAddress, setTracedAddress] = useState<string>("");
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceLogs, setTraceLogs] = useState<string[]>([]);
  const [traceError, setTraceError] = useState("");
  const [network, setNetwork] = useState<TraceNetwork>("ethereum");
  const [tronAssetType, setTronAssetType] = useState<TronAssetType>("all");

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  const goToCase = async (id: string, nextView: View = "trace") => {
    setSelectedCaseId(id);
    setView(nextView);
    setMobileMenu(false);

    const selected = cases.find((c) => c.id === id);

    if (!selected) {
      return;
    }

    // Load the wallet into Investigation
    setWalletInput(selected.primary_wallet);
    setNetwork(isTronAddress(selected.primary_wallet) ? "tron" : "ethereum");

    try {
      const txs = await getCaseTransactions(id);

      if (!txs.length) {
        setTraceResult(null);
        setTracedAddress(selected.primary_wallet);
        return;
      }

      const inward = txs
        .filter((tx) => tx.direction === "inward" || tx.direction === "in")
        .map((tx) => ({
          tx_hash: tx.tx_hash,
          from: tx.from_address,
          to: tx.to_address,
          value: tx.value_wei,
          hop: tx.hop,
          direction: tx.direction,
          block_number: tx.block_number,
          timestamp: tx.timestamp,
          is_error: tx.is_error,
        }));

      const outward = txs
        .filter((tx) => tx.direction === "outward" || tx.direction === "out")
        .map((tx) => ({
          tx_hash: tx.tx_hash,
          from: tx.from_address,
          to: tx.to_address,
          value: tx.value_wei,
          hop: tx.hop,
          direction: tx.direction,
          block_number: tx.block_number,
          timestamp: tx.timestamp,
          is_error: tx.is_error,
        }));

      const maxHop = Math.max(
        0,
        ...txs.map((tx) => Number(tx.hop) || 0)
      );

      setTraceResult({
        address: selected.primary_wallet,
        summary: {
          inward_transactions: inward.length,
          outward_transactions: outward.length,
          total_transactions: txs.length,
          max_hops: maxHop,
        },
        inward,
        outward,
      });

      setTracedAddress(selected.primary_wallet);
      setMaxHops(Math.min(10, Math.max(1, maxHop || 1)));
    } catch (err) {
      console.error("Failed to load case transactions:", err);
      setTraceResult(null);
      setTraceError(
        err instanceof Error
          ? err.message
          : "Failed to load saved case transactions"
      );
    }
  };

  return (
    <div className="app-frame">
      <aside className={`sidebar ${sidebarOpen ? "" : "sidebar-collapsed"} ${mobileMenu ? "mobile-visible" : ""}`}>
                <div className="brand">
          <div className="brand-mark">
            <img
              src="/favicon.png"
              alt="CryptoTrace logo"
              style={{ width: 40, height: 40, objectFit: "contain", display: "block" }}
            />
          </div>
          {sidebarOpen && (
            <div>
              <strong>CryptoTrace</strong>
              <span>INVESTIGATION OS</span>
            </div>
          )}
          <button className="icon-button sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Collapse navigation">
            <PanelLeftClose size={17} />
          </button>
        </div>
        {sidebarOpen && (
          <div className="workspace-switch">
            <span className="status-dot" /> Maharashtra Cyber Cell <ChevronDown size={14} />
          </div>
        )}
        <nav className="nav-list">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${view === item.id ? "active" : ""}`}
                onClick={() => {
                  setView(item.id as View);
                  setMobileMenu(false);
                }}
                title={item.label}
              >
                <Icon size={17} />
                <span>{sidebarOpen && item.label}</span>
                {sidebarOpen && item.count && <b>{item.count}</b>}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setView("integrations")}>
            <Settings size={17} />
            <span>{sidebarOpen && "Integrations & settings"}</span>
          </button>
          {sidebarOpen && (
            <div className="analyst">
              <div className="avatar">AP</div>
              <div>
                <strong>Admin Portal</strong>
                <span>Cyber Crime Cell</span>
              </div>
              <ChevronDown size={14} />
            </div>
          )}
        </div>
      </aside>
      <main className="main-shell">
        <header className="topbar">
          <button className="icon-button mobile-menu-button" onClick={() => setMobileMenu(true)}>
            <Menu size={19} />
          </button>
          {!sidebarOpen && (
            <button className="icon-button desktop-expand" onClick={() => setSidebarOpen(true)}>
              <PanelLeftOpen size={18} />
            </button>
          )}
          <div className="crumb">
            <span>Investigation workspace</span>
            <ChevronDown size={14} />
          </div>
          <div className="top-actions">
            <label className="global-search">
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search cases, wallets, transactions"
              />
              <kbd>⌘ K</kbd>
            </label>
            <button className="icon-button notification" aria-label="Notifications" onClick={() => showToast("No new critical alerts")}>
              <Bell size={18} />
              <i />
            </button>
            <div className="avatar top-avatar">AP</div>
          </div>
        </header>
        <div className="content-wrap">
          <PageHeader view={view} selectedCase={selectedCase} onNew={() => setNewInvestigationOpen(true)} />
          {view === "overview" && (
            <Overview
              cases={cases}
              loading={casesLoading}
              error={casesError}
              onRetry={fetchCases}
              onOpenCase={goToCase}
              onViewCases={() => setView("cases")}
            />
          )}
          {view === "cases" && (
            <CasesView
              cases={cases}
              loading={casesLoading}
              error={casesError}
              onRetry={fetchCases}
              query={search}
              filter={caseFilter}
              onFilterChange={setCaseFilter}
              onOpenCase={goToCase}
            />
          )}
          {view === "trace" && (
            <TraceView
              selectedCase={selectedCase}
              walletInput={walletInput}
              setWalletInput={setWalletInput}
              maxHops={maxHops}
              setMaxHops={setMaxHops}
              network={network}
              setNetwork={setNetwork}
              tronAssetType={tronAssetType}
              setTronAssetType={setTronAssetType}
              traceResult={traceResult}
              tracedAddress={tracedAddress}
              loading={traceLoading}
              setLoading={setTraceLoading}
              logs={traceLogs}
              setLogs={setTraceLogs}
              error={traceError}
              setError={setTraceError}
              onToast={showToast}
              onTraceComplete={(result, addr) => {
                setTraceResult(result);
                setTracedAddress(addr);
              }}
            />
          )}
          {view === "risk" && <RiskView selectedCase={selectedCase} traceResult={traceResult} tracedAddress={tracedAddress} />}
          {view === "vasp" && <VaspView traceResult={traceResult} tracedAddress={tracedAddress} onOpen={(title, body) => setDrawer({ title, body })} />}
          {view === "timeline" && <TimelineView traceResult={traceResult} tracedAddress={tracedAddress} />}
          {view === "networks" && <NetworksView cases={cases} traceResult={traceResult} tracedAddress={tracedAddress} onOpenCase={goToCase} />}
          {view === "evidence" && (
            <EvidenceView traceResult={traceResult} tracedAddress={tracedAddress} onToast={showToast} onOpen={(title, body) => setDrawer({ title, body })} />
          )}
          {view === "reports" && <ReportsView selectedCase={selectedCase} traceResult={traceResult} tracedAddress={tracedAddress} onToast={showToast} />}
          {view === "integrations" && <IntegrationsView onToast={showToast} />}
        </div>
      </main>
      {toast && (
        <div className="toast">
          <Check size={16} /> {toast}
        </div>
      )}
      {mobileMenu && <button className="mobile-scrim" onClick={() => setMobileMenu(false)} aria-label="Close menu" />}
      {drawer && <DetailDrawer title={drawer.title} body={drawer.body} onClose={() => setDrawer(null)} />}
      {newInvestigationOpen && (
        <NewInvestigationDialog
          onClose={() => setNewInvestigationOpen(false)}
          onSubmit={(createdCase) => {
            setNewInvestigationOpen(false);
            fetchCases();
            setSelectedCaseId(createdCase.id);
            showToast("Investigation intake created and trace queued");
          }}
        />
      )}
    </div>
  );
}

function PageHeader({ view, selectedCase, onNew }: { view: View; selectedCase: ApiCase | null; onNew: () => void }) {
  const labels: Record<View, string> = {
    overview: "Overview",
    cases: "Cases",
    trace: "Investigation workspace",
    risk: "Risk analysis",
    vasp: "VASP attribution",
    timeline: "Timeline",
    networks: "Networks",
    evidence: "Evidence ledger",
    reports: "Reports & requests",
    integrations: "Integrations & settings",
  };
  return (
    <div className="page-header">
      <div>
        <p className="eyebrow">I4C / DIGITAL ASSET INTELLIGENCE</p>
        <h1>{labels[view]}</h1>
        <p className="page-subtitle">
          {view === "overview" || !selectedCase
            ? "Operational picture across active investigations and wallet risk."
            : `${selectedCase.id} · ${selectedCase.victim_name ?? "Unnamed complainant"}`}
        </p>
      </div>
      <div className="header-actions">
        <span className="sync-state">
          <span className="status-dot" /> Indexers synced 4 min ago
        </span>
        {view === "overview" && (
          <button className="primary-button" onClick={onNew}>
            <Plus size={16} /> New investigation
          </button>
        )}
      </div>
    </div>
  );
}

function SectionHeading({ title, meta, onClick }: { title: string; meta?: React.ReactNode; onClick?: () => void }) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {meta && (
        <button onClick={onClick}>
          {meta} {onClick && <ArrowRight size={13} />}
        </button>
      )}
    </div>
  );
}

function CaseRow({ item, onClick }: { item: ApiCase; onClick: () => void }) {
  return (
    <button className="case-row" onClick={onClick}>
      <div className="case-priority" data-priority={item.priority ?? "Low"} />
      <div className="case-row-main">
        <strong>{item.id}</strong>
        <span>{item.fraud_type ?? "Unclassified"}</span>
      </div>
      <div className="case-row-amount">
        {formatInr(item.amount_inr ?? 0, true)}
        <small>{item.chain ?? "—"}</small>
      </div>
      <RiskBadge score={item.risk_score ?? 0} />
      <ArrowRight size={15} />
    </button>
  );
}

function Overview({
  cases,
  loading,
  error,
  onRetry,
  onOpenCase,
  onViewCases,
}: {
  cases: ApiCase[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onOpenCase: (id: string) => void;
  onViewCases: () => void;
}) {
  if (loading) {
    return (
      <div className="view-stack">
        <div className="empty-state">
          <ClipboardList size={22} />
          <strong>Loading cases…</strong>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="view-stack">
        <div className="alert-box">
          <AlertTriangle size={16} />
          <div>
            <strong>Couldn't load cases</strong>
            <p>{error}</p>
          </div>
        </div>
        <button className="secondary-button" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  const metrics: Metric[] = [
    { label: "Active cases", value: dashboardStats.activeCases.value, delta: dashboardStats.activeCases.delta, icon: ClipboardList, color: "blue" },
    { label: "High-risk wallets", value: dashboardStats.highRiskWallets.value, delta: dashboardStats.highRiskWallets.delta, icon: WalletCards, color: "red" },
    { label: "VASP attribution hits", value: dashboardStats.vaspHits.value, delta: dashboardStats.vaspHits.delta, icon: Database, color: "amber" },
    { label: "Pending actions", value: dashboardStats.pendingActions.value, delta: dashboardStats.pendingActions.delta, icon: AlertTriangle, color: "green" },
  ];
  return (
    <div className="view-stack">
      <section className="metric-grid">
        {metrics.map(({ label, value, delta, icon: Icon, color }) => (
          <div className="metric-card" key={label}>
            <div className={`metric-icon ${color}`}>
              <Icon size={18} />
            </div>
            <div>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{delta}</small>
            </div>
          </div>
        ))}
      </section>
      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <SectionHeading title="Investigation volume" meta="Last 7 days" />
          <div className="chart-legend">
            <span>
              <i className="legend-blue" /> Cases
            </span>
            <span>
              <i className="legend-red" /> High risk
            </span>
          </div>
          <div className="bar-chart">
            {weeklyTrend.map((day) => (
              <div className="bar-group" key={day.day}>
                <div className="bars">
                  <i style={{ height: `${day.cases * 3.2}px` }} />
                  <i style={{ height: `${day.highRisk * 9}px` }} />
                </div>
                <small>{day.day}</small>
              </div>
            ))}
          </div>
        </section>
        <section className="panel distribution-panel">
          <SectionHeading title="Exposure by chain" meta="124 active cases" />
          {chainDistribution.map((item) => (
            <div className="distribution-row" key={item.chain}>
              <div>
                <span>{item.chain}</span>
                <b>{item.value}%</b>
              </div>
              <div className="track">
                <i style={{ width: `${item.value * 2}%` }} />
              </div>
            </div>
          ))}
        </section>
      </div>
      <div className="dashboard-grid lower-grid">
        <section className="panel">
          <SectionHeading title="Priority queue" meta="View all" onClick={onViewCases} />
          {cases.slice(0, 4).map((item) => (
            <CaseRow key={item.id} item={item} onClick={() => onOpenCase(item.id)} />
          ))}
        </section>
        <section className="panel activity-panel">
          <SectionHeading title="Recent activity" meta="Live feed" />
          <div className="activity-list">
            {[
              "Trace completed · 5 hops",
              "VASP candidate identified",
              "Bridge event detected",
              "Preservation request pending",
              "New complaint ingested",
            ].map((label, index) => (
              <div className="activity-row" key={label}>
                <span className={`activity-dot dot-${index}`} />
                <div>
                  <strong>{label}</strong>
                  <small>
                    {[
                      "NCRP-2026-1234",
                      "NCRP-2026-1234",
                      "NCRP-2026-1102",
                      "NCRP-2026-1102",
                      "NCRP-2026-1054",
                    ][index]}
                  </small>
                </div>
                <time>{["09:38", "07:55", "09:31", "08:15", "20:05"][index]}</time>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function CasesView({
  cases,
  loading,
  error,
  onRetry,
  query,
  filter,
  onFilterChange,
  onOpenCase,
}: {
  cases: ApiCase[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  query: string;
  filter: CaseFilter;
  onFilterChange: (filter: CaseFilter) => void;
  onOpenCase: (id: string) => void;
}) {
  const filters: CaseFilter[] = ["All", "Investigating", "Action Required", "Closed"];
  const filtered = cases.filter(
    (item) =>
      (filter === "All" || item.status === filter) &&
      `${item.id} ${item.fraud_type ?? ""} ${item.primary_wallet}`.toLowerCase().includes(query.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="view-stack">
        <div className="empty-state">
          <ClipboardList size={22} />
          <strong>Loading cases…</strong>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="view-stack">
        <div className="alert-box">
          <AlertTriangle size={16} />
          <div>
            <strong>Couldn't load cases</strong>
            <p>{error}</p>
          </div>
        </div>
        <button className="secondary-button" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="view-stack">
      <div className="toolbar">
        <div className="filter-pills">
          {filters.map((item) => (
            <button
              key={item}
              className={`filter-pill ${filter === item ? "active" : ""}`}
              onClick={() => onFilterChange(item)}
            >
              {item === "All" ? "All cases" : item}{" "}
              <b>{item === "All" ? cases.length : cases.filter((caseItem) => caseItem.status === item).length}</b>
            </button>
          ))}
        </div>
        <button className="secondary-button" onClick={() => onFilterChange("All")}>
          <Filter size={15} /> Reset filters
        </button>
      </div>
      <section className="panel table-panel">
        <div className="table-header">
          <span>Case / complaint</span>
          <span>Exposure</span>
          <span>Status</span>
          <span>Risk</span>
          <span>Updated</span>
          <span />
        </div>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <ClipboardList size={22} />
            <strong>No cases match this view</strong>
            <span>Try another status or search term.</span>
          </div>
        ) : (
          filtered.map((item) => (
            <button className="table-row" key={item.id} onClick={() => onOpenCase(item.id)}>
              <div>
                <strong>{item.id}</strong>
                <small>{item.complaint_id ?? "—"}</small>
              </div>
              <div>
                <b>{formatInr(item.amount_inr ?? 0, true)}</b>
                <small>{item.chain ?? "—"}</small>
              </div>
              <div>
                <span className={`status-tag status-${(item.status ?? "new").toLowerCase().replaceAll(" ", "-")}`}>
                  {item.status ?? "New"}
                </span>
              </div>
              <RiskBadge score={item.risk_score ?? 0} showLabel />
              <div>
                <b>{item.updated_at ? formatDate(item.updated_at) : "—"}</b>
                <small>{(item.assigned_investigator ?? "Unassigned").replace("Insp. ", "")}</small>
              </div>
              <ArrowRight size={16} />
            </button>
          ))
        )}
      </section>
    </div>
  );
}

// Amount label that works for both networks.
// Ethereum: value is wei. TRON: value is already a decimal amount.
function txAmountLabel(tx: any): string {
  if (tx?.network === "tron") return `${tx.value} ${tx.asset ?? "TRX"}`;
  return `${weiToEth(tx.value)} ETH`;
}

function TraceView({
  selectedCase,
  walletInput,
  setWalletInput,
  maxHops,
  setMaxHops,
  network,
  setNetwork,
  tronAssetType,
  setTronAssetType,
  traceResult,
  tracedAddress,
  loading,
  setLoading,
  logs,
  setLogs,
  error,
  setError,
  onToast,
  onTraceComplete,
}: {
  selectedCase: ApiCase | null;
  walletInput: string;
  setWalletInput: (v: string) => void;
  maxHops: number;
  setMaxHops: (v: number) => void;
  network: TraceNetwork;
  setNetwork: (v: TraceNetwork) => void;
  tronAssetType: TronAssetType;
  setTronAssetType: (v: TronAssetType) => void;
  traceResult: TraceResponse | null;
  tracedAddress: string;
  loading: boolean;
  setLoading: (v: boolean) => void;
  logs: string[];
  setLogs: React.Dispatch<React.SetStateAction<string[]>>;
  error: string;
  setError: (v: string) => void;
  onToast: (text: string) => void;
  onTraceComplete: (result: TraceResponse, address: string) => void;
}) {
  const allTx = traceResult ? [...(traceResult.inward || []), ...(traceResult.outward || [])] : [];

  const tracedNetworkLabel = isTronAddress(tracedAddress) ? "TRON" : "Ethereum";

  const handleNetworkChange = (next: TraceNetwork) => {
    if (next === network) return;
    setNetwork(next);
    setError("");
    // TRON tracing is heavier (many API calls per hop) -> keep hops small by default
    if (next === "tron" && maxHops > 5) setMaxHops(2);
  };

  const handleAnalyze = () => {
    setError("");

    // ---------------- TRON ----------------
    if (network === "tron") {
      const addr = walletInput.trim();
      if (!isTronAddress(addr)) {
        setError(
          isEthereumAddress(addr)
            ? "This looks like an Ethereum address. Switch the network to Ethereum, or enter a TRON address (T...)."
            : "Invalid wallet address. Enter a valid TRON address (T...)."
        );
        return;
      }

      setLoading(true);
      setLogs([
        "Tracing TRON wallet...",
        "Fetching transactions from TronGrid...",
        "Building investigation graph...",
      ]);

      traceTronWallet(addr, maxHops, tronAssetType)
        .then((res) => {
          onTraceComplete(res as unknown as TraceResponse, addr);
          onToast(
            res.summary.total_transactions > 0
              ? `Traced ${res.summary.total_transactions} TRON transactions`
              : "No transactions found for this wallet."
          );
        })
        .catch((err) => {
          setError(
            err instanceof TypeError
              ? "Unable to connect to investigation server."
              : err instanceof Error
                ? err.message
                : "TRON investigation failed. Please try again."
          );
        })
        .finally(() => setLoading(false));
      return;
    }

    // ---------------- Ethereum (existing flow, unchanged) ----------------
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletInput.trim())) {
      setError(
        isTronAddress(walletInput)
          ? "This looks like a TRON address. Switch the network to TRON."
          : "Invalid wallet address. Enter a valid Ethereum address (0x...)."
      );
      return;
    }
    setLoading(true);
    setLogs([]);

    streamTrace(
      walletInput.trim(),
      maxHops,
      (e: any) => {
        const msg = typeof e === "string" ? e : e?.message || String(e);
        setLogs((prev) => [...prev, msg]);
      },
      (resultData: any) => {
        const res = resultData as TraceResponse;

        onTraceComplete(res, walletInput.trim());

        const allTx = [...(res.inward || []), ...(res.outward || [])];

        if (selectedCase && allTx.length > 0) {
          const incoming = allTx.filter(
            (t) => (t.direction as string) === "inward" || (t.direction as string) === "in"
          );

          const outgoing = allTx.filter(
            (t) => (t.direction as string) === "outward" || (t.direction as string) === "out"
          );

          const ethIn = incoming.reduce(
            (s, t) => s + Number(t.value || 0) / 1e18,
            0
          );

          const ethOut = outgoing.reduce(
            (s, t) => s + Number(t.value || 0) / 1e18,
            0
          );

          const assessment = riskEngine.calculateWalletRisk({
            incoming: incoming.length,
            outgoing: outgoing.length,
            ethIn,
            ethOut,
            hop: res.summary?.max_hops ?? 0,
            txs: allTx,
          });

          updateCase(selectedCase.id, {
            risk_score: assessment.score,
          }).catch((err) => {
            console.error("Failed to persist risk score:", err);
          });
        }

        setLoading(false);
        onToast(`Traced ${res?.summary?.total_transactions ?? 0} real transactions`);
      },
      (msg: any) => {
        setError(typeof msg === "string" ? msg : "An unexpected error occurred");
        setLoading(false);
      }
    );
  };

  return (
    <div className="view-stack">
      <div className="trace-toolbar">
        <div className="case-select" style={{ minWidth: 210 }}>
          <span>Network</span>
          <div style={{ display: "flex", gap: 6 }}>
            {(["ethereum", "tron"] as const).map((n) => (
              <button
                key={n}
                type="button"
                className={network === n ? "primary-button" : "secondary-button"}
                onClick={() => handleNetworkChange(n)}
                disabled={loading}
                style={{ flex: 1, padding: "8px 10px", fontSize: 12, whiteSpace: "nowrap" }}
              >
                {n === "ethereum" ? "Ethereum / Etherscan" : "TRON"}
              </button>
            ))}
          </div>
        </div>
        <label className="case-select" style={{ flex: 1 }}>
          <span>Wallet address</span>
          <input
            className="text-input"
            value={walletInput}
            onChange={(e) => setWalletInput(e.target.value)}
            placeholder={network === "tron" ? "T..." : "0x..."}
          />
        </label>
        <label className="case-select" style={{ minWidth: 130 }}>
          <span>Max hops</span>
          <select
            className="text-input"
            value={maxHops}
            onChange={(e) => setMaxHops(Number(e.target.value))}
          >
            {(network === "tron" ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).map((n) => (
              <option key={n} value={n}>
                {n} hop{n > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </label>
        {network === "tron" && (
          <label className="case-select" style={{ minWidth: 110 }}>
            <span>Asset</span>
            <select
              className="text-input"
              value={tronAssetType}
              onChange={(e) => setTronAssetType(e.target.value as TronAssetType)}
            >
              <option value="all">All</option>
              <option value="trx">TRX</option>
              <option value="trc20">TRC20</option>
            </select>
          </label>
        )}
        <button className="primary-button" onClick={handleAnalyze} disabled={loading}>
          {loading ? (network === "tron" ? "Tracing TRON wallet..." : "Tracing...") : "Analyze wallet"}
        </button>
        <span className="trace-summary">
          <Zap size={15} /> {allTx.length} transactions traced{traceResult ? ` · ${tracedNetworkLabel}` : ""}
        </span>
      </div>

      {error && (
        <div className="alert-box">
          <AlertTriangle size={16} />
          <div>
            <strong>Error</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {loading && (
        <section className="panel" style={{ padding: 20 }}>
          <SectionHeading title="Live Trace Terminal" meta="Streaming" />
          <TerminalLog lines={logs} />
        </section>
      )}

      {!loading && !traceResult && (
        <div className="empty-state">
          <GitBranch size={22} />
          <strong>No wallet analyzed yet</strong>
          <span>
            {network === "tron"
              ? "Enter a TRON address (T...) above and click Analyze Wallet."
              : "Enter an Ethereum address above and click Analyze Wallet."}
          </span>
        </div>
      )}

      {!loading && traceResult && allTx.length === 0 && (
        <div className="empty-state">
          <GitBranch size={22} />
          <strong>No transactions found for this wallet.</strong>
          <span>Try a different address, more hops, or a different asset filter.</span>
        </div>
      )}

      {!loading && traceResult && allTx.length > 0 && (
        <section className="panel trace-panel">
          <SectionHeading title="Fund flow trace" meta={`${allTx.length} transactions · ${tracedNetworkLabel}`} />
          <FundFlowGraph
            address={tracedAddress}
            transactions={allTx}
            onNodeClick={() => {}}
          />
        </section>
      )}
    </div>
  );
}

function RiskView({
  selectedCase,
  traceResult,
  tracedAddress,
}: {
  selectedCase?: ApiCase | null;
  traceResult: TraceResponse | null;
  tracedAddress: string;
}) {
  const allTx = traceResult ? [...(traceResult.inward || []), ...(traceResult.outward || [])] : [];

  const isTronTrace = isTronAddress(tracedAddress);
  let liveAssessment: RiskAssessment | null = null;
  if (tracedAddress && allTx.length > 0 && !isTronTrace) {
    const incoming = allTx.filter((t) => (t.direction as string) === "inward" || (t.direction as string) === "in");
    const outgoing = allTx.filter((t) => (t.direction as string) === "outward" || (t.direction as string) === "out");
    const ethIn = incoming.reduce((s, t) => s + Number(t.value || 0) / 1e18, 0);
    const ethOut = outgoing.reduce((s, t) => s + Number(t.value || 0) / 1e18, 0);
    liveAssessment = riskEngine.calculateWalletRisk({
      incoming: incoming.length,
      outgoing: outgoing.length,
      ethIn,
      ethOut,
      hop: traceResult?.summary?.max_hops ?? 0,
      txs: allTx,
    });
  }

  const score = liveAssessment?.score ?? null;

  if (score === null) {
    return (
      <div className="view-stack">
        <div className="empty-state">
          <ShieldCheck size={22} />
          <strong>No risk data yet</strong>
          <span>
            {isTronTrace
              ? "Risk scoring is currently calibrated for Ethereum only and is not available for TRON traces yet."
              : "Analyze a wallet in the Investigation workspace to see a live, evidence-based risk breakdown here."}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="view-stack">
      <div className="risk-hero panel">
        <div>
          <span className="eyebrow">COMPOSITE RISK SCORE</span>
          <div className="big-score">
            {score}
            <small>/100</small>
          </div>
          <RiskBadge score={score} showLabel />
        </div>
        <div className="risk-hero-copy">
          <h2>{score >= 60 ? "High-confidence suspicious activity" : "Activity requires review"}</h2>
          <p>Score computed live from this session's fund-flow trace (fan-in/out, velocity, hop depth, error rate, value concentration).</p>
          <div className="risk-hero-meta">
            <span>
              <ShieldCheck size={15} /> Live trace-based model
            </span>
            <span>
              <Check size={15} /> {liveAssessment?.signals.length ?? 0} signals evaluated
            </span>
          </div>
        </div>
      </div>
      <section className="panel factors-panel">
        <SectionHeading title="Contributing factors" meta={liveAssessment ? "Live model" : undefined} />
        {liveAssessment ? (
          liveAssessment.signals.length > 0 ? (
            liveAssessment.signals.map((signal) => (
              <div className="factor-row" key={signal.label}>
                <div className="factor-name">
                  <strong>{signal.label}</strong>
                  <span>{signal.positive ? "Positive signal" : "Risk-contributing signal"}</span>
                </div>
                <div className="factor-score">
                  <b>
                    {signal.weight}
                    <small>/100</small>
                  </b>
                  <RiskBar score={signal.weight} />
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <Check size={20} />
              <strong>No risk signals detected</strong>
            </div>
          )
        ) : (
          <div className="empty-state">
            <GitBranch size={22} />
            <strong>No live trace for this wallet yet</strong>
            <span>
              {selectedCase
                ? `Go to Investigation workspace and analyze ${shortAddress(selectedCase.primary_wallet)} to see a real factor breakdown here.`
                : "Analyze a wallet in the Investigation workspace to see a real factor breakdown here."}
            </span>
          </div>
        )}
      </section>
    </div>
  );
}

function VaspView({
  traceResult,
  tracedAddress,
  onOpen,
}: {
  traceResult: TraceResponse | null;
  tracedAddress: string;
  onOpen: (title: string, body: string) => void;
}) {
  const allTx = traceResult ? [...(traceResult.inward || []), ...(traceResult.outward || [])] : [];
  const uniqueCounterparties = new Set(
    allTx.map((t) => (((t.direction as string) === "outward" || (t.direction as string) === "out") ? t.to : t.from)?.toLowerCase()).filter(Boolean),
  );

  return (
    <div className="view-stack">
      <div className="insight-banner">
        <Sparkles size={18} />
        <div>
          <strong>VASP attribution registry not connected</strong>
          <span>
            No exchange/VASP labelling backend is wired up yet — this needs an attribution service (deposit-cluster
            labels, FIU-IND registry, etc.) that isn't part of the current API.
          </span>
        </div>
        <button
          onClick={() =>
            onOpen(
              "Why this is empty",
              "Attribution would combine deposit-cluster overlap, timing, transaction-graph similarity, and registry intelligence — none of which the current backend exposes. Connect a VASP intelligence provider under Integrations to enable this.",
            )
          }
        >
          Why is this empty? <ArrowRight size={14} />
        </button>
      </div>
      <section className="panel table-panel">
        <SectionHeading
          title="Counterparty addresses observed"
          meta={tracedAddress ? `${uniqueCounterparties.size} unique addresses` : undefined}
        />
        {!tracedAddress || uniqueCounterparties.size === 0 ? (
          <div className="empty-state">
            <Database size={22} />
            <strong>No counterparties yet</strong>
            <span>Analyze a wallet in the Investigation workspace to see the addresses it interacted with here.</span>
          </div>
        ) : (
          Array.from(uniqueCounterparties)
            .slice(0, 50)
            .map((addr) => (
              <div className="table-row vasp-row" key={addr}>
                <div>
                  <strong>{shortAddress(addr, 10, 6)}</strong>
                  <small>No registry label available</small>
                </div>
                <div />
                <div>
                  <span className="status-tag">Unattributed</span>
                </div>
                <div>—</div>
                <div>
                  <small>Connect a VASP registry to attribute this address</small>
                </div>
              </div>
            ))
        )}
      </section>
    </div>
  );
}

function TimelineView({ traceResult, tracedAddress }: { traceResult: TraceResponse | null; tracedAddress: string }) {
  if (!traceResult) {
    return (
      <div className="view-stack">
        <section className="panel timeline-panel">
          <div className="empty-state">
            <Activity size={22} />
            <strong>No trace data yet</strong>
            <span>Analyze a wallet in the Investigation Workspace to see its timeline here.</span>
          </div>
        </section>
      </div>
    );
  }

  const allTx = [...(traceResult.inward || []), ...(traceResult.outward || [])].sort(
    (a, b) => new Date(normalizeTimestamp(a.timestamp)).getTime() - new Date(normalizeTimestamp(b.timestamp)).getTime()
  );

  return (
    <div className="view-stack">
      <section className="panel timeline-panel">
        <SectionHeading title="Transaction Timeline" meta={`${shortAddress(tracedAddress, 8, 6)} · ${allTx.length} tx`} />
        {allTx.map((tx, index) => (
          <div className="timeline-row" key={tx.tx_hash ?? index}>
            <div className="timeline-rail">
              <span className="timeline-icon">{tx.hop}</span>
              {index < allTx.length - 1 && <i />}
            </div>
            <div className="timeline-content">
              <div>
                <strong>{((tx.direction as string) === "in" || (tx.direction as string) === "inward") ? "Inward" : "Outward"} transfer</strong>
                <span className="source-tag">Hop {tx.hop}</span>
              </div>
              <p>
                {shortAddress(tx.from)} → {shortAddress(tx.to)} · {txAmountLabel(tx)}
              </p>
              <small>{formatDateTime(normalizeTimestamp(tx.timestamp))}</small>
            </div>
            <code>{shortAddress(tx.tx_hash, 10, 6)}</code>
          </div>
        ))}
      </section>
    </div>
  );
}

function NetworksView({
  cases,
  traceResult,
  tracedAddress,
  onOpenCase,
}: {
  cases: ApiCase[];
  traceResult: TraceResponse | null;
  tracedAddress: string;
  onOpenCase: (id: string) => void;
}) {
  const allTx = traceResult ? [...(traceResult.inward || []), ...(traceResult.outward || [])] : [];
  const touchedAddresses = new Set(
    allTx.flatMap((t) => [t.from?.toLowerCase(), t.to?.toLowerCase()]).filter(Boolean) as string[],
  );
  if (tracedAddress) touchedAddresses.add(tracedAddress.toLowerCase());

  const matchedCases = cases.filter((c) => c.primary_wallet && touchedAddresses.has(c.primary_wallet.toLowerCase()));
  const matchedChains = Array.from(new Set(matchedCases.map((c) => c.chain).filter(Boolean))) as string[];

  const cluster =
    matchedCases.length > 0
      ? {
          id: `LIVE-${tracedAddress.slice(0, 8)}`,
          name: "Live trace correlation",
          commonEntity: shortAddress(tracedAddress, 8, 6),
          chains: matchedChains,
          walletCount: touchedAddresses.size,
          complaintCount: matchedCases.length,
          confidence: 100,
          caseIds: matchedCases.map((c) => c.id),
        }
      : null;

  return (
    <div className="view-stack">
      <div className="network-summary">
        <div className="panel">
          <span className="eyebrow">MATCHED CASES</span>
          <strong>{matchedCases.length}</strong>
          <span>share an address with this trace</span>
        </div>
        <div className="panel">
          <span className="eyebrow">ADDRESSES TOUCHED</span>
          <strong>{touchedAddresses.size}</strong>
          <span>in current trace</span>
        </div>
        <div className="panel">
          <span className="eyebrow">TOTAL EXPOSURE (MATCHED)</span>
          <strong>{formatInr(matchedCases.reduce((sum, c) => sum + (c.amount_inr ?? 0), 0), true)}</strong>
          <span>across matched cases</span>
        </div>
      </div>
      <section className="panel network-panel">
        <SectionHeading title="Cross-case correlation" meta="Exact address match" />
        {!tracedAddress ? (
          <div className="empty-state">
            <NetworkIcon size={22} />
            <strong>No trace run yet</strong>
            <span>Analyze a wallet in the Investigation workspace to check it against other cases.</span>
          </div>
        ) : !cluster ? (
          <div className="empty-state">
            <NetworkIcon size={22} />
            <strong>No shared addresses found</strong>
            <span>None of this trace's {touchedAddresses.size} addresses match another case's primary wallet.</span>
          </div>
        ) : (
          <div style={{ padding: "20px 0", borderTop: "1px solid #29323d" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <strong style={{ fontSize: 12 }}>{cluster.name}</strong>
                <div style={{ color: "#778896", fontSize: 10, marginTop: 4 }}>
                  {cluster.walletCount} addresses · {cluster.complaintCount} matched cases · {cluster.confidence}% confidence
                </div>
              </div>
            </div>
            <CrossCaseNetworkGraph cluster={cluster} onOpenCase={onOpenCase} />
          </div>
        )}
      </section>
    </div>
  );
}

function EvidenceView({
  traceResult,
  tracedAddress,
  onToast,
  onOpen,
}: {
  traceResult: TraceResponse | null;
  tracedAddress: string;
  onToast: (text: string) => void;
  onOpen: (title: string, body: string) => void;
}) {
  const allTx = traceResult
    ? [...(traceResult.inward || []), ...(traceResult.outward || [])].sort(
        (a, b) => new Date(normalizeTimestamp(b.timestamp)).getTime() - new Date(normalizeTimestamp(a.timestamp)).getTime(),
      )
    : [];

  return (
    <div className="view-stack">
      <div className="evidence-toolbar">
        <div>
          <strong>{allTx.length} chain-of-custody events</strong>
          <span>{tracedAddress ? `Derived from live trace of ${shortAddress(tracedAddress, 8, 6)}` : "Run a trace to populate this ledger"}</span>
        </div>
        <button
          className="secondary-button"
          onClick={() => onToast(allTx.length ? "Evidence export prepared as PDF" : "Nothing to export yet — run a trace first")}
          disabled={allTx.length === 0}
        >
          Export ledger <ArrowRight size={15} />
        </button>
      </div>
      <section className="panel evidence-grid">
        {allTx.length === 0 ? (
          <div className="empty-state">
            <FileText size={22} />
            <strong>No evidence yet</strong>
            <span>Analyze a wallet in the Investigation workspace to build a real chain-of-custody ledger here.</span>
          </div>
        ) : (
          allTx.map((tx, index) => {
            const isIncoming = (tx.direction as string) === "in" || (tx.direction as string) === "inward";
            const eventLabel = `${isIncoming ? "Inward" : "Outward"} transfer detected`;
            return (
              <button
                className="evidence-card"
                key={tx.tx_hash ?? index}
                onClick={() =>
                  onOpen(
                    eventLabel,
                    `Hop ${tx.hop} · ${shortAddress(tx.from)} \u2192 ${shortAddress(tx.to)}\n\nValue: ${txAmountLabel(tx)}\nBlock: ${tx.block_number}\n\nMethodology: Direct on-chain transaction observed during wallet trace.`,
                  )
                }
              >
                <div className="evidence-card-top">
                  <span className="source-tag">TxID</span>
                  <span>{formatDate(normalizeTimestamp(tx.timestamp))}</span>
                </div>
                <strong>{eventLabel}</strong>
                <p>
                  Hop {tx.hop} · {shortAddress(tx.from)} → {shortAddress(tx.to)} · {txAmountLabel(tx)}
                </p>
                <div>
                  <code>{shortAddress(tx.tx_hash, 10, 6)}</code>
                  <ArrowRight size={14} />
                </div>
              </button>
            );
          })
        )}
      </section>
    </div>
  );
}

function ReportsView({
  selectedCase,
  traceResult,
  tracedAddress,
  onToast,
}: {
  selectedCase: ApiCase | null;
  traceResult: TraceResponse | null;
  tracedAddress: string;
  onToast: (text: string) => void;
}) {
  const [reportGenerated, setReportGenerated] = useState(false);

  const [freezeRequests, setFreezeRequests] = useState<FreezeRequest[]>([]);
  const [auditEntries, setAuditEntries] = useState<FreezeRequestAudit[]>([]);

  const [rejectionReason, setRejectionReason] = useState("");
  const [executionReference, setExecutionReference] = useState("");
  const [executionDetails, setExecutionDetails] = useState("");

  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showExecuteDialog, setShowExecuteDialog] = useState(false);
  const [actionRequestId, setActionRequestId] = useState<number | null>(null);
  const [busyRequestId, setBusyRequestId] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedCase) {
      setFreezeRequests([]);
      setAuditEntries([]);
      return;
    }

    let cancelled = false;

    const loadFreezeRequests = async () => {
      try {
        const requests = await getCaseFreezeRequests(selectedCase.id);

        if (cancelled) return;

        setFreezeRequests(requests);

        if (requests.length > 0) {
          const audit = await getFreezeRequestAudit(requests[0].id);

          if (!cancelled) {
            setAuditEntries(audit);
          }
        } else {
          setAuditEntries([]);
        }
      } catch (err) {
        if (!cancelled) {
          onToast(
            err instanceof Error
              ? err.message
              : "Freeze requests could not be loaded",
          );
        }
      }
    };

    void loadFreezeRequests();

    return () => {
      cancelled = true;
    };
  }, [selectedCase?.id, onToast]);

  const handleReport = async () => {
    if (!selectedCase) return;

    try {
      await downloadCaseReport(selectedCase.id);
      setReportGenerated(true);
      onToast("Investigation report downloaded");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Report download failed");
    }
  };

  const handleFreeze = async () => {
    if (!selectedCase) return;

    try {
      const request = await createFreezeRequest({
        case_id: selectedCase.id,
        reason:
          "Suspicious blockchain activity identified during wallet investigation.",
        triggered_by: "investigator",
      });

      setFreezeRequests((current) => [request, ...current]);

      const audit = await getFreezeRequestAudit(request.id);
      setAuditEntries(audit);

      onToast(`Freeze request #${request.id} created — Pending`);
    } catch (err) {
      onToast(
        err instanceof Error
          ? err.message
          : "Freeze request creation failed"
      );
    }
  };

  const handleMoveToReview = async (request: FreezeRequest) => {
    setBusyRequestId(request.id);

    try {
      await moveFreezeRequestToReview(request.id);

      const requests = await getCaseFreezeRequests(request.case_id);
      setFreezeRequests(requests);

      const audit = await getFreezeRequestAudit(request.id);
      setAuditEntries(audit);

      onToast(`Freeze request #${request.id} moved to review`);
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : "Could not move request to review",
      );
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleApprove = async (request: FreezeRequest) => {
    setBusyRequestId(request.id);

    try {
      await approveFreezeRequest(request.id);

      const requests = await getCaseFreezeRequests(request.case_id);
      setFreezeRequests(requests);

      const audit = await getFreezeRequestAudit(request.id);
      setAuditEntries(audit);

      onToast(`Freeze request #${request.id} approved`);
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : "Could not approve freeze request",
      );
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleReject = async (request: FreezeRequest) => {
    const reason = rejectionReason.trim();

    if (!reason) {
      onToast("Rejection reason is required");
      return;
    }

    setBusyRequestId(request.id);

    try {
      await rejectFreezeRequest(request.id, reason);

      const requests = await getCaseFreezeRequests(request.case_id);
      setFreezeRequests(requests);

      const audit = await getFreezeRequestAudit(request.id);
      setAuditEntries(audit);

      setRejectionReason("");
      setShowRejectDialog(false);

      onToast(`Freeze request #${request.id} rejected`);
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : "Could not reject freeze request",
      );
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleExecute = async (request: FreezeRequest) => {
    const reference = executionReference.trim();

    if (!reference) {
      onToast("Execution reference is required");
      return;
    }

    setBusyRequestId(request.id);

    try {
      await executeFreezeRequest(
        request.id,
        reference,
        executionDetails.trim() || undefined,
      );

      const requests = await getCaseFreezeRequests(request.case_id);
      setFreezeRequests(requests);

      const audit = await getFreezeRequestAudit(request.id);
      setAuditEntries(audit);

      setExecutionReference("");
      setExecutionDetails("");
      setShowExecuteDialog(false);

      onToast(`Freeze request #${request.id} marked Executed`);
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : "Could not execute freeze request",
      );
    } finally {
      setBusyRequestId(null);
    }
  };

  return (
    <div className="view-stack">
      <div className="report-hero panel">
        <div>
          <span className="eyebrow">CASE ACTION CENTER</span>
          <h2>Turn analysis into action</h2>
          <p>
            {selectedCase
              ? `Select actions to generate PDF reports or DB freeze requests for ${selectedCase.id}.`
              : "Select a case to generate an official investigation report or DB-backed freeze request."}
          </p>
        </div>
        <div className="report-actions">
          <button
            className="primary-button"
            disabled={!selectedCase}
            onClick={handleReport}
          >
            <FileText size={16} /> Generate report
          </button>
          <button
            className="secondary-button"
            disabled={!selectedCase}
            onClick={handleFreeze}
          >
            <ShieldCheck size={16} /> Generate freeze request
          </button>
        </div>
      </div>

      {reportGenerated && (
        <section className="panel report-list">
          <SectionHeading title="Recent outputs" />
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
            <div
              className="report-output-row"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                padding: "12px 16px",
                background: "rgba(255, 255, 255, 0.03)",
                borderRadius: 8,
                border: "1px solid rgba(255, 255, 255, 0.08)",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <strong style={{ display: "block", color: "#fff", fontSize: 14 }}>
                  Investigation Report
                </strong>
                <span style={{ fontSize: 12, color: "#8798a8" }}>
                  PDF generated and downloaded successfully.
                </span>
              </div>
              <button
                onClick={handleReport}
                className="secondary-button"
                style={{ padding: "6px 12px", fontSize: 12, flexShrink: 0 }}
              >
                Generate again
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="panel report-list">
        <SectionHeading title="Freeze Requests" />

        {freezeRequests.length === 0 ? (
          <div className="empty-state">
            <ShieldCheck size={22} />
            <strong>No freeze requests for this case.</strong>
            <span>
              Create a freeze request after completing the investigation and risk
              assessment.
            </span>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginTop: 12,
            }}
          >
            {freezeRequests.map((request) => (
              <div
                key={request.id}
                className="freeze-request-card"
                style={{
                  padding: "16px",
                  background: "rgba(255, 255, 255, 0.03)",
                  borderRadius: 8,
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 24,
                    width: "100%",
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <strong
                      style={{
                        display: "block",
                        color: "#fff",
                        fontSize: 14,
                      }}
                    >
                      Freeze Request #{request.id}
                    </strong>

                    <span
                      style={{
                        display: "block",
                        marginTop: 5,
                        fontSize: 12,
                        color: "#8798a8",
                      }}
                    >
                      Status: {request.status}
                    </span>

                    <span
                      style={{
                        display: "block",
                        marginTop: 4,
                        fontSize: 12,
                        color: "#8798a8",
                        wordBreak: "break-all",
                      }}
                    >
                      Wallet: {request.wallet_address}
                    </span>

                    {request.risk_score !== null &&
                      request.risk_score !== undefined && (
                        <span
                          style={{
                            display: "block",
                            marginTop: 4,
                            fontSize: 12,
                            color: "#8798a8",
                          }}
                        >
                          Risk Score: {request.risk_score}
                        </span>
                      )}
                  </div>

                  <button
                    className="secondary-button"
                    style={{ padding: "6px 12px", fontSize: 12, flexShrink: 0 }}
                    onClick={async () => {
                      try {
                        await downloadFreezeRequest(request.id);
                        onToast("Freeze request PDF downloaded");
                      } catch (err) {
                        onToast(
                          err instanceof Error
                            ? err.message
                            : "Freeze request download failed",
                        );
                      }
                    }}
                  >
                    Download PDF
                  </button>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 14,
                    flexWrap: "wrap",
                  }}
                >
                  {request.status === "Pending" && (
                    <button
                      className="primary-button"
                      disabled={busyRequestId === request.id}
                      onClick={() => handleMoveToReview(request)}
                    >
                      Move to Review
                    </button>
                  )}

                  {request.status === "Under Review" && (
                    <>
                      <button
                        className="primary-button"
                        disabled={busyRequestId === request.id}
                        onClick={() => handleApprove(request)}
                      >
                        Approve Freeze
                      </button>

                      <button
                        className="secondary-button"
                        disabled={busyRequestId === request.id}
                        onClick={() => {
                          setActionRequestId(request.id);
                          setRejectionReason("");
                          setShowRejectDialog(true);
                        }}
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {request.status === "Approved" && (
                    <button
                      className="primary-button"
                      disabled={busyRequestId === request.id}
                      onClick={() => {
                        setActionRequestId(request.id);
                        setExecutionReference("");
                        setExecutionDetails("");
                        setShowExecuteDialog(true);
                      }}
                    >
                      Proceed to Enforcement
                    </button>
                  )}

                  {request.status === "Rejected" && (
                    <span
                      style={{
                        fontSize: 12,
                        color: "#8798a8",
                        padding: "8px 0",
                      }}
                    >
                      Rejected: {request.rejection_reason || "No reason provided"}
                    </span>
                  )}

                  {request.status === "Executed" && (
                    <span
                      style={{
                        fontSize: 12,
                        color: "#8798a8",
                        padding: "8px 0",
                      }}
                    >
                      Execution Reference:{" "}
                      {request.execution_reference || "Recorded"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel report-list">
        <SectionHeading title="Audit Trail" />

        {auditEntries.length === 0 ? (
          <div className="empty-state">
            <span>No audit activity recorded yet.</span>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: 12,
            }}
          >
            {auditEntries.map((entry) => (
              <div
                key={entry.id}
                className="audit-entry"
                style={{
                  padding: "14px 16px",
                  background: "rgba(255, 255, 255, 0.03)",
                  borderRadius: 8,
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                  width: "100%",
                  boxSizing: "border-box",
                }}
              >
                <strong
                  style={{
                    display: "block",
                    color: "#fff",
                    fontSize: 13,
                  }}
                >
                  {entry.action}
                </strong>

                <span
                  style={{
                    display: "block",
                    color: "#8798a8",
                    fontSize: 12,
                  }}
                >
                  {entry.previous_status
                    ? `${entry.previous_status} → ${entry.new_status}`
                    : entry.new_status}
                </span>

                <span
                  style={{
                    display: "block",
                    color: "#8798a8",
                    fontSize: 12,
                  }}
                >
                  Actor: {entry.actor}
                </span>

                {entry.reason && (
                  <span
                    style={{
                      display: "block",
                      color: "#8798a8",
                      fontSize: 12,
                    }}
                  >
                    Reason: {entry.reason}
                  </span>
                )}

                {entry.details && (
                  <span
                    style={{
                      display: "block",
                      color: "#8798a8",
                      fontSize: 12,
                    }}
                  >
                    {entry.details}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {showRejectDialog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            background: "rgba(0, 0, 0, 0.65)",
            padding: 20,
          }}
        >
          <div
            className="panel"
            style={{
              width: "min(500px, 100%)",
              padding: 20,
            }}
          >
            <h3 style={{ margin: 0 }}>Reject Freeze Request</h3>

            <p style={{ color: "#8798a8", fontSize: 13 }}>
              A rejection reason is required.
            </p>

            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Rejection reason"
              rows={5}
              style={{
                width: "100%",
                boxSizing: "border-box",
                resize: "vertical",
              }}
            />

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                className="secondary-button"
                onClick={() => setShowRejectDialog(false)}
              >
                Cancel
              </button>

              <button
                className="primary-button"
                disabled={!rejectionReason.trim()}
                onClick={() => {
                  const request = freezeRequests.find(
                    (item) => item.id === actionRequestId,
                  );

                  if (request) {
                    void handleReject(request);
                  }
                }}
              >
                Reject Request
              </button>
            </div>
          </div>
        </div>
      )}

      {showExecuteDialog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            background: "rgba(0, 0, 0, 0.65)",
            padding: 20,
          }}
        >
          <div
            className="panel"
            style={{
              width: "min(500px, 100%)",
              padding: 20,
            }}
          >
            <h3 style={{ margin: 0 }}>Proceed to Enforcement</h3>

            <p style={{ color: "#8798a8", fontSize: 13 }}>
              Record the enforcement reference. This does not claim that an
              external wallet freeze was performed unless an enforcement
              integration is actually connected.
            </p>

            <input
              value={executionReference}
              onChange={(e) => setExecutionReference(e.target.value)}
              placeholder="Execution reference"
              style={{
                width: "100%",
                boxSizing: "border-box",
                marginBottom: 10,
              }}
            />

            <textarea
              value={executionDetails}
              onChange={(e) => setExecutionDetails(e.target.value)}
              placeholder="Execution details (optional)"
              rows={4}
              style={{
                width: "100%",
                boxSizing: "border-box",
                resize: "vertical",
              }}
            />

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                className="secondary-button"
                onClick={() => setShowExecuteDialog(false)}
              >
                Cancel
              </button>

              <button
                className="primary-button"
                disabled={!executionReference.trim()}
                onClick={() => {
                  const request = freezeRequests.find(
                    (item) => item.id === actionRequestId,
                  );

                  if (request) {
                    void handleExecute(request);
                  }
                }}
              >
                Record Enforcement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IntegrationsView({ onToast }: { onToast: (text: string) => void }) {
  return (
    <div className="view-stack">
      <div className="integration-head">
        <div>
          <h2>Connected intelligence</h2>
          <p>Data sources and operational systems feeding CryptoTrace.</p>
        </div>
        <button className="secondary-button" onClick={() => onToast("Connection manager is ready for API credentials")}>
          <SlidersHorizontal size={15} /> Manage connections
        </button>
      </div>
      <div className="integration-grid">
        {integrations.map((item) => (
          <button className="panel integration-card" key={item.name} onClick={() => onToast(`${item.name} connection details opened`)}>
            <div className="integration-icon">
              <Database size={17} />
            </div>
            <div>
              <div className="integration-title">
                <strong>{item.name}</strong>
                <span className={`integration-status ${item.status}`}>{item.statusLabel}</span>
              </div>
              <p>{item.description}</p>
              <small>{item.detail}</small>
            </div>
            <ArrowRight size={15} />
          </button>
        ))}
      </div>
    </div>
  );
}

function DetailDrawer({ title, body, onClose }: { title: string; body: string; onClose: () => void }) {
  return (
    <>
      <button className="drawer-scrim" onClick={onClose} aria-label="Close details" />
      <aside className="detail-drawer">
        <div className="drawer-head">
          <div>
            <span className="eyebrow">DETAIL VIEW</span>
            {title}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close details">
            ×
          </button>
        </div>
        <div className="drawer-body">
          {body.split("\n").map((line, index) =>
            line ? <p key={`${line}-${index}`}>{line}</p> : <div className="drawer-gap" key={`gap-${index}`} />,
          )}
        </div>
        <button className="primary-button full-width" onClick={onClose}>
          <Check size={15} /> Done
        </button>
      </aside>
    </>
  );
}

function NewInvestigationDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (createdCase: ApiCase) => void;
}) {
  const [complaintId, setComplaintId] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [dialogMaxHops, setDialogMaxHops] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    setError("");

    try {
      const createdCase = await createCase({
        complaint_id: complaintId.trim(),
        primary_wallet: walletAddress.trim(),
        chain: "Ethereum",
        status: "New",
        priority: "Medium",
        auto_trace: true,
        max_hops: dialogMaxHops,
      });

      onSubmit(createdCase);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create investigation");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button className="drawer-scrim" onClick={onClose} aria-label="Close modal" />

      <div
        className="panel"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1000,
          width: "90%",
          maxWidth: 480,
        }}
      >
        <SectionHeading title="New Investigation Intake" />

        <p style={{ fontSize: 12, color: "#8798a8", marginBottom: 16 }}>
          Enter initial complaint details to initiate a new wallet trace and queue indexers.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <input
            className="text-input"
            placeholder="NCRP Complaint ID (e.g. NCRP-2026-9999)"
            value={complaintId}
            onChange={(e) => setComplaintId(e.target.value)}
            required
          />

          <input
            className="text-input"
            placeholder="Victim Wallet Address (0x...)"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            required
          />

          <label className="case-select">
            <span>Max hops</span>
            <select
              className="text-input"
              value={dialogMaxHops}
              onChange={(e) => setDialogMaxHops(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  {n} hop{n > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </label>

          {error && (
            <div style={{ fontSize: 12, color: "#ff6b6b" }}>
              {error}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
              marginTop: 8,
            }}
          >
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primary-button"
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Create & Trace"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
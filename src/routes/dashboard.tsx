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
import { formatDate, formatDateTime, formatInr, normalizeTimestamp, shortAddress, weiToEth, timeAgo } from "@/lib/format";
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
  type BackendTxRecord,
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
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);

  const fetchCases = (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setCasesLoading(true);
    setSyncing(true);
    setCasesError("");
    listCases()
      .then((result) => {
        setCases(result);
        setSelectedCaseId((prev) => (result.some((c) => c.id === prev) ? prev : (result[0]?.id ?? "")));
        setLastSyncedAt(new Date());
      })
      .catch((err) => setCasesError(err instanceof Error ? err.message : "Failed to load cases"))
      .finally(() => {
        setCasesLoading(false);
        setSyncing(false);
      });
  };

  useEffect(() => {
    fetchCases();
    // Keep the "Indexers synced" clock live by re-syncing with the backend
    // in the background, without showing a loading state.
    const id = setInterval(() => fetchCases({ silent: true }), 60_000);
    return () => clearInterval(id);
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

      const maxHop = Math.max(0, ...txs.map((tx) => Number(tx.hop) || 0));

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
      setTraceError(err instanceof Error ? err.message : "Failed to load saved case transactions");
    }
  };

  return (
    <div className="app-frame">
      <aside className={`sidebar ${sidebarOpen ? "" : "sidebar-collapsed"} ${mobileMenu ? "mobile-visible" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <img src="/favicon.png" alt="CryptoTrace logo" style={{ width: 40, height: 40, objectFit: "contain", display: "block" }} />
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
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search cases, wallets, transactions" />
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
          <PageHeader
            view={view}
            selectedCase={selectedCase}
            onNew={() => setNewInvestigationOpen(true)}
            lastSyncedAt={lastSyncedAt}
            syncing={syncing}
          />
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

function PageHeader({
  view,
  selectedCase,
  onNew,
  lastSyncedAt,
  syncing,
}: {
  view: View;
  selectedCase: ApiCase | null;
  onNew: () => void;
  lastSyncedAt: Date | null;
  syncing: boolean;
}) {
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

  // Re-render every few seconds so "Indexers synced Xs/min ago" stays live
  // without needing a fresh network call.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 5_000);
    return () => clearInterval(id);
  }, []);

  const isStale = lastSyncedAt ? Date.now() - lastSyncedAt.getTime() > 5 * 60_000 : true;

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
          <span className="status-dot" style={{ background: syncing ? "#e7bd74" : isStale ? "#8798a8" : undefined }} />
          {syncing ? "Syncing indexers..." : `Indexers synced ${timeAgo(lastSyncedAt)}`}
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
    if (next === "tron" && maxHops > 5) setMaxHops(2);
  };

  const handleAnalyze = () => {
    setError("");

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

          const allTx = [...(res.inward || []), ...(res.outward || [])];
          if (selectedCase && allTx.length > 0) {
            const incoming = allTx.filter((t) => (t.direction as string) === "inward" || (t.direction as string) === "in");
            const outgoing = allTx.filter((t) => (t.direction as string) === "outward" || (t.direction as string) === "out");
            const tronIn = incoming.reduce((s, t) => s + (Number(t.value) || 0), 0);
            const tronOut = outgoing.reduce((s, t) => s + (Number(t.value) || 0), 0);

            const assessment = riskEngine.calculateWalletRisk({
              incoming: incoming.length,
              outgoing: outgoing.length,
              ethIn: tronIn,
              ethOut: tronOut,
              hop: res.summary?.max_hops ?? 0,
              txs: allTx as BackendTxRecord[],
              network: "tron",
            });

            updateCase(selectedCase.id, { risk_score: assessment.score }).catch((err) => {
              console.error("Failed to persist TRON risk score:", err);
            });
          }

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
            txs: allTx as BackendTxRecord[],
            network: "ethereum",
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
  if (tracedAddress && allTx.length > 0) {
    const incoming = allTx.filter((t) => (t.direction as string) === "inward" || (t.direction as string) === "in");
    const outgoing = allTx.filter((t) => (t.direction as string) === "outward" || (t.direction as string) === "out");
    // Ethereum: wei -> ETH. TRON: value is already a decimal amount (TRX/token units).
    const amountOf = (t: { value?: string | number }) => (isTronTrace ? Number(t.value || 0) || 0 : Number(t.value || 0) / 1e18);
    const ethIn = incoming.reduce((s, t) => s + amountOf(t), 0);
    const ethOut = outgoing.reduce((s, t) => s + amountOf(t), 0);
    liveAssessment = riskEngine.calculateWalletRisk({
      incoming: incoming.length,
      outgoing: outgoing.length,
      ethIn,
      ethOut,
      hop: traceResult?.summary?.max_hops ?? 0,
      txs: allTx as BackendTxRecord[],
      network: isTronTrace ? "tron" : "ethereum",
    });
  }

  const score = liveAssessment?.score ?? null;

  if (score === null) {
    return (
      <div className="view-stack">
        <div className="empty-state">
          <ShieldCheck size={22} />
          <strong>No risk data yet</strong>
          <span>Analyze a wallet in the Investigation workspace to see a live, evidence-based risk breakdown here.</span>
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
          <p>
            Score computed live from this session's {isTronTrace ? "TRON" : "Ethereum"} fund-flow trace (fan-in/out,
            velocity, hop depth, error rate, value concentration{isTronTrace ? ", asset diversity" : ""}).
          </p>
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
    (a, b) => new Date(normalizeTimestamp(a.timestamp)).getTime() - new Date(normalizeTimestamp(a.timestamp)).getTime()
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
      await approveFreezeRequest(request.id, {
        reviewer: "supervisor_admin",
      });

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

  const handleRejectSubmit = async () => {
    if (!actionRequestId || !selectedCase) return;

    setBusyRequestId(actionRequestId);

    try {
      await rejectFreezeRequest(actionRequestId, {
        rejection_reason: rejectionReason || "Rejected by supervisor",
        reviewer: "supervisor_admin",
      });

      const requests = await getCaseFreezeRequests(selectedCase.id);
      setFreezeRequests(requests);

      const audit = await getFreezeRequestAudit(actionRequestId);
      setAuditEntries(audit);

      onToast(`Freeze request #${actionRequestId} rejected`);
      setShowRejectDialog(false);
      setRejectionReason("");
      setActionRequestId(null);
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : "Could not reject freeze request",
      );
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleExecuteSubmit = async () => {
    if (!actionRequestId || !selectedCase) return;

    setBusyRequestId(actionRequestId);

    try {
      await executeFreezeRequest(actionRequestId, {
        execution_reference: executionReference || "DEF-EXEC-001",
        execution_details: executionDetails || "Completed on-chain freeze operation",
        executed_by: "fiu_liaison",
      });

      const requests = await getCaseFreezeRequests(selectedCase.id);
      setFreezeRequests(requests);

      const audit = await getFreezeRequestAudit(actionRequestId);
      setAuditEntries(audit);

      onToast(`Freeze request #${actionRequestId} executed`);
      setShowExecuteDialog(false);
      setExecutionReference("");
      setExecutionDetails("");
      setActionRequestId(null);
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : "Could not execute freeze request",
      );
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleDownloadFreezePdf = async (requestId: number) => {
    try {
      await downloadFreezeRequest(requestId);
      onToast(`Freeze request #${requestId} PDF downloaded`);
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : "Freeze PDF download failed",
      );
    }
  };

  if (!selectedCase) {
    return (
      <div className="view-stack">
        <div className="empty-state">
          <Zap size={22} />
          <strong>No active case selected</strong>
          <span>Select a case to manage reports and freeze requests.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="view-stack">
      <div className="report-hero panel">
        <div>
          <span className="eyebrow">CASE DOSSIER</span>
          <h2>{selectedCase.id}</h2>
          <p>
            {selectedCase.victim_name ?? "Complainant"} ·{" "}
            {selectedCase.fraud_type ?? "Unclassified"} ·{" "}
            {formatInr(selectedCase.amount_inr ?? 0, true)}
          </p>
        </div>
        <div className="report-actions">
          <button className="primary-button" onClick={handleReport}>
            <Zap size={16} /> Generate report PDF
          </button>
          <button className="secondary-button" onClick={handleFreeze}>
            <ShieldCheck size={16} /> Create freeze request
          </button>
        </div>
      </div>

      <section className="panel report-list">
        <SectionHeading title="Freeze Requests & Compliance Workflows" />

        {freezeRequests.length === 0 ? (
          <div className="empty-state">
            <ShieldCheck size={22} />
            <strong>No freeze requests yet</strong>
            <span>Create a request to initiate emergency preservation or freezing.</span>
          </div>
        ) : (
          freezeRequests.map((req) => (
            <div key={req.id} className="report-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="report-file">
                  <ShieldCheck size={18} />
                  <div>
                    <strong>Request #{req.id} · Case {req.case_id}</strong>
                    <span>Status: {req.status} · Triggered by: {req.triggered_by}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {req.status === "pending" && (
                    <button
                      className="secondary-button"
                      disabled={busyRequestId === req.id}
                      onClick={() => handleMoveToReview(req)}
                    >
                      Move to review
                    </button>
                  )}

                  {req.status === "under_review" && (
                    <>
                      <button
                        className="primary-button"
                        disabled={busyRequestId === req.id}
                        onClick={() => handleApprove(req)}
                      >
                        Approve
                      </button>
                      <button
                        className="secondary-button"
                        disabled={busyRequestId === req.id}
                        onClick={() => {
                          setActionRequestId(req.id);
                          setShowRejectDialog(true);
                        }}
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {req.status === "approved" && (
                    <button
                      className="primary-button"
                      disabled={busyRequestId === req.id}
                      onClick={() => {
                        setActionRequestId(req.id);
                        setShowExecuteDialog(true);
                      }}
                    >
                      Mark executed
                    </button>
                  )}

                  <button
                    className="secondary-button"
                    onClick={() => handleDownloadFreezePdf(req.id)}
                  >
                    Download PDF
                  </button>
                </div>
              </div>

              {req.rejection_reason && (
                <div style={{ color: "#ff8a8c", fontSize: 11 }}>
                  Rejection reason: {req.rejection_reason}
                </div>
              )}

              {req.execution_reference && (
                <div style={{ color: "#7fe0ac", fontSize: 11 }}>
                  Execution Ref: {req.execution_reference} — {req.execution_details}
                </div>
              )}
            </div>
          ))
        )}
      </section>

      {auditEntries.length > 0 && (
        <section className="panel report-list">
          <SectionHeading title="Freeze Audit Log" />
          {auditEntries.map((log) => (
            <div key={log.id} className="report-row">
              <div className="report-file">
                <div>
                  <strong>
                    {log.action.toUpperCase()} by {log.performed_by}
                  </strong>
                  <span>{formatDateTime(log.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {showRejectDialog && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100,
        }}>
          <div className="panel" style={{ width: 400, padding: 20 }}>
            <h3>Reject Freeze Request #{actionRequestId}</h3>
            <textarea
              className="text-input"
              style={{ width: "100%", height: 80, margin: "12px 0" }}
              placeholder="Reason for rejection..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                className="secondary-button"
                onClick={() => {
                  setShowRejectDialog(false);
                  setActionRequestId(null);
                }}
              >
                Cancel
              </button>
              <button className="primary-button" onClick={handleRejectSubmit}>
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {showExecuteDialog && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100,
        }}>
          <div className="panel" style={{ width: 400, padding: 20 }}>
            <h3>Execute Freeze Request #{actionRequestId}</h3>
            <input
              className="text-input"
              style={{ width: "100%", margin: "12px 0 8px 0" }}
              placeholder="Execution Reference Code (e.g. EXEC-1234)"
              value={executionReference}
              onChange={(e) => setExecutionReference(e.target.value)}
            />
            <textarea
              className="text-input"
              style={{ width: "100%", height: 60, marginBottom: 12 }}
              placeholder="Execution Details / Notes..."
              value={executionDetails}
              onChange={(e) => setExecutionDetails(e.target.value)}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                className="secondary-button"
                onClick={() => {
                  setShowExecuteDialog(false);
                  setActionRequestId(null);
                }}
              >
                Cancel
              </button>
              <button className="primary-button" onClick={handleExecuteSubmit}>
                Confirm Execution
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
          <h2>Integrations & Datasources</h2>
          <p>Manage node endpoints, API connections, and intelligence providers.</p>
        </div>
      </div>
      <section className="integration-grid">
        {integrations.map((item) => (
          <div className="panel integration-card" key={item.name}>
            <div className="integration-icon">
              <Database size={18} />
            </div>
            <div>
              <div className="integration-title">
                <strong>{item.name}</strong>
                <span className={`integration-status ${item.status.toLowerCase()}`}>{item.status}</span>
              </div>
              <p>{item.type}</p>
              <small>Last synced: {item.lastSync}</small>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function DetailDrawer({ title, body, onClose }: { title: string; body: string; onClose: () => void }) {
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "flex-end",
      zIndex: 90,
    }}>
      <div className="panel" style={{ width: 380, height: "100%", borderRadius: 0, padding: 24, overflowY: "auto" }}>
        <button
          className="secondary-button"
          style={{ float: "right" }}
          onClick={onClose}
        >
          Close
        </button>
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 12, color: "#82909d" }}>{body}</pre>
      </div>
    </div>
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
  const [dialogNetwork, setDialogNetwork] = useState<TraceNetwork>("ethereum");
  const [dialogAssetType, setDialogAssetType] = useState<TronAssetType>("all");
  const [dialogMaxHops, setDialogMaxHops] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleNetworkChange = (next: TraceNetwork) => {
    setDialogNetwork(next);
    setError("");
    // TRON tracing is heavier (many API calls per hop) -> cap hops like the workspace does
    if (next === "tron" && dialogMaxHops > 5) setDialogMaxHops(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const addr = walletAddress.trim();
    if (dialogNetwork === "tron" && !isTronAddress(addr)) {
      setError(
        isEthereumAddress(addr)
          ? "This looks like an Ethereum address. Switch the network to Ethereum, or enter a TRON address (T...)."
          : "Invalid wallet address. Enter a valid TRON address (T...)."
      );
      return;
    }
    if (dialogNetwork === "ethereum" && !isEthereumAddress(addr)) {
      setError(
        isTronAddress(addr)
          ? "This looks like a TRON address. Switch the network to TRON."
          : "Invalid wallet address. Enter a valid Ethereum address (0x...)."
      );
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const createdCase = await createCase({
        complaint_id: complaintId.trim(),
        primary_wallet: addr,
        chain: dialogNetwork === "tron" ? "TRON" : "Ethereum",
        status: "New",
        priority: "Medium",
        auto_trace: true,
        max_hops: dialogMaxHops,
        ...(dialogNetwork === "tron" ? { asset_type: dialogAssetType } : {}),
      });

      onSubmit(createdCase);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create investigation case");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div className="panel" style={{ width: 420, padding: 24 }}>
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>New Investigation Intake</h3>
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <label className="case-select">
            <span>Network</span>
            <div style={{ display: "flex", gap: 6 }}>
              {(["ethereum", "tron"] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={dialogNetwork === n ? "primary-button" : "secondary-button"}
                  onClick={() => handleNetworkChange(n)}
                  disabled={submitting}
                  style={{ flex: 1, padding: "8px 10px", fontSize: 12, whiteSpace: "nowrap" }}
                >
                  {n === "ethereum" ? "Ethereum / Etherscan" : "TRON"}
                </button>
              ))}
            </div>
          </label>

          <input
            className="text-input"
            placeholder="NCRP Complaint ID (e.g. NCRP-2026-9999)"
            value={complaintId}
            onChange={(e) => setComplaintId(e.target.value)}
            required
          />

          <input
            className="text-input"
            placeholder={dialogNetwork === "tron" ? "Victim Wallet Address (T...)" : "Victim Wallet Address (0x...)"}
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            required
          />

          <label className="case-select">
            <span>Trace depth (hops)</span>
            <select
              className="text-input"
              value={dialogMaxHops}
              onChange={(e) => setDialogMaxHops(Number(e.target.value))}
            >
              {(dialogNetwork === "tron" ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).map((n) => (
                <option key={n} value={n}>
                  {n} hop{n > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </label>

          {dialogNetwork === "tron" && (
            <label className="case-select">
              <span>Asset</span>
              <select
                className="text-input"
                value={dialogAssetType}
                onChange={(e) => setDialogAssetType(e.target.value as TronAssetType)}
              >
                <option value="all">All</option>
                <option value="trx">TRX</option>
                <option value="trc20">TRC20</option>
              </select>
            </label>
          )}

          {error && (
            <div style={{ fontSize: 12, color: "#ff6b6b" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
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
              {submitting ? "Creating..." : "Create Case"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
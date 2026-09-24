const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export type ApiCase = {
  id: string;
  complaint_id: string | null;
  victim_name: string | null;
  primary_wallet: string;
  amount_inr: number | null;
  chain: string | null;
  fraud_type: string | null;
  status: string | null;
  priority: string | null;
  risk_score: number | null;
  assigned_investigator: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CreateCaseInput = {
  id?: string;
  complaint_id?: string;
  victim_name?: string;
  primary_wallet: string;
  amount_inr?: number;
  chain?: string;
  fraud_type?: string;
  status?: string;
  priority?: string;
  assigned_investigator?: string;
  auto_trace?: boolean;
  max_hops?: number;
  /** Only meaningful when chain is "TRON": "all" | "trx" | "trc20". */
  asset_type?: string;
};

export type UpdateCaseInput = Partial<{
  status: string;
  priority: string;
  assigned_investigator: string;
  risk_score: number;
  fraud_type: string;
  victim_name: string;
  amount_inr: number;
}>;

/**
 * FastAPI error bodies come in a few shapes:
 *  - { detail: "some string" }
 *  - { detail: [{ loc: [...], msg: "...", type: "..." }, ...] }  (422 validation errors)
 *  - { detail: { msg: "..." } }
 *  - sometimes no JSON body at all
 *
 * Passing the raw object/array straight into `new Error(...)` stringifies it
 * as "[object Object]" (or "[object Object],[object Object]" for arrays),
 * which is what was showing up in the New Investigation dialog. This always
 * returns a plain, readable string instead.
 */
function extractErrorMessage(body: unknown, status: number): string {
  const detail = (body as { detail?: unknown } | null)?.detail;

  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const joined = detail
      .map((d) => {
        if (typeof d === "string") return d;
        if (d && typeof d === "object" && "msg" in (d as Record<string, unknown>)) {
          const loc = Array.isArray((d as any).loc) ? (d as any).loc.filter((p: unknown) => p !== "body").join(".") : "";
          const msg = String((d as { msg?: string }).msg ?? "");
          return loc ? `${loc}: ${msg}` : msg;
        }
        return "";
      })
      .filter(Boolean)
      .join("; ");
    if (joined) return joined;
  }

  if (detail && typeof detail === "object" && "msg" in (detail as Record<string, unknown>)) {
    const msg = String((detail as { msg?: string }).msg ?? "");
    if (msg) return msg;
  }

  if (typeof (body as any)?.message === "string" && (body as any).message.trim()) {
    return (body as any).message;
  }

  return `Request failed (${status})`;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(extractErrorMessage(err, res.status));
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

export async function listCases(params?: {
  status?: string;
  priority?: string;
  search?: string;
}): Promise<ApiCase[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.priority) qs.set("priority", params.priority);
  if (params?.search) qs.set("search", params.search);
  const res = await fetch(`${API_URL}/cases${qs.toString() ? `?${qs}` : ""}`);
  return handle<ApiCase[]>(res);
}

export async function getCase(caseId: string): Promise<ApiCase> {
  const res = await fetch(`${API_URL}/cases/${encodeURIComponent(caseId)}`);
  return handle<ApiCase>(res);
}

export type CaseTransaction = {
  id: number;
  case_id: string;
  tx_hash: string;
  from_address: string;
  to_address: string;
  value_wei: string;
  hop: number;
  direction: string;
  block_number: string;
  timestamp: string;
  is_error: string;
  wallet_address: string | null;
};

export async function getCaseTransactions(caseId: string): Promise<CaseTransaction[]> {
  const res = await fetch(
    `${API_URL}/cases/${encodeURIComponent(caseId)}/transactions`
  );
  return handle<CaseTransaction[]>(res);
}

export async function createCase(input: CreateCaseInput): Promise<ApiCase> {
  const res = await fetch(`${API_URL}/cases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return handle<ApiCase>(res);
}

export async function updateCase(caseId: string, input: UpdateCaseInput): Promise<ApiCase> {
  const res = await fetch(`${API_URL}/cases/${encodeURIComponent(caseId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return handle<ApiCase>(res);
}

export async function deleteCase(caseId: string): Promise<void> {
  const res = await fetch(`${API_URL}/cases/${encodeURIComponent(caseId)}`, { method: "DELETE" });
  return handle<void>(res);
}
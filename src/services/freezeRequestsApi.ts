const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export type FreezeRequestStatus =
  | "Pending"
  | "Under Review"
  | "Approved"
  | "Rejected"
  | "Executed";

export interface FreezeRequest {
  id: number;
  wallet_address: string;
  case_id: string;
  reason: string;
  triggered_by: string;
  status: FreezeRequestStatus;
  created_at: string;
  updated_at?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  execution_reference?: string | null;
  execution_details?: string | null;
  chain?: string | null;
  complaint_id?: string | null;
  risk_score?: number | null;
}

export interface FreezeRequestAudit {
  id: number;
  request_id: number;
  case_id: string;
  action: string;
  previous_status: FreezeRequestStatus | null;
  new_status: FreezeRequestStatus | null;
  actor: string;
  reason?: string | null;
  details?: string | null;
  created_at: string;
}

async function parseResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.detail || `Request failed (${res.status})`);
  }

  return data as T;
}

export async function createFreezeRequest(input: {
  case_id: string;
  reason: string;
  triggered_by?: string;
}): Promise<FreezeRequest> {
  const res = await fetch(`${API_URL}/freeze-requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return parseResponse<FreezeRequest>(res);
}

export async function getCaseFreezeRequests(
  caseId: string,
): Promise<FreezeRequest[]> {
  const res = await fetch(
    `${API_URL}/freeze-requests/cases/${encodeURIComponent(caseId)}`,
  );

  return parseResponse<FreezeRequest[]>(res);
}

export async function moveFreezeRequestToReview(
  requestId: number,
  actor = "investigator",
): Promise<{ id: number; status: FreezeRequestStatus }> {
  const res = await fetch(`${API_URL}/freeze-requests/${requestId}/review`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ actor }),
  });

  return parseResponse(res);
}

export async function approveFreezeRequest(
  requestId: number,
  actor = "reviewer",
): Promise<{ id: number; status: FreezeRequestStatus }> {
  const res = await fetch(`${API_URL}/freeze-requests/${requestId}/approve`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ actor }),
  });

  return parseResponse(res);
}

export async function rejectFreezeRequest(
  requestId: number,
  reason: string,
  actor = "reviewer",
): Promise<{ id: number; status: FreezeRequestStatus; rejection_reason: string }> {
  const res = await fetch(`${API_URL}/freeze-requests/${requestId}/reject`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ actor, reason }),
  });

  return parseResponse(res);
}

export async function executeFreezeRequest(
  requestId: number,
  executionReference: string,
  executionDetails?: string,
  actor = "investigator",
): Promise<{ id: number; status: FreezeRequestStatus; execution_reference: string }> {
  const res = await fetch(`${API_URL}/freeze-requests/${requestId}/execute`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      actor,
      execution_reference: executionReference,
      execution_details: executionDetails,
    }),
  });

  return parseResponse(res);
}

export async function getFreezeRequestAudit(
  requestId: number,
): Promise<FreezeRequestAudit[]> {
  const res = await fetch(`${API_URL}/freeze-requests/${requestId}/audit`);

  return parseResponse<FreezeRequestAudit[]>(res);
}

export async function downloadFreezeRequest(requestId: number): Promise<void> {
  const res = await fetch(`${API_URL}/freeze-requests/${requestId}/pdf`);

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `PDF failed (${res.status})`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `freeze-request-${requestId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export async function downloadCaseReport(caseId: string) {
  const res = await fetch(
    `${API_URL}/reports/${encodeURIComponent(caseId)}/pdf`
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Report failed (${res.status})`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${caseId}-investigation-report.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}
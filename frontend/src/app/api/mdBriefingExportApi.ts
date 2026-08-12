/**
 * Client-side helper for the MD Portfolio Briefing export endpoint.
 *
 * Not RTK-Query — the response is a binary blob (xlsx/pdf/pptx), not a
 * JSON payload, so a plain fetch + Blob-download flow is simpler than
 * bending RTK Query around it.
 *
 * The backend endpoint is MD-only (routes/mdBriefingExport.ts uses
 * `requireRole('MD')`) — non-MD callers will see a 403.
 */

import { env } from '../../env';

// Same base URL RTK Query uses (see baseQuery.ts). Bypasses the Vercel
// /api rewrite when that isn't in play — direct-to-Render on prod.
const API = env.VITE_API_BASE_URL.replace(/\/$/, '');

export type MdBriefingFormat = 'xlsx' | 'pdf' | 'pptx';

/** Same 5 filters the MdSchemeSummaryModal exposes. */
export interface MdBriefingFilters {
  schemeId?: number | null;
  sectorId?: number | null;
  regionId?: number | null;
  divisionId?: number | null;
  status?: string | null;
}

interface DownloadOpts {
  format: MdBriefingFormat;
  filters: MdBriefingFilters;
  accessToken: string | null;
}

/**
 * Fetch the briefing document and trigger a browser download. Rejects
 * with a descriptive error if the response is non-2xx so the modal can
 * surface it inline.
 */
export async function downloadMdBriefing({ format, filters, accessToken }: DownloadOpts): Promise<void> {
  const params = new URLSearchParams({ format });
  if (filters.schemeId   != null) params.set('schemeId',   String(filters.schemeId));
  if (filters.sectorId   != null) params.set('sectorId',   String(filters.sectorId));
  if (filters.regionId   != null) params.set('regionId',   String(filters.regionId));
  if (filters.divisionId != null) params.set('divisionId', String(filters.divisionId));
  if (filters.status)             params.set('status',     filters.status);

  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`${API}/md-briefing/export?${params.toString()}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    // Try to surface backend's structured error (JSON envelope) — fall
    // back to a status-only message if the body isn't parseable.
    let msg = `Export failed (HTTP ${res.status})`;
    try {
      const body = await res.json();
      msg = body?.error?.message ?? msg;
    } catch { /* body wasn't JSON; keep status message */ }
    throw new Error(msg);
  }

  const blob = await res.blob();
  const suggested = extractFilenameFromDisposition(res.headers.get('Content-Disposition'))
    ?? `md-briefing.${format}`;
  triggerBlobDownload(blob, suggested);
}

// ─── Project snapshot (single project, drilled-in view) ──────────────────

export type ProjectSnapshotFormat = 'xlsx' | 'pdf';

interface SnapshotOpts {
  projectId: string;
  format: ProjectSnapshotFormat;
  accessToken: string | null;
}

/**
 * Download a single-project snapshot (PDF one-pager or XLSX single-row
 * import-template). Backend route is MD-only.
 */
export async function downloadProjectSnapshot({ projectId, format, accessToken }: SnapshotOpts): Promise<void> {
  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  const url = `${API}/projects/${encodeURIComponent(projectId)}/snapshot?format=${format}`;
  const res = await fetch(url, { method: 'GET', headers, credentials: 'include' });
  if (!res.ok) {
    let msg = `Snapshot export failed (HTTP ${res.status})`;
    try { const body = await res.json(); msg = body?.error?.message ?? msg; } catch { /* body not JSON */ }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const filename = extractFilenameFromDisposition(res.headers.get('Content-Disposition'))
    ?? `project-snapshot.${format}`;
  triggerBlobDownload(blob, filename);
}

/** Parse the filename off `Content-Disposition: attachment; filename="..."`. */
function extractFilenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const m = /filename="([^"]+)"/i.exec(header);
  return m?.[1] ?? null;
}

/** Create an in-memory anchor + click it to trigger the browser save dialog. */
function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on next tick so the click has a chance to consume the URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

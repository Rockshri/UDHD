/**
 * Client helpers for the project import + export endpoints.
 *
 * Uses plain `fetch` (not RTK Query) because responses are binary blobs
 * (xlsx/pdf/pptx) that don't fit RTK's JSON caching. Endpoints:
 *
 *   GET  /api/projects/template.xlsx        → blank template download
 *   POST /api/projects/import (multipart)   → preview or commit
 *   GET  /api/projects/export?format=…      → filtered export
 */

import { env } from '../../env';

// Same base URL RTK Query uses. On Vercel this may point directly at the
// Render backend (bypassing the /api rewrite), so relative "/api/..." paths
// silently 404. Route every export/import through the env-configured base.
const API = env.VITE_API_BASE_URL.replace(/\/$/, '');

export type ExportFormat = 'xlsx' | 'pdf' | 'pptx';

export interface ExportFilters {
  search?: string;
  status?: string;
  projectStage?: string;
  contractType?: string;
  sectorId?: number;
  divisionId?: number;
  regionId?: number;
  schemeId?: number;
}

// ─── Blank template ──────────────────────────────────────────────────────

export async function downloadBlankTemplate(accessToken: string | null): Promise<void> {
  const res = await fetch(`${API}/projects/template.xlsx`, {
    method: 'GET',
    headers: authHeaders(accessToken),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await extractErrorMessage(res, 'Template download failed.'));
  const blob = await res.blob();
  triggerBlobDownload(blob, filenameFromDisposition(res) ?? 'BUIDCO_Input_Sheet_template.xlsx');
}

// ─── Export ──────────────────────────────────────────────────────────────

interface DownloadExportOpts {
  format: ExportFormat;
  accessToken: string | null;
  /** When set, exports ONLY these project IDs; filters are ignored server-side. */
  projectIds?: string[];
  filters?: ExportFilters;
}

export async function downloadProjectsExport(opts: DownloadExportOpts): Promise<void> {
  const params = new URLSearchParams({ format: opts.format });
  if (opts.projectIds && opts.projectIds.length > 0) {
    params.set('projectIds', opts.projectIds.join(','));
  } else if (opts.filters) {
    const f = opts.filters;
    if (f.search)                    params.set('search',       f.search);
    if (f.status)                    params.set('status',       f.status);
    if (f.projectStage)              params.set('projectStage', f.projectStage);
    if (f.contractType)              params.set('contractType', f.contractType);
    if (f.sectorId !== undefined)    params.set('sectorId',     String(f.sectorId));
    if (f.divisionId !== undefined)  params.set('divisionId',   String(f.divisionId));
    if (f.regionId !== undefined)    params.set('regionId',     String(f.regionId));
    if (f.schemeId !== undefined)    params.set('schemeId',     String(f.schemeId));
  }

  const res = await fetch(`${API}/projects/export?${params.toString()}`, {
    method: 'GET',
    headers: authHeaders(opts.accessToken),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await extractErrorMessage(res, 'Export failed.'));
  const blob = await res.blob();
  triggerBlobDownload(blob, filenameFromDisposition(res) ?? `projects.${opts.format}`);
}

// ─── Import ──────────────────────────────────────────────────────────────

export interface ImportRowResult {
  rowNumber: number;
  projectName: string;
  status: 'valid' | 'invalid' | 'imported' | 'skipped-duplicate' | 'skipped-error';
  errors?: Array<{ field: string; message: string }>;
  projectId?: string;
}

export interface ImportSummary {
  fileName?: string;
  mode: 'preview' | 'commit';
  totals: {
    projectRowsRead: number;
    validRows: number;
    invalidRows: number;
    imported: number;
    skippedDuplicate: number;
    skippedError: number;
    childRowsAttached: number;
    childRowsSkipped: number;
  };
  rows: ImportRowResult[];
  sheetErrors: string[];
}

interface ImportOpts {
  file: File;
  mode: 'preview' | 'commit';
  accessToken: string | null;
}

export async function uploadImport(opts: ImportOpts): Promise<ImportSummary> {
  const form = new FormData();
  form.append('file', opts.file);
  const res = await fetch(`${API}/projects/import?mode=${opts.mode}`, {
    method: 'POST',
    body: form,
    headers: authHeaders(opts.accessToken), // Content-Type auto-set by FormData
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await extractErrorMessage(res, 'Import failed.'));
  return (await res.json()) as ImportSummary;
}

// ─── Internals ───────────────────────────────────────────────────────────

function authHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function filenameFromDisposition(res: Response): string | null {
  const h = res.headers.get('Content-Disposition');
  if (!h) return null;
  const m = /filename="([^"]+)"/i.exec(h);
  return m?.[1] ?? null;
}

async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return body?.error?.message ?? `${fallback} (HTTP ${res.status})`;
  } catch {
    return `${fallback} (HTTP ${res.status})`;
  }
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

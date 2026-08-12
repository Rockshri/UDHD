import { useRef, useState } from 'react';
import { useAppSelector } from '../../app/hooks';
import { selectAccessToken } from '../../features/auth/authSlice';
import {
  downloadBlankTemplate, uploadImport, type ImportSummary,
} from '../../app/api/projectImportExportApi';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

/**
 * Two-step import flow inside a single modal:
 *   1. Upload → runs a `preview` call → shows validation results (no writes)
 *   2. If any rows are valid, "Import N rows" runs a `commit` call → writes
 *
 * Users can dismiss anytime; a successful import auto-closes after showing
 * the summary and calls `onImported` so the parent can invalidate its list.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after a successful commit so the caller can refetch. */
  onImported?: (summary: ImportSummary) => void;
}

export function ImportProjectsModal({ open, onClose, onImported }: Props): JSX.Element | null {
  const accessToken = useAppSelector(selectAccessToken);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ImportSummary | null>(null);
  const [commitResult, setCommitResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const reset = (): void => {
    setFile(null);
    setPreview(null);
    setCommitResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const closeAll = (): void => { reset(); onClose(); };

  const onFilePick = (f: File | null): void => {
    setFile(f);
    setPreview(null);
    setCommitResult(null);
    setError(null);
  };

  const runPreview = async (): Promise<void> => {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const summary = await uploadImport({ file, mode: 'preview', accessToken });
      setPreview(summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed.');
    } finally {
      setBusy(false);
    }
  };

  const runCommit = async (): Promise<void> => {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const summary = await uploadImport({ file, mode: 'commit', accessToken });
      setCommitResult(summary);
      onImported?.(summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  };

  const runDownloadTemplate = async (): Promise<void> => {
    setBusy(true); setError(null);
    try {
      await downloadBlankTemplate(accessToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Template download failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-projects-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-3"
    >
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={busy ? undefined : closeAll}
      />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-2xl">
        {/* Header */}
        <header
          className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
          style={{ background: 'linear-gradient(100deg,#1E3A5F 0%,#2563EB 100%)' }}
        >
          <div className="min-w-0">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#93C5FD]">
              📥 Bulk Import
            </p>
            <h2 id="import-projects-title" className="mt-0.5 text-[15px] font-bold text-white">
              Import Projects from Excel
            </h2>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={closeAll}
            disabled={busy}
            className="border-white/40 bg-white/15 text-white hover:bg-white/25"
          >
            ✕
          </Button>
        </header>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-4 py-4">
          {commitResult ? (
            <SuccessBlock summary={commitResult} onClose={closeAll} onImportMore={reset} />
          ) : (
            <>
              {/* Step 1 — file picker */}
              <section className="space-y-3">
                <p className="text-[12.5px] text-[#374151]">
                  Upload a filled copy of the{' '}
                  <button
                    type="button"
                    onClick={() => void runDownloadTemplate()}
                    className="font-semibold text-[#1D4ED8] hover:underline"
                  >
                    BUIDCO Input Sheet template ↓
                  </button>. The importer parses the <em>Project Register</em>,{' '}
                  <em>CoS-EoT Log</em>, <em>Management Actions Log</em>, and{' '}
                  <em>GeoTagging Photos Log</em> sheets.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-2 rounded border border-[#D1D5DB] bg-[#F9FAFB] px-3 py-2 text-[12px] font-medium text-[#374151] hover:bg-[#F3F4F6]">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      className="hidden"
                      disabled={busy}
                      onChange={(e) => onFilePick(e.target.files?.[0] ?? null)}
                    />
                    📁 Choose file…
                  </label>
                  {file ? (
                    <span className="text-[12px] text-[#111827]">
                      <span className="font-semibold">{file.name}</span>{' '}
                      <span className="text-[#6B7280]">({formatBytes(file.size)})</span>
                    </span>
                  ) : (
                    <span className="text-[12px] italic text-[#9CA3AF]">No file chosen</span>
                  )}
                </div>
                {file && !preview ? (
                  <Button onClick={() => void runPreview()} disabled={busy}>
                    {busy ? 'Previewing…' : 'Preview →'}
                  </Button>
                ) : null}
              </section>

              {/* Step 2 — preview + commit */}
              {preview ? (
                <section className="mt-4 space-y-3 border-t border-[#F3F4F6] pt-4">
                  <TotalsBlock summary={preview} />
                  {preview.sheetErrors.length > 0 ? (
                    <div className="rounded border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-[11.5px] text-[#B91C1C]">
                      <p className="font-semibold">Sheet-level warnings:</p>
                      <ul className="mt-1 list-disc pl-4">
                        {preview.sheetErrors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
                        {preview.sheetErrors.length > 8 ? <li>…and {preview.sheetErrors.length - 8} more</li> : null}
                      </ul>
                    </div>
                  ) : null}
                  <RowsTable rows={preview.rows} />
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      onClick={() => void runCommit()}
                      disabled={busy || preview.totals.validRows === 0}
                      title={preview.totals.validRows === 0 ? 'No valid rows to import' : undefined}
                    >
                      {busy ? 'Importing…' : `✓ Import ${preview.totals.validRows} row${preview.totals.validRows === 1 ? '' : 's'}`}
                    </Button>
                    <Button variant="outline" onClick={reset} disabled={busy}>Choose different file</Button>
                  </div>
                </section>
              ) : null}
            </>
          )}

          {error ? (
            <div role="alert" className="mt-3 rounded border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-[12px] font-medium text-[#B91C1C]">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-blocks ──────────────────────────────────────────────────────────

function TotalsBlock({ summary }: { summary: ImportSummary }): JSX.Element {
  const t = summary.totals;
  return (
    <div className="grid grid-cols-2 gap-2 rounded border border-[#E5E7EB] bg-[#F9FAFB] p-2 text-[11.5px] sm:grid-cols-4">
      <Stat label="Rows read"          value={t.projectRowsRead} tone="brand" />
      <Stat label="Valid"              value={t.validRows}       tone="success" />
      <Stat label="Invalid"            value={t.invalidRows}     tone="danger" />
      <Stat label="Duplicates skipped" value={t.skippedDuplicate} tone="warning" />
      {summary.mode === 'commit' ? (
        <>
          <Stat label="Imported"       value={t.imported}         tone="success" />
          <Stat label="Insert errors"  value={t.skippedError}     tone="danger" />
          <Stat label="Child rows +"   value={t.childRowsAttached} tone="brand" />
          <Stat label="Child skipped"  value={t.childRowsSkipped} tone="warning" />
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'brand' | 'success' | 'danger' | 'warning' }): JSX.Element {
  const toneClass = {
    brand:   'text-[#1E3A5F]',
    success: 'text-[#15803D]',
    danger:  'text-[#B91C1C]',
    warning: 'text-[#B45309]',
  }[tone];
  return (
    <div className="flex flex-col rounded border border-[#E5E7EB] bg-white px-2 py-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">{label}</span>
      <span className={cn('mt-0.5 text-lg font-bold tabular-nums leading-none', toneClass)}>{value}</span>
    </div>
  );
}

function RowsTable({ rows }: { rows: ImportSummary['rows'] }): JSX.Element {
  if (rows.length === 0) return <p className="text-[12px] text-[#6B7280]">No data rows found.</p>;
  const shown = rows.slice(0, 100);
  return (
    <div className="overflow-x-auto rounded border border-[#E5E7EB]">
      <table className="w-full min-w-[560px] border-collapse text-[11.5px]">
        <thead className="bg-[#F9FAFB] text-[10.5px] uppercase tracking-wider text-[#6B7280]">
          <tr>
            <th className="px-2 py-1.5 text-left">Row</th>
            <th className="px-2 py-1.5 text-left">Project Name</th>
            <th className="px-2 py-1.5 text-left">Status</th>
            <th className="px-2 py-1.5 text-left">Errors</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={i} className={cn('border-t border-[#F3F4F6]', i % 2 === 1 && 'bg-[#FAFAFA]')}>
              <td className="px-2 py-1 tabular-nums text-[#374151]">{r.rowNumber}</td>
              <td className="px-2 py-1 font-semibold text-[#111827]">{r.projectName}</td>
              <td className="px-2 py-1"><StatusBadge status={r.status} /></td>
              <td className="px-2 py-1 text-[10.5px] text-[#B91C1C]">
                {r.errors && r.errors.length > 0 ? (
                  <ul className="list-disc pl-4">
                    {r.errors.slice(0, 3).map((e, ei) => <li key={ei}>{e.field}: {e.message}</li>)}
                    {r.errors.length > 3 ? <li>…and {r.errors.length - 3} more</li> : null}
                  </ul>
                ) : (
                  <span className="text-[#9CA3AF]">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > shown.length ? (
        <p className="border-t border-[#F3F4F6] bg-[#F9FAFB] px-2 py-1 text-[10.5px] text-[#6B7280]">
          Showing first {shown.length} of {rows.length} rows.
        </p>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: ImportSummary['rows'][number]['status'] }): JSX.Element {
  const cls = {
    'valid':             'bg-[#DBEAFE] text-[#1D4ED8] border-[#93C5FD]',
    'invalid':           'bg-[#FEE2E2] text-[#B91C1C] border-[#FCA5A5]',
    'imported':          'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]',
    'skipped-duplicate': 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]',
    'skipped-error':     'bg-[#FEE2E2] text-[#B91C1C] border-[#FCA5A5]',
  }[status];
  return <span className={cn('inline-flex rounded border px-2 py-0.5 text-[10.5px] font-bold', cls)}>{status}</span>;
}

function SuccessBlock({ summary, onClose, onImportMore }: { summary: ImportSummary; onClose: () => void; onImportMore: () => void }): JSX.Element {
  const t = summary.totals;
  const hadFailures = t.skippedError + t.invalidRows + t.skippedDuplicate > 0;
  return (
    <div className="space-y-3">
      <div className={cn('rounded border px-3 py-3', hadFailures ? 'border-[#FDE68A] bg-[#FFFBEB]' : 'border-[#86EFAC] bg-[#F0FDF4]')}>
        <p className={cn('text-[14px] font-bold', hadFailures ? 'text-[#B45309]' : 'text-[#15803D]')}>
          {hadFailures ? '⚠ Import completed with warnings' : '✓ Import successful'}
        </p>
        <p className="mt-0.5 text-[11.5px] text-[#374151]">
          Imported <strong>{t.imported}</strong> project{t.imported === 1 ? '' : 's'} + <strong>{t.childRowsAttached}</strong> child row(s).
        </p>
      </div>
      <TotalsBlock summary={summary} />
      {summary.sheetErrors.length > 0 ? (
        <div className="rounded border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-[11.5px] text-[#B91C1C]">
          <p className="font-semibold">Warnings:</p>
          <ul className="mt-1 list-disc pl-4">
            {summary.sheetErrors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
            {summary.sheetErrors.length > 10 ? <li>…and {summary.sheetErrors.length - 10} more</li> : null}
          </ul>
        </div>
      ) : null}
      <RowsTable rows={summary.rows} />
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button onClick={onClose}>Done</Button>
        <Button variant="outline" onClick={onImportMore}>Import another file</Button>
      </div>
    </div>
  );
}

// ─── Utils ───────────────────────────────────────────────────────────────

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

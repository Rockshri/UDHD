import { useEffect, useMemo, useState } from 'react';
import {
  useListMilestonesQuery,
  useReplaceMilestonesMutation,
  useUpsertMonthlyProgressMutation,
} from '../../app/api/milestonesApi';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { NumberField } from './NumberField';
import { FormSectionHeader } from './FormSectionHeader';
import { cn } from '../../lib/utils';
import type { MilestoneItem } from '../../types/api';

interface Props {
  projectId: string | null;
}

interface DraftMilestone {
  key: string;
  milestoneId?: number;
  milestoneName: string;
  weightPct: number | null;
  plannedDate: string | null;
  sortOrder: number;
}

function nextKey(): string {
  return `new-${Math.random().toString(36).slice(2, 10)}`;
}

function fromRemote(items: MilestoneItem[]): DraftMilestone[] {
  return items.map((m) => ({
    key: `m-${m.milestoneId}`,
    milestoneId: m.milestoneId,
    milestoneName: m.milestoneName,
    weightPct: m.weightPct,
    plannedDate: m.plannedDate,
    sortOrder: m.sortOrder ?? 0,
  }));
}

/** First-of-month string, e.g. "2026-07-01" from today. */
function currentMonthISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}-01`;
}

export function MilestonesSection({ projectId }: Props): JSX.Element {
  const { data, isLoading } = useListMilestonesQuery(projectId ?? '', { skip: !projectId });
  const [replaceMilestones, replaceState] = useReplaceMilestonesMutation();
  const [upsertProgress, upsertState] = useUpsertMonthlyProgressMutation();

  const remote = useMemo(() => data?.items ?? [], [data]);
  const [rows, setRows] = useState<DraftMilestone[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [snapMonth, setSnapMonth] = useState<string>(currentMonthISO());
  const [progressByMilestone, setProgressByMilestone] = useState<Record<number, number | null>>({});
  const [progressNote, setProgressNote] = useState<string>('');

  useEffect(() => {
    setRows(fromRemote(remote));
    setProgressByMilestone({});
  }, [remote]);

  const weightSum = rows.reduce((s, r) => s + (r.weightPct ?? 0), 0);
  const weightOk = Math.abs(weightSum - 100) < 0.5;

  if (!projectId) {
    return (
      <Card>
        <CardContent className="pt-4">
          <FormSectionHeader
            num="07"
            title="Milestones & Monthly Progress"
            sub="Milestone-weighted effective % — available after saving the project."
          />
          <p className="rounded border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[12.5px] text-[#92400E]">
            💡 Save the project first (Section 01 → Project Name) to define milestones and enter
            monthly progress. Weights must sum to exactly 100.
          </p>
        </CardContent>
      </Card>
    );
  }

  const updateRow = (idx: number, patch: Partial<DraftMilestone>): void => {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };
  const addRow = (): void => {
    setRows((r) => [
      ...r,
      { key: nextKey(), milestoneName: '', weightPct: null, plannedDate: null, sortOrder: r.length },
    ]);
  };
  const removeRow = (idx: number): void => {
    setRows((r) => r.filter((_, i) => i !== idx));
  };

  const handleSaveMilestones = async (): Promise<void> => {
    setError(null);
    setFlash(null);
    if (rows.length === 0) {
      setError('Add at least one milestone before saving.');
      return;
    }
    for (const r of rows) {
      if (!r.milestoneName.trim()) {
        setError('Every milestone needs a name.');
        return;
      }
      if (r.weightPct === null || Number.isNaN(r.weightPct) || r.weightPct <= 0) {
        setError(`Milestone "${r.milestoneName || '(unnamed)'}" needs a weight > 0.`);
        return;
      }
    }
    if (!weightOk) {
      setError(`Milestone weights must sum to 100 (currently ${weightSum.toFixed(2)}).`);
      return;
    }
    try {
      await replaceMilestones({
        projectId,
        body: {
          milestones: rows.map((r, i) => {
            const base = {
              milestoneName: r.milestoneName.trim(),
              weightPct: r.weightPct ?? 0,
              plannedDate: r.plannedDate ?? null,
              sortOrder: i,
            };
            return r.milestoneId ? { ...base, milestoneId: r.milestoneId } : base;
          }),
        },
      }).unwrap();
      setFlash('Milestones saved.');
    } catch (err) {
      setError(readError(err));
    }
  };

  const handleSaveProgress = async (): Promise<void> => {
    setError(null);
    setFlash(null);
    const entries = Object.entries(progressByMilestone)
      .filter((entry): entry is [string, number] => entry[1] !== null && entry[1] !== undefined)
      .map(([id, pct]) => ({
        milestoneId: Number(id),
        progressPct: pct,
        note: progressNote.trim() || null,
      }));
    if (entries.length === 0) {
      setError('Enter progress for at least one milestone.');
      return;
    }
    if (!/^\d{4}-\d{2}-01$/.test(snapMonth)) {
      setError('Month must be the first day of a month (YYYY-MM-01).');
      return;
    }
    try {
      await upsertProgress({ projectId, body: { snapMonth, entries } }).unwrap();
      setProgressByMilestone({});
      setProgressNote('');
      setFlash('Monthly progress saved.');
    } catch (err) {
      setError(readError(err));
    }
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <FormSectionHeader
          num="07"
          title="Milestones & Monthly Progress"
          sub="Weights must sum to 100 (Postgres trigger enforces this atomically at commit)"
          right={
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-bold',
                weightOk ? 'bg-[#F0FDF4] text-[#15803D]' : 'bg-[#FEF2F2] text-[#B91C1C]',
              )}
            >
              Σ {weightSum.toFixed(2)} / 100
            </span>
          }
        />

        {error ? (
          <div className="mb-3 rounded border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#B91C1C]">
            {error}
          </div>
        ) : null}
        {flash ? (
          <div className="mb-3 rounded border border-[#86EFAC] bg-[#F0FDF4] px-3 py-2 text-[12.5px] text-[#15803D]">
            {flash}
          </div>
        ) : null}

        <div className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">
          ▌ Milestone Definitions
        </div>
        <div className="space-y-2">
          {isLoading ? (
            <p className="text-[12.5px] text-[#6B7280]">Loading milestones…</p>
          ) : rows.length === 0 ? (
            <p className="rounded border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-[12.5px] text-[#6B7280]">
              No milestones yet — click <strong>+ Add Milestone</strong> to define the first one.
            </p>
          ) : (
            rows.map((r, i) => (
              <div
                key={r.key}
                className="grid grid-cols-1 gap-2 rounded border border-[#E5E7EB] bg-[#F9FAFB] p-2 md:grid-cols-[3fr_1fr_1fr_auto]"
              >
                <input
                  value={r.milestoneName}
                  onChange={(e) => updateRow(i, { milestoneName: e.target.value })}
                  placeholder="Milestone name"
                  className="h-9 rounded border border-[#D1D5DB] bg-white px-3 text-[13px]"
                />
                <NumberField
                  label="Weight %"
                  suffix="%"
                  value={r.weightPct}
                  onChange={(v) => updateRow(i, { weightPct: v })}
                  min={0}
                  max={100}
                />
                <label className="grid gap-1">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[#374151]">
                    Planned Date
                  </span>
                  <input
                    type="date"
                    value={r.plannedDate ?? ''}
                    onChange={(e) => updateRow(i, { plannedDate: e.target.value || null })}
                    className="h-9 rounded border border-[#D1D5DB] bg-white px-3 text-[13px]"
                  />
                </label>
                <div className="flex items-end">
                  <Button size="sm" variant="destructive" onClick={() => removeRow(i)}>
                    ×
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={addRow}>
            + Add Milestone
          </Button>
          <Button
            size="sm"
            onClick={handleSaveMilestones}
            disabled={replaceState.isLoading || rows.length === 0}
          >
            Save Milestone Set
          </Button>
          <span className="text-[11px] text-[#6B7280]">
            (Full replace-set — saved atomically with the weight-sum-100 trigger)
          </span>
        </div>

        {remote.length > 0 ? (
          <>
            <div className="mt-6 mb-2 text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">
              ▌ Monthly Progress Entry
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_2fr]">
              <label className="grid gap-1">
                <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[#374151]">
                  Snapshot Month (1st of month)
                </span>
                <input
                  type="date"
                  value={snapMonth}
                  onChange={(e) => setSnapMonth(e.target.value)}
                  className="h-9 rounded border border-[#D1D5DB] bg-white px-3 text-[13px]"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[#374151]">
                  Note (applies to all entries)
                </span>
                <input
                  value={progressNote}
                  onChange={(e) => setProgressNote(e.target.value)}
                  placeholder="Optional monthly note"
                  className="h-9 rounded border border-[#D1D5DB] bg-white px-3 text-[13px]"
                />
              </label>
            </div>

            <div className="mt-3 space-y-2">
              {remote.map((m) => (
                <div
                  key={m.milestoneId}
                  className="grid grid-cols-1 items-center gap-2 rounded border border-[#E5E7EB] p-2 md:grid-cols-[3fr_1fr_1fr]"
                >
                  <div>
                    <div className="text-[12.5px] font-semibold text-[#111827]">
                      {m.milestoneName}
                    </div>
                    <div className="text-[11px] text-[#6B7280]">
                      Weight: {m.weightPct ?? 0}% · Planned: {m.plannedDate ?? '—'}
                    </div>
                  </div>
                  <NumberField
                    label="Progress %"
                    suffix="%"
                    min={0}
                    max={100}
                    value={progressByMilestone[m.milestoneId] ?? null}
                    onChange={(v) =>
                      setProgressByMilestone((prev) => ({ ...prev, [m.milestoneId]: v }))
                    }
                  />
                  <div className="text-[11px] tabular-nums text-[#6B7280]">
                    Contribution:{' '}
                    <strong className="text-[#1D4ED8]">
                      {(((progressByMilestone[m.milestoneId] ?? 0) * (m.weightPct ?? 0)) / 100).toFixed(2)}
                    </strong>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSaveProgress}
                disabled={upsertState.isLoading}
              >
                Save Monthly Progress
              </Button>
              <span className="text-[11px] text-[#6B7280]">
                (Upsert on (milestone, month) — safe to re-submit for corrections)
              </span>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function readError(err: unknown): string {
  if (err && typeof err === 'object' && 'data' in err) {
    const data = (err as { data?: unknown }).data;
    if (data && typeof data === 'object' && 'error' in data) {
      const e = (data as { error?: { message?: string } }).error;
      if (e?.message) return e.message;
    }
  }
  return 'Something went wrong. Please retry.';
}

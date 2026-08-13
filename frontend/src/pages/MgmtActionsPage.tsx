import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { useGetMgmtActionSummaryQuery } from '../app/api/kpisApi';
import {
  useCreateStandaloneActionMutation,
  useDeleteStandaloneActionMutation,
  useListStandaloneActionsQuery,
  useUpdateStandaloneActionMutation,
  type StandaloneMgmtAction,
} from '../app/api/standaloneMgmtActionsApi';
import { useAppSelector } from '../app/hooks';
import { selectCurrentUser } from '../features/auth/authSlice';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { cn } from '../lib/utils';

type Tab = 'summary' | 'high' | 'zero';

export function MgmtActionsPage(): JSX.Element {
  const { data, isLoading } = useGetMgmtActionSummaryQuery();
  const standalone = useListStandaloneActionsQuery();
  const [tab, setTab] = useState<Tab>('summary');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const currentUser = useAppSelector(selectCurrentUser);
  const canWrite = (() => {
    const r = currentUser?.role;
    if (r === 'MD' || r === 'Admin') return true;
    // PD/Viewer follow their explicit write flag when the role is generic.
    return currentUser?.canUpdateProjects === true;
  })();

  const rows = useMemo(() => {
    const all = data?.items ?? [];
    const term = search.trim().toLowerCase();
    let subset = all;
    if (tab === 'high') subset = all.filter((r) => r.openItems > 0).sort((a, b) => b.openItems - a.openItems);
    if (tab === 'zero') subset = all.filter((r) => r.totalItems === 0);
    if (term) {
      subset = subset.filter((r) => (r.projectName ?? '').toLowerCase().includes(term));
    }
    return subset;
  }, [data, tab, search]);

  const totals = useMemo(() => {
    const all = data?.items ?? [];
    return {
      projects: all.length,
      totalActions: all.reduce((s, r) => s + r.totalItems, 0),
      openActions: all.reduce((s, r) => s + r.openItems, 0),
      closedActions: all.reduce((s, r) => s + r.closedItems, 0),
    };
  }, [data]);

  const standaloneItems = standalone.data?.items ?? [];
  const standaloneOpen = standaloneItems.filter((a) => a.status === 'Open').length;

  return (
    <article className="space-y-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#111827]">Management Actions</h1>
          <p className="text-[12.5px] text-[#6B7280]">
            Cross-project topics live below. Project-specific actions still live on each
            project's Input Sheet → Section 07.
          </p>
        </div>
        {canWrite ? (
          <Button variant="default" size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={14} aria-hidden />
            Add Action
          </Button>
        ) : null}
      </header>

      {/* ── Standalone actions (independent of any project) ─────────── */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[13px] font-bold text-[#111827]">
            Standalone Actions{' '}
            <span className="text-[11px] font-normal text-[#6B7280]">
              ({standaloneItems.length} total · {standaloneOpen} open)
            </span>
          </h2>
        </div>
        <StandaloneList
          items={standaloneItems}
          isLoading={standalone.isLoading}
          canWrite={canWrite}
        />
      </section>

      {/* ── Per-project rollup (existing behaviour) ────────────────── */}
      <section className="space-y-2 pt-2">
        <h2 className="text-[13px] font-bold text-[#111827]">Per-Project Rollup</h2>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Metric label="Projects" value={totals.projects} tone="brand" />
          <Metric label="Total Actions" value={totals.totalActions} tone="info" />
          <Metric label="Open" value={totals.openActions} tone="danger" />
          <Metric label="Closed" value={totals.closedActions} tone="success" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'summary', label: `All projects (${data?.items.length ?? 0})` },
              { id: 'high', label: `With open actions (${totals.openActions > 0 ? data?.items.filter((r) => r.openItems > 0).length : 0})` },
              { id: 'zero', label: `Without any actions (${data?.items.filter((r) => r.totalItems === 0).length ?? 0})` },
            ] satisfies Array<{ id: Tab; label: string }>
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-colors',
                tab === t.id
                  ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white'
                  : 'border-[#D1D5DB] bg-white text-[#6B7280] hover:text-[#374151]',
              )}
            >
              {t.label}
            </button>
          ))}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search project…"
            className="ml-auto h-8 w-64 rounded border border-[#D1D5DB] px-3 text-[12.5px]"
          />
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4">
                <Skeleton className="h-40 w-full" />
              </div>
            ) : rows.length === 0 ? (
              <div className="p-6 text-center text-[12.5px] text-[#6B7280]">
                No projects match the current filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-[12.5px]">
                  <thead>
                    <tr className="bg-[#F9FAFB] text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">
                      <th className="px-4 py-2 text-left">#</th>
                      <th className="px-4 py-2 text-left">Project</th>
                      <th className="px-4 py-2 text-right">Total</th>
                      <th className="px-4 py-2 text-right">Open</th>
                      <th className="px-4 py-2 text-right">Closed</th>
                      <th className="px-4 py-2 text-right">Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => {
                      const pct = r.totalItems > 0 ? Math.round((r.closedItems / r.totalItems) * 100) : 0;
                      return (
                        <tr
                          key={r.projectId}
                          className={cn(
                            'border-b border-[#F3F4F6] hover:bg-[#F9FAFB]',
                            idx % 2 === 1 && 'bg-[#FAFAFA]',
                          )}
                        >
                          <td className="px-4 py-2 text-[#9CA3AF]">{idx + 1}</td>
                          <td className="px-4 py-2">
                            <NavLink
                              to={`/projects/${r.projectId}`}
                              className="font-semibold text-[#1D4ED8] hover:underline"
                            >
                              {r.projectName ?? r.projectId}
                            </NavLink>
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-[#374151]">
                            {r.totalItems}
                          </td>
                          <td
                            className={cn(
                              'px-4 py-2 text-right tabular-nums font-semibold',
                              r.openItems > 0 ? 'text-[#B91C1C]' : 'text-[#6B7280]',
                            )}
                          >
                            {r.openItems}
                          </td>
                          <td
                            className={cn(
                              'px-4 py-2 text-right tabular-nums font-semibold',
                              r.closedItems > 0 ? 'text-[#15803D]' : 'text-[#6B7280]',
                            )}
                          >
                            {r.closedItems}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <div className="ml-auto flex items-center justify-end gap-2">
                              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#F3F4F6]">
                                <div
                                  className="h-full bg-[#15803D]"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="w-10 text-right tabular-nums text-[11px] text-[#374151]">
                                {pct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {addOpen ? <AddStandaloneModal onClose={() => setAddOpen(false)} /> : null}
    </article>
  );
}

function StandaloneList({
  items, isLoading, canWrite,
}: {
  items: StandaloneMgmtAction[];
  isLoading: boolean;
  canWrite: boolean;
}): JSX.Element {
  const [updateAction] = useUpdateStandaloneActionMutation();
  const [deleteAction] = useDeleteStandaloneActionMutation();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-[12.5px] text-[#6B7280]">
          No standalone actions yet.{canWrite ? ' Use "Add Action" above to create one.' : ''}
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[12.5px]">
            <thead>
              <tr className="bg-[#F9FAFB] text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">
                <th className="px-4 py-2 text-left">Topic</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Deadline</th>
                <th className="px-4 py-2 text-left">Added</th>
                {canWrite ? <th className="px-4 py-2 text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((a, idx) => (
                <tr
                  key={a.actionId}
                  className={cn(
                    'border-b border-[#F3F4F6]',
                    idx % 2 === 1 && 'bg-[#FAFAFA]',
                  )}
                >
                  <td className="px-4 py-2 align-top">
                    <p className="whitespace-pre-wrap font-medium text-[#111827]">{a.topic}</p>
                  </td>
                  <td className="px-4 py-2 align-top">
                    {canWrite ? (
                      <StatusPill
                        status={a.status}
                        onFlip={() =>
                          void updateAction({
                            actionId: a.actionId,
                            body: { status: a.status === 'Open' ? 'Closed' : 'Open' },
                          })
                        }
                      />
                    ) : (
                      <StatusPill status={a.status} />
                    )}
                  </td>
                  <td className="px-4 py-2 align-top text-[#374151]">
                    {a.deadlineDate ?? <span className="text-[#9CA3AF]">—</span>}
                  </td>
                  <td className="px-4 py-2 align-top text-[11px] text-[#6B7280]">
                    {new Date(a.createdAt).toLocaleDateString()}
                  </td>
                  {canWrite ? (
                    <td className="px-4 py-2 text-right align-top">
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete action "${a.topic.slice(0, 40)}"?`)) {
                            void deleteAction(a.actionId);
                          }
                        }}
                        aria-label="Delete action"
                        className="text-[#B91C1C] hover:text-[#7F1D1D]"
                      >
                        <Trash2 size={14} aria-hidden />
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusPill({
  status, onFlip,
}: {
  status: 'Open' | 'Closed';
  onFlip?: () => void;
}): JSX.Element {
  const styles =
    status === 'Open'
      ? 'bg-[#FEE2E2] text-[#B91C1C]'
      : 'bg-[#DCFCE7] text-[#15803D]';
  const label = status;
  if (!onFlip) {
    return (
      <span className={cn('inline-block rounded-full px-2 py-0.5 text-[11px] font-bold', styles)}>
        {label}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onFlip}
      title={status === 'Open' ? 'Click to close' : 'Click to reopen'}
      className={cn(
        'inline-block rounded-full px-2 py-0.5 text-[11px] font-bold transition-opacity hover:opacity-80',
        styles,
      )}
    >
      {label}
    </button>
  );
}

function AddStandaloneModal({ onClose }: { onClose: () => void }): JSX.Element {
  const [topic, setTopic] = useState('');
  const [status, setStatus] = useState<'Open' | 'Closed'>('Open');
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createAction, { isLoading }] = useCreateStandaloneActionMutation();

  const save = async (): Promise<void> => {
    const trimmed = topic.trim();
    if (!trimmed) {
      setError('Topic is required.');
      return;
    }
    setError(null);
    try {
      await createAction({
        topic: trimmed,
        status,
        deadlineDate: deadline ? deadline : null,
      }).unwrap();
      onClose();
    } catch (e) {
      const msg = (e as { data?: { error?: { message?: string } }; message?: string })?.data?.error?.message
        ?? (e as { message?: string })?.message
        ?? 'Could not save action.';
      setError(msg);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add standalone management action"
      className="fixed inset-0 z-50 flex items-center justify-center px-3"
    >
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={isLoading ? undefined : onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-lg border border-[#E5E7EB] bg-white shadow-xl">
        <div className="border-b border-[#F3F4F6] px-4 py-3">
          <h3 className="text-sm font-bold text-[#111827]">Add Management Action</h3>
          <p className="mt-0.5 text-[11.5px] text-[#6B7280]">
            Cross-project action item — not tied to any specific project.
          </p>
        </div>

        <div className="space-y-3 px-4 py-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#374151]">
              Topic
            </span>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
              className="w-full rounded border border-[#D1D5DB] px-3 py-2 text-sm focus:border-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
              placeholder="Describe the action item…"
              autoFocus
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#374151]">
              Status
            </span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'Open' | 'Closed')}
              className="h-9 w-full rounded border border-[#D1D5DB] px-3 text-sm focus:border-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
            >
              <option value="Open">Open</option>
              <option value="Closed">Closed</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#374151]">
              Deadline date <span className="font-normal normal-case text-[#9CA3AF]">(optional)</span>
            </span>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="h-9 w-full rounded border border-[#D1D5DB] px-3 text-sm focus:border-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
            />
          </label>

          {error ? (
            <div className="rounded border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-[12px] font-medium text-[#B91C1C]">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#F3F4F6] px-4 py-3">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="default" size="sm" onClick={() => void save()} disabled={isLoading}>
            {isLoading ? 'Saving…' : 'Save Action'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'brand' | 'info' | 'danger' | 'success';
}): JSX.Element {
  const palette: Record<typeof tone, string> = {
    brand: 'border-t-[#1E3A5F] text-[#1E3A5F]',
    info: 'border-t-[#1D4ED8] text-[#1D4ED8]',
    danger: 'border-t-[#B91C1C] text-[#B91C1C]',
    success: 'border-t-[#15803D] text-[#15803D]',
  };
  return (
    <div
      className={cn(
        'rounded border-t-4 border-x border-b border-[#E5E7EB] bg-white px-3 py-2 shadow-sm',
        palette[tone],
      )}
    >
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">{label}</div>
      <div className={cn('text-xl font-extrabold tabular-nums', palette[tone].split(' ').pop())}>
        {value}
      </div>
    </div>
  );
}

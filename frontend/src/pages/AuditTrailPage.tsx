import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useListAuditQuery } from '../app/api/auditApi';
import { useListUsersQuery } from '../app/api/usersApi';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { cn } from '../lib/utils';
import type { AuditAction, AuditChange } from '../types/api';

const ACTION_FILTERS: Array<AuditAction | 'All'> = ['All', 'Created', 'Updated', 'Deleted'];

const ACTION_STYLES: Record<AuditAction, string> = {
  Created: 'bg-[#F0FDF4] text-[#15803D] border-[#86EFAC]',
  Updated: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#93C5FD]',
  Deleted: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FCA5A5]',
};

export function AuditTrailPage(): JSX.Element {
  const [actionFilter, setActionFilter] = useState<AuditAction | 'All'>('All');
  const [userFilter, setUserFilter] = useState<string>('');
  const [projectIdFilter, setProjectIdFilter] = useState<string>('');
  const [cursorStack, setCursorStack] = useState<Array<string | null>>([null]);
  const [expanded, setExpanded] = useState<number | null>(null);

  const cursor = cursorStack[cursorStack.length - 1];

  const query = useListAuditQuery({
    limit: 25,
    ...(cursor ? { cursor } : {}),
    ...(actionFilter !== 'All' ? { action: actionFilter } : {}),
    ...(userFilter ? { userId: Number(userFilter) } : {}),
    ...(projectIdFilter.trim() ? { projectId: projectIdFilter.trim() } : {}),
  });

  const users = useListUsersQuery();
  const usersById = useMemo(() => {
    const map = new Map<number, string>();
    for (const u of users.data?.items ?? []) map.set(u.userId, u.username);
    return map;
  }, [users.data]);

  const items = query.data?.items ?? [];
  const canNext = query.data?.nextCursor;
  const canPrev = cursorStack.length > 1;

  const goNext = (): void => {
    if (canNext) {
      setCursorStack([...cursorStack, canNext]);
      setExpanded(null);
    }
  };
  const goPrev = (): void => {
    if (canPrev) {
      setCursorStack(cursorStack.slice(0, -1));
      setExpanded(null);
    }
  };
  const goFirst = (): void => {
    setCursorStack([null]);
    setExpanded(null);
  };

  const resetFilters = (): void => {
    setActionFilter('All');
    setUserFilter('');
    setProjectIdFilter('');
    goFirst();
  };

  return (
    <article className="space-y-4">
      <header>
        <h1 className="text-lg font-bold text-[#111827]">Audit Trail</h1>
        <p className="text-[12.5px] text-[#6B7280]">
          Every create/update/delete across projects, users, and nested resources — cursor-paginated,
          newest first.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {ACTION_FILTERS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => {
              setActionFilter(a);
              goFirst();
            }}
            className={cn(
              'rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-colors',
              actionFilter === a
                ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white'
                : 'border-[#D1D5DB] bg-white text-[#6B7280] hover:text-[#374151]',
            )}
          >
            {a}
          </button>
        ))}
        <select
          value={userFilter}
          onChange={(e) => {
            setUserFilter(e.target.value);
            goFirst();
          }}
          className="h-8 rounded border border-[#D1D5DB] bg-white px-2 text-[12.5px]"
        >
          <option value="">All users</option>
          {users.data?.items.map((u) => (
            <option key={u.userId} value={u.userId}>
              {u.username} ({u.role})
            </option>
          ))}
        </select>
        <input
          value={projectIdFilter}
          onChange={(e) => setProjectIdFilter(e.target.value)}
          onBlur={goFirst}
          placeholder="Project ID (UUID)…"
          className="h-8 w-64 rounded border border-[#D1D5DB] px-3 text-[12.5px]"
        />
        {(actionFilter !== 'All' || userFilter || projectIdFilter) ? (
          <Button size="xs" variant="outline" onClick={resetFilters}>
            Clear filters
          </Button>
        ) : null}
      </div>

      <Card>
        <CardContent className="p-0">
          {query.isLoading ? (
            <div className="p-4">
              <Skeleton className="h-40 w-full" />
            </div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-[12.5px] text-[#6B7280]">
              No audit rows match the current filter.
            </div>
          ) : (
            <ul className="divide-y divide-[#F3F4F6]">
              {items.map((item) => {
                const isOpen = expanded === item.auditId;
                const userName =
                  item.userId !== null
                    ? usersById.get(item.userId) ?? item.userLabel
                    : item.userLabel;
                return (
                  <li key={item.auditId} className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : item.auditId)}
                      className="grid w-full grid-cols-[auto_1fr_auto] items-start gap-3 text-left"
                    >
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[10.5px] font-bold',
                          ACTION_STYLES[item.action],
                        )}
                      >
                        {item.action}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-[#111827]">
                          <span className="text-[#1D4ED8]">{userName}</span>
                          {item.roleLabel ? (
                            <span className="ml-1 text-[10.5px] text-[#6B7280]">
                              ({item.roleLabel})
                            </span>
                          ) : null}
                          {' → '}
                          {item.projectId ? (
                            <NavLink
                              to={`/projects/${item.projectId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-[#7C3AED] hover:underline"
                            >
                              {item.projectNameSnapshot ?? item.projectId}
                            </NavLink>
                          ) : (
                            <span className="text-[#6B7280]">
                              {item.projectNameSnapshot ?? '(no project)'}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[11px] text-[#6B7280]">
                          {new Date(item.changedAt).toLocaleString('en-IN')} ·{' '}
                          {item.changes.length} change{item.changes.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <span className="text-[10.5px] text-[#9CA3AF]">
                        {isOpen ? '▲' : '▼'}
                      </span>
                    </button>

                    {isOpen ? (
                      <div className="mt-3 rounded border border-[#E5E7EB] bg-[#F9FAFB] p-3">
                        {item.changes.length === 0 ? (
                          <p className="text-[12px] text-[#6B7280]">
                            No field-level changes recorded (metadata-only audit entry).
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[540px] border-collapse text-[12px]">
                              <thead>
                                <tr className="text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">
                                  <th className="pb-2 pr-3 text-left">Field</th>
                                  <th className="pb-2 pr-3 text-left">Before</th>
                                  <th className="pb-2 text-left">After</th>
                                </tr>
                              </thead>
                              <tbody>
                                {item.changes.map((c) => (
                                  <ChangeRow key={c.changeId} change={c} />
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex items-center gap-2 border-t border-[#F3F4F6] bg-[#F9FAFB] px-4 py-2 text-[11.5px] text-[#6B7280]">
            <Button size="xs" variant="outline" onClick={goFirst} disabled={!canPrev}>
              ⏮ First
            </Button>
            <Button size="xs" variant="outline" onClick={goPrev} disabled={!canPrev}>
              ← Prev
            </Button>
            <Button size="xs" variant="outline" onClick={goNext} disabled={!canNext}>
              Next →
            </Button>
            <span className="ml-2 tabular-nums">
              Page {cursorStack.length} · {items.length} shown
              {query.isFetching ? ' · loading…' : ''}
            </span>
          </div>
        </CardContent>
      </Card>
    </article>
  );
}

function ChangeRow({ change }: { change: AuditChange }): JSX.Element {
  return (
    <tr className="border-t border-[#F3F4F6]">
      <td className="py-1.5 pr-3 align-top font-semibold text-[#374151]">
        {change.fieldLabel ?? change.fieldKey}
      </td>
      <td className="py-1.5 pr-3 align-top text-[#B91C1C]">
        <span className="line-through opacity-80">
          {formatAuditValue(change.beforeValue)}
        </span>
      </td>
      <td className="py-1.5 align-top text-[#15803D]">{formatAuditValue(change.afterValue)}</td>
    </tr>
  );
}

function formatAuditValue(v: string | null): string {
  if (v === null || v === '') return '—';
  if (v.length > 200) return `${v.slice(0, 200)}…`;
  return v;
}

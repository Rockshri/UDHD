import { NavLink } from 'react-router-dom';
import { useGetPbgExpiryAlertsQuery } from '../../app/api/kpisApi';
import { formatDate } from '../../lib/formatters';

/**
 * Full-width red banner at the top of the Overview when any PBGs are
 * expiring within 30 days. Auto-hides when the alert list is empty.
 */
export function PbgExpiryBanner(): JSX.Element | null {
  const { data } = useGetPbgExpiryAlertsQuery();
  const items = data?.items ?? [];
  if (items.length === 0) return null;

  return (
    <div
      role="alert"
      className="rounded-lg border-2 border-[#DC2626] bg-[#FEF2F2] px-5 py-4 shadow-sm"
    >
      <div className="mb-2 flex items-center gap-2">
        <span aria-hidden className="text-xl">🔴</span>
        <span className="text-sm font-bold uppercase tracking-[0.05em] text-[#B91C1C]">
          PBG Expiry Alert — {items.length} project{items.length > 1 ? 's' : ''} expiring within 30
          days
        </span>
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {items.slice(0, 6).map((row) => (
          <li key={row.projectId}>
            <NavLink
              to={`/projects/${row.projectId}`}
              className="flex items-center justify-between gap-2 rounded border border-[#FCA5A5] bg-white px-2.5 py-1.5 text-xs hover:border-[#B91C1C] hover:bg-[#FEE2E2]"
            >
              <span className="min-w-0 truncate font-medium text-[#111827]">
                {row.projectName ?? row.projectId}
              </span>
              <span className="flex-shrink-0 rounded bg-[#B91C1C] px-2 py-0.5 text-[10.5px] font-bold text-white tabular-nums">
                {row.daysLeft ?? '?'}d · {formatDate(row.pbgExpiryDate)}
              </span>
            </NavLink>
          </li>
        ))}
      </ul>
      {items.length > 6 ? (
        <p className="mt-2 text-[11px] font-semibold text-[#B91C1C]">
          + {items.length - 6} more — see PBG alerts card below for the full list.
        </p>
      ) : null}
    </div>
  );
}

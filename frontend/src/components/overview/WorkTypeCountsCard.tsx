import { NavLink } from 'react-router-dom';
import { useGetWorkTypeCountsQuery } from '../../app/api/kpisApi';
import { formatInteger } from '../../lib/formatters';
import { cn } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';

interface Row {
  icon: string;
  label: string;
  count: number;
  to: string;
  tone: 'info' | 'brand' | 'warning' | 'danger';
  hint?: string;
}

const TONE_STYLES: Record<Row['tone'], string> = {
  info: 'border-l-[#1D4ED8] bg-[#EFF6FF] text-[#1D4ED8]',
  brand: 'border-l-[#1E3A5F] bg-[#F0F4F8] text-[#1E3A5F]',
  warning: 'border-l-[#B45309] bg-[#FEF3C7] text-[#B45309]',
  danger: 'border-l-[#B91C1C] bg-[#FEE2E2] text-[#B91C1C]',
};

export function WorkTypeCountsCard(): JSX.Element {
  const { data, isLoading, error } = useGetWorkTypeCountsQuery();

  const rows: Row[] = [
    {
      icon: '🧱',
      label: 'Tender Works',
      count: data?.tenderWorks ?? 0,
      to: '/projects?workType=Tender+Work',
      tone: 'brand',
    },
    {
      icon: '📝',
      label: 'Tender Services',
      count: data?.tenderServices ?? 0,
      to: '/projects?workType=Tender+Service',
      tone: 'info',
    },
    {
      icon: '🌧️',
      label: 'Pre-Monsoon',
      count: data?.preMonsoon ?? 0,
      to: '/projects?workType=Pre-Monsoon',
      tone: 'warning',
      hint:
        data && data.preMonsoonCritical > 0
          ? `${data.preMonsoonCritical} marked High priority`
          : '',
    },
    {
      icon: '⚠️',
      label: 'Critical Pre-Monsoon',
      count: data?.preMonsoonCritical ?? 0,
      to: '/projects?workType=Pre-Monsoon&priority=High',
      tone: 'danger',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Work Type Mix</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : error ? (
          <p className="text-sm text-[#B91C1C]">Could not load work type counts.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {rows.map((row) => (
              <li key={row.label}>
                <NavLink
                  to={row.to}
                  aria-disabled={row.count === 0}
                  className={cn(
                    'flex flex-col rounded border-l-4 border-y border-r border-transparent px-3 py-2 transition-all',
                    TONE_STYLES[row.tone],
                    row.count > 0
                      ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md'
                      : 'opacity-60',
                  )}
                >
                  <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider">
                    <span aria-hidden>{row.icon}</span> {row.label}
                  </div>
                  <div className="mt-1 text-xl font-bold tabular-nums leading-none">
                    {formatInteger(row.count)}
                  </div>
                  {row.hint ? <p className="mt-0.5 text-[10px] opacity-80">{row.hint}</p> : null}
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

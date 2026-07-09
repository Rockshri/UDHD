import { useGetFinancialSecuritiesQuery } from '../../app/api/kpisApi';
import { formatCurrencyCr, formatInteger } from '../../lib/formatters';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';

interface Cell {
  icon: string;
  label: string;
  value: number | null | undefined;
  hint?: string;
}

export function FinancialSecuritiesCard(): JSX.Element {
  const { data, isLoading, error } = useGetFinancialSecuritiesQuery();

  const cells: Cell[] = [
    { icon: '💰', label: 'Mobilisation Advance Issued', value: data?.totalMobAdvanceCr },
    { icon: '📤', label: 'Advance Outstanding', value: data?.totalAdvanceOutstandingCr },
    { icon: '🔒', label: 'Retention Money Held', value: data?.totalRetentionCr },
    { icon: '📜', label: 'PBG Held', value: data?.totalPbgCr },
    { icon: '🎟️', label: 'EMD Held', value: data?.totalEmdCr },
  ];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Financial Securities</CardTitle>
        {data && data.pbgExpiredCount > 0 ? (
          <Badge variant="danger">{formatInteger(data.pbgExpiredCount)} PBG expired</Badge>
        ) : (
          <Badge variant="success">All PBGs valid</Badge>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : error ? (
          <p className="text-sm text-[#B91C1C]">Could not load financial securities.</p>
        ) : (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {cells.map((cell) => (
              <div
                key={cell.label}
                className="rounded border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2"
              >
                <dt className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[#6B7280]">
                  <span aria-hidden>{cell.icon}</span>
                  {cell.label}
                </dt>
                <dd className="mt-0.5 text-lg font-bold tabular-nums text-[#111827]">
                  {formatCurrencyCr(cell.value)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

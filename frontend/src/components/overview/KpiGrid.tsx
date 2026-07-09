import type { OverviewKpis } from '../../types/api';
import { formatCurrencyCr, formatInteger, formatPercent } from '../../lib/formatters';
import { StatCard } from './StatCard';

interface KpiGridProps {
  data: OverviewKpis | undefined;
}

export function KpiGrid({ data }: KpiGridProps): JSX.Element {
  const total = data?.total ?? 0;

  return (
    <section aria-label="Portfolio KPIs" className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Total Projects"
          value={formatInteger(data?.total)}
          hint="All portfolios"
          tone="brand"
          icon="📊"
          to="/projects"
        />
        <StatCard
          label="Completed"
          value={formatInteger(data?.completed)}
          hint={pctOfTotal(data?.completed, total)}
          tone="success"
          icon="✅"
          to="/projects?status=Completed"
        />
        <StatCard
          label="In Progress"
          value={formatInteger(data?.inProgress)}
          hint={pctOfTotal(data?.inProgress, total)}
          tone="info"
          icon="🚧"
          to="/projects?status=In+Progress"
        />
        <StatCard
          label="Not Started"
          value={formatInteger(data?.notStarted)}
          hint={pctOfTotal(data?.notStarted, total)}
          tone="neutral"
          icon="⏳"
          to="/projects?status=Not+Started"
        />
        <StatCard
          label="Delayed"
          value={formatInteger(data?.delayed)}
          hint={pctOfTotal(data?.delayed, total)}
          tone="danger"
          icon="⚠️"
          to="/projects?status=Delayed"
        />
        <StatCard
          label="On Hold"
          value={formatInteger(data?.onHold)}
          hint={pctOfTotal(data?.onHold, total)}
          tone="warning"
          icon="⏸️"
          to="/projects?status=On+Hold"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Total AA"
          value={formatCurrencyCr(data?.totalAaCr)}
          hint="Administrative approval"
          tone="brand"
          icon="₹"
        />
        <StatCard
          label="Total Agreement"
          value={formatCurrencyCr(data?.totalAgreementCr)}
          hint="Contract value across portfolio"
          tone="info"
          icon="✍️"
        />
        <StatCard
          label="Total Financial"
          value={formatCurrencyCr(data?.totalFinancialCr)}
          hint="Utilised to date"
          tone="success"
          icon="💰"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Avg Physical Progress"
          value={formatPercent(data?.avgPhysicalPct)}
          hint="Milestone-weighted where available"
          tone="info"
          icon="🏗️"
        />
        <StatCard
          label="Avg Financial Progress"
          value={formatPercent(data?.avgFinancialPct)}
          hint="Average across all projects"
          tone="success"
          icon="📈"
        />
        <StatCard
          label="Financial Utilisation"
          value={formatPercent(data?.financialUtilisationPct)}
          hint="Utilised ÷ Sanctioned"
          tone="brand"
          icon="📊"
        />
      </div>
    </section>
  );
}

function pctOfTotal(count: number | null | undefined, total: number): string {
  if (!count || !total) return '—';
  return `${((count / total) * 100).toFixed(1)}% of total`;
}

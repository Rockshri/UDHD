import type { OverviewKpis } from '../../types/api';
import { formatCurrencyCr, formatInteger } from '../../lib/formatters';
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
          label="Active Major Projects"
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

      {/*
        Card.md rework — replaced the old money+% rows (Total AA/Total
        Agreement/Total Financial + Avg Physical/Avg Financial/Financial
        Utilisation) with 4 focused cards: two money totals + two
        contract-type drill-throughs. Backend still exposes the removed
        fields (used elsewhere), so no API deprecation.
      */}
      {/*
        5-card money+contract+prep row. Responsive layout:
          - <sm  (mobile):        1 col
          - sm ..< lg (tablet):   2 cols  (3 rows of 2+2+1)
          - lg+ (desktop):        5 cols in one row
        Preserves the mobile-first pattern used elsewhere in the dashboard.
      */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Total Sanctioned"
          value={formatCurrencyCr(data?.totalAaCr)}
          hint="Administrative approval — portfolio total"
          tone="brand"
          icon="₹"
        />
        <StatCard
          label="Total Expenditure"
          value={formatCurrencyCr(data?.totalFinancialCr)}
          hint="Utilised to date"
          tone="success"
          icon="💰"
        />
        <StatCard
          label="Work Contract"
          value={formatInteger(data?.workContractCount)}
          hint={pctOfTotal(data?.workContractCount, total)}
          tone="info"
          icon="🛠️"
          to="/projects?contractType=Work+Contract"
        />
        <StatCard
          label="Service Contract"
          value={formatInteger(data?.serviceContractCount)}
          hint={pctOfTotal(data?.serviceContractCount, total)}
          tone="warning"
          icon="🧾"
          to="/projects?contractType=Service+Contract"
        />
        <StatCard
          label="Pre-Monsoon Prep"
          value={formatInteger(data?.preMonsoonPrepCount)}
          hint="Preparation topics tracked"
          tone="danger"
          icon="🌧️"
          to="/pre-monsoon"
        />
      </div>
    </section>
  );
}

function pctOfTotal(count: number | null | undefined, total: number): string {
  if (!count || !total) return '—';
  return `${((count / total) * 100).toFixed(1)}% of total`;
}

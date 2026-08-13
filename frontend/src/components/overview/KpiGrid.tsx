import type { OverviewKpis } from '../../types/api';
import { formatCurrencyCr, formatInteger } from '../../lib/formatters';
import { StatCard } from './StatCard';
import type { OverviewVisibility } from './customization';

interface KpiGridProps {
  data: OverviewKpis | undefined;
  visibility: OverviewVisibility;
}

export function KpiGrid({ data, visibility }: KpiGridProps): JSX.Element | null {
  const total = data?.total ?? 0;
  const v = visibility.isVisible;

  const row1 = [
    v('kpi.total'), v('kpi.completed'), v('kpi.inProgress'),
    v('kpi.notStarted'), v('kpi.delayed'), v('kpi.onHold'),
  ].some(Boolean);
  const row2 = [
    v('kpi.sanctioned'), v('kpi.expenditure'), v('kpi.workContract'),
    v('kpi.serviceContract'), v('kpi.preMonsoon'),
  ].some(Boolean);

  if (!row1 && !row2) return null;

  return (
    <section aria-label="Portfolio KPIs" className="space-y-3">
      {row1 ? (
        // auto-fit lets surviving cards stretch to fill the gap when the
        // user hides some via the Customize popover. 150px min matches the
        // narrowest a StatCard reads well at.
        <div className="grid gap-2 sm:gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
          {v('kpi.total') ? (
            <StatCard
              label="Total Projects"
              value={formatInteger(data?.total)}
              hint="All portfolios"
              tone="brand"
              icon="📊"
              to="/projects"
            />
          ) : null}
          {v('kpi.completed') ? (
            <StatCard
              label="Completed"
              value={formatInteger(data?.completed)}
              hint={pctOfTotal(data?.completed, total)}
              tone="success"
              icon="✅"
              to="/projects?status=Completed"
            />
          ) : null}
          {v('kpi.inProgress') ? (
            <StatCard
              label="In Progress"
              value={formatInteger(data?.inProgress)}
              hint={pctOfTotal(data?.inProgress, total)}
              tone="info"
              icon="🚧"
              to="/projects?status=In+Progress"
            />
          ) : null}
          {v('kpi.notStarted') ? (
            <StatCard
              label="Not Started"
              value={formatInteger(data?.notStarted)}
              hint={pctOfTotal(data?.notStarted, total)}
              tone="neutral"
              icon="⏳"
              to="/projects?status=Not+Started"
            />
          ) : null}
          {v('kpi.delayed') ? (
            <StatCard
              label="Delayed"
              value={formatInteger(data?.delayed)}
              hint={pctOfTotal(data?.delayed, total)}
              tone="danger"
              icon="⚠️"
              to="/projects?status=Delayed"
            />
          ) : null}
          {v('kpi.onHold') ? (
            <StatCard
              label="On Hold"
              value={formatInteger(data?.onHold)}
              hint={pctOfTotal(data?.onHold, total)}
              tone="warning"
              icon="⏸️"
              to="/projects?status=On+Hold"
            />
          ) : null}
        </div>
      ) : null}

      {row2 ? (
        // Money+contract cards carry longer values than the status row, so
        // give them a bit more breathing room (180px min vs 150px).
        <div className="grid gap-2 sm:gap-3 grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
          {v('kpi.sanctioned') ? (
            <StatCard
              label="Total Sanctioned"
              value={formatCurrencyCr(data?.totalAaCr)}
              hint="Administrative approval — portfolio total"
              tone="brand"
              icon="₹"
            />
          ) : null}
          {v('kpi.expenditure') ? (
            <StatCard
              label="Total Expenditure"
              value={formatCurrencyCr(data?.totalFinancialCr)}
              hint="Utilised to date"
              tone="success"
              icon="💰"
            />
          ) : null}
          {v('kpi.workContract') ? (
            <StatCard
              label="Work Contract"
              value={formatInteger(data?.workContractCount)}
              hint={pctOfTotal(data?.workContractCount, total)}
              tone="info"
              icon="🛠️"
              to="/projects?contractType=Work+Contract"
            />
          ) : null}
          {v('kpi.serviceContract') ? (
            <StatCard
              label="Service Contract"
              value={formatInteger(data?.serviceContractCount)}
              hint={pctOfTotal(data?.serviceContractCount, total)}
              tone="warning"
              icon="🧾"
              to="/projects?contractType=Service+Contract"
            />
          ) : null}
          {v('kpi.preMonsoon') ? (
            <StatCard
              label="Pre-Monsoon Prep"
              value={formatInteger(data?.preMonsoonPrepCount)}
              hint="Preparation topics tracked"
              tone="danger"
              icon="🌧️"
              to="/pre-monsoon"
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function pctOfTotal(count: number | null | undefined, total: number): string {
  if (!count || !total) return '—';
  return `${((count / total) * 100).toFixed(1)}% of total`;
}

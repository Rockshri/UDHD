import { useGetOverviewKpisQuery, useGetSchemeChartQuery, useGetStatusDonutQuery } from '../app/api/kpisApi';
import { useAppSelector } from '../app/hooks';
import { SchemeBarChart } from '../components/charts/SchemeBarChart';
import { StatusDonut } from '../components/charts/StatusDonut';
import { CustomizePopover } from '../components/overview/CustomizePopover';
import { DivisionSummaryCard } from '../components/overview/DivisionSummaryCard';
import { FinancialSecuritiesCard } from '../components/overview/FinancialSecuritiesCard';
import { KpiGrid } from '../components/overview/KpiGrid';
import { OmAlertsCard } from '../components/overview/OmAlertsCard';
import { PbgAlertsCard } from '../components/overview/PbgAlertsCard';
import { PbgExpiryBanner } from '../components/overview/PbgExpiryBanner';
import { ScheduleVsActualCard } from '../components/overview/ScheduleVsActualCard';
import { SectorSummaryCard } from '../components/overview/SectorSummaryCard';
import { StageBucketsCard } from '../components/overview/StageBucketsCard';
import { useOverviewVisibility } from '../components/overview/customization';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { selectCurrentUser } from '../features/auth/authSlice';

export function OverviewPage(): JSX.Element {
  const user = useAppSelector(selectCurrentUser);
  const overview = useGetOverviewKpisQuery();
  const donut = useGetStatusDonutQuery();
  const scheme = useGetSchemeChartQuery();
  const visibility = useOverviewVisibility();
  const v = visibility.isVisible;

  const refetchAll = (): void => {
    void overview.refetch();
    void donut.refetch();
    void scheme.refetch();
  };

  const anyFetching = overview.isFetching || donut.isFetching || scheme.isFetching;

  const showSchemeChart = v('panel.schemeChart');
  const showStatusDonut = v('panel.statusDonut');
  const showChartsRow = showSchemeChart || showStatusDonut;

  const showScheduleVsActual = v('panel.scheduleVsActual');
  const showFinancialSecurities = v('panel.financialSecurities');
  const showScheduleFinRow = showScheduleVsActual || showFinancialSecurities;

  const showSector = v('panel.sectorSummary');
  const showDivision = v('panel.divisionSummary');
  const showSectorDivisionRow = showSector || showDivision;

  const showPbgAlerts = v('panel.pbgAlerts');
  const showOmAlerts = v('panel.omAlerts');
  const showAlertsRow = showPbgAlerts || showOmAlerts;

  return (
    <div className="space-y-5">
      <PbgExpiryBanner />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111827] sm:text-2xl">
            Welcome{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}
          </h1>
          <p className="mt-0.5 text-xs text-[#6B7280] sm:text-sm">
            Portfolio-wide view of every project managed by BUIDCO.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CustomizePopover visibility={visibility} />
          <Button variant="outline" size="sm" onClick={refetchAll} disabled={anyFetching}>
            <span className={anyFetching ? 'animate-spin' : ''} aria-hidden>
              ↻
            </span>{' '}
            {anyFetching ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </div>

      {overview.isLoading ? (
        <div className="grid gap-2 sm:gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : overview.error ? (
        <ErrorPanel />
      ) : (
        <KpiGrid data={overview.data} visibility={visibility} />
      )}

      {v('panel.stageBuckets') ? <StageBucketsCard /> : null}

      {showScheduleFinRow ? (
        // Grid only splits when BOTH panels are visible — otherwise the
        // survivor takes the full row instead of leaving a phantom gap.
        <div
          className={
            showScheduleVsActual && showFinancialSecurities
              ? 'grid gap-4 lg:grid-cols-2'
              : 'grid gap-4'
          }
        >
          {showScheduleVsActual ? <ScheduleVsActualCard /> : null}
          {showFinancialSecurities ? <FinancialSecuritiesCard /> : null}
        </div>
      ) : null}

      {showChartsRow ? (
        // Three layouts depending on which chart(s) the user has enabled:
        //   both  -> 3-col grid on lg (scheme 2/3 + donut 1/3), 2-col md
        //   only scheme -> full-width single column (col-span dropped)
        //   only donut  -> full-width single column
        <div
          className={
            showSchemeChart && showStatusDonut
              ? 'grid gap-4 md:grid-cols-2 lg:grid-cols-3'
              : 'grid gap-4'
          }
        >
          {showSchemeChart ? (
            <Card className={showStatusDonut ? 'lg:col-span-2' : ''}>
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle>Physical vs Financial % by Scheme</CardTitle>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
                  Click a bar to filter
                </span>
              </CardHeader>
              <CardContent>
                {scheme.isLoading ? (
                  <Skeleton className="h-[260px] w-full sm:h-[300px]" />
                ) : scheme.error ? (
                  <p className="text-sm text-[#B91C1C]">Could not load scheme chart.</p>
                ) : (
                  <SchemeBarChart data={scheme.data?.items ?? []} />
                )}
              </CardContent>
            </Card>
          ) : null}

          {showStatusDonut ? (
            <Card>
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle>Status Breakdown</CardTitle>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
                  Click a slice to filter
                </span>
              </CardHeader>
              <CardContent>
                {donut.isLoading ? (
                  <Skeleton className="h-[220px] w-full sm:h-[260px]" />
                ) : donut.error ? (
                  <p className="text-sm text-[#B91C1C]">Could not load status data.</p>
                ) : (
                  <StatusDonut data={donut.data?.items ?? []} />
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {showSectorDivisionRow ? (
        <div
          className={
            showSector && showDivision
              ? 'grid gap-4 lg:grid-cols-2'
              : 'grid gap-4'
          }
        >
          {showSector ? <SectorSummaryCard /> : null}
          {showDivision ? <DivisionSummaryCard /> : null}
        </div>
      ) : null}

      {showAlertsRow ? (
        <div
          className={
            showPbgAlerts && showOmAlerts
              ? 'grid gap-4 lg:grid-cols-2'
              : 'grid gap-4'
          }
        >
          {showPbgAlerts ? <PbgAlertsCard /> : null}
          {showOmAlerts ? <OmAlertsCard /> : null}
        </div>
      ) : null}
    </div>
  );
}

function ErrorPanel(): JSX.Element {
  return (
    <div className="rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-sm text-[#B91C1C]">
      <p className="font-semibold">Could not load portfolio KPIs.</p>
      <p className="mt-1 text-[#7F1D1D]/80">
        Check that the API is reachable, then use the Refresh button.
      </p>
    </div>
  );
}

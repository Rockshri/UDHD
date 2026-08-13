import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Overview page widget registry. Each entry becomes a checkbox in the
 * "Customize" popover — unchecking hides it. Keep the ids stable across
 * releases; they're persisted verbatim in the user's browser storage.
 */
export type OverviewWidgetId =
  // Row 1 status stat cards
  | 'kpi.total' | 'kpi.completed' | 'kpi.inProgress'
  | 'kpi.notStarted' | 'kpi.delayed' | 'kpi.onHold'
  // Row 2 money + contract cards
  | 'kpi.sanctioned' | 'kpi.expenditure' | 'kpi.workContract'
  | 'kpi.serviceContract' | 'kpi.preMonsoon'
  // Full-width panels / charts
  | 'panel.stageBuckets' | 'panel.scheduleVsActual' | 'panel.financialSecurities'
  | 'panel.schemeChart' | 'panel.statusDonut'
  | 'panel.sectorSummary' | 'panel.divisionSummary'
  | 'panel.pbgAlerts' | 'panel.omAlerts';

export interface OverviewWidgetDef {
  id: OverviewWidgetId;
  label: string;
  group: 'Status KPIs' | 'Money & Contracts' | 'Charts & Panels';
}

export const OVERVIEW_WIDGETS: readonly OverviewWidgetDef[] = [
  { id: 'kpi.total',           label: 'Total Projects',       group: 'Status KPIs' },
  { id: 'kpi.completed',       label: 'Completed',            group: 'Status KPIs' },
  { id: 'kpi.inProgress',      label: 'In Progress',          group: 'Status KPIs' },
  { id: 'kpi.notStarted',      label: 'Not Started',          group: 'Status KPIs' },
  { id: 'kpi.delayed',         label: 'Delayed',              group: 'Status KPIs' },
  { id: 'kpi.onHold',          label: 'On Hold',              group: 'Status KPIs' },

  { id: 'kpi.sanctioned',      label: 'Total Sanctioned',     group: 'Money & Contracts' },
  { id: 'kpi.expenditure',     label: 'Total Expenditure',    group: 'Money & Contracts' },
  { id: 'kpi.workContract',    label: 'Work Contract',        group: 'Money & Contracts' },
  { id: 'kpi.serviceContract', label: 'Service Contract',     group: 'Money & Contracts' },
  { id: 'kpi.preMonsoon',      label: 'Pre-Monsoon Prep',     group: 'Money & Contracts' },

  { id: 'panel.stageBuckets',        label: 'Project Stage Buckets',    group: 'Charts & Panels' },
  { id: 'panel.scheduleVsActual',    label: 'Schedule vs Actual',       group: 'Charts & Panels' },
  { id: 'panel.financialSecurities', label: 'Financial Securities',     group: 'Charts & Panels' },
  { id: 'panel.schemeChart',         label: 'Physical vs Financial by Scheme', group: 'Charts & Panels' },
  { id: 'panel.statusDonut',         label: 'Status Breakdown Donut',   group: 'Charts & Panels' },
  { id: 'panel.sectorSummary',       label: 'Sector Summary',           group: 'Charts & Panels' },
  { id: 'panel.divisionSummary',     label: 'Division Summary (Top N)', group: 'Charts & Panels' },
  { id: 'panel.pbgAlerts',           label: 'PBG Expiry Alerts',        group: 'Charts & Panels' },
  { id: 'panel.omAlerts',            label: 'O&M Expiry Alerts',        group: 'Charts & Panels' },
] as const;

const STORAGE_KEY = 'overview.hiddenWidgets.v1';
const KNOWN_IDS = new Set<string>(OVERVIEW_WIDGETS.map((w) => w.id));

function readInitial(): Set<OverviewWidgetId> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    // Drop unknown ids so an old build's leftovers don't linger silently.
    return new Set(parsed.filter((v): v is OverviewWidgetId => typeof v === 'string' && KNOWN_IDS.has(v)));
  } catch {
    return new Set();
  }
}

export interface OverviewVisibility {
  isVisible: (id: OverviewWidgetId) => boolean;
  setVisible: (id: OverviewWidgetId, next: boolean) => void;
  showAll: () => void;
  hiddenCount: number;
}

export function useOverviewVisibility(): OverviewVisibility {
  const [hidden, setHidden] = useState<Set<OverviewWidgetId>>(() => readInitial());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(hidden)));
  }, [hidden]);

  const isVisible = useCallback((id: OverviewWidgetId) => !hidden.has(id), [hidden]);
  const setVisible = useCallback((id: OverviewWidgetId, next: boolean) => {
    setHidden((prev) => {
      const n = new Set(prev);
      if (next) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);
  const showAll = useCallback(() => setHidden(new Set()), []);

  return useMemo(
    () => ({ isVisible, setVisible, showAll, hiddenCount: hidden.size }),
    [isVisible, setVisible, showAll, hidden.size],
  );
}

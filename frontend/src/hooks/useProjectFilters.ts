import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * URL-driven project filter state. Every filter round-trips through the
 * query string so drill-throughs from the Overview (`/projects?status=Delayed`
 * etc.) work, deep-links are shareable, and the Back button behaves.
 */

export interface ProjectFilters {
  search: string;
  status: string;
  /** Backed by new project_stage_v2 column (Phase A §3.2). */
  projectStage: string;
  contractType: string;
  priority: string;
  divisionId: string;
  regionId: string;
  sectorId: string;
  schemeId: string;
}

const EMPTY: ProjectFilters = {
  search: '',
  status: '',
  projectStage: '',
  contractType: '',
  priority: '',
  divisionId: '',
  regionId: '',
  sectorId: '',
  schemeId: '',
};

const KEYS = Object.keys(EMPTY) as (keyof ProjectFilters)[];

export function useProjectFilters(): {
  filters: ProjectFilters;
  setFilter: <K extends keyof ProjectFilters>(key: K, value: string) => void;
  clearAll: () => void;
  activeCount: number;
} {
  const [params, setParams] = useSearchParams();

  const filters = useMemo<ProjectFilters>(() => {
    const next = { ...EMPTY };
    for (const key of KEYS) {
      next[key] = params.get(key) ?? '';
    }
    return next;
  }, [params]);

  const setFilter = useCallback(
    <K extends keyof ProjectFilters>(key: K, value: string) => {
      const next = new URLSearchParams(params);
      if (value) next.set(key, value);
      else next.delete(key);
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const clearAll = useCallback(() => {
    // Preserve non-filter params (currently none, but future-proof).
    const next = new URLSearchParams();
    for (const [k, v] of params.entries()) {
      if (!(KEYS as string[]).includes(k)) next.set(k, v);
    }
    setParams(next, { replace: true });
  }, [params, setParams]);

  const activeCount = useMemo(
    () => KEYS.reduce((acc, key) => acc + (filters[key] ? 1 : 0), 0),
    [filters],
  );

  return { filters, setFilter, clearAll, activeCount };
}

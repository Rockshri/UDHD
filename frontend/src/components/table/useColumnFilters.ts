import { useCallback, useMemo, useState } from 'react';

/**
 * Session-scoped column-filter state for any table.
 *
 *   const filters = useColumnFilters<Row>({
 *     rows,
 *     columns: {
 *       status:      (r) => r.status,
 *       contractor:  (r) => r.contractor ?? '—',
 *       priority:    (r) => r.priority ?? '—',
 *     },
 *   });
 *
 *   filters.filteredRows   // Row[] after every active filter
 *   filters.optionsFor('status')  // string[] distinct values for that column
 *   filters.selected('status')    // Set<string> currently checked
 *   filters.setSelected('status', next)
 *   filters.clearColumn('status')
 *   filters.clearAll()
 *   filters.activeCount           // number of columns with any filter applied
 *
 * Values are stringified so any accessor (number/date/enum) works. Missing
 * or empty values are bucketed as "—" so the user has a way to select
 * "unset" rows explicitly.
 */

export const EMPTY_BUCKET = '—';

export type ColumnAccessor<T> = (row: T) => string | number | boolean | null | undefined;

export interface ColumnFiltersConfig<T> {
  rows: readonly T[];
  columns: Record<string, ColumnAccessor<T>>;
}

export interface ColumnFilters<T> {
  filteredRows: T[];
  optionsFor: (col: string) => string[];
  selected: (col: string) => Set<string>;
  setSelected: (col: string, next: Set<string>) => void;
  clearColumn: (col: string) => void;
  clearAll: () => void;
  isActive: (col: string) => boolean;
  activeCount: number;
}

function toBucket(v: unknown): string {
  if (v === null || v === undefined) return EMPTY_BUCKET;
  const s = String(v).trim();
  return s === '' ? EMPTY_BUCKET : s;
}

export function useColumnFilters<T>({ rows, columns }: ColumnFiltersConfig<T>): ColumnFilters<T> {
  const [state, setState] = useState<Record<string, Set<string>>>({});

  const filteredRows = useMemo(() => {
    const activeCols = Object.keys(state).filter((k) => (state[k]?.size ?? 0) > 0);
    if (activeCols.length === 0) return [...rows];
    return rows.filter((row) => {
      for (const col of activeCols) {
        const accessor = columns[col];
        const wanted = state[col];
        if (!accessor || !wanted) continue;
        const bucket = toBucket(accessor(row));
        if (!wanted.has(bucket)) return false;
      }
      return true;
    });
  }, [rows, columns, state]);

  const optionsFor = useCallback(
    (col: string): string[] => {
      const accessor = columns[col];
      if (!accessor) return [];
      // Distinct values are computed against ALL rows, not filteredRows, so
      // deselecting a value doesn't cause it to vanish from the popover.
      const seen = new Set<string>();
      for (const row of rows) seen.add(toBucket(accessor(row)));
      return Array.from(seen).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    },
    [rows, columns],
  );

  const selected = useCallback((col: string): Set<string> => state[col] ?? new Set(), [state]);

  const setSelected = useCallback((col: string, next: Set<string>) => {
    setState((prev) => {
      if (next.size === 0) {
        // Drop the entry so activeCount stays accurate.
        if (!(col in prev)) return prev;
        const { [col]: _dropped, ...rest } = prev;
        void _dropped;
        return rest;
      }
      return { ...prev, [col]: next };
    });
  }, []);

  const clearColumn = useCallback((col: string) => {
    setState((prev) => {
      if (!(col in prev)) return prev;
      const { [col]: _dropped, ...rest } = prev;
      void _dropped;
      return rest;
    });
  }, []);

  const clearAll = useCallback(() => setState({}), []);

  const isActive = useCallback((col: string) => (state[col]?.size ?? 0) > 0, [state]);
  const activeCount = useMemo(
    () => Object.values(state).filter((s) => s.size > 0).length,
    [state],
  );

  return { filteredRows, optionsFor, selected, setSelected, clearColumn, clearAll, isActive, activeCount };
}

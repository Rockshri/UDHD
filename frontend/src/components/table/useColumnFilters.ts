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

/**
 * Accessors may return a single scalar or an array of scalars. Arrays
 * enable multi-value columns like "Schemes" — a project can belong to
 * several schemes, and any one of them satisfies a scheme-filter selection.
 */
export type ColumnAccessorValue = string | number | boolean | null | undefined;
export type ColumnAccessor<T> = (row: T) => ColumnAccessorValue | readonly ColumnAccessorValue[];

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

function toBucketOne(v: unknown): string {
  if (v === null || v === undefined) return EMPTY_BUCKET;
  const s = String(v).trim();
  return s === '' ? EMPTY_BUCKET : s;
}

/**
 * Scalar → [bucket]; array → deduped list of buckets (empty array
 * becomes ['—'] so rows without any tag still get grouped). Used both
 * for computing distinct options and for match testing.
 */
function toBuckets(v: unknown): string[] {
  if (Array.isArray(v)) {
    if (v.length === 0) return [EMPTY_BUCKET];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of v) {
      const b = toBucketOne(item);
      if (!seen.has(b)) {
        seen.add(b);
        out.push(b);
      }
    }
    return out;
  }
  return [toBucketOne(v)];
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
        // Multi-value columns match if ANY bucket is selected; scalar
        // columns are a special case of the same rule with one bucket.
        const buckets = toBuckets(accessor(row));
        let hit = false;
        for (const b of buckets) {
          if (wanted.has(b)) { hit = true; break; }
        }
        if (!hit) return false;
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
      for (const row of rows) {
        for (const b of toBuckets(accessor(row))) seen.add(b);
      }
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

/**
 * Government-facing number / date formatting.
 *
 * Money → ₹ prefix + Indian grouping (`8,076.62 Cr`, not `8076.62`).
 * Percentages → 1 decimal, `%` suffix; nulls display as an em-dash.
 * Dates → `05 Jul 2026` in en-IN.
 */

const inrNumber = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrInteger = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

const dateFmt = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export function formatCurrencyCr(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `₹ ${inrNumber.format(value)} Cr`;
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(digits)}%`;
}

export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return inrInteger.format(value);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return dateFmt.format(date);
}

export function daysBetween(from: Date | string, to: Date | string = new Date()): number {
  const a = typeof from === 'string' ? new Date(from) : from;
  const b = typeof to === 'string' ? new Date(to) : to;
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / 86_400_000);
}

/** Clamp a value between 0 and 100, defaulting nulls to 0. */
export function clampPct(value: number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Math.max(0, Math.min(100, value));
}

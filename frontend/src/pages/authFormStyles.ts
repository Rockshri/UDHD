/** Shared classNames for the redesigned auth pages (login + forgot password).
 *  Kept local to these pages so the shared ui/input.tsx and ui/button.tsx
 *  (used everywhere else in the app) stay untouched. Purely presentational;
 *  no behavior here. */
export const inputClassName =
  'h-11 rounded-xl border-[#D1D5DB] px-4 text-sm transition-all duration-200 ' +
  'focus-visible:border-[#1D4ED8] focus-visible:ring-4 focus-visible:ring-[#1D4ED8]/15 focus-visible:ring-offset-0';
export const primaryButtonClassName =
  'h-12 rounded-xl bg-gradient-to-r from-[#1E3A5F] to-[#1D4ED8] text-[15px] font-semibold ' +
  'shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:from-[#17304d] hover:to-[#1741b0] hover:shadow-lg ' +
  'active:translate-y-0';
export const secondaryButtonClassName =
  'h-12 rounded-xl border-[#D1D5DB] text-[15px] font-semibold transition-all duration-200 hover:-translate-y-0.5';

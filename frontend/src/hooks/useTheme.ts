import { useCallback, useEffect, useState } from 'react';

/**
 * Session-persistent theme preference (light / dark / system).
 *
 * `applied` is what the DOM currently shows (resolves 'system' via
 * matchMedia). `preference` is the user's saved choice — separate so
 * the toggle can show "System" as an explicit option later without
 * losing the effective theme.
 *
 * Adds/removes the `dark` class on <html> so Tailwind's `dark:` variant
 * and the global CSS overrides in index.css both apply.
 */

export type ThemePreference = 'light' | 'dark' | 'system';
export type AppliedTheme = 'light' | 'dark';

const STORAGE_KEY = 'buidco.theme.v1';

function readPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  return 'system';
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveApplied(pref: ThemePreference): AppliedTheme {
  if (pref === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return pref;
}

function apply(theme: AppliedTheme): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  if (theme === 'dark') html.classList.add('dark');
  else html.classList.remove('dark');
}

export interface ThemeControls {
  preference: ThemePreference;
  applied: AppliedTheme;
  setPreference: (p: ThemePreference) => void;
  toggle: () => void;
}

export function useTheme(): ThemeControls {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readPreference());
  const [applied, setApplied] = useState<AppliedTheme>(() => resolveApplied(readPreference()));

  useEffect(() => {
    const next = resolveApplied(preference);
    setApplied(next);
    apply(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, preference);
    }
  }, [preference]);

  // Follow the system color-scheme when the user's preference is 'system'.
  useEffect(() => {
    if (preference !== 'system') return;
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (): void => {
      const next: AppliedTheme = mql.matches ? 'dark' : 'light';
      setApplied(next);
      apply(next);
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [preference]);

  const setPreference = useCallback((p: ThemePreference) => setPreferenceState(p), []);
  const toggle = useCallback(() => {
    // Two-state toggle: whatever's applied → flip. Explicit choice wins
    // over 'system' (no reason to leave the toggle on 'system' after a click).
    setPreferenceState((prev) => {
      const currentApplied = resolveApplied(prev);
      return currentApplied === 'dark' ? 'light' : 'dark';
    });
  }, []);

  return { preference, applied, setPreference, toggle };
}

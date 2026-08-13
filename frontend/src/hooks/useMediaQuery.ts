import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media-query and re-render on match/unmatch. Used for
 * responsive tweaks the styling layer can't reach — e.g. Recharts YAxis
 * `width` prop is numeric, so we swap it based on viewport width here
 * instead of Tailwind. SSR-safe: returns `false` before hydration.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent): void => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

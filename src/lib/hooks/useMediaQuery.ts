'use client';

import { useEffect, useState } from 'react';

/**
 * Hook that tracks a CSS media query match in the browser.
 *
 * Returns `false` during SSR (safe for hydration — avoids flicker).
 *
 * @example
 * const isDesktop = useMediaQuery('(min-width: 768px)');
 *
 * @see Story 6.3.6 / B.4.6 — responsive status filter
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    // Set initial value
    setMatches(mql.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/**
 * Tailwind `md` breakpoint = 768 px.
 *
 * Returns `true` when viewport width ≥ 768 px (desktop / tablet landscape).
 * Returns `false` on SSR and on viewports < 768 px (mobile / tablet portrait).
 *
 * @see Story 6.3.6 / B.4.6 — chips on desktop, Select on mobile
 */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 768px)');
}

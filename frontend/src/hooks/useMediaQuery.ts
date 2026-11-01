import { useSyncExternalStore } from 'react';

/** Reactive `window.matchMedia` wrapper (SSR-safe, no effect flicker). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined') return () => undefined;
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => (typeof window === 'undefined' ? false : window.matchMedia(query).matches),
    () => false
  );
}

/** True below the Tailwind `md` breakpoint (tab bar layout). */
export const useIsPhone = () => useMediaQuery('(max-width: 767px)');

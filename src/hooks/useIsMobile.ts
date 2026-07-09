import { useEffect, useState } from 'react';

const MOBILE_QUERY = '(max-width: 640px)';

/** Tracks whether the viewport currently matches the app's mobile breakpoint (≤640px). */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobile(mql.matches);

    const handleChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  return isMobile;
}

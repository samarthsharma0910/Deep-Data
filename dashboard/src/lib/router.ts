import { useCallback, useEffect, useState } from 'react';

export type Route =
  | { page: 'census' }
  | { page: 'alerts' }
  | { page: 'patient'; pid: string }
  | { page: 'model' }
  | { page: 'assess' }
  | { page: 'settings' };

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, '');
  if (h === 'alerts') return { page: 'alerts' };
  if (h === 'model') return { page: 'model' };
  if (h === 'settings') return { page: 'settings' };
  if (h === 'assess') return { page: 'assess' };
  if (h.startsWith('patient-') && h.length > 8) return { page: 'patient', pid: decodeURIComponent(h.slice(8)) };
  return { page: 'census' };
}

export const hrefFor = (r: Route): string =>
  r.page === 'patient' ? `#patient-${encodeURIComponent(r.pid)}` : `#${r.page}`;

export function useRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const go = useCallback((r: Route) => { window.location.hash = hrefFor(r); }, []);
  return [route, go];
}

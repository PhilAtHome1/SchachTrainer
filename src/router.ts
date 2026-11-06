import { useEffect, useState } from 'react';

// Einfaches Hash-Routing (#/pfad) – funktioniert offline und in Unterordnern.
export function navigate(to: string, replace = false) {
  const hash = to.startsWith('#') ? to : '#' + to;
  if (replace) location.replace(hash);
  else location.hash = hash;
}

export function useRoute(): string[] {
  const parse = () => (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean);
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

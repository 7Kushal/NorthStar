import { useEffect, useState } from 'react';

const LOCAL_SESSION = {
  authenticated: true,
  email: 'local@northstar.dev',
  name: 'Local development',
  local: true,
};

export function useAccessSession() {
  const [session, setSession] = useState(() => import.meta.env.DEV
    ? LOCAL_SESSION
    : { authenticated: false, loading: true });

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/session', {
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      signal: controller.signal,
    })
      .then(async response => {
        if (!response.ok) throw new Error(`Session returned ${response.status}`);
        return response.json();
      })
      .then(identity => setSession({ ...identity, authenticated: true, loading: false }))
      .catch(error => {
        if (error.name === 'AbortError') return;
        setSession(import.meta.env.DEV ? LOCAL_SESSION : { authenticated: false, loading: false });
      });
    return () => controller.abort();
  }, []);

  return session;
}

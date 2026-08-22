import { useCallback, useEffect, useState } from 'react';

const CACHE_KEY = 'northstar-ff-calendar-v1';

function readCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    return cached?.events?.length ? cached : null;
  } catch {
    return null;
  }
}

export function useEconomicCalendar() {
  const cached = readCache();
  const [events, setEvents] = useState(cached?.events || []);
  const [status, setStatus] = useState(cached ? 'stale' : 'loading');
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(cached?.fetchedAt || null);

  const refresh = useCallback(async () => {
    setStatus(current => events.length ? current : 'loading');
    setError('');
    try {
      const response = await fetch('/api/forex-factory', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Calendar feed returned ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload)) throw new Error('Calendar feed returned an invalid response');
      const usdEvents = payload
        .filter(event => event.country === 'USD' && event.title && event.date)
        .map((event, index) => ({
          id: `${event.date}-${event.title}-${index}`,
          title: event.title,
          country: event.country,
          date: event.date,
          impact: event.impact || 'Non-Economic',
          forecast: event.forecast || '',
          previous: event.previous || '',
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      const fetchedAt = new Date().toISOString();
      setEvents(usdEvents);
      setUpdatedAt(fetchedAt);
      setStatus('live');
      localStorage.setItem(CACHE_KEY, JSON.stringify({ events: usdEvents, fetchedAt }));
    } catch (calendarError) {
      setError(calendarError.message || 'Unable to reach Forex Factory');
      setStatus(events.length ? 'stale' : 'error');
    }
  }, [events.length]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return { events, status, error, updatedAt, refresh };
}

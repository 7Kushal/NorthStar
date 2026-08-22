const FOREX_FACTORY_FEED = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

function json(body, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('X-Content-Type-Options', 'nosniff');

  return new Response(JSON.stringify(body), { ...init, headers });
}

async function getEconomicCalendar() {
  try {
    const upstream = await fetch(FOREX_FACTORY_FEED, {
      headers: { Accept: 'application/json' },
      cf: { cacheTtl: 300, cacheEverything: true },
    });

    if (!upstream.ok) {
      return json(
        { error: `Economic calendar feed returned ${upstream.status}` },
        { status: 502 },
      );
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return json(
      { error: 'Economic calendar feed is temporarily unavailable' },
      { status: 502 },
    );
  }
}

async function getAccessSession(context) {
  let identity = null;
  try {
    identity = await context?.access?.getIdentity?.();
  } catch {
    return json({ authenticated: false }, { status: 401 });
  }

  if (!identity?.email) return json({ authenticated: false }, { status: 401 });

  const fallbackName = identity.email.split('@')[0].split(/[._-]+/).filter(Boolean)
    .map(part => part[0]?.toUpperCase() + part.slice(1)).join(' ');
  return json({
    authenticated: true,
    email: identity.email,
    name: identity.name || fallbackName || 'NorthStar user',
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);

    if (url.pathname === '/api/session') {
      if (request.method !== 'GET') {
        return json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'GET' } });
      }
      return getAccessSession(context);
    }

    if (url.pathname === '/api/forex-factory') {
      if (request.method !== 'GET') {
        return json(
          { error: 'Method not allowed' },
          { status: 405, headers: { Allow: 'GET' } },
        );
      }

      return getEconomicCalendar();
    }

    if (url.pathname.startsWith('/api/')) {
      return json({ error: 'Not found' }, { status: 404 });
    }

    return env.ASSETS.fetch(request);
  },
};

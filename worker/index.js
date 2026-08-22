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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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

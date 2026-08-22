const FOREX_FACTORY_FEED = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

export async function onRequestGet() {
  try {
    const upstream = await fetch(FOREX_FACTORY_FEED, {
      headers: { Accept: 'application/json' },
      cf: { cacheTtl: 300, cacheEverything: true },
    });

    if (!upstream.ok) {
      return Response.json(
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
    return Response.json(
      { error: 'Economic calendar feed is temporarily unavailable' },
      { status: 502 },
    );
  }
}

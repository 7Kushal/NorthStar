const FOREX_FACTORY_FEED = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const MAX_WORKSPACE_BYTES = 4_500_000;

function json(body, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(body), { ...init, headers });
}

async function getEconomicCalendar() {
  try {
    const upstream = await fetch(FOREX_FACTORY_FEED, {
      headers: { Accept: 'application/json' },
      cf: { cacheTtl: 300, cacheEverything: true },
    });
    if (!upstream.ok) return json({ error: `Economic calendar feed returned ${upstream.status}` }, { status: 502 });
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return json({ error: 'Economic calendar feed is temporarily unavailable' }, { status: 502 });
  }
}

async function accessUser(context) {
  if (!context.access) return null;
  try {
    const identity = await context.access.getIdentity();
    const email = String(identity?.email || '').trim().toLowerCase();
    if (!email) return null;
    return {
      id: String(identity.user_uuid || identity.id || identity.sub || email),
      email,
      name: String(identity.name || identity.givenName || email.split('@')[0]),
    };
  } catch {
    return null;
  }
}

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin;
}

function validWorkspace(workspace) {
  return Boolean(
    workspace
    && typeof workspace === 'object'
    && workspace.version === 1
    && typeof workspace.activeAccountId === 'string'
    && Array.isArray(workspace.accounts)
    && workspace.accounts.length > 0
    && workspace.accounts.length <= 50
  );
}

async function upsertUser(env, user) {
  await env.DB.prepare(`
    INSERT INTO users (id, email, display_name, last_seen_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      display_name = excluded.display_name,
      last_seen_at = datetime('now')
  `).bind(user.id, user.email, user.name).run();
}

async function workspaceApi(request, env, user) {
  if (!env.DB) return json({ error: 'D1 binding is not configured' }, { status: 503 });

  if (request.method === 'GET') {
    await upsertUser(env, user);
    const row = await env.DB.prepare(
      'SELECT payload, schema_version, updated_at FROM user_workspaces WHERE user_id = ?',
    ).bind(user.id).first();
    if (!row) return json({ user, workspace: null, schemaVersion: 1, updatedAt: null });
    try {
      return json({ user, workspace: JSON.parse(row.payload), schemaVersion: row.schema_version, updatedAt: row.updated_at });
    } catch {
      return json({ error: 'Stored workspace data is invalid' }, { status: 500 });
    }
  }

  if (request.method === 'PUT') {
    if (!sameOrigin(request)) return json({ error: 'Cross-origin writes are not allowed' }, { status: 403 });
    if (!request.headers.get('Content-Type')?.toLowerCase().includes('application/json')) {
      return json({ error: 'Content-Type must be application/json' }, { status: 415 });
    }
    const declaredSize = Number(request.headers.get('Content-Length') || 0);
    if (declaredSize > MAX_WORKSPACE_BYTES) return json({ error: 'Workspace exceeds the 4.5 MB storage limit' }, { status: 413 });

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    if (!validWorkspace(body.workspace)) return json({ error: 'Invalid workspace structure' }, { status: 400 });
    const payload = JSON.stringify(body.workspace);
    if (new TextEncoder().encode(payload).byteLength > MAX_WORKSPACE_BYTES) {
      return json({ error: 'Workspace exceeds the 4.5 MB storage limit' }, { status: 413 });
    }

    await upsertUser(env, user);
    await env.DB.prepare(`
      INSERT INTO user_workspaces (user_id, payload, schema_version, updated_at)
      VALUES (?, ?, 1, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        payload = excluded.payload,
        schema_version = excluded.schema_version,
        updated_at = datetime('now')
    `).bind(user.id, payload).run();
    const row = await env.DB.prepare(
      'SELECT updated_at FROM user_workspaces WHERE user_id = ?',
    ).bind(user.id).first();
    return json({ saved: true, updatedAt: row?.updated_at || new Date().toISOString() });
  }

  return json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'GET, PUT' } });
}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);

    if (url.pathname === '/api/forex-factory') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'GET' } });
      return getEconomicCalendar();
    }

    if (url.pathname === '/api/session' || url.pathname === '/api/workspace') {
      const user = await accessUser(context);
      if (!user) return json({ authenticated: false, error: 'Cloudflare Access authentication is required' }, { status: 401 });
      if (url.pathname === '/api/session') {
        if (request.method !== 'GET') return json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'GET' } });
        return json({ authenticated: true, user });
      }
      try {
        return await workspaceApi(request, env, user);
      } catch (error) {
        console.error('Workspace database request failed', error);
        return json({ error: 'Workspace database is unavailable. Apply the D1 migrations and try again.' }, { status: 503 });
      }
    }

    if (url.pathname.startsWith('/api/')) return json({ error: 'Not found' }, { status: 404 });
    return env.ASSETS.fetch(request);
  },
};

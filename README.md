# EdgeTrader

EdgeTrader is a React trading journal and execution-review workspace with live BTC/XAU charts, acknowledged pre-trade check-ins, a journal calendar, economic events, risk controls, and performance analytics.

## Local development

```bash
npm install
npm run db:migrate:local
npm run start
```

The local app runs at `http://127.0.0.1:4173`. Wrangler simulates a Cloudflare
Access identity (`local@edgetrader.dev`) and persists the local D1 database
between restarts.

## Production build

```bash
npm run build
```

The production bundle is written to `dist/`.

## Deploy to Cloudflare Workers

Connect this repository to Cloudflare Workers Builds and configure:

- Build command: `npm run build`
- Deploy command: `npx wrangler versions upload`
- Root directory: `/`

`wrangler.jsonc` uploads `dist/` as static assets, enables SPA routing, and runs
`worker/index.js` for `/api/*`. The Worker provides the economic calendar and
authenticated workspace APIs.

## Production D1

The APAC `edgetrader-prod` database is provisioned and pinned by ID in
`wrangler.jsonc`. Authorized maintainers can apply future migrations with:

```bash
npx wrangler login
npm run db:migrate:remote
```

Do not create another production database. In the Cloudflare dashboard, protect
the deployed Worker with Cloudflare Access and an allow policy for the people
who may use EdgeTrader. The Worker rejects D1 workspace requests when Access is
not enabled.

## Data persistence

Each Cloudflare Access user has one private D1 workspace containing all of their
trading accounts, journal entries, check-ins, playbooks, risk settings, and
analytics inputs. Existing browser-local NorthStar data is claimed once by the
first authenticated identity and uploaded automatically. A user-scoped browser
cache remains for recovery, but D1 is the cloud source of truth across devices.

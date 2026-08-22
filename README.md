# NorthStar

NorthStar is a React trading journal and execution-review workspace with live BTC/XAU charts, acknowledged pre-trade check-ins, a journal calendar, economic events, risk controls, and performance analytics.

## Local development

```bash
npm install
npm run start
```

The local app runs at `http://127.0.0.1:4173`.

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
`worker/index.js` for `/api/*`. The Worker provides the production
`/api/forex-factory` endpoint used by the economic calendar.

## Public access

NorthStar does not require authentication. Anyone with the deployed URL can
open the application. Each visitor receives a separate browser-local workspace;
data is not shared between browsers or devices.

## Data persistence

Each trading account has its own journal entries, check-ins, playbooks, risk
settings and analytics state in browser `localStorage`. Existing NorthStar data
is migrated automatically into a **Primary account**. Records persist on the
same deployed origin and browser profile, but they are not synchronized across
devices. Cloudflare D1 is still required for cloud synchronization.

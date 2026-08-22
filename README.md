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

## Data persistence

Journal entries, check-ins, plans, settings, and interface preferences are stored in browser `localStorage`. They persist on the same deployed origin and browser profile, but they are not synchronized across devices. A hosted database and authentication layer are required before offering multi-device accounts.

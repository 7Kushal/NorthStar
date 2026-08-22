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

## Deploy to Cloudflare Pages

Connect this repository to Cloudflare Pages and configure:

- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`

The Pages Function in `functions/api/forex-factory.js` provides the production `/api/forex-factory` endpoint used by the economic calendar. The SPA redirect is defined in `public/_redirects`.

## Data persistence

Journal entries, check-ins, plans, settings, and interface preferences are stored in browser `localStorage`. They persist on the same deployed origin and browser profile, but they are not synchronized across devices. A hosted database and authentication layer are required before offering multi-device accounts.

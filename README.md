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
`/api/forex-factory` endpoint used by the economic calendar and exposes the
verified Cloudflare Access identity at `/api/session`.

## Cloudflare-account-only sign-in

NorthStar is designed to sit behind Cloudflare Access. There is no application
sign-up flow.

1. In Cloudflare Zero Trust, open **Integrations → Identity providers** and use
   the **Cloudflare** identity provider with **Restrict to account members** enabled.
2. Enable Access for the `northstar` Worker and its production hostname.
3. Create an **Allow** policy using the **Cloudflare account member** selector.
   Do not use an `Everyone` rule.
4. Select Cloudflare as the only login method for the application.

The Worker trusts only the identity verified by `ctx.access`. Local Vite
development uses a clearly labelled local-development identity. Cloudflare
handles authentication before NorthStar loads; the app itself has no sign-in
or sign-up page. After authentication, NorthStar displays a personalized
welcome screen before opening the workspace.

## Data persistence

Each trading account has its own journal entries, check-ins, playbooks, risk
settings and analytics state in browser `localStorage`. Existing NorthStar data
is migrated automatically into a **Primary account**. Records persist on the
same deployed origin and browser profile, but they are not synchronized across
devices. Cloudflare D1 is still required for cloud synchronization.

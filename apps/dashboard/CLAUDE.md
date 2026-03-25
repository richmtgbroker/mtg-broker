# Dashboard — App-Specific Details

> This app lives inside the mtg-broker monorepo at `apps/dashboard/`.
> See the root `CLAUDE.md` for platform-wide docs (tech stack, services, design system).

## What This App Does

The main dashboard for mortgage loan officers. Shows quick actions, today's mortgage rates, pipeline overview, recent leads, saved scenarios, and a calendar with upcoming closings.

## Architecture

```
User visits mtg.broker/dashboard (Webflow page, Outseta-gated)
  → Webflow renders: Navbar_App + Sidebar_App + [Dashboard App] + Footer_App
  → Dashboard JS mounts into <div id="dashboard-app">
  → Injects all CSS + HTML, then initializes:
    → Fetches mortgage rates from API
    → Fetches lender count from API
    → Loads pipeline data (loans, leads, closings) from API
    → Loads saved scenarios from localStorage
    → Loads user name from Outseta
```

## Key Files

- `src/main.js` — Entry point: injects CSS + HTML template, runs all dashboard logic
- `src/styles.css` — All dashboard styles (imported by main.js, inlined into bundle)
- `vite.config.js` — Vite build config (IIFE format, CSS inlined into JS)
- `public/_headers` — Cache-Control headers for Cloudflare Pages

## Tech Stack

- **Frontend**: Vanilla JS (no React) — single IIFE bundle served from Cloudflare Pages
- **APIs**: Cloudflare Workers (`mtg-broker-api.rich-e00.workers.dev` for rates/pipeline, `mtg-broker-lenders.rich-e00.workers.dev` for lender count)
- **Auth**: Outseta (page-level gating on Webflow — no auth code in the dashboard)
- **Shell**: Webflow components (Navbar_App, Sidebar_App, Footer_App)

## What This App Does NOT Handle

- ❌ Navbar / sidebar / footer (all Webflow components)
- ❌ Login / auth gating (Outseta on the Webflow page)

## Build & Deploy

### Build
```bash
cd apps/dashboard
npm install
npm run build
```
Output: `dist/index.js` (single IIFE bundle with CSS inlined)

### Deploy to Cloudflare Pages
```bash
npx wrangler pages deploy dist --project-name mtg-dashboard
```
- Bundle URL: `https://mtg-dashboard.pages.dev/index.js`
- Cache headers: `public, max-age=300, stale-while-revalidate=3600`

## Webflow HtmlEmbed

The single embed replaces all 3 previous embeds:

```html
<div id="dashboard-app"></div>
<script>
  (function() {
    var s = document.createElement('script');
    s.src = 'https://mtg-dashboard.pages.dev/index.js';
    s.defer = true;
    document.head.appendChild(s);
  })();
</script>
```

## Migration History

Migrated from 3 Webflow embeds:
- Embed 1: CSS (Dashboard_v13_Embed1_CSS.html)
- Embed 2: HTML (Dashboard_v13_Embed2_HTML.html)
- Embed 3: JS (Dashboard_Embed3_JS_v15_0.html)

All combined into a single `src/main.js` that injects CSS, HTML, and runs JS.

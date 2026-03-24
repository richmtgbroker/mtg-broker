# Lender Directory — App-Specific Details

> This app lives inside the mtg-broker monorepo at `apps/lender-directory/`.
> See the root `CLAUDE.md` for platform-wide docs (tech stack, services, design system).

## What This App Does

Displays a searchable, filterable directory of wholesale lenders as a card grid. Supports text search, loan type dropdown filter, favorites (persisted via API), and NEXA-specific filters/badges for NEXA mortgage users. The React app is embedded inside the Webflow page at `mtg.broker/app/lenders`, which is automatically auth-gated by Outseta.

## Architecture

```
User visits mtg.broker/app/lenders (Webflow page, Outseta-gated)
  → Webflow renders: Navbar_App + Sidebar_App + [React App] + Footer_App
  → React app mounts into <div id="lender-directory-app">
  → App fetches lender data from Cloudflare Worker API
  → Lenders rendered as card grid with search/filter/favorites
```

## Key Files

- `src/App.jsx` — React app (toolbar, card grid, favorites, NEXA gating — NO navbar/footer/auth)
- `src/main.jsx` — Mounts React into `#lender-directory-app` div on the Webflow page (with DOM polling)
- `src/index.css` — All styles for the lender directory UI
- `package.json` — App dependencies and build config
- `vite.config.js` — Vite build config (IIFE format, CSS inlined into JS)

## Tech Stack

- **Frontend**: Vite + React (embedded in Webflow page as IIFE bundle)
- **Lenders API**: Cloudflare Worker at `https://mtg-broker-lenders.rich-e00.workers.dev`
- **Favorites API**: Cloudflare Worker at `https://mtg-broker-favorites.rich-e00.workers.dev`
- **Auth**: Outseta (page-level gating on Webflow — no auth code in the React app)
- **Shell**: Webflow components (Navbar_App, Sidebar_App, Footer_App)

## What the React App Does NOT Handle

The following are all handled by Webflow and Outseta — do NOT add them back to the React app:
- ❌ Navbar / navigation
- ❌ Sidebar
- ❌ Footer
- ❌ Login prompt / auth gating
- ❌ Sign out button

## Vite Build Configuration

Built as **IIFE format** (not ES module). CSS is inlined into the JS bundle — there is NO separate CSS file. Filename is fixed (`index.js`) — no content hash.

## Webflow HtmlEmbed Code

```html
<div id="lender-directory-app"></div>
<script>
  (function() {
    var s = document.createElement('script');
    s.src = 'https://mtg-lender-directory.pages.dev/index.js';
    s.defer = true;
    document.head.appendChild(s);
  })();
</script>
```

## Features

- **Text search** — searches by lender name, loan types, and description
- **Loan type dropdown** — searchable dropdown to filter by specific loan type
- **Favorites** — heart button on each card, persisted via Favorites API, filterable
- **NEXA gating** — NEXA-only lenders hidden from non-NEXA users; NEXA users see Broker/NonDel/NEXA💯 filter buttons and badges
- **Stale-while-revalidate caching** — cached lender data renders instantly, background refresh keeps it fresh
- **Responsive** — adapts to tablet and mobile layouts

## Caching Strategy

- Cache key: `lenders_directory_v6` in localStorage
- Fresh window: 2 hours — no API call needed
- Stale window: 24 hours — shows cached data instantly, refreshes in background
- Beyond 24 hours: cache discarded, full loading spinner

## Deployment

### Build
```bash
cd apps/lender-directory
npm run build
```

### Deploy to Cloudflare Pages
```bash
npx wrangler pages deploy dist --project-name mtg-lender-directory
```

- Bundle URL (permanent): `https://mtg-lender-directory.pages.dev/index.js`
- Cache headers: `public, max-age=300, stale-while-revalidate=3600`

> No Webflow step needed after initial embed setup. Users get the latest build within 5 minutes via cache headers.

## Design

- **Font**: Host Grotesk (inherited from Webflow page)
- **Card grid**: auto-fill, minmax(260px, 1fr)
- **Responsive breakpoints**: 991px (tablet), 767px (small tablet), 479px (mobile)
- **Clean, professional** — no dark mode, no flashy animations

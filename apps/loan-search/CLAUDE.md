# Loan Search — App-Specific Details

> This app lives inside the mtg-broker monorepo at `apps/loan-search/`.
> See the root `CLAUDE.md` for platform-wide docs (tech stack, services, design system).

## What This App Does

A filterable, sortable table of ~625 wholesale loan products. Loan officers can search, filter by category/field, sort columns, and click any row to see full product details. The vanilla JS app is embedded inside the Webflow page at `mtg.broker/loan-search`, which is automatically auth-gated by Outseta.

## Architecture

```
User visits mtg.broker/loan-search (Webflow page, Outseta-gated)
  → Webflow renders: Navbar_App + Sidebar_App + [JS App] + Footer_App
  → JS app mounts into <div id="loan-search-app">
  → Fetches data from https://mtg-broker-api.rich-e00.workers.dev/api/loan-products
  → Renders: category pills, search bar, filter panel, data table, pagination, product detail modal
```

## Key Files

- `src/main.js` — Entry point: imports CSS, creates DOM, initializes UI + loan search
- `src/template.js` — HTML template (DOM structure injected into mount point)
- `src/styles.css` — All CSS (merged from former HTML embed + worker injectStyles)
- `src/ui.js` — UI handlers: filter panel, product detail modal, mobile backdrops, admin detection
- `src/loan-search.js` — Core logic: data fetch, filtering, sorting, pagination, categories, columns
- `vite.config.js` — Vite build config (IIFE format, CSS inlined into JS)
- `package.json` — App dependencies and build config

## Tech Stack

- **Frontend**: Vite + Vanilla JS (embedded in Webflow page as IIFE bundle)
- **Data API**: Cloudflare Worker at `mtg-broker-api.rich-e00.workers.dev`
- **Auth**: Outseta (page-level gating on Webflow — no auth code in the app)
- **Shell**: Webflow components (Navbar_App, Sidebar_App, Footer_App)

## What This App Does NOT Handle

The following are all handled by Webflow and Outseta:
- ❌ Navbar / navigation
- ❌ Sidebar
- ❌ Footer
- ❌ Login prompt / auth gating
- ❌ JWT decoding or token management (except admin detection for Edit in Airtable button)

## Vite Build Configuration

Built as **IIFE format** (not ES module). CSS is inlined into the JS bundle — there is NO separate CSS file. Filename is fixed (`index.js`) — no content hash.

## Webflow Page Structure

The page at `/loan-search` has this structure:

```
Body
├── Navbar_App (component)
├── Sidebar_App (component)
├── Div Block [style: main-content-section]
│   └── HtmlEmbed  ← loads the JS app
└── Footer_App (component)
```

## HtmlEmbed Code

The HtmlEmbed inside the content Div Block contains:

```html
<div id="loan-search-app"></div>
<script>
  (function() {
    var s = document.createElement('script');
    s.src = 'https://mtg-loan-search.pages.dev/index.js';
    s.defer = true;
    document.head.appendChild(s);
  })();
</script>
```

> The filename is fixed (`index.js`) — no hash. The Webflow embed never needs updating after a rebuild.

## Migration History

**v8.0** — Migrated from 3-piece Webflow embed architecture to Cloudflare Pages bundle:
- **Before**: HTML embed (937 lines) + before-body loader (35 lines) + Cloudflare Worker serving inline JS (2,598 lines)
- **After**: Single Vite-built IIFE bundle (73KB / 18KB gzipped) on Cloudflare Pages
- The old Worker (`mtg-broker-loan-search`) is no longer needed for serving JS
- The old HTML embed and before-body script are replaced by a tiny 10-line embed

## Features

- **Category pills** — Quick filter by loan type (DSCR, FHA, Bank Statement, etc.) with "More" dropdown
- **Search** — Full-text search across all fields (debounced)
- **Filter panel** — Slide-in accordion panel with multi-select dropdowns, numeric inputs, range filters
- **Column chooser** — Slide-in panel to show/hide table columns, grouped by category
- **Sort** — Click column headers to sort (smart: numeric values sort numerically)
- **Pagination** — 50 products per page with page navigation
- **Product detail modal** — Click any row to see full product details in a modal
- **NEXA gating** — NEXA | AXEN Lending products hidden for non-NEXA users
- **Lender logos** — Shown in the lender column (from API lenderLogos map)
- **Admin features** — "Edit in Airtable" button for admin users (detected via JWT)
- **Responsive** — Tablet and mobile layouts with bottom-sheet panels

## Deployment

### Step 1 — Build
```bash
cd apps/loan-search
npm run build
```
Output: `dist/index.js` (single file, ~73KB) + `dist/_headers`

### Step 2 — Deploy to Cloudflare Pages
```bash
npx wrangler pages deploy dist --project-name mtg-loan-search
```
- Bundle URL: `https://mtg-loan-search.pages.dev/index.js`
- Cache headers: `public, max-age=300, stale-while-revalidate=3600`

> No Webflow step needed. The embed URL is permanent.

## Design Requirements

- **Font**: Host Grotesk (inherited from Webflow page)
- **Primary color**: `#1a56db` (blue)
- **Secondary blue**: `#1e40af`
- **Clean, professional UI** — no flashy animations, no dark mode
- **Mobile responsive**

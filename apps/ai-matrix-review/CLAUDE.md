# AI Matrix Review — App-Specific Details

> This app lives inside the mtg-broker monorepo at `apps/ai-matrix-review/`.
> See the root `CLAUDE.md` for platform-wide docs (tech stack, services, design system).

## What This App Does

Admin-only tool for reviewing AI-extracted loan product data from the Airtable "Loan Search" table. Replicates the Airtable Interface "AI Matrix Review" as a faster, standalone Cloudflare Pages app. Lets Rich review AI outputs, compare AI vs manual field values, and update the AI Review Status.

## Architecture

```
User visits mtg.broker/app/ai-matrix-review (Webflow page, Outseta-gated)
  → Webflow renders: Navbar_App + Sidebar_App + [React App] + Footer_App
  → React app mounts into <div id="ai-matrix-review-app">
  → Fetches records from Airtable via Cloudflare Pages Function API
  → Left panel: searchable/filterable list of loan products
  → Right panel: full detail view with collapsible AI field sections
  → Status dropdown updates Airtable directly via PATCH API
```

## Key Files

- `src/App.jsx` — React app (list panel, detail panel, status editing — NO navbar/footer/auth)
- `src/main.jsx` — Mounts React into `#ai-matrix-review-app` div (with DOM polling)
- `src/index.css` — Styles for the review UI only
- `functions/api/list-records.js` — Pages Function (lists records, fetches single record detail)
- `functions/api/update-record.js` — Pages Function (updates AI Review Status via PATCH)
- `vite.config.js` — Vite build config (IIFE format, CSS inlined into JS)
- `public/_headers` — Cache-Control headers

## Tech Stack

- **Frontend**: Vite + React (embedded in Webflow page as IIFE bundle)
- **Backend**: Cloudflare Pages Functions (serverless, at `/api/list-records` and `/api/update-record`)
- **Database**: Airtable REST API (Base `appuJgI9X93OLaf0u`, Table `tblVSU5z4WSxreX7l`)
- **Auth**: Outseta JWT (RS256 verification) — admin-only access
- **Shell**: Webflow components (Navbar_App, Sidebar_App, Footer_App)

## Access Control

This is an **admin-only** tool. The API endpoints verify:
1. Valid Outseta JWT (RS256 signature verification)
2. Email is in the admin list (`rich@mtg.broker`, `rich@prestonlending.com`)

Non-admin users get a 403 error.

## API Endpoints

### GET `/api/list-records`

Query parameters:
- `status` — Filter by AI: Review Status (e.g., "Pending Review", "Completed")
- `search` — Search product name
- `offset` — Airtable pagination offset
- `recordId` — Fetch a single record with all fields (for detail view)

Returns: `{ records: [...], offset: "..." }` or `{ record: {...} }`

### PATCH `/api/update-record`

Body: `{ recordId: "rec...", fields: { "AI: Review Status": "Approved" } }`

Only the `AI: Review Status` field can be updated (safety measure).

Returns: `{ record: {...} }`

## Environment Variables

Set in Cloudflare Pages dashboard:
- `AIRTABLE_API_KEY` — Airtable personal access token

## Deployment

### Build
```bash
cd apps/ai-matrix-review
npm install
npm run build
```

### Deploy to staging
```bash
npx wrangler pages deploy dist --project-name mtg-matrix-review-staging
```

### Deploy to production
```bash
npx wrangler pages deploy dist --project-name mtg-matrix-review
```

- Bundle URL: `https://mtg-matrix-review.pages.dev/index.js`
- API: `https://mtg-matrix-review.pages.dev/api/list-records`

## HtmlEmbed Code (for Webflow)

```html
<div id="ai-matrix-review-app"></div>
<script>
  (function() {
    var s = document.createElement('script');
    s.src = 'https://mtg-matrix-review.pages.dev/index.js';
    s.defer = true;
    document.head.appendChild(s);
  })();
</script>
```

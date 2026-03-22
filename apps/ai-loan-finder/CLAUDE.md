# AI Loan Finder — App-Specific Details

> This app lives inside the mtg-broker monorepo at `apps/ai-loan-finder/`.
> See the root `CLAUDE.md` for platform-wide docs (tech stack, services, design system).

## What This App Does

Lets loan officers describe a borrower scenario in plain English and instantly get matched wholesale loan products. The React app is embedded inside the Webflow page at `mtg.broker/app/ai-search`, which is automatically auth-gated by Outseta.

## Architecture

```
User visits mtg.broker/app/ai-search (Webflow page, Outseta-gated)
  → Webflow renders: Navbar_App + Sidebar_App + [React App] + Footer_App
  → React app mounts into <div id="ai-search-app">
  → User types scenario → POST to Cloudflare Pages Function API
    → 1. Parse scenario for filters (FICO, occupancy, loan type, etc.)
    → 2. Query Supabase REST API with filters
    → 3. Send matching products to Claude for ranking/explanation
    → 4. Return structured JSON results → Display as cards
```

## Key Files

- `src/App.jsx` — React search UI (input, chips, results cards — NO navbar/footer/auth)
- `src/main.jsx` — Mounts React into `#ai-search-app` div on the Webflow page
- `src/index.css` — Styles for the search UI only
- `functions/api/search.js` — Cloudflare Pages Function (parses scenario → queries Supabase → calls Claude)
- `scripts/migrate-airtable-to-supabase.js` — One-time data migration script
- `package.json` — App dependencies and build config
- `vite.config.js` — Vite build configuration

## Tech Stack

- **Frontend**: Vite + React (embedded in Webflow page)
- **Backend**: Cloudflare Pages Functions (serverless)
- **Database**: Supabase (PostgreSQL) — `loan_products` table (~625 records)
- **AI**: Anthropic Claude API (claude-haiku-4-5) — ranks/explains results
- **Auth**: Outseta (page-level gating on Webflow — no auth code in the React app)
- **Shell**: Webflow components (Navbar_App, Sidebar_App, Footer_App)

## What the React App Does NOT Handle

The following are all handled by Webflow and Outseta — do NOT add them back to the React app:
- ❌ Navbar / navigation
- ❌ Sidebar
- ❌ Footer
- ❌ Login prompt / auth gating
- ❌ JWT decoding or token management
- ❌ Sign out button

## Database Schema

### Supabase Table: `loan_products`

| Column | Description |
|--------|------------|
| `product_name` | Product name |
| `lender_name` | Lender |
| `loan_product_type` | FHA, VA, Conventional, DSCR, etc. |
| `min_fico` / `min_fico_investment` | Minimum credit scores |
| `min_loan_amount` / `max_loan_amount` | Loan amount range |
| `occupancy_choices` | Primary, Secondary, Investment |
| `property_types` | Property type text |
| `purposes` | Purchase, Refinance, Cash-Out |
| `terms` | Loan terms |
| `dscr_min_ratio` | For DSCR products |
| `max_ltv_purchase` / `max_ltv_cashout` / `max_ltv_rate_term` | LTV limits |
| `max_dti` | Max debt-to-income |
| `state_restrictions` | State availability |
| `itin_allowed` / `foreign_national_eligible` | Special eligibility |
| `description` / `program_notes` | Detailed notes |
| `income_types` | Accepted income types |
| `product_status` | "Active" for live products |

### Original Airtable (source of truth)
- **Base ID**: `appuJgI9X93OLaf0u`
- **Loan Products Table**: `tblVSU5z4WSxreX7l` (~625 records)
- **Lender List Table**: `tbl1mpg3KFakZsFK7`

## System Prompt for AI

Defined in `functions/api/search.js`. Claude receives pre-filtered products from Supabase and ranks/explains them. It does NOT query the database directly.

## Example Scenarios (shown as clickable chips)

- "640 FICO, self-employed 2 years, buying a duplex as investment property, 25% down in Florida"
- "720 credit score, first-time homebuyer, looking at a condo, 5% down, primary residence"
- "Who does bank statement loans for self-employed borrowers with a 680 score?"
- "DSCR loan for a 4-unit investment property, 700 FICO, 30% down"
- "What lender does ITIN loans? Borrower has a 600 score."
- "VA loan options for a manufactured home, 660 credit score"

## Environment Variables

Set in Cloudflare Pages dashboard, never in code:
- `ANTHROPIC_API_KEY` — Claude API key
- `SUPABASE_ANON_KEY` — Supabase public key
- `SUPABASE_URL` — defaults to `https://tcmahfwhdknxhhdvqpum.supabase.co`

## Deployment

### Step 1 — Build the React app
```bash
cd apps/ai-loan-finder
npm run build
```
Output goes to `dist/`. The JS and CSS bundles will have hashed filenames like:
- `dist/assets/index-[hash].js`
- `dist/assets/index-[hash].css`

### Step 2 — Deploy to Cloudflare Pages
Deploy the `dist/` folder and `functions/` folder to Cloudflare Pages.
The API backend runs as a Pages Function at `/api/search`.

### Step 3 — Update the API_URL in App.jsx
Set `API_URL` at the top of `src/App.jsx` to the actual Cloudflare Pages domain:
```js
const API_URL = 'https://YOUR-PROJECT.pages.dev/api/search'
```
Then rebuild and redeploy.

### Step 4 — Embed in Webflow
In the Webflow Designer, on the `/app/ai-search` page, add an HtmlEmbed in the
content area (between Sidebar_App and Footer_App) with:
```html
<link rel="stylesheet" href="https://YOUR-PROJECT.pages.dev/assets/index-[hash].css">
<script type="module" src="https://YOUR-PROJECT.pages.dev/assets/index-[hash].js"></script>
```
Update the filenames after each build (the hash changes on every build).

### Step 5 — Reorder elements in Webflow Navigator
The content div (`#ai-search-app`) must appear between Sidebar_App and Footer_App
in the page structure. Drag it into position in the Webflow Navigator if needed.

## Sidebar Embed Deployment

The sidebar script (`workers/mtg-broker-sidebar/`) is embedded inside the
**Sidebar_App Webflow component** (not in Site Settings). This ensures it only
loads on app pages. To update the sidebar embed:
1. Open any app page in the Webflow Designer
2. Double-click the Sidebar_App component to enter component view
3. Double-click the HtmlEmbed inside it
4. Replace the code with the updated script tag
5. Save & Close, then publish

## CORS

The Cloudflare Pages Function must allow CORS from `https://mtg.broker`.
Check `functions/api/search.js` for CORS headers and add if missing:
```js
'Access-Control-Allow-Origin': 'https://mtg.broker'
```

## Design Requirements

- **Font**: Host Grotesk (inherited from Webflow page)
- **Primary color**: `#1a56db` (blue)
- **Secondary blue**: `#1e40af`
- **Light blue background**: `#e0ecff`
- **Clean, professional UI** — no flashy animations, no dark mode
- **Mobile responsive**

## Code Style

- Keep it simple — maintained by a solo non-developer
- Prefer clear, readable code over clever abstractions
- Comment anything non-obvious
- Single-file components where possible
- No TypeScript — plain JavaScript/JSX

## Current Status (as of 2026-03-22)

### Built
- React app stripped of navbar/footer/auth — search UI only
- Mounts into `#ai-search-app` div on Webflow page
- Cloudflare Pages Function backend (Supabase query → Claude ranking)
- Data migrated from Airtable to Supabase
- Webflow page created at `/app/ai-search` with Navbar_App, Sidebar_App, Footer_App

### Needs Work
- Set correct `API_URL` in App.jsx once Cloudflare Pages is deployed
- Build and deploy to Cloudflare Pages
- Add CORS header to Pages Function for `mtg.broker`
- Add HtmlEmbed to Webflow page with correct JS/CSS bundle URLs
- Reorder content div between Sidebar_App and Footer_App in Webflow Navigator
- End-to-end search testing with real data
- Automated Airtable → Supabase sync

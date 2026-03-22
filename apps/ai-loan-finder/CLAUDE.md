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
- `src/main.jsx` — Mounts React into `#ai-search-app` div on the Webflow page (with DOM polling)
- `src/index.css` — Styles for the search UI only (no navbar/footer styles)
- `functions/api/search.js` — Cloudflare Pages Function (parses scenario → queries Supabase → calls Claude)
- `scripts/migrate-airtable-to-supabase.js` — One-time data migration script
- `package.json` — App dependencies and build config
- `vite.config.js` — Vite build config (IIFE format, CSS inlined into JS)

## Tech Stack

- **Frontend**: Vite + React (embedded in Webflow page as IIFE bundle)
- **Backend**: Cloudflare Pages Functions (serverless, at `/api/search`)
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

## Vite Build Configuration

Built as **IIFE format** (not ES module). This avoids cross-origin `type="module"` issues in Webflow embeds. CSS is inlined into the JS bundle — there is NO separate CSS file.

```js
// vite.config.js
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        format: 'iife',
        name: 'AiLoanFinder',
        inlineDynamicImports: true,
      }
    }
  }
})
```

## Webflow Page Structure

The page at `/app/ai-search` (page ID: `69bf70b7f2bd8473e5780676`) has this exact structure:

```
Body
├── Navbar_App (component)
├── Sidebar_App (component)
├── Div Block [style: main-content-section]   ← content wrapper
│   └── HtmlEmbed                             ← loads the React app
└── Footer_App (component)
```

**The `main-content-section` style class is required** on the Div Block. Without it, content overlaps the navbar. This is the standard for all app pages (see root CLAUDE.md).

## HtmlEmbed Code

The HtmlEmbed inside the content Div Block contains:

```html
<div id="ai-search-app"></div>
<script>
  (function() {
    var s = document.createElement('script');
    s.src = 'https://mtg-loan-finder.pages.dev/index.js';
    s.defer = true;
    document.head.appendChild(s);
  })();
</script>
```

> ✅ The filename is fixed (`index.js`) — no hash. The Webflow embed never needs updating after a rebuild. Just build and deploy.

## React App Mount Logic (`main.jsx`)

Uses DOM polling to handle Webflow's async script injection:

```jsx
function mountApp() {
  const container = document.getElementById('ai-search-app')
  if (container) {
    ReactDOM.createRoot(container).render(<React.StrictMode><App /></React.StrictMode>)
  } else {
    let attempts = 0
    const interval = setInterval(() => {
      attempts++
      const el = document.getElementById('ai-search-app')
      if (el) {
        clearInterval(interval)
        ReactDOM.createRoot(el).render(<React.StrictMode><App /></React.StrictMode>)
      } else if (attempts > 100) {
        clearInterval(interval)
        console.error('ai-search-app container not found after 5 seconds')
      }
    }, 50)
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApp)
} else { mountApp() }
```

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
Output goes to `dist/`. Because of the IIFE build format, there is only **one JS file** (no separate CSS):
- `dist/index.js` — everything bundled (JS + CSS inlined), **fixed filename, no hash**

### Step 2 — Deploy to Cloudflare Pages
```bash
npx wrangler pages deploy dist --project-name mtg-loan-finder
```
The bundle is served at `https://mtg-loan-finder.pages.dev/index.js`.
The API backend runs as a Pages Function at `https://mtg-loan-finder.pages.dev/api/search`.

> ✅ No Step 3 needed — the Webflow embed URL is permanent (`/index.js`). Build and deploy is all that's required.

## CORS

The Cloudflare Pages Function allows CORS from `https://mtg.broker`. Check `functions/api/search.js`:
```js
'Access-Control-Allow-Origin': 'https://mtg.broker'
```

## Sidebar Embed Deployment

The sidebar script is embedded inside the **Sidebar_App Webflow component** (not in Site Settings).
This ensures it only loads on app pages. The sidebar includes an "AI Loan Finder" link pointing to `/app/ai-search`.

To update the sidebar script:
1. Open any app page in the Webflow Designer
2. Double-click the Sidebar_App component to enter component view
3. Double-click the HtmlEmbed inside it
4. Update the script
5. Save & Close, then publish

**Or do it via Webflow MCP** — use `mcp__webflow__de_component_tool` to access the Sidebar_App component and update its HtmlEmbed.

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

### Live and Working ✅
- React app embedded in Webflow page at `mtg.broker/app/ai-search`
- Webflow page structure: Navbar_App + Sidebar_App + [content div w/ `main-content-section`] + Footer_App
- IIFE JS bundle deployed on Cloudflare Pages (`mtg-loan-finder.pages.dev`)
- Cloudflare Pages Function API at `/api/search`
- Supabase `loan_products` table populated (~625 records)
- DOM polling in `main.jsx` handles async mounting
- Outseta auth gating active
- "AI Loan Finder" link in sidebar

### Still Needed
- End-to-end search testing with real borrower scenarios
- Automated Airtable → Supabase data sync (when Airtable data changes)
- Update HtmlEmbed hash after future builds (or automate via Webflow MCP)

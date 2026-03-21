# AI Loan Finder — App-Specific Details

> This app lives inside the mtg-broker monorepo at `apps/ai-loan-finder/`.
> See the root `CLAUDE.md` for platform-wide docs (tech stack, services, design system).

## What This App Does

Lets loan officers describe a borrower scenario in plain English and instantly get matched wholesale loan products. Deployed to Cloudflare Pages at `app.mtg.broker`.

## Architecture

```
User types scenario → React frontend → POST /api/search → Cloudflare Pages Function
  → 1. Parse scenario for filters (FICO, occupancy, loan type, etc.)
  → 2. Query Supabase REST API with filters
  → 3. Send matching products to Claude for ranking/explanation
  → 4. Return structured JSON results → Display as cards
```

## Key Files

- `src/App.jsx` — Single-page React frontend (input, chips, results cards, nav)
- `functions/api/search.js` — Cloudflare Pages Function (parses scenario → queries Supabase → calls Claude)
- `scripts/migrate-airtable-to-supabase.js` — One-time data migration script
- `worker-proxy.js` — Cloudflare Worker proxy for `/app/ai-search` route
- `package.json` — App dependencies and build config
- `vite.config.js` — Vite build configuration

## Tech Stack

- **Frontend**: Vite + React (single page app)
- **Backend**: Cloudflare Pages Functions (serverless)
- **Database**: Supabase (PostgreSQL) — `loan_products` table (~625 records)
- **AI**: Anthropic Claude API (claude-haiku-4-5) — ranks/explains results
- **Auth**: localStorage-based JWT token auth with redirect to mtg.broker login

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

```bash
cd apps/ai-loan-finder
npm run build
# Deploy via Cloudflare Pages (Wrangler or dashboard)
```

- Build output: `dist/`
- Custom domain: `app.mtg.broker`

## Design Requirements

- **Font**: Host Grotesk (Google Fonts)
- **Primary color**: `#1a56db` (blue)
- **Secondary blue**: `#1e40af`
- **Light blue background**: `#e0ecff`
- **Background gradient**: `linear-gradient(180deg, #f0f5ff 0%, #ffffff 30%)`
- **Clean, professional UI** — no flashy animations, no dark mode
- **Mobile responsive**

### Navigation Bar

| Label | Path |
|-------|------|
| Dashboard | `/dashboard` |
| AI Loan Finder | `/app/ai-search` (active state) |
| Loan Search | `/loan-search` |
| Lenders | `/lenders` |
| Calculators | `/calculators` |

## Code Style

- Keep it simple — maintained by a solo non-developer
- Prefer clear, readable code over clever abstractions
- Comment anything non-obvious
- Single-file components where possible
- No TypeScript — plain JavaScript/JSX

## Current Status (as of 2026-03-21)

### Built
- Full React frontend with scenario input, example chips, nav bar, results cards
- Cloudflare Pages Function backend (Supabase query → Claude ranking)
- JWT-based auth flow (reads access_token from URL redirect or localStorage)
- Data migrated from Airtable to Supabase
- Cloudflare Worker proxy for `/app/ai-search` route

### Needs Work
- Auth flow stabilization (went through 6+ iterations)
- Deployment verification at `app.mtg.broker`
- End-to-end search testing with real data
- Automated Airtable → Supabase sync

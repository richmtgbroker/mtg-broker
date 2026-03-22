# mtg.broker — Mortgage Broker SaaS Platform

## Platform Overview

mtg.broker is a SaaS platform for independent mortgage loan officers. It helps them find wholesale loan products, manage lender relationships, and run their business more efficiently.

The platform is a combination of a Webflow marketing/app site, standalone React apps, Cloudflare Workers for API logic, and Airtable/Supabase for data.

## Tech Stack

- **Website & App Shell**: Webflow (Site ID: `694e4aaf5f511ad7901b74bc`)
- **Standalone Apps**: Vite + React (deployed to Cloudflare Pages)
- **Database (current)**: Airtable (Base ID: `appuJgI9X93OLaf0u`)
- **Database (migrating to)**: Supabase (Project ID: `tcmahfwhdknxhhdvqpum`, URL: `https://tcmahfwhdknxhhdvqpum.supabase.co`)
- **Auth**: Outseta (`mtgbroker.outseta.com`) — handles signup, login, JWT tokens
- **API / Backend**: Cloudflare Workers (individual workers deployed per route)
- **AI**: Anthropic Claude API (used in AI Loan Finder for ranking loan products)
- **Domain**: `mtg.broker` (Cloudflare DNS)

## Folder Structure

```
mtg-broker/
├── CLAUDE.md                  ← You are here. Platform-wide docs.
├── apps/
│   └── ai-loan-finder/        ← Standalone React app (Vite + Cloudflare Pages)
│       ├── CLAUDE.md           ← App-specific docs, tech details, DB schema
│       ├── src/                ← React frontend (App.jsx)
│       ├── functions/          ← Cloudflare Pages Functions (API backend)
│       ├── scripts/            ← Migration/utility scripts
│       ├── package.json        ← App dependencies and build config
│       └── ...
├── workers/                   ← Cloudflare Workers (deployed individually)
│   └── (worker-name.js files)
├── webflow-embeds/            ← Custom code for Webflow pages
│   └── (organized by page or component)
├── airtable-scripts/          ← Airtable automation and scripting extension scripts
│   └── (script files)
└── shared/                    ← Reusable components across Webflow and apps
    └── (navbar, sidebar, footer, etc.)
```

## How Each Piece Deploys

| Component | Deploys To | How |
|-----------|-----------|-----|
| AI Loan Finder | Cloudflare Pages (`app.mtg.broker`) | `cd apps/ai-loan-finder && npm run build` → Wrangler/CF Pages |
| Workers | Cloudflare Workers (various routes) | `wrangler deploy` per worker |
| Webflow Embeds | Webflow custom code blocks | Copy/paste into Webflow Designer (50K char limit per embed) |
| Airtable Scripts | Airtable Scripting Extension | Copy/paste into Airtable's script editor |
| Shared Components | Used by apps and embeds | Imported or copy/pasted as needed |

## Key Services & IDs

| Service | Identifier |
|---------|-----------|
| Webflow Site | `694e4aaf5f511ad7901b74bc` |
| Airtable Base | `appuJgI9X93OLaf0u` |
| Airtable Loan Products Table | `tblVSU5z4WSxreX7l` (~625 records) |
| Airtable Lender List Table | `tbl1mpg3KFakZsFK7` |
| Supabase Project | `tcmahfwhdknxhhdvqpum` |
| Outseta Domain | `mtgbroker.outseta.com` |
| Cloudflare Pages Project | `app.mtg.broker` |
| GitHub Repo | `richmtgbroker/mtg-broker` |

## Design System

- **Font**: Host Grotesk (Google Fonts)
- **Primary color**: `#1a56db` (blue)
- **Secondary blue**: `#1e40af`
- **Light blue background**: `#e0ecff`
- **Background gradient**: `linear-gradient(180deg, #f0f5ff 0%, #ffffff 30%)`
- **Style**: Clean, professional — no flashy animations, no dark mode
- **Mobile responsive**

## Navigation (mtg.broker site)

| Label | Path |
|-------|------|
| Dashboard | `/dashboard` |
| AI Loan Finder | `/app/ai-search` |
| Loan Search | `/loan-search` |
| Lenders | `/lenders` |
| Calculators | `/calculators` |

## Environment Variables

Set in Cloudflare dashboards, never committed to code:
- `ANTHROPIC_API_KEY` — Claude API key (used by AI Loan Finder)
- `SUPABASE_ANON_KEY` — Supabase public key for REST API
- `SUPABASE_URL` — Supabase project URL
- `AIRTABLE_API_KEY` — Airtable personal access token (used by scripts)

## Workflow Rules

- **Always act autonomously** — Do everything possible automatically without asking for confirmation first. Never ask the user to do something manually if Claude can do it instead.
- After completing any code changes, always commit with a descriptive message and push to GitHub. Don't ask, just do it.
- Always provide full complete files, never partial snippets.
- Keep code simple and well-commented — this project is maintained by a solo non-developer.
- No TypeScript — use plain JavaScript/JSX everywhere.
- Prefer single-file components and readable code over clever abstractions.

## Code Standards

1. **Full files always** — ALWAYS provide the FULL complete file for EVERY code change. Never partial snippets, find-and-replace instructions, section replacements, or manual edit requests. No exceptions.
2. **Code summary with every delivery** — Always include a summary showing: old lines vs new lines, file sizes, what was added, changed, and removed.
3. **Webflow embed character limit** — Webflow embeds have a 50,000 character hard limit. Always check character count before delivering. Split into multiple embeds or external files if needed.
4. **Action item format** — Format action items as: ⚡ ACTION: description
5. **Keep code simple and well-commented** — This project is maintained by a solo non-developer who is new to coding.
6. **Debugging order** — When debugging, check in this order: Site Settings head code → Site Settings footer code → Page head code → Page before-body code.
7. **Use Airtable MCP tools** — Use Airtable MCP tools to create/modify fields and records directly. Never ask to do Airtable changes manually.
8. **Insurance before Tax** — Homeowner's Insurance is always listed BEFORE Property Tax in all layouts.
9. **Percent fields** — Store as decimals (divide by 100 on save, multiply by 100 on load).
10. **Currency fields** — Use precision 0 and $ symbol.
11. **Worker JS in template literals** — For Worker JS embedding in template literals, use three-step Python escaping: backslash first, then backtick, then `${`.
12. **Commit and push after every change** — After completing any code changes, always commit with a descriptive message and push to GitHub. Don't ask, just do it.

## Platform Architecture

- **Frontend**: Webflow (Site ID: `694e4aaf5f511ad7901b74bc`) — all embeds have 50K char limit
- **Database**: Airtable (Base ID: `appuJgI9X93OLaf0u`) migrating to Supabase
  - Pipeline Loans table: `tblH2hB1FlW9a3iXp`
- **Auth**: Outseta (domain: `mtgbroker.outseta.com`) — JWT stored in localStorage as `Outseta.nocode.accessToken`
  - Plan UIDs: LITE `NmdnZg90`, PLUS `Dmw8leQ4`, PRO `yWobBP9D`
- **API**: Cloudflare Workers
- **Owner/Admin**: Rich (`rich@mtg.broker`, admin email: `rich@prestonlending.com`)
- **NEXA detection**: JWT email domain check for `@nexalending.com` / `@nexamortgage.com`

## Current Status (as of 2026-03-21)

### What's Working
- AI Loan Finder React app (frontend + backend) — built, needs deployment verification
- Airtable database with ~625 loan products
- Supabase mirror (migrated from Airtable, used by AI Loan Finder)
- Webflow site live at mtg.broker

### What Needs Work
- Auth flow stabilization (Outseta JWT integration)
- End-to-end deployment verification for AI Loan Finder
- Automated Airtable → Supabase data sync
- Workers, embeds, and shared components not yet populated in this repo

# mtg.broker — Mortgage Broker SaaS Platform

## Platform Overview

mtg.broker is a SaaS platform for independent mortgage loan officers. It helps them find wholesale loan products, manage lender relationships, and run their business more efficiently.

The platform is a combination of a Webflow marketing/app site, standalone React apps, Cloudflare Workers for API logic, and Airtable/Supabase for data.

## Tech Stack

- **Website & App Shell**: Webflow (Site ID: `694e4aaf5f511ad7901b74bc`)
- **Standalone Apps**: Vite + React (embedded into Webflow via custom code embeds)
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
│   └── ai-loan-finder/        ← React app (Vite) embedded into Webflow at /app/ai-search
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

## Deployment Architecture

**Universal rule: All Cloudflare-served components use fixed URLs. Webflow embeds are set ONCE and never touched again.**

### Fixed-URL Patterns by Component Type

| Type | Pattern | Cache Strategy | Example |
|------|---------|----------------|---------|
| Static bundles (React apps) | Cloudflare Pages + `_headers` file | `Cache-Control: public, max-age=300, stale-while-revalidate=3600` | AI Loan Finder → `mtg-loan-finder.pages.dev/index.js` |
| Dynamic scripts | Cloudflare Worker, fixed route | Same `Cache-Control` header set in Worker response | Sidebar → `mtg-broker-sidebar.rich-e00.workers.dev/sidebar.js` |

### Rules

- **No content hashes in filenames.** Never use `index-[hash].js`. Output is always `index.js` (or equivalent fixed name).
- **Cache-busting via headers, not filenames.** `max-age=300` means browsers refresh within 5 minutes of a deploy. `stale-while-revalidate=3600` means no spinner — the old version serves instantly while the new one downloads in the background.
- **Webflow embeds are set once.** After the initial embed is set to the fixed URL, it never changes — not after rebuilds, not after deployments, not ever.
- **Deploy workflow is always:** build → deploy to Cloudflare → done. No Webflow steps.
- **This applies to:** AI Loan Finder, Sidebar Worker, Navbar Worker, and all future components.

### Staging / Preview Workflow

**Always deploy to staging first and ask before deploying to production. Never assume production unless the change is explicitly confirmed as trivial.**

#### Cloudflare Pages apps (AI Loan Finder)
- Every `git push` to any branch automatically creates a **preview deployment** at a unique URL (e.g. `abc123.mtg-loan-finder.pages.dev`)
- Only the `main` branch deploys to the production URL (`mtg-loan-finder.pages.dev/index.js`)
- **Staging workflow:** push changes to a `staging` branch → test the preview URL → merge to `main` when ready
- Preview URLs are safe to share for review before going live

#### Cloudflare Workers (sidebar, navbar, future components)
- Deploy a staging version with: `wrangler deploy --env staging`
  - Staging URL pattern: `mtg-broker-sidebar-staging.rich-e00.workers.dev`
- Test the staging Worker URL directly in the browser or with `curl`
- When ready, deploy to production: `wrangler deploy` (no `--env` flag)

#### Default deploy workflow
1. Make changes
2. Deploy to staging/preview first
3. Test at the preview/staging URL
4. If good → deploy to production
5. **Never deploy directly to production without testing** unless it's a trivial, low-risk change (e.g. a copy tweak or comment)

> ⚠️ **Claude must always ask:** "Deploy to staging or production?" before running any deploy command. Do not assume production.

### How to Add a New Component (checklist)

- [ ] Build as IIFE (React apps) or Worker script — single output file, fixed filename
- [ ] For Pages: add `public/_headers` with `Cache-Control: public, max-age=300, stale-while-revalidate=3600`
- [ ] For Workers: set the same `Cache-Control` header in the `fetch` handler response
- [ ] Set the Webflow embed to the fixed URL — this is the only time you touch the embed
- [ ] Document the fixed URL in the app's CLAUDE.md

## How Each Piece Deploys

| Component | Deploys To | How |
|-----------|-----------|-----|
| AI Loan Finder | Webflow page (`mtg.broker/app/ai-search`) | Built with Vite, JS/CSS hosted on Cloudflare Pages, loaded via HtmlEmbed in Webflow. Auth gated by Outseta automatically. React app has NO navbar/footer/auth — all handled by Webflow components. |
| Workers | Cloudflare Workers (various routes) | `wrangler deploy` per worker |
| Webflow Embeds | Webflow custom code blocks | Copy/paste into Webflow Designer (50K char limit per embed) |
| Sidebar Script | Sidebar_App Webflow component (HtmlEmbed inside it) | Double-click component → double-click embed → paste script tag. Do NOT put in Site Settings. |
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
| AI Loan Finder URL | `mtg.broker/app/ai-search` (Webflow page, Outseta-gated) |
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

## File Output Rules

- **Increment version on save** — When modifying an existing versioned file, save the updated version with an incremented version number in the filename (e.g., `v7_24` becomes `v7_25`). Keep the same naming convention as the original.
- **Match naming convention** — When creating a new file, use the same naming convention as existing files in that folder (e.g., `Pages_App_Products_JS_v3_0.js` matches the `Pages_App_*` pattern).
- **End-of-task file list** — At the end of every task, list ALL files created or modified with their full paths and a one-line summary of what changed.

## Workflow Rules

- **Always act autonomously** — Do everything possible automatically without asking for confirmation first. Never ask the user to do something manually if Claude can do it instead.
- After completing any code changes, always commit with a descriptive message and push to GitHub. Don't ask, just do it.
- Always provide full complete files, never partial snippets.
- Keep code simple and well-commented — this project is maintained by a solo non-developer.
- **Check git before rebuilding** — Before starting any rebuild or major file rewrite, always run `git log` and `git status` first to make sure all recent changes from other sessions have been committed and merged to main. Never overwrite uncommitted work.
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
12. **Cloudflare Worker URL pattern** — All Worker deploy URLs follow the pattern `{worker-name}.rich-e00.workers.dev`. Staging pattern: `{worker-name}-staging.rich-e00.workers.dev`.
13. **Commit and push after every change** — After completing any code changes, always commit with a descriptive message and push to GitHub. Don't ask, just do it.
14. **Use Webflow MCP tools** — Use Webflow MCP tools (`mcp__webflow__*`) to create pages, apply styles, and set element properties directly. Never ask the user to make Webflow Designer changes manually if it can be done via MCP.

## Standard App Page Structure

Every page in the `/app/` folder of Webflow MUST follow this exact structure. When creating a new app page, Claude should do ALL of these steps automatically via Webflow MCP tools:

### Required Elements (in order, top to bottom)
1. `Navbar_App` — component instance (handles sticky top navbar)
2. `Sidebar_App` — component instance (handles sidebar nav + layout positioning)
3. **Content Div Block** — with style class `main-content-section` applied
4. `Footer_App` — component instance

### The `main-content-section` Style Class
- **Always apply this style** to the content Div Block on every app page.
- This is a shared Webflow style that handles proper layout within the sidebar framework.
- Style ID: `ff20f642-7537-d6af-3000-97310d4628f4`
- Apply via MCP: `set_style` action with `style_names: ["main-content-section"]`
- **Never skip this** — without it, content will overlap the sticky navbar.

### App Page Creation Checklist (Claude does ALL of these automatically)
- [ ] Create page via `mcp__webflow__de_page_tool` in the App folder (`695c215357f7a77fba20aac2`)
- [ ] Add Navbar_App, Sidebar_App, Footer_App component instances
- [ ] Add content Div Block between Sidebar_App and Footer_App
- [ ] Apply `main-content-section` style to the content Div Block via `mcp__webflow__element_tool` `set_style`
- [ ] Add HtmlEmbed inside the content Div Block with the page content/script
- [ ] Publish the site

### Loading External JS Bundles in Webflow Embeds
Webflow strips external domains from `<script src="...">` attributes when saving embeds. Use this pattern instead:
```html
<div id="my-app"></div>
<script>
  (function() {
    var s = document.createElement('script');
    s.src = 'https://your-bundle-url.pages.dev/assets/index-[hash].js';
    s.defer = true;
    document.head.appendChild(s);
  })();
</script>
```

### React Apps Embedded in Webflow
- Build with Vite as **IIFE format** (not ES module) — avoids cross-origin `type="module"` issues
- CSS is **inlined into the JS bundle** — no separate CSS file to load
- Mount target is a `<div id="app-name">` in the HtmlEmbed, NOT `#root`
- Use DOM polling in `main.jsx` to handle Webflow's async script injection
- The React app handles NO auth, navbar, sidebar, or footer — all Webflow's job

## Platform Architecture

- **Frontend**: Webflow (Site ID: `694e4aaf5f511ad7901b74bc`) — all embeds have 50K char limit
- **Database**: Airtable (Base ID: `appuJgI9X93OLaf0u`) migrating to Supabase
  - Pipeline Loans table: `tblH2hB1FlW9a3iXp`
- **Auth**: Outseta (domain: `mtgbroker.outseta.com`) — JWT stored in localStorage as `Outseta.nocode.accessToken`
  - Plan UIDs: LITE `NmdnZg90`, PLUS `Dmw8leQ4`, PRO `yWobBP9D`
- **API**: Cloudflare Workers
- **Owner/Admin**: Rich (`rich@mtg.broker`, admin email: `rich@prestonlending.com`)
- **NEXA detection**: JWT email domain check for `@nexalending.com` / `@nexamortgage.com`

## Current Status (as of 2026-03-22)

### What's Working
- AI Loan Finder React app — fully live at `mtg.broker/app/ai-search`
  - Webflow page with Navbar_App, Sidebar_App, content div (`main-content-section`), Footer_App
  - React app (IIFE build) deployed on Cloudflare Pages (`mtg-loan-finder.pages.dev`)
  - Sidebar has "AI Loan Finder" link
  - Outseta auth gating active
- Airtable database with ~625 loan products
- Supabase mirror (migrated from Airtable, used by AI Loan Finder)
- Webflow site live at mtg.broker

### What's Automated
- **Airtable → Supabase sync** — Daily at 3 AM UTC via `mtg-broker-airtable-sync` Worker
  - `loan_products` (662 records) and `lenders` (297 records) both sync automatically
  - Manual trigger: `GET https://mtg-broker-airtable-sync.rich-e00.workers.dev/` (both tables), `/products`, or `/lenders`
  - Pipeline tables (`pipeline_loans`, `pipeline_tasks`) are Supabase-native — no sync needed

### What Needs Work
- End-to-end search testing with real borrower scenarios
- Workers, embeds, and shared components not yet populated in this repo

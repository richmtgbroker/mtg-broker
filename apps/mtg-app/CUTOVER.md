# mtg.broker — Production Cutover Plan

## Overview

Migrate mtg.broker from Webflow to the React Router app hosted on Cloudflare Pages.

**Current state:**
- Live site: Webflow → proxied through Cloudflare DNS
- `mtg.broker` redirects (301) to `www.mtg.broker` (Webflow)
- `app.mtg.broker` already points to `mtg-loan-finder.pages.dev`

**Target state:**
- `mtg.broker` and `www.mtg.broker` → Cloudflare Pages project `mtg-app`
- React Router SSR app with full Outseta auth, all pages ported

---

## Production Cloudflare Pages Project

- **Project name:** `mtg-app`
- **Pages URL:** `https://mtg-app.pages.dev`
- **Status:** Deployed and verified ✅

---

## DNS Change Required

The cutover is a DNS record change in the Cloudflare dashboard.

### Step 1: Add custom domain to Pages project

Go to: **Cloudflare Dashboard → Pages → mtg-app → Custom domains → Add domain**

Add both:
1. `mtg.broker`
2. `www.mtg.broker`

Cloudflare will automatically create/update the CNAME records.

### Step 2: Remove or update existing DNS records

If Cloudflare reports a conflict with existing records:

| Action | Record Type | Name | Old Value | New Value |
|--------|-------------|------|-----------|-----------|
| Update | CNAME | `www` | (Webflow proxy target) | `mtg-app.pages.dev` |
| Update | CNAME or A | `@` (root) | (Webflow proxy target) | `mtg-app.pages.dev` |

> **Note:** Cloudflare Pages supports apex domains (no `www`) via their CNAME flattening. The dashboard will guide you through this.

### Step 3: Remove the www redirect rule

The current `mtg.broker → www.mtg.broker` redirect rule (likely a Cloudflare Page Rule or Redirect Rule) should be **removed** after cutover, since the React Router app handles both domains.

---

## Pre-Cutover Checklist

Before changing DNS, verify ALL of these:

- [ ] **Production Pages project deployed:** `https://mtg-app.pages.dev` returns 200 with correct content
- [ ] **All routes work:** Homepage, Pricing, Login, Dashboard, AI Search, Loan Search, Products, Lenders, Calculators, Pipeline, Settings, Property Types, Privacy Policy, Terms of Service
- [ ] **CSS loads:** Pages render with full Tailwind styling (not unstyled HTML)
- [ ] **Logo displays:** MtgBroker logo visible in Navbar on all pages (logged in AND logged out)
- [ ] **Auth works:** Login page authenticates via Outseta `/tokens` API, saves JWT, redirects to dashboard
- [ ] **Logout works:** User dropdown → Logout clears JWT and redirects to homepage
- [ ] **API data loads:** Dashboard rates, lender counts, pipeline data all load (CORS allows `mtg.broker` origin)
- [ ] **Pipeline iframe loads:** `/app/pipeline` shows the Pipeline Worker UI in an iframe
- [ ] **robots.txt serves:** `/robots.txt` returns correct content
- [ ] **sitemap.xml serves:** `/sitemap.xml` returns valid XML
- [ ] **Outseta callbacks use dynamic origin:** `window.location.origin` not hardcoded domain
- [ ] **CORS verified:** `curl -H "Origin: https://mtg.broker" -I https://mtg-broker-api.rich-e00.workers.dev/api/lenders` returns `Access-Control-Allow-Origin: https://mtg.broker`

---

## Post-Cutover Checklist

After DNS change propagates (usually 1-5 minutes with Cloudflare):

- [ ] `https://mtg.broker` loads the React Router app (not Webflow)
- [ ] `https://www.mtg.broker` loads the React Router app (not Webflow)
- [ ] Login flow works end-to-end on `mtg.broker`
- [ ] Dashboard loads with data
- [ ] AI Loan Finder search works
- [ ] Pipeline iframe loads
- [ ] Outseta support widget works (help dropdown → Submit a Ticket)
- [ ] SSL certificate is valid (Cloudflare manages this automatically)
- [ ] Check Outseta admin: update "Post login URL" to `https://mtg.broker/app/dashboard` if not already

---

## Rollback Instructions

If something goes wrong after cutover:

### Quick Rollback (1-5 minutes)

1. Go to **Cloudflare Dashboard → DNS → mtg.broker zone**
2. Remove the custom domains from the `mtg-app` Pages project:
   - Pages → mtg-app → Custom domains → Remove `mtg.broker` and `www.mtg.broker`
3. Re-add the original DNS records pointing to Webflow:
   - The original Webflow proxy-sites-prod records should still be in Cloudflare or Webflow's dashboard
   - If using Webflow hosting: add CNAME `www` → `proxy-ssl.webflow.com` and A record for apex
4. Re-enable the `mtg.broker → www.mtg.broker` redirect rule if it was removed

### Webflow Site Status

- **Webflow Site ID:** `694e4aaf5f511ad7901b74bc`
- **Webflow staging URL:** Check Webflow Designer → Site Settings → Publishing
- **Important:** Do NOT unpublish or delete the Webflow site until the React Router app has been running stably in production for at least 2 weeks

### DNS Propagation

- Cloudflare DNS changes propagate in **1-5 minutes** (Cloudflare is both the DNS provider and the hosting provider)
- External DNS caches may take up to 1 hour with Cloudflare's default TTL
- Use `dig mtg.broker` or `nslookup mtg.broker` to verify propagation

---

## Deploy Commands

```bash
# Build the app
cd apps/mtg-app
npm run build

# Deploy to staging (test first)
npx wrangler pages deploy ./build/client --project-name mtg-app-staging

# Deploy to production
npx wrangler pages deploy ./build/client --project-name mtg-app
```

---

## Key URLs

| Resource | URL |
|----------|-----|
| Production Pages | `https://mtg-app.pages.dev` |
| Staging Pages | `https://mtg-app-staging.pages.dev` |
| Live site (Webflow) | `https://www.mtg.broker` |
| Cloudflare DNS | `https://dash.cloudflare.com` → mtg.broker zone |
| Outseta Admin | `https://mtgbroker.outseta.com/nocode` |
| GitHub Repo | `https://github.com/richmtgbroker/mtg-broker` |

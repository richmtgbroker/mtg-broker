# mtg.broker — Architecture & File Inventory

**Last Updated:** March 23, 2026
**Purpose:** Single reference doc for Claude.ai project knowledge. Replaces the need to upload individual code files. When working on a specific file, paste the current version from your git repo into the chat.

---

## How This Doc Works

- **Source of truth for all code:** Your local git repo (Claude Code's territory)
- **This doc provides:** File names, versions, purposes, deployment locations, and relationships — so Claude.ai can give informed answers without needing the actual code uploaded
- **When you need Claude.ai to edit a file:** Paste the current version from your repo into the chat message
- **When Claude Code changes a file:** Update the version number in this doc (or ask Claude.ai to remind you)

---

## Tech Stack Summary

| Layer | Technology | Key Identifier |
|-------|-----------|----------------|
| Frontend | Webflow | Site ID: `694e4aaf5f511ad7901b74bc` |
| Database | Airtable | Base ID: `appuJgI9X93OLaf0u` |
| API / Backend | Cloudflare Workers | 10 workers (see below) |
| Auth / Billing | Outseta | Domain: `mtgbroker.outseta.com` |
| Data Sync | Whalesync | Airtable ↔ Webflow CMS |
| File Storage | Cloudflare R2 | Avatars and logos |
| AI | Anthropic API | Claude Sonnet 4 (Pipeline PDF extraction) |
| AI (Automations) | Anthropic API | Claude Haiku (Airtable automations) |
| Automations | Make.com | NEXA employee auto-access |
| Referrals | Rewardful | API key: `a3ca66` |

---

## Cloudflare Workers (10 total)

| Worker Name | Current Version | Size | Purpose |
|-------------|----------------|------|---------|
| `mtg-broker-pipeline` | v7.29 | 402K | Pipeline page — loans CRUD, tabs (Assets, Income, Checklist, Contract, Documents), AI PDF extraction, calculators |
| `mtg-broker-api` | v7.24 | 141K | Core API — broker profile, settings, usage tracking, billing, save/load calculators |
| `mtg-broker-lenders` | v2.22 | 130K | Lender directory + detail pages, lender data from Airtable |
| `mtg-broker-social-media` | v1.0.22 | 107K | Social media tool — content generation, templates, scheduling |
| `mtg-broker-loan-search` | v1.7 | 95K | Loan product search — filters, product detail modals |
| `mtg-broker-vendors` | v1.15 | 71K | Vendor directory + detail pages, vendor data from Airtable |
| `mtg-broker-pipeline` (static) | v6.27.1 | 65K | Serves static JS modules: `pipeline-app.js`, `pipeline-assets.js`, `pipeline-checklist.js`, `pipeline-documents.js`, `pipeline-calcs.js` |
| `mtg-broker-matrix-ai` | v1.3 | 23K | AI matrix review — analyzes loan product PDFs |
| `mtg-broker-contacts` | v1.2 | 11K | Contacts page API |
| `mtg-broker-extras` | v1.1 | 11K | Miscellaneous endpoints (commitment letters, etc.) |
| `mtg-broker-favorites` | v1.0 | 11K | Favorites system — save/load favorites across directories |
| `mtg-broker-dev-tracker` | v1.0 | 8.5K | Development tracking tool |

---

## Airtable Tables (Key)

| Table | Table ID | Purpose |
|-------|----------|---------|
| Pipeline Loans | `tblH2hB1FlW9a3iXp` | Loan pipeline records |
| Pipeline Tasks | `tblI028O1LWD99HQN` | Tasks linked to pipeline loans |
| Lender List | `tbl1mpg3KFakZsFK7` | Lender directory records |
| Loan Search | `tblVSU5z4WSxreX7l` | Loan product data (493/500 fields) |
| Loan Search Config | `tblxAAUFpzZ7OrsGy` | Loan search filter configuration |
| Vendor Detail Config | `tblMmnKM3pY0eR37D` | Vendor page layout config |
| Lender Detail Config | `tblFuFTmTs0cZmWfO` | Lender page layout config |
| Goal Plans | *(see project knowledge)* | Goal setting records |
| Usage Tracking | *(see project knowledge)* | Plan usage/limits tracking |

---

## Airtable Automation Scripts (2)

| Script | Version | Purpose | Runtime |
|--------|---------|---------|---------|
| MatrixPDF Analysis STAGING | v3.3 | AI review of loan PDFs → writes to 160 "AI: staging" fields | ~23s (Haiku 4.5) |
| MatrixPDF Analysis MAKELIVE | v2.6 | Copies staging fields to live fields in batch | ~2.4s |

---

## Webflow Pages & Their Files

Each page typically has 1-3 Webflow embeds (CSS in head, HTML in body, JS before `</body>`). Some pages also load static JS modules from Cloudflare Workers.

### Site-Wide Code

| File | Version | Location | Purpose |
|------|---------|----------|---------|
| SiteSettingsHeadCode | v6.1 | Site Settings → Head | 10-section global CSS (navbar, forms, modals, tables, cards, utilities, mobile nav) |
| SiteSettingsFooterCode | v3.0 | Site Settings → Before `</body>` | Global JS: Outseta cache, billing core, feature gating, mobile nav, utilities |
| App_NavbarEmbed | v2.8 | Navbar symbol embed | App navigation bar |
| App_Pages_Sidebar | v8 | Sidebar symbol embed | Left sidebar navigation |
| App_Pages_Footer | v1 | Footer symbol embed | App footer styles |
| Global_Footer_Embed | v1.1 | Footer embed | Public pages footer |
| global-navbar | v2 | Navbar embed | Public pages navigation |

### Homepage (`/`)

| File | Version | Location | Purpose |
|------|---------|----------|---------|
| Pages_Home_Embed_CSS | v1 | Head CSS | Homepage styles |
| Pages_Home_Embed_CSS_Hero | v1.1 | Head CSS | Hero section styles |
| Pages_Home_Embed_HTML_Pricing | v4.0 | Body embed | Pricing cards on homepage |

### Login Page (`/login`)

| File | Version | Location | Purpose |
|------|---------|----------|---------|
| Login_Page_Head_CSS | v1.0 | Head CSS | Login page styles |
| Login_Page_HTML_Embed | v1.1 | Body HTML | Login form structure |
| Login_Page_BeforeBody_JS | v1.3 | Before `</body>` JS | Login logic and redirects |

### Pricing Page (`/pricing`)

| File | Version | Location | Purpose |
|------|---------|----------|---------|
| pricing_page_CSS | v3.0 | Head CSS | Pricing page styles |
| pricing_page_HTML | v4.0 | Body HTML | Pricing page structure |
| pricing_page_JS | v3.0 | Before `</body>` JS | Plan selection logic |

### Dashboard (`/app/dashboard`)

| File | Version | Location | Purpose |
|------|---------|----------|---------|
| Dashboard_v13_Embed1_CSS | v13 | Head CSS | Dashboard styles |
| Dashboard_v13_Embed2_HTML | v13 | Body HTML | Dashboard structure |
| Dashboard_Embed3_JS | v15.0 | Before `</body>` JS | Dashboard logic, charts, stats |

### Pipeline (`/app/pipeline`) — Most Complex Page

| File | Version | Location | Purpose |
|------|---------|----------|---------|
| Pipeline_Page_Embed_CSS | v12.4 | Head CSS (49K — near limit!) | All pipeline styles |
| Pipeline_Page_Embed_HTML | v12.0 | Body HTML (49K — near limit!) | Pipeline structure, modal, tabs |
| Pipeline_Page_Embed_JS | v13.8 | Before `</body>` JS (48K — near limit!) | JS Loader — loads static modules from Worker |

**Static JS modules served by Worker:**
- `pipeline-app.js` — Core pipeline logic
- `pipeline-assets.js` v1.3 — Assets tab
- `pipeline-checklist.js` — Document checklist tab
- `pipeline-documents.js` — Contract/document tab with AI PDF extraction
- `pipeline-calcs.js` — Calculator panel

**⚠️ All three Pipeline embeds are near the 50K Webflow character limit. New CSS/HTML is injected at runtime via JS modules.**

### Lender Directory (`/app/lenders`)

| File | Version | Location | Purpose |
|------|---------|----------|---------|
| Pages_Lenders_Head-CSS | v11.0 | Head CSS | Lender directory styles |
| Pages_Lenders_Main-Page-Code-Embed | v12.2 | Body embed | Lender directory HTML + JS |

### Lender Detail (`/app/lenders/[slug]`)

| File | Version | Location | Purpose |
|------|---------|----------|---------|
| Lender-Detail-Page-Head-CSS | v4.9 | Head CSS | Lender detail styles |
| Lender-Detail-Page-BeforeBody-Embed | v5.12 | Before `</body>` JS | Lender detail logic |

### Loan Search (`/app/loan-search`)

| File | Version | Location | Purpose |
|------|---------|----------|---------|
| Page-NewLoanSearch-HTML-Embed | v7.7 | Body HTML (47K) | Loan search UI |
| LoanSearchPage-BeforeBodyTag | v4.5 | Before `</body>` JS | Loan search initialization |

### Products (`/app/products`)

| File | Version | Location | Purpose |
|------|---------|----------|---------|
| Pages_App_Products_CSS | v2.5 | Head CSS | Products page styles |
| Pages_App_Products_HTML | v2.0 | Body HTML | Products page structure |
| Pages_App_Products_JS | v3.0 | Before `</body>` JS | Products page logic |

### Product Detail (`/app/products/[slug]`)

| File | Version | Location | Purpose |
|------|---------|----------|---------|
| Product-Detail-Page-Head-CSS | v2.0 | Head CSS | Product detail styles |
| Product-Detail-Page-BeforeBody-JS | v2.8 | Before `</body>` JS | Product detail logic |

### Property Types (`/app/property-types`)

| File | Version | Location | Purpose |
|------|---------|----------|---------|
| Pages_App_PropertyTypes_CSS | v1 | Head CSS | Property types styles |
| Pages_App_PropertyTypes_HTML | v1 | Body HTML | Property types structure |
| Pages_App_PropertyTypes_JS | v2.0 | Before `</body>` JS | Property types logic |

### Vendor Directory (`/app/vendors`)

| File | Version | Location | Purpose |
|------|---------|----------|---------|
| Vendors-Page-Head-CSS | v3 | Head CSS | Vendor directory styles |
| Vendors-HTML-Embed | v2 | Body HTML | Vendor directory HTML stub |
| Vendors-Main-Code-Embed | v4.0 | Body embed | Vendor directory full HTML + JS |

### Vendor Detail (`/app/vendors/[slug]`)

| File | Version | Location | Purpose |
|------|---------|----------|---------|
| Vendor-Detail-Page-Head-CSS | v3.7 | Head CSS | Vendor detail styles |
| Vendor-Detail-Page-BeforeBody-Embed | v1.8 | Before `</body>` JS | Vendor detail logic |

### Contacts (`/app/contacts`)

| File | Version | Location | Purpose |
|------|---------|----------|---------|
| Contacts-Page-Head-CSS | v3 | Head CSS | Contacts page styles |
| Contacts-Main-Code-Embed | v4.5 | Body embed | Contacts page HTML + JS |

### Social Media Tool (`/app/social-media`)

| File | Version | Location | Purpose |
|------|---------|----------|---------|
| Pages_App_SocialMedia_Head_CSS | v1.9 | Head CSS | Social media tool styles |
| Pages_App_SocialMedia_HTML_Embed | v1.9 | Body HTML | Social media tool structure |
| Pages_App_SocialMedia_BeforeBody_JS | v1.13 | Before `</body>` JS | Social media tool logic |

### Goal Setting (`/app/goal-setting`)

| File | Version | Location | Purpose |
|------|---------|----------|---------|
| GoalSetting_Page_Head_CSS | v5.0 | Head CSS | Goal setting styles |
| Pages_App_GoalSetting_HTML_Embed | v5.0 | Body HTML | Goal setting structure + JS |

### Credit Reports (`/app/credit-reports`) — NEXA Only

| File | Version | Location | Purpose |
|------|---------|----------|---------|
| Pages_App_CreditReports_HTML_Embed | v1.5 | Body embed | Credit report pricing table |

### Settings (`/app/settings`)

| File | Version | Location | Purpose |
|------|---------|----------|---------|
| Settings_Page_Head_CSS | v1.5 | Head CSS | Settings page styles |
| Settings_Page_HTML_Embed | v2.1 | Body HTML | Settings/profile page structure + JS |

### Admin Hub

| File | Version | Location | Purpose |
|------|---------|----------|---------|
| Admin_Hub_Embed_HTML | v2.4 | Body embed | Admin dashboard for rich@prestonlending.com |

### Referral Program (`/app/referral`)

| File | Version | Location | Purpose |
|------|---------|----------|---------|
| Pages_App_Referral_Head_CSS | v3.1 | Head CSS | Referral page styles |
| Pages_App_Referral_HTML_Embed | v3.1 | Body HTML | Referral program page |

### Tools Page (`/app/tools`)

| File | Version | Location | Purpose |
|------|---------|----------|---------|
| Pages_App_Tools_Embed_HTML | v1.1 | Body embed | Tools hub page |

### MISMO Import

| File | Version | Location | Purpose |
|------|---------|----------|---------|
| Pages_App_MISMOImport_Head_CSS | v1.0 | Head CSS | MISMO import styles |
| Pages_App_MISMOImport_HTML_Embed | v1.0 | Body HTML | MISMO import structure |
| Pages_App_MISMOImport_BeforeBody_JS | v1.0 | Before `</body>` JS | MISMO XML parsing logic |

---

## Calculator Pages (11 total)

All calculators share the Calculator Hub page (`/app/calculators`) and have cloud save/load deployed.

| Calculator | CSS Version | HTML Version | JS Version |
|-----------|------------|-------------|-----------|
| Mortgage Calculator | — | v2.2 (single embed) | — |
| Calculators Hub | v2 | v2.7 | — |
| Refinance | v4.3 | v4.3 | v4.3 |
| Loan Scenario Comparison | v2.0 | v1.0 | v2.0 |
| Affordability | v2.1 | v2.1 | v2.1 |
| Blended Rate | v1.0 | v1.0 | v1.0 |
| Rent vs Buy | v2.2 | v2.2 | v2.2 |
| DSCR | v1.0 | v1.1 | v1.1 |
| VA Entitlement | v1.0 | v1.0 | v1.0 |
| Lender Price Comparison | v2.5 | v2.5 | v2.5 |
| Closing Costs | v2.0 | v2.0 | v2.0 |
| Calculator Breadcrumb | — | v1.0 (single embed) | — |

**NEXA-Specific Calculators:**

| Calculator | CSS Version | HTML Version | JS Version |
|-----------|------------|-------------|-----------|
| NEXA Broker Comp | v2 | v2 | v2 |
| NEXA NonDel Comp | v2.0 | v2.1 | v2.1 |

---

## Outseta Configuration

| Item | Value |
|------|-------|
| Domain | `mtgbroker.outseta.com` |
| LITE Plan UID | `NmdnZg90` |
| PLUS Plan UID | `Dmw8leQ4` |
| PRO Plan UID | `yWobBP9D` |
| JWT Location | `localStorage` → `Outseta.nocode.accessToken` |
| Plan UID Path | `payload['outseta:planUid']` (camelCase) |
| API Auth Header | `Outseta {api_key}:{api_secret}` |
| Admin Email | `rich@prestonlending.com` |

---

## Other Standalone Files

| File | Version | Purpose |
|------|---------|---------|
| manifest.json | — | PWA manifest |
| airtable-property-type-lender-sync.js | — | Airtable automation: syncs property types to lenders |
| render-mode-reference.html | — | Reference for Webflow render modes |

---

## Reference Docs (Keep in Project Knowledge)

These files are stable and rarely change — ideal for project knowledge:

| File | Purpose |
|------|---------|
| `mtg-broker-project-knowledge-v2_15.md` | Master technical documentation |
| `Outseta_Configuration_Reference_20260201_2339.md` | Outseta setup and config details |
| `Outseta_Email_Campaigns_Complete.md` | Email campaign documentation |
| `Make_NEXA_Employee_Access_Automation.md` | Make.com NEXA automation docs |
| `PWA_Installation_Guide.md` | PWA setup instructions |
| `Pricing_Page_INSTALLATION-GUIDE.md` | Pricing page setup guide |
| `R2_Logo_Storage_SETUP_GUIDE.md` | Cloudflare R2 logo storage setup |
| `Settings_Page_SETUP_GUIDE.md` | Settings page setup guide |
| `Pages_App_PropertyTypes_SETUP_GUIDE.md` | Property types page setup guide |
| `mtg-broker-commitments-v1_0.md` | Commitment letter documentation |
| `Lender_Detail_Config_Build_Status.md` | Lender detail page build status |
| `LTV_CLTV_Field_Audit_Summary.md` | LTV/CLTV field audit |
| **This file** (`mtg-broker-architecture-inventory.md`) | Architecture & file inventory |

---

## Key Architecture Patterns

### Pipeline Page Pattern (most complex)
HTML embed + CSS embed + JS Loader embed → JS Loader fetches static JS modules from Cloudflare Worker → modules inject additional CSS/HTML at runtime. This pattern exists because all three Webflow embeds are at ~49K (near the 50K limit).

### Directory Page Pattern (Lenders, Vendors, Contacts)
Head CSS embed hides raw CMS elements → Body embed renders UI via JavaScript → Data from Airtable via Cloudflare Worker API (or CMS for some pages).

### Calculator Pattern
Three embeds per calculator (CSS, HTML, JS) → All have cloud save/load via `mtg-broker-api` Worker → Save uses `calculatorType` key → Load filters by `CALC_TYPE` query param.

### CMS Template Pattern (Lender Detail, Vendor Detail, Product Detail)
Head CSS embed + Before `</body>` JS embed → JS reads hidden CMS data elements → builds rich UI dynamically.

### Deploy Order (always)
Cloudflare Worker → CSS embed → HTML embed → JS Loader → Webflow publish → clear localStorage → hard refresh.

---

## Pending / In Progress

- Feature gating (`feature-gating.js`) — written Jan 26, not yet deployed site-wide
- Vendors page migration from CMS to Worker + Airtable
- Security audit of entire system
- Instructional videos (Loom / Scribe)
- Post-launch calculators: Fix N Flip, Construction Loan, Gift of Equity, Income Calculation, All-in-One
- Supabase migration (longer-term)
- AI semantic search (Pinecone + OpenAI)
- Products page: convert from CMS/Whalesync to Worker-powered

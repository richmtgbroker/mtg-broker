/**
 * Cloudflare Worker — mtg-broker-extras
 * Serves site-wide JS modules loaded by Webflow Site Settings footer code.
 *
 * DEPLOY: Worker named "mtg-broker-extras" in Cloudflare Dashboard
 * URL: mtg-broker-extras.rich-e00.workers.dev
 *
 * Endpoints:
 *   GET /static/site-footer.js      — Core platform JS (Outseta cache, billing, gating)
 *   GET /static/feature-extras.js   — Upgrade CTAs (LITE) + limit pills (PLUS)
 *
 * v3.0 — March 23, 2026
 *   - Added /static/site-footer.js endpoint (Sections 0–6 from Site Settings footer)
 *   - Moved ALL JS out of Webflow Site Settings to stay under 50K char limit
 *   - Added URL routing to serve the correct JS module
 *   - site-footer.js includes global fetch interceptor v3.3 (JWT exp check + header patch)
 *
 * v2.1 — March 22, 2026 (feature-extras.js only, see git history)
 */

const ALLOWED_ORIGINS = [
  /^https:\/\/(www\.)?mtg\.broker$/i,
  /^https:\/\/.*\.webflow\.io$/i,
  /^https:\/\/localhost(?::\d+)?$/i
];

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return { 'Access-Control-Allow-Origin': '*' };
  const ok = ALLOWED_ORIGINS.some(r => r.test(origin));
  if (!ok) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin'
  };
}

function jsResponse(body, request) {
  return new Response(body, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      ...getCorsHeaders(request)
    }
  });
}

function cssResponse(body, request) {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/css; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      ...getCorsHeaders(request)
    }
  });
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...getCorsHeaders(request),
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/static/site-head.css') {
      return cssResponse(SITE_HEAD_CSS, request);
    }

    if (path === '/static/site-head.js') {
      return jsResponse(SITE_HEAD_JS, request);
    }

    if (path === '/static/site-footer.js') {
      return jsResponse(SITE_FOOTER_JS, request);
    }

    if (path === '/static/feature-extras.js') {
      return jsResponse(FEATURE_EXTRAS_JS, request);
    }

    // Default: list available endpoints
    return new Response(JSON.stringify({
      endpoints: [
        'GET /static/site-head.css',
        'GET /static/site-head.js',
        'GET /static/site-footer.js',
        'GET /static/feature-extras.js'
      ]
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request)
      }
    });
  }
};



// ============================================================
// SITE HEAD CSS — Global platform styles
// Previously inline in Webflow Site Settings Head Code
// ============================================================
const SITE_HEAD_CSS = String.raw`
/* ================================================
   1. BASE & LAYOUT FIXES
   ================================================ */

/* Fix: Body height issue causing footer cutoff */
html, body {
  height: auto !important;
  min-height: 100vh !important;
  overflow-x: hidden;
}

/* CSS Variables */
:root {
  --sidebar-width: 260px;
  --sidebar-collapsed-width: 72px;
  --navbar-height: 77px;
}

body {
  background-color: #f8fafc;
}

/* Sticky footer for app pages — pushes footer to bottom
   on short-content pages (like sparse product detail pages).
   Scoped to body.app-page so home/marketing pages are unaffected.
   Navbar & sidebar are position:fixed so flex doesn't affect them. */
body.app-page {
  display: flex;
  flex-direction: column;
}

/* Main content grows to fill remaining space, pushing footer down */
body.app-page .main-content-section {
  flex: 1 0 auto;
}

/* Footer stays at its natural size at the bottom */
body.app-page .mtg-footer,
body.app-page .simple-calc-footer {
  flex-shrink: 0;
}


/* ================================================
   2. APP PAGE NAVBAR
   ================================================ */

/* Navbar - Full width on app pages */
body.app-page .mb-navWrap {
  left: 0 !important;
  right: 0 !important;
  width: 100% !important;
  transition: none;
}

/* Navbar inner content - full width edge to edge */
body.app-page .mb-header {
  width: 100% !important;
  max-width: none !important;
  padding-left: 24px !important;
  padding-right: 24px !important;
}

/* Navbar links container - push to right */
body.app-page .mb-nav {
  margin-left: auto !important;
}

@media (max-width: 991px) {
  body.app-page .mb-header {
    padding-left: 20px !important;
    padding-right: 20px !important;
  }
}


/* ================================================
   3. MAIN CONTENT SECTION
   Used by: Loan Search, Lenders, Products, Vendors, Property Types
   
   UPDATED: Using percentage-based width only (no max-width px constraint)
   so content expands properly on larger screens while staying
   centered with sidebar expanded or collapsed.
   ================================================ */

/* Main content section - fills available space next to sidebar */
body.app-page .main-content-section {
  padding-top: calc(var(--navbar-height) + 20px) !important;
  margin-left: var(--sidebar-width) !important;
  box-sizing: border-box;
}

/* When sidebar is collapsed */
body.app-page.sidebar-collapsed .main-content-section {
  margin-left: var(--sidebar-collapsed-width) !important;
}

/* Inner content - percentage-based width, NO max-width constraint */
.main-content-section > * {
  width: 94%;
  max-width: none !important;
  margin-left: auto !important;
  margin-right: auto !important;
}

/* Fix: Remove top gap on app pages */
body.app-page .mb-navSpacer {
  height: 0 !important;
  display: block !important;
}

/* Mobile: Remove sidebar offset, full width content (UNCHANGED) */
@media (max-width: 991px) {
  .main-content-section {
    margin-left: 0 !important;
  }
  
  .main-content-section > * {
    width: 100%;
    padding-left: 20px;
    padding-right: 20px;
    box-sizing: border-box;
  }
  
  body.app-page .main-content-section {
    margin-left: 0 !important;
    padding-top: calc(var(--navbar-height) + 15px) !important;
  }
}


/* ================================================
   4. APP PAGE CONTENT (HTML Embed pages)
   Used by: Calculators, Dashboard, etc.
   ================================================ */

.app-page-content {
  margin-left: var(--sidebar-width);
  padding-top: calc(var(--navbar-height) + 20px);
  padding-bottom: 40px;
  min-height: calc(100vh - var(--navbar-height));
  transition: margin-left 0.3s ease;
  box-sizing: border-box;
}

body.sidebar-collapsed .app-page-content {
  margin-left: var(--sidebar-collapsed-width);
}

/* App Container - percentage-based width, NO max-width constraint */
.app-container {
  width: 94%;
  max-width: none;
  margin-left: auto;
  margin-right: auto;
}

@media (max-width: 991px) {
  .app-page-content {
    margin-left: 0;
    padding-top: calc(var(--navbar-height) + 15px);
    padding-bottom: 20px;
  }
  
  .app-container {
    width: 100%;
    padding-left: 20px;
    padding-right: 20px;
    box-sizing: border-box;
  }
}


/* ================================================
   5. FOOTER
   ================================================ */

/* App Footer - offset by sidebar on app pages */
body.app-page .simple-calc-footer {
  margin-left: var(--sidebar-width);
  transition: margin-left 0.3s ease;
}

body.app-page.sidebar-collapsed .simple-calc-footer {
  margin-left: var(--sidebar-collapsed-width);
}

/* Main Site Footer - never offset, always full width */
.global-footer {
  margin-left: 0 !important;
  width: 100% !important;
}

/* Ensure footers are always visible */
.mtg-footer,
.simple-calc-footer,
.global-footer {
  position: relative;
  clear: both;
}

@media (max-width: 991px) {
  body.app-page .simple-calc-footer {
    margin-left: 0;
  }
}


/* ================================================
   6. REUSABLE BUTTONS & COMPONENTS
   ================================================ */

/* --- Breadcrumb Trail (Detail Pages) --- */
.breadcrumb-nav {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0;
  font-size: 14px;
  margin-bottom: 16px;
}

.breadcrumb-link-item {
  color: #2563eb;
  text-decoration: none;
  font-weight: 500;
  transition: all 0.2s ease;
}

.breadcrumb-link-item:hover {
  color: #1d4ed8;
  text-decoration: underline;
}

.breadcrumb-separator {
  color: #94a3b8;
  font-weight: 400;
  font-size: 14px;
}

.breadcrumb-current {
  color: #64748b;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

@media (max-width: 768px) {
  .breadcrumb-nav {
    gap: 8px;
    font-size: 13px;
  }
  
  .breadcrumb-current {
    max-width: 180px;
  }
}

/* --- Breadcrumb Link (Old Style - Back Button) --- */
.breadcrumb-link {
  display: inline-flex;
  align-items: center;
  padding: 10px 18px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  color: #475569;
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s ease;
}

.breadcrumb-link:hover { 
  background: #f8fafc;
  border-color: #cbd5e1;
}

/* Breadcrumb wrapper alignment - matches main content width */
.main-content-section > [class*="Breadcrumb"],
.main-content-section > .w-embed:has(.breadcrumb-link),
.main-content-section > .w-embed:has(.breadcrumb-nav) {
  width: 94%;
  max-width: none;
  margin-left: auto;
  margin-right: auto;
  margin-bottom: 16px;
  display: block;
}

/* --- Matrix Button (Primary Action) --- */
.matrix-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: #2563eb;
  border: none;
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s ease;
}

.matrix-btn::after {
  content: "";
  display: inline-block;
  width: 14px;
  height: 14px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14'/%3E%3C/svg%3E");
  background-size: contain;
  background-repeat: no-repeat;
}

.matrix-btn:hover {
  background: #1d4ed8;
}

/* --- Reset Button (Search Clear) --- */
.reset-button {
  background-color: #ffffff;
  color: #2563EB;
  padding: 0 18px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
  transition: all 0.2s ease;
  cursor: pointer;
  border: 1px solid #2563EB;
  box-sizing: border-box;
}

.reset-button:hover {
  background-color: #2563EB;
  color: #ffffff;
  transform: translateY(-1px);
}

.reset-button:active {
  transform: translateY(0px);
  background-color: #1d4ed8;
}

.search-input:placeholder-shown + .reset-button {
  display: none;
}

@media screen and (max-width: 479px) {
  .reset-button {
    padding: 0 12px;
    height: 40px;
    font-size: 13px;
  }
}

/* --- Profile Action Buttons --- */
.profile-actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
  margin-bottom: 24px;
}

.profile-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 22px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: #fff;
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
  transition: all 0.2s ease;
}

.profile-btn:hover {
  background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
  box-shadow: 0 4px 8px rgba(37, 99, 235, 0.3);
  transform: translateY(-1px);
}

.profile-btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 22px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  background: #fff;
  color: #475569;
  border: 1px solid #e2e8f0;
  transition: all 0.2s ease;
}

.profile-btn-secondary:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
  color: #334155;
}

@media (max-width: 768px) {
  .profile-actions {
    justify-content: center;
    margin-bottom: 20px;
  }
  
  .profile-btn, 
  .profile-btn-secondary {
    padding: 10px 24px;
    font-size: 14px;
  }
}


/* ================================================
   7. DETAIL PAGE COMPONENTS
   Used by: Lender Details, Vendor Details, Product Details, etc.
   ================================================ */

/* --- Detail Header (top card with title) --- */
.detail-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16px;
  padding: 24px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  margin-bottom: 16px;
  text-align: left;
}

.detail-logo {
  width: 80px;
  height: 80px;
  min-width: 80px;
  max-width: 80px;
  border-radius: 12px;
  object-fit: contain;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.detail-info {
  display: flex;
  flex-direction: column;
  gap: 0;
  flex: 1;
}

.detail-emphasis {
  font-size: 16px;
  font-weight: 500;
  color: #64748b;
  margin: 0 0 2px;
}

.detail-title {
  font-size: 32px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 2px;
  text-align: left;
}

.detail-subtitle {
  font-size: 16px;
  color: #64748b;
  margin: 0;
}

/* --- Detail Section Container --- */
.detail-section {
  padding: 20px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  margin-bottom: 16px;
}

/* --- Detail Section Title --- */
.detail-section-title {
  margin-top: 0;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e2e8f0;
  color: #0f172a;
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* --- Details List (Key-Value Pairs) --- */
.details-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.details-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid #f1f5f9;
}

.details-row:first-child {
  padding-top: 0;
}

.details-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.details-label {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.details-value {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  text-align: right;
  margin: 0;
}

@media (max-width: 768px) {
  .detail-header {
    flex-direction: column;
    text-align: center;
    padding: 20px 16px;
  }
  
  .detail-logo {
    width: 88px;
    height: 88px;
    min-width: 88px;
    max-width: 88px;
  }
  
  .detail-info {
    align-items: center;
  }
  
  .detail-title {
    font-size: 26px;
    text-align: center;
  }
  
  .details-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .details-value {
    text-align: left;
  }
}


/* ================================================
   8. AE CARDS (Contact Cards)
   Used on: Lender Details, Vendor Details, etc.
   ================================================ */

.ae-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
}

.ae-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  padding: 24px 16px;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
  min-height: 180px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.ae-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #2563eb, #3b82f6);
  opacity: 1;
}

.ae-card:hover {
  background: #f8fafc;
  border-color: #93c5fd;
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.15);
}

.ae-header-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.ae-photo {
  width: 64px;
  height: 64px;
  min-width: 64px;
  border-radius: 12px;
  object-fit: cover;
  background: #f1f5f9;
}

.ae-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.ae-name {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
  line-height: 1.3;
}

.ae-title {
  font-size: 13px;
  color: #64748b;
  margin: 0;
  line-height: 1.3;
}

/* Hide Call/Email buttons (handled by modal) */
.ae-actions {
  display: none;
}

@media (max-width: 768px) {
  .ae-list {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  
  .ae-card {
    padding: 20px 12px;
    min-height: 160px;
  }
  
  .ae-photo {
    width: 56px;
    height: 56px;
    min-width: 56px;
  }
  
  .ae-name {
    font-size: 14px;
  }
  
  .ae-title {
    font-size: 12px;
  }
}


/* ================================================
   9. QUICK LINKS CARDS
   Used on: Lender Details, Vendor Details, etc.
   ================================================ */

.quick-links-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
}

.quick-link-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  text-decoration: none;
  color: #1e293b;
  font-size: 14px;
  font-weight: 600;
  gap: 12px;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  min-height: 180px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.quick-link-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #2563eb, #3b82f6);
  opacity: 1;
}

.quick-link-card:hover {
  background: #f8fafc;
  border-color: #93c5fd;
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.15);
}

.quick-link-icon {
  width: 44px;
  height: 44px;
  padding: 10px;
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  border-radius: 12px;
}

.quick-link-card:hover .quick-link-icon {
  background: linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%);
}

@media (max-width: 768px) {
  .quick-links-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  
  .quick-link-card {
    padding: 20px 12px;
    font-size: 13px;
    min-height: 160px;
  }
  
  .quick-link-icon {
    width: 36px;
    height: 36px;
    padding: 8px;
  }
}


/* ================================================
   10. EMPTY STATE
   ================================================ */

.empty-state-box {
  padding: 24px;
  text-align: center;
  color: #94a3b8;
  font-size: 14px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}


/* ================================================
   11. COLLECTION LIST CARDS
   Used on: Products page, Lender Details, Product Details
   
   Main Page: Uses CSS Grid (horizontal flow)
   Relational Lists: Uses CSS Columns (vertical flow)
   
   Main Page Classes (full-size cards):
   - product-list-wrapper, product-list, product-list-item
   - product-card, product-card-name
   
   Relational List Classes (compact cards on detail pages):
   - lender-list-wrapper, lender-list, lender-list-item
   - lender-card, lender-card-name
   ================================================ */

/* --- List Wrapper --- */
.product-list-wrapper,
.lender-list-wrapper {
  background: transparent;
  border: none;
  border-radius: 0;
  overflow: visible;
  margin-bottom: 0;
}

/* --- Main Products Page: CSS Grid (Horizontal Flow) --- */
.product-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.product-list-item {
  display: flex;
  flex-direction: column;
  border-bottom: none;
}

/* --- Relational Lists: CSS Columns (Vertical Flow) --- */
/* Items flow top-to-bottom, then to next column */
.lender-list,
.detail-section .product-list {
  display: block;
  column-count: 4;
  column-gap: 8px;
}

/* Prevent cards from breaking across columns */
.lender-list-item,
.detail-section .product-list-item {
  display: block;
  break-inside: avoid;
  margin-bottom: 8px;
}

/* --- Main Page Card (Products page) --- */
.product-card {
  background: #ffffff;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  padding: 16px 20px;
  transition: all 0.15s ease;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 60px;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.product-card:hover {
  background: #F8FAFC;
  border-color: #CBD5E1;
  transform: translateX(4px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.product-card:active {
  transform: translateX(2px);
  background: #F1F5F9;
}

.product-card-name { 
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
  flex: 1;
  line-height: 1.4;
}

.product-card::after {
  content: '\203A';
  font-size: 24px;
  color: #94A3B8;
  font-weight: 300;
  margin-left: 12px;
  transition: all 0.15s ease;
}

.product-card:hover::after {
  color: #2563EB;
  transform: translateX(4px);
}

/* --- Compact Relational Card (Detail pages) --- */
/* Used for lender-card everywhere and product-card inside detail-section */
.lender-card,
.detail-section .product-card {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 10px 14px;
  padding-left: 18px; /* Extra padding for left highlight */
  transition: all 0.2s ease;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: auto;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  position: relative;
  overflow: hidden;
}

/* Blue LEFT side highlight */
.lender-card::before,
.detail-section .product-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 4px;
  background: linear-gradient(180deg, #2563eb, #3b82f6);
}

/* Hover: lift up effect */
.lender-card:hover,
.detail-section .product-card:hover {
  background: #f8fafc;
  border-color: #93c5fd;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.15);
}

.lender-card:active,
.detail-section .product-card:active {
  transform: translateY(-1px);
  background: #F1F5F9;
}

/* Compact card name text */
.lender-card-name,
.detail-section .product-card-name { 
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
  flex: 1;
  line-height: 1.3;
}

/* Smaller chevron for compact cards */
.lender-card::after,
.detail-section .product-card::after {
  content: '\203A';
  font-size: 18px;
  color: #94A3B8;
  font-weight: 300;
  margin-left: 8px;
  transition: all 0.15s ease;
}

.lender-card:hover::after,
.detail-section .product-card:hover::after {
  color: #2563EB;
  transform: translateX(2px);
}

/* --- Large Tablet: 3 columns for relational --- */
@media screen and (max-width: 991px) {
  .lender-list,
  .detail-section .product-list {
    column-count: 3;
  }
}

/* --- Tablet Portrait: 2 columns for all --- */
@media screen and (max-width: 768px) {
  .product-list {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .lender-list,
  .detail-section .product-list {
    column-count: 2;
  }
}

/* --- Mobile: Single column --- */
@media screen and (max-width: 479px) {
  .product-list {
    grid-template-columns: 1fr;
    gap: 6px;
  }
  
  .lender-list,
  .detail-section .product-list {
    column-count: 1;
  }
  
  .lender-list-item,
  .detail-section .product-list-item {
    margin-bottom: 6px;
  }
  
  .product-card {
    padding: 14px 16px;
    min-height: 56px;
  }

  .product-card-name { 
    font-size: 14px;
  }
  
  .lender-card,
  .detail-section .product-card {
    padding: 8px 12px;
    padding-left: 16px;
  }
  
  .lender-card-name,
  .detail-section .product-card-name { 
    font-size: 12px;
  }
  
  .lender-card::after,
  .detail-section .product-card::after {
    font-size: 16px;
  }
}


/* ================================================
   12. MOBILE BOTTOM NAVIGATION
   ================================================ */

.mobile-bottom-nav {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #ffffff;
  border-top: 1px solid #e0e0e0;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  padding: 8px 0 max(8px, env(safe-area-inset-bottom));
}

@media (max-width: 991px) {
  .mobile-bottom-nav {
    display: flex;
    justify-content: space-around;
    align-items: center;
  }
  
  body {
    padding-bottom: 70px;
  }
}

.mobile-bottom-nav .nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  color: #666666;
  font-size: 11px;
  font-weight: 500;
  flex: 1;
  padding: 4px 2px;
  transition: all 0.2s ease;
  min-width: 0;
}

.mobile-bottom-nav .nav-item i {
  font-size: 20px;
  margin-bottom: 4px;
  transition: all 0.2s ease;
}

.mobile-bottom-nav .nav-item span {
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.mobile-bottom-nav .nav-item:hover {
  color: #007bff;
}

.mobile-bottom-nav .nav-item:hover i {
  transform: scale(1.1);
}

.mobile-bottom-nav .nav-item.active {
  color: #007bff;
  font-weight: 600;
}

.mobile-bottom-nav .nav-item.active i {
  color: #007bff;
}

@media (max-width: 479px) {
  .mobile-bottom-nav .nav-item {
    font-size: 10px;
  }
  
  .mobile-bottom-nav .nav-item i {
    font-size: 18px;
  }
  
  .mobile-bottom-nav .nav-item span {
    font-size: 9px;
  }
}
`;


// ============================================================
// SITE HEAD JS — Fetch interceptor (retry-on-401)
// Must load in <head> before body scripts capture window.fetch
// ============================================================
const SITE_HEAD_JS = String.raw`
(function() {
  var API = 'https://mtg-broker-api.rich-e00.workers.dev';
  var _f = window.fetch;
  window.fetch = async function(input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf(API) !== 0) return _f.call(this, input, init);
    function patch(i) {
      try {
        var t = localStorage.getItem('Outseta.nocode.accessToken');
        if (t && i && i.headers) {
          i = Object.assign({}, i);
          i.headers = Object.assign({}, i.headers);
          i.headers['Authorization'] = 'Bearer ' + t;
        }
      } catch(e) {}
      return i;
    }
    init = patch(init);
    var resp = await _f.call(this, input, init);
    if (resp.status === 401) {
      for (var r = 0; r < 5; r++) {
        await new Promise(function(ok) { setTimeout(ok, 1000 * (r + 1)); });
        init = patch(init);
        resp = await _f.call(this, input, init);
        if (resp.status !== 401) break;
      }
    }
    return resp;
  };
})();
`;
// ============================================================
// SITE FOOTER JS — Sections 0–6
// Global Outseta cache, fetch interceptor, billing, feature gating
// ============================================================
const SITE_FOOTER_JS = String.raw`
// ============================================================
// mtg.broker — Site Footer JS v3.5
// Served from: /static/site-footer.js via Cloudflare Worker
// Sections 0–6 (previously inline in Webflow Site Settings)
// ============================================================

// ========== SECTION 0: GLOBAL OUTSETA CACHE ==========
(function() {
  'use strict';

  window.OUTSETA_USER_CACHE = null;
  window.OUTSETA_USER_LOADING = null;

  window.getCachedOutsetaUser = async function() {
    if (window.OUTSETA_USER_CACHE !== null) {
      return window.OUTSETA_USER_CACHE;
    }
    if (window.OUTSETA_USER_LOADING !== null) {
      return window.OUTSETA_USER_LOADING;
    }
    if (!window.Outseta || typeof window.Outseta.getUser !== 'function') {
      return null;
    }
    window.OUTSETA_USER_LOADING = window.Outseta.getUser()
      .then(function(user) {
        window.OUTSETA_USER_CACHE = user;
        window.OUTSETA_USER_LOADING = null;
        console.log('✅ Global: Outseta user loaded and cached');
        return user;
      })
      .catch(function(err) {
        window.OUTSETA_USER_LOADING = null;
        console.warn('⚠️ Global: Error loading Outseta user:', err.message);
        return null;
      });
    return window.OUTSETA_USER_LOADING;
  };

  window.clearOutsetaUserCache = function() {
    window.OUTSETA_USER_CACHE = null;
    window.OUTSETA_USER_LOADING = null;
  };

  window.addEventListener('hashchange', function() {
    if (window.location.hash.includes('logout')) {
      window.clearOutsetaUserCache();
    }
  });

  console.log('✅ Global Outseta cache initialized');

  // NOTE: The fetch interceptor (retry-on-401) is in Site Settings HEAD CODE
  // so it runs before any body scripts can capture window.fetch.

})();


// ========== SECTION 1: CARD PROFILE PHOTO FALLBACK ==========
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.ae-photo, .contact-image').forEach(function(img) {
    img.addEventListener('error', function() {
      var card = this.closest('.ae-card, .lender_card, .contact-card, [class*="contact"]');
      var name = card ? (
        card.getAttribute('data-contact-name') ||
        (card.querySelector('.ae-name, .contact-name-class, [class*="name"]') || {}).textContent
      ) : 'User';
      this.src = 'https://ui-avatars.com/api/?background=random&size=256&name=' + encodeURIComponent(name || 'User');
    });
    if (!img.src || img.src === window.location.href || img.src.endsWith('/')) {
      var card = img.closest('.ae-card, .lender_card, .contact-card, [class*="contact"]');
      var name = card ? (
        card.getAttribute('data-contact-name') ||
        (card.querySelector('.ae-name, .contact-name-class, [class*="name"]') || {}).textContent
      ) : 'User';
      img.src = 'https://ui-avatars.com/api/?background=random&size=256&name=' + encodeURIComponent(name || 'User');
    }
  });
});


// ========== SECTION 3: NEXA EMPLOYEE ACCESS ==========
(function() {
  async function checkNexaAccess() {
    if (typeof window.getCachedOutsetaUser !== 'function') {
      setTimeout(checkNexaAccess, 200);
      return;
    }
    try {
      var user = await window.getCachedOutsetaUser();
      if (user && user.NexaAccess === 'true') {
        document.querySelectorAll('.nexa-only').forEach(function(el) {
          var currentDisplay = el.style.getPropertyValue('display');
          if (currentDisplay && currentDisplay !== 'none') return;
          el.style.setProperty('display', 'block', 'important');
        });
      }
    } catch (err) {}
  }
  document.addEventListener('DOMContentLoaded', checkNexaAccess);
})();


// ========== SECTION 4: YBUG BUG REPORTING ==========
(function() {
  window.ybug_settings = { id: 'rp6gm9qcm7g7qvw2vkb2' };

  async function addUserToYbug() {
    if (typeof window.getCachedOutsetaUser !== 'function') return;
    try {
      var user = await window.getCachedOutsetaUser();
      if (user) {
        window.ybug_settings.user = {
          email: user.Email || '',
          name: user.FullName || ''
        };
      }
    } catch (err) {}
  }

  setTimeout(addUserToYbug, 1000);

  var ybug = document.createElement('script');
  ybug.type = 'text/javascript';
  ybug.async = true;
  ybug.src = 'https://widget.ybug.io/button/' + window.ybug_settings.id + '.js';
  var s = document.getElementsByTagName('script')[0];
  s.parentNode.insertBefore(ybug, s);
})();


// ========== SECTION 5: BILLING SYSTEM - CORE ==========
(function() {
  'use strict';

  var API_BASE = 'https://mtg-broker-api.rich-e00.workers.dev';

  var PLAN_UIDS = {
    LITE: 'NmdnZg90',
    PLUS: 'Dmw8leQ4',
    PRO: 'yWobBP9D'
  };

  async function getUserEmail() {
    if (typeof window.getCachedOutsetaUser !== 'function') return null;
    try {
      var user = await window.getCachedOutsetaUser();
      return user ? (user.Email || null) : null;
    } catch (err) { return null; }
  }

  async function getUserPlan() {
    if (typeof window.getCachedOutsetaUser !== 'function') return 'LITE';
    try {
      var user = await window.getCachedOutsetaUser();
      if (user && user.Account && user.Account.CurrentSubscription &&
          user.Account.CurrentSubscription.Plan && user.Account.CurrentSubscription.Plan.Uid) {
        var planUid = user.Account.CurrentSubscription.Plan.Uid;
        if (planUid === PLAN_UIDS.PRO) return 'PRO';
        if (planUid === PLAN_UIDS.PLUS) return 'PLUS';
        if (planUid === PLAN_UIDS.LITE) return 'LITE';
      }
      return 'LITE';
    } catch (err) { return 'LITE'; }
  }

  function getAccessToken() {
    try { return localStorage.getItem('Outseta.nocode.accessToken') || null; }
    catch (e) { return null; }
  }

  async function apiRequest(endpoint, method, body) {
    method = method || 'GET';
    if (typeof window.getCachedOutsetaUser === 'function') {
      await window.getCachedOutsetaUser();
    }
    var token = getAccessToken();
    if (!token) throw new Error('User not logged in');

    var options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      }
    };
    if (body) options.body = JSON.stringify(body);

    var response = await fetch(API_BASE + endpoint, options);
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || 'API request failed');
    return data;
  }

  async function checkPlanLimit(action, params) {
    params = params || {};
    try {
      var endpoint = '/api/plan-limits?action=' + encodeURIComponent(action);
      Object.keys(params).forEach(function(key) {
        endpoint += '&' + key + '=' + encodeURIComponent(params[key]);
      });
      return await apiRequest(endpoint);
    } catch (err) {
      console.error('Error checking plan limits:', err);
      return { allowed: false, reason: 'Error checking limits' };
    }
  }

  async function getUsage() {
    try { return (await apiRequest('/api/usage')).usage; }
    catch (err) { return null; }
  }

  async function updateUsage(updates) {
    try { return (await apiRequest('/api/usage', 'PUT', updates)).usage; }
    catch (err) { return null; }
  }

  // -- Upgrade Modal --
  function showUpgradeModal(reason, recommendedPlan) {
    recommendedPlan = recommendedPlan || 'PLUS';
    var existing = document.getElementById('upgrade-modal');
    if (existing) existing.remove();

    var BULLET_MAP = {
      'Pipeline tracking is available on PLUS and PRO plans.': [
        { icon: 'fa-chart-line', text: 'Track up to 25 active loans \u2014 PLUS plan' },
        { icon: 'fa-infinity', text: 'Unlimited pipeline loans \u2014 PRO plan' },
        { icon: 'fa-columns', text: 'Kanban board + table view included' }
      ],
      'Pipeline tracking is available on PLUS and PRO plans. Track up to 25 active loans on PLUS, or unlimited on PRO.': [
        { icon: 'fa-chart-line', text: 'Track up to 25 active loans \u2014 PLUS plan' },
        { icon: 'fa-infinity', text: 'Unlimited pipeline loans \u2014 PRO plan' },
        { icon: 'fa-columns', text: 'Kanban board + table view included' }
      ],
      'Export your pipeline to CSV or Excel with a PRO plan.': [
        { icon: 'fa-file-csv', text: 'Export pipeline to CSV and Excel files' },
        { icon: 'fa-plug', text: 'Integrate with your CRM or workflow tools' },
        { icon: 'fa-infinity', text: 'Unlimited pipeline loan tracking included' }
      ],
      'Advanced calculators are available on PLUS and PRO plans.': [
        { icon: 'fa-calculator', text: 'Loan Scenario Comparison, Rent vs Buy, Lender Pricing & Closing Costs' },
        { icon: 'fa-cloud', text: '10 cloud-saved scenarios per calculator \u2014 PLUS' },
        { icon: 'fa-print', text: 'Print any calculator to a professional PDF' }
      ],
      'Print calculator results to PDF with a PLUS or PRO plan.': [
        { icon: 'fa-print', text: 'Print any calculator to a professional PDF' },
        { icon: 'fa-cloud-arrow-up', text: 'Save up to 10 scenarios per calculator \u2014 PLUS' },
        { icon: 'fa-infinity', text: 'Unlimited saved scenarios \u2014 PRO plan' }
      ],
      'Save calculator scenarios with a PLUS or PRO plan.': [
        { icon: 'fa-cloud-arrow-up', text: 'Save and reload calculator setups anytime' },
        { icon: 'fa-list', text: '10 saves per calculator \u2014 PLUS plan' },
        { icon: 'fa-infinity', text: 'Unlimited saved scenarios \u2014 PRO plan' }
      ],
      'View detailed loan product information with a PLUS or PRO plan.': [
        { icon: 'fa-file-lines', text: 'Full loan specs, rates, and requirements' },
        { icon: 'fa-arrow-up-right-from-square', text: 'Direct links to lender guidelines and matrices' },
        { icon: 'fa-envelope', text: 'Contact lenders directly from search results' }
      ]
    };

    var DEFAULT_BULLETS = [
      { icon: 'fa-chart-line', text: 'Pipeline tracking (25 loans on PLUS, unlimited on PRO)' },
      { icon: 'fa-calculator', text: 'All 14+ calculators including advanced tools' },
      { icon: 'fa-cloud-arrow-up', text: 'Cloud-saved scenarios + print to PDF' }
    ];

    var bullets = BULLET_MAP[reason] || DEFAULT_BULLETS;
    var isPro = (recommendedPlan === 'PRO');
    var planLabel = isPro ? 'PRO' : 'PLUS';
    var planPrice = isPro ? '$79/month' : '$49/month';

    var bulletsHTML = bullets.map(function(b) {
      return '<div style="display:flex;align-items:flex-start;gap:10px;">' +
        '<span style="flex-shrink:0;width:30px;height:30px;background:#EFF6FF;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#2563EB;font-size:13px;">' +
          '<i class="fa-solid ' + b.icon + '"></i>' +
        '</span>' +
        '<span style="font-size:14px;color:#1E234C;line-height:1.5;padding-top:5px;">' + b.text + '</span>' +
      '</div>';
    }).join('');

    var modalHTML =
      '<div id="upgrade-modal" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,0.75);display:flex;align-items:center;justify-content:center;z-index:10000;padding:20px;box-sizing:border-box;backdrop-filter:blur(4px);">' +
        '<div style="background:white;border-radius:16px;max-width:520px;width:100%;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.3);font-family:Host Grotesk,system-ui,sans-serif;">' +
          '<div style="background:linear-gradient(135deg,#1E40AF 0%,#2563EB 60%,#3B82F6 100%);padding:28px 28px 22px;text-align:center;position:relative;">' +
            '<button id="upgrade-modal-close" style="position:absolute;top:12px;right:14px;background:rgba(255,255,255,0.2);border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;color:white;font-size:18px;display:flex;align-items:center;justify-content:center;">&times;</button>' +
            '<div style="width:56px;height:56px;margin:0 auto 14px;background:rgba(255,255,255,0.2);border-radius:14px;display:flex;align-items:center;justify-content:center;">' +
              '<i class="fa-solid fa-bolt" style="font-size:26px;color:white;"></i>' +
            '</div>' +
            '<h2 style="font-size:22px;font-weight:700;color:white;margin:0 0 4px;">Upgrade to ' + planLabel + '</h2>' +
            '<p style="font-size:13px;color:rgba(255,255,255,0.8);margin:0;">' + planPrice + ' &mdash; 7-day free trial, cancel anytime</p>' +
          '</div>' +
          '<div style="padding:22px 24px 24px;">' +
            '<p style="font-size:14px;color:#64748b;margin:0 0 16px;line-height:1.5;">' + (reason || 'Upgrade your plan to unlock this feature.') + '</p>' +
            '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:22px;">' + bulletsHTML + '</div>' +
            '<div style="display:flex;gap:10px;">' +
              '<button id="upgrade-modal-cancel" style="flex:1;padding:11px;background:#F1F5F9;border:none;border-radius:8px;font-size:14px;font-weight:600;color:#64748b;cursor:pointer;font-family:inherit;">Maybe Later</button>' +
              '<button id="upgrade-modal-confirm" style="flex:2;padding:11px;background:linear-gradient(135deg,#2563EB 0%,#1D4ED8 100%);border:none;border-radius:8px;font-size:14px;font-weight:700;color:white;cursor:pointer;font-family:inherit;box-shadow:0 4px 12px rgba(37,99,235,0.3);">Upgrade to ' + planLabel + ' &rarr;</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.style.overflow = 'hidden';

    var closeModal = function() {
      var m = document.getElementById('upgrade-modal');
      if (m) m.remove();
      document.body.style.overflow = '';
    };

    var closeBtn = document.getElementById('upgrade-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    var cancelBtn = document.getElementById('upgrade-modal-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    var confirmBtn = document.getElementById('upgrade-modal-confirm');
    if (confirmBtn) confirmBtn.addEventListener('click', function() {
      closeModal();
      openOutsetaPlanPicker();
    });
    var overlay = document.getElementById('upgrade-modal');
    if (overlay) overlay.addEventListener('click', function(e) {
      if (e.target.id === 'upgrade-modal') closeModal();
    });
  }

  // -- Init billing --
  async function initBillingSystem() {
    try {
      var attempts = 0;
      while (attempts < 30 && typeof window.getCachedOutsetaUser !== 'function') {
        await new Promise(function(r) { setTimeout(r, 100); });
        attempts++;
      }
      if (typeof window.getCachedOutsetaUser !== 'function') {
        window.MTG_Billing.state = 'error';
        return;
      }
      console.log('✅ MTG Billing Core loaded (uses global cache)');
      window.MTG_Billing.state = 'ready';
      console.log('✅ Billing system ready!');

      var userEmail = await getUserEmail();
      if (userEmail) {
        getUserPlan().then(async function(actualPlan) {
          await updateUsage({ currentPlan: actualPlan });
          console.log('✅ User plan synced:', actualPlan);
        }).catch(function() {});
      }
    } catch (err) {
      window.MTG_Billing.state = 'error';
    }
  }

  function openOutsetaPlanPicker() {
    var toast = document.createElement('div');
    toast.textContent = 'Opening plan options...';
    toast.style.cssText = 'position:fixed;bottom:32px;left:50%;transform:translateX(-50%);background:#1E234C;color:white;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;font-family:Host Grotesk,system-ui,sans-serif;z-index:10001;box-shadow:0 4px 12px rgba(0,0,0,0.2);transition:opacity 0.3s ease;';
    document.body.appendChild(toast);

    function removeToast() {
      if (toast.parentNode) {
        toast.style.opacity = '0';
        setTimeout(function() { toast.remove(); }, 300);
      }
    }

    var attempts = 0;
    var poller = setInterval(function() {
      attempts++;
      try {
        if (typeof Outseta !== 'undefined' && typeof Outseta.showProfile === 'function') {
          clearInterval(poller);
          removeToast();
          Outseta.showProfile({ tab: 'plan' });
          return;
        }
      } catch (e) {}
      if (attempts >= 50) {
        clearInterval(poller);
        removeToast();
        window.location.href = '/pricing';
      }
    }, 100);
  }

  window.MTG_Billing = {
    getUserEmail: getUserEmail,
    getUserPlan: getUserPlan,
    apiRequest: apiRequest,
    checkPlanLimit: checkPlanLimit,
    getUsage: getUsage,
    updateUsage: updateUsage,
    showUpgradeModal: showUpgradeModal,
    openOutsetaPlanPicker: openOutsetaPlanPicker,
    PLAN_UIDS: PLAN_UIDS,
    state: 'initializing'
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBillingSystem);
  } else {
    initBillingSystem();
  }
})();


// ========== SECTION 6: FEATURE GATING SYSTEM v2.0 ==========
(function() {
  'use strict';

  if (!window.MTG_Billing) return;

  var cachedPlan = null;
  var gatedElements = new WeakSet();

  var PAGE_GATES = {
    '/app/pipeline': {
      allowedPlans: ['PLUS', 'PRO'],
      title: 'Upgrade to PLUS',
      message: 'Pipeline tracking is available on PLUS and PRO plans. Track up to 25 active loans on PLUS, or unlimited on PRO.',
      icon: 'fa-chart-line',
      recommendedPlan: 'PLUS'
    }
  };

  var ADVANCED_CALC_SLUGS = ['loan-scenario-compare', 'rent-vs-buy', 'lender-pricing', 'closing-costs'];
  var CALC_PRINT_SELECTOR = '.btn-print';
  var CALC_SAVE_SELECTOR = '.btn-save';
  var CALC_LOAD_SELECTOR = '.btn-load';
  var CALCULATOR_PAGES = ['/app/calc-mortgage', '/app/refi-analysis', '/app/affordability', '/app/blended-rate', '/app/dscr', '/app/va-entitlement'];

  function showPageBlockOverlay(config) {
    var overlay = document.createElement('div');
    overlay.id = 'feature-gate-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,255,255,0.98);backdrop-filter:blur(10px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML =
      '<div style="text-align:center;max-width:500px;">' +
        '<div style="width:80px;height:80px;margin:0 auto 24px;background:linear-gradient(135deg,#DBEAFE 0%,#2563EB 100%);border-radius:50%;display:flex;align-items:center;justify-content:center;">' +
          '<i class="fa-solid ' + (config.icon || 'fa-lock') + '" style="font-size:36px;color:white;"></i>' +
        '</div>' +
        '<h2 style="font-size:28px;font-weight:700;color:#1E234C;margin:0 0 12px;font-family:Host Grotesk,system-ui,sans-serif;">' + (config.title || 'Upgrade Required') + '</h2>' +
        '<p style="font-size:17px;color:#64748b;margin:0 0 32px;line-height:1.6;font-family:Host Grotesk,system-ui,sans-serif;">' + (config.message || 'This feature requires an upgraded plan.') + '</p>' +
        '<button id="page-gate-upgrade-btn" style="padding:14px 36px;background:linear-gradient(135deg,#2563EB 0%,#1D4ED8 100%);color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;box-shadow:0 4px 14px rgba(37,99,235,0.35);font-family:Host Grotesk,system-ui,sans-serif;">Upgrade Now</button>' +
        '<br><a href="/app/dashboard" style="display:inline-block;margin-top:16px;color:#64748b;text-decoration:none;font-size:14px;font-family:Host Grotesk,system-ui,sans-serif;">&larr; Back to Dashboard</a>' +
      '</div>';
    document.body.appendChild(overlay);
    var btn = document.getElementById('page-gate-upgrade-btn');
    if (btn) btn.addEventListener('click', function() { window.MTG_Billing.openOutsetaPlanPicker(); });
  }

  async function checkPageGates(userPlan) {
    var path = window.location.pathname.toLowerCase();
    for (var gatePath in PAGE_GATES) {
      if (path === gatePath || path === gatePath + '/') {
        if (!PAGE_GATES[gatePath].allowedPlans.includes(userPlan)) {
          showPageBlockOverlay(PAGE_GATES[gatePath]);
          return true;
        }
      }
    }
    var isAdvancedCalc = ADVANCED_CALC_SLUGS.some(function(s) { return path.includes(s); });
    if (isAdvancedCalc && userPlan !== 'PLUS' && userPlan !== 'PRO') {
      showPageBlockOverlay({ allowedPlans: ['PLUS','PRO'], title: 'Upgrade to PLUS', message: 'Advanced calculators are available on PLUS and PRO plans.', icon: 'fa-calculator', recommendedPlan: 'PLUS' });
      return true;
    }
    return false;
  }

  function gateCalcButtons() {
    function gateButton(btn, message) {
      if (gatedElements.has(btn)) return;
      gatedElements.add(btn);
      btn.style.opacity = '0.55';
      btn.style.cursor = 'not-allowed';
      btn.style.position = 'relative';
      var badge = document.createElement('span');
      badge.innerHTML = '<i class="fa-solid fa-lock" style="font-size:9px;"></i>';
      badge.style.cssText = 'position:absolute;top:-4px;right:-4px;width:18px;height:18px;background:linear-gradient(135deg,#FDE68A 0%,#F59E0B 100%);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,0.2);z-index:10;pointer-events:none;';
      btn.appendChild(badge);
      btn.removeAttribute('onclick');
      btn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        window.MTG_Billing.showUpgradeModal(message, 'PLUS');
      }, true);
    }
    document.querySelectorAll(CALC_PRINT_SELECTOR).forEach(function(b) { gateButton(b, 'Print calculator results to PDF with a PLUS or PRO plan.'); });
    document.querySelectorAll(CALC_SAVE_SELECTOR).forEach(function(b) { gateButton(b, 'Save calculator scenarios with a PLUS or PRO plan.'); });
    document.querySelectorAll(CALC_LOAD_SELECTOR).forEach(function(b) { gateButton(b, 'Save and load calculator scenarios with a PLUS or PRO plan.'); });
  }

  function applyElementGating() {
    var path = window.location.pathname.toLowerCase();
    if (CALCULATOR_PAGES.some(function(p) { return path.startsWith(p); })) gateCalcButtons();
  }

  var gatingTimeout = null;
  function startGatingObserver() {
    var observer = new MutationObserver(function() {
      if (gatingTimeout) clearTimeout(gatingTimeout);
      gatingTimeout = setTimeout(applyElementGating, 150);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function interceptLoanSearchRows() {
    var path = window.location.pathname.toLowerCase();
    if (!path.includes('/app/loan-search') && !path.includes('/app/products')) return;
    document.addEventListener('click', function(e) {
      if (!cachedPlan || cachedPlan === 'PLUS' || cachedPlan === 'PRO') return;
      var row = e.target.closest('.loan-table-row');
      if (!row || e.target.closest('a[href]')) return;
      e.stopImmediatePropagation(); e.preventDefault();
      window.MTG_Billing.showUpgradeModal('View detailed loan product information with a PLUS or PRO plan.', 'PLUS');
    }, true);
  }

  function interceptPipelineAddLoan() {
    var path = window.location.pathname.toLowerCase();
    if (path !== '/app/pipeline' && path !== '/app/pipeline/') return;
    var attempts = 0;
    var ci = setInterval(function() {
      attempts++;
      if (window.openNewLoanModal && !window._originalOpenNewLoanModal) {
        clearInterval(ci);
        window._originalOpenNewLoanModal = window.openNewLoanModal;
        window.openNewLoanModal = async function() {
          try {
            var lc = await window.MTG_Billing.checkPlanLimit('add-pipeline-loan');
            if (lc.allowed) { window._originalOpenNewLoanModal(); }
            else { window.MTG_Billing.showUpgradeModal(lc.reason || 'Pipeline loan limit reached.', (cachedPlan === 'PLUS') ? 'PRO' : 'PLUS'); }
          } catch (err) { window._originalOpenNewLoanModal(); }
        };
      }
      if (attempts > 100) clearInterval(ci);
    }, 100);
  }

  var FEATURE_PLANS = {
    'pipeline': ['PLUS','PRO'], 'pipeline-export': ['PRO'], 'advanced-calc': ['PLUS','PRO'],
    'print-pdf': ['PLUS','PRO'], 'save-scenario': ['PLUS','PRO'], 'load-scenario': ['PLUS','PRO'],
    'loan-search-details': ['PLUS','PRO']
  };
  var FEATURE_MESSAGES = {
    'pipeline': 'Pipeline tracking is available on PLUS and PRO plans.',
    'pipeline-export': 'Export your pipeline to CSV or Excel with a PRO plan.',
    'advanced-calc': 'Advanced calculators are available on PLUS and PRO plans.',
    'print-pdf': 'Print calculator results to PDF with a PLUS or PRO plan.',
    'save-scenario': 'Save calculator scenarios with a PLUS or PRO plan.',
    'load-scenario': 'Save and load calculator scenarios with a PLUS or PRO plan.',
    'loan-search-details': 'View detailed loan product information with a PLUS or PRO plan.'
  };
  var FEATURE_REC_PLAN = { 'pipeline-export': 'PRO' };

  window.MTG_Billing.canAccessFeature = async function(feature) {
    var userPlan = cachedPlan || (await window.MTG_Billing.getUserPlan());
    var ap = FEATURE_PLANS[feature];
    if (!ap) return { allowed: true, plan: userPlan };
    return { allowed: ap.includes(userPlan), plan: userPlan };
  };

  window.MTG_Billing.gateAction = async function(feature, callback) {
    var result = await window.MTG_Billing.canAccessFeature(feature);
    if (result.allowed) { if (typeof callback === 'function') callback(); return true; }
    window.MTG_Billing.showUpgradeModal(FEATURE_MESSAGES[feature] || 'This feature requires an upgraded plan.', FEATURE_REC_PLAN[feature] || 'PLUS');
    return false;
  };

  window.MTG_Billing.getCachedPlan = function() { return cachedPlan; };

  async function initialize() {
    var attempts = 0;
    while (attempts < 50 && window.MTG_Billing.state !== 'ready') {
      await new Promise(function(r) { setTimeout(r, 100); });
      attempts++;
    }
    if (window.MTG_Billing.state !== 'ready') return;

    cachedPlan = await window.MTG_Billing.getUserPlan();
    console.log('\uD83D\uDD10 Feature Gating v2: User plan = ' + cachedPlan);

    if (cachedPlan === 'PRO') { console.log('✅ Feature Gating v2: PRO user \u2014 all features unlocked'); return; }
    if (cachedPlan === 'PLUS') { interceptPipelineAddLoan(); return; }

    var pageBlocked = await checkPageGates(cachedPlan);
    if (pageBlocked) return;
    applyElementGating();
    startGatingObserver();
    interceptLoanSearchRows();
    interceptPipelineAddLoan();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
`;


// ============================================================
// FEATURE EXTRAS JS — Sections 7–8
// Upgrade CTAs for LITE users + limit indicators for PLUS users
// ============================================================
const FEATURE_EXTRAS_JS = String.raw`
// ============================================================
// SECTION 7: UPGRADE CTAs FOR LITE USERS
// ============================================================
(function() {
  'use strict';

  var css = document.createElement('style');
  css.textContent = [
    '.mtg-ubanner{display:flex;align-items:center;gap:14px;background:linear-gradient(135deg,#EFF6FF 0%,#DBEAFE 100%);border:1px solid #BFDBFE;border-radius:12px;padding:16px 18px;margin-bottom:20px;font-family:Host Grotesk,system-ui,sans-serif;position:relative;box-sizing:border-box;}',
    '.mtg-ubanner .ub-icon{flex-shrink:0;width:40px;height:40px;background:linear-gradient(135deg,#2563EB 0%,#1D4ED8 100%);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:17px;}',
    '.mtg-ubanner .ub-body{flex:1;min-width:0;}',
    '.mtg-ubanner .ub-title{font-size:14px;font-weight:700;color:#1E234C;margin:0 0 2px;}',
    '.mtg-ubanner .ub-text{font-size:13px;color:#64748b;margin:0;line-height:1.4;}',
    '.mtg-ubanner .ub-btn{flex-shrink:0;padding:9px 18px;background:linear-gradient(135deg,#2563EB 0%,#1D4ED8 100%);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;transition:transform .15s,box-shadow .15s;box-shadow:0 2px 8px rgba(37,99,235,.25);}',
    '.mtg-ubanner .ub-btn:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(37,99,235,.35);}',
    '.mtg-ubanner .ub-dismiss{position:absolute;top:8px;right:10px;background:none;border:none;font-size:18px;color:#94a3b8;cursor:pointer;line-height:1;padding:2px 4px;}',
    '.mtg-ubanner .ub-dismiss:hover{color:#475569;}',
    '.mtg-ubanner-hero{background:linear-gradient(135deg,#1E3A5F 0%,#1E234C 100%) !important;border:none !important;border-radius:14px !important;padding:22px 20px !important;}',
    '.mtg-ubanner-hero .ub-icon{background:rgba(255,255,255,.18) !important;}',
    '.mtg-ubanner-hero .ub-title{font-size:16px !important;color:#fff !important;}',
    '.mtg-ubanner-hero .ub-text{color:#94A3B8 !important;}',
    '.mtg-ubanner-hero .ub-btn{font-size:14px;padding:10px 20px;}',
    '.mtg-ubanner-hero .ub-dismiss{color:rgba(255,255,255,.4);}',
    '.mtg-ubanner-hero .ub-dismiss:hover{color:rgba(255,255,255,.7);}',
    '.mtg-sprompt{text-align:center;padding:24px 16px;font-family:Host Grotesk,system-ui,sans-serif;}',
    '.mtg-sprompt .sp-icon{font-size:24px;color:#CBD5E1;margin-bottom:6px;}',
    '.mtg-sprompt .sp-title{font-size:13px;font-weight:600;color:#64748b;margin:0 0 4px;}',
    '.mtg-sprompt .sp-text{font-size:12px;color:#94A3B8;margin:0 0 10px;line-height:1.4;}',
    '.mtg-sprompt .sp-btn{display:inline-block;padding:7px 16px;background:#2563EB;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;}',
    '@media(max-width:600px){.mtg-ubanner{flex-wrap:wrap;}.mtg-ubanner .ub-btn{width:100%;}}'
  ].join('');
  document.head.appendChild(css);

  function makeBanner(opts) {
    var el = document.createElement('div');
    el.className = 'mtg-ubanner' + (opts.hero ? ' mtg-ubanner-hero' : '');
    el.innerHTML =
      (opts.dismissible ? '<button class="ub-dismiss" aria-label="Dismiss">\xd7</button>' : '') +
      '<div class="ub-icon"><i class="fa-solid ' + opts.icon + '"></i></div>' +
      '<div class="ub-body"><p class="ub-title">' + opts.title + '</p><p class="ub-text">' + opts.text + '</p></div>' +
      '<button class="ub-btn">' + (opts.btnText || 'Upgrade Now') + '</button>';
    el.querySelector('.ub-btn').addEventListener('click', function() {
      if (window.MTG_Billing && window.MTG_Billing.openOutsetaPlanPicker) window.MTG_Billing.openOutsetaPlanPicker();
    });
    if (opts.dismissible) {
      var key = opts.dismissKey || 'mtg_cta_dismissed';
      el.querySelector('.ub-dismiss').addEventListener('click', function() {
        el.remove();
        try { sessionStorage.setItem(key, '1'); } catch(e) {}
      });
    }
    return el;
  }

  function makePrompt(opts) {
    var el = document.createElement('div');
    el.className = 'mtg-sprompt';
    el.innerHTML =
      '<div class="sp-icon"><i class="fa-solid ' + opts.icon + '"></i></div>' +
      '<p class="sp-title">' + opts.title + '</p><p class="sp-text">' + opts.text + '</p>' +
      '<button class="sp-btn">' + (opts.btnText || 'Upgrade') + '</button>';
    el.querySelector('.sp-btn').addEventListener('click', function() {
      if (window.MTG_Billing && window.MTG_Billing.openOutsetaPlanPicker) window.MTG_Billing.openOutsetaPlanPicker();
    });
    return el;
  }

  function prependTo(selectorList, child) {
    for (var i = 0; i < selectorList.length; i++) {
      var el = document.querySelector(selectorList[i]);
      if (el) { el.insertBefore(child, el.firstChild); return true; }
    }
    return false;
  }

  function addDashboardCTAs() {
    var path = window.location.pathname.toLowerCase();
    if (path !== '/app/dashboard' && path !== '/app/dashboard/') return;
    if (sessionStorage.getItem('mtg_dash_cta_dismissed')) return;
    setTimeout(function() {
      var hero = makeBanner({ hero: true, icon: 'fa-rocket', title: 'Unlock the full mtg.broker toolkit', text: 'Upgrade to PLUS for Pipeline tracking, all 14+ calculators, cloud-saved scenarios, and PDF export — or go PRO for unlimited everything.', btnText: 'See Plans & Pricing', dismissible: true, dismissKey: 'mtg_dash_cta_dismissed' });
      var inserted = prependTo(['.main-content-area','.dash-content','.dash-main','.dashboard-content','.app-page-content','.main-content-section > div'], hero);
      if (!inserted) { var main = document.querySelector('main, .main-content-section, [class*="main"]'); if (main) main.insertBefore(hero, main.firstChild); }
      var pw = document.querySelector('.pipeline-stats-grid, .pipeline-summary, .pipeline-widget, #pipeline-stats, [data-widget="pipeline"]');
      if (pw && !pw.querySelector('.mtg-sprompt')) { pw.innerHTML = ''; pw.appendChild(makePrompt({ icon: 'fa-chart-line', title: 'Pipeline — PLUS & PRO', text: 'Track your loans from lead to close.', btnText: 'Unlock Pipeline' })); }
      var sw = document.querySelector('#scenarios-list, .scenarios-list, .saved-scenarios, [data-widget="scenarios"]');
      if (sw && !sw.querySelector('.mtg-sprompt')) { sw.innerHTML = ''; sw.appendChild(makePrompt({ icon: 'fa-cloud-arrow-up', title: 'Saved Scenarios — PLUS & PRO', text: 'Save and reload calculator setups anytime.', btnText: 'Unlock Saves' })); }
    }, 700);
  }

  function addLoanSearchCTA() {
    var path = window.location.pathname.toLowerCase();
    if (!path.startsWith('/app/loan-search')) return;
    setTimeout(function() {
      var banner = makeBanner({ icon: 'fa-magnifying-glass-dollar', title: 'See full loan details with PLUS or PRO', text: 'Click any product row to view complete specs, rates, and guidelines.', btnText: 'Upgrade' });
      prependTo(['.loan-search-controls','.loan-search-layout','.loan-search-main','.search-controls','#loan-search-app','.app-page-content'], banner);
    }, 700);
  }

  async function initialize() {
    for (var i = 0; i < 60; i++) {
      if (window.MTG_Billing && window.MTG_Billing.state === 'ready') break;
      await new Promise(function(r) { setTimeout(r, 100); });
    }
    if (!window.MTG_Billing || window.MTG_Billing.state !== 'ready') return;
    var plan = await window.MTG_Billing.getUserPlan();
    if (plan !== 'LITE') return;
    var path = window.location.pathname.toLowerCase();
    if (path === '/app/dashboard' || path === '/app/dashboard/') addDashboardCTAs();
    if (path.startsWith('/app/loan-search')) addLoanSearchCTA();
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initialize); }
  else { initialize(); }
})();


// ============================================================
// SECTION 8: LIMIT INDICATORS (PLUS USERS ONLY)
// ============================================================
(function() {
  'use strict';
  var css = document.createElement('style');
  css.textContent = [
    '.mtg-lpill{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;font-family:Host Grotesk,system-ui,sans-serif;white-space:nowrap;line-height:1;vertical-align:middle;}',
    '.mtg-lpill i{font-size:10px;}',
    '.mtg-pill-ok{background:#F0FDF4;color:#15803D;border:1px solid #BBF7D0;}',
    '.mtg-pill-warn{background:#FFFBEB;color:#B45309;border:1px solid #FDE68A;}',
    '.mtg-pill-full{background:#FEF2F2;color:#DC2626;border:1px solid #FECACA;}',
    '.mtg-pill-upgrade{font-size:12px;font-weight:600;color:#2563EB;cursor:pointer;text-decoration:none;font-family:Host Grotesk,system-ui,sans-serif;margin-left:8px;vertical-align:middle;}',
    '.mtg-pill-upgrade:hover{text-decoration:underline;}'
  ].join('');
  document.head.appendChild(css);

  function makePill(cur, max, label) {
    var pill = document.createElement('span');
    var ratio = (max > 0) ? (cur / max) : 0;
    var isFull = ratio >= 1;
    var isWarn = !isFull && ratio >= 0.8;
    pill.className = 'mtg-lpill ' + (isFull ? 'mtg-pill-full' : isWarn ? 'mtg-pill-warn' : 'mtg-pill-ok');
    var icon = isFull ? 'fa-circle-xmark' : isWarn ? 'fa-triangle-exclamation' : 'fa-gauge-high';
    pill.innerHTML = '<i class="fa-solid ' + icon + '"></i>\xa0' + cur + '\xa0/\xa0' + max + '\xa0' + label;
    return pill;
  }

  function showPipelinePill(loanCount) {
    var path = window.location.pathname.toLowerCase();
    if (path !== '/app/pipeline' && path !== '/app/pipeline/') return;
    var count = loanCount || 0;
    var pill = makePill(count, 25, 'loans');
    pill.style.marginRight = '8px';
    var wrap = document.createElement('span');
    wrap.style.display = 'inline-flex';
    wrap.style.alignItems = 'center';
    wrap.appendChild(pill);
    if (count >= 25) {
      var link = document.createElement('span');
      link.className = 'mtg-pill-upgrade';
      link.textContent = 'Upgrade to PRO \u2192';
      link.addEventListener('click', function() {
        if (window.MTG_Billing) window.MTG_Billing.showUpgradeModal("You've reached your 25-loan pipeline limit. Upgrade to PRO for unlimited.", 'PRO');
      });
      wrap.appendChild(link);
    }
    var inserted = false;
    var hs = ['.header-right','.pipeline-header-right','.page-header-actions','.page-header .right','.pipeline-header','.page-header'];
    for (var i = 0; i < hs.length; i++) {
      var c = document.querySelector(hs[i]);
      if (c && !c.querySelector('.mtg-lpill')) {
        var pb = c.querySelector('.btn-primary, button');
        if (pb && pb.parentNode === c) c.insertBefore(wrap, pb); else c.appendChild(wrap);
        inserted = true; break;
      }
    }
    if (!inserted) {
      var ab = document.querySelector('[data-action="add-loan"], #add-loan-btn, .add-loan-btn, [onclick*="addLoan"], [onclick*="openNewLoanModal"]');
      if (ab && ab.parentNode && !ab.parentNode.querySelector('.mtg-lpill')) ab.parentNode.insertBefore(wrap, ab);
    }
  }

  var CALC_URL_MAP = {
    '/app/calc-mortgage': 'Mortgage Calculator', '/app/mortgage-calculator': 'Mortgage Calculator',
    '/app/refi-analysis': 'Refinance Analysis', '/app/refinance': 'Refinance Analysis',
    '/app/affordability': 'Affordability Calculator', '/app/blended-rate': 'Blended Rate',
    '/app/dscr-calc': 'DSCR Calculator', '/app/dscr': 'DSCR Calculator',
    '/app/va-entitlement': 'VA Entitlement', '/app/loan-scenario': 'Loan Scenario Comparison',
    '/app/loan-scenario-comparison': 'Loan Scenario Comparison', '/app/rent-vs-buy': 'Rent vs Buy',
    '/app/lender-pricing': 'Lender Pricing Comparison', '/app/closing-costs': 'Closing Costs'
  };

  function showCalcPill(savesData) {
    var path = window.location.pathname.toLowerCase();
    var calcName = null;
    for (var url in CALC_URL_MAP) { if (path.startsWith(url)) { calcName = CALC_URL_MAP[url]; break; } }
    if (!calcName) return;
    var saveCount = (savesData && savesData[calcName]) ? savesData[calcName] : 0;
    var pill = makePill(saveCount, 10, 'saves');
    pill.style.marginLeft = '10px';
    var anchor = document.getElementById('saveStatus');
    if (!anchor) { var sb = document.querySelector('.btn-save, [data-action="save"], button[onclick*="save"], #save-btn'); anchor = sb ? sb.parentNode : null; }
    if (anchor && !anchor.querySelector('.mtg-lpill')) anchor.appendChild(pill);
  }

  async function initialize() {
    for (var i = 0; i < 60; i++) {
      if (window.MTG_Billing && window.MTG_Billing.state === 'ready') break;
      await new Promise(function(r) { setTimeout(r, 100); });
    }
    if (!window.MTG_Billing || window.MTG_Billing.state !== 'ready') return;
    var plan = await window.MTG_Billing.getUserPlan();
    if (plan !== 'PLUS') return;
    try {
      var data = await window.MTG_Billing.apiRequest('/api/plan-limits');
      var usage = (data && data.usage) ? data.usage : {};
      setTimeout(function() { showPipelinePill(usage.pipelineLoans); showCalcPill(usage.calculatorSaves); }, 1200);
    } catch (e) {}
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initialize); }
  else { initialize(); }
})();
`;

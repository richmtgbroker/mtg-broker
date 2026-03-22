/**
 * mtg-broker-navbar — Cloudflare Worker
 * =========================================================
 * Serves the app navbar as an injectable JavaScript module.
 *
 * ENDPOINT:
 *   GET /navbar.js  → returns the navbar as executable JS
 *   GET /           → returns a short status message
 *
 * DEPLOY:
 *   wrangler deploy workers/mtg-broker-navbar.js \
 *     --name mtg-broker-navbar \
 *     --compatibility-date 2024-01-01
 *
 *   After deploy, your URL will be:
 *   https://mtg-broker-navbar.<YOUR-SUBDOMAIN>.workers.dev/navbar.js
 *
 * HOW TO USE IN WEBFLOW:
 *   Inside the "Navbar_App" Webflow component, add an HtmlEmbed with:
 *
 *     <div id="mtg-navbar"></div>
 *     <script>
 *       (function() {
 *         var s = document.createElement('script');
 *         s.src = 'https://mtg-broker-navbar.rich-e00.workers.dev/navbar.js';
 *         s.defer = true;
 *         document.head.appendChild(s);
 *       })();
 *     </script>
 *
 * TO UPDATE THE NAVBAR:
 *   1. Edit this file (CSS, HTML, or JS sections below).
 *   2. Run: wrangler deploy workers/mtg-broker-navbar.js --name mtg-broker-navbar
 *   3. All pages pick up the change automatically — no Webflow edits needed.
 *
 * WHAT THIS NAVBAR DOES:
 *   - Fixed to the top of the page, full width, 64px tall
 *   - Sets --navbar-height CSS variable so the sidebar positions correctly
 *   - Shows the mtg.broker logo (links to /app/dashboard)
 *   - Shows user's name + avatar (initials) from Outseta JWT
 *   - Dropdown: My Account → /app/settings | Sign Out → clears token + redirects
 *   - Mobile: hamburger button opens a full-screen nav drawer (sidebar is hidden on mobile)
 * =========================================================
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ---- Serve the navbar JavaScript module ----
    if (url.pathname === '/navbar.js') {
      return new Response(buildNavbarScript(), {
        headers: {
          'Content-Type': 'application/javascript; charset=utf-8',
          // Allow any page to load this
          'Access-Control-Allow-Origin': '*',
          // Cache 5 minutes in browser, 1 hour at edge
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
        },
      });
    }

    // ---- Health check at root ----
    if (url.pathname === '/' || url.pathname === '') {
      return new Response(
        'mtg-broker-navbar worker is running.\nLoad /navbar.js on any page to inject the navbar.',
        { headers: { 'Content-Type': 'text/plain' } }
      );
    }

    return new Response('Not Found', { status: 404 });
  },
};


// ============================================================
// NAVBAR CSS
// All styles — injected into <head> at runtime.
// ============================================================
const NAVBAR_CSS = `
/* ================================================
   APP NAVBAR - Fixed Top Bar
   v1 - Initial release
   Served by mtg-broker-navbar Cloudflare Worker
   ================================================ */

/* --- Design token: all other components use this variable --- */
:root {
  --navbar-height: 64px;
}

/* --- Main navbar bar --- */
.app-navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--navbar-height);
  background: #ffffff;
  border-bottom: 1px solid #E5E7EB;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px 0 16px;
  box-sizing: border-box;
}

/* --- Left side: hamburger (mobile) + logo --- */
.navbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* --- Logo --- */
.navbar-logo {
  display: flex;
  align-items: center;
  text-decoration: none;
  font-size: 18px;
  font-weight: 700;
  color: #1a56db;
  letter-spacing: -0.3px;
  line-height: 1;
}

.navbar-logo .logo-dot {
  color: #111827;
}

/* --- Right side: user controls --- */
.navbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* --- User button (avatar + name + chevron) --- */
.navbar-user-wrap {
  position: relative;
}

.navbar-user-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px 6px 6px;
  border: 1px solid #E5E7EB;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.navbar-user-btn:hover {
  background: #F9FAFB;
  border-color: #D1D5DB;
}

/* --- Avatar circle with initials --- */
.navbar-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #1a56db;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  letter-spacing: 0.5px;
}

/* --- User's name --- */
.navbar-user-name {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* --- Chevron icon --- */
.navbar-chevron {
  width: 14px;
  height: 14px;
  color: #9CA3AF;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.navbar-user-wrap.open .navbar-chevron {
  transform: rotate(180deg);
}

/* --- Dropdown menu --- */
.navbar-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: #ffffff;
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  min-width: 180px;
  padding: 6px;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-4px);
  transition: opacity 0.15s ease, transform 0.15s ease;
  z-index: 10000;
}

.navbar-user-wrap.open .navbar-dropdown {
  opacity: 1;
  pointer-events: all;
  transform: translateY(0);
}

/* --- Dropdown items --- */
.navbar-dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 8px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  background: none;
  border: none;
  width: 100%;
  text-align: left;
  font-family: inherit;
  transition: background 0.1s ease;
}

.navbar-dropdown-item:hover {
  background: #F3F4F6;
  color: #111827;
}

.navbar-dropdown-item svg {
  width: 16px;
  height: 16px;
  color: #6B7280;
  flex-shrink: 0;
}

.navbar-dropdown-item.signout {
  color: #DC2626;
}

.navbar-dropdown-item.signout svg {
  color: #DC2626;
}

.navbar-dropdown-item.signout:hover {
  background: #FEF2F2;
}

/* --- Dropdown divider --- */
.navbar-dropdown-divider {
  border: none;
  border-top: 1px solid #E5E7EB;
  margin: 4px 0;
}

/* --- Hamburger button (mobile only) --- */
.navbar-hamburger {
  display: none;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  flex-shrink: 0;
}

.navbar-hamburger:hover {
  background: #F3F4F6;
}

.navbar-hamburger svg {
  width: 18px;
  height: 18px;
  color: #374151;
}

/* --- Mobile nav drawer --- */
.navbar-mobile-menu {
  display: none;
  position: fixed;
  top: var(--navbar-height);
  left: 0;
  right: 0;
  bottom: 0;
  background: #ffffff;
  z-index: 9998;
  overflow-y: auto;
  padding: 16px 12px;
  transform: translateX(-100%);
  transition: transform 0.25s ease;
}

.navbar-mobile-menu.open {
  transform: translateX(0);
}

/* Mobile menu nav links — same style as sidebar */
.navbar-mobile-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  text-decoration: none;
  color: #374151;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.15s ease;
}

.navbar-mobile-link:hover {
  background: #F3F4F6;
  color: #111827;
}

.navbar-mobile-link.active {
  background: #EFF6FF;
  color: #2563EB;
  font-weight: 600;
}

.navbar-mobile-link.active svg {
  color: #2563EB;
}

.navbar-mobile-link svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  color: #6B7280;
}

.navbar-mobile-divider {
  border: none;
  border-top: 1px solid #E5E7EB;
  margin: 8px 0;
}

.navbar-mobile-label {
  font-size: 11px;
  font-weight: 700;
  color: #94A3B8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 8px 14px 4px 14px;
}

/* Mobile NEXA links (hidden unless body.nexa-user) */
.navbar-mobile-nexa {
  display: none;
}
body.nexa-user .navbar-mobile-nexa {
  display: flex;
}

/* Mobile PRO links (hidden unless body.pro-user) */
.navbar-mobile-pro {
  display: none;
}
body.pro-user .navbar-mobile-pro {
  display: flex;
}

/* --- MOBILE BREAKPOINT --- */
@media (max-width: 991px) {
  .navbar-hamburger {
    display: flex;
  }

  /* Hide user name on small mobile, keep avatar */
  .navbar-user-name {
    display: none;
  }

  .navbar-mobile-menu {
    display: block;
  }

  /* App pages need top padding to clear the fixed navbar */
  body.app-page .wf-section,
  body.app-page main {
    padding-top: var(--navbar-height);
  }
}
`;


// ============================================================
// NAVBAR HTML
// The <header> element only — no <style> or <script> tags.
// ============================================================
const NAVBAR_HTML = `
<header class="app-navbar" id="app-navbar">

  <!-- ===== LEFT: Hamburger (mobile) + Logo ===== -->
  <div class="navbar-left">
    <!-- Hamburger — mobile only, toggles .navbar-mobile-menu -->
    <button class="navbar-hamburger" id="navbar-hamburger" aria-label="Open navigation menu">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    </button>

    <!-- Logo -->
    <a href="/app/dashboard" class="navbar-logo" aria-label="mtg.broker home">
      mtg<span class="logo-dot">.broker</span>
    </a>
  </div>

  <!-- ===== RIGHT: User avatar + dropdown ===== -->
  <div class="navbar-right">
    <div class="navbar-user-wrap" id="navbar-user-wrap">

      <!-- User button -->
      <button class="navbar-user-btn" id="navbar-user-btn" aria-label="Account menu">
        <div class="navbar-avatar" id="navbar-avatar">?</div>
        <span class="navbar-user-name" id="navbar-user-name">Account</span>
        <svg class="navbar-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      <!-- Dropdown menu -->
      <div class="navbar-dropdown" id="navbar-dropdown" role="menu">

        <!-- My Account -->
        <a href="/app/settings" class="navbar-dropdown-item" role="menuitem">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="8" r="4"></circle>
            <path d="M20 21a8 8 0 1 0-16 0"></path>
          </svg>
          My Account
        </a>

        <div class="navbar-dropdown-divider"></div>

        <!-- Sign Out -->
        <button class="navbar-dropdown-item signout" id="navbar-signout" role="menuitem">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          Sign Out
        </button>

      </div>
    </div>
  </div>
</header>

<!-- ===== MOBILE NAV DRAWER ===== -->
<!-- Mirrors the sidebar nav — visible on mobile when hamburger is clicked -->
<nav class="navbar-mobile-menu" id="navbar-mobile-menu" aria-label="Mobile navigation">

  <!-- Dashboard -->
  <a href="/app/dashboard" class="navbar-mobile-link">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect>
      <rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>
    </svg>
    Dashboard
  </a>

  <!-- Loan Search -->
  <a href="/app/loan-search" class="navbar-mobile-link">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
    Loan Search
  </a>

  <!-- AI Loan Finder — sparkles -->
  <a href="/app/ai-search/" class="navbar-mobile-link">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path>
      <path d="M20 3v4"></path><path d="M22 5h-4"></path><path d="M4 17v2"></path><path d="M5 18H3"></path>
    </svg>
    AI Loan Finder
  </a>

  <!-- Lenders -->
  <a href="/app/lenders" class="navbar-mobile-link">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 21h18M5 21v-7M19 21v-7M9 21v-7M15 21v-7M3 10h18M12 3L2 10h20L12 3z"></path>
    </svg>
    Lenders
  </a>

  <!-- Products -->
  <a href="/app/products" class="navbar-mobile-link">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>
    </svg>
    Products
  </a>

  <!-- Property Types -->
  <a href="/app/property-types" class="navbar-mobile-link">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"></path>
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"></path>
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"></path>
      <path d="M10 6h4"></path><path d="M10 10h4"></path><path d="M10 14h4"></path><path d="M10 18h4"></path>
    </svg>
    Property Types
  </a>

  <div class="navbar-mobile-divider"></div>

  <!-- Vendors -->
  <a href="/app/vendors" class="navbar-mobile-link">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle>
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
    </svg>
    Vendors
  </a>

  <!-- Contacts -->
  <a href="/app/contacts" class="navbar-mobile-link">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
    Contacts
  </a>

  <div class="navbar-mobile-divider"></div>

  <!-- Pipeline -->
  <a href="/app/pipeline" class="navbar-mobile-link">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
      <polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline>
    </svg>
    Pipeline
  </a>

  <!-- Calculators -->
  <a href="/app/calculators" class="navbar-mobile-link">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="8" x2="16" y1="6" y2="6"></line>
      <line x1="16" x2="16" y1="14" y2="18"></line>
      <path d="M16 10h.01"></path><path d="M12 10h.01"></path><path d="M8 10h.01"></path>
      <path d="M12 14h.01"></path><path d="M8 14h.01"></path><path d="M12 18h.01"></path><path d="M8 18h.01"></path>
    </svg>
    Calculators
  </a>

  <!-- Goal Setting -->
  <a href="/app/goal-setting" class="navbar-mobile-link">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle>
    </svg>
    Goal Setting
  </a>

  <!-- Social Media -->
  <a href="/app/social-media" class="navbar-mobile-link">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="13.5" cy="6.5" r="2.5"></circle>
      <path d="M17.5 10.5c1.7-1 3.5 0 3.5 0"></path>
      <path d="M3 21c0 0 1-4 4-4 1.5 0 2.3.5 3 1l2-6"></path>
      <path d="M12.5 12L10 21"></path><path d="M3 3l18 18"></path>
      <rect x="2" y="2" width="20" height="20" rx="2"></rect>
    </svg>
    Social Media
  </a>

  <!-- Tools -->
  <a href="/app/tools" class="navbar-mobile-link">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
    </svg>
    Tools
  </a>

  <!-- NEXA Exclusive (hidden unless body.nexa-user) -->
  <div class="navbar-mobile-divider navbar-mobile-nexa"></div>
  <div class="navbar-mobile-label navbar-mobile-nexa">NEXA Exclusive</div>
  <a href="/app/credit-reports" class="navbar-mobile-link navbar-mobile-nexa">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline><path d="M9 15l2 2 4-4"></path>
    </svg>
    Credit Reports
  </a>

  <div class="navbar-mobile-divider"></div>

  <!-- My Workspace -->
  <div class="navbar-mobile-label">My Workspace</div>

  <!-- Saved Items -->
  <a href="/app/saved" class="navbar-mobile-link">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
    </svg>
    Saved Items
  </a>

  <!-- Referrals (PRO only) -->
  <a href="/app/referral" class="navbar-mobile-link navbar-mobile-pro">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect>
      <line x1="12" y1="22" x2="12" y2="7"></line>
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path>
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>
    </svg>
    Referrals
  </a>

  <!-- Settings -->
  <a href="/app/settings" class="navbar-mobile-link">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
    Settings
  </a>

</nav>
`;


// ============================================================
// NAVBAR JS LOGIC
// Runs after HTML is injected. Handles:
//   1. User info from Outseta JWT (name + initials)
//   2. Dropdown open/close + close-on-outside-click
//   3. Hamburger toggle for mobile nav drawer
//   4. Sign out
//   5. Active link highlighting in mobile menu
// ============================================================
const NAVBAR_JS_LOGIC = `
(function() {

  // ---- Elements ----
  var userBtn    = document.getElementById('navbar-user-btn');
  var userWrap   = document.getElementById('navbar-user-wrap');
  var avatar     = document.getElementById('navbar-avatar');
  var userName   = document.getElementById('navbar-user-name');
  var signoutBtn = document.getElementById('navbar-signout');
  var hamburger  = document.getElementById('navbar-hamburger');
  var mobileMenu = document.getElementById('navbar-mobile-menu');

  // ============================================================
  // 1. LOAD USER INFO FROM OUTSETA JWT
  //    Reads name and email from the access token stored in
  //    localStorage. No network call needed — instant.
  // ============================================================
  function loadUserFromJWT() {
    try {
      var token = localStorage.getItem('Outseta.nocode.accessToken');
      if (!token) return;

      var payload = JSON.parse(atob(token.split('.')[1]));

      // Name: try common JWT claim shapes
      var fullName = payload['name'] ||
                     payload['outseta:name'] ||
                     payload['given_name'] ||
                     '';
      var email = payload['email'] || '';

      // Display: first name or email prefix
      var displayName = fullName
        ? fullName.split(' ')[0]
        : (email ? email.split('@')[0] : 'Account');

      // Initials: up to 2 chars from name words
      var initials = fullName
        ? fullName.split(' ').map(function(w) { return w.charAt(0); }).join('').substring(0, 2).toUpperCase()
        : (email ? email.charAt(0).toUpperCase() : '?');

      if (avatar)   avatar.textContent   = initials;
      if (userName) userName.textContent = displayName;

    } catch (e) {
      // Token missing or malformed — leave defaults
    }
  }

  loadUserFromJWT();


  // ============================================================
  // 2. DROPDOWN TOGGLE
  //    Opens/closes the user dropdown on button click.
  //    Closes when clicking anywhere outside.
  // ============================================================
  if (userBtn && userWrap) {
    userBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      userWrap.classList.toggle('open');
    });

    // Close dropdown on outside click
    document.addEventListener('click', function(e) {
      if (!userWrap.contains(e.target)) {
        userWrap.classList.remove('open');
      }
    });

    // Close dropdown on Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        userWrap.classList.remove('open');
      }
    });
  }


  // ============================================================
  // 3. HAMBURGER TOGGLE (MOBILE)
  //    Opens/closes the full-screen mobile nav drawer.
  //    Also prevents body scroll when menu is open.
  // ============================================================
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', function() {
      var isOpen = mobileMenu.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Close mobile menu when a link inside it is clicked
    mobileMenu.addEventListener('click', function(e) {
      if (e.target.closest('.navbar-mobile-link')) {
        mobileMenu.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    });
  }


  // ============================================================
  // 4. SIGN OUT
  //    Clears Outseta token and redirects to home page.
  //    Uses Outseta's built-in logout if available, otherwise
  //    clears the token manually.
  // ============================================================
  if (signoutBtn) {
    signoutBtn.addEventListener('click', function() {
      // Try Outseta's built-in logout first
      try {
        if (window.Outseta && typeof window.Outseta.setAccessToken === 'function') {
          window.Outseta.setAccessToken(null);
        }
      } catch (e) { /* ignore */ }

      // Always clear the token manually too
      localStorage.removeItem('Outseta.nocode.accessToken');
      sessionStorage.removeItem('nexa-access');
      sessionStorage.removeItem('pro-access');

      // Redirect to home
      window.location.href = '/';
    });
  }


  // ============================================================
  // 5. ACTIVE LINK HIGHLIGHTING (MOBILE MENU)
  //    Highlights whichever mobile menu link matches the
  //    current page URL.
  // ============================================================
  function highlightMobileActiveLink() {
    var currentPath = window.location.pathname.replace(/\/$/, '');
    var links = document.querySelectorAll('.navbar-mobile-link');
    links.forEach(function(link) {
      var linkPath = new URL(link.href, window.location.origin).pathname.replace(/\/$/, '');
      if (currentPath === linkPath) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  highlightMobileActiveLink();

})();
`;


// ============================================================
// BUILD FUNCTION
// Assembles the final JS string the browser executes.
// CSS and HTML use JSON.stringify() for safe embedding.
// JS logic is interpolated directly.
// ============================================================
function buildNavbarScript() {
  return `/* mtg-broker navbar v1 — served by Cloudflare Worker */
(function() {
  'use strict';

  // 1. Inject CSS into <head> (guarded by id — only runs once per page)
  if (!document.getElementById('mtg-navbar-css')) {
    var style = document.createElement('style');
    style.id = 'mtg-navbar-css';
    style.textContent = ${JSON.stringify(NAVBAR_CSS)};
    document.head.appendChild(style);
  }

  // 2. Find the mount point — add <div id="mtg-navbar"></div> to your page
  var container = document.getElementById('mtg-navbar');
  if (!container) {
    console.warn('[mtg-broker-navbar] No mount point found. Add <div id="mtg-navbar"></div> to your page.');
    return;
  }

  // 3. Inject the navbar HTML
  container.innerHTML = ${JSON.stringify(NAVBAR_HTML)};

  // 4. Run the navbar logic (user info, dropdown, hamburger, sign out)
  ${NAVBAR_JS_LOGIC}

})();`;
}

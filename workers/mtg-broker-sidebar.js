/**
 * mtg-broker-sidebar — Cloudflare Worker
 * =========================================================
 * Serves the app sidebar as an injectable JavaScript module.
 *
 * ENDPOINT:
 *   GET /sidebar.js  → returns the sidebar as executable JS
 *   GET /            → returns a short status message
 *
 * DEPLOY:
 *   wrangler deploy workers/mtg-broker-sidebar.js \
 *     --name mtg-broker-sidebar \
 *     --compatibility-date 2024-01-01
 *
 *   After deploy, your URL will be:
 *   https://mtg-broker-sidebar.<YOUR-SUBDOMAIN>.workers.dev/sidebar.js
 *
 * HOW TO USE IN WEBFLOW (replaces the giant sidebar embed):
 *   1. Delete the existing sidebar embed on each app page.
 *   2. Add a 1-line HTML embed wherever the sidebar should appear:
 *        <div id="mtg-sidebar"></div>
 *   3. In Site Settings → Footer Code, add:
 *        <script src="https://mtg-broker-sidebar.YOUR-SUBDOMAIN.workers.dev/sidebar.js"></script>
 *      (This loads the sidebar on every app page automatically.)
 *
 * HOW TO USE IN THE AI LOAN FINDER REACT APP:
 *   In index.html (or the root HTML file), add:
 *        <div id="mtg-sidebar"></div>
 *      ...in the body, and:
 *        <script src="https://mtg-broker-sidebar.YOUR-SUBDOMAIN.workers.dev/sidebar.js"></script>
 *      ...at the end of <body>.
 *
 * TO UPDATE THE SIDEBAR:
 *   1. Edit this file (CSS, HTML, or JS sections below).
 *   2. Run: wrangler deploy workers/mtg-broker-sidebar.js --name mtg-broker-sidebar
 *   3. All pages pick up the change automatically — no Webflow edits needed.
 * =========================================================
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ---- Serve the sidebar JavaScript module ----
    if (url.pathname === '/sidebar.js') {
      return new Response(buildSidebarScript(), {
        headers: {
          'Content-Type': 'application/javascript; charset=utf-8',
          // Allow any page (Webflow, React app, test file) to load this
          'Access-Control-Allow-Origin': '*',
          // Cache for 5 minutes in browsers, 1 hour at edge. Bump version
          // comment in buildSidebarScript() to bust cache after updates.
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
        },
      });
    }

    // ---- Health check at root ----
    if (url.pathname === '/' || url.pathname === '') {
      return new Response(
        'mtg-broker-sidebar worker is running.\nLoad /sidebar.js on any page to inject the sidebar.',
        { headers: { 'Content-Type': 'text/plain' } }
      );
    }

    return new Response('Not Found', { status: 404 });
  },
};


// ============================================================
// SIDEBAR CSS
// All styles for the sidebar — injected into <head> at runtime.
// ============================================================
const SIDEBAR_CSS = `
/* ================================================
   APP SIDEBAR - Fixed Navigation (Starts below navbar)
   v8 - Moved Pipeline above Calculators
   Served by mtg-broker-sidebar Cloudflare Worker
   NEXA gating uses sessionStorage cache + Outseta NexaAccess field
   PRO gating uses JWT planUid check + body.pro-user class
   ================================================ */
.sidebar {
  position: fixed;
  top: var(--navbar-height); /* Start below navbar */
  left: 0;
  width: 260px;
  height: calc(100vh - var(--navbar-height));
  background: #ffffff;
  border-right: 1px solid #E5E7EB;
  z-index: 999; /* Below navbar which is 9999 */
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  overflow: hidden;
}

.sidebar.collapsed {
  width: 72px;
}

/* --- Header --- */
.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid #E5E7EB;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 60px;
  box-sizing: border-box;
  gap: 12px;
}

.sidebar-header-text {
  font-size: 11px;
  font-weight: 700;
  color: #94A3B8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
  transition: opacity 0.2s ease;
}

.sidebar.collapsed .sidebar-header-text {
  opacity: 0;
  width: 0;
  overflow: hidden;
}

/* --- Toggle button --- */
.sidebar-toggle {
  width: 32px;
  height: 32px;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.sidebar-toggle:hover {
  background: #F3F4F6;
}

.sidebar-toggle svg {
  width: 16px;
  height: 16px;
  color: #6B7280;
  transition: transform 0.3s ease;
}

.sidebar.collapsed .sidebar-toggle svg {
  transform: rotate(180deg);
}

/* --- Nav area --- */
.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 16px 12px;
}

.sidebar-section {
  margin-bottom: 24px;
}

/* --- Section labels (e.g. "My Workspace", "NEXA Exclusive") --- */
.sidebar-label {
  font-size: 11px;
  font-weight: 700;
  color: #94A3B8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0 12px 8px 12px;
  white-space: nowrap;
  overflow: hidden;
  transition: opacity 0.2s ease, height 0.2s ease, padding 0.2s ease;
}

/* Label must collapse to zero height so it doesn't eat space */
.sidebar.collapsed .sidebar-label {
  opacity: 0;
  height: 0;
  padding-top: 0;
  padding-bottom: 0;
  margin: 0;
  overflow: hidden;
}

/* --- Nav links --- */
.sidebar-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  text-decoration: none;
  color: #374151;
  font-size: 17px;
  font-weight: 500;
  transition: all 0.15s ease;
  white-space: nowrap;
  overflow: hidden;
}

.sidebar-link:hover {
  background: #F3F4F6;
  color: #111827;
}

.sidebar-link.active {
  background: #EFF6FF;
  color: #2563EB;
  font-weight: 600;
}

.sidebar-link.active svg {
  color: #2563EB;
}

.sidebar-link svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  color: #6B7280;
}

.sidebar-link span {
  transition: opacity 0.2s ease;
}

/* Collapsed span needs width:0 + overflow:hidden
   so invisible text doesn't push icons off-screen */
.sidebar.collapsed .sidebar-link span {
  opacity: 0;
  width: 0;
  overflow: hidden;
  display: inline-block;
}

.sidebar.collapsed .sidebar-link {
  padding: 10px;
  justify-content: center;
}

/* --- Dividers (class-based, not inline style) --- */
.sidebar-divider {
  border: none;
  border-top: 1px solid #E5E7EB;
  margin: 12px 0;
}

.sidebar.collapsed .sidebar-divider {
  margin: 6px 0;
}


/* === NEXA-ONLY STYLES === */
/* Hidden by default, shown when body.nexa-user is present */
.sidebar-label.nexa-only {
  display: none;
}

body.nexa-user .sidebar-label.nexa-only {
  display: block;
}

.sidebar-link.nexa-link {
  display: none;
}

.sidebar-link.nexa-link svg {
  color: #059669;
}

.sidebar-link.nexa-link:hover {
  background: #ECFDF5;
  color: #065F46;
}

.sidebar-link.nexa-link.active {
  background: #ECFDF5;
  color: #059669;
}

.sidebar-link.nexa-link.active svg {
  color: #059669;
}

body.nexa-user .sidebar-link.nexa-link {
  display: flex;
}


/* === PRO-ONLY STYLES === */
/* Hidden by default, shown when body.pro-user is present */
.sidebar-link.pro-link {
  display: none;
}

body.pro-user .sidebar-link.pro-link {
  display: flex;
}

/* PRO badge next to link text */
.sidebar-pro-badge {
  font-size: 9px;
  font-weight: 700;
  color: #2563EB;
  background: #EFF6FF;
  border: 1px solid #BFDBFE;
  border-radius: 4px;
  padding: 1px 5px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  line-height: 1.4;
  flex-shrink: 0;
  transition: opacity 0.2s ease;
}

.sidebar.collapsed .sidebar-pro-badge {
  opacity: 0;
  width: 0;
  padding: 0;
  border: none;
  overflow: hidden;
}


/* === MOBILE === */
@media (max-width: 991px) {
  .sidebar {
    display: none;
  }

  .sidebar-link {
    font-size: 15px;
  }

  .sidebar-link svg {
    width: 18px;
    height: 18px;
  }

  .sidebar-label {
    font-size: 10px;
  }
}
`;


// ============================================================
// SIDEBAR HTML
// The <nav> element only — no <style> or <script> tags.
// CSS is injected separately above. JS runs after this is set.
//
// CHANGES vs sidebar-current.html:
//   - Added "AI Loan Finder" link after "Loan Search" (sparkles icon)
// ============================================================
const SIDEBAR_HTML = `
<nav class="sidebar" id="app-sidebar">
  <div class="sidebar-header">
    <span class="sidebar-header-text">Navigation</span>
    <button class="sidebar-toggle" id="sidebar-toggle" aria-label="Toggle sidebar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="11 17 6 12 11 7"></polyline>
        <polyline points="18 17 13 12 18 7"></polyline>
      </svg>
    </button>
  </div>

  <div class="sidebar-nav">
    <!-- ================================================
         MAIN NAVIGATION
         ================================================ -->
    <div class="sidebar-section">

      <!-- Dashboard — 4 squares grid -->
      <a href="/app/dashboard" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
        <span>Dashboard</span>
      </a>

      <!-- Loan Search — magnifying glass -->
      <a href="/app/loan-search" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <span>Loan Search</span>
      </a>

      <!-- AI Loan Finder — sparkles icon (links to React app) -->
      <a href="/app/ai-search/" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path>
          <path d="M20 3v4"></path>
          <path d="M22 5h-4"></path>
          <path d="M4 17v2"></path>
          <path d="M5 18H3"></path>
        </svg>
        <span>AI Loan Finder</span>
      </a>

      <!-- Lenders — temple/bank -->
      <a href="/app/lenders" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 21h18M5 21v-7M19 21v-7M9 21v-7M15 21v-7M3 10h18M12 3L2 10h20L12 3z"></path>
        </svg>
        <span>Lenders</span>
      </a>

      <!-- Products — 3D box -->
      <a href="/app/products" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
        <span>Products</span>
      </a>

      <!-- Property Types — building with side wings -->
      <a href="/app/property-types" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"></path>
          <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"></path>
          <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"></path>
          <path d="M10 6h4"></path>
          <path d="M10 10h4"></path>
          <path d="M10 14h4"></path>
          <path d="M10 18h4"></path>
        </svg>
        <span>Property Types</span>
      </a>

      <!-- Divider -->
      <div class="sidebar-divider"></div>

      <!-- Vendors — shopping cart -->
      <a href="/app/vendors" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="8" cy="21" r="1"></circle>
          <circle cx="19" cy="21" r="1"></circle>
          <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
        </svg>
        <span>Vendors</span>
      </a>

      <!-- Contacts — people -->
      <a href="/app/contacts" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        <span>Contacts</span>
      </a>

      <!-- Divider -->
      <div class="sidebar-divider"></div>

      <!-- Pipeline — stacked layers -->
      <a href="/app/pipeline" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
          <polyline points="2 17 12 22 22 17"></polyline>
          <polyline points="2 12 12 17 22 12"></polyline>
        </svg>
        <span>Pipeline</span>
      </a>

      <!-- Calculators -->
      <a href="/app/calculators" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2"></rect>
          <line x1="8" x2="16" y1="6" y2="6"></line>
          <line x1="16" x2="16" y1="14" y2="18"></line>
          <path d="M16 10h.01"></path>
          <path d="M12 10h.01"></path>
          <path d="M8 10h.01"></path>
          <path d="M12 14h.01"></path>
          <path d="M8 14h.01"></path>
          <path d="M12 18h.01"></path>
          <path d="M8 18h.01"></path>
        </svg>
        <span>Calculators</span>
      </a>

      <!-- Goal Setting — target -->
      <a href="/app/goal-setting" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <circle cx="12" cy="12" r="6"></circle>
          <circle cx="12" cy="12" r="2"></circle>
        </svg>
        <span>Goal Setting</span>
      </a>

      <!-- Social Media Graphics -->
      <a href="/app/social-media" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="13.5" cy="6.5" r="2.5"></circle>
          <path d="M17.5 10.5c1.7-1 3.5 0 3.5 0"></path>
          <path d="M3 21c0 0 1-4 4-4 1.5 0 2.3.5 3 1l2-6"></path>
          <path d="M12.5 12L10 21"></path>
          <path d="M3 3l18 18"></path>
          <rect x="2" y="2" width="20" height="20" rx="2"></rect>
        </svg>
        <span>Social Media</span>
      </a>

      <!-- Tools — wrench -->
      <a href="/app/tools" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
        </svg>
        <span>Tools</span>
      </a>
    </div>

    <!-- ================================================
         NEXA EXCLUSIVE (hidden unless body.nexa-user)
         ================================================ -->
    <div class="sidebar-section">
      <div class="sidebar-label nexa-only">NEXA Exclusive</div>

      <!-- Credit Reports — file with checkmark -->
      <a href="/app/credit-reports" class="sidebar-link nexa-link nexa-only">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <path d="M9 15l2 2 4-4"></path>
        </svg>
        <span>Credit Reports</span>
      </a>
    </div>

    <!-- ================================================
         MY WORKSPACE
         ================================================ -->
    <div class="sidebar-section">
      <div class="sidebar-label">My Workspace</div>

      <!-- Saved Items — bookmark -->
      <a href="/app/saved" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
        </svg>
        <span>Saved Items</span>
      </a>

      <!-- Referral Program (PRO-only, hidden unless body.pro-user) -->
      <a href="/app/referral" class="sidebar-link pro-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 12 20 22 4 22 4 12"></polyline>
          <rect x="2" y="7" width="20" height="5"></rect>
          <line x1="12" y1="22" x2="12" y2="7"></line>
          <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path>
          <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>
        </svg>
        <span>Referrals</span>
        <span class="sidebar-pro-badge">PRO</span>
      </a>

      <!-- Settings — gear -->
      <a href="/app/settings" class="sidebar-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
        <span>Settings</span>
      </a>
    </div>
  </div>
</nav>
`;


// ============================================================
// SIDEBAR JS LOGIC
// Identical to the original sidebar embed script.
// Runs after the HTML is injected into #mtg-sidebar.
// ============================================================
const SIDEBAR_JS_LOGIC = `
(function() {
  // Add app-page class to body for navbar offset
  document.body.classList.add('app-page');

  var sidebar = document.getElementById('app-sidebar');
  var toggle = document.getElementById('sidebar-toggle');
  var STORAGE_KEY = 'sidebar-collapsed';
  var NEXA_CACHE_KEY = 'nexa-access';
  var PRO_CACHE_KEY = 'pro-access';
  var PRO_PLAN_UID = 'yWobBP9D';

  // Load saved collapsed state
  var savedState = localStorage.getItem(STORAGE_KEY);
  if (savedState === 'true') {
    sidebar.classList.add('collapsed');
    document.body.classList.add('sidebar-collapsed');
  }

  // Toggle handler
  toggle.addEventListener('click', function() {
    sidebar.classList.toggle('collapsed');
    document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem(STORAGE_KEY, sidebar.classList.contains('collapsed'));
  });

  // Highlight current page
  function highlightCurrentPage() {
    var currentPath = window.location.pathname.replace(/\\/$/,'');
    var links = document.querySelectorAll('.sidebar-link');

    links.forEach(function(link) {
      var linkPath = new URL(link.href, window.location.origin).pathname.replace(/\\/$/,'');
      if (currentPath === linkPath) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  highlightCurrentPage();


  // ============================================================
  // PRO USER DETECTION (instant via JWT)
  // ============================================================
  function grantProAccess() {
    document.body.classList.add('pro-user');
    sessionStorage.setItem(PRO_CACHE_KEY, 'true');
  }

  function revokeProAccess() {
    document.body.classList.remove('pro-user');
    sessionStorage.removeItem(PRO_CACHE_KEY);
  }

  function checkProAccess() {
    // STEP 1: Check sessionStorage cache for instant display
    if (sessionStorage.getItem(PRO_CACHE_KEY) === 'true') {
      document.body.classList.add('pro-user');
    }

    // STEP 2: Check JWT planUid (instant, no network call)
    try {
      var token = localStorage.getItem('Outseta.nocode.accessToken');
      if (token) {
        var payload = JSON.parse(atob(token.split('.')[1]));
        var planUid = payload['outseta:planUid'] || '';
        if (planUid === PRO_PLAN_UID) {
          grantProAccess();
          return;
        } else {
          revokeProAccess();
          return;
        }
      }
    } catch (e) {
      // Token missing or invalid
    }

    if (sessionStorage.getItem(PRO_CACHE_KEY) === 'true') {
      revokeProAccess();
    }
  }

  checkProAccess();


  // ============================================================
  // NEXA USER DETECTION (with sessionStorage cache)
  // ============================================================
  function grantNexaAccess() {
    document.body.classList.add('nexa-user');
    sessionStorage.setItem(NEXA_CACHE_KEY, 'true');
  }

  function revokeNexaAccess() {
    document.body.classList.remove('nexa-user');
    sessionStorage.removeItem(NEXA_CACHE_KEY);
  }

  function checkNexaAccess() {
    // Already granted by another script on this page
    if (document.body.classList.contains('nexa-user')) {
      sessionStorage.setItem(NEXA_CACHE_KEY, 'true');
      return;
    }

    // STEP 1: INSTANT — Check sessionStorage cache
    if (sessionStorage.getItem(NEXA_CACHE_KEY) === 'true') {
      document.body.classList.add('nexa-user');
    }

    // STEP 2: FAST PATH — Check JWT email domain (instant, sync)
    try {
      var token = localStorage.getItem('Outseta.nocode.accessToken');
      if (token) {
        var payload = JSON.parse(atob(token.split('.')[1]));
        var email = (payload.email || '').toLowerCase();
        if (email.endsWith('@nexamortgage.com') || email.endsWith('@nexalending.com')) {
          grantNexaAccess();
          return;
        }
      }
    } catch (e) {
      // Token missing or invalid — continue to slow path
    }

    // STEP 3: SLOW PATH — Check Outseta NexaAccess custom field
    function checkOutsetaField() {
      if (typeof window.getCachedOutsetaUser !== 'function') return false;

      window.getCachedOutsetaUser().then(function(user) {
        if (!user) {
          revokeNexaAccess();
          return;
        }

        var hasAccess = false;

        if (user.NexaAccess === 'true') {
          hasAccess = true;
        }

        if (!hasAccess) {
          try {
            if (user.Account && user.Account.Metadata &&
                user.Account.Metadata.NexaAccess &&
                user.Account.Metadata.NexaAccess.toLowerCase() === 'true') {
              hasAccess = true;
            }
          } catch (e) { /* field doesn't exist */ }
        }

        if (hasAccess) {
          grantNexaAccess();
        } else {
          revokeNexaAccess();
        }
      }).catch(function() {
        // Error fetching user — leave current state as-is
      });

      return true;
    }

    if (checkOutsetaField()) return;

    // Poll for getCachedOutsetaUser if not available yet (up to 5 sec)
    var attempts = 0;
    var maxAttempts = 10;
    var pollInterval = setInterval(function() {
      attempts++;
      if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        if (sessionStorage.getItem(NEXA_CACHE_KEY) !== 'true') {
          revokeNexaAccess();
        }
        return;
      }
      if (typeof window.getCachedOutsetaUser === 'function') {
        clearInterval(pollInterval);
        checkOutsetaField();
      }
    }, 500);
  }

  checkNexaAccess();

})();
`;


// ============================================================
// BUILD FUNCTION
// Assembles the final JS string the browser will execute.
// Uses JSON.stringify() to safely embed CSS and HTML strings
// without any escaping issues.
// ============================================================
function buildSidebarScript() {
  return `/* mtg-broker sidebar v8 — served by Cloudflare Worker */
(function() {
  'use strict';

  // 1. Inject CSS into <head> (guarded by id so it only runs once per page)
  if (!document.getElementById('mtg-sidebar-css')) {
    var style = document.createElement('style');
    style.id = 'mtg-sidebar-css';
    style.textContent = ${JSON.stringify(SIDEBAR_CSS)};
    document.head.appendChild(style);
  }

  // 2. Find the mount point — add <div id="mtg-sidebar"></div> to your page
  var container = document.getElementById('mtg-sidebar');
  if (!container) {
    console.warn('[mtg-broker-sidebar] No mount point found. Add <div id="mtg-sidebar"></div> to your page.');
    return;
  }

  // 3. Inject the sidebar HTML
  container.innerHTML = ${JSON.stringify(SIDEBAR_HTML)};

  // 4. Run the sidebar logic (collapse/expand, active links, PRO/NEXA detection)
  ${SIDEBAR_JS_LOGIC}

})();`;
}

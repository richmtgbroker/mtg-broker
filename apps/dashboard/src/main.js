/* ============================================================
   DASHBOARD — Cloudflare Pages Bundle
   Combines CSS + HTML + JS into a single deployable file.
   Loaded via <script> tag in a Webflow HtmlEmbed.

   Version: 1.1.0
   - Pricing engine buttons restyled as horizontal pills
   - LoanSifter logo fixed (favicon with SVG fallback)
   - Added Favorites section (Lenders, Vendors, Contacts)
   - Replaced Recent Scenarios with Pipeline Tasks
   - Layout: 3-column top row (Quick Actions, Favorites, Rates)
   ============================================================ */

// Import CSS as string — Vite inlines this into the JS bundle via ?inline
import cssText from './styles.css?inline';

// Inject CSS into the page
(function() {
  var style = document.createElement('style');
  style.textContent = cssText;
  document.head.appendChild(style);
})();

// ============================================================
// HTML TEMPLATE — injected into the mount div
// ============================================================
const DASHBOARD_HTML = `
<div class="app-page-content">
<div class="dash-container">

  <!-- Header -->
  <header class="dash-header">
    <div class="dash-header-left">
      <h1 class="dash-title">Welcome back!</h1>
      <p class="dash-subtitle">Your mortgage toolkit at a glance</p>
    </div>
    <!-- Date Chip - Clickable with calendar -->
    <div class="dash-date" id="dash-date">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
      <span id="dash-date-text">Loading...</span>
      <!-- Calendar Popup -->
      <div class="calendar-popup" id="calendar-popup">
        <div class="calendar-header">
          <h4 class="calendar-title" id="calendar-month-title">March 2026</h4>
          <div class="calendar-nav">
            <button id="cal-prev-btn" aria-label="Previous month">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <button id="cal-next-btn" aria-label="Next month">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>
        </div>
        <div class="calendar-grid" id="calendar-grid"></div>
        <div class="calendar-closings" id="calendar-closings"></div>
      </div>
    </div>
  </header>

  <!-- Main Grid: 3-column top row -->
  <div class="dash-grid dash-grid-3col">

    <!-- COL 1: QUICK ACTIONS -->
    <div class="dash-section">
      <div class="section-header">
        <h3 class="section-title">Quick Actions</h3>
      </div>
      <div class="actions-grid actions-grid-compact">

        <a href="/app/loan-search" class="action-card highlight-card">
          <div class="action-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
          <div class="action-text">
            <strong>Loan Search</strong>
            <span>630+ products</span>
          </div>
        </a>

        <a href="/app/lenders" class="action-card">
          <div class="action-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21v-7M19 21v-7M9 21v-7M15 21v-7M3 10h18M12 3L2 10h20L12 3z"></path></svg>
          </div>
          <div class="action-text">
            <strong>Lenders</strong>
            <span><span id="lender-count-display">--</span> in directory</span>
          </div>
        </a>

        <a href="/app/calculators" class="action-card">
          <div class="action-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="8" x2="16" y1="6" y2="6"></line><path d="M16 10h.01M12 10h.01M8 10h.01M16 14h.01M12 14h.01M8 14h.01M16 18h.01M12 18h.01M8 18h.01"></path></svg>
          </div>
          <div class="action-text"><strong>Calculators</strong><span>Mortgage tools</span></div>
        </a>

        <a href="/app/vendors" class="action-card">
          <div class="action-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path></svg>
          </div>
          <div class="action-text"><strong>Vendors</strong><span>Service providers</span></div>
        </a>

        <a href="/app/contacts" class="action-card">
          <div class="action-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </div>
          <div class="action-text"><strong>Contacts</strong><span>Your network</span></div>
        </a>

        <a href="/app/products" class="action-card">
          <div class="action-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          </div>
          <div class="action-text"><strong>Products</strong><span>Loan types</span></div>
        </a>

      </div>
    </div>

    <!-- COL 2: FAVORITES -->
    <div class="dash-section">
      <div class="section-header">
        <h3 class="section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          Favorites
        </h3>
      </div>
      <div class="favorites-list" id="favorites-list">
        <div class="empty-favorites">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          <p>Loading favorites...</p>
        </div>
      </div>
    </div>

    <!-- COL 3: TODAY'S RATES -->
    <div class="dash-section rates-section">
      <div class="section-header">
        <h3 class="section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
          Today's Avg Rates
        </h3>
      </div>
      <div class="rates-grid rates-grid-compact">
        <div class="rate-card">
          <span class="rate-label">30yr Fixed</span>
          <div class="rate-value-row">
            <span class="rate-value" id="rate-30yr">--%</span>
            <span class="rate-change neutral" id="change-30yr">--</span>
          </div>
        </div>
        <div class="rate-card">
          <span class="rate-label">15yr Fixed</span>
          <div class="rate-value-row">
            <span class="rate-value" id="rate-15yr">--%</span>
            <span class="rate-change neutral" id="change-15yr">--</span>
          </div>
        </div>
        <div class="rate-card">
          <span class="rate-label">FHA 30yr</span>
          <div class="rate-value-row">
            <span class="rate-value" id="rate-fha">--%</span>
            <span class="rate-change neutral" id="change-fha">--</span>
          </div>
        </div>
        <div class="rate-card">
          <span class="rate-label">VA 30yr</span>
          <div class="rate-value-row">
            <span class="rate-value" id="rate-va">--%</span>
            <span class="rate-change neutral" id="change-va">--</span>
          </div>
        </div>
        <div class="rate-card">
          <span class="rate-label">Jumbo 30yr</span>
          <div class="rate-value-row">
            <span class="rate-value" id="rate-jumbo">--%</span>
            <span class="rate-change neutral" id="change-jumbo">--</span>
          </div>
        </div>
        <div class="rate-card">
          <span class="rate-label">10yr Treasury</span>
          <div class="rate-value-row">
            <span class="rate-value" id="rate-10yr">--%</span>
            <span class="rate-change neutral" id="change-10yr">--</span>
          </div>
        </div>
      </div>

      <!-- Pricing Engine Links -->
      <div class="pricing-engines-strip">
        <div class="pricing-engines-label">Pricing Engines</div>
        <div class="pricing-engines-row">
          <a href="https://marketplace.digitallending.com/#/login" target="_blank" rel="noopener noreferrer" class="ppe-chip">
            <img src="https://www.google.com/s2/favicons?domain=lenderprice.com&sz=32" alt="" class="ppe-chip-logo">
            <span class="ppe-chip-name">LenderPrice</span>
            <svg class="ppe-chip-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 17L17 7"></path><path d="M7 7h10v10"></path></svg>
          </a>
          <a href="https://web.loannex.com/" target="_blank" rel="noopener noreferrer" class="ppe-chip">
            <img src="https://www.google.com/s2/favicons?domain=loannex.com&sz=32" alt="" class="ppe-chip-logo">
            <span class="ppe-chip-name">LoanNEX</span>
            <svg class="ppe-chip-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 17L17 7"></path><path d="M7 7h10v10"></path></svg>
          </a>
          <a href="https://loansifternow.optimalblue.com/" target="_blank" rel="noopener noreferrer" class="ppe-chip">
            <svg class="ppe-chip-logo-svg" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="6" fill="#0066CC"/><text x="16" y="21" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="14" fill="#fff">LS</text></svg>
            <span class="ppe-chip-name">LoanSifter</span>
            <svg class="ppe-chip-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 17L17 7"></path><path d="M7 7h10v10"></path></svg>
          </a>
          <a href="https://lx.pollyex.com/accounts/login/" target="_blank" rel="noopener noreferrer" class="ppe-chip">
            <img src="https://www.google.com/s2/favicons?domain=polly.io&sz=32" alt="" class="ppe-chip-logo">
            <span class="ppe-chip-name">Polly</span>
            <svg class="ppe-chip-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 17L17 7"></path><path d="M7 7h10v10"></path></svg>
          </a>
        </div>
      </div>

    </div>

    <!-- BOTTOM ROW: 3 COLUMNS -->
    <div class="bottom-row">

      <!-- Pipeline Tasks (replaced Recent Scenarios) -->
      <div class="dash-section">
        <div class="section-header">
          <h3 class="section-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
            Tasks
          </h3>
          <a href="/app/pipeline" class="section-link">
            View All <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </a>
        </div>
        <div class="tasks-list" id="tasks-list">
          <div class="empty-tasks">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
            <p>Loading tasks...</p>
          </div>
        </div>
      </div>

      <!-- Leads -->
      <div class="dash-section">
        <div class="section-header">
          <h3 class="section-title">Leads</h3>
          <a href="/app/pipeline" class="section-link">
            View All <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </a>
        </div>
        <div class="leads-list" id="leads-list">
          <div class="empty-leads">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            <p>Loading leads...</p>
          </div>
        </div>
      </div>

      <!-- Pipeline Overview -->
      <div class="dash-section">
        <div class="section-header">
          <h3 class="section-title">Pipeline Overview</h3>
          <a href="/app/pipeline" class="section-link">
            View All <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </a>
        </div>
        <div class="pipeline-stats-grid">

          <a href="/app/pipeline" class="pipeline-stat-card highlight">
            <div class="stat-icon white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </div>
            <div class="stat-content">
              <span class="stat-label">Pipeline Loans</span>
              <span class="stat-value" id="stat-loans">--</span>
              <span class="stat-subtext">Active in pipeline</span>
            </div>
          </a>

          <a href="/app/pipeline" class="pipeline-stat-card">
            <div class="stat-icon green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            </div>
            <div class="stat-content">
              <span class="stat-label">Pipeline Volume</span>
              <span class="stat-value" id="stat-volume">--</span>
            </div>
          </a>

          <a href="/app/pipeline" class="pipeline-stat-card">
            <div class="stat-icon amber">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            </div>
            <div class="stat-content">
              <span class="stat-label">Upcoming Closings</span>
              <span class="stat-value" id="stat-closings">--</span>
              <span class="stat-subtext">Next 14 days</span>
            </div>
          </a>

        </div>
      </div>

    </div>

  </div>
</div>
</div>
`;

// ============================================================
// DASHBOARD LOGIC (migrated from v15 JS embed)
// ============================================================
(function() {
  'use strict';

  const API_BASE = 'https://mtg-broker-api.rich-e00.workers.dev';
  const PIPELINE_API = 'https://mtg-broker-pipeline.rich-e00.workers.dev';
  const LENDERS_API = 'https://mtg-broker-lenders.rich-e00.workers.dev/api/lenders';
  const LENDER_COUNT_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  const PIPELINE_CACHE_TTL = 5 * 60 * 1000;
  const RATES_CACHE_TTL = 30 * 60 * 1000;
  const ITEMS_PER_PAGE = 5;

  let allLeads = [];
  let userEmail = null;
  let calendarMonth = new Date().getMonth();
  let calendarYear = new Date().getFullYear();
  let upcomingClosings = [];

  // ============================================================
  // MOUNT: Inject HTML into the container div, then initialize
  // ============================================================
  function mount() {
    const container = document.getElementById('dashboard-app');
    if (container) {
      container.innerHTML = DASHBOARD_HTML;
      bindEvents();
      init();
    } else {
      // DOM polling for Webflow's async script injection
      let attempts = 0;
      const interval = setInterval(function() {
        attempts++;
        const el = document.getElementById('dashboard-app');
        if (el) {
          clearInterval(interval);
          el.innerHTML = DASHBOARD_HTML;
          bindEvents();
          init();
        } else if (attempts > 100) {
          clearInterval(interval);
          console.error('dashboard-app container not found after 5 seconds');
        }
      }, 50);
    }
  }

  // ============================================================
  // EVENT BINDING (replaces inline onclick handlers)
  // ============================================================
  function bindEvents() {
    // Calendar toggle
    var dateChip = document.getElementById('dash-date');
    if (dateChip) {
      dateChip.addEventListener('click', function(event) {
        event.stopPropagation();
        var popup = document.getElementById('calendar-popup');
        popup.classList.toggle('show');
        if (popup.classList.contains('show')) {
          setTimeout(function() {
            document.addEventListener('click', closeCalendarOnClickOutside);
          }, 10);
        }
      });
    }

    // Calendar nav buttons
    var prevBtn = document.getElementById('cal-prev-btn');
    var nextBtn = document.getElementById('cal-next-btn');
    if (prevBtn) {
      prevBtn.addEventListener('click', function(event) {
        event.stopPropagation();
        calendarMonth--;
        if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
        renderCalendar();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function(event) {
        event.stopPropagation();
        calendarMonth++;
        if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
        renderCalendar();
      });
    }

    // (pagination removed — tasks section has no pagination)
  }

  function closeCalendarOnClickOutside(event) {
    var popup = document.getElementById('calendar-popup');
    var dateChip = document.getElementById('dash-date');
    if (!popup.contains(event.target) && !dateChip.contains(event.target)) {
      popup.classList.remove('show');
      document.removeEventListener('click', closeCalendarOnClickOutside);
    }
  }

  // ============================================================
  // TIMEZONE-SAFE DATE PARSING
  // ============================================================
  function parseLocalDate(dateStr) {
    if (!dateStr) return null;
    var year, month, day;
    if (dateStr.includes('-')) {
      var parts = dateStr.split('T')[0].split('-');
      year = parseInt(parts[0]);
      month = parseInt(parts[1]) - 1;
      day = parseInt(parts[2]);
    } else if (dateStr.includes('/')) {
      var parts2 = dateStr.split('/');
      month = parseInt(parts2[0]) - 1;
      day = parseInt(parts2[1]);
      year = parseInt(parts2[2]);
    } else {
      return null;
    }
    return new Date(year, month, day);
  }

  // ============================================================
  // HELPERS
  // ============================================================
  function isActiveLoan(loan) {
    var dealStatus = loan['Deal Status'] || '';
    var stage = loan['Stage'] || '';
    if (dealStatus === 'Won' || dealStatus === 'Lost') return false;
    if (stage.includes('12') || stage.toLowerCase().includes('closed')) return false;
    return true;
  }

  function isLeadLoan(loan) {
    var dealStatus = loan['Deal Status'] || '';
    if (dealStatus === 'Won' || dealStatus === 'Lost') return false;
    var stage = loan['Stage'] || '';
    return stage.includes('01') || stage.toLowerCase().includes('lead');
  }

  function getEmailFromLocalStorage() {
    try {
      var token = localStorage.getItem('Outseta.nocode.accessToken');
      if (token) {
        var payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.email) return payload.email;
      }
    } catch (e) {}
    return null;
  }

  async function getEmailFromOutseta() {
    if (typeof window.getCachedOutsetaUser === 'function') {
      try {
        var user = await window.getCachedOutsetaUser();
        if (user && user.Email) return user.Email;
      } catch (e) {}
    }
    if (typeof Outseta !== 'undefined' && Outseta.getUser) {
      try {
        var user2 = await Outseta.getUser();
        if (user2 && user2.Email) return user2.Email;
      } catch (e) {}
    }
    return null;
  }

  function getPipelineCacheKey() {
    return userEmail ? 'pipeline_loans_' + userEmail : null;
  }

  function formatCurrency(num) {
    var value = parseFloat(num);
    return isNaN(value) ? '' : '$' + value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ============================================================
  // INIT
  // ============================================================
  async function init() {
    console.log('⚡ Dashboard v1.1 (Cloudflare Pages): Starting...');
    updateDate();
    renderCalendar();

    userEmail = getEmailFromLocalStorage();
    if (!userEmail) userEmail = await getEmailFromOutseta();

    await Promise.allSettled([
      loadMortgageRates(),
      loadLenderCount(),
      loadFavorites(),
      loadPipelineData(),
      loadPipelineTasks(),
      loadUserName()
    ]);
  }

  function updateDate() {
    var el = document.getElementById('dash-date-text');
    if (el) {
      var now = new Date();
      el.textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
  }

  // ============================================================
  // CALENDAR
  // ============================================================
  function renderCalendar() {
    var grid = document.getElementById('calendar-grid');
    var titleEl = document.getElementById('calendar-month-title');
    if (!grid || !titleEl) return;

    var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    titleEl.textContent = monthNames[calendarMonth] + ' ' + calendarYear;

    var firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
    var daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    var daysInPrevMonth = new Date(calendarYear, calendarMonth, 0).getDate();
    var today = new Date();
    var isCurrentMonth = today.getMonth() === calendarMonth && today.getFullYear() === calendarYear;

    var html = dayNames.map(function(d) { return '<div class="calendar-weekday">' + d + '</div>'; }).join('');

    for (var i = firstDay - 1; i >= 0; i--) {
      html += '<div class="calendar-day other-month">' + (daysInPrevMonth - i) + '</div>';
    }

    for (var day = 1; day <= daysInMonth; day++) {
      var dateStr = calendarYear + '-' + String(calendarMonth + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      var isToday = isCurrentMonth && day === today.getDate();
      var hasClosing = upcomingClosings.some(function(c) { return c.dateStr === dateStr; });
      var classes = 'calendar-day';
      if (isToday) classes += ' today';
      if (hasClosing) classes += ' has-closing';
      html += '<div class="' + classes + '" data-date="' + dateStr + '">' + day + '</div>';
    }

    var totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    for (var d2 = 1; d2 <= totalCells - (firstDay + daysInMonth); d2++) {
      html += '<div class="calendar-day other-month">' + d2 + '</div>';
    }

    grid.innerHTML = html;
    renderCalendarClosings();
  }

  function renderCalendarClosings() {
    var container = document.getElementById('calendar-closings');
    if (!container) return;

    var now = new Date();
    now.setHours(0, 0, 0, 0);
    var thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    var relevant = upcomingClosings.filter(function(c) {
      var d = parseLocalDate(c.date);
      return d && d >= now && d <= thirtyDaysOut;
    }).slice(0, 4);

    var monthShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    if (relevant.length === 0) {
      container.innerHTML = '<div class="calendar-closings-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>Upcoming Closings</div><div class="calendar-no-closings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>No closings in the next 30 days</div>';
      return;
    }

    var html = '<div class="calendar-closings-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>Upcoming Closings</div>';

    relevant.forEach(function(c) {
      var d = parseLocalDate(c.date);
      if (d) {
        html += '<a href="/app/pipeline" class="calendar-closing-item"><div class="calendar-closing-date"><span class="calendar-closing-date-month">' + monthShort[d.getMonth()] + '</span><span class="calendar-closing-date-day">' + d.getDate() + '</span></div><div class="calendar-closing-info"><div class="calendar-closing-name">' + escapeHtml(c.borrower) + '</div><div class="calendar-closing-amount">' + c.amount + '</div></div></a>';
      }
    });

    container.innerHTML = html;
  }

  // ============================================================
  // USER NAME
  // ============================================================
  async function loadUserName() {
    try {
      var user = null;
      if (typeof window.getCachedOutsetaUser === 'function') user = await window.getCachedOutsetaUser();
      else if (typeof Outseta !== 'undefined' && Outseta.getUser) user = await Outseta.getUser();

      if (user) {
        var firstName = user.FirstName || (user.FullName ? user.FullName.split(' ')[0] : '');
        if (firstName) {
          var el = document.querySelector('.dash-title');
          if (el) el.textContent = 'Welcome back, ' + firstName + '!';
        }
      }
    } catch (e) {}
  }

  // ============================================================
  // PIPELINE DATA
  // ============================================================
  async function loadPipelineData() {
    if (!userEmail) {
      updatePipelineUI({ loans: 0, volume: 0, closings: 0 });
      updateLeadsUI([]);
      return;
    }

    var cacheKey = getPipelineCacheKey();
    var cached = sessionStorage.getItem(cacheKey);

    if (cached) {
      try {
        var parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < PIPELINE_CACHE_TTL) {
          var loans = Array.isArray(parsed.data) ? parsed.data.map(function(r) { return Object.assign({ id: r.id }, r.fields); }) : [];
          if (loans.length > 0) {
            updatePipelineUI(calculatePipelineStats(loans));
            updateLeadsUI(loans.filter(function(l) { return isLeadLoan(l); }));
            extractUpcomingClosings(loans);
            return;
          }
        }
      } catch (e) {}
    }

    var dashCacheKey = 'dash_pipeline_' + userEmail;
    var dashCached = sessionStorage.getItem(dashCacheKey);
    if (dashCached) {
      try {
        var parsed2 = JSON.parse(dashCached);
        if (Date.now() - parsed2.timestamp < PIPELINE_CACHE_TTL) {
          updatePipelineUI(parsed2.data);
          updateLeadsUI(parsed2.leads || []);
          if (parsed2.closingsData) { upcomingClosings = parsed2.closingsData; renderCalendar(); }
          return;
        }
      } catch (e) {}
    }

    try {
      var response = await fetch(API_BASE + '/api/pipeline/loans', {
        headers: { 'Authorization': 'Bearer ' + userEmail, 'Content-Type': 'application/json' }
      });
      if (!response.ok) { updatePipelineUI({ loans: 0, volume: 0, closings: 0 }); updateLeadsUI([]); return; }

      var rawData = await response.json();
      var loans2 = Array.isArray(rawData) ? rawData.map(function(r) { return Object.assign({ id: r.id }, r.fields); }) : [];

      if (loans2.length > 0) {
        var stats = calculatePipelineStats(loans2);
        var leadLoans = loans2.filter(function(l) { return isLeadLoan(l); });
        extractUpcomingClosings(loans2);

        sessionStorage.setItem(dashCacheKey, JSON.stringify({ data: stats, leads: leadLoans, closingsData: upcomingClosings, timestamp: Date.now() }));
        updatePipelineUI(stats);
        updateLeadsUI(leadLoans);
      } else {
        updatePipelineUI({ loans: 0, volume: 0, closings: 0 });
        updateLeadsUI([]);
        updateTasksUI([]);
      }
    } catch (e) {
      updatePipelineUI({ loans: 0, volume: 0, closings: 0 });
      updateLeadsUI([]);
      updateTasksUI([]);
    }
  }

  function extractUpcomingClosings(loans) {
    var now = new Date();
    now.setHours(0, 0, 0, 0);

    upcomingClosings = loans.filter(function(l) {
      if (!isActiveLoan(l)) return false;
      var closeDate = l['Expected Close'];
      if (!closeDate) return false;
      var d = parseLocalDate(closeDate);
      return d && d >= now;
    }).map(function(l) {
      var d = parseLocalDate(l['Expected Close']);
      return {
        date: l['Expected Close'],
        dateStr: d ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') : '',
        borrower: l['Borrower Name'] || 'Unknown',
        amount: l['Loan Amount'] ? formatCurrency(l['Loan Amount']) : ''
      };
    }).filter(function(c) { return c.dateStr; }).sort(function(a, b) {
      var dateA = parseLocalDate(a.date);
      var dateB = parseLocalDate(b.date);
      return (dateA || 0) - (dateB || 0);
    });

    renderCalendar();
  }

  function calculatePipelineStats(loans) {
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    var in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    var activeLoans = loans.filter(function(l) { return isActiveLoan(l); });

    return {
      loans: activeLoans.length,
      volume: activeLoans.reduce(function(sum, l) { return sum + (parseFloat(l['Loan Amount']) || 0); }, 0),
      closings: activeLoans.filter(function(l) {
        var closeDate = l['Expected Close'];
        if (!closeDate) return false;
        var d = parseLocalDate(closeDate);
        return d && d >= now && d <= in14Days;
      }).length
    };
  }

  function updatePipelineUI(stats) {
    var loansEl = document.getElementById('stat-loans');
    var volumeEl = document.getElementById('stat-volume');
    var closingsEl = document.getElementById('stat-closings');
    if (loansEl) loansEl.textContent = stats.loans;
    if (volumeEl) volumeEl.textContent = formatCurrency(stats.volume);
    if (closingsEl) closingsEl.textContent = stats.closings;
  }

  function updateLeadsUI(leads) {
    var listEl = document.getElementById('leads-list');
    if (!listEl) return;
    allLeads = leads;

    if (leads.length === 0) {
      listEl.innerHTML = '<div class="empty-leads"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path></svg><p>No leads in pipeline.</p><a href="/app/pipeline">Add a new lead &rarr;</a></div>';
      return;
    }

    listEl.innerHTML = leads.slice(0, 5).map(function(lead) {
      var name = lead['Borrower Name'] || 'Unknown';
      var amount = lead['Loan Amount'] ? formatCurrency(lead['Loan Amount']) : '';
      var type = lead['Loan Type'] || '';
      var meta = [escapeHtml(type), escapeHtml(amount)].filter(Boolean).join(' &bull; ');
      return '<a href="/app/pipeline" class="lead-item"><div class="lead-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div><div class="lead-details"><span class="lead-name">' + escapeHtml(name) + '</span><span class="lead-meta">' + (meta || 'Lead') + '</span></div><svg class="lead-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg></a>';
    }).join('');
  }

  // ============================================================
  // LENDER COUNT
  // ============================================================
  async function loadLenderCount() {
    var el = document.getElementById('lender-count-display');
    if (!el) return;

    el.textContent = '...';

    var cacheKey = 'dash_lender_count';
    try {
      var cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < LENDER_COUNT_CACHE_TTL) {
          el.textContent = parsed.count;
          return;
        }
      }
    } catch (e) {}

    try {
      var response = await fetch(LENDERS_API);
      if (!response.ok) throw new Error('API error');
      var data = await response.json();

      var count = data.count != null
        ? data.count
        : (Array.isArray(data.lenders) ? data.lenders.length : 0);

      sessionStorage.setItem(cacheKey, JSON.stringify({ count: count, timestamp: Date.now() }));
      el.textContent = count;
    } catch (e) {
      el.textContent = '--';
    }
  }

  // ============================================================
  // MORTGAGE RATES
  // ============================================================
  async function loadMortgageRates() {
    var cached = sessionStorage.getItem('dash_mnd_rates');
    if (cached) {
      try {
        var parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < RATES_CACHE_TTL) { updateRatesUI(parsed.data); return; }
      } catch (e) {}
    }

    try {
      var response = await fetch(API_BASE + '/api/rates');
      if (!response.ok) return;
      var result = await response.json();
      if (result.success && result.data) {
        sessionStorage.setItem('dash_mnd_rates', JSON.stringify({ data: result.data, timestamp: Date.now() }));
        updateRatesUI(result.data);
      }
    } catch (e) {}
  }

  function updateRatesUI(rates) {
    function formatChange(change, elementId) {
      var el = document.getElementById(elementId);
      if (!el) return;
      var num = parseFloat(change);
      var displayVal = (num >= 0 ? '+' : '') + num.toFixed(2);
      if (num > 0) {
        el.className = 'rate-change up';
        el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="18 15 12 9 6 15"></polyline></svg>' + displayVal;
      } else if (num < 0) {
        el.className = 'rate-change down';
        el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"></polyline></svg>' + displayVal;
      } else {
        el.className = 'rate-change neutral';
        el.textContent = displayVal;
      }
    }

    if (rates['30yr']) { document.getElementById('rate-30yr').textContent = rates['30yr'].rate + '%'; formatChange(rates['30yr'].change, 'change-30yr'); }
    if (rates['15yr']) { document.getElementById('rate-15yr').textContent = rates['15yr'].rate + '%'; formatChange(rates['15yr'].change, 'change-15yr'); }
    if (rates['fha']) { document.getElementById('rate-fha').textContent = rates['fha'].rate + '%'; formatChange(rates['fha'].change, 'change-fha'); }
    if (rates['va']) { document.getElementById('rate-va').textContent = rates['va'].rate + '%'; formatChange(rates['va'].change, 'change-va'); }
    if (rates['jumbo']) { document.getElementById('rate-jumbo').textContent = rates['jumbo'].rate + '%'; formatChange(rates['jumbo'].change, 'change-jumbo'); }
    if (rates['10yr']) { document.getElementById('rate-10yr').textContent = rates['10yr'].rate + '%'; formatChange(rates['10yr'].change, 'change-10yr'); }
  }

  // ============================================================
  // PIPELINE TASKS — fetch from dedicated tasks API
  // ============================================================
  async function loadPipelineTasks() {
    var listEl = document.getElementById('tasks-list');
    if (!listEl || !userEmail) {
      if (listEl) listEl.innerHTML = '<div class="empty-tasks"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg><p>No pending tasks.</p><a href="/app/pipeline">Go to Pipeline &rarr;</a></div>';
      return;
    }

    try {
      var response = await fetch(PIPELINE_API + '/api/pipeline/tasks', {
        headers: { 'Authorization': 'Bearer ' + userEmail }
      });
      if (!response.ok) throw new Error('API error');
      var records = await response.json();

      // Filter to incomplete tasks only
      var pending = (Array.isArray(records) ? records : []).filter(function(r) {
        return !r.fields['Completed'];
      });

      if (pending.length === 0) {
        listEl.innerHTML = '<div class="empty-tasks"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg><p>No pending tasks.</p><a href="/app/pipeline">Go to Pipeline &rarr;</a></div>';
        return;
      }

      // Sort by due date (soonest first), no-date items at end
      pending.sort(function(a, b) {
        var da = a.fields['Due Date'] || '';
        var db = b.fields['Due Date'] || '';
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da.localeCompare(db);
      });

      listEl.innerHTML = pending.slice(0, 8).map(function(r) {
        var name = r.fields['Task Name'] || 'Untitled task';
        var dueDate = r.fields['Due Date'];
        var dueMeta = '';
        if (dueDate) {
          var d = parseLocalDate(dueDate);
          if (d) {
            var now = new Date(); now.setHours(0,0,0,0);
            var diff = Math.round((d - now) / (1000 * 60 * 60 * 24));
            if (diff < 0) dueMeta = 'Overdue';
            else if (diff === 0) dueMeta = 'Due today';
            else if (diff === 1) dueMeta = 'Due tomorrow';
            else dueMeta = 'Due ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          }
        }
        var overdue = dueMeta === 'Overdue' ? ' task-overdue' : '';
        return '<a href="/app/pipeline" class="task-item' + overdue + '"><div class="task-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg></div><div class="task-details"><span class="task-label">' + escapeHtml(name) + '</span>' + (dueMeta ? '<span class="task-meta">' + dueMeta + '</span>' : '') + '</div></a>';
      }).join('');
    } catch (e) {
      listEl.innerHTML = '<div class="empty-tasks"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg><p>No pending tasks.</p><a href="/app/pipeline">Go to Pipeline &rarr;</a></div>';
    }
  }

  // ============================================================
  // FAVORITES — load from API
  // ============================================================
  async function loadFavorites() {
    var listEl = document.getElementById('favorites-list');
    if (!listEl) return;

    if (!userEmail) {
      listEl.innerHTML = '<div class="empty-favorites"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg><p>No favorites yet.</p><a href="/app/lenders">Browse lenders &rarr;</a></div>';
      return;
    }

    try {
      var response = await fetch(API_BASE + '/api/favorites', {
        headers: { 'Authorization': 'Bearer ' + userEmail }
      });
      if (!response.ok) throw new Error('API error');
      var data = await response.json();
      var favorites = data.favorites || [];

      if (favorites.length === 0) {
        listEl.innerHTML = '<div class="empty-favorites"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg><p>No favorites yet.</p><a href="/app/lenders">Browse lenders &rarr;</a></div>';
        return;
      }

      // Group by type
      var typeIcons = {
        'Lender': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21v-7M19 21v-7M9 21v-7M15 21v-7M3 10h18M12 3L2 10h20L12 3z"></path></svg>',
        'Vendor': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path></svg>',
        'Contact': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>'
      };
      var typeLinks = {
        'Lender': '/app/lenders',
        'Vendor': '/app/vendors',
        'Contact': '/app/contacts'
      };
      var typeColors = {
        'Lender': 'fav-icon-blue',
        'Vendor': 'fav-icon-purple',
        'Contact': 'fav-icon-green'
      };

      // Group by type
      var groups = {};
      favorites.forEach(function(fav) {
        var t = fav.itemType || 'Other';
        if (!groups[t]) groups[t] = [];
        groups[t].push(fav);
      });

      var html = '';
      ['Lender', 'Vendor', 'Contact'].forEach(function(type) {
        var items = groups[type];
        if (!items || items.length === 0) return;
        var icon = typeIcons[type];
        var link = typeLinks[type];
        var colorClass = typeColors[type];
        html += '<div class="fav-group"><div class="fav-group-label">' + icon + ' ' + type + 's</div>';
        html += items.slice(0, 4).map(function(fav) {
          return '<a href="' + link + '" class="fav-chip ' + colorClass + '">' + escapeHtml(fav.itemName) + '</a>';
        }).join('');
        html += '</div>';
      });

      listEl.innerHTML = html;
    } catch (e) {
      listEl.innerHTML = '<div class="empty-favorites"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg><p>No favorites yet.</p><a href="/app/lenders">Browse lenders &rarr;</a></div>';
    }
  }

  // ============================================================
  // MOUNT ON LOAD
  // ============================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

})();

/* ============================================================
   DASHBOARD — Cloudflare Pages Bundle
   Combines CSS + HTML + JS into a single deployable file.
   Loaded via <script> tag in a Webflow HtmlEmbed.

   Version: 1.0.0 (migrated from Webflow embeds v13 CSS / v13 HTML / v15 JS)
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

  <!-- Main Grid -->
  <div class="dash-grid">

    <!-- TOP LEFT: QUICK ACTIONS -->
    <div class="dash-section">
      <div class="section-header">
        <h3 class="section-title">Quick Actions</h3>
      </div>
      <div class="actions-grid">

        <!-- Loan Search - Highlighted -->
        <a href="/app/loan-search" class="action-card highlight-card">
          <div class="action-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
          <div class="action-text">
            <strong>Loan Search</strong>
            <span>630+ products</span>
          </div>
        </a>

        <!-- Lenders -->
        <a href="/app/lenders" class="action-card">
          <div class="action-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21v-7M19 21v-7M9 21v-7M15 21v-7M3 10h18M12 3L2 10h20L12 3z"></path></svg>
          </div>
          <div class="action-text">
            <strong>Lenders</strong>
            <span><span id="lender-count-display">--</span> in directory</span>
          </div>
        </a>

        <!-- Calculators -->
        <a href="/app/calculators" class="action-card">
          <div class="action-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="8" x2="16" y1="6" y2="6"></line><path d="M16 10h.01M12 10h.01M8 10h.01M16 14h.01M12 14h.01M8 14h.01M16 18h.01M12 18h.01M8 18h.01"></path></svg>
          </div>
          <div class="action-text"><strong>Calculators</strong><span>Mortgage tools</span></div>
        </a>

        <!-- Vendors -->
        <a href="/app/vendors" class="action-card">
          <div class="action-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path></svg>
          </div>
          <div class="action-text"><strong>Vendors</strong><span>Service providers</span></div>
        </a>

        <!-- Contacts -->
        <a href="/app/contacts" class="action-card">
          <div class="action-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </div>
          <div class="action-text"><strong>Contacts</strong><span>Your network</span></div>
        </a>

        <!-- Products -->
        <a href="/app/products" class="action-card">
          <div class="action-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          </div>
          <div class="action-text"><strong>Products</strong><span>Loan types</span></div>
        </a>

      </div>
    </div>

    <!-- TOP RIGHT: TODAY'S RATES -->
    <div class="dash-section rates-section">
      <div class="section-header">
        <h3 class="section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
          Today's Avg Rates
        </h3>
      </div>
      <div class="rates-grid">
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

      <!-- Pricing Engine Quick Links -->
      <div class="pricing-engines-strip">
        <div class="pricing-engines-label">Pricing Engines</div>
        <div class="pricing-engines-row">

          <a href="https://marketplace.digitallending.com/#/login" target="_blank" rel="noopener noreferrer" class="ppe-btn">
            <img src="https://www.google.com/s2/favicons?domain=lenderprice.com&sz=32" alt="" class="ppe-btn-logo">
            <span class="ppe-btn-name">LenderPrice</span>
            <svg class="ppe-btn-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7"></path><path d="M7 7h10v10"></path></svg>
          </a>

          <a href="https://web.loannex.com/" target="_blank" rel="noopener noreferrer" class="ppe-btn">
            <img src="https://www.google.com/s2/favicons?domain=loannex.com&sz=32" alt="" class="ppe-btn-logo">
            <span class="ppe-btn-name">LoanNEX</span>
            <svg class="ppe-btn-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7"></path><path d="M7 7h10v10"></path></svg>
          </a>

          <a href="https://loansifternow.optimalblue.com/" target="_blank" rel="noopener noreferrer" class="ppe-btn">
            <img src="data:image/jpeg;base64,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" alt="" class="ppe-btn-logo">
            <span class="ppe-btn-name">LoanSifter</span>
            <svg class="ppe-btn-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7"></path><path d="M7 7h10v10"></path></svg>
          </a>

          <a href="https://lx.pollyex.com/accounts/login/" target="_blank" rel="noopener noreferrer" class="ppe-btn">
            <img src="https://www.google.com/s2/favicons?domain=polly.io&sz=32" alt="" class="ppe-btn-logo">
            <span class="ppe-btn-name">Polly</span>
            <svg class="ppe-btn-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7"></path><path d="M7 7h10v10"></path></svg>
          </a>

        </div>
      </div>

    </div>

    <!-- BOTTOM ROW: 3 COLUMNS -->
    <div class="bottom-row">

      <!-- Recent Scenarios -->
      <div class="dash-section">
        <div class="section-header">
          <h3 class="section-title">Recent Scenarios</h3>
          <a href="/app/calculators" class="section-link">
            View All <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </a>
        </div>
        <div class="scenarios-container">
          <div class="scenarios-list" id="scenarios-list"></div>
          <div class="scenarios-pagination" id="scenarios-pagination" style="display: none;">
            <button class="pagination-btn" id="prev-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <span class="pagination-info" id="pagination-info">1 of 1</span>
            <button class="pagination-btn" id="next-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
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
  const LENDERS_API = 'https://mtg-broker-lenders.rich-e00.workers.dev/api/lenders';
  const LENDER_COUNT_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  const PIPELINE_CACHE_TTL = 5 * 60 * 1000;
  const RATES_CACHE_TTL = 30 * 60 * 1000;
  const ITEMS_PER_PAGE = 5;

  let allScenarios = [];
  let currentPage = 0;
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

    // Pagination buttons
    var prevPageBtn = document.getElementById('prev-btn');
    var nextPageBtn = document.getElementById('next-btn');
    if (prevPageBtn) {
      prevPageBtn.addEventListener('click', function() {
        if (currentPage > 0) { currentPage--; renderScenarios(); }
      });
    }
    if (nextPageBtn) {
      nextPageBtn.addEventListener('click', function() {
        var totalPages = Math.ceil(allScenarios.length / ITEMS_PER_PAGE);
        if (currentPage < totalPages - 1) { currentPage++; renderScenarios(); }
      });
    }
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
    console.log('⚡ Dashboard v1.0 (Cloudflare Pages): Starting...');
    updateDate();
    renderCalendar();

    userEmail = getEmailFromLocalStorage();
    if (!userEmail) userEmail = await getEmailFromOutseta();

    await Promise.allSettled([
      loadMortgageRates(),
      loadLenderCount(),
      loadSavedScenarios(),
      loadPipelineData(),
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
      }
    } catch (e) {
      updatePipelineUI({ loans: 0, volume: 0, closings: 0 });
      updateLeadsUI([]);
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
      var meta = [type, amount].filter(Boolean).join(' &bull; ');
      return '<a href="/app/pipeline" class="lead-item"><div class="lead-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div><div class="lead-details"><span class="lead-name">' + escapeHtml(name) + '</span><span class="lead-meta">' + (escapeHtml(meta) || 'Lead') + '</span></div><svg class="lead-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg></a>';
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
  // SAVED SCENARIOS
  // ============================================================
  function loadSavedScenarios() {
    var sources = [
      { key: 'mtg_rentvsbuy', label: 'Rent vs Buy', link: '/app/rent-vs-buy' },
      { key: 'mtg_calc_basic', label: 'Mortgage Calc', link: '/app/calc-mortgage' },
      { key: 'mtg_affordability', label: 'Affordability', link: '/app/affordability' },
      { key: 'lender_pricing_saves', label: 'Loan Comparison', link: '/app/lender-pricing-comparison' },
      { key: 'mtg_compare_save', label: 'Compare', link: '/app/calc-compare' },
      { key: 'mtg_compare_library', label: 'Compare Library', link: '/app/calc-compare' }
    ];

    var items = [];
    sources.forEach(function(source) {
      try {
        var raw = localStorage.getItem(source.key);
        if (!raw) return;
        var data = JSON.parse(raw);
        if (Array.isArray(data)) {
          data.forEach(function(item, index) {
            items.push({
              name: item.scenName || item.name || item.title || item['global-name'] || source.label + ' ' + (index + 1),
              type: source.label,
              date: item.scenDate || item.timestamp || item.date || item.createdAt || item['global-date'] || '',
              link: source.link
            });
          });
        } else if (typeof data === 'object') {
          Object.keys(data).forEach(function(itemKey) {
            var item = data[itemKey];
            if (typeof item === 'object' && item !== null) {
              items.push({
                name: item.scenName || item.name || item.title || item['global-name'] || itemKey,
                type: source.label,
                date: item.scenDate || item.timestamp || item.date || item.createdAt || item['global-date'] || '',
                link: source.link
              });
            }
          });
        }
      } catch (e) {}
    });

    var seen = new Set();
    items = items.filter(function(item) { if (seen.has(item.name)) return false; seen.add(item.name); return true; });
    items.sort(function(a, b) {
      var parseDate = function(str) {
        if (!str) return 0;
        var d = new Date(str);
        if (!isNaN(d.getTime())) return d.getTime();
        var parts = str.split('/');
        if (parts.length === 3) { d = new Date(parts[2], parts[0] - 1, parts[1]); if (!isNaN(d.getTime())) return d.getTime(); }
        return 0;
      };
      return parseDate(b.date) - parseDate(a.date);
    });

    allScenarios = items;
    currentPage = 0;
    renderScenarios();
  }

  function renderScenarios() {
    var list = document.getElementById('scenarios-list');
    var pagination = document.getElementById('scenarios-pagination');

    if (allScenarios.length === 0) {
      list.innerHTML = '<div class="empty-scenarios"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg><p>No saved scenarios yet.</p><a href="/app/calculators">Create your first one &rarr;</a></div>';
      pagination.style.display = 'none';
      return;
    }

    var totalPages = Math.ceil(allScenarios.length / ITEMS_PER_PAGE);
    var start = currentPage * ITEMS_PER_PAGE;
    var pageItems = allScenarios.slice(start, start + ITEMS_PER_PAGE);

    list.innerHTML = pageItems.map(function(item) {
      var initials = item.type.split(' ').map(function(w) { return w[0]; }).join('').substring(0, 2).toUpperCase();
      var displayDate = '';
      if (item.date) {
        var d = new Date(item.date);
        displayDate = !isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) : (item.date.split(',')[0] || item.date);
      }
      return '<a href="' + item.link + '" class="scenario-item"><div class="scenario-icon">' + initials + '</div><div class="scenario-details"><span class="scenario-name">' + item.name + '</span><span class="scenario-meta">' + item.type + (displayDate ? ' &bull; ' + displayDate : '') + '</span></div><svg class="scenario-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg></a>';
    }).join('');

    if (totalPages > 1) {
      pagination.style.display = 'flex';
      document.getElementById('pagination-info').textContent = (currentPage + 1) + ' of ' + totalPages;
      document.getElementById('prev-btn').disabled = currentPage === 0;
      document.getElementById('next-btn').disabled = currentPage >= totalPages - 1;
    } else {
      pagination.style.display = 'none';
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

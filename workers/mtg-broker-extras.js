/**
 * Cloudflare Worker — mtg-broker-extras
 * Serves the feature extras JS (upgrade CTAs + limit indicators)
 *
 * DEPLOY: Worker named "mtg-broker-extras" in Cloudflare Dashboard
 * URL: mtg-broker-extras.rich-e00.workers.dev
 * Called by: <script src="https://mtg-broker-extras.rich-e00.workers.dev/static/feature-extras.js" defer>
 *
 * v2.0 — March 22, 2026
 *   Section 7 (LITE CTAs):
 *   - Dashboard card is now dismissible (persists via sessionStorage)
 *   - Fixed loan search CTA — uses reliable selector cascade instead of
 *     .loan-search-header (which doesn't exist in the actual DOM)
 *   - Better fallback selector chains for all DOM insertions
 *   - Removed placeholder .pipeline-stats-grid/.leads-list selectors;
 *     now targets .pipeline-widget, .scenarios-list, and common dashboard
 *     section names — update these after confirming actual Dashboard DOM
 *   Section 8 (PLUS limit indicators):
 *   - Pipeline pill: at 25/25, shows red pill + inline "Upgrade to PRO →" link
 *   - Pipeline pill: tries multiple header selectors before giving up
 *   - Calc saves pill: no longer requires #saveStatus — uses .btn-save
 *     parent as fallback, appends directly to btn container
 *   - Pill icons now context-aware (gauge → warning triangle → X at limit)
 *   Cache-Control: updated to max-age=300 / stale-while-revalidate=3600
 *     (per fixed-URL deployment policy — 5 min refresh, no spinner)
 *
 * v1.1 — prior version (placeholder CTAs, 1h cache)
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
    return new Response(FEATURE_EXTRAS_JS, {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        // 5-min refresh, stale-while-revalidate = no spinner on next visit
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
        ...getCorsHeaders(request)
      }
    });
  }
};


// ============================================================
// FEATURE EXTRAS JS
// Section 7: Upgrade CTAs for LITE users
// Section 8: Limit indicators for PLUS users
// ============================================================
const FEATURE_EXTRAS_JS = String.raw`

// ============================================================
// SECTION 7: UPGRADE CTAs FOR LITE USERS
// Runs only for LITE plan. Shows dismissible upgrade nudges
// on the Dashboard and Loan Search pages.
// ============================================================
(function() {
  'use strict';

  // ── Shared CSS ──────────────────────────────────────────────
  var css = document.createElement('style');
  css.textContent = [
    // Standard upgrade banner (horizontal pill row)
    '.mtg-ubanner{display:flex;align-items:center;gap:14px;background:linear-gradient(135deg,#EFF6FF 0%,#DBEAFE 100%);border:1px solid #BFDBFE;border-radius:12px;padding:16px 18px;margin-bottom:20px;font-family:Host Grotesk,system-ui,sans-serif;position:relative;box-sizing:border-box;}',
    '.mtg-ubanner .ub-icon{flex-shrink:0;width:40px;height:40px;background:linear-gradient(135deg,#2563EB 0%,#1D4ED8 100%);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:17px;}',
    '.mtg-ubanner .ub-body{flex:1;min-width:0;}',
    '.mtg-ubanner .ub-title{font-size:14px;font-weight:700;color:#1E234C;margin:0 0 2px;}',
    '.mtg-ubanner .ub-text{font-size:13px;color:#64748b;margin:0;line-height:1.4;}',
    '.mtg-ubanner .ub-btn{flex-shrink:0;padding:9px 18px;background:linear-gradient(135deg,#2563EB 0%,#1D4ED8 100%);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;transition:transform .15s,box-shadow .15s;box-shadow:0 2px 8px rgba(37,99,235,.25);}',
    '.mtg-ubanner .ub-btn:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(37,99,235,.35);}',
    // Dismiss X button
    '.mtg-ubanner .ub-dismiss{position:absolute;top:8px;right:10px;background:none;border:none;font-size:18px;color:#94a3b8;cursor:pointer;line-height:1;padding:2px 4px;}',
    '.mtg-ubanner .ub-dismiss:hover{color:#475569;}',
    // Hero variant — darker, for top of dashboard
    '.mtg-ubanner-hero{background:linear-gradient(135deg,#1E3A5F 0%,#1E234C 100%) !important;border:none !important;border-radius:14px !important;padding:22px 20px !important;}',
    '.mtg-ubanner-hero .ub-icon{background:rgba(255,255,255,.18) !important;}',
    '.mtg-ubanner-hero .ub-title{font-size:16px !important;color:#fff !important;}',
    '.mtg-ubanner-hero .ub-text{color:#94A3B8 !important;}',
    '.mtg-ubanner-hero .ub-btn{font-size:14px;padding:10px 20px;}',
    '.mtg-ubanner-hero .ub-dismiss{color:rgba(255,255,255,.4);}',
    '.mtg-ubanner-hero .ub-dismiss:hover{color:rgba(255,255,255,.7);}',
    // Section prompt (centered, for locked widget areas)
    '.mtg-sprompt{text-align:center;padding:24px 16px;font-family:Host Grotesk,system-ui,sans-serif;}',
    '.mtg-sprompt .sp-icon{font-size:24px;color:#CBD5E1;margin-bottom:6px;}',
    '.mtg-sprompt .sp-title{font-size:13px;font-weight:600;color:#64748b;margin:0 0 4px;}',
    '.mtg-sprompt .sp-text{font-size:12px;color:#94A3B8;margin:0 0 10px;line-height:1.4;}',
    '.mtg-sprompt .sp-btn{display:inline-block;padding:7px 16px;background:#2563EB;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;}',
    // Responsive
    '@media(max-width:600px){.mtg-ubanner{flex-wrap:wrap;}.mtg-ubanner .ub-btn{width:100%;}}'
  ].join('');
  document.head.appendChild(css);


  // ── Factory: create upgrade banner element ──────────────────
  // opts: { icon, title, text, btnText, hero, dismissible, dismissKey }
  function makeBanner(opts) {
    var el = document.createElement('div');
    el.className = 'mtg-ubanner' + (opts.hero ? ' mtg-ubanner-hero' : '');
    el.innerHTML =
      (opts.dismissible ? '<button class="ub-dismiss" aria-label="Dismiss">\xd7</button>' : '') +
      '<div class="ub-icon"><i class="fa-solid ' + opts.icon + '"></i></div>' +
      '<div class="ub-body">' +
        '<p class="ub-title">' + opts.title + '</p>' +
        '<p class="ub-text">' + opts.text + '</p>' +
      '</div>' +
      '<button class="ub-btn">' + (opts.btnText || 'Upgrade Now') + '</button>';

    el.querySelector('.ub-btn').addEventListener('click', function() {
      if (window.MTG_Billing && window.MTG_Billing.openOutsetaPlanPicker) {
        window.MTG_Billing.openOutsetaPlanPicker();
      }
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


  // ── Factory: create section prompt element ──────────────────
  // opts: { icon, title, text, btnText }
  function makePrompt(opts) {
    var el = document.createElement('div');
    el.className = 'mtg-sprompt';
    el.innerHTML =
      '<div class="sp-icon"><i class="fa-solid ' + opts.icon + '"></i></div>' +
      '<p class="sp-title">' + opts.title + '</p>' +
      '<p class="sp-text">' + opts.text + '</p>' +
      '<button class="sp-btn">' + (opts.btnText || 'Upgrade') + '</button>';
    el.querySelector('.sp-btn').addEventListener('click', function() {
      if (window.MTG_Billing && window.MTG_Billing.openOutsetaPlanPicker) {
        window.MTG_Billing.openOutsetaPlanPicker();
      }
    });
    return el;
  }


  // ── Helper: insert child before firstChild of first matching selector ──
  function prependTo(selectorList, child) {
    for (var i = 0; i < selectorList.length; i++) {
      var el = document.querySelector(selectorList[i]);
      if (el) {
        el.insertBefore(child, el.firstChild);
        return true;
      }
    }
    return false;
  }


  // ── Dashboard CTAs ──────────────────────────────────────────
  function addDashboardCTAs() {
    var path = window.location.pathname.toLowerCase();
    if (path !== '/app/dashboard' && path !== '/app/dashboard/') return;

    // Don't show if user dismissed this session
    if (sessionStorage.getItem('mtg_dash_cta_dismissed')) return;

    setTimeout(function() {

      // --- Hero upgrade card at top of content area ---
      var hero = makeBanner({
        hero: true,
        icon: 'fa-rocket',
        title: 'Unlock the full mtg.broker toolkit',
        text: 'Upgrade to PLUS for Pipeline tracking, all 14+ calculators, cloud-saved scenarios, and PDF export — or go PRO for unlimited everything.',
        btnText: 'See Plans & Pricing',
        dismissible: true,
        dismissKey: 'mtg_dash_cta_dismissed'
      });

      // Try selector cascade — these are the most likely Dashboard DOM structures.
      // Update these selectors after confirming actual Dashboard HTML class names.
      var inserted = prependTo([
        '.main-content-area',
        '.dash-content',
        '.dash-main',
        '.dashboard-content',
        '.app-page-content',
        '.main-content-section > div'
      ], hero);

      if (!inserted) {
        // Last resort: first div inside main content wrapper
        var main = document.querySelector('main, .main-content-section, [class*="main"]');
        if (main) main.insertBefore(hero, main.firstChild);
      }

      // --- Pipeline stats widget ---
      // Replace empty pipeline stat widget with an upgrade prompt.
      // ⚠️ Update selector below to match actual Dashboard Pipeline widget class.
      var pipelineWidget = document.querySelector(
        '.pipeline-stats-grid, .pipeline-summary, .pipeline-widget, #pipeline-stats, [data-widget="pipeline"]'
      );
      if (pipelineWidget && !pipelineWidget.querySelector('.mtg-sprompt')) {
        pipelineWidget.innerHTML = '';
        pipelineWidget.appendChild(makePrompt({
          icon: 'fa-chart-line',
          title: 'Pipeline — PLUS & PRO',
          text: 'Track your loans from lead to close. Up to 25 active loans on PLUS.',
          btnText: 'Unlock Pipeline'
        }));
      }

      // --- Saved scenarios widget ---
      // ⚠️ Update selector below to match actual Dashboard saved-scenarios widget class.
      var scenariosWidget = document.querySelector(
        '#scenarios-list, .scenarios-list, .saved-scenarios, [data-widget="scenarios"]'
      );
      if (scenariosWidget && !scenariosWidget.querySelector('.mtg-sprompt')) {
        scenariosWidget.innerHTML = '';
        scenariosWidget.appendChild(makePrompt({
          icon: 'fa-cloud-arrow-up',
          title: 'Saved Scenarios — PLUS & PRO',
          text: 'Save and reload calculator setups anytime. 10 saves per tool on PLUS.',
          btnText: 'Unlock Saves'
        }));
      }

    }, 700); // wait for dashboard content to render
  }


  // ── Loan Search CTA ─────────────────────────────────────────
  function addLoanSearchCTA() {
    var path = window.location.pathname.toLowerCase();
    if (!path.startsWith('/app/loan-search')) return;

    setTimeout(function() {
      var banner = makeBanner({
        icon: 'fa-magnifying-glass-dollar',
        title: 'See full loan details with PLUS or PRO',
        text: 'Click any product row to view complete specs, rates, LTV/DTI guidelines, and matrix links. Included with every paid plan.',
        btnText: 'Upgrade'
      });

      // Try selector cascade — matches actual Loan Search HTML structure (v7.7)
      prependTo([
        '.loan-search-controls',   // actual class in Loan Search HTML embed
        '.loan-search-layout',
        '.loan-search-main',
        '.search-controls',
        '#loan-search-app',
        '.app-page-content'
      ], banner);
    }, 700);
  }


  // ── Initialize ──────────────────────────────────────────────
  async function initialize() {
    // Poll for MTG_Billing ready (max 6 seconds)
    for (var i = 0; i < 60; i++) {
      if (window.MTG_Billing && window.MTG_Billing.state === 'ready') break;
      await new Promise(function(r) { setTimeout(r, 100); });
    }
    if (!window.MTG_Billing || window.MTG_Billing.state !== 'ready') return;

    var plan = await window.MTG_Billing.getUserPlan();
    if (plan !== 'LITE') return; // Section 7 is LITE-only

    var path = window.location.pathname.toLowerCase();
    if (path === '/app/dashboard' || path === '/app/dashboard/') addDashboardCTAs();
    if (path.startsWith('/app/loan-search')) addLoanSearchCTA();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();


// ============================================================
// SECTION 8: LIMIT INDICATORS (PLUS USERS ONLY)
// Shows loan count pill on Pipeline + saves pill on calculators.
// ============================================================
(function() {
  'use strict';

  // ── CSS ─────────────────────────────────────────────────────
  var css = document.createElement('style');
  css.textContent = [
    '.mtg-lpill{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;font-family:Host Grotesk,system-ui,sans-serif;white-space:nowrap;line-height:1;vertical-align:middle;}',
    '.mtg-lpill i{font-size:10px;}',
    // States
    '.mtg-pill-ok{background:#F0FDF4;color:#15803D;border:1px solid #BBF7D0;}',
    '.mtg-pill-warn{background:#FFFBEB;color:#B45309;border:1px solid #FDE68A;}',
    '.mtg-pill-full{background:#FEF2F2;color:#DC2626;border:1px solid #FECACA;}',
    // Inline "Upgrade to PRO" link that appears next to the red pill
    '.mtg-pill-upgrade{font-size:12px;font-weight:600;color:#2563EB;cursor:pointer;text-decoration:none;font-family:Host Grotesk,system-ui,sans-serif;margin-left:8px;vertical-align:middle;}',
    '.mtg-pill-upgrade:hover{text-decoration:underline;}'
  ].join('');
  document.head.appendChild(css);


  // ── Factory: create limit pill ──────────────────────────────
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


  // ── Pipeline: loan count pill ────────────────────────────────
  function showPipelinePill(loanCount) {
    var path = window.location.pathname.toLowerCase();
    if (path !== '/app/pipeline' && path !== '/app/pipeline/') return;

    var count = loanCount || 0;
    var pill = makePill(count, 25, 'loans');
    pill.style.marginRight = '8px';

    // Wrapper holds pill + optional upgrade link
    var wrap = document.createElement('span');
    wrap.style.display = 'inline-flex';
    wrap.style.alignItems = 'center';
    wrap.appendChild(pill);

    // At limit: add inline "Upgrade to PRO →" nudge
    if (count >= 25) {
      var link = document.createElement('span');
      link.className = 'mtg-pill-upgrade';
      link.textContent = 'Upgrade to PRO \u2192';
      link.addEventListener('click', function() {
        if (window.MTG_Billing && window.MTG_Billing.showUpgradeModal) {
          window.MTG_Billing.showUpgradeModal(
            "You've reached your 25-loan pipeline limit. Upgrade to PRO for unlimited loan tracking and CSV/Excel export.",
            'PRO'
          );
        }
      });
      wrap.appendChild(link);
    }

    // Insert into pipeline page header — try selector cascade
    var inserted = false;
    var headerSelectors = [
      '.header-right',
      '.pipeline-header-right',
      '.page-header-actions',
      '.page-header .right',
      '.pipeline-header',
      '.page-header'
    ];

    for (var i = 0; i < headerSelectors.length; i++) {
      var container = document.querySelector(headerSelectors[i]);
      if (container && !container.querySelector('.mtg-lpill')) {
        var primaryBtn = container.querySelector('.btn-primary, button');
        if (primaryBtn) container.insertBefore(wrap, primaryBtn);
        else container.appendChild(wrap);
        inserted = true;
        break;
      }
    }

    // Fallback: insert before the "Add Loan" button wherever it lives
    if (!inserted) {
      var addBtn = document.querySelector(
        '[data-action="add-loan"], #add-loan-btn, .add-loan-btn, [onclick*="addLoan"], [onclick*="openNewLoanModal"]'
      );
      if (addBtn && addBtn.parentNode && !addBtn.parentNode.querySelector('.mtg-lpill')) {
        addBtn.parentNode.insertBefore(wrap, addBtn);
      }
    }
  }


  // ── Calculators: saves count pill ───────────────────────────
  // URL prefix → calculator type name (must match API response keys)
  // Both known slug variants are included to handle URL discrepancies
  var CALC_URL_MAP = {
    '/app/calc-mortgage':            'Mortgage Calculator',
    '/app/mortgage-calculator':      'Mortgage Calculator',
    '/app/refi-analysis':            'Refinance Analysis',
    '/app/refinance':                'Refinance Analysis',
    '/app/affordability':            'Affordability Calculator',
    '/app/blended-rate':             'Blended Rate',
    '/app/dscr-calc':                'DSCR Calculator',
    '/app/dscr':                     'DSCR Calculator',
    '/app/va-entitlement':           'VA Entitlement',
    '/app/loan-scenario':            'Loan Scenario Comparison',
    '/app/loan-scenario-comparison': 'Loan Scenario Comparison',
    '/app/rent-vs-buy':              'Rent vs Buy',
    '/app/lender-pricing':           'Lender Pricing Comparison',
    '/app/closing-costs':            'Closing Costs'
  };

  function showCalcPill(savesData) {
    var path = window.location.pathname.toLowerCase();
    var calcName = null;

    for (var url in CALC_URL_MAP) {
      if (path.startsWith(url)) {
        calcName = CALC_URL_MAP[url];
        break;
      }
    }
    if (!calcName) return;

    var saveCount = (savesData && savesData[calcName]) ? savesData[calcName] : 0;
    var pill = makePill(saveCount, 10, 'saves');
    pill.style.marginLeft = '10px';

    // Find anchor point — try #saveStatus first, then .btn-save's parent
    var anchor = document.getElementById('saveStatus');

    if (!anchor) {
      var saveBtn = document.querySelector(
        '.btn-save, [data-action="save"], button[onclick*="save"], #save-btn'
      );
      anchor = saveBtn ? saveBtn.parentNode : null;
    }

    if (anchor && !anchor.querySelector('.mtg-lpill')) {
      anchor.appendChild(pill);
    }
  }


  // ── Initialize ──────────────────────────────────────────────
  async function initialize() {
    // Poll for MTG_Billing ready (max 6 seconds)
    for (var i = 0; i < 60; i++) {
      if (window.MTG_Billing && window.MTG_Billing.state === 'ready') break;
      await new Promise(function(r) { setTimeout(r, 100); });
    }
    if (!window.MTG_Billing || window.MTG_Billing.state !== 'ready') return;

    var plan = await window.MTG_Billing.getUserPlan();
    if (plan !== 'PLUS') return; // Section 8 is PLUS-only

    try {
      // Fetch current usage from API
      // Expected response: { usage: { pipelineLoans: 3, calculatorSaves: { "Blended Rate": 2 } } }
      var data = await window.MTG_Billing.apiRequest('/api/plan-limits');
      var usage = (data && data.usage) ? data.usage : {};

      // Wait for page content to render before injecting pills
      setTimeout(function() {
        showPipelinePill(usage.pipelineLoans);
        showCalcPill(usage.calculatorSaves);
      }, 1200);

    } catch (e) {
      // API unavailable — skip indicators silently, don't break the page
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
`;

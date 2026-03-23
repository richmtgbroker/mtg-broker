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

    if (path === '/static/site-footer.js') {
      return jsResponse(SITE_FOOTER_JS, request);
    }

    if (path === '/static/feature-extras.js') {
      return jsResponse(FEATURE_EXTRAS_JS, request);
    }

    // Default: list available endpoints
    return new Response(JSON.stringify({
      endpoints: [
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

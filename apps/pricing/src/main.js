/* MTG.BROKER Pricing Page v4.0 */
/* Entry point — Vite bundles this + CSS into a single IIFE (index.js) */

import './index.css'

/* ========================================
   HTML TEMPLATE
   Injected into #pricing-app mount div
   ======================================== */

/* Reusable SVG snippets */
var checkSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
var chevronSvg = '<svg class="faq-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>';
var tableCheckSvg = '<svg class="table-check" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>';

/* Helper: build a feature list item */
function featureItem(type, name) {
  if (type === 'included') {
    return '<li class="included"><div class="feature-icon">' + checkSvg + '</div><div class="feature-name">' + name + '</div></li>';
  }
  if (type === 'limited') {
    return '<li class="limited"><div class="feature-icon limited-icon">' + checkSvg + '</div><div class="feature-name">' + name + '</div></li>';
  }
  /* unavailable */
  return '<li class="unavailable"><div class="feature-name">' + name + '</div></li>';
}

/* Helper: build a FAQ item */
function faqItem(question, answer) {
  return '<div class="faq-item"><button class="faq-question"><span>' + question + '</span>' + chevronSvg + '</button><div class="faq-answer"><p>' + answer + '</p></div></div>';
}

var pricingHTML = ''
  /* ======== HERO ======== */
  + '<div class="pricing-page-wrapper">'
  + '<section class="pricing-hero"><div class="pricing-container">'
  + '<h1 class="pricing-hero-title">Simple, transparent pricing.</h1>'
  + '<p class="pricing-hero-subtitle">Start free. Upgrade when you\'re ready to scale.</p>'
  + '</div></section>'

  /* ======== PRICING CARDS ======== */
  + '<section class="pricing-cards"><div class="pricing-container"><div class="cards-grid">'

  /* --- LITE --- */
  + '<div class="pricing-card">'
  + '<div class="plan-header-bar lite-bar"></div>'
  + '<div class="plan-content">'
  + '<div class="plan-name-badge lite-badge">LITE</div>'
  + '<div class="plan-price">$0<span class="period">/mo</span></div>'
  + '<p class="plan-desc">Free access to lender &amp; vendor directories, plus core calculators.</p>'
  + '<ul class="plan-features">'
  + featureItem('included', 'Lender Directory')
  + featureItem('included', 'Vendor Directory')
  + featureItem('limited', 'Loan Product Search: <span class="feature-detail">Limited</span>')
  + featureItem('limited', 'Calculators: <span class="feature-detail">Basic</span>')
  + featureItem('unavailable', 'Favorites and Custom Notes')
  + featureItem('unavailable', 'Save Calculator Scenarios')
  + featureItem('unavailable', 'Pipeline Tracker')
  + featureItem('unavailable', 'Print to PDF / Export')
  + featureItem('unavailable', 'Referral Program')
  + '</ul>'
  + '<button class="cta-button cta-outline" data-plan="LITE" data-plan-btn="lite" data-state="logged-out">Create Free Account</button>'
  + '<div class="cta-button cta-current" data-plan-btn="lite" data-state="current-plan" style="display:none;">Current Plan \u2713</div>'
  + '</div></div>'

  /* --- PLUS --- */
  + '<div class="pricing-card">'
  + '<div class="plan-header-bar plus-bar"></div>'
  + '<div class="plan-content">'
  + '<div class="plan-name-badge plus-badge">PLUS</div>'
  + '<div class="plan-price">$49<span class="period">/mo</span></div>'
  + '<p class="plan-desc">Full access with smart limits for growing teams.</p>'
  + '<ul class="plan-features">'
  + featureItem('included', 'Lender Directory')
  + featureItem('included', 'Vendor Directory')
  + featureItem('included', 'Loan Product Search')
  + featureItem('included', 'Calculators: <strong>Advanced</strong>')
  + featureItem('included', 'Favorites and Custom Notes')
  + featureItem('limited', 'Save Calculator Scenarios: <span class="feature-detail">Limited</span>')
  + featureItem('limited', 'Pipeline Tracker: <span class="feature-detail">Limited</span>')
  + featureItem('unavailable', 'Print to PDF / Export')
  + featureItem('unavailable', 'Referral Program')
  + '</ul>'
  + '<button class="cta-button cta-primary" data-plan="PLUS" data-plan-btn="plus" data-state="logged-out">Start PLUS Trial</button>'
  + '<button class="cta-button cta-primary" data-plan-btn="plus" data-state="upgrade" style="display:none;">Upgrade to PLUS</button>'
  + '<div class="cta-button cta-current" data-plan-btn="plus" data-state="current-plan" style="display:none;">Current Plan \u2713</div>'
  + '</div></div>'

  /* --- PRO (MOST POPULAR) --- */
  + '<div class="pricing-card featured-card">'
  + '<div class="popular-badge">MOST POPULAR</div>'
  + '<div class="plan-header-bar pro-bar"></div>'
  + '<div class="plan-content">'
  + '<div class="plan-name-badge pro-badge">PRO</div>'
  + '<div class="plan-price">$79<span class="period">/mo</span></div>'
  + '<p class="plan-desc">Unlimited everything for power users.</p>'
  + '<ul class="plan-features">'
  + featureItem('included', 'Lender Directory')
  + featureItem('included', 'Vendor Directory')
  + featureItem('included', 'Loan Product Search')
  + featureItem('included', 'Calculators: <strong>Advanced</strong>')
  + featureItem('included', 'Favorites and Custom Notes')
  + featureItem('included', 'Save Calculator Scenarios: <strong>Unlimited</strong>')
  + featureItem('included', 'Pipeline Tracker: <strong>Unlimited</strong>')
  + featureItem('included', 'Print to PDF / Export')
  + featureItem('included', 'Referral Program')
  + '</ul>'
  + '<button class="cta-button cta-primary" data-plan="PRO" data-plan-btn="pro" data-state="logged-out">Start PRO Trial</button>'
  + '<button class="cta-button cta-primary" data-plan-btn="pro" data-state="upgrade" style="display:none;">Upgrade to PRO</button>'
  + '<div class="cta-button cta-current" data-plan-btn="pro" data-state="current-plan" style="display:none;">Current Plan \u2713</div>'
  + '</div></div>'

  + '</div></div></section>'

  /* ======== TRUST SECTION ======== */
  + '<section class="trust-section"><div class="pricing-container">'
  + '<div class="trust-stats">'
  + '<div class="trust-stat"><div class="stat-number">10,000+</div><div class="stat-label">Mortgage Professionals</div></div>'
  + '<div class="trust-stat"><div class="stat-number">300+</div><div class="stat-label">Lenders</div></div>'
  + '<div class="trust-stat"><div class="stat-number">1,000+</div><div class="stat-label">Loan Products</div></div>'
  + '</div>'
  + '<div class="trust-badges">'
  + '<div class="badge-item"><svg class="badge-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg><span>Secure Checkout</span></div>'
  + '<div class="badge-item"><svg class="badge-icon" viewBox="0 0 20 20" fill="currentColor"><path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/><path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z"/></svg><span>Cancel Anytime</span></div>'
  + '<div class="badge-item"><svg class="badge-icon" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg><span>Email Support</span></div>'
  + '</div>'
  + '</div></section>'

  /* ======== COMPARISON TABLE ======== */
  + '<section class="comparison-section"><div class="pricing-container">'
  + '<h2 class="section-title">Compare Plans</h2>'
  + '<div class="comparison-table-wrapper"><table class="comparison-table">'
  + '<thead><tr>'
  + '<th class="feature-col">Feature</th>'
  + '<th class="plan-col">LITE</th>'
  + '<th class="plan-col">PLUS</th>'
  + '<th class="plan-col featured">PRO</th>'
  + '</tr></thead>'
  + '<tbody>'
  + '<tr><td class="feature-name-cell">Loan Product Search</td><td class="feature-value">Limited</td><td class="feature-value">' + tableCheckSvg + '</td><td class="feature-value featured">' + tableCheckSvg + '</td></tr>'
  + '<tr><td class="feature-name-cell">Number of Calculators</td><td class="feature-value">Basic</td><td class="feature-value">All 14+</td><td class="feature-value featured">All 14+</td></tr>'
  + '<tr><td class="feature-name-cell">Saved Calculator Scenarios</td><td class="feature-value">\u2014</td><td class="feature-value">10 per tool</td><td class="feature-value featured">Unlimited</td></tr>'
  + '<tr><td class="feature-name-cell">PDF Export</td><td class="feature-value">\u2014</td><td class="feature-value">\u2014</td><td class="feature-value featured">' + tableCheckSvg + '</td></tr>'
  + '<tr><td class="feature-name-cell">Pipeline Tracking</td><td class="feature-value">\u2014</td><td class="feature-value">25 loans</td><td class="feature-value featured">Unlimited</td></tr>'
  + '<tr><td class="feature-name-cell">Pipeline Export</td><td class="feature-value">\u2014</td><td class="feature-value">\u2014</td><td class="feature-value featured">CSV/Excel</td></tr>'
  + '<tr><td class="feature-name-cell">Lender Contact Access</td><td class="feature-value">' + tableCheckSvg + '</td><td class="feature-value">Click-to-contact</td><td class="feature-value featured">One-click</td></tr>'
  + '<tr><td class="feature-name-cell">Saved Favorites</td><td class="feature-value">\u2014</td><td class="feature-value">Unlimited</td><td class="feature-value featured">Unlimited</td></tr>'
  + '<tr><td class="feature-name-cell">Product Details</td><td class="feature-value">Basic</td><td class="feature-value">Detailed</td><td class="feature-value featured">Full Transparency</td></tr>'
  + '<tr><td class="feature-name-cell">Support</td><td class="feature-value">Email</td><td class="feature-value">Email</td><td class="feature-value featured">Priority</td></tr>'
  + '<tr><td class="feature-name-cell">Referral Program</td><td class="feature-value">\u2014</td><td class="feature-value">\u2014</td><td class="feature-value featured">' + tableCheckSvg + '</td></tr>'
  + '</tbody></table></div>'
  + '</div></section>'

  /* ======== FAQ ======== */
  + '<section class="faq-section"><div class="pricing-container">'
  + '<h2 class="section-title">Frequently Asked Questions</h2>'
  + '<div class="faq-list">'
  + faqItem('Can I change plans later?', 'Yes! You can upgrade or downgrade your plan at any time. When you upgrade, you\'ll be charged the prorated difference. When you downgrade, the change takes effect at the end of your current billing period.')
  + faqItem('What happens after the 7-day free trial?', 'After your 7-day trial ends, you\'ll automatically be charged the monthly rate for your chosen plan. You can cancel anytime during the trial to avoid being charged. No surprises!')
  + faqItem('Can I cancel anytime?', 'Absolutely. There are no long-term contracts or commitments. You can cancel your subscription at any time from your account settings, and you\'ll retain access until the end of your current billing period.')
  + faqItem('What payment methods do you accept?', 'We accept all major credit cards (Visa, Mastercard, American Express, Discover) and debit cards. All payments are processed securely through our payment partner.')
  + faqItem('Is my data secure?', 'Yes! We take data security seriously. All data is encrypted in transit and at rest. We\'re compliant with industry-standard security practices and never share your information with third parties.')
  + faqItem('Can I get a refund?', 'We offer a 30-day money-back guarantee. If you\'re not satisfied with MTG.BROKER for any reason within your first 30 days, contact us for a full refund\u2014no questions asked.')
  + faqItem('Will my saved data transfer if I upgrade?', 'Absolutely! All your saved calculator scenarios, pipeline loans, and favorites are preserved when you upgrade. You\'ll simply unlock additional features and higher limits.')
  + '</div>'
  + '</div></section>'

  /* ======== FINAL CTA ======== */
  + '<section class="final-cta-section"><div class="pricing-container"><div class="final-cta-content">'
  + '<h2 class="final-cta-title">Ready to close more loans?</h2>'
  + '<p class="final-cta-subtitle">Join thousands of mortgage professionals using MTG.BROKER to work smarter.</p>'
  + '<div class="final-cta-buttons">'
  + '<button class="cta-button cta-primary cta-large cta-on-blue" data-plan="PRO" data-plan-btn="final-pro" data-state="logged-out">Start PRO Free Trial</button>'
  + '<button class="cta-button cta-outline cta-large cta-outline-light" data-plan="LITE" data-plan-btn="final-lite" data-state="logged-out">Start with Free Plan</button>'
  + '<button class="cta-button cta-primary cta-large cta-on-blue" data-plan-btn="final-upgrade" data-state="upgrade" style="display:none;">Upgrade Your Plan</button>'
  + '<a href="/app/dashboard" class="cta-button cta-primary cta-large cta-on-blue" data-plan-btn="final-dashboard" data-state="has-plan" style="display:none; text-decoration:none;">Go to Dashboard</a>'
  + '</div>'
  + '<p class="final-cta-note">No credit card required for LITE plan \u2022 Cancel anytime</p>'
  + '</div></div></section>'

  + '</div>'; /* end .pricing-page-wrapper */


/* ========================================
   OUTSETA PLAN CONFIGURATION
   ======================================== */

var PLAN_UIDS = {
  'LITE': 'NmdnZg90',
  'PLUS': 'Dmw8leQ4',
  'PRO':  'yWobBP9D'
};

var UID_TO_PLAN = {
  'NmdnZg90': 'LITE',
  'NmdmZg90': 'LITE',
  'Dmw8leQ4': 'PLUS',
  'yWobBP9D': 'PRO'
};

var PLAN_RANK = { 'LITE': 0, 'PLUS': 1, 'PRO': 2 };


/* ========================================
   FAQ ACCORDION
   ======================================== */

function initFAQ() {
  var faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(function(item) {
    var question = item.querySelector('.faq-question');
    if (!question) return;
    question.addEventListener('click', function() {
      faqItems.forEach(function(otherItem) {
        if (otherItem !== item && otherItem.classList.contains('active')) {
          otherItem.classList.remove('active');
        }
      });
      item.classList.toggle('active');
    });
  });
}


/* ========================================
   OUTSETA SIGNUP / UPGRADE HANDLERS
   (3-method fallback for each)
   ======================================== */

function openOutsetaSignup(planUid) {
  console.log('Pricing: Opening signup for plan UID:', planUid);

  /* Method 1: Outseta.auth.open (newer SDK) */
  if (typeof Outseta !== 'undefined' && Outseta.auth && typeof Outseta.auth.open === 'function') {
    Outseta.auth.open({ widgetMode: 'register', planUid: planUid, skipPlanOptions: true });
    return;
  }

  /* Method 2: Outseta.showWidget (alternative SDK) */
  if (typeof Outseta !== 'undefined' && typeof Outseta.showWidget === 'function') {
    Outseta.showWidget({ widgetMode: 'register', planUid: planUid, skipPlanOptions: true });
    return;
  }

  /* Method 3: Hosted signup URL redirect */
  console.log('Pricing: Outseta SDK not available, redirecting to hosted signup');
  window.location.href = 'https://mtgbroker.outseta.com/auth?widgetMode=register&planUid=' + planUid + '&skipPlanOptions=true#o-anonymous';
}

function openOutsetaUpgrade() {
  console.log('Pricing: Opening plan change/upgrade');

  /* Method 1: Outseta.profile.open */
  if (typeof Outseta !== 'undefined' && Outseta.profile && typeof Outseta.profile.open === 'function') {
    Outseta.profile.open({ tab: 'planChange' });
    return;
  }

  /* Method 2: Outseta.showProfile */
  if (typeof Outseta !== 'undefined' && typeof Outseta.showProfile === 'function') {
    Outseta.showProfile({ tab: 'planChange' });
    return;
  }

  /* Method 3: Hosted profile URL redirect */
  console.log('Pricing: Outseta SDK not available, redirecting to hosted profile');
  window.location.href = 'https://mtgbroker.outseta.com/profile#o-authenticated';
}


/* ========================================
   CTA BUTTON CLICK HANDLERS
   ======================================== */

function initCTAButtons() {
  /* Signup buttons (have data-plan attribute with plan name) */
  var signupButtons = document.querySelectorAll('.cta-button[data-plan]');
  signupButtons.forEach(function(button) {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      var planName = button.getAttribute('data-plan');
      var planUid = PLAN_UIDS[planName];
      if (planUid) {
        openOutsetaSignup(planUid);
      } else {
        console.warn('Pricing: Unknown plan:', planName);
      }
    });
  });

  /* Upgrade buttons (data-state="upgrade") */
  var upgradeButtons = document.querySelectorAll('[data-state="upgrade"]');
  upgradeButtons.forEach(function(button) {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      openOutsetaUpgrade();
    });
  });
}


/* ========================================
   PLAN STATE MANAGEMENT
   Fast JWT extraction -> Outseta SDK fallback
   ======================================== */

function initPlanState() {
  /* Fast path: try JWT extraction from localStorage */
  var currentPlan = getPlanFromJWT();

  if (currentPlan) {
    console.log('Pricing: Plan detected from JWT:', currentPlan);
    applyPlanState(currentPlan);
    return;
  }

  /* No token = not logged in */
  var hasToken = !!localStorage.getItem('Outseta.nocode.accessToken');
  if (!hasToken) {
    console.log('Pricing: No token found, showing signup buttons');
    showLoggedOutButtons();
    return;
  }

  /* Token exists but plan not in JWT -> try getCachedOutsetaUser */
  if (typeof window.getCachedOutsetaUser === 'function') {
    getPlanFromOutsetaUser();
  } else {
    var attempts = 0;
    var checkInterval = setInterval(function() {
      attempts++;
      if (typeof window.getCachedOutsetaUser === 'function') {
        clearInterval(checkInterval);
        getPlanFromOutsetaUser();
      } else if (attempts >= 15) {
        clearInterval(checkInterval);
        console.warn('Pricing: getCachedOutsetaUser not available, defaulting to LITE');
        applyPlanState('LITE');
      }
    }, 200);
  }
}

function getPlanFromJWT() {
  try {
    var token = localStorage.getItem('Outseta.nocode.accessToken');
    if (token) {
      var payload = JSON.parse(atob(token.split('.')[1]));
      var planUid = payload['outseta:planUid'];
      if (planUid && UID_TO_PLAN[planUid]) {
        return UID_TO_PLAN[planUid];
      }
    }
  } catch (e) {
    console.warn('Pricing: JWT extraction failed:', e);
  }
  return null;
}

function getPlanFromOutsetaUser() {
  window.getCachedOutsetaUser().then(function(user) {
    if (!user) {
      showLoggedOutButtons();
      return;
    }
    var planUid = user.Account
      && user.Account.CurrentSubscription
      && user.Account.CurrentSubscription.Plan
      ? user.Account.CurrentSubscription.Plan.Uid
      : null;
    var currentPlan = UID_TO_PLAN[planUid] || 'LITE';
    applyPlanState(currentPlan);
  }).catch(function(err) {
    console.warn('Pricing: Error loading user plan:', err);
    showLoggedOutButtons();
  });
}

function applyPlanState(currentPlan) {
  console.log('Pricing: Applying plan state:', currentPlan);
  var currentRank = PLAN_RANK[currentPlan] || 0;

  /* Hide ALL plan-specific buttons first (cards + final CTA) */
  document.querySelectorAll('[data-plan-btn]').forEach(function(el) {
    el.style.display = 'none';
  });

  /* Show correct button per card */
  ['lite', 'plus', 'pro'].forEach(function(plan) {
    var planRank = PLAN_RANK[plan.toUpperCase()] || 0;
    if (planRank === currentRank) {
      showBtn(plan, 'current-plan');
    } else if (planRank > currentRank) {
      showBtn(plan, 'upgrade');
    }
  });

  /* Final CTA section buttons */
  if (currentPlan === 'LITE') {
    showBtn('final-upgrade', 'upgrade');
  } else {
    showBtn('final-dashboard', 'has-plan');
  }
}

function showBtn(plan, state) {
  var btn = document.querySelector('[data-plan-btn="' + plan + '"][data-state="' + state + '"]');
  if (btn) btn.style.display = 'block';
}

function showLoggedOutButtons() {
  document.querySelectorAll('[data-plan-btn]').forEach(function(el) {
    el.style.display = 'none';
  });
  document.querySelectorAll('[data-state="logged-out"]').forEach(function(el) {
    el.style.display = 'block';
  });
}


/* ========================================
   SMOOTH SCROLL
   ======================================== */

function initSmoothScroll() {
  var links = document.querySelectorAll('a[href^="#"]');
  links.forEach(function(link) {
    link.addEventListener('click', function(e) {
      var href = link.getAttribute('href');
      if (href === '#') return;
      e.preventDefault();
      var target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}


/* ========================================
   MOUNT & INITIALIZE
   Uses DOM polling like AI Loan Finder to handle Webflow's async script injection
   ======================================== */

function mountAndInit() {
  var container = document.getElementById('pricing-app');

  if (container) {
    container.innerHTML = pricingHTML;
    initializeFeatures();
  } else {
    /* Retry every 50ms until the element appears (max 5 seconds) */
    var attempts = 0;
    var interval = setInterval(function() {
      attempts++;
      var el = document.getElementById('pricing-app');
      if (el) {
        clearInterval(interval);
        el.innerHTML = pricingHTML;
        initializeFeatures();
      } else if (attempts > 100) {
        clearInterval(interval);
        console.error('Pricing: #pricing-app element not found on page.');
      }
    }, 50);
  }
}

function initializeFeatures() {
  initFAQ();
  initSmoothScroll();
  initCTAButtons();
  initPlanState();
  console.log('MTG.BROKER Pricing Page v4.0 initialized');
}

/* Run immediately if DOM is ready, otherwise wait */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountAndInit);
} else {
  mountAndInit();
}

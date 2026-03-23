/**
 * mtg-broker-home — Cloudflare Worker
 * =========================================================
 * Serves the mtg.broker home page sections (Hero, Features,
 * Pricing, CTA) as injectable JavaScript.
 *
 * ENDPOINT:
 *   GET /home.js   → returns all home page sections as executable JS
 *   GET /home.css  → returns all home page CSS only
 *   GET /           → returns a short status message
 *
 * DEPLOY:
 *   wrangler deploy workers/mtg-broker-home.js \
 *     --name mtg-broker-home \
 *     --compatibility-date 2024-01-01
 *
 *   Production URL:
 *   https://mtg-broker-home.rich-e00.workers.dev/home.js
 *
 * HOW TO USE IN WEBFLOW:
 *   Replace ALL 5 existing embeds (CSS, CSS_HERO, FEATURES,
 *   HTML_PRICING, Final CTA) with a SINGLE embed:
 *
 *   <div id="mtg-home"></div>
 *   <script>
 *     (function() {
 *       var s = document.createElement('script');
 *       s.src = 'https://mtg-broker-home.rich-e00.workers.dev/home.js';
 *       s.defer = true;
 *       document.head.appendChild(s);
 *     })();
 *   </script>
 *
 * TO UPDATE:
 *   1. Edit this file (CSS, HTML, or JS sections below).
 *   2. Run: wrangler deploy workers/mtg-broker-home.js --name mtg-broker-home
 *   3. All pages pick up the change within 5 minutes — no Webflow edits needed.
 * =========================================================
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
    };

    // ---- Serve the home page JavaScript module ----
    if (url.pathname === '/home.js') {
      return new Response(buildHomeScript(), {
        headers: {
          'Content-Type': 'application/javascript; charset=utf-8',
          ...corsHeaders,
        },
      });
    }

    // ---- Serve CSS only (for debugging) ----
    if (url.pathname === '/home.css') {
      return new Response(HOME_CSS, {
        headers: {
          'Content-Type': 'text/css; charset=utf-8',
          ...corsHeaders,
        },
      });
    }

    // ---- Health check at root ----
    if (url.pathname === '/' || url.pathname === '') {
      return new Response(
        'mtg-broker-home worker is running.\nLoad /home.js on any page to inject the home page sections.',
        { headers: { 'Content-Type': 'text/plain' } }
      );
    }

    return new Response('Not Found', { status: 404 });
  },
};


// ============================================================
// HOME PAGE CSS
// All styles for Hero, Features, Pricing, CTA sections.
// Injected into <head> at runtime.
// ============================================================
const HOME_CSS = `
/* ================================================
   MTG.BROKER HOME PAGE — Cloudflare Worker Styles
   v1.0 — All sections combined
   ================================================ */

/* --- GLOBAL / BASE --- */
:root {
  --mtg-bg-gradient: linear-gradient(180deg, #F3F6FF 0%, #F9FAFB 100%);
  --mtg-font-primary: 'Host Grotesk', system-ui, -apple-system, sans-serif;
  --mtg-brand-dark: #0f172a;
}

html {
  height: 100%;
  scroll-padding-top: 120px;
}

body {
  font-family: var(--mtg-font-primary);
  background: var(--mtg-bg-gradient);
  background-attachment: fixed;
  background-repeat: no-repeat;
  background-size: cover;
  margin: 0;
  color: var(--mtg-brand-dark);
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
  padding-top: 0;
}

.mtg-container {
  width: 90%;
  max-width: 1280px;
  margin: 0 auto;
}

/* ================================================
   HERO SECTION
   ================================================ */
.mtg-hero-section { padding: 60px 0 80px 0; font-family: 'Host Grotesk', sans-serif; }

.mtg-hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center; }

.mtg-hero-content h1 { font-size: 56px; line-height: 1.1; font-weight: 800; color: #0f172a; margin: 0 0 24px 0; letter-spacing: -0.02em; }
.text-blue { color: #2563EB; }
.mtg-hero-content p { font-size: 18px; line-height: 1.6; color: #64748B; margin-bottom: 32px; max-width: 480px; }

.hero-actions {
  display: flex;
  gap: 16px;
  width: 100%;
  max-width: 450px;
}

.mtg-btn-primary, .mtg-btn-outline-hero {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 14px 20px;
  border-radius: 8px;
  font-weight: 700;
  text-decoration: none;
  font-size: 16px;
  transition: all 0.2s;
  white-space: nowrap;
  flex: 1;
  width: 100%;
}

.mtg-btn-primary {
  background: #2563EB;
  color: white;
  border: 1px solid #2563EB;
}
.mtg-btn-primary:hover { filter: brightness(110%); }

.mtg-btn-outline-hero {
  background: transparent;
  color: #0f172a;
  border: 1px solid #E2E8F0;
}
.mtg-btn-outline-hero:hover {
  border-color: #0f172a;
  background: #F8FAFC;
}

/* Hero Card Visual */
.hero-card { background: #0f172a; border-radius: 24px; padding: 40px; color: white; box-shadow: 0 20px 40px -10px rgba(15, 23, 42, 0.3); position: relative; overflow: hidden; }
.hero-card::before { content: ''; position: absolute; top: 0; right: 0; width: 300px; height: 300px; background: radial-gradient(circle, rgba(37,99,235,0.4) 0%, rgba(15,23,42,0) 70%); pointer-events: none; }

.hero-card-header { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 11px; letter-spacing: 0.1em; color: #94A3B8; font-weight: 700; }
.dot { width: 6px; height: 6px; background: #10B981; border-radius: 50%; }

.tags-row { display: flex; gap: 8px; margin-bottom: 40px; flex-wrap: wrap; }
.tag-blue { background: #2563EB; color: white; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; }
.tag-dark { background: #334155; color: #CBD5E1; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; }

.hero-card h3 { font-size: 28px; font-weight: 700; margin: 0 0 12px 0; position: relative; z-index: 2; }
.hero-card p { font-size: 16px; color: #94A3B8; line-height: 1.6; margin: 0; position: relative; z-index: 2; }

@media (max-width: 991px) {
  .mtg-hero-grid { grid-template-columns: 1fr; gap: 40px; }
  .mtg-hero-content h1 { font-size: 42px; }
  .hero-actions { flex-direction: column; max-width: 100%; }
}

/* ================================================
   FEATURES SECTION
   ================================================ */
.mtg-features-section { padding: 80px 0; font-family: 'Host Grotesk', sans-serif; }

.features-header { margin-bottom: 60px; text-align: center; }
.features-header h2 { font-size: 36px; font-weight: 800; color: #0f172a; margin: 0 0 12px 0; }
.features-header p { font-size: 18px; color: #64748B; margin: 0; }

.features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 32px; }

.feature-item {
  background: white;
  border-radius: 24px;
  padding: 32px;
  border: 1px solid #E5E7EB;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.feature-item:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

.feature-item h3 { font-size: 20px; font-weight: 700; color: #0f172a; margin: 20px 0 12px 0; }
.feature-item p { font-size: 15px; line-height: 1.6; color: #64748B; margin: 0; }

.icon-box { width: 48px; height: 48px; background: #EFF6FF; border-radius: 12px; display: flex; align-items: center; justify-content: center; }

/* ================================================
   PRICING SECTION
   ================================================ */
.mtg-pricing-section {
  padding: 80px 0;
  font-family: 'Host Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
  background: linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%);
}

.mtg-pricing-header {
  text-align: center;
  margin-bottom: 60px;
}

.mtg-pricing-header h2 {
  font-size: 40px;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 12px;
  letter-spacing: -0.02em;
}

.mtg-pricing-header p {
  font-size: 18px;
  color: #64748B;
  font-weight: 400;
}

/* 3-COLUMN GRID */
.mtg-pricing-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 28px;
  align-items: stretch;
}

/* BASE CARD */
.mtg-pricing-card {
  background: #FAFAFA;
  border-radius: 20px;
  border: 2.5px solid #CBD5E1;
  position: relative;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  box-shadow: 0 12px 32px -4px rgba(0, 0, 0, 0.18),
              0 4px 12px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  margin-top: 30px;
}

.mtg-pricing-card.lite,
.mtg-pricing-card.plus {
  overflow: hidden;
}

.mtg-pricing-card:hover {
  box-shadow: 0 16px 40px -6px rgba(0, 0, 0, 0.22),
              0 6px 16px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

/* PRO CARD (FEATURED - Brand Blue) */
.mtg-pricing-card.pro {
  background: #FFFFFF;
  border: 3px solid #2563EB;
  box-shadow: 0 16px 40px -6px rgba(37, 99, 235, 0.3),
              0 6px 16px rgba(37, 99, 235, 0.15);
  overflow: visible;
}

.mtg-pricing-card.pro:hover {
  box-shadow: 0 20px 50px -10px rgba(37, 99, 235, 0.35),
              0 8px 20px rgba(37, 99, 235, 0.2);
}

/* COLORED HEADER BARS */
.plan-header-bar {
  width: 100%;
  height: 8px;
  border-radius: 17px 17px 0 0;
}

.lite-bar {
  background: linear-gradient(135deg, #475569 0%, #334155 100%);
}

.plus-bar {
  background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
}

.pro-bar {
  background: linear-gradient(135deg, #1D4ED8 0%, #1E3A8A 100%);
}

/* POPULAR TAG (Brand Blue) */
.popular-tag {
  position: absolute;
  top: -18px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
  color: white;
  font-weight: 800;
  font-size: 11px;
  letter-spacing: 0.08em;
  padding: 6px 18px;
  border-radius: 20px;
  white-space: nowrap;
  z-index: 2;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
}

/* PLAN CONTENT */
.plan-content {
  padding: 32px 32px 44px 32px;
  display: flex;
  flex-direction: column;
  flex: 1;
}

/* PLAN NAME BADGE */
.plan-name-badge {
  display: inline-block;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.05em;
  margin-bottom: 20px;
  width: fit-content;
}

.lite-badge { background: #F1F5F9; color: #334155; }
.plus-badge { background: #DBEAFE; color: #1E40AF; }
.pro-badge { background: #1E40AF; color: white; }

/* PRICE */
.plan-price {
  font-size: 52px;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 8px;
  letter-spacing: -0.03em;
  line-height: 1;
}

.period {
  font-size: 18px;
  font-weight: 500;
  color: #94a3b8;
  letter-spacing: 0;
}

/* PLAN DESCRIPTION */
.plan-desc {
  font-size: 15px;
  color: #64748B;
  margin-bottom: 28px;
  line-height: 1.5;
}

/* FEATURES LIST */
.plan-features {
  list-style: none;
  padding: 0;
  margin: 0 0 32px 0;
  flex: 1;
}

.plan-features li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #F1F5F9;
}

.plan-features li:last-child { border-bottom: none; }

/* INCLUDED FEATURES (GREEN circle check) */
.plan-features li.included .feature-icon {
  width: 24px;
  height: 24px;
  min-width: 24px;
  background: linear-gradient(135deg, #10B981, #059669);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.plan-features li.included .feature-icon svg {
  width: 14px;
  height: 14px;
  stroke: white;
}

/* LIMITED FEATURES (BLUE circle check) */
.plan-features li.limited .feature-icon {
  width: 24px;
  height: 24px;
  min-width: 24px;
  background: linear-gradient(135deg, #60A5FA, #3B82F6);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.plan-features li.limited .feature-icon svg {
  width: 14px;
  height: 14px;
  stroke: white;
}

.feature-detail { color: #94A3B8; font-weight: 400; }

/* UNAVAILABLE FEATURES */
.plan-features li.unavailable {
  color: #CBD5E1;
  text-decoration: line-through;
  padding-left: 36px;
}

.plan-features li.unavailable .feature-name { color: #CBD5E1; }

/* FEATURE NAME */
.feature-name {
  font-size: 14px;
  font-weight: 500;
  color: #0f172a;
}

.badge-coming-soon {
  display: inline-block;
  background: #DBEAFE;
  color: #1E40AF;
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  margin-left: 6px;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

/* PRICING BUTTONS */
.mtg-pricing-section .mtg-btn-outline,
.mtg-pricing-section .mtg-btn-full,
.mtg-pricing-section .mtg-btn-current {
  width: 100%;
  padding: 16px 24px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 700;
  text-align: center;
  text-decoration: none;
  display: block;
  transition: all 0.3s;
  box-sizing: border-box;
  flex: 0 0 auto;
  cursor: pointer;
}

/* Outline button (LITE) */
.mtg-pricing-section .mtg-btn-outline {
  border: 2px solid #E2E8F0;
  color: #0f172a;
  background: white;
}

.mtg-pricing-section .mtg-btn-outline:hover {
  border-color: #2563EB;
  background: #F8FAFC;
  transform: translateY(-1px);
}

/* Filled button (PLUS & PRO) */
.mtg-btn-full {
  background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
  color: white;
  border: 2px solid transparent;
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.35);
}

.mtg-btn-full:hover {
  box-shadow: 0 8px 24px rgba(37, 99, 235, 0.45);
  transform: translateY(-2px);
}

/* Current Plan button (green) */
.mtg-btn-current {
  background: linear-gradient(135deg, #10B981 0%, #059669 100%);
  color: white;
  border: 2px solid transparent;
  cursor: default;
}

/* PRICING RESPONSIVE */
@media (max-width: 992px) {
  .mtg-pricing-grid { grid-template-columns: repeat(2, 1fr); }
  .mtg-pricing-card.lite { grid-column: 1 / -1; }
}

@media (max-width: 768px) {
  .mtg-pricing-section { padding: 60px 0; }
  .mtg-pricing-grid { grid-template-columns: 1fr; gap: 32px; }
  .mtg-pricing-card.lite { grid-column: auto; }
  .mtg-pricing-card { margin-top: 24px; }
  .plan-content { padding: 28px 28px 40px 28px; }
  .mtg-pricing-card:hover { transform: none; }
  .mtg-pricing-card.pro:hover { transform: none; }
  .plan-price { font-size: 44px; }
  .mtg-pricing-header h2 { font-size: 32px; }
  .mtg-pricing-header p { font-size: 16px; }
  .popular-tag { top: -15px; font-size: 10px; padding: 5px 14px; }
  .mtg-pricing-section .mtg-btn-outline,
  .mtg-pricing-section .mtg-btn-full,
  .mtg-pricing-section .mtg-btn-current { padding: 14px 20px; font-size: 14px; }
}

@media (max-width: 480px) {
  .mtg-container { width: 95%; }
  .plan-content { padding: 24px 24px 32px 24px; }
  .plan-price { font-size: 38px; }
  .mtg-pricing-header h2 { font-size: 28px; }
}

/* ================================================
   CTA SECTION
   ================================================ */
.mtg-cta-section { padding: 80px 0; font-family: 'Host Grotesk', sans-serif; }

.cta-card { background: #0f172a; color: white; padding: 60px 40px; text-align: center; border-radius: 24px; position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; }

.cta-glow-top { position: absolute; top: -100px; left: -100px; width: 300px; height: 300px; background: #2563EB; opacity: 0.3; filter: blur(80px); border-radius: 50%; }
.cta-glow-bottom { position: absolute; bottom: -100px; right: -100px; width: 300px; height: 300px; background: #2563EB; opacity: 0.3; filter: blur(80px); border-radius: 50%; }

.cta-content { position: relative; z-index: 2; max-width: 900px; width: 100%; }

.cta-content h2 {
  font-size: 42px;
  font-weight: 800;
  margin-bottom: 16px;
  color: white;
  letter-spacing: -0.02em;
  line-height: 1.1;
  text-wrap: balance;
}

.cta-content p {
  font-size: 18px;
  color: #cbd5e1;
  margin-bottom: 32px;
  line-height: 1.6;
  text-wrap: balance;
}

.mtg-btn-white { display: inline-block; background: white; color: #0f172a; border: 1px solid white; padding: 14px 28px; border-radius: 8px; font-weight: 700; text-decoration: none; transition: filter 0.2s; }
.mtg-btn-white:hover { filter: brightness(90%); }

.cta-note { margin-top: 24px; font-size: 13px; color: #64748B; display: flex; align-items: center; justify-content: center; gap: 6px; }

@media (max-width: 768px) {
  .cta-content h2 { font-size: 32px; }
  .cta-card { padding: 40px 24px; }
}
`;


// ============================================================
// CHECK ICON SVG (reused in pricing cards)
// ============================================================
const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';


// ============================================================
// HOME PAGE HTML
// All section markup — injected into the mount target at runtime.
// ============================================================
const HOME_HTML = `
<!-- ================================================
     HERO SECTION
     ================================================ -->
<section class="mtg-hero-section">
  <div class="mtg-container mtg-hero-grid">
    <div class="mtg-hero-content">
      <h1>The complete toolkit for modern <span class="text-blue">Loan Officers.</span></h1>
      <p>Stop juggling PDFs, spreadsheets, and sticky notes. Get instant access to lender guidelines, scenario answers, calculators, and vendor contacts—all in one place.</p>

      <div class="hero-actions">
        <a href="/pricing" class="mtg-btn-primary">View Plans</a>
        <a href="/pricing" class="mtg-btn-outline-hero">Create Free Account</a>
      </div>
    </div>

    <div class="mtg-hero-visual">
      <div class="hero-card">
        <div class="hero-card-header">
          <div class="dot"></div>
          <span class="label">ACTIVE FILTERS</span>
        </div>
        <div class="tags-row">
          <span class="tag-blue">Purchase ×</span>
          <span class="tag-blue">DSCR ×</span>
          <span class="tag-dark">75% LTV</span>
          <span class="tag-dark">640+ FICO</span>
        </div>
        <h3>Pinpoint the perfect program.</h3>
        <p>Don't waste time scanning endless PDF matrices. Use our advanced filters to instantly narrow down 300+ lenders.</p>
      </div>
    </div>
  </div>
</section>

<!-- ================================================
     FEATURES SECTION
     ================================================ -->
<section class="mtg-features-section" id="features">
  <div class="mtg-container">
    <div class="features-header">
      <h2>Fast Answers. Smart Solutions.</h2>
      <p>Everything you need to streamline your workflow and close more loans.</p>
    </div>

    <div class="features-grid">
      <div class="feature-item">
        <div class="icon-box"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></div>
        <h3>Scenario Search</h3>
        <p>Instant answers from lender guidelines and matrices. Stop digging through PDFs to find eligibility.</p>
      </div>
      <div class="feature-item">
        <div class="icon-box"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2"><path d="M3 21h18v-8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8z"></path><polyline points="12 3 2 11 22 11 12 3"></polyline></svg></div>
        <h3>Lender & Product DB</h3>
        <p>Searchable database of lenders, program rules, and specific requirements for every loan type.</p>
      </div>
      <div class="feature-item">
        <div class="icon-box"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="12" y1="18" x2="12" y2="18"></line><line x1="8" y1="18" x2="8" y2="18"></line><line x1="16" y1="18" x2="16" y2="18"></line><line x1="8" y1="6" x2="16" y2="6"></line></svg></div>
        <h3>Smart Calculators</h3>
        <p>Run numbers fast with tools for Refinance Analysis, Cash to Close, and Leverage/DSCR estimates.</p>
      </div>
      <div class="feature-item">
        <div class="icon-box"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg></div>
        <h3>Vendor Database</h3>
        <p>Find the right partners. A curated list of CRMs, credit agencies, compliance tools, and disclosure services.</p>
      </div>
      <div class="feature-item">
        <div class="icon-box"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div>
        <h3>Contacts Directory</h3>
        <p>Direct access to lender account reps, underwriting departments, and vendor support contacts.</p>
      </div>
      <div class="feature-item">
        <div class="icon-box"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg></div>
        <h3>How-to Playbooks</h3>
        <p>Step-by-step guidance for pricing and disclosing complex loan types to reduce guesswork.</p>
      </div>
    </div>
  </div>
</section>

<!-- ================================================
     PRICING SECTION
     ================================================ -->
<section class="mtg-pricing-section" id="pricing">
  <div class="mtg-container">
    <div class="mtg-pricing-header">
      <h2>Simple, transparent pricing.</h2>
      <p>Start free. Upgrade when you're ready to scale.</p>
    </div>

    <div class="mtg-pricing-grid">

      <!-- LITE PLAN -->
      <div class="mtg-pricing-card lite">
        <div class="plan-header-bar lite-bar"></div>
        <div class="plan-content">
          <div class="plan-name-badge lite-badge">LITE</div>
          <div class="plan-price">$0<span class="period">/mo</span></div>
          <p class="plan-desc">Free access to lender &amp; vendor directories, plus core calculators.</p>

          <ul class="plan-features">
            <li class="included">
              <div class="feature-icon">${CHECK_SVG}</div>
              <div class="feature-name">Lender Directory</div>
            </li>
            <li class="included">
              <div class="feature-icon">${CHECK_SVG}</div>
              <div class="feature-name">Vendor Directory</div>
            </li>
            <li class="limited">
              <div class="feature-icon limited-icon">${CHECK_SVG}</div>
              <div class="feature-name">Loan Product Search: <span class="feature-detail">Limited</span></div>
            </li>
            <li class="limited">
              <div class="feature-icon limited-icon">${CHECK_SVG}</div>
              <div class="feature-name">Calculators: <span class="feature-detail">Basic</span></div>
            </li>
            <li class="unavailable"><div class="feature-name">Favorites and Custom Notes</div></li>
            <li class="unavailable"><div class="feature-name">Save Calculator Scenarios</div></li>
            <li class="unavailable"><div class="feature-name">Pipeline Tracker</div></li>
            <li class="unavailable"><div class="feature-name">Print to PDF / Export</div></li>
            <li class="unavailable"><div class="feature-name">Referral Program</div></li>
          </ul>

          <a href="javascript:void(0);" class="mtg-btn-outline" data-plan-btn="lite" data-state="logged-out" onclick="openOutsetaSignup('NmdnZg90')">Create Free Account</a>
          <div class="mtg-btn-current" data-plan-btn="lite" data-state="current-plan" style="display:none;">Current Plan \u2713</div>
        </div>
      </div>

      <!-- PLUS PLAN -->
      <div class="mtg-pricing-card plus">
        <div class="plan-header-bar plus-bar"></div>
        <div class="plan-content">
          <div class="plan-name-badge plus-badge">PLUS</div>
          <div class="plan-price">$49<span class="period">/mo</span></div>
          <p class="plan-desc">Full access with smart limits for growing teams.</p>

          <ul class="plan-features">
            <li class="included">
              <div class="feature-icon">${CHECK_SVG}</div>
              <div class="feature-name">Lender Directory</div>
            </li>
            <li class="included">
              <div class="feature-icon">${CHECK_SVG}</div>
              <div class="feature-name">Vendor Directory</div>
            </li>
            <li class="included">
              <div class="feature-icon">${CHECK_SVG}</div>
              <div class="feature-name">Loan Product Search</div>
            </li>
            <li class="included">
              <div class="feature-icon">${CHECK_SVG}</div>
              <div class="feature-name">Calculators: <strong>Advanced</strong></div>
            </li>
            <li class="included">
              <div class="feature-icon">${CHECK_SVG}</div>
              <div class="feature-name">Favorites and Custom Notes</div>
            </li>
            <li class="limited">
              <div class="feature-icon limited-icon">${CHECK_SVG}</div>
              <div class="feature-name">Save Calculator Scenarios: <span class="feature-detail">Limited</span></div>
            </li>
            <li class="limited">
              <div class="feature-icon limited-icon">${CHECK_SVG}</div>
              <div class="feature-name">Pipeline Tracker: <span class="feature-detail">Limited</span></div>
            </li>
            <li class="unavailable"><div class="feature-name">Print to PDF / Export</div></li>
            <li class="unavailable"><div class="feature-name">Referral Program</div></li>
          </ul>

          <a href="javascript:void(0);" class="mtg-btn-full" data-plan-btn="plus" data-state="logged-out" onclick="openOutsetaSignup('Dmw8leQ4')">Start PLUS Trial</a>
          <a href="javascript:void(0);" class="mtg-btn-full" data-plan-btn="plus" data-state="upgrade" style="display:none;" onclick="openOutsetaProfile('planChange')">Upgrade to PLUS</a>
          <div class="mtg-btn-current" data-plan-btn="plus" data-state="current-plan" style="display:none;">Current Plan \u2713</div>
        </div>
      </div>

      <!-- PRO PLAN (MOST POPULAR) -->
      <div class="mtg-pricing-card pro">
        <div class="popular-tag">MOST POPULAR</div>
        <div class="plan-header-bar pro-bar"></div>
        <div class="plan-content">
          <div class="plan-name-badge pro-badge">PRO</div>
          <div class="plan-price">$79<span class="period">/mo</span></div>
          <p class="plan-desc">Unlimited everything for power users.</p>

          <ul class="plan-features">
            <li class="included">
              <div class="feature-icon">${CHECK_SVG}</div>
              <div class="feature-name">Lender Directory</div>
            </li>
            <li class="included">
              <div class="feature-icon">${CHECK_SVG}</div>
              <div class="feature-name">Vendor Directory</div>
            </li>
            <li class="included">
              <div class="feature-icon">${CHECK_SVG}</div>
              <div class="feature-name">Loan Product Search</div>
            </li>
            <li class="included">
              <div class="feature-icon">${CHECK_SVG}</div>
              <div class="feature-name">Calculators: <strong>Advanced</strong></div>
            </li>
            <li class="included">
              <div class="feature-icon">${CHECK_SVG}</div>
              <div class="feature-name">Favorites and Custom Notes</div>
            </li>
            <li class="included">
              <div class="feature-icon">${CHECK_SVG}</div>
              <div class="feature-name">Save Calculator Scenarios: <strong>Unlimited</strong></div>
            </li>
            <li class="included">
              <div class="feature-icon">${CHECK_SVG}</div>
              <div class="feature-name">Pipeline Tracker: <strong>Unlimited</strong></div>
            </li>
            <li class="included">
              <div class="feature-icon">${CHECK_SVG}</div>
              <div class="feature-name">Print to PDF / Export</div>
            </li>
            <li class="included">
              <div class="feature-icon">${CHECK_SVG}</div>
              <div class="feature-name">Referral Program</div>
            </li>
          </ul>

          <a href="javascript:void(0);" class="mtg-btn-full" data-plan-btn="pro" data-state="logged-out" onclick="openOutsetaSignup('yWobBP9D')">Start PRO Trial</a>
          <a href="javascript:void(0);" class="mtg-btn-full" data-plan-btn="pro" data-state="upgrade" style="display:none;" onclick="openOutsetaProfile('planChange')">Upgrade to PRO</a>
          <div class="mtg-btn-current" data-plan-btn="pro" data-state="current-plan" style="display:none;">Current Plan \u2713</div>
        </div>
      </div>

    </div>
  </div>
</section>

<!-- ================================================
     CTA SECTION
     ================================================ -->
<section class="mtg-cta-section">
  <div class="mtg-container">
    <div class="cta-card">
      <div class="cta-glow-top"></div>
      <div class="cta-glow-bottom"></div>
      <div class="cta-content">
        <h2>Instant answers for every scenario.</h2>
        <p>Stop guessing and start closing. Find the right guidelines and programs in seconds.</p>

        <a href="https://mtgbroker.outseta.com/auth?widgetMode=register#o-anonymous" class="mtg-btn-white">Get Started for Free</a>
        <div class="cta-note">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          No credit card required for free account.
        </div>
      </div>
    </div>
  </div>
</section>
`;


// ============================================================
// HOME PAGE JAVASCRIPT
// Outseta signup/profile handlers + plan state management.
// ============================================================
const HOME_JS = `
/* ============================================================
   PRICING CARD BUTTON HANDLERS
   Uses Outseta's JavaScript API with 3-method fallback
   ============================================================ */

window.openOutsetaSignup = function(planUid) {
  if (typeof Outseta !== 'undefined' && Outseta.auth && typeof Outseta.auth.open === 'function') {
    Outseta.auth.open({ widgetMode: 'register', planUid: planUid, skipPlanOptions: true });
    return;
  }
  if (typeof Outseta !== 'undefined' && typeof Outseta.showWidget === 'function') {
    Outseta.showWidget({ widgetMode: 'register', planUid: planUid, skipPlanOptions: true });
    return;
  }
  window.location.href = 'https://mtgbroker.outseta.com/auth?widgetMode=register&planUid=' + planUid + '&skipPlanOptions=true#o-anonymous';
};

window.openOutsetaProfile = function(tab) {
  if (typeof Outseta !== 'undefined' && Outseta.profile && typeof Outseta.profile.open === 'function') {
    Outseta.profile.open({ tab: tab || 'planChange' });
  } else if (typeof Outseta !== 'undefined' && typeof Outseta.showProfile === 'function') {
    Outseta.showProfile({ tab: tab || 'planChange' });
  } else {
    window.location.href = 'https://mtgbroker.outseta.com/profile#o-authenticated';
  }
};

/* ============================================================
   PLAN STATE MANAGEMENT
   Fast JWT extraction -> Outseta SDK fallback
   ============================================================ */
(function() {
  'use strict';

  var UID_TO_PLAN = {
    'NmdnZg90': 'LITE',
    'NmdmZg90': 'LITE',
    'Dmw8leQ4': 'PLUS',
    'yWobBP9D': 'PRO'
  };

  var PLAN_RANK = { 'LITE': 0, 'PLUS': 1, 'PRO': 2 };

  function init() {
    var currentPlan = getPlanFromJWT();
    if (currentPlan) {
      applyPlanState(currentPlan);
      return;
    }

    var hasToken = !!localStorage.getItem('Outseta.nocode.accessToken');
    if (!hasToken) {
      showLoggedOutButtons();
      return;
    }

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
        if (planUid && UID_TO_PLAN[planUid]) return UID_TO_PLAN[planUid];
      }
    } catch (e) { /* silent fail */ }
    return null;
  }

  function getPlanFromOutsetaUser() {
    window.getCachedOutsetaUser().then(function(user) {
      if (!user) { showLoggedOutButtons(); return; }
      var planUid = user.Account && user.Account.CurrentSubscription && user.Account.CurrentSubscription.Plan
        ? user.Account.CurrentSubscription.Plan.Uid : null;
      applyPlanState(UID_TO_PLAN[planUid] || 'LITE');
    }).catch(function() { showLoggedOutButtons(); });
  }

  function applyPlanState(currentPlan) {
    var currentRank = PLAN_RANK[currentPlan] || 0;
    document.querySelectorAll('[data-plan-btn]').forEach(function(el) { el.style.display = 'none'; });

    ['lite', 'plus', 'pro'].forEach(function(plan) {
      var planRank = PLAN_RANK[plan.toUpperCase()] || 0;
      if (planRank === currentRank) {
        showBtn(plan, 'current-plan');
      } else if (planRank > currentRank) {
        showBtn(plan, 'upgrade');
      }
    });
  }

  function showBtn(plan, state) {
    var btn = document.querySelector('[data-plan-btn="' + plan + '"][data-state="' + state + '"]');
    if (btn) btn.style.display = 'block';
  }

  function showLoggedOutButtons() {
    document.querySelectorAll('[data-plan-btn]').forEach(function(el) { el.style.display = 'none'; });
    document.querySelectorAll('[data-state="logged-out"]').forEach(function(el) { el.style.display = 'block'; });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
`;


// ============================================================
// BUILD: Combines CSS + HTML + JS into one injectable script
// ============================================================
function buildHomeScript() {
  // Escape backticks and ${} in template literals
  const escapedCSS = HOME_CSS.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  const escapedHTML = HOME_HTML.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  const escapedJS = HOME_JS.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

  return `/* mtg-broker-home v1.0 */
(function() {
  'use strict';

  // 1. Load Google Fonts (if not already loaded)
  if (!document.querySelector('link[href*="Host+Grotesk"]')) {
    var preconnect1 = document.createElement('link');
    preconnect1.rel = 'preconnect';
    preconnect1.href = 'https://fonts.googleapis.com';
    document.head.appendChild(preconnect1);

    var preconnect2 = document.createElement('link');
    preconnect2.rel = 'preconnect';
    preconnect2.href = 'https://fonts.gstatic.com';
    preconnect2.crossOrigin = 'anonymous';
    document.head.appendChild(preconnect2);

    var fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Host+Grotesk:wght@400;500;700;800&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap';
    document.head.appendChild(fontLink);
  }

  // 2. Inject CSS into <head>
  var style = document.createElement('style');
  style.id = 'mtg-home-styles';
  style.textContent = \`${escapedCSS}\`;
  document.head.appendChild(style);

  // 3. Inject HTML into mount target
  var mount = document.getElementById('mtg-home');
  if (mount) {
    mount.innerHTML = \`${escapedHTML}\`;
  } else {
    // Fallback: insert before Footer_Main if no mount target
    var footer = document.querySelector('[data-wf-component="Footer_Main"]') || document.querySelector('footer');
    if (footer) {
      var wrapper = document.createElement('div');
      wrapper.id = 'mtg-home';
      wrapper.innerHTML = \`${escapedHTML}\`;
      footer.parentNode.insertBefore(wrapper, footer);
    }
  }

  // 4. Execute pricing logic
  var scriptEl = document.createElement('script');
  scriptEl.textContent = \`${escapedJS}\`;
  document.body.appendChild(scriptEl);
})();
`;
}

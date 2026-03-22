/**
 * mtg-broker-footer — Cloudflare Worker v1.0
 * =========================================================
 * Serves the App Pages Footer as an injectable JavaScript file.
 *
 * ENDPOINT:
 *   GET /footer.js  → returns footer as executable JS
 *   GET /           → health check
 *
 * DEPLOY:
 *   wrangler deploy workers/mtg-broker-footer.js \
 *     --name mtg-broker-footer \
 *     --compatibility-date 2024-01-01
 *
 * HOW TO USE IN WEBFLOW (Footer_App HtmlEmbed):
 *   <div id="mtg-footer"></div>
 *   <script>
 *     (function() {
 *       var s = document.createElement('script');
 *       s.src = 'https://mtg-broker-footer.rich-e00.workers.dev/footer.js';
 *       s.defer = true;
 *       document.head.appendChild(s);
 *     })();
 *   </script>
 *
 * TO UPDATE THE FOOTER:
 *   1. Edit this file (CSS or HTML sections below).
 *   2. Run: wrangler deploy workers/mtg-broker-footer.js --name mtg-broker-footer
 *   3. All pages pick up the change automatically — no Webflow edits needed.
 *
 * SAFE EMBEDDING TECHNIQUE:
 *   buildFooterScript() uses string array + JSON.stringify() for ALL content.
 *   This avoids ALL template literal escaping issues — no backtick or ${} problems.
 * =========================================================
 */

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/footer.js') {
      return new Response(buildFooterScript(), {
        headers: {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
        },
      });
    }

    return new Response(
      'mtg-broker-footer v1.0 worker is running.\nGET /footer.js to get the footer script.',
      { headers: { 'Content-Type': 'text/plain' } }
    );
  },
};


// ============================================================
// SECTION 1: FOOTER CSS
// ============================================================
const FOOTER_CSS = [
  '.simple-calc-footer{background-color:#0f172a;color:#64748B;padding:32px 0;',
  "font-family:'Host Grotesk',system-ui,-apple-system,sans-serif;",
  'border-top:1px solid rgba(255,255,255,0.05);margin-top:40px;}',

  '.simple-footer-container{width:90%;max-width:1280px;margin:0 auto;text-align:center;}',

  '.simple-footer-meta{display:flex;justify-content:center;align-items:center;',
  'gap:24px;flex-wrap:wrap;margin-bottom:16px;font-size:13px;font-weight:500;color:#94A3B8;}',

  '.simple-legal-links{display:flex;align-items:center;gap:12px;}',

  '.simple-link{color:#94A3B8;text-decoration:none;transition:color 0.2s ease;cursor:pointer;}',
  '.simple-link:hover{color:#FFFFFF;text-decoration:underline;}',

  '.link-separator{color:#475569;font-size:11px;}',

  '.eho-badge{display:flex;align-items:center;gap:6px;opacity:0.8;}',

  '.simple-disclaimer-text{font-size:11px;line-height:1.5;color:#475569;',
  'max-width:800px;margin:0 auto;}',

  '@media(max-width:600px){',
  '.simple-calc-footer{padding:24px 0;}',
  '.simple-footer-meta{flex-direction:column;gap:12px;margin-bottom:20px;}',
  '.simple-legal-links{order:2;}',
  '.eho-badge{order:3;}',
  '.simple-disclaimer-text{font-size:10px;padding:0 10px;}',
  '}',
].join('');


// ============================================================
// SECTION 2: FOOTER HTML PARTS
// Split into named pieces for readability.
// The copyright year is inserted dynamically by the injected JS.
// ============================================================
const FOOTER_HTML_BEFORE_YEAR = [
  '<footer class="simple-calc-footer">',
  '<div class="simple-footer-container">',
  '<div class="simple-footer-meta">',
  '<span class="copyright-text">\u00a9 ',
].join('');

const FOOTER_HTML_AFTER_YEAR = [
  ' MtgBroker, LLC</span>',
  '<nav class="simple-legal-links">',
  '<a href="/privacy-policy" target="_blank" class="simple-link">Privacy Policy</a>',
  '<span class="link-separator">|</span>',
  '<a href="/terms-of-service" target="_blank" class="simple-link">Terms of Service</a>',
  '</nav>',
  '<div class="eho-badge" title="Equal Housing Opportunity">',
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"',
  ' stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">',
  '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>',
  '<polyline points="9 22 9 12 15 12 15 22"></polyline>',
  '</svg>',
  '<span>Equal Housing Opportunity</span>',
  '</div>',
  '</div>',
  '<p class="simple-disclaimer-text">',
  'MtgBroker, LLC provides informational tools for mortgage professionals and does not',
  ' provide legal, tax, or financial advice. Calculator and scenario results are estimates',
  ' and may not reflect final lender approval or pricing. MtgBroker, LLC is not a lender.',
  '</p>',
  '</div>',
  '</footer>',
].join('');


// ============================================================
// SECTION 3: SCRIPT BUILDER
// Assembles all pieces into a self-executing JS snippet that:
//   1. Injects the CSS as a <style> tag (once).
//   2. Finds #mtg-footer and replaces it with the footer HTML.
//   3. The copyright year is set dynamically via JS.
// ============================================================
function buildFooterScript() {
  const css  = JSON.stringify(FOOTER_CSS);
  const pre  = JSON.stringify(FOOTER_HTML_BEFORE_YEAR);
  const post = JSON.stringify(FOOTER_HTML_AFTER_YEAR);

  return `
(function() {
  // --- Inject CSS (only once) ---
  if (!document.getElementById('mtg-footer-styles')) {
    var style = document.createElement('style');
    style.id = 'mtg-footer-styles';
    style.textContent = ${css};
    document.head.appendChild(style);
  }

  // --- Render footer into #mtg-footer ---
  function renderFooter() {
    var mount = document.getElementById('mtg-footer');
    if (!mount) return;
    var year = String(new Date().getFullYear());
    var html = ${pre} + year + ${post};
    mount.outerHTML = html;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderFooter);
  } else {
    renderFooter();
  }
})();
`.trim();
}

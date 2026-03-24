/**
 * mtg-broker-navbar — Cloudflare Worker v2.8
 * =========================================================
 * Serves the App Navbar as an injectable JavaScript file.
 *
 * ENDPOINT:
 *   GET /navbar.js  → returns navbar as executable JS
 *   GET /           → health check
 *
 * DEPLOY:
 *   wrangler deploy workers/mtg-broker-navbar.js \
 *     --name mtg-broker-navbar \
 *     --compatibility-date 2024-01-01
 *
 * HOW TO USE IN WEBFLOW (Navbar_App HtmlEmbed):
 *   <div id="mtg-navbar"></div>
 *   <script>
 *     (function() {
 *       var s = document.createElement('script');
 *       s.src = 'https://mtg-broker-navbar.rich-e00.workers.dev/navbar.js';
 *       s.defer = true;
 *       document.head.appendChild(s);
 *     })();
 *   </script>
 *
 * TO UPDATE THE NAVBAR:
 *   1. Edit this file (CSS, HTML, or JS sections below).
 *   2. Run: wrangler deploy workers/mtg-broker-navbar.js --name mtg-broker-navbar
 *   3. All pages pick up the change automatically — no Webflow edits needed.
 *
 * COMPATIBILITY NOTES (v2.8):
 *   - Uses .mb-navWrap, .mb-header, .mb-navSpacer — matches Site Settings CSS exactly
 *   - Does NOT redefine --navbar-height (set to 77px in Site Settings head code)
 *   - Uses window.getCachedOutsetaUser() when available (Site Settings footer Section 0)
 *   - Falls back to own Outseta cache if global cache not loaded yet
 *   - Plan UIDs match CLAUDE.md: LITE=NmdnZg90, PLUS=Dmw8leQ4, PRO=yWobBP9D
 *
 * SAFE EMBEDDING TECHNIQUE:
 *   buildNavbarScript() uses string array + JSON.stringify() for ALL content.
 *   This avoids ALL template literal escaping issues — no backtick or ${} problems.
 * =========================================================
 */

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/navbar.js') {
      return new Response(buildNavbarScript(), {
        headers: {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
        },
      });
    }

    return new Response(
      'mtg-broker-navbar v2.8 worker is running.\nGET /navbar.js to get the navbar script.',
      { headers: { 'Content-Type': 'text/plain' } }
    );
  },
};


// ============================================================
// SECTION 1: NAVBAR CSS
// Matches Site Settings head code class names exactly.
// Does NOT define --navbar-height (set to 77px in Site Settings).
// ============================================================
const NAVBAR_CSS = `
.mb-navWrap{position:fixed;top:0;left:0;right:0;z-index:9999;padding:0;background:#ffffff;border-bottom:1px solid #E7EAF0;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);}
.mb-header{width:90%;max-width:1280px;margin:0 auto;padding:16px 0;display:flex;align-items:center;justify-content:space-between;gap:18px;}
.mb-navSpacer{height:0;}
.mb-brand{display:flex;align-items:center;height:44px;text-decoration:none;min-width:220px;}
.mb-brandLogo{height:32px;width:auto;display:block;}
.mb-brandGroup{display:flex;align-items:center;gap:12px;min-width:0;}
.mb-planTags{display:flex;align-items:center;gap:6px;flex-shrink:0;position:relative;}
.mb-planTag{font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;padding:3px 10px;border-radius:6px;line-height:1.4;white-space:nowrap;cursor:pointer;user-select:none;transition:opacity 0.15s;}
.mb-planTag:hover{opacity:0.8;}
.mb-planPopover{position:absolute;top:calc(100% + 10px);left:0;width:248px;background:#fff;border:1px solid #E2E8F0;border-radius:12px;box-shadow:0 8px 24px rgba(15,23,42,0.12);padding:16px;z-index:10001;animation:mb-fadeIn 0.15s ease;}
.mb-planPopover[hidden]{display:none;}
.mb-planPopover-plan{font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#94A3B8;margin-bottom:6px;}
.mb-planPopover-desc{font-size:13px;color:#374151;line-height:1.55;margin:0 0 14px 0;}
.mb-planPopover-btn{display:block;width:100%;padding:10px 14px;background:#2563EB;color:#fff;border-radius:8px;text-align:center;font-weight:700;font-size:13px;text-decoration:none;transition:background 0.15s;box-sizing:border-box;}
.mb-planPopover-btn:hover{background:#1D4ED8;}
.mb-planPopover-pro{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:600;color:#16A34A;}
.mb-planTag[data-plan="LITE"]{background:#F1F5F9;color:#64748B;border:1px solid #E2E8F0;}
.mb-planTag[data-plan="PLUS"]{background:#EFF6FF;color:#2563EB;border:1px solid #BFDBFE;}
.mb-planTag[data-plan="PRO"]{background:linear-gradient(135deg,#2563EB 0%,#7C3AED 100%);color:#ffffff;border:1px solid transparent;}
.mb-adminTag{font-size:10px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;padding:3px 8px;border-radius:6px;line-height:1.4;white-space:nowrap;background:#FEF2F2;color:#DC2626;border:1px solid #FECACA;text-decoration:none;}
.mb-nexaTag{font-size:10px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;padding:3px 8px;border-radius:6px;line-height:1.4;white-space:nowrap;background:linear-gradient(135deg,#2563EB 0%,#1d4ed8 100%);color:#ffffff;border:1px solid transparent;}
.mb-nexaTag-sm{font-size:9px;padding:2px 6px;border-radius:5px;}
.mb-planTag-sm{font-size:10px;padding:2px 7px;border-radius:5px;}
.mb-adminTag-sm{font-size:9px;padding:2px 6px;border-radius:5px;}
.mb-mUserCard-tags{display:flex;align-items:center;gap:5px;margin-top:2px;}
.mb-dashBtn{font-weight:800;color:#ffffff;padding:10px 20px;border-radius:6px;background:#2563eb;border:none;white-space:nowrap;box-shadow:0 1px 2px rgba(0,0,0,0.05);transition:all 0.2s ease;text-decoration:none;font-size:15px;line-height:1;display:inline-flex;align-items:center;justify-content:center;height:40px;}
.mb-dashBtn:hover{background:#1E40AF;box-shadow:0 4px 8px rgba(37,99,235,0.25);transform:translateY(-1px);}
.mb-actions{display:flex;align-items:center;gap:12px;justify-content:flex-end;flex:0 0 auto;}
.mb-authBtn{height:44px;min-width:110px;padding:0 18px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;font-weight:800;font-size:16px;line-height:1;border:1px solid transparent;white-space:nowrap;}
.mb-authBtnGray{background:#EEF2F7;border-color:#E7EAF0;color:#0f172a;}
.mb-authBtnGray:hover{filter:brightness(0.98);}
.mb-authBtnBlue{background:#2563eb;border-color:#2563eb;color:#fff;}
.mb-authBtnBlue:hover{filter:brightness(0.96);}
.mb-authBtnFull{width:100%;min-width:0;margin-top:10px;}
.mb-authIn{display:flex;gap:8px;}
.mb-mobileAuthIn{display:block;}
.mb-avatarBtn{width:44px;height:44px;border-radius:999px;border:1px solid #E7EAF0;background:#fff;display:inline-flex;align-items:center;justify-content:center;overflow:hidden;text-decoration:none;color:#0f172a;}
.mb-avatarImg{width:100%;height:100%;object-fit:cover;display:none;}
.mb-avatarBtn.has-img .mb-avatarImg{display:block;}
.mb-avatarBtn.has-img .mb-avatarFallback{display:none;}
.mb-avatarFallback{display:inline-flex;opacity:0.75;}
.mb-burger{display:none;width:44px;height:44px;border-radius:12px;border:1px solid #E7EAF0;background:#fff;cursor:pointer;padding:10px;}
.mb-burger span{display:block;height:2px;background:#0f172a;border-radius:2px;margin:5px 0;}
.mb-mobile{pointer-events:auto;width:100%;background:#fff;border-bottom:1px solid #E7EAF0;box-shadow:0 10px 20px rgba(15,23,42,0.05);padding:20px;max-height:calc(100vh - 77px);overflow-y:auto;}
.mb-mobile-divider{height:1px;background:#E7EAF0;margin:20px 0;}
.mb-mobileNav{display:flex;flex-direction:column;gap:4px;}
.mb-mLink{display:flex;align-items:center;gap:12px;padding:12px 12px;border-radius:12px;text-decoration:none;color:#0f172a;font-weight:600;font-size:15px;background:none;border:none;cursor:pointer;width:100%;text-align:left;font-family:inherit;}
.mb-mLink:hover{background:rgba(15,23,42,0.04);}
.mb-mLink svg{width:20px;height:20px;flex-shrink:0;stroke:currentColor;}
.mb-mDivider{height:1px;background:#E7EAF0;margin:16px 0;}
.mb-mNexa-section{margin-top:8px;padding-top:8px;}
.mb-mNexa-label{font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.05em;padding:8px 12px 4px 12px;}
.mb-mLink-nexa{color:#1e40af;}
.mb-mLink-nexa svg{color:#2563EB;}
.mb-mLink-nexa:hover{background:#EFF6FF;color:#1e40af;}
.mb-mNexa-tag{font-size:9px;font-weight:700;color:#fff;background:linear-gradient(135deg,#2563EB 0%,#1d4ed8 100%);padding:2px 6px;border-radius:4px;letter-spacing:0.04em;text-transform:uppercase;flex-shrink:0;line-height:1.3;margin-left:auto;}
.mb-mNexa-section.nexa-only{display:none !important;}
body.nexa-user .mb-mNexa-section.nexa-only{display:block !important;}
.mb-helpWrap{position:relative;}
.mb-helpBtn{width:40px;height:40px;border-radius:999px;border:1px solid #E7EAF0;background:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:#64748B;transition:all 0.2s ease;padding:0;}
.mb-helpBtn:hover{background:#F8FAFC;color:#2563EB;border-color:#BFDBFE;}
.mb-helpBtn[aria-expanded="true"]{background:#EFF6FF;color:#2563EB;border-color:#BFDBFE;box-shadow:0 0 0 3px rgba(37,99,235,0.1);}
.mb-helpDropdown{position:absolute;top:calc(100% + 10px);right:0;width:280px;background:#fff;border:1px solid #E7EAF0;border-radius:14px;box-shadow:0 12px 28px rgba(15,23,42,0.12),0 4px 8px rgba(15,23,42,0.04);z-index:10000;overflow:hidden;animation:mb-helpDropIn 0.15s ease-out;}
@keyframes mb-helpDropIn{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:translateY(0);}}
.mb-helpDropdown-header{padding:14px 16px 10px;font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.05em;}
.mb-helpDropdown-item{display:flex;align-items:center;gap:12px;padding:10px 16px;text-decoration:none;color:#0f172a;cursor:pointer;transition:background 0.15s ease;border:none;background:none;width:100%;text-align:left;font-family:inherit;font-size:inherit;}
.mb-helpDropdown-item:hover{background:#F8FAFC;}
.mb-helpDropdown-icon{width:34px;height:34px;border-radius:10px;background:#F1F5F9;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#475569;transition:all 0.15s ease;}
.mb-helpDropdown-item:hover .mb-helpDropdown-icon{background:#EFF6FF;color:#2563EB;}
.mb-helpDropdown-text{display:flex;flex-direction:column;gap:1px;min-width:0;}
.mb-helpDropdown-label{font-size:14px;font-weight:600;color:#0f172a;line-height:1.3;}
.mb-helpDropdown-desc{font-size:12px;color:#94A3B8;line-height:1.3;}
.mb-helpDropdown-divider{height:1px;background:#E7EAF0;margin:6px 16px;}
.mb-mHelp-label{font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.05em;padding:4px 12px 4px 12px;}
.mb-mLink-help{color:#475569;}
.mb-mLink-help svg{color:#94A3B8;}
.mb-mLink-help:hover{background:#F8FAFC;color:#2563EB;}
.mb-mLink-help:hover svg{color:#2563EB;}
.mb-supportModal{position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;}
.mb-supportModal[hidden]{display:none;}
.mb-supportModal-backdrop{position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(15,23,42,0.5);animation:mb-fadeIn 0.2s ease;}
@keyframes mb-fadeIn{from{opacity:0;}to{opacity:1;}}
.mb-supportModal-content{position:relative;background:#fff;border-radius:16px;box-shadow:0 20px 40px rgba(15,23,42,0.15);width:100%;max-width:560px;max-height:85vh;overflow:hidden;display:flex;flex-direction:column;animation:mb-slideUp 0.25s ease-out;}
@keyframes mb-slideUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
.mb-supportModal-header{display:flex;align-items:center;justify-content:space-between;padding:20px 24px 16px;border-bottom:1px solid #E7EAF0;}
.mb-supportModal-title{font-size:18px;font-weight:700;color:#0f172a;margin:0;}
.mb-supportModal-close{width:36px;height:36px;border-radius:10px;border:none;background:#F1F5F9;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#64748B;transition:all 0.15s ease;padding:0;}
.mb-supportModal-close:hover{background:#E2E8F0;color:#0f172a;}
.mb-supportModal-body{padding:24px;overflow-y:auto;flex:1;}
.mb-mUserCard{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px;background:#F8FAFC;border:1px solid #E7EAF0;text-decoration:none;color:#0f172a;margin-bottom:12px;transition:background 0.15s ease;}
.mb-mUserCard:hover{background:#F1F5F9;}
.mb-mAvatar{width:36px;height:36px;border-radius:999px;border:1px solid #E7EAF0;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;background:#fff;flex:0 0 auto;}
.mb-mAvatar .mb-avatarImg{width:100%;height:100%;object-fit:cover;display:none;}
.mb-mAvatar.has-img .mb-avatarImg{display:block;}
.mb-mAvatar.has-img .mb-avatarFallback{display:none;}
.mb-mUserCard-text{display:flex;flex-direction:column;flex:1;min-width:0;}
.mb-mUserCard-label{font-size:15px;font-weight:700;color:#0f172a;line-height:1.3;}
.mb-mUserCard-sub{font-size:12px;color:#94A3B8;line-height:1.3;}
.mb-mUserCard-arrow{flex-shrink:0;color:#94A3B8;}
.mb-mUserActions{display:flex;gap:10px;}
.mb-mUserAction-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 16px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;line-height:1;border:1px solid transparent;white-space:nowrap;transition:all 0.15s ease;}
.mb-mUserAction-btn svg{flex-shrink:0;}
.mb-mUserAction-dash{background:#2563eb;color:#fff;border-color:#2563eb;}
.mb-mUserAction-dash:hover{background:#1E40AF;}
.mb-mUserAction-logout{background:#EEF2F7;color:#374151;border-color:#E7EAF0;}
.mb-mUserAction-logout:hover{background:#E2E8F0;}
@media (max-width:991px){.mb-burger{display:inline-block;}}
@media (max-width:767px){.mb-brand{min-width:auto;}.mb-authOut,.mb-authIn{display:none;}.mb-dashBtn{display:none !important;}.mb-helpWrap{display:none;}.mb-planTags{display:none;}}
`;


// ============================================================
// SECTION 2: NAVBAR HTML
// Uses exact same structure as v2.8 embed — matches Site Settings CSS.
// ============================================================
const NAVBAR_HTML = `
<div class="mb-navSpacer" aria-hidden="true"></div>

<header class="mb-navWrap" role="banner">
  <div class="mb-header">

    <div class="mb-brandGroup">
      <a class="mb-brand" href="/app/dashboard" aria-label="MtgBroker dashboard">
        <img class="mb-brandLogo" src="https://cdn.prod.website-files.com/694e4aaf5f511ad7901b74bc/69576dcb21edb9d479222c02_Logo_Horizontal_Blue.png" alt="MtgBroker" loading="eager"/>
      </a>
      <div class="mb-planTags" data-mb-auth="in" style="display:none;">
        <span class="mb-planTag" id="mb-planTag-desktop" style="display:none;" role="button" tabindex="0" aria-haspopup="true" aria-expanded="false" title="View plan details"></span>
        <a class="mb-adminTag" id="mb-adminTag-desktop" href="/admin-hub" style="display:none;">Admin</a>
        <span class="mb-nexaTag" id="mb-nexaTag-desktop" style="display:none;">NEXA</span>
        <div id="mb-planPopover" class="mb-planPopover" hidden>
          <div class="mb-planPopover-plan" id="mb-planPopover-plan"></div>
          <p class="mb-planPopover-desc" id="mb-planPopover-desc"></p>
          <a class="mb-planPopover-btn" id="mb-planPopover-btn" href="/pricing" target="_blank" rel="noopener noreferrer"></a>
          <div class="mb-planPopover-pro" id="mb-planPopover-pro" style="display:none;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            You're on our best plan!
          </div>
        </div>
      </div>
    </div>

    <div class="mb-actions" aria-label="User actions">
      <a class="mb-dashBtn" href="/app/dashboard" data-mb-auth="in" style="display:none;">Dashboard</a>

      <div class="mb-authOut" data-mb-auth="out">
        <a class="mb-authBtn mb-authBtnGray" href="https://mtgbroker.outseta.com/auth?widgetMode=login#o-anonymous">Login</a>
        <a class="mb-authBtn mb-authBtnBlue" href="https://mtgbroker.outseta.com/auth?widgetMode=register#o-anonymous">Signup</a>
      </div>

      <div class="mb-authIn" data-mb-auth="in" style="display:none;">
        <a class="mb-authBtn mb-authBtnGray" href="/#o-logout-link">Logout</a>
      </div>

      <div class="mb-helpWrap" data-mb-auth="in" style="display:none;">
        <button class="mb-helpBtn" type="button" aria-label="Help and Support" aria-expanded="false" aria-haspopup="true">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        </button>
        <div class="mb-helpDropdown" hidden>
          <div class="mb-helpDropdown-header">Help and Support</div>
          <a class="mb-helpDropdown-item" href="https://mtgbroker.outseta.com/support/kb/categories" target="_blank" rel="noopener noreferrer" onclick="window.open(this.href,'_blank');return false;">
            <span class="mb-helpDropdown-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg></span>
            <span class="mb-helpDropdown-text"><span class="mb-helpDropdown-label">Knowledge Base</span><span class="mb-helpDropdown-desc">Browse help articles</span></span>
          </a>
          <button class="mb-helpDropdown-item" type="button" data-mb-open-support>
            <span class="mb-helpDropdown-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg></span>
            <span class="mb-helpDropdown-text"><span class="mb-helpDropdown-label">Submit a Ticket</span><span class="mb-helpDropdown-desc">Get help from our team</span></span>
          </button>
          <a class="mb-helpDropdown-item" href="mailto:support@mtg.broker" target="_blank" rel="noopener noreferrer">
            <span class="mb-helpDropdown-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg></span>
            <span class="mb-helpDropdown-text"><span class="mb-helpDropdown-label">Email Support</span><span class="mb-helpDropdown-desc">support@mtg.broker</span></span>
          </a>
          <div class="mb-helpDropdown-divider"></div>
          <button class="mb-helpDropdown-item" type="button" data-mb-open-ybug>
            <span class="mb-helpDropdown-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 2 1.88 1.88"></path><path d="M14.12 3.88 16 2"></path><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"></path><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"></path><path d="M12 20v-9"></path><path d="M6.53 9C4.6 8.8 3 7.1 3 5"></path><path d="M6 13H2"></path><path d="M3 21c0-2.1 1.7-3.9 3.8-4"></path><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"></path><path d="M22 13h-4"></path><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"></path></svg></span>
            <span class="mb-helpDropdown-text"><span class="mb-helpDropdown-label">Report a Bug</span><span class="mb-helpDropdown-desc">Screenshot and send feedback</span></span>
          </button>
        </div>
      </div>

      <a class="mb-avatarBtn" data-mb-auth="in" data-mb-profile-link href="https://mtgbroker.outseta.com/widgets/profile" aria-label="Profile" style="display:none;">
        <span class="mb-avatarFallback" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Z" stroke="currentColor" stroke-width="2"/><path d="M4.5 20.5c1.8-3.2 5-5.1 7.5-5.1s5.7 1.9 7.5 5.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>
        <img class="mb-avatarImg" data-mb-avatar data-o-member="ProfileImageS3Url" alt="User profile photo" loading="lazy" referrerpolicy="no-referrer"/>
      </a>

      <button class="mb-burger" type="button" aria-label="Open menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>

  <div class="mb-mobile" hidden>
    <div class="mb-mobileNav">

      <a href="/app/dashboard" class="mb-mLink">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
        <span>Dashboard</span>
      </a>

      <a href="/app/pipeline" class="mb-mLink">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
        <span>Pipeline</span>
      </a>

      <a href="/app/loan-search" class="mb-mLink">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <span>Loan Search</span>
      </a>

      <a href="/app/lenders" class="mb-mLink">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21v-7M19 21v-7M9 21v-7M15 21v-7M3 10h18M12 3L2 10h20L12 3z"></path></svg>
        <span>Lenders</span>
      </a>

      <a href="/app/products" class="mb-mLink">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
        <span>Products</span>
      </a>

      <a href="/app/property-types" class="mb-mLink">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"></path><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"></path><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"></path><path d="M10 6h4"></path><path d="M10 10h4"></path><path d="M10 14h4"></path><path d="M10 18h4"></path></svg>
        <span>Property Types</span>
      </a>

      <a href="/app/vendors" class="mb-mLink">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1.5-5h15L21 9"></path><path d="M3 9v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9"></path><path d="M9 21V13h6v8"></path><path d="M3 9h18"></path><path d="M6 9v3a3 3 0 0 0 6 0V9"></path><path d="M12 9v3a3 3 0 0 0 6 0V9"></path></svg>
        <span>Vendors</span>
      </a>

      <a href="/app/contacts" class="mb-mLink">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
        <span>Contacts</span>
      </a>

      <a href="/app/calculators" class="mb-mLink">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="8" x2="16" y1="6" y2="6"></line><line x1="16" x2="16" y1="14" y2="18"></line><path d="M16 10h.01"></path><path d="M12 10h.01"></path><path d="M8 10h.01"></path><path d="M12 14h.01"></path><path d="M8 14h.01"></path><path d="M12 18h.01"></path><path d="M8 18h.01"></path></svg>
        <span>Calculators</span>
      </a>

      <a href="/app/goal-setting" class="mb-mLink">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
        <span>Goal Setting</span>
      </a>

      <a href="/app/social-media" class="mb-mLink">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
        <span>Social Media</span>
      </a>

      <a href="/app/tools" class="mb-mLink">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
        <span>Tools</span>
      </a>

      <div class="mb-mNexa-section nexa-only">
        <div class="mb-mNexa-label nexa-only">NEXA Exclusive</div>
        <a href="/app/credit-reports" class="mb-mLink mb-mLink-nexa nexa-only">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M9 15l2 2 4-4"></path></svg>
          <span>Credit Reports</span>
          <span class="mb-mNexa-tag">NEXA</span>
        </a>
      </div>

      <div class="mb-mDivider"></div>

      <a href="/app/saved" class="mb-mLink">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
        <span>Saved Items</span>
      </a>

      <a href="/app/settings" class="mb-mLink">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        <span>Settings</span>
      </a>

      <div class="mb-mDivider"></div>
      <div class="mb-mHelp-label">Help and Support</div>

      <a href="https://mtgbroker.outseta.com/support/kb/categories" target="_blank" rel="noopener noreferrer" class="mb-mLink mb-mLink-help" onclick="window.open(this.href,'_blank');return false;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
        <span>Knowledge Base</span>
      </a>

      <button type="button" class="mb-mLink mb-mLink-help" data-mb-open-support>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        <span>Submit a Ticket</span>
      </button>

      <a href="mailto:support@mtg.broker" target="_blank" rel="noopener noreferrer" class="mb-mLink mb-mLink-help">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>
        <span>Email Support</span>
      </a>

      <button type="button" class="mb-mLink mb-mLink-help" data-mb-open-ybug>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 2 1.88 1.88"></path><path d="M14.12 3.88 16 2"></path><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"></path><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"></path><path d="M12 20v-9"></path><path d="M6.53 9C4.6 8.8 3 7.1 3 5"></path><path d="M6 13H2"></path><path d="M3 21c0-2.1 1.7-3.9 3.8-4"></path><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"></path><path d="M22 13h-4"></path><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"></path></svg>
        <span>Report a Bug</span>
      </button>
    </div>

    <div class="mb-mobile-divider"></div>

    <div class="mb-mobile-app">
      <div class="mb-mobileAuthOut" data-mb-auth="out">
        <a class="mb-authBtn mb-authBtnBlue mb-authBtnFull" href="https://mtgbroker.outseta.com/auth?widgetMode=register#o-anonymous">Sign Up Free</a>
        <a class="mb-authBtn mb-authBtnGray mb-authBtnFull" href="https://mtgbroker.outseta.com/auth?widgetMode=login#o-anonymous">Login</a>
      </div>

      <div class="mb-mobileAuthIn" data-mb-auth="in" style="display:none;">
        <a class="mb-mUserCard" data-mb-profile-link href="https://mtgbroker.outseta.com/widgets/profile">
          <span class="mb-mAvatar">
            <img class="mb-avatarImg" data-mb-avatar data-o-member="ProfileImageS3Url" alt="User profile photo" loading="lazy" referrerpolicy="no-referrer"/>
            <span class="mb-avatarFallback" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Z" stroke="currentColor" stroke-width="2"/><path d="M4.5 20.5c1.8-3.2 5-5.1 7.5-5.1s5.7 1.9 7.5 5.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>
          </span>
          <span class="mb-mUserCard-text">
            <span class="mb-mUserCard-label">My Profile</span>
            <span class="mb-mUserCard-tags">
              <span class="mb-planTag mb-planTag-sm" id="mb-planTag-mobile" style="display:none;"></span>
              <a class="mb-adminTag mb-adminTag-sm" id="mb-adminTag-mobile" href="/admin-hub" style="display:none;">Admin</a>
              <span class="mb-nexaTag mb-nexaTag-sm" id="mb-nexaTag-mobile" style="display:none;">NEXA</span>
            </span>
          </span>
          <svg class="mb-mUserCard-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </a>
        <div class="mb-mUserActions">
          <a class="mb-mUserAction-btn mb-mUserAction-dash" href="/app/dashboard">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            Dashboard
          </a>
          <a class="mb-mUserAction-btn mb-mUserAction-logout" href="/#o-logout-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            Logout
          </a>
        </div>
      </div>
    </div>
  </div>
</header>

<div class="mb-supportModal" id="mb-supportModal" hidden>
  <div class="mb-supportModal-backdrop"></div>
  <div class="mb-supportModal-content">
    <div class="mb-supportModal-header">
      <h3 class="mb-supportModal-title">Submit a Support Ticket</h3>
      <button class="mb-supportModal-close" type="button" aria-label="Close support form"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
    </div>
    <div class="mb-supportModal-body">
      <div data-o-support="1" data-mode="embed"></div>
    </div>
  </div>
</div>
`;


// ============================================================
// SECTION 3: NAVBAR JS LOGIC
// Identical to v2.8 embed, with one improvement:
// getCachedUser() now uses window.getCachedOutsetaUser (global
// cache from Site Settings footer Section 0) when available,
// falling back to its own cache if needed.
// ============================================================
const NAVBAR_JS = `
(function () {

  // ---- Own cache (fallback if global cache not loaded yet) ----
  window.NAVBAR_USER_CACHE = window.NAVBAR_USER_CACHE || null;
  window.NAVBAR_USER_LOADING = window.NAVBAR_USER_LOADING || null;

  // Uses global site cache (Site Settings footer Section 0) when available.
  // This avoids duplicate Outseta.getUser() calls across navbar, billing, NEXA, etc.
  async function getCachedUser() {
    if (typeof window.getCachedOutsetaUser === 'function') {
      return window.getCachedOutsetaUser();
    }
    // Fallback: own cache
    if (window.NAVBAR_USER_CACHE) return window.NAVBAR_USER_CACHE;
    if (window.NAVBAR_USER_LOADING) return window.NAVBAR_USER_LOADING;
    if (!window.Outseta || typeof window.Outseta.getUser !== 'function') return null;

    window.NAVBAR_USER_LOADING = window.Outseta.getUser()
      .then(function(user) {
        window.NAVBAR_USER_CACHE = user;
        window.NAVBAR_USER_LOADING = null;
        return user;
      })
      .catch(function() {
        window.NAVBAR_USER_LOADING = null;
        return null;
      });

    return window.NAVBAR_USER_LOADING;
  }

  // Clear caches on logout
  window.addEventListener('hashchange', function() {
    if (window.location.hash.includes('logout')) {
      window.NAVBAR_USER_CACHE = null;
      window.NAVBAR_USER_LOADING = null;
    }
  });

  var PLAN_MAP = {
    'NmdnZg90': 'LITE',
    'Dmw8leQ4': 'PLUS',
    'yWobBP9D': 'PRO'
  };

  var ADMIN_EMAILS = ['rich@prestonlending.com'];

  var navWrap = document.querySelector('.mb-navWrap');
  var spacer = document.querySelector('.mb-navSpacer');
  var burger = document.querySelector('.mb-burger');
  var mobile = document.querySelector('.mb-mobile');
  var helpBtn = document.querySelector('.mb-helpBtn');
  var helpDropdown = document.querySelector('.mb-helpDropdown');
  var supportModal = document.getElementById('mb-supportModal');
  var planPopover = document.getElementById('mb-planPopover');
  var planTagDesktop = document.getElementById('mb-planTag-desktop');
  var supportBackdrop = supportModal ? supportModal.querySelector('.mb-supportModal-backdrop') : null;
  var supportClose = supportModal ? supportModal.querySelector('.mb-supportModal-close') : null;

  function setSpacerHeight() {
    if (!navWrap || !spacer) return;
    spacer.style.height = navWrap.offsetHeight + 'px';
  }

  function closeMobile() {
    if (!mobile || !burger) return;
    mobile.hidden = true;
    burger.setAttribute('aria-expanded', 'false');
  }

  function toggleMobile() {
    if (!mobile || !burger) return;
    var open = mobile.hidden;
    mobile.hidden = !open;
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    closeHelpDropdown();
  }

  function openHelpDropdown() {
    if (!helpDropdown || !helpBtn) return;
    helpDropdown.hidden = false;
    helpBtn.setAttribute('aria-expanded', 'true');
  }

  function closeHelpDropdown() {
    if (!helpDropdown || !helpBtn) return;
    helpDropdown.hidden = true;
    helpBtn.setAttribute('aria-expanded', 'false');
  }

  function toggleHelpDropdown() {
    if (!helpDropdown) return;
    helpDropdown.hidden ? openHelpDropdown() : closeHelpDropdown();
  }

  function openSupportModal() {
    if (!supportModal) return;
    supportModal.hidden = false;
    document.body.style.overflow = 'hidden';
    closeHelpDropdown();
    closeMobile();
  }

  function closeSupportModal() {
    if (!supportModal) return;
    supportModal.hidden = true;
    document.body.style.overflow = '';
  }

  var PLAN_POPOVER_CONTENT = {
    'LITE': { desc: "You're on the free LITE plan. Upgrade to PLUS to unlock more features, calculators, and pipeline tools.", cta: 'Upgrade to PLUS' },
    'PLUS': { desc: "You're on the PLUS plan. Upgrade to PRO to unlock the referral program, priority support, and all advanced features.", cta: 'Upgrade to PRO' },
    'PRO':  { desc: null, cta: null }
  };

  function openPlanPopover(planName) {
    if (!planPopover) return;
    var cfg = PLAN_POPOVER_CONTENT[planName] || {};
    var planEl = document.getElementById('mb-planPopover-plan');
    var descEl = document.getElementById('mb-planPopover-desc');
    var btnEl  = document.getElementById('mb-planPopover-btn');
    var proEl  = document.getElementById('mb-planPopover-pro');
    if (planEl) planEl.textContent = planName + ' Plan';
    if (cfg.cta) {
      if (descEl) { descEl.textContent = cfg.desc; descEl.style.display = ''; }
      if (btnEl)  { btnEl.textContent = cfg.cta; btnEl.style.display = ''; }
      if (proEl)  proEl.style.display = 'none';
    } else {
      if (descEl) descEl.style.display = 'none';
      if (btnEl)  btnEl.style.display = 'none';
      if (proEl)  proEl.style.display = '';
    }
    planPopover.hidden = false;
    if (planTagDesktop) planTagDesktop.setAttribute('aria-expanded', 'true');
  }

  function closePlanPopover() {
    if (!planPopover) return;
    planPopover.hidden = true;
    if (planTagDesktop) planTagDesktop.setAttribute('aria-expanded', 'false');
  }

  function togglePlanPopover() {
    if (!planPopover) return;
    planPopover.hidden ? openPlanPopover(planTagDesktop ? (planTagDesktop.getAttribute('data-plan') || '') : '') : closePlanPopover();
  }

  function openYbug() {
    closeHelpDropdown();
    closeMobile();
    if (window.Ybug && typeof window.Ybug.open === 'function') {
      window.Ybug.open();
    } else {
      var ybugLauncher = document.getElementById('ybug-launcher') || document.querySelector('[id^="ybug"]');
      if (ybugLauncher) {
        ybugLauncher.click();
      } else {
        alert('Bug reporter is loading. Please try again in a moment.');
      }
    }
  }

  function setAuthUI(isAuthed) {
    document.querySelectorAll('[data-mb-auth="out"]').forEach(function(el) {
      el.style.display = isAuthed ? 'none' : '';
    });
    document.querySelectorAll('[data-mb-auth="in"]').forEach(function(el) {
      isAuthed ? el.style.removeProperty('display') : el.style.display = 'none';
    });
  }

  function showNexaTags() {
    var d = document.getElementById('mb-nexaTag-desktop');
    var m = document.getElementById('mb-nexaTag-mobile');
    if (d) d.style.display = '';
    if (m) m.style.display = '';
  }

  function hideNexaTags() {
    var d = document.getElementById('mb-nexaTag-desktop');
    var m = document.getElementById('mb-nexaTag-mobile');
    if (d) d.style.display = 'none';
    if (m) m.style.display = 'none';
  }

  function showPlanAndAdminTags() {
    try {
      var token = localStorage.getItem('Outseta.nocode.accessToken');
      if (!token) return;

      var payload = JSON.parse(atob(token.split('.')[1]));
      var planUid = payload['outseta:planUid'] || '';
      var planName = PLAN_MAP[planUid] || null;

      if (planName) {
        var desktopTag = document.getElementById('mb-planTag-desktop');
        if (desktopTag) {
          desktopTag.textContent = planName;
          desktopTag.setAttribute('data-plan', planName);
          desktopTag.style.display = '';
        }
        var mobileTag = document.getElementById('mb-planTag-mobile');
        if (mobileTag) {
          mobileTag.textContent = planName;
          mobileTag.setAttribute('data-plan', planName);
          mobileTag.style.display = '';
        }
      }

      var email = (payload.email || payload['https://app.outseta.com/claims/email'] || '').toLowerCase();

      if (email && ADMIN_EMAILS.indexOf(email) !== -1) {
        var dAdmin = document.getElementById('mb-adminTag-desktop');
        if (dAdmin) dAdmin.style.display = '';
        var mAdmin = document.getElementById('mb-adminTag-mobile');
        if (mAdmin) mAdmin.style.display = '';
      }

      // Fast NEXA check via JWT email domain (no network call)
      if (email && (email.endsWith('@nexalending.com') || email.endsWith('@nexamortgage.com'))) {
        showNexaTags();
      }

    } catch (e) {}
  }

  // Slow NEXA check — catches manually granted access (e.g. rich@prestonlending.com)
  function checkNexaFromUser(user) {
    if (!user) return;
    var hasAccess = false;
    if (user.NexaAccess === 'true') hasAccess = true;
    if (!hasAccess) {
      try {
        if (user.Account && user.Account.Metadata &&
            user.Account.Metadata.NexaAccess &&
            user.Account.Metadata.NexaAccess.toLowerCase() === 'true') {
          hasAccess = true;
        }
      } catch (e) {}
    }
    if (hasAccess) showNexaTags();
  }

  function looksLikeUrl(v) {
    return typeof v === 'string' && /^https?:\/\//i.test(v) && v.length < 1200;
  }

  function applyAvatar(url) {
    document.querySelectorAll('img[data-mb-avatar]').forEach(function(img) {
      var btn = img.closest('.mb-avatarBtn') || img.closest('.mb-mAvatar');
      if (!url) { if (btn) btn.classList.remove('has-img'); return; }
      /* Remove loading="lazy" — lazy images with display:none never load
         (browser skips them since they're not visible). Must be eager. */
      img.removeAttribute('loading');
      img.src = url;
      /* Add has-img immediately so the image becomes display:block,
         which allows the browser to actually load it. The onload/onerror
         handlers then confirm or revert. */
      if (btn) btn.classList.add('has-img');
      img.onerror = function() { if (btn) btn.classList.remove('has-img'); };
    });
  }

  function getUserProfileImg(user) {
    if (!user) return null;
    var c = [
      user.person && user.person.profileImageS3Url,
      user.person && user.person.ProfileImageS3Url,
      user.person && user.person.oAuthGoogleProfileImageUrl,
      user.person && user.person.OAuthGoogleProfileImageUrl,
      user.profileImageS3Url,
      user.ProfileImageS3Url
    ];
    for (var i = 0; i < c.length; i++) { if (looksLikeUrl(c[i])) return c[i]; }
    return null;
  }

  async function initNavbar() {
    showPlanAndAdminTags();

    /* Wait for Outseta SDK AND the global cache function (from Site Settings footer).
       Previously only waited for Outseta.getUser, so the navbar would call Outseta
       directly before the global cache was ready — missing profile image data on
       pages other than Dashboard. */
    var attempts = 0;
    while (attempts < 50 && (!window.Outseta || !window.Outseta.getUser || typeof window.getCachedOutsetaUser !== 'function')) {
      await new Promise(function(resolve) { setTimeout(resolve, 100); });
      attempts++;
    }
    if (!window.Outseta || !window.Outseta.getUser) return;

    var user = await getCachedUser();

    if (user) {
      setAuthUI(true);
      checkNexaFromUser(user);

      /* Apply avatar from user object immediately, then check for Outseta-native
         images as a fallback after a short delay */
      var userImg = getUserProfileImg(user);
      if (userImg) applyAvatar(userImg);

      setTimeout(function() {
        var imgs = document.querySelectorAll('img[data-o-member="ProfileImageS3Url"]');
        var hasNativeImage = false;
        imgs.forEach(function(img) {
          if (img.src && looksLikeUrl(img.src) && !img.src.includes('data:')) {
            var btn = img.closest('.mb-avatarBtn') || img.closest('.mb-mAvatar');
            if (btn) btn.classList.add('has-img');
            hasNativeImage = true;
          }
        });
        if (!hasNativeImage && userImg) {
          applyAvatar(userImg);
        }
      }, 500);
    } else {
      setAuthUI(false);
    }
  }

  if (burger) {
    burger.addEventListener('click', function(e) { e.preventDefault(); toggleMobile(); });
  }

  document.addEventListener('click', function(e) {
    if (mobile && !mobile.hidden && e.target.closest('.mb-mLink:not([data-mb-open-support]):not([data-mb-open-ybug]), .mb-authBtn, .mb-mUserCard, .mb-mUserAction-btn')) {
      closeMobile();
    }
  });

  if (helpBtn) {
    helpBtn.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); toggleHelpDropdown(); });
  }

  document.addEventListener('click', function(e) {
    if (helpDropdown && !helpDropdown.hidden && !e.target.closest('.mb-helpWrap')) closeHelpDropdown();
  });

  if (helpDropdown) {
    helpDropdown.addEventListener('click', function(e) {
      var item = e.target.closest('.mb-helpDropdown-item');
      if (item && item.tagName === 'A') closeHelpDropdown();
    });
  }

  if (planTagDesktop) {
    planTagDesktop.addEventListener('click', function(e) { e.stopPropagation(); togglePlanPopover(); closeHelpDropdown(); });
    planTagDesktop.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); planTagDesktop.click(); }
    });
  }

  document.addEventListener('click', function(e) {
    if (planPopover && !planPopover.hidden && !e.target.closest('.mb-planTags')) closePlanPopover();
  });

  document.querySelectorAll('[data-mb-open-support]').forEach(function(btn) {
    btn.addEventListener('click', function(e) { e.preventDefault(); openSupportModal(); });
  });

  document.querySelectorAll('[data-mb-open-ybug]').forEach(function(btn) {
    btn.addEventListener('click', function(e) { e.preventDefault(); openYbug(); });
  });

  if (supportClose) supportClose.addEventListener('click', closeSupportModal);
  if (supportBackdrop) supportBackdrop.addEventListener('click', closeSupportModal);

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      if (helpDropdown && !helpDropdown.hidden) closeHelpDropdown();
      else if (supportModal && !supportModal.hidden) closeSupportModal();
    }
  });

  window.addEventListener('resize', setSpacerHeight);

  window.addEventListener('hashchange', function() {
    closeMobile();
    closeHelpDropdown();
    closePlanPopover();
    if (window.location.hash.includes('logout')) {
      setTimeout(function() {
        setAuthUI(false);
        var planDesktop = document.getElementById('mb-planTag-desktop');
        var planMobile = document.getElementById('mb-planTag-mobile');
        var adminDesktop = document.getElementById('mb-adminTag-desktop');
        var adminMobile = document.getElementById('mb-adminTag-mobile');
        if (planDesktop) planDesktop.style.display = 'none';
        if (planMobile) planMobile.style.display = 'none';
        if (adminDesktop) adminDesktop.style.display = 'none';
        if (adminMobile) adminMobile.style.display = 'none';
        hideNexaTags();
      }, 100);
    }
  });

  setSpacerHeight();
  closeMobile();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavbar);
  } else {
    initNavbar();
  }

})();
`;


// ============================================================
// BUILD FUNCTION
// Builds the JS string the browser downloads and executes.
//
// SAFE TECHNIQUE: Uses string array + JSON.stringify() for ALL content.
// - JSON.stringify(css/html/js) safely escapes ALL special characters
//   including backticks, ${}, backslashes, quotes, and newlines.
// - String array join avoids any template literal issues in the output.
// - new Function(code)() executes the JS logic in a fresh scope.
//
// This is provably safe — no escaping issues possible.
// ============================================================
function buildNavbarScript() {
  var cssStr = JSON.stringify(NAVBAR_CSS);
  var htmlStr = JSON.stringify(NAVBAR_HTML);
  var jsStr = JSON.stringify(NAVBAR_JS);

  return [
    '/* mtg-broker-navbar v2.8 — Cloudflare Worker — DO NOT EDIT DIRECTLY */',
    '/* Edit workers/mtg-broker-navbar.js in the repo, then redeploy. */',
    '(function() {',

    '  // 1. Inject CSS into <head> (once per page — guarded by id)',
    '  if (!document.getElementById("mtg-navbar-css")) {',
    '    var style = document.createElement("style");',
    '    style.id = "mtg-navbar-css";',
    '    style.textContent = ' + cssStr + ';',
    '    document.head.appendChild(style);',
    '  }',

    '  // 2. Find mount point — the HtmlEmbed sets <div id="mtg-navbar"></div>',
    '  var mount = document.getElementById("mtg-navbar");',
    '  if (!mount) {',
    '    console.warn("[mtg-broker-navbar] No mount point found. Add <div id=\\"mtg-navbar\\"></div> to your page.");',
    '    return;',
    '  }',

    '  // 3. Inject navbar HTML into the mount point',
    '  mount.innerHTML = ' + htmlStr + ';',

    '  // 4. Run JS logic (uses new Function to avoid scope issues)',
    '  (new Function(' + jsStr + '))();',

    '})();',
  ].join('\n');
}

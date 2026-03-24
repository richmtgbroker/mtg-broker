"""
Rebuild mtg-broker-extras.js from live downloaded content.
Adds all 6 static routes + avatar fix in site-footer.js.
"""
import os

TMP = "C:/Users/rich2/AppData/Local/Temp" if os.name == 'nt' else "/tmp"
# Fallback: check both locations
if not os.path.exists(os.path.join(TMP, "global-navbar.js")):
    TMP = "/tmp"
OUT = "C:/Users/rich2/projects/mtg-broker/.claude/worktrees/frosty-colden/workers/mtg-broker-extras.js"

def escape(content):
    """Escape for JS template literal using String.raw`...`"""
    # For String.raw, we only need to escape backticks and ${
    content = content.replace('`', '\\`')
    content = content.replace('${', '\\${')
    return content

def read(name):
    with open(os.path.join(TMP, name), 'r', encoding='utf-8') as f:
        return f.read()

# Read all 6 files
site_head_css = read("site-head-live.css")
site_head_js = read("site-head-live.js")
site_footer_js = read("site-footer-live.js")
feature_extras_js = read("feature-extras-live.js")
global_navbar_js = read("global-navbar.js")
global_footer_js = read("global-footer.js")

# Add avatar fix to site-footer.js
AVATAR_FIX = """

// ========== SECTION 7: GLOBAL AVATAR FIX ==========
// Fix: avatar images have loading="lazy" + display:none (from CSS).
// Lazy images with display:none never load — browser skips them.
(function() {
  'use strict';

  function fixAvatarImages() {
    document.querySelectorAll('img[data-mb-avatar]').forEach(function(img) {
      if (!img.src || img.src === '' || img.src === window.location.href) return;
      img.removeAttribute('loading');
      var btn = img.closest('.mb-avatarBtn') || img.closest('.mb-mAvatar');
      if (btn && !btn.classList.contains('has-img')) {
        btn.classList.add('has-img');
        img.onerror = function() { btn.classList.remove('has-img'); };
      }
    });
  }

  setTimeout(fixAvatarImages, 1500);
  setTimeout(fixAvatarImages, 3000);
  setTimeout(fixAvatarImages, 5000);

  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      if (m.type === 'attributes' && m.attributeName === 'src') {
        fixAvatarImages();
      }
    });
  });

  function watchAvatars() {
    document.querySelectorAll('img[data-mb-avatar]').forEach(function(img) {
      observer.observe(img, { attributes: true, attributeFilter: ['src'] });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchAvatars);
  } else {
    watchAvatars();
  }
})();
"""

site_footer_js_with_fix = site_footer_js + AVATAR_FIX

# Build the worker
worker = '''/**
 * mtg-broker-extras — Cloudflare Worker v2.0
 * =========================================================
 * Serves static JS/CSS files for the mtg.broker platform.
 * Synced from live deployed version + avatar fix.
 *
 * ENDPOINTS:
 *   GET /static/site-head.css       — Global CSS
 *   GET /static/site-head.js        — Global head JS
 *   GET /static/site-footer.js      — Core platform JS (Outseta cache, billing, gating)
 *   GET /static/feature-extras.js   — Upgrade CTAs (LITE) + limit pills (PLUS)
 *   GET /static/global-navbar.js    — Global marketing navbar
 *   GET /static/global-footer.js    — Global marketing footer
 *
 * DEPLOY:
 *   wrangler deploy workers/mtg-broker-extras.js --name mtg-broker-extras --compatibility-date 2024-01-01
 */

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsResponse(content, request) {
  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      ...getCorsHeaders(request)
    }
  });
}

function cssResponse(content, request) {
  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/css; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      ...getCorsHeaders(request)
    }
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: getCorsHeaders(request) });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/static/site-head.css') {
      return cssResponse(SITE_HEAD_CSS, request);
    }

    if (path === '/static/site-head.js') {
      return jsResponse(SITE_HEAD_JS, request);
    }

    if (path === '/static/site-footer.js') {
      return jsResponse(SITE_FOOTER_JS, request);
    }

    if (path === '/static/feature-extras.js') {
      return jsResponse(FEATURE_EXTRAS_JS, request);
    }

    if (path === '/static/global-navbar.js') {
      return jsResponse(GLOBAL_NAVBAR_JS, request);
    }

    if (path === '/static/global-footer.js') {
      return jsResponse(GLOBAL_FOOTER_JS, request);
    }

    // Default: list available endpoints
    return new Response(JSON.stringify({
      endpoints: [
        'GET /static/site-head.css',
        'GET /static/site-head.js',
        'GET /static/site-footer.js',
        'GET /static/feature-extras.js',
        'GET /static/global-navbar.js',
        'GET /static/global-footer.js'
      ]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request) }
    });
  }
};

'''

# Add the content constants
worker += 'const SITE_HEAD_CSS = String.raw`' + escape(site_head_css) + '`;\n\n'
worker += 'const SITE_HEAD_JS = String.raw`' + escape(site_head_js) + '`;\n\n'
worker += 'const SITE_FOOTER_JS = String.raw`' + escape(site_footer_js_with_fix) + '`;\n\n'
worker += 'const FEATURE_EXTRAS_JS = String.raw`' + escape(feature_extras_js) + '`;\n\n'
worker += 'const GLOBAL_NAVBAR_JS = String.raw`' + escape(global_navbar_js) + '`;\n\n'
worker += 'const GLOBAL_FOOTER_JS = String.raw`' + escape(global_footer_js) + '`;\n'

with open(OUT, 'w', encoding='utf-8') as f:
    f.write(worker)

print(f"Worker written: {len(worker):,} chars")
print(f"Routes: 6 (site-head.css, site-head.js, site-footer.js, feature-extras.js, global-navbar.js, global-footer.js)")
print(f"Avatar fix added to site-footer.js")

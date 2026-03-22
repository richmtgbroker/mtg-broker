/**
 * MTG Broker PROPERTY TYPES API - Cloudflare Worker
 *
 * Version: 1.0  |  Updated: March 2026
 *
 * Handles everything for the Property Types section:
 *   1. Listing data for the directory grid (/api/property-types)
 *   2. Detail data with resolved lenders (/api/property-types/:slug)
 *   3. Serves the detail page JS bundle (/property-type-detail.js)
 *   4. Cache clearing (/api/property-types/clear-cache)
 *   5. Health check (/health)
 *
 * DEPLOY URL: mtg-broker-property-types.rich-e00.workers.dev
 *
 * Environment Variables Required:
 *   AIRTABLE_API_KEY — Airtable personal access token
 *
 * Airtable Tables:
 *   Property Types: tblRGL1EV78kjZHJ8
 *   Lender List:    tbl1mpg3KFakZsFK7
 */

const AIRTABLE_BASE_ID = 'appuJgI9X93OLaf0u';

// ============================
// TABLE IDs
// ============================
const TABLES = {
  PROPERTY_TYPES: 'tblRGL1EV78kjZHJ8',
  LENDER_LIST:    'tbl1mpg3KFakZsFK7'
};

// ============================
// CORS
// ============================
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/(www\.)?mtg\.broker$/i,
  /^https:\/\/.*\.mtg\.broker$/i,
  /^https:\/\/localhost(?::\d+)?$/i,
  /^https:\/\/.*\.webflow\.io$/i,
  /^https:\/\/.*\.workers\.dev$/i
];

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin');

  if (!origin) {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
  }

  const allowed = ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin));
  if (!allowed) return {};

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers':
      request.headers.get('Access-Control-Request-Headers') ||
      'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

// ============================
// CACHING
// ============================

// Property Type list cache (all records for the directory page)
let ptListCache = null;
let ptListCacheTimestamp = null;
const PT_LIST_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Property Type detail cache (per slug)
const ptDetailCache = new Map();
const PT_DETAIL_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Lender map cache (all lenders: recordId → { name, slug })
let lenderMapCache = null;
let lenderMapCacheTimestamp = null;
const LENDER_MAP_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes


// ============================
// HELPER FUNCTIONS
// ============================

/** Return a JSON response with CORS headers */
function jsonResponse(data, status, request) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      ...getCorsHeaders(request),
      'Content-Type': 'application/json'
    }
  });
}

/** Fetch from Airtable with auth headers */
async function airtableRequest(tableId, params, apiKey) {
  const url = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID + '/' + tableId +
    (params ? '?' + params : '');

  const response = await fetch(url, {
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error('Airtable error ' + response.status + ': ' + text);
  }

  return response.json();
}

/**
 * Convert a lender name to a URL slug.
 * e.g. "United Wholesale Mortgage (UWM)" → "united-wholesale-mortgage-uwm"
 */
function toLenderSlug(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Get the sort name for a property type record.
 * Uses Sort Name Override if set, otherwise uses the Name.
 */
function toSortName(name, sortOverride) {
  const override = sortOverride && sortOverride.trim();
  return (override || name || '').toLowerCase().trim();
}


// ============================
// FETCH ALL LENDERS
// Builds a Map of { recordId → { name, slug } } for resolving
// linked lender records on the detail endpoint.
// Cached for 30 minutes.
// ============================
async function fetchLenderMap(apiKey, bypassCache) {
  const now = Date.now();

  if (
    !bypassCache &&
    lenderMapCache &&
    lenderMapCacheTimestamp &&
    (now - lenderMapCacheTimestamp) < LENDER_MAP_CACHE_DURATION
  ) {
    return lenderMapCache;
  }

  console.log('🔄 Lenders: Building lender map from Airtable...');

  const map = new Map();
  let offset = null;

  do {
    let url = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID + '/' + TABLES.LENDER_LIST +
      '?fields%5B%5D=Name&fields%5B%5D=Webflow+Slug&pageSize=100';
    if (offset) url += '&offset=' + offset;

    const resp = await fetch(url, {
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!resp.ok) {
      throw new Error('Lender list fetch error: ' + resp.status);
    }

    const data = await resp.json();

    for (const record of data.records) {
      const name = (record.fields['Name'] || '').trim();
      const slug = (record.fields['Webflow Slug'] || toLenderSlug(name)).trim();
      if (name) {
        map.set(record.id, { name, slug });
      }
    }

    offset = data.offset || null;
  } while (offset);

  lenderMapCache = map;
  lenderMapCacheTimestamp = now;

  console.log('✅ Lenders: Cached ' + map.size + ' lenders in map');
  return map;
}


// ============================
// GET /api/property-types
// Returns all property types for the listing/directory page.
// Response: { success, cached, count, propertyTypes: [{ name, slug, sortName, lenderCount }] }
// ============================
async function getPropertyTypes(apiKey, request) {
  try {
    const now = Date.now();
    const bypassCache = new URL(request.url).searchParams.get('refresh') === 'true';

    // --- Check cache ---
    if (
      !bypassCache &&
      ptListCache &&
      ptListCacheTimestamp &&
      (now - ptListCacheTimestamp) < PT_LIST_CACHE_DURATION
    ) {
      console.log('✅ Property Types: Returning cached list (' + ptListCache.length + ' records)');
      return jsonResponse({
        success: true,
        cached: true,
        count: ptListCache.length,
        propertyTypes: ptListCache
      }, 200, request);
    }

    console.log('🔄 Property Types: Fetching list from Airtable...');

    const allPTs = [];
    let offset = null;

    // Fields needed for the listing page cards
    const listFields = ['Name', 'Webflow Slug', 'Sort Name Override', 'Lenders Available (Property Type)'];

    do {
      let url = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID + '/' + TABLES.PROPERTY_TYPES + '?';
      url += listFields.map(f => 'fields%5B%5D=' + encodeURIComponent(f)).join('&');
      url += '&sort%5B0%5D%5Bfield%5D=Name&sort%5B0%5D%5Bdirection%5D=asc';
      url += '&pageSize=100';
      if (offset) url += '&offset=' + offset;

      const resp = await fetch(url, {
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!resp.ok) throw new Error('Airtable error: ' + resp.status);

      const data = await resp.json();

      for (const record of data.records) {
        const f = record.fields;
        const name = (f['Name'] || '').trim();
        if (!name) continue;

        const slug = (f['Webflow Slug'] || '').trim();
        const sortName = toSortName(name, f['Sort Name Override']);

        // Linked record fields return an array of record IDs — count gives lenderCount
        const lendersRaw = f['Lenders Available (Property Type)'];
        const lenderCount = Array.isArray(lendersRaw) ? lendersRaw.length : 0;

        allPTs.push({ name, slug, sortName, lenderCount });
      }

      offset = data.offset || null;
    } while (offset);

    // Sort alphabetically by sortName (Airtable sort by Name isn't always the same as sort override)
    allPTs.sort((a, b) => a.sortName.localeCompare(b.sortName));

    ptListCache = allPTs;
    ptListCacheTimestamp = now;

    console.log('✅ Property Types: Fetched and cached ' + allPTs.length + ' records');

    return jsonResponse({
      success: true,
      cached: false,
      count: allPTs.length,
      propertyTypes: allPTs
    }, 200, request);

  } catch (error) {
    console.error('getPropertyTypes error:', error);
    return jsonResponse({ success: false, error: error.message }, 500, request);
  }
}


// ============================
// GET /api/property-types/clear-cache
// Clears all in-memory caches.
// ============================
async function clearAllCaches(request) {
  ptListCache = null;
  ptListCacheTimestamp = null;
  ptDetailCache.clear();
  lenderMapCache = null;
  lenderMapCacheTimestamp = null;

  console.log('🗑️ All property type caches cleared');

  return jsonResponse({
    success: true,
    message: 'Property type list, detail, and lender map caches cleared'
  }, 200, request);
}


// ============================
// GET /api/property-types/:slug
// Returns full detail for a single property type, with resolved lender names.
// Response: { success, cached, propertyType: { name, slug, sortName, description, lenders, lenderCount, airtableUrl } }
// ============================
async function getPropertyTypeBySlug(slug, apiKey, request) {
  try {
    const now = Date.now();
    const bypassCache = new URL(request.url).searchParams.get('refresh') === 'true';

    // --- Check per-slug cache ---
    const cached = ptDetailCache.get(slug);
    if (!bypassCache && cached && (now - cached.timestamp) < PT_DETAIL_CACHE_DURATION) {
      console.log('✅ Property Type Detail: Returning cached "' + slug + '"');
      return jsonResponse({ success: true, cached: true, propertyType: cached.data }, 200, request);
    }

    console.log('🔄 Property Type Detail: Fetching "' + slug + '" from Airtable...');

    // Fetch the property type record and the lender map in parallel
    const filterFormula = encodeURIComponent('{Webflow Slug}=\'' + slug + '\'');
    const detailFields = [
      'Name', 'Webflow Slug', 'Sort Name Override', 'Description',
      'Lenders Available (Property Type)'
    ];
    const params = 'filterByFormula=' + filterFormula +
      '&' + detailFields.map(f => 'fields%5B%5D=' + encodeURIComponent(f)).join('&') +
      '&maxRecords=1';

    const [ptData, lenderMap] = await Promise.all([
      airtableRequest(TABLES.PROPERTY_TYPES, params, apiKey),
      fetchLenderMap(apiKey, bypassCache)
    ]);

    if (!ptData.records || ptData.records.length === 0) {
      return jsonResponse(
        { success: false, error: 'Property type not found: ' + slug },
        404, request
      );
    }

    const record = ptData.records[0];
    const f = record.fields;

    const name = (f['Name'] || '').trim();
    const description = (f['Description'] || '').trim();
    const sortName = toSortName(name, f['Sort Name Override']);

    // Resolve linked lender record IDs to { name, slug } objects
    const lenderIds = f['Lenders Available (Property Type)'] || [];
    const lenders = [];

    for (const lenderId of lenderIds) {
      const lenderInfo = lenderMap.get(lenderId);
      if (lenderInfo) lenders.push(lenderInfo);
    }

    // Sort lenders alphabetically by name
    lenders.sort((a, b) => a.name.localeCompare(b.name));

    // Build a direct Airtable URL for the admin edit button
    const airtableUrl = 'https://airtable.com/' + AIRTABLE_BASE_ID + '/' +
      TABLES.PROPERTY_TYPES + '/' + record.id;

    const propertyType = {
      name,
      slug: (f['Webflow Slug'] || slug).trim(),
      sortName,
      description,
      lenders,
      lenderCount: lenders.length,
      airtableUrl
    };

    // Store in cache
    ptDetailCache.set(slug, { data: propertyType, timestamp: now });

    return jsonResponse({ success: true, cached: false, propertyType }, 200, request);

  } catch (error) {
    console.error('getPropertyTypeBySlug error:', error);
    return jsonResponse({ success: false, error: error.message }, 500, request);
  }
}


// ============================
// GET /property-type-detail.js
// Serves the property type detail page JavaScript as a static bundle.
// This script runs in the browser and builds the full detail page UI.
// ============================

// NOTE ON ESCAPING:
// This JS is embedded in a template literal. Rules applied:
//   - No backticks in inner JS (all strings use single/double quotes)
//   - No ${...} template expressions in inner JS (concatenation used instead)
//   - No \n, \r, \t in string literals or regex (String.fromCharCode used where needed)
//   - \/ in regex patterns is kept as-is (unknown escape in template literal stays as \/)
const PROPERTY_TYPE_DETAIL_JS = `
/* ================================================================
   PROPERTY TYPE DETAIL PAGE - JS BUNDLE
   Worker: mtg-broker-property-types.rich-e00.workers.dev
   Version: 1.0 | March 2026

   Fetches property type data from the Worker API and builds the
   full detail page UI: breadcrumb, header, description, lender cards.

   Admin: shows "Edit in Airtable" button for rich@prestonlending.com
   ================================================================ */

(function () {
  'use strict';

  var WORKER_BASE = 'https://mtg-broker-property-types.rich-e00.workers.dev';
  var ADMIN_EMAIL = 'rich@prestonlending.com';


  /* ============================================================
     AUTO-INJECT PAGE CONTAINERS
     If the Webflow page has no content divs (just the script tag),
     this builds the full app layout and injects it into <body>.
     If containers already exist on the page, this is a no-op.
     ============================================================ */
  function ensureContainers() {
    if (
      document.querySelector('.proptype-detail-breadcrumb') &&
      document.querySelector('.proptype-detail-header') &&
      document.querySelector('.proptype-detail-content')
    ) { return; }

    var wrapper = document.createElement('div');
    wrapper.className = 'app-page-content';
    wrapper.innerHTML =
      '<div class="app-container">' +
        '<div class="proptype-detail-breadcrumb" style="margin-bottom:12px;"></div>' +
        '<div class="proptype-detail-header" style="margin-bottom:20px;"></div>' +
        '<div class="proptype-detail-content"></div>' +
      '</div>';

    // Insert before the first non-script element so sidebar/navbar overlay correctly
    var body = document.body;
    var firstNonScript = null;
    for (var i = 0; i < body.children.length; i++) {
      var el = body.children[i];
      if (el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE') {
        firstNonScript = el;
        break;
      }
    }

    if (firstNonScript) {
      body.insertBefore(wrapper, firstNonScript);
    } else {
      body.appendChild(wrapper);
    }

    console.log('Property Type Detail: Auto-injected page containers');
  }


  /* ============================================================
     ENTRY POINT
     ============================================================ */
  document.addEventListener('DOMContentLoaded', function () {
    init();
  });

  function init() {
    ensureContainers();
    showLoadingSkeletons();

    var slug = getSlugFromUrl();
    if (!slug) {
      showError('Could not determine which property type to load.');
      return;
    }

    console.log('Property Type Detail v1.0: Loading slug "' + slug + '"');

    fetch(WORKER_BASE + '/api/property-types/' + encodeURIComponent(slug))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.success || !data.propertyType) {
          var msg = (data.error && data.error.indexOf('not found') !== -1)
            ? 'This property type could not be found. It may have been removed or renamed.'
            : 'Could not load data. Please refresh and try again.';
          showError(msg);
          return;
        }

        var pt = data.propertyType;
        console.log('Property Type Detail v1.0: Loaded "' + pt.name + '"' +
          ' (' + pt.lenderCount + ' lenders)' + (data.cached ? ' [cached]' : ''));

        buildBreadcrumb(pt);
        buildHeader(pt);
        buildContent(pt);
      })
      .catch(function (err) {
        console.error('Property Type Detail v1.0: API error', err);
        showError('Could not load data. Please refresh and try again.');
      });
  }


  /* ============================================================
     GET SLUG FROM URL
     e.g. /app/property-types/single-family → "single-family"
     ============================================================ */
  function getSlugFromUrl() {
    var parts = window.location.pathname.replace(/\/$/, '').split('/');
    return parts[parts.length - 1] || '';
  }


  /* ============================================================
     BREADCRUMB
     ============================================================ */
  function buildBreadcrumb(pt) {
    var container = document.querySelector('.proptype-detail-breadcrumb');
    if (!container) return;

    container.innerHTML =
      '<nav class="breadcrumb-nav">' +
        '<a href="/app/property-types" class="breadcrumb-link-item">' +
          '<i class="fa-solid fa-house-chimney" style="margin-right:6px;font-size:12px;"></i>' +
          'Property Types' +
        '</a>' +
        '<span class="breadcrumb-separator">/</span>' +
        '<span class="breadcrumb-current">' + escapeHtml(pt.name) + '</span>' +
      '</nav>';
  }


  /* ============================================================
     HEADER  —  Icon + Name + lender count subtitle + Copy button
     Admin users also see an "Edit in Airtable" button.
     ============================================================ */
  function buildHeader(pt) {
    var container = document.querySelector('.proptype-detail-header');
    if (!container) return;

    var lenderSubtitle = '';
    if (pt.lenderCount > 0) {
      var lenderWord = pt.lenderCount === 1 ? 'lender' : 'lenders';
      lenderSubtitle =
        '<p class="proptype-detail-subtitle">' +
          pt.lenderCount + ' ' + lenderWord + ' available' +
        '</p>';
    }

    var adminHtml = '';
    if (isAdmin()) {
      adminHtml =
        '<a href="' + escapeAttr(pt.airtableUrl) + '" target="_blank" rel="noopener" ' +
           'class="proptype-admin-edit-btn">' +
          '<i class="fa-solid fa-pen-to-square" style="margin-right:6px;"></i>' +
          'Edit in Airtable' +
        '</a>';
    }

    var actionsHtml =
      '<div class="proptype-header-actions">' +
        adminHtml +
        '<button class="proptype-share-btn" id="proptype-copy-url-btn" title="Copy link to clipboard">' +
          '<i class="fa-solid fa-link"></i>' +
        '</button>' +
      '</div>';

    container.innerHTML =
      '<div class="detail-header">' +
        '<div class="proptype-detail-icon">' +
          '<i class="fa-solid fa-house-chimney-window"></i>' +
        '</div>' +
        '<div class="detail-info">' +
          '<p class="detail-emphasis">Property Type</p>' +
          '<div class="detail-title-row">' +
            '<h1 class="detail-title">' + escapeHtml(pt.name) + '</h1>' +
            actionsHtml +
          '</div>' +
          lenderSubtitle +
        '</div>' +
      '</div>';

    // Attach the copy-link button handler
    var copyBtn = document.getElementById('proptype-copy-url-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var url = window.location.href;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(url).then(function () {
            flashBtn(copyBtn, 'fa-link');
          }).catch(function () {
            copyFallback(url);
            flashBtn(copyBtn, 'fa-link');
          });
        } else {
          copyFallback(url);
          flashBtn(copyBtn, 'fa-link');
        }
      });
    }
  }

  function flashBtn(btn, originalIcon) {
    var icon = btn.querySelector('i');
    if (icon) icon.className = 'fa-solid fa-check';
    btn.classList.add('copied');
    setTimeout(function () {
      if (icon) icon.className = 'fa-solid ' + originalIcon;
      btn.classList.remove('copied');
    }, 2000);
  }

  function copyFallback(text) {
    var tmp = document.createElement('input');
    tmp.value = text;
    document.body.appendChild(tmp);
    tmp.select();
    document.execCommand('copy');
    document.body.removeChild(tmp);
  }


  /* ============================================================
     CONTENT  —  Description (if any) + Available Lenders
     ============================================================ */
  function buildContent(pt) {
    var container = document.querySelector('.proptype-detail-content');
    if (!container) return;

    var html = '';

    // Description section (only shown if the property type has a description)
    if (pt.description && pt.description.trim()) {
      // Convert newline characters to <br> tags without using \n in a string literal
      var NL = String.fromCharCode(10);
      var CR = String.fromCharCode(13);
      var descHtml = escapeHtml(pt.description)
        .split(CR).join('')   // strip \r
        .split(NL).join('<br>'); // \n → <br>

      html +=
        '<div class="detail-section">' +
          '<h2 class="detail-section-title">About This Property Type</h2>' +
          '<div class="proptype-description-content">' + descHtml + '</div>' +
        '</div>';
    }

    // Available Lenders section
    html += buildLendersSection(pt);

    // Fallback if nothing to show
    if (!html) {
      html =
        '<div class="empty-state-box">' +
          '<i class="fa-solid fa-circle-info" ' +
             'style="font-size:24px;color:#cbd5e1;margin-bottom:8px;display:block;"></i>' +
          'No details have been added for this property type yet.' +
        '</div>';
    }

    container.innerHTML = html;
  }

  function buildLendersSection(pt) {
    if (!pt.lenders || pt.lenders.length === 0) return '';

    var lenders = pt.lenders; // already sorted alphabetically by the Worker
    var count = lenders.length;

    var html =
      '<div class="detail-section">' +
        '<h2 class="detail-section-title has-subtitle">' +
          'Available Lenders (' + count + ')' +
        '</h2>' +
        '<p class="lender-section-subtitle">' + escapeHtml(pt.name) + '</p>' +
        '<div class="lender-list">';

    lenders.forEach(function (lender) {
      var href = '/app/lenders/' + escapeAttr(lender.slug);
      html +=
        '<div class="lender-list-item">' +
          '<a href="' + href + '" class="lender-card" ' +
             'style="text-decoration:none;display:flex;align-items:center;width:100%;">' +
            '<span class="lender-card-name">' + escapeHtml(lender.name) + '</span>' +
          '</a>' +
        '</div>';
    });

    html += '</div></div>';
    return html;
  }


  /* ============================================================
     ADMIN DETECTION
     Reads the Outseta JWT from localStorage and checks the email.
     Only shows the "Edit in Airtable" button for the admin email.
     ============================================================ */
  function isAdmin() {
    try {
      var token = localStorage.getItem('Outseta.nocode.accessToken');
      if (!token) return false;

      var parts = token.split('.');
      if (parts.length !== 3) return false;

      // Base64url decode the JWT payload
      var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      var payload = JSON.parse(atob(b64));

      // Outseta JWT may store email in different claims
      var email = payload['outseta:email'] || payload['email'] || payload['sub'] || '';
      return email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    } catch (e) {
      return false;
    }
  }


  /* ============================================================
     LOADING SKELETONS
     Shown while the API request is in flight.
     ============================================================ */
  function showLoadingSkeletons() {
    var header  = document.querySelector('.proptype-detail-header');
    var content = document.querySelector('.proptype-detail-content');

    if (header) {
      header.innerHTML = '<div class="proptype-detail-skeleton skeleton-header"></div>';
    }
    if (content) {
      content.innerHTML =
        '<div class="proptype-detail-skeleton skeleton-section"></div>' +
        '<div class="proptype-detail-skeleton skeleton-section" style="height:200px;"></div>';
    }
  }


  /* ============================================================
     ERROR STATE
     ============================================================ */
  function showError(message) {
    var header     = document.querySelector('.proptype-detail-header');
    var content    = document.querySelector('.proptype-detail-content');
    var breadcrumb = document.querySelector('.proptype-detail-breadcrumb');

    if (header) header.innerHTML = '';

    if (content) {
      content.innerHTML =
        '<div class="proptype-error-state">' +
          '<div class="error-icon">' +
            '<i class="fa-solid fa-circle-exclamation"></i>' +
          '</div>' +
          '<h3>Property Type Not Found</h3>' +
          '<p>' + escapeHtml(message) + '</p>' +
          '<a href="/app/property-types" class="proptype-error-back-btn">' +
            '<i class="fa-solid fa-arrow-left"></i> Back to Property Types' +
          '</a>' +
        '</div>';
    }

    if (breadcrumb) {
      breadcrumb.innerHTML =
        '<nav class="breadcrumb-nav">' +
          '<a href="/app/property-types" class="breadcrumb-link-item">' +
            '<i class="fa-solid fa-house-chimney" style="margin-right:6px;font-size:12px;"></i>' +
            'Property Types' +
          '</a>' +
          '<span class="breadcrumb-separator">/</span>' +
          '<span class="breadcrumb-current">Not Found</span>' +
        '</nav>';
    }
  }


  /* ============================================================
     UTILITIES
     ============================================================ */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

  function escapeAttr(str) {
    return escapeHtml(str);
  }

})();
`;


function serveDetailJs(request) {
  return new Response(PROPERTY_TYPE_DETAIL_JS, {
    status: 200,
    headers: {
      ...getCorsHeaders(request),
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600'
    }
  });
}


// ============================
// MAIN FETCH HANDLER (routing)
// ============================
export default {
  async fetch(request, env, ctx) {
    const method = request.method;
    const url    = new URL(request.url);
    const path   = url.pathname;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request)
      });
    }

    // Check API key
    const apiKey = env.AIRTABLE_API_KEY;
    if (!apiKey) {
      return jsonResponse(
        { success: false, error: 'AIRTABLE_API_KEY not configured' },
        500, request
      );
    }

    // ── Static JS bundle ──────────────────────────────────────
    if (path === '/property-type-detail.js') {
      return serveDetailJs(request);
    }

    // ── Health check ──────────────────────────────────────────
    if (path === '/health') {
      return jsonResponse({
        success: true,
        worker: 'mtg-broker-property-types',
        version: '1.0',
        timestamp: new Date().toISOString()
      }, 200, request);
    }

    // ── API routes ────────────────────────────────────────────

    // GET /api/property-types — listing endpoint
    if (path === '/api/property-types' || path === '/api/property-types/') {
      return getPropertyTypes(apiKey, request);
    }

    // GET /api/property-types/clear-cache — cache clearing
    if (path === '/api/property-types/clear-cache') {
      return clearAllCaches(request);
    }

    // GET /api/property-types/:slug — detail endpoint
    const slugMatch = path.match(/^\/api\/property-types\/([^\/]+)$/);
    if (slugMatch) {
      const slug = decodeURIComponent(slugMatch[1]);
      return getPropertyTypeBySlug(slug, apiKey, request);
    }

    // 404 fallback
    return jsonResponse({ success: false, error: 'Not found: ' + path }, 404, request);
  }
};

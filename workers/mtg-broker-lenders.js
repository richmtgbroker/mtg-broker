/**
 * MTG Broker LENDERS API - Cloudflare Worker
 * Serves lender directory and detail data directly from Airtable.
 *
 * UPDATED: March 2026 — v2.23
 *
 * v2.23 Changes:
 *   - FIX: Lender logos returning 410 errors from expired Airtable URLs.
 *     Airtable CDN tokens expire on fixed 2-hour boundaries — ALL URLs share
 *     the same expiry timestamp. If the cache was populated near the end of a
 *     validity window, ALL logo URLs expire simultaneously before the cache TTL.
 *   - Added getAirtableUrlExpiry() helper that extracts the expiry timestamp
 *     embedded in Airtable attachment URLs (path segment: /v3/u/.../TIMESTAMP/...).
 *   - Added areCachedLogosValid() that checks if cached lender logo URLs will
 *     remain valid for at least 5 more minutes. If not, cache is bypassed and
 *     fresh data is fetched from Airtable with new URLs.
 *   - This check is applied to both L1 (in-memory) and L2 (CF Cache) lookups
 *     for the /api/lenders directory endpoint and /api/lenders/:slug detail.
 *
 * v2.22 Changes:
 *   - Admin-only "Edit in Airtable" button in Product Matrices detail modal
 *     Uses "Link to this Airtable LOAN (Formula)" field, gated to ADMIN_EMAILS
 *
 * v2.21 Changes:
 *   - REVERTED logo proxy approach (v2.18–v2.20). The proxy had persistent
 *     cold-start and cross-isolate failures that could not be reliably resolved.
 *   - Logos now use raw Airtable attachment URLs directly. These are valid for
 *     1–2 hours; with 10-min in-memory cache + 30-min CF Cache, URLs are at
 *     most 30 min old — well within the validity window.
 *   - Removed: proxyLenderLogo(), logoUrlMap, LOGO_CACHE_TTL_SECONDS,
 *     /api/lenders/logo/:recordId endpoint, logo cache purge in clear-cache.
 *   - The page embed's onerror handler shows a letter placeholder for any rare
 *     case where a URL has expired.
 *
 * v2.19 Changes:
 *   - PERF: Lender Detail page now loads near-instantly on repeat visits.
 *   - Added Cloudflare Cache API (L2) for /api/lenders/:slug detail endpoint.
 *     Same 3-tier pattern as the /api/lenders directory endpoint:
 *     L1=in-memory (instant, 10min), L2=CF Cache (≈50ms, 30min), L3=Airtable.
 *   - Added browser-side localStorage caching in LENDER_DETAIL_JS (v5.12).
 *     On page load: check localStorage first → if hit, render instantly.
 *     Then background-refresh from API and update localStorage for next visit.
 *     Cache key: `lender_detail_{slug}_v1`, TTL: 10 minutes.
 *   - Added Cache-Control header to detail endpoint responses (5min browser cache).
 *   - clear-cache endpoint now also purges detail CF Cache entries.
 *   - LENDER_DETAIL_JS bumped to v5.12.
 *
 * v2.18 Changes: [REVERTED in v2.21 — logo proxy removed, using raw URLs]
 *
 * v2.17 Changes:
 *   - New "Product Matrices" tab on Lender Detail page (between Loan Products and Contacts)
 *   - Fetches product specifics from main API /api/loan-products, filtered by lender name
 *   - Clicking a product opens full detail modal (same grouped fields as Loan Search page)
 *   - LENDER_DETAIL_JS updated to v5.12
 *
 * v2.16 Changes:
 *   - Admin-only "Edit in Airtable" button using Interface link from formula field
 *   - airtableLink field added to lender detail API response
 *
 * v2.15 Changes:
 *   - PERF: Added Cloudflare Cache API for /api/lenders endpoint. The CF
 *     Cache persists across worker cold starts (unlike in-memory cache),
 *     so returning users get fast responses even if the worker was idle.
 *     In-memory cache still used as L1 (instant); CF Cache acts as L2
 *     (≈50ms); Airtable is L3 (slow, only when both caches miss).
 *   - CF Cache TTL: 30 minutes. In-memory cache TTL unchanged at 10 min.
 *   - clear-cache endpoint now also purges the CF Cache entry.
 *   - Added Cache-Control response header on /api/lenders responses.
 *
 * v2.14 Changes:
 *   - Boolean/pills field parsing fixed: Airtable single-select values like
 *     "🟢 Yes" and "🔴 No" include emoji prefixes. isYesOrTrue(), boolean
 *     render mode, and pills render mode now use .includes() instead of
 *     strict === so emoji-prefixed values are correctly detected.
 *
 * v2.13 Changes:
 *   - Section header colors flattened: all standard sections now use brand
 *     blue (#2563EB) instead of per-section rotating colors. Any section
 *     whose name contains "NEXA" uses dark navy (#1E3A5F) to visually
 *     distinguish NEXA content. SECTION_COLOR_MAP and fallback array removed.
 *
 * v2.2 Changes:
 *   - BUGFIX: PRO plan check in page JS used wrong JWT field name.
 *     Outseta JWT uses 'outseta:planUid' (camelCase), not 'outseta:plan_uid'.
 *     All users were seeing the upgrade teaser instead of the notes UI.
 *
 * v2.1 Changes:
 *   - Added list, pills, nexa render modes to page JS
 *   - Added pill CSS and list CSS
 *
 * v2.0 Changes:
 *   - Added fetchLenderDetailConfig() with 30-min cache (same pattern as
 *     fetchLoanProductTypesConfig in the main API worker)
 *   - getLenderBySlug() now returns config-driven sections[] in the response,
 *     matching the Product Detail /api/loan-product-types pattern exactly
 *   - Added fetchOtherContactRecord() for the Other Contacts section
 *   - Other Contacts fetched by filtering tblAwo8EzVCyoikmP by lender record ID
 *   - Added GET  /api/lenders/:slug/user-notes — fetch user's private notes+rating
 *   - Added PUT  /api/lenders/:slug/user-notes — save/update user's notes+rating
 *   - Lender User Notes stored in tblkn2kLWu2aOEwcS (one record per user+lender)
 *   - CORS updated to allow PUT method
 *
 * DEPLOY URL: mtg-broker-lenders.rich-e00.workers.dev
 *
 * Environment Variables Required:
 *   - AIRTABLE_API_KEY: Your Airtable personal access token
 *
 * Airtable Tables Used:
 *   - Lender List           (tbl1mpg3KFakZsFK7) — main lender data
 *   - Lender Detail Config  (tblFuFTmTs0cZmWfO) — controls sections/fields shown
 *   - Contacts              (tblEEDPa1vXeR6cnT) — Account Executive details
 *   - Other Contacts        (tblAwo8EzVCyoikmP) — dept contacts per lender
 *   - Loan Product Types    (tblbcS2rYWmC69bVu) — linked loan products
 *   - Lender User Notes     (tblkn2kLWu2aOEwcS) — per-user private notes+rating
 *
 * Endpoints:
 *   GET  /api/lenders                        — All lenders for directory grid
 *   GET  /api/lenders/clear-cache            — Clear all caches
 *   GET  /api/lenders/:slug                  — Single lender detail (sections + AEs + products)
 *   GET  /api/lenders/:slug/user-notes       — Fetch user's private notes+rating (auth required)
 *   PUT  /api/lenders/:slug/user-notes       — Save/update user's notes+rating (auth required)
 *   GET  /health                             — Health check with version info
 */
const AIRTABLE_BASE_ID = 'appuJgI9X93OLaf0u';
// ============================
// TABLE IDs
// ============================
const TABLES = {
  LENDER_LIST:          'tbl1mpg3KFakZsFK7',
  LENDER_DETAIL_CONFIG: 'tblFuFTmTs0cZmWfO',
  CONTACTS:             'tblEEDPa1vXeR6cnT',
  OTHER_CONTACTS:       'tblAwo8EzVCyoikmP',
  LOAN_PRODUCT_TYPES:   'tblbcS2rYWmC69bVu',
  LENDER_USER_NOTES:    'tblkn2kLWu2aOEwcS'
};
// Plan UIDs for user-notes gating check (PLUS and PRO both have access)
const PLUS_PLAN_UID = 'Dmw8leQ4';
const PRO_PLAN_UID  = 'yWobBP9D';
// ============================
// CORS (supports cookies + PUT)
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
      'Access-Control-Allow-Methods': 'GET, PUT, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
  }
  const allowed = ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin));
  if (!allowed) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, PUT, HEAD, OPTIONS',
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
// Lender List Cache — all lenders for the directory page
let lenderListCache = null;
let lenderListCacheTimestamp = null;
const LENDER_LIST_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
// Cloudflare Cache API — L2 cache that persists across worker cold starts
// This is the key improvement: even after the worker is idle and loses
// in-memory state, the CF Cache can serve the response in ~50ms.
const CF_CACHE_KEY = 'https://mtg-broker-lenders.rich-e00.workers.dev/api/lenders';
const CF_CACHE_TTL_SECONDS = 30 * 60; // 30 minutes
// Lender Detail Cache — per-slug
// L1: in-memory (instant, 10 min TTL, lost on cold start)
const lenderDetailCache = new Map();
const LENDER_DETAIL_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
// Lender Detail CF Cache — L2 that persists across cold starts
// Key format: WORKER_BASE_URL + '/api/lenders/' + slug
const CF_DETAIL_CACHE_TTL_SECONDS = 30 * 60; // 30 minutes
// Lender Detail Config Cache — shared, all fields
// Invalidated after 30 minutes or on worker restart
let lenderDetailConfigCache = null;
let lenderDetailConfigCacheTimestamp = null;
const LENDER_DETAIL_CONFIG_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
// Worker base URL — used to construct CF Cache keys
const WORKER_BASE_URL = 'https://mtg-broker-lenders.rich-e00.workers.dev';
// Minimum remaining validity for Airtable URLs before forcing a cache refresh.
// If URLs expire within this window, we skip the cache and fetch fresh data.
const AIRTABLE_URL_EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

// ============================
// AIRTABLE URL EXPIRY DETECTION
// ============================
/**
 * Extract the expiry timestamp (ms) from an Airtable attachment URL.
 * Airtable CDN URLs have the format: /v3/u/{num}/{num}/{timestamp}/{hash}/{hash}
 * The timestamp is a Unix ms value indicating when the signed URL expires.
 * Returns 0 if the URL doesn't match the expected pattern.
 */
function getAirtableUrlExpiry(url) {
  if (!url || typeof url !== 'string') return 0;
  // Match the pattern: /v3/u/digits/digits/TIMESTAMP/
  var match = url.match(/\/v3\/u\/\d+\/\d+\/(\d{13,})\//);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return 0;
}

/**
 * Check if cached lender data has logo URLs that are still valid.
 * Samples a few lenders with logos and checks if their Airtable URLs
 * will remain valid for at least AIRTABLE_URL_EXPIRY_BUFFER_MS.
 * Returns true if logos are valid (or no logos to check), false if expired/expiring soon.
 */
function areCachedLogosValid(lenders) {
  if (!lenders || !Array.isArray(lenders) || lenders.length === 0) return true;
  var now = Date.now();
  // Sample up to 5 lenders that have logo URLs
  var checked = 0;
  for (var i = 0; i < lenders.length && checked < 5; i++) {
    var logo = lenders[i].logo;
    if (!logo) continue;
    var expiry = getAirtableUrlExpiry(logo);
    if (expiry > 0) {
      checked++;
      // If the URL expires within the buffer window, it's stale
      if (expiry - now < AIRTABLE_URL_EXPIRY_BUFFER_MS) {
        console.log('⚠️ Airtable logo URL expiring soon or expired: ' +
          lenders[i].name + ' (expires in ' + Math.round((expiry - now) / 1000) + 's)');
        return false;
      }
    }
  }
  return true;
}

/**
 * Check if a single lender's data has valid (non-expired) Airtable URLs.
 * Checks the logo field and any attachment fields in sections.
 */
function isLenderDetailValid(lender) {
  if (!lender) return true;
  var now = Date.now();
  // Check logo
  if (lender.logo) {
    var expiry = getAirtableUrlExpiry(lender.logo);
    if (expiry > 0 && (expiry - now < AIRTABLE_URL_EXPIRY_BUFFER_MS)) {
      console.log('⚠️ Detail logo URL expiring soon: ' + lender.name +
        ' (expires in ' + Math.round((expiry - now) / 1000) + 's)');
      return false;
    }
  }
  return true;
}

// ============================
// HELPER FUNCTIONS
// ============================
/** Return a JSON response with CORS headers */
function jsonResponse(data, status, request) {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: {
      ...getCorsHeaders(request),
      'Content-Type': 'application/json'
    }
  });
}
/**
 * Minimal Airtable fetch helper.
 * tableId: just the table ID (e.g. 'tbl1mpg3KFakZsFK7')
 * params:  URL query string (optional, without leading ?)
 * method:  'GET', 'POST', 'PATCH', 'DELETE' (default 'GET')
 * body:    object to JSON-stringify for POST/PATCH (optional)
 */
async function airtableRequest(tableId, params, apiKey, method, body) {
  var url = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID + '/' + tableId;
  if (params) url += '?' + params;
  var options = {
    method: method || 'GET',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    }
  };
  if (body) options.body = JSON.stringify(body);
  var response = await fetch(url, options);
  if (!response.ok) {
    var text = await response.text();
    throw new Error('Airtable ' + (method || 'GET') + ' error ' + response.status + ': ' + text);
  }
  return await response.json();
}
/**
 * Parse loan types from an Airtable rollup/text field.
 * Handles comma-separated, newline-separated, or array formats.
 */
function parseLoanTypes(raw) {
  if (!raw) return [];
  var result;
  if (Array.isArray(raw)) {
    result = raw
      .map(function(item) { return String(item).trim(); })
      .filter(function(item) { return item && item !== '-' && item.length > 1; });
  } else {
    if (typeof raw !== 'string') return [];
    if (!raw.trim() || raw.trim() === '-') return [];
    result = raw
      .replace(/\r?\n/g, ',')
      .replace(/\s*,\s*/g, ',')
      .replace(/,,+/g, ',')
      .replace(/^,|,$/g, '')
      .split(',')
      .map(function(t) { return t.trim(); })
      .filter(function(t) { return t && t !== '-' && t.length > 1; });
  }
  // Always return alphabetically sorted
  return result.sort(function(a, b) { return a.localeCompare(b); });
}
/**
 * Check if a value is "Yes" or true.
 */
function isYesOrTrue(value) {
  if (value === true) return true;
  if (typeof value === 'string') {
    var lower = value.trim().toLowerCase();
    // Use .includes() to handle emoji-prefixed select options like "🟢 Yes"
    return lower.includes('yes') || lower.includes('true');
  }
  return false;
}
/**
 * Extract the first image URL from an Airtable attachment field.
 */
function getAttachmentUrl(field) {
  if (field && Array.isArray(field) && field.length > 0) {
    return field[0].url || '';
  }
  return '';
}
/**
 * Normalize an attachment array to { url, filename, type } objects.
 * Used for 'attachment' render mode fields.
 */
function normalizeAttachments(raw) {
  if (!raw || !Array.isArray(raw)) return null;
  if (raw.length === 0) return null;
  var result = [];
  for (var i = 0; i < raw.length; i++) {
    var att = raw[i];
    if (att && att.url) {
      result.push({
        url: att.url,
        filename: att.filename || ('File ' + (i + 1)),
        type: att.type || ''
      });
    }
  }
  return result.length > 0 ? result : null;
}
/**
 * Extract user email from the Bearer JWT in the Authorization header.
 * Does NOT verify signature — only decodes the payload.
 * Returns null if token is missing or malformed.
 */
function extractEmailFromJWT(request) {
  try {
    var authHeader = request.headers.get('Authorization') || '';
    var token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token || token.split('.').length !== 3) return null;
    // Base64url → Base64 → JSON
    var b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    var payload = JSON.parse(atob(b64));
    return payload.email || null;
  } catch (e) {
    return null;
  }
}
// ============================================================
// FETCH LENDER DETAIL CONFIG
//
// Reads the Lender Detail Config table (tblFuFTmTs0cZmWfO)
// and returns a Map of:
//   fieldName → { displayName, section, sectionOrder, fieldOrder, renderMode, nexaGated }
//
// Only includes records where "Show on Page" is checked.
// Cached for 30 minutes. Pass bypassCache=true to force refresh.
// ============================================================
async function fetchLenderDetailConfig(apiKey, bypassCache) {
  var now = Date.now();
  if (
    !bypassCache &&
    lenderDetailConfigCache &&
    lenderDetailConfigCacheTimestamp &&
    (now - lenderDetailConfigCacheTimestamp) < LENDER_DETAIL_CONFIG_CACHE_DURATION
  ) {
    return lenderDetailConfigCache;
  }
  // Fetch all records where Show on Page = TRUE and Field Name is not empty
  var filterFormula = encodeURIComponent('AND({Show on Page} = 1, {Field Name} != "")');
  var fields = [
    'Field Name',
    'Display Name',
    'Section',
    'Section Order',
    'Field Order',
    'Render Mode',
    'NEXA Gated'
  ].map(function(f) { return 'fields%5B%5D=' + encodeURIComponent(f); }).join('&');
  var params = 'filterByFormula=' + filterFormula + '&' + fields + '&pageSize=100';
  var data = await airtableRequest(TABLES.LENDER_DETAIL_CONFIG, params, apiKey);
  if (!data.records) {
    console.error('fetchLenderDetailConfig: no records returned');
    return new Map();
  }
  var config = new Map();
  for (var i = 0; i < data.records.length; i++) {
    var f = data.records[i].fields;
    var fieldName = f['Field Name'];
    if (!fieldName) continue;
    config.set(fieldName, {
      displayName:  f['Display Name'] || fieldName,
      section:      f['Section'] || 'Other',
      sectionOrder: f['Section Order'] != null ? f['Section Order'] : 99,
      fieldOrder:   f['Field Order']   != null ? f['Field Order']   : 99,
      renderMode:   f['Render Mode'] || 'text',
      nexaGated:    f['NEXA Gated'] === true
    });
  }
  console.log('Loaded Lender Detail config: ' + config.size + ' fields');
  lenderDetailConfigCache = config;
  lenderDetailConfigCacheTimestamp = now;
  return config;
}
// ============================================================
// GET /api/lenders
//
// Returns all lenders for the directory grid page.
// Three-tier caching:
//   L1: In-memory (instant, 10 min TTL, lost on cold start)
//   L2: Cloudflare Cache API (≈50ms, 30 min TTL, persists across restarts)
//   L3: Airtable (slow, only when both caches miss)
// ============================================================
async function getLenders(apiKey, request) {
  try {
    var now = Date.now();
    // --- L1: Check in-memory cache (instant) ---
    if (
      lenderListCache &&
      lenderListCacheTimestamp &&
      (now - lenderListCacheTimestamp < LENDER_LIST_CACHE_DURATION)
    ) {
      // v2.23: Validate that cached logo URLs haven't expired
      if (areCachedLogosValid(lenderListCache)) {
        console.log('✅ Lenders L1 HIT: Returning in-memory cache (' + lenderListCache.length + ' lenders)');
        return buildLendersResponse(lenderListCache, true, 'memory', request);
      } else {
        console.log('⏰ Lenders L1: Cache valid but logo URLs expiring — bypassing to refresh');
        lenderListCache = null;
        lenderListCacheTimestamp = null;
      }
    }
    // --- L2: Check Cloudflare Cache API (≈50ms, persists across cold starts) ---
    var cfCache = caches.default;
    var cacheKey = new Request(CF_CACHE_KEY, { method: 'GET' });
    try {
      var cfResponse = await cfCache.match(cacheKey);
      if (cfResponse) {
        // Re-populate in-memory cache from the CF Cache response
        var cfData = await cfResponse.clone().json();
        // v2.23: Validate that CF-cached logo URLs haven't expired
        if (cfData.success && cfData.lenders && areCachedLogosValid(cfData.lenders)) {
          console.log('✅ Lenders L2 HIT: Returning CF Cache response');
          lenderListCache = cfData.lenders;
          lenderListCacheTimestamp = now;
          console.log('   ↳ Repopulated L1 in-memory cache with ' + cfData.lenders.length + ' lenders');
          return buildLendersResponse(cfData.lenders, true, 'cf-cache', request);
        } else {
          console.log('⏰ Lenders L2: CF Cache hit but logo URLs expiring — purging and refreshing');
          // Purge the stale CF Cache entry so it doesn't keep serving expired URLs
          try { await cfCache.delete(cacheKey); } catch (e) { /* ignore */ }
        }
      }
    } catch (cfErr) {
      console.warn('⚠️ CF Cache lookup failed (non-fatal):', cfErr.message);
    }
    // --- L3: Fetch from Airtable (slow path) ---
    console.log('🔄 Lenders L3 MISS: Fetching from Airtable...');
    var allLenders = [];
    var offset = null;
    // Fields needed for directory grid cards
    var fields = [
      'Lender Name',
      'Webflow Slug',
      'Airtable Record ID',
      'Logo',
      'Corporate Website (Final)',
      'TPO Broker Portal (Final)',
      'Portal Pricer (Requires Login)',
      'Quick Quote Pricer',
      'Turn Times (Wholesale)',
      "Lender's Product Page",
      'Available Loan Product Types (Rollup)',
      'Description (Final)',
      'Notes (Wholesale) Final',
      'NEXA Wholesale Lender',
      'NEXA NonDel Lender',
      'NEXA100 Lender (Yes/Blank)',
      'NEXA Only',
      'Sync to Webflow'
    ];
    do {
      var urlStr = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID + '/' + TABLES.LENDER_LIST + '?';
      fields.forEach(function(field, i) {
        urlStr += (i > 0 ? '&' : '') + 'fields%5B%5D=' + encodeURIComponent(field);
      });
      urlStr += '&filterByFormula=' + encodeURIComponent('{Sync to Webflow}=TRUE()');
      urlStr += '&sort%5B0%5D%5Bfield%5D=Lender+Name&sort%5B0%5D%5Bdirection%5D=asc';
      urlStr += '&pageSize=100';
      if (offset) urlStr += '&offset=' + offset;
      var resp = await fetch(urlStr, {
        headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' }
      });
      if (!resp.ok) throw new Error('Airtable API error: ' + resp.status);
      var data = await resp.json();
      for (var i = 0; i < data.records.length; i++) {
        var record = data.records[i];
        var f = record.fields;
        var loanTypesRaw = f['Available Loan Product Types (Rollup)'] || '';
        if (Array.isArray(loanTypesRaw)) loanTypesRaw = loanTypesRaw.join(', ');
        var loanTypes = parseLoanTypes(f['Available Loan Product Types (Rollup)']);
        // Get the record ID and raw Airtable logo URL
        var recordId = f['Airtable Record ID'] || record.id;
        var rawLogoUrl = getAttachmentUrl(f['Logo']);
        allLenders.push({
          id: recordId,
          name: f['Lender Name'] || '',
          slug: f['Webflow Slug'] || '',
          logo: rawLogoUrl,
          website: f['Corporate Website (Final)'] || '',
          tpoPortal: f['TPO Broker Portal (Final)'] || '',
          portalPricer: f['Portal Pricer (Requires Login)'] || '',
          quickPricer: f['Quick Quote Pricer'] || '',
          turnTimes: f['Turn Times (Wholesale)'] || '',
          productPage: f["Lender's Product Page"] || '',
          loanTypes: loanTypes,
          loanTypesRaw: loanTypesRaw,
          description: f['Description (Final)'] || '',
          notes: f['Notes (Wholesale) Final'] || '',
          nexaWholesale: isYesOrTrue(f['NEXA Wholesale Lender']),
          nexaNondel: isYesOrTrue(f['NEXA NonDel Lender']),
          nexa100: isYesOrTrue(f['NEXA100 Lender (Yes/Blank)']),
          nexaOnly: f['NEXA Only'] === true
        });
      }
      offset = data.offset || null;
    } while (offset);
    // Store in L1 (in-memory)
    lenderListCache = allLenders;
    lenderListCacheTimestamp = now;
    console.log('✅ Lenders: Fetched ' + allLenders.length + ' lenders from Airtable');
    // Build the response
    var freshResponse = buildLendersResponse(allLenders, false, 'airtable', request);
    // Store in L2 (CF Cache) — fire-and-forget, don't await
    try {
      var responseToCache = new Response(JSON.stringify({
        success: true,
        cached: true,
        cacheSource: 'cf-cache',
        count: allLenders.length,
        lenders: allLenders
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=' + CF_CACHE_TTL_SECONDS
        }
      });
      await cfCache.put(cacheKey, responseToCache);
      console.log('💾 Stored in CF Cache (TTL: ' + CF_CACHE_TTL_SECONDS + 's)');
    } catch (cfErr) {
      console.warn('⚠️ CF Cache store failed (non-fatal):', cfErr.message);
    }
    return freshResponse;
  } catch (error) {
    console.error('getLenders error:', error);
    return jsonResponse({ success: false, error: error.message }, 500, request);
  }
}
/**
 * Build the standard /api/lenders JSON response with CORS + cache headers.
 */
function buildLendersResponse(lenders, cached, source, request) {
  var body = JSON.stringify({
    success: true,
    cached: cached,
    cacheSource: source,
    count: lenders.length,
    lenders: lenders
  });
  return new Response(body, {
    status: 200,
    headers: {
      ...getCorsHeaders(request),
      'Content-Type': 'application/json',
      // Tell browser to cache for 5 min (doesn't affect CF Cache)
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
    }
  });
}
/**
 * Build the standard /api/lenders/:slug detail JSON response with CORS + cache headers.
 */
function buildDetailResponse(lender, cached, source, request) {
  var body = JSON.stringify({
    success: true,
    cached: cached,
    cacheSource: source,
    lender: lender
  });
  return new Response(body, {
    status: 200,
    headers: {
      ...getCorsHeaders(request),
      'Content-Type': 'application/json',
      // Tell browser to cache for 5 min (doesn't affect CF Cache)
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
    }
  });
}
// ============================================================
// GET /api/lenders/clear-cache
// Clears all caches: in-memory (L1), CF Cache (L2), detail, config
// ============================================================
async function clearLenderCache(request) {
  // Collect detail slugs before clearing (so we can purge their CF Cache entries)
  var detailSlugs = Array.from(lenderDetailCache.keys());
  lenderListCache = null;
  lenderListCacheTimestamp = null;
  lenderDetailCache.clear();
  lenderDetailConfigCache = null;
  lenderDetailConfigCacheTimestamp = null;
  // Purge CF Cache entries for directory + all cached detail slugs
  try {
    var cfCache = caches.default;
    // Purge directory CF Cache
    var dirCacheKey = new Request(CF_CACHE_KEY, { method: 'GET' });
    var dirDeleted = await cfCache.delete(dirCacheKey);
    console.log('🗑️ CF Cache (directory) purged: ' + (dirDeleted ? 'yes' : 'no entry found'));
    // Purge detail CF Cache entries for known slugs
    var detailPurged = 0;
    for (var i = 0; i < detailSlugs.length; i++) {
      var detailKey = new Request(WORKER_BASE_URL + '/api/lenders/' + detailSlugs[i], { method: 'GET' });
      var del = await cfCache.delete(detailKey);
      if (del) detailPurged++;
    }
    if (detailSlugs.length > 0) {
      console.log('🗑️ CF Cache (detail) purged: ' + detailPurged + '/' + detailSlugs.length + ' slugs');
    }
  } catch (cfErr) {
    console.warn('⚠️ CF Cache purge failed (non-fatal):', cfErr.message);
  }
  console.log('🗑️ All lender caches cleared (L1 + L2 + detail + config)');
  return jsonResponse({
    success: true,
    message: 'All lender caches cleared (in-memory, CF Cache, detail, config)'
  }, 200, request);
}
// ============================================================
// GET /api/lenders/:slug
//
// Returns full lender details including:
//   - Core identity fields (name, logo, NEXA flags, loan types)
//   - Config-driven sections[] (same structure as /api/loan-product-types)
//   - accountExecs[] — from Contacts table
//   - otherContacts[] — from Other Contacts table
//   - loanProducts[] — linked Loan Product Types
//
// Response shape:
// {
//   success: true,
//   cached: false,
//   lender: {
//     id, name, slug, logo, description,
//     nexaWholesale, nexaNondel, nexa100, nexaOnly,
//     loanTypes[], loanTypesRaw,
//     sections: [
//       {
//         name: "Links",
//         order: 1,
//         hasNexa: false,
//         fields: [
//           { fieldName, displayName, value, fieldOrder, renderMode, nexaGated }
//         ]
//       },
//       ...
//     ],
//     accountExecs: [{ id, name, title, email, phone, ... }],
//     otherContacts: [{ id, name, title, email, phone }],
//     loanProducts: [{ id, name, slug }]
//   }
// }
// ============================================================
async function getLenderBySlug(slug, apiKey, request) {
  try {
    var now = Date.now();
    var bypassCache = new URL(request.url).searchParams.get('refresh') === 'true';
    // --- L1: Check in-memory per-slug cache (instant) ---
    var cached = lenderDetailCache.get(slug);
    if (!bypassCache && cached && (now - cached.timestamp < LENDER_DETAIL_CACHE_DURATION)) {
      // v2.23: Validate logo URLs haven't expired
      if (isLenderDetailValid(cached.data)) {
        console.log('✅ Lender Detail L1 HIT: Returning in-memory cache for "' + slug + '"');
        return buildDetailResponse(cached.data, true, 'memory', request);
      } else {
        console.log('⏰ Lender Detail L1: Cache valid but logo URLs expiring — refreshing');
        lenderDetailCache.delete(slug);
      }
    }
    // --- L2: Check Cloudflare Cache API (≈50ms, persists across cold starts) ---
    if (!bypassCache) {
      try {
        var cfCache = caches.default;
        var cfCacheKey = new Request(WORKER_BASE_URL + '/api/lenders/' + slug, { method: 'GET' });
        var cfResponse = await cfCache.match(cfCacheKey);
        if (cfResponse) {
          var cfData = await cfResponse.clone().json();
          // v2.23: Validate logo URLs haven't expired
          if (cfData.success && cfData.lender && isLenderDetailValid(cfData.lender)) {
            console.log('✅ Lender Detail L2 HIT: Returning CF Cache for "' + slug + '"');
            lenderDetailCache.set(slug, { data: cfData.lender, timestamp: now });
            console.log('   ↳ Repopulated L1 in-memory cache for "' + slug + '"');
            return buildDetailResponse(cfData.lender, true, 'cf-cache', request);
          } else {
            console.log('⏰ Lender Detail L2: CF Cache hit but logo URLs expiring — purging');
            try { await cfCache.delete(cfCacheKey); } catch (e) { /* ignore */ }
          }
        }
      } catch (cfErr) {
        console.warn('⚠️ CF Cache lookup failed for detail (non-fatal):', cfErr.message);
      }
    }
    // --- L3: Fetch from Airtable (slow path) ---
    console.log('🔄 Lender Detail L3 MISS: Fetching "' + slug + '" from Airtable...');
    // --- Fetch config and lender record in parallel ---
    var filterFormula = encodeURIComponent('{Webflow Slug}=\'' + slug + '\'');
    var lenderParams = 'filterByFormula=' + filterFormula + '&maxRecords=1';
    var [fieldConfig, lenderData] = await Promise.all([
      fetchLenderDetailConfig(apiKey, bypassCache),
      airtableRequest(TABLES.LENDER_LIST, lenderParams, apiKey)
    ]);
    if (!lenderData.records || lenderData.records.length === 0) {
      return jsonResponse({ success: false, error: 'Lender not found: ' + slug }, 404, request);
    }
    var record = lenderData.records[0];
    var f = record.fields;
    // --- Parse loan types ---
    var loanTypesRaw = f['Available Loan Product Types (Rollup)'] || '';
    if (Array.isArray(loanTypesRaw)) loanTypesRaw = loanTypesRaw.join(', ');
    var loanTypes = parseLoanTypes(f['Available Loan Product Types (Rollup)']);
    // --------------------------------------------------------
    // Build sections from config (same logic as main API worker)
    // Iterates the config Map (only "Show on Page" fields) and
    // pulls matching values from the raw Airtable record.
    // --------------------------------------------------------
    var sectionsMap = new Map(); // sectionName → { order, hasNexa, fields[] }
    for (var [fieldName, meta] of fieldConfig.entries()) {
      var rawValue = f[fieldName];
      // Skip if field has no value in this record
      if (rawValue === undefined || rawValue === null) continue;
      // Skip AI objects ({ state, value, isStale })
      if (typeof rawValue === 'object' && !Array.isArray(rawValue) && 'state' in rawValue) continue;
      // Skip linked-record ID arrays (recXXX strings)
      if (
        Array.isArray(rawValue) &&
        rawValue.length > 0 &&
        typeof rawValue[0] === 'string' &&
        rawValue[0].startsWith('rec')
      ) continue;
      // Skip empty strings and dash-only values
      if (typeof rawValue === 'string' && (!rawValue.trim() || rawValue.trim() === '-')) continue;
      // Skip boolean false on non-boolean render modes
      // (boolean fields only meaningful when they are true or explicitly "No")
      // For 'boolean' renderMode: keep true AND false so page can show Yes/No
      // For other modes: skip false
      if (rawValue === false && meta.renderMode !== 'boolean') continue;
      // Normalize attachment arrays → keep only useful properties
      var value = rawValue;
      if (meta.renderMode === 'attachment') {
        var normalized = normalizeAttachments(rawValue);
        if (!normalized) continue; // Skip if no attachments
        value = normalized;
      }
      var section = meta.section;
      var sectionOrder = meta.sectionOrder;
      if (!sectionsMap.has(section)) {
        sectionsMap.set(section, {
          name: section,
          order: sectionOrder,
          hasNexa: false,
          fields: []
        });
      }
      var sectionEntry = sectionsMap.get(section);
      if (meta.nexaGated) sectionEntry.hasNexa = true;
      sectionEntry.fields.push({
        fieldName:   fieldName,
        displayName: meta.displayName,
        value:       value,
        fieldOrder:  meta.fieldOrder,
        renderMode:  meta.renderMode,
        nexaGated:   meta.nexaGated
      });
    }
    // Sort sections by order, then fields within each section by fieldOrder
    var sections = Array.from(sectionsMap.values()).sort(function(a, b) {
      return a.order - b.order;
    });
    sections.forEach(function(section) {
      section.fields.sort(function(a, b) { return a.fieldOrder - b.fieldOrder; });
    });
    // --------------------------------------------------------
    // Build base lender object
    // --------------------------------------------------------
    var lender = {
      id:           f['Airtable Record ID'] || record.id,
      name:         f['Lender Name'] || '',
      slug:         f['Webflow Slug'] || '',
      logo:         getAttachmentUrl(f['Logo']),
      description:  f['Description (Final)'] || '',
      airtableLink: f['Link to this Airtable LENDER (Formula)'] || '',
      nexaWholesale: isYesOrTrue(f['NEXA Wholesale Lender']),
      nexaNondel:   isYesOrTrue(f['NEXA NonDel Lender']),
      nexa100:      isYesOrTrue(f['NEXA100 Lender (Yes/Blank)']),
      nexaOnly:     f['NEXA Only'] === true,
      loanTypes:    loanTypes,
      loanTypesRaw: loanTypesRaw,
      sections:     sections,
      accountExecs:  [],
      otherContacts: [],
      loanProducts:  []
    };
    // --------------------------------------------------------
    // Fetch Account Executives, Other Contacts, and Loan Products
    // in parallel for speed
    // --------------------------------------------------------
    var aeIds     = f['Account Executives (Wholesale)'] || [];
    var productIds = f['Available Loan Product Types'] || [];
    var lenderRecordId = record.id; // used to filter Other Contacts
    var fetchAEs = (aeIds.length > 0)
      ? Promise.all(aeIds.map(function(id) { return fetchContactRecord(id, apiKey); }))
      : Promise.resolve([]);
    var fetchOtherContacts = fetchOtherContactsByLender(lenderRecordId, apiKey);
    var fetchProducts = (productIds.length > 0)
      ? Promise.all(productIds.map(function(id) { return fetchProductTypeRecord(id, apiKey); }))
      : Promise.resolve([]);
    var [aeResults, otherContactResults, productResults] = await Promise.all([
      fetchAEs,
      fetchOtherContacts,
      fetchProducts
    ]);
    // --- AEs ---
    lender.accountExecs = aeResults.filter(Boolean).sort(function(a, b) {
      return (a.name || '').localeCompare(b.name || '');
    });
    // --- Other Contacts ---
    lender.otherContacts = otherContactResults;
    // --- Loan Products ---
    lender.loanProducts = productResults
      .filter(Boolean)
      .sort(function(a, b) { return a.name.localeCompare(b.name); });
    // --- Store in L1 (in-memory) ---
    lenderDetailCache.set(slug, { data: lender, timestamp: now });
    console.log(
      '✅ Lender Detail: "' + lender.name + '" — ' +
      sections.length + ' sections, ' +
      lender.accountExecs.length + ' AEs, ' +
      lender.otherContacts.length + ' other contacts, ' +
      lender.loanProducts.length + ' products'
    );
    // Build the response
    var freshResponse = buildDetailResponse(lender, false, 'airtable', request);
    // --- Store in L2 (CF Cache) — fire-and-forget ---
    try {
      var cfCache = caches.default;
      var cfCacheKey = new Request(WORKER_BASE_URL + '/api/lenders/' + slug, { method: 'GET' });
      var responseToCache = new Response(JSON.stringify({
        success: true,
        cached: true,
        cacheSource: 'cf-cache',
        lender: lender
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=' + CF_DETAIL_CACHE_TTL_SECONDS
        }
      });
      await cfCache.put(cfCacheKey, responseToCache);
      console.log('💾 Stored detail in CF Cache for "' + slug + '" (TTL: ' + CF_DETAIL_CACHE_TTL_SECONDS + 's)');
    } catch (cfErr) {
      console.warn('⚠️ CF Cache store failed for detail (non-fatal):', cfErr.message);
    }
    return freshResponse;
  } catch (error) {
    console.error('getLenderBySlug error:', error);
    return jsonResponse({ success: false, error: error.message }, 500, request);
  }
}
// ============================================================
// HELPER: Fetch a single Contact record (for Account Executives)
// ============================================================
async function fetchContactRecord(recordId, apiKey) {
  try {
    var url = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID + '/' + TABLES.CONTACTS + '/' + recordId;
    var resp = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' }
    });
    if (!resp.ok) {
      console.warn('⚠️ Could not fetch contact ' + recordId + ': ' + resp.status);
      return null;
    }
    var data = await resp.json();
    var f = data.fields;
    return {
      id:              data.id,
      name:            f['Contact Name'] || '',
      title:           f['Title'] || '',
      email:           f['Email'] || '',
      phone:           f['Mobile Number'] || f['Office Number'] || '',
      mobileNumber:    f['Mobile Number'] || '',
      officeNumber:    f['Office Number'] || '',
      officeExtension: f['Office Extension'] || '',
      photo:           getAttachmentUrl(f['Profile Pic'])
    };
  } catch (err) {
    console.warn('⚠️ Error fetching contact ' + recordId + ':', err.message);
    return null;
  }
}
// ============================================================
// HELPER: Fetch all Other Contacts for a given lender
//
// Other Contacts table (tblAwo8EzVCyoikmP) has a "Lender List"
// linked field that stores the lender's record ID.
// We filter by FIND(lenderRecordId, ARRAYJOIN({Lender List},',')) > 0
// to get all contacts for this lender.
// ============================================================
async function fetchOtherContactsByLender(lenderRecordId, apiKey) {
  try {
    var formula = 'FIND(\'' + lenderRecordId + '\', ARRAYJOIN({Lender List}, \',\')) > 0';
    var params =
      'filterByFormula=' + encodeURIComponent(formula) +
      '&fields%5B%5D=' + encodeURIComponent('Name') +
      '&fields%5B%5D=' + encodeURIComponent('Department or Title') +
      '&fields%5B%5D=' + encodeURIComponent('Department or Title (Choice)') +
      '&fields%5B%5D=' + encodeURIComponent('Company') +
      '&fields%5B%5D=' + encodeURIComponent('Email') +
      '&fields%5B%5D=' + encodeURIComponent('Phone Number') +
      '&pageSize=50';
    var data = await airtableRequest(TABLES.OTHER_CONTACTS, params, apiKey);
    if (!data.records) return [];
    return data.records.map(function(rec) {
      var f = rec.fields;
      return {
        id:         rec.id,
        name:       f['Name'] || '',
        // Prefer the Choice (single-select) version for clean display
        title:      f['Department or Title (Choice)'] || f['Department or Title'] || '',
        company:    f['Company'] || '',
        email:      f['Email'] || '',
        phone:      f['Phone Number'] || ''
      };
    });
  } catch (err) {
    console.warn('⚠️ Error fetching other contacts for ' + lenderRecordId + ':', err.message);
    return [];
  }
}
// ============================================================
// HELPER: Fetch a single Loan Product Type record
// ============================================================
async function fetchProductTypeRecord(recordId, apiKey) {
  try {
    var url = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID + '/' + TABLES.LOAN_PRODUCT_TYPES + '/' + recordId +
      '?fields%5B%5D=' + encodeURIComponent('Loan Product Type') +
      '&fields%5B%5D=' + encodeURIComponent('Webflow Slug');
    var resp = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' }
    });
    if (!resp.ok) {
      console.warn('⚠️ Could not fetch product type ' + recordId + ': ' + resp.status);
      return null;
    }
    var data = await resp.json();
    var f = data.fields;
    return {
      id:   data.id,
      name: f['Loan Product Type'] || '',
      slug: f['Webflow Slug'] || ''
    };
  } catch (err) {
    console.warn('⚠️ Error fetching product type ' + recordId + ':', err.message);
    return null;
  }
}
// ============================================================
// GET /api/lenders/:slug/user-notes
//
// Returns the authenticated user's private notes + rating for
// this lender. Requires Authorization: Bearer <JWT> header.
//
// Response:
// { success: true, rating: 0-5, notes: "...", exists: true/false }
// ============================================================
async function getLenderUserNotes(slug, apiKey, request) {
  var email = extractEmailFromJWT(request);
  if (!email) {
    return jsonResponse({ success: false, error: 'Authentication required' }, 401, request);
  }
  try {
    var formula = 'AND({User Email}="' + email + '", {Slug}="' + slug + '")';
    var params = 'filterByFormula=' + encodeURIComponent(formula) + '&maxRecords=1';
    var data = await airtableRequest(TABLES.LENDER_USER_NOTES, params, apiKey);
    if (!data.records || data.records.length === 0) {
      // No notes yet — return empty defaults
      return jsonResponse({ success: true, exists: false, rating: 0, notes: '' }, 200, request);
    }
    var f = data.records[0].fields;
    return jsonResponse({
      success: true,
      exists: true,
      recordId: data.records[0].id,
      rating: f['Rating'] || 0,
      notes: f['Notes'] || ''
    }, 200, request);
  } catch (err) {
    console.error('getLenderUserNotes error:', err);
    return jsonResponse({ success: false, error: err.message }, 500, request);
  }
}
// ============================================================
// PUT /api/lenders/:slug/user-notes
//
// Creates or updates the authenticated user's notes + rating.
// Body: { rating: 0-5, notes: "...", lenderId: "recXXX" }
// Requires Authorization: Bearer <JWT> header.
//
// Response: { success: true, recordId: "recXXX" }
// ============================================================
async function saveLenderUserNotes(slug, apiKey, request) {
  var email = extractEmailFromJWT(request);
  if (!email) {
    return jsonResponse({ success: false, error: 'Authentication required' }, 401, request);
  }
  var body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400, request);
  }
  var rating   = Math.min(5, Math.max(0, parseInt(body.rating, 10) || 0));
  var notes    = (body.notes || '').trim();
  var lenderId = body.lenderId || '';
  try {
    // --- Check if a record already exists for this user + slug ---
    var formula = 'AND({User Email}="' + email + '", {Slug}="' + slug + '")';
    var searchParams = 'filterByFormula=' + encodeURIComponent(formula) + '&maxRecords=1';
    var existing = await airtableRequest(TABLES.LENDER_USER_NOTES, searchParams, apiKey);
    var fields = {
      'User Email':  email,
      'Lender ID':   lenderId,
      'Slug':        slug,
      'Rating':      rating,
      'Notes':       notes,
      'Updated At':  new Date().toISOString()
    };
    var result;
    if (existing.records && existing.records.length > 0) {
      // --- UPDATE existing record ---
      var recordId = existing.records[0].id;
      var url = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID + '/' + TABLES.LENDER_USER_NOTES + '/' + recordId;
      var resp = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields: fields })
      });
      if (!resp.ok) throw new Error('Airtable PATCH error: ' + resp.status);
      result = await resp.json();
    } else {
      // --- CREATE new record ---
      result = await airtableRequest(
        TABLES.LENDER_USER_NOTES, null, apiKey,
        'POST', { fields: fields }
      );
    }
    return jsonResponse({ success: true, recordId: result.id }, 200, request);
  } catch (err) {
    console.error('saveLenderUserNotes error:', err);
    return jsonResponse({ success: false, error: err.message }, 500, request);
  }
}
// ============================================================
// MAIN REQUEST ROUTER
// ============================================================
export default {
  async fetch(request, env, ctx) {
    // --- Handle CORS preflight ---
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request)
      });
    }
    var url    = new URL(request.url);
    var path   = url.pathname;
    var method = request.method;
    var apiKey = env.AIRTABLE_API_KEY;
    // ---- SERVE LENDER DETAIL PAGE JS ----
    if (path === '/lender-detail.js') {
      return new Response(LENDER_DETAIL_JS, {
        headers: {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'public, max-age=300', // 5 min — short TTL so deployments take effect quickly
          ...getCorsHeaders(request),
          'X-Version': '5.11'
        }
      });
    }
    // ---- HEALTH CHECK ----
    if (path === '/health' || path === '/') {
      return jsonResponse({
        status: 'ok',
        worker: 'mtg-broker-lenders',
        version: '2.23',
        timestamp: new Date().toISOString(),
        endpoints: [
          'GET  /api/lenders                  — All lenders for directory grid',
          'GET  /api/lenders/clear-cache       — Clear all caches',
          'GET  /api/lenders/:slug             — Single lender detail (sections + AEs + products)',
          'GET  /api/lenders/:slug/user-notes  — Fetch user notes+rating (auth required)',
          'PUT  /api/lenders/:slug/user-notes  — Save user notes+rating (auth required)',
          'GET  /lender-detail.js             — Serves the lender detail page JS (v5.12)',
          'GET  /health                        — This health check'
        ]
      }, 200, request);
    }
    // ---- ALL LENDERS (directory grid) ----
    if (path === '/api/lenders' && method === 'GET') {
      return await getLenders(apiKey, request);
    }
    // ---- CLEAR CACHE ----
    if (path === '/api/lenders/clear-cache' && method === 'GET') {
      return await clearLenderCache(request);
    }
    // ---- ROUTES WITH :slug ----
    if (path.startsWith('/api/lenders/')) {
      // Parse slug and optional subpath from path
      // e.g. '/api/lenders/rocket-pro-tpo/user-notes' → slug='rocket-pro-tpo', sub='user-notes'
      // e.g. '/api/lenders/rocket-pro-tpo'            → slug='rocket-pro-tpo', sub=''
      var rest  = path.slice('/api/lenders/'.length);
      var parts = rest.split('/');
      var slug  = parts[0];
      var sub   = parts[1] || '';
      // Validate slug — must be non-empty, alphanumeric+hyphens only
      if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
        return jsonResponse({ error: 'Invalid slug' }, 400, request);
      }
      // ---- USER NOTES ----
      if (sub === 'user-notes') {
        if (method === 'GET')  return await getLenderUserNotes(slug, apiKey, request);
        if (method === 'PUT')  return await saveLenderUserNotes(slug, apiKey, request);
        return jsonResponse({ error: 'Method not allowed' }, 405, request);
      }
      // ---- SINGLE LENDER DETAIL ----
      if (!sub && method === 'GET') {
        return await getLenderBySlug(slug, apiKey, request);
      }
    }
    // ---- 404 — No matching route ----
    return jsonResponse({ error: 'Not found' }, 404, request);
  }
};
// ============================================================
// LENDER DETAIL PAGE JS v5.12
// Served at: GET /lender-detail.js
// Usage in Webflow Before </body> embed:
//   <script src="https://mtg-broker-lenders.rich-e00.workers.dev/lender-detail.js?v=5.12"></script>
// ============================================================
// ============================================================
// LENDER DETAIL PAGE JS v5.12
// Served at: GET /lender-detail.js
// Usage in Webflow Before </body> embed:
//   <script src="https://mtg-broker-lenders.rich-e00.workers.dev/lender-detail.js?v=5.12"></script>
//
// v5.12 Changes (March 2026):
//   - PERF: Added browser-side localStorage caching with stale-while-revalidate.
//     On page load, check localStorage for cached lender data (10 min TTL).
//     If cache hit: render immediately → then background-refresh from API.
//     If cache miss: show skeleton → fetch from API → render + cache.
//     Cache key format: lender_detail_{slug}_v1
//   - Clean up old cache entries on page load to prevent localStorage bloat.
//
// v5.11 Changes (March 2026):
//   - New "Product Matrices" tab between "Loan Products" and "Contacts"
//   - Fetches product specifics from main API /api/loan-products, filtered by lender name
//   - Clicking a product opens grouped detail modal (same UX as Loan Search page)
//   - Modal CSS injected on page load
//   - Product count badge updates async after data loads
//
// v5.10 Changes (March 2026):
//   - Admin-only "Edit in Airtable" button in lender detail header
//     Only visible to ADMIN_EMAILS (rich@prestonlending.com).
//     Uses the "Link to this Airtable LENDER (Formula)" field from the API
//     to deep-link to the Airtable Interface page for the lender record.
//     Button appears after the Share button, matching vendors detail pattern.
// v5.9 Changes (March 2026):
//   - Section header colors unified: all standard sections → brand blue (#2563EB)
//   - NEXA sections (name contains "NEXA") → dark navy (#1E3A5F)
//   - SECTION_COLOR_MAP and SECTION_COLOR_FALLBACK removed; replaced with
//     two constants and a simplified getSectionColor() function
//
// v5.8 Changes (March 2026):
//   - Pricing engine redesign: horizontal rows, available engines only
//   - Section hidden entirely if no engines available
//
// v5.7 Changes (March 2026):
//   - Loan Types pills moved from Details tab → Loan Products tab
//   - Section header tint opacity increased (more vivid colored bands)
//   - Pricing engine renderPricingGrid wraps in padding div (matches new CSS)
//   - Font sizes increased across all field rows and labels
// ============================================================
const LENDER_DETAIL_JS = String.raw`
(function () {
  'use strict';
  var LENDERS_API    = 'https://mtg-broker-lenders.rich-e00.workers.dev';
  var PRO_PLAN_UID  = 'yWobBP9D';
  var PLUS_PLAN_UID = 'Dmw8leQ4'; // PLUS plan also gets private notes access
  // Admin-only: email list for "Open in Airtable" button visibility
  var ADMIN_EMAILS = ['rich@prestonlending.com'];
  // Section header colors — v2.13:
  //   All standard sections use brand blue (#2563EB) for a clean, consistent look.
  //   Any section whose name contains "NEXA" uses dark navy (#1E3A5F) to visually
  //   distinguish NEXA-exclusive content from general lender info.
  var SECTION_COLOR_BRAND_BLUE = '#2563EB';  // applied to all standard sections
  var SECTION_COLOR_NEXA       = '#1E3A5F';  // dark navy — NEXA sections only
  function getSectionColor(sectionName) {
    // If the section name contains "NEXA" (case-insensitive), use dark navy
    if (sectionName && sectionName.toUpperCase().indexOf('NEXA') !== -1) {
      return SECTION_COLOR_NEXA;
    }
    // Everything else gets brand blue
    return SECTION_COLOR_BRAND_BLUE;
  }
  var SOCIAL_CONFIG = {
    'Facebook':    { icon: 'fa-brands fa-facebook',  color: '#1877F2', label: 'Facebook'  },
    'LinkedIn':    { icon: 'fa-brands fa-linkedin',  color: '#0A66C2', label: 'LinkedIn'  },
    'Instagram':   { icon: 'fa-brands fa-instagram', color: '#E1306C', label: 'Instagram' },
    'X (Twitter)': { icon: 'fa-brands fa-x-twitter', color: '#000000', label: 'X'         },
    'YouTube':     { icon: 'fa-brands fa-youtube',   color: '#FF0000', label: 'YouTube'   }
  };
  var PRICING_ENGINE_CONFIG = {
    'LenderPrice': { icon: 'fa-solid fa-chart-line',              label: 'LenderPrice', url: 'https://marketplace.digitallending.com/#/login'          },
    'Loansifter':  { icon: 'fa-solid fa-magnifying-glass-dollar', label: 'Loansifter',  url: 'https://loansifternow.optimalblue.com/'                  },
    'Polly':       { icon: 'fa-solid fa-wave-square',             label: 'Polly',       url: 'https://lx.pollyex.com/accounts/login/'                  },
    'Arive':       { icon: 'fa-solid fa-rocket',                  label: 'Arive',       url: 'https://www.arive.com/'                                  }
  };
  var LINK_ICON_CONFIG = {
    'Website':                'fa-solid fa-globe',
    'Broker Portal':          'fa-solid fa-arrow-right-to-bracket',
    'Correspondent Website':  'fa-solid fa-building',
    'Correspondent Portal':   'fa-solid fa-door-open',
    'Products':               'fa-solid fa-file-invoice-dollar',
    'Scenario Desk':          'fa-solid fa-comments-dollar',
    'Turn Times':             'fa-solid fa-clock',
    'Lender Fees':            'fa-solid fa-receipt',
    'Quick Pricer':           'fa-solid fa-bolt',
    'TPO Portal Pricer':      'fa-solid fa-calculator',
    'Guidelines & Matrices':  'fa-solid fa-book-open',
    'NEXA Drive Folder':      'fa-brands fa-google-drive',
    'Licensed States':        'fa-solid fa-map'
  };
  // ============================================================
  // BROWSER-SIDE CACHE (localStorage)
  // Stores API response per slug. On repeat visits, renders
  // instantly from cache then refreshes in the background.
  // ============================================================
  var CACHE_PREFIX = 'lender_detail_';
  var CACHE_VERSION = '_v1';
  var CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  function getCacheKey(slug) { return CACHE_PREFIX + slug + CACHE_VERSION; }
  function getCachedLender(slug) {
    try {
      var raw = localStorage.getItem(getCacheKey(slug));
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.lender || !parsed.timestamp) return null;
      if (Date.now() - parsed.timestamp > CACHE_TTL) return null; // expired
      return parsed.lender;
    } catch (e) { return null; }
  }
  function setCachedLender(slug, lender) {
    try {
      localStorage.setItem(getCacheKey(slug), JSON.stringify({
        lender: lender,
        timestamp: Date.now()
      }));
    } catch (e) { /* localStorage full or disabled — ignore */ }
  }
  // Clean up old cache keys from previous versions or stale slugs
  function cleanOldCacheKeys() {
    try {
      var keysToRemove = [];
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf('lender_detail_') === 0 && key.indexOf(CACHE_VERSION) === -1) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(function(k) { localStorage.removeItem(k); });
      if (keysToRemove.length > 0) {
        console.log('🧹 Cleaned ' + keysToRemove.length + ' old lender cache keys');
      }
    } catch (e) { /* ignore */ }
  }
  // ============================================================
  // RENDER LENDER — called after data is ready
  // Handles NEXA gating then calls buildPage
  // ============================================================
  function renderLender(lender) {
    if (lender.nexaOnly) {
      var hasJWT = checkNexaViaJWT();
      if (hasJWT) {
        buildPage(lender);
      } else {
        checkNexaViaOutseta().then(function(ok) {
          if (ok) { buildPage(lender); } else { redirectToLenders(); }
        });
      }
    } else {
      buildPage(lender);
    }
  }
  // ============================================================
  // ENTRY POINT
  // ============================================================
  document.addEventListener('DOMContentLoaded', function () {
    ensureContainers();
    cleanOldCacheKeys();
    var slug = getSlugFromUrl();
    if (!slug) { showError('Could not determine which lender to load.'); return; }
    console.log('Lender Detail v5.12: Loading slug "' + slug + '"');
    // --- Try localStorage cache first (instant!) ---
    var cachedLender = getCachedLender(slug);
    if (cachedLender) {
      // FAST PATH: Render from cache immediately
      console.log('⚡ Cache hit! Rendering "' + cachedLender.name + '" from localStorage');
      renderLender(cachedLender);
      // Background refresh: fetch fresh data silently to update cache for next visit
      fetch(LENDERS_API + '/api/lenders/' + encodeURIComponent(slug))
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (data.success && data.lender) {
            setCachedLender(slug, data.lender);
            console.log('🔄 Background refresh complete for "' + data.lender.name + '"');
          }
        })
        .catch(function(err) {
          console.warn('Background refresh failed (non-fatal):', err.message);
        });
    } else {
      // SLOW PATH: No cache — show skeleton, fetch from API
      showLoadingSkeleton();
      fetch(LENDERS_API + '/api/lenders/' + encodeURIComponent(slug))
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (!data.success || !data.lender) {
            showError(
              data.error === 'Lender not found: ' + slug
                ? 'This lender could not be found.'
                : 'Could not load lender data. Please refresh and try again.'
            );
            return;
          }
          var lender = data.lender;
          console.log('Lender Detail v5.12: Loaded "' + lender.name + '" from API' + (data.cached ? ' [server-cached]' : ''));
          // Store in localStorage for next visit
          setCachedLender(slug, lender);
          renderLender(lender);
        })
        .catch(function(err) {
          console.error('Lender Detail v5.12: API error', err);
          showError('Could not load lender data. Please refresh and try again.');
        });
    }
  });
  // ============================================================
  // ENSURE CONTAINERS
  // ============================================================
  function ensureContainers() {
    if (document.querySelector('.lender-detail-breadcrumb') &&
        document.querySelector('.lender-detail-header') &&
        document.querySelector('.lender-detail-content')) return;
    var wrapper = document.createElement('div');
    wrapper.className = 'app-page-content';
    wrapper.innerHTML =
      '<div class="app-container">' +
        '<div class="lender-detail-breadcrumb" style="margin-bottom:4px;"></div>' +
        '<div class="lender-detail-header"></div>' +
        '<div class="lender-detail-content"></div>' +
      '</div>';
    var body = document.body;
    var firstNonScript = null;
    for (var i = 0; i < body.children.length; i++) {
      var el = body.children[i];
      if (el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE') { firstNonScript = el; break; }
    }
    if (firstNonScript) { body.insertBefore(wrapper, firstNonScript); }
    else { body.appendChild(wrapper); }
  }
  function getSlugFromUrl() {
    var parts = window.location.pathname.replace(/\/$/, '').split('/');
    return parts[parts.length - 1] || '';
  }
  // ============================================================
  // BUILD PAGE
  // ============================================================
  function buildPage(lender) {
    injectProductMatrixModal(); // v5.11: inject modal HTML+CSS once
    buildBreadcrumb(lender);
    buildHeader(lender);
    buildTabLayout(lender);
    checkNexaAndRevealGated(lender);
    loadPrivateNotes(lender);
  }
  // ============================================================
  // BREADCRUMB
  // ============================================================
  function buildBreadcrumb(lender) {
    var container = document.querySelector('.lender-detail-breadcrumb');
    if (!container) return;
    container.innerHTML =
      '<nav class="breadcrumb-nav">' +
        '<a href="/app/lenders" class="breadcrumb-link-item">' +
          '<i class="fa-solid fa-building" style="margin-right:5px;font-size:11px;"></i>Lenders' +
        '</a>' +
        '<span class="breadcrumb-separator">/</span>' +
        '<span class="breadcrumb-current">' + escapeHtml(lender.name) + '</span>' +
      '</nav>';
  }
  // ============================================================
  // HEADER — full-width dark navy bar
  // ============================================================
  function buildHeader(lender) {
    var container = document.querySelector('.lender-detail-header');
    if (!container) return;
    // Logo
    var logoHtml = '';
    if (isValidURL(lender.logo)) {
      logoHtml =
        '<div class="ld-logo">' +
          '<img src="' + escapeAttr(lender.logo) + '" ' +
               'alt="' + escapeAttr(lender.name) + '" ' +
               'onerror="this.style.display=\'none\';this.parentNode.textContent=\'' + escapeAttr(lender.name.charAt(0)) + '\'">' +
        '</div>';
    } else {
      logoHtml =
        '<div class="ld-logo">' + escapeHtml(lender.name.charAt(0)) + '</div>';
    }
    // NEXA channel badges — NEXA users only (hidden by default, revealed by revealNexaElements)
    var badgesHtml = '';
    var hasBadges = lender.nexaWholesale || lender.nexaNondel || lender.nexa100 || lender.nexaOnly;
    if (hasBadges) {
      badgesHtml = '<div class="ld-badges ld-nexa-badges" id="ld-nexa-badges" style="display:none;">';
      if (lender.nexaWholesale) badgesHtml += '<span class="ld-badge ld-badge-wholesale">Broker</span>';
      if (lender.nexaNondel)    badgesHtml += '<span class="ld-badge ld-badge-nondel">NonDel</span>';
      if (lender.nexa100)       badgesHtml += '<span class="ld-badge ld-badge-nexa100">NEXA 💯</span>';
      if (lender.nexaOnly)      badgesHtml += '<span class="ld-badge ld-badge-nexaonly">NEXA Only</span>';
      badgesHtml += '</div>';
    }
    // Favorite button — state loaded async from Favorites API after render
    var favBtn =
      '<button class="ld-fav-btn" id="ld-fav-btn" title="Add to favorites">' +
        '<i class="fa-regular fa-heart"></i>' +
      '</button>';
    // Action buttons
    var actionsHtml =
      '<div class="ld-header-actions">' +
        favBtn +
        '<button class="ld-action-btn" id="ld-copy-url-btn" title="Copy link">' +
          '<i class="fa-solid fa-link" style="margin-right:6px;"></i>Copy Link' +
        '</button>' +
        '<button class="ld-action-btn" id="ld-share-btn" title="Share">' +
          '<i class="fa-solid fa-share-nodes" style="margin-right:6px;"></i>Share' +
        '</button>' +
        (checkIsAdmin() && lender.airtableLink
          ? '<a class="ld-action-btn ld-admin-airtable-btn" ' +
              'href="' + escapeAttr(lender.airtableLink) + '" ' +
              'target="_blank" rel="noopener noreferrer" title="Edit in Airtable (Admin)">' +
              '<i class="fa-solid fa-table" style="margin-right:6px;"></i>Airtable' +
            '</a>'
          : '') +
      '</div>';
    container.innerHTML =
      '<div class="ld-header">' +
        logoHtml +
        '<div class="ld-header-info">' +
          '<h1 class="ld-name">' + escapeHtml(lender.name) + '</h1>' +
          badgesHtml +
        '</div>' +
        actionsHtml +
      '</div>';
    attachShareHandlers(lender.name);
    // Load real favorite state from API then wire up toggle
    initFavoriteButton(lender);
  }
  // ============================================================
  // FAVORITE BUTTON — synced with Favorites API (same as
  // Lenders directory). Uses lender.id (Airtable record ID)
  // and user email from JWT as auth, matching the directory
  // pattern exactly so favorites are shared across both pages.
  // ============================================================
  var FAVORITES_API = 'https://mtg-broker-favorites.rich-e00.workers.dev';
  function getUserEmailFromJWT() {
    try {
      var token = localStorage.getItem('Outseta.nocode.accessToken');
      if (!token) return null;
      var payload = JSON.parse(atob(token.split('.')[1]));
      return payload.email || payload['outseta:email'] || null;
    } catch (e) { return null; }
  }
  // Check if logged-in user is admin (for "Open in Airtable" button)
  function checkIsAdmin() {
    var email = getUserEmailFromJWT();
    if (!email) return false;
    return ADMIN_EMAILS.map(function(e) { return e.toLowerCase(); }).indexOf(email.toLowerCase()) !== -1;
  }
  function initFavoriteButton(lender) {
    var btn = document.getElementById('ld-fav-btn');
    if (!btn) return;
    var email = getUserEmailFromJWT();
    if (!email) {
      // No logged-in user — hide the button entirely
      btn.style.display = 'none';
      return;
    }
    var lenderId   = lender.id;
    var lenderName = lender.name;
    var favRecordId = null; // Airtable record ID of the favorite row (needed for DELETE)
    // ── Load current state from API ──
    fetch(FAVORITES_API + '/api/favorites?type=Lender', {
      headers: { 'Authorization': 'Bearer ' + email }
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.favorites && Array.isArray(data.favorites)) {
        data.favorites.forEach(function(fav) {
          if (fav.itemId === lenderId) {
            favRecordId = fav.id; // the Airtable record ID for this favorite
          }
        });
      }
      setFavUI(btn, !!favRecordId);
    })
    .catch(function() {
      // API unavailable — leave button in default unfilled state
    });
    // ── Toggle on click ──
    btn.addEventListener('click', function() {
      var isCurrent = btn.classList.contains('fav-active');
      // Optimistic UI
      setFavUI(btn, !isCurrent);
      if (isCurrent) {
        // Remove favorite
        if (!favRecordId) { setFavUI(btn, true); return; }
        fetch(FAVORITES_API + '/api/favorites/' + favRecordId, {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer ' + email }
        })
        .then(function(res) {
          if (res.ok) { favRecordId = null; }
          else { setFavUI(btn, true); } // revert
        })
        .catch(function() { setFavUI(btn, true); }); // revert
      } else {
        // Add favorite
        fetch(FAVORITES_API + '/api/favorites', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + email,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ itemType: 'Lender', itemId: lenderId, itemName: lenderName })
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (data.favorite) {
            favRecordId = data.favorite.id;
          } else if (data.error && data.error.indexOf('409') !== -1) {
            // Already exists — treat as success
          } else {
            setFavUI(btn, false); // revert
          }
        })
        .catch(function() { setFavUI(btn, false); }); // revert
      }
    });
  }
  function setFavUI(btn, active) {
    var icon = btn.querySelector('i');
    if (active) {
      btn.classList.add('fav-active');
      btn.title = 'Remove from favorites';
      if (icon) icon.className = 'fa-solid fa-heart';
    } else {
      btn.classList.remove('fav-active');
      btn.title = 'Add to favorites';
      if (icon) icon.className = 'fa-regular fa-heart';
    }
  }
  // ============================================================
  // TAB LAYOUT
  // ============================================================
  function buildTabLayout(lender) {
    var container = document.querySelector('.lender-detail-content');
    if (!container) return;
    // Count tabs with content
    var hasProducts = lender.loanProducts && lender.loanProducts.length > 0;
    var hasContacts = (lender.accountExecs && lender.accountExecs.length > 0) ||
                      (lender.otherContacts && lender.otherContacts.length > 0);
    container.innerHTML =
      // Option B: pill tabs on white bar below header
      '<div class="ld-tabs">' +
        '<button class="ld-tab active" data-tab="details">Details</button>' +
        '<button class="ld-tab" data-tab="products">Loan Products' +
          (hasProducts ? ' (' + lender.loanProducts.length + ')' : '') +
        '</button>' +
        '<button class="ld-tab" data-tab="matrices" id="ld-tab-matrices">Product Matrices</button>' +
        '<button class="ld-tab" data-tab="contacts">Contacts</button>' +
      '</div>' +
      // Panels
      '<div class="ld-tab-panel active" id="ld-panel-details"></div>' +
      '<div class="ld-tab-panel" id="ld-panel-products"></div>' +
      '<div class="ld-tab-panel" id="ld-panel-matrices"></div>' +
      '<div class="ld-tab-panel" id="ld-panel-contacts"></div>' +
      '<div id="ae-copy-toast"></div>';
    // Populate panels
    buildDetailsPanel(lender);
    buildProductsPanel(lender);
    buildContactsPanel(lender);
    // Show loading spinner in Product Matrices panel while data loads
    var matricesPanel = document.getElementById('ld-panel-matrices');
    if (matricesPanel) {
      matricesPanel.innerHTML =
        '<div style="text-align:center;padding:40px 20px;color:#64748B;">' +
          '<i class="fa-solid fa-spinner fa-spin" style="font-size:24px;margin-bottom:12px;display:block;"></i>' +
          'Loading product specifics\u2026' +
        '</div>';
    }
    // Fetch product specifics asynchronously from main API
    fetchProductMatrices(lender);
    // Wire up tab clicks
    container.querySelectorAll('.ld-tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        container.querySelectorAll('.ld-tab').forEach(function(b) { b.classList.remove('active'); });
        container.querySelectorAll('.ld-tab-panel').forEach(function(p) { p.classList.remove('active'); });
        btn.classList.add('active');
        var panel = document.getElementById('ld-panel-' + btn.getAttribute('data-tab'));
        if (panel) panel.classList.add('active');
      });
    });
    // Attach AE card click handlers after DOM is ready
    attachAEClickHandlers(lender);
    attachCopyableHandlers();
  }
  // ============================================================
  // DETAILS PANEL
  // ============================================================
  function buildDetailsPanel(lender) {
    var panel = document.getElementById('ld-panel-details');
    if (!panel) return;
    var html = '';
    // Section cards in 2-col grid
    // NOTE: Description is now config-driven via "Description (Final)" field
    // in Lender Detail Config (Section: About, Render Mode: richtext)
    if (lender.sections && lender.sections.length > 0) {
      html += '<div class="ld-section-grid">';
      lender.sections.forEach(function(section, idx) {
        var color = getSectionColor(section.name, idx);
        html += renderSectionCard(section, color);
      });
      html += '</div>';
    }
    // Private notes placeholder
    html += '<div id="lender-private-notes-section" class="ld-notes-section"></div>';
    panel.innerHTML = html;
  }
  // ============================================================
  // PRODUCTS PANEL — loan type pills + linked product cards
  // ============================================================
  function buildProductsPanel(lender) {
    var panel = document.getElementById('ld-panel-products');
    if (!panel) return;
    var products  = lender.loanProducts || [];
    var loanTypes = lender.loanTypes   || [];
    var hasContent = products.length > 0 || loanTypes.length > 0;
    if (!hasContent) {
      panel.innerHTML =
        '<div class="empty-state-box">' +
          '<i class="fa-solid fa-file-invoice-dollar" style="font-size:28px;color:#94A3B8;margin-bottom:10px;display:block;"></i>' +
          'No loan products linked yet.' +
        '</div>';
      return;
    }
    var html = '';
    // Loan Types pill card (full-width, always first)
    if (loanTypes.length > 0) {
      html += '<div class="ld-loan-types-card" style="margin-bottom:16px;">';
      html += renderSectionHeader('Loan Types', '#2563EB');
      html += '<div class="ld-loan-types-pills">';
      loanTypes.forEach(function(t) {
        html += '<span class="ld-loan-type-pill">' + escapeHtml(t) + '</span>';
      });
      html += '</div></div>';
    }
    // Linked loan product cards grid
    if (products.length > 0) {
      html += '<p class="ld-contacts-section-label" style="margin-bottom:10px;">Loan Product Types</p>';
      html += '<div class="ld-products-grid">';
      products.forEach(function(p) {
        var href = p.slug ? '/app/products/' + p.slug : '#';
        html +=
          '<a href="' + escapeAttr(href) + '" class="ld-product-card">' +
            '<span class="ld-product-name">' + escapeHtml(p.name) + '</span>' +
            '<span class="ld-product-arrow">View →</span>' +
          '</a>';
      });
      html += '</div>';
    }
    panel.innerHTML = html;
  }
  // ============================================================
  // CONTACTS PANEL
  // ============================================================
  function buildContactsPanel(lender) {
    var panel = document.getElementById('ld-panel-contacts');
    if (!panel) return;
    var html = '';
    var aes = lender.accountExecs || [];
    var others = lender.otherContacts || [];
    if (aes.length === 0 && others.length === 0) {
      panel.innerHTML =
        '<div class="empty-state-box">' +
          '<i class="fa-solid fa-address-book" style="font-size:28px;color:#4A627A;margin-bottom:10px;display:block;"></i>' +
          'No contacts on file for this lender.' +
        '</div>';
      return;
    }
    // Account Executives — compact cards
    if (aes.length > 0) {
      html += '<p class="ld-contacts-section-label">Account Executives</p>';
      html += '<div class="ae-grid">';
      aes.forEach(function(ae) {
        var fallbackSrc = 'https://ui-avatars.com/api/?background=random&size=128&rounded=false&bold=true&name=' +
          encodeURIComponent(ae.name || 'AE');
        var photoHtml = ae.photo && isValidURL(ae.photo)
          ? '<img class="ae-avatar" src="' + escapeAttr(ae.photo) + '" alt="' + escapeAttr(ae.name) + '" onerror="this.src=\'' + fallbackSrc + '\'">'
          : '<img class="ae-avatar ae-avatar-placeholder" src="' + fallbackSrc + '" alt="' + escapeAttr(ae.name) + '">';
        html +=
          '<div class="ae-card" data-ae-id="' + escapeAttr(ae.id) + '" style="cursor:pointer;">' +
            '<div class="ae-photo-wrap">' + photoHtml + '</div>' +
            '<p class="ae-name">' + escapeHtml(ae.name) + '</p>' +
            '<p class="ae-title">' + escapeHtml(ae.title || '') + '</p>' +
            '<span class="ae-tap-hint">Tap for details</span>' +
          '</div>';
      });
      html += '</div>';
    }
    // Other Contacts
    if (others.length > 0) {
      if (aes.length > 0) html += '<div style="margin-top:20px;"></div>';
      html += '<p class="ld-contacts-section-label">Other Contacts & Departments</p>';
      html += '<div class="other-contacts-list">';
      others.forEach(function(c) {
        html +=
          '<div class="other-contact-card">' +
            '<div class="oc-info">' +
              '<p class="oc-name">' + escapeHtml(c.name || '') + '</p>' +
              '<p class="oc-title">' + escapeHtml(c.title || '') + '</p>' +
            '</div>' +
            '<div></div>' + // grid spacer
            '<div class="oc-contact">' +
              (c.email ? '<a href="mailto:' + escapeAttr(c.email) + '" class="oc-email">' + escapeHtml(c.email) + '</a>' : '') +
              (c.phone ? '<a href="tel:' + escapeAttr(c.phone) + '" class="oc-phone">' + escapeHtml(c.phone) + '</a>' : '') +
            '</div>' +
          '</div>';
      });
      html += '</div>';
    }
    panel.innerHTML = html;
  }
  // ============================================================
  // PRODUCT MATRICES TAB — fetches product specifics from main API
  // and renders them as clickable cards. Clicking opens a detail
  // modal with the same grouped fields as the Loan Search page.
  // ============================================================
  var MAIN_API = 'https://mtg-broker-api.rich-e00.workers.dev';
  // Cached data after first fetch (shared across tab re-renders)
  var _productMatricesData = null;
  var _productMatricesMeta = null;
  function fetchProductMatrices(lender) {
    fetch(MAIN_API + '/api/loan-products')
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (!data.success || !data.products) {
          renderMatricesEmpty('Could not load product specifics.');
          return;
        }
        // Filter products to this lender by matching lender name
        var lenderName = (lender.name || '').toLowerCase().trim();
        var filtered = data.products.filter(function(p) {
          var pLender = p['Lender Name (from Lender Name)'];
          if (Array.isArray(pLender)) pLender = pLender[0];
          if (!pLender) pLender = p['Lender'] || p['lender'] || '';
          return String(pLender).toLowerCase().trim() === lenderName;
        });
        // Store for later use (modal clicks)
        _productMatricesData = filtered;
        _productMatricesMeta = data.fieldMetadata || {};
        // Update tab badge with count
        var tabBtn = document.getElementById('ld-tab-matrices');
        if (tabBtn && filtered.length > 0) {
          tabBtn.textContent = 'Product Matrices (' + filtered.length + ')';
        }
        // Render the panel content
        buildMatricesPanel(filtered, data.fieldMetadata || {});
      })
      .catch(function(err) {
        console.warn('Product matrices fetch error:', err);
        renderMatricesEmpty('Could not load product specifics. Please try again later.');
      });
  }
  function renderMatricesEmpty(message) {
    var panel = document.getElementById('ld-panel-matrices');
    if (!panel) return;
    panel.innerHTML =
      '<div class="empty-state-box">' +
        '<i class="fa-solid fa-table-cells" style="font-size:28px;color:#94A3B8;margin-bottom:10px;display:block;"></i>' +
        escapeHtml(message || 'No product specifics found for this lender.') +
      '</div>';
  }
  function buildMatricesPanel(products, fieldMetadata) {
    var panel = document.getElementById('ld-panel-matrices');
    if (!panel) return;
    if (!products || products.length === 0) {
      renderMatricesEmpty('No product specifics found for this lender.');
      return;
    }
    // Group products by Loan Product type
    var groups = {};
    products.forEach(function(p, idx) {
      var loanType = p['Loan Product'] || p['loan_product'] || p['Product Name'] || 'Other';
      if (Array.isArray(loanType)) loanType = loanType[0] || 'Other';
      if (!groups[loanType]) groups[loanType] = [];
      groups[loanType].push({ product: p, index: idx });
    });
    // Sort group names alphabetically
    var groupNames = Object.keys(groups).sort();
    var html = '';
    // Search box for filtering
    html +=
      '<div style="margin-bottom:16px;">' +
        '<input type="text" id="ld-matrices-search" placeholder="Search product specifics\u2026" ' +
          'style="width:100%;padding:10px 14px;border:1px solid #E2E8F0;border-radius:10px;' +
          'font-size:14px;font-family:inherit;background:#FFFFFF;color:#0F172A;' +
          'outline:none;transition:border-color 0.15s;">' +
      '</div>';
    // Render each group
    groupNames.forEach(function(groupName) {
      var items = groups[groupName];
      html += '<div class="ld-matrices-group" data-group="' + escapeAttr(groupName) + '">';
      html += '<p class="ld-contacts-section-label" style="margin-bottom:8px;margin-top:16px;">' +
                escapeHtml(groupName) + ' (' + items.length + ')' +
              '</p>';
      html += '<div class="ld-products-grid">';
      items.forEach(function(item) {
        var p = item.product;
        var version = p['Lender Product Name | Version (Final)'] || p['Lender Product Name | Version'] || '';
        var displayName = version || (p['Loan Product'] || 'Product Details');
        html +=
          '<div class="ld-product-card ld-matrix-card" data-matrix-idx="' + item.index + '" ' +
               'data-search-text="' + escapeAttr((displayName + ' ' + groupName).toLowerCase()) + '">' +
            '<div style="display:flex;flex-direction:column;gap:2px;min-width:0;">' +
              '<span class="ld-product-name" style="white-space:normal;">' + escapeHtml(displayName) + '</span>' +
              (version && version !== displayName
                ? '<span style="font-size:12px;color:#64748B;">' + escapeHtml(groupName) + '</span>'
                : '') +
            '</div>' +
            '<span class="ld-product-arrow"><i class="fa-solid fa-chevron-right" style="font-size:12px;"></i></span>' +
          '</div>';
      });
      html += '</div></div>';
    });
    panel.innerHTML = html;
    // Wire up card clicks
    panel.querySelectorAll('.ld-matrix-card').forEach(function(card) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', function() {
        var idx = parseInt(card.getAttribute('data-matrix-idx'), 10);
        if (_productMatricesData && _productMatricesData[idx] && _productMatricesMeta) {
          openProductMatrixModal(_productMatricesData[idx], _productMatricesMeta);
        }
      });
    });
    // Wire up search filter
    var searchInput = document.getElementById('ld-matrices-search');
    if (searchInput) {
      searchInput.addEventListener('input', function() {
        var query = searchInput.value.toLowerCase().trim();
        panel.querySelectorAll('.ld-matrix-card').forEach(function(card) {
          var text = card.getAttribute('data-search-text') || '';
          card.style.display = text.indexOf(query) !== -1 ? '' : 'none';
        });
        // Show/hide group headers if all cards hidden
        panel.querySelectorAll('.ld-matrices-group').forEach(function(group) {
          var visibleCards = group.querySelectorAll('.ld-matrix-card:not([style*="display: none"])');
          group.style.display = visibleCards.length > 0 ? '' : 'none';
        });
      });
      searchInput.addEventListener('focus', function() {
        searchInput.style.borderColor = '#2563EB';
        searchInput.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)';
      });
      searchInput.addEventListener('blur', function() {
        searchInput.style.borderColor = '#E2E8F0';
        searchInput.style.boxShadow = 'none';
      });
    }
  }
  // ============================================================
  // PRODUCT MATRIX DETAIL MODAL
  // Same grouped-field layout as the Loan Search page modal.
  // Modal HTML + CSS are injected once on page load.
  // ============================================================
  function injectProductMatrixModal() {
    // Skip if already injected
    if (document.getElementById('ld-product-matrix-modal')) return;
    // Inject modal HTML
    var modalDiv = document.createElement('div');
    modalDiv.id = 'ld-product-matrix-modal';
    modalDiv.className = 'ld-pm-modal';
    modalDiv.style.display = 'none';
    modalDiv.innerHTML =
      '<div class="ld-pm-backdrop"></div>' +
      '<div class="ld-pm-content">' +
        '<div class="ld-pm-header">' +
          '<div class="ld-pm-header-text">' +
            '<p class="ld-pm-lender"></p>' +
            '<h2 class="ld-pm-title">Product Details</h2>' +
            '<p class="ld-pm-version"></p>' +
          '</div>' +
          '<div class="ld-pm-header-actions">' +
            '<a id="ld-pm-airtable-link" class="ld-pm-admin-airtable-btn" href="#" target="_blank" rel="noopener" style="display:none;" title="Edit in Airtable (Admin)">' +
              '<i class="fas fa-external-link-alt"></i> Edit in Airtable' +
            '</a>' +
            '<button class="ld-pm-close" aria-label="Close modal">&times;</button>' +
          '</div>' +
        '</div>' +
        '<div class="ld-pm-body"></div>' +
      '</div>';
    document.body.appendChild(modalDiv);
    // Close on backdrop click
    modalDiv.querySelector('.ld-pm-backdrop').addEventListener('click', closeProductMatrixModal);
    modalDiv.querySelector('.ld-pm-close').addEventListener('click', closeProductMatrixModal);
    // Close on Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeProductMatrixModal();
    });
    // Inject modal CSS
    var style = document.createElement('style');
    style.textContent =
      '.ld-pm-modal{ position:fixed; inset:0; z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px; }' +
      '.ld-pm-backdrop{ position:absolute; inset:0; background:rgba(0,0,0,0.5); backdrop-filter:blur(4px); }' +
      '.ld-pm-content{ position:relative; background:#F1F5F9; border-radius:16px; width:100%; max-width:1000px; max-height:85vh; display:flex; flex-direction:column; box-shadow:0 25px 50px rgba(0,0,0,.15); overflow:hidden; }' +
      '.ld-pm-header{ display:flex; align-items:flex-start; justify-content:space-between; padding:24px 28px; flex-shrink:0; background:#0F172A; }' +
      '.ld-pm-header-text{ display:flex; flex-direction:column; gap:2px; }' +
      '.ld-pm-header-actions{ display:flex; align-items:center; gap:10px; flex-shrink:0; }' +
      '.ld-pm-admin-airtable-btn{ display:inline-flex; align-items:center; gap:6px; padding:6px 12px; font-size:12px; font-weight:600; color:#fff; background:#2563EB; border-radius:6px; text-decoration:none; white-space:nowrap; transition:background 0.15s ease; }' +
      '.ld-pm-admin-airtable-btn:hover{ background:#1D4ED8; color:#fff; }' +
      '.ld-pm-admin-airtable-btn i{ font-size:11px; }' +
      '.ld-pm-lender{ font-size:11px; font-weight:700; color:#94A3B8; text-transform:uppercase; letter-spacing:0.08em; margin:0; }' +
      '.ld-pm-title{ font-size:20px; font-weight:700; color:#FFFFFF; margin:0; }' +
      '.ld-pm-version{ font-size:13px; color:#94A3B8; margin:4px 0 0; }' +
      '.ld-pm-close{ width:36px; height:36px; border-radius:10px; border:none; background:rgba(255,255,255,0.1); color:#E2E8F0; font-size:24px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.15s; flex-shrink:0; }' +
      '.ld-pm-close:hover{ background:rgba(255,255,255,0.2); color:#fff; }' +
      '.ld-pm-body{ padding:20px 24px 24px; overflow-y:auto; flex:1; background:#F1F5F9; }' +
      '.ld-pm-section{ background:#FFFFFF; border:1px solid #E2E8F0; border-radius:16px; padding:24px; margin-bottom:16px; box-shadow:0 2px 8px rgba(0,0,0,0.04); transition:box-shadow 0.2s ease; }' +
      '.ld-pm-section:hover{ box-shadow:0 4px 16px rgba(0,0,0,0.07); }' +
      '.ld-pm-section:last-child{ margin-bottom:0; }' +
      '.ld-pm-section-title{ font-size:14px; font-weight:700; color:#0F172A; text-transform:uppercase; letter-spacing:0.04em; margin:0 0 20px 0; padding-bottom:10px; border-bottom:2px solid #E2E8F0; display:flex; align-items:center; gap:8px; }' +
      '.ld-pm-section-title .pm-icon{ color:#2563EB; font-size:14px; flex-shrink:0; }' +
      '.ld-pm-section.nexa-pm-card{ background:#FFFFFF; border-color:#334155; padding:0; overflow:hidden; }' +
      '.ld-pm-section.nexa-pm-card:hover{ box-shadow:0 4px 16px rgba(0,0,0,0.1); border-color:#475569; }' +
      '.ld-pm-section.nexa-pm-card .ld-pm-section-title{ color:#F1F5F9; background:#0F172A; border-bottom:none; margin:0; padding:16px 24px; border-radius:0; }' +
      '.ld-pm-section.nexa-pm-card .ld-pm-section-title .pm-icon{ color:#60A5FA; }' +
      '.ld-pm-section.nexa-pm-card .ld-pm-grid{ grid-template-columns:1fr; padding:24px; }' +
      '.ld-pm-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:16px; }' +
      '.ld-pm-item{ display:flex; flex-direction:column; gap:4px; }' +
      '.ld-pm-label{ font-size:11px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.3px; }' +
      '.ld-pm-value{ font-size:14px; color:#0f172a; word-break:break-word; }' +
      '.ld-pm-value a{ color:#2563eb; text-decoration:none; }' +
      '.ld-pm-value a:hover{ text-decoration:underline; }' +
      '.ld-pm-tags{ display:flex; flex-wrap:wrap; gap:6px; }' +
      '.ld-pm-tag{ display:inline-block; padding:5px 12px; background:#FFFFFF; color:#1E3A5F; border:1px solid #BFDBFE; border-radius:6px; font-size:12px; font-weight:600; }' +
      '.ld-pm-section.nexa-pm-card .ld-pm-tag{ background:#FFFFFF; color:#1E3A5F; border:1px solid #BFDBFE; }' +
      '.ld-pm-section.nexa-pm-card .ld-pm-section-title .nexa-pm-badge{ display:inline-block; font-size:10px; font-weight:700; padding:2px 8px; border-radius:4px; background:rgba(96,165,250,0.2); color:#60A5FA; margin-left:8px; vertical-align:middle; }' +
      '@media(max-width:768px){' +
        '.ld-pm-content{ max-width:100%; max-height:95vh; }' +
        '.ld-pm-grid{ grid-template-columns:1fr; }' +
        '.ld-pm-section{ padding:20px; border-radius:12px; }' +
        '.ld-pm-header{ padding:20px 16px; }' +
        '.ld-pm-body{ padding:16px; }' +
      '}';
    document.head.appendChild(style);
  }
  function openProductMatrixModal(productData, fieldMetadata) {
    var modal = document.getElementById('ld-product-matrix-modal');
    if (!modal) return;
    var body = modal.querySelector('.ld-pm-body');
    var titleEl = modal.querySelector('.ld-pm-title');
    var lenderEl = modal.querySelector('.ld-pm-lender');
    var versionEl = modal.querySelector('.ld-pm-version');
    // Extract header info
    var lenderArr = productData['Lender Name (from Lender Name)'];
    var lenderName = Array.isArray(lenderArr) ? lenderArr[0] : (lenderArr || productData['Lender'] || '');
    var loanType = productData['Loan Product'] || productData['Product Name'] || 'Product Details';
    var productVersion = productData['Lender Product Name | Version (Final)'] || productData['Lender Product Name | Version'] || '';
    if (lenderEl) {
      lenderEl.textContent = lenderName ? lenderName.toUpperCase() : '';
      lenderEl.style.display = lenderName ? 'block' : 'none';
    }
    if (titleEl) titleEl.textContent = loanType;
    if (versionEl) {
      versionEl.textContent = productVersion;
      versionEl.style.display = productVersion ? 'block' : 'none';
    }
    // Build grouped field sections (same logic as Loan Search modal)
    var configuredFields = Object.keys(fieldMetadata || {});
    if (configuredFields.length === 0) {
      body.innerHTML = '<p style="padding:20px;color:#64748b;">No field configuration available.</p>';
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      return;
    }
    var groups = {};
    configuredFields.forEach(function(key) {
      if (key === 'id') return;
      var meta = fieldMetadata[key];
      if (!meta) return;
      var groupName = meta.groupName || 'Other Details';
      var groupOrder = meta.groupOrder || 99;
      if (!groups[groupName]) groups[groupName] = { order: groupOrder, fields: [] };
      groups[groupName].fields.push({
        key: key,
        label: meta.label || key.replace(/_/g, ' '),
        value: productData[key],
        order: meta.fieldOrder || 99
      });
    });
    var sortedGroups = Object.entries(groups).sort(function(a, b) { return a[1].order - b[1].order; });
    var html = '';
    sortedGroups.forEach(function(entry) {
      var groupName = entry[0];
      var groupData = entry[1];
      groupData.fields.sort(function(a, b) { return a.order - b.order; });
      var nonEmptyFields = groupData.fields.filter(function(field) { return !pmIsFieldEmpty(field.value); });
      if (nonEmptyFields.length === 0) return;
      var isNexaGroup = groupName.toLowerCase().indexOf('nexa') !== -1;
      var sectionClasses = 'ld-pm-section';
      if (isNexaGroup) sectionClasses += ' nexa-pm-card nexa-only';
      html += '<div class="' + sectionClasses + '">';
      var iconClass = pmGetGroupIcon(groupName);
      html += '<h3 class="ld-pm-section-title"><i class="pm-icon fas ' + iconClass + '"></i>' + escapeHtml(groupName);
      if (isNexaGroup) html += ' <span class="nexa-pm-badge">NEXA</span>';
      html += '</h3><div class="ld-pm-grid">';
      nonEmptyFields.forEach(function(field) {
        var valueHtml = pmFormatValue(field.value, field.key);
        html += '<div class="ld-pm-item"><span class="ld-pm-label">' + escapeHtml(field.label) + '</span><span class="ld-pm-value">' + valueHtml + '</span></div>';
      });
      html += '</div></div>';
    });
    if (html === '') html = '<p style="padding:20px;color:#64748b;">No data available for this product.</p>';
    body.innerHTML = html;
    // Show NEXA sections if user has NEXA access
    var existingNexaEl = document.querySelector('.nexa-only');
    if (existingNexaEl && window.getComputedStyle(existingNexaEl).display !== 'none') {
      body.querySelectorAll('.nexa-only').forEach(function(el) { el.style.display = 'block'; });
    }
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    // v2.22: Show/hide admin Edit in Airtable button for this loan product
    var pmAirtableBtn = document.getElementById('ld-pm-airtable-link');
    if (pmAirtableBtn) {
      var loanAirtableUrl = productData['Link to this Airtable LOAN (Formula)'] || '';
      if (checkIsAdmin() && loanAirtableUrl) {
        pmAirtableBtn.href = loanAirtableUrl;
        pmAirtableBtn.style.display = 'inline-flex';
      } else {
        pmAirtableBtn.style.display = 'none';
        pmAirtableBtn.href = '#';
      }
    }
  }
  function closeProductMatrixModal() {
    var modal = document.getElementById('ld-product-matrix-modal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
    // v2.22: Reset admin Airtable button on close
    var pmAirtableBtn = document.getElementById('ld-pm-airtable-link');
    if (pmAirtableBtn) { pmAirtableBtn.style.display = 'none'; pmAirtableBtn.href = '#'; }
  }
  // ---- Modal helper: check if a field value is empty ----
  function pmIsFieldEmpty(value) {
    if (value === null || value === undefined) return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'boolean') return false;
    if (typeof value === 'number') return false;
    if (typeof value === 'string') {
      var trimmed = value.trim();
      if (trimmed === '') return true;
      if (/^[-\u2014\u2013]+$/.test(trimmed)) return true;
      if (/^n\/?a$/i.test(trimmed)) return true;
    }
    return false;
  }
  // ---- Modal helper: map group name to FA icon ----
  function pmGetGroupIcon(groupName) {
    var name = (groupName || '').toLowerCase();
    if (name.indexOf('loan info') !== -1 || name.indexOf('loan details') !== -1) return 'fa-file-invoice-dollar';
    if (name.indexOf('property') !== -1) return 'fa-house';
    if (name.indexOf('borrower') !== -1 || name.indexOf('credit') !== -1) return 'fa-user';
    if (name.indexOf('pricing') !== -1 || name.indexOf('rate') !== -1 || name.indexOf('comp') !== -1) return 'fa-percent';
    if (name.indexOf('ltv') !== -1 || name.indexOf('cltv') !== -1) return 'fa-chart-simple';
    if (name.indexOf('guideline') !== -1 || name.indexOf('eligible') !== -1 || name.indexOf('requirement') !== -1) return 'fa-list-check';
    if (name.indexOf('dscr') !== -1 || name.indexOf('investment') !== -1 || name.indexOf('rental') !== -1) return 'fa-building';
    if (name.indexOf('bank') !== -1 || name.indexOf('income') !== -1 || name.indexOf('p&l') !== -1 || name.indexOf('profit') !== -1) return 'fa-money-bill-wave';
    if (name.indexOf('dpa') !== -1 || name.indexOf('down payment') !== -1 || name.indexOf('assistance') !== -1) return 'fa-hand-holding-dollar';
    if (name.indexOf('heloc') !== -1 || name.indexOf('heloan') !== -1 || name.indexOf('2nd') !== -1) return 'fa-layer-group';
    if (name.indexOf('fix') !== -1 || name.indexOf('flip') !== -1 || name.indexOf('rehab') !== -1) return 'fa-hammer';
    if (name.indexOf('construction') !== -1 || name.indexOf('guc') !== -1) return 'fa-hard-hat';
    if (name.indexOf('nexa') !== -1) return 'fa-shield-halved';
    if (name.indexOf('other') !== -1) return 'fa-ellipsis';
    return 'fa-sliders';
  }
  // ---- Modal helper: format a field value for display ----
  function pmFormatValue(value, key) {
    if (value === null || value === undefined || value === '') return '\u2014';
    // Array of attachments (objects with url property)
    if (Array.isArray(value)) {
      if (value.length === 0) return '\u2014';
      if (typeof value[0] === 'object' && value[0] !== null && value[0].url) {
        return value.map(function(att) {
          var fname = att.filename || 'Attachment';
          var isImage = att.type && att.type.startsWith('image/');
          if (isImage && att.thumbnails && att.thumbnails.large) {
            return '<a href="' + escapeHtml(att.url) + '" target="_blank" rel="noopener" style="display:inline-block;margin:4px 4px 4px 0"><img src="' + escapeHtml(att.thumbnails.large.url) + '" alt="' + escapeHtml(fname) + '" style="max-width:200px;max-height:120px;border-radius:8px;border:1px solid #e2e8f0"></a>';
          }
          return '<a href="' + escapeHtml(att.url) + '" target="_blank" rel="noopener" class="ld-pm-tag" style="text-decoration:none"><i class="fas fa-file" style="margin-right:4px"></i>' + escapeHtml(fname) + ' \u2197</a>';
        }).join(' ');
      }
      // Array of strings (pills/tags)
      return '<div class="ld-pm-tags">' + value.map(function(v) { return '<span class="ld-pm-tag">' + escapeHtml(String(v)) + '</span>'; }).join('') + '</div>';
    }
    // URL
    if (typeof value === 'string' && value.startsWith('http')) {
      var linkText = key.toLowerCase().includes('matrix') ? 'View Matrix' : 'Open Link';
      return '<a href="' + escapeHtml(value) + '" target="_blank" rel="noopener">' + linkText + ' \u2197</a>';
    }
    // Boolean
    if (typeof value === 'boolean') return value ? '\u2713 Yes' : '\u2717 No';
    // Long text / multi-line
    var str = String(value);
    if (str.length > 100 || str.indexOf('\n') !== -1) {
      var h = escapeHtml(str);
      h = h.replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:|tel:)[^)]+)\)/g, function(m, text, url) { return '<a href="' + url + '" target="_blank" rel="noopener">' + text + '</a>'; });
      h = h.replace(/&lt;(https?:\/\/[^&]+?)&gt;/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
      h = h.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
      h = h.replace(/(^|[\s(>])_([^_]+?)_(?=[\s,.):<]|$)/gm, '$1<em>$2</em>');
      h = h.replace(/(^|[^"=/>])(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
      h = h.replace(/\n/g, '<br>');
      return '<div style="white-space:normal;line-height:1.7;font-size:13px">' + h + '</div>';
    }
    return escapeHtml(str);
  }
  // ============================================================
  // SECTION CARD — colored card with field rows
  // ============================================================
  function renderSectionCard(section, color) {
    if (!section.fields || section.fields.length === 0) return '';
    var allNexaGated = section.fields.every(function(f) { return f.nexaGated; });
    var renderModes = {};
    section.fields.forEach(function(f) { renderModes[f.renderMode] = true; });
    var allLinks   = Object.keys(renderModes).length === 1 && renderModes['link'];
    var allSocial  = Object.keys(renderModes).length === 1 && renderModes['social'];
    var allPricing = Object.keys(renderModes).length === 1 && renderModes['pricing-engine'];
    var fieldsHtml = '';
    if (allLinks) {
      fieldsHtml = renderLinkRows(section.fields);
    } else if (allSocial) {
      fieldsHtml = '<div style="padding:12px 16px;">' + renderSocialRow(section.fields) + '</div>';
    } else if (allPricing) {
      fieldsHtml = renderPricingGrid(section.fields);
      if (!fieldsHtml) return ''; // hide section entirely if no available engines
    } else {
      section.fields.forEach(function(field) {
        var rowHtml = renderFieldRow(field, color);
        if (!rowHtml) return;
        if (field.nexaGated) {
          fieldsHtml += '<div class="nexa-only" style="display:none;">' + rowHtml + '</div>';
        } else {
          fieldsHtml += rowHtml;
        }
      });
    }
    if (!fieldsHtml) return '';
    if (allNexaGated) {
      // Use getSectionColor so NEXA sections get dark navy consistently
      var nexaColor  = getSectionColor(section.name);
      var nexaBorder = (nexaColor === '#1E3A5F') ? '#8EB5D4' : nexaColor + '55';
      return (
        '<div class="ld-section-card nexa-only" style="display:none;border:1px solid ' + nexaBorder + ';">' +
          renderSectionHeader(section.name, nexaColor) +
          fieldsHtml +
        '</div>'
      );
    }
    // "About" section spans full width of the 2-col grid
    var fullWidth = section.name === 'About' ? 'grid-column:1/-1;' : '';
    // Dark navy needs an explicit border color — hex opacity '55' looks washed out
    var cardBorder = (color === '#1E3A5F') ? '#8EB5D4' : color + '55';
    return (
      '<div class="ld-section-card" style="' + fullWidth + 'border:1px solid ' + cardBorder + ';">' +
        renderSectionHeader(section.name, color) +
        fieldsHtml +
      '</div>'
    );
  }
  function renderSectionHeader(title, color) {
    // NEXA sections get a solid dark navy header (matching the page header bar)
    // with white text — making them unmistakably distinct from standard sections.
    // Standard sections continue to use the light tint + colored text pattern.
    var isDarkNavy = (color === '#1E3A5F');
    if (isDarkNavy) {
      return (
        '<div class="ld-section-header" style="background:#1E3A5F;border-bottom:1px solid #152D4A;">' +
          '<div class="ld-section-bar" style="background:#FFFFFF;opacity:0.5;"></div>' +
          '<span class="ld-section-title" style="color:#FFFFFF;letter-spacing:0.06em;">' + escapeHtml(title) + '</span>' +
        '</div>'
      );
    }
    return (
      '<div class="ld-section-header" style="background:' + color + '20;border-bottom:1px solid ' + color + '45;">' +
        '<div class="ld-section-bar" style="background:' + color + ';"></div>' +
        '<span class="ld-section-title" style="color:' + color + ';">' + escapeHtml(title) + '</span>' +
      '</div>'
    );
  }
  // ============================================================
  // FIELD ROW — renders a single field as a label/value row
  // ============================================================
  function renderFieldRow(field, sectionColor) {
    var mode  = field.renderMode || 'text';
    var value = field.value;
    var label = field.displayName;
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' && (!value.trim() || value.trim() === '-')) return '';
    // Determine alternating row bg (pass color for section-tinted rows)
    var altBg = sectionColor ? sectionColor + '06' : 'var(--ld-surface2)';
    switch (mode) {
      case 'text':
      default:
        return (
          '<div class="ld-field-row">' +
            '<span class="ld-field-label">' + escapeHtml(label) + '</span>' +
            '<span class="ld-field-value">' + escapeHtml(String(value)) + '</span>' +
          '</div>'
        );
      case 'link':
        if (!isValidURL(String(value))) return '';
        var linkIcon = LINK_ICON_CONFIG[label] || 'fa-solid fa-link';
        return (
          '<div class="ld-field-row">' +
            '<span class="ld-field-label">' + escapeHtml(label) + '</span>' +
            '<a href="' + escapeAttr(String(value)) + '" target="_blank" rel="noopener" class="ld-link-btn">' +
              '<i class="' + linkIcon + ' ld-link-btn-icon"></i>' +
              escapeHtml(label) +
            '</a>' +
          '</div>'
        );
      case 'copyable': {
        var textVal = String(value);
        return (
          '<div class="ld-field-row details-row-copyable" style="align-items:flex-start;">' +
            '<span class="ld-field-label">' + escapeHtml(label) + '</span>' +
            '<div class="copyable-value">' +
              '<pre class="copyable-text" style="margin:0;white-space:pre-wrap;word-break:break-word;font-family:inherit;font-size:inherit;">' +
                escapeHtml(textVal) +
              '</pre>' +
              '<button class="copy-btn" data-copy="' + escapeAttr(textVal) + '" title="Copy to clipboard">' +
                '<i class="fa-solid fa-copy"></i>' +
              '</button>' +
            '</div>' +
          '</div>'
        );
      }
      case 'boolean': {
        var boolVal = (value === true || String(value).toLowerCase().includes('yes'));
        return (
          '<div class="ld-field-row">' +
            '<span class="ld-field-label">' + escapeHtml(label) + '</span>' +
            '<span class="status-badge ' + (boolVal ? 'badge-yes' : 'badge-no') + '">' +
              (boolVal ? '✓ Yes' : '✗ No') +
            '</span>' +
          '</div>'
        );
      }
      case 'pills': {
        var pillVal = String(value).trim();
        if (!pillVal) return '';
        var lv = pillVal.toLowerCase();
        var pillClass = lv.includes('yes') || lv.includes('true') ? 'pill-yes'
                      : lv.includes('no')  || lv.includes('false') ? 'pill-no'
                      : 'pill-neutral';
        return (
          '<div class="ld-field-row">' +
            '<span class="ld-field-label">' + escapeHtml(label) + '</span>' +
            '<span class="lender-pill ' + pillClass + '">' + escapeHtml(pillVal) + '</span>' +
          '</div>'
        );
      }
      case 'notes': {
        var noteText = String(value).trim();
        if (!noteText) return '';
        return (
          '<div style="padding:10px 16px;">' +
            '<div class="lender-notes-box">' +
              '<p style="font-size:10px;font-weight:700;letter-spacing:0.08em;color:var(--ld-dim);text-transform:uppercase;margin:0 0 8px 0;">' +
                escapeHtml(label) +
              '</p>' +
              '<div class="lender-notes-content">' + parseMarkdown(noteText) + '</div>' +
            '</div>' +
          '</div>'
        );
      }
      case 'richtext': {
        var proseText = String(value).trim();
        if (!proseText) return '';
        return (
          '<div style="padding:10px 16px;">' +
            '<div class="lender-notes-content">' + parseMarkdown(proseText) + '</div>' +
          '</div>'
        );
      }
      case 'list': {
        var listVal = String(value).trim();
        if (!listVal) return '';
        var items = listVal.split(/\n|,/).map(function(s) { return s.trim(); }).filter(Boolean);
        if (items.length === 0) return '';
        if (items.length === 1) {
          return (
            '<div class="ld-field-row">' +
              '<span class="ld-field-label">' + escapeHtml(label) + '</span>' +
              '<span class="ld-field-value">' + escapeHtml(items[0]) + '</span>' +
            '</div>'
          );
        }
        var listHtml = '<div style="padding:10px 16px;">';
        listHtml += '<p style="font-size:11px;font-weight:600;color:var(--ld-muted);margin-bottom:6px;">' + escapeHtml(label) + '</p>';
        listHtml += '<ul class="lender-bullet-list">';
        items.forEach(function(item) { listHtml += '<li>' + escapeHtml(item) + '</li>'; });
        listHtml += '</ul></div>';
        return listHtml;
      }
      case 'attachment': {
        if (!Array.isArray(value) || value.length === 0) return '';
        var html = '<div style="padding:10px 16px;"><div class="attachment-list">';
        html += '<p style="font-size:11px;font-weight:600;color:var(--ld-muted);margin-bottom:6px;">' + escapeHtml(label) + '</p>';
        value.forEach(function(att) {
          var ext = att.filename ? att.filename.split('.').pop().toUpperCase() : 'FILE';
          html +=
            '<a href="' + escapeAttr(att.url) + '" target="_blank" rel="noopener" class="attachment-item">' +
              '<i class="fa-solid fa-file-arrow-down" style="margin-right:6px;color:var(--ld-accent);"></i>' +
              escapeHtml(att.filename || 'Download') +
              '<span class="attachment-ext">' + ext + '</span>' +
            '</a>';
        });
        html += '</div></div>';
        return html;
      }
      case 'social': // handled at section level
      case 'pricing-engine':
        return '';
      case 'nexa': {
        var nexaVal = escapeHtml(String(value));
        if (!nexaVal) return '';
        return (
          '<div class="ld-field-row">' +
            '<span class="ld-field-label">' + escapeHtml(label) + '</span>' +
            '<span class="ld-field-value">' + nexaVal + '</span>' +
          '</div>'
        );
      }
    }
  }
  // ============================================================
  // LINK ROWS — link sections render each link as a button row
  // Uses LINK_ICON_CONFIG for per-link icons; falls back to fa-link
  // ============================================================
  function renderLinkRows(fields) {
    var validLinks = fields.filter(function(f) { return f.value && isValidURL(String(f.value)); });
    if (validLinks.length === 0) return '';
    var html = '';
    validLinks.forEach(function(field) {
      var icon = LINK_ICON_CONFIG[field.displayName] || 'fa-solid fa-link';
      var wrapOpen  = field.nexaGated ? '<div class="nexa-only" style="display:none;">' : '';
      var wrapClose = field.nexaGated ? '</div>' : '';
      html += wrapOpen +
        '<div class="ld-field-row">' +
          '<span class="ld-field-label">' + escapeHtml(field.displayName) + '</span>' +
          '<a href="' + escapeAttr(String(field.value)) + '" target="_blank" rel="noopener" class="ld-link-btn">' +
            '<i class="' + icon + ' ld-link-btn-icon"></i>' +
            escapeHtml(field.displayName) +
          '</a>' +
        '</div>' +
        wrapClose;
    });
    return html;
  }
  // ============================================================
  // SOCIAL ROW
  // ============================================================
  function renderSocialRow(fields) {
    var valid = fields.filter(function(f) { return f.value && isValidURL(String(f.value)); });
    if (valid.length === 0) return '';
    var html = '<div class="social-icons-row">';
    valid.forEach(function(field) {
      var cfg = SOCIAL_CONFIG[field.displayName] || { icon: 'fa-solid fa-share-nodes', color: '#64748B', label: field.displayName };
      html +=
        '<a href="' + escapeAttr(String(field.value)) + '" target="_blank" rel="noopener" ' +
        'class="social-icon-btn" style="background:' + cfg.color + ';" title="' + escapeAttr(cfg.label) + '">' +
          '<i class="' + cfg.icon + '"></i>' +
          '<span class="social-label">' + escapeHtml(cfg.label) + '</span>' +
        '</a>';
    });
    return html + '</div>';
  }
  // ============================================================
  // PRICING GRID — only shows available engines, horizontal rows
  // ============================================================
  function renderPricingGrid(fields) {
    if (fields.length === 0) return '';
    // Only render engines marked as available
    var available = fields.filter(function(field) {
      var pVal = String(field.value || '').toLowerCase();
      return pVal.indexOf('yes') !== -1 || pVal.indexOf('✅') !== -1;
    });
    if (available.length === 0) return '';
    var html = '<div class="pricing-engines-list">';
    available.forEach(function(field) {
      var pe = PRICING_ENGINE_CONFIG[field.displayName] || { icon: 'fa-solid fa-chart-bar', label: field.displayName, url: '' };
      html +=
        '<a href="' + escapeAttr(pe.url || '#') + '" target="_blank" rel="noopener" class="pe-row">' +
          '<div class="pe-row-icon"><i class="' + pe.icon + '"></i></div>' +
          '<span class="pe-row-label">' + escapeHtml(pe.label) + '</span>' +
          '<span class="pe-row-launch">Open <i class="fa-solid fa-arrow-up-right-from-square"></i></span>' +
        '</a>';
    });
    return html + '</div>';
  }
  // ============================================================
  // AE MODAL
  // ============================================================
  function attachAEClickHandlers(lenderData) {
    var cards = document.querySelectorAll('.ae-card[data-ae-id]');
    if (cards.length === 0) return;
    var aes = lenderData.accountExecs || [];
    cards.forEach(function(card) {
      card.addEventListener('click', function() {
        var aeId = card.getAttribute('data-ae-id');
        var ae = null;
        for (var i = 0; i < aes.length; i++) {
          if (aes[i].id === aeId) { ae = aes[i]; break; }
        }
        if (ae) openAEModal(ae);
      });
    });
  }
  function openAEModal(ae) {
    var existing = document.getElementById('ae-modal-overlay');
    if (existing) existing.remove();
    var photoHtml = '';
    if (ae.photo && isValidURL(ae.photo)) {
      photoHtml = '<img class="ae-modal-photo" src="' + escapeAttr(ae.photo) + '" alt="' + escapeAttr(ae.name) + '" ' +
        'onerror="this.outerHTML=\'<div class=ae-modal-photo-placeholder>' + escapeAttr((ae.name || 'A').charAt(0)) + '</div>\'">';
    } else {
      photoHtml = '<div class="ae-modal-photo-placeholder">' + escapeHtml((ae.name || 'A').charAt(0)) + '</div>';
    }
    var summaryLines = [];
    if (ae.name)  summaryLines.push(ae.name);
    if (ae.title) summaryLines.push(ae.title);
    if (ae.email) summaryLines.push(ae.email);
    if (ae.mobileNumber) summaryLines.push('Mobile: ' + ae.mobileNumber);
    if (ae.officeNumber)  summaryLines.push('Office: ' + ae.officeNumber + (ae.officeExtension ? ' x' + ae.officeExtension : ''));
    var summaryText = summaryLines.join('\n');
    var overlay = document.createElement('div');
    overlay.id = 'ae-modal-overlay';
    overlay.className = 'ae-modal-overlay';
    overlay.innerHTML =
      '<div class="ae-modal">' +
        '<button class="ae-modal-close" id="ae-modal-close"><i class="fa-solid fa-xmark"></i></button>' +
        '<div class="ae-modal-header">' +
          photoHtml +
          '<div class="ae-modal-info">' +
            '<h3 class="ae-modal-name">' + escapeHtml(ae.name || '') + '</h3>' +
            '<p class="ae-modal-title">' + escapeHtml(ae.title || '') + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="ae-modal-body">' +
          (ae.email
            ? '<div class="ae-contact-row">' +
                '<i class="fa-solid fa-envelope ae-contact-icon"></i>' +
                '<a href="mailto:' + escapeAttr(ae.email) + '" class="ae-contact-link">' + escapeHtml(ae.email) + '</a>' +
                '<button class="ae-copy-btn" data-copy="' + escapeAttr(ae.email) + '"><i class="fa-solid fa-copy"></i></button>' +
              '</div>' : '') +
          (ae.mobileNumber
            ? '<div class="ae-contact-row">' +
                '<i class="fa-solid fa-mobile-screen ae-contact-icon"></i>' +
                '<a href="tel:' + escapeAttr(ae.mobileNumber) + '" class="ae-contact-link">' + escapeHtml(ae.mobileNumber) + '</a>' +
                '<button class="ae-copy-btn" data-copy="' + escapeAttr(ae.mobileNumber) + '"><i class="fa-solid fa-copy"></i></button>' +
              '</div>' : '') +
          (ae.officeNumber
            ? '<div class="ae-contact-row">' +
                '<i class="fa-solid fa-phone ae-contact-icon"></i>' +
                '<a href="tel:' + escapeAttr(ae.officeNumber) + '" class="ae-contact-link">' + escapeHtml(ae.officeNumber) + (ae.officeExtension ? ' x' + ae.officeExtension : '') + '</a>' +
                '<button class="ae-copy-btn" data-copy="' + escapeAttr(ae.officeNumber) + '"><i class="fa-solid fa-copy"></i></button>' +
              '</div>' : '') +
        '</div>' +
        (summaryText
          ? '<div class="ae-modal-footer">' +
              '<button class="ae-modal-summary-copy" id="ae-summary-copy">' +
                '<i class="fa-solid fa-copy"></i> Copy All Contact Info' +
              '</button>' +
            '</div>' : '') +
      '</div>';
    document.body.appendChild(overlay);
    document.getElementById('ae-modal-close').addEventListener('click', closeAEModal);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) closeAEModal(); });
    document.addEventListener('keydown', handleAEModalKeydown);
    overlay.querySelectorAll('.ae-copy-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        copyToClipboard(btn.getAttribute('data-copy'), btn);
      });
    });
    var summaryBtn = document.getElementById('ae-summary-copy');
    if (summaryBtn && summaryText) {
      summaryBtn.setAttribute('data-copy', summaryText);
      summaryBtn.addEventListener('click', function() { copyToClipboard(summaryText, summaryBtn); });
    }
  }
  function closeAEModal() {
    var overlay = document.getElementById('ae-modal-overlay');
    if (overlay) overlay.remove();
    document.removeEventListener('keydown', handleAEModalKeydown);
  }
  function handleAEModalKeydown(e) { if (e.key === 'Escape') closeAEModal(); }
  // ============================================================
  // SHARE HANDLERS
  // ============================================================
  function attachShareHandlers(name) {
    var copyBtn  = document.getElementById('ld-copy-url-btn');
    var shareBtn = document.getElementById('ld-share-btn');
    var currentUrl = window.location.href;
    if (copyBtn) {
      copyBtn.addEventListener('click', function() {
        navigator.clipboard.writeText(currentUrl)
          .then(function() { flashActionBtn(copyBtn, 'Copy Link', 'Copied!'); })
          .catch(function() { fallbackCopy(currentUrl); flashActionBtn(copyBtn, 'Copy Link', 'Copied!'); });
      });
    }
    if (shareBtn) {
      shareBtn.addEventListener('click', function() {
        if (navigator.share) {
          navigator.share({ title: name + ' | mtg.broker', url: currentUrl }).catch(function() {});
        } else {
          navigator.clipboard.writeText(currentUrl)
            .then(function() { flashActionBtn(shareBtn, 'Share', 'Copied!'); })
            .catch(function() { fallbackCopy(currentUrl); flashActionBtn(shareBtn, 'Share', 'Copied!'); });
        }
      });
    }
  }
  function flashActionBtn(btn, originalText, successText) {
    btn.classList.add('copied');
    var icon = btn.querySelector('i');
    var origIcon = icon ? icon.className : '';
    if (icon) icon.className = 'fa-solid fa-check';
    btn.childNodes[btn.childNodes.length - 1].textContent = successText;
    setTimeout(function() {
      btn.classList.remove('copied');
      if (icon) icon.className = origIcon;
      btn.childNodes[btn.childNodes.length - 1].textContent = originalText;
    }, 2000);
  }
  // ============================================================
  // PRIVATE NOTES (PLUS and PRO plans)
  // ============================================================
  function loadPrivateNotes(lender) {
    var placeholder = document.getElementById('lender-private-notes-section');
    if (!placeholder) return;
    var token = null;
    try { token = localStorage.getItem('Outseta.nocode.accessToken'); } catch (e) {}
    if (!token) return;
    var hasPlusOrPro = false;
    try {
      var payload = JSON.parse(atob(token.split('.')[1]));
      var planUid = payload['outseta:planUid'] || payload['outseta:plan_uid'] || payload.plan_uid || '';
      hasPlusOrPro = (planUid === PRO_PLAN_UID || planUid === PLUS_PLAN_UID);
    } catch (e) {}
    if (!hasPlusOrPro) {
      placeholder.innerHTML =
        '<div style="margin-top:4px;">' +
          '<p style="font-size:10px;font-weight:700;letter-spacing:0.08em;color:var(--ld-dim);text-transform:uppercase;margin-bottom:8px;">' +
            'Private Notes' +
          '</p>' +
          '<div class="upgrade-teaser">' +
            '<i class="fa-solid fa-lock" style="margin-right:8px;color:var(--ld-dim);"></i>' +
            'Private notes and star ratings are available on the ' +
            '<a href="/pricing">PLUS or PRO plan</a>.' +
          '</div>' +
        '</div>';
      return;
    }
    fetch(
      LENDERS_API + '/api/lenders/' + encodeURIComponent(lender.slug) + '/user-notes',
      { headers: { 'Authorization': 'Bearer ' + token } }
    )
    .then(function(r) { return r.json(); })
    .then(function(data) { renderPrivateNotesUI(placeholder, lender, data.rating || 0, data.notes || '', token); })
    .catch(function() { renderPrivateNotesUI(placeholder, lender, 0, '', token); });
  }
  function renderPrivateNotesUI(placeholder, lender, rating, notes, token) {
    var starsHtml = '';
    for (var s = 1; s <= 5; s++) {
      var filled = s <= rating;
      starsHtml +=
        '<button class="star-btn ' + (filled ? 'star-filled' : '') + '" data-star="' + s + '">' +
          '<i class="fa-' + (filled ? 'solid' : 'regular') + ' fa-star"></i>' +
        '</button>';
    }
    placeholder.innerHTML =
      '<div style="margin-top:4px;">' +
        '<p style="font-size:10px;font-weight:700;letter-spacing:0.08em;color:var(--ld-dim);text-transform:uppercase;margin-bottom:8px;">' +
          '<i class="fa-solid fa-lock" style="margin-right:6px;"></i>My Private Notes' +
        '</p>' +
        '<div class="private-notes-container">' +
          '<div class="star-rating" id="star-rating" data-current="' + rating + '">' +
            starsHtml +
            '<span class="star-label" id="star-label">' + (rating > 0 ? rating + '/5' : 'Not rated') + '</span>' +
          '</div>' +
          '<textarea id="private-notes-textarea" placeholder="Add your private notes about this lender...">' +
            escapeHtml(notes) +
          '</textarea>' +
          '<div id="notes-save-status"></div>' +
        '</div>' +
      '</div>';
    var starBtns    = placeholder.querySelectorAll('.star-btn');
    var starLabel   = placeholder.querySelector('#star-label');
    var currentRating = rating;
    starBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var newRating = parseInt(btn.getAttribute('data-star'), 10);
        currentRating = newRating;
        starBtns.forEach(function(b) {
          var n = parseInt(b.getAttribute('data-star'), 10);
          b.classList.toggle('star-filled', n <= newRating);
          b.querySelector('i').className = 'fa-' + (n <= newRating ? 'solid' : 'regular') + ' fa-star';
        });
        starLabel.textContent = newRating + '/5';
        scheduleNotesSave(lender, currentRating, null, token);
      });
    });
    var textarea = placeholder.querySelector('#private-notes-textarea');
    textarea.addEventListener('input', function() {
      scheduleNotesSave(lender, currentRating, textarea.value, token);
    });
  }
  var notesSaveTimer = null;
  function scheduleNotesSave(lender, rating, notes, token) {
    if (notesSaveTimer) clearTimeout(notesSaveTimer);
    var statusEl = document.getElementById('notes-save-status');
    if (statusEl) statusEl.textContent = 'Saving...';
    notesSaveTimer = setTimeout(function() {
      var textarea = document.getElementById('private-notes-textarea');
      var notesVal = (notes !== null) ? notes : (textarea ? textarea.value : '');
      fetch(
        LENDERS_API + '/api/lenders/' + encodeURIComponent(lender.slug) + '/user-notes',
        {
          method: 'PUT',
          headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating: rating, notes: notesVal, lenderId: lender.id })
        }
      )
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (statusEl) {
          statusEl.textContent = data.success ? '✓ Saved' : '⚠ Save failed';
          setTimeout(function() { if (statusEl) statusEl.textContent = ''; }, 2000);
        }
      })
      .catch(function() { if (statusEl) statusEl.textContent = '⚠ Save failed'; });
    }, 1200);
  }
  // ============================================================
  // NEXA GATING
  // ============================================================
  function checkNexaAndRevealGated(lender) {
    var needsCheck = lender.nexaWholesale || lender.nexaNondel || lender.nexa100 ||
      (lender.sections || []).some(function(s) { return s.hasNexa; });
    if (!needsCheck) return;
    if (checkNexaViaJWT()) { revealNexaElements(); return; }
    checkNexaViaOutseta().then(function(isNexa) { if (isNexa) revealNexaElements(); });
  }
  function checkNexaViaJWT() {
    try {
      var token = localStorage.getItem('Outseta.nocode.accessToken');
      if (token) {
        var payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        var email = (payload.email || '').toLowerCase();
        if (email.endsWith('@nexamortgage.com') || email.endsWith('@nexalending.com')) return true;
        var nexaAccess = '';
        try { nexaAccess = payload['outseta:NexaAccess'] || payload.NexaAccess || ''; } catch (e) {}
        if (nexaAccess.toLowerCase() === 'true') return true;
      }
    } catch (e) {}
    return false;
  }
  function checkNexaViaOutseta() {
    return new Promise(function(resolve) {
      var attempts = 0;
      function tryCheck() {
        attempts++;
        if (typeof window.getCachedOutsetaUser === 'function') {
          window.getCachedOutsetaUser().then(function(user) {
            if (!user) { resolve(false); return; }
            // Check user.NexaAccess first — confirmed correct path from site-wide NEXA detection
            var nexaAccess = '';
            try { nexaAccess = user.NexaAccess || ''; } catch (e) {}
            // Fallback: also check Account.Metadata path
            if (!nexaAccess) {
              try { nexaAccess = user.Account.Metadata.NexaAccess || ''; } catch (e) {}
            }
            resolve(nexaAccess.toLowerCase() === 'true');
          }).catch(function() { resolve(false); });
        } else if (attempts < 15) {
          setTimeout(tryCheck, 200);
        } else {
          resolve(false);
        }
      }
      tryCheck();
    });
  }
  function revealNexaElements() {
    // Reveal all nexa-only section field wrappers as block.
    // NOTE: .ld-badges is intentionally NOT in .nexa-only — it's handled
    // separately below to avoid Site Settings checkNexaAccess() overwriting
    // display:flex with display:block (which compresses the badge layout).
    document.querySelectorAll('.nexa-only').forEach(function(el) {
      el.style.display = 'block';
    });
    // Reveal badges div as flex (its natural display type)
    var badges = document.getElementById('ld-nexa-badges');
    if (badges) badges.style.display = 'flex';
    console.log('✅ Lender Detail v5.12: NEXA elements revealed');
  }
  function redirectToLenders() {
    var header  = document.querySelector('.lender-detail-header');
    var content = document.querySelector('.lender-detail-content');
    if (content) content.innerHTML = '';
    if (header) {
      header.innerHTML =
        '<div style="text-align:center;padding:60px 20px;">' +
          '<div style="font-size:48px;margin-bottom:16px;">🔒</div>' +
          '<h2 style="font-size:20px;font-weight:600;color:var(--ld-text);margin-bottom:8px;">Access Restricted</h2>' +
          '<p style="color:var(--ld-muted);margin-bottom:24px;">This lender is only available to NEXA employees.</p>' +
          '<a href="/app/lenders" style="display:inline-block;padding:10px 24px;background:#2563EB;color:#fff;border-radius:8px;text-decoration:none;font-weight:500;">Back to Lenders</a>' +
        '</div>';
    }
    setTimeout(function() { window.location.href = '/app/lenders'; }, 3000);
  }
  // ============================================================
  // COPY HANDLERS
  // ============================================================
  function attachCopyableHandlers() {
    document.querySelectorAll('.copy-btn[data-copy]').forEach(function(btn) {
      btn.addEventListener('click', function() { copyToClipboard(btn.getAttribute('data-copy'), btn); });
    });
  }
  function copyToClipboard(text, btnEl) {
    navigator.clipboard.writeText(text)
      .then(function() { showCopyFeedback(btnEl); })
      .catch(function() { fallbackCopy(text); showCopyFeedback(btnEl); });
  }
  function showCopyFeedback(btnEl) {
    if (!btnEl) return;
    var origHTML = btnEl.innerHTML;
    btnEl.classList.add('copied');
    if (btnEl.classList.contains('ae-modal-summary-copy')) {
      btnEl.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
    } else {
      btnEl.innerHTML = '<i class="fa-solid fa-check"></i>';
    }
    setTimeout(function() { btnEl.classList.remove('copied'); btnEl.innerHTML = origHTML; }, 1500);
    showCopyToast('Copied to clipboard');
  }
  function showCopyToast(msg) {
    var toast = document.getElementById('ae-copy-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.style.display = 'block';
    toast.classList.add('show');
    setTimeout(function() {
      toast.classList.remove('show');
      setTimeout(function() { toast.style.display = 'none'; }, 300);
    }, 1800);
  }
  // ============================================================
  // LOADING / ERROR
  // ============================================================
  function showLoadingSkeleton() {
    var header  = document.querySelector('.lender-detail-header');
    var content = document.querySelector('.lender-detail-content');
    if (header  && !header.innerHTML.trim())  header.innerHTML  = '<div class="lender-detail-skeleton skeleton-header"></div>';
    if (content && !content.innerHTML.trim()) content.innerHTML =
      '<div class="lender-detail-skeleton skeleton-section"></div>' +
      '<div class="lender-detail-skeleton skeleton-section" style="height:160px;"></div>';
  }
  function showError(message) {
    var header  = document.querySelector('.lender-detail-header');
    var content = document.querySelector('.lender-detail-content');
    if (header)  header.innerHTML  = '';
    if (content) content.innerHTML =
      '<div class="empty-state-box" style="text-align:center;padding:40px 20px;">' +
        '<i class="fa-solid fa-triangle-exclamation" style="font-size:32px;color:#F59E0B;margin-bottom:12px;display:block;"></i>' +
        '<p>' + escapeHtml(message) + '</p>' +
      '</div>';
  }
  // ============================================================
  // MARKDOWN PARSER (lightweight)
  // ============================================================
  function parseMarkdown(text) {
    if (!text) return '';
    var lines  = text.split('\n');
    var output = '';
    var inUL = false, inOL = false;
    function closeList() {
      if (inUL) { output += '</ul>'; inUL = false; }
      if (inOL) { output += '</ol>'; inOL = false; }
    }
    function inlineFmt(str) {
      str = escapeHtml(str);
      str = str.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
      str = str.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      str = str.replace(/\*(.*?)\*/g, '<em>$1</em>');
      str = str.replace(/_(.*?)_/g, '<em>$1</em>');
      str = str.replace(/\x60([^\x60]+)\x60/g, '<code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:3px;font-size:0.9em;">$1</code>');
      str = str.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:var(--ld-accent);">$1</a>');
      return str;
    }
    lines.forEach(function(raw) {
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(raw.trim())) {
        closeList(); output += '<hr style="border:none;border-top:1px solid var(--ld-border);margin:10px 0;">'; return;
      }
      var hm = raw.match(/^(#{1,6})\s+(.*)/);
      if (hm) { closeList(); var lvl = Math.min(hm[1].length + 2, 6); output += '<h' + lvl + ' style="margin:12px 0 5px;font-weight:600;color:var(--ld-text);">' + inlineFmt(hm[2]) + '</h' + lvl + '>'; return; }
      var ul = raw.match(/^[\s]*[-*]\s+(.*)/);
      if (ul) { if (inOL) { output += '</ol>'; inOL = false; } if (!inUL) { output += '<ul style="margin:4px 0 4px 16px;padding:0;">'; inUL = true; } output += '<li>' + inlineFmt(ul[1]) + '</li>'; return; }
      var ol = raw.match(/^[\s]*\d+\.\s+(.*)/);
      if (ol) { if (inUL) { output += '</ul>'; inUL = false; } if (!inOL) { output += '<ol style="margin:4px 0 4px 16px;padding:0;">'; inOL = true; } output += '<li>' + inlineFmt(ol[1]) + '</li>'; return; }
      if (!raw.trim()) { closeList(); output += '<br>'; return; }
      closeList(); output += '<p style="margin:3px 0;">' + inlineFmt(raw) + '</p>';
    });
    closeList();
    return output;
  }
  // ============================================================
  // UTILITIES
  // ============================================================
  function isValidURL(val) {
    if (!val) return false;
    var v = String(val).trim();
    if (!v || v === '#' || v === '-') return false;
    if (v.indexOf('{') !== -1 || v.indexOf('%7B') !== -1) return false;
    return v.indexOf('http://') === 0 || v.indexOf('https://') === 0 || v.indexOf('//') === 0;
  }
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    } catch (e) {}
  }
})();
`;

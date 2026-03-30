/**
 * MTG Broker VENDORS API - Cloudflare Worker
 * Serves vendor directory and detail data directly from Airtable.
 *
 * Version: 1.15  |  Updated: March 2026
 *
 * v1.15 changes:
 *   - NEXA Approved boolean fix: renderBooleanField now handles multi-value
 *     single-select fields (Yes, No - Restricted, NA, Not Listed, etc.)
 *     instead of defaulting anything non-"Yes" to "No". Values like "--"
 *     are now skipped by the API (treated as empty/no-data).
 *   - Currency formatting: text fields in the Pricing section that contain
 *     numeric values now display with $ prefix and comma formatting.
 *   - Removed "VENDOR" label from the detail page header bar.
 *
 * v1.14 changes:
 *   - Added airtableLink field to vendor detail API response.
 *     Reads from "Link to this Airtable VENDOR (Formula)" field.
 *   - Admin-only "Edit in Airtable" button in vendor-detail.js (v1.8).
 *     Detects admin email via JWT, shows amber Airtable button in header.
 *
 * v1.13 changes:
 *   - Boolean field parsing fixed: Airtable single-select values like
 *     "🟢 Yes" and "🔴 No" include emoji prefixes. isYesOrTrue() and
 *     renderBooleanField() now use .includes() instead of strict ===
 *     so emoji-prefixed "Yes"/"True" values are correctly detected.
 *     This fixes NEXA Approved always showing "No" on vendor detail pages.
 *   - Removed NEXA Approved badge from vendor header. The badge was
 *     visible to ALL users (not NEXA-gated). NEXA Approved status is
 *     already shown inside the NEXA Specific section which is properly
 *     gated to NEXA users only.
 *
 * v1.12 changes:
 *   - renderBooleanField() crash fixed: isYesOrTrue() is defined in the
 *     Cloudflare Worker scope but VENDOR_DETAIL_JS is served as a separate
 *     browser JS file with no access to that scope — causing a ReferenceError.
 *     The boolean check is now inlined directly in renderBooleanField().
 *
 * v1.7 changes:
 *   - Section colors unified: all standard sections → brand blue (#2563EB),
 *     NEXA sections → dark navy (#1E3A5F). Matches lender worker v2.13.
 *   - NEXA gating fixed: JWT check now also reads outseta:NexaAccess claim;
 *     Outseta check now compares string "true" instead of boolean true;
 *     uses getCachedOutsetaUser() with retry loop (matches lender pattern).
 *   - X (Twitter) icon fixed: fa-x-twitter not in FA 6.4.0, now renders
 *     a bold text "X" character as fallback so it always displays correctly.
 *
 * This worker handles everything for the Vendors section:
 *   1. Vendor list for the directory grid (/api/vendors)
 *   2. Vendor detail with config-driven sections (/api/vendors/:slug)
 *   3. Serves the vendor detail page JS as a static file (/vendor-detail.js)
 *
 * Built following the same pattern as mtg-broker-lenders v2.x
 *
 * ⚡ SETUP REQUIRED:
 *   Vendor Detail Config table created and configured.
 *   Table ID configured: tblMmnKM3pY0eR37D
 *   See Vendor-Detail-Config-Setup-Guide.md for full instructions.
 *
 * DEPLOY URL: mtg-broker-vendors.rich-e00.workers.dev
 *
 * Environment Variables Required:
 *   - AIRTABLE_API_KEY: Your Airtable personal access token
 *
 * Airtable Tables Used:
 *   - Vendors List         (tblDodcVHoEEatVIe) — main vendor data
 *   - Vendor Detail Config (tblMmnKM3pY0eR37D) — controls sections/fields shown
 *   - Vendor Categories    (tblC6wIF4f3oMAypu) — category names and descriptions
 *   - Contacts             (tblEEDPa1vXeR6cnT) — Account Rep details
 *   - Other Contacts       (tblAwo8EzVCyoikmP) — dept contacts per vendor
 *
 * Endpoints:
 *   GET  /api/vendors              — All vendors for directory grid
 *   GET  /api/vendors/clear-cache  — Clear all caches
 *   GET  /api/vendors/:slug        — Single vendor detail (sections + reps + contacts)
 *   GET  /vendor-detail.js         — Serves the vendor detail page JS
 *   GET  /health                   — Health check with version info
 */

const AIRTABLE_BASE_ID = 'appuJgI9X93OLaf0u';

// ============================
// TABLE IDs
// ============================
const TABLES = {
  VENDORS:              'tblDodcVHoEEatVIe',
  VENDOR_DETAIL_CONFIG: 'tblMmnKM3pY0eR37D', // Vendor Detail Config table
  VENDOR_CATEGORIES:    'tblC6wIF4f3oMAypu',
  CONTACTS:             'tblEEDPa1vXeR6cnT',
  OTHER_CONTACTS:       'tblAwo8EzVCyoikmP'
};

// ============================
// CORS (supports cookies)
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

// Vendor List Cache — all vendors for the directory page
let vendorListCache = null;
let vendorListCacheTimestamp = null;
const VENDOR_LIST_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Vendor Detail Cache — per-slug
const vendorDetailCache = new Map();
const VENDOR_DETAIL_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Vendor Detail Config Cache — shared across all slug requests
let vendorDetailConfigCache = null;
let vendorDetailConfigCacheTimestamp = null;
const VENDOR_DETAIL_CONFIG_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes


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
 * Check if a value is "Yes" or true (for boolean fields).
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
 * Parse a comma or newline separated string into an array.
 */
function parseDelimitedList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw !== 'string') return [];
  return raw
    .replace(/\r?\n/g, ',')
    .split(',')
    .map(function(s) { return s.trim(); })
    .filter(function(s) { return s && s !== '-'; });
}


// ============================================================
// FETCH VENDOR DETAIL CONFIG
//
// Reads the Vendor Detail Config table and returns a Map of:
//   fieldName → { displayName, section, sectionOrder, fieldOrder, renderMode, nexaGated }
//
// Only includes records where "Show on Page" is checked.
// Cached for 30 minutes.
// ============================================================
async function fetchVendorDetailConfig(apiKey, bypassCache) {
  var now = Date.now();

  if (
    !bypassCache &&
    vendorDetailConfigCache &&
    vendorDetailConfigCacheTimestamp &&
    (now - vendorDetailConfigCacheTimestamp) < VENDOR_DETAIL_CONFIG_CACHE_DURATION
  ) {
    return vendorDetailConfigCache;
  }

  // Confirm config table ID has been set
  if (false) { // Config table ID is set — this guard no longer needed
    console.warn('⚠️ Vendor Detail Config table ID not set yet! Returning empty config.');
    return new Map();
  }

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

  var data = await airtableRequest(TABLES.VENDOR_DETAIL_CONFIG, params, apiKey);

  if (!data.records) {
    console.error('fetchVendorDetailConfig: no records returned');
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

  console.log('✅ Loaded Vendor Detail config: ' + config.size + ' fields');
  vendorDetailConfigCache = config;
  vendorDetailConfigCacheTimestamp = now;
  return config;
}


// ============================================================
// GET /api/vendors
//
// Returns all vendors for the directory grid page.
// Maintains backward compatibility with Vendors Main v4.0.
// ============================================================
async function getVendors(apiKey, request) {
  try {
    var now = Date.now();
    var bypassCache = new URL(request.url).searchParams.get('refresh') === 'true';

    // --- Check cache ---
    if (
      !bypassCache &&
      vendorListCache &&
      vendorListCacheTimestamp &&
      (now - vendorListCacheTimestamp < VENDOR_LIST_CACHE_DURATION)
    ) {
      console.log('✅ Vendors: Returning cached data (' + vendorListCache.length + ' vendors)');
      return jsonResponse({
        success: true,
        cached: true,
        count: vendorListCache.length,
        vendors: vendorListCache
      }, 200, request);
    }

    console.log('🔄 Vendors: Fetching from Airtable...');

    var allVendors = [];
    var offset = null;

    // Fields needed for directory grid cards
    var listFields = [
      'Vendor Name',
      'Webflow Slug',
      'Airtable Record ID',
      'Logo',
      'Corporate Website (Final)',
      'Login Portal',
      'Vendor Category (Rollup)',
      'Sync to Webflow'
    ];

    do {
      var urlStr = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID + '/' + TABLES.VENDORS + '?';
      listFields.forEach(function(field, i) {
        urlStr += (i > 0 ? '&' : '') + 'fields%5B%5D=' + encodeURIComponent(field);
      });
      urlStr += '&filterByFormula=' + encodeURIComponent('{Sync to Webflow}=TRUE()');
      urlStr += '&sort%5B0%5D%5Bfield%5D=Vendor+Name&sort%5B0%5D%5Bdirection%5D=asc';
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

        var categoryRaw = f['Vendor Category (Rollup)'] || '';
        if (Array.isArray(categoryRaw)) categoryRaw = categoryRaw.join(', ');
        var categories = parseDelimitedList(categoryRaw);

        allVendors.push({
          id:          f['Airtable Record ID'] || record.id,
          name:        f['Vendor Name'] || '',
          slug:        f['Webflow Slug'] || '',
          logo:        getAttachmentUrl(f['Logo']),
          website:     f['Corporate Website (Final)'] || '',
          loginPortal: f['Login Portal'] || '',
          categories:  categories,
          categoryRaw: categoryRaw
        });
      }

      offset = data.offset || null;
    } while (offset);

    vendorListCache = allVendors;
    vendorListCacheTimestamp = now;

    console.log('✅ Vendors: Fetched ' + allVendors.length + ' vendors');

    return jsonResponse({
      success: true,
      cached: false,
      count: allVendors.length,
      vendors: allVendors
    }, 200, request);

  } catch (error) {
    console.error('getVendors error:', error);
    return jsonResponse({ success: false, error: error.message }, 500, request);
  }
}


// ============================================================
// GET /api/vendors/clear-cache
// ============================================================
async function clearVendorCache(request) {
  vendorListCache = null;
  vendorListCacheTimestamp = null;
  vendorDetailCache.clear();
  vendorDetailConfigCache = null;
  vendorDetailConfigCacheTimestamp = null;
  console.log('🗑️ All vendor caches cleared');
  return jsonResponse({
    success: true,
    message: 'Vendor list, detail, and config caches cleared'
  }, 200, request);
}


// ============================================================
// GET /api/vendors/:slug
//
// Returns full vendor details including:
//   - Core identity (name, logo, description, categories, NEXA status)
//   - Config-driven sections[] (Links, Pricing, Contact, Social, Docs, NEXA, Notes)
//   - accountReps[] — from Contacts table
//   - otherContacts[] — from Other Contacts table
//   - categories[] — from Vendor Categories table (with descriptions)
// ============================================================
async function getVendorBySlug(slug, apiKey, request) {
  try {
    var now = Date.now();
    var bypassCache = new URL(request.url).searchParams.get('refresh') === 'true';

    // --- Check per-slug cache ---
    var cached = vendorDetailCache.get(slug);
    if (!bypassCache && cached && (now - cached.timestamp < VENDOR_DETAIL_CACHE_DURATION)) {
      console.log('✅ Vendor Detail: Returning cached data for "' + slug + '"');
      return jsonResponse({ success: true, cached: true, vendor: cached.data }, 200, request);
    }

    console.log('🔄 Vendor Detail: Fetching "' + slug + '" from Airtable...');

    // --- Fetch config and vendor record in parallel ---
    var filterFormula = encodeURIComponent('{Webflow Slug}=\'' + slug + '\'');
    var vendorParams = 'filterByFormula=' + filterFormula + '&maxRecords=1';

    var [fieldConfig, vendorData] = await Promise.all([
      fetchVendorDetailConfig(apiKey, bypassCache),
      airtableRequest(TABLES.VENDORS, vendorParams, apiKey)
    ]);

    if (!vendorData.records || vendorData.records.length === 0) {
      return jsonResponse({ success: false, error: 'Vendor not found: ' + slug }, 404, request);
    }

    var record = vendorData.records[0];
    var f = record.fields;

    // --------------------------------------------------------
    // Build config-driven sections
    // Same pattern as getLenderBySlug in mtg-broker-lenders
    // --------------------------------------------------------
    var sectionsMap = new Map();

    for (var [fieldName, meta] of fieldConfig.entries()) {
      var rawValue = f[fieldName];

      // Skip undefined/null values
      if (rawValue === undefined || rawValue === null) continue;

      // Skip AI state objects
      if (typeof rawValue === 'object' && !Array.isArray(rawValue) && 'state' in rawValue) continue;

      // Skip linked-record ID arrays (recXXX strings)
      if (
        Array.isArray(rawValue) &&
        rawValue.length > 0 &&
        typeof rawValue[0] === 'string' &&
        rawValue[0].startsWith('rec')
      ) continue;

      // Skip empty strings, single dash, and double dash (Airtable "--" = no data)
      if (typeof rawValue === 'string' && (!rawValue.trim() || rawValue.trim() === '-' || rawValue.trim() === '--')) continue;

      // Skip false on non-boolean fields
      if (rawValue === false && meta.renderMode !== 'boolean') continue;

      // Normalize attachments
      var value = rawValue;
      if (meta.renderMode === 'attachment') {
        var normalized = normalizeAttachments(rawValue);
        if (!normalized) continue;
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

    // Sort sections by order, then fields within sections
    var sections = Array.from(sectionsMap.values()).sort(function(a, b) {
      return a.order - b.order;
    });
    sections.forEach(function(section) {
      section.fields.sort(function(a, b) { return a.fieldOrder - b.fieldOrder; });
    });

    // --------------------------------------------------------
    // Parse category rollup for display
    // --------------------------------------------------------
    var categoryRaw = f['Vendor Category (Rollup)'] || '';
    if (Array.isArray(categoryRaw)) categoryRaw = categoryRaw.join(', ');
    var categoryNames = parseDelimitedList(categoryRaw);

    // --------------------------------------------------------
    // Build base vendor object
    // --------------------------------------------------------
    var vendor = {
      id:           f['Airtable Record ID'] || record.id,
      name:         f['Vendor Name'] || '',
      slug:         f['Webflow Slug'] || '',
      logo:         getAttachmentUrl(f['Logo']),
      description:  f['Vendor Description (Final)'] || '',
      airtableLink: f['Link to this Airtable VENDOR (Formula)'] || '',
      categoryNames: categoryNames,
      nexaApproved: f['NEXA Approved'] === true || isYesOrTrue(f['NEXA Approved']),
      sections:     sections,
      accountReps:  [],
      otherContacts: [],
      categories:   []   // Full category objects with descriptions
    };

    // --------------------------------------------------------
    // Fetch Account Reps, Other Contacts, and Categories in parallel
    // Categories: use bulk lookup by name (from rollup) — avoids linked-record ID fetch issues
    // --------------------------------------------------------
    var repIds          = f['Account Rep'] || [];
    var otherContactIds = f['Other Contacts'] || [];

    var fetchReps = (repIds.length > 0)
      ? Promise.all(repIds.map(function(id) { return fetchContactRecord(id, apiKey); }))
      : Promise.resolve([]);

    var fetchOther = (otherContactIds.length > 0)
      ? Promise.all(otherContactIds.map(function(id) { return fetchOtherContactRecord(id, apiKey); }))
      : Promise.resolve([]);

    // Fetch category descriptions by name using the rollup names we already have
    var fetchCats = (vendor.categoryNames && vendor.categoryNames.length > 0)
      ? fetchVendorCategoriesByName(vendor.categoryNames, apiKey)
      : Promise.resolve([]);

    var [repResults, otherResults, catResults] = await Promise.all([
      fetchReps,
      fetchOther,
      fetchCats
    ]);

    vendor.accountReps = repResults.filter(Boolean).sort(function(a, b) {
      return (a.name || '').localeCompare(b.name || '');
    });
    vendor.otherContacts = otherResults.filter(Boolean);
    vendor.categories = catResults.filter(Boolean);

    // --- Cache and return ---
    vendorDetailCache.set(slug, { data: vendor, timestamp: now });

    console.log(
      '✅ Vendor Detail: "' + vendor.name + '" — ' +
      sections.length + ' sections, ' +
      vendor.accountReps.length + ' reps, ' +
      vendor.otherContacts.length + ' other contacts, ' +
      vendor.categories.length + ' categories'
    );

    return jsonResponse({ success: true, cached: false, vendor: vendor }, 200, request);

  } catch (error) {
    console.error('getVendorBySlug error:', error);
    return jsonResponse({ success: false, error: error.message }, 500, request);
  }
}


// ============================================================
// HELPER: Fetch a single Contact record (Account Rep)
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
// HELPER: Fetch a single Other Contact record
// ============================================================
async function fetchOtherContactRecord(recordId, apiKey) {
  try {
    var url = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID + '/' + TABLES.OTHER_CONTACTS + '/' + recordId +
      '?fields%5B%5D=' + encodeURIComponent('Name') +
      '&fields%5B%5D=' + encodeURIComponent('Department or Title') +
      '&fields%5B%5D=' + encodeURIComponent('Department or Title (Choice)') +
      '&fields%5B%5D=' + encodeURIComponent('Company') +
      '&fields%5B%5D=' + encodeURIComponent('Email') +
      '&fields%5B%5D=' + encodeURIComponent('Phone Number');

    var resp = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' }
    });
    if (!resp.ok) {
      console.warn('⚠️ Could not fetch other contact ' + recordId + ': ' + resp.status);
      return null;
    }
    var data = await resp.json();
    var f = data.fields;
    return {
      id:      data.id,
      name:    f['Name'] || '',
      title:   f['Department or Title (Choice)'] || f['Department or Title'] || '',
      company: f['Company'] || '',
      email:   f['Email'] || '',
      phone:   f['Phone Number'] || ''
    };
  } catch (err) {
    console.warn('⚠️ Error fetching other contact ' + recordId + ':', err.message);
    return null;
  }
}


// ============================================================
// HELPER: Fetch Vendor Categories by name (bulk lookup)
// Uses filter formula instead of linked record IDs — more reliable
// ============================================================
async function fetchVendorCategoriesByName(names, apiKey) {
  try {
    if (!names || names.length === 0) return [];

    // Build OR filter: OR({Category Name}='Processing', {Category Name}='Credit')
    var orParts = names.map(function(n) {
      return "{Category Name}='" + n + "'";
    });
    var formula = names.length === 1 ? orParts[0] : 'OR(' + orParts.join(',') + ')';

    var url = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID + '/' + TABLES.VENDOR_CATEGORIES +
      '?filterByFormula=' + encodeURIComponent(formula) +
      '&fields%5B%5D=' + encodeURIComponent('Category Name') +
      '&fields%5B%5D=' + encodeURIComponent('Description (Final)') +
      '&fields%5B%5D=' + encodeURIComponent('Webflow Slug');

    var resp = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' }
    });
    if (!resp.ok) {
      console.warn('⚠️ Could not fetch categories: ' + resp.status);
      return [];
    }
    var data = await resp.json();
    return (data.records || []).map(function(rec) {
      return {
        id:          rec.id,
        name:        rec.fields['Category Name'] || '',
        description: rec.fields['Description (Final)'] || '',
        slug:        rec.fields['Webflow Slug'] || ''
      };
    });
  } catch (err) {
    console.warn('⚠️ Error fetching categories:', err.message);
    return [];
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

    // ---- SERVE VENDOR DETAIL PAGE JS ----
    if (path === '/vendor-detail.js') {
      return new Response(VENDOR_DETAIL_JS, {
        headers: {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'public, max-age=300', // 5 minutes
          ...getCorsHeaders(request),
          'X-Version': '1.0'
        }
      });
    }

    // ---- HEALTH CHECK ----
    if (path === '/health' || path === '/') {
      return jsonResponse({
        status: 'ok',
        worker: 'mtg-broker-vendors',
        version: '1.0',
        timestamp: new Date().toISOString(),
        configTableSet: true, // tblMmnKM3pY0eR37D
        endpoints: [
          'GET  /api/vendors              — All vendors for directory grid',
          'GET  /api/vendors/clear-cache  — Clear all caches',
          'GET  /api/vendors/:slug        — Single vendor detail',
          'GET  /vendor-detail.js         — Vendor detail page JS (v1.7)',
          'GET  /health                   — This health check'
        ]
      }, 200, request);
    }

    // ---- ALL VENDORS (directory grid) ----
    if (path === '/api/vendors' && method === 'GET') {
      return await getVendors(apiKey, request);
    }

    // ---- CLEAR CACHE ----
    if (path === '/api/vendors/clear-cache' && method === 'GET') {
      return await clearVendorCache(request);
    }

    // ---- ROUTES WITH :slug ----
    if (path.startsWith('/api/vendors/')) {
      var rest  = path.slice('/api/vendors/'.length);
      var slug  = rest.split('/')[0];

      // Validate slug
      if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
        return jsonResponse({ error: 'Invalid slug' }, 400, request);
      }

      // ---- SINGLE VENDOR DETAIL ----
      if (method === 'GET') {
        return await getVendorBySlug(slug, apiKey, request);
      }
    }

    // ---- 404 ----
    return jsonResponse({ error: 'Not found' }, 404, request);
  }
};


// ============================================================
// VENDOR DETAIL PAGE JS  v1.1
// Served at: GET /vendor-detail.js
//
// Usage in Webflow Before </body> embed:
//   <script src="https://mtg-broker-vendors.rich-e00.workers.dev/vendor-detail.js?v=1.1"></script>
//
// This script:
//   1. Reads the slug from the URL path
//   2. Fetches vendor data from /api/vendors/:slug
//   3. Builds the full page: breadcrumb, header, config sections,
//      account reps, other contacts, vendor categories
//   4. Handles NEXA gating — hides NEXA sections unless user is NEXA
// ============================================================
const VENDOR_DETAIL_JS = String.raw`
(function () {
  'use strict';

  var VENDORS_API = 'https://mtg-broker-vendors.rich-e00.workers.dev';

  // ---- Section header colors — v1.7 ----
  //   All standard sections use brand blue (#2563EB) for a clean, consistent look.
  //   Any section whose name contains "NEXA" (case-insensitive) uses dark navy (#1E3A5F).
  //   Matches the exact same approach used in mtg-broker-lenders v2.13.
  var SECTION_COLOR_BRAND_BLUE = '#2563EB';  // applied to all standard sections
  var SECTION_COLOR_NEXA       = '#1E3A5F';  // dark navy — NEXA sections only

  function getSectionColor(name, idx) {
    if (name && name.toUpperCase().indexOf('NEXA') !== -1) {
      return SECTION_COLOR_NEXA;
    }
    return SECTION_COLOR_BRAND_BLUE;
  }

  // ---- Social icon/color map ----
  var SOCIAL_CONFIG = {
    'Facebook':    { icon: 'fa-brands fa-facebook',  color: '#1877F2', label: 'Facebook'  },
    'Instagram':   { icon: 'fa-brands fa-instagram', color: '#E1306C', label: 'Instagram' },
    'X (Twitter)': { icon: null,                       color: '#000000', label: 'X'         },
    'LinkedIn':    { icon: 'fa-brands fa-linkedin',  color: '#0A66C2', label: 'LinkedIn'  },
    'YouTube':     { icon: 'fa-brands fa-youtube',   color: '#FF0000', label: 'YouTube'   },
    'TikTok':      { icon: 'fa-brands fa-tiktok',    color: '#000000', label: 'TikTok'    }
  };

  // ---- Link icon map ----
  var LINK_ICON_CONFIG = {
    'Website':               'fa-solid fa-globe',
    'Login / Portal':        'fa-solid fa-arrow-right-to-bracket',
    'Support Site':          'fa-solid fa-headset',
    'Pricing Page':          'fa-solid fa-tag',
    'Tutorials & Training':  'fa-solid fa-circle-play',
    'LOS Link':              'fa-solid fa-link',
    'Affiliate Portal':      'fa-solid fa-handshake',
    'Referral Link':         'fa-solid fa-share-nodes',
    'NEXA Files Folder':     'fa-brands fa-google-drive'
  };

  // ============================================================
  // ADMIN DETECTION (v1.7)
  // Same pattern as Loan Search v7.5 and Lender Detail v5.10.
  // Reads JWT email from localStorage, checks against admin list.
  // ============================================================
  var ADMIN_EMAILS = ['rich@prestonlending.com'];
  var _isAdmin = false;
  (function detectAdmin() {
    try {
      var token = localStorage.getItem('Outseta.nocode.accessToken');
      if (!token) return;
      var parts = token.split('.');
      if (parts.length < 2) return;
      var payload = JSON.parse(atob(parts[1]));
      var email = (payload.email || payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || '').toLowerCase().trim();
      if (email && ADMIN_EMAILS.indexOf(email) !== -1) _isAdmin = true;
    } catch (e) { /* silently fail */ }
  })();

  // ============================================================
  // ENTRY POINT
  // ============================================================
  document.addEventListener('DOMContentLoaded', function () {
    var slug = getSlugFromUrl();
    if (!slug) { showError('Could not determine which vendor to load.'); return; }

    console.log('Vendor Detail v1.8: Loading slug "' + slug + '"');
    showLoadingSkeleton();

    fetch(VENDORS_API + '/api/vendors/' + encodeURIComponent(slug))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.success || !data.vendor) {
          showError(
            data.error === 'Vendor not found: ' + slug
              ? 'This vendor could not be found.'
              : 'Could not load vendor data. Please refresh and try again.'
          );
          return;
        }
        var vendor = data.vendor;
        console.log('Vendor Detail v1.8: Loaded "' + vendor.name + '"' + (data.cached ? ' [cached]' : ''));
        buildPage(vendor);
      })
      .catch(function (err) {
        console.error('Vendor Detail v1.8: API error', err);
        showError('Could not load vendor data. Please refresh and try again.');
      });
  });

  function getSlugFromUrl() {
    var parts = window.location.pathname.replace(/\/$/, '').split('/');
    return parts[parts.length - 1] || '';
  }

  // ============================================================
  // LOADING SKELETON
  // ============================================================
  function showLoadingSkeleton() {
    var header  = document.querySelector('.vendor-detail-header');
    var content = document.querySelector('.vendor-detail-content');

    if (header) {
      header.innerHTML =
        '<div class="vd-skeleton-wrap">' +
          '<div class="vd-skeleton-logo"></div>' +
          '<div class="vd-skeleton-info">' +
            '<div class="vd-skeleton-line" style="width:60%;height:12px;margin-bottom:8px;"></div>' +
            '<div class="vd-skeleton-line" style="width:40%;height:20px;"></div>' +
          '</div>' +
        '</div>';
    }

    if (content) {
      content.innerHTML =
        '<div class="vd-skeleton-section"></div>' +
        '<div class="vd-skeleton-section" style="margin-top:12px;"></div>';
    }
  }

  function showError(msg) {
    var header  = document.querySelector('.vendor-detail-header');
    var content = document.querySelector('.vendor-detail-content');
    if (header) header.innerHTML = '';
    if (content) {
      content.innerHTML =
        '<div class="vd-error">' +
          '<i class="fa-solid fa-triangle-exclamation"></i>' +
          '<p>' + escapeHtml(msg) + '</p>' +
          '<a href="/app/vendors" class="vd-back-link">← Back to Vendors</a>' +
        '</div>';
    }
  }

  // ============================================================
  // BUILD PAGE
  // ============================================================
  function buildPage(vendor) {
    buildBreadcrumb(vendor);
    buildHeader(vendor);
    buildContent(vendor);
    checkNexaAndRevealGated(vendor);
  }

  // ============================================================
  // BREADCRUMB
  // ============================================================
  function buildBreadcrumb(vendor) {
    var el = document.querySelector('.vendor-detail-breadcrumb');
    if (!el) return;
    el.innerHTML =
      '<nav class="breadcrumb-nav" aria-label="breadcrumb">' +
        '<a href="/app/vendors" class="breadcrumb-link-item">' +
          '<i class="fa-solid fa-chevron-left"></i> Vendors' +
        '</a>' +
        '<span class="breadcrumb-separator">/</span>' +
        '<span class="breadcrumb-current">' + escapeHtml(vendor.name) + '</span>' +
      '</nav>';
  }

  // ============================================================
  // HEADER
  // Dark navy bar: logo + "VENDOR" label + name + NEXA badge +
  // favorites heart + Copy Link + Share  (matches lender page exactly)
  // ============================================================
  function buildHeader(vendor) {
    var el = document.querySelector('.vendor-detail-header');
    if (!el) return;

    // Logo — exact same pattern as lender ld-logo
    var logoHtml;
    if (vendor.logo) {
      logoHtml =
        '<div class="vd-logo">' +
          '<img src="' + escapeAttr(vendor.logo) + '" alt="' + escapeAttr(vendor.name) + '" ' +
            'onerror="this.style.display=\'none\';this.parentNode.textContent=\'' + escapeAttr(vendor.name.charAt(0)) + '\';">' +
        '</div>';
    } else {
      logoHtml = '<div class="vd-logo">' + escapeHtml(vendor.name.charAt(0)) + '</div>';
    }

    // Favorites button — state loaded async after render
    var favBtn =
      '<button class="vd-fav-btn" id="vd-fav-btn" title="Add to favorites">' +
        '<i class="fa-regular fa-heart"></i>' +
      '</button>';

    // Action buttons — icon + text, matching lender ld-action-btn
    var actionsHtml =
      '<div class="vd-header-actions">' +
        favBtn +
        '<button class="vd-action-btn" id="vd-copy-url-btn" title="Copy link">' +
          '<i class="fa-solid fa-link" style="margin-right:6px;"></i>Copy Link' +
        '</button>' +
        '<button class="vd-action-btn" id="vd-share-btn" title="Share">' +
          '<i class="fa-solid fa-share-nodes" style="margin-right:6px;"></i>Share' +
        '</button>' +
        (_isAdmin && vendor.airtableLink
          ? '<a class="vd-admin-airtable-btn" id="vd-admin-airtable-btn" ' +
              'href="' + escapeAttr(vendor.airtableLink) + '" ' +
              'target="_blank" rel="noopener" title="Edit in Airtable (Admin)">' +
              '<i class="fa-solid fa-table" style="margin-right:6px;"></i>Airtable' +
            '</a>'
          : '') +
      '</div>';

    el.innerHTML =
      '<div class="vd-header">' +
        logoHtml +
        '<div class="vd-header-info">' +
          '<h1 class="vd-name">' + escapeHtml(vendor.name) + '</h1>' +
        '</div>' +
        actionsHtml +
      '</div>';

    attachShareHandlers(vendor.name);
    initFavoriteVendorButton(vendor);
  }

  function attachShareHandlers(vendorName) {
    var copyBtn = document.getElementById('vd-copy-url-btn');
    var shareBtn = document.getElementById('vd-share-btn');
    var currentUrl = window.location.href;

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        navigator.clipboard.writeText(currentUrl).then(function () {
          copyBtn.innerHTML = '<i class="fa-solid fa-check" style="margin-right:6px;"></i>Copied!';
          copyBtn.classList.add('copied');
          setTimeout(function () {
            copyBtn.innerHTML = '<i class="fa-solid fa-link" style="margin-right:6px;"></i>Copy Link';
            copyBtn.classList.remove('copied');
          }, 2000);
        }).catch(function () {});
      });
    }

    if (shareBtn) {
      shareBtn.addEventListener('click', function () {
        if (navigator.share) {
          navigator.share({ title: vendorName || document.title, url: currentUrl }).catch(function () {});
        } else {
          if (copyBtn) copyBtn.click();
        }
      });
    }
  }

  // ============================================================
  // FAVORITES BUTTON — mirrors lender page exactly
  // Uses itemType: 'Vendor' so favorites are tracked separately
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

  function initFavoriteVendorButton(vendor) {
    var btn = document.getElementById('vd-fav-btn');
    if (!btn) return;

    var email = getUserEmailFromJWT();
    if (!email) { btn.style.display = 'none'; return; }

    var vendorId   = vendor.id;
    var vendorName = vendor.name;
    var favRecordId = null;

    // Load current state
    fetch(FAVORITES_API + '/api/favorites?type=Vendor', {
      headers: { 'Authorization': 'Bearer ' + email }
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.favorites && Array.isArray(data.favorites)) {
        data.favorites.forEach(function(fav) {
          if (fav.itemId === vendorId) { favRecordId = fav.id; }
        });
      }
      setVendorFavUI(btn, !!favRecordId);
    })
    .catch(function() {});

    // Toggle on click
    btn.addEventListener('click', function() {
      var isCurrent = btn.classList.contains('fav-active');
      setVendorFavUI(btn, !isCurrent);

      if (isCurrent) {
        if (!favRecordId) { setVendorFavUI(btn, true); return; }
        fetch(FAVORITES_API + '/api/favorites/' + favRecordId, {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer ' + email }
        })
        .then(function(res) {
          if (res.ok) { favRecordId = null; }
          else { setVendorFavUI(btn, true); }
        })
        .catch(function() { setVendorFavUI(btn, true); });
      } else {
        fetch(FAVORITES_API + '/api/favorites', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + email, 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemType: 'Vendor', itemId: vendorId, itemName: vendorName })
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (data.favorite) { favRecordId = data.favorite.id; }
          else if (data.error && data.error.indexOf('409') !== -1) { /* already exists */ }
          else { setVendorFavUI(btn, false); }
        })
        .catch(function() { setVendorFavUI(btn, false); });
      }
    });
  }

  function setVendorFavUI(btn, active) {
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
  // CONTENT — tab bar + three panels
  // ============================================================
  function buildContent(vendor) {
    var el = document.querySelector('.vendor-detail-content');
    if (!el) return;

    var hasCats = vendor.categoryNames && vendor.categoryNames.length > 0;
    var hasContacts = (vendor.accountReps && vendor.accountReps.length > 0) ||
                     (vendor.otherContacts && vendor.otherContacts.length > 0);

    // --- TAB BAR ---
    var tabBarHtml =
      '<div class="vd-tabs">' +
        '<button class="vd-tab active" data-panel="details">Details</button>';

    if (hasCats) {
      tabBarHtml += '<button class="vd-tab" data-panel="categories">Categories</button>';
    }
    if (hasContacts) {
      tabBarHtml += '<button class="vd-tab" data-panel="contacts">Contacts</button>';
    }
    tabBarHtml += '</div>';

    // --- DETAILS PANEL ---
    var detailsHtml = '<div class="vd-panel active" data-panel="details">';

    // About / description (full width)
    if (vendor.description && vendor.description.trim()) {
      detailsHtml +=
        '<div class="vd-section-card vd-full-width">' +
          buildVdSectionHeader('ABOUT', '#2563EB') +
          '<div class="vd-section-body">' +
            '<p class="vd-description">' + escapeHtml(vendor.description) + '</p>' +
          '</div>' +
        '</div>';
    }

    // Config-driven sections — all in one 2-column grid, ordered by Airtable Section Order.
    // NEXA section is positioned by its Section Order value (1.5), placing it right
    // next to Links in the first row. No special split needed here.
    if (vendor.sections && vendor.sections.length > 0) {
      var visibleSections = vendor.sections.filter(function (s) {
        return s.fields.some(function (f) { return f.value !== null && f.value !== undefined && f.value !== ''; });
      });
      if (visibleSections.length > 0) {
        detailsHtml += '<div class="vd-section-grid">';
        visibleSections.forEach(function (section, idx) {
          detailsHtml += buildConfigSection(section, idx);
        });
        detailsHtml += '</div>';
      }
    }

    detailsHtml += '</div>';

    // --- CATEGORIES PANEL ---
    var catsHtml = '';
    if (hasCats) {
      catsHtml = '<div class="vd-panel" data-panel="categories">';
      catsHtml += '<div class="vd-cats-grid">';
      vendor.categoryNames.forEach(function (cat) {
        var catObj = vendor.categories && vendor.categories.find(function (c) { return c.name === cat; });
        var desc = catObj && catObj.description ? catObj.description : '';
        // Clickable card — click opens modal if description exists
        var clickable = desc ? ' vd-cat-clickable' : '';
        var hint = desc
          ? '<div class="vd-cat-hint"><i class="fa-solid fa-circle-info"></i></div>'
          : '';
        catsHtml +=
          '<div class="vd-cat-card' + clickable + '" data-cat-name="' + escapeAttr(cat) + '" data-cat-desc="' + escapeAttr(desc) + '">' +
            '<div class="vd-cat-icon-wrap"><i class="fa-solid fa-tag"></i></div>' +
            '<div class="vd-cat-body">' +
              '<div class="vd-cat-name">' + escapeHtml(cat) + '</div>' +
              (desc ? '<div class="vd-cat-preview">' + escapeHtml(desc.length > 60 ? desc.substring(0, 60) + '…' : desc) + '</div>' : '') +
            '</div>' +
            hint +
          '</div>';
      });
      catsHtml += '</div></div>';
    }

    // --- CONTACTS PANEL ---
    var contactsHtml = '';
    if (hasContacts) {
      contactsHtml = '<div class="vd-panel" data-panel="contacts">';
      if (vendor.accountReps && vendor.accountReps.length > 0) {
        contactsHtml += buildContactsSection('Account Representatives', '#2563EB', vendor.accountReps, 'rep');
      }
      if (vendor.otherContacts && vendor.otherContacts.length > 0) {
        contactsHtml += buildContactsSection('Other Contacts', '#14B8A6', vendor.otherContacts, 'other');
      }
      contactsHtml += '</div>';
    }

    el.innerHTML = tabBarHtml + detailsHtml + catsHtml + contactsHtml;

    // Attach tab switching
    attachTabHandlers(el);

    // Attach category click handlers
    attachCategoryCardHandlers(el);

    // Attach modal handlers for contact cards
    attachRepClickHandlers(vendor);
    attachOtherContactClickHandlers(vendor);
  }

  function attachCategoryCardHandlers(container) {
    container.querySelectorAll('.vd-cat-clickable').forEach(function (card) {
      card.addEventListener('click', function () {
        var name = card.getAttribute('data-cat-name');
        var desc = card.getAttribute('data-cat-desc');
        if (name && desc) openCategoryModal(name, desc);
      });
    });
  }

  function openCategoryModal(name, description) {
    var existing = document.getElementById('vd-cat-modal');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'vd-cat-modal';
    overlay.className = 'vd-modal-overlay';
    overlay.innerHTML =
      '<div class="vd-modal-box">' +
        '<button class="vd-modal-close" id="vd-cat-modal-close"><i class="fa-solid fa-xmark"></i></button>' +
        '<div class="vd-cat-modal-header">' +
          '<div class="vd-cat-modal-icon"><i class="fa-solid fa-tag"></i></div>' +
          '<div class="vd-cat-modal-name">' + escapeHtml(name) + '</div>' +
        '</div>' +
        '<div class="vd-cat-modal-body">' +
          '<p class="vd-cat-modal-desc">' + escapeHtml(description) + '</p>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add('open'); });

    document.getElementById('vd-cat-modal-close').addEventListener('click', function () {
      overlay.classList.remove('open');
      setTimeout(function () { overlay.remove(); }, 200);
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        overlay.classList.remove('open');
        setTimeout(function () { overlay.remove(); }, 200);
      }
    });
  }

  function attachTabHandlers(container) {
    var tabs = container.querySelectorAll('.vd-tab');
    var panels = container.querySelectorAll('.vd-panel');

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = tab.getAttribute('data-panel');

        tabs.forEach(function (t) { t.classList.remove('active'); });
        panels.forEach(function (p) { p.classList.remove('active'); });

        tab.classList.add('active');
        var panel = container.querySelector('.vd-panel[data-panel="' + target + '"]');
        if (panel) panel.classList.add('active');
      });
    });
  }

  // ============================================================
  // BUILD A CONFIG-DRIVEN SECTION (card for 2-col grid)
  // ============================================================
  // ============================================================
  // SECTION HEADER BUILDER
  // NEXA sections → solid dark navy (#1E3A5F) with white text,
  //   matching the lender detail page exactly.
  // Standard sections → light color tint via CSS variable.
  // ============================================================
  function buildVdSectionHeader(title, color) {
    var isNexa = (color === '#1E3A5F');
    if (isNexa) {
      // Solid dark navy — same style as lender page NEXA sections
      return (
        '<div class="vd-section-header vd-section-header-nexa">' +
          '<span class="vd-section-bar" style="background:rgba(255,255,255,0.5);"></span>' +
          '<span class="vd-section-title" style="color:#FFFFFF;letter-spacing:0.06em;">' + escapeHtml(title.toUpperCase()) + '</span>' +
        '</div>'
      );
    }
    // Standard: tinted background via CSS variable (handled by CSS color-mix)
    return (
      '<div class="vd-section-header" style="--section-color:' + color + ';">' +
        '<span class="vd-section-bar" style="background:' + color + ';"></span>' +
        '<span class="vd-section-title" style="color:' + color + ';">' + escapeHtml(title.toUpperCase()) + '</span>' +
      '</div>'
    );
  }

  function buildConfigSection(section, colorIdx) {
    var visibleFields = section.fields.filter(function (f) {
      return f.value !== null && f.value !== undefined && f.value !== '';
    });
    if (visibleFields.length === 0) return '';

    var color = getSectionColor(section.name, colorIdx);
    // NEXA sections are always full-width (rendered outside the 2-col grid)
    var nexaClass = section.hasNexa ? ' nexa-gated-section' : '';

    var bodyHtml;
    if (section.name === 'Links') {
      // Use standard field-list layout — each link is an inline vd-link-btn
      bodyHtml = '<div class="vd-field-list">';
      visibleFields.forEach(function (field) { bodyHtml += renderLinkCard(field); });
      bodyHtml += '</div>';
    } else if (section.name === 'Social Media') {
      bodyHtml = '<div class="vd-social-row">';
      visibleFields.forEach(function (field) { bodyHtml += renderSocialButton(field); });
      bodyHtml += '</div>';
    } else if (section.name === 'Documents' || visibleFields.some(function (f) { return f.renderMode === 'attachment'; })) {
      bodyHtml = '<div class="vd-attachment-list">';
      visibleFields.forEach(function (field) { bodyHtml += renderField(field, section.name); });
      bodyHtml += '</div>';
    } else {
      bodyHtml = '<div class="vd-field-list">';
      visibleFields.forEach(function (field) { bodyHtml += renderField(field, section.name); });
      bodyHtml += '</div>';
    }

    return (
      '<div class="vd-section-card' + nexaClass + '" data-section="' + escapeAttr(section.name) + '">' +
        buildVdSectionHeader(section.name, color) +
        '<div class="vd-section-body">' + bodyHtml + '</div>' +
      '</div>'
    );
  }

  // ============================================================
  // RENDER A SINGLE FIELD (by render mode)
  // ============================================================
  function renderField(field, sectionName) {
    if (!field.value && field.value !== false) return '';

    switch (field.renderMode) {
      case 'link':        return renderLinkCard(field);
      case 'copyable':    return renderCopyableField(field);
      case 'boolean':     return renderBooleanField(field);
      case 'social':      return renderSocialButton(field);
      case 'attachment':  return renderAttachmentField(field);
      case 'richtext':    return renderRichTextField(field);
      case 'notes':       return renderNotesField(field);
      default:            return renderTextField(field, sectionName);
    }
  }

  function renderTextField(field, sectionName) {
    var displayVal = String(field.value);
    // Auto-format numeric values in the Pricing section as currency ($X,XXX)
    if (sectionName === 'Pricing') {
      var num = parseFloat(displayVal);
      if (!isNaN(num) && String(num) === displayVal.trim()) {
        displayVal = '$' + num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      }
    }
    return (
      '<div class="vd-field-row">' +
        '<span class="vd-field-label">' + escapeHtml(field.displayName) + '</span>' +
        '<span class="vd-field-value">' + escapeHtml(displayVal) + '</span>' +
      '</div>'
    );
  }

  function renderRichTextField(field) {
    var text = String(field.value || '').trim();
    if (!text) return '';
    // 'richtext' fields contain Markdown-formatted text from Airtable.
    // Run through parseMarkdown() so **bold**, _italic_, etc. render correctly.
    // Uses the same vd-notes-box callout style as the 'notes' render mode.
    return (
      '<div style="padding:10px 16px;">' +
        '<div class="vd-notes-box">' +
          '<p style="font-size:10px;font-weight:700;letter-spacing:0.08em;color:var(--vd-dim);text-transform:uppercase;margin:0 0 8px 0;">' +
            escapeHtml(field.displayName) +
          '</p>' +
          '<div class="vd-notes-content">' + parseMarkdown(text) + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  // ============================================================
  // NOTES FIELD — styled callout box with label + markdown body
  // Matches the lender detail page notes style exactly.
  // ============================================================
  function renderNotesField(field) {
    var noteText = String(field.value || '').trim();
    if (!noteText) return '';
    return (
      '<div style="padding:10px 16px;">' +
        '<div class="vd-notes-box">' +
          '<p style="font-size:10px;font-weight:700;letter-spacing:0.08em;color:var(--vd-dim);text-transform:uppercase;margin:0 0 8px 0;">' +
            escapeHtml(field.displayName) +
          '</p>' +
          '<div class="vd-notes-content">' + parseMarkdown(noteText) + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  // ============================================================
  // MARKDOWN PARSER — lightweight, matches lender worker v2.13
  // Supports: **bold**, *italic*, headings, lists, links, <hr>
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
      str = str.replace(/\*\*(.*?)\*\*/g,     '<strong>$1</strong>');
      str = str.replace(/\*(.*?)\*/g,          '<em>$1</em>');
      str = str.replace(/_(.*?)_/g,            '<em>$1</em>');
      str = str.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener" style="color:var(--vd-accent);text-decoration:underline;">$1</a>');
      return str;
    }

    lines.forEach(function (raw) {
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(raw.trim())) {
        closeList();
        output += '<hr style="border:none;border-top:1px solid var(--vd-border);margin:10px 0;">';
        return;
      }
      var hm = raw.match(/^(#{1,6})\s+(.*)/);
      if (hm) {
        closeList();
        var lvl = Math.min(hm[1].length + 2, 6);
        output += '<h' + lvl + ' style="margin:12px 0 5px;font-weight:600;color:var(--vd-text);">' + inlineFmt(hm[2]) + '</h' + lvl + '>';
        return;
      }
      var ul = raw.match(/^[\s]*[-*]\s+(.*)/);
      if (ul) {
        if (inOL) { output += '</ol>'; inOL = false; }
        if (!inUL) { output += '<ul style="margin:4px 0 4px 16px;padding:0;">'; inUL = true; }
        output += '<li>' + inlineFmt(ul[1]) + '</li>';
        return;
      }
      var ol = raw.match(/^[\s]*\d+\.\s+(.*)/);
      if (ol) {
        if (inUL) { output += '</ul>'; inUL = false; }
        if (!inOL) { output += '<ol style="margin:4px 0 4px 16px;padding:0;">'; inOL = true; }
        output += '<li>' + inlineFmt(ol[1]) + '</li>';
        return;
      }
      if (!raw.trim()) { closeList(); output += '<br>'; return; }
      closeList();
      output += '<p style="margin:3px 0;">' + inlineFmt(raw) + '</p>';
    });

    closeList();
    return output;
  }

  function renderCopyableField(field) {
    var safeVal = escapeAttr(String(field.value || ''));
    return (
      '<div class="vd-field-row">' +
        '<span class="vd-field-label">' + escapeHtml(field.displayName) + '</span>' +
        '<span class="vd-field-value">' +
          '<span class="vd-copy-wrap">' +
            '<span>' + escapeHtml(String(field.value)) + '</span>' +
            '<button class="vd-copy-btn" data-copy="' + safeVal + '" title="Copy">' +
              '<i class="fa-regular fa-copy"></i>' +
            '</button>' +
          '</span>' +
        '</span>' +
      '</div>'
    );
  }

  function renderBooleanField(field) {
    // Handles Airtable single-select fields with multiple states beyond yes/no.
    // Options like "🟢 Yes", "🔴 No - Restricted (Do Not Use)", "NA",
    // "Not Listed", "Not Listed in LOS", "--" can all appear.
    // Strip emoji prefixes for display and detect the state by keyword.
    var v = field.value;
    var rawStr = (typeof v === 'string') ? v.trim() : '';
    var lower = rawStr.toLowerCase();

    // Clean display text: remove leading emoji/symbol characters + space
    // (e.g. "🟢 Yes" → "Yes", "🔴 No - Restricted" → "No - Restricted")
    var cleanText = rawStr.replace(/^[^\x20-\x7E]+\s*/g, '').trim();

    var icon, label, colorClass;

    if (v === true || lower.includes('yes') || lower.includes('true')) {
      // Positive: Yes / True
      icon = 'fa-solid fa-circle-check text-green';
      label = cleanText || 'Yes';
      colorClass = '';
    } else if (lower.includes('no') || lower.includes('restricted')) {
      // Negative: No / No - Restricted (Do Not Use)
      icon = 'fa-solid fa-circle-xmark text-red';
      label = cleanText || 'No';
      colorClass = '';
    } else if (lower === 'na' || lower === 'n/a') {
      // Neutral: NA
      icon = 'fa-solid fa-minus-circle';
      label = 'N/A';
      colorClass = ' style="color:#94a3b8;"';
    } else if (lower.includes('not listed')) {
      // Neutral: Not Listed / Not Listed in LOS
      icon = 'fa-solid fa-minus-circle';
      label = cleanText || 'Not Listed';
      colorClass = ' style="color:#94a3b8;"';
    } else if (v === false) {
      // Explicit boolean false
      icon = 'fa-solid fa-circle-xmark text-red';
      label = 'No';
      colorClass = '';
    } else {
      // Fallback: show the raw value with a neutral icon
      icon = 'fa-solid fa-minus-circle';
      label = cleanText || String(v);
      colorClass = ' style="color:#94a3b8;"';
    }

    return (
      '<div class="vd-field-row">' +
        '<span class="vd-field-label">' + escapeHtml(field.displayName) + '</span>' +
        '<span class="vd-field-value"><i class="' + icon + '"' + colorClass + '></i> ' + escapeHtml(label) + '</span>' +
      '</div>'
    );
  }

  function renderLinkCard(field) {
    var url = String(field.value || '');
    if (!url || !url.match(/^https?:\/\//)) return '';
    var icon = LINK_ICON_CONFIG[field.displayName] || 'fa-solid fa-arrow-up-right-from-square';
    // Matches lender ld-link-btn exactly: label text in button, <a> is direct sibling (not wrapped in span)
    return (
      '<div class="vd-field-row">' +
        '<span class="vd-field-label">' + escapeHtml(field.displayName) + '</span>' +
        '<a href="' + escapeAttr(url) + '" target="_blank" rel="noopener" class="vd-link-btn">' +
          '<i class="' + icon + ' vd-link-btn-icon"></i>' +
          escapeHtml(field.displayName) +
        '</a>' +
      '</div>'
    );
  }

  function renderSocialButton(field) {
    var cfg = SOCIAL_CONFIG[field.displayName] || SOCIAL_CONFIG[field.fieldName];
    var url = String(field.value || '');
    if (!cfg || !url || !url.match(/^https?:\/\//)) return '';
    // If icon is null (X/Twitter — fa-x-twitter not in FA 6.4.0),
    // render a bold text "X" so it always displays correctly.
    var iconHtml = cfg.icon
      ? '<i class="' + cfg.icon + '"></i>'
      : '<span style="font-size:18px;font-weight:900;line-height:1;font-family:serif;">X</span>';
    return (
      '<a href="' + escapeAttr(url) + '" target="_blank" rel="noopener" ' +
        'class="vd-social-btn" style="--social-color:' + cfg.color + ';" title="' + escapeAttr(cfg.label) + '">' +
        iconHtml +
      '</a>'
    );
  }

  function renderAttachmentField(field) {
    var attachments = Array.isArray(field.value) ? field.value : [];
    if (attachments.length === 0) return '';

    var html = '<div class="vd-attachment-group">';
    if (field.displayName) {
      html += '<div class="vd-attachment-group-label">' + escapeHtml(field.displayName) + '</div>';
    }
    attachments.forEach(function (att) {
      html +=
        '<a href="' + escapeAttr(att.url) + '" target="_blank" rel="noopener" class="vd-attachment-item">' +
          '<i class="fa-solid fa-file-lines"></i>' +
          '<span>' + escapeHtml(att.filename || att.url) + '</span>' +
          '<span class="vd-attachment-open"><i class="fa-solid fa-arrow-up-right-from-square"></i></span>' +
        '</a>';
    });
    html += '</div>';
    return html;
  }

  // ============================================================
  // CONTACTS SECTION (used inside Contacts panel)
  // ============================================================
  function buildContactsSection(title, color, people, type) {
    var html =
      '<div class="vd-section-card" style="margin-bottom:14px;">' +
        buildVdSectionHeader(title, color) +
        '<div class="vd-section-body">' +
          '<div class="ae-grid">';

    people.forEach(function (person) {
      var dataAttr = type === 'rep' ? 'data-rep-id' : 'data-contact-id';
      var cardClass = type === 'rep' ? 'ae-card vd-rep-card' : 'ae-card vd-other-card';
      var photoHtml = (type === 'rep' && person.photo)
        ? '<div class="ae-photo-wrap"><img src="' + escapeAttr(person.photo) + '" alt="' + escapeAttr(person.name) + '" onerror="this.style.display=\'none\'"></div>'
        : '<div class="ae-avatar">' + escapeHtml((person.name || '?').charAt(0)) + '</div>';

      html +=
        '<div class="' + cardClass + '" ' + dataAttr + '="' + escapeAttr(person.id) + '">' +
          photoHtml +
          '<div class="ae-name">' + escapeHtml(person.name) + '</div>' +
          (person.title ? '<div class="ae-title-text">' + escapeHtml(person.title) + '</div>' : '') +
        '</div>';
    });

    html += '</div></div></div>';
    return html;
  }

  function attachRepClickHandlers(vendor) {
    var repsById = {};
    (vendor.accountReps || []).forEach(function (rep) { repsById[rep.id] = rep; });
    document.querySelectorAll('.vd-rep-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var rep = repsById[card.getAttribute('data-rep-id')];
        if (rep) openContactModal(rep.name, rep.title, rep.email, rep.mobileNumber, rep.officeNumber, rep.officeExtension, rep.photo);
      });
    });
  }

  function attachOtherContactClickHandlers(vendor) {
    var contactsById = {};
    (vendor.otherContacts || []).forEach(function (c) { contactsById[c.id] = c; });
    document.querySelectorAll('.vd-other-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var c = contactsById[card.getAttribute('data-contact-id')];
        if (c) openContactModal(c.name, c.title, c.email, c.phone, '', '', null);
      });
    });
  }

  // ============================================================
  // CONTACT MODAL
  // ============================================================
  function openContactModal(name, title, email, mobile, office, ext, photo) {
    var existing = document.getElementById('vd-contact-modal');
    if (existing) existing.remove();

    var photoHtml = photo
      ? '<img class="vd-modal-photo" src="' + escapeAttr(photo) + '" alt="' + escapeAttr(name) + '">'
      : '<div class="vd-modal-photo-placeholder">' + escapeHtml((name || '?').charAt(0)) + '</div>';

    var contactRows = '';
    if (email) {
      contactRows +=
        '<a href="mailto:' + escapeAttr(email) + '" class="vd-modal-contact-row">' +
          '<i class="fa-solid fa-envelope"></i>' +
          '<span>' + escapeHtml(email) + '</span>' +
        '</a>';
    }
    if (mobile) {
      contactRows +=
        '<a href="tel:' + escapeAttr(mobile) + '" class="vd-modal-contact-row">' +
          '<i class="fa-solid fa-mobile-screen"></i>' +
          '<span>' + escapeHtml(mobile) + '</span>' +
        '</a>';
    }
    if (office) {
      var officeLabel = office + (ext ? ' x' + ext : '');
      contactRows +=
        '<a href="tel:' + escapeAttr(office) + '" class="vd-modal-contact-row">' +
          '<i class="fa-solid fa-phone"></i>' +
          '<span>' + escapeHtml(officeLabel) + '</span>' +
        '</a>';
    }
    if (!contactRows) contactRows = '<p class="vd-modal-no-contact">No contact details available.</p>';

    var overlay = document.createElement('div');
    overlay.id = 'vd-contact-modal';
    overlay.className = 'vd-modal-overlay';
    overlay.innerHTML =
      '<div class="vd-modal-box">' +
        '<button class="vd-modal-close" id="vd-modal-close-btn"><i class="fa-solid fa-xmark"></i></button>' +
        '<div class="vd-modal-content">' +
          photoHtml +
          '<div class="vd-modal-name">' + escapeHtml(name) + '</div>' +
          (title ? '<div class="vd-modal-title">' + escapeHtml(title) + '</div>' : '') +
          contactRows +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add('open'); });

    document.getElementById('vd-modal-close-btn').addEventListener('click', function () {
      overlay.classList.remove('open');
      setTimeout(function () { overlay.remove(); }, 200);
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        overlay.classList.remove('open');
        setTimeout(function () { overlay.remove(); }, 200);
      }
    });
  }


  // ============================================================
  // COPY BUTTON HANDLERS (for copyable fields)
  // ============================================================
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.vd-copy-btn');
    if (!btn) return;
    var text = btn.getAttribute('data-copy') || '';
    navigator.clipboard.writeText(text).then(function () {
      btn.innerHTML = '<i class="fa-solid fa-check"></i>';
      btn.classList.add('copied');
      setTimeout(function () {
        btn.innerHTML = '<i class="fa-regular fa-copy"></i>';
        btn.classList.remove('copied');
      }, 2000);
    }).catch(function () {});
  });

  // ============================================================
  // NEXA GATING
  // Hides sections with class 'nexa-gated-section' unless user is NEXA.
  // Uses the same 3-step check as the rest of the platform.
  // ============================================================
  function checkNexaAndRevealGated(vendor) {
    var nexaSections = document.querySelectorAll('.nexa-gated-section');
    if (!nexaSections.length) return;

    // Step 1: Fast JWT check (also reads outseta:NexaAccess claim)
    if (checkNexaViaJWT()) {
      revealNexaSections(nexaSections);
      return;
    }

    // Step 2: Outseta SDK check with retry loop (matches lender pattern)
    checkNexaViaOutseta().then(function (ok) {
      if (ok) revealNexaSections(nexaSections);
    });
  }

  function revealNexaSections(sections) {
    sections.forEach(function (section) {
      section.classList.remove('nexa-gated-section');
    });
    console.log('\u2705 NEXA user \u2014 revealed ' + sections.length + ' gated section(s)');
  }

  function checkNexaViaJWT() {
    try {
      var token = localStorage.getItem('Outseta.nocode.accessToken');
      if (!token) return false;
      var payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      var email = (payload.email || '').toLowerCase();
      if (email.endsWith('@nexamortgage.com') || email.endsWith('@nexalending.com')) return true;
      // Also check the NexaAccess custom field stored in the JWT
      var nexaAccess = '';
      try { nexaAccess = payload['outseta:NexaAccess'] || payload.NexaAccess || ''; } catch (e) {}
      if (nexaAccess.toLowerCase() === 'true') return true;
    } catch (e) {}
    return false;
  }

  function checkNexaViaOutseta() {
    // Uses getCachedOutsetaUser() with retry loop — same pattern as lender worker.
    // NexaAccess is stored as the string "true", not boolean true.
    return new Promise(function (resolve) {
      var attempts = 0;
      function tryCheck() {
        attempts++;
        if (typeof window.getCachedOutsetaUser === 'function') {
          window.getCachedOutsetaUser().then(function (user) {
            if (!user) { resolve(false); return; }
            var nexaAccess = '';
            try { nexaAccess = user.NexaAccess || ''; } catch (e) {}
            if (!nexaAccess) {
              try { nexaAccess = user.Account.Metadata.NexaAccess || ''; } catch (e) {}
            }
            resolve(nexaAccess.toLowerCase() === 'true');
          }).catch(function () { resolve(false); });
        } else if (attempts < 15) {
          setTimeout(tryCheck, 200);
        } else {
          resolve(false);
        }
      }
      tryCheck();
    });
  }

  // ============================================================
  // HTML ESCAPE HELPERS
  // ============================================================
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

})();
`;

/**
 * MTG Broker API - Cloudflare Worker
 * Handles Pipeline, Billing, Calculator saves, Mortgage Rates, Loan Products, Credit Vendors, Goal Plans, Broker Profiles, and other user data
 * 
 * UPDATED: March 24, 2026 - v7.28
 * v7.28: PRO plan gating for referral program endpoints. All /api/referral/*
 *        routes now check JWT planUid and return 403 for non-PRO users.
 * v7.27: CRIT-1 security fix — JWT signature verification. Server now verifies
 *        the Outseta RS256 JWT before trusting any user identity. Plain emails
 *        in Authorization headers are rejected. verifyOutsetaJWT() added.
 * v7.26: Security fixes — CRIT-2 (plan self-promotion), HIGH-2 (formula injection),
 *        HIGH-3 (task ownership), MED-2 (cache-clear token), MED-3 (error leakage).
 * v7.25: Fixed /api/plan-limits pipelineLoans count — was reading stale
 *        counter from Usage table; now counts actual LOANS table records.
 * v7.24: Added /api/products-list endpoint for Products listing page (/app/products).
 *        Fetches all Loan Product Types from Airtable with pagination, returns
 *        { name, slug, categoryTags, lendersRollup, sortName, firstLetter }.
 *        Cached for 10 minutes. Also added /api/products-list/clear-cache.
 *
 * v7.23: Updated PLAN_LIMITS — LITE users can now access directory links
 *        (Lenders, Vendors, Contacts detail pages) per March 2026 policy change.
 * v7.22: Reverted v7.21 RentCast AVM integration (removed /api/property-value endpoint
 *        and /static/property-value.js module). Using Zillow Lookup buttons instead.
 *
 * v7.20: Added lender logo map to /api/loan-products response for table rendering
 * v7.19: Fixed /api/credit-vendors 500 error
 *        - Added detailed error logging with separate try/catch for Airtable fetch vs data transform
 *        - Fixed 'SmartPay Option' field name (removed incorrect 'Credit Reports -' prefix)
 *        - Returns detailed error info in response body for debugging
 *
 * v7.18: Added SmartPay Option to /api/credit-vendors response
 *        - Added 'Credit Reports - SmartPay Option' to Airtable fields fetch
 *        - Added smartPay property to features object in vendor transform
 *
 * v7.17: Added /api/admin/stats endpoint — admin-only platform stats (users, pipeline, calculator saves, goal plans, lender notes, favorites)
 *
 * v7.16: Added 'NEXA Gated' checkbox to config reads. nexaGated is now a
 *        separate boolean per field, decoupled from renderMode. Any field
 *        can use any render mode AND be NEXA gated independently.
 *        section.hasNexa is now driven by nexaGated (not renderMode=nexa).
 *
 * v7.15: Render Mode per-field (not per-section)
 *        (tblSEHyREJOVdhAa9). Fields are filtered, renamed, grouped into
 *        sections, and sorted entirely from Airtable — no code changes needed
 *        to add, hide, rename, or reorder a field on the Product detail page.
 *        Added fetchLoanProductTypesConfig() with 30-min cache.
 *        Response now returns { product: { name, lendersRollup, categoryTags, sections[] } }
 * 
 * v7.11: Added /api/loan-product-types endpoint for Products detail page
 *        GET /api/loan-product-types?slug={webflow-slug}
 *        Fetches a single Loan Product Types record by its Webflow Slug field.
 *        Returns all displayable fields so the detail page renders without
 *        any Webflow CMS bindings — add a new Airtable field and it appears
 *        automatically on the page with no code or Designer changes.
 *        Cached per-slug for 10 minutes.
 * 
 * v7.10: "Show in Detail Only" support for NEXA fields
 *        - fetchFieldConfig fetches both "Show in Picker" AND "Show in Detail Only" records
 *        - Detail-only fields get filterable:false, detailOnly:true
 *        - NEXA Docs + NEXA Specific Notes now visible in product detail modal
 * v7.9: Full referral program integration — enrollment, payout setup, commissions
 *       GET /api/referral - Status + stats + payout info (Rewardful + Airtable)
 *       POST /api/referral/enroll - Accept terms + create affiliate
 *       PUT /api/referral/payout-setup - Save PayPal + legal info
 *       GET /api/referral/commissions - Commission history
 *       Requires env.REWARDFUL_API_KEY secret
 * v7.7: Added avatar (profile picture) upload/serve/delete endpoints using R2
 *       POST /api/broker-profile/avatar, GET /api/avatars/:key, DELETE /api/broker-profile/avatar
 * v7.6: Added /api/broker-profile endpoints (GET/POST/PUT) for Settings page
 *       Stores company address, logo URL, and disclaimer text in Airtable JSON
 *       Added R2 logo upload/serve endpoints (POST /api/broker-profile/logo, GET /api/logos/:key)
 * v7.5: Split VOE into VOE/VOI (TWN) and VOE/VOI (Argyle) for credit vendors
 * UPDATED: Affordability calculator v2 - qualifying rate, MI, supplemental insurance,
 *          annual/monthly toggles for taxes & insurance
 * v7.4: Pipeline calcs v3.2 - 2-decimal DTI, localStorage persistence per loan
 * v7.2: /static/pipeline-calcs.js endpoint for external calculator module
 * 
 * Previous: v7.0 MERGED
 * MERGED: Goal Plan endpoints back into latest codebase with updated Credit Vendor fields
 * ADDED: /api/goal-plan endpoints for Goal Setting page (GET/POST/PUT)
 * 
 * Previous Updates:
 * - v6.0: Updated Credit Vendor field names to match renamed Airtable columns
 *         Added expanded soft pull tiers and additional fee fields
 *         Removed deprecated WhatIf and WayFinder fields
 * - v5.0: /api/credit-vendors endpoint for NEXA credit report pricing page
 * - v4.0: /manifest.json endpoint for Progressive Web App installation
 * - v2.0 PERFORMANCE UPDATE: Pipeline Loans caching (10 minute per-user cache for GET requests)
 * - v2.0: Cache invalidation on POST/PUT/DELETE operations
 * - v2.0: /api/pipeline/loans/clear-cache endpoint for manual cache clearing
 * - v6.15 COMPATIBILITY FIX: Return fieldMetadata as object (not array)
 * - ADDED: allFields, coreColumns, visibleColumns arrays for v6.15
 * - ADDED: CORS credentials support with origin whitelist validation
 * - FIXED: Properly URL-encoded filter formula for "Show in Picker" checkbox
 * - Added: Config table support for /api/loan-products endpoint
 * - Added: Display Name support for custom column labels
 */

const AIRTABLE_BASE_ID = 'appuJgI9X93OLaf0u';

// Admin emails — only these users can access /api/admin/stats
const ADMIN_EMAILS = ['rich@prestonlending.com'];

// ============================
// CORS (supports cookies)
// ============================
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/(www\.)?mtg\.broker$/i,
  /^https:\/\/.*\.mtg\.broker$/i,
  /^https:\/\/localhost(?::\d+)?$/i,
  /^https:\/\/.*\.webflow\.io$/i,
  /^https:\/\/.*\.workers\.dev$/i,
  /^https:\/\/.*\.pages\.dev$/i
];

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  // No Origin header (e.g., direct navigation) => allow read-only access
  if (!origin) {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
  }

  const allowed = ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin));
  // If not allowed, omit CORS entirely (browser will block)
  if (!allowed) return {};

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

// Table IDs
const TABLES = {
  // Existing Pipeline Tables
  LOANS: 'tblH2hB1FlW9a3iXp',
  TASKS: 'tblI028O1LWD99HQN',
  
  // Billing Tables
  FAVORITES: 'tbl9PH9VvdUqNiw4i',
  SCENARIOS: 'tblSuOuW1tHbSjJlA',
  USAGE: 'tblEnYBn1mbgEdK2g',
  
  // Loan Products Tables
  LOAN_PRODUCTS: 'tblVSU5z4WSxreX7l',
  LOAN_SEARCH_CONFIG: 'tblxAAUFpzZ7OrsGy',

  // Vendors Table (used by Credit Reports page)
  VENDORS: 'tblDodcVHoEEatVIe',

  // Goal Plans Table (used by Goal Setting page)
  GOAL_PLANS: 'tblTbW2iSVRZBlIJA',

  // Broker Profiles Table (used by Settings page - stores company address, logo, disclaimer)
  BROKER_PROFILES: 'tblWLqnCtCUZYmTSk',

  // Loan Product Types Table (used by Products detail page /app/products/{slug})
  LOAN_PRODUCT_TYPES: 'tblbcS2rYWmC69bVu',

  // Loan Product Types Config Table (controls which fields show, display names, sections)
  LOAN_PRODUCT_TYPES_CONFIG: 'tblSEHyREJOVdhAa9',

  // Lender List Table (used by lender directory, logo map for loan search)
  LENDER_LIST: 'tbl1mpg3KFakZsFK7'
};

// ============================================================
// LOGO UPLOAD CONFIGURATION
// R2 bucket binding name: LOGO_BUCKET (set in wrangler.toml or dashboard)
// ============================================================
const LOGO_CONFIG = {
  MAX_SIZE_BYTES: 2 * 1024 * 1024,  // 2MB max file size
  ALLOWED_TYPES: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'],
  KEY_PREFIX: 'logos/'               // R2 key prefix for all logos
};

// ============================================================
// AVATAR (PROFILE PICTURE) UPLOAD CONFIGURATION
// Uses the same R2 bucket as logos, just with 'avatars/' prefix
// ============================================================
const AVATAR_CONFIG = {
  MAX_SIZE_BYTES: 2 * 1024 * 1024,  // 2MB max file size
  ALLOWED_TYPES: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
  KEY_PREFIX: 'avatars/'             // R2 key prefix for all avatars
};

// ============================================================
// CACHING CONFIGURATION
// ============================================================

// Loan Products Cache (in-memory, resets on worker restart)
let loanProductsCache = null;
let loanProductsCacheTimestamp = null;
const LOAN_PRODUCTS_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Loan Product Types Cache (per-slug, for Products detail page)
// Structure: { [slug]: { data: {...}, timestamp: Date.now() } }
const loanProductTypesCache = new Map();
const LOAN_PRODUCT_TYPES_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Loan Product Types Config Cache (shared, all fields)
// Invalidated whenever the Worker restarts or after 30 minutes
let loanProductTypesConfigCache = null;
let loanProductTypesConfigCacheTimestamp = null;
const LOAN_PRODUCT_TYPES_CONFIG_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Pipeline Loans Cache (per-user, in-memory)
// Structure: { [userEmail]: { data: [...], timestamp: Date.now() } }
const pipelineLoansCache = new Map();
const PIPELINE_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Credit Vendors Cache (in-memory, resets on worker restart)
let creditVendorsCache = null;
let creditVendorsCacheTimestamp = null;
const CREDIT_VENDORS_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Products List Cache — serves the /app/products listing page
let productsListCache = null;
let productsListCacheTimestamp = null;
const PRODUCTS_LIST_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// ============================================================
// PIPELINE CACHE HELPER FUNCTIONS
// ============================================================

/**
 * Get cached pipeline loans for a user
 * Returns null if cache is expired or doesn't exist
 */
function getCachedPipelineLoans(userEmail) {
  const cached = pipelineLoansCache.get(userEmail);
  if (!cached) return null;
  
  const now = Date.now();
  if (now - cached.timestamp > PIPELINE_CACHE_DURATION) {
    // Cache expired, remove it
    pipelineLoansCache.delete(userEmail);
    return null;
  }
  
  return cached.data;
}

/**
 * Set cached pipeline loans for a user
 */
function setCachedPipelineLoans(userEmail, data) {
  pipelineLoansCache.set(userEmail, {
    data: data,
    timestamp: Date.now()
  });
}

/**
 * Clear pipeline cache for a specific user
 * Called after create, update, or delete operations
 */
function clearPipelineCacheForUser(userEmail) {
  pipelineLoansCache.delete(userEmail);
  console.log(`Pipeline cache cleared for user: ${userEmail}`);
}

/**
 * Clear all pipeline caches (admin function)
 */
function clearAllPipelineCaches() {
  pipelineLoansCache.clear();
  console.log('All pipeline caches cleared');
}

// Plan Limits Configuration
// UPDATED: February 2, 2026 - Aligned with pricing page
// - LITE calculatorSaves: 0 (was 1) - pricing page shows "Save Calculator Scenarios" as unavailable
// - PLUS canPrintCalculatorPDF: false (was true) - pricing page shows "Print to PDF / Export" as unavailable
const PLAN_LIMITS = {
  LITE: {
    pipelineLoans: 0,
    calculatorSaves: 0,
    canAccessAdvancedCalcs: false,
    canClickLoanSearchDetails: false,
    canClickDirectoryLinks: true,   // Mar 2026: directories are free for all plans
    canAddFavorites: false,
    canExportPipeline: false,
    canPrintCalculatorPDF: false
  },
  PLUS: {
    pipelineLoans: 25,
    calculatorSaves: 10,
    canAccessAdvancedCalcs: true,
    canClickLoanSearchDetails: true,
    canClickDirectoryLinks: true,
    canAddFavorites: true,
    canExportPipeline: false,
    canPrintCalculatorPDF: false
  },
  PRO: {
    pipelineLoans: Infinity,
    calculatorSaves: Infinity,
    canAccessAdvancedCalcs: true,
    canClickLoanSearchDetails: true,
    canClickDirectoryLinks: true,
    canAddFavorites: true,
    canExportPipeline: true,
    canPrintCalculatorPDF: true
  }
};

// Valid calculator types
const CALCULATOR_TYPES = [
  'Refinance Analysis',
  'Mortgage Calculator',
  'Affordability Calculator',
  'Buy Down Calculator',
  'Blended Rate',
  'DSCR Calculator',
  'Loan Scenario Comparison',
  'Rent vs Buy',
  'Lender Pricing Comparison',
  'Gift of Equity',
  'Income Calculation',
  'Fix N Flip',
  'Construction Loan',
  'Closing Costs',
  'VA Entitlement'
];

// Valid item types for favorites
const FAVORITE_ITEM_TYPES = ['Lender', 'Vendor', 'Contact'];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function jsonResponse(data, status = 200, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request) }
  });
}

/**
 * Sanitize a user email before embedding it in an Airtable filterByFormula.
 * Removes characters that could break the formula string or enable injection.
 * A valid email only needs: letters, digits, @, ., _, -, +
 * Single quotes, parens, braces, and commas are the dangerous Airtable formula chars.
 * Returns null if the result doesn't look like an email (missing @).
 */
function sanitizeEmailForFormula(email) {
  if (!email || typeof email !== 'string') return null;
  const safe = email.replace(/['"(){}[\],\\]/g, '').trim().toLowerCase();
  return (safe.includes('@') && safe.length > 3) ? safe : null;
}

// ============================================================
// JWT VERIFICATION (CRIT-1 Security Fix)
// Verifies Outseta RS256 JWT signatures using JWKS public keys.
// The server NEVER trusts a plain email from the Authorization header —
// it must be extracted from a cryptographically verified JWT.
// ============================================================

// Cache for JWKS keys (1-hour TTL, resets on worker restart)
let outsetaJwksCache = null;
let outsetaJwksCacheTimestamp = null;
const JWKS_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

/**
 * Fetch and cache Outseta public JWKS keys
 */
async function getOutsetaJwks() {
  const now = Date.now();
  if (outsetaJwksCache && outsetaJwksCacheTimestamp && (now - outsetaJwksCacheTimestamp < JWKS_CACHE_DURATION)) {
    return outsetaJwksCache;
  }
  const res = await fetch('https://mtgbroker.outseta.com/.well-known/jwks');
  if (!res.ok) throw new Error('Failed to fetch JWKS');
  outsetaJwksCache = await res.json();
  outsetaJwksCacheTimestamp = now;
  return outsetaJwksCache;
}

/**
 * Verify an Outseta RS256 JWT and return the decoded payload.
 * Returns null if the token is missing, malformed, expired, or fails signature check.
 */
async function verifyOutsetaJWT(token) {
  try {
    if (!token || typeof token !== 'string') return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // base64url → base64 helper
    const b64 = (s) => s.replace(/-/g, '+').replace(/_/g, '/');

    const header  = JSON.parse(atob(b64(parts[0])));
    const payload = JSON.parse(atob(b64(parts[1])));

    // Outseta uses RS256
    if (header.alg !== 'RS256') return null;

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;

    // Check issuer
    if (payload.iss !== 'https://mtgbroker.outseta.com') return null;

    // Fetch JWKS and find the matching key by kid, falling back to first key
    const jwks = await getOutsetaJwks();
    const key = (header.kid ? jwks.keys?.find(k => k.kid === header.kid) : null) || jwks.keys?.[0];
    if (!key) return null;

    // Import the RSA public key for signature verification
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      key,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Verify the signature over "header.payload"
    const encoder  = new TextEncoder();
    const data     = encoder.encode(`${parts[0]}.${parts[1]}`);
    const sigBytes = Uint8Array.from(atob(b64(parts[2])), c => c.charCodeAt(0));

    const isValid = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      publicKey,
      sigBytes,
      data
    );

    return isValid ? payload : null;

  } catch (e) {
    console.error('JWT verification error:', e.message);
    return null;
  }
}

async function airtableRequest(endpoint, apiKey, method = 'GET', body = null) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  };
  if (body) options.body = JSON.stringify(body);
  
  const response = await fetch(url, options);
  return response.json();
}

// ============================================================
// PIPELINE ENDPOINTS (WITH CACHING)
// ============================================================

/**
 * GET /api/pipeline/loans
 * Fetches all loans for a user with 10-minute caching
 * Add ?refresh=true to bypass cache
 */
async function getLoans(userEmail, apiKey, request) {
  const url = new URL(request.url);
  const bypassCache = url.searchParams.get('refresh') === 'true';
  
  // Check cache first (unless bypassing)
  if (!bypassCache) {
    const cachedData = getCachedPipelineLoans(userEmail);
    if (cachedData) {
      console.log(`Pipeline cache HIT for user: ${userEmail}`);
      return jsonResponse(cachedData, 200, request);
    }
  }
  
  console.log(`Pipeline cache MISS for user: ${userEmail} - fetching from Airtable`);
  
  // Fetch from Airtable
  const formula = encodeURIComponent(`{User Email}='${userEmail}'`);
  const data = await airtableRequest(`${TABLES.LOANS}?filterByFormula=${formula}`, apiKey);
  const records = data.records || [];
  
  // Cache the result
  setCachedPipelineLoans(userEmail, records);
  
  return jsonResponse(records, 200, request);
}

/**
 * POST /api/pipeline/loans
 * Creates a new loan and invalidates the user's cache
 */
async function createLoan(userEmail, fields, apiKey, request) {
  fields['User Email'] = userEmail;
  const data = await airtableRequest(TABLES.LOANS, apiKey, 'POST', { fields });
  
  // Invalidate cache after successful create
  clearPipelineCacheForUser(userEmail);
  
  return jsonResponse(data, 201, request);
}

/**
 * PUT /api/pipeline/loans/:id
 * Updates a loan and invalidates the user's cache
 */
async function updateLoan(userEmail, recordId, fields, apiKey, request) {
  const existing = await airtableRequest(`${TABLES.LOANS}/${recordId}`, apiKey);
  if (existing.fields['User Email'] !== userEmail) {
    return jsonResponse({ error: 'Unauthorized' }, 403, request);
  }
  const data = await airtableRequest(`${TABLES.LOANS}/${recordId}`, apiKey, 'PATCH', { fields });
  
  // Invalidate cache after successful update
  clearPipelineCacheForUser(userEmail);
  
  return jsonResponse(data, 200, request);
}

/**
 * DELETE /api/pipeline/loans/:id
 * Deletes a loan and invalidates the user's cache
 */
async function deleteLoan(userEmail, recordId, apiKey, request) {
  const existing = await airtableRequest(`${TABLES.LOANS}/${recordId}`, apiKey);
  if (existing.fields['User Email'] !== userEmail) {
    return jsonResponse({ error: 'Unauthorized' }, 403, request);
  }
  await airtableRequest(`${TABLES.LOANS}/${recordId}`, apiKey, 'DELETE');
  
  // Invalidate cache after successful delete
  clearPipelineCacheForUser(userEmail);
  
  return jsonResponse({ success: true }, 200, request);
}

/**
 * GET /api/pipeline/loans/clear-cache
 * Manually clears the pipeline cache for the authenticated user
 */
async function clearPipelineCache(userEmail, request) {
  clearPipelineCacheForUser(userEmail);
  return jsonResponse({ 
    success: true, 
    message: 'Pipeline cache cleared for your account' 
  }, 200, request);
}

async function getTasks(userEmail, loanId, apiKey, request) {
  let formula;
  if (loanId) {
    formula = encodeURIComponent(`FIND('${loanId}', ARRAYJOIN({Loan}))`);
  } else {
    formula = encodeURIComponent(`{Assigned To}='${userEmail}'`);
  }
  const data = await airtableRequest(`${TABLES.TASKS}?filterByFormula=${formula}`, apiKey);
  return jsonResponse(data.records || [], 200, request);
}

async function createTask(userEmail, fields, apiKey, request) {
  if (!fields['Assigned To']) fields['Assigned To'] = userEmail;
  const data = await airtableRequest(TABLES.TASKS, apiKey, 'POST', { fields });
  return jsonResponse(data, 201, request);
}

async function updateTask(userEmail, recordId, fields, apiKey, request) {
  // Verify ownership — only the user who owns the task can update it (HIGH-3 security fix)
  const existing = await airtableRequest(`${TABLES.TASKS}/${recordId}`, apiKey);
  if (!existing.fields || existing.fields['Assigned To'] !== userEmail) {
    return jsonResponse({ error: 'Unauthorized' }, 403, request);
  }
  const data = await airtableRequest(`${TABLES.TASKS}/${recordId}`, apiKey, 'PATCH', { fields });
  return jsonResponse(data, 200, request);
}

async function deleteTask(userEmail, recordId, apiKey, request) {
  // Verify ownership — only the user who owns the task can delete it (HIGH-3 security fix)
  const existing = await airtableRequest(`${TABLES.TASKS}/${recordId}`, apiKey);
  if (!existing.fields || existing.fields['Assigned To'] !== userEmail) {
    return jsonResponse({ error: 'Unauthorized' }, 403, request);
  }
  await airtableRequest(`${TABLES.TASKS}/${recordId}`, apiKey, 'DELETE');
  return jsonResponse({ success: true }, 200, request);
}

// ============================================================
// MORTGAGE RATES
// ============================================================

async function getRates(request) {
  try {
    const response = await fetch('https://www.mortgagenewsdaily.com/mortgage-rates/mnd', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      return jsonResponse({ success: false, error: 'Failed to fetch MND page' }, 500, request);
    }

    const html = await response.text();
    const rates = parseRates(html);

    return jsonResponse({
      success: true,
      data: rates,
      timestamp: new Date().toISOString()
    }, 200, request);

  } catch (error) {
    console.error('getRates error:', error);
    return jsonResponse({ success: false, error: 'An internal error occurred. Please try again.' }, 500, request);
  }
}

function parseRates(html) {
  const rates = {};

  let match = html.match(/30YR Fixed Rate[\s\S]*?(\d+\.\d+)%[\s\S]*?([+-]\d+\.\d+)%/i);
  if (match) {
    rates['30yr'] = { rate: match[1], change: match[2] };
  }

  match = html.match(/15YR Fixed Rate[\s\S]*?(\d+\.\d+)%[\s\S]*?([+-]\d+\.\d+)%/i);
  if (match) {
    rates['15yr'] = { rate: match[1], change: match[2] };
  }

  match = html.match(/10 Year Treasury[\s\S]*?(\d+\.\d+)[\s\S]*?([+-]?\d+\.\d+)/i);
  if (match) {
    rates['10yr'] = { rate: match[1], change: match[2] };
  }

  match = html.match(/30\s*Yr\.?\s*FHA[\s\S]*?(\d+\.\d+)%[\s\S]*?([+-]\d+\.\d+)%/i);
  if (!match) {
    match = html.match(/>FHA<[\s\S]*?(\d+\.\d+)%[\s\S]*?([+-]\d+\.\d+)%/i);
  }
  if (!match) {
    match = html.match(/FHA[^>]*>[\s\S]*?<td[^>]*>(\d+\.\d+)%<\/td>[\s\S]*?<td[^>]*>([+-]?\d+\.\d+)%/i);
  }
  if (match) {
    rates['fha'] = { rate: match[1], change: match[2] };
  }

  match = html.match(/30\s*Yr\.?\s*VA[\s\S]*?(\d+\.\d+)%[\s\S]*?([+-]\d+\.\d+)%/i);
  if (!match) {
    match = html.match(/>VA<[\s\S]*?(\d+\.\d+)%[\s\S]*?([+-]\d+\.\d+)%/i);
  }
  if (!match) {
    match = html.match(/\bVA\b[^>]*>[\s\S]*?<td[^>]*>(\d+\.\d+)%<\/td>[\s\S]*?<td[^>]*>([+-]?\d+\.\d+)%/i);
  }
  if (match) {
    rates['va'] = { rate: match[1], change: match[2] };
  }

  match = html.match(/30\s*Yr\.?\s*Jumbo[\s\S]*?(\d+\.\d+)%[\s\S]*?([+-]\d+\.\d+)%/i);
  if (!match) {
    match = html.match(/>Jumbo<[\s\S]*?(\d+\.\d+)%[\s\S]*?([+-]\d+\.\d+)%/i);
  }
  if (!match) {
    match = html.match(/Jumbo[^>]*>[\s\S]*?<td[^>]*>(\d+\.\d+)%<\/td>[\s\S]*?<td[^>]*>([+-]?\d+\.\d+)%/i);
  }
  if (match) {
    rates['jumbo'] = { rate: match[1], change: match[2] };
  }

  if (!rates['fha'] || !rates['va'] || !rates['jumbo']) {
    const tableMatch = html.match(/Current Mortgage Rates[\s\S]*?<\/table>/i);
    if (tableMatch) {
      const tableHtml = tableMatch[0];
      
      if (!rates['fha']) {
        match = tableHtml.match(/FHA[\s\S]*?(\d+\.\d+)%[\s\S]*?([+-]?\d+\.\d+)%/i);
        if (match) {
          rates['fha'] = { rate: match[1], change: match[2] };
        }
      }
      
      if (!rates['va']) {
        match = tableHtml.match(/\bVA\b[\s\S]*?(\d+\.\d+)%[\s\S]*?([+-]?\d+\.\d+)%/i);
        if (match) {
          rates['va'] = { rate: match[1], change: match[2] };
        }
      }
      
      if (!rates['jumbo']) {
        match = tableHtml.match(/Jumbo[\s\S]*?(\d+\.\d+)%[\s\S]*?([+-]?\d+\.\d+)%/i);
        if (match) {
          rates['jumbo'] = { rate: match[1], change: match[2] };
        }
      }
    }
  }

  if (!rates['fha']) {
    const fhaMatches = [...html.matchAll(/FHA[^%]*?(\d+\.\d+)%[^%]*?([+-]?\d+\.\d+)%/gi)];
    if (fhaMatches.length > 0) {
      rates['fha'] = { rate: fhaMatches[0][1], change: fhaMatches[0][2] };
    }
  }
  
  if (!rates['va']) {
    const vaMatches = [...html.matchAll(/\bVA\b[^%]*?(\d+\.\d+)%[^%]*?([+-]?\d+\.\d+)%/gi)];
    if (vaMatches.length > 0) {
      rates['va'] = { rate: vaMatches[0][1], change: vaMatches[0][2] };
    }
  }
  
  if (!rates['jumbo']) {
    const jumboMatches = [...html.matchAll(/Jumbo[^%]*?(\d+\.\d+)%[^%]*?([+-]?\d+\.\d+)%/gi)];
    if (jumboMatches.length > 0) {
      rates['jumbo'] = { rate: jumboMatches[0][1], change: jumboMatches[0][2] };
    }
  }

  return rates;
}

// ============================================================
// PWA MANIFEST ENDPOINT
// ============================================================

/**
 * GET /manifest.json
 * Serves the Progressive Web App manifest file for mobile app installation
 * 
 * IMPORTANT: Update the icon URLs below after uploading your app icons
 * Icons needed: 192x192 and 512x512 pixels (PNG format)
 * Upload to: imgbb.com, imgur.com, or any image hosting service
 */
async function getManifest(request) {
  // App icons hosted on imgbb.com
  const manifest = {
    "name": "Mtg.Broker - Mortgage Broker Platform",
    "short_name": "MtgBroker",
    "description": "Pipeline tracking, lender search, and mortgage tools for brokers",
    "start_url": "/app/dashboard",
    "display": "standalone",
    "background_color": "#ffffff",
    "theme_color": "#2563eb",
    "orientation": "portrait-primary",
    "icons": [
      {
        "src": "https://i.ibb.co/Rkg1kd76/web-app-manifest-192x192.png",
        "sizes": "192x192",
        "type": "image/png",
        "purpose": "any maskable"
      },
      {
        "src": "https://i.ibb.co/PsPnSMWB/web-app-manifest-512x512.png",
        "sizes": "512x512",
        "type": "image/png",
        "purpose": "any maskable"
      }
    ]
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      ...getCorsHeaders(request)
    }
  });
}

// ============================================================
// PIPELINE CALCULATORS — STATIC JS MODULE
// ============================================================

/**
 * GET /static/pipeline-calcs.js
 * Serves the external calculator module for the Pipeline page.
 * This file is loaded via <script src="..."> after the main pipeline script.
 * Keeping calculator logic external avoids Webflow's 50k embed limit.
 * Cache-busted via ?v= query param when deploying updates.
 */
async function getPipelineCalcsJS(request) {
  const jsContent = `
/**
 * Pipeline Calculators Module v3.2
 * External JS loaded after main pipeline script
 * Served from: /static/pipeline-calcs.js via Cloudflare Worker
 *
 * v3.2 Changes:
 *   - DTI percentages now show 2 decimal places (e.g. 46.99%)
 *   - Calc values saved to localStorage per loan ID
 *   - Opening calc sidebar restores saved values instead of resetting to defaults
 *   - Values persist across page reloads and code/Worker updates
 *
 * v3.1: Current DTI = debts-only / income, Available = Max minus Current
 * v3.0: HOA, 2-column results, DTI color coding
 *
 * Dependencies (from main pipeline script, loaded first):
 *   - parseCurrency(val)
 *   - debounce(fn, ms)
 *   - currentLoanId (global from main script)
 *
 * Globals exposed (called from HTML onclick handlers):
 *   - launchCalculator, showCalcSidebar, closeCalcSidebar
 *   - toggleIncomeMode, toggleCalcTaxMode, toggleCalcInsMode, toggleCalcSuppMode
 *   - toggleCalcHOAMode
 *   - runAffordCalc
 */

/* ---- Toggle state trackers ---- */
var calcIncomeMode = 'annual';
var calcTaxMode    = 'annual';
var calcInsMode    = 'annual';
var calcSuppMode   = 'annual';
var calcHOAMode    = 'monthly';

/* ============================================================
   CALC STATE PERSISTENCE (localStorage per loan)
   Saves all input values + toggle modes so they survive
   page reloads, code updates, and Worker deployments.
   Key format: calc_afford_{loanRecordId}
   ============================================================ */

/* IDs of every input field in the calc sidebar */
var CALC_FIELD_IDS = [
  'calc-income', 'calc-debts', 'calc-taxes', 'calc-insurance',
  'calc-supp-insurance', 'calc-hoa', 'calc-rate', 'calc-qual-rate',
  'calc-term', 'calc-down-pct', 'calc-dti', 'calc-mi-rate'
];

/* Build the localStorage key for the current loan */
function calcStorageKey() {
  if (typeof currentLoanId !== 'undefined' && currentLoanId) {
    return 'calc_afford_' + currentLoanId;
  }
  return null;
}

/* Save all calc field values + toggle modes to localStorage */
function saveCalcState() {
  var key = calcStorageKey();
  if (!key) return;
  var state = { toggles: {} };
  CALC_FIELD_IDS.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) state[id] = el.value;
  });
  state.toggles.income = calcIncomeMode;
  state.toggles.tax    = calcTaxMode;
  state.toggles.ins    = calcInsMode;
  state.toggles.supp   = calcSuppMode;
  state.toggles.hoa    = calcHOAMode;
  try { localStorage.setItem(key, JSON.stringify(state)); } catch(e) {}
}

/* Restore saved calc state from localStorage. Returns true if found. */
function restoreCalcState() {
  var key = calcStorageKey();
  if (!key) return false;
  try {
    var raw = localStorage.getItem(key);
    if (!raw) return false;
    var state = JSON.parse(raw);
    /* Restore field values */
    CALC_FIELD_IDS.forEach(function(id) {
      if (state[id] !== undefined && state[id] !== '') {
        var el = document.getElementById(id);
        if (el) el.value = state[id];
      }
    });
    /* Restore toggle modes + update button highlights */
    if (state.toggles) {
      if (state.toggles.income) {
        calcIncomeMode = state.toggles.income;
        var incRow = document.getElementById('calc-income');
        if (incRow) {
          var fg = incRow.closest('.calc-field-group');
          if (fg) fg.querySelectorAll('.calc-toggle-btn').forEach(function(b) {
            b.classList.toggle('active', b.dataset.mode === calcIncomeMode);
          });
        }
      }
      if (state.toggles.tax) {
        calcTaxMode = state.toggles.tax;
        document.querySelectorAll('.calc-tax-toggle').forEach(function(b) {
          b.classList.toggle('active', b.dataset.mode === calcTaxMode);
        });
      }
      if (state.toggles.ins) {
        calcInsMode = state.toggles.ins;
        document.querySelectorAll('.calc-ins-toggle').forEach(function(b) {
          b.classList.toggle('active', b.dataset.mode === calcInsMode);
        });
      }
      if (state.toggles.supp) {
        calcSuppMode = state.toggles.supp;
        document.querySelectorAll('.calc-supp-toggle').forEach(function(b) {
          b.classList.toggle('active', b.dataset.mode === calcSuppMode);
        });
      }
      if (state.toggles.hoa) {
        calcHOAMode = state.toggles.hoa;
        document.querySelectorAll('.calc-hoa-toggle').forEach(function(b) {
          b.classList.toggle('active', b.dataset.mode === calcHOAMode);
        });
      }
    }
    return true;
  } catch(e) { return false; }
}

/* ---- Calculator launcher (future: other calc types) ---- */
function launchCalculator(calcType) {
  if (calcType === 'Affordability Calculator') { showCalcSidebar(); return; }
  alert(calcType + ' \\u2014 coming soon!');
}

/* ---- Open the sidebar and pre-fill from saved state or modal fields ---- */
function showCalcSidebar() {
  var sb = document.getElementById('calc-sidebar');

  /* Try restoring saved calc state for this loan first */
  var restored = restoreCalcState();

  if (!restored) {
    /* No saved state — pull defaults from the main loan modal fields */
    var noteRate = document.getElementById('loan-interest-rate').value;
    var qualRate = document.getElementById('qualifying-interest-rate').value;
    var term     = document.getElementById('loan-term').value;
    var ltv      = parseFloat(document.getElementById('ltv').value) || 80;

    document.getElementById('calc-rate').value      = noteRate || '6.5';
    document.getElementById('calc-qual-rate').value  = qualRate || '';
    document.getElementById('calc-term').value       = term || '30';
    document.getElementById('calc-down-pct').value   = (100 - ltv).toFixed(1);

    /* Reset toggles to defaults */
    calcIncomeMode = 'annual';
    calcTaxMode    = 'annual';
    calcInsMode    = 'annual';
    calcSuppMode   = 'annual';
    calcHOAMode    = 'monthly';
  }

  /* Reveal and slide in */
  sb.classList.remove('hidden');
  setTimeout(function() { sb.classList.add('open'); }, 10);
  runAffordCalc();
}

/* ---- Close the sidebar ---- */
function closeCalcSidebar() {
  var sb = document.getElementById('calc-sidebar');
  if (!sb) return;
  sb.classList.remove('open');
  setTimeout(function() { sb.classList.add('hidden'); }, 300);
}

/* ============================================================
   TOGGLE FUNCTIONS
   Each converts the displayed value between Annual <-> Monthly,
   updates the mode tracker, highlights the correct button,
   and re-runs the calculator.
   ============================================================ */

/* Income toggle (Annual / Monthly) */
function toggleIncomeMode(mode) {
  var inp = document.getElementById('calc-income');
  var curVal = parseCurrency(inp.value) || 0;
  if (mode === 'monthly' && calcIncomeMode === 'annual' && curVal > 0) {
    inp.value = Math.round(curVal / 12).toLocaleString();
  } else if (mode === 'annual' && calcIncomeMode === 'monthly' && curVal > 0) {
    inp.value = Math.round(curVal * 12).toLocaleString();
  }
  calcIncomeMode = mode;
  var incomeRow = inp.closest('.calc-field-group');
  if (incomeRow) {
    incomeRow.querySelectorAll('.calc-toggle-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
  }
  runAffordCalc();
}

/* Property Taxes toggle (Annual / Monthly) */
function toggleCalcTaxMode(mode) {
  var inp = document.getElementById('calc-taxes');
  var curVal = parseCurrency(inp.value) || 0;
  if (mode === 'monthly' && calcTaxMode === 'annual' && curVal > 0) {
    inp.value = Math.round(curVal / 12).toLocaleString();
  } else if (mode === 'annual' && calcTaxMode === 'monthly' && curVal > 0) {
    inp.value = Math.round(curVal * 12).toLocaleString();
  }
  calcTaxMode = mode;
  document.querySelectorAll('.calc-tax-toggle').forEach(function(b) {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  runAffordCalc();
}

/* Homeowners Insurance toggle (Annual / Monthly) */
function toggleCalcInsMode(mode) {
  var inp = document.getElementById('calc-insurance');
  var curVal = parseCurrency(inp.value) || 0;
  if (mode === 'monthly' && calcInsMode === 'annual' && curVal > 0) {
    inp.value = Math.round(curVal / 12).toLocaleString();
  } else if (mode === 'annual' && calcInsMode === 'monthly' && curVal > 0) {
    inp.value = Math.round(curVal * 12).toLocaleString();
  }
  calcInsMode = mode;
  document.querySelectorAll('.calc-ins-toggle').forEach(function(b) {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  runAffordCalc();
}

/* Supplemental Insurance toggle (Annual / Monthly) */
function toggleCalcSuppMode(mode) {
  var inp = document.getElementById('calc-supp-insurance');
  var curVal = parseCurrency(inp.value) || 0;
  if (mode === 'monthly' && calcSuppMode === 'annual' && curVal > 0) {
    inp.value = Math.round(curVal / 12).toLocaleString();
  } else if (mode === 'annual' && calcSuppMode === 'monthly' && curVal > 0) {
    inp.value = Math.round(curVal * 12).toLocaleString();
  }
  calcSuppMode = mode;
  document.querySelectorAll('.calc-supp-toggle').forEach(function(b) {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  runAffordCalc();
}

/* HOA Dues toggle (Annual / Monthly) */
function toggleCalcHOAMode(mode) {
  var inp = document.getElementById('calc-hoa');
  var curVal = parseCurrency(inp.value) || 0;
  if (mode === 'annual' && calcHOAMode === 'monthly' && curVal > 0) {
    inp.value = Math.round(curVal * 12).toLocaleString();
  } else if (mode === 'monthly' && calcHOAMode === 'annual' && curVal > 0) {
    inp.value = Math.round(curVal / 12).toLocaleString();
  }
  calcHOAMode = mode;
  document.querySelectorAll('.calc-hoa-toggle').forEach(function(b) {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  runAffordCalc();
}

/* ============================================================
   DTI COLOR HELPER
   Returns CSS class based on DTI percentage:
   - green: < 43%
   - yellow: 43-50%
   - red: > 50%
   ============================================================ */
function getDTIColorClass(dti) {
  if (dti < 43) return 'dti-green';
  if (dti <= 50) return 'dti-yellow';
  return 'dti-red';
}

/* ============================================================
   MAIN AFFORDABILITY CALCULATION
   ============================================================ */
function runAffordCalc() {
  /* ---- Parse all inputs ---- */
  var incomeRaw    = parseCurrency(document.getElementById('calc-income').value) || 0;
  var annualIncome = (calcIncomeMode === 'monthly') ? incomeRaw * 12 : incomeRaw;
  var monthlyDebts = parseCurrency(document.getElementById('calc-debts').value) || 0;
  var dtiPct       = parseFloat(document.getElementById('calc-dti').value) || 45;
  var downPct      = parseFloat(document.getElementById('calc-down-pct').value) || 20;

  /* Note Rate vs Qualifying Rate */
  var noteRate     = parseFloat(document.getElementById('calc-rate').value) || 6.5;
  var qualRateVal  = document.getElementById('calc-qual-rate').value;
  var qualRate     = qualRateVal ? parseFloat(qualRateVal) : noteRate;

  var termYears    = parseInt(document.getElementById('calc-term').value) || 30;
  var miRatePct    = parseFloat(document.getElementById('calc-mi-rate').value) || 0;

  /* Taxes -> convert to monthly */
  var taxesRaw = parseCurrency(document.getElementById('calc-taxes').value) || 0;
  var moTaxes  = (calcTaxMode === 'annual') ? taxesRaw / 12 : taxesRaw;

  /* HOI -> convert to monthly */
  var hoiRaw = parseCurrency(document.getElementById('calc-insurance').value) || 0;
  var moHOI  = (calcInsMode === 'annual') ? hoiRaw / 12 : hoiRaw;

  /* Supplemental Insurance -> convert to monthly */
  var suppRaw  = parseCurrency(document.getElementById('calc-supp-insurance').value) || 0;
  var moSupp   = (calcSuppMode === 'annual') ? suppRaw / 12 : suppRaw;

  /* HOA -> convert to monthly */
  var hoaRaw = parseCurrency(document.getElementById('calc-hoa').value) || 0;
  var moHOA  = (calcHOAMode === 'annual') ? hoaRaw / 12 : hoaRaw;

  /* Result elements */
  var elP   = document.getElementById('calc-max-purchase');
  var elL   = document.getElementById('calc-max-loan');
  var elM   = document.getElementById('calc-max-pitia');
  var elB   = document.getElementById('calc-breakdown');
  var elDM  = document.getElementById('calc-max-dti');
  var elDC  = document.getElementById('calc-current-dti');
  var elDA  = document.getElementById('calc-available-dti');

  /* ---- Guard: no income ---- */
  if (annualIncome <= 0) {
    elP.textContent = elL.textContent = elM.textContent = '\\u2014';
    elB.innerHTML = '';
    if (elDM) elDM.textContent = '\\u2014';
    if (elDC) elDC.textContent = '\\u2014';
    if (elDA) elDA.textContent = '\\u2014';
    saveCalcState();
    return;
  }

  /* ---- Calculate max housing budget from DTI ---- */
  var monthlyGross = annualIncome / 12;
  var maxHousing   = monthlyGross * (dtiPct / 100) - monthlyDebts;

  if (maxHousing <= 0) {
    elP.textContent = elL.textContent = '$0';
    elM.textContent = '$0';
    elB.innerHTML = '<div class="calc-payment-line">Housing budget is $0 after debts</div>';
    if (elDM) { elDM.textContent = dtiPct.toFixed(2) + '%'; elDM.className = getDTIColorClass(dtiPct); }
    if (elDC) { var cDTI = (monthlyDebts / monthlyGross) * 100; elDC.textContent = cDTI.toFixed(2) + '%'; elDC.className = getDTIColorClass(cDTI); }
    if (elDA) { var aDTI = dtiPct - (monthlyDebts / monthlyGross) * 100; elDA.textContent = aDTI.toFixed(2) + '%'; elDA.className = aDTI > 0 ? 'dti-green' : 'dti-red'; }
    saveCalcState();
    return;
  }

  /* ---- Solve for max purchase price ---- */
  var r = (qualRate / 100) / 12;
  var n = termYears * 12;
  var pmtFactor = (r > 0)
    ? (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
    : 1 / n;

  var dpFrac        = downPct / 100;
  var miMonthlyRate = miRatePct / 100 / 12;
  var denom         = (1 - dpFrac) * (pmtFactor + miMonthlyRate);

  var maxPurchase = Math.max(0, Math.round((maxHousing - moTaxes - moHOI - moSupp - moHOA) / denom));
  var maxLoan     = Math.round(maxPurchase * (1 - dpFrac));

  /* ---- Compute actual monthly components (NOTE rate for P&I display) ---- */
  var rNote = (noteRate / 100) / 12;
  var pmtFactorNote = (rNote > 0)
    ? (rNote * Math.pow(1 + rNote, n)) / (Math.pow(1 + rNote, n) - 1)
    : 1 / n;

  var moPI      = Math.round(maxLoan * pmtFactorNote);
  var moMI      = Math.round(maxLoan * miMonthlyRate);
  var moTax     = Math.round(moTaxes);
  var moIns     = Math.round(moHOI);
  var moSuppIns = Math.round(moSupp);
  var moHOAamt  = Math.round(moHOA);

  var totalPayment = moPI + moMI + moTax + moIns + moSuppIns + moHOAamt;

  /* ---- DTI Calculations ---- */
  var currentDTI = (monthlyDebts / monthlyGross) * 100;
  var availDTI = dtiPct - currentDTI;

  /* ---- Render results ---- */
  var fCur = function(v) { return '$' + v.toLocaleString(); };

  elP.textContent = fCur(maxPurchase);
  elL.textContent = fCur(maxLoan);
  elM.textContent = fCur(Math.round(maxHousing));

  if (elDM) {
    elDM.textContent = dtiPct.toFixed(2) + '%';
    elDM.className = getDTIColorClass(dtiPct);
  }
  if (elDC) {
    elDC.textContent = currentDTI.toFixed(2) + '%';
    elDC.className = getDTIColorClass(currentDTI);
  }
  if (elDA) {
    elDA.textContent = availDTI.toFixed(2) + '%';
    elDA.className = availDTI > 0 ? 'dti-green' : 'dti-red';
  }

  /* Build payment breakdown */
  var lines = [];
  lines.push('<div class="calc-payment-line"><span>P&I</span><span>' + fCur(moPI) + '</span></div>');
  if (moMI > 0) lines.push('<div class="calc-payment-line"><span>MI</span><span>' + fCur(moMI) + '</span></div>');
  lines.push('<div class="calc-payment-line"><span>Taxes</span><span>' + fCur(moTax) + '</span></div>');
  lines.push('<div class="calc-payment-line"><span>HOI</span><span>' + fCur(moIns) + '</span></div>');
  if (moSuppIns > 0) lines.push('<div class="calc-payment-line"><span>Supp Ins</span><span>' + fCur(moSuppIns) + '</span></div>');
  if (moHOAamt > 0) lines.push('<div class="calc-payment-line"><span>HOA</span><span>' + fCur(moHOAamt) + '</span></div>');
  lines.push('<div class="calc-payment-total"><span>Total</span><span>' + fCur(totalPayment) + '</span></div>');

  elB.innerHTML = lines.join('');

  /* Save state to localStorage after every calculation */
  saveCalcState();
}

/* ---- Attach input listeners so calc updates on every keystroke ---- */
(function attachCalcListeners() {
  var calcIds = [
    'calc-income', 'calc-debts', 'calc-dti', 'calc-down-pct',
    'calc-rate', 'calc-qual-rate', 'calc-term', 'calc-mi-rate',
    'calc-taxes', 'calc-insurance', 'calc-supp-insurance',
    'calc-hoa'
  ];
  var debouncedCalc = debounce(runAffordCalc, 200);
  calcIds.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', debouncedCalc);
  });
})();
`;
  return new Response(jsContent, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=86400', // Cache 24 hours, bust with ?v=
      ...getCorsHeaders(request)
    }
  });
}

// ============================================================
// LOAN PRODUCT TYPES ENDPOINT
// Used by the Products detail page (/app/products/{slug})
// ============================================================

/**
 * Fetch and cache the Loan Product Types Config table.
 * Returns a Map: fieldName → { displayName, section, sectionOrder, fieldOrder }
 * Only includes rows where "Show on Page" is checked.
 *
 * Cached for 30 minutes in loanProductTypesConfigCache.
 * Pass bypassCache=true to force a fresh fetch (used when ?refresh=true).
 */
async function fetchLoanProductTypesConfig(apiKey, bypassCache = false) {
  const now = Date.now();
  if (
    !bypassCache &&
    loanProductTypesConfigCache &&
    loanProductTypesConfigCacheTimestamp &&
    (now - loanProductTypesConfigCacheTimestamp) < LOAN_PRODUCT_TYPES_CONFIG_CACHE_DURATION
  ) {
    return loanProductTypesConfigCache;
  }

  // Fetch all records where Show on Page = true
  const filterFormula = encodeURIComponent('AND({Show on Page} = 1, {Field Name} != "")');
  const fields = [
    'Field Name',
    'Display Name',
    'Section',
    'Section Order',
    'Field Order',
    'Render Mode',
    'NEXA Gated'
  ].map(f => `fields%5B%5D=${encodeURIComponent(f)}`).join('&');

  const url = `${TABLES.LOAN_PRODUCT_TYPES_CONFIG}?filterByFormula=${filterFormula}&${fields}&pageSize=100`;
  const response = await airtableRequest(url, apiKey);

  if (response.error || !response.records) {
    console.error('fetchLoanProductTypesConfig error:', response.error);
    return new Map();
  }

  const config = new Map();
  for (const record of response.records) {
    const f = record.fields;
    const fieldName = f['Field Name'];
    if (!fieldName) continue;

    config.set(fieldName, {
      displayName: f['Display Name'] || fieldName,
      section: f['Section'] || 'Other',
      sectionOrder: f['Section Order'] ?? 99,
      fieldOrder: f['Field Order'] ?? 99,
      renderMode: f['Render Mode'] || null,
      nexaGated: f['NEXA Gated'] === true
    });
  }

  console.log(`Loaded Loan Product Types config: ${config.size} fields`);
  loanProductTypesConfigCache = config;
  loanProductTypesConfigCacheTimestamp = now;
  return config;
}

/**
 * GET /api/loan-product-types?slug={webflow-slug}
 *
 * Fetches a single record from the Loan Product Types table, then applies
 * the Loan Product Types Config to:
 *   - Only return fields where "Show on Page" is checked
 *   - Return the Display Name (renamed label) for each field
 *   - Group fields into sections sorted by Section Order / Field Order
 *
 * Response shape:
 * {
 *   success: true,
 *   product: {
 *     name: "FHA",
 *     lendersRollup: "Rocket, UWM",   // always included for the lenders section
 *     categoryTags: "Government",      // always included for header subtitle
 *     sections: [
 *       {
 *         name: "Overview",
 *         order: 1,
 *         fields: [
 *           { fieldName, displayName, value, fieldOrder },
 *           ...
 *         ]
 *       },
 *       ...
 *     ]
 *   }
 * }
 *
 * Cache: 10 minutes per slug.
 */
async function getLoanProductType(apiKey, request) {
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get('slug');
    const bypassCache = url.searchParams.get('refresh') === 'true';

    if (!slug) {
      return jsonResponse({ success: false, error: 'Missing ?slug= parameter' }, 400, request);
    }

    // --- Check per-slug cache ---
    const now = Date.now();
    const cached = loanProductTypesCache.get(slug);
    if (!bypassCache && cached && (now - cached.timestamp) < LOAN_PRODUCT_TYPES_CACHE_DURATION) {
      return jsonResponse({ success: true, cached: true, product: cached.data }, 200, request);
    }

    // --- Fetch config and product record in parallel ---
    const [fieldConfig, recordResponse] = await Promise.all([
      fetchLoanProductTypesConfig(apiKey, bypassCache),
      airtableRequest(
        `${TABLES.LOAN_PRODUCT_TYPES}?filterByFormula=${encodeURIComponent(`{Webflow Slug} = "${slug}"`)}&pageSize=1`,
        apiKey
      )
    ]);

    if (recordResponse.error) {
      return jsonResponse({ success: false, error: 'Airtable API error' }, 500, request);
    }
    if (!recordResponse.records || recordResponse.records.length === 0) {
      return jsonResponse({ success: false, error: 'Product not found' }, 404, request);
    }

    const record = recordResponse.records[0];
    const rawFields = record.fields;

    // --- Build sections from config ---
    // We iterate the config (which only has "Show on Page = true" fields)
    // and pull matching values from the raw Airtable record.
    const sectionsMap = new Map(); // sectionName → { order, fields: [] }

    for (const [fieldName, meta] of fieldConfig.entries()) {
      const rawValue = rawFields[fieldName];

      // Skip if the field has no value in this record
      if (rawValue === undefined || rawValue === null) continue;

      // Skip AI objects ({ state, value, isStale })
      if (typeof rawValue === 'object' && !Array.isArray(rawValue) && 'state' in rawValue) continue;

      // Skip linked-record ID arrays (recXXX)
      if (Array.isArray(rawValue) && rawValue.length > 0 &&
          typeof rawValue[0] === 'string' && rawValue[0].startsWith('rec')) continue;

      // Skip empty strings and dash-only values
      if (typeof rawValue === 'string' && (!rawValue.trim() || rawValue.trim() === '-')) continue;

      // Normalise attachment arrays → keep only useful properties
      let value = rawValue;
      if (Array.isArray(rawValue) && rawValue.length > 0 && typeof rawValue[0] === 'object' && rawValue[0].url) {
        value = rawValue.map(att => ({ url: att.url, filename: att.filename || '', type: att.type || '' }));
      }

      const { section, sectionOrder, fieldOrder, displayName, renderMode, nexaGated } = meta;

      if (!sectionsMap.has(section)) {
        sectionsMap.set(section, { name: section, order: sectionOrder, hasNexa: false, fields: [] });
      }

      const sectionEntry = sectionsMap.get(section);
      if (nexaGated) sectionEntry.hasNexa = true;

      // renderMode and nexaGated are both per-field — page JS handles each independently
      sectionEntry.fields.push({ fieldName, displayName, value, fieldOrder, renderMode: renderMode || 'list', nexaGated });
    }

    // Sort sections by order, then fields within each section by fieldOrder
    const sections = Array.from(sectionsMap.values())
      .sort((a, b) => a.order - b.order);

    for (const section of sections) {
      section.fields.sort((a, b) => a.fieldOrder - b.fieldOrder);
    }

    // --- Always-present top-level fields (used by header + lenders section) ---
    const product = {
      id: record.id,
      name: rawFields['Loan Product Type'] || slug,
      lendersRollup: rawFields['Available Lenders (Rollup)'] || '',
      categoryTags: rawFields['Catergory Tags'] || rawFields['Category Tags'] || '',
      sections
    };

    // --- Cache and return ---
    loanProductTypesCache.set(slug, { data: product, timestamp: now });
    return jsonResponse({ success: true, cached: false, product }, 200, request);

  } catch (error) {
    console.error('getLoanProductType error:', error);
    return jsonResponse({ success: false, error: 'An internal error occurred. Please try again.' }, 500, request);
  }
}

// ============================================================
// LOAN PRODUCTS ENDPOINT (WITH CONFIG TABLE + DISPLAY NAME)
// ============================================================

/**
 * GET /api/loan-products
 * Fetches all loan products from Airtable for the dynamic loan search
 * 
 * Config Table Fields:
 * - Field Name: The actual Airtable field name (used for data access)
 * - Display Name: What shows in the UI (optional, uses Field Name if blank)
 * - Show in Picker: Checkbox to show/hide
 * - Group Name: Single select for grouping
 * - Group Order: Number for group sort order
 * - Field Order: Number for field sort order within group
 */
async function getLoanProducts(apiKey, request) {
  try {
    const url = new URL(request.url);
    const bypassCache = url.searchParams.get('refresh') === 'true';
    
    const now = Date.now();
    if (!bypassCache && loanProductsCache && loanProductsCacheTimestamp && (now - loanProductsCacheTimestamp) < LOAN_PRODUCTS_CACHE_DURATION) {
      console.log('Returning cached loan products');
      return jsonResponse({
        success: true,
        cached: true,
        ...loanProductsCache
      }, 200, request);
    }

    console.log('Fetching fresh loan products from Airtable');
    
    const [fieldConfig, productsData, lenderLogos] = await Promise.all([
      fetchFieldConfig(apiKey),
      fetchAllLoanProducts(apiKey),
      fetchLenderLogos(apiKey)
    ]);

    const { fieldMetadata, groups } = applyFieldConfig(productsData.fieldMetadata, fieldConfig);

    // FIXED FOR V6.15: Convert fieldMetadata array to object format
    const fieldMetadataObject = {};
    const allFieldNames = [];

    fieldMetadata.forEach(field => {
      allFieldNames.push(field.name);
      fieldMetadataObject[field.name] = {
        label: field.displayName || field.name,
        type: field.type || 'text',
        groupName: field.groupName,
        groupOrder: field.groupOrder,
        fieldOrder: field.fieldOrder,
        filterOrder: field.filterOrder || null,  // Separate filter ordering
        filterable: field.detailOnly ? false : true,  // v7.10: detail-only fields NOT filterable
        detailOnly: field.detailOnly || false,         // v7.10: flag for frontend
        sampleValues: field.sampleValues || []  // Preserve sample values for filter rendering
      };
    });

    // Extract core columns (Group Order = 1) sorted by Field Order
    // v7.10: Exclude detail-only fields from table columns
    const coreColumns = fieldMetadata
      .filter(f => f.groupOrder === 1 && !f.detailOnly)
      .sort((a, b) => a.fieldOrder - b.fieldOrder)
      .map(f => f.name);

    const cacheData = {
      products: productsData.products,
      fieldMetadata: fieldMetadataObject,      // Object format (not array)
      allFields: allFieldNames,                 // Array of all 16 field names
      coreColumns: coreColumns,                 // Core columns for initial display
      visibleColumns: coreColumns.slice(0, 8),  // First 8 core columns
      lenderLogos,                              // v7.20: Lender name → logo URL map
      groups,
      totalCount: productsData.products.length,
      timestamp: new Date().toISOString()
    };

    loanProductsCache = cacheData;
    loanProductsCacheTimestamp = now;

    console.log(`Loaded ${productsData.products.length} loan products with ${allFieldNames.length} visible fields in ${groups.length} groups`);

    return jsonResponse({
      success: true,
      cached: false,
      ...cacheData
    }, 200, request);

  } catch (error) {
    console.error('Loan products error:', error);
    return jsonResponse({
      success: false,
      error: 'An internal error occurred. Please try again.'
    }, 500, request);
  }
}

/**
 * Fetch field configuration from the Loan Search Config table
 * v7.10: Now fetches BOTH "Show in Picker" = TRUE and "Show in Detail Only" = TRUE
 * Detail-only fields appear in the product detail modal but NOT in filters or column picker
 */
async function fetchFieldConfig(apiKey) {
  const allRecords = [];
  let offset = null;

  do {
    // v7.10: Fetch fields where EITHER Show in Picker OR Show in Detail Only is TRUE
    const filterFormula = encodeURIComponent('OR({Show in Picker}=TRUE(),{Show in Detail Only}=TRUE())');
    let url = `${TABLES.LOAN_SEARCH_CONFIG}?filterByFormula=${filterFormula}&pageSize=100`;
    
    if (offset) {
      url += `&offset=${offset}`;
    }

    const response = await airtableRequest(url, apiKey);

    if (response.error) {
      console.warn('Config table fetch failed, using defaults:', response.error);
      return {};
    }

    if (response.records) {
      allRecords.push(...response.records);
    }

    offset = response.offset || null;

  } while (offset);

  const config = {};
  
  for (const record of allRecords) {
    const fields = record.fields;
    const fieldName = fields['Field Name'];
    
    if (fieldName) {
      // Handle Group Name - can be string or object {name: "..."} from single select
      let groupName = fields['Group Name'];
      if (groupName && typeof groupName === 'object') {
        groupName = groupName.name;
      }
      
      // v7.10: Track whether this is a detail-only field
      // Detail-only fields: Show in Detail Only = TRUE but Show in Picker may be FALSE
      const showInPicker = fields['Show in Picker'] === true;
      const showInDetailOnly = fields['Show in Detail Only'] === true;
      const isDetailOnly = showInDetailOnly && !showInPicker;

      config[fieldName] = {
        show: true,  // Always true now since we filtered by OR condition
        displayName: fields['Display Name'] || null,
        groupName: groupName || 'Other',
        groupOrder: fields['Group Order'] || 99,
        fieldOrder: fields['Column Field Order'] || 99,
        filterOrder: fields['Filter Order'] || null,
        detailOnly: isDetailOnly  // v7.10: true = only show in product detail modal
      };
    }
  }

  const detailOnlyCount = Object.values(config).filter(c => c.detailOnly).length;
  console.log(`Loaded config for ${Object.keys(config).length} fields (${detailOnlyCount} detail-only)`);
  return config;
}

/**
 * Fetch all loan products from Airtable (handles pagination)
 */
async function fetchAllLoanProducts(apiKey) {
  const allRecords = [];
  let offset = null;
  let fieldMetadata = null;

  do {
    let url = `${TABLES.LOAN_PRODUCTS}?pageSize=100`;
    if (offset) {
      url += `&offset=${offset}`;
    }

    const response = await airtableRequest(url, apiKey);

    if (response.error) {
      console.error('Airtable error:', response.error);
      throw new Error(response.error.message || 'Airtable API error');
    }

    if (!fieldMetadata && response.records && response.records.length > 0) {
      fieldMetadata = extractFieldMetadata(response.records);
    }

    if (response.records) {
      allRecords.push(...response.records);
    }

    offset = response.offset || null;

  } while (offset);

  const products = allRecords.map(record => ({
    id: record.id,
    ...record.fields
  }));

  return {
    products,
    fieldMetadata: fieldMetadata || []
  };
}

/**
 * v7.20: Fetch lender logos from the Lender List table.
 * Returns a map of lender name → logo URL for the loan search table rendering.
 * Only fetches Name and Logo fields to keep the payload small.
 */
async function fetchLenderLogos(apiKey) {
  const logoMap = {};
  let offset = null;

  try {
    do {
      const fields = encodeURIComponent('fields[]') + '=Lender+Name&' + encodeURIComponent('fields[]') + '=Logo';
      let url = `${TABLES.LENDER_LIST}?${fields}&pageSize=100`;
      if (offset) url += `&offset=${offset}`;

      const response = await airtableRequest(url, apiKey);
      if (response.error) break;

      if (response.records) {
        response.records.forEach(rec => {
          const name = rec.fields['Lender Name'];
          const logo = rec.fields['Logo'];
          if (name && logo && Array.isArray(logo) && logo.length > 0 && logo[0].url) {
            logoMap[name] = logo[0].url;
          }
        });
      }

      offset = response.offset || null;
    } while (offset);
  } catch (err) {
    console.error('Failed to fetch lender logos:', err.message);
    // Non-fatal — return whatever we have (could be empty)
  }

  return logoMap;
}

/**
 * Apply config to field metadata
 * Now includes displayName for custom column labels
 */
function applyFieldConfig(fieldMetadata, config) {
  const enhancedFields = [];
  const groupsMap = {};
  const processedFieldNames = new Set();  // v7.10: Track which config fields were matched

  for (const field of fieldMetadata) {
    const fieldConfig = config[field.name];
    
    // NEW LOGIC: If field is NOT in config, skip it
    // Only fields with "Show in Picker" = TRUE are in the config now
    if (!fieldConfig) {
      continue;
    }

    processedFieldNames.add(field.name);  // v7.10: Mark as processed

    const groupName = fieldConfig.groupName || 'Other';
    const groupOrder = fieldConfig.groupOrder || 99;
    const fieldOrder = fieldConfig.fieldOrder || 99;
    const filterOrder = fieldConfig.filterOrder || null;  // Separate filter position
    
    // Use displayName if provided, otherwise use original field name
    const displayName = fieldConfig.displayName || field.name;

    // Track groups
    if (!groupsMap[groupName]) {
      groupsMap[groupName] = {
        name: groupName,
        order: groupOrder,
        fields: []
      };
    }

    // Add enhanced field info with both name (for data) and displayName (for UI)
    const enhancedField = {
      ...field,
      displayName,      // The name shown in the UI
      groupName,
      groupOrder,
      fieldOrder,
      filterOrder,       // Filter-specific ordering (null = use fieldOrder)
      detailOnly: fieldConfig.detailOnly || false  // v7.10: detail-only fields skip filters/columns
    };

    enhancedFields.push(enhancedField);
    groupsMap[groupName].fields.push(enhancedField);
  }

  // v7.10: Second pass — add config fields that weren't discovered in the record sample.
  // This happens when fields like "NEXA Docs" or "NEXA Specific Notes" are sparse
  // (not populated in the first 50 records that extractFieldMetadata samples).
  // These fields still need to be in fieldMetadata so the frontend can display them
  // in the product detail modal when a specific product DOES have the data.
  for (const [fieldName, fieldConfig] of Object.entries(config)) {
    if (processedFieldNames.has(fieldName)) continue;  // Already handled above

    const groupName = fieldConfig.groupName || 'Other';
    const groupOrder = fieldConfig.groupOrder || 99;
    const fieldOrder = fieldConfig.fieldOrder || 99;
    const filterOrder = fieldConfig.filterOrder || null;
    const displayName = fieldConfig.displayName || fieldName;

    if (!groupsMap[groupName]) {
      groupsMap[groupName] = {
        name: groupName,
        order: groupOrder,
        fields: []
      };
    }

    const enhancedField = {
      name: fieldName,
      type: 'text',          // Default type since we couldn't detect from data
      hasData: true,          // Assume it has data somewhere
      sampleValues: [],
      displayName,
      groupName,
      groupOrder,
      fieldOrder,
      filterOrder,
      detailOnly: fieldConfig.detailOnly || false
    };

    enhancedFields.push(enhancedField);
    groupsMap[groupName].fields.push(enhancedField);
    console.log(`v7.10: Added config-only field "${fieldName}" (group: ${groupName})`);
  }

  // Sort fields within each group by fieldOrder, then alphabetically by displayName
  for (const group of Object.values(groupsMap)) {
    group.fields.sort((a, b) => {
      if (a.fieldOrder !== b.fieldOrder) {
        return a.fieldOrder - b.fieldOrder;
      }
      return a.displayName.localeCompare(b.displayName);
    });
  }

  // Convert groups to sorted array
  const groups = Object.values(groupsMap).sort((a, b) => a.order - b.order);

  // Sort all fields by group order, then field order, then displayName
  enhancedFields.sort((a, b) => {
    if (a.groupOrder !== b.groupOrder) {
      return a.groupOrder - b.groupOrder;
    }
    if (a.fieldOrder !== b.fieldOrder) {
      return a.fieldOrder - b.fieldOrder;
    }
    return a.displayName.localeCompare(b.displayName);
  });

  return {
    fieldMetadata: enhancedFields,
    groups
  };
}

/**
 * Extract field metadata from records
 */
function extractFieldMetadata(records) {
  const fields = {};
  const sampleSize = Math.min(records.length, 50);
  
  for (let i = 0; i < sampleSize; i++) {
    const record = records[i];
    if (!record.fields) continue;

    for (const [fieldName, value] of Object.entries(record.fields)) {
      if (!fields[fieldName]) {
        fields[fieldName] = {
          name: fieldName,
          type: detectFieldType(fieldName, value),
          hasData: false,
          sampleValues: []
        };
      }

      if (value !== null && value !== '' && value !== undefined) {
        fields[fieldName].hasData = true;
        
        if (fields[fieldName].sampleValues.length < 20) {
          const stringValue = String(value);
          if (!fields[fieldName].sampleValues.includes(stringValue)) {
            fields[fieldName].sampleValues.push(stringValue);
          }
        }
      }
    }
  }

  return Object.values(fields).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Detect field type from field name and sample value
 */
function detectFieldType(fieldName, value) {
  if (value === null || value === undefined) {
    return 'text';
  }

  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === 'object' && value[0].url) {
      return 'attachment';
    }
    return 'multiselect';
  }

  if (typeof value === 'number') {
    const nameLower = fieldName.toLowerCase();
    if (nameLower.includes('fee') || nameLower.includes('amount') || nameLower.includes('price')) {
      return 'currency';
    }
    if (nameLower.includes('ltv') || nameLower.includes('dti') || nameLower.includes('ratio') || nameLower.includes('%')) {
      return 'percent';
    }
    return 'number';
  }

  if (typeof value === 'boolean') {
    return 'checkbox';
  }

  if (typeof value === 'string') {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return 'url';
    }
    
    if (value.includes('%') && /\d+(\.\d+)?%/.test(value)) {
      return 'percent';
    }

    if (value.startsWith('$') || /^\$[\d,]+/.test(value)) {
      return 'currency';
    }

    const valueLower = value.toLowerCase().trim();
    if (['yes', 'no', 'true', 'false', 'y', 'n'].includes(valueLower)) {
      return 'yesno';
    }

    const nameLower = fieldName.toLowerCase();
    if (nameLower.includes('allowed') || nameLower.includes('required') || nameLower.includes('available')) {
      return 'yesno';
    }
  }

  return 'text';
}

/**
 * Clear the loan products cache
 */
async function clearLoanProductsCache(request) {
  loanProductsCache = null;
  loanProductsCacheTimestamp = null;
  return jsonResponse({ 
    success: true, 
    message: 'Loan products cache cleared' 
  }, 200, request);
}

// ============================================================
// PRODUCTS LIST ENDPOINT — serves /app/products listing page
// Fetches all Loan Product Types from Airtable (with pagination),
// returns a clean sorted array for the frontend.
// Cached for 10 minutes in Worker memory.
// ============================================================

/**
 * GET /api/products-list
 * Returns all loan product types for the Products listing page.
 * No auth required — the Webflow page is Outseta-gated.
 * Fields returned per product: name, slug, categoryTags, lendersRollup, sortName, firstLetter
 */
async function fetchProductsList(apiKey, request) {
  const now = Date.now();

  // Return cached data if still fresh
  if (productsListCache && productsListCacheTimestamp && (now - productsListCacheTimestamp < PRODUCTS_LIST_CACHE_DURATION)) {
    console.log('Products list cache HIT');
    return jsonResponse(productsListCache, 200, request);
  }

  console.log('Products list cache MISS - fetching from Airtable');

  // Fields to pull from the Loan Product Types table
  // Primary name field is "Loan Product Type"; categories are in the "Category" multipleSelects field
  const fields = ['Loan Product Type', 'Webflow Slug', 'Category', 'Available Lenders (Rollup)', 'Sort Name Override'];
  const fieldsParam = fields.map(f => `fields[]=${encodeURIComponent(f)}`).join('&');

  // Airtable returns max 100 records per page — loop until no more offset
  let allRecords = [];
  let offset = null;

  try {
    do {
      let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLES.LOAN_PRODUCT_TYPES}?${fieldsParam}`;
      if (offset) url += `&offset=${encodeURIComponent(offset)}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Products list: Airtable error ${response.status}: ${errorBody}`);
        return jsonResponse({ error: 'Airtable API error', status: response.status }, 502, request);
      }

      const data = await response.json();
      allRecords = allRecords.concat(data.records || []);
      offset = data.offset || null;

    } while (offset);

  } catch (err) {
    console.error('Products list fetch error:', err.message);
    return jsonResponse({ error: 'Failed to fetch products list' }, 500, request);
  }

  console.log(`Products list: fetched ${allRecords.length} records from Airtable`);

  // Transform records into clean objects for the frontend
  const products = allRecords.map(record => {
    const f = record.fields;
    const name = f['Loan Product Type'] || '';
    const sortName = (f['Sort Name Override'] || name).toLowerCase();
    const firstLetter = sortName.charAt(0).toUpperCase();

    // Category — Airtable multipleSelects comes back as an array
    const categoryTags = Array.isArray(f['Category']) ? f['Category'] : [];

    // Available Lenders (Rollup) — normalize to string
    const lendersRollup = f['Available Lenders (Rollup)']
      ? (Array.isArray(f['Available Lenders (Rollup)'])
          ? f['Available Lenders (Rollup)'].join(', ')
          : String(f['Available Lenders (Rollup)']))
      : '';

    return {
      name,
      slug: f['Webflow Slug'] || '',
      categoryTags,
      lendersRollup,
      sortName,
      firstLetter: /[A-Z]/.test(firstLetter) ? firstLetter : '#'
    };
  });

  // Sort alphabetically by sortName
  products.sort((a, b) => a.sortName.localeCompare(b.sortName));

  const result = {
    products,
    count: products.length,
    lastUpdated: new Date().toISOString()
  };

  // Store in cache
  productsListCache = result;
  productsListCacheTimestamp = now;

  return jsonResponse(result, 200, request);
}

/**
 * GET /api/products-list/clear-cache
 * Clears the products list in-memory cache.
 * Useful after adding/renaming products in Airtable.
 */
async function clearProductsListCache(request) {
  productsListCache = null;
  productsListCacheTimestamp = null;
  return jsonResponse({ success: true, message: 'Products list cache cleared' }, 200, request);
}

// ============================================================
// CREDIT VENDORS ENDPOINT (for NEXA Credit Reports page)
// ============================================================

/**
 * GET /api/credit-vendors
 * Returns credit reporting vendors with pricing data from Airtable
 * No authentication required (page-level NEXA gating handles access)
 * Cached for 30 minutes since pricing data changes rarely
 *
 * v7.19: Enhanced error handling — separate try/catch for Airtable fetch
 *        vs data transform so we can pinpoint failures. Returns error
 *        detail in the response body for debugging.
 */
async function handleCreditVendors(request, env, corsHeaders) {
  // Only allow GET requests
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Check cache first
  const now = Date.now();
  if (creditVendorsCache && creditVendorsCacheTimestamp && (now - creditVendorsCacheTimestamp < CREDIT_VENDORS_CACHE_DURATION)) {
    console.log('Credit vendors cache HIT');
    return new Response(JSON.stringify(creditVendorsCache), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  console.log('Credit vendors cache MISS - fetching from Airtable');

  // ---- STEP 1: Build URL and fetch from Airtable ----
  let data;
  try {
    const apiKey = env.AIRTABLE_API_KEY;
    if (!apiKey) {
      console.error('AIRTABLE_API_KEY is missing from env');
      return new Response(JSON.stringify({ error: 'An internal error occurred. Please try again.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Filter: Category contains "Credit Reporting"
    const filterFormula = encodeURIComponent('FIND("Credit Reporting", ARRAYJOIN({Category}))');
    
    // Fields we need for the pricing chart
    // NOTE: Field names updated 2/2026 to match renamed Airtable columns
    // NOTE: v7.19 — 'SmartPay Option' does NOT have the 'Credit Reports -' prefix
    const fields = [
      'Vendor Name',
      'Category',
      'Logo',
      'Corporate Website',
      'Login Portal',
      'Support Phone Number',
      'Support Email',
      'NEXA Approved',
      'NEXA Specific Notes',
      // Hard Pull pricing (renamed from "Trimerge Cost")
      'Credit Reports - Hard Pull | Trimerge | Individual',
      'Credit Reports - Hard Pull | Trimerge | Joint',
      // Soft Pull pricing (renamed from "Single Bureau Soft Pull")
      'Credit Reports - Soft Pull | Non-trended | 1 Bureau | Individual',
      'Credit Reports - Soft Pull | Non-trended | 1 Bureau | Joint',
      'Credit Reports - Soft Pull | Non-trended | Trimerge | Individual',
      'Credit Reports - Soft Pull | Non-trended | Trimerge | Joint',
      'Credit Reports - Soft Pull | Trended (AUS) | 1 Bureau | Individual',
      'Credit Reports - Softpull | Trended (AUS) | 1 Bureau | Joint',
      'Credit Reports - Soft Pull | Trended (AUS) | Trimerge | Individual',
      'Credit Reports - Soft Pull | Trended (AUS) | Trimerge | Joint',
      // Additional fees
      'Credit Reports - Rescore Fee (Per Bureau / Per Trade)',
      'Credit Reports - Tax Transcript Cost (4506-T)',
      'Credit Reports - VOE / VOI (TWN)',
      'Credit Reports - VOE / VOI (Argyle)',
      'Credit Reports - UDN (Undisclosed Debt Monitoring) Cost',
      // Features
      'Credit Reports - Score Navigator Available',
      'Credit Reports - Score Navigator Cost (If any)',
      'Credit Reports - SoftPull Trended (AUS)',
      'Credit Reports - Softpull Non-Trended',
      // v7.19 FIX: Field is 'SmartPay Option' (no 'Credit Reports -' prefix)
      'SmartPay Option',
      'Pricing Note',
      'Link to Pricing',
      'Account Rep (Rollup)',
      'Contact Name (from Account Rep)',
      'Vendor Description (Final)',
      'NEXA Doc 1',
      'NEXA Doc 1 Title',
      'Webflow Slug'
    ];

    const fieldsParam = fields.map(f => `fields%5B%5D=${encodeURIComponent(f)}`).join('&');
    
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLES.VENDORS}?filterByFormula=${filterFormula}&${fieldsParam}&sort%5B0%5D%5Bfield%5D=Vendor+Name&sort%5B0%5D%5Bdirection%5D=asc`;

    console.log(`Credit vendors: Fetching from Airtable (URL length: ${url.length})`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`Credit vendors: Airtable responded with status ${response.status}`);

    if (!response.ok) {
      // Log the full error body from Airtable
      let errorBody = '';
      try { errorBody = await response.text(); } catch (_) { errorBody = '(could not read body)'; }
      console.error(`Credit vendors: Airtable API error ${response.status}: ${errorBody}`);
      return new Response(JSON.stringify({
        error: 'An internal error occurred. Please try again.'
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    data = await response.json();
    console.log(`Credit vendors: Airtable returned ${data.records ? data.records.length : 'NO'} records`);

  } catch (fetchError) {
    // Network error, DNS failure, timeout, etc.
    console.error('Credit vendors FETCH error:', fetchError.message, fetchError.stack);
    return new Response(JSON.stringify({
      error: 'Failed to fetch credit vendor data. Please try again.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // ---- STEP 2: Transform the Airtable data for the frontend ----
  try {
    if (!data || !data.records) {
      console.error('Credit vendors: data.records is missing from Airtable response');
      return new Response(JSON.stringify({
        error: 'An internal error occurred. Please try again.'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const vendors = data.records.map(record => {
      const f = record.fields;
      return {
        id: record.id,
        name: f['Vendor Name'] || '',
        nexaApproved: f['NEXA Approved'] || '--',
        logo: f['Logo'] ? f['Logo'][0]?.url : null,
        website: f['Corporate Website'] || '',
        loginPortal: f['Login Portal'] || '',
        supportPhone: f['Support Phone Number'] || '',
        supportEmail: f['Support Email'] || '',
        webflowSlug: f['Webflow Slug'] || '',
        description: f['Vendor Description (Final)'] || '',
        accountRep: f['Account Rep (Rollup)'] || '',
        pricingNote: f['Pricing Note'] || '',
        nexaNotes: f['NEXA Specific Notes'] || '',
        nexaDoc: f['NEXA Doc 1'] ? {
          url: f['NEXA Doc 1'][0]?.url,
          filename: f['NEXA Doc 1'][0]?.filename,
          title: f['NEXA Doc 1 Title'] || 'Pricing Document'
        } : null,
        pricing: {
          // Hard Pull (renamed from "Trimerge Cost") - used in pricing table and cards
          trimergeIndividual: f['Credit Reports - Hard Pull | Trimerge | Individual'] ?? null,
          trimergeJoint: f['Credit Reports - Hard Pull | Trimerge | Joint'] ?? null,
          // Soft Pull - primary display value uses Non-trended 1 Bureau Individual
          softPullIndividual: f['Credit Reports - Soft Pull | Non-trended | 1 Bureau | Individual'] ?? null,
          softPullJoint: f['Credit Reports - Soft Pull | Non-trended | 1 Bureau | Joint'] ?? null,
          // Additional soft pull tiers
          softPullTrimergeIndividual: f['Credit Reports - Soft Pull | Non-trended | Trimerge | Individual'] ?? null,
          softPullTrimergeJoint: f['Credit Reports - Soft Pull | Non-trended | Trimerge | Joint'] ?? null,
          softPullTrendedIndividual: f['Credit Reports - Soft Pull | Trended (AUS) | 1 Bureau | Individual'] ?? null,
          softPullTrendedJoint: f['Credit Reports - Softpull | Trended (AUS) | 1 Bureau | Joint'] ?? null,
          softPullTrendedTrimergeIndividual: f['Credit Reports - Soft Pull | Trended (AUS) | Trimerge | Individual'] ?? null,
          softPullTrendedTrimergeJoint: f['Credit Reports - Soft Pull | Trended (AUS) | Trimerge | Joint'] ?? null,
          // Additional fees
          rescoreFee: f['Credit Reports - Rescore Fee (Per Bureau / Per Trade)'] ?? null,
          taxTranscriptCost: f['Credit Reports - Tax Transcript Cost (4506-T)'] ?? null,
          voeTwnCost: f['Credit Reports - VOE / VOI (TWN)'] ?? null,
          voeArgyleCost: f['Credit Reports - VOE / VOI (Argyle)'] ?? null,
          udnCost: f['Credit Reports - UDN (Undisclosed Debt Monitoring) Cost'] ?? null,
        },
        features: {
          scoreNavigator: f['Credit Reports - Score Navigator Available'] || '--',
          scoreNavigatorCost: f['Credit Reports - Score Navigator Cost (If any)'] ?? null,
          softPullTrended: f['Credit Reports - SoftPull Trended (AUS)'] || '--',
          softPullNonTrended: f['Credit Reports - Softpull Non-Trended'] || '--',
          // v7.19 FIX: Field is 'SmartPay Option' (no 'Credit Reports -' prefix)
          smartPay: f['SmartPay Option'] || '--',
          // WhatIf and WayFinder fields were removed from Airtable — set to null
          whatIf: null,
          wayFinder: null,
        }
      };
    });

    // Build the response
    const result = {
      vendors: vendors,
      lastUpdated: new Date().toISOString(),
      count: vendors.length
    };

    // Cache the result
    creditVendorsCache = result;
    creditVendorsCacheTimestamp = now;

    console.log(`Loaded ${vendors.length} credit vendors successfully`);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (transformError) {
    // Data transformation error (bad field access, null dereference, etc.)
    console.error('Credit vendors TRANSFORM error:', transformError.message, transformError.stack);
    return new Response(JSON.stringify({
      error: 'Failed to process credit vendor data. Please try again.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ============================================================
// FAVORITES ENDPOINTS
// ============================================================

async function getFavorites(userEmail, apiKey, request) {
  const url = new URL(request.url);
  const itemType = url.searchParams.get('type');
  
  let filterFormula = `{User Email} = '${userEmail}'`;
  if (itemType && FAVORITE_ITEM_TYPES.includes(itemType)) {
    filterFormula = `AND(${filterFormula}, {Item Type} = '${itemType}')`;
  }
  
  const result = await airtableRequest(
    `${TABLES.FAVORITES}?filterByFormula=${encodeURIComponent(filterFormula)}&sort[0][field]=Date Added&sort[0][direction]=desc`,
    apiKey
  );
  
  if (result.error) {
    console.error('Airtable error:', result.error.message);
    return jsonResponse({ error: 'A server error occurred. Please try again.' }, 500, request);
  }
  
  const favorites = result.records.map(record => ({
    id: record.id,
    itemType: record.fields['Item Type'],
    itemId: record.fields['Item ID'],
    itemName: record.fields['Item Name'],
    dateAdded: record.fields['Date Added']
  }));
  
  return jsonResponse({ favorites }, 200, request);
}

async function createFavorite(userEmail, apiKey, request) {
  const body = await request.json();
  const { itemType, itemId, itemName } = body;
  
  if (!itemType || !itemId || !itemName) {
    return jsonResponse({ error: 'Missing required fields: itemType, itemId, itemName' }, 400, request);
  }
  
  if (!FAVORITE_ITEM_TYPES.includes(itemType)) {
    return jsonResponse({ error: `Invalid itemType. Must be one of: ${FAVORITE_ITEM_TYPES.join(', ')}` }, 400, request);
  }
  
  const checkFormula = `AND({User Email} = '${userEmail}', {Item Type} = '${itemType}', {Item ID} = '${itemId}')`;
  const existingCheck = await airtableRequest(
    `${TABLES.FAVORITES}?filterByFormula=${encodeURIComponent(checkFormula)}`,
    apiKey
  );
  
  if (existingCheck.records && existingCheck.records.length > 0) {
    return jsonResponse({ error: 'Favorite already exists' }, 409, request);
  }
  
  const result = await airtableRequest(
    TABLES.FAVORITES,
    apiKey,
    'POST',
    {
      fields: {
        'User Email': userEmail,
        'Item Type': itemType,
        'Item ID': itemId,
        'Item Name': itemName,
        'Date Added': new Date().toISOString()
      }
    }
  );
  
  if (result.error) {
    console.error('Airtable error:', result.error.message);
    return jsonResponse({ error: 'A server error occurred. Please try again.' }, 500, request);
  }
  
  return jsonResponse({
    favorite: {
      id: result.id,
      itemType,
      itemId,
      itemName,
      dateAdded: result.fields['Date Added']
    }
  }, 201, request);
}

async function deleteFavorite(userEmail, apiKey, request, favoriteId) {
  const record = await airtableRequest(`${TABLES.FAVORITES}/${favoriteId}`, apiKey);
  
  if (record.error) {
    return jsonResponse({ error: 'Favorite not found' }, 404, request);
  }
  
  if (record.fields['User Email'] !== userEmail) {
    return jsonResponse({ error: 'Unauthorized' }, 403, request);
  }
  
  await airtableRequest(`${TABLES.FAVORITES}/${favoriteId}`, apiKey, 'DELETE');
  
  return jsonResponse({ success: true, deleted: favoriteId }, 200, request);
}

// ============================================================
// CALCULATOR SCENARIOS ENDPOINTS
// ============================================================

async function getScenarios(userEmail, apiKey, request) {
  const url = new URL(request.url);
  const calculatorType = url.searchParams.get('type');
  
  let filterFormula = `{User Email} = '${userEmail}'`;
  if (calculatorType && CALCULATOR_TYPES.includes(calculatorType)) {
    filterFormula = `AND(${filterFormula}, {Calculator Type} = '${calculatorType}')`;
  }
  
  const result = await airtableRequest(
    `${TABLES.SCENARIOS}?filterByFormula=${encodeURIComponent(filterFormula)}&sort[0][field]=Date Created&sort[0][direction]=desc`,
    apiKey
  );
  
  if (result.error) {
    console.error('Airtable error:', result.error.message);
    return jsonResponse({ error: 'A server error occurred. Please try again.' }, 500, request);
  }
  
  const scenarios = result.records.map(record => ({
    id: record.id,
    calculatorType: record.fields['Calculator Type'],
    scenarioName: record.fields['Scenario Name'],
    scenarioData: JSON.parse(record.fields['Scenario Data']),
    dateCreated: record.fields['Date Created']
  }));
  
  return jsonResponse({ scenarios }, 200, request);
}

async function createScenario(userEmail, apiKey, request) {
  const body = await request.json();
  const { calculatorType, scenarioName, scenarioData } = body;
  
  if (!calculatorType || !scenarioName || !scenarioData) {
    return jsonResponse({ error: 'Missing required fields: calculatorType, scenarioName, scenarioData' }, 400, request);
  }
  
  if (!CALCULATOR_TYPES.includes(calculatorType)) {
    return jsonResponse({ error: `Invalid calculatorType. Must be one of: ${CALCULATOR_TYPES.join(', ')}` }, 400, request);
  }
  
  const result = await airtableRequest(
    TABLES.SCENARIOS,
    apiKey,
    'POST',
    {
      fields: {
        'User Email': userEmail,
        'Calculator Type': calculatorType,
        'Scenario Name': scenarioName,
        'Scenario Data': JSON.stringify(scenarioData),
        'Date Created': new Date().toISOString()
      }
    }
  );
  
  if (result.error) {
    console.error('Airtable error:', result.error.message);
    return jsonResponse({ error: 'A server error occurred. Please try again.' }, 500, request);
  }
  
  return jsonResponse({
    scenario: {
      id: result.id,
      calculatorType,
      scenarioName,
      scenarioData,
      dateCreated: result.fields['Date Created']
    }
  }, 201, request);
}

async function updateScenario(userEmail, apiKey, request, scenarioId) {
  const record = await airtableRequest(`${TABLES.SCENARIOS}/${scenarioId}`, apiKey);
  
  if (record.error) {
    return jsonResponse({ error: 'Scenario not found' }, 404, request);
  }
  
  if (record.fields['User Email'] !== userEmail) {
    return jsonResponse({ error: 'Unauthorized' }, 403, request);
  }
  
  const body = await request.json();
  const updateFields = {};
  
  if (body.scenarioName) updateFields['Scenario Name'] = body.scenarioName;
  if (body.scenarioData) updateFields['Scenario Data'] = JSON.stringify(body.scenarioData);
  
  if (Object.keys(updateFields).length === 0) {
    return jsonResponse({ error: 'No fields to update' }, 400, request);
  }
  
  const result = await airtableRequest(
    `${TABLES.SCENARIOS}/${scenarioId}`,
    apiKey,
    'PATCH',
    { fields: updateFields }
  );
  
  if (result.error) {
    console.error('Airtable error:', result.error.message);
    return jsonResponse({ error: 'A server error occurred. Please try again.' }, 500, request);
  }
  
  return jsonResponse({
    scenario: {
      id: result.id,
      calculatorType: result.fields['Calculator Type'],
      scenarioName: result.fields['Scenario Name'],
      scenarioData: JSON.parse(result.fields['Scenario Data']),
      dateCreated: result.fields['Date Created']
    }
  }, 200, request);
}

async function deleteScenario(userEmail, apiKey, request, scenarioId) {
  const record = await airtableRequest(`${TABLES.SCENARIOS}/${scenarioId}`, apiKey);
  
  if (record.error) {
    return jsonResponse({ error: 'Scenario not found' }, 404, request);
  }
  
  if (record.fields['User Email'] !== userEmail) {
    return jsonResponse({ error: 'Unauthorized' }, 403, request);
  }
  
  await airtableRequest(`${TABLES.SCENARIOS}/${scenarioId}`, apiKey, 'DELETE');
  
  return jsonResponse({ success: true, deleted: scenarioId }, 200, request);
}

// ============================================================
// USAGE TRACKING ENDPOINTS
// ============================================================

async function getUsage(userEmail, apiKey, request) {
  const filterFormula = `{User Email} = '${userEmail}'`;
  const result = await airtableRequest(
    `${TABLES.USAGE}?filterByFormula=${encodeURIComponent(filterFormula)}`,
    apiKey
  );
  
  if (result.error) {
    console.error('Airtable error:', result.error.message);
    return jsonResponse({ error: 'A server error occurred. Please try again.' }, 500, request);
  }
  
  if (!result.records || result.records.length === 0) {
    const createResult = await airtableRequest(
      TABLES.USAGE,
      apiKey,
      'POST',
      {
        fields: {
          'User Email': userEmail,
          'Current Plan': 'LITE',
          'Pipeline Loan Count': 0,
          'Calculator Saves Count': JSON.stringify({}),
          'Account Created': new Date().toISOString()
        }
      }
    );
    
    if (createResult.error) {
      console.error('Usage create (getUsage) error:', createResult.error.message);
      return jsonResponse({ error: 'A server error occurred. Please try again.' }, 500, request);
    }

    return jsonResponse({
      usage: {
        currentPlan: 'LITE',
        pipelineLoanCount: 0,
        calculatorSavesCount: {},
        accountCreated: createResult.fields['Account Created']
      }
    }, 200, request);
  }
  
  const record = result.records[0];
  return jsonResponse({
    usage: {
      currentPlan: record.fields['Current Plan'] || 'LITE',
      pipelineLoanCount: record.fields['Pipeline Loan Count'] || 0,
      calculatorSavesCount: JSON.parse(record.fields['Calculator Saves Count'] || '{}'),
      accountCreated: record.fields['Account Created']
    }
  }, 200, request);
}

async function updateUsage(userEmail, apiKey, request) {
  const filterFormula = `{User Email} = '${userEmail}'`;
  const result = await airtableRequest(
    `${TABLES.USAGE}?filterByFormula=${encodeURIComponent(filterFormula)}`,
    apiKey
  );
  
  if (result.error) {
    console.error('Airtable error:', result.error.message);
    return jsonResponse({ error: 'A server error occurred. Please try again.' }, 500, request);
  }
  
  const body = await request.json();
  const updateFields = {};

  // SECURITY (CRIT-2): currentPlan and pipelineLoanCount are intentionally NOT
  // user-writeable. Plan is managed by Outseta billing, never by the user.
  // Loan count is computed from actual records in checkPlanLimits, not a counter.
  // Only calculatorSavesCount is tracked here (per-type saves, incremented by the app).
  if (body.calculatorSavesCount) updateFields['Calculator Saves Count'] = JSON.stringify(body.calculatorSavesCount);

  let recordId;

  if (!result.records || result.records.length === 0) {
    const createResult = await airtableRequest(
      TABLES.USAGE,
      apiKey,
      'POST',
      {
        fields: {
          'User Email': userEmail,
          'Current Plan': 'LITE',         // Always starts as LITE — Outseta webhook upgrades this
          'Pipeline Loan Count': 0,        // Legacy field — not used for limit checks (see checkPlanLimits)
          'Calculator Saves Count': JSON.stringify(body.calculatorSavesCount || {}),
          'Account Created': new Date().toISOString()
        }
      }
    );
    
    if (createResult.error) {
      console.error('Usage create error:', createResult.error.message);
      return jsonResponse({ error: 'Failed to initialize usage record' }, 500, request);
    }

    return jsonResponse({
      usage: {
        currentPlan: createResult.fields['Current Plan'],
        pipelineLoanCount: createResult.fields['Pipeline Loan Count'],
        calculatorSavesCount: JSON.parse(createResult.fields['Calculator Saves Count'] || '{}'),
        accountCreated: createResult.fields['Account Created']
      }
    }, 200, request);
  }
  
  // If there's nothing to update (e.g. caller only sent currentPlan which is now blocked), return current state
  if (Object.keys(updateFields).length === 0) {
    const r = result.records[0];
    return jsonResponse({
      usage: {
        currentPlan: r.fields['Current Plan'] || 'LITE',
        pipelineLoanCount: r.fields['Pipeline Loan Count'] || 0,
        calculatorSavesCount: JSON.parse(r.fields['Calculator Saves Count'] || '{}'),
        accountCreated: r.fields['Account Created']
      }
    }, 200, request);
  }

  recordId = result.records[0].id;

  const updateResult = await airtableRequest(
    `${TABLES.USAGE}/${recordId}`,
    apiKey,
    'PATCH',
    { fields: updateFields }
  );

  if (updateResult.error) {
    console.error('Usage update error:', updateResult.error.message);
    return jsonResponse({ error: 'Failed to update usage data' }, 500, request);
  }
  
  return jsonResponse({
    usage: {
      currentPlan: updateResult.fields['Current Plan'],
      pipelineLoanCount: updateResult.fields['Pipeline Loan Count'],
      calculatorSavesCount: JSON.parse(updateResult.fields['Calculator Saves Count'] || '{}'),
      accountCreated: updateResult.fields['Account Created']
    }
  }, 200, request);
}

// ============================================================
// PLAN LIMITS ENDPOINT
// ============================================================

async function checkPlanLimits(userEmail, apiKey, request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  
  const usageResponse = await getUsage(userEmail, apiKey, request);
  const usageData = await usageResponse.json();
  const currentPlan = usageData.usage?.currentPlan || 'LITE';
  
  const limits = PLAN_LIMITS[currentPlan];
  
  if (!limits) {
    return jsonResponse({ error: 'Invalid plan' }, 400, request);
  }
  
  if (!action) {
    // Count actual pipeline loans from LOANS table — the pipelineLoanCount
    // field in the Usage table is a stale counter that isn't kept in sync.
    // Fetching only the User Email field keeps the payload minimal.
    // PLUS users are capped at 25, so pagination is never needed here.
    const loansFormula = encodeURIComponent(`{User Email}='${userEmail}'`);
    const loansResult = await airtableRequest(
      `${TABLES.LOANS}?filterByFormula=${loansFormula}&fields%5B%5D=User+Email`,
      apiKey
    );
    const actualLoanCount = (loansResult.records || []).length;

    return jsonResponse({
      plan: currentPlan,
      limits: limits,
      usage: {
        pipelineLoans: actualLoanCount,
        calculatorSaves: usageData.usage.calculatorSavesCount
      }
    }, 200, request);
  }
  
  let allowed = true;
  let reason = null;
  
  switch (action) {
    case 'add-pipeline-loan':
      if (limits.pipelineLoans !== Infinity && usageData.usage.pipelineLoanCount >= limits.pipelineLoans) {
        allowed = false;
        reason = `Pipeline limit reached (${limits.pipelineLoans} loans)`;
      }
      break;
      
    case 'save-calculator-scenario':
      const calcType = url.searchParams.get('calculatorType');
      if (calcType) {
        const currentCount = usageData.usage.calculatorSavesCount[calcType] || 0;
        if (limits.calculatorSaves !== Infinity && currentCount >= limits.calculatorSaves) {
          allowed = false;
          reason = `Calculator save limit reached (${limits.calculatorSaves} per calculator)`;
        }
      }
      break;
      
    case 'add-favorite':
      if (!limits.canAddFavorites) {
        allowed = false;
        reason = 'Favorites not available on this plan';
      }
      break;
      
    case 'access-advanced-calculator':
      if (!limits.canAccessAdvancedCalcs) {
        allowed = false;
        reason = 'Advanced calculators not available on this plan';
      }
      break;
      
    case 'export-pipeline':
      if (!limits.canExportPipeline) {
        allowed = false;
        reason = 'Pipeline export not available on this plan';
      }
      break;
      
    case 'print-calculator-pdf':
      if (!limits.canPrintCalculatorPDF) {
        allowed = false;
        reason = 'PDF export not available on this plan';
      }
      break;
      
    default:
      return jsonResponse({ error: 'Unknown action' }, 400, request);
  }
  
  return jsonResponse({
    plan: currentPlan,
    action,
    allowed,
    reason,
    upgradeRequired: !allowed
  }, 200, request);
}

// ============================================================
// GOAL PLAN ENDPOINTS (for Goal Setting page)
// ============================================================

/**
 * GET /api/goal-plan
 * Retrieves the user's saved goal plan from Airtable
 * Returns the plan data JSON or empty if no plan exists
 */
async function getGoalPlan(userEmail, apiKey, request) {
  const formula = encodeURIComponent(`{User Email}='${userEmail}'`);
  const result = await airtableRequest(
    `${TABLES.GOAL_PLANS}?filterByFormula=${formula}&maxRecords=1`,
    apiKey
  );

  if (result.error) {
    console.error('Airtable error:', result.error.message);
    return jsonResponse({ error: 'A server error occurred. Please try again.' }, 500, request);
  }

  if (!result.records || result.records.length === 0) {
    return jsonResponse({ plan: null }, 200, request);
  }

  const record = result.records[0];
  let planData = null;
  try {
    planData = JSON.parse(record.fields['Plan Data'] || 'null');
  } catch (e) {
    planData = null;
  }

  return jsonResponse({
    plan: {
      id: record.id,
      data: planData
    }
  }, 200, request);
}

/**
 * POST /api/goal-plan
 * Creates a new goal plan record for the user
 * Body: { planData: { ...form fields as JSON } }
 */
async function createGoalPlan(userEmail, apiKey, request) {
  const body = await request.json();
  const { planData } = body;

  if (!planData) {
    return jsonResponse({ error: 'Missing required field: planData' }, 400, request);
  }

  const result = await airtableRequest(
    TABLES.GOAL_PLANS,
    apiKey,
    'POST',
    {
      fields: {
        'User Email': userEmail,
        'Plan Data': JSON.stringify(planData)
      }
    }
  );

  if (result.error) {
    console.error('Airtable error:', result.error.message);
    return jsonResponse({ error: 'A server error occurred. Please try again.' }, 500, request);
  }

  return jsonResponse({
    plan: {
      id: result.id,
      data: planData
    }
  }, 201, request);
}

/**
 * PUT /api/goal-plan/:id
 * Updates an existing goal plan record
 * Verifies the record belongs to the authenticated user
 * Body: { planData: { ...form fields as JSON } }
 */
async function updateGoalPlan(userEmail, recordId, apiKey, request) {
  // Verify ownership
  const existing = await airtableRequest(`${TABLES.GOAL_PLANS}/${recordId}`, apiKey);
  if (existing.error) {
    return jsonResponse({ error: 'Goal plan not found' }, 404, request);
  }
  if (existing.fields['User Email'] !== userEmail) {
    return jsonResponse({ error: 'Unauthorized' }, 403, request);
  }

  const body = await request.json();
  const { planData } = body;

  if (!planData) {
    return jsonResponse({ error: 'Missing required field: planData' }, 400, request);
  }

  const result = await airtableRequest(
    `${TABLES.GOAL_PLANS}/${recordId}`,
    apiKey,
    'PATCH',
    {
      fields: {
        'Plan Data': JSON.stringify(planData)
      }
    }
  );

  if (result.error) {
    console.error('Airtable error:', result.error.message);
    return jsonResponse({ error: 'A server error occurred. Please try again.' }, 500, request);
  }

  return jsonResponse({
    plan: {
      id: result.id,
      data: planData
    }
  }, 200, request);
}

// ============================================================
// BROKER PROFILE FUNCTIONS (Settings page - company address, logo, disclaimer)
// Uses JSON-based storage pattern (same as Goal Plans)
// Airtable fields: User Email, Profile Data (JSON), Updated At
// ============================================================

/**
 * GET /api/broker-profile
 * Retrieves the broker's profile data (company address, logo URL, disclaimer)
 */
async function getBrokerProfile(userEmail, apiKey, request) {
  const formula = encodeURIComponent(`{User Email}='${userEmail}'`);
  const result = await airtableRequest(
    `${TABLES.BROKER_PROFILES}?filterByFormula=${formula}&maxRecords=1`,
    apiKey
  );

  if (result.error) {
    console.error('Airtable error:', result.error.message);
    return jsonResponse({ error: 'A server error occurred. Please try again.' }, 500, request);
  }

  // No profile found yet - return null (user hasn't saved settings)
  if (!result.records || result.records.length === 0) {
    return jsonResponse({ profile: null }, 200, request);
  }

  const record = result.records[0];
  let profileData = null;
  try {
    profileData = JSON.parse(record.fields['Profile Data'] || 'null');
  } catch (e) {
    profileData = null;
  }

  return jsonResponse({
    profile: {
      id: record.id,
      data: profileData,
      updatedAt: record.fields['Updated At'] || null
    }
  }, 200, request);
}

/**
 * POST /api/broker-profile
 * Creates a new broker profile record
 * Body: { profileData: { companyStreet, companyCity, companyState, companyZip, logoUrl, disclaimerText } }
 */
async function createBrokerProfile(userEmail, apiKey, request) {
  const body = await request.json();
  const { profileData } = body;

  if (!profileData) {
    return jsonResponse({ error: 'Missing required field: profileData' }, 400, request);
  }

  const result = await airtableRequest(
    TABLES.BROKER_PROFILES,
    apiKey,
    'POST',
    {
      fields: {
        'User Email': userEmail,
        'Profile Data': JSON.stringify(profileData),
        'Updated At': new Date().toISOString()
      }
    }
  );

  if (result.error) {
    console.error('Airtable error:', result.error.message);
    return jsonResponse({ error: 'A server error occurred. Please try again.' }, 500, request);
  }

  return jsonResponse({
    profile: {
      id: result.id,
      data: profileData,
      updatedAt: new Date().toISOString()
    }
  }, 201, request);
}

/**
 * PUT /api/broker-profile/:id
 * Updates an existing broker profile record
 * Verifies the record belongs to the authenticated user
 * Body: { profileData: { companyStreet, companyCity, companyState, companyZip, logoUrl, disclaimerText } }
 */
async function updateBrokerProfile(userEmail, recordId, apiKey, request) {
  // Verify ownership - make sure this profile belongs to the requesting user
  const existing = await airtableRequest(`${TABLES.BROKER_PROFILES}/${recordId}`, apiKey);
  if (existing.error) {
    return jsonResponse({ error: 'Broker profile not found' }, 404, request);
  }
  if (existing.fields['User Email'] !== userEmail) {
    return jsonResponse({ error: 'Unauthorized' }, 403, request);
  }

  const body = await request.json();
  const { profileData } = body;

  if (!profileData) {
    return jsonResponse({ error: 'Missing required field: profileData' }, 400, request);
  }

  const result = await airtableRequest(
    `${TABLES.BROKER_PROFILES}/${recordId}`,
    apiKey,
    'PATCH',
    {
      fields: {
        'Profile Data': JSON.stringify(profileData),
        'Updated At': new Date().toISOString()
      }
    }
  );

  if (result.error) {
    console.error('Airtable error:', result.error.message);
    return jsonResponse({ error: 'A server error occurred. Please try again.' }, 500, request);
  }

  return jsonResponse({
    profile: {
      id: result.id,
      data: profileData,
      updatedAt: new Date().toISOString()
    }
  }, 200, request);
}

// ============================================================
// LOGO UPLOAD/SERVE FUNCTIONS (R2 Storage)
// Requires R2 bucket binding: LOGO_BUCKET
// ============================================================

/**
 * Helper: Generate a safe R2 key from user email
 * Converts email to a URL-safe string for use as the R2 object key
 * Example: "rich@example.com" -> "logos/rich_at_example_com"
 */
function emailToLogoKey(email) {
  const safe = email.toLowerCase().replace(/@/g, '_at_').replace(/[^a-z0-9_]/g, '_');
  return `${LOGO_CONFIG.KEY_PREFIX}${safe}`;
}

/**
 * POST /api/broker-profile/logo
 * Uploads a logo image to R2 storage
 * Accepts multipart/form-data with a "logo" file field
 * Returns the public URL for the uploaded logo
 */
async function uploadLogo(userEmail, request, env) {
  // Check if R2 bucket is configured
  if (!env.LOGO_BUCKET) {
    return jsonResponse({ error: 'Logo storage not configured' }, 500, request);
  }

  // Parse the multipart form data
  let formData;
  try {
    formData = await request.formData();
  } catch (e) {
    return jsonResponse({ error: 'Invalid form data. Send multipart/form-data with a "logo" field.' }, 400, request);
  }

  const file = formData.get('logo');
  if (!file || typeof file === 'string') {
    return jsonResponse({ error: 'Missing "logo" file in form data' }, 400, request);
  }

  // Validate file type
  if (!LOGO_CONFIG.ALLOWED_TYPES.includes(file.type)) {
    return jsonResponse({ 
      error: `Invalid file type: ${file.type}. Allowed: PNG, JPEG, WebP, SVG` 
    }, 400, request);
  }

  // Validate file size
  if (file.size > LOGO_CONFIG.MAX_SIZE_BYTES) {
    return jsonResponse({ 
      error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max: 2MB` 
    }, 400, request);
  }

  // Generate the R2 key (one logo per user, overwrites previous)
  const r2Key = emailToLogoKey(userEmail);

  // Upload to R2
  try {
    const arrayBuffer = await file.arrayBuffer();
    await env.LOGO_BUCKET.put(r2Key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
        // Cache logo for 1 hour in browsers, allow revalidation
        cacheControl: 'public, max-age=3600'
      },
      customMetadata: {
        uploadedBy: userEmail,
        uploadedAt: new Date().toISOString(),
        originalName: file.name || 'logo'
      }
    });
  } catch (e) {
    console.error('R2 upload error:', e);
    return jsonResponse({ error: 'Failed to upload logo' }, 500, request);
  }

  // Build the public URL for serving this logo
  const workerUrl = new URL(request.url);
  const logoUrl = `${workerUrl.origin}/api/logos/${encodeURIComponent(r2Key)}`;

  return jsonResponse({
    logoUrl: logoUrl,
    key: r2Key,
    size: file.size,
    type: file.type
  }, 200, request);
}

/**
 * GET /api/logos/:key
 * PUBLIC endpoint - serves a logo image from R2 storage
 * No authentication required so logos can be displayed anywhere
 */
async function serveLogo(r2Key, request, env) {
  if (!env.LOGO_BUCKET) {
    return jsonResponse({ error: 'Logo storage not configured' }, 500, request);
  }

  // Fetch the object from R2
  const object = await env.LOGO_BUCKET.get(r2Key);
  if (!object) {
    return new Response('Logo not found', { 
      status: 404,
      headers: getCorsHeaders(request)
    });
  }

  // Return the image with proper headers
  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'image/png');
  headers.set('Cache-Control', 'public, max-age=3600');
  // Allow cross-origin image loading
  const corsHeaders = getCorsHeaders(request);
  Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));

  return new Response(object.body, { status: 200, headers });
}

/**
 * DELETE /api/broker-profile/logo
 * Deletes the user's logo from R2 storage
 */
async function deleteLogo(userEmail, request, env) {
  if (!env.LOGO_BUCKET) {
    return jsonResponse({ error: 'Logo storage not configured' }, 500, request);
  }

  const r2Key = emailToLogoKey(userEmail);
  
  try {
    await env.LOGO_BUCKET.delete(r2Key);
  } catch (e) {
    console.error('R2 delete error:', e);
    return jsonResponse({ error: 'Failed to delete logo' }, 500, request);
  }

  return jsonResponse({ success: true, deleted: r2Key }, 200, request);
}

// ============================================================
// AVATAR (PROFILE PICTURE) UPLOAD/SERVE FUNCTIONS (R2 Storage)
// Uses the same LOGO_BUCKET R2 binding, with 'avatars/' prefix
// ============================================================

/**
 * Helper: Generate a safe R2 key from user email for avatar
 * Example: "rich@example.com" -> "avatars/rich_at_example_com"
 */
function emailToAvatarKey(email) {
  const safe = email.toLowerCase().replace(/@/g, '_at_').replace(/[^a-z0-9_]/g, '_');
  return `${AVATAR_CONFIG.KEY_PREFIX}${safe}`;
}

/**
 * POST /api/broker-profile/avatar
 * Uploads a profile picture to R2 storage
 * Accepts multipart/form-data with an "avatar" file field
 * Returns the public URL for the uploaded avatar
 */
async function uploadAvatar(userEmail, request, env) {
  if (!env.LOGO_BUCKET) {
    return jsonResponse({ error: 'Image storage not configured' }, 500, request);
  }

  let formData;
  try {
    formData = await request.formData();
  } catch (e) {
    return jsonResponse({ error: 'Invalid form data. Send multipart/form-data with an "avatar" field.' }, 400, request);
  }

  const file = formData.get('avatar');
  if (!file || typeof file === 'string') {
    return jsonResponse({ error: 'Missing "avatar" file in form data' }, 400, request);
  }

  if (!AVATAR_CONFIG.ALLOWED_TYPES.includes(file.type)) {
    return jsonResponse({ 
      error: `Invalid file type: ${file.type}. Allowed: PNG, JPEG, WebP` 
    }, 400, request);
  }

  if (file.size > AVATAR_CONFIG.MAX_SIZE_BYTES) {
    return jsonResponse({ 
      error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max: 2MB` 
    }, 400, request);
  }

  const r2Key = emailToAvatarKey(userEmail);

  try {
    const arrayBuffer = await file.arrayBuffer();
    await env.LOGO_BUCKET.put(r2Key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=3600'
      },
      customMetadata: {
        uploadedBy: userEmail,
        uploadedAt: new Date().toISOString(),
        originalName: file.name || 'avatar'
      }
    });
  } catch (e) {
    console.error('R2 avatar upload error:', e);
    return jsonResponse({ error: 'Failed to upload profile picture' }, 500, request);
  }

  const workerUrl = new URL(request.url);
  const avatarUrl = `${workerUrl.origin}/api/avatars/${encodeURIComponent(r2Key)}`;

  return jsonResponse({
    avatarUrl: avatarUrl,
    key: r2Key,
    size: file.size,
    type: file.type
  }, 200, request);
}

/**
 * GET /api/avatars/:key
 * PUBLIC endpoint - serves an avatar image from R2 storage
 * No authentication required so avatars can be displayed anywhere
 */
async function serveAvatar(r2Key, request, env) {
  if (!env.LOGO_BUCKET) {
    return jsonResponse({ error: 'Image storage not configured' }, 500, request);
  }

  const object = await env.LOGO_BUCKET.get(r2Key);
  if (!object) {
    return new Response('Avatar not found', { 
      status: 404,
      headers: getCorsHeaders(request)
    });
  }

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'image/png');
  headers.set('Cache-Control', 'public, max-age=3600');
  const corsHeaders = getCorsHeaders(request);
  Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));

  return new Response(object.body, { status: 200, headers });
}

/**
 * DELETE /api/broker-profile/avatar
 * Deletes the user's avatar from R2 storage
 */
async function deleteAvatar(userEmail, request, env) {
  if (!env.LOGO_BUCKET) {
    return jsonResponse({ error: 'Image storage not configured' }, 500, request);
  }

  const r2Key = emailToAvatarKey(userEmail);
  
  try {
    await env.LOGO_BUCKET.delete(r2Key);
  } catch (e) {
    console.error('R2 avatar delete error:', e);
    return jsonResponse({ error: 'Failed to delete profile picture' }, 500, request);
  }

  return jsonResponse({ success: true, deleted: r2Key }, 200, request);
}

// ============================================================
// MAIN WORKER HANDLER
// ============================================================

// ============================================================
// REFERRAL PROGRAM - Full Rewardful API + Airtable Integration
// v2.0 - Complete self-service: enrollment, payout setup,
//         commissions, and stats — all on mtg.broker
//
// Endpoints:
//   GET  /api/referral              - Status check (enrolled? link, stats, payout setup)
//   POST /api/referral/enroll       - Accept terms + create affiliate
//   PUT  /api/referral/payout-setup - Save PayPal email + legal info
//   GET  /api/referral/commissions  - Fetch commission history
//
// Rewardful API docs: https://developers.getrewardful.com/
// Requires env.REWARDFUL_API_KEY secret
// ============================================================

const REFERRAL_TABLE = 'tblk438ZoRJ3YenKp';

// Helper: Rewardful API call (Basic Auth)
async function rewardfulAPI(path, apiKey, method = 'GET', body = null) {
  const basicAuth = btoa(apiKey + ':');
  const options = {
    method,
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  };
  if (body && (method === 'POST' || method === 'PUT')) {
    // Rewardful accepts form-encoded bodies
    options.body = new URLSearchParams(body).toString();
  }
  const response = await fetch(`https://api.getrewardful.com/v1${path}`, options);
  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

// Helper: Look up Airtable referral record by email
async function getAirtableReferralRecord(email, apiKey) {
  const formula = encodeURIComponent(`{Email} = '${email}'`);
  const data = await airtableRequest(
    `${REFERRAL_TABLE}?filterByFormula=${formula}&maxRecords=1`,
    apiKey
  );
  return data.records && data.records.length > 0 ? data.records[0] : null;
}

// ============================================================
// GET /api/referral
// Returns enrollment status, referral link, stats, and
// payout setup status. Checks both Rewardful + Airtable.
// ============================================================
async function getReferralStatus(userEmail, apiKey, request, env) {
  const corsHeaders = getCorsHeaders(request);
  const rewardfulKey = env.REWARDFUL_API_KEY;

  if (!rewardfulKey) {
    return new Response(
      JSON.stringify({ error: 'Rewardful API key not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Parallel fetch: Rewardful affiliate + Airtable record
    const [rewardfulResult, airtableRecord] = await Promise.all([
      rewardfulAPI(`/affiliates?email=${encodeURIComponent(userEmail)}&expand[]=links`, rewardfulKey),
      getAirtableReferralRecord(userEmail, apiKey)
    ]);

    // Check if enrolled in Rewardful
    const affiliates = rewardfulResult.data?.data || rewardfulResult.data || [];
    if (!affiliates || affiliates.length === 0) {
      return new Response(
        JSON.stringify({
          enrolled: false,
          termsAccepted: !!(airtableRecord?.fields?.['Terms Accepted']),
          payoutSetupComplete: false
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const affiliate = affiliates[0];
    const referralLink = affiliate.links?.[0]?.url || null;
    const link = referralLink || (affiliate.links?.[0]?.token
      ? `https://www.mtg.broker?via=${affiliate.links[0].token}`
      : null);

    // Build full status response
    const result = {
      enrolled: true,
      affiliateId: affiliate.id || null,
      link: link,
      firstName: affiliate.first_name || null,
      // Stats from Rewardful
      visitors: affiliate.visitors || 0,
      leads: affiliate.leads || 0,
      conversions: affiliate.conversions || 0,
      // Payout info from Airtable
      termsAccepted: !!(airtableRecord?.fields?.['Terms Accepted']),
      termsAcceptedDate: airtableRecord?.fields?.['Terms Accepted Date'] || null,
      payoutSetupComplete: !!(airtableRecord?.fields?.['Payout Setup Complete']),
      paypalEmail: airtableRecord?.fields?.['PayPal Email'] || null,
      legalName: airtableRecord?.fields?.['Legal Name'] || null,
      legalAddress: airtableRecord?.fields?.['Legal Address'] || null,
      payoutMethod: airtableRecord?.fields?.['Payout Method'] || null,
      enrolledDate: airtableRecord?.fields?.['Enrolled Date'] || null,
      airtableRecordId: airtableRecord?.id || null
    };

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Referral status error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to load referral status' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// ============================================================
// POST /api/referral/enroll
// Accepts terms, creates affiliate in Rewardful (if not already),
// and creates/updates the Airtable record.
// Body: { firstName, lastName, termsAccepted: true }
// ============================================================
async function enrollAffiliate(userEmail, apiKey, request, env) {
  const corsHeaders = getCorsHeaders(request);
  const rewardfulKey = env.REWARDFUL_API_KEY;

  if (!rewardfulKey) {
    return new Response(
      JSON.stringify({ error: 'Rewardful API key not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json();

    // Require terms acceptance
    if (!body.termsAccepted) {
      return new Response(
        JSON.stringify({ error: 'You must accept the program terms to enroll' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firstName = (body.firstName || '').trim();
    const lastName = (body.lastName || '').trim();
    if (!firstName || !lastName) {
      return new Response(
        JSON.stringify({ error: 'First name and last name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already enrolled in Rewardful
    const lookupResult = await rewardfulAPI(
      `/affiliates?email=${encodeURIComponent(userEmail)}&expand[]=links`,
      rewardfulKey
    );
    let affiliate;
    const existingAffiliates = lookupResult.data?.data || lookupResult.data || [];

    if (existingAffiliates.length > 0) {
      // Already enrolled in Rewardful
      affiliate = existingAffiliates[0];
    } else {
      // Create new affiliate in Rewardful
      const createResult = await rewardfulAPI('/affiliates', rewardfulKey, 'POST', {
        first_name: firstName,
        last_name: lastName,
        email: userEmail,
        receive_new_commission_notifications: 'true'
      });

      if (!createResult.ok) {
        console.error('Rewardful create error:', createResult.status, JSON.stringify(createResult.data));
        return new Response(
          JSON.stringify({ error: 'Failed to create affiliate account. Please try again.' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      affiliate = createResult.data;

      // Fetch with expanded links to get the referral URL
      const fetchResult = await rewardfulAPI(
        `/affiliates/${affiliate.id}?expand[]=links`,
        rewardfulKey
      );
      if (fetchResult.ok) {
        affiliate = fetchResult.data;
      }
    }

    const referralLink = affiliate.links?.[0]?.url || 
      (affiliate.links?.[0]?.token ? `https://www.mtg.broker?via=${affiliate.links[0].token}` : null) ||
      (affiliate.token ? `https://www.mtg.broker?via=${affiliate.token}` : null);

    const now = new Date().toISOString();

    // Create or update Airtable record
    const existingRecord = await getAirtableReferralRecord(userEmail, apiKey);
    const airtableFields = {
      'Email': userEmail,
      'Rewardful Affiliate ID': affiliate.id || '',
      'Referral Link': referralLink || '',
      'Terms Accepted': true,
      'Terms Accepted Date': now,
      'Enrolled Date': now
    };

    let airtableRecordId;
    if (existingRecord) {
      // Update existing
      await airtableRequest(
        `${REFERRAL_TABLE}/${existingRecord.id}`,
        apiKey, 'PATCH', { fields: airtableFields }
      );
      airtableRecordId = existingRecord.id;
    } else {
      // Create new
      const created = await airtableRequest(
        REFERRAL_TABLE, apiKey, 'POST', { fields: airtableFields }
      );
      airtableRecordId = created.id;
    }

    return new Response(
      JSON.stringify({
        enrolled: true,
        affiliateId: affiliate.id,
        link: referralLink,
        termsAccepted: true,
        termsAcceptedDate: now,
        airtableRecordId: airtableRecordId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Enrollment error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to enroll in referral program' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// ============================================================
// PUT /api/referral/payout-setup
// Saves PayPal email + legal info for tax purposes.
// Updates both Airtable and Rewardful (paypal_email).
// Body: { paypalEmail, legalName, payoutMethod, street, city, state, zip }
// ============================================================
async function updatePayoutSetup(userEmail, apiKey, request, env) {
  const corsHeaders = getCorsHeaders(request);
  const rewardfulKey = env.REWARDFUL_API_KEY;

  try {
    const body = await request.json();
    const paypalEmail = (body.paypalEmail || '').trim();
    const legalName = (body.legalName || '').trim();
    const payoutMethod = (body.payoutMethod || '').trim();
    const street = (body.street || '').trim();
    const city = (body.city || '').trim();
    const state = (body.state || '').trim();
    const zip = (body.zip || '').trim();

    if (!paypalEmail) {
      return new Response(
        JSON.stringify({ error: 'PayPal or Wise email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!legalName) {
      return new Response(
        JSON.stringify({ error: 'Legal name is required for tax reporting' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get existing Airtable record — or create one if enrolled in Rewardful
    let existingRecord = await getAirtableReferralRecord(userEmail, apiKey);

    if (!existingRecord) {
      // No Airtable record — check if they're enrolled in Rewardful
      // (handles users who enrolled before the v2.0 flow existed)
      if (rewardfulKey) {
        const lookupResult = await rewardfulAPI(
          `/affiliates?email=${encodeURIComponent(userEmail)}`,
          rewardfulKey
        );
        const affiliates = lookupResult.data?.data || lookupResult.data || [];
        if (affiliates.length > 0) {
          // Enrolled in Rewardful but no Airtable record — create one now
          const affiliate = affiliates[0];
          const referralLink = affiliate.links?.[0]?.url ||
            (affiliate.token ? `https://www.mtg.broker?via=${affiliate.token}` : '');
          const created = await airtableRequest(
            REFERRAL_TABLE, apiKey, 'POST', {
              fields: {
                'Email': userEmail,
                'Rewardful Affiliate ID': affiliate.id || '',
                'Referral Link': referralLink,
                'Terms Accepted': true,
                'Terms Accepted Date': new Date().toISOString(),
                'Enrolled Date': new Date().toISOString()
              }
            }
          );
          existingRecord = created;
        }
      }

      // If still no record after checking Rewardful, block the request
      if (!existingRecord) {
        return new Response(
          JSON.stringify({ error: 'Must enroll first before setting up payouts' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Build legal address JSON
    const legalAddress = JSON.stringify({ street, city, state, zip });

    // Update Airtable
    const airtableFields = {
      'PayPal Email': paypalEmail,
      'Legal Name': legalName,
      'Legal Address': legalAddress,
      'Payout Method': payoutMethod || null,
      'Payout Setup Complete': true
    };

    await airtableRequest(
      `${REFERRAL_TABLE}/${existingRecord.id}`,
      apiKey, 'PATCH', { fields: airtableFields }
    );

    // Update Rewardful with PayPal email
    if (rewardfulKey && existingRecord.fields['Rewardful Affiliate ID']) {
      const affiliateId = existingRecord.fields['Rewardful Affiliate ID'];
      await rewardfulAPI(`/affiliates/${affiliateId}`, rewardfulKey, 'PUT', {
        paypal_email: paypalEmail
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        payoutSetupComplete: true,
        paypalEmail: paypalEmail,
        legalName: legalName,
        payoutMethod: payoutMethod || null
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Payout setup error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to save payout setup' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// ============================================================
// GET /api/referral/commissions
// Fetches commission history from Rewardful for this affiliate.
// Returns array of commissions with amount, status, date.
// ============================================================
async function getReferralCommissions(userEmail, apiKey, request, env) {
  const corsHeaders = getCorsHeaders(request);
  const rewardfulKey = env.REWARDFUL_API_KEY;

  if (!rewardfulKey) {
    return new Response(
      JSON.stringify({ error: 'Rewardful API key not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get the affiliate ID from Airtable
    const record = await getAirtableReferralRecord(userEmail, apiKey);
    const affiliateId = record?.fields?.['Rewardful Affiliate ID'];

    if (!affiliateId) {
      return new Response(
        JSON.stringify({ commissions: [], total: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch commissions from Rewardful
    const result = await rewardfulAPI(
      `/commissions?affiliate_id=${affiliateId}&limit=50`,
      rewardfulKey
    );

    if (!result.ok) {
      console.error('Rewardful commissions error:', result.status);
      return new Response(
        JSON.stringify({ commissions: [], total: 0, error: 'Failed to fetch commissions' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawCommissions = result.data?.data || result.data || [];

    // Map to a clean format for the frontend
    const commissions = rawCommissions.map(c => ({
      id: c.id,
      amount: c.amount || 0,          // Amount in cents
      currency: c.currency || 'USD',
      state: c.state || 'pending',     // pending, due, paid, voided
      createdAt: c.created_at,
      dueAt: c.due_at || null,
      paidAt: c.paid_at || null
    }));

    // Calculate totals
    const totalPending = commissions
      .filter(c => c.state === 'pending')
      .reduce((sum, c) => sum + c.amount, 0);
    const totalDue = commissions
      .filter(c => c.state === 'due')
      .reduce((sum, c) => sum + c.amount, 0);
    const totalPaid = commissions
      .filter(c => c.state === 'paid')
      .reduce((sum, c) => sum + c.amount, 0);

    return new Response(
      JSON.stringify({
        commissions,
        total: commissions.length,
        totalPendingCents: totalPending,
        totalDueCents: totalDue,
        totalPaidCents: totalPaid
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Commissions fetch error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to load commissions' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}


// ============================================================
// ADMIN STATS — /api/admin/stats
// Returns platform-wide aggregate counts for the Admin Hub.
// Only accessible to emails listed in ADMIN_EMAILS.
// ============================================================

/**
 * Fetch ALL records from an Airtable table, paginating automatically.
 * Returns the full array of records.
 * Fields are filtered to only the ones we need to keep the payload small.
 */
async function airtableFetchAll(tableId, apiKey, fields = [], filterFormula = '') {
  const allRecords = [];
  let offset = null;

  do {
    let params = `pageSize=100`;
    if (filterFormula) params += `&filterByFormula=${encodeURIComponent(filterFormula)}`;
    if (fields.length) params += fields.map(f => `&fields[]=${encodeURIComponent(f)}`).join('');
    if (offset) params += `&offset=${offset}`;

    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}?${params}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const data = await res.json();

    if (data.records) allRecords.push(...data.records);
    offset = data.offset || null;
  } while (offset);

  return allRecords;
}

/**
 * GET /api/admin/stats
 * Aggregates counts from Usage Tracking, Pipeline, Calculator Scenarios,
 * Goal Plans, Lender Notes, and Favorites tables.
 * Requires the requesting user to be in ADMIN_EMAILS.
 */
async function getAdminStats(userEmail, apiKey, request) {
  // Admin guard
  if (!ADMIN_EMAILS.includes(userEmail?.toLowerCase())) {
    return jsonResponse({ error: 'Forbidden — admin only' }, 403, request);
  }

  try {
    // Run all table fetches in parallel for speed
    const [usageRecords, loanRecords, scenarioRecords, goalPlanRecords, noteRecords, favoriteRecords] =
      await Promise.all([
        airtableFetchAll(TABLES.USAGE,    apiKey, ['User Email', 'Current Plan', 'Account Created']),
        airtableFetchAll(TABLES.LOANS,    apiKey, ['User Email', 'Stage', 'Deal Status']),
        airtableFetchAll(TABLES.SCENARIOS, apiKey, ['User Email', 'Calculator Type', 'Date Created']),
        airtableFetchAll(TABLES.GOAL_PLANS, apiKey, ['User Email', 'Planning Year']),
        airtableFetchAll('tblkn2kLWu2aOEwcS', apiKey, ['User Email', 'Updated At']),
        airtableFetchAll(TABLES.FAVORITES,  apiKey, ['User Email', 'Item Type', 'Date Added']),
      ]);

    // ── User / Plan breakdown ──────────────────────────────
    const totalUsers = usageRecords.length;
    const planCounts = { LITE: 0, PLUS: 0, PRO: 0 };
    usageRecords.forEach(r => {
      const plan = r.fields['Current Plan'] || 'LITE';
      if (plan in planCounts) planCounts[plan]++;
    });

    // Recent signups (last 10, newest first)
    const recentSignups = usageRecords
      .filter(r => r.fields['Account Created'])
      .sort((a, b) => new Date(b.fields['Account Created']) - new Date(a.fields['Account Created']))
      .slice(0, 10)
      .map(r => ({
        email: r.fields['User Email'],
        plan: r.fields['Current Plan'] || 'LITE',
        joined: r.fields['Account Created']
      }));

    // All paid accounts (PRO + PLUS), newest joined first
    const paidAccounts = usageRecords
      .filter(r => r.fields['Current Plan'] === 'PRO' || r.fields['Current Plan'] === 'PLUS')
      .sort((a, b) => new Date(b.fields['Account Created']) - new Date(a.fields['Account Created']))
      .map(r => ({
        email: r.fields['User Email'],
        plan: r.fields['Current Plan'],
        joined: r.fields['Account Created']
      }));

    // ── Pipeline Loans ─────────────────────────────────────
    const totalLoans = loanRecords.length;
    const activeLoans = loanRecords.filter(r => {
      const status = r.fields['Deal Status'];
      return !status || status === 'Active';
    }).length;
    const closedLoans = loanRecords.filter(r => r.fields['Deal Status'] === 'Won').length;

    // Stage breakdown (top 8 stages by count)
    const stageCounts = {};
    loanRecords.forEach(r => {
      const stage = r.fields['Stage'] || 'Unknown';
      stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    });
    const topStages = Object.entries(stageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([stage, count]) => ({ stage, count }));

    // Unique users with pipeline loans
    const loanUserEmails = new Set(loanRecords.map(r => r.fields['User Email']).filter(Boolean));
    const usersWithLoans = loanUserEmails.size;

    // ── Calculator Saves ───────────────────────────────────
    const totalCalcSaves = scenarioRecords.length;

    // By calculator type
    const calcTypeCounts = {};
    scenarioRecords.forEach(r => {
      const type = r.fields['Calculator Type'] || 'Unknown';
      calcTypeCounts[type] = (calcTypeCounts[type] || 0) + 1;
    });
    const calcTypeBreakdown = Object.entries(calcTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));

    // Unique users with saves
    const calcUserEmails = new Set(scenarioRecords.map(r => r.fields['User Email']).filter(Boolean));
    const usersWithCalcSaves = calcUserEmails.size;

    // ── Goal Plans ─────────────────────────────────────────
    const totalGoalPlans = goalPlanRecords.length;
    const goalUserEmails = new Set(goalPlanRecords.map(r => r.fields['User Email']).filter(Boolean));
    const usersWithGoalPlans = goalUserEmails.size;

    // ── Lender Notes ───────────────────────────────────────
    const totalLenderNotes = noteRecords.length;
    const noteUserEmails = new Set(noteRecords.map(r => r.fields['User Email']).filter(Boolean));
    const usersWithNotes = noteUserEmails.size;

    // ── Favorites ──────────────────────────────────────────
    const totalFavorites = favoriteRecords.length;
    const favTypeCounts = {};
    favoriteRecords.forEach(r => {
      const type = r.fields['Item Type'] || 'Unknown';
      favTypeCounts[type] = (favTypeCounts[type] || 0) + 1;
    });
    const favUserEmails = new Set(favoriteRecords.map(r => r.fields['User Email']).filter(Boolean));
    const usersWithFavorites = favUserEmails.size;

    return jsonResponse({
      generatedAt: new Date().toISOString(),
      users: {
        total: totalUsers,
        byPlan: planCounts,
        paidAccounts,
        recentSignups
      },
      pipeline: {
        totalLoans,
        activeLoans,
        closedLoans,
        usersWithLoans,
        topStages
      },
      calculators: {
        totalSaves: totalCalcSaves,
        usersWithSaves: usersWithCalcSaves,
        byType: calcTypeBreakdown
      },
      goalPlans: {
        total: totalGoalPlans,
        usersWithPlans: usersWithGoalPlans
      },
      lenderNotes: {
        total: totalLenderNotes,
        usersWithNotes
      },
      favorites: {
        total: totalFavorites,
        usersWithFavorites,
        byType: favTypeCounts
      }
    }, 200, request);

  } catch (err) {
    console.error('Admin stats error:', err);
    return jsonResponse({ error: 'Failed to load admin stats' }, 500, request);
  }
}


export default {
  async fetch(request, env, ctx) {
    // Handle OPTIONS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...getCorsHeaders(request),
        },
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const apiKey = env.AIRTABLE_API_KEY;

    // CRIT-1: Verify the JWT signature before trusting any user identity.
    // verifyOutsetaJWT() checks the RS256 signature, expiration, and issuer.
    // userEmail is extracted from the verified payload — never from the raw header.
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') || '';
    const jwtPayload = await verifyOutsetaJWT(token);
    const userEmail = jwtPayload ? sanitizeEmailForFormula(jwtPayload.email) : null;

    // ============================================================
    // PUBLIC ROUTES (No authentication required)
    // ============================================================
    
    // PWA Manifest endpoint - for mobile app installation
    if (path === '/manifest.json' && method === 'GET') {
      return await getManifest(request);
    }

    // Pipeline Calculators external JS module
    if (path === '/static/pipeline-calcs.js' && method === 'GET') {
      return await getPipelineCalcsJS(request);
    }
    
    if (path === '/api/rates' && method === 'GET') {
      return await getRates(request);
    }
    
    if (path === '/api/loan-products' && method === 'GET') {
      return await getLoanProducts(apiKey, request);
    }
    
    if (path === '/api/loan-products/clear-cache' && method === 'GET') {
      // MED-2: Require admin token to prevent unauthenticated cache-busting / Airtable rate exhaustion
      const cacheToken = request.headers.get('X-Admin-Token');
      if (!cacheToken || cacheToken !== env.CACHE_CLEAR_TOKEN) {
        return jsonResponse({ error: 'Unauthorized' }, 401, request);
      }
      return await clearLoanProductsCache(request);
    }

    // Loan Product Types — Products detail page (/app/products/{slug})
    if (path === '/api/loan-product-types' && method === 'GET') {
      return await getLoanProductType(apiKey, request);
    }

    // Products List — Products listing page (/app/products)
    if (path === '/api/products-list' && method === 'GET') {
      return await fetchProductsList(apiKey, request);
    }

    if (path === '/api/products-list/clear-cache' && method === 'GET') {
      // MED-2: Require admin token
      const cacheToken = request.headers.get('X-Admin-Token');
      if (!cacheToken || cacheToken !== env.CACHE_CLEAR_TOKEN) {
        return jsonResponse({ error: 'Unauthorized' }, 401, request);
      }
      return await clearProductsListCache(request);
    }

    // Credit Vendors endpoint - public route (NEXA gating is page-level)
    if (path === '/api/credit-vendors' && method === 'GET') {
      const corsHeaders = getCorsHeaders(request);
      return await handleCreditVendors(request, env, corsHeaders);
    }

    // Logo serve endpoint - public so logos can be displayed anywhere
    if (path.startsWith('/api/logos/') && method === 'GET') {
      const r2Key = decodeURIComponent(path.replace('/api/logos/', ''));
      return await serveLogo(r2Key, request, env);
    }

    // Avatar serve endpoint - public so profile pics can be displayed anywhere
    if (path.startsWith('/api/avatars/') && method === 'GET') {
      const r2Key = decodeURIComponent(path.replace('/api/avatars/', ''));
      return await serveAvatar(r2Key, request, env);
    }
    
    if (path === '/health' || path === '/') {
      return jsonResponse({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        endpoints: [
          'GET /manifest.json (PWA manifest)',
          'GET /static/pipeline-calcs.js (Calculator module)',
          'GET /api/rates',
          'GET /api/loan-products',
          'GET /api/loan-products/clear-cache',
          'GET /api/loan-product-types (Products detail page)',
          'GET /api/products-list (Products listing page)',
          'GET /api/products-list/clear-cache',
          'GET /api/credit-vendors',
          'GET /api/logos/:key (public logo serve)',
          'GET /api/avatars/:key (public avatar serve)',
          'GET /api/pipeline/loans',
          'GET /api/pipeline/loans/clear-cache',
          'GET /api/favorites',
          'GET /api/calculator-scenarios',
          'GET /api/usage',
          'GET /api/plan-limits',
          'GET /api/goal-plan',
          'POST /api/goal-plan',
          'PUT /api/goal-plan/:id',
          'GET /api/broker-profile',
          'POST /api/broker-profile',
          'PUT /api/broker-profile/:id',
          'POST /api/broker-profile/logo (upload)',
          'DELETE /api/broker-profile/logo',
          'POST /api/broker-profile/avatar (upload)',
          'DELETE /api/broker-profile/avatar',
          'GET /api/referral (Rewardful affiliate lookup)',
          'POST /api/referral/enroll (accept terms + create affiliate)',
          'PUT /api/referral/payout-setup (save payout info)',
          'GET /api/referral/commissions (commission history)'
        ]
      }, 200, request);
    }

    // ============================================================
    // AUTHENTICATED ROUTES (Require user email)
    // ============================================================
    
    if (!userEmail) {
      return jsonResponse({ error: 'Unauthorized - No user email' }, 401, request);
    }

    try {
      // PIPELINE LOANS
      if (path === '/api/pipeline/loans' && method === 'GET') {
        return await getLoans(userEmail, apiKey, request);
      }
      // NEW: Clear cache endpoint for pipeline loans
      if (path === '/api/pipeline/loans/clear-cache' && method === 'GET') {
        return await clearPipelineCache(userEmail, request);
      }
      if (path === '/api/pipeline/loans' && method === 'POST') {
        const body = await request.json();
        return await createLoan(userEmail, body, apiKey, request);
      }
      if (path.match(/^\/api\/pipeline\/loans\/rec\w+$/) && method === 'PUT') {
        const recordId = path.split('/').pop();
        const body = await request.json();
        return await updateLoan(userEmail, recordId, body, apiKey, request);
      }
      if (path.match(/^\/api\/pipeline\/loans\/rec\w+$/) && method === 'DELETE') {
        const recordId = path.split('/').pop();
        return await deleteLoan(userEmail, recordId, apiKey, request);
      }

      // PIPELINE TASKS
      if (path === '/api/pipeline/tasks' && method === 'GET') {
        const loanId = url.searchParams.get('loanId');
        return await getTasks(userEmail, loanId, apiKey, request);
      }
      if (path === '/api/pipeline/tasks' && method === 'POST') {
        const body = await request.json();
        return await createTask(userEmail, body, apiKey, request);
      }
      if (path.match(/^\/api\/pipeline\/tasks\/rec\w+$/) && method === 'PUT') {
        const recordId = path.split('/').pop();
        const body = await request.json();
        return await updateTask(userEmail, recordId, body, apiKey, request);
      }
      if (path.match(/^\/api\/pipeline\/tasks\/rec\w+$/) && method === 'DELETE') {
        const recordId = path.split('/').pop();
        return await deleteTask(userEmail, recordId, apiKey, request);
      }

      // FAVORITES
      if (path === '/api/favorites' && method === 'GET') {
        return await getFavorites(userEmail, apiKey, request);
      }
      if (path === '/api/favorites' && method === 'POST') {
        return await createFavorite(userEmail, apiKey, request);
      }
      if (path.match(/^\/api\/favorites\/rec\w+$/) && method === 'DELETE') {
        const favoriteId = path.split('/').pop();
        return await deleteFavorite(userEmail, apiKey, request, favoriteId);
      }
      
      // CALCULATOR SCENARIOS
      if (path === '/api/calculator-scenarios' && method === 'GET') {
        return await getScenarios(userEmail, apiKey, request);
      }
      if (path === '/api/calculator-scenarios' && method === 'POST') {
        return await createScenario(userEmail, apiKey, request);
      }
      if (path.match(/^\/api\/calculator-scenarios\/rec\w+$/) && method === 'PUT') {
        const scenarioId = path.split('/').pop();
        return await updateScenario(userEmail, apiKey, request, scenarioId);
      }
      if (path.match(/^\/api\/calculator-scenarios\/rec\w+$/) && method === 'DELETE') {
        const scenarioId = path.split('/').pop();
        return await deleteScenario(userEmail, apiKey, request, scenarioId);
      }
      
      // USAGE TRACKING
      if (path === '/api/usage' && method === 'GET') {
        return await getUsage(userEmail, apiKey, request);
      }
      if (path === '/api/usage' && method === 'PUT') {
        return await updateUsage(userEmail, apiKey, request);
      }
      
      // PLAN LIMITS
      if (path === '/api/plan-limits' && method === 'GET') {
        return await checkPlanLimits(userEmail, apiKey, request);
      }

      // GOAL PLANS (Goal Setting page)
      if (path === '/api/goal-plan' && method === 'GET') {
        return await getGoalPlan(userEmail, apiKey, request);
      }
      if (path === '/api/goal-plan' && method === 'POST') {
        return await createGoalPlan(userEmail, apiKey, request);
      }
      if (path.match(/^\/api\/goal-plan\/rec\w+$/) && method === 'PUT') {
        const recordId = path.split('/').pop();
        return await updateGoalPlan(userEmail, recordId, apiKey, request);
      }

      // BROKER PROFILES (Settings page - company address, logo, disclaimer)
      if (path === '/api/broker-profile' && method === 'GET') {
        return await getBrokerProfile(userEmail, apiKey, request);
      }
      if (path === '/api/broker-profile' && method === 'POST') {
        return await createBrokerProfile(userEmail, apiKey, request);
      }
      if (path.match(/^\/api\/broker-profile\/rec\w+$/) && method === 'PUT') {
        const recordId = path.split('/').pop();
        return await updateBrokerProfile(userEmail, recordId, apiKey, request);
      }

      // LOGO UPLOAD/DELETE (R2 Storage - authenticated)
      if (path === '/api/broker-profile/logo' && method === 'POST') {
        return await uploadLogo(userEmail, request, env);
      }
      if (path === '/api/broker-profile/logo' && method === 'DELETE') {
        return await deleteLogo(userEmail, request, env);
      }

      // AVATAR (PROFILE PIC) UPLOAD/DELETE (R2 Storage - authenticated)
      if (path === '/api/broker-profile/avatar' && method === 'POST') {
        return await uploadAvatar(userEmail, request, env);
      }
      if (path === '/api/broker-profile/avatar' && method === 'DELETE') {
        return await deleteAvatar(userEmail, request, env);
      }

      // REFERRAL PROGRAM (Rewardful + Airtable) — PRO plan only
      if (path.startsWith('/api/referral')) {
        const PRO_PLAN_UID = 'yWobBP9D';
        const userPlanUid = jwtPayload?.['outseta:planUid'] || '';
        if (userPlanUid !== PRO_PLAN_UID) {
          return jsonResponse({
            error: 'Referral program is available on the PRO plan. Please upgrade to access this feature.'
          }, 403, request);
        }

        if (path === '/api/referral' && method === 'GET') {
          return await getReferralStatus(userEmail, apiKey, request, env);
        }
        if (path === '/api/referral/enroll' && method === 'POST') {
          return await enrollAffiliate(userEmail, apiKey, request, env);
        }
        if (path === '/api/referral/payout-setup' && method === 'PUT') {
          return await updatePayoutSetup(userEmail, apiKey, request, env);
        }
        if (path === '/api/referral/commissions' && method === 'GET') {
          return await getReferralCommissions(userEmail, apiKey, request, env);
        }
      }


      // ADMIN STATS — admin-only endpoint for Admin Hub dashboard
      if (path === '/api/admin/stats' && method === 'GET') {
        return await getAdminStats(userEmail, apiKey, request);
      }

      return jsonResponse({ error: 'Not found' }, 404, request);

    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({ error: 'Internal server error' }, 500, request);
    }
  }
};
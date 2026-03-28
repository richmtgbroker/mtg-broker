// Cloudflare Pages Function — List loan products for AI Matrix Review
// v1.0 — Fetches records from Airtable with AI review fields,
// supports filtering by status and search query.

// ─── CORS ───────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://mtg.broker',
  'https://www.mtg.broker',
  'https://mtg-matrix-review.pages.dev',
  'https://mtg-app.pages.dev',
  'https://mtg-app-staging.pages.dev',
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/[a-f0-9]+\.mtg-matrix-review\.pages\.dev$/.test(origin)) return true;
  if (/^https:\/\/[a-f0-9]+\.mtg-app-staging\.pages\.dev$/.test(origin)) return true;
  if (/^https:\/\/[a-f0-9]+\.mtg-app\.pages\.dev$/.test(origin)) return true;
  // Allow localhost for development
  if (/^http:\/\/localhost:\d+$/.test(origin)) return true;
  return false;
}

function getCorsHeaders(request) {
  const origin = request ? request.headers.get('Origin') : null;
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// ─── JWT VERIFICATION (RS256) ───────────────────────────────────────────────
let jwksCache = null;
let jwksCacheTimestamp = null;
const JWKS_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

async function getOutsetaJwks() {
  const now = Date.now();
  if (jwksCache && jwksCacheTimestamp && (now - jwksCacheTimestamp < JWKS_CACHE_DURATION)) {
    return jwksCache;
  }
  const res = await fetch('https://mtgbroker.outseta.com/.well-known/jwks');
  if (!res.ok) throw new Error('Failed to fetch JWKS');
  jwksCache = await res.json();
  jwksCacheTimestamp = now;
  return jwksCache;
}

async function verifyOutsetaJWT(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const b64 = (s) => s.replace(/-/g, '+').replace(/_/g, '/');
    const header  = JSON.parse(atob(b64(parts[0])));
    const payload = JSON.parse(atob(b64(parts[1])));

    // Check expiry
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    // Verify signature with Outseta JWKS
    const jwks = await getOutsetaJwks();
    const key = jwks.keys.find(k => k.kid === header.kid);
    if (!key) return null;

    const cryptoKey = await crypto.subtle.importKey(
      'jwk', key, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
    );

    const signatureBytes = Uint8Array.from(atob(b64(parts[2])), c => c.charCodeAt(0));
    const dataBytes = new TextEncoder().encode(parts[0] + '.' + parts[1]);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signatureBytes, dataBytes);
    return valid ? payload : null;
  } catch {
    return null;
  }
}

// ─── ADMIN CHECK ────────────────────────────────────────────────────────────
// Only admin users can access the matrix review tool
const ADMIN_EMAILS = ['rich@mtg.broker', 'rich@prestonlending.com'];

function isAdmin(payload) {
  if (!payload || !payload.email) return false;
  return ADMIN_EMAILS.includes(payload.email.toLowerCase());
}

// ─── AIRTABLE CONFIG ────────────────────────────────────────────────────────
const AIRTABLE_BASE_ID = 'appuJgI9X93OLaf0u';
const AIRTABLE_TABLE_ID = 'tblVSU5z4WSxreX7l'; // Loan Search table

// Fields to fetch from Airtable for the list view and detail view
const LIST_FIELDS = [
  'Lender and product and version',     // fldBqgio9uc79xEMY - formula (display name)
  'AI: Review Status',                   // fldcKhMZ17MO2ajfn
  'AI: Last Run Date',                   // fld8r6AnKkKFz4kR2
  'AI: Confidence',                      // fldUDsBTbGEeco9Kv
  'Lender Product Name | Version (Final)', // fldVbH84LZjCutU2n - formula
  'Matrix Document',                     // fld83rKW7bCng97zr - attachment
  'Matrix Date',                         // flde8RHhfKDSxlAHn
  'Product Status',                      // fldl5uXa9QsJGCNfB
  'AI: Analysis Summary',               // fldxyQrPEpm2qVrrt
  'Lender Name (from Lender Name)',      // fld16K2p7hVi00f4w - lookup
];

// All AI: fields for the detail view
const DETAIL_FIELDS = [
  // FICO section
  'Min FICO', 'AI: Min FICO', 'AI: Min FICO (Rate-Term)', 'AI: Min FICO (Cash-Out)',
  'AI: Min FICO (MH)', 'AI: Min FICO (Investment)', 'AI: Min FICO (2nd Home)',
  'AI: Min FICO (FTHB)', 'AI: Min FICO (1st Time Investor)', 'AI: Min FICO (Manual UW)',
  'AI: Min Blended FICO', 'AI: # of Scores Required', 'AI: FICO Notes',
  // LTV section
  'Max LTV (Purch)', 'AI: Max LTV (Purch)', 'Max LTV (RT)', 'AI: Max LTV (RT)',
  'Max LTV (Cash Out)', 'AI: Max LTV (Cash Out)', 'AI: Max LTV (MH)', 'AI: Max LTV (2-4 Units)',
  'AI: LTV Reductions', 'AI: LTV and DTI Notes',
  // CLTV / DTI
  'Max CLTV', 'AI: Max CLTV', 'AI: Max CLTV (Investment)', 'AI: Max CLTV (2nd Homes)',
  'Max DTI', 'AI: Max DTI', 'AI: Max DTI (Manual UW)', 'AI: Manual UW Allowed?',
  // Loan Amounts
  'Min Loan Amount', 'AI: Min Loan Amount', 'Max Loan Amount (singleSelect)',
  'AI: Max Loan Amount', 'AI: Max Cash-Out', 'AI: Max Cash-Out (2 Unit)',
  'AI: Max Cash Back at Closing (RT Refi)', 'AI: Max Loan (1st Time Investor)',
  'AI: Loan Amounts Notes',
  // Borrower Eligibility
  'AI: FTHB Allowed?', 'FTHB Allowed?', 'AI: FTHB Required?', 'AI: Homebuyer Education Reqd?',
  'AI: Cash-Out Available?', 'AI: Vest in LLC', 'AI: Borrower Requirements Notes',
  'AI: Gift Funds Allowed', 'AI: Max Seller Concessions',
  // Income
  'AI: Income Notes',
  // Reserves
  'AI: Reserves Required', 'AI: Reserves Required (Cash-Out)',
  'AI: Cash-Out As Reserves Allowed?', 'AI: Additional Reserves', 'AI: Reserves Notes',
  // Investor / Special Eligibility
  'AI: First Time Investors Allowed?', 'AI: NOCB Allowed?',
  'AI: Non-Perm Residents?', 'AI: Foreign National?', 'AI: ITIN Allowed?',
  'AI: DACA Eligible?', 'AI: Foreign Credit?', 'AI: Perm Resident Aliens',
  // Credit Events
  'AI: FC | SS | DIL Seasoning', 'AI: Bankruptcy Seasoning', 'AI: Mortgage Lates',
  'AI: Ownership Seasoning (Cash-Out)', 'AI: Ownership Seasoning (RT)',
  'AI: Current Bankruptcy', 'AI: Discharged Bankruptcy', 'AI: Asset Seasoning',
  'AI: Flip Rules',
  // Property
  'AI: PROPERTY TYPES Notes', 'AI: Rural Allowed?', 'AI: Max Acres',
  'AI: Max Acres (Investment)', 'AI: Min Sq Ft', 'AI: Max Multi-Units',
  // Appraisal
  'AI: Appraisal Transfers', 'AI: Appraisal Waivers?',
  // Financed Properties
  'AI: Max Financed Properties', 'AI: Max Agency Financed', 'AI: Max Lender Financed',
  'AI: Vesting Requirement', 'AI: Must Own or Rent?',
  // Loan Features
  'AI: Terms Available', 'AI: Amortization', 'AI: Interest Only?',
  'AI: Buydowns', 'AI: Buydowns Paid By',
  'AI: Prepayment Penalty (PPP)', 'AI: PPP Terms', 'AI: EPO Timeframe',
  // Tradelines
  'AI: Tradeline Requirements', 'AI: Tradeline Notes', 'AI: Credit Report Type',
  // Fees
  'AI: FEE Notes',
  // DSCR section
  'AI: DSCR Min Ratio', 'AI: DSCR Min Ratio (FTI)', 'AI: DSCR Min Ratio (STR)',
  'AI: DSCR STR Income?', 'AI: DSCR PPP Options', 'AI: DSCR Primary Home Req',
  'AI: DSCR Asset Seasoning', 'AI: DSCR Lease Payment?',
  'AI: DSCR No License States', 'AI: DSCR Notes',
  // Fix & Flip section
  'AI: FNF Max LTC', 'AI: FNF Max LTC (FTI)', 'AI: FNF ARV',
  'AI: FNF LTV Purchase', 'AI: FNF Interest Rate', 'AI: FNF Experience Required',
  'AI: FNF Asset Seasoning', 'AI: FNF Self Help?', 'AI: FNF Origination Fee',
  'AI: FNF Min Value Per Property', 'AI: FNF % Construction Covered',
  'AI: FNF Vesting', 'AI: FNF Notes',
  // HELOC section
  'AI: HELOC Draw Period', 'AI: HELOC Repay Period', 'AI: HELOC Lien Positions',
  'AI: HELOC Payoff Debt to Qualify?', 'AI: HELOC Appraisal AVM', 'AI: HELOC AVM BPO',
  'AI: HELOC Listed Eligible?', 'AI: HELOC Initial Draw', 'AI: HELOC Origination Fee',
  'AI: HELOC Max Combined Liens', 'AI: HELOC Seasoning Listed',
  // Bank Statement section
  'AI: BS Months', 'AI: BS Expense Ratio', 'AI: BS Min Expense Ratio',
  'AI: BS Account Type', 'AI: BS % of Deposits', 'AI: BS Co-Mingled?', 'AI: BS Notes',
  // P&L section
  'AI: P&L SE Length', 'AI: P&L Prepared By', 'AI: P&L Audited?',
  'AI: P&L Months Bank Stmts', 'AI: P&L Months of P&L',
  'AI: P&L Same Line of Work',
  // OTC (One-Time Close) section
  'AI: OTC Self Builds?', 'AI: OTC Rate Lock', 'AI: OTC Construction Rate',
  'AI: OTC Construction Rate (MH)', 'AI: OTC Construction Period',
  'AI: OTC Interest During?', 'AI: OTC Draw at Closing', 'AI: OTC Float Down?',
  'AI: OTC Payments During?', 'AI: OTC Contingency',
  // DPA section
  'AI: DPA % Assistance', 'AI: DPA Income Restriction', 'AI: DPA 2nd Lien Rate',
  'AI: DPA Forgivable/Repayable?', 'AI: DPA Forgivable After',
  'AI: DPA Monthly Payments?', 'AI: DPA Term', 'AI: DPA Notes',
  // 1099 section
  'AI: 1099 Years', 'AI: 1099 Expense Factor',
  // Asset Utilization
  'AI: Asset Util Months Divided By',
  // Source data
  'Extracted Text', 'AI JSON Output',
  // Links
  'Matrix', 'Flyer | Info Page', 'Pricing', 'Guidelines',
  'Lender Product Name | Version', 'Notes',
];

// ─── HANDLER ────────────────────────────────────────────────────────────────
export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Verify JWT — admin only
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const payload = await verifyOutsetaJWT(token);

    if (!payload) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isAdmin(payload)) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse query parameters
    const url = new URL(request.url);
    const status = url.searchParams.get('status');       // Filter by AI: Review Status
    const search = url.searchParams.get('search');       // Search by product name
    const offset = url.searchParams.get('offset') || ''; // Airtable pagination offset
    const recordId = url.searchParams.get('recordId');   // Fetch single record detail
    const pageSize = 100;

    // Build Airtable API URL
    const apiKey = env.AIRTABLE_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If requesting a single record detail, fetch it directly
    if (recordId) {
      const detailUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${recordId}`;
      const detailRes = await fetch(detailUrl, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (!detailRes.ok) {
        const errText = await detailRes.text();
        return new Response(JSON.stringify({ error: 'Failed to fetch record', details: errText }), {
          status: detailRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const record = await detailRes.json();
      return new Response(JSON.stringify({ record }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build list request URL with field selection
    let airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?pageSize=${pageSize}`;

    // Add fields to fetch (list view fields only for list requests)
    for (const field of LIST_FIELDS) {
      airtableUrl += `&fields[]=${encodeURIComponent(field)}`;
    }

    // Sort by product name
    airtableUrl += `&sort[0][field]=${encodeURIComponent('Lender and product and version')}&sort[0][direction]=asc`;

    // Build filter formula
    const filters = [];
    if (status) {
      filters.push(`{AI: Review Status} = '${status}'`);
    }
    if (search) {
      // Search across product name
      filters.push(`FIND(LOWER("${search.replace(/"/g, '\\"')}"), LOWER({Lender and product and version}))`);
    }

    if (filters.length > 0) {
      const formula = filters.length === 1 ? filters[0] : `AND(${filters.join(', ')})`;
      airtableUrl += `&filterByFormula=${encodeURIComponent(formula)}`;
    }

    if (offset) {
      airtableUrl += `&offset=${encodeURIComponent(offset)}`;
    }

    // Fetch from Airtable
    const airtableRes = await fetch(airtableUrl, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!airtableRes.ok) {
      const errText = await airtableRes.text();
      return new Response(JSON.stringify({ error: 'Airtable request failed', details: errText }), {
        status: airtableRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await airtableRes.json();

    return new Response(JSON.stringify({
      records: data.records,
      offset: data.offset || null,  // null means no more pages
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// Handle OPTIONS preflight for CORS
export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context.request),
  });
}

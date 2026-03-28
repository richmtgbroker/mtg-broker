// Cloudflare Pages Function for loan product search
// v2.1 — Security hardening: JWT signature verification (RS256),
// CORS origin lockdown, server-side plan enforcement.
// v2.0 — Uses Claude Haiku to parse scenarios (replaces fragile regex),
// Supabase RPC scoring function for ranked results, and condensed
// field selection to reduce token usage.

// ─── CORS ───────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://mtg.broker',
  'https://www.mtg.broker',
  'https://mtg-loan-finder.pages.dev',
  'https://mtg-app.pages.dev',
  'https://mtg-app-staging.pages.dev',
  'https://mtg-app-stage.pages.dev',
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/[a-f0-9]+\.mtg-app-staging\.pages\.dev$/.test(origin)) return true;
  if (/^https:\/\/[a-f0-9]+\.mtg-app-stage\.pages\.dev$/.test(origin)) return true;
  if (/^https:\/\/[a-f0-9]+\.mtg-app\.pages\.dev$/.test(origin)) return true;
  if (/^https:\/\/[a-f0-9]+\.mtg-loan-finder\.pages\.dev$/.test(origin)) return true;
  return false;
}

function getCorsHeaders(request) {
  const origin = request ? request.headers.get('Origin') : null;
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}


// ─── PLAN LIMITS ─────────────────────────────────────────────────────────────
const PLAN_UIDS = {
  LITE: 'NmdnZg90',
  PLUS: 'Dmw8leQ4',
  PRO:  'yWobBP9D',
};

const LITE_DAILY_SEARCH_LIMIT = 5;


// ─── JWT VERIFICATION (RS256) ───────────────────────────────────────────────
// Verifies the Outseta JWT signature using their public JWKS endpoint.
// Returns the decoded payload if valid, null if invalid/expired/forged.

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


function getPlanName(planUid) {
  if (planUid === PLAN_UIDS.PRO) return 'PRO';
  if (planUid === PLAN_UIDS.PLUS) return 'PLUS';
  return 'LITE';
}


// Count how many searches a user has done today (UTC)
async function getTodaySearchCount(supabaseUrl, supabaseKey, userEmail) {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayIso = todayStart.toISOString();

  const url = `${supabaseUrl}/rest/v1/search_log?select=id&user_email=eq.${encodeURIComponent(userEmail)}&searched_at=gte.${encodeURIComponent(todayIso)}`;

  const response = await fetch(url, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'count=exact',
      'Range-Unit': 'items',
      'Range': '0-0',
    }
  });

  if (!response.ok) {
    console.error('Search count query failed:', response.status);
    return 0;
  }

  const contentRange = response.headers.get('Content-Range');
  if (contentRange) {
    const match = contentRange.match(/\/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }

  return 0;
}


// Log a search to the search_log table (fire-and-forget)
async function logSearch(supabaseUrl, supabaseKey, userEmail, planUid, scenario) {
  try {
    await fetch(`${supabaseUrl}/rest/v1/search_log`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_email: userEmail,
        plan_uid: planUid || 'unknown',
        scenario: scenario.substring(0, 500),
      }),
    });
  } catch (e) {
    console.error('Failed to log search:', e.message);
  }
}


// ─── STEP 1: USE CLAUDE HAIKU TO PARSE THE SCENARIO ─────────────────────────
// This replaces the old fragile regex-based parseScenarioForFilters function.
// Claude understands context — "720 credit score" won't become a $720K loan amount,
// "VA loan" won't set state to Virginia, and complex scenarios are handled naturally.

const PARSE_PROMPT = `You are a mortgage scenario parser. Extract structured search parameters from the loan officer's scenario.

Return ONLY a valid JSON object (no markdown, no backticks):
{
  "fico": number or null (credit score, 300-850),
  "loan_amount": number or null (in dollars, e.g. 500000),
  "occupancy": "Primary" | "Investment" | "Second" | null,
  "property_type": "SFR" | "Condo" | "Townhouse" | "2 Units" | "3 Units" | "4 Units" | "Manufactured" | "PUD" | "Mixed-Use" | null,
  "purpose": "Purchase" | "Cash-Out" | "Refinance" | "HELOC" | null,
  "state": "XX" (2-letter code) or null,
  "loan_type": "FHA" | "VA" | "USDA" | "Conventional" | "Jumbo" | "DSCR" | "Bank Statement" | "Non-QM" | "HELOC" | "Reverse" | "Hard Money" | null,
  "special_flags": ["fthb", "itin", "foreign_national", "self_employed", "daca", "str", "llc", "bankruptcy", "foreclosure", "interest_only", "non_warrantable_condo"] (only include relevant ones),
  "key_factors": ["brief phrases describing other important scenario details"]
}

RULES:
- "VA loan" = loan_type "VA", NOT state Virginia
- "5% down" or "buying" = purpose "Purchase"
- "first-time homebuyer" = occupancy "Primary" + special_flag "fthb"
- "self-employed" or "bank statements" for income = special_flag "self_employed"
- "Airbnb", "VRBO", "short-term rental" = special_flag "str"
- "investment property" = occupancy "Investment"
- "duplex" = property_type "2 Units"
- Down payment percentage → calculate LTV if possible (20% down = loan_amount null but note in key_factors)
- If purpose is clearly HELOC/home equity, set BOTH purpose and loan_type to capture it
- Only extract what's explicitly stated — don't guess`;


async function parseScenarioWithClaude(scenario, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: `Parse this mortgage scenario:\n\n"${scenario}"` }],
      system: PARSE_PROMPT,
    }),
  });

  if (!response.ok) {
    console.error('Parse API error:', response.status);
    // Fall back to basic regex parsing if Claude is unavailable
    return fallbackParse(scenario);
  }

  const data = await response.json();
  let text = '';
  if (data.content && Array.isArray(data.content)) {
    for (const block of data.content) {
      if (block.type === 'text') text += block.text;
    }
  }

  try {
    // Clean markdown if present
    let cleaned = text;
    if (cleaned.includes('```')) {
      cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    }
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Parse JSON error:', e.message);
  }

  // Fall back to basic parsing if Claude response can't be parsed
  return fallbackParse(scenario);
}


// Minimal regex fallback — only used if Claude Haiku is down
function fallbackParse(scenario) {
  const lower = scenario.toLowerCase();
  const filters = {};

  // FICO
  const ficoMatch = scenario.match(/(\d{3})\s*(?:fico|credit|score)/i) ||
                    scenario.match(/(?:fico|credit|score)[:\s]*(\d{3})/i);
  if (ficoMatch) {
    const score = parseInt(ficoMatch[1], 10);
    if (score >= 300 && score <= 850) filters.fico = score;
  }

  // Basic loan type
  if (lower.includes('dscr')) filters.loan_type = 'DSCR';
  else if (lower.includes('fha')) filters.loan_type = 'FHA';
  else if (lower.includes('heloc')) filters.loan_type = 'HELOC';
  else if (lower.includes('conventional')) filters.loan_type = 'Conventional';

  // Basic occupancy
  if (lower.includes('investment')) filters.occupancy = 'Investment';
  else if (lower.includes('primary')) filters.occupancy = 'Primary';

  // Basic purpose
  if (lower.includes('purchase') || lower.includes('buying')) filters.purpose = 'Purchase';
  else if (lower.includes('cash-out') || lower.includes('cash out')) filters.purpose = 'Cash-Out';

  filters.special_flags = [];
  filters.key_factors = [];
  return filters;
}


// ─── STEP 2: QUERY SUPABASE WITH SCORING FUNCTION ───────────────────────────
// Calls the match_loan_products RPC function which scores and ranks products
// instead of hard binary filtering. Near-misses are included with lower scores.

async function queryScoredProducts(env, parsed) {
  const supabaseUrl = env.SUPABASE_URL || 'https://tcmahfwhdknxhhdvqpum.supabase.co';
  const supabaseKey = env.SUPABASE_ANON_KEY;

  if (!supabaseKey) throw new Error('SUPABASE_ANON_KEY not configured');

  const rpcUrl = `${supabaseUrl}/rest/v1/rpc/match_loan_products`;

  // Build RPC parameters from parsed scenario
  const rpcBody = {
    p_fico: parsed.fico || null,
    p_loan_amount: parsed.loan_amount || null,
    p_occupancy: parsed.occupancy || null,
    p_property_type: parsed.property_type || null,
    p_purpose: parsed.purpose || null,
    p_state: parsed.state || null,
    p_loan_type: parsed.loan_type || null,
    p_special_flags: parsed.special_flags || [],
    p_limit: 100,
  };

  console.log('RPC params:', JSON.stringify(rpcBody));

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(rpcBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Supabase RPC error:', response.status, errorText);
    // Fall back to basic query if RPC function doesn't exist yet
    return querySupabaseFallback(env, parsed);
  }

  return response.json();
}


// Fallback: basic PostgREST query (same as old approach) if RPC isn't available
async function querySupabaseFallback(env, parsed) {
  const supabaseUrl = env.SUPABASE_URL || 'https://tcmahfwhdknxhhdvqpum.supabase.co';
  const supabaseKey = env.SUPABASE_ANON_KEY;
  const baseUrl = `${supabaseUrl}/rest/v1/loan_products`;
  const params = new URLSearchParams();

  params.set('select', '*');
  params.append('product_status', 'ilike.*Active*');

  // Soft FICO filter (include nulls)
  if (parsed.fico) {
    params.append('or', `(min_fico.lte.${parsed.fico},min_fico.is.null)`);
  }

  // Loan type, occupancy, property type, purpose (partial match)
  if (parsed.loan_type)     params.append('loan_product_type', `ilike.*${parsed.loan_type}*`);
  if (parsed.occupancy)     params.append('occupancy_choices', `ilike.*${parsed.occupancy}*`);
  if (parsed.property_type) params.append('property_types', `ilike.*${parsed.property_type}*`);
  if (parsed.purpose)       params.append('purposes', `ilike.*${parsed.purpose}*`);

  params.append('limit', '100');

  const response = await fetch(`${baseUrl}?${params.toString()}`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase query failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}


// ─── STEP 3: FORMAT CONDENSED PRODUCT DATA FOR CLAUDE ────────────────────────
// Instead of sending all 55 fields for every product, we send:
// - Always: core identifiers (name, lender, type, FICO, LTV, loan range)
// - Conditionally: fields relevant to the parsed scenario
// This reduces tokens by ~60% and lets us send more products.

function formatProductsCondensed(products, parsed) {
  if (!products || products.length === 0) {
    return 'No matching products found in the database.';
  }

  // Determine which optional field groups are relevant to this scenario
  const showDscr = parsed.loan_type === 'DSCR' ||
    (parsed.special_flags || []).includes('str') ||
    parsed.occupancy === 'Investment';
  const showCreditEvents = (parsed.special_flags || []).some(f =>
    ['bankruptcy', 'foreclosure'].includes(f)) ||
    (parsed.key_factors || []).some(f =>
      /bankrupt|foreclos|short.sale|late.payment|delinquen/i.test(f));
  const showSpecialEligibility = (parsed.special_flags || []).some(f =>
    ['itin', 'foreign_national', 'daca', 'fthb'].includes(f));
  const showInvestment = parsed.occupancy === 'Investment' ||
    (parsed.special_flags || []).includes('llc');
  const showCashOut = parsed.purpose === 'Cash-Out';
  const showHeloc = parsed.loan_type === 'HELOC';

  return products.map((p, i) => {
    const line = (label, value) => {
      if (value === null || value === undefined || value === '' || value === 'N/A') return null;
      return `- ${label}: ${value}`;
    };

    // Score indicator (if available from RPC)
    const scoreTag = p.match_score !== undefined ? ` [score: ${p.match_score}]` : '';

    const rows = [
      `PRODUCT ${i + 1}: ${p.product_name || 'Unknown'}${scoreTag}`,
      line('Lender', p.lender_name),
      line('Type', p.loan_product_type),

      // Always show core fields
      line('Min FICO', p.min_fico),
      line('Loan Range', `$${p.min_loan_amount?.toLocaleString() || '?'} – $${p.max_loan_amount?.toLocaleString() || '?'}`),
      line('Max LTV (Purchase)', p.max_ltv_purchase),
      line('Max LTV (Cash-Out)', p.max_ltv_cashout),
      line('Max LTV (Rate-Term)', p.max_ltv_rate_term),
      line('Max DTI', p.max_dti),
      line('Occupancy', p.occupancy_choices),
      line('Property Types', p.property_types),
      line('Purposes', p.purposes),
      line('Terms', p.terms),
      line('Income Types', p.income_types),
      line('States', p.state_restrictions),

      // Investment-specific
      ...(showInvestment ? [
        line('Min FICO (Investment)', p.min_fico_investment),
        line('Max LTV (2-4 Units)', p.max_ltv_2_4_units),
        line('Max CLTV (Investment)', p.max_cltv_investment),
        line('Vest in LLC', p.vest_in_llc),
        line('First Time Investors', p.first_time_investors_allowed),
        line('Max Financed Properties', p.max_financed_properties),
      ] : []),

      // DSCR-specific
      ...(showDscr ? [
        line('DSCR Min Ratio', p.dscr_min_ratio),
        line('DSCR STR Income Usable', p.dscr_str_income_usable),
        line('DSCR Min Ratio (STR)', p.dscr_min_ratio_str),
      ] : []),

      // Credit events
      ...(showCreditEvents ? [
        line('Bankruptcy Seasoning', p.bankruptcy_seasoning),
        line('Foreclosure Seasoning', p.foreclosure_seasoning),
        line('Mortgage Lates', p.mortgage_lates),
      ] : []),

      // Cash-out specific
      ...(showCashOut ? [
        line('Cash-Out Available', p.cash_out_available),
        line('Max Cash-Out', p.max_cash_out),
        line('Ownership Seasoning (Cash-Out)', p.ownership_seasoning_cashout),
      ] : []),

      // Special eligibility
      ...(showSpecialEligibility ? [
        line('ITIN Allowed', p.itin_allowed),
        line('Foreign National Eligible', p.foreign_national_eligible),
        line('DACA Eligible', p.daca_eligible),
        line('FTHB Allowed', p.fthb_allowed),
        line('Non-Occupant Co-Borrower', p.non_occupant_coborrower),
        line('Manual UW Allowed', p.manual_uw_allowed),
      ] : []),

      // Always show these loan feature fields (compact)
      line('Interest Only', p.interest_only_available),
      line('Prepayment Penalty', p.prepayment_penalty),
      line('Reserves', p.reserves_required),
      line('Gift Funds', p.gift_funds_allowed),
      line('Max Seller Concessions', p.max_seller_concessions),

      // Notes (always useful)
      line('Program Notes', p.program_notes),
    ].filter(Boolean);

    return rows.join('\n');
  }).join('\n\n---\n\n');
}


// ─── RANKING SYSTEM PROMPT ──────────────────────────────────────────────────
const RANKING_PROMPT = `You are a mortgage loan product matching engine for mtg.broker. You help loan officers find the right wholesale lending products for their borrower scenarios.

You will be given:
1. A borrower scenario from a loan officer
2. The parsed search parameters extracted from the scenario
3. A list of matching loan products from the database, pre-scored by relevance

YOUR JOB:
1. Review the parsed scenario parameters for accuracy
2. Analyze the provided products — especially credit event seasoning, income type requirements, DSCR ratios, LLC vesting, STR income, IO options, prepayment penalties, and eligibility flags
3. Rank products by best fit, considering the match_score as a starting point but applying your judgment
4. Include near-miss products when useful (e.g., "you're 5 FICO points away from qualifying")
5. Explain WHY each product fits and note any gotchas, conditions, or watch-outs
6. Return structured JSON with your analysis

IMPORTANT FIELD NOTES:
- Products with higher match_score are likely better fits, but always verify against the actual scenario
- A product with a near-miss on FICO (e.g., borrower has 638, product needs 640) is STILL worth mentioning
- bankruptcy_seasoning / foreclosure_seasoning: Check carefully against scenario timeline
- dscr_min_ratio / dscr_min_ratio_str: Different minimums for standard vs. STR income
- vest_in_llc: Whether the property can be in an LLC
- max_ltv_2_4_units: Specific LTV for multi-unit properties

RESPONSE FORMAT:
Respond with ONLY a valid JSON object (no markdown, no backticks). Structure:
{
  "parsed_scenario": {
    "fico": number or null,
    "ltv": number or null,
    "loan_amount": number or null,
    "property_type": "string or null",
    "occupancy": "string or null",
    "purpose": "string or null",
    "state": "string or null",
    "other_factors": ["array of other noted factors"]
  },
  "matches": [
    {
      "product_name": "string",
      "lender": "string",
      "product_type": "string",
      "min_fico": "string",
      "max_ltv": "string",
      "loan_range": "string",
      "terms": "string",
      "why_it_fits": "Brief explanation of why this product matches the scenario",
      "watch_out": "Any gotchas, conditions, or concerns for this borrower",
      "near_miss": true/false (set true if product almost qualifies but has a gap)
    }
  ],
  "summary": "2-3 sentence summary for the loan officer.",
  "data_gaps": "Note any scenario parameters that couldn't be fully matched or verified."
}

Return up to 10 best matches ranked by fit. Include up to 2 near-misses if relevant. If no products match well, explain why.`;


// ─── MAIN REQUEST HANDLER ───────────────────────────────────────────────────
export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = getCorsHeaders(request);

  try {
    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Anthropic API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const body = await request.json();
    const { scenario, token: bodyToken } = body;

    if (!scenario || typeof scenario !== 'string' || !scenario.trim()) {
      return new Response(
        JSON.stringify({ error: 'Please provide a borrower scenario' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // ── Verify user identity from Outseta JWT (RS256 signature check) ────
    const authHeader = request.headers.get('Authorization');
    const rawToken = authHeader?.replace('Bearer ', '') || bodyToken || null;

    let userEmail = null;
    let planUid = null;
    let planName = 'LITE';

    if (rawToken) {
      // Verify JWT signature — rejects forged/expired/tampered tokens
      const payload = await verifyOutsetaJWT(rawToken);
      if (payload) {
        userEmail = payload.email || payload.sub || null;
        planUid = payload['outseta:planUid'] || null;
        planName = getPlanName(planUid);
      } else {
        // Token provided but invalid — treat as unauthenticated LITE user
        console.warn('JWT verification failed — treating as LITE');
      }
    }
    console.log('User:', userEmail, '| Plan:', planName);

    // ── LITE plan daily search limit ────────────────────────────────────
    const supabaseUrl = env.SUPABASE_URL || 'https://tcmahfwhdknxhhdvqpum.supabase.co';
    const supabaseKey = env.SUPABASE_ANON_KEY;
    let searchesUsedToday = 0;

    if (planName === 'LITE' && userEmail && supabaseKey) {
      searchesUsedToday = await getTodaySearchCount(supabaseUrl, supabaseKey, userEmail);
      console.log('LITE user searches today:', searchesUsedToday, '/', LITE_DAILY_SEARCH_LIMIT);

      if (searchesUsedToday >= LITE_DAILY_SEARCH_LIMIT) {
        return new Response(
          JSON.stringify({
            error: "You've reached your daily search limit of 5. Upgrade to PLUS or PRO for unlimited searches.",
            limit: LITE_DAILY_SEARCH_LIMIT,
            used: searchesUsedToday,
            plan: planName,
          }),
          { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    // ── Log the search ──────────────────────────────────────────────────
    if (userEmail && supabaseKey) {
      logSearch(supabaseUrl, supabaseKey, userEmail, planUid, scenario);
      searchesUsedToday += 1;
    }

    // ── STEP 1: Parse scenario with Claude Haiku ────────────────────────
    // This replaces the old regex-based parser. Claude understands context,
    // so "720 credit score" is correctly parsed as FICO, not a loan amount.
    console.log('Step 1: Parsing scenario with Claude Haiku...');
    const parsed = await parseScenarioWithClaude(scenario, apiKey);
    console.log('Parsed scenario:', JSON.stringify(parsed));

    // ── STEP 2: Query scored products from Supabase ─────────────────────
    // Uses RPC function that scores products by relevance instead of hard
    // binary filtering. Near-misses are included with lower scores.
    console.log('Step 2: Querying scored products...');
    let products = [];
    try {
      products = await queryScoredProducts(env, parsed);
      console.log(`Found ${products.length} scored products`);
    } catch (supabaseError) {
      console.error('Supabase error:', supabaseError);
      return new Response(
        JSON.stringify({ error: 'Database query failed. Please try again.' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // ── STEP 3: Format condensed product data for Claude ────────────────
    // Only sends fields relevant to the scenario, reducing tokens by ~60%.
    console.log('Step 3: Formatting condensed product data...');
    const productsText = formatProductsCondensed(products, parsed);

    // ── STEP 4: Call Claude to rank and explain ─────────────────────────
    console.log('Step 4: Calling Claude for ranking...');
    const userMessage = `BORROWER SCENARIO:
${scenario.trim()}

PARSED PARAMETERS:
${JSON.stringify(parsed, null, 2)}

HERE ARE THE MATCHING PRODUCTS FROM THE DATABASE (${products.length} found, pre-scored by relevance):

${productsText}

Please analyze these products, rank them by best fit for this borrower scenario, and explain why each one fits or doesn't fit. Include any useful near-misses. Return your response as JSON.`;

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: RANKING_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text();
      console.error('Anthropic API error:', anthropicResponse.status, errorText);

      const errorMessage = anthropicResponse.status === 429
        ? 'Service is temporarily busy. Please wait a moment and try again.'
        : 'Failed to process your request. Please try again.';

      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: anthropicResponse.status === 429 ? 429 : 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const anthropicData = await anthropicResponse.json();

    // Extract text from Claude response
    let responseText = '';
    if (anthropicData.content && Array.isArray(anthropicData.content)) {
      for (const block of anthropicData.content) {
        if (block.type === 'text') responseText += block.text;
      }
    }

    // Parse JSON from Claude
    let parsedResult;
    try {
      let cleanedText = responseText;
      if (cleanedText.includes('```')) {
        cleanedText = cleanedText.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
      }
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message);
      return new Response(
        JSON.stringify({
          parsed_scenario: parsed,
          matches: [],
          summary: 'Unable to process the response from the AI. Please try rephrasing your scenario.',
          data_gaps: 'Response parsing failed',
          raw_response: responseText.substring(0, 500),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Add metadata
    parsedResult.meta = {
      filters_applied: parsed,
      products_found: products.length,
      search_version: '2.1',
    };
    parsedResult.raw_products = products;
    parsedResult.usage = {
      plan: planName,
      searches_today: searchesUsedToday,
      daily_limit: planName === 'LITE' ? LITE_DAILY_SEARCH_LIMIT : null,
    };

    return new Response(
      JSON.stringify(parsedResult),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Search error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// Handle CORS preflight requests
export async function onRequestOptions({ request }) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

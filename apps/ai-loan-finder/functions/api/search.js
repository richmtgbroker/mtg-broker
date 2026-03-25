// Cloudflare Pages Function for loan product search
// Queries Supabase directly, then uses Claude to rank and explain results

// ─── PLAN LIMITS ─────────────────────────────────────────────────────────────
// Plan UIDs from Outseta — used to identify user tier from JWT
const PLAN_UIDS = {
  LITE: 'NmdnZg90',
  PLUS: 'Dmw8leQ4',
  PRO:  'yWobBP9D',
};

// LITE users get 5 searches per day. PLUS and PRO are unlimited.
const LITE_DAILY_SEARCH_LIMIT = 5;


// Decode the Outseta JWT to extract user email and plan UID.
// We only need the payload — no signature verification here because
// Outseta handles auth gating on the Webflow page. This is just for
// identifying the user and their plan for usage tracking.
function decodeJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // Base64url decode the payload
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return {
      email: payload.email || payload.sub || null,
      planUid: payload['outseta:planUid'] || null,
    };
  } catch (e) {
    console.error('JWT decode error:', e.message);
    return null;
  }
}


// Determine plan name from planUid
function getPlanName(planUid) {
  if (planUid === PLAN_UIDS.PRO) return 'PRO';
  if (planUid === PLAN_UIDS.PLUS) return 'PLUS';
  return 'LITE'; // Default to LITE if no plan or unknown plan
}


// Count how many searches a user has done today (UTC)
async function getTodaySearchCount(supabaseUrl, supabaseKey, userEmail) {
  // Get start of today in UTC
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
      'Range': '0-0', // We only need the count, not the data
    }
  });

  if (!response.ok) {
    console.error('Search count query failed:', response.status);
    return 0; // Fail open — don't block users if count query fails
  }

  // Supabase returns count in Content-Range header: "0-0/5"
  const contentRange = response.headers.get('Content-Range');
  if (contentRange) {
    const match = contentRange.match(/\/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }

  return 0;
}


// Log a search to the search_log table
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
        scenario: scenario.substring(0, 500), // Truncate long scenarios
      }),
    });
  } catch (e) {
    // Non-blocking — don't fail the search if logging fails
    console.error('Failed to log search:', e.message);
  }
}


const SYSTEM_PROMPT = `You are a mortgage loan product matching engine for mtg.broker. You help loan officers find the right wholesale lending products for their borrower scenarios.

You will be given:
1. A borrower scenario from a loan officer
2. A list of matching loan products from the database

YOUR JOB:
1. Parse the scenario to identify key parameters (FICO, LTV, property type, occupancy, purpose, state, loan amount, special circumstances)
2. Analyze ALL provided product fields — especially credit event seasoning, income type requirements, DSCR ratios, LLC vesting, STR income, IO options, prepayment penalties, and eligibility flags
3. Rank products by best fit, ruling out any that clearly don't fit the scenario
4. Explain WHY each product fits and note any gotchas, conditions, or watch-outs
5. Return structured JSON with your analysis

FIELD REFERENCE (for your analysis):
- bankruptcy_seasoning / foreclosure_seasoning / mortgage_lates: Credit event requirements — check carefully against the scenario
- ownership_seasoning_cashout / ownership_seasoning_rate_term: How long borrower must own before refinancing
- dscr_min_ratio / dscr_min_ratio_str: Minimum DSCR for standard vs. short-term rental income
- dscr_str_income_usable: Whether Airbnb/VRBO/STR income counts for DSCR
- vest_in_llc: Whether the property can be in an LLC
- non_occupant_coborrower: Whether a non-occupant co-borrower is allowed
- fthb_allowed: First-time homebuyer eligibility
- first_time_investors_allowed: First-time investor eligibility
- interest_only_available: Whether IO payment option exists
- cash_out_available / max_cash_out: Cash-out refi capability and limits
- prepayment_penalty: PPP terms (common on DSCR/Non-QM)
- reserves_required: Post-close reserve requirements
- max_seller_concessions: Seller credit limits
- max_financed_properties: How many financed properties borrower can have
- max_cltv / max_cltv_investment: Combined LTV limits
- max_ltv_2_4_units: LTV for 2-4 unit properties specifically
- rural_properties_allowed: Whether rural/acreage properties qualify
- daca_eligible: DACA recipient eligibility
- manual_uw_allowed: Whether manual underwriting is available
- asset_seasoning: How long funds must be in account

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
      "watch_out": "Any gotchas, conditions, or concerns for this borrower"
    }
  ],
  "summary": "2-3 sentence summary for the loan officer.",
  "data_gaps": "Note any scenario parameters that couldn't be fully matched or verified."
}

Return up to 10 best matches ranked by fit. If no products match well, explain why.`;


// Parse scenario to extract searchable parameters for Supabase pre-filtering
function parseScenarioForFilters(scenario) {
  const lower = scenario.toLowerCase();
  const filters = {};

  // Extract FICO score
  const ficoPatterns = [
    /(\d{3})\s*(?:fico|credit|score)/i,
    /(?:fico|credit|score)[:\s]*(\d{3})/i,
    /(\d{3})\s+(?:credit|fico)/i
  ];
  for (const pattern of ficoPatterns) {
    const match = scenario.match(pattern);
    if (match) {
      const score = parseInt(match[1], 10);
      if (score >= 300 && score <= 850) {
        filters.fico = score;
        break;
      }
    }
  }

  // Extract loan amount — must have a dollar sign, "k/K" suffix, or keyword like "loan amount"
  // to avoid false positives from FICO scores (e.g. "720 credit score" != $720K loan)
  const loanAmountPatterns = [
    // "$500,000" or "$500000" or "$500K" — dollar sign is unambiguous
    /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:k|K)?/,
    // "500k loan" or "500K mortgage" — k/K suffix with optional keyword
    /(\d{1,3}(?:,\d{3})*)\s*(?:k|K)\b/,
    // "loan amount 500000" or "loan amount: $500,000"
    /(?:loan\s*(?:amount|size|balance)|mortgage\s*(?:amount|size|balance))[:\s]*\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:k|K)?/i,
    // "500,000 loan" or "300000 mortgage" — comma-formatted or 6+ digit numbers before keyword
    /(\d{1,3},\d{3}(?:,\d{3})*|\d{6,})\s*(?:loan|mortgage)/i,
  ];
  for (const pattern of loanAmountPatterns) {
    const match = scenario.match(pattern);
    if (match) {
      // Find the first capturing group that matched
      const rawAmount = match[1] || match[2] || match[3];
      if (rawAmount) {
        let amount = parseFloat(rawAmount.replace(/,/g, ''));
        if (amount < 1000) amount *= 1000; // "500k" → 500000
        if (amount >= 50000) {
          filters.loanAmount = amount;
          break;
        }
      }
    }
  }

  // Detect occupancy type
  if (lower.includes('investment') || lower.includes('rental') || lower.includes('investor')) {
    filters.occupancy = 'Investment';
  } else if (lower.includes('second home') || lower.includes('vacation')) {
    filters.occupancy = 'Second';
  } else if (lower.includes('primary') || lower.includes('owner occupied') || lower.includes('first-time') || lower.includes('first time')) {
    filters.occupancy = 'Primary';
  }

  // Detect loan type
  if (lower.includes('dscr')) {
    filters.loanType = 'DSCR';
  } else if (lower.includes('fha')) {
    filters.loanType = 'FHA';
  } else if (lower.match(/\bva\b/) || lower.includes('va loan')) {
    filters.loanType = 'VA';
  } else if (lower.includes('usda')) {
    filters.loanType = 'USDA';
  } else if (lower.includes('conventional')) {
    filters.loanType = 'Conventional';
  } else if (lower.includes('jumbo')) {
    filters.loanType = 'Jumbo';
  } else if (lower.includes('bank statement')) {
    filters.loanType = 'Bank Statement';
  } else if (lower.includes('non-qm') || lower.includes('non qm')) {
    filters.loanType = 'Non-QM';
  }

  // Detect property type
  if (lower.includes('condo')) {
    filters.propertyType = 'Condo';
  } else if (lower.includes('townhouse') || lower.includes('town house')) {
    filters.propertyType = 'Townhouse';
  } else if (lower.includes('duplex') || lower.includes('2 unit') || lower.includes('2-unit')) {
    filters.propertyType = '2 Units';
  } else if (lower.includes('triplex') || lower.includes('3 unit') || lower.includes('3-unit')) {
    filters.propertyType = '3 Units';
  } else if (lower.includes('4 unit') || lower.includes('4-unit') || lower.includes('fourplex') || lower.includes('quadplex')) {
    filters.propertyType = '4 Units';
  } else if (lower.includes('multi') || lower.includes('2-4 unit')) {
    filters.propertyType = 'Multi';
  } else if (lower.includes('manufactured') || lower.includes('mobile home')) {
    filters.propertyType = 'Manufactured';
  } else if (lower.includes('sfr') || lower.includes('single family')) {
    filters.propertyType = 'SFR';
  }

  // Detect purpose
  if (lower.includes('cash-out') || lower.includes('cash out') || lower.includes('cashout')) {
    filters.purpose = 'Cash-Out';
  } else if (lower.includes('refinance') || lower.includes('refi') || lower.includes('rate-term') || lower.includes('rate term')) {
    filters.purpose = 'Refinance';
  } else if (lower.includes('purchase') || lower.includes('buying') || lower.includes('buy') || lower.includes('homebuyer') || lower.includes('home buyer') || lower.includes('down payment') || lower.match(/\d+%?\s*down/)) {
    filters.purpose = 'Purchase';
  }

  // Detect special programs
  if (lower.includes('itin')) filters.itin = true;
  if (lower.includes('foreign national')) filters.foreignNational = true;
  if (lower.includes('self-employed') || lower.includes('self employed')) filters.selfEmployed = true;
  if (lower.includes('daca')) filters.daca = true;
  if (lower.includes('str') || lower.includes('short-term rental') || lower.includes('airbnb') || lower.includes('vrbo')) {
    filters.str = true;
  }
  if (lower.includes('llc')) filters.llc = true;

  // Extract state (2-letter abbreviation or full name)
  // Map common full state names to abbreviations
  const stateNames = {
    'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
    'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
    'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
    'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
    'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
    'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
    'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
    'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
    'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
    'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
    'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
    'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
    'wisconsin': 'WI', 'wyoming': 'WY',
  };
  // Try 2-letter abbreviation first (but skip "VA" if it's part of "VA loan")
  const stateMatch = scenario.match(/\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/);
  if (stateMatch) {
    // Avoid "VA" false positive when it means "VA loan" not Virginia
    if (stateMatch[1] === 'VA' && lower.match(/\bva\s*(loan|mortgage|irrrl|streamline|eligible)\b/)) {
      // Don't set state — "VA" here means Veterans Affairs, not Virginia
    } else {
      filters.state = stateMatch[1];
    }
  }
  // Try full state names if no abbreviation matched
  if (!filters.state) {
    for (const [name, abbr] of Object.entries(stateNames)) {
      if (lower.includes(name)) {
        filters.state = abbr;
        break;
      }
    }
  }

  return filters;
}


// Query Supabase with filters
async function querySupabase(env, filters) {
  const supabaseUrl = env.SUPABASE_URL || 'https://tcmahfwhdknxhhdvqpum.supabase.co';
  const supabaseKey = env.SUPABASE_ANON_KEY;

  if (!supabaseKey) throw new Error('SUPABASE_ANON_KEY not configured');

  const baseUrl = `${supabaseUrl}/rest/v1/loan_products`;
  const params = new URLSearchParams();

  params.set('select', '*');

  // Only active products
  params.append('product_status', 'ilike.*Active*');

  // FICO and loan amount filters need to handle null values gracefully.
  // Products with null min_fico or null min_loan_amount should still be included
  // (null = not specified = no restriction). We use PostgREST "or" syntax.
  // Since only one "or" param is supported per query, we build a combined "and"
  // with nested "or" conditions when both filters are present.
  const orConditions = [];
  if (filters.fico) {
    orConditions.push(`min_fico.lte.${filters.fico},min_fico.is.null`);
  }
  if (filters.loanAmount) {
    // Only filter min_loan_amount — skip max_loan_amount since most agency
    // products have null max (they follow county loan limits instead).
    // Claude handles max loan amount relevance in the ranking step.
    orConditions.push(`min_loan_amount.lte.${filters.loanAmount},min_loan_amount.is.null`);
  }

  if (orConditions.length === 1) {
    // Single "or" condition — use directly
    params.append('or', `(${orConditions[0]})`);
  } else if (orConditions.length > 1) {
    // Multiple "or" conditions — wrap each in "or()" inside an "and()" block
    const andParts = orConditions.map(c => `or(${c})`).join(',');
    params.append('and', `(${andParts})`);
  }

  // Occupancy, loan type, property type, purpose (partial match)
  if (filters.occupancy)    params.append('occupancy_choices', `ilike.*${filters.occupancy}*`);
  if (filters.loanType)     params.append('loan_product_type', `ilike.*${filters.loanType}*`);
  if (filters.propertyType) params.append('property_types', `ilike.*${filters.propertyType}*`);
  if (filters.purpose)      params.append('purposes', `ilike.*${filters.purpose}*`);

  // Special eligibility flags
  if (filters.itin)          params.append('itin_allowed', 'ilike.*Yes*');
  if (filters.foreignNational) params.append('foreign_national_eligible', 'ilike.*Yes*');
  if (filters.daca)          params.append('daca_eligible', 'ilike.*Yes*');
  if (filters.str)           params.append('dscr_str_income_usable', 'ilike.*Yes*');
  if (filters.llc)           params.append('vest_in_llc', 'ilike.*Yes*');

  params.append('limit', '25');

  const url = `${baseUrl}?${params.toString()}`;
  console.log('Supabase query URL:', url);

  const response = await fetch(url, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Supabase error:', response.status, errorText);
    throw new Error(`Supabase query failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}


// Format products for Claude — includes ALL data fields so nothing is missed
function formatProductsForClaude(products) {
  if (!products || products.length === 0) {
    return 'No matching products found in the database.';
  }

  return products.map((p, i) => {
    // Helper: only include a line if the value is non-null and non-empty
    const line = (label, value) => {
      if (value === null || value === undefined || value === '' || value === 'N/A') return null;
      return `- ${label}: ${value}`;
    };

    const rows = [
      `PRODUCT ${i + 1}: ${p.product_name || 'Unknown'}`,
      line('Lender', p.lender_name),
      line('Type', p.loan_product_type),
      line('Status', p.product_status),

      // Loan amounts & LTVs
      line('Loan Range', `$${p.min_loan_amount?.toLocaleString() || '?'} – $${p.max_loan_amount?.toLocaleString() || '?'}`),
      line('Min FICO', p.min_fico),
      line('Min FICO (Investment)', p.min_fico_investment),
      line('Max LTV (Purchase)', p.max_ltv_purchase),
      line('Max LTV (Cash-Out)', p.max_ltv_cashout),
      line('Max LTV (Rate-Term)', p.max_ltv_rate_term),
      line('Max LTV (2-4 Units)', p.max_ltv_2_4_units),
      line('Max CLTV', p.max_cltv),
      line('Max CLTV (Investment)', p.max_cltv_investment),
      line('Max DTI', p.max_dti),

      // Eligibility
      line('Occupancy', p.occupancy_choices),
      line('Property Types', p.property_types),
      line('Property Types Notes', p.property_types_notes),
      line('Purposes', p.purposes),
      line('Income Types', p.income_types),
      line('Terms', p.terms),
      line('States Available', p.state_restrictions),

      // DSCR-specific
      line('DSCR Min Ratio', p.dscr_min_ratio),
      line('DSCR STR Income Usable', p.dscr_str_income_usable),
      line('DSCR Min Ratio (STR)', p.dscr_min_ratio_str),

      // Borrower eligibility flags
      line('ITIN Allowed', p.itin_allowed),
      line('Foreign National Eligible', p.foreign_national_eligible),
      line('DACA Eligible', p.daca_eligible),
      line('FTHB Allowed', p.fthb_allowed),
      line('First Time Investors Allowed', p.first_time_investors_allowed),
      line('Non-Occupant Co-Borrower Allowed', p.non_occupant_coborrower),

      // Credit event seasoning (critical for non-QM)
      line('Bankruptcy Seasoning', p.bankruptcy_seasoning),
      line('Foreclosure/SS/DIL Seasoning', p.foreclosure_seasoning),
      line('Mortgage Lates', p.mortgage_lates),
      line('Ownership Seasoning (Cash-Out)', p.ownership_seasoning_cashout),
      line('Ownership Seasoning (Rate-Term)', p.ownership_seasoning_rate_term),

      // Loan features
      line('Interest Only Available', p.interest_only_available),
      line('Cash-Out Available', p.cash_out_available),
      line('Max Cash-Out', p.max_cash_out),
      line('Prepayment Penalty', p.prepayment_penalty),
      line('Vest in LLC', p.vest_in_llc),
      line('Manual UW Allowed', p.manual_uw_allowed),

      // Requirements
      line('Reserves Required', p.reserves_required),
      line('Asset Seasoning', p.asset_seasoning),
      line('Max Seller Concessions', p.max_seller_concessions),
      line('Max Financed Properties', p.max_financed_properties),
      line('Gift Funds Allowed', p.gift_funds_allowed),
      line('Additional Reserves', p.additional_reserves),
      line('Max Acreage', p.max_acreage),
      line('Rural Properties Allowed', p.rural_properties_allowed),

      // Notes & matrix
      line('Description', p.description),
      line('Program Notes', p.program_notes),
      line('Matrix URL', p.matrix_url),
    ].filter(Boolean); // Remove null lines

    return rows.join('\n');
  }).join('\n\n---\n\n');
}


export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

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

    // ── Identify user from Outseta JWT ──────────────────────────────────────
    // Token can come from Authorization header or request body
    const authHeader = request.headers.get('Authorization');
    const rawToken = authHeader?.replace('Bearer ', '') || bodyToken || null;

    let userEmail = null;
    let planUid = null;
    let planName = 'LITE'; // Default to LITE (most restrictive) if no token

    if (rawToken) {
      const decoded = decodeJwt(rawToken);
      if (decoded) {
        userEmail = decoded.email;
        planUid = decoded.planUid;
        planName = getPlanName(planUid);
      }
    }
    console.log('User:', userEmail, '| Plan:', planName);

    // ── LITE plan daily search limit ────────────────────────────────────────
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

    // ── Log the search ──────────────────────────────────────────────────────
    if (userEmail && supabaseKey) {
      // Fire and forget — don't wait for log to complete before searching
      logSearch(supabaseUrl, supabaseKey, userEmail, planUid, scenario);
      searchesUsedToday += 1; // Increment for the response (this search counts)
    }

    // Step 1: Parse scenario for Supabase filters
    const filters = parseScenarioForFilters(scenario);
    console.log('Parsed filters:', filters);

    // Step 2: Query Supabase
    let products = [];
    try {
      products = await querySupabase(env, filters);
      console.log(`Found ${products.length} products from Supabase`);
    } catch (supabaseError) {
      console.error('Supabase error:', supabaseError);
      return new Response(
        JSON.stringify({ error: 'Database query failed. Please try again.' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Step 3: Format all product fields for Claude
    const productsText = formatProductsForClaude(products);

    // Step 4: Call Claude to rank and explain
    const userMessage = `BORROWER SCENARIO:
${scenario.trim()}

HERE ARE THE MATCHING PRODUCTS FROM THE DATABASE (${products.length} found):

${productsText}

Please analyze these products, rank them by best fit for this borrower scenario, and explain why each one fits or doesn't fit. Return your response as JSON.`;

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
        system: SYSTEM_PROMPT,
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
        JSON.stringify({ error: errorMessage, status: anthropicResponse.status, details: errorText.substring(0, 500) }),
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
          parsed_scenario: null,
          matches: [],
          summary: 'Unable to process the response from the AI. Please try rephrasing your scenario.',
          data_gaps: 'Response parsing failed: ' + parseError.message,
          raw_response: responseText.substring(0, 500),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    parsedResult.meta = { filters_applied: filters, products_found: products.length };
    // Include full Supabase records so the frontend can show a complete product detail modal
    parsedResult.raw_products = products;

    // Include search usage info so the frontend can show "X/5 searches used" for LITE users
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
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// Cloudflare Pages Function for loan product search
// Queries Supabase directly, then uses Claude to rank and explain results

const SYSTEM_PROMPT = `You are a mortgage loan product matching engine for mtg.broker. You help loan officers find the right wholesale lending products for their borrower scenarios.

You will be given:
1. A borrower scenario from a loan officer
2. A list of matching loan products from the database

YOUR JOB:
1. Parse the scenario to identify key parameters (FICO, LTV, property type, occupancy, purpose, state, loan amount, special circumstances)
2. Analyze the provided products and rank them by best fit for this specific scenario
3. Explain WHY each product fits and note any gotchas or watch-outs
4. Return structured JSON with your analysis

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

// Parse scenario to extract searchable parameters
function parseScenarioForFilters(scenario) {
  const lower = scenario.toLowerCase();
  const filters = {};

  // Extract FICO score (look for 3-digit numbers near credit/fico/score keywords)
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

  // Extract loan amount
  const amountMatch = scenario.match(/\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:k|K|loan|mortgage)?/);
  if (amountMatch) {
    let amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    if (amount < 1000) amount *= 1000; // Assume "500k" means 500,000
    if (amount >= 50000) filters.loanAmount = amount;
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
  } else if (lower.includes('va ') || lower.includes('va loan') || lower.match(/\bva\b/)) {
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
  } else if (lower.includes('purchase') || lower.includes('buying') || lower.includes('buy')) {
    filters.purpose = 'Purchase';
  }

  // Detect special programs
  if (lower.includes('itin')) {
    filters.itin = true;
  }
  if (lower.includes('foreign national')) {
    filters.foreignNational = true;
  }
  if (lower.includes('self-employed') || lower.includes('self employed')) {
    filters.selfEmployed = true;
  }

  return filters;
}

// Query Supabase with filters
async function querySupabase(env, filters) {
  const supabaseUrl = env.SUPABASE_URL || 'https://tcmahfwhdknxhhdvqpum.supabase.co';
  const supabaseKey = env.SUPABASE_ANON_KEY;

  if (!supabaseKey) {
    throw new Error('SUPABASE_ANON_KEY not configured');
  }

  // Build query URL with filters using URLSearchParams for proper encoding
  const baseUrl = `${supabaseUrl}/rest/v1/loan_products`;
  const params = new URLSearchParams();

  params.set('select', '*');

  // Filter by FICO - products where min_fico <= borrower's score
  if (filters.fico) {
    params.append('min_fico', `lte.${filters.fico}`);
  }

  // Filter by occupancy (ilike for partial match)
  if (filters.occupancy) {
    params.append('occupancy_choices', `ilike.*${filters.occupancy}*`);
  }

  // Filter by loan type
  if (filters.loanType) {
    params.append('loan_product_type', `ilike.*${filters.loanType}*`);
  }

  // Filter by property type
  if (filters.propertyType) {
    params.append('property_types', `ilike.*${filters.propertyType}*`);
  }

  // Filter by purpose
  if (filters.purpose) {
    params.append('purposes', `ilike.*${filters.purpose}*`);
  }

  // Filter for ITIN
  if (filters.itin) {
    params.append('itin_allowed', 'ilike.*Yes*');
  }

  // Filter for foreign nationals
  if (filters.foreignNational) {
    params.append('foreign_national_eligible', 'ilike.*Yes*');
  }

  // Only active products (contains "Active" to match "🟢 Active")
  params.append('product_status', 'ilike.*Active*');

  // Limit results (keep small to avoid Claude token limits)
  params.append('limit', '20');

  const url = `${baseUrl}?${params.toString()}`;
  console.log('Supabase query URL:', url);

  const response = await fetch(url, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Supabase error:', response.status, errorText);
    throw new Error(`Supabase query failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// Format products for Claude
function formatProductsForClaude(products) {
  if (!products || products.length === 0) {
    return 'No matching products found in the database.';
  }

  return products.map((p, i) => {
    return `
PRODUCT ${i + 1}: ${p.product_name || 'Unknown'}
- Lender: ${p.lender_name || 'N/A'}
- Type: ${p.loan_product_type || 'N/A'}
- Min FICO: ${p.min_fico || 'N/A'}
- Min FICO (Investment): ${p.min_fico_investment || 'N/A'}
- Loan Range: $${p.min_loan_amount?.toLocaleString() || '?'} - $${p.max_loan_amount?.toLocaleString() || '?'}
- Max LTV (Purchase): ${p.max_ltv_purchase || 'N/A'}
- Max LTV (Cash-Out): ${p.max_ltv_cashout || 'N/A'}
- Max LTV (Rate-Term): ${p.max_ltv_rate_term || 'N/A'}
- Max DTI: ${p.max_dti || 'N/A'}
- DSCR Min Ratio: ${p.dscr_min_ratio || 'N/A'}
- Occupancy: ${p.occupancy_choices || 'N/A'}
- Property Types: ${p.property_types || 'N/A'}
- Purposes: ${p.purposes || 'N/A'}
- Income Types: ${p.income_types || 'N/A'}
- Terms: ${p.terms || 'N/A'}
- State Restrictions: ${p.state_restrictions || 'None noted'}
- ITIN Allowed: ${p.itin_allowed || 'N/A'}
- Foreign National: ${p.foreign_national_eligible || 'N/A'}
- Description: ${p.description || 'N/A'}
- Notes: ${p.program_notes || 'N/A'}
`.trim();
  }).join('\n\n---\n\n');
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    // Check required environment variables
    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Anthropic API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Parse request body
    const body = await request.json();
    const { scenario } = body;

    if (!scenario || typeof scenario !== 'string' || !scenario.trim()) {
      return new Response(
        JSON.stringify({ error: 'Please provide a borrower scenario' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Step 1: Parse scenario for filters
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

    // Step 3: Format products for Claude
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
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: userMessage
          }
        ]
      })
    });

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text();
      console.error('Anthropic API error:', anthropicResponse.status, errorText);

      const errorMessage = anthropicResponse.status === 429
        ? 'Service is temporarily busy. Please wait a moment and try again.'
        : 'Failed to process your request. Please try again.';

      return new Response(
        JSON.stringify({
          error: errorMessage,
          status: anthropicResponse.status,
          details: errorText.substring(0, 500)
        }),
        { status: anthropicResponse.status === 429 ? 429 : 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const anthropicData = await anthropicResponse.json();

    // Extract the text response from Claude
    let responseText = '';
    if (anthropicData.content && Array.isArray(anthropicData.content)) {
      for (const block of anthropicData.content) {
        if (block.type === 'text') {
          responseText += block.text;
        }
      }
    }

    // Parse the JSON response from Claude
    let parsedResult;
    try {
      // Strip markdown code blocks if present
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
      console.error('Raw response length:', responseText.length);
      console.error('Raw response start:', responseText.substring(0, 200));
      console.error('Raw response end:', responseText.substring(responseText.length - 200));

      return new Response(
        JSON.stringify({
          parsed_scenario: null,
          matches: [],
          summary: 'Unable to process the response from the AI. Please try rephrasing your scenario.',
          data_gaps: 'Response parsing failed: ' + parseError.message,
          raw_response: responseText.substring(0, 500)
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Add metadata about the search
    parsedResult.meta = {
      filters_applied: filters,
      products_found: products.length
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
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}

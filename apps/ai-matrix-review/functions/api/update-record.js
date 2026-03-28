// Cloudflare Pages Function — Update a loan product record in Airtable
// v1.0 — Allows updating AI review fields (status, confidence, etc.)
// Admin-only access via Outseta JWT verification.

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
  if (/^http:\/\/localhost:\d+$/.test(origin)) return true;
  return false;
}

function getCorsHeaders(request) {
  const origin = request ? request.headers.get('Origin') : null;
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// ─── JWT VERIFICATION (RS256) ───────────────────────────────────────────────
let jwksCache = null;
let jwksCacheTimestamp = null;
const JWKS_CACHE_DURATION = 60 * 60 * 1000;

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

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

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
const ADMIN_EMAILS = ['rich@mtg.broker', 'rich@prestonlending.com'];

function isAdmin(payload) {
  if (!payload || !payload.email) return false;
  return ADMIN_EMAILS.includes(payload.email.toLowerCase());
}

// ─── ALLOWED FIELDS ─────────────────────────────────────────────────────────
// Only these fields can be updated via this endpoint (safety measure).
// Includes AI: Review Status + all manual "current" fields that AI values can be copied into.
const UPDATABLE_FIELDS = [
  'AI: Review Status',
  // FICO
  'Min FICO', 'Min FICO (MH)', 'Min FICO (FTHB)', 'Min FICO (1st Time Investor)',
  'Min FICO (Manual UW)',
  // LTV / CLTV / DTI
  'Max LTV (Purch)', 'Max LTV (RT)', 'Max LTV (Cash Out)',
  'Max CLTV', 'Max DTI', 'Manual UW Allowed?',
  // Loan Amounts
  'Min Loan Amount', 'Max Loan Amount', 'Max Cash-Out', 'Max Cash-Out (2 Unit)',
  // Borrower Eligibility
  'FTHB Allowed?', 'FTHB Required?', 'Homebuyer Education Reqd?',
  'Cash-Out Available?', 'Vest in LLC', 'Gift Funds Allowed',
  'Max Seller Concessions | Contributions',
  // Income & Reserves
  'Reserves Required', 'Cash-Out As Reserves Allowed?',
  // Investor / Special Eligibility
  'First Time Investors Allowed?', 'Non-Permanent Residents Allowed?',
  'Foreign National Eligible?', 'ITIN Borrower Allowed?',
  // Credit Events
  'FC | SS | DIL Seasoning',
  // Property
  'Rural Properties Allowed?', 'Max Property Size (Acres)', 'Appraisal Transfers',
  // Financed Properties
  'Max Financed Properties', 'Max Agency Financed', 'Max Lender Financed',
  'Must Currently Own or Rent',
  // Loan Features
  'Interest Only (IO) Option', 'Prepayment Penalty (PPP)',
  // DSCR
  'DSCR - Min Ratio Required', 'DSCR - Min Ratio (1st Time Investor)',
  'DSCR - Min Ratio for STR', 'DSCR - Short Term Rental (STR) Income',
  'DSCR - Primary Home Requirement', 'DSCR - Asset Seasoning',
];

// ─── VALID CHOICES FOR SINGLESELECT FIELDS ──────────────────────────────────
// Used to validate AI values before writing to Airtable.
// If the AI value doesn't match an existing choice, it's skipped with a warning.
const FIELD_CHOICES = {
  'AI: Review Status': ['Pending Review', 'Approved', 'Completed', 'Rejected', 'Error', 'Processing'],
  'Min FICO': ['No Credit Required', 'None', 'No Minimum Required', 'Per AUS / No Minimum', '500', '540', '550', '570', '575', '580', '590', '600', '620', '640', '650', '660', '680', '700', '720', 'NA', 'Info Requested', 'Need Info'],
  'Min FICO (MH)': ['NA', '580', '620', '640', '660', '680', '700', 'MH not eligible', '600', '540', '550', '500', '650'],
  'Min FICO (FTHB)': ['660', '550', '600', '580', '620'],
  'Min FICO (1st Time Investor)': ['600', '620', '640', '650', '660', '680', '700', '720', 'NA', 'FTI Not Allowed'],
  'Min FICO (Manual UW)': ['NA', '500', '540', '550', '560', '580', '600', '620', '640', '660', '680', 'Manual UW Not Allowed', '700'],
  'Max LTV (Purch)': ['NA', '50.00%', '60.00%', '65.00%', '70.00%', '75.00%', '79.00%', '80.00%', '85.00%', '89.99%', '90.00%', '93.00%', '95.00%', '96.50%', '97.00%', '100.00%', '101.00%', '102.00%', '105.00%', '125.00%'],
  'Max LTV (RT)': ['NA', '55.00%', '65.00%', '70.00%', '75.00%', '80.00%', '85.00%', '90.00%', '97.75%', '100.00%', '110.00%', '125.00%', '89.99%', '50.00%', '97.00%', '95.00%'],
  'Max LTV (Cash Out)': ['NA', '50.00%', '65.00%', '70.00%', '75.00%', '80.00%', '89.99%', '90.00%', '100.00%', '60.00%', '85.00%'],
  'Max CLTV': ['Subordinate Financing Not Allowed', '65.00%', '75.00%', '80.00%', '85.00%', '89.99%', '90.00%', '95.00%', '100.00%', '101.50%', '102.00%', '105.00%', '125.00%', 'No Overlays', '96.50%', '97.00%', '70.00%', '103.50%', '101.00%'],
  'Max DTI': ['NA', '42% / 55%', '45%', '48.99%', '49.99%', '50%', '50% / 55%', '55%', '65%', 'Per AUS', 'Per AUS / Max 43% For Manual UW', 'Per AUS / Max 45% for borrowers with no prior housing expense or 125% payment shock', 'Per AUS / Max 45% for FICO scores 580-599', 'Per AUS / Max 45% for Manual UW', 'Per AUS / Max 45%', 'Per AUS / Max 50%', 'Per GUS', '49%', 'Per AUS / Max 49.99%', '50.00% / 45.00% for Duplexes', '50.00% / 43.00% for Non-Warr Condos', '43%', 'Per AUS / Max 31%/43% for Manual UW', '50% / 45% for FICO <700', 'Per AUS / Max 65%', '50% / 45% for FICO 640-679', '60%', '50% / 45% for LTV>95%', '50% max, 45% max if > 85% LTV', '48.00%', '50% / 45% for FICO <680'],
  'Manual UW Allowed?': ['NA', '\uD83D\uDD34 No', '\uD83D\uDFE2 Yes', '\uD83D\uDFE1 Yes (Not allowed on MH)', 'Only Manual UW - No AUS', 'Yes (On a case by case basis)'],
  'Min Loan Amount': ['$0', '$5,000', '$25,000', '$35,000', '$50,000', '$55,000', '$75,000', '$100,000', '$100,001', '$115,000', '$120,000', '$125,000', '$150,000', '$150,001', '$200,000', '$250,000', '$300,000', '$350,000', '$400,000', '$450,000', '$500,000', '$3,000,000', '$3,500,000', '$4,000,000', 'Conforming plus $1', 'Confirm with AE', '$95,000'],
  'Max Loan Amount': ['$250,000', '$350,000', '$400,000', '$450,000', '$500,000', '$550,000', '$600,000', '$650,000', '$750,000', '$825,000', '$865,000', '$999,999', '$1,000,000', '$1,200,000', '$1,500,000', '$1,867,275', '$2,000,000', '$2,500,000', '$3,000,000', '$3,500,000', '$4,000,000', '$5,000,000', '$6,000,000', '$6,250,000', '$7,500,000', '$8,000,000', '$10,000,000', '$20,000,000', '$30,000,000+', 'Conforming and High Balance', 'Conforming Only (No High Balance)', 'County Limits', 'Lesser of County Limits or $726,200', '$803,500 on 1 Unit. Conforming on 2-4 Units', '$15,000,000', '$2,402,625', 'County Limits including High Balance', 'County Limits (No High Balance)', 'Per GUS', 'VA Loan Limits', 'ATR', '$850,000'],
  'Max Cash-Out': ['NA', '$350,000', '$500,000', '$750,000', '$1,000,000', '$1,500,000', '$2,000,000', '$2,450,000', '$2,500,000', '$3,000,000', '500', '750', '$4,000,000', '3,500,000'],
  'Max Cash-Out (2 Unit)': ['NA', '$150,000', '$400,000', '$500,000', '$1,000,000', '$2,000,000', '$2,450,000', '$2,500,000', '$3,000,000'],
  'FTHB Allowed?': ['\uD83D\uDD34 No', '\uD83D\uDFE2 Yes', '\uD83D\uDFE1 Only Foreign Nationals', '\uD83D\uDFE1 Yes - 70% LTV', '\uD83D\uDFE1 Yes (Not on Investment Properties or I/O Loans)', 'NA', 'Not Stated', '\uD83D\uDFE1 Yes (No Investment Properties)', '\uD83D\uDFE1 Yes. With Restrictions (See Matrix)'],
  'FTHB Required?': ['\uD83D\uDFE2 No', '\uD83D\uDFE1 Yes and must currently reside in specific census tracts', '\uD83D\uDFE1 Yes. At least one borrower', 'NA'],
  'Homebuyer Education Reqd?': ['\uD83D\uDFE2 No', '\uD83D\uDD34 One-Borrower', '\uD83D\uDD34 Yes', '\uD83D\uDD34 Yes for FICO scores 600-639. No for score 640+', '\uD83D\uDFE1 Only if all borrowers are first-time homebuyers'],
  'Cash-Out Available?': ['\uD83D\uDFE2 Yes', '\uD83D\uDD34 No', 'NA'],
  'Vest in LLC': [' \uD83D\uDFE2Allowed', '\uD83D\uDFE1 Allowed for Investment', '\uD83D\uDD34 No'],
  'Gift Funds Allowed': ['NA', '\uD83D\uDFE2 Yes', '\uD83D\uDD34 No', '\uD83D\uDFE1 100% with 10% LTV reduction OR Min 5% buyer own funds', '\uD83D\uDFE1 Allowed. After 20% Contribution Toward Down Payment, Closing Costs, Prepaids and Reserves Are Met From Borrower\'s Own Funds', '\uD83D\uDFE1 Allowed. After minimum borrower contribution met (Non-Foreign National Only)', '\uD83D\uDFE1 Allowed. Borrower must contribute 5% own funds (Non-Foreign National Only)', '\uD83D\uDFE1 Allowed. Borrower must contribute 10% own funds', '\uD83D\uDFE1 Allowed. Borrower must contribute 10% own funds (Non-Foreign National Only)', '\uD83D\uDFE1 Not Stated - Verify with lender', '\uD83D\uDFE1 Allowed but NOT for reserve requirements', '\uD83D\uDFE1 100% gift funds allowed on Primary only', 'Allowed. Requires 5% borrower own funds when LTV >75%', 'Allowed (With restrictions). See guidelines'],
  'Max Seller Concessions | Contributions': ['2%', '3%', '5%', '6%', 'Less than or equal to 75% LTV: 6%, >75% to 89.99%: 3%', 'Less than or equal to 80% LTV: 6%, >80% LTV: 3%', 'Reduces Loan Amount (Not applied to closing cost)', 'NA', '4%', 'Per Fannie Mae (FNMA)', '9%', 'On a primary or second home, 9% up to 75% LTV and 6% to 90% LTV; On an investment property, 6%.', '4% to 6%: CLTV > 75%: max IPC = 4%; CLTV \u2264 75%: max IPC = 6%', '9% for LTV/CLTV \u226470%, 6% for LTV/CLTV >70%', 'Per Freddie Mac (FHLMC) guidelines', 'Per Fannie Mae (FNMA) guidelines', '4% to 6% based on LTV', '6% for owner-occupied. 2% for investment properties'],
  'Reserves Required': ['\uD83D\uDFE1 \u2264 $1.5M: 6 Months, > $1.5M - $2M: 9 Months', '\uD83D\uDFE1 \u2264 $1.5M: 6 Months, > $1.5M: 12 Months', '\uD83D\uDFE1 \u2264 $1M: 3 Months, > $1M: 6 Months', '\uD83D\uDFE1 \u2264 65% LTV (0 Months), >65% LTV (3 Months PITIA)', '\uD83D\uDFE1 $125K-$1M: 6 Months, $1M-$1.5M: 9 Months, $1.5M-$3M: 12 Months', '\uD83D\uDFE1 2 Months', '\uD83D\uDFE1 2 months of PITIA/ITIA reserves for each additional financed property owned', '\uD83D\uDFE1 3 Months', '\uD83D\uDFE1 3 Months. Additonal 3 Months if living Rent-free or unable to document 12-Month housing history', '\uD83D\uDFE1 3-6 Months on subject property only', '\uD83D\uDFE1 3-9 Months based on loan size', '\uD83D\uDFE1 4 Months', '\uD83D\uDFE1 6 Months', '\uD83D\uDFE1 6 Months Reserves Seasoned 30 days', '\uD83D\uDFE1 6-12 Months based on Loan Size and LTV', '\uD83D\uDFE1 12 Months', '\uD83D\uDFE1 Based on Experience (3-12 Months)', '\uD83D\uDFE1 None for Purchase or R/T', '\uD83D\uDFE1 Per AUS', '\uD83D\uDFE1 See Notes', '\uD83D\uDFE1 Yes. 6 Months Minimum. See Matrix for details', '\uD83D\uDFE2 None', 'Yes. Based on DTI. See Matrix for specifics', '3-12 Months based on Loan Amount', 'No reserves required under 1.5M Loan Amount', '2-12 Months based on scenario. See guidelines for details', '6-12 Months based on scenario. See guidelines for details.', '3-6 Months based on loan amount. See guidelines for details', '6-9 Months based on scenario. See guidelines for details.', '3-12 Months based on scenario. See guidelines for details.', '4-12 Months based on scenario. See guidelines for details.', '0-12 Months based on scenario. See guidelines for details.', '0-6 Months based on scenario. See guidelines for details.'],
  'Cash-Out As Reserves Allowed?': ['\uD83D\uDFE2 Yes', '\uD83D\uDFE1 Yes but only for LTV below 60%', '\uD83D\uDFE1 Yes but only up to 50% of reserve requirement', '\uD83D\uDD34 No', 'NA'],
  'First Time Investors Allowed?': ['NA', '\uD83D\uDFE2 Yes', '\uD83D\uDFE1 Must own primary for 12 months during last 3 yrs', '\uD83D\uDD34 No', 'Unknown', '\uD83D\uDFE1 Yes (With Restrictions. See Guidelines)'],
  'Non-Permanent Residents Allowed?': ['\uD83D\uDFE2 Yes', '\uD83D\uDFE1 Yes (with US Credit)', '\uD83D\uDFE1 Yes. With valid Soc Sec Number', '\uD83D\uDD34 No', '\uD83D\uDFE1 Yes (with US Credit and acceptable VISA)', '\uD83D\uDFE1 On Title Only', '\uD83D\uDFE1 Yes. With Restrictions (See Matrix)'],
  'Foreign National Eligible?': ['\uD83D\uDFE2 Yes', '\uD83D\uDFE1 Yes, with FICO', '\uD83D\uDD34 No'],
  'ITIN Borrower Allowed?': ['\uD83D\uDFE2 Yes', '\uD83D\uDD34 No', 'NA'],
  'FC | SS | DIL Seasoning': ['7 Years', '24 Months', '36 Months', '48 Months', '60 Months', '84 Months', 'No Seasoning', 'No Seasoning Required. Must be Settled', '12 Months'],
  'Rural Properties Allowed?': ['\uD83D\uDD34 No', 'Not Stated - Confirm with lender', '\uD83D\uDFE2 Yes', '\uD83D\uDFE1 Yes (Up to 10 Acres - 10% Leverage Reduction)', '\uD83D\uDFE1 Yes for Primary and 2nd Homes with LTV reduction. No for Investment properties.', '\uD83D\uDFE1 YES for Primary only. NO for 2nd and Investment'],
  'Max Property Size (Acres)': ['2', '5', '10', '10 Acres for Texas', '10 Acres Max >2 acres \u2013 75% Pur, 70% Refi ', '15', '20', '20 Acres / 10 Acres for Texas', '25', '40', '100', 'Lot sizes greater than 10 acres require pre-approval from lender', 'No acreage limitations', 'No Limit (If Comps Support)', 'Not Stated', 'NA'],
  'Appraisal Transfers': ['\uD83D\uDFE2 Yes', '\uD83D\uDD34 No', 'NA'],
  'Max Financed Properties': ['4', '10', '10 Including Subject Property', '10 properties or up to a total of $4,000,000 in unpaid loan balance', '15', '20', 'No limit', 'Not Specified in Matrix', 'Occupying borrowers may not own any other financed properties at the time of closing. ', 'NA', '20 including subject property'],
  'Max Agency Financed': ['10', 'No limit', 'Occupying borrowers may not own any other financed properties at the time of closing.', 'Not Specified in Matrix', 'NA'],
  'Max Lender Financed': ['1 Loan Per Borrower', '4', '10', 'Not Specified in Matrix', 'Occupying borrowers may not own any other financed properties at the time of closing. ', 'NA', 'Limited to exposure of $5M'],
  'Must Currently Own or Rent': ['NA', 'Must have Ownership of ANY property within the past 24 months', 'Living Rent free - Allowed', 'No', 'Must currently own or rent. Rent free is not eligible', 'Must have 12-month primary mortgage and/or rent payment history in the three (3) years', 'Living Rent Free is only allowed if borrower is NOT a First-Time Investor', 'Living Rent Free is allowed at max 70% LTV and DSCR of 1.0+', 'Living Rent Free Allowed with Restrictions (See Matrix)'],
  'Interest Only (IO) Option': ['\uD83D\uDFE2 Yes', '\uD83D\uDFE1 Interest-Only is the only option available', '\uD83D\uDD34 No', 'NA'],
  'Prepayment Penalty (PPP)': ['\uD83D\uDFE2 None', '\uD83D\uDD34 Yes', '\uD83D\uDD34 Yes, for investment properties', '\uD83D\uDD34 Required', '\uD83D\uDFE1 Optional', 'Need Info', '\uD83D\uDFE1 None (Except DSCR)'],
  'DSCR - Min Ratio Required': ['0.75', '0.80', '0.85', '1.00', '1.25', '1.26', 'No Minimum', '1.05', '1.10', '1.15'],
  'DSCR - Min Ratio (1st Time Investor)': ['0.85', '1.00', '1.15', 'NA', '0.75', 'FTI Not Allowed', '1.10'],
  'DSCR - Min Ratio for STR': ['0.85', '1.25', '1.00', 'Not Stated', 'STR Not Allowed', '1.15'],
  'DSCR - Short Term Rental (STR) Income': ['Yes', 'Yes-Refis only', 'No'],
  'DSCR - Primary Home Requirement': ['Must own primary residence', 'Must currently own or rent. Rent free is not eligible', 'Must own a primary residence for at least 1 year', 'Living Rent Free is only allowed if borrower is NOT a First-Time Investor', 'Living Rent Free is allowed at max 70% LTV and DSCR of 1.0+', 'Living Rent Free is only allowed if borrower is NOT a First-Time Homebuyer', 'Must have owned a property for 12 months in the past 3 years', 'Must have owned a property for 12 months in the past 3 years. No FTHB', '12 Months of Property Management Experience at any point in time OR Currently own a primary residence.', 'Must currently own a primary or document a 12-month history of rent'],
  'DSCR - Asset Seasoning': ['30 Days', '60 Days', '10 Days'],
};

// ─── HANDLER ────────────────────────────────────────────────────────────────
const AIRTABLE_BASE_ID = 'appuJgI9X93OLaf0u';
const AIRTABLE_TABLE_ID = 'tblVSU5z4WSxreX7l';

export async function onRequestPatch(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    // Auth is handled by Outseta page-level gating on the Webflow page.
    // The Airtable API key (server-side only) is the security layer here.

    // Parse request body
    const body = await request.json();
    const { recordId, fields } = body;

    if (!recordId || !fields || typeof fields !== 'object') {
      return new Response(JSON.stringify({ error: 'recordId and fields are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate that only allowed fields are being updated
    for (const fieldName of Object.keys(fields)) {
      if (!UPDATABLE_FIELDS.includes(fieldName)) {
        return new Response(JSON.stringify({ error: `Field "${fieldName}" is not updatable` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Validate singleSelect values against known choices.
    // Split fields into valid (will be written) and skipped (returned as warnings).
    const validFields = {};
    const skipped = [];

    for (const [fieldName, value] of Object.entries(fields)) {
      const choices = FIELD_CHOICES[fieldName];
      if (choices) {
        // This is a singleSelect field — check if the value matches a valid choice
        if (choices.includes(value)) {
          validFields[fieldName] = value;
        } else {
          skipped.push({ field: fieldName, value, reason: 'Value does not match any existing option' });
        }
      } else {
        // Not a singleSelect field (or not in our choices map) — allow the write
        validFields[fieldName] = value;
      }
    }

    const apiKey = env.AIRTABLE_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let updatedRecord = null;

    // Only call Airtable if there are valid fields to write
    if (Object.keys(validFields).length > 0) {
      const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${recordId}`;
      const airtableRes = await fetch(airtableUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields: validFields }),
      });

      if (!airtableRes.ok) {
        const errText = await airtableRes.text();
        return new Response(JSON.stringify({ error: 'Airtable update failed', details: errText, skipped }), {
          status: airtableRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      updatedRecord = await airtableRes.json();
    }

    return new Response(JSON.stringify({
      record: updatedRecord,
      updated: Object.keys(validFields).length,
      skipped,
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

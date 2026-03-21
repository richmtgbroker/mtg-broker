// Migration script: Airtable -> Supabase
// Migrates loan products data from Airtable to Supabase

const AIRTABLE_BASE_ID = 'appuJgI9X93OLaf0u';
const AIRTABLE_TABLE_ID = 'tblVSU5z4WSxreX7l';
const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;

const SUPABASE_URL = 'https://tcmahfwhdknxhhdvqpum.supabase.co';
const SUPABASE_TABLE = 'loan_products';

// Get API keys from environment variables
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!AIRTABLE_API_KEY) {
  console.error('ERROR: AIRTABLE_API_KEY environment variable is required');
  process.exit(1);
}

if (!SUPABASE_SERVICE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_KEY environment variable is required');
  process.exit(1);
}

// Helper to safely parse integers
function parseIntSafe(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
}

// Helper to safely parse decimals
function parseDecimalSafe(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

// Helper to get first item of array or null
function getFirstItem(arr) {
  if (Array.isArray(arr) && arr.length > 0) return arr[0];
  return null;
}

// Helper to join array with commas
function joinArray(arr) {
  if (Array.isArray(arr)) return arr.join(', ');
  return arr || null;
}

// Map Airtable record to Supabase row
function mapRecord(record) {
  const fields = record.fields || {};

  return {
    airtable_id: record.id,
    product_name: fields["Lender Product Name | Version"] || null,
    lender_name: getFirstItem(fields["Lender Name (from Lender Name)"]),
    loan_product_type: fields["Loan Product"] || null,
    product_status: fields["Product Status"] || null,
    min_fico: parseIntSafe(fields["Min FICO (Formula)"]),
    min_fico_investment: parseIntSafe(fields["Min FICO (Investment)"]),
    min_loan_amount: parseIntSafe(fields["Min Loan Amount $"]),
    max_loan_amount: parseIntSafe(fields["Converted Max Loan Amount"]),
    max_ltv_purchase: parseDecimalSafe(fields["Max LTV Purch (Formula)"]),
    max_ltv_cashout: parseDecimalSafe(fields["Max LTV (Cash Out) - Text to #"]),
    max_ltv_rate_term: fields["Max LTV (RT)"] || null,
    max_ltv_2_4_units: fields["Max LTV (2-4 Units)"] || null,
    max_cltv: fields["Max CLTV"] || null,
    max_cltv_investment: fields["Max CLTV (Investment)"] || null,
    max_dti: fields["Max DTI"] || null,
    dscr_min_ratio: fields["DSCR - Min Ratio Required"] || null,
    occupancy_choices: fields["Occupancy Choices (Rollup)"] || null,
    property_types: joinArray(fields["Name (from Property Types)"]),
    purposes: fields["Purposes (Rollup)"] || null,
    income_types: fields["Income Types (Rollup)"] || null,
    terms: fields["Terms (Length of Loan)"] || null,
    state_restrictions: fields["States Available"] || null,
    itin_allowed: fields["ITIN Borrower Allowed?"] || null,
    reserves_required: fields["Reserves Required"] || null,
    gift_funds_allowed: fields["Gift Funds Allowed"] || null,
    max_seller_concessions: fields["Max Seller Concessions | Contributions"] || null,
    max_financed_properties: fields["Max Financed Properties"] || null,
    ownership_seasoning_cashout: fields["Ownership Seasoning (Cash-Out)"] || null,
    ownership_seasoning_rate_term: fields["Ownership Seasoning (Rate-Term)"] || null,
    bankruptcy_seasoning: fields["Bankruptcy (BK) Seasoning"] || null,
    foreclosure_seasoning: fields["FC | SS | DIL Seasoning"] || null,
    mortgage_lates: fields["Mortgage Lates"] || null,
    asset_seasoning: fields["Asset Seasoning"] || null,
    max_acreage: fields["Max Property Size (Acres)"] || null,
    rural_properties_allowed: fields["Rural Properties Allowed?"] || null,
    foreign_national_eligible: fields["Foreign National Eligible?"] || null,
    daca_eligible: fields["DACA Borrowers Eligible?"] || null,
    non_occupant_coborrower: fields["Non-Occupant Co-Borrower (NOCB) Allowed?"] || null,
    fthb_allowed: fields["FTHB Allowed?"] || null,
    first_time_investors_allowed: fields["First Time Investors Allowed?"] || null,
    interest_only_available: fields["Interest Only (IO) Option"] || null,
    cash_out_available: fields["Cash-Out Available?"] || null,
    max_cash_out: fields["Max Cash-Out"] || null,
    prepayment_penalty: fields["Prepayment Penalty (PPP)"] || null,
    manual_uw_allowed: fields["Manual UW Allowed?"] || null,
    vest_in_llc: fields["Vest in LLC"] || null,
    property_types_notes: fields["PROPERTY TYPES Notes"] || null,
    description: fields["Description"] || null,
    program_notes: fields["Notes"] || null,
    additional_reserves: fields["Additional Reserves"] || null,
    dscr_str_income_usable: fields["DSCR - STR (Short Term Rental) Income Usable?"] || null,
    dscr_min_ratio_str: fields["DSCR - Min Ratio for STR"] || null,
    matrix_url: fields["Matrix"] || null,
    matrix_date: fields["Matrix Date"] || null
  };
}

// Fetch all records from Airtable with pagination
async function fetchAllAirtableRecords() {
  const allRecords = [];
  let offset = null;
  let page = 1;

  console.log('Fetching records from Airtable...');

  do {
    const url = new URL(AIRTABLE_API_URL);
    url.searchParams.set('pageSize', '100');
    if (offset) {
      url.searchParams.set('offset', offset);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Airtable API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const records = data.records || [];
    allRecords.push(...records);

    console.log(`  Page ${page}: fetched ${records.length} records (total: ${allRecords.length})`);

    offset = data.offset || null;
    page++;

    // Small delay to avoid rate limiting
    if (offset) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  } while (offset);

  console.log(`\nTotal records fetched from Airtable: ${allRecords.length}`);
  return allRecords;
}

// Insert records into Supabase in batches
async function insertIntoSupabase(records) {
  const BATCH_SIZE = 50;
  let inserted = 0;
  let errors = 0;

  console.log(`\nInserting ${records.length} records into Supabase in batches of ${BATCH_SIZE}...`);

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const mappedBatch = batch.map(mapRecord);

    const response = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(mappedBatch)
    });

    if (response.ok) {
      inserted += batch.length;
      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: inserted ${batch.length} records (total: ${inserted})`);
    } else {
      const errorText = await response.text();
      console.error(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} FAILED: ${response.status} - ${errorText}`);
      errors += batch.length;
    }

    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return { inserted, errors };
}

// Verify final count in Supabase
async function verifySupabaseCount() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?select=count`, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'count=exact'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to verify count: ${response.status}`);
  }

  const countHeader = response.headers.get('content-range');
  if (countHeader) {
    const match = countHeader.match(/\/(\d+)$/);
    if (match) return parseInt(match[1], 10);
  }

  return null;
}

// Main migration function
async function migrate() {
  console.log('='.repeat(60));
  console.log('AIRTABLE TO SUPABASE MIGRATION');
  console.log('='.repeat(60));
  console.log(`Source: Airtable base ${AIRTABLE_BASE_ID}, table ${AIRTABLE_TABLE_ID}`);
  console.log(`Destination: Supabase ${SUPABASE_URL}, table ${SUPABASE_TABLE}`);
  console.log('='.repeat(60));

  try {
    // Step 1: Fetch all records from Airtable
    const airtableRecords = await fetchAllAirtableRecords();

    if (airtableRecords.length === 0) {
      console.log('No records found in Airtable. Exiting.');
      return;
    }

    // Step 2: Insert into Supabase
    const { inserted, errors } = await insertIntoSupabase(airtableRecords);

    // Step 3: Verify
    console.log('\n' + '='.repeat(60));
    console.log('MIGRATION COMPLETE');
    console.log('='.repeat(60));
    console.log(`Airtable records: ${airtableRecords.length}`);
    console.log(`Successfully inserted: ${inserted}`);
    console.log(`Errors: ${errors}`);

    const supabaseCount = await verifySupabaseCount();
    if (supabaseCount !== null) {
      console.log(`Supabase table count: ${supabaseCount}`);
      if (supabaseCount === airtableRecords.length) {
        console.log('\n✓ Migration verified successfully!');
      } else {
        console.log(`\n⚠ Count mismatch: expected ${airtableRecords.length}, got ${supabaseCount}`);
      }
    }

  } catch (error) {
    console.error('\nMIGRATION FAILED:', error.message);
    process.exit(1);
  }
}

// Run migration
migrate();

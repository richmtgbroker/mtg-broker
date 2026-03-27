/**
 * mtg-broker-airtable-sync — Cloudflare Worker
 * =========================================================
 * Syncs Airtable tables → Supabase:
 *   1. Loan Products  (Airtable tblVSU5z4WSxreX7l → Supabase loan_products)
 *   2. Lenders         (Airtable tbl1mpg3KFakZsFK7 → Supabase lenders)
 *
 * SCHEDULE: Daily at 3 AM UTC (cron: 0 3 * * *)
 *
 * ENDPOINTS:
 *   GET /         → runs full sync (both tables) and returns results
 *   GET /products → syncs only loan_products
 *   GET /lenders  → syncs only lenders
 *   GET /health   → returns status + confirms secrets are set
 *
 * REQUIRED SECRETS (set in Cloudflare dashboard → Workers → Settings → Variables):
 *   AIRTABLE_API_KEY     — Airtable personal access token
 *   SUPABASE_SERVICE_KEY — Supabase service role key (not anon key)
 *
 * DEPLOY:
 *   wrangler deploy workers/mtg-broker-airtable-sync.js \
 *     --name mtg-broker-airtable-sync \
 *     --compatibility-date 2024-01-01
 *
 * SYNC STRATEGY: Full replace (delete all → re-insert all).
 *   Safe because Airtable is the source of truth and we abort
 *   if Airtable returns 0 records (prevents accidental wipe).
 * =========================================================
 */

// ============================================================
// CONFIG
// ============================================================
const AIRTABLE_BASE_ID = 'appuJgI9X93OLaf0u';
const SUPABASE_URL     = 'https://tcmahfwhdknxhhdvqpum.supabase.co';
const BATCH_SIZE       = 50;

// Table-specific config
const TABLES = {
  loan_products: {
    airtable_table_id: 'tblVSU5z4WSxreX7l',
    supabase_table:    'loan_products',
    delete_filter:     'airtable_id=not.is.null',
    mapper:            mapLoanProductRecord,
  },
  lenders: {
    airtable_table_id: 'tbl1mpg3KFakZsFK7',
    supabase_table:    'lenders',
    delete_filter:     'id=gt.0',  // Delete all rows (old rows lack airtable_id)
    mapper:            mapLenderRecord,
  },
};


// ============================================================
// FIELD HELPERS
// ============================================================

function parseIntSafe(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
}

function parseDecimalSafe(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

function getFirstItem(arr) {
  if (Array.isArray(arr) && arr.length > 0) return arr[0];
  return null;
}

function joinArray(arr) {
  if (Array.isArray(arr)) return arr.join(', ');
  return arr || null;
}

// Extract URL from Airtable's link-type fields (can be string or {label, url} object)
function extractUrl(field) {
  if (!field) return null;
  if (typeof field === 'string') return field || null;
  if (typeof field === 'object' && field.url) return field.url || null;
  return null;
}


// ============================================================
// FIELD MAPPING — Loan Products
// Maps one Airtable record to a Supabase loan_products row.
// ============================================================
function mapLoanProductRecord(record) {
  const fields = record.fields || {};
  return {
    airtable_id:                    record.id,
    product_name:                   fields['Lender Product Name | Version'] || null,
    lender_name:                    getFirstItem(fields['Lender Name (from Lender Name)']),
    loan_product_type:              fields['Loan Product'] || null,
    product_status:                 fields['Product Status'] || null,
    min_fico:                       parseIntSafe(fields['Min FICO (Formula)']),
    min_fico_investment:            parseIntSafe(fields['Min FICO (Investment)']),
    min_loan_amount:                parseIntSafe(fields['Min Loan Amount $']),
    max_loan_amount:                parseIntSafe(fields['Converted Max Loan Amount']),
    max_ltv_purchase:               parseDecimalSafe(fields['Max LTV Purch (Formula)']),
    max_ltv_cashout:                parseDecimalSafe(fields['Max LTV (Cash Out) - Text to #']),
    max_ltv_rate_term:              fields['Max LTV (RT)'] || null,
    max_ltv_2_4_units:              fields['Max LTV (2-4 Units)'] || null,
    max_cltv:                       fields['Max CLTV'] || null,
    max_cltv_investment:            fields['Max CLTV (Investment)'] || null,
    max_dti:                        fields['Max DTI'] || null,
    dscr_min_ratio:                 fields['DSCR - Min Ratio Required'] || null,
    occupancy_choices:              fields['Occupancy Choices (Rollup)'] || null,
    property_types:                 joinArray(fields['Name (from Property Types)']),
    purposes:                       fields['Purposes (Rollup)'] || null,
    income_types:                   fields['Income Types (Rollup)'] || null,
    terms:                          fields['Terms (Length of Loan)'] || null,
    state_restrictions:             fields['States Available'] || null,
    itin_allowed:                   fields['ITIN Borrower Allowed?'] || null,
    reserves_required:              fields['Reserves Required'] || null,
    gift_funds_allowed:             fields['Gift Funds Allowed'] || null,
    max_seller_concessions:         fields['Max Seller Concessions | Contributions'] || null,
    max_financed_properties:        fields['Max Financed Properties'] || null,
    ownership_seasoning_cashout:    fields['Ownership Seasoning (Cash-Out)'] || null,
    ownership_seasoning_rate_term:  fields['Ownership Seasoning (Rate-Term)'] || null,
    bankruptcy_seasoning:           fields['Bankruptcy (BK) Seasoning'] || null,
    foreclosure_seasoning:          fields['FC | SS | DIL Seasoning'] || null,
    mortgage_lates:                 fields['Mortgage Lates'] || null,
    asset_seasoning:                fields['Asset Seasoning'] || null,
    max_acreage:                    fields['Max Property Size (Acres)'] || null,
    rural_properties_allowed:       fields['Rural Properties Allowed?'] || null,
    foreign_national_eligible:      fields['Foreign National Eligible?'] || null,
    daca_eligible:                  fields['DACA Borrowers Eligible?'] || null,
    non_occupant_coborrower:        fields['Non-Occupant Co-Borrower (NOCB) Allowed?'] || null,
    fthb_allowed:                   fields['FTHB Allowed?'] || null,
    first_time_investors_allowed:   fields['First Time Investors Allowed?'] || null,
    interest_only_available:        fields['Interest Only (IO) Option'] || null,
    cash_out_available:             fields['Cash-Out Available?'] || null,
    max_cash_out:                   fields['Max Cash-Out'] || null,
    prepayment_penalty:             fields['Prepayment Penalty (PPP)'] || null,
    manual_uw_allowed:              fields['Manual UW Allowed?'] || null,
    vest_in_llc:                    fields['Vest in LLC'] || null,
    property_types_notes:           fields['PROPERTY TYPES Notes'] || null,
    description:                    fields['Description'] || null,
    program_notes:                  fields['Notes'] || null,
    additional_reserves:            fields['Additional Reserves'] || null,
    dscr_str_income_usable:         fields['DSCR - STR (Short Term Rental) Income Usable?'] || null,
    dscr_min_ratio_str:             fields['DSCR - Min Ratio for STR'] || null,
    matrix_url:                     fields['Matrix'] || null,
    matrix_date:                    fields['Matrix Date'] || null,
  };
}


// ============================================================
// FIELD MAPPING — Lenders
// Maps one Airtable record to a Supabase lenders row.
// ============================================================
function mapLenderRecord(record) {
  const fields = record.fields || {};
  return {
    airtable_id:              record.id,
    name:                     fields['Lender Name'] || null,
    website_url:              fields['Corporate Website (Final)'] || fields['Corporate Website'] || null,
    tpo_portal_url:           fields['TPO Broker Portal (Final)'] || extractUrl(fields['TPO Portal']) || null,
    correspondent_portal_url: extractUrl(fields['Correspondent Portal']) || null,
    turn_times_url:           fields['Turn Times'] || extractUrl(fields['Turn Times URL']) || null,
  };
}


// ============================================================
// AIRTABLE — fetch all records (handles pagination)
// ============================================================
async function fetchAllAirtableRecords(airtableTableId, apiKey) {
  const apiUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${airtableTableId}`;
  const allRecords = [];
  let offset = null;
  let page = 1;

  do {
    const url = new URL(apiUrl);
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Airtable API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const records = data.records || [];
    allRecords.push(...records);
    console.log(`Airtable page ${page}: ${records.length} records (running total: ${allRecords.length})`);

    offset = data.offset || null;
    page++;

    // Airtable rate limit: 5 requests/second — wait 220ms between pages
    if (offset) await new Promise(r => setTimeout(r, 220));
  } while (offset);

  return allRecords;
}


// ============================================================
// SUPABASE — delete all rows, insert in batches, count
// ============================================================
async function deleteAllSupabaseRecords(supabaseTable, deleteFilter, serviceKey) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${supabaseTable}?${deleteFilter}`,
    {
      method: 'DELETE',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase delete failed (${response.status}): ${errorText}`);
  }
}

async function insertSupabaseRecords(supabaseTable, records, mapper, serviceKey) {
  let inserted = 0;
  let errors = 0;
  const errorDetails = [];

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const mappedBatch = batch.map(mapper);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    const response = await fetch(`${SUPABASE_URL}/rest/v1/${supabaseTable}`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(mappedBatch),
    });

    if (response.ok) {
      inserted += batch.length;
      console.log(`Batch ${batchNum}: inserted ${batch.length} records (total: ${inserted})`);
    } else {
      const errorText = await response.text();
      errors += batch.length;
      errorDetails.push(`Batch ${batchNum}: ${response.status} - ${errorText.slice(0, 200)}`);
      console.error(`Batch ${batchNum} FAILED: ${response.status} - ${errorText.slice(0, 200)}`);
    }

    // Small delay between batches to avoid overwhelming Supabase
    await new Promise(r => setTimeout(r, 100));
  }

  return { inserted, errors, errorDetails };
}

async function getSupabaseCount(supabaseTable, serviceKey) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${supabaseTable}?select=count`,
    {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer': 'count=exact',
      },
    }
  );

  if (!response.ok) return null;

  const contentRange = response.headers.get('content-range');
  if (contentRange) {
    const match = contentRange.match(/\/(\d+)$/);
    if (match) return parseInt(match[1], 10);
  }

  return null;
}


// ============================================================
// SYNC ONE TABLE
// Returns { success, airtable_count, inserted, errors, supabase_count, errorDetails }
// ============================================================
async function syncTable(tableConfig, apiKey, serviceKey, logLine) {
  const { airtable_table_id, supabase_table, delete_filter, mapper } = tableConfig;

  // Fetch from Airtable
  logLine(`  Fetching from Airtable (${airtable_table_id})...`);
  const airtableRecords = await fetchAllAirtableRecords(airtable_table_id, apiKey);
  logLine(`  ✓ Fetched ${airtableRecords.length} records`);

  // Safety check — never wipe Supabase if Airtable returns nothing
  if (airtableRecords.length === 0) {
    throw new Error(`Airtable returned 0 records for ${supabase_table} — aborting to avoid wiping Supabase`);
  }

  // Clear Supabase table
  logLine(`  Clearing ${supabase_table}...`);
  await deleteAllSupabaseRecords(supabase_table, delete_filter, serviceKey);
  logLine(`  ✓ Table cleared`);

  // Insert all records
  logLine(`  Inserting ${airtableRecords.length} records into ${supabase_table}...`);
  const { inserted, errors, errorDetails } = await insertSupabaseRecords(
    supabase_table, airtableRecords, mapper, serviceKey
  );

  const finalCount = await getSupabaseCount(supabase_table, serviceKey);

  return {
    success: errors === 0 && finalCount === airtableRecords.length,
    airtable_count: airtableRecords.length,
    inserted,
    errors,
    supabase_count: finalCount,
    errorDetails,
  };
}


// ============================================================
// MAIN SYNC FUNCTION
// tablesToSync: array of table keys from TABLES config, e.g. ['loan_products', 'lenders']
// ============================================================
async function runSync(env, tablesToSync) {
  const startTime = Date.now();
  const log = [];
  const logLine = msg => { console.log(msg); log.push(msg); };
  const results = {};

  try {
    logLine(`[${new Date().toISOString()}] Starting Airtable → Supabase sync`);
    logLine(`Tables: ${tablesToSync.join(', ')}`);

    if (!env.AIRTABLE_API_KEY)     throw new Error('Missing secret: AIRTABLE_API_KEY');
    if (!env.SUPABASE_SERVICE_KEY) throw new Error('Missing secret: SUPABASE_SERVICE_KEY');

    let allSuccess = true;

    for (const tableKey of tablesToSync) {
      const tableConfig = TABLES[tableKey];
      if (!tableConfig) {
        logLine(`⚠ Unknown table: ${tableKey} — skipping`);
        continue;
      }

      logLine('');
      logLine(`── Syncing ${tableKey} ──────────────────────────────`);

      try {
        const tableResult = await syncTable(tableConfig, env.AIRTABLE_API_KEY, env.SUPABASE_SERVICE_KEY, logLine);
        results[tableKey] = tableResult;

        logLine(`  Airtable: ${tableResult.airtable_count} | Inserted: ${tableResult.inserted} | Errors: ${tableResult.errors} | Supabase: ${tableResult.supabase_count ?? 'unknown'}`);

        if (tableResult.errors > 0) {
          tableResult.errorDetails.forEach(e => logLine(`    - ${e}`));
        }

        logLine(tableResult.success ? `  ✓ ${tableKey} synced successfully` : `  ⚠ ${tableKey} synced with issues`);

        if (!tableResult.success) allSuccess = false;
      } catch (tableError) {
        logLine(`  ✗ ${tableKey} FAILED: ${tableError.message}`);
        results[tableKey] = { success: false, error: tableError.message };
        allSuccess = false;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logLine('');
    logLine('─── OVERALL ────────────────────────────────────────');
    logLine(`Duration: ${duration}s`);
    logLine(allSuccess ? '✓ All syncs completed successfully!' : '⚠ Some syncs had issues');

    return { success: allSuccess, tables: results, duration_seconds: parseFloat(duration), log };

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logLine(`✗ SYNC FAILED: ${error.message}`);
    return { success: false, error: error.message, tables: results, duration_seconds: parseFloat(duration), log };
  }
}


// ============================================================
// WORKER ENTRY POINT
// ============================================================
export default {
  // Cron trigger — runs daily at 3 AM UTC, syncs all tables
  async scheduled(event, env, ctx) {
    const result = await runSync(env, ['loan_products', 'lenders']);
    if (!result.success) {
      console.error('SYNC FAILED:', JSON.stringify(result));
    }
  },

  // HTTP trigger — for manual runs and health checks
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Health check — confirms secrets are set, no sync
    if (url.pathname === '/health') {
      return Response.json({
        status: 'ok',
        has_airtable_key: !!env.AIRTABLE_API_KEY,
        has_supabase_key: !!env.SUPABASE_SERVICE_KEY,
        tables: Object.keys(TABLES),
        cron: '0 3 * * * (daily at 3 AM UTC)',
        next_run: 'Check Cloudflare dashboard → Workers → Triggers',
      }, { headers: corsHeaders });
    }

    // Sync specific table
    if (url.pathname === '/products') {
      const result = await runSync(env, ['loan_products']);
      return Response.json(result, { status: result.success ? 200 : 500, headers: corsHeaders });
    }

    if (url.pathname === '/lenders') {
      const result = await runSync(env, ['lenders']);
      return Response.json(result, { status: result.success ? 200 : 500, headers: corsHeaders });
    }

    // Default: sync all tables
    const result = await runSync(env, ['loan_products', 'lenders']);
    return Response.json(result, { status: result.success ? 200 : 500, headers: corsHeaders });
  },
};

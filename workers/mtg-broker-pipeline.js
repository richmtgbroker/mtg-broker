/**
 * MTG Broker PIPELINE API - Cloudflare Worker
 * Handles Pipeline Loans CRUD, Pipeline Tasks CRUD, Affordability Calculator module,
 * Refinance Quick Calc module, Plan Limits checking, and Usage Tracking
 * 
 * CREATED: February 23, 2026 - v1.0
 * UPDATED: March 25, 2026 - v8.3 — Liabilities tab + Pricing tab:
 *   New Liabilities tab (after Assets): dynamic liability rows with name, type,
 *   balance, monthly payment, exclude checkbox, totals. Stored as JSON.
 *   New Pricing tab (above Loan Details): moved Pricing Summary card from
 *   Loan Details. Added Pricing Notes + Loan Details Notes cards.
 *   New static endpoint: /static/pipeline-liabilities.js
 *   New Supabase columns: liabilities_json (jsonb), liabilities_notes (text),
 *   loan_details_notes (text).
 *
 * PREVIOUS: March 24, 2026 - v8.2 — Lender searchable dropdown:
 *   Replaced text input with searchable combobox pulling 294 lenders from Supabase.
 *   "Other" option with manual text input for unlisted lenders.
 *   New public endpoint: GET /api/lenders (cached 30min).
 *   New Supabase table: public.lenders (294 rows).
 *
 * PREVIOUS: March 24, 2026 - v8.0 — Supabase migration for Pipeline Loans + Tasks:
 *   Loans + Tasks CRUD now reads/writes Supabase instead of Airtable.
 *   Server-side field mapping layer converts Airtable field names ↔ Supabase snake_case columns.
 *   Client-side JS is unchanged — still sends/receives Airtable-format field names.
 *   Response format preserved: {id, fields: {...}} for seamless client compatibility.
 *   Route matching updated to accept both UUIDs and Airtable rec* IDs.
 *   Usage tracking still uses Airtable (separate migration planned).
 *   Environment: now requires SUPABASE_URL + SUPABASE_KEY (service_role) in addition to AIRTABLE_API_KEY.
 *
 * PREVIOUS: March 23, 2026 - v7.30 — Dev Tracker items 1.1, 1.2, 1.4:
 *   1.1: Renamed "Report #" label to "Report / File #" in credit section (DOM enhancement in initPipeline).
 *   1.2: Converted Credit Pull Type from text input to dropdown with Hard Pull, Soft Pull, Estimated options.
 *   1.4: Added "Requested HOI from Borrower" checklist item above "HOI Quotes Requested" in Homeowners Insurance group.
 *   Checklist now has 51 items (was 50). Order numbers bumped for HOI and Closing groups.
 *
 * PREVIOUS: March 23, 2026 - v7.29 — CRIT-1 security fix: JWT signature verification.
 *   Client now sends raw JWT instead of plain email in Authorization header.
 *   Server verifies RS256 signature via Outseta JWKS before trusting identity.
 *   Added verifyOutsetaJWT(), sanitizeEmailForFormula(), getAccessToken().
 *   HIGH-3: updateTask() and deleteTask() now verify task ownership.
 *
 * PREVIOUS: March 19, 2026 - v7.28 — Added Closing Costs Calculator module.
 *   Two-panel sidebar (inputs left, results right) matching Refi Analysis pattern.
 *   All LE sections A-H, credits, funding fee, purchase/refi toggle.
 *   Pre-fills from loan modal fields, localStorage save/restore per loan.
 *   Served via /static/pipeline-closing-costs.js.
 *
 * PREVIOUS: March 20, 2026 - v7.27 — Refinance Analysis v3.0: two-panel layout.
 *   Inputs on left, live results on right. Modal widened to 1200px.
 *   No more scrolling between inputs and results. Added all fields from v2.0
 *   (property value, cash-out, debt payoff, funding fee, discount points, etc.)
 *   Results: savings hero, payment comparison, 2x2 metrics (break-even, benefit,
 *   LTV, lifetime savings), loan breakdown, cost breakdown. Responsive stacking
 *   on narrow screens.
 *
 * PREVIOUS: March 20, 2026 - v7.25 — FIX: Tasks not loading for loans.
 *   getTasks() was using ARRAYJOIN({Loan}) which returns display names,
 *   not record IDs. Replaced with: fetch all user tasks, filter in JS
 *   by checking if the Loan array contains the requested loanId.
 *   Tasks were being created correctly but never appeared in the UI.
 *
 * PREVIOUS: March 19, 2026 - v7.24 — Documents tab v2.1 (Two independent cards + note fix):
 *   Borrower Documents and Broker/Lender Documents are now two separate
 *   cards with their own toolbars, progress counts, and Copy Needs List
 *   buttons (each only copies its own card's remaining docs).
 *   Fixed note blur/click race condition: onmousedown+preventDefault on
 *   note toggle, onblur save no longer re-renders DOM.
 *   25 Borrower docs + 9 Broker docs = 34 total across 8 categories.
 *   Migration: existing v1.0 saved docs auto-assigned resp from defaults.
 * v7.23 — Purchase Agreement PDF extraction v1.2:
 *   Rewrote Claude extraction prompt for dramatically better accuracy:
 *   - "may" vs "shall" distinction: "Buyer may have the Property surveyed" = N/A (right, not election)
 *   - Checkbox/fill-in primary evidence rule: unchecked boxes + empty blanks = N/A
 *   - Florida FAR/BAR paragraph-by-paragraph guidance: 9(d) Survey = boilerplate right,
 *     12(c) WDO = boilerplate right, 9(e) Home Warranty = read checked checkbox
 *   - "When in doubt → always N/A" default
 *   - TBD closing dates now omitted instead of guessed
 *   - Cooperating Sales Associate / Listing Sales Associate lookup for agents
 *   Multi-document upload: users can select contract + addenda in one go.
 *   Worker accepts { documents: [{data, mediaType}, ...] } array.
 *   max_tokens increased to 4000 for longer contracts.
 *   New endpoint: POST /api/pipeline/extract-purchase-agreement
 * v7.22 — Purchase Agreement tab v1.0:
 *   New nav item + section card injected at runtime via pipeline-purchase-agreement.js.
 *   Fields: Buyers Names, Purchase Price, Escrow Deposit, Seller Concessions ($/%), 
 *   COE/Expiration Date, Survey/Pest/Home Warranty (Required + Paid By toggles),
 *   Buyer's Agent, Seller's Agent. All stored as JSON blob in "Purchase Agreement JSON" field.
 *   New static endpoint: /static/pipeline-purchase-agreement.js
 * v7.21 — (no changes from v7.20, version bump for deployment)
 * v7.20 — Documents tab v1.0:
 *   34 default mortgage document items across 8 categories.
 *   Per-document status tracking (Needed/Received/Waived).
 *   Date received, per-document notes, custom document addition.
 *   "Copy Needs List" with clipboard + screenshot popup.
 *   Auto-save to "Documents JSON" Airtable field.
 *   New endpoint: /static/pipeline-documents.js
 * v7.19 — Equity Loan subordinate financing:
 *   New fields: Lien Position, Existing 1st/2nd Mortgage Balance, Max CLTV.
 *   Conditional show/hide when Purpose = "Equity Loan".
 *   Auto-calc: Total Existing Liens, Max Total Debt, Max New Loan, Actual CLTV.
 *   Recalculates live on any input change (property value, loan amount, etc.).
 * v7.18 — Assets tab 2-column layout:
 *   Accounts card dynamically created as separate right-column card.
 *   Cash to Close + Reserves + Grand Total in left card.
 *   Requires JS loader hookShowSection for 2-column pinning.
 * v7.17 — Assets tab v2 (full rebuild):
 *   Cash to Close section (Down Payment synced from loan, Closing Costs, total).
 *   Reserves section (Primary + Other Reserves with overridable total).
 *   Accounts section (multi-row: Type/Balance/Account#/Description, JSON stored).
 *   New static endpoint: /static/pipeline-assets.js
 *   New Airtable fields: Other Reserves Months, Other Reserves Monthly Amount,
 *   Other Reserves Total, Asset Accounts (JSON).
 * v7.16 — Assets tab v1:
 *   Added Down Payment, Closing Costs, Months of Reserves, and
 *   Estimated Monthly Payment fields to load/save. Auto-calc totals
 *   (Reserve Amount, Total Assets Needed) handled client-side in JS loader.
 * v7.15 — Checklist v2.2:
 *   Reordered Credit & Prequalification group: Hard Credit Pull first;
 *   Added "Select Expected Lender and Loan Product" and "Price Loan" items;
 *   Renamed "AUS/GUS Ran" → "Run AUS/GUS"; 50 items across 14 groups.
 * v7.14 — Checklist v2.1:
 *   Added date fields to Opt Out Prescreen and Request Docs;
 *   Fixed Closing order (Funded → Closed → Purchased);
 *   Added N/A toggle per item (counts as done, greyed style).
 * v7.13 — Checklist v2.0 overhaul:
 *   Restructured checklist groups: new Initial Compliance & Credit/Prequalification
 *   sections; Purchase Agreement conditionally shown based on Purpose field;
 *   Disclosures renamed to Lender Disclosures; Closed moved before Funded;
 *   Added All Docs Received, Hard Credit Pull, Purchased (NonDel) items.
 * v7.12 — Favicons on LINKS tab fields
 * v7.10 — Hybrid Income section (Quick Total + Detail Modal):
 *   Main view: fixed-width total fields per person with Ann/Mo toggle + Details button.
 *   Details button opens a modal with table-style income source rows.
 *   Each source: Type | SE Doc (incl. Bank Statements option) | Amount | BS Period | Exp Factor.
 *   BS Period + Expense Factor only visible when SE Doc = "Bank Statements".
 *   "Apply to total" auto-sums sources back into the total field.
 *   Airtable: totals in existing Borrower/Co-Borrower Income number fields.
 *   Detail lines stored as JSON in Borrower/Co-Borrower Income Details (longText).
 * v7.9 — Property Value field added to Property page (synced with Loan Details).
 * v7.12 — Favicons on LINKS tab: show site favicon next to field label
 *   when a URL is entered. Uses Google favicon service. Favicon hidden
 *   when field is empty or URL is invalid.
 * v7.7 — Save without closing modal + Links section:
 *   Save Loan button now saves data but keeps the modal open.
 *   Added "Saved!" toast notification for visual confirmation.
 *   For new loans, updates currentLoanId after API returns real ID
 *   so subsequent saves update the same record (no duplicates).
 *   Cancel buttons renamed to Close for clarity.
 *   Unsaved changes detection: closing the modal with pending
 *   changes shows a 3-button dialog (Save & Close / Discard / Keep Editing).
 *   Form snapshot captured on modal open and after each save.
 *   HELOC section now stacks centered under Loan Details (not side-by-side).
 *   Links section: Application, Documents, Lender Portal, Appraisal Portal
 *   plus 3 custom-named Other links with Open buttons for each URL.
 * v7.6 — Section pages layout:
 *   Modal sections now display as full-page views instead of one scrollable page.
 *   Borrower + Deal shown side-by-side as the default "main" page.
 *   Each other section (Credit, Loan Details, etc.) shown individually
 *   when its left nav item is clicked. Replaced scrollToSection() with
 *   showSection() for show/hide behavior. Removed scroll spy (no longer
 *   needed). Single sections display full-width with max-width constraint.
 *   Notes + Tasks shown side-by-side on the Notes page.
 * v7.5 — Refinance Quick Calc sidebar:
 *   Added inline refinance analysis calculator to pipeline modal.
 *   DOM and CSS both built dynamically via JS (CSS injected into <head>
 *   at runtime) to keep Webflow HTML+CSS embeds under 50K limits.
 * v7.4 — Section highlight on nav click/scroll (replaced by v7.6 page layout)
 * v7.3 — Fixed checklist not saving:
 *   Changed let→var for loans/currentLoanId/userEmail so they are
 *   accessible via window.* from the checklist module (separate script).
 *   let at top-level scope does NOT create window properties; var does.
 * v7.1 — Added Loan Workflow Checklist module
 *   50-item drag-and-drop checklist per loan stored as JSON in Airtable;
 *   14 color-coded groups; auto-save; MutationObserver integration;
 *   Served as /static/pipeline-checklist.js
 * v7.0 — Payment fields 2 decimal places + math expressions;
 *   Modal 3-panel layout (left nav + right calc panel); Deal section first;
 *   Scroll-to-section nav; evaluateExpression() for calc inputs like 240*12
 * v6.0 — Added Property County, Channel, Comp Type;
 *   restructured Loan Details/Compensation; P&I auto-calc; rate 3-decimal formatting
 * v5.0 — Lead Source options, Lender text input, Co-Borrower divider + Role dropdown
 * Split from main mtg-broker-api worker to allow parallel development.
 * 
 * DEPLOY URL: mtg-broker-pipeline.rich-e00.workers.dev
 * 
 * Environment Variables Required:
 *   - SUPABASE_URL: Supabase project URL (e.g. https://tcmahfwhdknxhhdvqpum.supabase.co)
 *   - SUPABASE_KEY: Supabase service_role key (NOT anon key — bypasses RLS for server ops)
 *   - ANTHROPIC_API_KEY: Claude API key (used for Purchase Agreement PDF extraction)
 * 
 * Endpoints:
 *   --- Pipeline Loans ---
 *   GET    /api/pipeline/loans              - Get all loans for user (10-min cache, ?refresh=true to bypass)
 *   POST   /api/pipeline/loans              - Create a new loan
 *   PUT    /api/pipeline/loans/:id          - Update a loan
 *   DELETE /api/pipeline/loans/:id          - Delete a loan
 *   GET    /api/pipeline/loans/clear-cache  - Manually clear pipeline cache
 * 
 *   --- Pipeline Tasks ---
 *   GET    /api/pipeline/tasks              - Get tasks (?loanId=uuid to filter by loan)
 *   POST   /api/pipeline/tasks              - Create a new task
 *   PUT    /api/pipeline/tasks/:id          - Update a task
 *   DELETE /api/pipeline/tasks/:id          - Delete a task
 * 
 *   --- Plan Limits & Usage ---
 *   GET    /api/plan-limits                 - Check plan limits (?action=add-pipeline-loan etc.)
 *   GET    /api/usage                       - Get usage stats
 *   PUT    /api/usage                       - Update usage stats
 * 
 *   --- Static Assets ---
 *   GET    /static/pipeline-app.js         - Main pipeline app JS module
 *   GET    /static/pipeline-calcs.js        - Affordability calculator JS module
 *   GET    /static/pipeline-checklist.js    - Loan workflow checklist JS module
 *   GET    /static/pipeline-assets.js       - Assets tab JS module
 *   GET    /static/pipeline-documents.js    - Documents tab JS module (v2.0 Borrower/Broker split)
 * 
 *   --- Health ---
 *   GET    /health                          - Health check
 */

// ============================
// Supabase Config (Pipeline Loans + Tasks)
// ============================
// SUPABASE_URL and SUPABASE_KEY are set as Cloudflare Worker env vars.
// SUPABASE_KEY must be the service_role key to bypass RLS for server-side operations.

// Field mapping: Airtable field name → Supabase column name
// Used to translate between client-side Airtable format and Supabase snake_case
const FIELD_TO_COLUMN = {
  'Loan Name': 'loan_name', 'Loan Purpose': 'loan_purpose', 'Occupancy': 'occupancy',
  'Credit Pull Type': 'credit_pull_type', 'User Email': 'user_email', 'Stage': 'stage',
  'Borrower Name': 'borrower_name', 'Borrower Email': 'borrower_email',
  'Borrower Phone': 'borrower_phone', 'Co-Borrower': 'co_borrower',
  'Property Street': 'property_street', 'Property City': 'property_city',
  'Property State': 'property_state', 'Property Zip': 'property_zip',
  'Property Type': 'property_type', 'Property Value': 'property_value',
  'Purchase Price': 'purchase_price', 'Loan Type': 'loan_type',
  'Loan Amount': 'loan_amount', 'Interest Rate': 'interest_rate',
  'Loan Term': 'loan_term', 'LTV': 'ltv', 'Expected Close': 'expected_close',
  'Lead Source': 'lead_source', 'Calculator Link': 'calculator_link',
  'Notes': 'notes', 'Comp BPS': 'comp_bps',
  'HELOC Line Amount': 'heloc_line_amount', 'HELOC Initial Draw': 'heloc_initial_draw',
  'Credit Score': 'credit_score', 'Date Credit Pulled': 'date_credit_pulled',
  'Scores Pulled': 'scores_pulled', 'Credit Vendor': 'credit_vendor',
  'Credit Report Number': 'credit_report_number',
  'Compensation Amount': 'compensation_amount',
  'Qualifying Interest Rate': 'qualifying_interest_rate',
  'Other Loan Type': 'other_loan_type', 'Deal Status': 'deal_status',
  'Lost Reason': 'lost_reason', 'Lock Date': 'lock_date',
  'Lock Expiration Date': 'lock_expiration_date', 'Lock Status': 'lock_status',
  'Payroll Submitted Date': 'payroll_submitted_date',
  'Payroll Processed Date': 'payroll_processed_date',
  'Pay Received Date': 'pay_received_date', 'Pay Status': 'pay_status',
  'Co-Borrower Email': 'co_borrower_email', 'Co-Borrower Phone': 'co_borrower_phone',
  'Last Contact Date': 'last_contact_date', 'Gross Annual Income': 'gross_annual_income',
  'Monthly Debt Payments': 'monthly_debt_payments', 'Target DTI': 'target_dti',
  'Afford Max Purchase': 'afford_max_purchase',
  'Afford Max Loan Amt': 'afford_max_loan_amt',
  'Afford Max PITIA': 'afford_max_pitia',
  'Borrower First Name': 'borrower_first_name',
  'Borrower Middle Name': 'borrower_middle_name',
  'Borrower Last Name': 'borrower_last_name',
  'Co-Borrower First Name': 'co_borrower_first_name',
  'Co-Borrower Middle Name': 'co_borrower_middle_name',
  'Co-Borrower Last Name': 'co_borrower_last_name',
  'HOI': 'hoi', 'Property Taxes': 'property_taxes',
  'Supplemental Insurance': 'supplemental_insurance', 'HOA': 'hoa', 'HOA Dues': 'hoa',
  'Lender': 'lender', 'Co-Borrower Role': 'co_borrower_role',
  'Property County': 'property_county', 'Channel': 'channel',
  'Comp Type': 'comp_type',
  'Link Application': 'link_application', 'Link Documents': 'link_documents',
  'Link Lender Portal': 'link_lender_portal', 'Link Appraisal Portal': 'link_appraisal_portal',
  'Link Other 1 Name': 'link_other_1_name', 'Link Other 1 URL': 'link_other_1_url',
  'Link Other 2 Name': 'link_other_2_name', 'Link Other 2 URL': 'link_other_2_url',
  'Link Other 3 Name': 'link_other_3_name', 'Link Other 3 URL': 'link_other_3_url',
  'Borrower Income': 'borrower_income', 'Co-Borrower Income': 'co_borrower_income',
  'Income Notes': 'income_notes',
  'Borrower Employment Type': 'borrower_employment_type',
  'Borrower SE Doc Type': 'borrower_se_doc_type',
  'Borrower Bank Statement': 'borrower_bank_statement',
  'Borrower BS Months': 'borrower_bs_months',
  'Borrower Expense Factor': 'borrower_expense_factor',
  'Co-Borrower Employment Type': 'co_borrower_employment_type',
  'Co-Borrower SE Doc Type': 'co_borrower_se_doc_type',
  'Co-Borrower Bank Statement': 'co_borrower_bank_statement',
  'Co-Borrower BS Months': 'co_borrower_bs_months',
  'Co-Borrower Expense Factor': 'co_borrower_expense_factor',
  'Borrower Income Details': 'borrower_income_details',
  'Co-Borrower Income Details': 'co_borrower_income_details',
  'Borrower DOB': 'borrower_dob', 'Borrower SSN Last 4': 'borrower_ssn_last_4',
  'Co-Borrower DOB': 'co_borrower_dob', 'Co-Borrower SSN Last 4': 'co_borrower_ssn_last_4',
  'Deal Notes': 'deal_notes', 'Pricing Notes': 'pricing_notes',
  'Points': 'points', 'YSP': 'ysp', 'Payroll Notes': 'payroll_notes',
  'Down Payment': 'down_payment', 'Closing Costs': 'closing_costs',
  'Months of Reserves': 'months_of_reserves',
  'Estimated Monthly Payment': 'estimated_monthly_payment',
  'Other Reserves Months': 'other_reserves_months',
  'Other Reserves Monthly Amount': 'other_reserves_monthly_amount',
  'Other Reserves Total': 'other_reserves_total',
  'Lien Position': 'lien_position',
  'Existing 1st Mortgage Balance': 'existing_1st_mortgage_balance',
  'Existing 2nd Mortgage Balance': 'existing_2nd_mortgage_balance',
  'Max CLTV': 'max_cltv',
  'Checklist JSON': 'checklist_json',
  'Documents JSON': 'documents_json',
  'Asset Accounts': 'asset_accounts',
  'Liabilities JSON': 'liabilities_json',
  'Liabilities Notes': 'liabilities_notes',
  'Loan Details Notes': 'loan_details_notes',
  'Purchase Agreement JSON': 'purchase_agreement_json',
};

// Reverse mapping: Supabase column name → Airtable field name
const COLUMN_TO_FIELD = {};
for (const [field, col] of Object.entries(FIELD_TO_COLUMN)) {
  // For duplicate mappings (e.g. HOA Dues -> hoa), keep the first one
  if (!COLUMN_TO_FIELD[col]) COLUMN_TO_FIELD[col] = field;
}

// JSON blob columns that need parse/stringify when going to/from Supabase
const JSON_COLUMNS = new Set(['checklist_json', 'documents_json', 'asset_accounts', 'liabilities_json', 'purchase_agreement_json']);

// Columns that store JSON strings in Airtable but are jsonb in Supabase
// Client sends them as strings; we parse to objects for Supabase storage
// and stringify back when returning to client
const JSON_STRING_FIELDS = new Set(['Checklist JSON', 'Documents JSON', 'Asset Accounts', 'Liabilities JSON', 'Purchase Agreement JSON',
  'Borrower Income Details', 'Co-Borrower Income Details']);

/**
 * Convert Airtable-format fields object to Supabase row object
 */
function fieldsToRow(fields) {
  const row = {};
  for (const [atField, value] of Object.entries(fields)) {
    const col = FIELD_TO_COLUMN[atField];
    if (!col) continue; // skip unknown fields
    if (JSON_STRING_FIELDS.has(atField) && typeof value === 'string') {
      // Client sends JSON blobs as strings; parse for Supabase jsonb storage
      try { row[col] = JSON.parse(value); } catch { row[col] = value; }
    } else {
      row[col] = value;
    }
  }
  return row;
}

/**
 * Convert Supabase row to Airtable-format {id, fields} object
 */
function rowToRecord(row) {
  const fields = {};
  for (const [col, value] of Object.entries(row)) {
    if (col === 'id' || col === 'airtable_id' || col === 'created_at' || col === 'updated_at') continue;
    const atField = COLUMN_TO_FIELD[col];
    if (!atField) continue;
    if (value === null) continue;
    // JSON blob columns: stringify back for client compatibility
    if (JSON_COLUMNS.has(col) && typeof value === 'object') {
      fields[atField] = JSON.stringify(value);
    } else {
      fields[atField] = value;
    }
  }
  return { id: row.id, fields };
}

/**
 * Make an authenticated request to the Supabase REST API (bypasses RLS with service_role key)
 */
async function supabaseRequest(table, env, method = 'GET', options = {}) {
  const { filters, body, select, single } = options;
  let url = `${env.SUPABASE_URL}/rest/v1/${table}`;
  const params = [];
  if (filters) params.push(filters);
  if (select) params.push(`select=${select}`);
  if (params.length) url += '?' + params.join('&');

  const headers = {
    'apikey': env.SUPABASE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };
  if (method === 'POST') headers['Prefer'] = 'return=representation';
  if (method === 'PATCH') headers['Prefer'] = 'return=representation';
  if (method === 'DELETE') headers['Prefer'] = 'return=representation';
  if (single) headers['Accept'] = 'application/vnd.pgrst.object+json';

  const fetchOptions = { method, headers };
  if (body) fetchOptions.body = JSON.stringify(body);

  const response = await fetch(url, fetchOptions);
  if (method === 'DELETE' && response.status === 204) return { success: true };
  const data = await response.json();
  if (!response.ok) {
    console.error('Supabase error:', JSON.stringify(data));
    throw new Error(data.message || data.error || 'Supabase request failed');
  }
  return data;
}

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

// ============================
// Plan Limits Configuration
// ============================
// UPDATED: February 2, 2026 - Aligned with pricing page
const PLAN_LIMITS = {
  LITE: {
    pipelineLoans: 0,
    calculatorSaves: 0,
    canAccessAdvancedCalcs: false,
    canClickLoanSearchDetails: false,
    canClickDirectoryLinks: true,
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

// ============================================================
// PIPELINE LOANS CACHING (per-user, in-memory)
// Structure: { [userEmail]: { data: [...], timestamp: Date.now() } }
// ============================================================
const pipelineLoansCache = new Map();
const PIPELINE_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

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

// ============================
// HELPER FUNCTIONS
// ============================

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

/**
 * Sanitize an email before using it in an Airtable filterByFormula (HIGH-2).
 * Strips chars that could break or inject into formula strings.
 * Returns null if the result doesn't look like a valid email.
 */
function sanitizeEmailForFormula(email) {
  if (!email || typeof email !== 'string') return null;
  const safe = email.replace(/['"(){}[\],\\]/g, '').trim().toLowerCase();
  return (safe.includes('@') && safe.length > 3) ? safe : null;
}

/**
 * Return a JSON response with CORS headers
 */
function jsonResponse(data, status = 200, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request) }
  });
}

// ============================================================
// PIPELINE LOANS ENDPOINTS — SUPABASE (v8.0)
// ============================================================

/**
 * GET /api/pipeline/loans
 * Fetches lender names from Supabase for the searchable dropdown.
 * Public endpoint — no auth required. Cached in-memory for 30 minutes.
 */
let lenderListCache = null;
let lenderListCacheTime = 0;
const LENDER_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

async function getLenderList(env, request) {
  const now = Date.now();
  if (lenderListCache && (now - lenderListCacheTime) < LENDER_CACHE_TTL) {
    return new Response(JSON.stringify(lenderListCache), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=1800', ...getCorsHeaders(request) }
    });
  }
  try {
    const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/lenders?select=name,website_url,tpo_portal_url,correspondent_portal_url,turn_times_url&order=name.asc`, {
      headers: { 'apikey': env.SUPABASE_KEY, 'Authorization': `Bearer ${env.SUPABASE_KEY}` }
    });
    const rows = await resp.json();
    /* Return array of lender objects with name + URLs */
    const lenders = rows.map(r => {
      const obj = { name: r.name };
      if (r.website_url) obj.website_url = r.website_url;
      if (r.tpo_portal_url) obj.tpo_portal_url = r.tpo_portal_url;
      if (r.correspondent_portal_url) obj.correspondent_portal_url = r.correspondent_portal_url;
      if (r.turn_times_url) obj.turn_times_url = r.turn_times_url;
      return obj;
    });
    lenderListCache = lenders;
    lenderListCacheTime = now;
    return new Response(JSON.stringify(lenders), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=1800', ...getCorsHeaders(request) }
    });
  } catch (err) {
    return jsonResponse({ error: 'Failed to fetch lenders', detail: err.message }, 500, request);
  }
}

/**
 * Fetches all loans for a user from Supabase with 10-minute caching.
 * Returns Airtable-format records: [{id, fields: {...}}, ...]
 */
async function getLoans(userEmail, env, request) {
  const url = new URL(request.url);
  const bypassCache = url.searchParams.get('refresh') === 'true';

  if (!bypassCache) {
    const cachedData = getCachedPipelineLoans(userEmail);
    if (cachedData) {
      console.log(`Pipeline cache HIT for user: ${userEmail}`);
      return jsonResponse(cachedData, 200, request);
    }
  }

  console.log(`Pipeline cache MISS for user: ${userEmail} - fetching from Supabase`);

  const rows = await supabaseRequest('pipeline_loans', env, 'GET', {
    filters: `user_email=eq.${encodeURIComponent(userEmail)}`,
  });

  // Convert Supabase rows to Airtable-format records for client compatibility
  const records = (rows || []).map(rowToRecord);

  setCachedPipelineLoans(userEmail, records);
  return jsonResponse(records, 200, request);
}

/**
 * POST /api/pipeline/loans
 * Creates a new loan in Supabase
 */
async function createLoan(userEmail, fields, env, request) {
  fields['User Email'] = userEmail;
  const row = fieldsToRow(fields);
  row.user_email = userEmail; // ensure it's set

  const result = await supabaseRequest('pipeline_loans', env, 'POST', { body: row });
  const record = rowToRecord(Array.isArray(result) ? result[0] : result);

  clearPipelineCacheForUser(userEmail);
  return jsonResponse(record, 201, request);
}

/**
 * PUT /api/pipeline/loans/:id
 * Updates a loan in Supabase (verifies ownership)
 */
async function updateLoan(userEmail, recordId, fields, env, request) {
  // Verify ownership: fetch the loan and check user_email
  const existing = await supabaseRequest('pipeline_loans', env, 'GET', {
    filters: `id=eq.${recordId}`,
    select: 'id,user_email',
  });
  if (!existing || existing.length === 0 || existing[0].user_email !== userEmail) {
    return jsonResponse({ error: 'Unauthorized' }, 403, request);
  }

  const row = fieldsToRow(fields);
  const result = await supabaseRequest('pipeline_loans', env, 'PATCH', {
    filters: `id=eq.${recordId}`,
    body: row,
  });
  const record = rowToRecord(Array.isArray(result) ? result[0] : result);

  clearPipelineCacheForUser(userEmail);
  return jsonResponse(record, 200, request);
}

/**
 * DELETE /api/pipeline/loans/:id
 * Deletes a loan from Supabase (verifies ownership)
 */
async function deleteLoan(userEmail, recordId, env, request) {
  // Verify ownership
  const existing = await supabaseRequest('pipeline_loans', env, 'GET', {
    filters: `id=eq.${recordId}`,
    select: 'id,user_email',
  });
  if (!existing || existing.length === 0 || existing[0].user_email !== userEmail) {
    return jsonResponse({ error: 'Unauthorized' }, 403, request);
  }

  await supabaseRequest('pipeline_loans', env, 'DELETE', {
    filters: `id=eq.${recordId}`,
  });

  clearPipelineCacheForUser(userEmail);
  return jsonResponse({ success: true }, 200, request);
}

/**
 * GET /api/pipeline/loans/clear-cache
 */
async function clearPipelineCache(userEmail, request) {
  clearPipelineCacheForUser(userEmail);
  return jsonResponse({
    success: true,
    message: 'Pipeline cache cleared for your account'
  }, 200, request);
}

// ============================================================
// PIPELINE TASKS ENDPOINTS — SUPABASE (v8.0)
// ============================================================

/**
 * GET /api/pipeline/tasks
 * Fetches tasks from Supabase. Optional ?loanId=... to filter by loan.
 * Returns Airtable-format records for client compatibility.
 */
async function getTasks(userEmail, loanId, env, request) {
  let filters = `user_email=eq.${encodeURIComponent(userEmail)}`;
  if (loanId) {
    filters += `&loan_id=eq.${loanId}`;
  }

  const rows = await supabaseRequest('pipeline_tasks', env, 'GET', { filters });

  // Convert to Airtable-format: {id, fields: {Task Name, Due Date, Completed, Assigned To, Loan: [loanId]}}
  const records = (rows || []).map(row => ({
    id: row.id,
    fields: {
      'Task Name': row.task_name,
      'Due Date': row.due_date,
      'Completed': row.completed || false,
      'Assigned To': row.assigned_to || row.user_email,
      // Airtable returned Loan as an array of record IDs; Supabase stores single UUID
      'Loan': row.loan_id ? [row.loan_id] : [],
    }
  }));

  return jsonResponse(records, 200, request);
}

/**
 * POST /api/pipeline/tasks
 * Creates a new task in Supabase
 */
async function createTask(userEmail, fields, env, request) {
  const row = {
    task_name: fields['Task Name'],
    due_date: fields['Due Date'] || null,
    completed: fields['Completed'] || false,
    assigned_to: fields['Assigned To'] || userEmail,
    user_email: userEmail,
    // Airtable sends Loan as array [recXXX]; Supabase stores single UUID
    loan_id: Array.isArray(fields['Loan']) ? fields['Loan'][0] : (fields['Loan'] || null),
  };

  const result = await supabaseRequest('pipeline_tasks', env, 'POST', { body: row });
  const created = Array.isArray(result) ? result[0] : result;

  return jsonResponse({
    id: created.id,
    fields: {
      'Task Name': created.task_name,
      'Due Date': created.due_date,
      'Completed': created.completed || false,
      'Assigned To': created.assigned_to,
      'Loan': created.loan_id ? [created.loan_id] : [],
    }
  }, 201, request);
}

/**
 * PUT /api/pipeline/tasks/:id
 * Updates a task in Supabase (verifies ownership)
 */
async function updateTask(userEmail, recordId, fields, env, request) {
  // Ownership check
  const existing = await supabaseRequest('pipeline_tasks', env, 'GET', {
    filters: `id=eq.${recordId}`,
    select: 'id,user_email',
  });
  if (!existing || existing.length === 0 || existing[0].user_email !== userEmail) {
    return jsonResponse({ error: 'Unauthorized' }, 403, request);
  }

  const row = {};
  if (fields['Task Name'] !== undefined) row.task_name = fields['Task Name'];
  if (fields['Due Date'] !== undefined) row.due_date = fields['Due Date'] || null;
  if (fields['Completed'] !== undefined) row.completed = fields['Completed'];
  if (fields['Assigned To'] !== undefined) row.assigned_to = fields['Assigned To'];
  if (fields['Loan'] !== undefined) {
    row.loan_id = Array.isArray(fields['Loan']) ? fields['Loan'][0] : (fields['Loan'] || null);
  }

  const result = await supabaseRequest('pipeline_tasks', env, 'PATCH', {
    filters: `id=eq.${recordId}`,
    body: row,
  });
  const updated = Array.isArray(result) ? result[0] : result;

  return jsonResponse({
    id: updated.id,
    fields: {
      'Task Name': updated.task_name,
      'Due Date': updated.due_date,
      'Completed': updated.completed || false,
      'Assigned To': updated.assigned_to,
      'Loan': updated.loan_id ? [updated.loan_id] : [],
    }
  }, 200, request);
}

/**
 * DELETE /api/pipeline/tasks/:id
 * Deletes a task from Supabase (verifies ownership)
 */
async function deleteTask(userEmail, recordId, env, request) {
  // Ownership check
  const existing = await supabaseRequest('pipeline_tasks', env, 'GET', {
    filters: `id=eq.${recordId}`,
    select: 'id,user_email',
  });
  if (!existing || existing.length === 0 || existing[0].user_email !== userEmail) {
    return jsonResponse({ error: 'Unauthorized' }, 403, request);
  }

  await supabaseRequest('pipeline_tasks', env, 'DELETE', {
    filters: `id=eq.${recordId}`,
  });
  return jsonResponse({ success: true }, 200, request);
}

// ============================================================
// USAGE TRACKING ENDPOINTS — SUPABASE (v8.1)
// ============================================================

/**
 * GET /api/usage
 * Gets usage stats for the authenticated user from Supabase.
 * If no usage record exists, creates one with LITE defaults.
 */
async function getUsage(userEmail, env, request) {
  const rows = await supabaseRequest('user_usage', env, 'GET', {
    filters: `user_email=eq.${encodeURIComponent(userEmail)}`,
  });

  // If no usage record exists, create one
  if (!rows || rows.length === 0) {
    const created = await supabaseRequest('user_usage', env, 'POST', {
      body: {
        user_email: userEmail,
        current_plan: 'LITE',
        pipeline_loan_count: 0,
        calculator_saves_count: {},
        account_created: new Date().toISOString(),
      },
    });
    const row = Array.isArray(created) ? created[0] : created;
    return jsonResponse({
      usage: {
        currentPlan: 'LITE',
        pipelineLoanCount: 0,
        calculatorSavesCount: {},
        accountCreated: row.account_created,
      }
    }, 200, request);
  }

  const row = rows[0];
  return jsonResponse({
    usage: {
      currentPlan: row.current_plan || 'LITE',
      pipelineLoanCount: row.pipeline_loan_count || 0,
      calculatorSavesCount: row.calculator_saves_count || {},
      accountCreated: row.account_created,
    }
  }, 200, request);
}

/**
 * PUT /api/usage
 * Updates usage stats (plan, loan count, calculator saves count) in Supabase.
 * Creates a new record if one doesn't exist yet.
 */
async function updateUsage(userEmail, env, request) {
  const rows = await supabaseRequest('user_usage', env, 'GET', {
    filters: `user_email=eq.${encodeURIComponent(userEmail)}`,
  });

  const body = await request.json();

  // If no usage record exists, create one
  if (!rows || rows.length === 0) {
    const created = await supabaseRequest('user_usage', env, 'POST', {
      body: {
        user_email: userEmail,
        current_plan: body.currentPlan || 'LITE',
        pipeline_loan_count: body.pipelineLoanCount || 0,
        calculator_saves_count: body.calculatorSavesCount || {},
        account_created: new Date().toISOString(),
      },
    });
    const row = Array.isArray(created) ? created[0] : created;
    return jsonResponse({
      usage: {
        currentPlan: row.current_plan,
        pipelineLoanCount: row.pipeline_loan_count,
        calculatorSavesCount: row.calculator_saves_count || {},
        accountCreated: row.account_created,
      }
    }, 200, request);
  }

  // Update existing record
  const updateRow = {};
  if (body.currentPlan) updateRow.current_plan = body.currentPlan;
  if (body.pipelineLoanCount !== undefined) updateRow.pipeline_loan_count = body.pipelineLoanCount;
  if (body.calculatorSavesCount) updateRow.calculator_saves_count = body.calculatorSavesCount;

  const result = await supabaseRequest('user_usage', env, 'PATCH', {
    filters: `user_email=eq.${encodeURIComponent(userEmail)}`,
    body: updateRow,
  });
  const row = Array.isArray(result) ? result[0] : result;

  return jsonResponse({
    usage: {
      currentPlan: row.current_plan,
      pipelineLoanCount: row.pipeline_loan_count,
      calculatorSavesCount: row.calculator_saves_count || {},
      accountCreated: row.account_created,
    }
  }, 200, request);
}

// ============================================================
// PLAN LIMITS ENDPOINT
// ============================================================

/**
 * GET /api/plan-limits
 * Checks plan limits for the authenticated user.
 * Optional ?action= param to check a specific action:
 *   - add-pipeline-loan
 *   - save-calculator-scenario (&calculatorType=...)
 *   - add-favorite
 *   - access-advanced-calculator
 *   - export-pipeline
 *   - print-calculator-pdf
 */
async function checkPlanLimits(userEmail, env, request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  // Get current usage to determine plan
  const usageResponse = await getUsage(userEmail, env, request);
  const usageData = await usageResponse.json();
  const currentPlan = usageData.usage?.currentPlan || 'LITE';

  const limits = PLAN_LIMITS[currentPlan];

  if (!limits) {
    return jsonResponse({ error: 'Invalid plan' }, 400, request);
  }

  // If no specific action requested, return full limits + usage
  if (!action) {
    return jsonResponse({
      plan: currentPlan,
      limits: limits,
      usage: {
        pipelineLoans: usageData.usage.pipelineLoanCount,
        calculatorSaves: usageData.usage.calculatorSavesCount
      }
    }, 200, request);
  }

  // Check specific action
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
// PIPELINE APP — MAIN JS MODULE (served externally to bypass Webflow 50K limit)
// ============================================================

/**
 * GET /static/pipeline-app.js
 * Serves the main Pipeline page JavaScript.
 * Previously embedded directly in Webflow page embed (was at 49,982/50,000 char limit).
 * Now served externally via this worker to allow unlimited JS size.
 * Cache-busted via ?v= query param when deploying updates.
 */
async function getPipelineAppJS(request) {
  const jsContent = `const API_BASE = 'https://mtg-broker-pipeline.rich-e00.workers.dev';
const STAGES = [
  '01 - Lead','02 - Application','03 - Prequal | AUS',
  '04 - (Purchase) Shopping','04 - (Purchase) Under Contract','04 - (Refi) Quotes',
  '05 - Disclosure','06 - Processing','07 - Underwriting',
  '08 - Conditional Approval','09 - Resubmittal','10 - CTC',
  '11 - Closing | Funding','12 - Closed'
];
const PIPELINE_CACHE_TTL = 5 * 60 * 1000;
function getPipelineCacheKey() { return userEmail ? \`pipeline_loans_\${userEmail}\` : null; }
function getCachedPipelineData() {
  const k = getPipelineCacheKey(); if (!k) return null;
  try {
    const c = sessionStorage.getItem(k); if (!c) return null;
    const { data, timestamp } = JSON.parse(c);
    if (Date.now() - timestamp > PIPELINE_CACHE_TTL) { sessionStorage.removeItem(k); return null; }
    return data;
  } catch (e) { return null; }
}
function setCachedPipelineData(data) {
  const k = getPipelineCacheKey(); if (!k) return;
  try { sessionStorage.setItem(k, JSON.stringify({ data, timestamp: Date.now() })); } catch (e) {}
}
function clearPipelineCache() { const k = getPipelineCacheKey(); if (k) sessionStorage.removeItem(k); }
const LOAN_TYPES = ['Conventional','FHA','VA','USDA','DSCR','Non-QM','HELOC','Other'];
const COLUMN_CONFIG = [
  { id:'borrower', label:'Borrower', field:'Borrower Name', sortField:'Borrower Name', defaultVisible:true, format:'bold' },
  { id:'property', label:'Property', field:'Property Street', sortField:'Property Street', defaultVisible:true, format:'text' },
  { id:'city', label:'City', field:'Property City', sortField:'Property City', defaultVisible:false, format:'text' },
  { id:'state', label:'State', field:'Property State', sortField:'Property State', defaultVisible:false, format:'text' },
  { id:'zip', label:'Zip', field:'Property Zip', sortField:'Property Zip', defaultVisible:false, format:'text' },
  { id:'loan-amount', label:'Base Loan Amount', field:'Loan Amount', sortField:'Loan Amount', defaultVisible:true, format:'currency' },
  { id:'type', label:'Loan Type', field:'Loan Type', sortField:'Loan Type', defaultVisible:true, format:'text' },
  { id:'other-loan-type', label:'Other Loan Type', field:'Other Loan Type', sortField:'Other Loan Type', defaultVisible:false, format:'text' },
  { id:'stage', label:'Stage', field:'Stage', sortField:'Stage', defaultVisible:true, format:'stage' },
  { id:'close-date', label:'Expected Close', field:'Expected Close', sortField:'Expected Close', defaultVisible:true, format:'date' },
  { id:'last-contact', label:'Last Contact', field:'Last Contact Date', sortField:'Last Contact Date', defaultVisible:false, format:'date' },
  { id:'lock-status', label:'Lock Status', field:'Lock Status', sortField:'Lock Status', defaultVisible:false, format:'lock' },
  { id:'credit-score', label:'Credit Score', field:'Credit Score', sortField:'Credit Score', defaultVisible:false, format:'text' },
  { id:'credit-date', label:'Credit Date', field:'Date Credit Pulled', sortField:'Date Credit Pulled', defaultVisible:false, format:'date' },
  { id:'credit-pull-type', label:'Credit Pull Type', field:'Credit Pull Type', sortField:'Credit Pull Type', defaultVisible:false, format:'text' },
  { id:'ltv', label:'LTV', field:'LTV', sortField:'LTV', defaultVisible:false, format:'percent' },
  { id:'loan-interest-rate', label:'Loan Interest Rate', field:'Interest Rate', sortField:'Interest Rate', defaultVisible:false, format:'rate' },
  { id:'qualifying-rate', label:'Qualifying Rate', field:'Qualifying Interest Rate', sortField:'Qualifying Interest Rate', defaultVisible:false, format:'rate' },
  { id:'comp-bps', label:'Compensation (BPS)', field:'Comp BPS', sortField:'Comp BPS', defaultVisible:false, format:'bps' },
  { id:'comp-amount', label:'Compensation ($)', field:'Compensation Amount', sortField:'Compensation Amount', defaultVisible:false, format:'comp' },
  { id:'lead-source', label:'Lead Source', field:'Lead Source', sortField:'Lead Source', defaultVisible:false, format:'text' },
  { id:'lost-reason', label:'Lost Reason', field:'Lost Reason', sortField:'Lost Reason', defaultVisible:false, format:'text' },
  { id:'pay-status', label:'Pay Status', field:'Pay Status', sortField:'Pay Status', defaultVisible:false, format:'pay' },
  { id:'purpose', label:'Purpose', field:'Loan Purpose', sortField:'Loan Purpose', defaultVisible:false, format:'text' },
  { id:'occupancy', label:'Occupancy', field:'Occupancy', sortField:'Occupancy', defaultVisible:false, format:'text' }
];
var loans = [], tasks = [], currentView = 'table', currentLoanId = null, userEmail = null;
var isUpdatingLTV = false, isUpdatingComp = false, lastCompFieldEdited = null;
var sortColumn = 'Stage', sortDirection = 'asc';
var currentStatusFilter = 'Active';
function debounce(func, wait) {
  let timeout;
  return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func(...args), wait); };
}
/* Escape HTML for safe rendering (used by formatCellValue, buildBoardCard, etc.) */
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
/* -- Name helpers: combine First/Middle/Last into one string, and split back -- */
function combineName(first, middle, last) {
  return [first, middle, last].map(s => (s || '').trim()).filter(Boolean).join(' ');
}
function splitName(fullName) {
  if (!fullName) return { first: '', middle: '', last: '' };
  const parts = fullName.trim().split(/\\s+/);
  if (parts.length === 1) return { first: parts[0], middle: '', last: '' };
  if (parts.length === 2) return { first: parts[0], middle: '', last: parts[1] };
  return { first: parts[0], middle: parts.slice(1, -1).join(' '), last: parts[parts.length - 1] };
}
function getEmailFromLocalStorage() {
  try {
    const t = localStorage.getItem('Outseta.nocode.accessToken');
    if (t) { const p = JSON.parse(atob(t.split('.')[1])); if (p.email) return p.email; }
  } catch (e) {} return null;
}
// CRIT-1: Returns the raw JWT string (not just the email) so it can be sent to the
// server for signature verification. The server must verify the JWT — never trust plain email.
function getAccessToken() {
  try {
    return localStorage.getItem('Outseta.nocode.accessToken') || null;
  } catch (e) { return null; }
}
async function getEmailFromOutseta() {
  if (typeof window.getCachedOutsetaUser === 'function') {
    try { const u = await window.getCachedOutsetaUser(); if (u?.Email) return u.Email; } catch (e) {}
  }
  if (typeof Outseta !== 'undefined' && Outseta.getUser) {
    try { const u = await Outseta.getUser(); if (u?.Email) return u.Email; } catch (e) {}
  }
  return null;
}
async function getUserEmail() { return getEmailFromLocalStorage() || await getEmailFromOutseta(); }
function getColumnPrefsKey() { return userEmail ? \`pipeline-columns-\${userEmail}\` : 'pipeline-columns-default'; }
function getColumnOrderKey() { return userEmail ? \`pipeline-col-order-\${userEmail}\` : 'pipeline-col-order-default'; }
function saveColumnPreferences() {
  const prefs = {};
  COLUMN_CONFIG.forEach(col => {
    const cb = document.getElementById(\`col-\${col.id}\`);
    if (cb) prefs[col.id] = cb.checked;
  });
  try { localStorage.setItem(getColumnPrefsKey(), JSON.stringify(prefs)); } catch (e) {}
}
function loadColumnPreferences() {
  try {
    const s = localStorage.getItem(getColumnPrefsKey());
    if (s) {
      const p = JSON.parse(s);
      COLUMN_CONFIG.forEach(col => {
        const cb = document.getElementById(\`col-\${col.id}\`);
        if (cb && p.hasOwnProperty(col.id)) cb.checked = p[col.id];
      });
      return true;
    }
  } catch (e) {} return false;
}
function saveColumnOrder() {
  const list = document.getElementById('column-options-list');
  if (!list) return;
  const order = Array.from(list.children).map(el => el.dataset.colId);
  try { localStorage.setItem(getColumnOrderKey(), JSON.stringify(order)); } catch (e) {}
}
function getColumnOrder() {
  try {
    const s = localStorage.getItem(getColumnOrderKey());
    if (s) {
      const order = JSON.parse(s);
      const currentIds = COLUMN_CONFIG.map(c => c.id);
      const validOrder = order.filter(id => currentIds.includes(id));
      currentIds.forEach(id => {
        if (!validOrder.includes(id)) validOrder.push(id);
      });
      return validOrder;
    }
  } catch (e) {}
  return COLUMN_CONFIG.map(c => c.id);
}
function getOrderedColumns() {
  const order = getColumnOrder();
  return order.map(id => COLUMN_CONFIG.find(c => c.id === id)).filter(Boolean);
}
function buildColumnSelector() {
  const list = document.getElementById('column-options-list');
  if (!list) return;
  list.innerHTML = '';
  const orderedCols = getOrderedColumns();
  orderedCols.forEach(col => {
    const div = document.createElement('div');
    div.className = 'column-option';
    div.draggable = true;
    div.dataset.colId = col.id;
    div.innerHTML = \`<span class="col-drag-handle" title="Drag to reorder">&#9776;</span><input type="checkbox" id="col-\${col.id}" \${col.defaultVisible ? 'checked' : ''} onchange="updateVisibleTableColumns()"><label for="col-\${col.id}">\${col.label}</label>\`;
    list.appendChild(div);
  });

  setupColumnDragDrop();
}
function setupColumnDragDrop() {
  const list = document.getElementById('column-options-list');
  if (!list) return;
  let dragSrcEl = null;
  list.querySelectorAll('.column-option').forEach(item => {
    item.addEventListener('dragstart', function(e) {
      dragSrcEl = this;
      this.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', this.dataset.colId);
    });
    item.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      list.querySelectorAll('.column-option').forEach(el => el.classList.remove('drag-over'));
      this.classList.add('drag-over');
    });
    item.addEventListener('dragleave', function() {
      this.classList.remove('drag-over');
    });
    item.addEventListener('drop', function(e) {
      e.preventDefault();
      e.stopPropagation();
      this.classList.remove('drag-over');
      if (dragSrcEl !== this) {

        const allItems = Array.from(list.children);
        const srcIdx = allItems.indexOf(dragSrcEl);
        const tgtIdx = allItems.indexOf(this);
        if (srcIdx < tgtIdx) {
          list.insertBefore(dragSrcEl, this.nextSibling);
        } else {
          list.insertBefore(dragSrcEl, this);
        }

        saveColumnOrder();
        renderTableHeaders();
        filterTable();
      }
    });
    item.addEventListener('dragend', function() {
      this.classList.remove('dragging');
      list.querySelectorAll('.column-option').forEach(el => el.classList.remove('drag-over'));
    });
  });
}
function renderTableHeaders() {
  const headerRow = document.getElementById('table-header-row');
  if (!headerRow) return;
  const orderedCols = getOrderedColumns();
  headerRow.innerHTML = orderedCols.map(col => {
    const cb = document.getElementById(\`col-\${col.id}\`);
    const visible = cb ? cb.checked : col.defaultVisible;
    return \`<th class="col-\${col.id}" data-column="\${col.sortField}" onclick="sortTable('\${col.sortField}')" style="\${visible ? '' : 'display:none;'}cursor:pointer;">\${col.label} &#8597;</th>\`;
  }).join('');
}
function formatCellValue(loan, col) {
  const val = col.field === 'Compensation Amount' ? getCompAmount(loan) : loan[col.field];
  switch (col.format) {
    case 'bold':
      return \`<strong>\${escapeHtml(String(val || '-'))}</strong>\`;
    case 'currency':
      return val ? fmtCW(val) : '-';
    case 'date':
      return val ? new Date(val + 'T00:00:00').toLocaleDateString() : '-';
    case 'stage':
      return \`<span class="stage-badge \${getStageClass(val)}">\${escapeHtml(String(val || '-'))}</span>\`;
    case 'lock':
      const ls = val || '-';
      return \`<span class="lock-badge \${getLockBadgeClass(ls)}">\${escapeHtml(String(ls))}</span>\`;
    case 'pay':
      const ps = val || '-';
      return \`<span class="pay-badge \${getPayBadgeClass(ps)}">\${escapeHtml(String(ps))}</span>\`;
    case 'percent':
      return val ? (val * 100).toFixed(1) + '%' : '-';
    case 'rate':
      return val ? (val * 100).toFixed(3) + '%' : '-';
    case 'bps':
      return val ? val.toFixed(0) : '-';
    case 'comp':
      return val > 0 ? fmtCW(val) : '-';
    default:
      return escapeHtml(String(val || '-'));
  }
}
function buildTableRow(loan, orderedCols) {
  const cells = orderedCols.map(col => {
    const cb = document.getElementById(\`col-\${col.id}\`);
    const visible = cb ? cb.checked : col.defaultVisible;
    return \`<td class="col-\${col.id}" style="\${visible ? '' : 'display:none'}">\${formatCellValue(loan, col)}</td>\`;
  }).join('');
  return \`<tr onclick="openLoanModal('\${loan.id}')">\${cells}</tr>\`;
}
function buildSummaryRow(filtered, orderedCols) {

  const loansWithAmount = filtered.filter(l => l['Loan Amount'] > 0);
  const totalLoanAmt = loansWithAmount.reduce((s, l) => s + l['Loan Amount'], 0);
  const avgLoanAmt = loansWithAmount.length > 0 ? totalLoanAmt / loansWithAmount.length : 0;

  const lwc = filtered.filter(l => getCompAmount(l) > 0);
  const tca = lwc.reduce((s, l) => s + getCompAmount(l), 0);
  const lwb = filtered.filter(l => l['Comp BPS']);
  const acb = lwb.length > 0 ? lwb.reduce((s, l) => s + l['Comp BPS'], 0) / lwb.length : 0;
  const cells = orderedCols.map(col => {
    const cb = document.getElementById(\`col-\${col.id}\`);
    const visible = cb ? cb.checked : col.defaultVisible;
    let content = '';
    if (col.id === 'borrower') {
      content = \`<strong>Summary (\${filtered.length} loans)</strong>\`;
    } else if (col.id === 'loan-amount') {

      const avgStr = avgLoanAmt > 0 ? fmtCW(avgLoanAmt) : '-';
      const totalStr = totalLoanAmt > 0 ? fmtCW(totalLoanAmt) : '-';
      content = \`<strong>Avg: \${avgStr}<br>Total: \${totalStr}</strong>\`;
    } else if (col.id === 'comp-bps') {
      content = \`<strong>Avg: \${acb > 0 ? acb.toFixed(0) : '-'}</strong>\`;
    } else if (col.id === 'comp-amount') {
      content = \`<strong>Total: \${tca > 0 ? fmtCW(tca) : '-'}</strong>\`;
    }
    return \`<td class="col-\${col.id}" style="\${visible ? '' : 'display:none'}">\${content}</td>\`;
  }).join('');
  return \`<tr class="summary-row">\${cells}</tr>\`;
}
function populateLoanTypeDropdowns() {
  const tf = document.getElementById('type-filter'), ls = document.getElementById('loan-type');
  LOAN_TYPES.forEach(type => {
    const o1 = document.createElement('option'); o1.value = type; o1.textContent = type; tf.appendChild(o1);
    const o2 = document.createElement('option'); o2.value = type; o2.textContent = type; ls.appendChild(o2);
  });
}
function togglePurchasePriceField() {
  const p = document.getElementById('loan-purpose').value;
  document.getElementById('purchase-price-group').style.display = p.toLowerCase().includes('purchase') ? '' : 'none';
}
function toggleHelocSection() {
  const t = document.getElementById('loan-type').value;
  document.getElementById('heloc-section').classList.toggle('hidden', !t.toLowerCase().includes('heloc'));
}
function toggleOtherLoanTypeField() {
  const t = document.getElementById('loan-type').value;
  const r = document.getElementById('other-loan-type-row');
  if (t === 'Other') r.classList.remove('hidden');
  else { r.classList.add('hidden'); document.getElementById('other-loan-type').value = ''; }
}

/* v7.19: Toggle Equity Loan subordinate financing fields visibility */
function toggleEquityLoanFields() {
  var p = document.getElementById('loan-purpose').value;
  var show = (p === 'Equity Loan');
  document.getElementById('equity-loan-divider').classList.toggle('hidden', !show);
  document.getElementById('equity-loan-fields').classList.toggle('hidden', !show);
  document.getElementById('equity-loan-fields-2').classList.toggle('hidden', !show);
  document.getElementById('equity-loan-results').classList.toggle('hidden', !show);
  if (show) { toggleExisting2ndField(); calcEquityLoan(); }
}

/* v7.19: Show/hide Existing 2nd Mortgage field based on lien position */
function toggleExisting2ndField() {
  var pos = document.getElementById('lien-position').value;
  var grp = document.getElementById('existing-2nd-group');
  if (pos === '3rd') {
    grp.classList.remove('hidden');
  } else {
    grp.classList.add('hidden');
    document.getElementById('existing-2nd-balance').value = '';
  }
  calcEquityLoan();
}

/* v7.19: Auto-calculate equity loan / subordinate financing results */
function calcEquityLoan() {
  var resultsEl = document.getElementById('equity-loan-results');
  if (!resultsEl || resultsEl.classList.contains('hidden')) return;
  var propVal = parseCurrency(document.getElementById('property-value').value);
  var first = parseCurrency(document.getElementById('existing-1st-balance').value);
  var pos = document.getElementById('lien-position').value;
  var second = (pos === '3rd') ? parseCurrency(document.getElementById('existing-2nd-balance').value) : 0;
  var maxCltv = parseFloat(document.getElementById('max-cltv').value) || 0;
  var loanAmt = parseCurrency(document.getElementById('loan-amount').value);
  var fmt = function(v) { return v > 0 ? '$' + Math.round(v).toLocaleString() : '\u2014'; };
  /* Total existing liens */
  var totalLiens = first + second;
  document.getElementById('eq-total-liens').textContent = totalLiens > 0 ? fmt(totalLiens) : '\u2014';
  /* Max total debt = Property Value × Max CLTV% */
  var maxDebt = (propVal > 0 && maxCltv > 0) ? propVal * (maxCltv / 100) : 0;
  document.getElementById('eq-max-debt').textContent = maxDebt > 0 ? fmt(maxDebt) : '\u2014';
  /* Max new loan = Max total debt - total existing liens */
  var maxLoan = maxDebt - totalLiens;
  document.getElementById('eq-max-loan').textContent = maxDebt > 0 ? fmt(Math.max(maxLoan, 0)) : '\u2014';
  /* Actual CLTV = (total existing liens + loan amount) / property value */
  if (propVal > 0 && loanAmt > 0) {
    var actualCltv = ((totalLiens + loanAmt) / propVal) * 100;
    var cltvEl = document.getElementById('eq-actual-cltv');
    cltvEl.textContent = actualCltv.toFixed(2) + '%';
    /* Color code: green if within max, red if over */
    if (maxCltv > 0 && actualCltv > maxCltv) {
      cltvEl.style.color = '#DC2626';
    } else if (maxCltv > 0) {
      cltvEl.style.color = '#15803D';
    } else {
      cltvEl.style.color = '';
    }
  } else {
    document.getElementById('eq-actual-cltv').textContent = '\u2014';
    document.getElementById('eq-actual-cltv').style.color = '';
  }
}
/* v7.11: Show Points/YSP row when channel is NOT Broker */
function togglePointsYsp() {
  var ch = document.getElementById('comp-channel').value;
  var row = document.getElementById('points-ysp-row');
  if (!row) return;
  if (ch && ch !== 'Broker') row.classList.remove('hidden');
  else row.classList.add('hidden');
}
/* Init: If DOM already loaded (script loaded dynamically), run immediately; otherwise wait */
async function initPipeline() {
  console.log('Pipeline v12.0: Starting...');
  const startTime = performance.now();
  userEmail = getEmailFromLocalStorage();
  if (!userEmail) userEmail = await getEmailFromOutseta();
  if (!userEmail) {
    document.getElementById('pipeline-app').innerHTML = '<div class="empty-state"><div style="font-size:48px;">&#128274;</div><h3>Please log in</h3><p>You need to be logged in to view your pipeline.</p></div>';
    return;
  }
  const sf = document.getElementById('stage-filter');
  STAGES.forEach(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; sf.appendChild(o); });
  populateLoanTypeDropdowns();

  buildColumnSelector();
  loadColumnPreferences();

  renderTableHeaders();

  document.querySelectorAll('.currency-input').forEach(input => {
    input.addEventListener('blur', e => formatCurrency(e.target));
    input.addEventListener('focus', e => unformatCurrency(e.target));
  });
  /* v7.10: Income section CSS — totals + detail modal */
  var incomeStyle = document.createElement('style');
  incomeStyle.textContent = ''
    /* Main view: person blocks */
    + '.inc-hdr{font-size:11px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:0.05em;padding-bottom:5px;border-bottom:1px solid #E2E8F0;margin-bottom:8px;}'
    + '.inc-row{display:flex;align-items:center;gap:8px;margin-bottom:8px;}'
    + '.inc-lbl{font-size:13px;font-weight:500;color:#64748B;flex-shrink:0;width:46px;}'
    + '.inc-iw{display:flex;align-items:center;gap:4px;width:280px;flex-shrink:0;}'
    + '.inc-dlr{font-size:13px;color:#64748B;}'
    + '.inc-inp{width:100%;font-size:14px;padding:6px 10px;font-weight:500;box-sizing:border-box;}'
    + '.inc-tog{display:flex;flex-shrink:0;}'
    + '.inc-tbtn{padding:5px 10px;border:1px solid #E2E8F0;background:#F8FAFC;font-size:11px;font-weight:500;color:#64748B;cursor:pointer;transition:all 0.15s;}'
    + '.inc-tbtn:first-child{border-radius:5px 0 0 5px;}'
    + '.inc-tbtn:last-child{border-radius:0 5px 5px 0;}'
    + '.inc-tbtn.active{background:#2563EB;color:white;border-color:#2563EB;}'
    + '.inc-dbtn{padding:4px 10px;font-size:11px;font-weight:500;border-radius:5px;cursor:pointer;white-space:nowrap;border:1px solid #E2E8F0;background:#F8FAFC;color:#64748B;transition:all 0.15s;}'
    + '.inc-dbtn:hover{border-color:#93C5FD;background:#EFF6FF;color:#2563EB;}'
    + '.inc-dbtn .inc-cnt{font-size:10px;color:#94A3B8;margin-left:2px;}'
    + '.inc-div{height:1px;background:#E2E8F0;margin:10px 0;}'
    + '.inc-combined{display:flex;align-items:center;justify-content:space-between;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:8px 14px;margin-bottom:10px;}'
    + '.inc-comb-lbl{font-size:13px;font-weight:600;color:#166534;}'
    + '.inc-comb-val{font-size:16px;font-weight:800;color:#166534;font-variant-numeric:tabular-nums;}'
    + '.inc-notes-lbl{font-size:11px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;}'
    + '.inc-notes textarea.fc{min-height:48px;font-size:13px;}'
    /* Detail modal */
    + '.inc-modal-bg{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:200000;display:flex;align-items:flex-start;justify-content:center;padding:60px 20px 20px;}'
    + '.inc-modal{background:#fff;border-radius:12px;width:100%;max-width:1100px;max-height:calc(100vh - 80px);display:flex;flex-direction:column;}'
    + '.inc-modal-hdr{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-bottom:1px solid #E2E8F0;background:#F8FAFC;border-radius:12px 12px 0 0;flex-shrink:0;}'
    + '.inc-modal-title{font-size:15px;font-weight:700;color:#0F172A;}'
    + '.inc-modal-close{font-size:20px;cursor:pointer;color:#94A3B8;padding:0 4px;line-height:1;}'
    + '.inc-modal-close:hover{color:#DC2626;}'
    + '.inc-modal-body{padding:20px;overflow-y:auto;flex:1;}'
    + '.inc-modal table{width:100%;border-collapse:separate;border-spacing:0;font-size:13px;}'
    + '.inc-modal th{font-size:10px;text-transform:uppercase;letter-spacing:0.04em;color:#94A3B8;font-weight:500;padding:0 8px 8px;text-align:left;white-space:nowrap;}'
    + '.inc-modal td{padding:6px 8px;vertical-align:middle;border-top:1px solid #F1F5F9;}'
    + '.inc-modal tbody tr:first-child td{border-top:none;}'
    + '.inc-modal td select,.inc-modal td input[type=text],.inc-modal td input[type=number]{font-size:13px;padding:6px 8px;border:1px solid #E2E8F0;border-radius:5px;background:white;color:#0F172A;box-sizing:border-box;width:100%;}'
    + '.inc-modal .src-lbl{font-size:12px;font-weight:500;color:#64748B;white-space:nowrap;}'
    + '.inc-modal .src-na{font-size:12px;color:#CBD5E1;}'
    + '.inc-modal .src-del{font-size:15px;cursor:pointer;color:#94A3B8;text-align:center;line-height:1;}'
    + '.inc-modal .src-del:hover{color:#DC2626;}'
    + '.inc-modal .src-amt{display:flex;align-items:center;gap:3px;}'
    + '.inc-modal .src-amt span{font-size:13px;color:#64748B;flex-shrink:0;}'
    + '.inc-modal .src-amt input{min-width:0;}'
    + '.inc-modal .src-exp{display:flex;align-items:center;gap:2px;}'
    + '.inc-modal .src-exp input{min-width:0;text-align:right;}'
    + '.inc-modal .src-exp span{font-size:13px;color:#64748B;flex-shrink:0;}'
    + '.inc-modal-add{font-size:12px;color:#2563EB;cursor:pointer;font-weight:600;}'
    + '.inc-modal-add:hover{text-decoration:underline;}'
    + '.inc-modal-sum{font-size:12px;color:#64748B;}'
    + '.inc-modal-sum b{font-weight:600;color:#0F172A;}'
    + '.inc-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1px solid #E2E8F0;flex-shrink:0;}'
    + '.inc-modal-btn{padding:7px 18px;font-size:13px;font-weight:600;border-radius:6px;cursor:pointer;border:none;}'
    + '.inc-modal-cancel{background:#F8FAFC;color:#64748B;border:1px solid #E2E8F0;}'
    + '.inc-modal-cancel:hover{background:#F1F5F9;}'
    + '.inc-modal-apply{background:#2563EB;color:white;}'
    + '.inc-modal-apply:hover{background:#1D4ED8;}'
    + '.src-calc{display:flex;align-items:center;gap:3px;font-size:13px;font-weight:600;color:#166534;white-space:nowrap;}'
    + '.src-calc .eq{color:#94A3B8;font-weight:400;}'
    + '.inc-bs-btn{padding:3px 8px;font-size:10px;font-weight:600;border-radius:4px;cursor:pointer;white-space:nowrap;border:1px solid #FDE68A;background:#FFFBEB;color:#92400E;transition:all 0.15s;}'
    + '.inc-bs-btn:hover{background:#FEF3C7;border-color:#F59E0B;}'
    + '.inc-bs-btn.has-data{background:#F0FDF4;border-color:#BBF7D0;color:#166534;}'
    + '.inc-bs-modal-bg{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.45);z-index:210000;display:flex;align-items:center;justify-content:center;padding:20px;}'
    + '.inc-bs-modal{background:#fff;border-radius:12px;width:100%;max-width:480px;}'
    + '.inc-bs-modal-hdr{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-bottom:1px solid #E2E8F0;background:#FFFBEB;border-radius:12px 12px 0 0;}'
    + '.inc-bs-modal-hdr span:first-child{font-size:14px;font-weight:700;color:#92400E;}'
    + '.inc-bs-modal-hdr .inc-bs-close{font-size:18px;cursor:pointer;color:#94A3B8;}'
    + '.inc-bs-modal-hdr .inc-bs-close:hover{color:#DC2626;}'
    + '.inc-bs-modal-body{padding:20px;}'
    + '.inc-bs-field{margin-bottom:14px;}'
    + '.inc-bs-field label{display:block;font-size:12px;font-weight:600;color:#64748B;margin-bottom:4px;}'
    + '.inc-bs-field input,.inc-bs-field select{width:100%;font-size:14px;padding:8px 10px;border:1px solid #E2E8F0;border-radius:6px;box-sizing:border-box;}'
    + '.inc-bs-result{background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;}'
    + '.inc-bs-result-lbl{font-size:13px;font-weight:500;color:#166534;}'
    + '.inc-bs-result-val{font-size:18px;font-weight:800;color:#166534;}'
    + '.inc-bs-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1px solid #E2E8F0;}'
    + '@media(max-width:900px){.inc-iw{width:200px;}.inc-modal{max-width:98vw;}}';
  document.head.appendChild(incomeStyle);
  /* Income section: init handled by buildIncomeSection() from openNewLoanModal / openLoanModal */
  setupLTVSync(); setupCompensationSync(); setupPICalc(); setupRateFormatting(); setupBorrowerNameBar(); setupPropertyValueSync();

  /* v7.30: DOM enhancements — rename labels + convert fields */
  /* 1.1: Rename "Report #" label to "Report / File #" */
  (function() {
    var reportInput = document.getElementById('credit-report-number');
    if (reportInput) {
      var label = reportInput.closest('.field-group, .form-group, div')?.querySelector('label');
      if (!label) {
        /* Try previous sibling or parent's label */
        label = reportInput.parentElement?.querySelector('label');
      }
      if (label && label.textContent.trim().match(/Report\\s*#/i)) {
        label.textContent = 'Report / File #';
      }
    }
  })();

  /* 1.2: Convert credit-pull-type from text input to dropdown with Estimated option */
  (function() {
    var textInput = document.getElementById('credit-pull-type');
    if (textInput && textInput.tagName === 'INPUT') {
      var select = document.createElement('select');
      select.id = 'credit-pull-type';
      select.className = textInput.className;
      select.style.cssText = textInput.style.cssText;
      var options = ['', 'Hard', 'Soft', 'Estimated'];
      options.forEach(function(opt) {
        var o = document.createElement('option');
        o.value = opt;
        o.textContent = opt || '-- Select --';
        select.appendChild(o);
      });
      /* Preserve current value if it exists */
      var currentVal = textInput.value;
      if (currentVal) {
        /* If current value isn't in predefined options, add it */
        var found = options.indexOf(currentVal) >= 0;
        if (!found) {
          var extra = document.createElement('option');
          extra.value = currentVal;
          extra.textContent = currentVal;
          select.appendChild(extra);
        }
        select.value = currentVal;
      }
      textInput.parentNode.replaceChild(select, textInput);
    }
  })();

  document.addEventListener('click', e => {
    const sel = document.querySelector('.column-selector');
    const dd = document.getElementById('column-selector-dropdown');
    if (sel && !sel.contains(e.target)) dd.classList.remove('open');
  });
  await loadLoans();

  console.log(\`Pipeline v12.2 loaded in \${(performance.now() - startTime).toFixed(0)}ms\`);
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPipeline);
} else {
  initPipeline();
}

// Deep-link: auto-open a loan if ?openLoan=<uuid> is in the URL.
// Runs on window.load so ALL scripts (including Notes override) are fully set up.
window.addEventListener('load', function() {
  var openLoanParam = new URLSearchParams(window.location.search).get('openLoan');
  if (openLoanParam) {
    // Small delay to ensure all DOMContentLoaded handlers and script inits are done
    setTimeout(function() {
      if (typeof openLoanModal === 'function') {
        console.log('Deep-link: opening loan', openLoanParam);
        openLoanModal(openLoanParam);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }, 500);
  }
});
function toggleColumnSelector() {
  event.stopPropagation();
  document.getElementById('column-selector-dropdown').classList.toggle('open');
}
function setStatusFilter(status) {
  currentStatusFilter = status;
  document.querySelectorAll('.status-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.status === status);
  });
  applyStatusColumnDefaults(status);
  filterTable();
}
function applyStatusColumnDefaults(status) {
  const lostReasonCB = document.getElementById('col-lost-reason');
  const otherTypeCB = document.getElementById('col-other-loan-type');
  const loanRateCB = document.getElementById('col-loan-interest-rate');
  const payStatusCB = document.getElementById('col-pay-status');
  if (lostReasonCB) lostReasonCB.checked = (status === 'Lost');
  if (payStatusCB) payStatusCB.checked = (status === 'Won');
  if (status === 'Won') {
    if (otherTypeCB) otherTypeCB.checked = true;
    if (loanRateCB) loanRateCB.checked = true;
  }
}
function updateVisibleTableColumns() {
  const orderedCols = getOrderedColumns();
  orderedCols.forEach(col => {
    const cb = document.getElementById(\`col-\${col.id}\`);
    const vis = cb ? cb.checked : false;
    document.querySelectorAll(\`th.col-\${col.id}, td.col-\${col.id}\`).forEach(el => el.style.display = vis ? '' : 'none');
  });
  saveColumnPreferences();
}
function sortTable(column) {
  if (sortColumn === column) sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  else { sortColumn = column; sortDirection = 'asc'; }
  filterTable();
}
function getCompAmount(loan) {
  if (loan['Compensation Amount']) return loan['Compensation Amount'];
  if (loan['Comp BPS'] && loan['Loan Amount']) return (loan['Loan Amount'] * loan['Comp BPS']) / 10000;
  return 0;
}
function getActiveLoans() { return loans.filter(l => { const s = l['Deal Status']; return !s || s === 'Active'; }); }
function getWonLoans() { return loans.filter(l => l['Deal Status'] === 'Won'); }
function getLostLoans() { return loans.filter(l => l['Deal Status'] === 'Lost'); }
function getLeadLoans() { return loans.filter(l => { const s = l['Deal Status']; return (!s || s === 'Active') && l.Stage === '01 - Lead'; }); }
function getLoansForCurrentFilter() {
  if (currentStatusFilter === 'All') return loans;
  if (currentStatusFilter === 'Leads') return getLeadLoans();
  if (currentStatusFilter === 'Won') return getWonLoans();
  if (currentStatusFilter === 'Lost') return getLostLoans();
  return getActiveLoans();
}
function getLockBadgeClass(s) {
  if (!s || s === '-') return 'lock-not-set';
  return s === 'Floating' ? 'lock-floating' : s === 'Locked' ? 'lock-locked' : s === 'Expired' ? 'lock-expired' : 'lock-not-set';
}
function getPayBadgeClass(s) {
  if (!s || s === '-') return 'pay-not-set';
  if (s === 'Preparing') return 'pay-preparing';
  if (s === 'Ready for Payroll') return 'pay-ready';
  if (s === 'Payroll Submitted') return 'pay-submitted';
  if (s === 'Pay Received') return 'pay-received';
  return 'pay-not-set';
}
function setDealStatus(status) {
  if (status === 'Lost') { promptLostReason(); return; }
  if (!currentLoanId) return;
  const loan = loans.find(l => l.id === currentLoanId); if (!loan) return;
  if (status === 'Active') loan['Lost Reason'] = '';
  loan['Deal Status'] = status;
  updateDealStatusButtons(status); updateStats(); renderCurrentView();
  clearPipelineCache();
  const fields = { 'Deal Status': status }; if (status === 'Active') fields['Lost Reason'] = '';
  apiCall(\`/api/pipeline/loans/\${currentLoanId}\`, 'PUT', fields).catch(err => console.error('Error saving deal status:', err));
}
function promptLostReason() {
  document.getElementById('lost-reason-text').value = '';
  document.getElementById('lost-reason-modal').classList.remove('hidden');
}
function cancelLostReason() { document.getElementById('lost-reason-modal').classList.add('hidden'); }
function confirmLostDeal() {
  const reason = document.getElementById('lost-reason-text').value.trim();
  if (!reason) { alert('Please enter a reason for losing this deal.'); return; }
  if (!currentLoanId) return;
  const loan = loans.find(l => l.id === currentLoanId); if (!loan) return;
  loan['Deal Status'] = 'Lost'; loan['Lost Reason'] = reason;
  document.getElementById('lost-reason-modal').classList.add('hidden');
  updateDealStatusButtons('Lost'); updateStats(); renderCurrentView();
  clearPipelineCache();
  apiCall(\`/api/pipeline/loans/\${currentLoanId}\`, 'PUT', { 'Deal Status': 'Lost', 'Lost Reason': reason }).catch(err => console.error('Error saving lost deal:', err));
}
function updateDealStatusButtons(status) {
  const bw = document.getElementById('btn-won'), bl = document.getElementById('btn-lost');
  const br = document.getElementById('btn-reopen'), wb = document.getElementById('won-banner'), lb = document.getElementById('lost-banner');
  [bw,bl,br,wb,lb].forEach(el => el.classList.add('hidden'));
  if (status === 'Won') { wb.classList.remove('hidden'); br.classList.remove('hidden'); }
  else if (status === 'Lost') { lb.classList.remove('hidden'); br.classList.remove('hidden'); }
  else { bw.classList.remove('hidden'); bl.classList.remove('hidden'); }
}
function setupLTVSync() {
  const lai = document.getElementById('loan-amount'), li = document.getElementById('ltv'), pvi = document.getElementById('property-value');
  let af = null;
  [lai,li,pvi].forEach(i => { i.addEventListener('focus', () => af = i.id); i.addEventListener('blur', () => af = null); });
  const uLTV = debounce(() => {
    if (af === 'ltv' || isUpdatingLTV) return;
    const la = parseCurrency(lai.value), pv = parseCurrency(pvi.value);
    if (la && pv && pv > 0) li.value = ((la / pv) * 100).toFixed(2);
    if (lastCompFieldEdited === 'bps') calculateCompFromBPS();
  }, 300);
  const uLA = debounce(() => {
    if (af === 'loan-amount' || isUpdatingLTV) return;
    const ltv = parseFloat(li.value), pv = parseCurrency(pvi.value);
    if (ltv && pv && pv > 0) { lai.value = Math.round((ltv / 100) * pv).toLocaleString(); if (lastCompFieldEdited === 'bps') calculateCompFromBPS(); }
  }, 300);
  const uPV = debounce(() => {
    if (isUpdatingLTV) return;
    const pv = parseCurrency(pvi.value), ltv = parseFloat(li.value);
    if (ltv && pv && pv > 0 && af !== 'loan-amount') { lai.value = Math.round((ltv / 100) * pv).toLocaleString(); if (lastCompFieldEdited === 'bps') calculateCompFromBPS(); }
  }, 300);
  lai.addEventListener('input', uLTV); li.addEventListener('input', uLA); pvi.addEventListener('input', uPV);
}
function setupPropertyValueSync() {
  const pvLoan = document.getElementById('property-value');
  const pvProp = document.getElementById('prop-page-value');
  if (!pvLoan || !pvProp) return;
  pvProp.addEventListener('input', () => { pvLoan.value = pvProp.value; pvLoan.dispatchEvent(new Event('input', {bubbles:true})); });
  pvLoan.addEventListener('input', () => { pvProp.value = pvLoan.value; calcEquityLoan(); });
}
function setupCompensationSync() {
  const cb = document.getElementById('comp-bps'), ca = document.getElementById('comp-amount-input'), la = document.getElementById('loan-amount');
  cb.addEventListener('input', () => { if (!isUpdatingComp) { lastCompFieldEdited = 'bps'; calculateCompFromBPS(); } });
  ca.addEventListener('input', () => { if (!isUpdatingComp) { lastCompFieldEdited = 'amount'; calculateCompFromAmount(); } });
  la.addEventListener('input', () => { if (lastCompFieldEdited === 'amount') calculateCompFromAmount(); else if (lastCompFieldEdited === 'bps') calculateCompFromBPS(); calcEquityLoan(); });
}
function calculateCompFromBPS() {
  if (isUpdatingComp) return; isUpdatingComp = true;
  const la = parseCurrency(document.getElementById('loan-amount').value), bps = parseFloat(document.getElementById('comp-bps').value);
  const cai = document.getElementById('comp-amount-input'), bsi = document.getElementById('bps-sync-indicator'), asi = document.getElementById('amount-sync-indicator');
  if (la && bps && !isNaN(la) && !isNaN(bps)) { cai.value = Math.round((la * bps) / 10000).toLocaleString(); bsi.textContent = ''; asi.textContent = 'Calculated from BPS'; }
  else if (!document.getElementById('comp-bps').value) { cai.value = ''; bsi.textContent = ''; asi.textContent = ''; }
  isUpdatingComp = false;
}
function calculateCompFromAmount() {
  if (isUpdatingComp) return; isUpdatingComp = true;
  const la = parseCurrency(document.getElementById('loan-amount').value), ca = parseCurrency(document.getElementById('comp-amount-input').value);
  const cbi = document.getElementById('comp-bps'), bsi = document.getElementById('bps-sync-indicator'), asi = document.getElementById('amount-sync-indicator');
  if (la && ca && !isNaN(la) && !isNaN(ca) && la > 0) { cbi.value = Math.round((ca / la) * 100000) / 10; bsi.textContent = 'Calculated from $'; asi.textContent = ''; }
  else if (!document.getElementById('comp-amount-input').value) { cbi.value = ''; bsi.textContent = ''; asi.textContent = ''; }
  isUpdatingComp = false;
}
/* ---- P&I Monthly Payment Calculation (v7.0: 2 decimal places) ---- */
function fmtMo(v) { return '$' + v.toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ','); }
function updatePICalc() {
  var piEl = document.getElementById('pi-calc-display');
  var expEl = document.getElementById('monthly-expenses-display');
  var totalEl = document.getElementById('total-pitia-display');
  var loanAmt = parseCurrency(document.getElementById('loan-amount').value);
  var rateVal = parseFloat(document.getElementById('loan-interest-rate').value);
  var termYrs = parseInt(document.getElementById('loan-term').value);
  var pi = 0;
  if (loanAmt && rateVal && termYrs && loanAmt > 0 && rateVal > 0 && termYrs > 0) {
    var r = (rateVal / 100) / 12;
    var n = termYrs * 12;
    pi = loanAmt * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  }
  if (piEl) piEl.textContent = pi > 0 ? fmtMo(pi) : '\\u2014';
  /* Per-row monthly values for stacked payment table */
  var hoi = parseCurrency(document.getElementById('prop-hoi').value) || 0;
  var taxes = parseCurrency(document.getElementById('prop-taxes').value) || 0;
  var supp = parseCurrency(document.getElementById('prop-supp-ins').value) || 0;
  var hoa = parseCurrency(document.getElementById('prop-hoa').value) || 0;
  var hoiM = hoi / 12, taxM = taxes / 12, supM = supp / 12, hoaM = hoa;
  var hoiEl = document.getElementById('hoi-monthly');
  var taxEl = document.getElementById('taxes-monthly');
  var supEl = document.getElementById('supp-monthly');
  var hoaEl = document.getElementById('hoa-monthly');
  if (hoiEl) hoiEl.textContent = hoi > 0 ? fmtMo(hoiM) : '\\u2014';
  if (taxEl) taxEl.textContent = taxes > 0 ? fmtMo(taxM) : '\\u2014';
  if (supEl) supEl.textContent = supp > 0 ? fmtMo(supM) : '\\u2014';
  if (hoaEl) hoaEl.textContent = hoa > 0 ? fmtMo(hoaM) : '\\u2014';
  var monthlyExp = hoiM + taxM + supM + hoaM;
  if (expEl) expEl.textContent = monthlyExp > 0 ? fmtMo(monthlyExp) : '\\u2014';
  /* Total PITIA — also 2 decimal places */
  var total = (pi > 0 ? pi : 0) + monthlyExp;
  if (totalEl) totalEl.textContent = total > 0 ? fmtMo(total) : '\\u2014';
}
function setupPICalc() {
  ['loan-amount','loan-interest-rate','loan-term','prop-hoi','prop-taxes','prop-supp-ins','prop-hoa'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', debounce(updatePICalc, 300));
  });
}
/* ---- Rate Input Formatting (always show 3 decimal places) ---- */
function setupRateFormatting() {
  document.querySelectorAll('.rate-input').forEach(function(input) {
    input.addEventListener('blur', function() {
      var val = parseFloat(input.value);
      if (!isNaN(val)) { input.value = val.toFixed(3); }
    });
  });
}
/* ---- Borrower Name Bar (sticky header subtitle) ---- */
function updateBorrowerNameBar() {
  var first = (document.getElementById('borrower-first').value || '').trim();
  var last = (document.getElementById('borrower-last').value || '').trim();
  var coFirst = (document.getElementById('co-borrower-first').value || '').trim();
  var coLast = (document.getElementById('co-borrower-last').value || '').trim();
  var borrowerName = [first, last].filter(Boolean).join(' ');
  var coBorrowerName = [coFirst, coLast].filter(Boolean).join(' ');
  var bar = document.getElementById('borrower-name-bar');
  var bEl = document.getElementById('header-borrower-name');
  var sep = document.getElementById('header-name-separator');
  var cEl = document.getElementById('header-coborrower-name');
  if (!bar || !bEl) return;
  bEl.textContent = borrowerName || 'New Loan';
  if (coBorrowerName) { cEl.textContent = coBorrowerName; sep.classList.remove('hidden'); cEl.style.display = ''; }
  else { cEl.textContent = ''; sep.classList.add('hidden'); cEl.style.display = 'none'; }
  bar.classList.remove('hidden');
}
function setupBorrowerNameBar() {
  ['borrower-first','borrower-last','co-borrower-first','co-borrower-last'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', debounce(updateBorrowerNameBar, 200));
  });
}
/* ---- Show a section page when a left nav item is clicked ---- */
/* v7.6: Sections are now separate pages (show/hide) instead of scroll targets */
function showSection(pageId) {
  var container = document.getElementById('section-pages');
  if (!container) return;
  /* Hide all section cards */
  container.querySelectorAll('.section-card').forEach(function(card) {
    card.classList.add('section-hidden');
    card.classList.remove('section-full');
  });
  /* Show matching cards for this page */
  var matchingCards = container.querySelectorAll('[data-page="' + pageId + '"]');
  var visibleCount = 0;
  matchingCards.forEach(function(card) {
    card.classList.remove('section-hidden');
    /* Count cards that are actually visible (not hidden by other logic like tasks-section) */
    if (!card.classList.contains('hidden')) {
      visibleCount++;
    }
  });
  /* If only one visible card OR not on the main page, make cards full-width centered */
  /* The main page uses 2-col side-by-side (Borrower + Deal); all other pages stack */
  if (visibleCount === 1 || pageId !== 'main') {
    matchingCards.forEach(function(card) {
      if (!card.classList.contains('hidden')) {
        card.classList.add('section-full');
      }
    });
  }
  /* Special: HELOC visibility is managed by toggleHelocSection() separately */
  /* When on loan-details page, re-check HELOC visibility */
  if (pageId === 'section-loan-details') {
    toggleHelocSection();
  }
  /* Scroll content area to top */
  var scrollContainer = document.getElementById('modal-main-scroll');
  if (scrollContainer) scrollContainer.scrollTop = 0;
  /* Update nav highlighting */
  document.querySelectorAll('.mnav-item[data-section]').forEach(function(item) {
    var section = item.getAttribute('data-section');
    if (pageId === 'main') {
      item.classList.toggle('active', section === 'section-borrower' || section === 'section-deal');
    } else {
      item.classList.toggle('active', section === pageId);
    }
  });
  /* Store current page for reference */
  window._currentSectionPage = pageId;
}
/* ---- Backward-compat alias: scrollToSection calls showSection ---- */
function scrollToSection(sectionId) {
  /* Map borrower/deal to main page, everything else to its own page */
  if (sectionId === 'section-borrower' || sectionId === 'section-deal') {
    showSection('main');
  } else {
    showSection(sectionId);
  }
}
/* ---- Co-Borrower Collapsible Toggle ---- */
function toggleCoBorrower() {
  var body = document.getElementById('coborrower-toggle-body');
  var icon = document.getElementById('coborrower-toggle-icon');
  if (!body) return;
  if (body.classList.contains('collapsed')) {
    body.classList.remove('collapsed');
    body.classList.add('expanded');
    if (icon) icon.innerHTML = '&#9652;';
  } else {
    body.classList.remove('expanded');
    body.classList.add('collapsed');
    if (icon) icon.innerHTML = '&#9662;';
  }
}
function expandCoBorrower() {
  var body = document.getElementById('coborrower-toggle-body');
  var icon = document.getElementById('coborrower-toggle-icon');
  if (!body) return;
  body.classList.remove('collapsed');
  body.classList.add('expanded');
  if (icon) icon.innerHTML = '&#9652;';
}
function collapseCoBorrower() {
  var body = document.getElementById('coborrower-toggle-body');
  var icon = document.getElementById('coborrower-toggle-icon');
  if (!body) return;
  body.classList.remove('expanded');
  body.classList.add('collapsed');
  if (icon) icon.innerHTML = '&#9662;';
}
async function apiCall(endpoint, method = 'GET', body = null) {
  // CRIT-1: Send the raw JWT (not plain email) so the server can verify the signature.
  const token = getAccessToken();
  const opts = { method, headers: { 'Authorization': \`Bearer \${token}\`, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(\`\${API_BASE}\${endpoint}\`, opts);
  return r.json();
}
async function loadLoans(forceRefresh = false) {
  try {
    if (!forceRefresh) {
      const cd = getCachedPipelineData();
      // Guard: only use cache if it's a valid array (prevents crash if an error object was cached)
      if (cd && Array.isArray(cd)) {
        loans = cd.map(r => ({ id: r.id, ...r.fields }));
        document.getElementById('loading-state').classList.add('hidden');
        if (loans.length === 0) document.getElementById('empty-state').classList.remove('hidden');
        else { updateStats(); renderCurrentView(); }
        return;
      } else if (cd) {
        // Cache has bad data (e.g. an error object from a failed request) — clear it
        clearPipelineCache();
      }
    }
    const data = await apiCall('/api/pipeline/loans');
    // Guard: only cache and map if API returned a valid array
    if (!Array.isArray(data)) {
      throw new Error(data?.error || 'Unexpected response from server');
    }
    setCachedPipelineData(data);
    loans = data.map(r => ({ id: r.id, ...r.fields }));
    document.getElementById('loading-state').classList.add('hidden');
    if (loans.length === 0) document.getElementById('empty-state').classList.remove('hidden');
    else { updateStats(); renderCurrentView(); }
  } catch (error) {
    console.error('Error loading loans:', error);
    document.getElementById('loading-state').innerHTML = '<p>Error loading data. Please refresh.</p>';
  }
}
async function refreshPipelineData() {
  clearPipelineCache();
  document.getElementById('loading-state').classList.remove('hidden');
  ['empty-state','kanban-view','table-view'].forEach(id => document.getElementById(id).classList.add('hidden'));
  await loadLoans(true);
}
function updateStats() {
  const al = getActiveLoans(), wl = getWonLoans(), ll = getLostLoans();
  const ip = al.filter(l => l.Stage !== '12 - Closed').length;
  const cs = al.filter(l => { if (!l['Expected Close'] || l.Stage === '12 - Closed') return false; const d = (new Date(l['Expected Close']) - new Date()) / 864e5; return d >= 0 && d <= 14; }).length;
  const vol = al.filter(l => l.Stage !== '12 - Closed').reduce((s, l) => s + (l['Loan Amount'] || 0), 0);
  document.getElementById('stat-total').textContent = al.length;
  document.getElementById('stat-active').textContent = ip;
  document.getElementById('stat-closing').textContent = cs;
  document.getElementById('stat-volume').textContent = '$' + Math.round(vol).toLocaleString();
  document.getElementById('stat-won').textContent = wl.length;
  document.getElementById('stat-lost').textContent = ll.length;
}
function fmtM(n) { if (!n) return '$0'; if (n >= 1e6) return '$' + (n/1e6).toFixed(3) + 'M'; if (n >= 1e3) return '$' + (n/1e3).toFixed(3) + 'K'; return '$' + n.toLocaleString(); }
function fmtCW(n) { if (!n) return '$0'; return '$' + Math.round(n).toLocaleString(); }
function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  renderCurrentView();
}
function renderCurrentView() {
  ['kanban-view','table-view','empty-state'].forEach(id => document.getElementById(id).classList.add('hidden'));
  if (loans.length === 0) { document.getElementById('empty-state').classList.remove('hidden'); return; }
  if (currentView === 'kanban') { renderKanban(); document.getElementById('kanban-view').classList.remove('hidden'); }
  else { renderTable(); document.getElementById('table-view').classList.remove('hidden'); }
}
function renderKanban() {
  const board = document.getElementById('kanban-view'); board.innerHTML = '';
  const al = getActiveLoans();
  STAGES.forEach(stage => {
    const sl = al.filter(l => l.Stage === stage);
    const col = document.createElement('div'); col.className = 'kanban-column';
    col.innerHTML = \`<div class="column-header"><span class="column-title">\${stage.replace(/^\\d+\\s*-\\s*/,'')}</span><span class="column-count">\${sl.length}</span></div><div class="kanban-cards" data-stage="\${stage}">\${sl.map(l => renderLoanCard(l)).join('')}</div>\`;
    board.appendChild(col);
  });
}
function renderLoanCard(loan) {
  const cd = loan['Expected Close']; let cdc = '', cdt = '-';
  if (cd) { const d = new Date(cd+'T00:00:00'), diff = (d - new Date()) / 864e5; cdt = d.toLocaleDateString('en-US',{month:'short',day:'numeric'}); if (diff < 0) cdc = 'overdue'; else if (diff <= 7) cdc = 'soon'; }
  const addr = [loan['Property Street'], loan['Property City']].filter(Boolean).join(', ') || 'No address';
  return \`<div class="loan-card" onclick="openLoanModal('\${loan.id}')"><div class="loan-card-header"><h4 class="loan-borrower">\${escapeHtml(loan['Borrower Name']||'Unnamed')}</h4><span class="loan-amount">\${fmtM(loan['Loan Amount'])}</span></div><div class="loan-property">\${escapeHtml(addr)}</div><div class="loan-meta"><span class="loan-type">\${escapeHtml(loan['Loan Type']||'-')}</span><span class="loan-close-date \${cdc}">\${cdt}</span></div></div>\`;
}
function renderTable() { filterTable(); }
function filterTable() {
  const search = document.getElementById('search-input').value.toLowerCase();
  const sf = document.getElementById('stage-filter').value;
  const tf = document.getElementById('type-filter').value;
  const lf = document.getElementById('lock-status-filter').value;
  const pf = document.getElementById('pay-status-filter').value;
  let filtered = getLoansForCurrentFilter().filter(loan => {
    const ms = !search || (loan['Borrower Name']||'').toLowerCase().includes(search) || (loan['Borrower First Name']||'').toLowerCase().includes(search) || (loan['Borrower Last Name']||'').toLowerCase().includes(search) || (loan['Property Street']||'').toLowerCase().includes(search) || (loan['Property City']||'').toLowerCase().includes(search);
    const mst = !sf || loan.Stage === sf;
    const mt = !tf || loan['Loan Type'] === tf;
    const ml = !lf || (loan['Lock Status']||'-') === lf;
    const mp = !pf || (loan['Pay Status']||'-') === pf;
    return ms && mst && mt && ml && mp;
  });
  if (sortColumn) {
    filtered.sort((a, b) => {
      let av = sortColumn === 'Compensation Amount' ? getCompAmount(a) : a[sortColumn];
      let bv = sortColumn === 'Compensation Amount' ? getCompAmount(b) : b[sortColumn];
      av = av ?? (typeof av === 'number' ? 0 : ''); bv = bv ?? (typeof bv === 'number' ? 0 : '');
      if (typeof av === 'string') av = av.toLowerCase(); if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortDirection === 'asc' ? -1 : 1;
      if (av > bv) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }
  const orderedCols = getOrderedColumns();
  const tbody = document.getElementById('table-body');
  tbody.innerHTML = filtered.map(loan => buildTableRow(loan, orderedCols)).join('');
  tbody.innerHTML += buildSummaryRow(filtered, orderedCols);
  updateVisibleTableColumns();

  document.querySelectorAll('th[data-column]').forEach(th => {
    const c = th.getAttribute('data-column'); th.classList.remove('sort-asc','sort-desc');
    if (c === sortColumn) th.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
  });
}
function getStageClass(stage) {
  if (!stage) return '';
  const s = stage.toLowerCase();
  if (s.includes('lead')) return 'lead'; if (s.includes('application')) return 'application';
  if (s.includes('prequal')) return 'prequal'; if (s.includes('shopping')) return 'shopping';
  if (s.includes('contract')) return 'contract'; if (s.includes('quotes')) return 'quotes';
  if (s.includes('disclosure')) return 'disclosure'; if (s.includes('processing')) return 'processing';
  if (s.includes('underwriting')) return 'underwriting'; if (s.includes('conditional')) return 'conditional';
  if (s.includes('resubmittal')) return 'resubmittal'; if (s.includes('ctc')) return 'ctc';
  if (s.includes('closing') || s.includes('funding')) return 'closing';
  if (s.includes('closed')) return 'closed'; return '';
}
/* ---- Links section: dynamically build HTML into #links-content ---- */
function buildLinksSection() {
  var c = document.getElementById('links-content');
  if (!c || c.children.length > 0) return; /* already built */
  /* Fixed-name links */
  var fixed = [
    { id: 'application', label: 'Application' },
    { id: 'documents', label: 'Documents' },
    { id: 'lender-portal', label: 'Lender Portal' },
    { id: 'appraisal-portal', label: 'Appraisal Portal' }
  ];
  var html = '';
  fixed.forEach(function(lk) {
    html += '<div class="link-row"><label class="link-label">' +
      '<img class="link-favicon hidden" id="link-fav-' + lk.id + '" width="16" height="16" alt="">' +
      lk.label + '</label>' +
      '<div class="link-input-wrap"><input type="url" class="fc link-url-input" id="link-' + lk.id + '" placeholder="https://..." oninput="updateLinkButton(\\'' + lk.id + '\\')">' +
      '<a class="link-open-btn hidden" id="link-btn-' + lk.id + '" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i> Open</a></div></div>';
  });
  /* Divider */
  html += '<div class="link-divider"></div>';
  /* Custom "Other" links with editable name field */
  for (var i = 1; i <= 3; i++) {
    html += '<div class="link-row"><div class="link-name-row">' +
      '<img class="link-favicon hidden" id="link-fav-other' + i + '" width="16" height="16" alt="">' +
      '<input type="text" class="fc link-name-input" id="link-other' + i + '-name" placeholder="Custom Link ' + i + '"></div>' +
      '<div class="link-input-wrap"><input type="url" class="fc link-url-input" id="link-other' + i + '-url" placeholder="https://..." oninput="updateLinkButton(\\'other' + i + '\\')">' +
      '<a class="link-open-btn hidden" id="link-btn-other' + i + '" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i> Open</a></div></div>';
  }
  c.innerHTML = html;
}
/* Show/hide the Open button and favicon based on input value */
function updateLinkButton(key) {
  var input = document.getElementById('link-' + key) || document.getElementById('link-' + key + '-url');
  var btn = document.getElementById('link-btn-' + key);
  var fav = document.getElementById('link-fav-' + key);
  if (!input || !btn) return;
  var url = input.value.trim();
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    btn.href = url;
    btn.classList.remove('hidden');
    /* v7.12: Show favicon from the URL's root domain.
       Subdomains like 1660690.myarive.com or prestonlending.pipedrive.com
       won't have favicons indexed — the root domain (myarive.com, pipedrive.com)
       always works. Extract the last two hostname parts as root domain. */
    if (fav) {
      try {
        var parts = new URL(url).hostname.split('.');
        var rootDomain = parts.length > 2 ? parts.slice(-2).join('.') : parts.join('.');
        fav.src = 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(rootDomain) + '&sz=32';
        fav.classList.remove('hidden');
        fav.onerror = function() { fav.classList.add('hidden'); };
      } catch(e) { fav.classList.add('hidden'); }
    }
  } else {
    btn.classList.add('hidden');
    btn.removeAttribute('href');
    if (fav) { fav.classList.add('hidden'); fav.removeAttribute('src'); }
  }
}
/* Refresh all Open buttons (called when loading a loan) */
function refreshAllLinkButtons() {
  ['application','documents','lender-portal','appraisal-portal'].forEach(updateLinkButton);
  ['other1','other2','other3'].forEach(updateLinkButton);
}
function openNewLoanModal() {
  currentLoanId = null; lastCompFieldEdited = null;
  document.getElementById('modal-title').textContent = 'New Loan';
  document.getElementById('loan-form').reset();
  document.getElementById('loan-id').value = '';
  document.getElementById('delete-loan-btn').classList.add('hidden');
  document.getElementById('tasks-section').classList.add('hidden');
  document.getElementById('bps-sync-indicator').textContent = '';
  document.getElementById('amount-sync-indicator').textContent = '';
  document.getElementById('purchase-price-group').style.display = 'none';
  document.getElementById('heloc-section').classList.add('hidden');
  document.getElementById('other-loan-type-row').classList.add('hidden');
  /* v7.19: Reset equity loan subordinate financing fields */
  document.getElementById('equity-loan-divider').classList.add('hidden');
  document.getElementById('equity-loan-fields').classList.add('hidden');
  document.getElementById('equity-loan-fields-2').classList.add('hidden');
  document.getElementById('equity-loan-results').classList.add('hidden');
  document.getElementById('lien-position').value = '';
  document.getElementById('max-cltv').value = '';
  document.getElementById('existing-1st-balance').value = '';
  document.getElementById('existing-2nd-balance').value = '';
  document.getElementById('existing-2nd-group').classList.add('hidden');
  document.getElementById('eq-total-liens').textContent = '\u2014';
  document.getElementById('eq-max-debt').textContent = '\u2014';
  document.getElementById('eq-max-loan').textContent = '\u2014';
  document.getElementById('eq-actual-cltv').textContent = '\u2014';
  /* Reset lender searchable dropdown */
  if (window.setLenderValue) window.setLenderValue('');
  document.getElementById('deal-status-bar').classList.add('hidden');
  document.getElementById('lock-status').value = '-';
  document.getElementById('lock-date').value = '';
  document.getElementById('lock-expiration-date').value = '';
  document.getElementById('pay-status').value = '-';
  document.getElementById('payroll-submitted-date').value = '';
  document.getElementById('payroll-processed-date').value = '';
  document.getElementById('pay-received-date').value = '';
  document.getElementById('last-contact-date').value = '';
  closeCalcSidebar();
  closeRefiSidebar();

  document.getElementById('calc-income').value = '';
  document.getElementById('calc-debts').value = '';
  document.getElementById('calc-dti').value = '45';
  document.getElementById('calc-insurance').value = '';
  document.getElementById('calc-taxes').value = '';
  document.getElementById('calc-supp-insurance').value = '';
  document.getElementById('calc-hoa').value = '';
  /* Reset Property section housing cost fields */
  document.getElementById('prop-hoi').value = '';
  document.getElementById('prop-taxes').value = '';
  document.getElementById('prop-supp-ins').value = '';
  document.getElementById('prop-hoa').value = '';
  /* Reset housing cost toggles to defaults: annual for ins/tax/supp, monthly for HOA */
  if (typeof calcInsMode !== 'undefined') calcInsMode = 'annual';
  if (typeof calcTaxMode !== 'undefined') calcTaxMode = 'annual';
  if (typeof calcSuppMode !== 'undefined') calcSuppMode = 'annual';
  if (typeof calcHOAMode !== 'undefined') calcHOAMode = 'monthly';
  document.querySelectorAll('.calc-ins-toggle').forEach(function(b) { b.classList.toggle('active', b.dataset.mode === 'annual'); });
  document.querySelectorAll('.calc-tax-toggle').forEach(function(b) { b.classList.toggle('active', b.dataset.mode === 'annual'); });
  document.querySelectorAll('.calc-supp-toggle').forEach(function(b) { b.classList.toggle('active', b.dataset.mode === 'annual'); });
  document.querySelectorAll('.calc-hoa-toggle').forEach(function(b) { b.classList.toggle('active', b.dataset.mode === 'monthly'); });
  document.getElementById('calc-max-purchase').textContent = '\\u2014';
  document.getElementById('calc-max-loan').textContent = '\\u2014';
  document.getElementById('calc-max-pitia').textContent = '\\u2014';
  document.getElementById('calc-max-dti').textContent = '\\u2014';
  document.getElementById('calc-current-dti').textContent = '\\u2014';
  document.getElementById('calc-available-dti').textContent = '\\u2014';
  document.getElementById('calc-breakdown').innerHTML = '';
  var piEl = document.getElementById('pi-calc-display'); if (piEl) piEl.textContent = '\\u2014';
  var expEl = document.getElementById('monthly-expenses-display'); if (expEl) expEl.textContent = '\\u2014';
  var totalEl = document.getElementById('total-pitia-display'); if (totalEl) totalEl.textContent = '\\u2014';
  ["hoi-monthly","taxes-monthly","supp-monthly","hoa-monthly"].forEach(function(id){var e=document.getElementById(id);if(e)e.textContent="\u2014";});
  /* Build Links section HTML (only first time) and clear values */
  buildLinksSection();
  ['link-application','link-documents','link-lender-portal','link-appraisal-portal','link-other1-name','link-other1-url','link-other2-name','link-other2-url','link-other3-name','link-other3-url'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
  refreshAllLinkButtons();
  /* v7.10: Build/reset Income section */
  buildIncomeSection();
  /* v7.17: Build/reset Assets section */
  if (typeof buildAssetsSection === 'function') buildAssetsSection();
  /* v8.3: Build/reset Liabilities section */
  if (typeof buildLiabilitiesSection === 'function') buildLiabilitiesSection();
  /* v7.22: Build/reset Purchase Agreement section */
  if (typeof buildPurchaseAgreementSection === 'function') buildPurchaseAgreementSection();
  updateBorrowerNameBar();
  collapseCoBorrower();
  showSection('main');
  document.getElementById('loan-modal').classList.remove('hidden');
  /* Capture baseline for unsaved changes detection.
   * Use 500ms delay to ensure all async formatting (currency blur, module loads) settles. */
  setTimeout(captureFormSnapshot, 500);
}
async function openLoanModal(id) {
  currentLoanId = id; lastCompFieldEdited = null;
  const loan = loans.find(l => l.id === id); if (!loan) return;
  document.getElementById('modal-title').textContent = 'Edit Loan';
  document.getElementById('loan-id').value = id;
  document.getElementById('delete-loan-btn').classList.remove('hidden');
  isUpdatingLTV = true; isUpdatingComp = true;
  document.getElementById('bps-sync-indicator').textContent = '';
  document.getElementById('amount-sync-indicator').textContent = '';
  const setVal = (elId, val) => document.getElementById(elId).value = val || '';
  setVal('loan-stage', loan['Stage'] || '01 - Lead');
  setVal('loan-purpose', loan['Loan Purpose']); setVal('occupancy', loan['Occupancy']);
  setVal('lead-source', loan['Lead Source']); setVal('expected-close', loan['Expected Close']);
  togglePurchasePriceField();
  setVal('borrower-email', loan['Borrower Email']); setVal('borrower-phone', loan['Borrower Phone']);
  /* -- Borrower name: use individual fields if available, otherwise parse combined name -- */
  if (loan['Borrower First Name'] || loan['Borrower Last Name']) {
    setVal('borrower-first', loan['Borrower First Name']);
    setVal('borrower-middle', loan['Borrower Middle Name']);
    setVal('borrower-last', loan['Borrower Last Name']);
  } else {
    const bn = splitName(loan['Borrower Name']);
    setVal('borrower-first', bn.first); setVal('borrower-middle', bn.middle); setVal('borrower-last', bn.last);
  }
  /* -- Co-Borrower name: same priority logic -- */
  if (loan['Co-Borrower First Name'] || loan['Co-Borrower Last Name']) {
    setVal('co-borrower-first', loan['Co-Borrower First Name']);
    setVal('co-borrower-middle', loan['Co-Borrower Middle Name']);
    setVal('co-borrower-last', loan['Co-Borrower Last Name']);
  } else {
    const cn = splitName(loan['Co-Borrower']);
    setVal('co-borrower-first', cn.first); setVal('co-borrower-middle', cn.middle); setVal('co-borrower-last', cn.last);
  }
  setVal('co-borrower-email', loan['Co-Borrower Email']); setVal('co-borrower-phone', loan['Co-Borrower Phone']);
  setVal('co-borrower-role', loan['Co-Borrower Role']);
  /* v7.11: Borrower/Co-Borrower DOB + SSN Last 4 */
  setVal('borrower-dob', loan['Borrower DOB']);
  setVal('borrower-ssn4', loan['Borrower SSN Last 4']);
  setVal('co-borrower-dob', loan['Co-Borrower DOB']);
  setVal('co-borrower-ssn4', loan['Co-Borrower SSN Last 4']);
  /* Lender searchable dropdown — set hidden value + display input */
  setVal('loan-lender', loan['Lender']);
  if (window.setLenderValue) window.setLenderValue(loan['Lender'] || '');
  setVal('credit-pull-type', loan['Credit Pull Type']); setVal('credit-score', loan['Credit Score']);
  setVal('date-credit-pulled', loan['Date Credit Pulled']); setVal('scores-pulled', loan['Scores Pulled']);
  setVal('credit-vendor', loan['Credit Vendor']); setVal('credit-report-number', loan['Credit Report Number']);
  setVal('property-street', loan['Property Street']); setVal('property-city', loan['Property City']);
  setVal('property-state', loan['Property State']); setVal('property-zip', loan['Property Zip']);
  setVal('property-county', loan['Property County']);
  setVal('property-type', loan['Property Type']);
  document.getElementById('property-value').value = loan['Property Value'] ? loan['Property Value'].toLocaleString() : '';
  document.getElementById('prop-page-value').value = loan['Property Value'] ? loan['Property Value'].toLocaleString() : '';
  document.getElementById('purchase-price').value = loan['Purchase Price'] ? loan['Purchase Price'].toLocaleString() : '';
  setVal('loan-type', loan['Loan Type']); setVal('other-loan-type', loan['Other Loan Type']);
  document.getElementById('loan-amount').value = loan['Loan Amount'] ? loan['Loan Amount'].toLocaleString() : '';
  document.getElementById('ltv').value = loan['LTV'] ? (loan['LTV']*100).toFixed(2) : '';
  document.getElementById('loan-interest-rate').value = loan['Interest Rate'] ? (loan['Interest Rate']*100).toFixed(3) : '';
  document.getElementById('qualifying-interest-rate').value = loan['Qualifying Interest Rate'] ? (loan['Qualifying Interest Rate']*100).toFixed(3) : '';
  setVal('loan-term', loan['Loan Term']);
  toggleHelocSection(); toggleOtherLoanTypeField();
  document.getElementById('heloc-line-amount').value = loan['HELOC Line Amount'] ? loan['HELOC Line Amount'].toLocaleString() : '';
  document.getElementById('heloc-initial-draw').value = loan['HELOC Initial Draw'] ? loan['HELOC Initial Draw'].toLocaleString() : '';
  /* v7.19: Equity Loan subordinate financing fields */
  setVal('lien-position', loan['Lien Position']);
  document.getElementById('max-cltv').value = loan['Max CLTV'] ? (loan['Max CLTV'] * 100).toFixed(2) : '';
  document.getElementById('existing-1st-balance').value = loan['Existing 1st Mortgage Balance'] ? loan['Existing 1st Mortgage Balance'].toLocaleString() : '';
  document.getElementById('existing-2nd-balance').value = loan['Existing 2nd Mortgage Balance'] ? loan['Existing 2nd Mortgage Balance'].toLocaleString() : '';
  toggleEquityLoanFields();
  setVal('comp-bps', loan['Comp BPS']);
  document.getElementById('comp-amount-input').value = loan['Compensation Amount'] ? loan['Compensation Amount'].toLocaleString() : '';
  setVal('comp-channel', loan['Channel']);
  setVal('comp-type', loan['Comp Type']);
  /* v7.11: Points + YSP */
  if (document.getElementById('comp-points')) document.getElementById('comp-points').value = loan['Points'] != null ? loan['Points'] : '';
  if (document.getElementById('comp-ysp')) document.getElementById('comp-ysp').value = loan['YSP'] != null ? loan['YSP'] : '';
  togglePointsYsp();
  document.getElementById('lock-status').value = loan['Lock Status'] || '-';
  setVal('lock-date', loan['Lock Date']); setVal('lock-expiration-date', loan['Lock Expiration Date']);
  document.getElementById('pay-status').value = loan['Pay Status'] || '-';
  setVal('payroll-submitted-date', loan['Payroll Submitted Date']);
  setVal('payroll-processed-date', loan['Payroll Processed Date']);
  setVal('pay-received-date', loan['Pay Received Date']);
  setVal('last-contact-date', loan['Last Contact Date']);
  setVal('loan-notes', loan['Notes']);
  /* v7.11: Deal Notes + Pricing Notes + Payroll Notes */
  if (document.getElementById('deal-notes')) setVal('deal-notes', loan['Deal Notes']);
  if (document.getElementById('pricing-notes')) setVal('pricing-notes', loan['Pricing Notes']);
  if (document.getElementById('loan-details-notes')) setVal('loan-details-notes', loan['Loan Details Notes']);
  if (document.getElementById('liabilities-notes')) setVal('liabilities-notes', loan['Liabilities Notes']);
  if (document.getElementById('payroll-notes')) setVal('payroll-notes', loan['Payroll Notes']);
  setTimeout(() => { isUpdatingLTV = false; isUpdatingComp = false; }, 50);
  document.getElementById('deal-status-bar').classList.remove('hidden');
  updateDealStatusButtons(loan['Deal Status'] || 'Active');
  document.getElementById('tasks-section').classList.remove('hidden');
  await loadTasks(id);

  document.getElementById('calc-income').value = loan['Gross Annual Income'] ? loan['Gross Annual Income'].toLocaleString() : '';
  document.getElementById('calc-debts').value = loan['Monthly Debt Payments'] ? loan['Monthly Debt Payments'].toLocaleString() : '';
  document.getElementById('calc-dti').value = loan['Target DTI'] ? (loan['Target DTI']*100).toFixed(1) : '45';
  /* Load housing costs — stored as MONTHLY in Airtable */
  /* Property section fields (HOI/Taxes/Supp shown as annual with 2 decimals, HOA as monthly) */
  document.getElementById('prop-hoi').value = loan['HOI'] ? (loan['HOI'] * 12).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '';
  document.getElementById('prop-taxes').value = loan['Property Taxes'] ? (loan['Property Taxes'] * 12).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '';
  document.getElementById('prop-supp-ins').value = loan['Supplemental Insurance'] ? (loan['Supplemental Insurance'] * 12).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '';
  document.getElementById('prop-hoa').value = loan['HOA Dues'] ? loan['HOA Dues'].toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '';
  /* Also populate calculator sidebar fields (annual for ins/tax/supp, monthly for HOA) */
  document.getElementById('calc-insurance').value = loan['HOI'] ? (loan['HOI'] * 12).toLocaleString() : '';
  document.getElementById('calc-taxes').value = loan['Property Taxes'] ? (loan['Property Taxes'] * 12).toLocaleString() : '';
  document.getElementById('calc-supp-insurance').value = loan['Supplemental Insurance'] ? (loan['Supplemental Insurance'] * 12).toLocaleString() : '';
  document.getElementById('calc-hoa').value = loan['HOA Dues'] ? loan['HOA Dues'].toLocaleString() : '';
  calcIncomeMode = 'annual';
  document.querySelectorAll('.calc-toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'annual'));
  /* Reset housing cost toggles to defaults: annual for ins/tax/supp, monthly for HOA */
  if (typeof calcInsMode !== 'undefined') calcInsMode = 'annual';
  if (typeof calcTaxMode !== 'undefined') calcTaxMode = 'annual';
  if (typeof calcSuppMode !== 'undefined') calcSuppMode = 'annual';
  if (typeof calcHOAMode !== 'undefined') calcHOAMode = 'monthly';
  document.querySelectorAll('.calc-ins-toggle').forEach(function(b) { b.classList.toggle('active', b.dataset.mode === 'annual'); });
  document.querySelectorAll('.calc-tax-toggle').forEach(function(b) { b.classList.toggle('active', b.dataset.mode === 'annual'); });
  document.querySelectorAll('.calc-supp-toggle').forEach(function(b) { b.classList.toggle('active', b.dataset.mode === 'annual'); });
  document.querySelectorAll('.calc-hoa-toggle').forEach(b => b.classList.toggle('active', b.dataset.mode === 'monthly'));
  /* Build Links section HTML (only first time) and populate values */
  buildLinksSection();
  setVal('link-application', loan['Link Application']);
  setVal('link-documents', loan['Link Documents']);
  setVal('link-lender-portal', loan['Link Lender Portal']);
  setVal('link-appraisal-portal', loan['Link Appraisal Portal']);
  setVal('link-other1-name', loan['Link Other 1 Name']);
  setVal('link-other1-url', loan['Link Other 1 URL']);
  setVal('link-other2-name', loan['Link Other 2 Name']);
  setVal('link-other2-url', loan['Link Other 2 URL']);
  setVal('link-other3-name', loan['Link Other 3 Name']);
  setVal('link-other3-url', loan['Link Other 3 URL']);
  refreshAllLinkButtons();
  /* v7.10: Build Income section and populate from loan data */
  buildIncomeSection(loan);
  /* v7.17: Build Assets section and populate from loan data */
  if (typeof buildAssetsSection === 'function') buildAssetsSection(loan);
  /* v8.3: Build Liabilities section and populate from loan data */
  if (typeof buildLiabilitiesSection === 'function') buildLiabilitiesSection(loan);
  /* v7.22: Build Purchase Agreement section and populate from loan data */
  if (typeof buildPurchaseAgreementSection === 'function') buildPurchaseAgreementSection(loan);
  updatePICalc();
  updateBorrowerNameBar();
  /* Auto-expand co-borrower if data exists, otherwise collapse */
  var hasCoBorrower = (document.getElementById('co-borrower-first').value || '').trim() ||
                      (document.getElementById('co-borrower-last').value || '').trim();
  if (hasCoBorrower) { expandCoBorrower(); } else { collapseCoBorrower(); }
  showSection('main');
  document.getElementById('loan-modal').classList.remove('hidden');
  /* Capture baseline for unsaved changes detection.
   * Use 500ms delay to ensure all async formatting (currency blur, module loads) settles. */
  setTimeout(captureFormSnapshot, 500);
}
async function loadTasks(loanId) {
  try { const d = await apiCall(\`/api/pipeline/tasks?loanId=\${loanId}\`); tasks = d.map(r => ({ id: r.id, ...r.fields })); renderTasks(); }
  catch (e) { console.error('Error loading tasks:', e); }
}
function renderTasks() {
  document.getElementById('task-list').innerHTML = tasks.map(t => \`<div class="task-item \${t.Completed?'completed':''}"><input type="checkbox" \${t.Completed?'checked':''} onchange="toggleTask('\${t.id}',this.checked)"><span class="task-name">\${escapeHtml(t['Task Name'])}</span><span class="task-due">\${t['Due Date']?new Date(t['Due Date']).toLocaleDateString():''}</span><button class="btn btn-sm" style="padding:4px 8px;color:#DC2626;" onclick="deleteTask('\${t.id}')">&times;</button></div>\`).join('');
}
async function toggleTask(id, done) {
  try { await apiCall(\`/api/pipeline/tasks/\${id}\`,'PUT',{Completed:done}); const t = tasks.find(x=>x.id===id); if(t)t.Completed=done; renderTasks(); }
  catch(e){console.error('Error updating task:',e);}
}
async function addTask() {
  const n = document.getElementById('new-task-name').value.trim(), d = document.getElementById('new-task-due').value;
  if (!n || !currentLoanId) return;
  try { const r = await apiCall('/api/pipeline/tasks','POST',{'Task Name':n,'Due Date':d||null,Loan:[currentLoanId]}); tasks.push({id:r.id,...r.fields}); renderTasks(); document.getElementById('new-task-name').value=''; document.getElementById('new-task-due').value=''; }
  catch(e){console.error('Error adding task:',e);}
}
async function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  try { await apiCall(\`/api/pipeline/tasks/\${id}\`,'DELETE'); tasks = tasks.filter(t=>t.id!==id); renderTasks(); }
  catch(e){console.error('Error deleting task:',e);}
}
/* ---- Unsaved changes tracking ---- */
var _formSnapshot = '';
function captureFormSnapshot() {
  var form = document.getElementById('loan-form');
  if (!form) { _formSnapshot = ''; return; }
  var data = {};
  form.querySelectorAll('input, select, textarea').forEach(function(el) {
    if (el.id) data[el.id] = el.value || '';
  });
  _formSnapshot = JSON.stringify(data);
}
function hasUnsavedChanges() {
  var form = document.getElementById('loan-form');
  if (!form || !_formSnapshot) return false;
  var data = {};
  form.querySelectorAll('input, select, textarea').forEach(function(el) {
    if (el.id) data[el.id] = el.value || '';
  });
  return JSON.stringify(data) !== _formSnapshot;
}
function closeModal() {
  if (hasUnsavedChanges()) {
    showUnsavedDialog();
    return;
  }
  forceCloseModal();
}
function forceCloseModal() {
  document.getElementById('loan-modal').classList.add('hidden');
  closeCalcSidebar();
  closeRefiSidebar();
  currentLoanId = null;
  lastCompFieldEdited = null;
  _formSnapshot = '';
}
/* ---- Unsaved changes dialog ---- */
function showUnsavedDialog() {
  /* Remove any existing dialog */
  var old = document.getElementById('unsaved-dialog-overlay');
  if (old) old.remove();
  /* Build overlay + dialog */
  var overlay = document.createElement('div');
  overlay.id = 'unsaved-dialog-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:100002;display:flex;align-items:center;justify-content:center;';
  var box = document.createElement('div');
  box.style.cssText = 'background:#fff;border-radius:12px;padding:28px 32px;max-width:420px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.25);text-align:center;font-family:inherit;';
  box.innerHTML = '<div style="font-size:36px;margin-bottom:12px;">⚠️</div>' +
    '<h3 style="margin:0 0 8px;font-size:18px;color:#1f2937;">Unsaved Changes</h3>' +
    '<p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.5;">You have unsaved changes. Would you like to save before closing?</p>' +
    '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">' +
      '<button id="unsaved-discard-btn" style="padding:9px 20px;border-radius:8px;border:1px solid #d1d5db;background:#fff;color:#374151;font-size:14px;font-weight:500;cursor:pointer;">Discard</button>' +
      '<button id="unsaved-cancel-btn" style="padding:9px 20px;border-radius:8px;border:1px solid #d1d5db;background:#f9fafb;color:#374151;font-size:14px;font-weight:500;cursor:pointer;">Keep Editing</button>' +
      '<button id="unsaved-save-btn" style="padding:9px 20px;border-radius:8px;border:none;background:#2563EB;color:#fff;font-size:14px;font-weight:600;cursor:pointer;">Save & Close</button>' +
    '</div>';
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  /* Button handlers */
  document.getElementById('unsaved-discard-btn').addEventListener('click', function() {
    overlay.remove();
    forceCloseModal();
  });
  document.getElementById('unsaved-cancel-btn').addEventListener('click', function() {
    overlay.remove();
  });
  document.getElementById('unsaved-save-btn').addEventListener('click', async function() {
    overlay.remove();
    await saveLoan();
    forceCloseModal();
  });
  /* Close on overlay background click */
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });
}
/* ---- Save toast — brief "Saved!" confirmation that fades out ---- */
function showSaveToast() {
  /* Remove any existing toast */
  var old = document.getElementById('save-toast');
  if (old) old.remove();
  /* Create toast element */
  var toast = document.createElement('div');
  toast.id = 'save-toast';
  toast.innerHTML = '<i class="fa-solid fa-check-circle"></i> Saved!';
  toast.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);background:#059669;color:#fff;padding:10px 24px;border-radius:8px;font-size:15px;font-weight:600;z-index:100001;display:flex;align-items:center;gap:8px;box-shadow:0 4px 12px rgba(0,0,0,0.2);opacity:0;transition:opacity 0.3s ease;';
  document.body.appendChild(toast);
  /* Fade in */
  requestAnimationFrame(function() { toast.style.opacity = '1'; });
  /* Fade out after 1.5s, remove after 2s */
  setTimeout(function() { toast.style.opacity = '0'; }, 1500);
  setTimeout(function() { toast.remove(); }, 2000);
}
async function saveLoan() {
  const lsv = document.getElementById('lock-status').value;
  const psv = document.getElementById('pay-status').value;
  /* -- Combine individual name fields into full names for table display & backward compat -- */
  const borrowerFirst = document.getElementById('borrower-first').value.trim();
  const borrowerMiddle = document.getElementById('borrower-middle').value.trim();
  const borrowerLast = document.getElementById('borrower-last').value.trim();
  const borrowerName = combineName(borrowerFirst, borrowerMiddle, borrowerLast);
  const coBorrowerFirst = document.getElementById('co-borrower-first').value.trim();
  const coBorrowerMiddle = document.getElementById('co-borrower-middle').value.trim();
  const coBorrowerLast = document.getElementById('co-borrower-last').value.trim();
  const coBorrowerName = combineName(coBorrowerFirst, coBorrowerMiddle, coBorrowerLast);
  const fields = {
    'Borrower Name': borrowerName,
    'Borrower First Name': borrowerFirst,
    'Borrower Middle Name': borrowerMiddle,
    'Borrower Last Name': borrowerLast,
    'Co-Borrower': coBorrowerName,
    'Co-Borrower First Name': coBorrowerFirst,
    'Co-Borrower Middle Name': coBorrowerMiddle,
    'Co-Borrower Last Name': coBorrowerLast,
    'Borrower Email': document.getElementById('borrower-email').value,
    'Borrower Phone': document.getElementById('borrower-phone').value,
    'Co-Borrower Email': document.getElementById('co-borrower-email').value,
    'Co-Borrower Phone': document.getElementById('co-borrower-phone').value,
    'Co-Borrower Role': document.getElementById('co-borrower-role').value,
    /* v7.11: Borrower/Co-Borrower DOB + SSN Last 4 */
    'Borrower DOB': document.getElementById('borrower-dob').value || null,
    'Borrower SSN Last 4': document.getElementById('borrower-ssn4').value,
    'Co-Borrower DOB': document.getElementById('co-borrower-dob').value || null,
    'Co-Borrower SSN Last 4': document.getElementById('co-borrower-ssn4').value,
    'Lender': document.getElementById('loan-lender').value,
    'Credit Pull Type': document.getElementById('credit-pull-type').value,
    'Credit Score': document.getElementById('credit-score').value ? parseInt(document.getElementById('credit-score').value) : null,
    'Date Credit Pulled': document.getElementById('date-credit-pulled').value || null,
    'Scores Pulled': document.getElementById('scores-pulled').value ? parseInt(document.getElementById('scores-pulled').value) : null,
    'Credit Vendor': document.getElementById('credit-vendor').value,
    'Credit Report Number': document.getElementById('credit-report-number').value,
    'Property Street': document.getElementById('property-street').value,
    'Property City': document.getElementById('property-city').value,
    'Property State': document.getElementById('property-state').value.toUpperCase(),
    'Property Zip': document.getElementById('property-zip').value,
    'Property Type': document.getElementById('property-type').value,
    'Property County': document.getElementById('property-county') ? document.getElementById('property-county').value : '',
    'Property Value': parseCurrency(document.getElementById('property-value').value),
    'Purchase Price': parseCurrency(document.getElementById('purchase-price').value),
    'Loan Purpose': document.getElementById('loan-purpose').value,
    'Loan Type': document.getElementById('loan-type').value,
    'Other Loan Type': document.getElementById('other-loan-type').value,
    'Occupancy': document.getElementById('occupancy').value,
    'Stage': document.getElementById('loan-stage').value,
    'Loan Amount': parseCurrency(document.getElementById('loan-amount').value),
    'Interest Rate': document.getElementById('loan-interest-rate').value ? parseFloat(document.getElementById('loan-interest-rate').value)/100 : null,
    'Qualifying Interest Rate': document.getElementById('qualifying-interest-rate').value ? parseFloat(document.getElementById('qualifying-interest-rate').value)/100 : null,
    'Loan Term': document.getElementById('loan-term').value ? parseInt(document.getElementById('loan-term').value) : null,
    'LTV': document.getElementById('ltv').value ? parseFloat(document.getElementById('ltv').value)/100 : null,
    'Expected Close': document.getElementById('expected-close').value || null,
    'Lead Source': document.getElementById('lead-source').value,
    'Notes': document.getElementById('loan-notes').value,
    /* v7.11: Deal Notes + Pricing Notes */
    'Deal Notes': document.getElementById('deal-notes') ? document.getElementById('deal-notes').value : '',
    'Pricing Notes': document.getElementById('pricing-notes') ? document.getElementById('pricing-notes').value : '',
    'Payroll Notes': document.getElementById('payroll-notes') ? document.getElementById('payroll-notes').value : '',
    'Comp BPS': document.getElementById('comp-bps').value ? parseFloat(document.getElementById('comp-bps').value) : null,
    'Compensation Amount': parseCurrency(document.getElementById('comp-amount-input').value),
    'Channel': document.getElementById('comp-channel').value || null,
    'Comp Type': document.getElementById('comp-type').value || null,
    /* v7.11: Points + YSP */
    'Points': document.getElementById('comp-points') && document.getElementById('comp-points').value ? parseFloat(document.getElementById('comp-points').value) : null,
    'YSP': document.getElementById('comp-ysp') && document.getElementById('comp-ysp').value ? parseFloat(document.getElementById('comp-ysp').value) : null,
    'HELOC Line Amount': parseCurrency(document.getElementById('heloc-line-amount').value),
    'HELOC Initial Draw': parseCurrency(document.getElementById('heloc-initial-draw').value),
    /* v7.19: Equity Loan subordinate financing fields */
    'Lien Position': document.getElementById('lien-position').value || null,
    'Existing 1st Mortgage Balance': parseCurrency(document.getElementById('existing-1st-balance').value) || null,
    'Existing 2nd Mortgage Balance': parseCurrency(document.getElementById('existing-2nd-balance').value) || null,
    'Max CLTV': document.getElementById('max-cltv').value ? parseFloat(document.getElementById('max-cltv').value) / 100 : null,
    'Lock Status': (lsv && lsv !== '-') ? lsv : null,
    'Lock Date': document.getElementById('lock-date').value || null,
    'Lock Expiration Date': document.getElementById('lock-expiration-date').value || null,
    'Pay Status': (psv && psv !== '-') ? psv : null,
    'Payroll Submitted Date': document.getElementById('payroll-submitted-date').value || null,
    'Payroll Processed Date': document.getElementById('payroll-processed-date').value || null,
    'Pay Received Date': document.getElementById('pay-received-date').value || null,
    'Last Contact Date': document.getElementById('last-contact-date').value || null,
    'Gross Annual Income': (() => { const v = parseCurrency(document.getElementById('calc-income').value); return v ? (calcIncomeMode === 'monthly' ? v * 12 : v) : null; })(),
    'Monthly Debt Payments': parseCurrency(document.getElementById('calc-debts').value) || null,
    'Target DTI': document.getElementById('calc-dti').value ? parseFloat(document.getElementById('calc-dti').value)/100 : null,
    /* Housing costs — read from Property section, convert to MONTHLY for Airtable storage */
    'HOI': (() => { const v = parseCurrency(document.getElementById('prop-hoi').value); return v ? v / 12 : null; })(),
    'Property Taxes': (() => { const v = parseCurrency(document.getElementById('prop-taxes').value); return v ? v / 12 : null; })(),
    'Supplemental Insurance': (() => { const v = parseCurrency(document.getElementById('prop-supp-ins').value); return v ? v / 12 : null; })(),
    'HOA Dues': parseCurrency(document.getElementById('prop-hoa').value) || null,
    'Afford Max Purchase': parseCurrency(document.getElementById('calc-max-purchase').textContent) || null,
    'Afford Max Loan Amt': parseCurrency(document.getElementById('calc-max-loan').textContent) || null,
    'Afford Max PITIA': parseCurrency(document.getElementById('calc-max-pitia').textContent) || null,
    /* Links section */
    'Link Application': document.getElementById('link-application') ? document.getElementById('link-application').value : '',
    'Link Documents': document.getElementById('link-documents') ? document.getElementById('link-documents').value : '',
    'Link Lender Portal': document.getElementById('link-lender-portal') ? document.getElementById('link-lender-portal').value : '',
    'Link Appraisal Portal': document.getElementById('link-appraisal-portal') ? document.getElementById('link-appraisal-portal').value : '',
    'Link Other 1 Name': document.getElementById('link-other1-name') ? document.getElementById('link-other1-name').value : '',
    'Link Other 1 URL': document.getElementById('link-other1-url') ? document.getElementById('link-other1-url').value : '',
    'Link Other 2 Name': document.getElementById('link-other2-name') ? document.getElementById('link-other2-name').value : '',
    'Link Other 2 URL': document.getElementById('link-other2-url') ? document.getElementById('link-other2-url').value : '',
    'Link Other 3 Name': document.getElementById('link-other3-name') ? document.getElementById('link-other3-name').value : '',
    'Link Other 3 URL': document.getElementById('link-other3-url') ? document.getElementById('link-other3-url').value : '',
    /* v7.10: Income — totals stored as ANNUAL numbers, details as JSON */
    'Borrower Income': (() => { var el = document.getElementById('borrower-income'); if (!el) return null; var v = parseCurrency(el.value); return v ? (borrowerIncomeMode === 'monthly' ? v * 12 : v) : null; })(),
    'Co-Borrower Income': (() => { var el = document.getElementById('coborrower-income'); if (!el) return null; var v = parseCurrency(el.value); return v ? (coBorrowerIncomeMode === 'monthly' ? v * 12 : v) : null; })(),
    'Income Notes': document.getElementById('income-notes') ? document.getElementById('income-notes').value : '',
    'Borrower Income Details': getIncomeDetailsJSON('borrower'),
    'Co-Borrower Income Details': getIncomeDetailsJSON('coborrower'),
    /* v7.17: Assets tab fields */
    'Down Payment': parseCurrency(document.getElementById('asset-down-payment') ? document.getElementById('asset-down-payment').value : '') || null,
    'Closing Costs': parseCurrency(document.getElementById('asset-closing-costs') ? document.getElementById('asset-closing-costs').value : '') || null,
    'Months of Reserves': document.getElementById('asset-months-reserves') && document.getElementById('asset-months-reserves').value ? parseInt(document.getElementById('asset-months-reserves').value) : null,
    'Estimated Monthly Payment': parseCurrency(document.getElementById('asset-est-monthly-pmt') ? document.getElementById('asset-est-monthly-pmt').value : '') || null,
    'Other Reserves Months': document.getElementById('asset-other-months') && document.getElementById('asset-other-months').value ? parseInt(document.getElementById('asset-other-months').value) : null,
    'Other Reserves Monthly Amount': parseCurrency(document.getElementById('asset-other-monthly-amt') ? document.getElementById('asset-other-monthly-amt').value : '') || null,
    'Other Reserves Total': parseCurrency(document.getElementById('asset-other-total') ? document.getElementById('asset-other-total').value : '') || null,
    'Asset Accounts': (typeof getAssetAccountsJSON === 'function') ? getAssetAccountsJSON() : '',
    /* v8.3: Liabilities tab — stored as JSON like Asset Accounts */
    'Liabilities JSON': (typeof getLiabilitiesJSON === 'function') ? getLiabilitiesJSON() : '',
    'Liabilities Notes': document.getElementById('liabilities-notes') ? document.getElementById('liabilities-notes').value : '',
    /* v8.3: Loan Details Notes (renamed from Pricing Notes position) */
    'Loan Details Notes': document.getElementById('loan-details-notes') ? document.getElementById('loan-details-notes').value : '',
    /* v7.22: Purchase Agreement tab — all fields stored as single JSON blob */
    'Purchase Agreement JSON': (typeof getPurchaseAgreementJSON === 'function') ? getPurchaseAgreementJSON() : ''
  };
  if (!borrowerName) { alert('Borrower First and Last Name are required'); return; }
  if (!fields['Stage']) { alert('Stage is required'); return; }
  Object.keys(fields).forEach(k => { if (fields[k] === '' || fields[k] === null) delete fields[k]; });
  const loanId = document.getElementById('loan-id').value;
  if (loanId) { const i = loans.findIndex(l => l.id === loanId); if (i !== -1) loans[i] = { ...loans[i], ...fields }; }
  else loans.push({ id: 'temp_' + Date.now(), ...fields });
  updateStats(); renderCurrentView(); clearPipelineCache();
  try {
    if (loanId) {
      await apiCall(\`/api/pipeline/loans/\${loanId}\`, 'PUT', fields);
    } else {
      const d = await apiCall('/api/pipeline/loans', 'POST', fields);
      const t = loans.find(l => l.id.startsWith('temp_'));
      if (t) t.id = d.id;
      /* Update currentLoanId and hidden field so subsequent saves update, not create */
      currentLoanId = d.id;
      document.getElementById('loan-id').value = d.id;
      /* Show the delete button now that the loan exists in Airtable */
      const delBtn = document.getElementById('delete-loan-btn');
      if (delBtn) delBtn.classList.remove('hidden');
    }
    showSaveToast();
    /* Reset baseline so only post-save changes trigger the unsaved warning.
     * Capture immediately AND after a short delay to account for any async
     * formatting (currency blur handlers, checklist auto-save, etc.) that
     * may change form field values after save completes. */
    captureFormSnapshot();
    setTimeout(captureFormSnapshot, 300);
  } catch (e) { console.error('Error saving loan:', e); alert('Warning: Changes may not have been saved. Please refresh.'); await loadLoans(true); }
}
async function deleteLoan() {
  if (!currentLoanId || !confirm('Are you sure you want to delete this loan? This cannot be undone.')) return;
  loans = loans.filter(l => l.id !== currentLoanId);
  updateStats(); renderCurrentView(); forceCloseModal(); clearPipelineCache();
  try { await apiCall(\`/api/pipeline/loans/\${currentLoanId}\`, 'DELETE'); }
  catch (e) { console.error('Error deleting loan:', e); alert('Warning: Deletion may not have been saved. Please refresh.'); await loadLoans(true); }
}
/* ---- Evaluate math expressions like 240*12 ---- */
function evaluateExpression(str) {
  if (!str) return null;
  var cleaned = str.replace(/[$,\\s]/g, '');
  if (/^[\\d.+\\-*/()]+$/.test(cleaned) && cleaned.length > 0) {
    try {
      var result = Function('"use strict"; return (' + cleaned + ')')();
      if (typeof result === 'number' && isFinite(result)) return result;
    } catch (e) { /* fall through */ }
  }
  var n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}
function formatCurrency(input) {
  var decimals = parseInt(input.getAttribute('data-decimals')) || 0;
  var result = evaluateExpression(input.value);
  if (result !== null && result > 0) {
    if (decimals > 0) {
      input.value = result.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    } else {
      input.value = result.toLocaleString('en-US', { maximumFractionDigits: 0 });
    }
  } else if (input.value.trim() !== '') {
    input.value = '';
  }
}
function unformatCurrency(input) {
  var hasCalc = input.classList.contains('payment-calc-input');
  if (hasCalc) {
    input.value = input.value.replace(/[$,]/g, '');
  } else {
    input.value = input.value.replace(/[^\\d.]/g, '');
  }
}
function parseCurrency(val) { if (!val) return null; return evaluateExpression(val); }

/* ══════════════════════════════════════════════════════════════
   v7.31: PHONE FORMATTING + SSN MASKING
   ══════════════════════════════════════════════════════════════ */

/* --- Phone: auto-format as (XXX) XXX-XXXX while typing --- */
function formatPhoneValue(val) {
  var digits = val.replace(/\\D/g, '');
  if (digits.length === 0) return '';
  if (digits.length <= 3) return '(' + digits;
  if (digits.length <= 6) return '(' + digits.slice(0,3) + ') ' + digits.slice(3);
  return '(' + digits.slice(0,3) + ') ' + digits.slice(3,6) + '-' + digits.slice(6,10);
}
function stripPhoneFormat(val) { return val.replace(/\\D/g, ''); }

function wirePhoneInput(inputId) {
  var el = document.getElementById(inputId);
  if (!el) return;
  /* Format on input (as-you-type) */
  el.addEventListener('input', function() {
    var cursor = el.selectionStart;
    var beforeLen = el.value.length;
    el.value = formatPhoneValue(el.value);
    var afterLen = el.value.length;
    /* Adjust cursor so it doesn't jump */
    var newCursor = cursor + (afterLen - beforeLen);
    el.setSelectionRange(newCursor, newCursor);
  });
  /* Format any pre-filled value on modal open */
  if (el.value) el.value = formatPhoneValue(el.value);
}

/* --- SSN Last 4: mask with dots + eye toggle --- */
function wireSSNMasking(inputId) {
  var el = document.getElementById(inputId);
  if (!el) return;
  /* Only proceed if not already wired */
  if (el.dataset.ssnWired) return;
  el.dataset.ssnWired = 'true';

  /* Create wrapper for the toggle icon */
  var wrapper = el.parentElement;
  if (wrapper) {
    wrapper.style.position = 'relative';
    var toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'ssn-toggle-btn';
    toggleBtn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
    toggleBtn.title = 'Show/hide SSN';
    toggleBtn.style.cssText = 'position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#6b7280;padding:4px;font-size:13px;z-index:2;';
    wrapper.appendChild(toggleBtn);
    el.style.paddingRight = '32px';

    var masked = true;
    function updateMask() {
      if (masked && el.value) {
        el.type = 'password';
        toggleBtn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
        toggleBtn.title = 'Show SSN';
      } else {
        el.type = 'text';
        toggleBtn.innerHTML = '<i class="fa-solid fa-eye"></i>';
        toggleBtn.title = 'Hide SSN';
      }
    }
    toggleBtn.addEventListener('click', function(e) {
      e.preventDefault();
      masked = !masked;
      updateMask();
    });
    /* Default to masked */
    updateMask();
    /* Re-mask when modal opens (listener on value changes) */
    el.addEventListener('focus', function() { /* keep current state */ });
  }
}

/* Wire everything once DOM is ready */
function initInputFormatters() {
  wirePhoneInput('borrower-phone');
  wirePhoneInput('co-borrower-phone');
  wireSSNMasking('borrower-ssn4');
  wireSSNMasking('co-borrower-ssn4');
}

/* Hook into modal open — re-format phone values loaded from Airtable */
var _origOpenLoanModal = window.openLoanModal;
if (typeof _origOpenLoanModal === 'function') {
  window.openLoanModal = async function(id) {
    await _origOpenLoanModal(id);
    /* Format phone numbers that were loaded */
    var bp = document.getElementById('borrower-phone');
    if (bp && bp.value) bp.value = formatPhoneValue(bp.value);
    var cp = document.getElementById('co-borrower-phone');
    if (cp && cp.value) cp.value = formatPhoneValue(cp.value);
    /* Re-mask SSN fields */
    var bs = document.getElementById('borrower-ssn4');
    if (bs) bs.type = 'password';
    var cs = document.getElementById('co-borrower-ssn4');
    if (cs) cs.type = 'password';
  };
}
var _origOpenNewLoanModal = window.openNewLoanModal;
if (typeof _origOpenNewLoanModal === 'function') {
  window.openNewLoanModal = function() {
    _origOpenNewLoanModal();
    /* Wire formatters for new loan modal too */
    wirePhoneInput('borrower-phone');
    wirePhoneInput('co-borrower-phone');
  };
}

/* Strip phone formatting before save — so Airtable gets clean digits */
var _origSaveLoan = window.saveLoan;
if (typeof _origSaveLoan === 'function') {
  window.saveLoan = async function() {
    /* Strip phone formatting to save raw digits */
    var bp = document.getElementById('borrower-phone');
    if (bp) bp.value = stripPhoneFormat(bp.value);
    var cp = document.getElementById('co-borrower-phone');
    if (cp) cp.value = stripPhoneFormat(cp.value);
    /* Ensure SSN field is text type so .value reads correctly */
    var bs = document.getElementById('borrower-ssn4');
    if (bs) bs.type = 'text';
    var cs = document.getElementById('co-borrower-ssn4');
    if (cs) cs.type = 'text';
    /* Call original save */
    await _origSaveLoan();
    /* Re-format phone after save */
    if (bp && bp.value) bp.value = formatPhoneValue(bp.value);
    if (cp && cp.value) cp.value = formatPhoneValue(cp.value);
    /* Re-mask SSN after save */
    if (bs) bs.type = 'password';
    if (cs) cs.type = 'password';
  };
}

/* Initialize on DOMContentLoaded or immediately if already loaded */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initInputFormatters);
} else {
  setTimeout(initInputFormatters, 200);
}`;
  return new Response(jsContent, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
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
 * Pipeline Calculators Module v3.5
 * External JS loaded after main pipeline script
 * Served from: /static/pipeline-calcs.js via Cloudflare Worker
 *
 * v3.5 Changes:
 *   - launchCalculator now routes 'Closing Costs' to showClosingCostsSidebar()
 *
 * v3.3 Changes:
 *   - Added self-contained debounce function (fixes ReferenceError when loaded before app JS)
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
 * Dependencies (from main pipeline script):
 *   - parseCurrency(val) — used inside functions, safe with defer loading
 *   - currentLoanId (global from main script)
 *
 * Globals exposed (called from HTML onclick handlers):
 *   - launchCalculator, showCalcSidebar, closeCalcSidebar
 *   - showRefiSidebar, closeRefiSidebar, runRefiCalc
 *   - toggleIncomeMode, toggleCalcTaxMode, toggleCalcInsMode, toggleCalcSuppMode
 *   - toggleCalcHOAMode
 *   - runAffordCalc
 */

/* ---- Utility: debounce (defined here so calcs module is self-contained) ---- */
if (typeof debounce === 'undefined') {
  var debounce = function(func, wait) {
    var timeout;
    return function() {
      var context = this, args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(function() { func.apply(context, args); }, wait);
    };
  };
}

/* ---- Toggle state trackers ---- */
var calcIncomeMode = 'annual';
var calcTaxMode    = 'annual';
var calcInsMode    = 'annual';
var calcSuppMode   = 'annual';
var calcHOAMode    = 'monthly';

/* ============================================================
   v7.10: HYBRID INCOME SYSTEM
   Main view: quick totals per person with Ann/Mo toggle + Details button.
   Details button opens a modal with table-style source rows.
   SE Doc includes "Bank Statements" option — when selected, BS Period + Exp Factor appear.
   Totals saved to Borrower/Co-Borrower Income (number).
   Detail lines saved as JSON to Borrower/Co-Borrower Income Details (longText).
   ============================================================ */
var borrowerIncomeMode = 'annual';
var coBorrowerIncomeMode = 'annual';
var incSrcCounters = { borrower: 0, coborrower: 0 };
/* Cached detail lines per person (kept in memory, written to Airtable on loan save) */
var incDetails = { borrower: [], coborrower: [] };
/* BS Analysis data per source row index */
var incBsData = {};

var EMP_TYPES = ['W-2 Hourly','W-2 Salary','Self-Employed','1099 Only','Other'];
var SE_DOC_TYPES = ['Schedule C','K-1 (1065)','K-1 (1120S)','C-Corp (1120)','Schedule E','Bank Statements','Other'];

/* ---- Build the entire Income section HTML ---- */
function buildIncomeSection(loan) {
  var c = document.getElementById('income-section-content');
  if (!c) return;
  borrowerIncomeMode = 'annual';
  coBorrowerIncomeMode = 'annual';
  incSrcCounters = { borrower: 0, coborrower: 0 };
  incDetails = { borrower: [], coborrower: [] };
  incBsData = {};
  c.innerHTML = ''
    + incPersonHTML('borrower', 'Borrower')
    + '<div class="inc-div"></div>'
    + incPersonHTML('coborrower', 'Co-Borrower')
    + '<div class="inc-div"></div>'
    + '<div class="inc-combined"><span class="inc-comb-lbl">Combined annual income</span><span class="inc-comb-val" id="inc-combined-display">\\u2014</span></div>'
    + '<div class="inc-notes"><div class="inc-notes-lbl">Income notes</div><textarea class="fc" id="income-notes" placeholder="Employment, verification, other sources..."></textarea></div>';
  /* Wire currency formatting + combined update on total inputs */
  ['borrower-income','coborrower-income'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('blur', function(){ formatCurrency(el); });
      el.addEventListener('focus', function(){ unformatCurrency(el); });
      el.addEventListener('input', debounce(updateCombinedIncome, 300));
    }
  });
  /* Populate from loan data */
  if (loan) {
    var bInc = document.getElementById('borrower-income');
    if (bInc && loan['Borrower Income']) bInc.value = loan['Borrower Income'].toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    var cInc = document.getElementById('coborrower-income');
    if (cInc && loan['Co-Borrower Income']) cInc.value = loan['Co-Borrower Income'].toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    var notesEl = document.getElementById('income-notes');
    if (notesEl && loan['Income Notes']) notesEl.value = loan['Income Notes'];
    /* Parse saved detail lines into memory */
    incDetails.borrower = parseIncJSON(loan['Borrower Income Details']);
    incDetails.coborrower = parseIncJSON(loan['Co-Borrower Income Details']);
  }
  updateDetailBtnCounts();
  updateCombinedIncome();
}

/* Build one person row HTML */
function incPersonHTML(who, label) {
  return '<div class="inc-hdr">' + label + '</div>'
    + '<div class="inc-row">'
    +   '<span class="inc-lbl">Total</span>'
    +   '<div class="inc-iw"><span class="inc-dlr">$</span><input type="text" class="fc currency-input inc-inp" id="' + who + '-income" placeholder="0"></div>'
    +   '<div class="inc-tog"><button type="button" class="inc-tbtn active" data-mode="annual" data-target="' + who + '" onclick="toggleIncTotalMode(\\'' + who + '\\',\\'annual\\')">Ann</button><button type="button" class="inc-tbtn" data-mode="monthly" data-target="' + who + '" onclick="toggleIncTotalMode(\\'' + who + '\\',\\'monthly\\')">Mo</button></div>'
    +   '<button type="button" class="inc-dbtn" id="inc-dbtn-' + who + '" onclick="openIncomeModal(\\'' + who + '\\')">Details</button>'
    + '</div>';
}

/* Toggle Annual/Monthly on the total field */
function toggleIncTotalMode(who, mode) {
  var inp = document.getElementById(who + '-income');
  if (!inp) return;
  var curMode = (who === 'coborrower') ? coBorrowerIncomeMode : borrowerIncomeMode;
  var curVal = parseCurrency(inp.value) || 0;
  if (mode === 'monthly' && curMode === 'annual' && curVal > 0) inp.value = (curVal / 12).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  else if (mode === 'annual' && curMode === 'monthly' && curVal > 0) inp.value = (curVal * 12).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  if (who === 'coborrower') coBorrowerIncomeMode = mode; else borrowerIncomeMode = mode;
  document.querySelectorAll('.inc-tbtn[data-target="' + who + '"]').forEach(function(b) { b.classList.toggle('active', b.dataset.mode === mode); });
  updateCombinedIncome();
}
function toggleBorrowerIncomeMode(m) { toggleIncTotalMode('borrower', m); }
function toggleCoBorrowerIncomeMode(m) { toggleIncTotalMode('coborrower', m); }

/* Update combined annual income display */
function updateCombinedIncome() {
  var bVal = parseCurrency(document.getElementById('borrower-income') ? document.getElementById('borrower-income').value : '') || 0;
  var cVal = parseCurrency(document.getElementById('coborrower-income') ? document.getElementById('coborrower-income').value : '') || 0;
  var bAnnual = (borrowerIncomeMode === 'monthly') ? bVal * 12 : bVal;
  var cAnnual = (coBorrowerIncomeMode === 'monthly') ? cVal * 12 : cVal;
  var total = bAnnual + cAnnual;
  var display = document.getElementById('inc-combined-display');
  if (display) display.textContent = total > 0 ? '$' + total.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '\\u2014';
}

/* Sync Income Tab total into Affordability Calculator Gross Income field */
function syncIncomeFromTab() {
  var bVal = parseCurrency(document.getElementById('borrower-income') ? document.getElementById('borrower-income').value : '') || 0;
  var cVal = parseCurrency(document.getElementById('coborrower-income') ? document.getElementById('coborrower-income').value : '') || 0;
  var bAnnual = (borrowerIncomeMode === 'monthly') ? bVal * 12 : bVal;
  var cAnnual = (coBorrowerIncomeMode === 'monthly') ? cVal * 12 : cVal;
  var combined = bAnnual + cAnnual;
  var calcIncome = document.getElementById('calc-income');
  var msg = document.getElementById('calc-income-sync-msg');
  if (combined <= 0) {
    if (msg) { msg.textContent = 'No income entered on Income tab'; msg.style.color = '#DC2626'; setTimeout(function(){ msg.textContent = ''; }, 3000); }
    return;
  }
  /* Set the calc income field to annual combined */
  if (calcIncome) {
    calcIncome.value = combined.toLocaleString('en-US');
    calcIncome.dispatchEvent(new Event('input', { bubbles: true }));
  }
  /* Ensure calc toggle is on Annual */
  if (typeof calcIncomeMode !== 'undefined' && calcIncomeMode !== 'annual') {
    toggleIncomeMode('annual');
  }
  if (msg) { msg.textContent = '$' + combined.toLocaleString('en-US') + ' applied'; msg.style.color = '#166534'; setTimeout(function(){ msg.textContent = ''; }, 3000); }
  if (typeof runAffordCalc === 'function') runAffordCalc();
}

/* Update detail button badge counts */
function updateDetailBtnCounts() {
  ['borrower','coborrower'].forEach(function(who) {
    var btn = document.getElementById('inc-dbtn-' + who);
    if (!btn) return;
    var n = incDetails[who].length;
    btn.innerHTML = n > 0 ? 'Details<span class="inc-cnt"> (' + n + ')</span>' : 'Details';
  });
}

/* Parse JSON string to array (safe) */
function parseIncJSON(str) {
  if (!str) return [];
  try { var arr = JSON.parse(str); return Array.isArray(arr) ? arr : []; }
  catch(e) { return []; }
}

/* Serialize in-memory details to JSON string for Airtable save */
function getIncomeDetailsJSON(who) {
  var arr = incDetails[who];
  if (!arr || arr.length === 0) return '';
  return JSON.stringify(arr);
}

/* Build select options HTML */
function incBuildOpts(arr, selected) {
  var h = '<option value="">\\u2014 Select \\u2014</option>';
  arr.forEach(function(v) { h += '<option value="' + v + '"' + (v === selected ? ' selected' : '') + '>' + v + '</option>'; });
  return h;
}

/* ---- INCOME DETAIL MODAL ---- */
var incModalWho = null; /* which person the modal is open for */
var incModalSrcCounter = 0;

function openIncomeModal(who) {
  incModalWho = who;
  incModalSrcCounter = 0;
  var label = (who === 'coborrower') ? 'Co-Borrower' : 'Borrower';
  /* Remove any existing modal */
  var old = document.getElementById('inc-modal-overlay');
  if (old) old.remove();
  /* Build modal */
  var overlay = document.createElement('div');
  overlay.className = 'inc-modal-bg';
  overlay.id = 'inc-modal-overlay';
  overlay.innerHTML = '<div class="inc-modal">'
    + '<div class="inc-modal-hdr"><span class="inc-modal-title">' + label + ' \\u2014 income sources</span><span class="inc-modal-close" onclick="closeIncomeModal(false)">\\u2715</span></div>'
    + '<div class="inc-modal-body">'
    +   '<table><thead><tr>'
    +     '<th style="width:68px"></th>'
    +     '<th>Employment type</th>'
    +     '<th>SE documentation</th>'
    +     '<th style="min-width:130px">Amount (annual)</th>'
    +     '<th style="width:130px"></th>'
    +     '<th style="width:28px"></th>'
    +   '</tr></thead><tbody id="inc-modal-tbody"></tbody></table>'
    +   '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 8px 0;">'
    +     '<span class="inc-modal-add" onclick="addModalSource()">+ Add source</span>'
    +     '<span class="inc-modal-sum" id="inc-modal-sum"></span>'
    +   '</div>'
    + '</div>'
    + '<div class="inc-modal-foot">'
    +   '<button type="button" class="inc-modal-btn inc-modal-cancel" onclick="closeIncomeModal(false)">Cancel</button>'
    +   '<button type="button" class="inc-modal-btn inc-modal-apply" onclick="closeIncomeModal(true)">Apply to total</button>'
    + '</div>'
    + '</div>';
  /* Close on backdrop click */
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeIncomeModal(false); });
  document.body.appendChild(overlay);
  /* Populate existing sources */
  var sources = incDetails[who];
  if (sources.length > 0) {
    sources.forEach(function(d) { addModalSource(d); });
  } else {
    addModalSource(); /* start with one empty row */
  }
  updateModalSum();
}

function addModalSource(data) {
  var tbody = document.getElementById('inc-modal-tbody');
  if (!tbody) return;
  var idx = incModalSrcCounter++;
  var rid = 'ims-' + idx;
  var d = data || {};
  var isBs = (d.seDoc === 'Bank Statements');
  /* Store BS data in memory keyed by idx */
  if (isBs && d.totalDeposits) {
    incBsData[idx] = { bsPeriod: d.bsPeriod || '', totalDeposits: d.totalDeposits || 0, expFactor: d.expFactor != null ? d.expFactor : '' };
  }
  var amtReadonly = isBs ? ' readonly style="background:#F1F5F9;cursor:not-allowed;width:100%"' : '';
  var amtVal = d.amount ? d.amount.toLocaleString('en-US') : '';
  var tr = document.createElement('tr');
  tr.id = rid;
  tr.innerHTML = ''
    + '<td class="src-lbl">Source ' + (idx + 1) + '</td>'
    + '<td><select id="' + rid + '-type" onchange="onModalTypeChange(' + idx + ')">' + incBuildOpts(EMP_TYPES, d.type || '') + '</select></td>'
    + '<td id="' + rid + '-se-cell">' + (isSeVisible(d.type) ? '<select id="' + rid + '-se" onchange="onModalSeChange(' + idx + ')">' + incBuildOpts(SE_DOC_TYPES, d.seDoc || '') + '</select>' : '<span class="src-na">n/a</span>') + '</td>'
    + '<td><div class="src-amt"><span>$</span><input type="text" id="' + rid + '-amt" value="' + amtVal + '" oninput="updateModalSum()"' + amtReadonly + '></div></td>'
    + '<td id="' + rid + '-bs-cell">' + (isBs ? '<button type="button" class="inc-bs-btn' + (d.totalDeposits ? ' has-data' : '') + '" onclick="openBsAnalysis(' + idx + ')"><i class="fa-solid fa-university"></i> BS Analysis</button>' : '') + '</td>'
    + '<td><span class="src-del" onclick="removeModalSource(' + idx + ')">\\u2715</span></td>';
  tbody.appendChild(tr);
  updateModalSum();
}

function isSeVisible(type) { return type === 'Self-Employed' || type === '1099 Only'; }

function onModalTypeChange(idx) {
  var rid = 'ims-' + idx;
  var typeEl = document.getElementById(rid + '-type');
  if (!typeEl) return;
  var seCell = document.getElementById(rid + '-se-cell');
  if (!seCell) return;
  if (isSeVisible(typeEl.value)) {
    seCell.innerHTML = '<select id="' + rid + '-se" onchange="onModalSeChange(' + idx + ')">' + incBuildOpts(SE_DOC_TYPES, '') + '</select>';
  } else {
    seCell.innerHTML = '<span class="src-na">n/a</span>';
    /* Clear BS button and data since SE Doc is gone */
    clearBsForSource(idx);
  }
}

function onModalSeChange(idx) {
  var rid = 'ims-' + idx;
  var seEl = document.getElementById(rid + '-se');
  var bsCell = document.getElementById(rid + '-bs-cell');
  var amtEl = document.getElementById(rid + '-amt');
  if (!seEl) return;
  var isBs = (seEl.value === 'Bank Statements');
  /* Show/hide BS Analysis button */
  if (bsCell) bsCell.innerHTML = isBs ? '<button type="button" class="inc-bs-btn" onclick="openBsAnalysis(' + idx + ')"><i class="fa-solid fa-university"></i> BS Analysis</button>' : '';
  /* Toggle Amount readonly */
  if (amtEl) {
    if (isBs) { amtEl.readOnly = true; amtEl.style.background = '#F1F5F9'; amtEl.style.cursor = 'not-allowed'; amtEl.value = ''; }
    else { amtEl.readOnly = false; amtEl.style.background = ''; amtEl.style.cursor = ''; }
  }
  /* Clear BS data if switching away */
  if (!isBs) clearBsForSource(idx);
  updateModalSum();
}

function clearBsForSource(idx) {
  var rid = 'ims-' + idx;
  var bsCell = document.getElementById(rid + '-bs-cell');
  if (bsCell) bsCell.innerHTML = '';
  delete incBsData[idx];
  /* Make Amount editable again */
  var amtEl = document.getElementById(rid + '-amt');
  if (amtEl) { amtEl.readOnly = false; amtEl.style.background = ''; amtEl.style.cursor = ''; }
}

/* ---- BS Analysis Sub-Modal ---- */
var bsModalIdx = null; /* which source row the BS modal is open for */

function openBsAnalysis(idx) {
  bsModalIdx = idx;
  var d = incBsData[idx] || {};
  /* Remove any existing BS modal */
  var old = document.getElementById('inc-bs-overlay');
  if (old) old.remove();
  var overlay = document.createElement('div');
  overlay.className = 'inc-bs-modal-bg';
  overlay.id = 'inc-bs-overlay';
  overlay.innerHTML = '<div class="inc-bs-modal">'
    + '<div class="inc-bs-modal-hdr"><span><i class="fa-solid fa-university"></i> Bank Statement Analysis</span><span class="inc-bs-close" onclick="closeBsAnalysis(false)">\\u2715</span></div>'
    + '<div class="inc-bs-modal-body">'
    +   '<div class="inc-bs-field"><label>Statement Period</label><select id="bs-period"><option value="">\\u2014 Select \\u2014</option><option value="12 Months"' + (d.bsPeriod === '12 Months' ? ' selected' : '') + '>12 Months</option><option value="24 Months"' + (d.bsPeriod === '24 Months' ? ' selected' : '') + '>24 Months</option></select></div>'
    +   '<div class="inc-bs-field"><label>Total Deposits ($)</label><div style="display:flex;align-items:center;gap:4px;"><span style="font-size:14px;color:#64748B;">$</span><input type="text" id="bs-deposits" value="' + (d.totalDeposits ? d.totalDeposits.toLocaleString('en-US') : '') + '" oninput="calcBsResult()" placeholder="0"></div></div>'
    +   '<div class="inc-bs-field"><label>Expense Factor (%)</label><div style="display:flex;align-items:center;gap:4px;"><input type="number" id="bs-exp-factor" value="' + (d.expFactor != null && d.expFactor !== '' ? d.expFactor : '') + '" placeholder="50" step="0.01" min="0" max="100" oninput="calcBsResult()" style="flex:1;"><span style="font-size:14px;color:#64748B;">%</span></div></div>'
    +   '<div class="inc-bs-result"><span class="inc-bs-result-lbl">Calculated annual income</span><span class="inc-bs-result-val" id="bs-result-val">\\u2014</span></div>'
    + '</div>'
    + '<div class="inc-bs-modal-foot">'
    +   '<button type="button" class="inc-modal-btn inc-modal-cancel" onclick="closeBsAnalysis(false)">Cancel</button>'
    +   '<button type="button" class="inc-modal-btn inc-modal-apply" onclick="closeBsAnalysis(true)">Apply</button>'
    + '</div>'
    + '</div>';
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeBsAnalysis(false); });
  document.body.appendChild(overlay);
  calcBsResult();
}

function calcBsResult() {
  var depEl = document.getElementById('bs-deposits');
  var efEl = document.getElementById('bs-exp-factor');
  var resEl = document.getElementById('bs-result-val');
  var deposits = depEl ? (parseCurrency(depEl.value) || 0) : 0;
  var expPct = efEl ? (parseFloat(efEl.value) || 0) : 0;
  var income = deposits > 0 ? deposits * (1 - expPct / 100) : 0;
  income = Math.round(income * 100) / 100;
  if (resEl) resEl.textContent = income > 0 ? '$' + income.toLocaleString('en-US') : '\\u2014';
}

function closeBsAnalysis(apply) {
  if (apply && bsModalIdx != null) {
    var depEl = document.getElementById('bs-deposits');
    var efEl = document.getElementById('bs-exp-factor');
    var perEl = document.getElementById('bs-period');
    var deposits = depEl ? (parseCurrency(depEl.value) || 0) : 0;
    var expPct = efEl ? (parseFloat(efEl.value) || 0) : 0;
    var income = deposits > 0 ? deposits * (1 - expPct / 100) : 0;
    income = Math.round(income * 100) / 100;
    /* Store BS data in memory */
    incBsData[bsModalIdx] = {
      bsPeriod: perEl ? perEl.value : '',
      totalDeposits: deposits,
      expFactor: expPct || null
    };
    /* Write calculated income to Amount field */
    var amtEl = document.getElementById('ims-' + bsModalIdx + '-amt');
    if (amtEl) amtEl.value = income > 0 ? income.toLocaleString('en-US') : '';
    /* Update button to show it has data */
    var bsCell = document.getElementById('ims-' + bsModalIdx + '-bs-cell');
    if (bsCell) bsCell.innerHTML = '<button type="button" class="inc-bs-btn has-data" onclick="openBsAnalysis(' + bsModalIdx + ')"><i class="fa-solid fa-university"></i> BS Analysis</button>';
    updateModalSum();
  }
  var overlay = document.getElementById('inc-bs-overlay');
  if (overlay) overlay.remove();
  bsModalIdx = null;
}

function removeModalSource(idx) {
  var tr = document.getElementById('ims-' + idx);
  if (tr) tr.remove();
  updateModalSum();
}

function updateModalSum() {
  var tbody = document.getElementById('inc-modal-tbody');
  var sumEl = document.getElementById('inc-modal-sum');
  if (!tbody || !sumEl) return;
  var sum = 0;
  tbody.querySelectorAll('tr').forEach(function(tr) {
    var amtEl = tr.querySelector('[id$="-amt"]');
    if (amtEl) sum += (parseCurrency(amtEl.value) || 0);
  });
  sumEl.innerHTML = 'Total from sources: <b>$' + sum.toLocaleString('en-US') + '</b>';
}

function closeIncomeModal(apply) {
  if (apply && incModalWho) {
    /* Collect all source rows from modal */
    var tbody = document.getElementById('inc-modal-tbody');
    var sources = [];
    var sum = 0;
    if (tbody) {
      tbody.querySelectorAll('tr').forEach(function(tr) {
        var id = tr.id;
        var idx = parseInt(id.replace('ims-', ''));
        var typeEl = document.getElementById(id + '-type');
        var seEl = document.getElementById(id + '-se');
        var amtEl = tr.querySelector('[id$="-amt"]');
        var amt = amtEl ? (parseCurrency(amtEl.value) || 0) : 0;
        sum += amt;
        /* Get BS data from memory (not DOM — BS fields live in sub-modal) */
        var bs = incBsData[idx] || {};
        sources.push({
          type: typeEl ? typeEl.value : '',
          seDoc: seEl ? seEl.value : '',
          amount: amt,
          bsPeriod: bs.bsPeriod || '',
          totalDeposits: bs.totalDeposits || 0,
          expFactor: bs.expFactor != null ? bs.expFactor : null
        });
      });
    }
    /* Save to in-memory cache */
    incDetails[incModalWho] = sources;
    /* Write sum back to total field (always annual) */
    if (sum > 0) {
      var totalEl = document.getElementById(incModalWho + '-income');
      if (totalEl) {
        var mode = (incModalWho === 'coborrower') ? coBorrowerIncomeMode : borrowerIncomeMode;
        var displayVal = (mode === 'monthly') ? sum / 12 : sum;
        totalEl.value = displayVal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
      }
    }
    updateDetailBtnCounts();
    updateCombinedIncome();
  }
  /* Remove overlay */
  var overlay = document.getElementById('inc-modal-overlay');
  if (overlay) overlay.remove();
  incModalWho = null;
}

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

/* ---- Calculator launcher ---- */
function launchCalculator(calcType) {
  if (calcType === 'Affordability Calculator') { showCalcSidebar(); return; }
  if (calcType === 'Refinance Analysis') { showRefiSidebar(); return; }
  if (calcType === 'Closing Costs') { showClosingCostsSidebar(); return; }
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


/* ============================================================
   REFINANCE ANALYSIS — Pipeline Modal Module (v3.0)
   ============================================================
   Two-panel layout: inputs left, live results right.
   v3.0: Side-by-side panels eliminate scrolling between
   inputs and results. Modal expanded to ~1200px.

   Globals exposed (called from onclick handlers):
     - showRefiSidebar, closeRefiSidebar, runRefiCalc
   ============================================================ */

var refiSidebarBuilt = false;

/* ---- Build the Refi modal DOM (called once, then reused) ---- */
function buildRefiSidebar() {
  if (refiSidebarBuilt) return;

  /* Inject refi-specific CSS */
  var style = document.createElement('style');
  style.textContent = ''
    /* ---- Override modal size for refi ---- */
    + '#refi-sidebar .calc-sidebar-card{width:1200px;max-width:96vw;max-height:94vh;}'
    /* ---- Two-panel layout ---- */
    + '.refi-panels{display:flex;flex:1;overflow:hidden;min-height:0;}'
    + '.refi-panel-left{flex:1;overflow-y:auto;padding:20px 24px 24px;border-right:1px solid #E2E8F0;display:flex;flex-direction:column;gap:16px;}'
    + '.refi-panel-right{width:420px;flex-shrink:0;overflow-y:auto;padding:20px 20px 24px;background:#FAFBFC;display:flex;flex-direction:column;gap:14px;}'
    /* ---- Results styling ---- */
    + '.refi-hero{text-align:center;padding:14px 12px;background:linear-gradient(135deg,#EFF6FF,#DBEAFE);border-radius:10px;border:1px solid #BFDBFE;}'
    + '.refi-hero.negative{background:linear-gradient(135deg,#FEF2F2,#FEE2E2);border-color:#FECACA;}'
    + '.refi-hero-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#3B82F6;margin-bottom:2px;}'
    + '.refi-hero.negative .refi-hero-label{color:#EF4444;}'
    + '.refi-hero-value{font-size:26px;font-weight:800;color:#1E40AF;line-height:1.1;}'
    + '.refi-hero.negative .refi-hero-value{color:#DC2626;}'
    + '.refi-hero-sub{font-size:11px;color:#64748B;margin-top:3px;}'
    + '.refi-compare-row{display:flex;align-items:center;gap:6px;}'
    + '.refi-cmp-card{flex:1;text-align:center;padding:8px 6px;border-radius:8px;background:#FFF;border:1px solid #E2E8F0;}'
    + '.refi-cmp-card.hl{background:#EFF6FF;border-color:#93C5FD;}'
    + '.refi-cmp-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;color:#64748B;margin-bottom:1px;}'
    + '.refi-cmp-amt{font-size:17px;font-weight:800;color:#1E293B;font-variant-numeric:tabular-nums;}'
    + '.refi-cmp-card.hl .refi-cmp-amt{color:#1E40AF;}'
    + '.refi-cmp-arrow{color:#94A3B8;font-size:14px;flex-shrink:0;}'
    /* ---- Metrics grid ---- */
    + '.refi-metrics{display:grid;grid-template-columns:1fr 1fr;gap:6px;}'
    + '.refi-metric{padding:8px 10px;background:#FFF;border-radius:6px;border:1px solid #E2E8F0;}'
    + '.refi-metric-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;color:#64748B;}'
    + '.refi-metric-val{font-size:14px;font-weight:700;color:#1E293B;font-variant-numeric:tabular-nums;}'
    + '.refi-metric-val.green{color:#059669;}'
    /* ---- Breakdowns ---- */
    + '.refi-bd{}'
    + '.refi-bd-title{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;color:#1E3A8A;margin-bottom:6px;padding-bottom:3px;border-bottom:2px solid #DBEAFE;}'
    + '.refi-bd-row{display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:12px;color:#475569;}'
    + '.refi-bd-row .v{font-weight:700;color:#1E293B;font-variant-numeric:tabular-nums;}'
    + '.refi-bd-row.tot{border-top:2px solid #E2E8F0;margin-top:3px;padding-top:6px;font-weight:700;color:#1E293B;}'
    + '.refi-bd-note{font-size:10px;color:#64748B;margin-top:3px;}'
    /* ---- Inputs: checkbox, computed, estimate ---- */
    + '.refi-cb-label{display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;font-weight:600;color:#475569;margin-top:2px;}'
    + '.refi-cb-label input[type="checkbox"]{width:16px;height:16px;accent-color:#2563EB;cursor:pointer;}'
    + '.refi-computed{padding:7px 10px;background:#F1F5F9;border:1px solid #E2E8F0;border-radius:6px;font-size:13px;font-weight:600;color:#334155;font-variant-numeric:tabular-nums;}'
    + '.refi-est-toggle{font-size:11px;color:#2563EB;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:4px;margin-top:4px;grid-column:span 2;}'
    + '.refi-est-toggle:hover{text-decoration:underline;}'
    + '.refi-est-section{grid-column:span 2;display:none;border:1px solid #E2E8F0;border-radius:8px;padding:10px 12px;background:#FAFBFC;}'
    + '.refi-est-section.open{display:block;}'
    + '.refi-est-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;margin-top:6px;}'
    + '.refi-use-est-btn{font-size:11px;color:#2563EB;cursor:pointer;font-weight:700;background:none;border:1px solid #2563EB;border-radius:4px;padding:3px 8px;margin-top:4px;display:none;}'
    + '.refi-use-est-btn:hover{background:#EFF6FF;}'
    /* ---- Responsive: stack panels on narrow screens ---- */
    + '@media(max-width:900px){.refi-panels{flex-direction:column;}.refi-panel-left{border-right:none;border-bottom:1px solid #E2E8F0;max-height:50vh;}.refi-panel-right{width:100%;max-height:50vh;}}';
  document.head.appendChild(style);

  var overlay = document.createElement('div');
  overlay.id = 'refi-sidebar';
  overlay.className = 'calc-sidebar hidden';

  overlay.innerHTML = '<div class="calc-sidebar-card">'
    + '<div class="calc-sidebar-header">'
    +   '<h3><i class="fa-solid fa-arrows-rotate"></i> Refinance Analysis</h3>'
    +   '<span class="close-calc-sidebar" onclick="closeRefiSidebar()">&times;</span>'
    + '</div>'

    /* ===== TWO PANELS ===== */
    + '<div class="refi-panels">'

    /* ========== LEFT PANEL: INPUTS ========== */
    + '<div class="refi-panel-left">'

    /* --- Current Loan --- */
    +   '<div class="calc-section">'
    +     '<div class="calc-section-title"><i class="fa-solid fa-house"></i> Current Loan</div>'
    +     '<div class="calc-field-group"><label>Loan Type</label>'
    +       '<select id="refi-cur-loan-type" class="form-control"><option>Conventional</option><option>FHA</option><option>VA</option><option>USDA</option></select>'
    +     '</div>'
    +     '<div class="calc-field-group"><label>Payoff Balance ($)</label>'
    +       '<input type="text" id="refi-cur-balance" class="form-control currency-input" placeholder="0">'
    +     '</div>'
    +     '<div class="calc-field-group"><label>Current Rate (%)</label>'
    +       '<input type="number" id="refi-cur-rate" class="form-control" step="0.125" placeholder="6.625">'
    +     '</div>'
    +     '<div class="calc-field-group"><label>Remaining Term (yrs)</label>'
    +       '<input type="number" id="refi-cur-term" class="form-control" value="30" min="1" max="50">'
    +     '</div>'
    +     '<div class="calc-field-group"><label>Current P&I ($/mo)</label>'
    +       '<input type="text" id="refi-cur-pi" class="form-control currency-input" placeholder="Auto or enter">'
    +     '</div>'
    +     '<div class="calc-field-group"><label>Current MI ($/mo)</label>'
    +       '<input type="text" id="refi-cur-mi" class="form-control currency-input" placeholder="0">'
    +     '</div>'
    /* Estimate toggle */
    +     '<div class="refi-est-toggle" onclick="toggleRefiEstimate()"><i class="fa-solid fa-calculator"></i> Estimate balance from original loan</div>'
    +     '<div class="refi-est-section" id="refi-est-section">'
    +       '<div style="font-size:11px;color:#64748B;margin-bottom:6px;">Enter original loan details to estimate payoff balance</div>'
    +       '<div class="refi-est-grid">'
    +         '<div class="calc-field-group" style="margin:0;"><label>Original Amount</label><input type="text" id="refi-orig-amount" class="form-control currency-input" placeholder="$0"></div>'
    +         '<div class="calc-field-group" style="margin:0;"><label>Original Term (yrs)</label><input type="number" id="refi-orig-term" class="form-control" placeholder="30"></div>'
    +         '<div class="calc-field-group" style="margin:0;"><label>First Payment Date</label><input type="month" id="refi-first-payment" class="form-control"></div>'
    +         '<div class="calc-field-group" style="margin:0;"><label>Estimated Balance</label><div class="refi-computed" id="refi-est-balance">Enter details</div></div>'
    +       '</div>'
    +       '<button type="button" class="refi-use-est-btn" id="refi-use-est-btn" onclick="useRefiEstimate()"><i class="fa-solid fa-arrow-up"></i> Use estimated balance</button>'
    +     '</div>'
    +   '</div>'

    /* --- New Loan --- */
    +   '<div class="calc-section">'
    +     '<div class="calc-section-title"><i class="fa-solid fa-arrow-right-arrow-left"></i> New Loan</div>'
    +     '<div class="calc-field-group"><label>Property Value ($)</label>'
    +       '<input type="text" id="refi-prop-value" class="form-control currency-input" placeholder="0">'
    +     '</div>'
    +     '<div class="calc-field-group"><label>New Loan Type</label>'
    +       '<select id="refi-new-loan-type" class="form-control"><option>Conventional</option><option>FHA</option><option>VA</option><option>USDA</option></select>'
    +     '</div>'
    +     '<div class="calc-field-group"><label>New Rate (%)</label>'
    +       '<input type="number" id="refi-new-rate" class="form-control" step="0.125" placeholder="5.990">'
    +     '</div>'
    +     '<div class="calc-field-group"><label>New Term (yrs)</label>'
    +       '<input type="number" id="refi-new-term" class="form-control" value="30" min="1" max="50">'
    +     '</div>'
    +     '<div class="calc-field-group"><label>Cash-Out ($)</label>'
    +       '<input type="text" id="refi-cashout" class="form-control currency-input" placeholder="0">'
    +     '</div>'
    +     '<div class="calc-field-group"><label>Debt Payoff ($)</label>'
    +       '<input type="text" id="refi-debt-payoff" class="form-control currency-input" placeholder="0">'
    +     '</div>'
    +     '<div class="calc-field-group"><label>Debt Pmts Eliminated ($/mo)</label>'
    +       '<input type="text" id="refi-debt-pmts" class="form-control currency-input" placeholder="0">'
    +     '</div>'
    +     '<div class="calc-field-group"><label>Closing Costs ($)</label>'
    +       '<input type="text" id="refi-closing-costs" class="form-control currency-input" placeholder="0">'
    +     '</div>'
    +     '<div class="calc-field-group"><label>Discount Points ($)</label>'
    +       '<input type="text" id="refi-discount-pts" class="form-control currency-input" placeholder="0">'
    +     '</div>'
    +     '<div class="calc-field-group">'
    +       '<label class="refi-cb-label"><input type="checkbox" id="refi-roll-costs" checked> Roll closing costs into loan</label>'
    +     '</div>'
    +     '<div class="calc-field-group"><label>Funding Fee (%)</label>'
    +       '<input type="number" id="refi-funding-pct" class="form-control" value="0" step="0.01" min="0">'
    +     '</div>'
    +     '<div class="calc-field-group"><label>New MI Rate (%)</label>'
    +       '<input type="number" id="refi-new-mi-rate" class="form-control" value="0" step="0.01" min="0">'
    +     '</div>'
    +   '</div>'

    + '</div>' /* /refi-panel-left */

    /* ========== RIGHT PANEL: RESULTS ========== */
    + '<div class="refi-panel-right">'

    /* Savings hero */
    +   '<div class="refi-hero" id="refi-hero">'
    +     '<div class="refi-hero-label" id="refi-hero-label">Monthly Savings</div>'
    +     '<div class="refi-hero-value" id="refi-hero-value">&mdash;</div>'
    +     '<div class="refi-hero-sub" id="refi-hero-sub">Enter loan details to see results</div>'
    +   '</div>'

    /* Payment comparison */
    +   '<div class="refi-compare-row">'
    +     '<div class="refi-cmp-card"><div class="refi-cmp-lbl">Current P&I+MI</div><div class="refi-cmp-amt" id="refi-comp-current">&mdash;</div></div>'
    +     '<div class="refi-cmp-arrow"><i class="fa-solid fa-arrow-right"></i></div>'
    +     '<div class="refi-cmp-card hl"><div class="refi-cmp-lbl">New P&I+MI</div><div class="refi-cmp-amt" id="refi-comp-new">&mdash;</div></div>'
    +   '</div>'

    /* Key metrics 2x2 */
    +   '<div class="refi-metrics">'
    +     '<div class="refi-metric"><div class="refi-metric-lbl">Break-Even</div><div class="refi-metric-val" id="refi-breakeven">&mdash;</div></div>'
    +     '<div class="refi-metric"><div class="refi-metric-lbl">Total Monthly Benefit</div><div class="refi-metric-val green" id="refi-total-benefit">&mdash;</div></div>'
    +     '<div class="refi-metric"><div class="refi-metric-lbl">LTV</div><div class="refi-metric-val" id="refi-ltv">&mdash;</div></div>'
    +     '<div class="refi-metric"><div class="refi-metric-lbl">Lifetime Savings</div><div class="refi-metric-val" id="refi-lifetime">&mdash;</div></div>'
    +   '</div>'

    /* New Loan Amount computed display */
    +   '<div style="display:flex;gap:8px;">'
    +     '<div style="flex:1;"><div class="refi-metric-lbl" style="margin-bottom:3px;">Max Loan (LTV)</div><div class="refi-computed" id="refi-max-loan-display">$0</div></div>'
    +     '<div style="flex:1;"><div class="refi-metric-lbl" style="margin-bottom:3px;">New Loan Amount</div><div class="refi-computed" style="background:#EFF6FF;border-color:#93C5FD;color:#1E40AF;" id="refi-new-loan-display">$0</div></div>'
    +   '</div>'

    /* New Loan Breakdown */
    +   '<div class="refi-bd">'
    +     '<div class="refi-bd-title">New Loan Breakdown</div>'
    +     '<div class="refi-bd-row"><span>Paying off current loan</span><span class="v" id="refi-bd-payoff">$0</span></div>'
    +     '<div class="refi-bd-row"><span>Cash-out to borrower</span><span class="v" id="refi-bd-cashout">$0</span></div>'
    +     '<div class="refi-bd-row"><span>Debt payoff</span><span class="v" id="refi-bd-debt">$0</span></div>'
    +     '<div class="refi-bd-row"><span>Closing costs rolled in</span><span class="v" id="refi-bd-closing">$0</span></div>'
    +     '<div class="refi-bd-row"><span>Funding / guarantee fee</span><span class="v" id="refi-bd-funding">$0</span></div>'
    +     '<div class="refi-bd-row tot"><span>New Loan Amount</span><span class="v" id="refi-bd-total">$0</span></div>'
    +   '</div>'

    /* Cost to Refinance */
    +   '<div class="refi-bd">'
    +     '<div class="refi-bd-title">Cost to Refinance</div>'
    +     '<div class="refi-bd-row"><span>Closing costs</span><span class="v" id="refi-cd-closing">$0</span></div>'
    +     '<div class="refi-bd-row"><span>Discount points</span><span class="v" id="refi-cd-points">$0</span></div>'
    +     '<div class="refi-bd-row"><span>Funding / guarantee fee</span><span class="v" id="refi-cd-funding">$0</span></div>'
    +     '<div class="refi-bd-row tot"><span>Due at Closing</span><span class="v" id="refi-cd-oop">$0</span></div>'
    +     '<div class="refi-bd-note" id="refi-cd-note"></div>'
    +   '</div>'

    + '</div>' /* /refi-panel-right */

    + '</div>' /* /refi-panels */
    + '</div>' /* /calc-sidebar-card */;

  /* Append inside the loan modal */
  var modal = document.getElementById('loan-modal');
  if (modal) { modal.appendChild(overlay); } else { document.body.appendChild(overlay); }

  /* Attach input listeners for real-time calc */
  var refiIds = REFI_FIELD_IDS.concat(['refi-cur-loan-type','refi-new-loan-type']);
  var debouncedRefi = debounce(runRefiCalc, 200);
  refiIds.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', debouncedRefi);
  });
  ['refi-cur-loan-type','refi-new-loan-type'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('change', debouncedRefi);
  });
  var rollCosts = document.getElementById('refi-roll-costs');
  if (rollCosts) rollCosts.addEventListener('change', debouncedRefi);

  /* Estimate balance fields */
  ['refi-orig-amount','refi-orig-term','refi-first-payment'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', calcEstimatedBalance);
  });

  /* Format currency inputs */
  document.querySelectorAll('#refi-sidebar .currency-input').forEach(function(inp) {
    inp.addEventListener('blur', function() {
      var raw = parseCurrency(this.value);
      if (raw > 0) this.value = raw.toLocaleString();
    });
  });

  refiSidebarBuilt = true;
}


/* ---- Toggle estimate section ---- */
function toggleRefiEstimate() {
  var sec = document.getElementById('refi-est-section');
  if (sec) sec.classList.toggle('open');
}

/* ---- Calculate estimated remaining balance ---- */
function calcEstimatedBalance() {
  var origAmt = parseCurrency(document.getElementById('refi-orig-amount').value) || 0;
  var origTerm = parseFloat(document.getElementById('refi-orig-term').value) || 0;
  var firstPayStr = document.getElementById('refi-first-payment').value;
  var curRate = parseFloat(document.getElementById('refi-cur-rate').value) || 0;
  var display = document.getElementById('refi-est-balance');
  var btn = document.getElementById('refi-use-est-btn');
  var fC = function(v) { return '$' + Math.abs(Math.round(v)).toLocaleString(); };

  if (origAmt > 0 && curRate > 0 && origTerm > 0 && firstPayStr) {
    var parts = firstPayStr.split('-');
    var startYear = parseInt(parts[0]), startMonth = parseInt(parts[1]);
    var now = new Date();
    var pmtsMade = ((now.getFullYear() - startYear) * 12) + (now.getMonth() + 1 - startMonth);
    if (pmtsMade < 0) pmtsMade = 0;
    if (pmtsMade > origTerm * 12) pmtsMade = origTerm * 12;
    var mr = curRate / 100 / 12, np = origTerm * 12;
    var estBal = 0;
    if (mr > 0) {
      var origPI = (origAmt * mr * Math.pow(1 + mr, np)) / (Math.pow(1 + mr, np) - 1);
      estBal = origAmt * Math.pow(1 + mr, pmtsMade) - origPI * ((Math.pow(1 + mr, pmtsMade) - 1) / mr);
      if (estBal < 0) estBal = 0;
    }
    display.textContent = '\\u2248 ' + fC(estBal);
    display.style.color = '#2563EB';
    btn.style.display = 'inline-flex';
    btn.dataset.estimate = Math.round(estBal).toString();
  } else {
    display.textContent = 'Enter details';
    display.style.color = '#94A3B8';
    btn.style.display = 'none';
  }
}

function useRefiEstimate() {
  var btn = document.getElementById('refi-use-est-btn');
  var est = parseInt(btn.dataset.estimate) || 0;
  if (est > 0) {
    document.getElementById('refi-cur-balance').value = est.toLocaleString();
    runRefiCalc();
  }
}


/* ============================================================
   STATE PERSISTENCE (localStorage per loan)
   ============================================================ */

var REFI_FIELD_IDS = [
  'refi-cur-balance', 'refi-cur-rate', 'refi-cur-term', 'refi-cur-mi', 'refi-cur-pi',
  'refi-cur-loan-type', 'refi-prop-value', 'refi-new-loan-type',
  'refi-new-rate', 'refi-new-term', 'refi-closing-costs', 'refi-new-mi-rate',
  'refi-cashout', 'refi-debt-payoff', 'refi-debt-pmts',
  'refi-discount-pts', 'refi-funding-pct',
  'refi-orig-amount', 'refi-orig-term', 'refi-first-payment'
];

function refiStorageKey() {
  if (typeof currentLoanId !== 'undefined' && currentLoanId) return 'calc_refi_' + currentLoanId;
  return null;
}

function saveRefiState() {
  var key = refiStorageKey(); if (!key) return;
  var state = {};
  REFI_FIELD_IDS.forEach(function(id) { var el = document.getElementById(id); if (el) state[id] = el.value; });
  var cb = document.getElementById('refi-roll-costs');
  if (cb) state['refi-roll-costs'] = cb.checked;
  try { localStorage.setItem(key, JSON.stringify(state)); } catch(e) {}
}

function restoreRefiState() {
  var key = refiStorageKey(); if (!key) return false;
  try {
    var raw = localStorage.getItem(key); if (!raw) return false;
    var state = JSON.parse(raw);
    REFI_FIELD_IDS.forEach(function(id) {
      if (state[id] !== undefined && state[id] !== '') {
        var el = document.getElementById(id); if (el) el.value = state[id];
      }
    });
    if (state['refi-roll-costs'] !== undefined) {
      var cb = document.getElementById('refi-roll-costs');
      if (cb) cb.checked = state['refi-roll-costs'];
    }
    return true;
  } catch(e) { return false; }
}


/* ---- Open the Refi modal ---- */
function showRefiSidebar() {
  buildRefiSidebar();
  var sb = document.getElementById('refi-sidebar'); if (!sb) return;
  var restored = restoreRefiState();

  if (!restored) {
    var loanAmt = document.getElementById('loan-amount');
    var loanRate = document.getElementById('loan-interest-rate');
    var loanTerm = document.getElementById('loan-term');
    var propValue = document.getElementById('property-value') || document.getElementById('prop-value');

    if (loanAmt) { var b = parseCurrency(loanAmt.value); if (b > 0) document.getElementById('refi-cur-balance').value = b.toLocaleString(); }
    if (loanRate && loanRate.value) document.getElementById('refi-cur-rate').value = loanRate.value;
    if (loanTerm && loanTerm.value) document.getElementById('refi-cur-term').value = loanTerm.value;
    if (propValue) { var pv = parseCurrency(propValue.value); if (pv > 0) document.getElementById('refi-prop-value').value = pv.toLocaleString(); }

    document.getElementById('refi-new-rate').value = '';
    document.getElementById('refi-new-term').value = '30';
    document.getElementById('refi-closing-costs').value = '';
    document.getElementById('refi-new-mi-rate').value = '0';
    document.getElementById('refi-cur-mi').value = '';
    document.getElementById('refi-cur-pi').value = '';
    document.getElementById('refi-cashout').value = '';
    document.getElementById('refi-debt-payoff').value = '';
    document.getElementById('refi-debt-pmts').value = '';
    document.getElementById('refi-discount-pts').value = '';
    document.getElementById('refi-funding-pct').value = '0';
    document.getElementById('refi-roll-costs').checked = true;
  }

  sb.classList.remove('hidden');
  setTimeout(function() { sb.classList.add('open'); }, 10);
  runRefiCalc();
}

function closeRefiSidebar() {
  var sb = document.getElementById('refi-sidebar'); if (!sb) return;
  sb.classList.remove('open');
  setTimeout(function() { sb.classList.add('hidden'); }, 300);
}


/* ============================================================
   MAIN REFINANCE CALCULATION
   ============================================================ */
function runRefiCalc() {
  var curBalance  = parseCurrency(document.getElementById('refi-cur-balance').value) || 0;
  var curRate     = parseFloat(document.getElementById('refi-cur-rate').value) || 0;
  var curTerm     = parseInt(document.getElementById('refi-cur-term').value) || 30;
  var curMI       = parseCurrency(document.getElementById('refi-cur-mi').value) || 0;
  var curPIinput  = parseCurrency(document.getElementById('refi-cur-pi').value) || 0;
  var propValue   = parseCurrency(document.getElementById('refi-prop-value').value) || 0;
  var newRate     = parseFloat(document.getElementById('refi-new-rate').value) || 0;
  var newTerm     = parseInt(document.getElementById('refi-new-term').value) || 30;
  var closingCosts= parseCurrency(document.getElementById('refi-closing-costs').value) || 0;
  var discountPts = parseCurrency(document.getElementById('refi-discount-pts').value) || 0;
  var rollCosts   = document.getElementById('refi-roll-costs').checked;
  var fundingPct  = parseFloat(document.getElementById('refi-funding-pct').value) || 0;
  var newMIRate   = parseFloat(document.getElementById('refi-new-mi-rate').value) || 0;
  var cashOut     = parseCurrency(document.getElementById('refi-cashout').value) || 0;
  var debtPayoff  = parseCurrency(document.getElementById('refi-debt-payoff').value) || 0;
  var debtPmts    = parseCurrency(document.getElementById('refi-debt-pmts').value) || 0;

  var elHero = document.getElementById('refi-hero');
  var elHeroLabel = document.getElementById('refi-hero-label');
  var elHeroValue = document.getElementById('refi-hero-value');
  var elHeroSub = document.getElementById('refi-hero-sub');
  var elCompCur = document.getElementById('refi-comp-current');
  var elCompNew = document.getElementById('refi-comp-new');
  var elBreakeven = document.getElementById('refi-breakeven');
  var elBenefit = document.getElementById('refi-total-benefit');
  var elLTV = document.getElementById('refi-ltv');
  var elLifetime = document.getElementById('refi-lifetime');
  var elNewLoan = document.getElementById('refi-new-loan-display');
  var elMaxLoan = document.getElementById('refi-max-loan-display');

  var fC = function(v) { return '$' + Math.abs(Math.round(v)).toLocaleString(); };

  if (curBalance <= 0 || (curRate <= 0 && newRate <= 0)) {
    elHeroValue.textContent = '\\u2014';
    elHeroSub.textContent = 'Enter loan details to see results';
    elHero.classList.remove('negative');
    elCompCur.textContent = elCompNew.textContent = '\\u2014';
    elBreakeven.textContent = elBenefit.textContent = elLTV.textContent = elLifetime.textContent = '\\u2014';
    elNewLoan.textContent = elMaxLoan.textContent = '$0';
    saveRefiState();
    return;
  }

  /* Current P&I */
  var curR = (curRate / 100) / 12, curN = curTerm * 12, curPI = 0;
  if (curPIinput > 0) { curPI = curPIinput; }
  else if (curR > 0 && curN > 0) { curPI = curBalance * (curR * Math.pow(1 + curR, curN)) / (Math.pow(1 + curR, curN) - 1); }
  else if (curN > 0) { curPI = curBalance / curN; }
  var curTotal = curPI + curMI;

  /* New loan amount */
  var baseLoan = curBalance + cashOut + debtPayoff;
  var fundingFeeAmt = baseLoan * (fundingPct / 100);
  var newLoanAmt = baseLoan + fundingFeeAmt;
  if (rollCosts) newLoanAmt += closingCosts + discountPts;

  var maxLTV = 95;
  var maxLoan = propValue > 0 ? propValue * (maxLTV / 100) : 0;
  elMaxLoan.textContent = maxLoan > 0 ? fC(maxLoan) : '$0';
  if (propValue > 0 && newLoanAmt > maxLoan) newLoanAmt = maxLoan;
  elNewLoan.textContent = fC(newLoanAmt);

  /* New P&I */
  var newR = (newRate / 100) / 12, newN = newTerm * 12, newPI = 0;
  if (newR > 0 && newN > 0) { newPI = newLoanAmt * (newR * Math.pow(1 + newR, newN)) / (Math.pow(1 + newR, newN) - 1); }
  else if (newN > 0) { newPI = newLoanAmt / newN; }

  var newMI = (newMIRate > 0) ? (newLoanAmt * (newMIRate / 100)) / 12 : 0;
  var newTotal = newPI + newMI;

  var monthlySavings = curTotal - newTotal;
  var isNeg = monthlySavings < 0;
  var totalBenefit = monthlySavings + debtPmts;
  var totalCosts = closingCosts + discountPts + fundingFeeAmt;
  var breakEvenMonths = (monthlySavings > 0 && totalCosts > 0) ? Math.ceil(totalCosts / monthlySavings) : 0;
  var lifetimeSavings = (monthlySavings * newN) - totalCosts;
  var ltv = propValue > 0 ? (newLoanAmt / propValue) * 100 : 0;

  /* Render */
  elHero.classList.toggle('negative', isNeg);
  elHeroLabel.textContent = isNeg ? 'Monthly Increase' : 'Monthly Savings';
  elHeroValue.textContent = fC(monthlySavings) + '/mo';
  elHeroSub.textContent = isNeg ? 'New payment is higher' : (newRate > 0 ? curRate.toFixed(3) + '% \\u2192 ' + newRate.toFixed(3) + '%' : '');
  elCompCur.textContent = fC(curTotal);
  elCompNew.textContent = fC(newTotal);

  if (monthlySavings > 0 && totalCosts > 0) {
    var beYrs = Math.floor(breakEvenMonths / 12), beMos = breakEvenMonths % 12;
    elBreakeven.textContent = beYrs > 0 ? beYrs + 'yr ' + beMos + 'mo' : breakEvenMonths + ' mo';
  } else if (monthlySavings > 0) { elBreakeven.textContent = 'Immediate'; }
  else { elBreakeven.textContent = 'N/A'; }

  elBenefit.textContent = totalBenefit > 0 ? fC(totalBenefit) + '/mo' : '\\u2014';
  elLTV.textContent = ltv > 0 ? ltv.toFixed(1) + '%' : '\\u2014';
  elLifetime.textContent = lifetimeSavings >= 0 ? fC(lifetimeSavings) : '-' + fC(Math.abs(lifetimeSavings));

  /* Loan breakdown */
  var rolledIn = rollCosts ? (closingCosts + discountPts) : 0;
  document.getElementById('refi-bd-payoff').textContent = fC(curBalance);
  document.getElementById('refi-bd-cashout').textContent = cashOut > 0 ? fC(cashOut) : '$0';
  document.getElementById('refi-bd-debt').textContent = debtPayoff > 0 ? fC(debtPayoff) : '$0';
  document.getElementById('refi-bd-closing').textContent = rolledIn > 0 ? fC(rolledIn) : '$0';
  document.getElementById('refi-bd-funding').textContent = fundingFeeAmt > 0 ? fC(fundingFeeAmt) : '$0';
  document.getElementById('refi-bd-total').textContent = fC(newLoanAmt);

  /* Cost breakdown */
  var oopCosts = rollCosts ? 0 : (closingCosts + discountPts);
  document.getElementById('refi-cd-closing').textContent = fC(closingCosts);
  document.getElementById('refi-cd-points').textContent = discountPts > 0 ? fC(discountPts) : '$0';
  document.getElementById('refi-cd-funding').textContent = fundingFeeAmt > 0 ? fC(fundingFeeAmt) : '$0';
  document.getElementById('refi-cd-oop').textContent = fC(oopCosts);
  var noteEl = document.getElementById('refi-cd-note');
  if (noteEl) noteEl.textContent = rollCosts ? 'Closing costs rolled into loan \\u2014 $0 due at closing' : '';

  saveRefiState();
}

`;
  return new Response(jsContent, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600', // Cache 24 hours, bust with ?v=
      ...getCorsHeaders(request)
    }
  });
}


// ============================================================
// PIPELINE CHECKLIST — STATIC JS MODULE
// ============================================================

/**
 * GET /static/pipeline-checklist.js
 * Serves the loan workflow checklist module for the Pipeline page.
 * This file is loaded via <script src="..."> after the main pipeline script.
 * It hooks into the loan modal via MutationObserver and provides a 50-item
 * drag-and-drop checklist per loan, stored as JSON in Airtable.
 * Cache-busted via ?v= query param when deploying updates.
 */
async function getPipelineChecklistJS(request) {
  const jsContent = `/* ============================================================
   PIPELINE CHECKLIST — JavaScript Module v2.2
   ============================================================
   Served via Cloudflare Worker as /static/pipeline-checklist.js
   Loaded AFTER pipeline-app.js so it has access to:
     - currentLoanId (global)
     - loans (global array)
     - apiCall (global function)
   
   Features:
     - 50 default checklist items grouped into 14 sections
     - Per-loan checklist stored as JSON in Airtable
     - Auto-save on each checkbox/date change
     - Drag-and-drop reorder within groups
     - Progress tracking with visual bar
     - Collapse/expand groups
     - Purchase Agreement section conditionally shown based on Purpose
     - N/A toggle per item (counts as done, greyed styling, hides date)
     - Migration logic for existing saved checklists
   
   v2.2 Changes:
     - Reordered Credit & Prequalification: Hard Credit Pull first
     - Added: Select Expected Lender and Loan Product, Price Loan
     - Renamed: AUS/GUS Ran → Run AUS/GUS
     - 50 items across 14 groups
   v2.1 Changes:
     - Opt Out Prescreen + Request Docs now have date fields
     - Fixed Closing order: Funded → Closed → Purchased (NonDel)
     - Added N/A toggle button per checklist item
     - N/A items count as "done" in progress/badge
     - N/A items show greyed-out with italic strikethrough + amber badge
   v2.0 Changes:
     - Added: All Docs Received, Hard Credit Pull, Purchased (NonDel)
     - New sections: Initial Compliance, Credit & Prequalification
     - Renamed: Disclosures → Lender Disclosures
     - Renamed: Send Quotes to Buyer → Quotes Sent to Borrower
     - Moved: AUS/GUS Ran + Prequalified to Credit & Prequalification
     - Purchase Agreement only shown when Purpose contains "Purchase"
   ============================================================ */

(function() {
  'use strict';

  // ============================================================
  // DEFAULT CHECKLIST TEMPLATE — 50 items across 14 groups
  // Each item: { id, label, group, checked, date, value, order }
  // ============================================================
  var DEFAULT_CHECKLIST = [
    // GROUP 1: Application & Setup
    { id: 'app-interview',        label: 'Interview',                 group: 'Application & Setup',         inputType: 'date', na: false, checked: false, date: '', value: '', order: 1 },
    { id: 'app-received',         label: 'Application Received',      group: 'Application & Setup',         inputType: 'date', na: false, checked: false, date: '', value: '', order: 2 },
    { id: 'app-opt-out',          label: 'Opt Out Prescreen',         group: 'Application & Setup',         inputType: 'date', na: false, checked: false, date: '', value: '', order: 3 },
    { id: 'app-run-credit',       label: 'Run Initial Credit',        group: 'Application & Setup',         inputType: 'date', na: false, checked: false, date: '', value: '', order: 4 },
    { id: 'app-request-docs',     label: 'Request Docs',              group: 'Application & Setup',         inputType: 'date', na: false, checked: false, date: '', value: '', order: 5 },
    { id: 'app-all-docs',         label: 'All Docs Received',         group: 'Application & Setup',         inputType: 'date', na: false, checked: false, date: '', value: '', order: 6 },

    // GROUP 2: Income & Assets (only confirmation items)
    { id: 'inc-confirmed',        label: 'Income Confirmed',          group: 'Income & Assets',             inputType: 'date', na: false, checked: false, date: '', value: '', order: 7 },
    { id: 'inc-assets',           label: 'Assets Confirmed',          group: 'Income & Assets',             inputType: 'date', na: false, checked: false, date: '', value: '', order: 8 },

    // GROUP 3: Initial Compliance (NEW)
    { id: 'comp-sent',            label: 'Initial Compliance Docs Sent',       group: 'Initial Compliance',  inputType: 'date', na: false, checked: false, date: '', value: '', order: 9 },
    { id: 'comp-signed-lo',       label: 'Initial Compliance Docs Signed - LO',    group: 'Initial Compliance',  inputType: 'date', na: false, checked: false, date: '', value: '', order: 10 },
    { id: 'comp-signed-client',   label: 'Initial Compliance Docs Signed - Client', group: 'Initial Compliance', inputType: 'date', na: false, checked: false, date: '', value: '', order: 11 },

    // GROUP 4: Credit & Prequalification (v2.2 — reordered, 2 new items, renamed AUS/GUS)
    { id: 'cred-hard-pull',       label: 'Hard Credit Pull',                        group: 'Credit & Prequalification',  inputType: 'date', na: false, checked: false, date: '', value: '', order: 12 },
    { id: 'cred-select-lender',   label: 'Select Expected Lender and Loan Product', group: 'Credit & Prequalification',  inputType: 'date', na: false, checked: false, date: '', value: '', order: 13 },
    { id: 'cred-price-loan',     label: 'Price Loan',                              group: 'Credit & Prequalification',  inputType: 'date', na: false, checked: false, date: '', value: '', order: 14 },
    { id: 'inc-aus',              label: 'Run AUS/GUS',                             group: 'Credit & Prequalification',  inputType: 'date', na: false, checked: false, date: '', value: '', order: 15 },
    { id: 'inc-preapproved',      label: 'Prequalified (Letter Sent)',              group: 'Credit & Prequalification',  inputType: 'date', na: false, checked: false, date: '', value: '', order: 16 },

    // GROUP 5: Purchase Agreement (conditionally shown based on Purpose)
    { id: 'pur-agreement',        label: 'Purchase Agreement Rcvd',   group: 'Purchase Agreement',          inputType: 'date', na: false, checked: false, date: '', value: '', order: 17 },

    // GROUP 6: Lender Disclosures (renamed from Disclosures)
    { id: 'disc-requested',       label: 'Disclosures Requested',     group: 'Lender Disclosures',          inputType: 'date', na: false, checked: false, date: '', value: '', order: 18 },
    { id: 'disc-sent',            label: 'Disclosures Sent',          group: 'Lender Disclosures',          inputType: 'date', na: false, checked: false, date: '', value: '', order: 19 },
    { id: 'disc-lo-signed',       label: 'Signed by LO',             group: 'Lender Disclosures',          inputType: 'date', na: false, checked: false, date: '', value: '', order: 20 },
    { id: 'disc-borrower-signed', label: 'Signed by Borrowers',      group: 'Lender Disclosures',          inputType: 'date', na: false, checked: false, date: '', value: '', order: 21 },

    // GROUP 7: Processing
    { id: 'proc-sent',            label: 'Sent to Processing',        group: 'Processing',                  inputType: 'date', na: false, checked: false, date: '', value: '', order: 22 },
    { id: 'proc-accepted',        label: 'Processing Accepted',       group: 'Processing',                  inputType: 'date', na: false, checked: false, date: '', value: '', order: 23 },

    // GROUP 8: Appraisal
    { id: 'apr-requested',        label: 'Requested Processing to Order', group: 'Appraisal',               inputType: 'date', na: false, checked: false, date: '', value: '', order: 24 },
    { id: 'apr-ordered',          label: 'Appraisal Order Placed',    group: 'Appraisal',                   inputType: 'date', na: false, checked: false, date: '', value: '', order: 25 },
    { id: 'apr-paid',             label: 'Appraisal Paid',            group: 'Appraisal',                   inputType: 'date', na: false, checked: false, date: '', value: '', order: 26 },
    { id: 'apr-assigned',         label: 'Appraisal Assigned',        group: 'Appraisal',                   inputType: 'date', na: false, checked: false, date: '', value: '', order: 27 },
    { id: 'apr-received',         label: 'Appraisal Received',        group: 'Appraisal',                   inputType: 'date', na: false, checked: false, date: '', value: '', order: 28 },
    { id: 'apr-cleared',          label: 'Appraisal Cleared',         group: 'Appraisal',                   inputType: 'date', na: false, checked: false, date: '', value: '', order: 29 },

    // GROUP 9: Reports & Certs
    { id: 'insp-wir',             label: 'WIR / Pest Inspection',     group: 'Reports & Certs',             inputType: 'date', na: false, checked: false, date: '', value: '', order: 30 },
    { id: 'insp-flood',           label: 'Flood Cert Ordered',        group: 'Reports & Certs',             inputType: 'date', na: false, checked: false, date: '', value: '', order: 31 },
    { id: 'insp-hoa',             label: 'HOA Certs',                 group: 'Reports & Certs',             inputType: 'date', na: false, checked: false, date: '', value: '', order: 32 },

    // GROUP 10: Title
    { id: 'title-ordered',        label: 'Title Ordered',             group: 'Title',                       inputType: 'date', na: false, checked: false, date: '', value: '', order: 33 },
    { id: 'title-received',       label: 'Title Received',            group: 'Title',                       inputType: 'date', na: false, checked: false, date: '', value: '', order: 34 },

    // GROUP 11: Rate Lock
    { id: 'lock-locked',          label: 'Rate Locked',               group: 'Rate Lock',                   inputType: 'date', na: false, checked: false, date: '', value: '', order: 35 },
    { id: 'lock-email',           label: 'Rate Lock Sent to Processing', group: 'Rate Lock',                inputType: 'date', na: false, checked: false, date: '', value: '', order: 36 },

    // GROUP 12: Underwriting
    { id: 'uw-sent',              label: 'Submitted to Underwriting', group: 'Underwriting',                inputType: 'date', na: false, checked: false, date: '', value: '', order: 37 },
    { id: 'uw-accepted',          label: 'Underwriting Accepted',     group: 'Underwriting',                inputType: 'date', na: false, checked: false, date: '', value: '', order: 38 },
    { id: 'uw-conditional',       label: 'Conditional Approval',      group: 'Underwriting',                inputType: 'date', na: false, checked: false, date: '', value: '', order: 39 },

    // GROUP 13: Homeowners Insurance (HOI)
    { id: 'hoi-requested',        label: 'Requested HOI from Borrower',      group: 'Homeowners Insurance',  inputType: 'date', na: false, checked: false, date: '', value: '', order: 40 },
    { id: 'hoi-quotes',           label: 'HOI Quotes Requested',             group: 'Homeowners Insurance',  inputType: 'date', na: false, checked: false, date: '', value: '', order: 41 },
    { id: 'hoi-sent-buyer',       label: 'Quotes Sent to Borrower',          group: 'Homeowners Insurance',  inputType: 'date', na: false, checked: false, date: '', value: '', order: 42 },
    { id: 'hoi-decision',         label: 'HOI Decision Made',                group: 'Homeowners Insurance',  inputType: 'date', na: false, checked: false, date: '', value: '', order: 43 },
    { id: 'hoi-sent-processing',  label: 'HOI Choice Sent to Processing',   group: 'Homeowners Insurance',  inputType: 'date', na: false, checked: false, date: '', value: '', order: 44 },

    // GROUP 14: Closing (Funded → Closed → Purchased)
    { id: 'close-cd-sent',        label: 'Initial CD Sent',           group: 'Closing',                     inputType: 'date', na: false, checked: false, date: '', value: '', order: 45 },
    { id: 'close-cd-signed',      label: 'Initial CD Signed',         group: 'Closing',                     inputType: 'date', na: false, checked: false, date: '', value: '', order: 46 },
    { id: 'close-conditions',     label: 'Conditions Cleared',        group: 'Closing',                     inputType: 'date', na: false, checked: false, date: '', value: '', order: 47 },
    { id: 'close-final',          label: 'Final Approval / CTC',      group: 'Closing',                     inputType: 'date', na: false, checked: false, date: '', value: '', order: 48 },
    { id: 'close-funded',         label: 'Funded',                    group: 'Closing',                     inputType: 'date', na: false, checked: false, date: '', value: '', order: 49 },
    { id: 'close-closed',         label: 'Closed',                    group: 'Closing',                     inputType: 'date', na: false, checked: false, date: '', value: '', order: 50 },
    { id: 'close-purchased',      label: 'Purchased (NonDel)',        group: 'Closing',                     inputType: 'date', na: false, checked: false, date: '', value: '', order: 51 }
  ];

  // Group metadata — icon + display color for each group header
  var GROUP_META = {
    'Application & Setup':        { icon: 'fa-solid fa-file-circle-plus',     color: '#3B82F6' },
    'Income & Assets':            { icon: 'fa-solid fa-money-bill-wave',      color: '#10B981' },
    'Initial Compliance':         { icon: 'fa-solid fa-clipboard-check',      color: '#F43F5E' },
    'Credit & Prequalification':  { icon: 'fa-solid fa-credit-card',          color: '#8B5CF6' },
    'Purchase Agreement':         { icon: 'fa-solid fa-file-signature',       color: '#A855F7' },
    'Lender Disclosures':         { icon: 'fa-solid fa-file-shield',          color: '#F59E0B' },
    'Processing':                 { icon: 'fa-solid fa-gears',               color: '#6366F1' },
    'Appraisal':                  { icon: 'fa-solid fa-house-chimney',        color: '#A855F7' },
    'Reports & Certs':            { icon: 'fa-solid fa-file-certificate',     color: '#14B8A6' },
    'Title':                      { icon: 'fa-solid fa-scroll',               color: '#0EA5E9' },
    'Rate Lock':                  { icon: 'fa-solid fa-lock',                 color: '#EC4899' },
    'Underwriting':               { icon: 'fa-solid fa-stamp',                color: '#F97316' },
    'Homeowners Insurance':       { icon: 'fa-solid fa-shield-halved',        color: '#06B6D4' },
    'Closing':                    { icon: 'fa-solid fa-flag-checkered',       color: '#22C55E' }
  };

  // ============================================================
  // STATE
  // ============================================================
  var checklistData = [];           // Current loan's checklist items
  var checklistPanelOpen = false;   // Is the panel visible?
  var saveTimer = null;             // Debounce timer for auto-save
  var collapsedGroups = {};         // Track which groups are collapsed

  // ============================================================
  // INITIALIZATION — called when loan modal opens
  // Uses MutationObserver to detect modal open/close
  // ============================================================

  /** 
   * Initialize checklist for a loan.
   * If loan has saved checklist JSON, use that.
   * If not (new loan or first time), use the default template.
   */
  function initChecklist(loan) {
    if (loan && loan['Checklist JSON']) {
      try {
        checklistData = JSON.parse(loan['Checklist JSON']);
        // Merge any new default items that may have been added after loan was created
        checklistData = mergeWithDefaults(checklistData);
      } catch (e) {
        console.warn('Invalid Checklist JSON, using defaults:', e);
        checklistData = JSON.parse(JSON.stringify(DEFAULT_CHECKLIST));
      }
    } else {
      // New loan or no checklist yet — use fresh defaults
      checklistData = JSON.parse(JSON.stringify(DEFAULT_CHECKLIST));
    }
    updateBadge();
    if (checklistPanelOpen) {
      renderChecklist();
    }
  }

  /**
   * Merge saved checklist with defaults to pick up any new items
   * added after the loan was created. Preserves user order + data.
   * Also migrates items when groups are renamed or items move groups.
   */
  function mergeWithDefaults(saved) {
    // --- MIGRATION: Rename groups and move items to match new structure ---

    // Rename "Disclosures" → "Lender Disclosures"
    saved.forEach(function(item) {
      if (item.group === 'Disclosures') {
        item.group = 'Lender Disclosures';
      }
    });

    // Upgrade Opt Out Prescreen and Request Docs from 'none' to 'date'
    saved.forEach(function(item) {
      if ((item.id === 'app-opt-out' || item.id === 'app-request-docs') && item.inputType === 'none') {
        item.inputType = 'date';
      }
    });

    // Ensure all items have an 'na' property (added in v2.1)
    saved.forEach(function(item) {
      if (typeof item.na === 'undefined') {
        item.na = false;
      }
    });

    // Move AUS/GUS Ran and Preapproved/Prequalified from "Income & Assets" to "Credit & Prequalification"
    saved.forEach(function(item) {
      if (item.id === 'inc-aus' || item.id === 'inc-preapproved') {
        item.group = 'Credit & Prequalification';
      }
      // Also update label for the renamed item
      if (item.id === 'inc-preapproved') {
        item.label = 'Prequalified (Letter Sent)';
      }
      // v2.2: Rename "AUS/GUS Ran" → "Run AUS/GUS"
      if (item.id === 'inc-aus') {
        item.label = 'Run AUS/GUS';
      }
      // Rename "Send Quotes to Buyer" → "Quotes Sent to Borrower"
      if (item.id === 'hoi-sent-buyer') {
        item.label = 'Quotes Sent to Borrower';
      }
    });

    // Fix Closing order: ensure Funded comes before Closed
    var closedIdx = -1, fundedIdx = -1;
    for (var ci = 0; ci < saved.length; ci++) {
      if (saved[ci].id === 'close-closed') closedIdx = ci;
      if (saved[ci].id === 'close-funded') fundedIdx = ci;
    }
    if (closedIdx > -1 && fundedIdx > -1 && closedIdx < fundedIdx) {
      // Closed is before Funded — move Funded before Closed
      var fundedItem = saved.splice(fundedIdx, 1)[0];
      var newClosedIdx = saved.findIndex(function(i) { return i.id === 'close-closed'; });
      saved.splice(newClosedIdx, 0, fundedItem);
    }

    // --- END MIGRATION ---

    var savedIds = {};
    saved.forEach(function(item) { savedIds[item.id] = true; });
    // Add any new default items not in the saved data
    DEFAULT_CHECKLIST.forEach(function(def) {
      if (!savedIds[def.id]) {
        // Insert new item at the end of its group
        var lastGroupIndex = -1;
        for (var i = saved.length - 1; i >= 0; i--) {
          if (saved[i].group === def.group) { lastGroupIndex = i; break; }
        }
        if (lastGroupIndex >= 0) {
          saved.splice(lastGroupIndex + 1, 0, JSON.parse(JSON.stringify(def)));
        } else {
          // Group doesn't exist yet in saved data — find where it should go
          // based on DEFAULT_CHECKLIST order
          var defGroupOrder = [];
          var seenGroups = {};
          DEFAULT_CHECKLIST.forEach(function(d) {
            if (!seenGroups[d.group]) {
              defGroupOrder.push(d.group);
              seenGroups[d.group] = true;
            }
          });
          var targetGroupIdx = defGroupOrder.indexOf(def.group);
          // Find the first item from a later group and insert before it
          var insertIdx = saved.length; // default: append at end
          for (var j = 0; j < saved.length; j++) {
            var savedGroupIdx = defGroupOrder.indexOf(saved[j].group);
            if (savedGroupIdx > targetGroupIdx) {
              insertIdx = j;
              break;
            }
          }
          saved.splice(insertIdx, 0, JSON.parse(JSON.stringify(def)));
        }
      }
    });
    return saved;
  }

  // ============================================================
  // RENDER — builds the checklist HTML inside the panel
  // ============================================================
  function renderChecklist() {
    var body = document.getElementById('checklist-panel-body');
    if (!body) return;

    // Determine if current loan is a Purchase — controls Purchase Agreement visibility
    var isPurchase = false;
    var purposeField = document.getElementById('loan-purpose');
    if (purposeField && purposeField.value) {
      isPurchase = purposeField.value.toLowerCase().indexOf('purchase') !== -1;
    } else if (window.currentLoanId && window.loans) {
      var curLoan = window.loans.find(function(l) { return l.id === window.currentLoanId; });
      if (curLoan && curLoan['Loan Purpose']) {
        isPurchase = curLoan['Loan Purpose'].toLowerCase().indexOf('purchase') !== -1;
      }
    }

    // Group items by their group name (preserving order)
    var groups = [];
    var groupMap = {};
    checklistData.forEach(function(item) {
      if (!groupMap[item.group]) {
        groupMap[item.group] = { name: item.group, items: [] };
        groups.push(groupMap[item.group]);
      }
      groupMap[item.group].items.push(item);
    });

    var html = '';
    groups.forEach(function(group) {
      // Skip Purchase Agreement group if loan is not a Purchase
      if (group.name === 'Purchase Agreement' && !isPurchase) return;

      var meta = GROUP_META[group.name] || { icon: 'fa-solid fa-circle', color: '#64748B' };
      // Count checked OR N/A items as "done"
      var doneCount = group.items.filter(function(i) { return i.checked || i.na; }).length;
      var totalCount = group.items.length;
      var isCollapsed = collapsedGroups[group.name] === true;
      var allDone = doneCount === totalCount;

      html += '<div class="cl-group' + (isCollapsed ? ' collapsed' : '') + '" data-group="' + escapeAttr(group.name) + '">';

      // Group header
      html += '<div class="cl-group-header" onclick="toggleGroup(\\'' + escapeAttr(group.name) + '\\')">';
      html += '  <span class="cl-group-chevron"><i class="fa-solid fa-chevron-down"></i></span>';
      html += '  <span class="cl-group-icon" style="color:' + meta.color + '"><i class="' + meta.icon + '"></i></span>';
      html += '  <span class="cl-group-name">' + escapeHtml(group.name) + '</span>';
      html += '  <span class="cl-group-count' + (allDone ? ' complete' : '') + '">' + doneCount + '/' + totalCount + '</span>';
      html += '</div>';

      // Group items
      html += '<div class="cl-group-items">';
      group.items.forEach(function(item) {
        var isChecked = item.checked;
        var isNA = item.na === true;
        var itemClasses = 'cl-item' + (isChecked ? ' checked' : '') + (isNA ? ' na' : '');
        html += '<div class="' + itemClasses + '" data-id="' + escapeAttr(item.id) + '" draggable="true">';
        html += '  <span class="cl-drag-handle" title="Drag to reorder"><i class="fa-solid fa-grip-vertical"></i></span>';
        html += '  <label class="cl-checkbox">';
        html += '    <input type="checkbox"' + (isChecked ? ' checked' : '') + (isNA ? ' disabled' : '') + ' onchange="handleChecklistCheck(\\'' + escapeAttr(item.id) + '\\', this.checked)">';
        html += '    <span class="cl-checkmark"></span>';
        html += '  </label>';
        html += '  <span class="cl-label" onclick="toggleChecklistItem(\\'' + escapeAttr(item.id) + '\\')">' + escapeHtml(item.label) + (isNA ? ' <span class=\"cl-na-badge\">N/A</span>' : '') + '</span>';

        // N/A toggle button
        html += '  <button class="cl-na-btn' + (isNA ? ' active' : '') + '" onclick="handleChecklistNA(\\'' + escapeAttr(item.id) + '\\')" title="' + (isNA ? 'Remove N/A' : 'Mark as N/A') + '">N/A</button>';

        // Date or text input based on item type (hidden when N/A)
        if (item.inputType === 'date' && !isNA) {
          html += '  <input type="date" class="cl-date" value="' + (item.date || '') + '" onchange="handleChecklistDate(\\'' + escapeAttr(item.id) + '\\', this.value)">';
        } else if (item.inputType === 'text' && !isNA) {
          html += '  <input type="text" class="cl-text" value="' + escapeAttr(item.value || '') + '" placeholder="Enter..." onchange="handleChecklistValue(\\'' + escapeAttr(item.id) + '\\', this.value)">';
        }

        html += '</div>';
      });
      html += '</div>';
      html += '</div>';
    });

    body.innerHTML = html;
    updateProgress();
    initDragAndDrop();
  }

  // ============================================================
  // EVENT HANDLERS — checkbox, date, value changes
  // ============================================================

  /** Handle checkbox toggle */
  window.handleChecklistCheck = function(id, checked) {
    var item = findItem(id);
    if (!item) return;
    item.checked = checked;

    // If checking AND the item has a date input AND no date set, auto-fill today
    if (checked && item.inputType === 'date' && !item.date) {
      item.date = getTodayDate();
    }

    renderChecklist();
    updateBadge();
    scheduleAutoSave();
  };

  /** Handle date change */
  window.handleChecklistDate = function(id, dateVal) {
    var item = findItem(id);
    if (!item) return;
    item.date = dateVal;
    scheduleAutoSave();
  };

  /** Handle text value change for text-type items */
  window.handleChecklistValue = function(id, val) {
    var item = findItem(id);
    if (!item) return;
    item.value = val;
    scheduleAutoSave();
  };

  /** Toggle checkbox by clicking label */
  window.toggleChecklistItem = function(id) {
    var item = findItem(id);
    if (!item || item.na) return; // Don't toggle if N/A
    item.checked = !item.checked;
    if (item.checked && item.inputType === 'date' && !item.date) {
      item.date = getTodayDate();
    }
    renderChecklist();
    updateBadge();
    scheduleAutoSave();
  };

  /** Handle N/A toggle — marks item as not applicable */
  window.handleChecklistNA = function(id) {
    var item = findItem(id);
    if (!item) return;
    item.na = !item.na;
    // When marking N/A, uncheck the checkbox (N/A replaces checked)
    if (item.na) {
      item.checked = false;
    }
    renderChecklist();
    updateBadge();
    scheduleAutoSave();
  };

  // ============================================================
  // PANEL OPEN / CLOSE
  // ============================================================

  /** Toggle the checklist panel open/close */
  window.toggleChecklistPanel = function() {
    if (checklistPanelOpen) {
      closeChecklistPanel();
    } else {
      openChecklistPanel();
    }
  };

  function openChecklistPanel() {
    var panel = document.getElementById('checklist-panel');
    if (!panel) return;
    panel.classList.remove('hidden');
    // Force reflow before adding 'open' class for transition
    panel.offsetHeight;
    panel.classList.add('open');
    checklistPanelOpen = true;
    renderChecklist();

    // Highlight the nav item
    var navBtn = document.querySelector('.mnav-checklist-btn');
    if (navBtn) navBtn.classList.add('active');

    // Close on backdrop click
    panel.addEventListener('click', handleBackdropClick);
  }

  window.closeChecklistPanel = function() {
    var panel = document.getElementById('checklist-panel');
    if (!panel) return;
    panel.classList.remove('open');
    checklistPanelOpen = false;

    var navBtn = document.querySelector('.mnav-checklist-btn');
    if (navBtn) navBtn.classList.remove('active');

    panel.removeEventListener('click', handleBackdropClick);

    // Hide after transition
    setTimeout(function() {
      if (!checklistPanelOpen) {
        panel.classList.add('hidden');
      }
    }, 300);
  };

  function handleBackdropClick(e) {
    // Only close if clicking the backdrop (::before) not the panel content
    if (e.target.id === 'checklist-panel') {
      closeChecklistPanel();
    }
  }

  // ============================================================
  // GROUP COLLAPSE / EXPAND
  // ============================================================
  window.toggleGroup = function(groupName) {
    collapsedGroups[groupName] = !collapsedGroups[groupName];
    var groupEl = document.querySelector('.cl-group[data-group="' + groupName + '"]');
    if (groupEl) {
      groupEl.classList.toggle('collapsed', collapsedGroups[groupName]);
    }
  };

  window.collapseAllGroups = function() {
    var allGroups = document.querySelectorAll('.cl-group');
    allGroups.forEach(function(g) {
      var name = g.getAttribute('data-group');
      collapsedGroups[name] = true;
      g.classList.add('collapsed');
    });
  };

  window.expandAllGroups = function() {
    var allGroups = document.querySelectorAll('.cl-group');
    allGroups.forEach(function(g) {
      var name = g.getAttribute('data-group');
      collapsedGroups[name] = false;
      g.classList.remove('collapsed');
    });
  };

  // ============================================================
  // DRAG & DROP — reorder items within a group
  // ============================================================
  function initDragAndDrop() {
    var items = document.querySelectorAll('.cl-item[draggable="true"]');
    items.forEach(function(item) {
      item.addEventListener('dragstart', handleDragStart);
      item.addEventListener('dragover', handleDragOver);
      item.addEventListener('dragenter', handleDragEnter);
      item.addEventListener('dragleave', handleDragLeave);
      item.addEventListener('drop', handleDrop);
      item.addEventListener('dragend', handleDragEnd);
    });
  }

  var dragSrcEl = null;

  function handleDragStart(e) {
    dragSrcEl = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.getAttribute('data-id'));
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDragEnter(e) {
    e.preventDefault();
    // Only allow drop within same group
    if (dragSrcEl && this !== dragSrcEl) {
      var srcGroup = dragSrcEl.closest('.cl-group');
      var tgtGroup = this.closest('.cl-group');
      if (srcGroup === tgtGroup) {
        this.classList.add('drag-over');
      }
    }
  }

  function handleDragLeave() {
    this.classList.remove('drag-over');
  }

  function handleDrop(e) {
    e.stopPropagation();
    e.preventDefault();
    this.classList.remove('drag-over');

    if (!dragSrcEl || this === dragSrcEl) return;

    var srcGroup = dragSrcEl.closest('.cl-group');
    var tgtGroup = this.closest('.cl-group');
    if (srcGroup !== tgtGroup) return; // Only reorder within same group

    var srcId = dragSrcEl.getAttribute('data-id');
    var tgtId = this.getAttribute('data-id');

    // Reorder in data array
    var srcIdx = checklistData.findIndex(function(i) { return i.id === srcId; });
    var tgtIdx = checklistData.findIndex(function(i) { return i.id === tgtId; });
    if (srcIdx < 0 || tgtIdx < 0) return;

    var moved = checklistData.splice(srcIdx, 1)[0];
    // Recalculate target index after removal
    tgtIdx = checklistData.findIndex(function(i) { return i.id === tgtId; });
    checklistData.splice(tgtIdx, 0, moved);

    // Re-number order within the group
    var groupName = moved.group;
    var orderCounter = 1;
    checklistData.forEach(function(item) {
      if (item.group === groupName) {
        item.order = orderCounter++;
      }
    });

    renderChecklist();
    scheduleAutoSave();
  }

  function handleDragEnd() {
    this.classList.remove('dragging');
    document.querySelectorAll('.cl-item.drag-over').forEach(function(el) {
      el.classList.remove('drag-over');
    });
    dragSrcEl = null;
  }

  // ============================================================
  // AUTO-SAVE — debounced save to Airtable
  // ============================================================
  function scheduleAutoSave() {
    clearTimeout(saveTimer);
    showSaveStatus('saving');
    saveTimer = setTimeout(function() {
      saveChecklist();
    }, 800); // 800ms debounce
  }

  function saveChecklist() {
    // Get the current loan ID (set by pipeline-app.js)
    var loanId = window.currentLoanId;
    if (!loanId || loanId.startsWith('temp_')) {
      // New loan not yet saved — store in global for saveLoan to include
      window._checklistJSON = JSON.stringify(checklistData);
      showSaveStatus('saved');
      return;
    }

    // Auto-save just the Checklist JSON field
    var jsonStr = JSON.stringify(checklistData);
    window._checklistJSON = jsonStr; // Also update global in case saveLoan runs

    if (typeof window.apiCall === 'function') {
      window.apiCall('/api/pipeline/loans/' + loanId, 'PUT', { 'Checklist JSON': jsonStr })
        .then(function() {
          showSaveStatus('saved');
          // Also update the local loans array so re-opening the modal shows current data
          if (window.loans) {
            var loan = window.loans.find(function(l) { return l.id === loanId; });
            if (loan) loan['Checklist JSON'] = jsonStr;
          }
        })
        .catch(function(err) {
          console.error('Checklist auto-save failed:', err);
          showSaveStatus('error');
        });
    }
  }

  /** Get the current checklist as JSON string (called by saveLoan for new loans) */
  window.getChecklistJSON = function() {
    return JSON.stringify(checklistData);
  };

  // ============================================================
  // UI HELPERS
  // ============================================================

  /** Update the progress bar and pill */
  function updateProgress() {
    // Determine if Purchase Agreement is visible
    var isPurchase = false;
    var purposeField = document.getElementById('loan-purpose');
    if (purposeField && purposeField.value) {
      isPurchase = purposeField.value.toLowerCase().indexOf('purchase') !== -1;
    } else if (window.currentLoanId && window.loans) {
      var curLoan = window.loans.find(function(l) { return l.id === window.currentLoanId; });
      if (curLoan && curLoan['Loan Purpose']) {
        isPurchase = curLoan['Loan Purpose'].toLowerCase().indexOf('purchase') !== -1;
      }
    }

    // Filter out hidden Purchase Agreement items from progress count
    var visibleItems = checklistData.filter(function(i) {
      if (i.group === 'Purchase Agreement' && !isPurchase) return false;
      return true;
    });
    var total = visibleItems.length;
    var checked = visibleItems.filter(function(i) { return i.checked || i.na; }).length;
    var pct = total > 0 ? Math.round((checked / total) * 100) : 0;

    var fill = document.getElementById('checklist-progress-fill');
    if (fill) fill.style.width = pct + '%';

    var pill = document.getElementById('checklist-progress-pill');
    if (pill) pill.textContent = checked + ' / ' + total;
  }

  /** Update the badge in the left nav sidebar */
  function updateBadge() {
    // Determine if Purchase Agreement is visible
    var isPurchase = false;
    var purposeField = document.getElementById('loan-purpose');
    if (purposeField && purposeField.value) {
      isPurchase = purposeField.value.toLowerCase().indexOf('purchase') !== -1;
    } else if (window.currentLoanId && window.loans) {
      var curLoan = window.loans.find(function(l) { return l.id === window.currentLoanId; });
      if (curLoan && curLoan['Loan Purpose']) {
        isPurchase = curLoan['Loan Purpose'].toLowerCase().indexOf('purchase') !== -1;
      }
    }

    var visibleItems = checklistData.filter(function(i) {
      if (i.group === 'Purchase Agreement' && !isPurchase) return false;
      return true;
    });
    var total = visibleItems.length;
    var checked = visibleItems.filter(function(i) { return i.checked || i.na; }).length;

    var badge = document.getElementById('checklist-badge');
    if (badge) badge.textContent = checked + '/' + total;
  }

  /** Show save status indicator */
  function showSaveStatus(status) {
    var el = document.getElementById('checklist-save-status');
    if (!el) return;
    el.className = 'checklist-auto-save-status ' + status;
    if (status === 'saving') el.textContent = 'Saving...';
    else if (status === 'saved') el.textContent = 'Saved \\u2713';
    else if (status === 'error') el.textContent = 'Save failed';

    // Reset to neutral after 3 seconds
    if (status === 'saved') {
      setTimeout(function() {
        if (el.textContent === 'Saved \\u2713') {
          el.className = 'checklist-auto-save-status';
          el.textContent = 'Auto-saved';
        }
      }, 3000);
    }
  }

  /** Find an item in checklistData by ID */
  function findItem(id) {
    return checklistData.find(function(i) { return i.id === id; });
  }

  /** Get today's date as YYYY-MM-DD */
  function getTodayDate() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /** Escape HTML for safe rendering */
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** Escape for use in HTML attributes */
  function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\\\'").replace(/"/g, '&quot;');
  }

  // ============================================================
  // INTEGRATION — Hook into loan modal open/close
  // Uses MutationObserver to detect when the modal opens
  // ============================================================
  function setupModalObserver() {
    var modal = document.getElementById('loan-modal');
    if (!modal) {
      // Modal not in DOM yet, retry
      setTimeout(setupModalObserver, 500);
      return;
    }

    var wasHidden = modal.classList.contains('hidden');

    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        if (m.type === 'attributes' && m.attributeName === 'class') {
          var isHidden = modal.classList.contains('hidden');

          if (wasHidden && !isHidden) {
            // Modal just opened — wait a tick for currentLoanId to be set
            setTimeout(function() {
              var loanId = window.currentLoanId;
              var loan = null;
              if (loanId && window.loans) {
                loan = window.loans.find(function(l) { return l.id === loanId; });
              }
              initChecklist(loan);
            }, 100);
          }

          if (!wasHidden && isHidden) {
            // Modal closed — close checklist panel too
            if (checklistPanelOpen) {
              closeChecklistPanel();
            }
            // Clear the temp checklist JSON
            window._checklistJSON = null;
          }

          wasHidden = isHidden;
        }
      });
    });

    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
  }

  // ============================================================
  // MONKEY-PATCH saveLoan to include checklist for new loans
  // ============================================================
  function patchSaveLoan() {
    if (typeof window.saveLoan !== 'function') {
      setTimeout(patchSaveLoan, 500);
      return;
    }

    var originalSaveLoan = window.saveLoan;
    window.saveLoan = async function() {
      // Before the original save, inject checklist JSON into a hidden field
      // The original function builds the fields object, but we need to
      // patch after it sends to the API.
      
      // Store checklist JSON in global for the worker
      window._checklistJSON = JSON.stringify(checklistData);
      
      // Call original save
      await originalSaveLoan.apply(this, arguments);
      
      // After save, if this was a new loan, save checklist to the now-created record
      if (window.currentLoanId && !window.currentLoanId.startsWith('temp_')) {
        // The loan now has an ID, save the checklist
        var loanId = window.currentLoanId;
        var jsonStr = JSON.stringify(checklistData);
        if (typeof window.apiCall === 'function') {
          try {
            await window.apiCall('/api/pipeline/loans/' + loanId, 'PUT', { 'Checklist JSON': jsonStr });
            var loan = window.loans ? window.loans.find(function(l) { return l.id === loanId; }) : null;
            if (loan) loan['Checklist JSON'] = jsonStr;
          } catch (e) {
            console.warn('Could not save checklist after loan creation:', e);
          }
        }
      }
    };
    console.log('\\u2705 Checklist patched into saveLoan');
  }

  // ============================================================
  // BOOT — start everything
  // ============================================================
  function boot() {
    setupModalObserver();
    patchSaveLoan();
    console.log('\\u2705 Pipeline Checklist module loaded (v2.2) — 50 items, 14 groups, N/A support');
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(boot, 300); });
  } else {
    setTimeout(boot, 300);
  }

})();
`;
  return new Response(jsContent, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      ...getCorsHeaders(request)
    }
  });
}


// ============================================================
// PIPELINE DOCUMENTS — STATIC JS MODULE
// ============================================================
/**
 * GET /static/pipeline-documents.js
 * Serves the loan document tracking module for the Pipeline page.
 *
 * v2.1 — Two separate cards + note blur fix:
 *   - Borrower Documents and Broker/Lender Documents are now two
 *     completely independent cards (injected side-by-side in section-pages).
 *   - Each card has its own toolbar, progress pill, and Copy Needs List
 *     button that only copies docs from that card's responsibility.
 *   - Fixed note blur/click race condition: _docSaveNote no longer
 *     re-renders the DOM, so clicking another note button or the same
 *     toggle button works immediately without requiring page reload.
 *
 * v2.0 — Borrower / Broker responsibility split (initial):
 *   - Each document has a `resp` field: 'borrower' or 'broker'
 *   - Migration: existing saved docs auto-assigned resp from defaults
 *
 * v1.0 — Initial release:
 *   - 34 default mortgage document items across 8 categories
 *   - Per-document status: Needed / Received / Waived
 *   - Date received tracking + per-document notes
 *   - Add custom documents to any category
 *   - "Copy Needs List" — clipboard text + screenshot popup
 *   - Auto-save to Airtable "Documents JSON" field
 *   - Badge in left nav showing progress
 *   - Runtime-injected nav item + section card (no HTML/CSS changes)
 */
async function getPipelineDocumentsJS(request) {
  const jsContent = `
/*
  ============================================================
  Pipeline Documents Module v2.1
  ============================================================
  Served via: /static/pipeline-documents.js
  Loaded AFTER pipeline-app.js so it has access to globals:
    - window.currentLoanId
    - window.loans
    - window.apiCall(path, method, body)
    - window.showSection(pageId)

  v2.1 — Two independent cards + note blur/click fix
  v2.0 — Borrower / Broker responsibility split
  v1.0 — Initial release (34 items, 8 groups)
  ============================================================
*/
(function() {
  'use strict';

  // ============================================================
  // CSS - injected at runtime (HTML+CSS embeds at 50K limit)
  // ============================================================
  var css = document.createElement('style');
  css.textContent = ''
    /* ----- Card-level toolbar ----- */
    + '.doc-toolbar{display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap}'
    + '.doc-toolbar-left{display:flex;align-items:center;gap:8px;flex:1;min-width:200px}'
    + '.doc-toolbar-right{display:flex;align-items:center;gap:6px;flex-shrink:0}'
    + '.doc-search{padding:6px 10px 6px 32px;border:1px solid #E2E8F0;border-radius:6px;font-size:13px;color:#1E293B;background:#F8FAFC url("data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'16\\' height=\\'16\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'%2394A3B8\\' stroke-width=\\'2\\'%3E%3Ccircle cx=\\'11\\' cy=\\'11\\' r=\\'8\\'/%3E%3Cpath d=\\'m21 21-4.35-4.35\\'/%3E%3C/svg%3E") 8px center no-repeat;width:200px;transition:border-color .15s}'
    + '.doc-search:focus{outline:none;border-color:#3B82F6;background-color:#fff}'
    + '.doc-btn{padding:5px 12px;font-size:12px;font-weight:600;border-radius:6px;cursor:pointer;border:1px solid #E2E8F0;background:#fff;color:#334155;display:inline-flex;align-items:center;gap:5px;transition:all .15s;white-space:nowrap}'
    + '.doc-btn:hover{background:#F1F5F9;border-color:#CBD5E1}'
    + '.doc-btn-primary{background:#3B82F6;color:#fff;border-color:#3B82F6}'
    + '.doc-btn-primary:hover{background:#2563EB;border-color:#2563EB}'
    + '.doc-btn-green{background:#10B981;color:#fff;border-color:#10B981}'
    + '.doc-btn-green:hover{background:#059669;border-color:#059669}'
    + '.doc-progress-pill{font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;white-space:nowrap}'
    /* ----- Two-card section wrapper ----- */
    + '.doc-cards-wrap{display:flex;flex-direction:row;gap:16px;align-items:flex-start}'
    + '.doc-card{border:1px solid #E2E8F0;border-radius:10px;background:#fff;overflow:hidden;flex:1;min-width:0}'
    + '.doc-card-header{display:flex;align-items:center;gap:10px;padding:14px 16px;cursor:default;user-select:none}'
    + '.doc-card-header.resp-borrower{background:linear-gradient(135deg,#EFF6FF 0%,#DBEAFE 100%);border-bottom:1px solid #BFDBFE}'
    + '.doc-card-header.resp-broker{background:linear-gradient(135deg,#F0FDF4 0%,#DCFCE7 100%);border-bottom:1px solid #BBF7D0}'
    + '.doc-card-icon{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;color:#fff;flex-shrink:0}'
    + '.doc-card-icon.resp-borrower{background:#3B82F6}'
    + '.doc-card-icon.resp-broker{background:#10B981}'
    + '.doc-card-title{font-size:15px;font-weight:800;color:#1E293B;flex:1}'
    + '.doc-card-count{font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;white-space:nowrap}'
    + '.doc-card-count.resp-borrower{background:#DBEAFE;color:#2563EB}'
    + '.doc-card-count.resp-broker{background:#DCFCE7;color:#059669}'
    + '.doc-card-body{padding:12px 16px 16px}'
    /* ----- Group styles ----- */
    + '.doc-group{margin-bottom:12px;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;background:#fff}'
    + '.doc-group-header{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#F8FAFC;cursor:pointer;user-select:none;border-bottom:1px solid #E2E8F0;transition:background .1s}'
    + '.doc-group-header:hover{background:#F1F5F9}'
    + '.doc-group-icon{width:20px;height:20px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;flex-shrink:0}'
    + '.doc-group-name{font-size:13px;font-weight:700;color:#1E293B;flex:1}'
    + '.doc-group-count{font-size:11px;font-weight:600;color:#94A3B8;white-space:nowrap}'
    + '.doc-group-chevron{font-size:10px;color:#94A3B8;transition:transform .2s}'
    + '.doc-group.collapsed .doc-group-chevron{transform:rotate(-90deg)}'
    + '.doc-group-body{transition:max-height .2s ease}'
    + '.doc-group.collapsed .doc-group-body{display:none}'
    /* ----- Document row ----- */
    + '.doc-row{display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid #F1F5F9;transition:background .1s}'
    + '.doc-row:last-child{border-bottom:none}'
    + '.doc-row:hover{background:#FAFBFE}'
    + '.doc-row.doc-received{background:#F0FDF4}'
    + '.doc-row.doc-waived{opacity:.55}'
    + '.doc-row.doc-waived .doc-label{text-decoration:line-through}'
    /* ----- Status button ----- */
    + '.doc-status-btn{width:26px;height:26px;border-radius:6px;border:2px solid #CBD5E1;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px;transition:all .15s;flex-shrink:0;padding:0;line-height:1}'
    + '.doc-status-btn.s-needed{border-color:#F59E0B;color:#F59E0B;background:#FFFBEB}'
    + '.doc-status-btn.s-received{border-color:#10B981;color:#10B981;background:#ECFDF5}'
    + '.doc-status-btn.s-waived{border-color:#94A3B8;color:#94A3B8;background:#F1F5F9}'
    /* ----- Label + date + notes ----- */
    + '.doc-label{font-size:13px;font-weight:500;color:#1E293B;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.doc-date{width:110px;padding:4px 6px;border:1px solid #E2E8F0;border-radius:5px;font-size:12px;color:#334155;background:#fff;flex-shrink:0}'
    + '.doc-date:focus{outline:none;border-color:#3B82F6}'
    + '.doc-date::-webkit-calendar-picker-indicator{opacity:.5}'
    + '.doc-note-btn{width:26px;height:26px;border-radius:5px;border:1px solid #E2E8F0;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:11px;color:#94A3B8;transition:all .15s;flex-shrink:0;padding:0}'
    + '.doc-note-btn:hover{background:#EFF6FF;border-color:#93C5FD;color:#3B82F6}'
    + '.doc-note-btn.has-note{background:#EFF6FF;border-color:#93C5FD;color:#3B82F6}'
    + '.doc-note-row{padding:4px 14px 10px 48px;background:#F8FAFC;border-bottom:1px solid #F1F5F9}'
    + '.doc-note-input{width:100%;padding:5px 8px;border:1px solid #E2E8F0;border-radius:5px;font-size:12px;color:#334155;font-family:inherit;resize:none;min-height:32px;background:#fff}'
    + '.doc-note-input:focus{outline:none;border-color:#3B82F6}'
    /* ----- Delete custom doc button ----- */
    + '.doc-delete-btn{width:20px;height:20px;border:none;background:transparent;cursor:pointer;color:#CBD5E1;font-size:14px;display:flex;align-items:center;justify-content:center;border-radius:4px;flex-shrink:0;padding:0;transition:all .15s}'
    + '.doc-delete-btn:hover{color:#EF4444;background:#FEF2F2}'
    /* ----- Needs list popup overlay ----- */
    + '.doc-needs-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.4);z-index:10002;display:flex;align-items:center;justify-content:center;padding:20px}'
    + '.doc-needs-popup{background:#fff;border-radius:12px;padding:24px;max-width:420px;width:100%;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}'
    + '.doc-needs-title{font-size:15px;font-weight:800;color:#1E293B;text-align:center;margin-bottom:4px}'
    + '.doc-needs-borrower{font-size:13px;font-weight:600;color:#64748B;text-align:center;margin-bottom:12px}'
    + '.doc-needs-divider{border:none;border-top:2px solid #E2E8F0;margin:0 0 10px}'
    + '.doc-needs-group-title{font-size:11px;font-weight:700;color:#3B82F6;text-transform:uppercase;letter-spacing:.5px;margin:10px 0 4px;padding-left:2px}'
    + '.doc-needs-item{font-size:13px;color:#334155;padding:2px 0 2px 4px;display:flex;align-items:center;gap:6px}'
    + '.doc-needs-item::before{content:"\\\\25A1";color:#F59E0B;font-size:14px;flex-shrink:0}'
    + '.doc-needs-footer{margin-top:12px;padding-top:10px;border-top:2px solid #E2E8F0;text-align:center;font-size:12px;font-weight:700;color:#64748B}'
    + '.doc-needs-close{position:absolute;top:12px;right:14px;background:none;border:none;font-size:20px;color:#94A3B8;cursor:pointer;padding:4px}'
    + '.doc-needs-close:hover{color:#1E293B}'
    + '.doc-needs-popup-wrap{position:relative}'
    + '.doc-needs-actions{display:flex;gap:8px;justify-content:center;margin-top:12px}'
    /* ----- Add doc form ----- */
    + '.doc-add-form{display:flex;align-items:center;gap:8px;padding:8px 14px;background:#F8FAFC;border-top:1px solid #E2E8F0}'
    + '.doc-add-input{flex:1;padding:6px 10px;border:1px solid #E2E8F0;border-radius:6px;font-size:13px;color:#1E293B;background:#fff}'
    + '.doc-add-input:focus{outline:none;border-color:#3B82F6}'
    + '.doc-save-status{font-size:11px;color:#94A3B8;margin-left:auto;white-space:nowrap}'
    /* ----- Nav badge ----- */
    + '.doc-badge{font-size:10px;font-weight:700;padding:1px 6px;border-radius:10px;background:#DBEAFE;color:#2563EB;margin-left:auto}'
    /* ----- Override section-full max-width: docs needs full grid width for side-by-side cards ----- */
    + '#section-documents.section-full{max-width:none;justify-self:stretch}'
    /* ----- Responsive ----- */
    + '@media(max-width:900px){.doc-cards-wrap{flex-direction:column}.doc-toolbar{flex-direction:column;align-items:stretch}.doc-toolbar-left,.doc-toolbar-right{width:100%}.doc-search{width:100%}.doc-date{width:90px}.doc-label{font-size:12px}.doc-needs-popup{max-width:95vw;padding:16px}}';
  document.head.appendChild(css);


  // ============================================================
  // DEFAULT DOCUMENTS TEMPLATE - 34 items across 8 groups
  // Each: { id, label, group, resp, status, dateReceived, notes, custom }
  // resp: 'borrower' = client provides | 'broker' = broker/lender handles
  // status: 'needed' | 'received' | 'waived'
  // ============================================================
  var DEFAULT_DOCUMENTS = [
    // GROUP 1: Application & ID — ALL BORROWER
    { id: 'doc-1003',           label: '1003 / Application',                group: 'Application & ID',       resp: 'borrower', status: 'needed', dateReceived: '', notes: '', custom: false },
    { id: 'doc-photo-id',       label: 'Government Photo ID (Borrower)',    group: 'Application & ID',       resp: 'borrower', status: 'needed', dateReceived: '', notes: '', custom: false },
    { id: 'doc-photo-id-co',    label: 'Government Photo ID (Co-Borrower)', group: 'Application & ID',       resp: 'borrower', status: 'needed', dateReceived: '', notes: '', custom: false },
    { id: 'doc-ssn-card',       label: 'Social Security Card / ITIN',       group: 'Application & ID',       resp: 'borrower', status: 'needed', dateReceived: '', notes: '', custom: false },

    // GROUP 2: Income - Employment — ALL BORROWER
    { id: 'doc-paystubs',       label: 'Paystubs - 2 Most Recent (Borr)',    group: 'Income - Employment',   resp: 'borrower', status: 'needed', dateReceived: '', notes: '', custom: false },
    { id: 'doc-paystubs-co',    label: 'Paystubs - 2 Most Recent (Co-Borr)', group: 'Income - Employment',   resp: 'borrower', status: 'needed', dateReceived: '', notes: '', custom: false },
    { id: 'doc-w2-borr',        label: 'W-2s - 2 Years (Borrower)',          group: 'Income - Employment',   resp: 'borrower', status: 'needed', dateReceived: '', notes: '', custom: false },
    { id: 'doc-w2-co',          label: 'W-2s - 2 Years (Co-Borrower)',       group: 'Income - Employment',   resp: 'borrower', status: 'needed', dateReceived: '', notes: '', custom: false },
    { id: 'doc-tax-borr',       label: 'Tax Returns - 2 Years (Borr)',       group: 'Income - Employment',   resp: 'borrower', status: 'needed', dateReceived: '', notes: '', custom: false },
    { id: 'doc-tax-co',         label: 'Tax Returns - 2 Years (Co-Borr)',    group: 'Income - Employment',   resp: 'borrower', status: 'needed', dateReceived: '', notes: '', custom: false },

    // GROUP 3: Income - Self-Employed — ALL BORROWER
    { id: 'doc-biz-tax',        label: 'Business Tax Returns - 2 Years',  group: 'Income - Self-Employed',   resp: 'borrower', status: 'needed', dateReceived: '', notes: '', custom: false },
    { id: 'doc-pnl',            label: 'Profit & Loss Statement (YTD)',   group: 'Income - Self-Employed',   resp: 'borrower', status: 'needed', dateReceived: '', notes: '', custom: false },
    { id: 'doc-biz-license',    label: 'Business License / Articles',     group: 'Income - Self-Employed',   resp: 'borrower', status: 'needed', dateReceived: '', notes: '', custom: false },
    { id: 'doc-cpa-letter',     label: 'CPA Letter / 1099s',             group: 'Income - Self-Employed',   resp: 'borrower', status: 'needed', dateReceived: '', notes: '', custom: false },

    // GROUP 4: Assets — ALL BORROWER
    { id: 'doc-bank-stmts',     label: 'Bank Statements - 2 Months (All)',  group: 'Assets',                resp: 'borrower', status: 'needed', dateReceived: '', notes: '', custom: false },
    { id: 'doc-retirement',     label: 'Retirement / Investment Statements', group: 'Assets',                resp: 'borrower', status: 'needed', dateReceived: '', notes: '', custom: false },
    { id: 'doc-gift-letter',    label: 'Gift Letter & Source Docs',          group: 'Assets',                resp: 'borrower', status: 'needed', dateReceived: '', notes: '', custom: false },
    { id: 'doc-earnest',        label: 'Earnest Money Documentation',        group: 'Assets',                resp: 'borrower', status: 'needed', dateReceived: '', notes: '', custom: false },

    // GROUP 5: Credit & Liabilities — MIXED
    { id: 'doc-credit-report',  label: 'Credit Report',                    group: 'Credit & Liabilities',    resp: 'broker',   status: 'needed', dateReceived: '', notes: '', custom: false },
    { id: 'doc-loe-inquiries',  label: 'LOE - Credit Inquiries',           group: 'Credit & Liabilities',    resp: 'borrower', status: 'needed', dateReceived: '', notes: '', custom: false },
    { id: 'doc-loe-lates',      label: 'LOE - Late Payments',              group: 'Credit & Liabilities',    resp: 'borrower', status: 'needed', dateReceived: '', notes: '', custom: false },
    { id: 'doc-loe-deposits',   label: 'LOE - Large Deposits',             group: 'Credit & Liabilities',    resp: 'borrower', status: 'needed', dateReceived: '', notes: '', custom: false },

    // GROUP 6: Property — MIXED
    { id: 'doc-purchase-agmt',  label: 'Purchase Agreement / Contract',    group: 'Property',                resp: 'borrower', status: 'needed', dateReceived: '', notes: '', custom: false },
    { id: 'doc-appraisal',      label: 'Appraisal Report',                 group: 'Property',                resp: 'broker',   status: 'needed', dateReceived: '', notes: '', custom: false },
    { id: 'doc-hoi-binder',     label: 'Homeowners Insurance Binder',      group: 'Property',                resp: 'borrower', status: 'needed', dateReceived: '', notes: '', custom: false },
    { id: 'doc-survey',         label: 'Property Survey',                  group: 'Property',                resp: 'broker',   status: 'needed', dateReceived: '', notes: '', custom: false },
    { id: 'doc-hoa-docs',       label: 'HOA Documents / Condo Cert',       group: 'Property',                resp: 'broker',   status: 'needed', dateReceived: '', notes: '', custom: false },

    // GROUP 7: Title & Insurance — ALL BROKER
    { id: 'doc-title',          label: 'Title Commitment / Prelim Title',  group: 'Title & Insurance',       resp: 'broker',   status: 'needed', dateReceived: '', notes: '', custom: false },
    { id: 'doc-flood-cert',     label: 'Flood Certification',              group: 'Title & Insurance',       resp: 'broker',   status: 'needed', dateReceived: '', notes: '', custom: false },
    { id: 'doc-pest',           label: 'Pest / WIR Inspection',            group: 'Title & Insurance',       resp: 'broker',   status: 'needed', dateReceived: '', notes: '', custom: false },

    // GROUP 8: Government Loans — MIXED
    { id: 'doc-va-coe',         label: 'VA - Certificate of Eligibility',    group: 'Government Loans',      resp: 'borrower', status: 'needed', dateReceived: '', notes: '', custom: false },
    { id: 'doc-va-dd214',       label: 'VA - DD-214 / Statement of Service', group: 'Government Loans',      resp: 'borrower', status: 'needed', dateReceived: '', notes: '', custom: false },
    { id: 'doc-fha-case',       label: 'FHA - Case Number Assignment',       group: 'Government Loans',      resp: 'broker',   status: 'needed', dateReceived: '', notes: '', custom: false },
    { id: 'doc-usda-elig',      label: 'USDA - Eligibility Determination',   group: 'Government Loans',      resp: 'broker',   status: 'needed', dateReceived: '', notes: '', custom: false }
  ];

  // Group metadata - icon + background color for headers
  var DOC_GROUP_META = {
    'Application & ID':        { icon: 'fa-solid fa-id-card',          color: '#3B82F6' },
    'Income - Employment':     { icon: 'fa-solid fa-briefcase',        color: '#10B981' },
    'Income - Self-Employed':  { icon: 'fa-solid fa-store',            color: '#8B5CF6' },
    'Assets':                  { icon: 'fa-solid fa-piggy-bank',       color: '#F59E0B' },
    'Credit & Liabilities':    { icon: 'fa-solid fa-credit-card',      color: '#EC4899' },
    'Property':                { icon: 'fa-solid fa-house',            color: '#0EA5E9' },
    'Title & Insurance':       { icon: 'fa-solid fa-scroll',           color: '#14B8A6' },
    'Government Loans':        { icon: 'fa-solid fa-flag-usa',         color: '#6366F1' }
  };

  // Build a lookup from doc id -> default resp (used during migration)
  var DEFAULT_RESP_MAP = {};
  DEFAULT_DOCUMENTS.forEach(function(d) { DEFAULT_RESP_MAP[d.id] = d.resp; });


  // ============================================================
  // STATE
  // ============================================================
  var documentsData = [];       // Current loan's document items
  var collapsedDocGroups = {};  // Which groups are collapsed (key = "resp|groupName")
  var docSaveTimer = null;      // Debounce timer for auto-save
  var openNoteId = null;        // Which doc's note row is open
  var docSearchTerm = '';       // Current search/filter term


  // ============================================================
  // INITIALIZATION - called when loan modal opens
  // ============================================================
  function initDocuments(loan) {
    if (loan && loan['Documents JSON']) {
      try {
        documentsData = JSON.parse(loan['Documents JSON']);
        documentsData = mergeWithDefaults(documentsData);
      } catch (e) {
        console.warn('Invalid Documents JSON, using defaults:', e);
        documentsData = JSON.parse(JSON.stringify(DEFAULT_DOCUMENTS));
      }
    } else {
      documentsData = JSON.parse(JSON.stringify(DEFAULT_DOCUMENTS));
    }
    openNoteId = null;
    docSearchTerm = '';
    updateDocBadge();
    if (window._currentSectionPage === 'section-documents') {
      renderDocuments();
    }
  }

  /**
   * Merge saved documents with defaults to pick up new items.
   * Also migrates v1.0 docs (no resp field) to v2.0+ format.
   */
  function mergeWithDefaults(saved) {
    saved.forEach(function(item) {
      if (typeof item.custom === 'undefined') item.custom = false;
      if (typeof item.status === 'undefined') item.status = 'needed';
      if (typeof item.dateReceived === 'undefined') item.dateReceived = '';
      if (typeof item.notes === 'undefined') item.notes = '';
      // v2.0 migration: add resp field if missing
      if (typeof item.resp === 'undefined') {
        item.resp = DEFAULT_RESP_MAP[item.id] || 'borrower';
      }
    });

    var savedIds = {};
    saved.forEach(function(item) { savedIds[item.id] = true; });

    DEFAULT_DOCUMENTS.forEach(function(def) {
      if (!savedIds[def.id]) {
        var lastIdx = -1;
        for (var i = saved.length - 1; i >= 0; i--) {
          if (saved[i].group === def.group) { lastIdx = i; break; }
        }
        var newItem = JSON.parse(JSON.stringify(def));
        if (lastIdx >= 0) {
          saved.splice(lastIdx + 1, 0, newItem);
        } else {
          saved.push(newItem);
        }
      }
    });
    return saved;
  }


  // ============================================================
  // HELPER - get counts for a specific responsibility
  // ============================================================
  function getRespCounts(respType) {
    var items = documentsData.filter(function(d) { return d.resp === respType; });
    var received = items.filter(function(d) { return d.status === 'received'; }).length;
    var active = items.filter(function(d) { return d.status !== 'waived'; }).length;
    return { received: received, active: active };
  }


  // ============================================================
  // RENDER - builds BOTH card bodies
  // ============================================================
  function renderDocuments() {
    renderCardBody('borrower');
    renderCardBody('broker');
    updateDocBadge();
  }

  /**
   * Render one card's body content (groups + rows)
   */
  function renderCardBody(respType) {
    var body = document.getElementById('doc-card-body-' + respType);
    if (!body) return;

    // Filter to this responsibility
    var filteredData = documentsData.filter(function(d) { return d.resp === respType; });

    // Apply search filter
    if (docSearchTerm) {
      var term = docSearchTerm.toLowerCase();
      filteredData = filteredData.filter(function(d) {
        return d.label.toLowerCase().indexOf(term) !== -1 ||
               d.group.toLowerCase().indexOf(term) !== -1 ||
               (d.notes && d.notes.toLowerCase().indexOf(term) !== -1);
      });
    }

    // Build groups
    var groups = [];
    var groupMap = {};
    filteredData.forEach(function(doc) {
      if (!groupMap[doc.group]) {
        groupMap[doc.group] = { name: doc.group, items: [] };
        groups.push(groupMap[doc.group]);
      }
      groupMap[doc.group].items.push({ doc: doc, globalIdx: documentsData.indexOf(doc) });
    });

    // Update the card header count pill
    var counts = getRespCounts(respType);
    var countEl = document.getElementById('doc-card-count-' + respType);
    if (countEl) countEl.textContent = counts.received + ' / ' + counts.active + ' received';

    var html = '';

    groups.forEach(function(group) {
      var meta = DOC_GROUP_META[group.name] || { icon: 'fa-solid fa-file', color: '#64748B' };
      var received = group.items.filter(function(i) { return i.doc.status === 'received'; }).length;
      var waived = group.items.filter(function(i) { return i.doc.status === 'waived'; }).length;
      var active = group.items.length - waived;
      var collapseKey = respType + '|' + group.name;
      var isCollapsed = collapsedDocGroups[collapseKey] || false;

      html += '<div class="doc-group' + (isCollapsed ? ' collapsed' : '') + '" data-group="' + escHtml(group.name) + '" data-resp="' + respType + '">';
      html += '<div class="doc-group-header" onclick="window._docToggleGroup(\\'' + escJs(collapseKey) + '\\')">';
      html += '<div class="doc-group-icon" style="background:' + meta.color + '"><i class="' + meta.icon + '"></i></div>';
      html += '<div class="doc-group-name">' + escHtml(group.name) + '</div>';
      html += '<div class="doc-group-count">' + received + '/' + active + ' received</div>';
      html += '<div class="doc-group-chevron"><i class="fa-solid fa-chevron-down"></i></div>';
      html += '</div>';
      html += '<div class="doc-group-body">';

      group.items.forEach(function(item) {
        var d = item.doc;
        var gi = item.globalIdx;
        var statusClass = 's-' + d.status;
        var rowClass = 'doc-row' + (d.status === 'received' ? ' doc-received' : '') + (d.status === 'waived' ? ' doc-waived' : '');
        var statusIcon = d.status === 'received' ? '&#10003;' : (d.status === 'waived' ? '&#8212;' : '');

        html += '<div class="' + rowClass + '" data-doc-idx="' + gi + '">';

        // Status toggle button
        html += '<button type="button" class="doc-status-btn ' + statusClass + '" onclick="window._docCycleStatus(' + gi + ')" title="Click to change status">' + statusIcon + '</button>';

        // Document label
        html += '<div class="doc-label">' + escHtml(d.label) + '</div>';

        // Date received (only show when status is received)
        if (d.status === 'received') {
          html += '<input type="date" class="doc-date" value="' + (d.dateReceived || '') + '" onchange="window._docSetDate(' + gi + ',this.value)" title="Date received">';
        } else {
          html += '<span style="width:110px;flex-shrink:0"></span>';
        }

        // Notes toggle button — uses onmousedown + preventDefault to fix blur race condition
        var hasNote = d.notes && d.notes.trim().length > 0;
        html += '<button type="button" class="doc-note-btn' + (hasNote ? ' has-note' : '') + '" onmousedown="event.preventDefault();window._docToggleNote(' + gi + ')" title="' + (hasNote ? 'Edit note' : 'Add note') + '"><i class="fa-solid fa-sticky-note"></i></button>';

        // Delete button (custom docs only)
        if (d.custom) {
          html += '<button type="button" class="doc-delete-btn" onclick="window._docDelete(' + gi + ')" title="Remove document">&times;</button>';
        }

        html += '</div>';

        // Notes row (if this doc's note is open)
        if (openNoteId === d.id) {
          html += '<div class="doc-note-row"><textarea class="doc-note-input" placeholder="Add a note..." onblur="window._docSaveNote(' + gi + ',this.value)" oninput="this.style.height=\\'auto\\';this.style.height=this.scrollHeight+\\'px\\'">' + escHtml(d.notes || '') + '</textarea></div>';
        }
      });

      html += '</div>'; // group-body

      // Add custom doc form
      html += '<div class="doc-add-form">';
      html += '<input type="text" class="doc-add-input" id="doc-add-input-' + respType + '-' + escAttr(group.name) + '" placeholder="Add document to ' + escHtml(group.name) + '..." onkeydown="if(event.key===\\'Enter\\'){event.preventDefault();window._docAddCustom(\\'' + escJs(group.name) + '\\',\\'' + respType + '\\');}">';
      html += '<button type="button" class="doc-btn" onclick="window._docAddCustom(\\'' + escJs(group.name) + '\\',\\'' + respType + '\\')"><i class="fa-solid fa-plus"></i></button>';
      html += '</div>';

      html += '</div>'; // doc-group
    });

    body.innerHTML = html;

    // Auto-focus notes textarea if open and in this card
    if (openNoteId) {
      var ta = body.querySelector('.doc-note-input');
      if (ta) { ta.focus(); ta.selectionStart = ta.value.length; }
    }
  }


  // ============================================================
  // STATUS CYCLING: needed -> received -> waived -> needed
  // ============================================================
  window._docCycleStatus = function(idx) {
    var doc = documentsData[idx]; if (!doc) return;
    if (doc.status === 'needed') {
      doc.status = 'received';
      doc.dateReceived = doc.dateReceived || new Date().toISOString().slice(0, 10);
    } else if (doc.status === 'received') {
      doc.status = 'waived';
    } else {
      doc.status = 'needed';
      doc.dateReceived = '';
    }
    updateDocBadge();
    renderDocuments();
    scheduleDocSave();
  };


  // ============================================================
  // DATE RECEIVED
  // ============================================================
  window._docSetDate = function(idx, val) {
    var doc = documentsData[idx]; if (!doc) return;
    doc.dateReceived = val;
    scheduleDocSave();
  };


  // ============================================================
  // NOTES — blur saves data without re-render (fixes race condition)
  // Toggle uses onmousedown+preventDefault so blur doesn't fire first
  // ============================================================
  window._docToggleNote = function(idx) {
    var doc = documentsData[idx]; if (!doc) return;

    // If a different note was open, grab its current value before re-rendering
    if (openNoteId && openNoteId !== doc.id) {
      var openTa = document.querySelector('.doc-note-input');
      if (openTa) {
        var prevDoc = documentsData.find(function(d) { return d.id === openNoteId; });
        if (prevDoc) {
          prevDoc.notes = openTa.value;
          scheduleDocSave();
        }
      }
    }

    openNoteId = (openNoteId === doc.id) ? null : doc.id;
    renderDocuments();
  };

  window._docSaveNote = function(idx, val) {
    var doc = documentsData[idx]; if (!doc) return;
    doc.notes = val;
    scheduleDocSave();
    // NOTE: intentionally does NOT call renderDocuments()
    // This fixes the blur/click race condition where re-rendering
    // the DOM during onblur destroyed the click target before
    // the onclick/onmousedown event could fire.
    // Just update the note icon indicator in-place.
    var noteBtn = document.querySelector('[data-doc-idx="' + idx + '"] .doc-note-btn');
    if (noteBtn) {
      if (val && val.trim().length > 0) {
        noteBtn.classList.add('has-note');
      } else {
        noteBtn.classList.remove('has-note');
      }
    }
  };


  // ============================================================
  // GROUP EXPAND/COLLAPSE (key = "resp|groupName")
  // ============================================================
  window._docToggleGroup = function(collapseKey) {
    collapsedDocGroups[collapseKey] = !collapsedDocGroups[collapseKey];
    renderDocuments();
  };


  // ============================================================
  // ADD CUSTOM DOCUMENT (inherits resp from its card)
  // ============================================================
  window._docAddCustom = function(groupName, respType) {
    var inputId = 'doc-add-input-' + respType + '-' + escAttr(groupName);
    var input = document.getElementById(inputId);
    if (!input) return;
    var label = input.value.trim();
    if (!label) return;

    var newDoc = {
      id: 'custom-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      label: label,
      group: groupName,
      resp: respType,
      status: 'needed',
      dateReceived: '',
      notes: '',
      custom: true
    };

    // Insert at end of matching group + resp
    var lastIdx = -1;
    for (var i = documentsData.length - 1; i >= 0; i--) {
      if (documentsData[i].group === groupName && documentsData[i].resp === respType) {
        lastIdx = i;
        break;
      }
    }
    if (lastIdx >= 0) {
      documentsData.splice(lastIdx + 1, 0, newDoc);
    } else {
      documentsData.push(newDoc);
    }

    input.value = '';
    updateDocBadge();
    renderDocuments();
    scheduleDocSave();
  };


  // ============================================================
  // DELETE CUSTOM DOCUMENT
  // ============================================================
  window._docDelete = function(idx) {
    var doc = documentsData[idx];
    if (!doc || !doc.custom) return;
    if (!confirm('Remove "' + doc.label + '" from the documents list?')) return;
    documentsData.splice(idx, 1);
    updateDocBadge();
    renderDocuments();
    scheduleDocSave();
  };


  // ============================================================
  // SEARCH / FILTER (shared across both cards)
  // ============================================================
  window._docSearch = function(val) {
    docSearchTerm = val;
    // Sync both search inputs so they stay in sync
    var inputs = document.querySelectorAll('.doc-search');
    inputs.forEach(function(inp) { if (inp.value !== val) inp.value = val; });
    renderDocuments();
  };


  // ============================================================
  // COPY NEEDS LIST — per-card (only copies docs from that card)
  // ============================================================
  window._docCopyNeedsList = function(respType) {
    var needed = documentsData.filter(function(d) {
      return d.resp === respType && d.status === 'needed';
    });
    if (needed.length === 0) {
      alert('All ' + (respType === 'borrower' ? 'borrower' : 'broker/lender') + ' documents have been received or waived!');
      return;
    }

    // Get borrower name for header
    var borrowerName = '';
    var firstEl = document.getElementById('borrower-first');
    var lastEl = document.getElementById('borrower-last');
    if (firstEl && lastEl) {
      borrowerName = ((firstEl.value || '') + ' ' + (lastEl.value || '')).trim();
    }

    // Build grouped list
    var groups = [];
    var gMap = {};
    needed.forEach(function(d) {
      if (!gMap[d.group]) { gMap[d.group] = []; groups.push(d.group); }
      gMap[d.group].push(d.label);
    });

    // Header label based on card type
    var headerLabel = respType === 'borrower' ? 'BORROWER DOCS NEEDED' : 'BROKER / LENDER DOCS NEEDED';

    // Build plain text for clipboard
    var text = headerLabel;
    if (borrowerName) text += ' \\u2014 ' + borrowerName;
    text += '\\n\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\n';
    groups.forEach(function(g) {
      gMap[g].forEach(function(label) {
        text += '\\u25A1 ' + label + '\\n';
      });
    });
    text += '\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\n';
    text += needed.length + ' item' + (needed.length !== 1 ? 's' : '') + ' still needed';

    // Copy to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }

    // Show visual popup
    showNeedsPopup(borrowerName, headerLabel, groups, gMap, needed.length);
  };

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* silent */ }
    document.body.removeChild(ta);
  }

  function showNeedsPopup(borrowerName, headerLabel, groups, gMap, total) {
    var existing = document.getElementById('doc-needs-overlay');
    if (existing) existing.remove();

    var html = '<div class="doc-needs-overlay" id="doc-needs-overlay" onclick="if(event.target===this)this.remove()">';
    html += '<div class="doc-needs-popup-wrap"><div class="doc-needs-popup">';
    html += '<button type="button" class="doc-needs-close" onclick="document.getElementById(\\'doc-needs-overlay\\').remove()">&times;</button>';
    html += '<div class="doc-needs-title">' + headerLabel + '</div>';
    if (borrowerName) {
      html += '<div class="doc-needs-borrower">' + escHtml(borrowerName) + '</div>';
    }
    html += '<hr class="doc-needs-divider">';

    groups.forEach(function(g) {
      html += '<div class="doc-needs-group-title">' + escHtml(g) + '</div>';
      gMap[g].forEach(function(label) {
        html += '<div class="doc-needs-item">' + escHtml(label) + '</div>';
      });
    });

    html += '<div class="doc-needs-footer">' + total + ' item' + (total !== 1 ? 's' : '') + ' still needed</div>';
    html += '<div class="doc-needs-actions">';
    html += '<button type="button" class="doc-btn" onclick="document.getElementById(\\'doc-needs-overlay\\').remove()">Close</button>';
    html += '</div>';
    html += '</div></div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
  }


  // ============================================================
  // BADGE - combined total in nav sidebar
  // ============================================================
  function updateDocBadge() {
    var badge = document.getElementById('doc-nav-badge');
    if (!badge) return;
    var received = documentsData.filter(function(d) { return d.status === 'received'; }).length;
    var active = documentsData.filter(function(d) { return d.status !== 'waived'; }).length;
    badge.textContent = received + '/' + active;
  }


  // ============================================================
  // AUTO-SAVE - debounced, same pattern as checklist
  // ============================================================
  function scheduleDocSave() {
    clearTimeout(docSaveTimer);
    showDocSaveStatus('saving');
    docSaveTimer = setTimeout(function() {
      saveDocuments();
    }, 800);
  }

  function saveDocuments() {
    var loanId = window.currentLoanId;
    if (!loanId || loanId.startsWith('temp_')) {
      window._documentsJSON = JSON.stringify(documentsData);
      showDocSaveStatus('saved');
      return;
    }

    var jsonStr = JSON.stringify(documentsData);
    window._documentsJSON = jsonStr;

    if (typeof window.apiCall === 'function') {
      window.apiCall('/api/pipeline/loans/' + loanId, 'PUT', { 'Documents JSON': jsonStr })
        .then(function() {
          showDocSaveStatus('saved');
          if (window.loans) {
            var loan = window.loans.find(function(l) { return l.id === loanId; });
            if (loan) loan['Documents JSON'] = jsonStr;
          }
        })
        .catch(function(err) {
          console.error('Documents auto-save failed:', err);
          showDocSaveStatus('error');
        });
    }
  }

  function showDocSaveStatus(state) {
    // Update save status in BOTH cards
    ['borrower', 'broker'].forEach(function(resp) {
      var el = document.getElementById('doc-save-status-' + resp);
      if (!el) return;
      if (state === 'saving') { el.textContent = 'Saving...'; el.style.color = '#F59E0B'; }
      else if (state === 'saved') { el.textContent = 'Saved'; el.style.color = '#10B981'; }
      else if (state === 'error') { el.textContent = 'Save failed'; el.style.color = '#EF4444'; }
    });
  }

  /** Get current documents as JSON string (called by saveLoan for new loans) */
  window.getDocumentsJSON = function() {
    return JSON.stringify(documentsData);
  };


  // ============================================================
  // INJECT NAV ITEM - adds "Docs" to the left sidebar
  // ============================================================
  function injectNavItem() {
    var sidebar = document.getElementById('modal-nav-sidebar');
    if (!sidebar) return;
    if (document.getElementById('doc-nav-item')) return;

    var divider = sidebar.querySelector('.mnav-divider');
    if (!divider) return;

    var navItem = document.createElement('a');
    navItem.className = 'mnav-item';
    navItem.id = 'doc-nav-item';
    navItem.setAttribute('data-section', 'section-documents');
    navItem.onclick = function() {
      if (typeof window.showSection === 'function') {
        window.showSection('section-documents');
      }
      renderDocuments();
    };
    navItem.innerHTML = '<i class="fa-solid fa-folder-open"></i><span>Docs</span><span class="doc-badge" id="doc-nav-badge">0/0</span>';

    sidebar.insertBefore(navItem, divider);
  }


  // ============================================================
  // INJECT SECTION - two independent cards inside one section wrapper
  // ============================================================
  function injectSection() {
    var sectionPages = document.getElementById('section-pages');
    if (!sectionPages) return;
    if (document.getElementById('section-documents')) return;

    var wrapper = document.createElement('div');
    wrapper.className = 'section-card section-hidden';
    wrapper.id = 'section-documents';
    wrapper.setAttribute('data-page', 'section-documents');

    wrapper.innerHTML = ''
      + '<div class="doc-cards-wrap">'
      /* ===== BORROWER CARD ===== */
      +   '<div class="doc-card">'
      +     '<div class="doc-card-header resp-borrower">'
      +       '<div class="doc-card-icon resp-borrower"><i class="fa-solid fa-user"></i></div>'
      +       '<div class="doc-card-title">Borrower Documents</div>'
      +       '<div class="doc-card-count resp-borrower" id="doc-card-count-borrower">0 / 0 received</div>'
      +     '</div>'
      +     '<div class="doc-card-body">'
      +       '<div class="doc-toolbar">'
      +         '<div class="doc-toolbar-left">'
      +           '<input type="text" class="doc-search" placeholder="Filter documents..." oninput="window._docSearch(this.value)">'
      +         '</div>'
      +         '<div class="doc-toolbar-right">'
      +           '<button type="button" class="doc-btn doc-btn-green" onclick="window._docCopyNeedsList(\\'borrower\\')"><i class="fa-solid fa-copy"></i> Copy Needs List</button>'
      +           '<span class="doc-save-status" id="doc-save-status-borrower"></span>'
      +         '</div>'
      +       '</div>'
      +       '<div id="doc-card-body-borrower"></div>'
      +     '</div>'
      +   '</div>'
      /* ===== BROKER CARD ===== */
      +   '<div class="doc-card">'
      +     '<div class="doc-card-header resp-broker">'
      +       '<div class="doc-card-icon resp-broker"><i class="fa-solid fa-building-columns"></i></div>'
      +       '<div class="doc-card-title">Broker / Lender Documents</div>'
      +       '<div class="doc-card-count resp-broker" id="doc-card-count-broker">0 / 0 received</div>'
      +     '</div>'
      +     '<div class="doc-card-body">'
      +       '<div class="doc-toolbar">'
      +         '<div class="doc-toolbar-left">'
      +           '<input type="text" class="doc-search" placeholder="Filter documents..." oninput="window._docSearch(this.value)">'
      +         '</div>'
      +         '<div class="doc-toolbar-right">'
      +           '<button type="button" class="doc-btn doc-btn-green" onclick="window._docCopyNeedsList(\\'broker\\')"><i class="fa-solid fa-copy"></i> Copy Needs List</button>'
      +           '<span class="doc-save-status" id="doc-save-status-broker"></span>'
      +         '</div>'
      +       '</div>'
      +       '<div id="doc-card-body-broker"></div>'
      +     '</div>'
      +   '</div>'
      + '</div>';

    sectionPages.appendChild(wrapper);
  }


  // ============================================================
  // MODAL OBSERVER - detect when loan modal opens/closes
  // ============================================================
  function setupModalObserver() {
    var modalEl = document.getElementById('loan-modal');
    if (!modalEl) {
      setTimeout(setupModalObserver, 500);
      return;
    }

    var lastHiddenState = modalEl.classList.contains('hidden');
    var observer = new MutationObserver(function(mutations) {
      var isHidden = modalEl.classList.contains('hidden');
      if (isHidden === lastHiddenState) return;
      lastHiddenState = isHidden;

      if (!isHidden) {
        injectNavItem();
        injectSection();
        setTimeout(function() {
          var loanId = window.currentLoanId;
          var loan = null;
          if (loanId && window.loans) {
            loan = window.loans.find(function(l) { return l.id === loanId; });
          }
          initDocuments(loan);
        }, 150);
      }
    });

    observer.observe(modalEl, { attributes: true, attributeFilter: ['class'] });
  }


  // ============================================================
  // MONKEY-PATCH saveLoan - include Documents JSON for new loans
  // ============================================================
  function patchSaveLoan() {
    if (typeof window.saveLoan !== 'function') {
      setTimeout(patchSaveLoan, 500);
      return;
    }

    var originalSaveLoan = window.saveLoan;
    window.saveLoan = async function() {
      window._documentsJSON = JSON.stringify(documentsData);
      await originalSaveLoan.apply(this, arguments);

      if (window.currentLoanId && !window.currentLoanId.startsWith('temp_')) {
        var loanId = window.currentLoanId;
        var jsonStr = JSON.stringify(documentsData);
        if (typeof window.apiCall === 'function') {
          try {
            await window.apiCall('/api/pipeline/loans/' + loanId, 'PUT', { 'Documents JSON': jsonStr });
            var loan = window.loans ? window.loans.find(function(l) { return l.id === loanId; }) : null;
            if (loan) loan['Documents JSON'] = jsonStr;
          } catch (e) {
            console.warn('Could not save documents after loan creation:', e);
          }
        }
      }
    };
    console.log('\\u2705 Documents patched into saveLoan');
  }


  // ============================================================
  // UTILITY - HTML escaping
  // ============================================================
  function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escJs(str) {
    return String(str).replace(/\\\\/g, '\\\\\\\\').replace(/'/g, "\\\\'");
  }
  function escAttr(str) {
    return String(str).replace(/[^a-zA-Z0-9\\-_]/g, '_');
  }


  // ============================================================
  // BOOT
  // ============================================================
  function boot() {
    setupModalObserver();
    patchSaveLoan();
    console.log('\\u2705 Pipeline Documents module loaded (v2.1) \\u2014 34 items, 8 groups, 2 independent cards');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(boot, 400); });
  } else {
    setTimeout(boot, 400);
  }
})();

`;
  return new Response(jsContent, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      ...getCorsHeaders(request)
    }
  });
}


// ============================================================
// PIPELINE ASSETS JS MODULE (served from /static/pipeline-assets.js)
// Builds the Assets tab UI: Cash to Close + Reserves (left),
// Accounts (right, separate card dynamically injected)
// ============================================================
async function getPipelineAssetsJS(request) {
  const jsContent = `

(function() {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     ACCOUNT TYPE OPTIONS (from MISMO / URLA standard list)
     ══════════════════════════════════════════════════════════════ */
  var ACCOUNT_TYPES = [
    'Bonds','Bridge Loan Proceeds','Cash On Hand','Certificate Of Deposit',
    'Checking','Gift Cash','Gift Of Equity','Grant',
    'Individual Development Account','Life Insurance','Money Market',
    'Mutual Fund','Other Asset','Proceeds From Non Property Sale',
    'Proceeds From Property Sale','Retirement','Savings',
    'Secured Borrowed Funds','Stock Options','Stocks',
    'Trust Account'
  ];

  /* In-memory account rows */
  var assetAccounts = [];
  var acctCounter = 0;

  /* ══════════════════════════════════════════════════════════════
     HELPERS
     ══════════════════════════════════════════════════════════════ */
  function pc(val) {
    if (!val) return 0;
    var n = parseFloat(String(val).replace(/[^0-9.\\-]/g, ''));
    return isNaN(n) ? 0 : n;
  }
  function fmt(num) {
    if (!num && num !== 0) return '\\u2014';
    if (num <= 0 && num !== 0) return '\\u2014';
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtOrDash(num) {
    return num > 0 ? fmt(num) : '\\u2014';
  }

  /* ══════════════════════════════════════════════════════════════
     ENSURE ACCOUNTS CARD EXISTS — dynamically create it as a
     separate section-card in #section-pages for 2-column layout
     ══════════════════════════════════════════════════════════════ */
  /* ══════════════════════════════════════════════════════════════
     INJECT STYLES — CSS for the Assets 2-column layout
     Following the same pattern as Documents (doc-cards-wrap).
     The parent section-card gets section-full from showSection(),
     so we override max-width just like Documents does.
     ══════════════════════════════════════════════════════════════ */
  /* ── ENSURE RIGHT COLUMN WRAPPER — single section-card in #section-pages
     that contains both Accounts and Summary as inner cards with flexbox.
     This avoids CSS grid row-height distribution issues. ── */
  function ensureRightColumn() {
    var wrapper = document.getElementById('section-assets-right');
    if (wrapper) return wrapper;
    wrapper = document.createElement('div');
    wrapper.className = 'section-card section-hidden';
    wrapper.id = 'section-assets-right';
    wrapper.setAttribute('data-page', 'section-assets');
    wrapper.style.cssText = 'display:flex;flex-direction:column;gap:16px;background:none;padding:0;border:none;box-shadow:none;align-self:start;';
    wrapper.innerHTML = ''
      /* ── ACCOUNTS CARD ── */
      + '<div class="card" id="section-assets-accounts">'
      +   '<div class="card-title"><i class="fa-solid fa-building-columns"></i> Accounts</div>'
      +   '<div id="accounts-section-content"></div>'
      + '</div>'
      /* ── ASSET SUMMARY CARD ── */
      + '<div class="card ast-summary-card" id="section-assets-summary">'
      +   '<div class="card-title"><i class="fa-solid fa-scale-balanced"></i> Asset Summary</div>'
      +   '<div class="ast-summary-grid">'
      +     '<div class="ast-summary-item">'
      +       '<div class="ast-summary-label">Total Account Balances</div>'
      +       '<div class="ast-summary-value" id="ast-sum-accounts">\\u2014</div>'
      +     '</div>'
      +     '<div class="ast-summary-op">\\u2212</div>'
      +     '<div class="ast-summary-item">'
      +       '<div class="ast-summary-label">Total Assets Needed</div>'
      +       '<div class="ast-summary-value" id="ast-sum-needed">\\u2014</div>'
      +     '</div>'
      +     '<div class="ast-summary-op">=</div>'
      +     '<div class="ast-summary-item ast-summary-result">'
      +       '<div class="ast-summary-label" id="ast-sum-result-label">Excess / Shortage</div>'
      +       '<div class="ast-summary-value ast-summary-result-val" id="ast-sum-result">\\u2014</div>'
      +     '</div>'
      +   '</div>'
      + '</div>';
    var pages = document.getElementById('section-pages');
    if (pages) pages.appendChild(wrapper);
    return wrapper;
  }

  /* ══════════════════════════════════════════════════════════════
     BUILD ASSETS SECTION — called by openLoanModal / openNewLoanModal
     Left card: Cash to Close + Reserves + Grand Total
     Right card: Accounts (dynamically created)
     ══════════════════════════════════════════════════════════════ */
  window.buildAssetsSection = function(loan) {
    var c = document.getElementById('assets-section-content');
    if (!c) return;
    assetAccounts = [];
    acctCounter = 0;

    /* ── LEFT CARD: Cash to Close + Reserves + Grand Total ──
       This fills the existing #section-assets card (defined in HTML template).
       The showSection hook assigns .ast-col-left (grid-column:1) to this card. */
    c.innerHTML = ''
      /* ── CASH TO CLOSE ── */
      + '<div class="ast-group">'
      +   '<div class="ast-group-title">Cash to Close</div>'
        +   '<div class="cg">'
        +     '<div class="ff"><label>Down Payment ($)</label>'
        +       '<div style="display:flex;align-items:center;gap:6px;">'
        +         '<input type="text" class="fc currency-input ast-input" id="asset-down-payment" placeholder="0" style="flex:1;">'
        +         '<button type="button" class="ast-sync-btn" onclick="syncAssetsDownPayment()" title="Pull from Loan Details"><i class="fa-solid fa-arrow-right-to-bracket"></i> Loan</button>'
        +       '</div>'
        +       '<span id="assets-dp-sync-msg" class="ast-sync-msg"></span>'
        +     '</div>'
        +     '<div class="ff"><label>Closing Costs ($)</label>'
        +       '<input type="text" class="fc currency-input ast-input" id="asset-closing-costs" placeholder="0">'
        +     '</div>'
        +   '</div>'
        +   '<div class="ast-total-row"><span>Total Cash to Close</span><span class="ast-total-val" id="ast-cash-to-close-total">\\u2014</span></div>'
        + '</div>'

        /* ── RESERVES ── */
        + '<div class="ast-group">'
        +   '<div class="ast-group-title">Reserves</div>'

        /* Primary Reserves */
        +   '<div class="ast-sub-label">Primary Reserves</div>'
        +   '<div class="cg">'
        +     '<div class="ff"><label>Months of Reserves</label>'
        +       '<input type="number" class="fc ast-input" id="asset-months-reserves" placeholder="0" min="0" step="1">'
        +     '</div>'
        +     '<div class="ff"><label>Est. Monthly Payment ($)</label>'
        +       '<div style="display:flex;align-items:center;gap:6px;">'
        +         '<input type="text" class="fc currency-input ast-input" id="asset-est-monthly-pmt" placeholder="0" style="flex:1;">'
        +         '<button type="button" class="ast-sync-btn" onclick="syncAssetsPITIA()" title="Pull Total PITIA from Payment tab"><i class="fa-solid fa-arrow-right-to-bracket"></i> PITIA</button>'
        +       '</div>'
        +       '<span id="assets-pitia-sync-msg" class="ast-sync-msg"></span>'
        +     '</div>'
        +   '</div>'
        +   '<div class="ast-subtotal-row"><span>Primary Reserve Amount</span><span class="ast-hint" id="ast-primary-hint"></span><span class="ast-subtotal-val" id="ast-primary-reserve-amt">\\u2014</span></div>'

        /* Other Reserves */
        +   '<div class="ast-sub-label" style="margin-top:12px;">Other Reserves</div>'
        +   '<div class="cg cg3">'
        +     '<div class="ff"><label>Months</label>'
        +       '<input type="number" class="fc ast-input" id="asset-other-months" placeholder="0" min="0" step="1">'
        +     '</div>'
        +     '<div class="ff"><label>Monthly Amount ($)</label>'
        +       '<input type="text" class="fc currency-input ast-input" id="asset-other-monthly-amt" placeholder="0">'
        +     '</div>'
        +     '<div class="ff"><label>Total Override ($)</label>'
        +       '<input type="text" class="fc currency-input ast-input ast-override" id="asset-other-total" placeholder="Auto">'
        +     '</div>'
        +   '</div>'
        +   '<div class="ast-subtotal-row"><span>Other Reserve Amount</span><span class="ast-hint" id="ast-other-hint"></span><span class="ast-subtotal-val" id="ast-other-reserve-amt">\\u2014</span></div>'

        +   '<div class="ast-total-row"><span>Total Reserves</span><span class="ast-total-val" id="ast-reserves-total">\\u2014</span></div>'
        + '</div>'

        /* ── GRAND TOTAL ── */
        + '<div class="ast-grand-total"><span>Total Assets Needed</span><span class="ast-grand-val" id="ast-grand-total">\\u2014</span></div>';

    /* ── RIGHT COLUMN: wrapper with Accounts + Summary (flexbox, 16px gap) ── */
    ensureRightColumn();
    var r = document.getElementById('accounts-section-content');
    if (r) {
      r.innerHTML = ''
        + '<div id="ast-accounts-list"></div>'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;">'
        +   '<button type="button" class="ast-add-btn" onclick="addAssetAccount()"><i class="fa-solid fa-plus"></i> Add Account</button>'
        + '</div>'
        + '<div class="ast-acct-grand-total"><span>Total Account Balances</span><span class="ast-acct-grand-val" id="ast-accounts-total">\\u2014</span></div>';
    }

    /* Wire currency formatting on all .ast-input fields */
    c.querySelectorAll('.ast-input').forEach(function(el) {
      el.addEventListener('input', recalcAll);
      el.addEventListener('change', recalcAll);
    });

    /* Populate from loan data */
    if (loan) {
      var setV = function(id, val) { var el = document.getElementById(id); if (el && val) el.value = typeof val === 'number' ? val.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : val; };
      var setN = function(id, val) { var el = document.getElementById(id); if (el && val != null) el.value = val; };
      setV('asset-down-payment', loan['Down Payment']);
      setV('asset-closing-costs', loan['Closing Costs']);
      setN('asset-months-reserves', loan['Months of Reserves']);
      setV('asset-est-monthly-pmt', loan['Estimated Monthly Payment']);
      setN('asset-other-months', loan['Other Reserves Months']);
      setV('asset-other-monthly-amt', loan['Other Reserves Monthly Amount']);
      /* Only populate override if it differs from calculated */
      var calcOther = (loan['Other Reserves Months'] || 0) * (loan['Other Reserves Monthly Amount'] || 0);
      if (loan['Other Reserves Total'] && Math.abs(loan['Other Reserves Total'] - calcOther) > 0.01) {
        setV('asset-other-total', loan['Other Reserves Total']);
      }
      /* Parse saved accounts JSON */
      if (loan['Asset Accounts']) {
        try {
          var saved = JSON.parse(loan['Asset Accounts']);
          if (Array.isArray(saved)) {
            saved.forEach(function(acct) { addAssetAccount(acct); });
          }
        } catch(e) { console.warn('Could not parse Asset Accounts JSON'); }
      }
    }

    recalcAll();
    console.log('\\u2705 Assets section built');
  };


  /* ══════════════════════════════════════════════════════════════
     SYNC BUTTONS
     ══════════════════════════════════════════════════════════════ */

  /* Pull Down Payment from Loan Details calculation (Purchase Price - Loan Amount) */
  window.syncAssetsDownPayment = function() {
    var msgEl = document.getElementById('assets-dp-sync-msg');
    var ppEl = document.getElementById('purchase-price');
    var laEl = document.getElementById('loan-amount');
    var pp = pc(ppEl ? ppEl.value : '');
    var la = pc(laEl ? laEl.value : '');
    if (pp > 0 && la > 0 && pp > la) {
      var dp = pp - la;
      var input = document.getElementById('asset-down-payment');
      if (input) {
        input.value = dp.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        recalcAll();
        if (msgEl) { msgEl.textContent = fmt(dp) + ' from Loan Details'; setTimeout(function(){ msgEl.textContent = ''; }, 3000); }
      }
    } else {
      if (msgEl) { msgEl.textContent = 'Need Purchase Price & Loan Amount'; setTimeout(function(){ msgEl.textContent = ''; }, 3000); }
    }
  };

  /* Pull PITIA from Payment tab */
  window.syncAssetsPITIA = function() {
    var pitiaEl = document.getElementById('total-pitia-display');
    var msgEl = document.getElementById('assets-pitia-sync-msg');
    if (!pitiaEl) return;
    var pitiaVal = pc(pitiaEl.textContent);
    if (pitiaVal > 0) {
      var input = document.getElementById('asset-est-monthly-pmt');
      if (input) {
        input.value = pitiaVal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        recalcAll();
        if (msgEl) { msgEl.textContent = 'Synced from Payment tab'; setTimeout(function(){ msgEl.textContent = ''; }, 3000); }
      }
    } else {
      if (msgEl) { msgEl.textContent = 'No PITIA calculated yet'; setTimeout(function(){ msgEl.textContent = ''; }, 3000); }
    }
  };


  /* ══════════════════════════════════════════════════════════════
     ACCOUNT ROW MANAGEMENT
     ══════════════════════════════════════════════════════════════ */

  window.addAssetAccount = function(data) {
    acctCounter++;
    var id = 'acct-' + acctCounter;
    var acct = data || { type: '', balance: '', accountNum: '', description: '', statementDate: '' };

    /* Build options HTML */
    var opts = '<option value="">Select type...</option>';
    ACCOUNT_TYPES.forEach(function(t) {
      opts += '<option value="' + t + '"' + (t === acct.type ? ' selected' : '') + '>' + t + '</option>';
    });

    var row = document.createElement('div');
    row.className = 'ast-acct-row';
    row.id = id;
    row.innerHTML = ''
      + '<div class="ast-acct-fields">'
      +   '<div class="ff" style="flex:2;min-width:160px;"><label>Account Type</label><select class="fc ast-acct-type" onchange="toggleAssetDesc(\\'' + id + '\\')">' + opts + '</select></div>'
      +   '<div class="ff" style="flex:1.2;min-width:120px;"><label>Balance ($)</label><input type="text" class="fc currency-input ast-acct-bal" placeholder="0" value="' + (acct.balance ? Number(acct.balance).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '') + '"></div>'
      +   '<div class="ff" style="flex:1;min-width:100px;"><label>Account #</label><input type="text" class="fc ast-acct-num" placeholder="Last 4" maxlength="20" value="' + escapeHtml(acct.accountNum || '') + '"></div>'
      +   '<div class="ff" style="flex:1;min-width:130px;"><label>Statement Date</label><input type="date" class="fc ast-acct-stmt-date" value="' + (acct.statementDate || '') + '"></div>'
      +   '<button type="button" class="ast-remove-btn" onclick="removeAssetAccount(\\'' + id + '\\')" title="Remove"><i class="fa-solid fa-xmark"></i></button>'
      + '</div>'
      + '<div class="ast-acct-desc-row' + (acct.type === 'Other Asset' ? '' : ' hidden') + '">'
      +   '<div class="ff" style="flex:1;"><label>Description</label><input type="text" class="fc ast-acct-desc" placeholder="Describe the asset..." value="' + (acct.description || '').replace(/"/g, '&quot;') + '"></div>'
      + '</div>';

    document.getElementById('ast-accounts-list').appendChild(row);

    /* Wire balance change to recalc */
    var balInput = row.querySelector('.ast-acct-bal');
    if (balInput) {
      balInput.addEventListener('input', recalcAll);
      balInput.addEventListener('change', recalcAll);
    }

    recalcAll();
  };

  window.removeAssetAccount = function(id) {
    var row = document.getElementById(id);
    if (row) row.remove();
    recalcAll();
  };

  window.toggleAssetDesc = function(id) {
    var row = document.getElementById(id);
    if (!row) return;
    var sel = row.querySelector('.ast-acct-type');
    var descRow = row.querySelector('.ast-acct-desc-row');
    if (sel && descRow) {
      if (sel.value === 'Other Asset') descRow.classList.remove('hidden');
      else descRow.classList.add('hidden');
    }
  };


  /* ══════════════════════════════════════════════════════════════
     SERIALIZE ACCOUNTS TO JSON (called by saveLoan)
     ══════════════════════════════════════════════════════════════ */
  window.getAssetAccountsJSON = function() {
    var rows = document.querySelectorAll('.ast-acct-row');
    if (!rows.length) return '';
    var arr = [];
    rows.forEach(function(row) {
      var type = row.querySelector('.ast-acct-type');
      var bal = row.querySelector('.ast-acct-bal');
      var num = row.querySelector('.ast-acct-num');
      var desc = row.querySelector('.ast-acct-desc');
      var stmtDate = row.querySelector('.ast-acct-stmt-date');
      if (type && (type.value || (bal && pc(bal.value)))) {
        arr.push({
          type: type.value,
          balance: pc(bal ? bal.value : ''),
          accountNum: num ? num.value.trim() : '',
          description: desc ? desc.value.trim() : '',
          statementDate: stmtDate ? stmtDate.value : ''
        });
      }
    });
    return arr.length > 0 ? JSON.stringify(arr) : '';
  };


  /* ══════════════════════════════════════════════════════════════
     RECALC ALL — runs on any input change
     ══════════════════════════════════════════════════════════════ */
  function recalcAll() {
    /* Cash to Close */
    var dp = pc(document.getElementById('asset-down-payment') ? document.getElementById('asset-down-payment').value : '');
    var cc = pc(document.getElementById('asset-closing-costs') ? document.getElementById('asset-closing-costs').value : '');
    var cashToClose = dp + cc;
    var ctcEl = document.getElementById('ast-cash-to-close-total');
    if (ctcEl) ctcEl.textContent = cashToClose > 0 ? fmt(cashToClose) : '\\u2014';

    /* Primary Reserves */
    var months = parseInt(document.getElementById('asset-months-reserves') ? document.getElementById('asset-months-reserves').value : '') || 0;
    var estPmt = pc(document.getElementById('asset-est-monthly-pmt') ? document.getElementById('asset-est-monthly-pmt').value : '');
    var primaryReserve = months * estPmt;
    var phint = document.getElementById('ast-primary-hint');
    if (phint) phint.textContent = (months > 0 && estPmt > 0) ? months + ' \\u00d7 ' + fmt(estPmt) : '';
    var prEl = document.getElementById('ast-primary-reserve-amt');
    if (prEl) prEl.textContent = primaryReserve > 0 ? fmt(primaryReserve) : '\\u2014';

    /* Other Reserves — use override if user entered one, otherwise auto-calc */
    var oMonths = parseInt(document.getElementById('asset-other-months') ? document.getElementById('asset-other-months').value : '') || 0;
    var oAmt = pc(document.getElementById('asset-other-monthly-amt') ? document.getElementById('asset-other-monthly-amt').value : '');
    var oOverride = pc(document.getElementById('asset-other-total') ? document.getElementById('asset-other-total').value : '');
    var otherReserve = oOverride > 0 ? oOverride : (oMonths * oAmt);
    var ohint = document.getElementById('ast-other-hint');
    if (ohint) {
      if (oOverride > 0) ohint.textContent = 'Override';
      else if (oMonths > 0 && oAmt > 0) ohint.textContent = oMonths + ' \\u00d7 ' + fmt(oAmt);
      else ohint.textContent = '';
    }
    var orEl = document.getElementById('ast-other-reserve-amt');
    if (orEl) orEl.textContent = otherReserve > 0 ? fmt(otherReserve) : '\\u2014';

    /* Total Reserves */
    var totalReserves = primaryReserve + otherReserve;
    var trEl = document.getElementById('ast-reserves-total');
    if (trEl) trEl.textContent = totalReserves > 0 ? fmt(totalReserves) : '\\u2014';

    /* Account Balances Total */
    var acctTotal = 0;
    document.querySelectorAll('.ast-acct-bal').forEach(function(el) { acctTotal += pc(el.value); });
    var atEl = document.getElementById('ast-accounts-total');
    if (atEl) atEl.textContent = acctTotal > 0 ? fmt(acctTotal) : '\\u2014';

    /* Grand Total = Cash to Close + Total Reserves */
    var grandTotal = cashToClose + totalReserves;
    var gtEl = document.getElementById('ast-grand-total');
    if (gtEl) gtEl.textContent = grandTotal > 0 ? fmt(grandTotal) : '\\u2014';

    /* ── SUMMARY CARD: Excess / Shortage ── */
    var sumAcctEl = document.getElementById('ast-sum-accounts');
    var sumNeededEl = document.getElementById('ast-sum-needed');
    var sumResultEl = document.getElementById('ast-sum-result');
    var sumLabelEl = document.getElementById('ast-sum-result-label');
    if (sumAcctEl) sumAcctEl.textContent = acctTotal > 0 ? fmt(acctTotal) : '\\u2014';
    if (sumNeededEl) sumNeededEl.textContent = grandTotal > 0 ? fmt(grandTotal) : '\\u2014';
    if (sumResultEl && sumLabelEl) {
      if (acctTotal > 0 && grandTotal > 0) {
        var diff = acctTotal - grandTotal;
        sumResultEl.textContent = (diff >= 0 ? '+' : '') + fmt(Math.abs(diff));
        if (diff >= 0) {
          sumLabelEl.textContent = 'Excess';
          sumResultEl.className = 'ast-summary-value ast-summary-result-val ast-excess';
        } else {
          sumLabelEl.textContent = 'Shortage';
          sumResultEl.textContent = '\\u2212' + fmt(Math.abs(diff));
          sumResultEl.className = 'ast-summary-value ast-summary-result-val ast-shortage';
        }
      } else {
        sumLabelEl.textContent = 'Excess / Shortage';
        sumResultEl.textContent = '\\u2014';
        sumResultEl.className = 'ast-summary-value ast-summary-result-val';
      }
    }
  }
  /* Expose for external calls */
  window.recalcAssets = recalcAll;

  console.log('\\u2705 Pipeline Assets module loaded (v1.5)');
})();

`;
  return new Response(jsContent, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      ...getCorsHeaders(request)
    }
  });
}

// ============================================================
// PIPELINE LIABILITIES JS MODULE (served from /static/pipeline-liabilities.js)
// Builds the Liabilities tab UI: dynamic liability rows with
// name, type, balance, monthly payment, exclude checkbox, totals, notes
// ============================================================
async function getPipelineLiabilitiesJS(request) {
  const jsContent = `

(function() {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     LIABILITY TYPE OPTIONS
     ══════════════════════════════════════════════════════════════ */
  var LIABILITY_TYPES = [
    'Auto Loan',
    'Business Debt',
    'Child Care',
    'Child Support',
    'Collections',
    'Credit Card',
    'HELOC',
    'Installment Loan',
    'Lease Payment',
    'Medical Debt',
    'Mortgage',
    'Other',
    'Personal Loan',
    'Student Loan',
    'Tax Lien'
  ];

  /* In-memory liability rows */
  var liabilities = [];
  var liabCounter = 0;

  /* ══════════════════════════════════════════════════════════════
     HELPERS
     ══════════════════════════════════════════════════════════════ */
  function pc(val) {
    if (!val) return 0;
    var n = parseFloat(String(val).replace(/[^0-9.\\-]/g, ''));
    return isNaN(n) ? 0 : n;
  }
  function fmt(num) {
    if (!num && num !== 0) return '\\u2014';
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ══════════════════════════════════════════════════════════════
     INJECT STYLES
     ══════════════════════════════════════════════════════════════ */
  var css = document.createElement('style');
  css.textContent = ''
    +'.liab-row{margin-bottom:8px;border:1px solid #E2E8F0;border-radius:8px;padding:10px 12px;background:#fff;transition:background .1s}'
    +'.liab-row:hover{background:#F8FAFC}'
    +'.liab-row.liab-excluded{opacity:.5;background:#F8FAFC}'
    +'.liab-fields{display:flex;align-items:flex-end;gap:8px;flex:1;min-width:0;flex-wrap:wrap}'
    +'.liab-fields .ff{margin-bottom:0}'
    +'.liab-fields .ff label{font-size:11px;font-weight:600;color:#64748B;margin-bottom:3px}'
    +'.liab-fields .ff select,.liab-fields .ff input{font-size:13px;padding:7px 10px}'
    +'.liab-remove-btn{background:none;border:none;color:#CBD5E1;cursor:pointer;font-size:16px;padding:6px;border-radius:4px;transition:all .15s;line-height:1;flex-shrink:0;align-self:flex-end;margin-bottom:2px}'
    +'.liab-remove-btn:hover{color:#EF4444;background:#FEF2F2}'
    +'.liab-exclude-wrap{display:flex;align-items:center;gap:6px;align-self:flex-end;margin-bottom:4px;flex-shrink:0}'
    +'.liab-exclude-wrap label{font-size:11px;font-weight:600;color:#64748B;cursor:pointer;white-space:nowrap}'
    +'.liab-exclude-wrap input[type="checkbox"]{width:16px;height:16px;cursor:pointer;accent-color:#3B82F6}'
    +'.liab-add-btn{display:flex;align-items:center;gap:6px;padding:8px 12px;border:1px dashed #CBD5E1;border-radius:6px;background:#FAFBFE;color:#64748B;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s}'
    +'.liab-add-btn:hover{border-color:#93C5FD;color:#3B82F6;background:#EFF6FF}'
    +'.liab-add-btn i{font-size:11px}'
    +'.liab-total-row{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;margin-top:12px;border-radius:8px;background:linear-gradient(135deg,#FEF2F2 0%,#FEE2E2 100%);border:1px solid #FECACA}'
    +'.liab-total-row span:first-child{font-size:13px;font-weight:700;color:#991B1B}'
    +'.liab-total-val{font-size:16px;font-weight:800;color:#DC2626}'
    +'.liab-totals-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}'
    +'.liab-total-card{padding:10px 14px;border-radius:8px;border:1px solid #E2E8F0;background:#F8FAFC}'
    +'.liab-total-card-label{font-size:11px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px}'
    +'.liab-total-card-value{font-size:16px;font-weight:700;color:#1E293B}'
    +'.liab-total-card.highlight{background:linear-gradient(135deg,#FEF2F2 0%,#FEE2E2 100%);border-color:#FECACA}'
    +'.liab-total-card.highlight .liab-total-card-label{color:#991B1B}'
    +'.liab-total-card.highlight .liab-total-card-value{color:#DC2626}'
    +'.liab-notes-card{margin-top:16px}'
    +'@media(max-width:600px){.liab-fields{flex-direction:column}.liab-fields .ff{min-width:100%!important}}';
  document.head.appendChild(css);

  /* ══════════════════════════════════════════════════════════════
     BUILD LIABILITIES SECTION — called by openLoanModal / openNewLoanModal
     ══════════════════════════════════════════════════════════════ */
  window.buildLiabilitiesSection = function(loan) {
    var c = document.getElementById('liabilities-section-content');
    if (!c) return;
    liabilities = [];
    liabCounter = 0;

    c.innerHTML = ''
      + '<div id="liab-list"></div>'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;">'
      +   '<button type="button" class="liab-add-btn" onclick="addLiability()"><i class="fa-solid fa-plus"></i> Add Liability</button>'
      + '</div>'
      + '<div class="liab-totals-grid">'
      +   '<div class="liab-total-card">'
      +     '<div class="liab-total-card-label">Total Balance</div>'
      +     '<div class="liab-total-card-value" id="liab-total-balance">\\u2014</div>'
      +   '</div>'
      +   '<div class="liab-total-card highlight">'
      +     '<div class="liab-total-card-label">Total Monthly Payment</div>'
      +     '<div class="liab-total-card-value" id="liab-total-payment">\\u2014</div>'
      +   '</div>'
      + '</div>';

    /* Ensure Liabilities Notes card exists */
    ensureLiabilitiesNotesCard();

    /* Populate from loan data */
    if (loan && loan['Liabilities JSON']) {
      try {
        var saved = JSON.parse(loan['Liabilities JSON']);
        if (Array.isArray(saved)) {
          saved.forEach(function(item) { addLiability(item); });
        }
      } catch(e) { console.warn('Could not parse Liabilities JSON'); }
    }

    recalcLiabilities();
    console.log('\\u2705 Liabilities section built');
  };

  /* ══════════════════════════════════════════════════════════════
     ENSURE NOTES CARD — dynamically create the liabilities notes card
     ══════════════════════════════════════════════════════════════ */
  function ensureLiabilitiesNotesCard() {
    if (document.getElementById('liabilities-notes-card')) return;
    var pages = document.getElementById('section-pages');
    if (!pages) return;
    var card = document.createElement('div');
    card.className = 'card section-card section-hidden liab-notes-card';
    card.id = 'liabilities-notes-card';
    card.setAttribute('data-page', 'section-liabilities');
    card.innerHTML = '<div class="card-title"><i class="fa-solid fa-pen-to-square"></i> Notes</div>'
      + '<div class="ff"><textarea class="ps-notes-textarea" id="liabilities-notes" placeholder="Liability details, payoff plans, disputes..."></textarea></div>';
    pages.appendChild(card);
  }

  /* ══════════════════════════════════════════════════════════════
     LIABILITY ROW MANAGEMENT
     ══════════════════════════════════════════════════════════════ */
  window.addLiability = function(data) {
    liabCounter++;
    var id = 'liab-' + liabCounter;
    var item = data || { name: '', type: '', balance: '', payment: '', excluded: false };

    /* Build type options */
    var opts = '<option value="">Select type...</option>';
    LIABILITY_TYPES.forEach(function(t) {
      opts += '<option value="' + t + '"' + (t === item.type ? ' selected' : '') + '>' + t + '</option>';
    });

    var row = document.createElement('div');
    row.className = 'liab-row' + (item.excluded ? ' liab-excluded' : '');
    row.id = id;
    row.innerHTML = ''
      + '<div class="liab-fields">'
      +   '<div class="ff" style="flex:1.5;min-width:150px;"><label>Liability Name</label><input type="text" class="fc liab-name" placeholder="e.g. Chase Visa" value="' + escapeHtml(item.name || '') + '"></div>'
      +   '<div class="ff" style="flex:1.5;min-width:140px;"><label>Type</label><select class="fc liab-type">' + opts + '</select></div>'
      +   '<div class="ff" style="flex:1;min-width:110px;"><label>Balance ($)</label><input type="text" class="fc currency-input liab-balance" placeholder="0" value="' + (item.balance ? Number(item.balance).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '') + '"></div>'
      +   '<div class="ff" style="flex:1;min-width:110px;"><label>Monthly Payment ($)</label><input type="text" class="fc currency-input liab-payment" placeholder="0" value="' + (item.payment ? Number(item.payment).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '') + '"></div>'
      +   '<div class="liab-exclude-wrap"><input type="checkbox" class="liab-exclude" id="' + id + '-excl"' + (item.excluded ? ' checked' : '') + ' onchange="toggleLiabExclude(\\'' + id + '\\')"><label for="' + id + '-excl">Exclude</label></div>'
      +   '<button type="button" class="liab-remove-btn" onclick="removeLiability(\\'' + id + '\\')" title="Remove"><i class="fa-solid fa-xmark"></i></button>'
      + '</div>';

    document.getElementById('liab-list').appendChild(row);

    /* Wire balance + payment changes to recalc */
    var balInput = row.querySelector('.liab-balance');
    var pmtInput = row.querySelector('.liab-payment');
    if (balInput) { balInput.addEventListener('input', recalcLiabilities); balInput.addEventListener('change', recalcLiabilities); }
    if (pmtInput) { pmtInput.addEventListener('input', recalcLiabilities); pmtInput.addEventListener('change', recalcLiabilities); }

    recalcLiabilities();
  };

  window.removeLiability = function(id) {
    var row = document.getElementById(id);
    if (row) row.remove();
    recalcLiabilities();
  };

  window.toggleLiabExclude = function(id) {
    var row = document.getElementById(id);
    if (!row) return;
    var cb = row.querySelector('.liab-exclude');
    if (cb && cb.checked) {
      row.classList.add('liab-excluded');
    } else {
      row.classList.remove('liab-excluded');
    }
    recalcLiabilities();
  };

  /* ══════════════════════════════════════════════════════════════
     SERIALIZE LIABILITIES TO JSON (called by saveLoan)
     ══════════════════════════════════════════════════════════════ */
  window.getLiabilitiesJSON = function() {
    var rows = document.querySelectorAll('.liab-row');
    if (!rows.length) return '';
    var arr = [];
    rows.forEach(function(row) {
      var name = row.querySelector('.liab-name');
      var type = row.querySelector('.liab-type');
      var bal = row.querySelector('.liab-balance');
      var pmt = row.querySelector('.liab-payment');
      var excl = row.querySelector('.liab-exclude');
      if ((name && name.value.trim()) || (type && type.value) || (bal && pc(bal.value)) || (pmt && pc(pmt.value))) {
        arr.push({
          name: name ? name.value.trim() : '',
          type: type ? type.value : '',
          balance: pc(bal ? bal.value : ''),
          payment: pc(pmt ? pmt.value : ''),
          excluded: excl ? excl.checked : false
        });
      }
    });
    return arr.length > 0 ? JSON.stringify(arr) : '';
  };

  /* ══════════════════════════════════════════════════════════════
     RECALC TOTALS — runs on any input change or exclude toggle
     Excluded rows are NOT counted in totals.
     ══════════════════════════════════════════════════════════════ */
  function recalcLiabilities() {
    var totalBalance = 0;
    var totalPayment = 0;
    document.querySelectorAll('.liab-row').forEach(function(row) {
      var excl = row.querySelector('.liab-exclude');
      if (excl && excl.checked) return; /* skip excluded */
      var bal = row.querySelector('.liab-balance');
      var pmt = row.querySelector('.liab-payment');
      totalBalance += pc(bal ? bal.value : '');
      totalPayment += pc(pmt ? pmt.value : '');
    });

    var balEl = document.getElementById('liab-total-balance');
    var pmtEl = document.getElementById('liab-total-payment');
    if (balEl) balEl.textContent = totalBalance > 0 ? fmt(totalBalance) : '\\u2014';
    if (pmtEl) pmtEl.textContent = totalPayment > 0 ? fmt(totalPayment) : '\\u2014';
  }

  /* Expose for external calls */
  window.recalcLiabilities = recalcLiabilities;

  console.log('\\u2705 Pipeline Liabilities module loaded (v1.0)');
})();

`;
  return new Response(jsContent, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      ...getCorsHeaders(request)
    }
  });
}

// ============================================================
// POST /api/pipeline/extract-purchase-agreement
// Receives one or more base64 PDFs, sends to Claude Sonnet 4 via
// Anthropic API, returns structured JSON with extracted PA fields.
// Supports multi-document upload (contract + addenda).
// Requires env.ANTHROPIC_API_KEY
// ============================================================
async function extractPurchaseAgreement(request, env) {
  const corsHeaders = getCorsHeaders(request);

  // Check for Anthropic API key
  if (!env.ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured in Worker environment' }, 500, request);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: 'Invalid JSON body' }, 400, request);
  }

  // Support both single PDF (pdfBase64) and multiple (documents array)
  const documents = body.documents || [];
  if (body.pdfBase64) {
    documents.push({ data: body.pdfBase64, mediaType: body.mediaType || 'application/pdf' });
  }
  if (documents.length === 0) {
    return jsonResponse({ error: 'No PDF documents provided' }, 400, request);
  }

  // Build content array: one document block per uploaded file + the prompt
  const contentBlocks = [];
  documents.forEach((doc, idx) => {
    contentBlocks.push({
      type: 'document',
      source: {
        type: 'base64',
        media_type: doc.mediaType || 'application/pdf',
        data: doc.data
      }
    });
  });

  // Add the extraction prompt as the final text block
  contentBlocks.push({
    type: 'text',
    text: `You are an expert mortgage document analyst specializing in residential Purchase Agreements and Sales Contracts from ALL 50 US states. You have been given ${documents.length > 1 ? documents.length + ' PDF documents (likely a contract plus addenda/riders)' : 'a Purchase Agreement PDF'}. Extract the fields listed below.

CRITICAL DISTINCTION — "Required/Elected" vs "Boilerplate Right":
This is the MOST IMPORTANT instruction. Many state contracts contain standard boilerplate paragraphs that MENTION surveys, pest inspections, and home warranties. These boilerplate sections grant the buyer a RIGHT or OPTION — they do NOT mean the parties elected or required them. You MUST distinguish:

THE WORD "MAY" = BOILERPLATE / NOT ELECTED:
- "Buyer MAY, at Buyer's expense, have the Property surveyed" → This is a RIGHT, not a requirement. Answer "N/A".
- "The Property MAY be inspected by a licensed pest control business" → This is an OPTION, not an election. Answer "N/A".
- Any paragraph that describes what a party "may" do is granting permission, not establishing a requirement.

THE WORD "SHALL" or "WILL" with an AFFIRMATIVE ELECTION = REQUIRED:
- "Buyer SHALL obtain a survey" → Required. Answer "Yes".
- "Seller WILL pay for a home warranty" → Elected. Answer "Yes".

CHECKBOXES AND FILL-INS ARE THE PRIMARY EVIDENCE:
- A checkbox next to "Buyer", "Seller", or "N/A" that is CHECKED (☑) is definitive.
- A blank line that has been FILLED IN with a dollar amount, provider name, or date = elected.
- A blank line that is LEFT EMPTY or has no entry = NOT elected.
- If ALL checkboxes in a section are UNCHECKED and all fill-in lines are BLANK = "N/A".

WHEN IN DOUBT → ALWAYS ANSWER "N/A". Never default to "Yes".

FIELDS TO EXTRACT (return as a flat JSON object):

"contractDate" (string) — Date the contract was written/signed/executed. NOT the closing date. Convert to YYYY-MM-DD.

"propertyAddress" (string) — Full street address of the property. Include street, city, state, zip if available.

"buyersNames" (string) — Full legal names of ALL buyers/purchasers.

"purchasePrice" (number) — The agreed purchase/sales price. Return as plain number.

"escrowDeposit" (number) — Earnest money / good faith deposit. Look for: Earnest Money, Escrow Deposit, Good Faith Deposit, Binder, Initial Deposit, EMD. Return as plain number.

"sellerConcessions" (number) — Seller's contribution toward buyer's closing costs.
  CRITICAL: "Buyer Broker Compensation" / "Buyer's Broker Compensation" is BAC, NOT seller concessions. These are SEPARATE items. If the Seller Concession section is blank/$0/unchecked, omit this field.

"sellerConcessionsType" (string) — "$" if dollar amount, "%" if percentage. Only include if sellerConcessions has a value.

"bacAmount" (number) — Buyer Agent Commission / Buyer Broker Compensation amount. Look for: Buyer Broker Compensation, BAC, Cooperating Broker Commission. For percentages return the number (e.g. 2 for 2%).

"bacType" (string) — "$" if dollar amount, "%" if percentage.

"bacPaidBy" (string) — "Seller" or "Buyer". Who pays the buyer agent commission.

"coeDate" (string) — The closing date, close of escrow date, settlement date, or contract expiration date. Look for: Closing Date, Close of Escrow, Settlement Date, COE Date, Closing On or Before, Expiration Date. Convert to YYYY-MM-DD format. If written as "March 15, 2026" return "2026-03-15". If the closing date says "TBD", "To Be Determined", or is left blank, omit this field entirely.

"earliestCloseDate" (string) — The earliest possible closing date, if specified. Some contracts state "on or after [date]" or "no earlier than [date]" or have a separate earliest close date distinct from the target closing date. Convert to YYYY-MM-DD format. Omit if not found or if the contract only has a single closing date (already captured in coeDate).

"surveyRequired" (string) — "Yes", "No", or "N/A". 
  IMPORTANT: A boilerplate paragraph saying "Buyer may have the Real Property surveyed" is NOT an election — it grants a right. Answer "N/A" unless there is an AFFIRMATIVE indication: a checked checkbox, a filled-in cost amount, or a separate addendum specifically requiring a survey.

"surveyPaidBy" (string) — "Buyer", "Seller", or "Split". Only include if surveyRequired is "Yes".

"pestRequired" (string) — "Yes", "No", or "N/A".
  IMPORTANT: A boilerplate paragraph saying "The Property may be inspected by a pest control business" (or "WDO Inspector") is NOT an election — it grants a right within the inspection period. Answer "N/A" unless there is an AFFIRMATIVE indication: a checked checkbox requiring a pest inspection, a filled-in cost or provider name, or a separate addendum specifically requiring a WDO/pest inspection. In the Florida FAR/BAR contract, Paragraph 12(c) "WOOD DESTROYING ORGANISM INSPECTION AND REPAIR" is STANDARD BOILERPLATE — it describes what happens IF the buyer chooses to get a WDO inspection. The word "may" means it is optional. This should be "N/A" unless an addendum or rider specifically requires it.

"pestPaidBy" (string) — "Buyer", "Seller", or "Split". Only include if pestRequired is "Yes".

"homeWarranty" (string) — "Yes", "No", or "N/A".
  IMPORTANT: Look for EXPLICIT checkboxes (Buyer / Seller / N/A). If the "N/A" checkbox is checked, answer "N/A". If no checkbox is checked and no provider name or dollar amount is filled in, answer "N/A". Only answer "Yes" if "Buyer" or "Seller" is checked AND a provider name or cost is filled in.

"homeWarrantyPaidBy" (string) — "Buyer", "Seller", or "Split". Only include if homeWarranty is "Yes".

"buyersAgent" (string) — BUYER'S agent name (not brokerage).
  CRITICAL: "Cooperating" / "Buyer's Broker" section / "Selling Licensee" as "agent of Buyer" = BUYER'S agent.
  In Alabama: Paragraph 1 "Selling Licensee" checked "agent of Buyer" + "Buyer's Broker/Company" section at end.
  In Florida FAR/BAR: "Cooperating Sales Associate" on last page.

"buyersAgentCompany" (string) — Brokerage/company of buyer's agent.

"buyersAgentEmail" (string) — Email of buyer's agent, if listed.

"sellersAgent" (string) — SELLER'S agent name (listing agent, not brokerage).
  CRITICAL: "Listing" / "Seller's Broker" section / "Listing Licensee" as "agent of Seller" = SELLER'S agent.
  In Alabama: Paragraph 1 "Listing Licensee" + "Seller's Broker/Company" section at end.

"sellersAgentCompany" (string) — Brokerage/company of seller's agent.

"sellersAgentEmail" (string) — Email of seller's agent, if listed.

"contractSummary" (string) — A concise plain-text summary of ADDITIONAL important deal terms that are NOT already captured by the fields above. Use bullet points (• character) with line breaks between items. Include ONLY items that have actual values filled in (not blank boilerplate). Look for and include as applicable:
  • Seller name(s) — full names of all sellers
  • Property address and legal description
  • Financing type and terms (Conventional/FHA/VA, fixed/adjustable, LTV percentage, loan approval period)
  • Inspection period length (e.g., "15 days")
  • Closing date details (if TBD, say "TBD")
  • Title/closing responsibility (who designates closing agent, who pays owner's policy)
  • Escrow agent name and firm
  • Assignability (may assign / may not assign)
  • Repair limits (General Repair Limit, WDO Repair Limit, Permit Limit — include dollar amounts or percentages if filled in)
  • Checked addenda/riders from the addenda checklist (list the names of CHECKED items only)
  • Additional Terms / Special Provisions — quote or summarize any handwritten or typed additional terms verbatim, these are critical
  • Financing contingency details
  • Any other notable non-standard terms or conditions
  Keep each bullet to one line. Aim for 8-20 bullets depending on the contract. Do NOT include items already covered by the structured fields above (purchase price, escrow deposit, seller concessions, COE date, survey/pest/warranty status, agent names).

STATE-SPECIFIC NOTES:
- Florida (FAR/BAR, FloridaRealtors/FloridaBar form):
  • Paragraph 2: Purchase Price and Closing — purchase price, deposit, financing.
  • Paragraph 4: Closing Date — may say "TBD" (omit coeDate if so).
  • Paragraph 9(a): Seller Costs — look for filled-in General Repair Limit, WDO Repair Limit, Permit Limit. The "See additional terms" reference means check Paragraph 20 / Additional Terms.
  • Paragraph 9(d): SURVEY — "Buyer may, at Buyer's expense, have the Real Property surveyed" = BOILERPLATE RIGHT, NOT a requirement. Answer "N/A" unless a rider/addendum specifically requires it.
  • Paragraph 9(e): HOME WARRANTY — Has checkboxes: ☐ Buyer ☐ Seller ☐ N/A. Read the CHECKED box. If N/A is checked, answer "N/A".
  • Paragraph 12(a): Inspection Period — defines the timeframe for inspections. This does NOT mean inspections are required.
  • Paragraph 12(c): WDO INSPECTION — "The Property may be inspected by a Florida-licensed pest control business" = BOILERPLATE RIGHT, NOT a requirement. Answer "N/A" for pestRequired unless a separate rider/addendum requires it.
  • Paragraph 19: Addenda checklist — checked boxes indicate which riders are attached.
  • Paragraph 20: Additional Terms — handwritten/typed terms that override printed provisions.
  • Broker section (near signatures): Lists Cooperating Sales Associate (buyer's agent) and Listing Sales Associate (seller's agent).
- Texas (TREC 1-4): Look in Paragraph 6 (Title), Paragraph 7 (Property Condition), Paragraph 11 (Special Provisions).
- California (CAR RPA): Look in sections 3-4 (Finance), 7 (Allocation of Costs), 11 (Condition of Property).
- Other states: Look for dedicated sections on Inspections, Contingencies, Due Diligence, Settlement Costs, and any Addenda or Riders.
${documents.length > 1 ? '\nMULTIPLE DOCUMENTS: You have been given multiple files. The main contract may be supplemented by addenda, riders, or amendments. Information in addenda/riders OVERRIDES the main contract where they conflict. Check ALL documents before finalizing your answers.' : ''}

OUTPUT RULES:
- Return ONLY a valid JSON object. No markdown backticks, no explanation, no preamble.
- Omit any field entirely if the information is not found or not determinable.
- For dollar amounts, return plain numbers (no $ signs, no commas, no formatting).
- For dates, return in YYYY-MM-DD format. Omit if "TBD" or relative.
- Do NOT include "paidBy" fields if the corresponding "required" field is "No" or "N/A".
- For contractSummary: use plain text with bullet points (• character). Each bullet on its own line separated by \\n. No markdown formatting.
- REMEMBER: "may" = optional right = "N/A". Only "shall"/"will" with affirmative evidence = "Yes".`
  });

  // Build the Claude API request
  const claudePayload = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: contentBlocks
      }
    ]
  };

  try {
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(claudePayload)
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error('Claude API error:', claudeResponse.status, errText);
      return jsonResponse({ error: 'Claude API error: ' + claudeResponse.status }, 502, request);
    }

    const claudeData = await claudeResponse.json();

    // Extract text from Claude's response
    let responseText = '';
    if (claudeData.content && Array.isArray(claudeData.content)) {
      responseText = claudeData.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('');
    }

    // Clean up any markdown fencing that might sneak through
    responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    // Parse the JSON
    let extractedData;
    try {
      extractedData = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('Failed to parse Claude response as JSON:', responseText);
      return jsonResponse({ error: 'Failed to parse extraction results', raw: responseText }, 500, request);
    }

    return jsonResponse({ success: true, data: extractedData }, 200, request);

  } catch (fetchErr) {
    console.error('Error calling Claude API:', fetchErr);
    return jsonResponse({ error: 'Failed to call Claude API: ' + fetchErr.message }, 500, request);
  }
}

// ============================================================
// GET /static/pipeline-purchase-agreement.js
// Purchase Agreement tab — self-contained JS module
// Injects nav item, section card, CSS, and provides
// buildPurchaseAgreementSection(loan) + getPurchaseAgreementJSON()
// ============================================================
async function getPurchaseAgreementJS(request) {
  const jsContent = `
(function() {
  'use strict';

  // ============================================================
  // CSS — injected at runtime (embeds are at 50K limit)
  // ============================================================
  var css = document.createElement('style');
  css.textContent = ''
    /* Card container */
    +'.pa-section .cg{display:grid;grid-template-columns:1fr 1fr;gap:12px 16px;margin-bottom:12px}'
    +'.pa-section .cg3{grid-template-columns:1fr 1fr 1fr}'
    +'@media(max-width:700px){.pa-section .cg,.pa-section .cg3{grid-template-columns:1fr}}'
    +'.pa-section .ff{display:flex;flex-direction:column;gap:2px}'
    +'.pa-section .ff label{font-size:12px;font-weight:600;color:#475569;margin-bottom:2px}'
    +'.pa-section .ff input,.pa-section .ff select{padding:8px 10px;border:1px solid #E2E8F0;border-radius:6px;font-size:14px;color:#1E293B;background:#fff;transition:border-color .15s,box-shadow .15s;box-sizing:border-box}'
    +'.pa-section .ff input:focus,.pa-section .ff select:focus{outline:none;border-color:#3B82F6;box-shadow:0 0 0 3px rgba(59,130,246,.1)}'
    /* Concessions row — amount + toggle */
    +'.pa-conc-row{display:flex;gap:8px;align-items:flex-end}'
    +'.pa-conc-row .ff:first-child{flex:1}'
    +'.pa-conc-toggle{display:flex;border:1px solid #E2E8F0;border-radius:6px;overflow:hidden;height:38px;align-self:flex-end}'
    +'.pa-conc-btn{padding:0 14px;font-size:13px;font-weight:600;border:none;background:#F8FAFC;color:#64748B;cursor:pointer;transition:all .15s}'
    +'.pa-conc-btn.active{background:#1E40AF;color:#fff}'
    +'.pa-conc-btn:hover:not(.active){background:#EFF6FF;color:#3B82F6}'
    /* Inspection group cards */
    +'.pa-insp-group{margin-bottom:16px;padding:14px 16px;border:1px solid #E2E8F0;border-radius:8px;background:#FAFBFE}'
    +'.pa-insp-group:last-of-type{margin-bottom:8px}'
    +'.pa-insp-title{font-size:12px;font-weight:700;color:#1E3A8A;text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #DBEAFE;display:flex;align-items:center;gap:8px}'
    +'.pa-insp-title i{font-size:13px;color:#3B82F6}'
    +'.pa-insp-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 16px}'
    +'@media(max-width:600px){.pa-insp-grid{grid-template-columns:1fr}}'
    /* Divider */
    +'.pa-divider{border:none;border-top:1px solid #E2E8F0;margin:20px 0}'
    /* Agent section */
    +'.pa-agent-section{margin-top:4px}'
    +'.pa-agent-title{font-size:12px;font-weight:700;color:#1E3A8A;text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #DBEAFE;display:flex;align-items:center;gap:8px}'
    +'.pa-agent-title i{font-size:13px;color:#3B82F6}'
    /* Contract Summary card */
    +'.pa-summary-card{margin-top:20px;padding:16px 20px;border:1px solid #DBEAFE;border-radius:10px;background:linear-gradient(135deg,#F0F7FF 0%,#FAFBFE 100%);display:none}'
    +'.pa-summary-card.pa-has-summary{display:block}'
    +'.pa-summary-title{font-size:13px;font-weight:700;color:#1E3A8A;text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #DBEAFE;display:flex;align-items:center;gap:8px}'
    +'.pa-summary-title i{font-size:14px;color:#3B82F6}'
    +'.pa-summary-body{font-size:13px;color:#334155;line-height:1.7;white-space:pre-line}'
    +'.pa-summary-body .pa-bullet{display:block;padding:3px 0;padding-left:4px}'
    /* Upload / Extract area */
    +'.pa-upload-bar{display:flex;align-items:center;gap:10px;padding:12px 16px;margin-bottom:16px;border:2px dashed #CBD5E1;border-radius:8px;background:#F8FAFC;transition:all .2s}'
    +'.pa-upload-bar:hover{border-color:#93C5FD;background:#EFF6FF}'
    +'.pa-upload-bar.pa-extracting{border-color:#3B82F6;background:#EFF6FF;border-style:solid}'
    +'.pa-upload-btn{display:flex;align-items:center;gap:6px;padding:8px 16px;border:1px solid #3B82F6;border-radius:6px;background:#fff;color:#3B82F6;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;white-space:nowrap}'
    +'.pa-upload-btn:hover{background:#3B82F6;color:#fff}'
    +'.pa-upload-btn:disabled{opacity:.5;cursor:not-allowed;background:#F1F5F9;color:#94A3B8;border-color:#CBD5E1}'
    +'.pa-upload-btn i{font-size:14px}'
    +'.pa-upload-hint{font-size:12px;color:#64748B;flex:1}'
    +'.pa-upload-hint strong{color:#1E293B}'
    +'.pa-upload-spinner{display:none;width:18px;height:18px;border:2px solid #DBEAFE;border-top:2px solid #3B82F6;border-radius:50%;animation:pa-spin .8s linear infinite}'
    +'.pa-extracting .pa-upload-spinner{display:block}'
    +'.pa-upload-status{font-size:12px;font-weight:600;color:#3B82F6;display:none}'
    +'.pa-extracting .pa-upload-status{display:block}'
    +'.pa-upload-success{color:#15803D;font-size:12px;font-weight:600;display:none;align-items:center;gap:4px}'
    +'.pa-upload-error{color:#DC2626;font-size:12px;font-weight:500;display:none}'
    +'@keyframes pa-spin{to{transform:rotate(360deg)}}';
  document.head.appendChild(css);


  // ============================================================
  // INJECT NAV ITEM — before the divider, after Links
  // ============================================================
  function injectNavItem() {
    var sidebar = document.getElementById('modal-nav-sidebar');
    if (!sidebar || document.getElementById('pa-nav-item')) return;

    var divider = sidebar.querySelector('.mnav-divider');
    if (!divider) return;

    var navItem = document.createElement('a');
    navItem.className = 'mnav-item';
    navItem.id = 'pa-nav-item';
    navItem.setAttribute('data-section', 'section-purchase-agreement');
    navItem.onclick = function() {
      if (typeof window.showSection === 'function') {
        window.showSection('section-purchase-agreement');
      }
    };
    navItem.innerHTML = '<i class="fa-solid fa-file-signature"></i><span>Contract</span>';

    sidebar.insertBefore(navItem, divider);
  }


  // ============================================================
  // INJECT SECTION CARD — into #section-pages
  // ============================================================
  function injectSection() {
    var sectionPages = document.getElementById('section-pages');
    if (!sectionPages || document.getElementById('section-purchase-agreement')) return;

    var card = document.createElement('div');
    card.className = 'card section-card section-hidden';
    card.id = 'section-purchase-agreement';
    card.setAttribute('data-page', 'section-purchase-agreement');

    card.innerHTML = ''
      + '<div class="card-title"><i class="fa-solid fa-file-signature"></i> Purchase Agreement</div>'
      /* ── Upload / Extract from PDF bar ── */
      + '<div class="pa-upload-bar" id="pa-upload-bar">'
      +   '<button type="button" class="pa-upload-btn" id="pa-upload-btn" onclick="window._paUploadPDF()">'
      +     '<i class="fa-solid fa-wand-magic-sparkles"></i> Extract from PDF(s)'
      +   '</button>'
      +   '<input type="file" id="pa-file-input" accept=".pdf" multiple style="display:none">'
      +   '<span class="pa-upload-hint">Upload Purchase Agreement PDF(s) — contract + addenda — and AI will auto-fill the fields</span>'
      +   '<div class="pa-upload-spinner"></div>'
      +   '<span class="pa-upload-status" id="pa-upload-status">Extracting fields...</span>'
      +   '<span class="pa-upload-success" id="pa-upload-success"><i class="fa-solid fa-circle-check"></i> Fields extracted!</span>'
      +   '<span class="pa-upload-error" id="pa-upload-error"></span>'
      + '</div>'
      + '<div class="pa-section" id="pa-section-body">'
      /* ── Row 0: Date of Contract, Property Address ── */
      + '<div class="cg">'
      +   '<div class="ff"><label>Date of Contract</label>'
      +   '<input type="date" class="fc" id="pa-contract-date"></div>'
      +   '<div class="ff"><label>Property Address</label>'
      +   '<input type="text" class="fc" id="pa-property-address" placeholder="123 Main St, City, ST 12345"></div>'
      + '</div>'
      /* ── Row 1: Buyers Names (full width) ── */
      + '<div class="cg" style="grid-template-columns:1fr">'
      +   '<div class="ff"><label>Buyers Names</label>'
      +   '<input type="text" class="fc" id="pa-buyers-names" placeholder="John Smith & Jane Smith"></div>'
      + '</div>'
      /* ── Row 2: Purchase Price, Escrow Deposit ── */
      + '<div class="cg">'
      +   '<div class="ff"><label>Purchase Price</label>'
      +   '<input type="text" class="fc" id="pa-purchase-price" placeholder="425,000" inputmode="decimal"></div>'
      +   '<div class="ff"><label>Earnest Money / Escrow Deposit</label>'
      +   '<input type="text" class="fc" id="pa-escrow-deposit" placeholder="10,000" inputmode="decimal"></div>'
      + '</div>'
      /* ── Row 3: Seller Concessions $ or % ── */
      + '<div class="cg">'
      +   '<div class="pa-conc-row">'
      +     '<div class="ff"><label>Seller Concessions</label>'
      +     '<input type="text" class="fc" id="pa-seller-concessions" placeholder="6,000" inputmode="decimal"></div>'
      +     '<div class="pa-conc-toggle">'
      +       '<button type="button" class="pa-conc-btn active" data-type="$" onclick="window._paSetConcType(this)">$</button>'
      +       '<button type="button" class="pa-conc-btn" data-type="%" onclick="window._paSetConcType(this)">%</button>'
      +     '</div>'
      +   '</div>'
      +   '<div class="ff"><label>COE / Expiration Date</label>'
      +   '<input type="date" class="fc" id="pa-coe-date"></div>'
      + '</div>'
      /* ── Row 3b: BAC + Paid By ── */
      + '<div class="cg">'
      +   '<div class="pa-conc-row">'
      +     '<div class="ff"><label>BAC (Buyer Agent Commission)</label>'
      +     '<input type="text" class="fc" id="pa-bac-amount" placeholder="2" inputmode="decimal"></div>'
      +     '<div class="pa-conc-toggle">'
      +       '<button type="button" class="pa-conc-btn" data-type="$" onclick="window._paSetBacType(this)">$</button>'
      +       '<button type="button" class="pa-conc-btn active" data-type="%" onclick="window._paSetBacType(this)">%</button>'
      +     '</div>'
      +   '</div>'
      +   '<div class="ff"><label>BAC Paid By</label>'
      +   '<select class="fc" id="pa-bac-paid-by">'
      +     '<option value="">Select...</option><option value="Seller">Seller</option><option value="Buyer">Buyer</option>'
      +   '</select></div>'
      + '</div>'
      /* ── Row 4: Earliest Close Date ── */
      + '<div class="cg">'
      +   '<div class="ff" style="position:relative"><label>Earliest Close Date</label>'
      +   '<input type="date" class="fc" id="pa-earliest-close">'
      +   '<span class="pa-no-early-date" id="pa-no-early-hint" style="display:none;font-size:11px;color:#94A3B8;font-style:italic;margin-top:2px">No early date given</span></div>'
      +   '<div class="ff"></div>'
      + '</div>'
      /* ── Divider ── */
      + '<hr class="pa-divider">'
      /* ── Inspection Group: Survey ── */
      + '<div class="pa-insp-group">'
      +   '<div class="pa-insp-title"><i class="fa-solid fa-ruler-combined"></i> Survey</div>'
      +   '<div class="pa-insp-grid">'
      +     '<div class="ff"><label>Required?</label>'
      +     '<select class="fc" id="pa-survey-required">'
      +       '<option value="">Select...</option><option value="Yes">Yes</option><option value="No">No</option><option value="N/A">N/A</option>'
      +     '</select></div>'
      +     '<div class="ff"><label>Paid By</label>'
      +     '<select class="fc" id="pa-survey-paid-by">'
      +       '<option value="">Select...</option><option value="Buyer">Buyer</option><option value="Seller">Seller</option><option value="Split">Split</option>'
      +     '</select></div>'
      +   '</div>'
      + '</div>'
      /* ── Inspection Group: Pest Inspection ── */
      + '<div class="pa-insp-group">'
      +   '<div class="pa-insp-title"><i class="fa-solid fa-bug"></i> Pest Inspection</div>'
      +   '<div class="pa-insp-grid">'
      +     '<div class="ff"><label>Required?</label>'
      +     '<select class="fc" id="pa-pest-required">'
      +       '<option value="">Select...</option><option value="Yes">Yes</option><option value="No">No</option><option value="N/A">N/A</option>'
      +     '</select></div>'
      +     '<div class="ff"><label>Paid By</label>'
      +     '<select class="fc" id="pa-pest-paid-by">'
      +       '<option value="">Select...</option><option value="Buyer">Buyer</option><option value="Seller">Seller</option><option value="Split">Split</option>'
      +     '</select></div>'
      +   '</div>'
      + '</div>'
      /* ── Inspection Group: Home Warranty ── */
      + '<div class="pa-insp-group">'
      +   '<div class="pa-insp-title"><i class="fa-solid fa-shield-halved"></i> Home Warranty</div>'
      +   '<div class="pa-insp-grid">'
      +     '<div class="ff"><label>Required?</label>'
      +     '<select class="fc" id="pa-warranty-required">'
      +       '<option value="">Select...</option><option value="Yes">Yes</option><option value="No">No</option><option value="N/A">N/A</option>'
      +     '</select></div>'
      +     '<div class="ff"><label>Paid By</label>'
      +     '<select class="fc" id="pa-warranty-paid-by">'
      +       '<option value="">Select...</option><option value="Buyer">Buyer</option><option value="Seller">Seller</option><option value="Split">Split</option>'
      +     '</select></div>'
      +   '</div>'
      + '</div>'
      /* ── Divider ── */
      + '<hr class="pa-divider">'
      /* ── Agent Section ── */
      + '<div class="pa-agent-section">'
      +   '<div class="pa-agent-title"><i class="fa-solid fa-user-tie"></i> Agents</div>'
      +   '<div class="cg">'
      +     '<div class="ff"><label>Buyer\\u2019s Agent Name</label>'
      +     '<input type="text" class="fc" id="pa-buyers-agent" placeholder="Agent name"></div>'
      +     '<div class="ff"><label>Seller\\u2019s Agent Name</label>'
      +     '<input type="text" class="fc" id="pa-sellers-agent" placeholder="Agent name"></div>'
      +   '</div>'
      +   '<div class="cg">'
      +     '<div class="ff"><label>Buyer\\u2019s Agent Company</label>'
      +     '<input type="text" class="fc" id="pa-buyers-agent-company" placeholder="Brokerage name"></div>'
      +     '<div class="ff"><label>Seller\\u2019s Agent Company</label>'
      +     '<input type="text" class="fc" id="pa-sellers-agent-company" placeholder="Brokerage name"></div>'
      +   '</div>'
      +   '<div class="cg">'
      +     '<div class="ff"><label>Buyer\\u2019s Agent Email</label>'
      +     '<input type="email" class="fc" id="pa-buyers-agent-email" placeholder="agent@email.com"></div>'
      +     '<div class="ff"><label>Seller\\u2019s Agent Email</label>'
      +     '<input type="email" class="fc" id="pa-sellers-agent-email" placeholder="agent@email.com"></div>'
      +   '</div>'
      + '</div>'
      /* ── Contract Summary (populated by AI extraction) ── */
      + '<div class="pa-summary-card" id="pa-summary-card">'
      +   '<div class="pa-summary-title"><i class="fa-solid fa-clipboard-list"></i> Contract Summary</div>'
      +   '<div class="pa-summary-body" id="pa-summary-body"></div>'
      + '</div>'
      + '</div>';

    sectionPages.appendChild(card);
  }


  // ============================================================
  // CONCESSION TYPE TOGGLE ($ vs %)
  // ============================================================
  var concType = '$';
  var currentSummaryText = '';
  window._paSetConcType = function(btn) {
    concType = btn.getAttribute('data-type');
    var btns = btn.parentNode.querySelectorAll('.pa-conc-btn');
    btns.forEach(function(b) { b.classList.toggle('active', b === btn); });
    /* Update placeholder */
    var input = document.getElementById('pa-seller-concessions');
    if (input) input.placeholder = (concType === '%') ? '3.0' : '6,000';
  };

  var bacType = '%';
  window._paSetBacType = function(btn) {
    bacType = btn.getAttribute('data-type');
    var btns = btn.parentNode.querySelectorAll('.pa-conc-btn');
    btns.forEach(function(b) { b.classList.toggle('active', b === btn); });
    var input = document.getElementById('pa-bac-amount');
    if (input) input.placeholder = (bacType === '%') ? '2' : '10,000';
  };


  // ============================================================
  // CURRENCY FORMATTING for Purchase Price & Escrow Deposit
  // ============================================================
  function formatCurrencyOnBlur(inputId) {
    var el = document.getElementById(inputId);
    if (!el) return;
    el.addEventListener('blur', function() {
      var raw = el.value.replace(/[^0-9.\\-]/g, '');
      var num = parseFloat(raw);
      if (!isNaN(num)) {
        el.value = num.toLocaleString('en-US');
      }
    });
  }


  // ============================================================
  // PDF UPLOAD + AI EXTRACTION
  // ============================================================
  window._paUploadPDF = function() {
    var fileInput = document.getElementById('pa-file-input');
    if (!fileInput) return;
    fileInput.value = ''; /* Reset so same file can be re-selected */
    fileInput.click();
  };

  /* Set up the file input change listener once DOM is ready */
  function attachFileListener() {
    var fileInput = document.getElementById('pa-file-input');
    if (!fileInput || fileInput._paListenerAttached) return;
    fileInput._paListenerAttached = true;

    fileInput.addEventListener('change', async function() {
      var files = Array.from(fileInput.files);
      if (!files.length) return;

      /* Validate all files are PDFs */
      for (var i = 0; i < files.length; i++) {
        if (files[i].type !== 'application/pdf') {
          showUploadError('All files must be PDFs. "' + files[i].name + '" is not a PDF.');
          return;
        }
      }

      /* Validate total size (25MB max across all files) */
      var totalSize = files.reduce(function(sum, f) { return sum + f.size; }, 0);
      if (totalSize > 25 * 1024 * 1024) {
        showUploadError('Total file size too large. Maximum is 25MB across all files.');
        return;
      }

      /* Update status text based on file count */
      var statusEl = document.getElementById('pa-upload-status');
      if (statusEl) {
        statusEl.textContent = files.length > 1
          ? 'Extracting from ' + files.length + ' documents...'
          : 'Extracting fields...';
      }

      /* Show extracting state */
      setExtractingState(true);

      try {
        /* Read all files as base64 */
        var documents = [];
        for (var j = 0; j < files.length; j++) {
          var b64 = await readFileAsBase64(files[j]);
          documents.push({ data: b64, mediaType: 'application/pdf' });
        }

        /* Get user email for auth */
        var email = null;
        if (typeof window.MTG_Billing !== 'undefined' && window.MTG_Billing.getUserEmail) {
          email = await window.MTG_Billing.getUserEmail();
        }
        if (!email && typeof getEmailFromLocalStorage === 'function') {
          email = getEmailFromLocalStorage();
        }
        if (!email) {
          /* Fallback: try to read from Outseta JWT in localStorage */
          try {
            var token = localStorage.getItem('Outseta.nocode.accessToken');
            if (token) {
              var payload = JSON.parse(atob(token.split('.')[1]));
              email = payload.email || payload['outseta:email'] || '';
            }
          } catch(e) {}
        }

        if (!email) {
          showUploadError('Could not determine your login. Please refresh and try again.');
          setExtractingState(false);
          return;
        }

        /* Call the extraction endpoint with all documents */
        /* CRIT-1: Send raw JWT for server-side signature verification, not plain email */
        var token = getAccessToken();
        var response = await fetch('https://mtg-broker-pipeline.rich-e00.workers.dev/api/pipeline/extract-purchase-agreement', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ documents: documents })
        });

        var result = await response.json();

        if (!response.ok || !result.success) {
          showUploadError(result.error || 'Extraction failed. Please try again.');
          setExtractingState(false);
          return;
        }

        /* Populate fields from extracted data */
        populateFromExtraction(result.data);
        setExtractingState(false);
        showUploadSuccess();

      } catch (err) {
        console.error('PA extraction error:', err);
        showUploadError('Error: ' + err.message);
        setExtractingState(false);
      }
    });
  }

  function readFileAsBase64(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function() {
        /* result is data:application/pdf;base64,XXXX — strip the prefix */
        var b64 = reader.result.split(',')[1];
        resolve(b64);
      };
      reader.onerror = function() { reject(new Error('Failed to read file')); };
      reader.readAsDataURL(file);
    });
  }

  function setExtractingState(active) {
    var bar = document.getElementById('pa-upload-bar');
    var btn = document.getElementById('pa-upload-btn');
    var successEl = document.getElementById('pa-upload-success');
    var errorEl = document.getElementById('pa-upload-error');
    if (bar) bar.classList.toggle('pa-extracting', active);
    if (btn) btn.disabled = active;
    if (successEl) successEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';
  }

  function showUploadSuccess() {
    var el = document.getElementById('pa-upload-success');
    if (el) { el.style.display = 'flex'; setTimeout(function() { el.style.display = 'none'; }, 5000); }
  }

  function showUploadError(msg) {
    var el = document.getElementById('pa-upload-error');
    if (el) { el.textContent = msg; el.style.display = 'block'; setTimeout(function() { el.style.display = 'none'; }, 8000); }
  }

  // ============================================================
  // CONTRACT SUMMARY DISPLAY
  // ============================================================
  function displayContractSummary(summaryText) {
    var card = document.getElementById('pa-summary-card');
    var body = document.getElementById('pa-summary-body');
    if (!card || !body) return;

    /* Store raw text for saving */
    currentSummaryText = summaryText || '';

    if (!summaryText || !summaryText.trim()) {
      card.classList.remove('pa-has-summary');
      body.innerHTML = '';
      return;
    }

    /* Convert bullet text into styled HTML spans */
    var lines = summaryText.split('\\n').filter(function(l) { return l.trim(); });
    var html = lines.map(function(line) {
      var cleaned = line.replace(/^[•\\-\\*]\\s*/, '').trim();
      if (!cleaned) return '';
      return '<span class="pa-bullet">• ' + cleaned.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>';
    }).filter(Boolean).join('');

    body.innerHTML = html;
    card.classList.add('pa-has-summary');
  }

  function populateFromExtraction(data) {
    if (!data) return;
    /* New fields */
    if (data.contractDate) document.getElementById('pa-contract-date').value = data.contractDate;
    if (data.propertyAddress) document.getElementById('pa-property-address').value = data.propertyAddress;
    /* Text fields */
    if (data.buyersNames) document.getElementById('pa-buyers-names').value = data.buyersNames;
    if (data.buyersAgent) document.getElementById('pa-buyers-agent').value = data.buyersAgent;
    if (data.buyersAgentCompany) document.getElementById('pa-buyers-agent-company').value = data.buyersAgentCompany;
    if (data.buyersAgentEmail) document.getElementById('pa-buyers-agent-email').value = data.buyersAgentEmail;
    if (data.sellersAgent) document.getElementById('pa-sellers-agent').value = data.sellersAgent;
    if (data.sellersAgentCompany) document.getElementById('pa-sellers-agent-company').value = data.sellersAgentCompany;
    if (data.sellersAgentEmail) document.getElementById('pa-sellers-agent-email').value = data.sellersAgentEmail;
    /* Currency fields — format with $ prefix */
    if (data.purchasePrice) document.getElementById('pa-purchase-price').value = '$' + parseFloat(data.purchasePrice).toLocaleString('en-US');
    if (data.escrowDeposit) document.getElementById('pa-escrow-deposit').value = '$' + parseFloat(data.escrowDeposit).toLocaleString('en-US');
    /* Seller concessions */
    if (data.sellerConcessions != null && data.sellerConcessions !== '' && parseFloat(data.sellerConcessions) !== 0) {
      var sv = parseFloat(data.sellerConcessions);
      if (data.sellerConcessionsType === '%') {
        document.getElementById('pa-seller-concessions').value = sv;
      } else {
        document.getElementById('pa-seller-concessions').value = sv.toLocaleString('en-US');
      }
      /* Set concession type toggle */
      if (data.sellerConcessionsType) {
        concType = data.sellerConcessionsType;
        var btns = document.querySelectorAll('.pa-conc-btn');
        btns.forEach(function(b) { b.classList.toggle('active', b.getAttribute('data-type') === concType); });
        var concInput = document.getElementById('pa-seller-concessions');
        if (concInput) concInput.placeholder = (concType === '%') ? '3.0' : '6,000';
      }
    }
    /* BAC fields */
    if (data.bacAmount != null && data.bacAmount !== '') {
      var bv = parseFloat(data.bacAmount);
      if (!isNaN(bv) && bv !== 0) {
        document.getElementById('pa-bac-amount').value = (data.bacType === '%') ? bv : bv.toLocaleString('en-US');
        if (data.bacType) {
          bacType = data.bacType;
          var bacInput = document.getElementById('pa-bac-amount');
          if (bacInput) {
            var row = bacInput.closest('.pa-conc-row');
            if (row) row.querySelectorAll('.pa-conc-btn').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-type') === bacType); });
          }
        }
        if (data.bacPaidBy) document.getElementById('pa-bac-paid-by').value = data.bacPaidBy;
      }
    }
    /* Date fields */
    if (data.coeDate) document.getElementById('pa-coe-date').value = data.coeDate;
    if (data.earliestCloseDate) document.getElementById('pa-earliest-close').value = data.earliestCloseDate;
    /* Earliest close hint */
    var earlyHint = document.getElementById('pa-no-early-hint');
    if (earlyHint) earlyHint.style.display = data.earliestCloseDate ? 'none' : 'block';
    /* Select fields — only set if value is a valid option */
    var selectMap = {
      'pa-survey-required': data.surveyRequired,
      'pa-survey-paid-by': data.surveyPaidBy,
      'pa-pest-required': data.pestRequired,
      'pa-pest-paid-by': data.pestPaidBy,
      'pa-warranty-required': data.homeWarranty,
      'pa-warranty-paid-by': data.homeWarrantyPaidBy
    };
    Object.keys(selectMap).forEach(function(id) {
      var val = selectMap[id];
      if (!val) return;
      var sel = document.getElementById(id);
      if (!sel) return;
      /* Check if the value exists as an option */
      for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === val) {
          sel.value = val;
          break;
        }
      }
    });

    /* Contract Summary — display in the summary card */
    displayContractSummary(data.contractSummary || '');
  }


  // ============================================================
  // BUILD / POPULATE / RESET
  // Called from pipeline-app.js openLoanModal() and openNewLoanModal()
  // ============================================================
  window.buildPurchaseAgreementSection = function(loan) {
    /* Inject nav + section if not already present */
    injectNavItem();
    injectSection();

    /* Attach currency formatting (only once) */
    if (!window._paFormattersAttached) {
      formatCurrencyOnBlur('pa-purchase-price');
      formatCurrencyOnBlur('pa-escrow-deposit');
      formatCurrencyOnBlur('pa-seller-concessions');
      formatCurrencyOnBlur('pa-bac-amount');
      attachFileListener();
      window._paFormattersAttached = true;
    }

    /* Reset all fields first */
    ['pa-contract-date','pa-property-address','pa-buyers-names','pa-purchase-price','pa-escrow-deposit','pa-seller-concessions',
     'pa-bac-amount','pa-bac-paid-by',
     'pa-coe-date','pa-earliest-close','pa-survey-required','pa-survey-paid-by',
     'pa-pest-required','pa-pest-paid-by',
     'pa-warranty-required','pa-warranty-paid-by',
     'pa-buyers-agent','pa-buyers-agent-company','pa-buyers-agent-email',
     'pa-sellers-agent','pa-sellers-agent-company','pa-sellers-agent-email'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });

    /* Reset concession type to $ */
    concType = '$';
    var btns = document.querySelectorAll('.pa-conc-btn');
    btns.forEach(function(b) { b.classList.toggle('active', b.getAttribute('data-type') === '$'); });
    var concInput = document.getElementById('pa-seller-concessions');
    if (concInput) concInput.placeholder = '6,000';

    /* Reset upload bar state */
    setExtractingState(false);
    var successEl = document.getElementById('pa-upload-success');
    var errorEl = document.getElementById('pa-upload-error');
    if (successEl) successEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';

    /* Reset contract summary */
    displayContractSummary('');

    /* If loan data provided, parse and populate */
    if (loan && loan['Purchase Agreement JSON']) {
      try {
        var data = JSON.parse(loan['Purchase Agreement JSON']);
        if (data.contractDate) document.getElementById('pa-contract-date').value = data.contractDate;
        if (data.propertyAddress) document.getElementById('pa-property-address').value = data.propertyAddress;
        if (data.buyersNames) document.getElementById('pa-buyers-names').value = data.buyersNames;
        if (data.purchasePrice) document.getElementById('pa-purchase-price').value = '$' + parseFloat(data.purchasePrice).toLocaleString('en-US');
        if (data.escrowDeposit) document.getElementById('pa-escrow-deposit').value = '$' + parseFloat(data.escrowDeposit).toLocaleString('en-US');
        if (data.sellerConcessions != null && data.sellerConcessions !== '') {
          var sv = parseFloat(data.sellerConcessions);
          if (data.sellerConcessionsType === '%') {
            document.getElementById('pa-seller-concessions').value = sv;
          } else {
            document.getElementById('pa-seller-concessions').value = sv.toLocaleString('en-US');
          }
        }
        if (data.sellerConcessionsType) {
          concType = data.sellerConcessionsType;
          btns.forEach(function(b) { b.classList.toggle('active', b.getAttribute('data-type') === concType); });
          if (concInput) concInput.placeholder = (concType === '%') ? '3.0' : '6,000';
        }
        if (data.coeDate) document.getElementById('pa-coe-date').value = data.coeDate;
        if (data.earliestCloseDate) document.getElementById('pa-earliest-close').value = data.earliestCloseDate;
        if (data.surveyRequired) document.getElementById('pa-survey-required').value = data.surveyRequired;
        if (data.surveyPaidBy) document.getElementById('pa-survey-paid-by').value = data.surveyPaidBy;
        if (data.pestRequired) document.getElementById('pa-pest-required').value = data.pestRequired;
        if (data.pestPaidBy) document.getElementById('pa-pest-paid-by').value = data.pestPaidBy;
        if (data.homeWarranty) document.getElementById('pa-warranty-required').value = data.homeWarranty;
        if (data.homeWarrantyPaidBy) document.getElementById('pa-warranty-paid-by').value = data.homeWarrantyPaidBy;
        if (data.buyersAgent) document.getElementById('pa-buyers-agent').value = data.buyersAgent;
        if (data.buyersAgentCompany) document.getElementById('pa-buyers-agent-company').value = data.buyersAgentCompany;
        if (data.buyersAgentEmail) document.getElementById('pa-buyers-agent-email').value = data.buyersAgentEmail;
        if (data.sellersAgent) document.getElementById('pa-sellers-agent').value = data.sellersAgent;
        if (data.sellersAgentCompany) document.getElementById('pa-sellers-agent-company').value = data.sellersAgentCompany;
        if (data.sellersAgentEmail) document.getElementById('pa-sellers-agent-email').value = data.sellersAgentEmail;
        if (data.bacAmount) document.getElementById('pa-bac-amount').value = data.bacAmount;
        if (data.bacType) bacType = data.bacType;
        if (data.bacPaidBy) document.getElementById('pa-bac-paid-by').value = data.bacPaidBy;
        /* Load contract summary */
        displayContractSummary(data.contractSummary || '');
      } catch (e) {
        console.warn('Could not parse Purchase Agreement JSON:', e);
      }
    }
  };


  // ============================================================
  // GET JSON — called by saveLoan() to serialize all PA fields
  // ============================================================
  window.getPurchaseAgreementJSON = function() {
    var contractDate = (document.getElementById('pa-contract-date') || {}).value || '';
    var propertyAddr = (document.getElementById('pa-property-address') || {}).value || '';
    var buyersNames = (document.getElementById('pa-buyers-names') || {}).value || '';
    var purchasePrice = (document.getElementById('pa-purchase-price') || {}).value || '';
    var escrowDeposit = (document.getElementById('pa-escrow-deposit') || {}).value || '';
    var sellerConc = (document.getElementById('pa-seller-concessions') || {}).value || '';
    var bacAmt = (document.getElementById('pa-bac-amount') || {}).value || '';
    var bacPaid = (document.getElementById('pa-bac-paid-by') || {}).value || '';
    var coeDate = (document.getElementById('pa-coe-date') || {}).value || '';
    var earliestClose = (document.getElementById('pa-earliest-close') || {}).value || '';
    var surveyReq = (document.getElementById('pa-survey-required') || {}).value || '';
    var surveyPaid = (document.getElementById('pa-survey-paid-by') || {}).value || '';
    var pestReq = (document.getElementById('pa-pest-required') || {}).value || '';
    var pestPaid = (document.getElementById('pa-pest-paid-by') || {}).value || '';
    var warrantyReq = (document.getElementById('pa-warranty-required') || {}).value || '';
    var warrantyPaid = (document.getElementById('pa-warranty-paid-by') || {}).value || '';
    var buyersAgent = (document.getElementById('pa-buyers-agent') || {}).value || '';
    var buyersAgentCo = (document.getElementById('pa-buyers-agent-company') || {}).value || '';
    var buyersAgentEm = (document.getElementById('pa-buyers-agent-email') || {}).value || '';
    var sellersAgent = (document.getElementById('pa-sellers-agent') || {}).value || '';
    var sellersAgentCo = (document.getElementById('pa-sellers-agent-company') || {}).value || '';
    var sellersAgentEm = (document.getElementById('pa-sellers-agent-email') || {}).value || '';

    /* Only return JSON if at least one field has data */
    var hasData = buyersNames || purchasePrice || escrowDeposit || sellerConc ||
                  bacAmt || coeDate || earliestClose || surveyReq || surveyPaid || pestReq || pestPaid ||
                  warrantyReq || warrantyPaid || buyersAgent || buyersAgentCo || sellersAgent || sellersAgentCo || currentSummaryText;
    if (!hasData) return '';

    /* Parse currency strings to numbers for storage */
    function parseNum(str) {
      var cleaned = String(str).replace(/[^0-9.\\-]/g, '');
      var num = parseFloat(cleaned);
      return isNaN(num) ? null : num;
    }

    var obj = {
      contractDate: contractDate,
      propertyAddress: propertyAddr,
      buyersNames: buyersNames,
      purchasePrice: parseNum(purchasePrice),
      escrowDeposit: parseNum(escrowDeposit),
      sellerConcessions: parseNum(sellerConc),
      sellerConcessionsType: concType,
      bacAmount: parseNum(bacAmt),
      bacType: bacType,
      bacPaidBy: bacPaid,
      coeDate: coeDate,
      earliestCloseDate: earliestClose,
      surveyRequired: surveyReq,
      surveyPaidBy: surveyPaid,
      pestRequired: pestReq,
      pestPaidBy: pestPaid,
      homeWarranty: warrantyReq,
      homeWarrantyPaidBy: warrantyPaid,
      buyersAgent: buyersAgent,
      buyersAgentCompany: buyersAgentCo,
      buyersAgentEmail: buyersAgentEm,
      sellersAgent: sellersAgent,
      sellersAgentCompany: sellersAgentCo,
      sellersAgentEmail: sellersAgentEm,
      contractSummary: currentSummaryText
    };

    /* Remove null/empty values to keep JSON clean */
    Object.keys(obj).forEach(function(k) {
      if (obj[k] === null || obj[k] === '') delete obj[k];
    });

    return JSON.stringify(obj);
  };


  // ============================================================
  // AUTO-INIT — inject nav + section when DOM is ready
  // ============================================================
  function init() {
    injectNavItem();
    injectSection();
    attachFileListener();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 600); });
  } else {
    setTimeout(init, 600);
  }
})();
`;
  return new Response(jsContent, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      ...getCorsHeaders(request)
    }
  });
}


// ============================================================
// PIPELINE CLOSING COSTS CALCULATOR — STATIC JS MODULE
// ============================================================

/**
 * GET /static/pipeline-closing-costs.js
 * Serves the Closing Costs calculator module for the Pipeline page.
 * Two-panel sidebar: inputs left, results right.
 * Pre-fills from current loan data, saves to localStorage per loan.
 * Cache-busted via ?v= query param when deploying updates.
 */
async function getClosingCostsJS(request) {
  const jsContent = `
/* ============================================================
   PIPELINE CLOSING COSTS CALCULATOR — JavaScript Module v1.0
   ============================================================
   Served via Cloudflare Worker as /static/pipeline-closing-costs.js
   Loaded after pipeline-app.js (uses parseCurrency global).

   Two-panel sidebar: inputs left, results right.
   Pre-fills from current loan data. Saves to localStorage per loan.
   Single scenario (no multi-column comparison).
   ============================================================ */

var ccSidebarBuilt = false;

/* ============================================================
   CURRENCY HELPERS (self-contained if parseCurrency not yet loaded)
   ============================================================ */
function ccParseCurrency(val) {
  if (typeof parseCurrency === 'function') return parseCurrency(val);
  if (!val) return 0;
  return parseFloat(String(val).replace(/[^0-9.\\-]/g, '')) || 0;
}

function ccFormatCurrency(n) {
  if (!n && n !== 0) return '$0';
  return '$' + Math.round(n).toLocaleString('en-US');
}

/* ============================================================
   BUILD THE SIDEBAR DOM (called once, then reused)
   ============================================================ */
function buildClosingCostsSidebar() {
  if (ccSidebarBuilt) return;

  /* ---- Inject Closing Costs-specific CSS ---- */
  var style = document.createElement('style');
  style.textContent = ''
    /* Override modal size for closing costs */
    + '#cc-sidebar .calc-sidebar-card{width:1200px;max-width:96vw;max-height:94vh;}'
    /* Two-panel layout */
    + '.cc-panels{display:flex;flex:1;overflow:hidden;min-height:0;}'
    + '.cc-panel-left{flex:1;overflow-y:auto;padding:20px 24px 24px;border-right:1px solid #E2E8F0;display:flex;flex-direction:column;gap:12px;}'
    + '.cc-panel-right{width:380px;flex-shrink:0;overflow-y:auto;padding:20px 20px 24px;background:#FAFBFC;display:flex;flex-direction:column;gap:12px;}'
    /* Section headers */
    + '.cc-sec-hdr{display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:#F1F5F9;border-radius:6px;border-left:3px solid #3B82F6;cursor:pointer;user-select:none;}'
    + '.cc-sec-hdr:hover{background:#E2E8F0;}'
    + '.cc-sec-title{font-size:11px;font-weight:700;color:#1E3A8A;text-transform:uppercase;letter-spacing:0.03em;display:flex;align-items:center;gap:6px;}'
    + '.cc-sec-title i{font-size:10px;color:#64748B;transition:transform 0.2s;}'
    + '.cc-sec-title i.open{transform:rotate(90deg);}'
    + '.cc-sec-total{font-size:13px;font-weight:800;color:#1E293B;font-variant-numeric:tabular-nums;}'
    /* Section body (collapsible) */
    + '.cc-sec-body{display:none;padding:10px 12px 6px;}'
    + '.cc-sec-body.open{display:block;}'
    /* Input rows */
    + '.cc-field{display:flex;align-items:center;gap:8px;margin-bottom:8px;}'
    + '.cc-field:last-child{margin-bottom:0;}'
    + '.cc-field label{font-size:11px;font-weight:600;color:#64748B;min-width:130px;flex-shrink:0;}'
    + '.cc-field .cc-inp{flex:1;min-width:0;padding:6px 10px;border:1px solid #E2E8F0;border-radius:5px;font-size:13px;background:#FFF;color:#1E293B;}'
    + '.cc-field .cc-inp:focus{outline:none;border-color:#3B82F6;box-shadow:0 0 0 2px rgba(59,130,246,0.1);}'
    + '.cc-dlr{position:relative;flex:1;min-width:0;}'
    + '.cc-dlr span{position:absolute;left:8px;top:50%;transform:translateY(-50%);color:#94A3B8;font-weight:600;font-size:12px;pointer-events:none;}'
    + '.cc-dlr .cc-inp{padding-left:22px;width:100%;}'
    + '.cc-pct{position:relative;flex:1;min-width:0;}'
    + '.cc-pct span{position:absolute;right:8px;top:50%;transform:translateY(-50%);color:#94A3B8;font-weight:600;font-size:12px;pointer-events:none;}'
    + '.cc-pct .cc-inp{padding-right:22px;width:100%;}'
    /* Computed display rows */
    + '.cc-comp-row{display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:12px;color:#475569;}'
    + '.cc-comp-row .v{font-weight:700;color:#1E293B;font-variant-numeric:tabular-nums;}'
    /* Purchase/Refi toggle area */
    + '.cc-purpose-area{padding:10px 12px;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;}'
    + '.cc-purpose-area select{width:100%;padding:6px 10px;border:1px solid #93C5FD;border-radius:5px;font-size:13px;background:#FFF;color:#1E293B;}'
    + '.cc-purpose-area .cc-field{margin-bottom:6px;}'
    + '.cc-purchase-fields,.cc-refi-fields{margin-top:8px;}'
    /* Origination radio toggle */
    + '.cc-radio-row{display:flex;gap:12px;margin:4px 0 6px;}'
    + '.cc-radio-row label{min-width:auto;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:4px;}'
    + '.cc-radio-row input{width:14px;height:14px;}'
    /* Checkbox row */
    + '.cc-cb-row{display:flex;align-items:center;gap:6px;margin:4px 0;}'
    + '.cc-cb-row input{width:15px;height:15px;accent-color:#2563EB;cursor:pointer;}'
    + '.cc-cb-row label{min-width:auto;font-size:12px;cursor:pointer;}'
    /* Right panel results */
    + '.cc-hero{text-align:center;padding:14px 12px;background:linear-gradient(135deg,#EFF6FF,#DBEAFE);border-radius:10px;border:1px solid #BFDBFE;}'
    + '.cc-hero-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#3B82F6;margin-bottom:2px;}'
    + '.cc-hero-value{font-size:28px;font-weight:800;color:#1E40AF;line-height:1.1;}'
    + '.cc-hero-sub{font-size:11px;color:#64748B;margin-top:3px;}'
    /* Result breakdown rows */
    + '.cc-bd{}'
    + '.cc-bd-title{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;color:#1E3A8A;margin-bottom:6px;padding-bottom:3px;border-bottom:2px solid #DBEAFE;}'
    + '.cc-bd-row{display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:12px;color:#475569;}'
    + '.cc-bd-row .v{font-weight:700;color:#1E293B;font-variant-numeric:tabular-nums;}'
    + '.cc-bd-row.tot{border-top:2px solid #E2E8F0;margin-top:3px;padding-top:6px;font-weight:700;color:#1E293B;}'
    + '.cc-bd-row.grand{border-top:2px solid #1E40AF;margin-top:6px;padding-top:8px;font-size:14px;font-weight:800;color:#1E40AF;}'
    /* Payment breakdown */
    + '.cc-pmt-card{background:#F0FDF4;border:1px solid #86EFAC;border-radius:8px;padding:10px 12px;}'
    + '.cc-pmt-title{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.3px;color:#166534;margin-bottom:6px;}'
    + '.cc-pmt-row{display:flex;justify-content:space-between;padding:3px 0;font-size:12px;color:#334155;}'
    + '.cc-pmt-row .v{font-weight:700;font-variant-numeric:tabular-nums;}'
    + '.cc-pmt-row.tot{border-top:2px solid #86EFAC;margin-top:3px;padding-top:5px;font-weight:700;color:#166534;}'
    /* Summary card */
    + '.cc-summary-card{background:#FFF;border:1px solid #E2E8F0;border-radius:8px;padding:10px 12px;}'
    + '.cc-summary-row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#475569;border-bottom:1px solid #F1F5F9;}'
    + '.cc-summary-row:last-child{border-bottom:none;}'
    + '.cc-summary-row .v{font-weight:700;color:#1E293B;font-variant-numeric:tabular-nums;}'
    + '.cc-summary-row.highlight{border-top:2px solid #1E40AF;padding-top:8px;margin-top:4px;font-size:14px;font-weight:800;color:#1E40AF;}'
    + '.cc-summary-row.highlight .v{color:#1E40AF;font-size:16px;}'
    /* Credit row styling */
    + '.cc-credit-row{display:flex;justify-content:space-between;padding:3px 0;font-size:12px;color:#059669;}'
    + '.cc-credit-row .v{font-weight:700;color:#059669;font-variant-numeric:tabular-nums;}'
    /* Responsive */
    + '@media(max-width:900px){.cc-panels{flex-direction:column;}.cc-panel-left{border-right:none;border-bottom:1px solid #E2E8F0;max-height:55vh;}.cc-panel-right{width:100%;max-height:45vh;}}';
  document.head.appendChild(style);

  /* ---- Build overlay DOM ---- */
  var overlay = document.createElement('div');
  overlay.id = 'cc-sidebar';
  overlay.className = 'calc-sidebar hidden';

  overlay.innerHTML = '<div class="calc-sidebar-card">'
    + '<div class="calc-sidebar-header">'
    +   '<h3><i class="fa-solid fa-file-invoice-dollar"></i> Closing Costs</h3>'
    +   '<span class="close-calc-sidebar" onclick="closeClosingCostsSidebar()">&times;</span>'
    + '</div>'

    /* ===== TWO PANELS ===== */
    + '<div class="cc-panels">'

    /* ========== LEFT PANEL: INPUTS ========== */
    + '<div class="cc-panel-left">'

    /* --- Purpose & Loan Details --- */
    + '<div class="cc-purpose-area">'
    +   '<div class="cc-field"><label>Purpose</label>'
    +     '<select id="cc-purpose" class="cc-inp" onchange="ccHandlePurpose()">'
    +       '<option value="Purchase">Purchase</option>'
    +       '<option value="Refi (Rate-Term)">Refi (Rate-Term)</option>'
    +       '<option value="Refi (Cash-Out)">Refi (Cash-Out)</option>'
    +     '</select>'
    +   '</div>'
    /* Purchase fields */
    +   '<div id="cc-purchase-fields" class="cc-purchase-fields">'
    +     '<div class="cc-field"><label>Purchase Price</label><div class="cc-dlr"><span>$</span><input type="text" id="cc-purchase-price" class="cc-inp currency-input" placeholder="0"></div></div>'
    +     '<div class="cc-field"><label>Down Payment %</label><div class="cc-pct"><span>%</span><input type="number" id="cc-down-pct" class="cc-inp" step="0.01" placeholder="20"></div></div>'
    +     '<div class="cc-comp-row"><span>Down Payment</span><span class="v" id="cc-disp-dp">$0</span></div>'
    +     '<div class="cc-comp-row"><span>Base Loan Amount</span><span class="v" id="cc-disp-base-loan">$0</span></div>'
    +     '<div class="cc-comp-row"><span>LTV</span><span class="v" id="cc-disp-ltv">0.00%</span></div>'
    +   '</div>'
    /* Refi fields */
    +   '<div id="cc-refi-fields" class="cc-refi-fields" style="display:none;">'
    +     '<div class="cc-field"><label>Est. Value</label><div class="cc-dlr"><span>$</span><input type="text" id="cc-prop-value" class="cc-inp currency-input" placeholder="0"></div></div>'
    +     '<div class="cc-field"><label>Payoff Balance</label><div class="cc-dlr"><span>$</span><input type="text" id="cc-payoff" class="cc-inp currency-input" placeholder="0"></div></div>'
    +     '<div class="cc-field"><label>Cash Out</label><div class="cc-dlr"><span>$</span><input type="text" id="cc-cashout" class="cc-inp currency-input" placeholder="0"></div></div>'
    +     '<div class="cc-cb-row"><input type="checkbox" id="cc-roll-costs"><label for="cc-roll-costs">Roll all closing costs into loan</label></div>'
    +     '<div class="cc-comp-row"><span>Base Loan Amount</span><span class="v" id="cc-disp-refi-loan">$0</span></div>'
    +   '</div>'
    /* Loan info row */
    +   '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:8px;">'
    +     '<div class="cc-field" style="flex-direction:column;align-items:stretch;"><label>Loan Type</label><select id="cc-loan-type" class="cc-inp"><option>Conv</option><option>FHA</option><option>VA</option><option>USDA</option><option>DSCR</option><option>Other</option></select></div>'
    +     '<div class="cc-field" style="flex-direction:column;align-items:stretch;"><label>Term (yrs)</label><input type="number" id="cc-term" class="cc-inp" value="30" min="1" max="50"></div>'
    +     '<div class="cc-field" style="flex-direction:column;align-items:stretch;"><label>Rate (%)</label><input type="number" id="cc-rate" class="cc-inp" step="0.125" placeholder="6.5"></div>'
    +   '</div>'
    +   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">'
    +     '<div class="cc-field" style="flex-direction:column;align-items:stretch;"><label>HOI (yearly)</label><div class="cc-dlr"><span>$</span><input type="text" id="cc-hoi-yearly" class="cc-inp currency-input" placeholder="0"></div></div>'
    +     '<div class="cc-field" style="flex-direction:column;align-items:stretch;"><label>Prop Tax (yearly)</label><div class="cc-dlr"><span>$</span><input type="text" id="cc-tax-yearly" class="cc-inp currency-input" placeholder="0"></div></div>'
    +   '</div>'
    /* Funding fee row (VA/FHA/USDA only) */
    +   '<div id="cc-funding-row" style="display:none;">'
    +     '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">'
    +       '<div class="cc-field" style="flex-direction:column;align-items:stretch;"><label>Funding Fee %</label><div class="cc-pct"><span>%</span><input type="number" id="cc-funding-pct" class="cc-inp" step="0.01" placeholder="0"></div></div>'
    +       '<div class="cc-field" style="flex-direction:column;align-items:stretch;"><label>Funding Fee Amt</label><div class="cc-dlr"><span>$</span><input type="text" id="cc-funding-amt" class="cc-inp" readonly style="background:#F1F5F9;"></div></div>'
    +     '</div>'
    +     '<div class="cc-cb-row"><input type="checkbox" id="cc-finance-funding"><label for="cc-finance-funding">Finance funding fee</label></div>'
    +   '</div>'
    + '</div>'

    /* --- Section A: Origination Charges --- */
    + ccSectionHTML('A', 'Origination Charges', [
        ['cc-admin-fee', 'Admin Fee', 'dollar'],
        ['cc-underwriting', 'Underwriting Fee', 'dollar'],
      ])
    + '<div id="cc-sec-body-A-extra" class="cc-sec-body">'
    +   '<div class="cc-field"><label>Origination</label><div class="cc-pct"><span>%</span><input type="number" id="cc-origination-pct" class="cc-inp" step="0.001" placeholder="0"></div></div>'
    +   '<div class="cc-comp-row"><span>Origination Fee</span><span class="v" id="cc-disp-orig-fee">$0</span></div>'
    +   '<div class="cc-field"><label>Points</label><div class="cc-pct"><span>%</span><input type="number" id="cc-points" class="cc-inp" step="0.001" placeholder="0"></div></div>'
    +   '<div class="cc-comp-row"><span>Points Fee</span><span class="v" id="cc-disp-points-fee">$0</span></div>'
    + '</div>'

    /* --- Section B: Non-Shoppable Services --- */
    + ccSectionHTML('B', 'Non-Shoppable Services', [
        ['cc-appraisal', 'Appraisal', 'dollar'],
        ['cc-credit', 'Credit Report', 'dollar'],
        ['cc-3rd-party', '3rd Party Processing', 'dollar'],
        ['cc-flood', 'Flood Cert', 'dollar'],
        ['cc-tax-service', 'Tax Service', 'dollar'],
        ['cc-mers', 'MERS', 'dollar'],
        ['cc-voe', 'VOE/VOD', 'dollar'],
        ['cc-b-other', 'Other', 'dollar'],
      ])

    /* --- Section C: Title Services --- */
    + ccSectionHTML('C', 'Title Services', [
        ['cc-title-settlement', 'Settlement Fee', 'dollar'],
        ['cc-title-doc-prep', 'Doc Prep', 'dollar'],
        ['cc-title-cpl', 'CPL', 'dollar'],
        ['cc-lenders-title', 'Lenders Title', 'dollar'],
        ['cc-title-other', 'Other', 'dollar'],
      ])

    /* --- Section E: Government Fees --- */
    + ccSectionHTML('E', 'Government Fees', [
        ['cc-recording', 'Recording Fee', 'dollar'],
        ['cc-transfer-tax', 'Transfer Tax', 'dollar'],
      ])

    /* --- Section F: Prepaids --- */
    + ccSectionHTML('F', 'Prepaids', [
        ['cc-prepaid-interest', 'Prepaid Interest', 'dollar'],
        ['cc-prepaid-hoi', 'Prepaid HOI', 'dollar'],
      ])

    /* --- Section G: Escrows --- */
    + ccSectionHTML('G', 'Escrows', [
        ['cc-insurance-escrow', 'Insurance Escrow', 'dollar'],
        ['cc-tax-escrow', 'Tax Escrow', 'dollar'],
      ])

    /* --- Section H: Other Costs --- */
    + ccSectionHTML('H', 'Other Costs', [
        ['cc-pest', 'Pest Inspection', 'dollar'],
        ['cc-realtor-admin', 'Realtor Admin', 'dollar'],
        ['cc-warranty', 'Home Warranty', 'dollar'],
        ['cc-owner-title', 'Owners Title Ins', 'dollar'],
      ])

    /* --- Credits --- */
    + ccSectionHTML('credits', 'Credits', [
        ['cc-earnest', 'Earnest Money', 'dollar'],
        ['cc-seller-concession', 'Seller Concessions', 'dollar'],
        ['cc-lender-credit', 'Lender Credit', 'dollar'],
      ])

    + '</div>' /* /cc-panel-left */

    /* ========== RIGHT PANEL: RESULTS ========== */
    + '<div class="cc-panel-right">'

    /* Hero: Cash to Close */
    + '<div class="cc-hero" id="cc-hero">'
    +   '<div class="cc-hero-label" id="cc-hero-label">Cash to Close</div>'
    +   '<div class="cc-hero-value" id="cc-hero-value">$0</div>'
    +   '<div class="cc-hero-sub" id="cc-hero-sub">Enter loan details to calculate</div>'
    + '</div>'

    /* Section Totals Breakdown */
    + '<div class="cc-bd">'
    +   '<div class="cc-bd-title">Lender Costs</div>'
    +   '<div class="cc-bd-row"><span>A. Origination</span><span class="v" id="cc-total-A">$0</span></div>'
    +   '<div class="cc-bd-row"><span>B. Non-Shoppable</span><span class="v" id="cc-total-B">$0</span></div>'
    +   '<div class="cc-bd-row"><span>C. Title Services</span><span class="v" id="cc-total-C">$0</span></div>'
    +   '<div class="cc-bd-row tot"><span>D. Total Lender (A+B+C)</span><span class="v" id="cc-total-D">$0</span></div>'
    + '</div>'

    + '<div class="cc-bd">'
    +   '<div class="cc-bd-title">Other Costs</div>'
    +   '<div class="cc-bd-row"><span>E. Government Fees</span><span class="v" id="cc-total-E">$0</span></div>'
    +   '<div class="cc-bd-row"><span>F. Prepaids</span><span class="v" id="cc-total-F">$0</span></div>'
    +   '<div class="cc-bd-row"><span>G. Escrows</span><span class="v" id="cc-total-G">$0</span></div>'
    +   '<div class="cc-bd-row"><span>H. Other</span><span class="v" id="cc-total-H">$0</span></div>'
    +   '<div class="cc-bd-row tot"><span>I. Total Other (E+F+G+H)</span><span class="v" id="cc-total-I">$0</span></div>'
    + '</div>'

    + '<div class="cc-bd">'
    +   '<div class="cc-bd-row grand"><span>J. Total Closing Costs (D+I)</span><span class="v" id="cc-total-J">$0</span></div>'
    + '</div>'

    /* Credits */
    + '<div class="cc-bd">'
    +   '<div class="cc-bd-title">Credits</div>'
    +   '<div class="cc-credit-row"><span>Earnest Money</span><span class="v" id="cc-credit-earnest">$0</span></div>'
    +   '<div class="cc-credit-row"><span>Seller Concessions</span><span class="v" id="cc-credit-seller">$0</span></div>'
    +   '<div class="cc-credit-row"><span>Lender Credit</span><span class="v" id="cc-credit-lender">$0</span></div>'
    +   '<div class="cc-credit-row tot" style="border-top:1px solid #BBF7D0;margin-top:3px;padding-top:5px;"><span>Total Credits</span><span class="v" id="cc-total-credits">$0</span></div>'
    + '</div>'

    /* Cash to Close Summary */
    + '<div class="cc-summary-card">'
    +   '<div class="cc-bd-title">Summary</div>'
    +   '<div class="cc-summary-row"><span>Base Loan Amount</span><span class="v" id="cc-sum-loan">$0</span></div>'
    +   '<div class="cc-summary-row"><span>Total Closing Costs</span><span class="v" id="cc-sum-cc">$0</span></div>'
    +   '<div class="cc-summary-row" id="cc-sum-dp-row"><span>+ Down Payment</span><span class="v" id="cc-sum-dp">$0</span></div>'
    +   '<div class="cc-summary-row"><span>- Total Credits</span><span class="v" id="cc-sum-credits">$0</span></div>'
    +   '<div class="cc-summary-row highlight"><span id="cc-sum-label">= Cash to Close</span><span class="v" id="cc-sum-ctc">$0</span></div>'
    + '</div>'

    /* Monthly Payment */
    + '<div class="cc-pmt-card">'
    +   '<div class="cc-pmt-title">Monthly Payment</div>'
    +   '<div class="cc-pmt-row"><span>Principal & Interest</span><span class="v" id="cc-pmt-pi">$0</span></div>'
    +   '<div class="cc-pmt-row"><span>Homeowners Ins</span><span class="v" id="cc-pmt-hoi">$0</span></div>'
    +   '<div class="cc-pmt-row"><span>Property Tax</span><span class="v" id="cc-pmt-tax">$0</span></div>'
    +   '<div class="cc-pmt-row tot"><span>Total PITI</span><span class="v" id="cc-pmt-piti">$0</span></div>'
    + '</div>'

    + '</div>' /* /cc-panel-right */

    + '</div>' /* /cc-panels */
    + '</div>'; /* /calc-sidebar-card */

  /* Append inside the loan modal */
  var modal = document.getElementById('loan-modal');
  if (modal) { modal.appendChild(overlay); } else { document.body.appendChild(overlay); }

  /* ---- Attach input listeners for real-time calc ---- */
  var allInputs = overlay.querySelectorAll('input, select');
  allInputs.forEach(function(el) {
    var evtType = (el.type === 'checkbox' || el.tagName === 'SELECT') ? 'change' : 'input';
    el.addEventListener(evtType, function() {
      /* Format currency fields on input */
      if (el.classList.contains('currency-input') && el.type === 'text') {
        ccFormatInput(el);
      }
      runCCCalc();
    });
  });

  /* Click-to-toggle section bodies */
  overlay.querySelectorAll('.cc-sec-hdr').forEach(function(hdr) {
    hdr.addEventListener('click', function() {
      var secId = hdr.dataset.section;
      var body = document.getElementById('cc-sec-body-' + secId);
      var icon = hdr.querySelector('i');
      /* Also toggle the extra body for Section A */
      var extraBody = document.getElementById('cc-sec-body-' + secId + '-extra');
      if (body) {
        var isOpen = body.classList.contains('open');
        body.classList.toggle('open', !isOpen);
        if (extraBody) extraBody.classList.toggle('open', !isOpen);
        if (icon) icon.classList.toggle('open', !isOpen);
      }
    });
  });

  /* Loan type change handler for funding fee visibility */
  var loanTypeSelect = document.getElementById('cc-loan-type');
  if (loanTypeSelect) {
    loanTypeSelect.addEventListener('change', ccHandleLoanType);
  }

  ccSidebarBuilt = true;
}

/* ---- Helper: build section HTML ---- */
function ccSectionHTML(id, title, fields) {
  var html = '<div class="cc-sec-hdr" data-section="' + id + '">'
    + '<span class="cc-sec-title"><i class="fa-solid fa-chevron-right"></i> ' + title + '</span>'
    + '<span class="cc-sec-total" id="cc-sec-total-' + id + '">$0</span>'
    + '</div>'
    + '<div class="cc-sec-body" id="cc-sec-body-' + id + '">';
  fields.forEach(function(f) {
    html += '<div class="cc-field"><label>' + f[1] + '</label>';
    if (f[2] === 'dollar') {
      html += '<div class="cc-dlr"><span>$</span><input type="text" id="' + f[0] + '" class="cc-inp currency-input" placeholder="0"></div>';
    } else {
      html += '<div class="cc-pct"><span>%</span><input type="number" id="' + f[0] + '" class="cc-inp" step="0.01" placeholder="0"></div>';
    }
    html += '</div>';
  });
  html += '</div>';
  return html;
}

/* ---- Format currency input on typing ---- */
function ccFormatInput(el) {
  var raw = el.value.replace(/[^\\d.]/g, '');
  if (!raw) return;
  var parts = raw.split('.');
  if (parts.length > 2) raw = parts[0] + '.' + parts.slice(1).join('');
  parts = raw.split('.');
  parts[0] = parts[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
  el.value = parts.join('.');
}

/* ---- Get raw numeric value from input ---- */
function ccGetVal(id) {
  var el = document.getElementById(id);
  if (!el) return 0;
  return ccParseCurrency(el.value);
}

/* ---- Set display text ---- */
function ccSetDisplay(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = ccFormatCurrency(val);
}

/* ============================================================
   HANDLE PURPOSE CHANGE — Show/hide purchase vs refi fields
   ============================================================ */
function ccHandlePurpose() {
  var purpose = document.getElementById('cc-purpose').value;
  var purchaseFields = document.getElementById('cc-purchase-fields');
  var refiFields = document.getElementById('cc-refi-fields');
  var dpRow = document.getElementById('cc-sum-dp-row');
  var sumLabel = document.getElementById('cc-sum-label');

  if (purpose === 'Purchase') {
    purchaseFields.style.display = 'block';
    refiFields.style.display = 'none';
    if (dpRow) dpRow.style.display = 'flex';
    if (sumLabel) sumLabel.textContent = '= Cash to Close';
  } else {
    purchaseFields.style.display = 'none';
    refiFields.style.display = 'block';
    if (dpRow) dpRow.style.display = 'none';
    if (sumLabel) sumLabel.textContent = '= Cash to Close';
  }
  runCCCalc();
}

/* ============================================================
   HANDLE LOAN TYPE CHANGE — Show/hide funding fee row
   ============================================================ */
function ccHandleLoanType() {
  var type = document.getElementById('cc-loan-type').value;
  var row = document.getElementById('cc-funding-row');
  var pctInput = document.getElementById('cc-funding-pct');
  if (type === 'FHA' || type === 'VA' || type === 'USDA') {
    if (row) row.style.display = 'block';
    if (pctInput) {
      if (type === 'FHA') pctInput.value = '1.75';
      else if (type === 'USDA') pctInput.value = '1.01';
      else if (type === 'VA') pctInput.value = '2.15';
    }
  } else {
    if (row) row.style.display = 'none';
    if (pctInput) pctInput.value = '';
  }
  runCCCalc();
}

/* ============================================================
   MAIN CALCULATION ENGINE
   ============================================================ */
function runCCCalc() {
  var purpose = document.getElementById('cc-purpose').value;
  var baseLoan = 0;
  var downPayment = 0;

  /* ---- Calculate base loan amount ---- */
  if (purpose === 'Purchase') {
    var price = ccGetVal('cc-purchase-price');
    var dpPct = parseFloat(document.getElementById('cc-down-pct').value) || 0;
    downPayment = price * dpPct / 100;
    baseLoan = price - downPayment;
    var ltv = price > 0 ? (baseLoan / price * 100) : 0;

    ccSetDisplay('cc-disp-dp', downPayment);
    ccSetDisplay('cc-disp-base-loan', baseLoan);
    var ltvEl = document.getElementById('cc-disp-ltv');
    if (ltvEl) ltvEl.textContent = ltv.toFixed(2) + '%';
  } else {
    var payoff = ccGetVal('cc-payoff');
    var cashout = ccGetVal('cc-cashout');
    baseLoan = payoff + cashout;
    ccSetDisplay('cc-disp-refi-loan', baseLoan);
  }

  /* ---- Funding fee ---- */
  var loanType = document.getElementById('cc-loan-type').value;
  var fundingPct = parseFloat(document.getElementById('cc-funding-pct').value) || 0;
  var fundingAmt = 0;
  var financeFunding = document.getElementById('cc-finance-funding').checked;
  if ((loanType === 'FHA' || loanType === 'VA' || loanType === 'USDA') && fundingPct > 0) {
    fundingAmt = baseLoan * fundingPct / 100;
  }
  ccSetDisplay('cc-funding-amt', fundingAmt);

  /* ---- Section A: Origination ---- */
  var admin = ccGetVal('cc-admin-fee');
  var underwriting = ccGetVal('cc-underwriting');
  var origPct = parseFloat(document.getElementById('cc-origination-pct').value) || 0;
  var origFee = baseLoan * origPct / 100;
  var pointsPct = parseFloat(document.getElementById('cc-points').value) || 0;
  var pointsFee = baseLoan * pointsPct / 100;
  ccSetDisplay('cc-disp-orig-fee', origFee);
  ccSetDisplay('cc-disp-points-fee', pointsFee);
  var totalA = admin + underwriting + origFee + pointsFee;

  /* ---- Section B: Non-Shoppable ---- */
  var totalB = ccGetVal('cc-appraisal')
    + ccGetVal('cc-credit')
    + ccGetVal('cc-3rd-party')
    + ccGetVal('cc-flood')
    + ccGetVal('cc-tax-service')
    + ccGetVal('cc-mers')
    + ccGetVal('cc-voe')
    + ccGetVal('cc-b-other');
  /* Add funding fee to Section B if NOT financed */
  if (fundingAmt > 0 && !financeFunding) {
    totalB += fundingAmt;
  }

  /* ---- Section C: Title ---- */
  var totalC = ccGetVal('cc-title-settlement')
    + ccGetVal('cc-title-doc-prep')
    + ccGetVal('cc-title-cpl')
    + ccGetVal('cc-lenders-title')
    + ccGetVal('cc-title-other');

  /* ---- Total Lender Costs (D) ---- */
  var totalD = totalA + totalB + totalC;

  /* ---- Section E: Government ---- */
  var totalE = ccGetVal('cc-recording') + ccGetVal('cc-transfer-tax');

  /* ---- Section F: Prepaids ---- */
  var totalF = ccGetVal('cc-prepaid-interest') + ccGetVal('cc-prepaid-hoi');

  /* ---- Section G: Escrows ---- */
  var totalG = ccGetVal('cc-insurance-escrow') + ccGetVal('cc-tax-escrow');

  /* ---- Section H: Other ---- */
  var totalH = ccGetVal('cc-pest')
    + ccGetVal('cc-realtor-admin')
    + ccGetVal('cc-warranty')
    + ccGetVal('cc-owner-title');

  /* ---- Total Other Costs (I) ---- */
  var totalI = totalE + totalF + totalG + totalH;

  /* ---- Total Closing Costs (J) ---- */
  var totalJ = totalD + totalI;

  /* ---- Credits ---- */
  var earnest = ccGetVal('cc-earnest');
  var sellerConc = ccGetVal('cc-seller-concession');
  var lenderCredit = ccGetVal('cc-lender-credit');
  var totalCredits = earnest + sellerConc + lenderCredit;

  /* ---- Update section header totals ---- */
  ccSetDisplay('cc-sec-total-A', totalA);
  ccSetDisplay('cc-sec-total-B', totalB);
  ccSetDisplay('cc-sec-total-C', totalC);
  ccSetDisplay('cc-sec-total-E', totalE);
  ccSetDisplay('cc-sec-total-F', totalF);
  ccSetDisplay('cc-sec-total-G', totalG);
  ccSetDisplay('cc-sec-total-H', totalH);
  ccSetDisplay('cc-sec-total-credits', totalCredits);

  /* ---- Update right panel ---- */
  ccSetDisplay('cc-total-A', totalA);
  ccSetDisplay('cc-total-B', totalB);
  ccSetDisplay('cc-total-C', totalC);
  ccSetDisplay('cc-total-D', totalD);
  ccSetDisplay('cc-total-E', totalE);
  ccSetDisplay('cc-total-F', totalF);
  ccSetDisplay('cc-total-G', totalG);
  ccSetDisplay('cc-total-H', totalH);
  ccSetDisplay('cc-total-I', totalI);
  ccSetDisplay('cc-total-J', totalJ);

  ccSetDisplay('cc-credit-earnest', earnest);
  ccSetDisplay('cc-credit-seller', sellerConc);
  ccSetDisplay('cc-credit-lender', lenderCredit);
  ccSetDisplay('cc-total-credits', totalCredits);

  /* ---- Handle refi: roll costs into loan ---- */
  var finalBaseLoan = baseLoan;
  if (purpose !== 'Purchase') {
    var rollCosts = document.getElementById('cc-roll-costs').checked;
    if (rollCosts) {
      finalBaseLoan = baseLoan + totalJ;
    }
    /* If funding fee is financed, add to loan */
    if (financeFunding && fundingAmt > 0) {
      finalBaseLoan += fundingAmt;
    }
    ccSetDisplay('cc-disp-refi-loan', finalBaseLoan);
  } else {
    /* If funding fee is financed, add to loan (purchase) */
    if (financeFunding && fundingAmt > 0) {
      finalBaseLoan = baseLoan + fundingAmt;
    }
  }

  /* ---- Summary ---- */
  ccSetDisplay('cc-sum-loan', finalBaseLoan);
  ccSetDisplay('cc-sum-cc', totalJ);
  ccSetDisplay('cc-sum-dp', downPayment);
  ccSetDisplay('cc-sum-credits', totalCredits);

  var cashToClose = 0;
  if (purpose === 'Purchase') {
    cashToClose = totalJ + downPayment - totalCredits;
  } else {
    var rollCosts2 = document.getElementById('cc-roll-costs').checked;
    if (rollCosts2) {
      cashToClose = 0 - totalCredits; /* Costs are rolled in */
    } else {
      cashToClose = totalJ - totalCredits;
    }
  }
  ccSetDisplay('cc-sum-ctc', cashToClose);

  /* ---- Hero ---- */
  var heroLabel = document.getElementById('cc-hero-label');
  var heroValue = document.getElementById('cc-hero-value');
  var heroSub = document.getElementById('cc-hero-sub');
  if (heroLabel) heroLabel.textContent = 'Cash to Close';
  if (heroValue) heroValue.textContent = ccFormatCurrency(cashToClose);
  if (heroSub) {
    heroSub.textContent = totalJ > 0
      ? 'Total closing costs: ' + ccFormatCurrency(totalJ)
      : 'Enter loan details to calculate';
  }

  /* ---- Monthly Payment ---- */
  var rate = parseFloat(document.getElementById('cc-rate').value) || 0;
  var term = parseFloat(document.getElementById('cc-term').value) || 30;
  var hoiYearly = ccGetVal('cc-hoi-yearly');
  var taxYearly = ccGetVal('cc-tax-yearly');

  var monthlyRate = rate / 100 / 12;
  var numPayments = term * 12;
  var monthlyPI = 0;
  if (rate > 0 && finalBaseLoan > 0) {
    monthlyPI = finalBaseLoan * monthlyRate * Math.pow(1 + monthlyRate, numPayments) / (Math.pow(1 + monthlyRate, numPayments) - 1);
  }
  var monthlyHOI = hoiYearly / 12;
  var monthlyTax = taxYearly / 12;
  var monthlyPITI = monthlyPI + monthlyHOI + monthlyTax;

  ccSetDisplay('cc-pmt-pi', monthlyPI);
  ccSetDisplay('cc-pmt-hoi', monthlyHOI);
  ccSetDisplay('cc-pmt-tax', monthlyTax);
  ccSetDisplay('cc-pmt-piti', monthlyPITI);

  /* Save state to localStorage */
  ccSaveState();
}

/* ============================================================
   SHOW / CLOSE SIDEBAR
   ============================================================ */
function showClosingCostsSidebar() {
  buildClosingCostsSidebar();
  var sb = document.getElementById('cc-sidebar');
  if (!sb) return;

  /* Try restoring saved state first */
  var restored = ccRestoreState();

  if (!restored) {
    /* Pre-fill from loan modal fields */
    ccPrefillFromLoan();
  }

  /* Open all sections by default on first open */
  if (!restored) {
    sb.querySelectorAll('.cc-sec-body').forEach(function(body) {
      body.classList.add('open');
    });
    sb.querySelectorAll('.cc-sec-hdr i').forEach(function(icon) {
      icon.classList.add('open');
    });
  }

  /* Handle purpose and loan type UI */
  ccHandlePurpose();
  ccHandleLoanType();

  /* Reveal and slide in */
  sb.classList.remove('hidden');
  setTimeout(function() { sb.classList.add('open'); }, 10);
  runCCCalc();
}

function closeClosingCostsSidebar() {
  var sb = document.getElementById('cc-sidebar');
  if (!sb) return;
  sb.classList.remove('open');
  setTimeout(function() { sb.classList.add('hidden'); }, 300);
}

/* ============================================================
   PRE-FILL FROM LOAN MODAL FIELDS
   ============================================================ */
function ccPrefillFromLoan() {
  /* Purchase price */
  var priceEl = document.getElementById('purchase-price');
  if (priceEl && priceEl.value) {
    var priceInput = document.getElementById('cc-purchase-price');
    if (priceInput) {
      priceInput.value = priceEl.value;
      ccFormatInput(priceInput);
    }
  }

  /* Down payment percent — derive from LTV */
  var ltvEl = document.getElementById('ltv');
  if (ltvEl && ltvEl.value) {
    var ltv = parseFloat(ltvEl.value) || 80;
    var dpInput = document.getElementById('cc-down-pct');
    if (dpInput) dpInput.value = (100 - ltv).toFixed(2);
  }

  /* Loan type */
  var loanTypeEl = document.getElementById('loan-type');
  if (loanTypeEl) {
    var typeMap = {
      'Conventional': 'Conv', 'FHA': 'FHA', 'VA': 'VA',
      'USDA': 'USDA', 'DSCR': 'DSCR', 'Other': 'Other'
    };
    var ccType = document.getElementById('cc-loan-type');
    if (ccType) {
      var mapped = typeMap[loanTypeEl.value];
      if (mapped) {
        for (var i = 0; i < ccType.options.length; i++) {
          if (ccType.options[i].value === mapped) {
            ccType.selectedIndex = i;
            break;
          }
        }
      }
    }
  }

  /* Interest rate */
  var rateEl = document.getElementById('loan-interest-rate');
  if (rateEl && rateEl.value) {
    var ccRate = document.getElementById('cc-rate');
    if (ccRate) ccRate.value = rateEl.value;
  }

  /* Loan term */
  var termEl = document.getElementById('loan-term');
  if (termEl && termEl.value) {
    var ccTerm = document.getElementById('cc-term');
    if (ccTerm) ccTerm.value = termEl.value;
  }

  /* Purpose — check if loan has a purpose field */
  var purposeEl = document.getElementById('loan-purpose');
  if (purposeEl && purposeEl.value) {
    var ccPurpose = document.getElementById('cc-purpose');
    if (ccPurpose) {
      var purposeMap = {
        'Purchase': 'Purchase',
        'Refinance': 'Refi (Rate-Term)',
        'Refi (Rate-Term)': 'Refi (Rate-Term)',
        'Refi (Cash-Out)': 'Refi (Cash-Out)',
        'Cash-Out Refi': 'Refi (Cash-Out)'
      };
      var mapped = purposeMap[purposeEl.value];
      if (mapped) ccPurpose.value = mapped;
    }
  }

  /* Property value for refi */
  var propValEl = document.getElementById('property-value');
  if (propValEl && propValEl.value) {
    var ccPropVal = document.getElementById('cc-prop-value');
    if (ccPropVal) {
      ccPropVal.value = propValEl.value;
      ccFormatInput(ccPropVal);
    }
  }

  /* HOI */
  var hoiEl = document.getElementById('homeowners-insurance');
  if (hoiEl && hoiEl.value) {
    var ccHoi = document.getElementById('cc-hoi-yearly');
    if (ccHoi) {
      ccHoi.value = hoiEl.value;
      ccFormatInput(ccHoi);
    }
  }

  /* Property tax */
  var taxEl = document.getElementById('property-taxes');
  if (taxEl && taxEl.value) {
    var ccTax = document.getElementById('cc-tax-yearly');
    if (ccTax) {
      ccTax.value = taxEl.value;
      ccFormatInput(ccTax);
    }
  }
}

/* ============================================================
   LOCALSTORAGE SAVE / RESTORE (per loan ID)
   ============================================================ */
var CC_FIELD_IDS = [
  'cc-purpose', 'cc-purchase-price', 'cc-down-pct', 'cc-prop-value',
  'cc-payoff', 'cc-cashout', 'cc-loan-type', 'cc-term', 'cc-rate',
  'cc-hoi-yearly', 'cc-tax-yearly', 'cc-funding-pct',
  'cc-admin-fee', 'cc-underwriting', 'cc-origination-pct', 'cc-points',
  'cc-appraisal', 'cc-credit', 'cc-3rd-party', 'cc-flood',
  'cc-tax-service', 'cc-mers', 'cc-voe', 'cc-b-other',
  'cc-title-settlement', 'cc-title-doc-prep', 'cc-title-cpl',
  'cc-lenders-title', 'cc-title-other',
  'cc-recording', 'cc-transfer-tax',
  'cc-prepaid-interest', 'cc-prepaid-hoi',
  'cc-insurance-escrow', 'cc-tax-escrow',
  'cc-pest', 'cc-realtor-admin', 'cc-warranty', 'cc-owner-title',
  'cc-earnest', 'cc-seller-concession', 'cc-lender-credit'
];
var CC_CHECKBOX_IDS = ['cc-roll-costs', 'cc-finance-funding'];

function ccSaveState() {
  if (typeof currentLoanId === 'undefined' || !currentLoanId) return;
  var state = {};
  CC_FIELD_IDS.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) state[id] = el.value;
  });
  CC_CHECKBOX_IDS.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) state[id] = el.checked;
  });
  /* Track which sections are open */
  var openSections = [];
  document.querySelectorAll('.cc-sec-body.open').forEach(function(body) {
    openSections.push(body.id);
  });
  state._openSections = openSections;

  try {
    localStorage.setItem('cc_calc_' + currentLoanId, JSON.stringify(state));
  } catch(e) { /* ignore quota errors */ }
}

function ccRestoreState() {
  if (typeof currentLoanId === 'undefined' || !currentLoanId) return false;
  var raw;
  try {
    raw = localStorage.getItem('cc_calc_' + currentLoanId);
  } catch(e) { return false; }
  if (!raw) return false;

  var state;
  try { state = JSON.parse(raw); } catch(e) { return false; }

  CC_FIELD_IDS.forEach(function(id) {
    var el = document.getElementById(id);
    if (el && state[id] !== undefined) {
      el.value = state[id];
      if (el.classList.contains('currency-input') && el.type === 'text') {
        ccFormatInput(el);
      }
    }
  });
  CC_CHECKBOX_IDS.forEach(function(id) {
    var el = document.getElementById(id);
    if (el && state[id] !== undefined) el.checked = state[id];
  });

  /* Restore open/closed sections */
  if (state._openSections) {
    document.querySelectorAll('.cc-sec-body').forEach(function(body) {
      var isOpen = state._openSections.indexOf(body.id) !== -1;
      body.classList.toggle('open', isOpen);
    });
    document.querySelectorAll('.cc-sec-hdr i').forEach(function(icon) {
      var secId = icon.closest('.cc-sec-hdr').dataset.section;
      var bodyId = 'cc-sec-body-' + secId;
      var isOpen = state._openSections.indexOf(bodyId) !== -1;
      icon.classList.toggle('open', isOpen);
    });
  }

  return true;
}

/* Expose globals for onclick handlers */
window.showClosingCostsSidebar = showClosingCostsSidebar;
window.closeClosingCostsSidebar = closeClosingCostsSidebar;
window.ccHandlePurpose = ccHandlePurpose;
window.ccHandleLoanType = ccHandleLoanType;

console.log('Pipeline Closing Costs Calculator v1.0 loaded');

`;
  return new Response(jsContent, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      ...getCorsHeaders(request)
    }
  });
}



// ============================================================
// PIPELINE PAGE STATIC FILES (migrated from Webflow embeds)
// CSS, HTML template, and bootstrap JS — previously in 3 Webflow
// embeds (~49K each), now served from Cloudflare Worker.
// ============================================================

// PIPELINE CSS (migrated from Webflow embed Pipeline_Page_Embed_CSS_v12_4.css)
// Served as: GET /static/pipeline.css

async function getPipelineCSS(request) {
  const cssContent = `/* PIPELINE CSS v12.4 — Equity Loan subordinate financing section */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: #F8FAFC;
  color: #1E293B;
  line-height: 1.6;
}
.pipeline-container {
  max-width: calc(100% - 48px);
  margin: 0 auto;
  padding: 24px;
}
@media (min-width: 1800px) {
  .pipeline-container {
    max-width: calc(100% - 80px);
    padding: 24px 40px;
  }
}
@media (min-width: 2200px) {
  .pipeline-container {
    max-width: calc(100% - 120px);
    padding: 24px 60px;
  }
}
/* Header */
.pipeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  gap: 16px;
}
.pipeline-title {
  font-size: 24px;
  font-weight: 700;
  color: #0F172A;
}
.header-right {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: nowrap;
}
.view-toggle {
  display: flex;
  gap: 4px;
  background: white;
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.view-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #64748B;
  transition: all 0.2s;
}
.view-btn:hover {
  background: #F1F5F9;
  color: #334155;
}
.view-btn.active {
  background: #3B82F6;
  color: white;
}
.view-btn svg {
  width: 16px;
  height: 16px;
}
/* Stats Bar */
.stats-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}
.stat-card {
  background: white;
  padding: 12px 16px;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}
.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.stat-card.highlight {
  background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
  color: white;
}
.stat-value {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 2px;
}
.stat-label {
  font-size: 13px;
  opacity: 0.8;
}
/* Buttons */
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.btn-primary {
  background: #3B82F6;
  color: white;
}
.btn-primary:hover {
  background: #2563EB;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}
.btn-secondary {
  background: #E2E8F0;
  color: #475569;
}
.btn-secondary:hover {
  background: #CBD5E1;
}
.btn-danger {
  background: #EF4444;
  color: white;
}
.btn-danger:hover {
  background: #DC2626;
}
.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}
/* Loading & Empty States */
.loading, .empty-state {
  text-align: center;
  padding: 80px 20px;
}
.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #E2E8F0;
  border-top-color: #3B82F6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.empty-state h3 {
  font-size: 24px;
  margin: 16px 0 8px;
  color: #0F172A;
}
.empty-state p {
  color: #64748B;
  font-size: 16px;
}
.hidden {
  display: none !important;
}
/* Kanban Board */
.kanban-board {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding-bottom: 16px;
}
.kanban-column {
  min-width: 300px;
  background: #F1F5F9;
  border-radius: 12px;
  padding: 16px;
}
.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid #E2E8F0;
}
.column-title {
  font-weight: 600;
  font-size: 14px;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.column-count {
  background: white;
  color: #64748B;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 12px;
}
.kanban-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 100px;
}
.loan-card {
  background: white;
  padding: 16px;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  cursor: pointer;
  transition: all 0.2s;
}
.loan-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.loan-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}
.loan-borrower {
  font-size: 16px;
  font-weight: 600;
  color: #0F172A;
  margin: 0;
}
.loan-amount {
  font-size: 14px;
  font-weight: 700;
  color: #3B82F6;
}
.loan-property {
  font-size: 14px;
  color: #64748B;
  margin-bottom: 12px;
}
.loan-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}
.loan-type {
  background: #F1F5F9;
  color: #475569;
  padding: 4px 8px;
  border-radius: 6px;
  font-weight: 500;
}
.loan-close-date {
  font-weight: 500;
  color: #64748B;
}
.loan-close-date.soon {
  color: #F59E0B;
  font-weight: 600;
}
.loan-close-date.overdue {
  color: #EF4444;
  font-weight: 600;
}
/* Table View */
.table-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  overflow: visible;
}
.table-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #E2E8F0;
  gap: 12px;
  flex-wrap: nowrap;
  position: relative;
  z-index: 10;
}
.search-box {
  position: relative;
  flex: 1;
  min-width: 250px;
  max-width: 400px;
}
.search-box svg {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
}
.search-box input {
  width: 100%;
  padding: 10px 12px 10px 40px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.2s;
}
.search-box input:focus {
  outline: none;
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
/* Search + Status toggle row */
.search-and-status {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}
/* Status toggle buttons */
.status-toggle {
  display: flex;
  gap: 0;
  background: #F1F5F9;
  border-radius: 8px;
  padding: 3px;
  flex-shrink: 0;
}
.status-btn {
  padding: 7px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  background: transparent;
  color: #64748B;
  transition: all 0.2s;
  white-space: nowrap;
}
.status-btn:hover {
  color: #334155;
  background: #E2E8F0;
}
.status-btn.active[data-status="All"] { background: #475569; color: white; }
.status-btn.active[data-status="Leads"] { background: #8B5CF6; color: white; }
.status-btn.active[data-status="Active"] { background: #3B82F6; color: white; }
.status-btn.active[data-status="Won"] { background: #16A34A; color: white; }
.status-btn.active[data-status="Lost"] { background: #DC2626; color: white; }
.filter-group {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: nowrap;
  flex-direction: row;
}
.filter-select {
  padding: 8px 10px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 13px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  min-width: 0;
}
.filter-select:focus {
  outline: none;
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
/* Column Selector */
.column-selector { position: relative; }
.column-selector-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 14px; background: white; border: 1px solid #E2E8F0;
  border-radius: 8px; font-size: 14px; font-weight: 500;
  color: #475569; cursor: pointer; transition: all 0.2s;
}
.column-selector-btn:hover { background: #F8FAFC; border-color: #CBD5E1; }
.column-selector-dropdown {
  position: absolute; top: calc(100% + 4px); right: 0;
  background: white; border: 1px solid #E2E8F0; border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.15); padding: 8px;
  min-width: 240px; max-height: 500px; overflow-y: auto;
  z-index: 1000; display: none;
}
.column-selector-dropdown.open { display: block; }
.column-selector-header {
  padding: 8px 12px; font-size: 12px; font-weight: 600; color: #64748B;
  text-transform: uppercase; letter-spacing: 0.5px;
  border-bottom: 1px solid #E2E8F0; margin-bottom: 4px;
}
.column-option {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-radius: 6px; cursor: pointer;
  transition: background 0.15s; user-select: none;
}
.column-option:hover { background: #F8FAFC; }
.col-drag-handle {
  cursor: grab; color: #CBD5E1; font-size: 12px;
  padding: 2px; line-height: 1; flex-shrink: 0; transition: color 0.15s;
}
.col-drag-handle:hover { color: #94A3B8; }
.col-drag-handle:active { cursor: grabbing; }
.column-option.dragging { opacity: 0.4; background: #EFF6FF; }
.column-option.drag-over { border-top: 2px solid #3B82F6; padding-top: 6px; }
.column-option input[type="checkbox"] { cursor: pointer; flex-shrink: 0; }
.column-option label { cursor: pointer; flex: 1; font-size: 14px; color: #334155; }
/* Pipeline Table */
.pipeline-table { width: 100%; border-collapse: collapse; }
.pipeline-table thead { background: #F8FAFC; border-bottom: 2px solid #E2E8F0; }
.pipeline-table th {
  padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600;
  color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap;
}
.pipeline-table th[data-column] { user-select: none; }
.pipeline-table th.sort-asc::after { content: ' \\2191'; color: #3B82F6; }
.pipeline-table th.sort-desc::after { content: ' \\2193'; color: #3B82F6; }
.pipeline-table tbody tr {
  border-bottom: 1px solid #E2E8F0; cursor: pointer; transition: background 0.2s;
}
.pipeline-table tbody tr:hover { background: #F8FAFC; }
.pipeline-table td { padding: 14px 16px; font-size: 14px; color: #334155; }
/* Summary Row */
.summary-row { background: #F1F5F9 !important; border-top: 2px solid #CBD5E1; cursor: default !important; }
.summary-row:hover { background: #F1F5F9 !important; }
.summary-row td { font-weight: 600; color: #1E40AF; }
/* Stage Badges */
.stage-badge {
  display: inline-block; padding: 4px 12px; border-radius: 12px;
  font-size: 12px; font-weight: 600; white-space: nowrap;
}
.stage-badge.lead { background: #DBEAFE; color: #1E40AF; }
.stage-badge.application { background: #E0E7FF; color: #3730A3; }
.stage-badge.prequal { background: #DDD6FE; color: #5B21B6; }
.stage-badge.shopping { background: #FCE7F3; color: #9F1239; }
.stage-badge.contract { background: #FBCFE8; color: #BE185D; }
.stage-badge.quotes { background: #FED7AA; color: #C2410C; }
.stage-badge.disclosure { background: #FEF3C7; color: #92400E; }
.stage-badge.processing { background: #FEF08A; color: #713F12; }
.stage-badge.underwriting { background: #D9F99D; color: #3F6212; }
.stage-badge.conditional { background: #BBF7D0; color: #14532D; }
.stage-badge.resubmittal { background: #A7F3D0; color: #065F46; }
.stage-badge.ctc { background: #99F6E4; color: #115E59; }
.stage-badge.closing { background: #A5F3FC; color: #155E75; }
.stage-badge.closed { background: #D1D5DB; color: #374151; }
/* Deal Status Badges (Won/Lost) for table rows */
.deal-status-badge {
  display: inline-block; padding: 3px 10px; border-radius: 10px;
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.5px; margin-left: 8px;
}
.deal-status-badge.won { background: #DCFCE7; color: #15803D; }
.deal-status-badge.lost { background: #FEE2E2; color: #DC2626; }
/* Deal Status Bar in Modal */
.deal-status-bar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; padding: 12px 32px; background: #F8FAFC;
  border-bottom: 1px solid #E2E8F0;
}
.deal-status-left { display: flex; align-items: center; gap: 10px; }
.deal-status-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.deal-status-field-label { font-size: 13px; font-weight: 600; color: #64748B; white-space: nowrap; }
.deal-status-date { padding: 6px 10px !important; font-size: 13px !important; width: 150px; }
.deal-status-bar .status-label { font-size: 13px; font-weight: 600; color: #64748B; margin-right: 4px; }
.deal-status-btn {
  padding: 8px 18px; border: 2px solid transparent; border-radius: 8px;
  font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.2s;
  display: inline-flex; align-items: center; gap: 6px;
}
.deal-status-btn.won-btn { background: #F0FDF4; color: #15803D; border-color: #86EFAC; }
.deal-status-btn.won-btn:hover { background: #DCFCE7; border-color: #4ADE80; }
.deal-status-btn.won-btn.active { background: #15803D; color: white; border-color: #15803D; }
.deal-status-btn.lost-btn { background: #FEF2F2; color: #DC2626; border-color: #FCA5A5; }
.deal-status-btn.lost-btn:hover { background: #FEE2E2; border-color: #F87171; }
.deal-status-btn.lost-btn.active { background: #DC2626; color: white; border-color: #DC2626; }
.deal-status-btn.reopen-btn { background: #EFF6FF; color: #2563EB; border-color: #93C5FD; }
.deal-status-btn.reopen-btn:hover { background: #DBEAFE; border-color: #60A5FA; }
.deal-status-banner { padding: 4px 10px; border-radius: 5px; font-size: 12px; font-weight: 600; }
.won-banner { background: #DCFCE7; color: #166534; }
.lost-banner { background: #FEE2E2; color: #991B1B; }
/* Lost Deals Section */
.lost-deals-section { margin-top: 32px; }
.lost-deals-header {
  display: flex; justify-content: space-between; align-items: center;
  cursor: pointer; padding: 16px 20px; background: white;
  border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  transition: all 0.2s; user-select: none;
}
.lost-deals-header:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.12); }
.lost-deals-header-left { display: flex; align-items: center; gap: 12px; }
.lost-deals-header-left h2 { font-size: 20px; font-weight: 700; color: #0F172A; margin: 0; }
.lost-deals-count { background: #FEE2E2; color: #DC2626; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 600; }
.lost-deals-toggle-icon { font-size: 20px; color: #64748B; transition: transform 0.3s; }
.lost-deals-toggle-icon.expanded { transform: rotate(180deg); }
.lost-deals-body { margin-top: 12px; background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
.lost-deals-body .pipeline-table thead { background: #FFF5F5; }
.lost-deals-body .pipeline-table tbody tr { opacity: 0.85; }
.lost-deals-body .pipeline-table tbody tr:hover { opacity: 1; background: #FFFBFB; }
/* MODAL — v10.0 3-PANEL LAYOUT — Left nav | Scrollable content | Right calculator panel */
.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: #E8ECF2;
  display: flex; flex-direction: column;
  z-index: 10000; overflow: hidden;
}
.modal-content {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  overflow: hidden;
}
/* ---- Header bar ---- */
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 24px; background: #FFFFFF;
  border-bottom: 1px solid #E2E8F0;
  position: sticky; top: 0; z-index: 10;
  min-height: 50px; gap: 10px;
}
.modal-nav-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
.modal-nav-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.back-to-pipeline-btn {
  display: inline-flex; align-items: center; gap: 5px;
  background: none; border: 1px solid #E2E8F0; border-radius: 6px;
  padding: 5px 10px; font-size: 13px; font-weight: 500; color: #64748B;
  cursor: pointer; transition: all 0.15s; white-space: nowrap;
}
.back-to-pipeline-btn:hover { background: #F1F5F9; color: #1E293B; }
.modal-header h2 { font-size: 17px; font-weight: 700; color: #0F172A; margin: 0; white-space: nowrap; }
.header-borrower-names {
  display: flex; align-items: center; gap: 6px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.header-borrower-names.hidden { display: none; }
.hbn-sep { color: #CBD5E1; font-size: 14px; }
.hbn-primary { font-size: 14px; font-weight: 600; color: #334155; }
.hbn-amp { font-size: 12px; color: #94A3B8; }
.hbn-amp.hidden { display: none; }
.hbn-secondary { font-size: 13px; font-weight: 500; color: #64748B; }
/* ---- Deal Status Bar ---- */
.deal-status-bar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 24px; border-bottom: 1px solid #E2E8F0;
  background: #FFFBEB; gap: 12px;
}
.deal-status-bar.hidden { display: none; }
.deal-status-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.deal-status-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.status-label { font-size: 11px; font-weight: 700; color: #92400E; text-transform: uppercase; letter-spacing: 0.5px; }
.deal-status-btn {
  padding: 4px 10px; border-radius: 5px; font-size: 12px; font-weight: 600;
  cursor: pointer; border: 1px solid; transition: all 0.15s;
}
.won-btn { background: #F0FDF4; color: #166534; border-color: #86EFAC; }
.won-btn:hover { background: #DCFCE7; }
.lost-btn { background: #FEF2F2; color: #991B1B; border-color: #FCA5A5; }
.lost-btn:hover { background: #FEE2E2; }
.reopen-btn { background: #EFF6FF; color: #1E40AF; border-color: #93C5FD; }
.reopen-btn:hover { background: #DBEAFE; }
.deal-status-banner { padding: 4px 10px; border-radius: 5px; font-size: 12px; font-weight: 600; }
.won-banner { background: #DCFCE7; color: #166534; }
.lost-banner { background: #FEE2E2; color: #991B1B; }
.deal-status-field-label { font-size: 11px; font-weight: 600; color: #92400E; white-space: nowrap; }
.deal-status-date { padding: 4px 8px !important; font-size: 12px !important; max-width: 140px; }
/* 3-PANEL BODY WRAPPER — Left nav sidebar | Scrollable main | Right calc panel */
.modal-body-wrapper {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}
/* ---- LEFT NAVIGATION SIDEBAR ----
   v11.5: font bumped 12→14px, icons 12→14px, width 150→160px
   to match app sidebar link sizing
   ---- */
.modal-nav-sidebar {
  width: 160px;
  flex-shrink: 0;
  background: #FFFFFF;
  border-right: 1px solid #E2E8F0;
  overflow-y: auto;
  padding: 12px 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
/* Navigation items — v11.5: 14px text to match sidebar */
.mnav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  font-size: 14px;
  font-weight: 600;
  color: #64748B;
  cursor: pointer;
  transition: all 0.15s;
  text-decoration: none;
  border-left: 3px solid transparent;
  white-space: nowrap;
}
.mnav-item:hover {
  color: #334155;
  background: #F8FAFC;
}
.mnav-item.active {
  color: #2563EB;
  background: #EFF6FF;
  border-left-color: #2563EB;
}
.mnav-item i {
  font-size: 14px;
  width: 18px;
  text-align: center;
  flex-shrink: 0;
}
/* ---- MAIN SCROLLABLE CONTENT ---- */
.modal-main-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px 28px;
  background: #E8ECF2;
  scroll-behavior: smooth;
}
/* ---- FOOTER ---- */
.modal-footer {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 24px; border-top: 1px solid #E2E8F0;
  background: #FFFFFF; position: sticky; bottom: 0; z-index: 10;
}
.modal-footer-right {
  display: flex; gap: 8px; align-items: center; margin-left: auto;
}
/* LINKS SECTION — URL inputs with Open buttons */
.link-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}
.link-label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
/* v12.0: Favicon shown next to link labels when URL has data */
.link-favicon {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  flex-shrink: 0;
  vertical-align: middle;
}
.link-favicon.hidden {
  display: none;
}
/* v12.0: Wrapper for custom link name + favicon */
.link-name-row {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.link-input-wrap {
  display: flex;
  gap: 8px;
  align-items: center;
}
.link-url-input {
  flex: 1;
  min-width: 0;
}
.link-name-input {
  font-weight: 600 !important;
  color: #374151 !important;
  border: 1px dashed #d1d5db !important;
  background: #f9fafb !important;
  max-width: 220px;
}
.link-name-input:focus {
  border-style: solid !important;
  background: #fff !important;
}
.link-open-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  background: #2563EB;
  color: #fff !important;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.15s ease;
  flex-shrink: 0;
}
.link-open-btn:hover {
  background: #1D4ED8;
  text-decoration: none;
  color: #fff;
}
.link-open-btn.hidden {
  display: none;
}
.link-divider {
  border-top: 1px dashed #E2E8F0;
  margin: 8px 0 16px;
}
/* RIGHT CALCULATOR PANEL — v11.5: header & button font bumped to 13px, added Coming Soon styles */
.modal-calc-panel {
  width: 190px;
  flex-shrink: 0;
  background: #FFFFFF;
  border-left: 1px solid #E2E8F0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.calc-panel-header {
  padding: 14px 16px;
  font-size: 13px;
  font-weight: 700;
  color: #1E293B;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  border-bottom: 1px solid #E2E8F0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.calc-panel-header i {
  color: #3B82F6;
  font-size: 13px;
}
.calc-panel-list {
  padding: 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}
.calc-panel-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  background: #F8FAFC;
  cursor: pointer;
  transition: all 0.15s;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  position: relative;
  flex-wrap: wrap;
}
.calc-panel-btn i {
  font-size: 14px;
  color: #3B82F6;
  width: 18px;
  text-align: center;
  flex-shrink: 0;
}
.calc-panel-btn:hover {
  border-color: #3B82F6;
  background: #EFF6FF;
  box-shadow: 0 2px 4px rgba(59,130,246,0.1);
}
/* Coming Soon badge inside calc buttons — v11.5 */
.calc-coming-soon {
  display: block;
  width: 100%;
  font-size: 9px;
  font-weight: 700;
  color: #F59E0B;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: -2px;
  padding-left: 28px;
}
/* Disabled-look for Coming Soon calculator buttons */
.calc-panel-btn.disabled {
  opacity: 0.65;
  cursor: default;
}
.calc-panel-btn.disabled:hover {
  border-color: #E2E8F0;
  background: #F8FAFC;
  box-shadow: none;
}
/* SECTION PAGES — v11.8 full-page section layout — Each nav item shows its own page instead of scrolling */
.section-pages {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  align-items: start;
  margin-bottom: 16px;
  min-height: 200px;
}
/* Base class for all section cards in the pages container */
.section-card {
  transition: opacity 0.15s ease;
}
/* Hidden section cards (not on the current page) */
.section-hidden {
  display: none !important;
}
/* Full-width single-section page — centered with max-width */
.section-card.section-full {
  grid-column: span 2;
  max-width: 700px;
  justify-self: center;
  width: 100%;
}
/* Legacy card-columns kept for any non-modal usage */
.card-columns {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  align-items: start;
  margin-bottom: 16px;
}
.card-col { display: flex; flex-direction: column; gap: 16px; }
/* Full-width row for cards that span all columns */
.card-full-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  margin-bottom: 16px;
}
/* CARDS — section header bands match Lender/Vendor Detail pages */
.card {
  background: #FFFFFF;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  padding: 16px 18px;
  border: 1px solid #E2E8F0;
  scroll-margin-top: 16px;
  overflow: hidden;
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}
/* v11.8: .card.section-active removed — replaced by section-pages layout */
.card-title {
  font-size: 13px; font-weight: 800; color: #1E3A8A;
  /* Negative margins pull the header band edge-to-edge over the card padding */
  margin: -16px -18px 12px -18px;
  padding: 11px 18px;
  text-transform: uppercase;
  letter-spacing: 0.01em;
  display: flex; align-items: center; gap: 9px;
  /* Blue-tinted header band — matches .ld-section-header / .vd-section-header */
  background: #EFF6FF;
  border-bottom: 1px solid #BFDBFE;
}
.card-title i { font-size: 13px; color: #2563EB; }
/* CARD FIELD GRID — 2 cols inside each card */
.cg {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
}
.cg:not(:last-child) { margin-bottom: 8px; }
.cg .sp2 { grid-column: span 2; }
/* FORM FIELDS */
.ff { display: flex; flex-direction: column; min-width: 0; }
.ff label {
  font-size: 11px; font-weight: 600; color: #64748B;
  margin-bottom: 3px; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
.fc, .form-control {
  padding: 7px 10px; border: 1px solid #E2E8F0; border-radius: 6px;
  font-size: 14px; background: #F8FAFC; color: #1E293B;
  width: 100%; box-sizing: border-box; transition: all 0.15s;
}
.fc:focus, .form-control:focus {
  outline: none; border-color: #3B82F6;
  background: #FFFFFF;
  box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
}
.fc::placeholder, .form-control::placeholder { color: #CBD5E1; }
select.fc, select.form-control { appearance: auto; cursor: pointer; background: #F8FAFC; }
select.fc:focus, select.form-control:focus { background: #FFFFFF; }
textarea.fc, textarea.form-control { min-height: 70px; resize: vertical; font-family: inherit; }
.rate-input { text-align: right; }
/* CO-BORROWER TOGGLE */
.cb-toggle {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 10px; padding-top: 10px;
  border-top: 1px dashed #E2E8F0;
  cursor: pointer; user-select: none;
}
.cb-toggle:hover .cb-toggle-icon { background: #E2E8F0; }
.cb-toggle-label {
  font-size: 12px; font-weight: 700; color: #94A3B8;
  text-transform: uppercase; letter-spacing: 0.4px;
}
.cb-toggle-icon {
  font-size: 14px; color: #94A3B8; width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 4px; transition: all 0.15s;
}
.cb-body { transition: max-height 0.3s ease, opacity 0.2s ease; overflow: hidden; }
.cb-body.collapsed { max-height: 0 !important; opacity: 0; }
.cb-body.expanded { max-height: 500px; opacity: 1; padding-top: 8px; }
/* PAYMENT TABLE */
.pt { width: 100%; border-collapse: collapse; margin-top: 4px; }
.pt th {
  font-size: 10px; font-weight: 700; color: #94A3B8; text-transform: uppercase;
  letter-spacing: 0.4px; padding: 6px 0; text-align: left;
  border-bottom: 1px solid #E2E8F0;
}
.pt th:last-child { text-align: right; }
.pt td { padding: 8px 0; border-bottom: 1px solid #F1F5F9; vertical-align: middle; }
.pt-lbl { font-size: 13px; font-weight: 500; color: #334155; white-space: nowrap; }
.pt-hint { font-size: 10px; color: #94A3B8; font-weight: 400; }
.pt-inp { text-align: center; }
.pt-inp .fc { max-width: 130px; padding: 5px 8px; font-size: 13px; display: inline-block; text-align: right; }
.pt-auto { font-size: 11px; color: #94A3B8; font-style: italic; }
.pt-mo { text-align: right; }
.pt-val { font-size: 14px; font-weight: 700; color: #1E293B; font-variant-numeric: tabular-nums; }
.pt-cmp { font-weight: 600; color: #475569; font-size: 13px; }
.pt-foot td {
  padding: 10px 0; border-top: 2px solid #86EFAC;
  border-bottom: none; background: transparent;
}
.pt-tot-lbl { font-size: 14px; font-weight: 700; color: #166534; }
.pt-tot-val { font-size: 18px; font-weight: 800; color: #166534; text-align: right; }
/* MISC */
.comp-sync-indicator { font-size: 10px; color: #94A3B8; margin-top: 1px; }
.task-item { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px solid #F1F5F9; font-size: 13px; }
.task-item.completed .task-name { text-decoration: line-through; color: #94A3B8; }
.task-name { flex: 1; }
.task-due { font-size: 11px; color: #94A3B8; }
.add-task-row { display: flex; gap: 8px; margin-top: 6px; }
.add-task-row .fc { font-size: 13px; padding: 5px 8px; }
/* ---- Buttons (modal-scoped overrides) ---- */
.btn { padding: 6px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; transition: all 0.15s; }
.btn-primary { background: #2563EB; color: white; }
.btn-primary:hover { background: #1D4ED8; }
.btn-secondary { background: #F1F5F9; color: #475569; border: 1px solid #E2E8F0; }
.btn-secondary:hover { background: #E2E8F0; }
.btn-danger { background: #DC2626; color: white; }
.btn-danger:hover { background: #B91C1C; }
.btn-sm { padding: 4px 8px; font-size: 12px; }
/* ---- Lost reason ---- */
.lost-reason-content {
  background: white; border-radius: 12px; padding: 24px; max-width: 440px;
  width: 90%; margin: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.15);
}
.lost-reason-content h3 { margin: 0 0 12px; font-size: 17px; color: #0F172A; }
.lost-reason-content textarea { margin-bottom: 14px; }
.lost-reason-actions { display: flex; justify-content: flex-end; gap: 8px; }
/* RESPONSIVE */
/* Medium screens: hide left nav text, show icons only */
@media (max-width: 1200px) {
  .modal-nav-sidebar { width: 52px; }
  .mnav-item span { display: none; }
  .mnav-item { padding: 10px 0; justify-content: center; }
  .mnav-item i { font-size: 14px; }
  .modal-calc-panel { width: 160px; }
}
/* Small screens: hide both panels, single column cards */
@media (max-width: 900px) {
  .modal-nav-sidebar { display: none; }
  .modal-calc-panel { display: none; }
  .card-columns { grid-template-columns: 1fr; }
  .section-pages { grid-template-columns: 1fr; }
  .section-card.section-full { grid-column: span 1; max-width: none; }
  .modal-main-scroll { padding: 12px; }
  .modal-header, .modal-footer, .deal-status-bar { padding-left: 12px; padding-right: 12px; }
  .deal-status-bar { flex-direction: column; align-items: flex-start; gap: 6px; }
  .header-borrower-names { display: none !important; }
  .cg { grid-template-columns: 1fr; }
  .cg .sp2 { grid-column: span 1; }
  .card { padding: 14px 14px; }
  .card-title { margin: -14px -14px 12px -14px; padding: 11px 14px; }
}
/* CHECKLIST NAV ITEM — divider + badge */
.mnav-divider {
  height: 1px;
  background: #E2E8F0;
  margin: 8px 16px;
}
.mnav-checklist-btn {
  position: relative;
}
.checklist-badge {
  font-size: 9px;
  font-weight: 700;
  background: #DBEAFE;
  color: #2563EB;
  padding: 1px 6px;
  border-radius: 6px;
  margin-left: auto;
  white-space: nowrap;
}
/* AFFORDABILITY CALCULATOR — OVERLAY MODE */
.calc-sidebar {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 10050;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(4px);
  transition: opacity 0.3s ease, visibility 0.3s ease;
  opacity: 0;
  visibility: hidden;
}
.calc-sidebar.hidden { display: none; }
.calc-sidebar.open { opacity: 1; visibility: visible; }
.calc-sidebar-card {
  background: #FFFFFF;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
  width: 960px;
  max-width: 94vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.calc-sidebar-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 24px;
  background: linear-gradient(135deg, #1E40AF, #2563EB);
  flex-shrink: 0;
}
.calc-sidebar-header h3 {
  font-size: 16px; font-weight: 700; color: #FFFFFF; margin: 0;
  display: flex; align-items: center; gap: 8px;
}
.calc-sidebar-header h3 i { font-size: 15px; }
.close-calc-sidebar {
  font-size: 28px; cursor: pointer; color: rgba(255,255,255,0.7);
  line-height: 1; padding: 0 4px; transition: color 0.15s;
}
.close-calc-sidebar:hover { color: #FFFFFF; }
.calc-sidebar-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
/* ---- Section containers inside the overlay ---- */
.calc-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 16px;
}
.calc-section-title {
  grid-column: span 2;
  font-size: 12px; font-weight: 800; color: #1E3A8A;
  text-transform: uppercase; letter-spacing: 0.05em;
  padding-bottom: 6px; margin-bottom: 4px;
  border-bottom: 2px solid #DBEAFE;
  display: flex; align-items: center; gap: 8px;
}
.calc-section-title i { font-size: 13px; color: #3B82F6; }
/* ---- Input rows ---- */
.calc-row { display: flex; flex-direction: column; gap: 3px; }
.calc-row.span-2 { grid-column: span 2; }
.calc-row label { font-size: 11px; font-weight: 600; color: #64748B; }
.calc-row input, .calc-row select {
  padding: 7px 10px; border: 1px solid #E2E8F0; border-radius: 6px;
  font-size: 14px; background: #F8FAFC; color: #1E293B;
  width: 100%; box-sizing: border-box; transition: all 0.15s;
}
.calc-row input:focus, .calc-row select:focus {
  outline: none; border-color: #3B82F6; background: #FFFFFF;
  box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
}
/* ---- Results section ---- */
.calc-results-area {
  background: #F0FDF4;
  border: 1px solid #86EFAC;
  border-radius: 10px;
  padding: 16px 20px;
}
.calc-results-area h4 {
  font-size: 12px; font-weight: 800; color: #166534;
  text-transform: uppercase; letter-spacing: 0.05em;
  margin: 0 0 12px; display: flex; align-items: center; gap: 8px;
}
.calc-results-area h4 i { font-size: 13px; }
.calc-result-grid {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.calc-result-col {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cr-row { display: flex; justify-content: space-between; align-items: center; }
.cr-lbl { font-size: 13px; color: #334155; font-weight: 500; }
.cr-val { font-size: 14px; color: #0F172A; font-weight: 700; font-variant-numeric: tabular-nums; }
.cr-sep { height: 1px; background: #BBF7D0; margin: 4px 0; }
.cr-big { font-size: 22px; font-weight: 800; color: #15803D; }
/* ---- DTI Summary ---- */
.calc-dti-summary {
  background: #EFF6FF;
  border: 1px solid #BFDBFE;
  border-radius: 8px;
  padding: 12px 16px;
  margin-top: 4px;
}
.calc-dti-summary h5 {
  font-size: 11px; font-weight: 700; color: #1E40AF;
  text-transform: uppercase; margin: 0 0 8px;
}
.calc-dti-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 4px 0;
}
.calc-dti-row:not(:last-child) { border-bottom: 1px solid #DBEAFE; }
.calc-dti-label { font-size: 12px; color: #334155; font-weight: 500; }
.calc-dti-value { font-size: 13px; color: #1E40AF; font-weight: 700; }
/* ---- Toggle buttons (Annual/Monthly etc.) ---- */
.calc-toggle-group { display: flex; gap: 0; }
.calc-toggle-btn {
  padding: 4px 10px; border: 1px solid #E2E8F0; background: #F8FAFC;
  font-size: 10px; font-weight: 600; color: #64748B; cursor: pointer;
  transition: all 0.15s;
}
.calc-toggle-btn:first-child { border-radius: 5px 0 0 5px; }
.calc-toggle-btn:last-child { border-radius: 0 5px 5px 0; }
.calc-toggle-btn.active { background: #2563EB; color: white; border-color: #2563EB; }
/* CHECKLIST PANEL — Centered overlay like Affordability */
.checklist-panel {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  z-index: 10010;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.25s ease, visibility 0.25s ease;
  width: auto;
  height: auto;
  background: transparent;
  box-shadow: none;
  transform: none;
  overflow: visible;
}
.checklist-panel.open {
  opacity: 1;
  visibility: visible;
  display: flex;
}
.checklist-panel.hidden {
  display: none !important;
}
/* ---- Card width for all 3 sections ---- */
.checklist-panel > .checklist-panel-header,
.checklist-panel > .checklist-panel-body,
.checklist-panel > .checklist-panel-footer {
  background: white;
  position: relative;
  z-index: 1;
  width: 620px;
  max-width: 94vw;
}
/* ---- Header ---- */
.checklist-panel > .checklist-panel-header {
  border-radius: 16px 16px 0 0;
  flex-shrink: 0;
  box-shadow: 0 -2px 20px rgba(0,0,0,0.06);
}
.checklist-panel-header {
  padding: 16px 24px;
  border-bottom: 1px solid #E2E8F0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #F8FAFC;
  flex-shrink: 0;
}
.checklist-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.checklist-header-left i {
  color: #2563EB;
  font-size: 16px;
}
.checklist-header-left h3 {
  font-size: 16px;
  font-weight: 700;
  color: #1E293B;
  margin: 0;
}
.checklist-progress-pill {
  font-size: 11px;
  font-weight: 600;
  color: #2563EB;
  background: #DBEAFE;
  border-radius: 10px;
  padding: 2px 10px;
}
.checklist-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.checklist-collapse-btn,
.checklist-expand-btn {
  background: none;
  border: 1px solid #E2E8F0;
  border-radius: 6px;
  padding: 4px 8px;
  cursor: pointer;
  color: #64748B;
  font-size: 12px;
  transition: all 0.15s;
}
.checklist-collapse-btn:hover,
.checklist-expand-btn:hover {
  background: #F1F5F9;
  color: #334155;
}
.close-checklist-panel {
  font-size: 26px;
  font-weight: 300;
  color: #94A3B8;
  cursor: pointer;
  line-height: 1;
  padding: 0 4px;
  transition: color 0.15s;
}
.close-checklist-panel:hover {
  color: #334155;
}
/* ---- Body (scrollable) ---- */
.checklist-panel > .checklist-panel-body {
  flex-shrink: 1;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: calc(85vh - 160px);
}
.checklist-panel-body {
  padding: 0;
}
.checklist-loading {
  padding: 40px;
  text-align: center;
  color: #94A3B8;
  font-size: 14px;
}
/* ---- Footer ---- */
.checklist-panel > .checklist-panel-footer {
  border-radius: 0 0 16px 16px;
  flex-shrink: 0;
  box-shadow: 0 4px 24px rgba(0,0,0,0.10);
}
.checklist-panel-footer {
  padding: 12px 24px;
  border-top: 1px solid #E2E8F0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: #FFFFFF;
}
/* ---- Progress bar ---- */
.checklist-progress-bar {
  flex: 1;
  height: 6px;
  background: #E2E8F0;
  border-radius: 3px;
  overflow: hidden;
}
.checklist-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3B82F6, #2563EB);
  border-radius: 3px;
  transition: width 0.3s ease;
}
.checklist-auto-save-status {
  font-size: 11px;
  color: #94A3B8;
  white-space: nowrap;
}
.checklist-auto-save-status.saving {
  color: #F59E0B;
}
.checklist-auto-save-status.saved {
  color: #22C55E;
}
.checklist-auto-save-status.error {
  color: #EF4444;
}
/* CHECKLIST GROUPS & ITEMS */
/* ---- Group container ---- */
.cl-group {
  border-bottom: 1px solid #F1F5F9;
}
.cl-group:last-child {
  border-bottom: none;
}
/* ---- Group header (clickable to collapse) ---- */
.cl-group-header {
  display: flex;
  align-items: center;
  padding: 12px 24px;
  cursor: pointer;
  gap: 10px;
  background: #FAFBFC;
  border-bottom: 1px solid #F1F5F9;
  transition: background 0.15s;
  user-select: none;
}
.cl-group-header:hover {
  background: #F1F5F9;
}
.cl-group-chevron {
  font-size: 10px;
  color: #94A3B8;
  transition: transform 0.2s ease;
  width: 14px;
  text-align: center;
  flex-shrink: 0;
}
.cl-group.collapsed .cl-group-chevron {
  transform: rotate(-90deg);
}
.cl-group-icon {
  font-size: 13px;
  width: 16px;
  text-align: center;
  flex-shrink: 0;
}
.cl-group-name {
  font-size: 12px;
  font-weight: 700;
  color: #334155;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  flex: 1;
}
.cl-group-count {
  font-size: 11px;
  font-weight: 600;
  color: #94A3B8;
  background: #F1F5F9;
  border-radius: 8px;
  padding: 1px 8px;
}
.cl-group-count.complete {
  background: #DCFCE7;
  color: #15803D;
}
/* ---- Group items container ---- */
.cl-group-items {
  max-height: 2000px;
  overflow: hidden;
  transition: max-height 0.3s ease, opacity 0.2s ease;
  opacity: 1;
}
.cl-group.collapsed .cl-group-items {
  max-height: 0;
  opacity: 0;
}
/* ---- Individual checklist item ---- */
.cl-item {
  display: flex;
  align-items: center;
  padding: 10px 24px 10px 50px;
  gap: 10px;
  border-bottom: 1px solid #F8FAFC;
  transition: background 0.1s;
}
.cl-item:hover {
  background: #F8FAFC;
}
.cl-item:last-child {
  border-bottom: none;
}
/* ---- Custom checkbox ---- */
.cl-checkbox {
  position: relative;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}
.cl-checkbox input[type="checkbox"] {
  position: absolute;
  opacity: 0;
  width: 20px;
  height: 20px;
  cursor: pointer;
  z-index: 2;
  margin: 0;
}
.cl-checkbox .cl-checkmark {
  position: absolute;
  top: 0; left: 0;
  width: 20px;
  height: 20px;
  background: #FFFFFF;
  border: 2px solid #CBD5E1;
  border-radius: 4px;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cl-checkbox .cl-checkmark::after {
  content: '';
  display: none;
  width: 5px;
  height: 10px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
  margin-top: -2px;
}
.cl-checkbox input:checked + .cl-checkmark {
  background: #2563EB;
  border-color: #2563EB;
}
.cl-checkbox input:checked + .cl-checkmark::after {
  display: block;
}
.cl-checkbox input:hover + .cl-checkmark {
  border-color: #93C5FD;
}
/* ---- Item label ---- */
.cl-label {
  flex: 1;
  font-size: 13px;
  color: #334155;
  cursor: pointer;
  line-height: 1.3;
}
.cl-item.checked .cl-label {
  color: #94A3B8;
  text-decoration: line-through;
  text-decoration-color: #CBD5E1;
}
/* ---- Item date input ---- */
.cl-date {
  width: 120px;
  flex-shrink: 0;
  font-size: 11px;
  padding: 4px 8px;
  border: 1px solid #E2E8F0;
  border-radius: 6px;
  color: #475569;
  background: #FFFFFF;
  outline: none;
  transition: border-color 0.15s;
}
.cl-date:focus {
  border-color: #93C5FD;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}
.cl-date::-webkit-calendar-picker-indicator {
  opacity: 0.5;
  cursor: pointer;
}
.cl-item.checked .cl-date {
  color: #94A3B8;
  background: #F8FAFC;
}
/* ---- N/A button ---- */
.cl-na-btn {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border: 1px solid #E2E8F0;
  border-radius: 4px;
  background: #FFFFFF;
  color: #94A3B8;
  cursor: pointer;
  transition: all 0.15s ease;
  line-height: 1.3;
}
.cl-na-btn:hover {
  border-color: #CBD5E1;
  color: #64748B;
  background: #F8FAFC;
}
.cl-na-btn.active {
  background: #FEF3C7;
  border-color: #F59E0B;
  color: #92400E;
}
.cl-na-btn.active:hover {
  background: #FDE68A;
}
/* ---- N/A item state ---- */
.cl-item.na {
  background: #FAFAFA;
}
.cl-item.na .cl-label {
  color: #94A3B8;
  font-style: italic;
  text-decoration: line-through;
  text-decoration-color: #CBD5E1;
}
.cl-item.na .cl-checkmark {
  background: #F1F5F9;
  border-color: #E2E8F0;
}
.cl-item.na .cl-drag-handle {
  color: #E2E8F0;
}
/* ---- N/A badge ---- */
.cl-na-badge {
  display: inline-block;
  font-size: 9px;
  font-weight: 700;
  font-style: normal;
  padding: 1px 5px;
  margin-left: 6px;
  border-radius: 3px;
  background: #FEF3C7;
  color: #92400E;
  vertical-align: middle;
  text-decoration: none;
}
/* ---- Item text input (for Wire Amount etc.) ---- */
.cl-text {
  width: 120px;
  flex-shrink: 0;
  font-size: 11px;
  padding: 4px 8px;
  border: 1px solid #E2E8F0;
  border-radius: 6px;
  color: #475569;
  background: #FFFFFF;
  outline: none;
  transition: border-color 0.15s;
}
.cl-text:focus {
  border-color: #93C5FD;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}
/* DRAG & DROP STYLES */
.cl-item.dragging {
  opacity: 0.4;
  background: #EFF6FF;
}
.cl-item.drag-over {
  border-top: 2px solid #3B82F6;
}
.cl-drag-handle {
  cursor: grab;
  color: #CBD5E1;
  font-size: 11px;
  padding: 2px;
  flex-shrink: 0;
  transition: color 0.15s;
}
.cl-drag-handle:hover {
  color: #64748B;
}
.cl-drag-handle:active {
  cursor: grabbing;
}
/* RESPONSIVE */
@media (max-width: 768px) {
  .checklist-panel {
    padding: 16px;
  }
  .checklist-panel > .checklist-panel-header,
  .checklist-panel > .checklist-panel-body,
  .checklist-panel > .checklist-panel-footer {
    width: 100%;
    max-width: 100%;
  }
  .cl-item {
    padding: 10px 16px 10px 36px;
  }
  .cl-group-header {
    padding: 10px 16px;
  }
  .cl-date, .cl-text {
    width: 100px;
  }
  .cl-na-btn {
    font-size: 9px;
    padding: 2px 5px;
  }
  .checklist-panel-header {
    padding: 12px 16px;
  }
  .checklist-panel-footer {
    padding: 10px 16px;
  }
}
/* AFFORDABILITY CALC — Input Field Layout Helpers — .calc-field-group, .calc-input-row, .calc-toggle, — .calc-row-2col, .calc-row-3col */
.calc-field-group {
  display: flex; flex-direction: column; gap: 3px;
}
.calc-field-group label {
  font-size: 11px; font-weight: 600; color: #64748B;
  margin: 0; line-height: 1.2;
}
.calc-input-row {
  display: flex; align-items: center; gap: 8px;
}
.calc-input-row .form-control { flex: 1; min-width: 0; }
.calc-toggle {
  display: flex; flex-shrink: 0;
}
.calc-row-2col {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 10px 16px;
}
.calc-row-3col {
  display: grid; grid-template-columns: 1fr 1fr 1fr;
  gap: 10px 12px;
}
/* AFFORDABILITY CALC — Results Section (bottom of overlay) — 2-column flex layout: left = amounts + DTI, right = breakdown */
.calc-results {
  display: flex;
  gap: 16px;
  padding: 14px 20px 16px;
  background: #F8FAFC;
  border-top: 1px solid #E2E8F0;
  flex-shrink: 0;
}
/* ---- Left column: key values + DTI ---- */
.calc-results-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.calc-result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 0;
  border-bottom: 1px solid #E2E8F0;
}
.calc-result-item:last-of-type {
  border-bottom: none;
}
.calc-result-item.primary {
  padding: 6px 0 8px;
  border-bottom: 2px solid #DBEAFE;
}
.calc-result-label {
  font-size: 11px;
  font-weight: 600;
  color: #64748B;
}
.calc-result-value {
  font-size: 13px;
  font-weight: 700;
  color: #1E293B;
  font-variant-numeric: tabular-nums;
}
.calc-result-item.primary .calc-result-value {
  font-size: 15px;
  font-weight: 800;
  color: #1E40AF;
}
/* ---- DTI color classes (set by JS) ---- */
.dti-green  { color: #16A34A !important; }
.dti-yellow { color: #D97706 !important; }
.dti-red    { color: #DC2626 !important; }
/* ---- Right column: payment breakdown ---- */
.calc-results-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.calc-payment-title {
  font-size: 11px;
  font-weight: 700;
  color: #1E3A8A;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding-bottom: 5px;
  margin-bottom: 2px;
  border-bottom: 2px solid #DBEAFE;
}
.calc-payment-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  font-size: 12px;
  color: #334155;
  border-bottom: 1px solid #F1F5F9;
}
.calc-payment-line:last-of-type {
  border-bottom: none;
}
.calc-payment-line span:last-child {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: #1E293B;
}
.calc-payment-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0 2px;
  margin-top: 2px;
  border-top: 2px solid #CBD5E1;
  font-size: 12px;
  font-weight: 700;
  color: #1E293B;
}
.calc-payment-total span:last-child {
  font-size: 14px;
  font-weight: 800;
  color: #1E40AF;
  font-variant-numeric: tabular-nums;
}
/* ============================================================
   EQUITY LOAN — Subordinate Financing Section (v12.4)
   Conditional divider + fields + auto-calc results strip
   inside the Loan Details card.
   ============================================================ */
/* Divider with centered label */
.equity-loan-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 14px 0 8px;
}
.equity-loan-divider::before,
.equity-loan-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #CBD5E1;
}
.equity-loan-divider span {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #64748B;
  white-space: nowrap;
}
/* Auto-calc results strip */
.equity-calc-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 10px;
}
.equity-calc-item {
  background: #F1F5F9;
  border-radius: 6px;
  padding: 8px 10px;
  text-align: center;
}
.equity-calc-label {
  display: block;
  font-size: 10px;
  font-weight: 600;
  color: #64748B;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: 3px;
}
.equity-calc-value {
  display: block;
  font-size: 14px;
  font-weight: 700;
  color: #1E293B;
  font-variant-numeric: tabular-nums;
}
/* Highlighted item (Max New Loan) */
.equity-calc-highlight {
  background: #EFF6FF;
  border: 1.5px solid #93C5FD;
}
.equity-calc-highlight .equity-calc-label {
  color: #2563EB;
}
.equity-calc-highlight .equity-calc-value {
  color: #1D4ED8;
  font-size: 15px;
}
/* Responsive: stack on small screens */
@media (max-width: 600px) {
  .equity-calc-strip {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* ========== Lender Searchable Dropdown ========== */
.lender-search-wrap { position: relative; }
.lender-dropdown {
  display: none; position: absolute; top: 100%; left: 0; right: 0; z-index: 100000;
  background: #fff; border: 1px solid #d1d5db; border-top: none; border-radius: 0 0 6px 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,.12); max-height: 240px; overflow-y: auto; margin-top: -1px;
}
.lender-dropdown.open { display: block; }
.lender-dropdown-item {
  padding: 9px 12px; cursor: pointer; font-size: 14px; color: #1f2937; border-bottom: 1px solid #f3f4f6;
}
.lender-dropdown-item:last-child { border-bottom: none; }
.lender-dropdown-item:hover, .lender-dropdown-item.active { background: #eff6ff; }
.lender-dropdown-item.lender-other-item { font-weight: 600; color: #1a56db; border-bottom: 2px solid #e5e7eb; }
.lender-dropdown-item .lender-match { font-weight: 600; }
.lender-clear-btn {
  position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none;
  cursor: pointer; color: #9ca3af; font-size: 16px; padding: 2px 6px; line-height: 1; border-radius: 4px;
}
.lender-clear-btn:hover { color: #ef4444; background: #fef2f2; }
.lender-other-wrap { margin-top: 8px; }
.lender-other-wrap.hidden { display: none; }

/* Lender Quick Links */
.lender-links { display: none; margin-top: 8px; padding: 0; gap: 6px; }
.lender-links.visible { display: grid; grid-template-columns: 1fr 1fr; }
.lender-links a {
  display: flex; align-items: center; justify-content: center; gap: 5px;
  font-size: 11.5px; color: #1a56db; text-decoration: none; font-weight: 500;
  padding: 6px 8px; border-radius: 5px; background: #f0f5ff; border: 1px solid #dbeafe;
  transition: background .15s, border-color .15s; white-space: nowrap;
}
.lender-links a:hover { background: #dbeafe; border-color: #93c5fd; }
.lender-links a i { font-size: 11px; }`;
  return new Response(cssContent, {
    status: 200,
    headers: {
      "Content-Type": "text/css; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      ...getCorsHeaders(request)
    }
  });
}

// PIPELINE HTML TEMPLATE (migrated from Webflow embed Pipeline_Page_Embed_HTML_v12_0.html)
// Served as: GET /static/pipeline-template.html

async function getPipelineTemplateHTML(request) {
  const htmlContent = `<!-- PIPELINE HTML v12.0 — Closing Costs calc button enabled (no longer Coming Soon) -->
<div class="app-page-content">
<div class="pipeline-container" id="pipeline-app">
  <div class="pipeline-header"><div class="header-left"><h1 class="pipeline-title">Pipeline</h1></div><div class="header-right"><div class="view-toggle"><button class="view-btn active" data-view="table" onclick="switchView('table')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v18H3z"></path><path d="M3 9h18M3 15h18M9 3v18M15 3v18"></path></svg> Table</button><button class="view-btn" data-view="kanban" onclick="switchView('kanban')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="6" height="18" rx="1"></rect><rect x="9" y="3" width="6" height="13" rx="1"></rect><rect x="16" y="3" width="6" height="8" rx="1"></rect></svg> Board</button></div><button class="btn btn-primary" onclick="openNewLoanModal()">+ Add Loan</button><button class="btn btn-secondary btn-sm" onclick="exportPipeline()" title="Export to CSV" id="export-pipeline-btn"><i class="fa-solid fa-download"></i> Export</button><button class="btn btn-secondary btn-sm" onclick="refreshPipelineData()" title="Refresh data">&#8635;</button></div></div>
  <!-- Stats Bar -->
  <div class="stats-bar">
    <div class="stat-card highlight"><div class="stat-value" id="stat-total">-</div><div class="stat-label">Total Active</div></div>
    <div class="stat-card"><div class="stat-value" id="stat-active">-</div><div class="stat-label">In Progress</div></div>
    <div class="stat-card"><div class="stat-value" id="stat-closing">-</div><div class="stat-label">Closing Soon</div></div>
    <div class="stat-card"><div class="stat-value" id="stat-volume">-</div><div class="stat-label">Pipeline Volume</div></div>
    <div class="stat-card"><div class="stat-value" id="stat-won" style="color:#15803D;">-</div><div class="stat-label">Won</div></div>
    <div class="stat-card"><div class="stat-value" id="stat-lost" style="color:#DC2626;">-</div><div class="stat-label">Lost</div></div>
  </div>
  <div class="loading" id="loading-state"><div class="spinner"></div></div>
  <div class="empty-state hidden" id="empty-state"><div style="font-size:48px;">&#128194;</div><h3>No loans in your pipeline</h3><p>Create your first loan to get started</p><button class="btn btn-primary" onclick="openNewLoanModal()" style="margin-top:16px;">+ Add First Loan</button></div>
  <div class="kanban-board hidden" id="kanban-view"></div>
  <!-- Table View -->
  <div class="table-container hidden" id="table-view"><div class="table-toolbar"><div class="search-and-status"><div class="search-box"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg><input type="text" placeholder="Search loans..." id="search-input" oninput="filterTable()"></div>
        <div class="status-toggle">
          <button class="status-btn" data-status="All" onclick="setStatusFilter('All')">All</button>
          <button class="status-btn" data-status="Leads" onclick="setStatusFilter('Leads')">Leads</button>
          <button class="status-btn active" data-status="Active" onclick="setStatusFilter('Active')">Active</button>
          <button class="status-btn" data-status="Won" onclick="setStatusFilter('Won')">Won</button>
          <button class="status-btn" data-status="Lost" onclick="setStatusFilter('Lost')">Lost</button>
        </div>
      </div>
      <div class="filter-group">
        <select class="filter-select" id="stage-filter" onchange="filterTable()">
          <option value="">All Stages</option>
        </select>
        <select class="filter-select" id="type-filter" onchange="filterTable()">
          <option value="">All Loan Types</option>
        </select>
        <select class="filter-select" id="lock-status-filter" onchange="filterTable()">
          <option value="">All Lock Status</option>
          <option value="Floating">Floating</option>
          <option value="Locked">Locked</option>
          <option value="Expired">Expired</option>
          <option value="-">Not Set</option>
        </select>
        <select class="filter-select" id="pay-status-filter" onchange="filterTable()">
          <option value="">All Pay Status</option>
          <option value="Preparing">Preparing</option>
          <option value="Ready for Payroll">Ready for Payroll</option>
          <option value="Payroll Submitted">Payroll Submitted</option>
          <option value="Pay Received">Pay Received</option>
          <option value="-">Not Set</option>
        </select>
        <div class="column-selector">
          <button class="column-selector-btn" onclick="toggleColumnSelector()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            Columns
          </button>
          <div class="column-selector-dropdown" id="column-selector-dropdown">
            <div class="column-selector-header">Show/Hide &amp; Reorder Columns</div>
            <div id="column-options-list">
            </div>
          </div>
        </div>
      </div>
    </div>
    <div style="overflow-x: auto;">
      <table class="pipeline-table">
        <thead>
          <tr id="table-header-row">
          </tr>
        </thead>
        <tbody id="table-body">
        </tbody>
      </table>
    </div>
  </div>
</div>
<!-- Loan Modal -->
<div class="modal-overlay hidden" id="loan-modal">
  <div class="modal-content">
    <!-- Header -->
    <div class="modal-header"><div class="modal-nav-left"><button type="button" class="back-to-pipeline-btn" onclick="closeModal()"><i class="fa-solid fa-arrow-left"></i> Back</button><h2 id="modal-title">New Loan</h2><div class="header-borrower-names hidden" id="borrower-name-bar"><span class="hbn-sep">—</span><span class="hbn-primary" id="header-borrower-name"></span><span class="hbn-amp hidden" id="header-name-separator">&amp;</span><span class="hbn-secondary" id="header-coborrower-name"></span></div></div><div class="modal-nav-right"><button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button><button type="button" class="btn btn-primary" id="save-loan-btn-top" onclick="saveLoan()">Save Loan</button></div></div>
    <div class="deal-status-bar hidden" id="deal-status-bar"><div class="deal-status-left"><span class="status-label">Deal Status:</span><button class="deal-status-btn won-btn" id="btn-won" onclick="setDealStatus('Won')">&#10003; Won</button><button class="deal-status-btn lost-btn" id="btn-lost" onclick="setDealStatus('Lost')">&#10007; Lost</button><div class="deal-status-banner won-banner hidden" id="won-banner">&#10003; WON</div><div class="deal-status-banner lost-banner hidden" id="lost-banner">&#10007; LOST</div><button class="deal-status-btn reopen-btn hidden" id="btn-reopen" onclick="setDealStatus('Active')">&#8634; Reopen</button></div><div class="deal-status-right"><label class="deal-status-field-label">Last Contact</label><input type="date" class="fc deal-status-date" id="last-contact-date"></div></div>
    <!-- 3-PANEL LAYOUT -->
    <div class="modal-body-wrapper">
      <!-- LEFT NAV SIDEBAR -->
      <div class="modal-nav-sidebar" id="modal-nav-sidebar">
        <a class="mnav-item active" data-section="section-borrower" onclick="showSection('main')"><i class="fa-solid fa-user"></i><span>Borrower</span></a>
        <a class="mnav-item active" data-section="section-deal" onclick="showSection('main')"><i class="fa-solid fa-handshake"></i><span>Deal</span></a>
        <a class="mnav-item" data-section="section-credit" onclick="showSection('section-credit')"><i class="fa-solid fa-chart-line"></i><span>Credit</span></a>
        <a class="mnav-item" data-section="section-income" onclick="showSection('section-income')"><i class="fa-solid fa-money-bill-trend-up"></i><span>Income</span></a>
        <a class="mnav-item" data-section="section-assets" onclick="showSection('section-assets')"><i class="fa-solid fa-vault"></i><span>Assets</span></a>
        <a class="mnav-item" data-section="section-liabilities" onclick="showSection('section-liabilities')"><i class="fa-solid fa-credit-card"></i><span>Liabilities</span></a>
        <a class="mnav-item" data-section="section-pricing" onclick="showSection('section-pricing')"><i class="fa-solid fa-tags"></i><span>Pricing</span></a>
        <a class="mnav-item" data-section="section-loan-details" onclick="showSection('section-loan-details')"><i class="fa-solid fa-file-invoice-dollar"></i><span>Loan Details</span></a>
        <a class="mnav-item" data-section="section-payment" onclick="showSection('section-payment')"><i class="fa-solid fa-money-check-dollar"></i><span>Payment</span></a>
        <a class="mnav-item" data-section="section-property" onclick="showSection('section-property')"><i class="fa-solid fa-house"></i><span>Property</span></a>
        <a class="mnav-item" data-section="section-comp-pay" onclick="showSection('section-comp-pay')"><i class="fa-solid fa-sack-dollar"></i><span>Comp</span></a>
        <a class="mnav-item" data-section="section-lock" onclick="showSection('section-lock')"><i class="fa-solid fa-lock"></i><span>Lock</span></a>
        <a class="mnav-item" data-section="section-notes" onclick="showSection('section-notes')"><i class="fa-solid fa-pen-to-square"></i><span>Notes</span></a>
        <a class="mnav-item" data-section="section-links" onclick="showSection('section-links')"><i class="fa-solid fa-link"></i><span>Links</span></a>
        <div class="mnav-divider"></div>
        <a class="mnav-item mnav-checklist-btn" onclick="toggleChecklistPanel()"><i class="fa-solid fa-clipboard-check"></i><span>Checklist</span><span class="checklist-badge" id="checklist-badge">0/43</span></a>
      </div>
      <!-- MAIN SCROLLABLE CONTENT -->
      <div class="modal-main-scroll" id="modal-main-scroll">
        <form id="loan-form">
          <input type="hidden" id="loan-id">
          <input type="hidden" id="checklist-json">
  <!-- SECTION PAGES -->
          <div class="section-pages" id="section-pages">
            <!-- BORROWER (main) -->
            <div class="card section-card" id="section-borrower" data-page="main">
              <div class="card-title"><i class="fa-solid fa-user"></i> Borrower</div>
              <div class="cg cg3">
                <div class="ff"><label>First Name *</label><input type="text" class="fc" id="borrower-first" required></div>
                <div class="ff"><label>Middle</label><input type="text" class="fc" id="borrower-middle"></div>
                <div class="ff"><label>Last Name *</label><input type="text" class="fc" id="borrower-last" required></div>
              </div>
              <div class="cg">
                <div class="ff"><label>Email</label><input type="email" class="fc" id="borrower-email"></div>
                <div class="ff"><label>Phone</label><input type="tel" class="fc" id="borrower-phone"></div>
              </div>
              <div class="cg">
                <div class="ff"><label>Date of Birth</label><input type="date" class="fc" id="borrower-dob"></div>
                <div class="ff"><label>SSN Last 4</label><input type="text" class="fc" id="borrower-ssn4" maxlength="4" placeholder="0000" inputmode="numeric" pattern="[0-9]{4}"></div>
              </div>
              <div class="cb-toggle" onclick="toggleCoBorrower()">
                <span class="cb-toggle-label">Co-Borrower</span>
                <span class="cb-toggle-icon" id="coborrower-toggle-icon">&#9662;</span>
              </div>
              <div class="cb-body collapsed" id="coborrower-toggle-body">
                <div class="cg cg3">
                  <div class="ff"><label>First Name</label><input type="text" class="fc" id="co-borrower-first"></div>
                  <div class="ff"><label>Middle</label><input type="text" class="fc" id="co-borrower-middle"></div>
                  <div class="ff"><label>Last Name</label><input type="text" class="fc" id="co-borrower-last"></div>
                </div>
                <div class="cg">
                  <div class="ff"><label>Role</label>
                    <select class="fc" id="co-borrower-role"><option value="">Select...</option><option value="Borrower">Borrower</option><option value="Non-Occupant Co-Borrower">Non-Occupant Co-Borrower</option><option value="Title Holder Only">Title Holder Only</option><option value="Guarantor">Guarantor</option><option value="Non-title Spouse">Non-title Spouse</option></select>
                  </div>
                </div>
                <div class="cg">
                  <div class="ff"><label>Email</label><input type="email" class="fc" id="co-borrower-email"></div>
                  <div class="ff"><label>Phone</label><input type="tel" class="fc" id="co-borrower-phone"></div>
                </div>
                <div class="cg">
                  <div class="ff"><label>Date of Birth</label><input type="date" class="fc" id="co-borrower-dob"></div>
                  <div class="ff"><label>SSN Last 4</label><input type="text" class="fc" id="co-borrower-ssn4" maxlength="4" placeholder="0000" inputmode="numeric" pattern="[0-9]{4}"></div>
                </div>
              </div>
            </div>
            <!-- DEAL (main) -->
            <div class="card section-card" id="section-deal" data-page="main">
              <div class="card-title"><i class="fa-solid fa-handshake"></i> Deal</div>
              <div class="cg">
                <div class="ff"><label>Stage *</label>
                  <select class="fc" id="loan-stage" required>
                    <option value="01 - Lead">01 - Lead</option>
                    <option value="02 - Application">02 - Application</option>
                    <option value="03 - Prequal | AUS">03 - Prequal | AUS</option>
                    <option value="04 - (Purchase) Shopping">04 - (Purchase) Shopping</option>
                    <option value="04 - (Purchase) Under Contract">04 - (Purchase) Under Contract</option>
                    <option value="04 - (Refi) Quotes">04 - (Refi) Quotes</option>
                    <option value="05 - Disclosure">05 - Disclosure</option>
                    <option value="06 - Processing">06 - Processing</option>
                    <option value="07 - Underwriting">07 - Underwriting</option>
                    <option value="08 - Conditional Approval">08 - Conditional Approval</option>
                    <option value="09 - Resubmittal">09 - Resubmittal</option>
                    <option value="10 - CTC">10 - CTC</option>
                    <option value="11 - Closing | Funding">11 - Closing | Funding</option>
                    <option value="12 - Closed">12 - Closed</option>
                  </select>
                </div>
                <div class="ff"><label>Purpose</label>
                  <select class="fc" id="loan-purpose" onchange="togglePurchasePriceField(); toggleEquityLoanFields();"><option value="">Select...</option><option value="Purchase">Purchase</option><option value="Refi (Rate-Term)">Refi (Rate-Term)</option><option value="Refi (Cash-Out)">Refi (Cash-Out)</option><option value="Equity Loan">Equity Loan</option><option value="Construction">Construction</option></select>
                </div>
              </div>
              <div class="cg">
                <div class="ff"><label>Occupancy</label>
                  <select class="fc" id="occupancy"><option value="">Select...</option><option value="Primary Residence">Primary Residence</option><option value="Second Home">Second Home</option><option value="Investment Property">Investment Property</option><option value="Commercial">Commercial</option></select>
                </div>
                <div class="ff"><label>Expected Close</label><input type="date" class="fc" id="expected-close"></div>
              </div>
              <div class="cg">
                <div class="ff"><label>Lead Source</label>
                  <select class="fc" id="lead-source"><option value="">Select...</option><option value="Self-Generated">Self-Generated</option><option value="Past Client">Past Client</option><option value="Referral - Realtor">Referral - Realtor</option><option value="Referral - Client">Referral - Client</option><option value="Referral - Financial Planner">Referral - Financial Planner</option><option value="Referral - Builder">Referral - Builder</option><option value="Referral - Other">Referral - Other</option><option value="Website">Website</option><option value="Social Media">Social Media</option><option value="Cold Call">Cold Call</option><option value="Direct Mail">Direct Mail</option><option value="Lead Service">Lead Service</option><option value="Walk-In">Walk-In</option><option value="Other">Other</option></select>
                </div>
                <div class="ff"><label>Lender</label><div class="lender-search-wrap" id="lender-search-wrap"><input type="text" class="fc" id="loan-lender-search" placeholder="Search lenders..." autocomplete="off"><input type="hidden" id="loan-lender"><div class="lender-dropdown" id="lender-dropdown"></div></div><div class="lender-links" id="lender-links"></div><div class="ff lender-other-wrap hidden" id="lender-other-wrap"><label>Other Lender Name</label><input type="text" class="fc" id="loan-lender-other" placeholder="Type lender name..."></div></div>
              </div>
              <div class="cg">
                <div class="ff sp2"><label>Deal Notes</label><textarea class="fc" id="deal-notes" placeholder="Quick notes about the deal..." style="min-height:60px;"></textarea></div>
              </div>
            </div>
            <!-- CREDIT (own page) -->
            <div class="card section-card section-hidden" id="section-credit" data-page="section-credit">
              <div class="card-title"><i class="fa-solid fa-chart-line"></i> Credit</div>
              <div class="cg">
                <div class="ff"><label>Score</label><input type="number" class="fc" id="credit-score" min="300" max="850" placeholder="740"></div>
                <div class="ff"><label>Date Pulled</label><input type="date" class="fc" id="date-credit-pulled"></div>
              </div>
              <div class="cg">
                <div class="ff"><label>Pull Type</label><select class="fc" id="credit-pull-type"><option value="">—</option><option value="Soft">Soft</option><option value="Hard">Hard</option></select></div>
                <div class="ff"><label># Scores</label><input type="number" class="fc" id="scores-pulled" placeholder="3"></div>
              </div>
              <div class="cg">
                <div class="ff"><label>Vendor</label><input type="text" class="fc" id="credit-vendor"></div>
                <div class="ff"><label>Report #</label><input type="text" class="fc" id="credit-report-number"></div>
              </div>
            </div>
            <!-- INCOME v11.3 -->
            <div class="card section-card section-hidden" id="section-income" data-page="section-income">
              <div class="card-title"><i class="fa-solid fa-money-bill-trend-up"></i> Income</div>
<div id="income-section-content"></div>
            </div>
            <!-- ASSETS v11.7 (own page - content built by pipeline-assets.js) -->
            <div class="card section-card section-hidden" id="section-assets" data-page="section-assets">
              <div class="card-title"><i class="fa-solid fa-vault"></i> Assets</div>
              <div id="assets-section-content"></div>
            </div>
            <!-- LIABILITIES v8.3 (own page - content built by pipeline-liabilities.js) -->
            <div class="card section-card section-hidden" id="section-liabilities" data-page="section-liabilities">
              <div class="card-title"><i class="fa-solid fa-credit-card"></i> Liabilities</div>
              <div id="liabilities-section-content"></div>
            </div>
            <!-- PRICING v8.3 (own page - pricing card + notes injected by JS) -->
            <div class="card section-card section-hidden" id="section-pricing" data-page="section-pricing">
              <div class="card-title"><i class="fa-solid fa-tags"></i> Pricing</div>
              <div id="pricing-section-content"></div>
            </div>
            <!-- LOAN DETAILS (own page) -->
            <div class="card section-card section-hidden" id="section-loan-details" data-page="section-loan-details">
              <div class="card-title"><i class="fa-solid fa-file-invoice-dollar"></i> Loan Details</div>
              <div class="cg" id="property-value-row">
                <div class="ff" id="purchase-price-group"><label>Purchase Price ($)</label><input type="text" class="fc currency-input" id="purchase-price"></div>
                <div class="ff"><label>Property Value ($)</label><input type="text" class="fc currency-input" id="property-value"></div>
              </div>
              <div class="cg">
                <div class="ff"><label>LTV (%)</label><input type="number" class="fc" id="ltv" step="0.01" placeholder="80"></div>
                <div class="ff"><label>Loan Amount ($)</label><input type="text" class="fc currency-input" id="loan-amount"></div>
              </div>
              <div class="cg">
                <div class="ff"><label>Loan Type</label><select class="fc" id="loan-type" onchange="toggleHelocSection(); toggleOtherLoanTypeField();"><option value="">Select...</option></select></div>
                <div class="ff"><label>Term (Years)</label><input type="number" class="fc" id="loan-term" placeholder="30"></div>
              </div>
              <div class="cg hidden" id="other-loan-type-row">
                <div class="ff sp2"><label>Other Loan Type</label><input type="text" class="fc" id="other-loan-type" placeholder="Specify loan type..."></div>
              </div>
              <div class="cg">
                <div class="ff"><label>Interest Rate (%)</label><input type="text" class="fc rate-input" id="loan-interest-rate" placeholder="6.500" inputmode="decimal"></div>
                <div class="ff"><label>Qualifying Rate (%)</label><input type="text" class="fc rate-input" id="qualifying-interest-rate" placeholder="7.500" inputmode="decimal"></div>
              </div>
              <!-- Equity Loan / Subordinate Financing -->
              <div class="equity-loan-divider hidden" id="equity-loan-divider"><span>Subordinate Financing</span></div>
              <div class="cg hidden" id="equity-loan-fields">
                <div class="ff"><label>Lien Position</label><select class="fc" id="lien-position" onchange="toggleExisting2ndField(); calcEquityLoan();"><option value="">Select...</option><option value="2nd">2nd</option><option value="3rd">3rd</option></select></div>
                <div class="ff"><label>Max CLTV (%)</label><input type="number" class="fc" id="max-cltv" step="0.01" placeholder="90" oninput="calcEquityLoan();"></div>
              </div>
              <div class="cg hidden" id="equity-loan-fields-2">
                <div class="ff"><label>Existing 1st Mortgage ($)</label><input type="text" class="fc currency-input" id="existing-1st-balance" oninput="calcEquityLoan();"></div>
                <div class="ff hidden" id="existing-2nd-group"><label>Existing 2nd Mortgage ($)</label><input type="text" class="fc currency-input" id="existing-2nd-balance" oninput="calcEquityLoan();"></div>
              </div>
              <div class="hidden" id="equity-loan-results"><div class="equity-calc-strip"><div class="equity-calc-item"><span class="equity-calc-label">Total Existing Liens</span><span class="equity-calc-value" id="eq-total-liens">&mdash;</span></div><div class="equity-calc-item"><span class="equity-calc-label">Max Total Debt</span><span class="equity-calc-value" id="eq-max-debt">&mdash;</span></div><div class="equity-calc-item equity-calc-highlight"><span class="equity-calc-label">Max New Loan</span><span class="equity-calc-value" id="eq-max-loan">&mdash;</span></div><div class="equity-calc-item"><span class="equity-calc-label">Actual CLTV</span><span class="equity-calc-value" id="eq-actual-cltv">&mdash;</span></div></div></div>
            </div>
            <!-- HELOC (loan-details, conditional) -->
            <div class="card section-card section-hidden hidden" id="heloc-section" data-page="section-loan-details">
              <div class="card-title"><i class="fa-solid fa-piggy-bank"></i> HELOC Details</div>
              <div class="cg" style="max-width:500px;">
                <div class="ff"><label>Line Amount ($)</label><input type="text" class="fc currency-input" id="heloc-line-amount"></div>
                <div class="ff"><label>Initial Draw ($)</label><input type="text" class="fc currency-input" id="heloc-initial-draw"></div>
              </div>
            </div>
            <!-- PAYMENT (own page) -->
            <div class="card section-card section-hidden" id="section-payment" data-page="section-payment">
              <div class="card-title"><i class="fa-solid fa-money-check-dollar"></i> Payment</div>
              <table class="pt">
                <thead><tr><th>Item</th><th>Annual</th><th>Monthly</th></tr></thead>
                <tbody>
                  <tr>
                    <td class="pt-lbl">P&amp;I</td>
                    <td class="pt-inp"><span class="pt-auto">Auto</span></td>
                    <td class="pt-mo"><span class="pt-val" id="pi-calc-display">—</span></td>
                  </tr>
                  <tr>
                    <td class="pt-lbl">HOI</td>
                    <td class="pt-inp"><input type="text" class="fc currency-input payment-calc-input" id="prop-hoi" data-decimals="2" placeholder="0.00"></td>
                    <td class="pt-mo"><span class="pt-val pt-cmp" id="hoi-monthly">—</span></td>
                  </tr>
                  <tr>
                    <td class="pt-lbl">Taxes</td>
                    <td class="pt-inp"><input type="text" class="fc currency-input payment-calc-input" id="prop-taxes" data-decimals="2" placeholder="0.00"></td>
                    <td class="pt-mo"><span class="pt-val pt-cmp" id="taxes-monthly">—</span></td>
                  </tr>
                  <tr>
                    <td class="pt-lbl">Supp. Ins.</td>
                    <td class="pt-inp"><input type="text" class="fc currency-input payment-calc-input" id="prop-supp-ins" data-decimals="2" placeholder="0.00"></td>
                    <td class="pt-mo"><span class="pt-val pt-cmp" id="supp-monthly">—</span></td>
                  </tr>
                  <tr>
                    <td class="pt-lbl">HOA <span class="pt-hint">(mo)</span></td>
                    <td class="pt-inp"><input type="text" class="fc currency-input payment-calc-input" id="prop-hoa" data-decimals="2" placeholder="0.00"></td>
                    <td class="pt-mo"><span class="pt-val pt-cmp" id="hoa-monthly">—</span></td>
                  </tr>
                </tbody>
                <tfoot><tr class="pt-foot">
                  <td class="pt-tot-lbl" colspan="2">Total PITIA</td>
                  <td class="pt-tot-val"><span id="total-pitia-display">—</span></td>
                </tr></tfoot>
              </table>
              <div style="display:none;" id="monthly-expenses-display">—</div>
            </div>
            <!-- PROPERTY (own page) -->
            <div class="card section-card section-hidden" id="section-property" data-page="section-property">
              <div class="card-title"><i class="fa-solid fa-house"></i> Property</div>
              <div class="cg">
                <div class="ff sp2"><label>Street Address</label><input type="text" class="fc" id="property-street"></div>
              </div>
              <div class="cg">
                <div class="ff"><label>City</label><input type="text" class="fc" id="property-city"></div>
                <div class="ff"><label>State</label><input type="text" class="fc" id="property-state" maxlength="2"></div>
              </div>
              <div class="cg">
                <div class="ff"><label>Zip</label><input type="text" class="fc" id="property-zip" maxlength="10"></div>
                <div class="ff"><label>County</label><input type="text" class="fc" id="property-county"></div>
              </div>
              <div class="cg">
                <div class="ff"><label>Type</label>
                  <select class="fc" id="property-type"><option value="">Select...</option><option value="SFR">SFR</option><option value="Condo">Condo</option><option value="Townhome">Townhome</option><option value="2-4 Unit">2-4 Unit</option><option value="Multi 5+">Multi 5+</option><option value="Manufactured">Manufactured</option><option value="Land">Land</option></select>
                </div>
                <div class="ff"><label>Property Value ($)</label><input type="text" class="fc currency-input" id="prop-page-value"></div>
              </div>
              <div class="cg">
                <div class="ff"><button type="button" class="btn btn-secondary" onclick="zillowLookup()" style="display:flex;align-items:center;gap:6px"><i class="fa-solid fa-arrow-up-right-from-square"></i>Zillow Lookup</button></div>
              </div>
            </div>
            <!-- COMPENSATION (own page) -->
            <div class="card section-card section-hidden" id="section-compensation" data-page="section-comp-pay">
              <div class="card-title"><i class="fa-solid fa-sack-dollar"></i> Compensation</div>
              <div class="cg">
                <div class="ff"><label>Channel</label>
                  <select class="fc" id="comp-channel" onchange="togglePointsYsp()"><option value="">Select...</option><option value="Broker">Broker</option><option value="NonDel">NonDel</option><option value="Correspondent">Correspondent</option><option value="Other">Other</option></select>
                </div>
                <div class="ff"><label>Comp Type</label>
                  <select class="fc" id="comp-type"><option value="">Select...</option><option value="BPC">BPC</option><option value="LPC">LPC</option><option value="Other">Other</option></select>
                </div>
              </div>
              <div class="cg">
                <div class="ff"><label>Comp (BPS)</label>
                  <input type="number" class="fc" id="comp-bps" step="1" placeholder="250">
                  <span class="comp-sync-indicator" id="bps-sync-indicator"></span>
                </div>
                <div class="ff"><label>Comp ($)</label>
                  <input type="text" class="fc currency-input" id="comp-amount-input" placeholder="5,000">
                  <span class="comp-sync-indicator" id="amount-sync-indicator"></span>
                </div>
              </div>
              <div class="cg hidden" id="points-ysp-row">
                <div class="ff"><label>Points</label><input type="number" class="fc" id="comp-points" step="0.001" placeholder="0.000"></div>
                <div class="ff"><label>YSP</label><input type="number" class="fc" id="comp-ysp" step="0.001" placeholder="0.000"></div>
              </div>
            </div>
            <!-- LOCK (own page) -->
            <div class="card section-card section-hidden" id="section-lock" data-page="section-lock">
              <div class="card-title"><i class="fa-solid fa-lock"></i> Lock Info</div>
              <div class="cg">
                <div class="ff sp2"><label>Lock Status</label><select class="fc" id="lock-status"><option value="-">-</option><option value="Floating">Floating</option><option value="Locked">Locked</option><option value="Expired">Expired</option></select></div>
              </div>
              <div class="cg">
                <div class="ff"><label>Lock Date</label><input type="date" class="fc" id="lock-date"></div>
                <div class="ff"><label>Expiration</label><input type="date" class="fc" id="lock-expiration-date"></div>
              </div>
            </div>
            <!-- PAYROLL (comp-pay page) -->
            <div class="card section-card section-hidden" id="section-payroll" data-page="section-comp-pay">
              <div class="card-title"><i class="fa-solid fa-wallet"></i> Payroll</div>
              <div class="cg">
                <div class="ff sp2"><label>Pay Status</label>
                  <select class="fc" id="pay-status"><option value="-">-</option><option value="Preparing">Preparing</option><option value="Ready for Payroll">Ready for Payroll</option><option value="Payroll Submitted">Payroll Submitted</option><option value="Pay Received">Pay Received</option></select>
                </div>
              </div>
              <div class="cg">
                <div class="ff"><label>Submitted</label><input type="date" class="fc" id="payroll-submitted-date"></div>
                <div class="ff"><label>Processed</label><input type="date" class="fc" id="payroll-processed-date"></div>
              </div>
              <div class="cg">
                <div class="ff sp2"><label>Pay Received</label><input type="date" class="fc" id="pay-received-date"></div>
              </div>
            </div>
            <!-- PAYROLL NOTES (comp-pay page) -->
            <div class="card section-card section-hidden" id="section-payroll-notes" data-page="section-comp-pay">
              <div class="card-title"><i class="fa-solid fa-pen-to-square"></i> Payroll Notes</div>
              <div class="ff"><textarea class="fc" id="payroll-notes" placeholder="Payroll details, submission notes, commission splits..."></textarea></div>
            </div>
            <!-- NOTES -->
            <div class="card section-card section-hidden" id="section-notes" data-page="section-notes">
              <div class="card-title"><i class="fa-solid fa-pen-to-square"></i> Notes</div>
              <div class="ff"><textarea class="fc" id="loan-notes" placeholder="Add any notes about this loan..."></textarea></div>
            </div>
            <!-- TASKS (notes page) -->
            <div class="card section-card section-hidden hidden" id="tasks-section" data-page="section-notes">
              <div class="card-title"><i class="fa-solid fa-list-check"></i> Tasks</div>
              <div class="task-list" id="task-list"></div>
              <div class="add-task-row">
                <input type="text" class="fc" id="new-task-name" placeholder="Add a task...">
                <input type="date" class="fc" id="new-task-due" style="max-width:120px;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="addTask()">Add</button>
              </div>
            </div>
            <!-- LINKS (own page) -->
            <div class="card section-card section-hidden" id="section-links" data-page="section-links">
              <div class="card-title"><i class="fa-solid fa-link"></i> Links</div>
              <div id="links-content"></div>
            </div>
          </div><!-- /section-pages -->
        </form>
      </div><!-- /modal-main-scroll -->
      <!-- RIGHT CALCULATOR PANEL
           v10.4: Added "Coming Soon" badges to calculators that
           aren't yet integrated into the pipeline modal.
-->
      <div class="modal-calc-panel" id="modal-calc-panel">
        <div class="calc-panel-header"><i class="fa-solid fa-calculator"></i> Calculators</div>
        <div class="calc-panel-list">
          <button type="button" class="calc-panel-btn" onclick="launchCalculator('Affordability Calculator')"><i class="fa-solid fa-house-circle-check"></i><span>Affordability</span></button>
          <button type="button" class="calc-panel-btn disabled" onclick="launchCalculator('Mortgage Calculator')"><i class="fa-solid fa-calculator"></i><span>Mortgage</span><span class="calc-coming-soon">Coming Soon</span></button>
          <button type="button" class="calc-panel-btn" onclick="launchCalculator('Refinance Analysis')"><i class="fa-solid fa-arrows-rotate"></i><span>Refinance</span></button>
          <button type="button" class="calc-panel-btn disabled" onclick="launchCalculator('Lender Pricing Comparison')"><i class="fa-solid fa-tags"></i><span>Lender Pricing</span><span class="calc-coming-soon">Coming Soon</span></button>
          <button type="button" class="calc-panel-btn" onclick="launchCalculator('Closing Costs')"><i class="fa-solid fa-file-invoice-dollar"></i><span>Closing Costs</span></button>
          <button type="button" class="calc-panel-btn disabled" onclick="launchCalculator('DSCR Calculator')"><i class="fa-solid fa-building"></i><span>DSCR</span><span class="calc-coming-soon">Coming Soon</span></button>
          <button type="button" class="calc-panel-btn disabled" onclick="launchCalculator('Loan Scenario Comparison')"><i class="fa-solid fa-code-compare"></i><span>Compare</span><span class="calc-coming-soon">Coming Soon</span></button>
          <button type="button" class="calc-panel-btn disabled" onclick="launchCalculator('Rent vs Buy')"><i class="fa-solid fa-scale-balanced"></i><span>Rent vs Buy</span><span class="calc-coming-soon">Coming Soon</span></button>
        </div>
      </div>
    </div><!-- /modal-body -->
    <!-- Affordability Calculator Sidebar -->
    <div id="calc-sidebar" class="calc-sidebar hidden">
      <div class="calc-sidebar-card">
      <div class="calc-sidebar-header">
        <h3><i class="fa-solid fa-house-circle-check"></i> Affordability</h3>
        <span class="close-calc-sidebar" onclick="closeCalcSidebar()">&times;</span>
      </div>
      <div class="calc-sidebar-body">
          <!-- Income -->
        <div class="calc-section">
          <div class="calc-section-title">Income &amp; Liabilities</div>
          <!-- Gross Income -->
          <div class="calc-field-group">
            <label>Gross Income ($)</label>
            <div class="calc-input-row">
              <input type="text" id="calc-income" class="form-control currency-input" placeholder="0">
              <div class="calc-toggle">
                <button type="button" class="calc-toggle-btn active" data-mode="annual" onclick="toggleIncomeMode('annual')">Annual</button>
                <button type="button" class="calc-toggle-btn" data-mode="monthly" onclick="toggleIncomeMode('monthly')">Monthly</button>
              </div>
            </div>
            <div id="calc-income-sync-row" style="margin-top:4px;display:flex;align-items:center;gap:6px;"><button type="button" onclick="syncIncomeFromTab()" style="padding:3px 8px;font-size:10px;font-weight:600;border-radius:4px;cursor:pointer;border:1px solid #93C5FD;background:#EFF6FF;color:#2563EB;white-space:nowrap;"><i class="fa-solid fa-arrow-right-to-bracket"></i> Use Income Tab</button><span id="calc-income-sync-msg" style="font-size:10px;color:#64748B;"></span></div>
          </div>
          <!-- Monthly Liabilities -->
          <div class="calc-field-group">
            <label>Monthly Liabilities ($)</label>
            <input type="text" id="calc-debts" class="form-control currency-input" placeholder="0">
          </div>
        </div>
        <!-- ===== SECTION 2: Housing Costs ===== -->
        <div class="calc-section">
          <div class="calc-section-title">Housing Costs</div>
          <!-- Homeowners Insurance (HOI) -->
          <div class="calc-field-group">
            <label>Homeowners Insurance ($)</label>
            <div class="calc-input-row">
              <input type="text" id="calc-insurance" class="form-control currency-input" value="1,800">
              <div class="calc-toggle">
                <button type="button" class="calc-toggle-btn calc-ins-toggle active" data-mode="annual" onclick="toggleCalcInsMode('annual')">Annual</button>
                <button type="button" class="calc-toggle-btn calc-ins-toggle" data-mode="monthly" onclick="toggleCalcInsMode('monthly')">Monthly</button>
              </div>
            </div>
          </div>
          <!-- Property Taxes -->
          <div class="calc-field-group">
            <label>Property Taxes ($)</label>
            <div class="calc-input-row">
              <input type="text" id="calc-taxes" class="form-control currency-input" value="3,000">
              <div class="calc-toggle">
                <button type="button" class="calc-toggle-btn calc-tax-toggle active" data-mode="annual" onclick="toggleCalcTaxMode('annual')">Annual</button>
                <button type="button" class="calc-toggle-btn calc-tax-toggle" data-mode="monthly" onclick="toggleCalcTaxMode('monthly')">Monthly</button>
              </div>
            </div>
          </div>
          <!-- Supp Insurance -->
          <div class="calc-field-group">
            <label>Supplemental Insurance ($) <span style="font-size:11px;color:#94A3B8;font-weight:400;">Flood, etc.</span></label>
            <div class="calc-input-row">
              <input type="text" id="calc-supp-insurance" class="form-control currency-input" placeholder="0">
              <div class="calc-toggle">
                <button type="button" class="calc-toggle-btn calc-supp-toggle active" data-mode="annual" onclick="toggleCalcSuppMode('annual')">Annual</button>
                <button type="button" class="calc-toggle-btn calc-supp-toggle" data-mode="monthly" onclick="toggleCalcSuppMode('monthly')">Monthly</button>
              </div>
            </div>
          </div>
          <!-- HOA -->
          <div class="calc-field-group">
            <label>HOA Dues ($)</label>
            <div class="calc-input-row">
              <input type="text" id="calc-hoa" class="form-control currency-input" placeholder="0">
              <div class="calc-toggle">
                <button type="button" class="calc-toggle-btn calc-hoa-toggle" data-mode="annual" onclick="toggleCalcHOAMode('annual')">Annual</button>
                <button type="button" class="calc-toggle-btn calc-hoa-toggle active" data-mode="monthly" onclick="toggleCalcHOAMode('monthly')">Monthly</button>
              </div>
            </div>
          </div>
        </div>
          <!-- Loan Parameters -->
        <div class="calc-section">
          <div class="calc-section-title">Loan Parameters</div>
          <!-- Note Rate + Qualifying Rate row -->
          <div class="calc-row-2col">
            <div class="calc-field-group">
              <label>Note Rate (%)</label>
              <input type="number" id="calc-rate" class="form-control" value="6.5" step="0.001" min="0">
            </div>
            <div class="calc-field-group">
              <label>Qualifying Rate (%)</label>
              <input type="number" id="calc-qual-rate" class="form-control" placeholder="Same as Note" step="0.001" min="0">
            </div>
          </div>
          <!-- Down Payment + DTI -->
          <div class="calc-row-3col">
            <div class="calc-field-group">
              <label>Term (yrs)</label>
              <input type="number" id="calc-term" class="form-control" value="30" min="1" max="50" step="1">
            </div>
            <div class="calc-field-group">
              <label>Down (%)</label>
              <input type="number" id="calc-down-pct" class="form-control" value="20" step="0.1" min="0" max="100">
            </div>
            <div class="calc-field-group">
              <label>Target DTI (%)</label>
              <input type="number" id="calc-dti" class="form-control" value="45" step="0.1" min="0" max="65">
            </div>
          </div>
        </div>
        <!-- ===== SECTION 4: MI Rate ===== -->
        <div class="calc-section">
          <div class="calc-section-title">Mortgage Insurance</div>
          <div class="calc-field-group">
            <label>MI Rate (%)</label>
            <input type="number" id="calc-mi-rate" class="form-control" value="0" step="0.01" min="0" placeholder="0">
          </div>
        </div>
      </div>
      <!-- ===== RESULTS: 2-Column Layout ===== -->
      <div class="calc-results">
        <!-- Left Column: Amounts + DTI -->
        <div class="calc-results-left">
          <div class="calc-result-item primary">
            <span class="calc-result-label">Max Purchase Price</span>
            <span class="calc-result-value" id="calc-max-purchase">&mdash;</span>
          </div>
          <div class="calc-result-item">
            <span class="calc-result-label">Max Loan Amount</span>
            <span class="calc-result-value" id="calc-max-loan">&mdash;</span>
          </div>
          <div class="calc-result-item">
            <span class="calc-result-label">Max Monthly PITIA</span>
            <span class="calc-result-value" id="calc-max-pitia">&mdash;</span>
          </div>
          <!-- DTI Summary -->
          <div class="calc-dti-summary">
            <div class="calc-dti-row">
              <span>Max DTI</span>
              <span id="calc-max-dti" class="dti-green">&mdash;</span>
            </div>
            <div class="calc-dti-row">
              <span>Current DTI</span>
              <span id="calc-current-dti">&mdash;</span>
            </div>
            <div class="calc-dti-row">
              <span>Available DTI</span>
              <span id="calc-available-dti">&mdash;</span>
            </div>
          </div>
        </div>
        <!-- Right Column: Payment Breakdown -->
        <div class="calc-results-right">
          <div class="calc-payment-title">Payment Breakdown</div>
          <div id="calc-breakdown">
            <!-- Populated by JS -->
          </div>
        </div>
      </div>
      </div>
    </div>
    <!-- CHECKLIST SIDE PANEL -->
    <div id="checklist-panel" class="checklist-panel hidden">
      <div class="checklist-panel-header"><div class="checklist-header-left"><i class="fa-solid fa-clipboard-check"></i><h3>Loan Checklist</h3><span class="checklist-progress-pill" id="checklist-progress-pill">0 / 43</span></div><div class="checklist-header-right"><button type="button" class="checklist-collapse-btn" onclick="collapseAllGroups()" title="Collapse all"><i class="fa-solid fa-compress"></i></button><button type="button" class="checklist-expand-btn" onclick="expandAllGroups()" title="Expand all"><i class="fa-solid fa-expand"></i></button><span class="close-checklist-panel" onclick="closeChecklistPanel()">&times;</span></div></div>
      <div class="checklist-panel-body" id="checklist-panel-body"><div class="checklist-loading">Loading checklist...</div></div>
      <div class="checklist-panel-footer"><div class="checklist-progress-bar"><div class="checklist-progress-fill" id="checklist-progress-fill" style="width:0%"></div></div><div class="checklist-auto-save-status" id="checklist-save-status">Auto-saved</div></div>
    </div>
    <div class="modal-footer"><button type="button" class="btn btn-danger hidden" id="delete-loan-btn" onclick="deleteLoan()">Delete Loan</button><div class="modal-footer-right"><button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button><button type="button" class="btn btn-primary" id="save-loan-btn" onclick="saveLoan()">Save Loan</button></div></div>
  </div>
</div>
<!-- Lost Reason Popup Modal -->
<div class="modal-overlay hidden" id="lost-reason-modal" style="z-index:10001;"><div class="lost-reason-content"><h3>Why was this deal lost?</h3><textarea class="form-control" id="lost-reason-text" rows="3" placeholder="Enter the reason this deal was lost..."></textarea><div class="lost-reason-actions"><button class="btn btn-secondary" onclick="cancelLostReason()">Cancel</button><button class="btn btn-danger" onclick="confirmLostDeal()">Mark as Lost</button></div></div></div>
</div>
<!-- EXPORT TO CSV (PRO only) -->
<script>
async function exportPipeline() {
  /* Gate check: only PRO users can export */
  await window.MTG_Billing.gateAction('pipeline-export', async function() {
    /* Get user email for API auth */
    var email = await window.MTG_Billing.getUserEmail();
    if (!email) {
      alert('Please log in to export your pipeline.');
      return;
    }
    /* Fetch loans from the Pipeline API */
    try {
      var response = await fetch('https://mtg-broker-pipeline.rich-e00.workers.dev/api/pipeline/loans', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + email,
          'Content-Type': 'application/json'
        }
      });
      var records = await response.json();
      /* The API returns Airtable records: [{ id, fields: {...} }, ...] */
      if (!Array.isArray(records) || records.length === 0) {
        alert('No loans to export.');
        return;
      }
      /* Define CSV columns — keys match Airtable field names */
      var cols = [
        { key: 'Borrower First Name', label: 'Borrower First' },
        { key: 'Borrower Last Name', label: 'Borrower Last' },
        { key: 'Stage', label: 'Stage' },
        { key: 'Deal Status', label: 'Deal Status' },
        { key: 'Loan Purpose', label: 'Purpose' },
        { key: 'Occupancy', label: 'Occupancy' },
        { key: 'Lender', label: 'Lender' },
        { key: 'Loan Amount', label: 'Loan Amount' },
        { key: 'Loan Type', label: 'Loan Type' },
        { key: 'Loan Interest Rate', label: 'Interest Rate' },
        { key: 'Loan Term', label: 'Term' },
        { key: 'Credit Score', label: 'Credit Score' },
        { key: 'Property Street', label: 'Property Address' },
        { key: 'Property City', label: 'City' },
        { key: 'Property State', label: 'State' },
        { key: 'Property Zip', label: 'Zip' },
        { key: 'Expected Close Date', label: 'Expected Close' },
        { key: 'Lock Status', label: 'Lock Status' },
        { key: 'Lead Source', label: 'Lead Source' },
        { key: 'Compensation (BPS)', label: 'Comp BPS' },
        { key: 'Compensation Amount', label: 'Comp $' },
        { key: 'Notes', label: 'Notes' }
      ];
      /* Build CSV string */
      var header = cols.map(function(c) { return '"' + c.label + '"'; }).join(',');
      var rows = records.map(function(rec) {
        var f = rec.fields || {};
        return cols.map(function(c) {
          var val = (f[c.key] != null) ? String(f[c.key]) : '';
          return '"' + val.replace(/"/g, '""') + '"';
        }).join(',');
      });
      var csv = header + '\\n' + rows.join('\\n');
      /* Trigger CSV download */
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'pipeline-export-' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('Error exporting pipeline. Please try again.');
    }
  });
}
</script>`;
  return new Response(htmlContent, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      ...getCorsHeaders(request)
    }
  });
}

// PIPELINE LOADER JS (migrated from Webflow embed Pipeline_Page_Embed_JS_v13_8.html)
// Served as: GET /static/pipeline-bootstrap.html
// Contains: Google Maps loader, address autocomplete, showSection hooks, module loaders
// NOTE: This is served as HTML (contains <script> tags) and injected via innerHTML

async function getPipelineBootstrapHTML(request) {
  const htmlContent = `<!--
  ============================================================
  Pipeline Page — JS Loader Embed (v13.8)
  ============================================================
  Place this in: Pipeline page → Before </body> tag

  v13.8 — Deal String: clickable copy-to-clipboard string in
           the yellow deal-status-bar showing combined deal info
           (Borrower & Co-Borrower - Buyer Agent - Seller Agent -
           Lender - Loan#: - Loan Type: - Occupancy: - Address).
           Auto-updates as fields change. Skips empty segments.
           Placeholder-ready for Processor, Title Rep, Loan Number.
  v13.7 — Added pipeline-closing-costs.js module loader (v1.0).
           Cache-bust pipeline-calcs.js to v3.5 for Closing Costs
           routing in launchCalculator (worker v7.28).
  v13.6 — Cache-bust pipeline-calcs.js to v3.4 for Refinance
           Analysis v3.0 two-panel layout (worker v7.27).
  v13.5 — FIX: Google address autocomplete click bug.
  v13.4 — Documents tab v2.1: Two independent cards + note blur fix.
  v13.3 — Purchase Agreement PDF extraction v1.1.
  v13.2 — Purchase Agreement tab: pipeline-purchase-agreement.js.
  v13.1 — FIX: showSection 2-column grid layout restoration.
  v13.0 — Documents tab: pipeline-documents.js module loader.
  v12.9 — Loan Detail Bar: clickable chips in modal header.
  v12.8–v11.0 — See earlier changelogs.

  Worker: mtg-broker-pipeline.rich-e00.workers.dev
  Google API Key: mtg-broker-places
  ============================================================
-->

<!-- ============================================================
     Google Maps JS API — async bootstrap loader
     ============================================================ -->
<script>
(g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);e.set("callback",c+".maps."+q);a.src=\`https://maps.googleapis.com/maps/api/js?\`+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})({
  key: "AIzaSyBdmYPIFxOVgOBZUT8PDpB29b6Ko5-A9SI",
  v: "weekly"
});
</script>

<!-- ============================================================
     Custom Address Autocomplete
     ============================================================ -->
<script>
(function() {
  'use strict';
  /* Local escapeHtml for XSS safety (mirrors the one in pipeline-app.js) */
  function escapeHtml(str) { if (!str) return ''; return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var style = document.createElement('style');
  style.textContent = '.address-autocomplete-wrap{position:relative}.address-dropdown{display:none;position:absolute;top:100%;left:0;right:0;z-index:100000;background:#fff;border:1px solid #d1d5db;border-top:none;border-radius:0 0 6px 6px;box-shadow:0 4px 12px rgba(0,0,0,.1);max-height:240px;overflow-y:auto;margin-top:-1px}.address-dropdown.open{display:block}.address-dropdown-item{padding:10px 12px;cursor:pointer;font-size:14px;color:#1f2937;border-bottom:1px solid #f3f4f6;display:flex;align-items:flex-start;gap:8px}.address-dropdown-item:last-child{border-bottom:none}.address-dropdown-item:hover,.address-dropdown-item.active{background:#eff6ff}.address-dropdown-item .addr-icon{color:#9ca3af;font-size:13px;margin-top:2px;flex-shrink:0}.address-dropdown-item .addr-main{font-weight:500}.address-dropdown-item .addr-secondary{color:#6b7280;font-size:13px}.address-dropdown-loading{padding:10px 12px;color:#9ca3af;font-size:13px;text-align:center}.address-dropdown-attr{padding:4px 12px;text-align:right;font-size:10px;color:#9ca3af;background:#f9fafb;border-top:1px solid #f3f4f6}';
  document.head.appendChild(style);

  var placesLib = null, sessionToken = null, dropdown = null;
  var debounceTimer = null, activeIndex = -1, currentSuggestions = [];
  var isInteractingWithDropdown = false; /* v13.5: prevents blur from closing dropdown during selection */

  function debounce(fn, ms) {
    return function() {
      var args = arguments;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() { fn.apply(null, args); }, ms);
    };
  }

  function newSession() {
    if (placesLib && placesLib.AutocompleteSessionToken) {
      sessionToken = new placesLib.AutocompleteSessionToken();
    }
  }

  function createDropdown(streetInput) {
    var parent = streetInput.parentNode;
    var wrap = document.createElement('div');
    wrap.className = 'address-autocomplete-wrap';
    parent.insertBefore(wrap, streetInput);
    wrap.appendChild(streetInput);
    dropdown = document.createElement('div');
    dropdown.className = 'address-dropdown';
    /* v13.5: Prevent blur when clicking dropdown */
    dropdown.addEventListener('mousedown', function(e) {
      e.preventDefault();
      isInteractingWithDropdown = true;
    });
    wrap.appendChild(dropdown);
  }

  function showDropdown(items) {
    currentSuggestions = items;
    activeIndex = -1;
    if (!items.length) { dropdown.classList.remove('open'); dropdown.innerHTML = ''; return; }
    var html = '';
    items.forEach(function(item, i) {
      var main = item.mainText || item.text || '';
      var secondary = item.secondaryText || '';
      html += '<div class="address-dropdown-item" data-index="' + i + '">'
        + '<span class="addr-icon"><i class="fa-solid fa-location-dot"></i></span>'
        + '<div><div class="addr-main">' + escapeHtml(main) + '</div>'
        + (secondary ? '<div class="addr-secondary">' + escapeHtml(secondary) + '</div>' : '')
        + '</div></div>';
    });
    html += '<div class="address-dropdown-attr">Powered by Google</div>';
    dropdown.innerHTML = html;
    dropdown.classList.add('open');
    dropdown.querySelectorAll('.address-dropdown-item').forEach(function(el) {
      el.addEventListener('mousedown', function(e) {
        e.preventDefault();
        isInteractingWithDropdown = true; /* v13.5: flag to prevent blur-close */
        selectSuggestion(parseInt(el.dataset.index));
      });
    });
  }

  async function selectSuggestion(index) {
    var item = currentSuggestions[index]; if (!item) return;
    dropdown.classList.remove('open');
    try {
      var place = new placesLib.Place({ id: item.placeId });
      await place.fetchFields({ fields: ['addressComponents', 'formattedAddress'] });
      var comps = place.addressComponents || [];
      var get = function(type) {
        var c = comps.find(function(comp) { return comp.types && comp.types.indexOf(type) !== -1; });
        return c ? (type === 'administrative_area_level_1' ? (c.shortText || c.text || '') : (c.text || c.longText || '')) : '';
      };
      var streetNum = get('street_number');
      var route = get('route');
      var streetFull = streetNum ? streetNum + ' ' + route : route;
      document.getElementById('property-street').value = streetFull;
      document.getElementById('property-city').value = get('locality') || get('sublocality') || get('administrative_area_level_2') || '';
      document.getElementById('property-state').value = get('administrative_area_level_1');
      document.getElementById('property-zip').value = get('postal_code');
      var countyField = document.getElementById('property-county');
      if (countyField) {
        var county = get('administrative_area_level_2');
        countyField.value = county.replace(/ County$/i, '');
      }
      newSession();
      /* v13.5: After populating fields, blur input + clear suggestions */
      currentSuggestions = [];
      var streetEl = document.getElementById('property-street');
      if (streetEl) streetEl.blur();
    } catch (err) { console.warn('Place details error:', err); }
    isInteractingWithDropdown = false; /* v13.5: reset flag */
  }

  async function fetchSuggestions(query) {
    if (!query || query.length < 3) { showDropdown([]); return; }
    try {
      var request = { input: query, includedPrimaryTypes: ['street_address', 'subpremise', 'premise', 'route'], includedRegionCodes: ['us'], sessionToken: sessionToken };
      var res = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
      var suggestions = (res.suggestions || []).map(function(s) {
        var p = s.placePrediction; if (!p) return null;
        return { placeId: p.placeId, text: p.text ? p.text.text : '', mainText: p.mainText ? p.mainText.text : '', secondaryText: p.secondaryText ? p.secondaryText.text : '' };
      }).filter(Boolean);
      showDropdown(suggestions);
    } catch (err) { console.warn('Autocomplete error:', err); showDropdown([]); }
  }

  var debouncedFetch = debounce(fetchSuggestions, 300);

  function handleKeydown(e) {
    var items = dropdown.querySelectorAll('.address-dropdown-item');
    if (!items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, items.length - 1); updateActive(items); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); updateActive(items); }
    else if (e.key === 'Enter' && activeIndex >= 0) { e.preventDefault(); selectSuggestion(activeIndex); }
    else if (e.key === 'Escape') { dropdown.classList.remove('open'); }
  }

  function updateActive(items) {
    items.forEach(function(el, i) { el.classList.toggle('active', i === activeIndex); });
    if (activeIndex >= 0 && items[activeIndex]) items[activeIndex].scrollIntoView({ block: 'nearest' });
  }

  async function init() {
    var streetInput = document.getElementById('property-street');
    if (!streetInput) return;
    try {
      placesLib = await google.maps.importLibrary('places');
      newSession();
      createDropdown(streetInput);
      streetInput.addEventListener('input', function() { debouncedFetch(streetInput.value); });
      /* v13.5: Fixed blur handler — prevents dropdown from eating clicks */
      streetInput.addEventListener('blur', function() {
        if (isInteractingWithDropdown) return; /* don't close during selection */
        if (dropdown) dropdown.style.pointerEvents = 'none'; /* instantly stop intercepting clicks */
        setTimeout(function() {
          dropdown.classList.remove('open');
          if (dropdown) dropdown.style.pointerEvents = ''; /* restore for next use */
        }, 120);
      });
      streetInput.addEventListener('keydown', handleKeydown);
      streetInput.addEventListener('focus', function() {
        var val = streetInput.value.trim();
        if (val.length >= 3 && currentSuggestions.length === 0) { debouncedFetch(val); }
      });
    } catch (err) { console.warn('Address autocomplete failed to load:', err); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 500); });
  } else { setTimeout(init, 500); }
})();
</script>

<!-- ============================================================
     Pipeline Calculator JS (Affordability calcs, toggle logic)
     ============================================================ -->
<script>
(function(){var s=document.createElement('script');s.src='https://mtg-broker-pipeline.rich-e00.workers.dev/static/pipeline-calcs.js';s.defer=true;document.body.appendChild(s);})();
</script>

<!-- ============================================================
     Pipeline App JS (Main app: load loans, save, modals, etc.)
     v13.3: Cache-bust to v15.15 for PA PDF extraction (v7.23 worker)
     ============================================================ -->
<script>
(function(){var s=document.createElement('script');s.src='https://mtg-broker-pipeline.rich-e00.workers.dev/static/pipeline-app.js';s.defer=true;document.body.appendChild(s);})();
</script>

<!-- ============================================================
     v11.2: Pipeline Checklist JS (Loan workflow checklist)
     Must load AFTER pipeline-app.js to access globals
     ============================================================ -->
<script>
(function(){var s=document.createElement('script');s.src='https://mtg-broker-pipeline.rich-e00.workers.dev/static/pipeline-checklist.js';s.defer=true;document.body.appendChild(s);})();
</script>

<!-- v13.0: Pipeline Documents JS -->
<script>
(function(){var s=document.createElement('script');s.src='https://mtg-broker-pipeline.rich-e00.workers.dev/static/pipeline-documents.js';s.defer=true;document.body.appendChild(s);})();
</script>

<!-- v13.2+: Pipeline Purchase Agreement JS (Contract tab) -->
<script>
(function(){var s=document.createElement('script');s.src='https://mtg-broker-pipeline.rich-e00.workers.dev/static/pipeline-purchase-agreement.js';s.defer=true;document.body.appendChild(s);})();
</script>

<!-- v13.7: Pipeline Closing Costs JS -->
<script>
(function(){var s=document.createElement('script');s.src='https://mtg-broker-pipeline.rich-e00.workers.dev/static/pipeline-closing-costs.js';s.defer=true;document.body.appendChild(s);})();
</script>

<!-- ============================================================
     v11.8: Zillow Lookup — opens Zillow search from address fields
     ============================================================ -->
<script>
function zillowLookup() {
  var street = (document.getElementById('property-street').value || '').trim();
  if (!street) { alert('Enter a street address first.'); return; }
  var addr = street;
  var city = (document.getElementById('property-city').value || '').trim();
  var state = (document.getElementById('property-state').value || '').trim();
  var zip = (document.getElementById('property-zip').value || '').trim();
  if (city) addr += ', ' + city;
  if (state) addr += ', ' + state;
  if (zip) addr += ' ' + zip;
  window.open('https://www.zillow.com/homes/' + encodeURIComponent(addr) + '_rb/', '_blank');
}
</script>

<!-- ============================================================
     v12.1+: Pricing Card, Pricing Notes, Layout hooks,
     v12.9: Loan Detail Bar, v13.8: Deal String
     ============================================================ -->
<script>
(function() {
  'use strict';
  /* Local escapeHtml for XSS safety (mirrors the one in pipeline-app.js) */
  function escapeHtml(str) { if (!str) return ''; return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* ══════════════════════════════════════════════
     CSS — injected at runtime (embed at 50K limit)
     ══════════════════════════════════════════════ */
  var css = document.createElement('style');
  css.textContent = ''
    /* v12.1: rate inputs + v12.2: 3-col names */
    +'.rate-input{text-align:left!important}'
    +'.cg3{grid-template-columns:1fr 1fr 1fr!important}'
    +'@media(max-width:900px){.cg3{grid-template-columns:1fr!important}}'
    /* v12.8: Assets tab styles */
    +'.ast-group{margin-bottom:16px;padding:14px 16px;border:1px solid #E2E8F0;border-radius:8px;background:#FAFBFE}'
    +'.ast-group:last-of-type{margin-bottom:8px}'
    +'.ast-group-title{font-size:12px;font-weight:700;color:#1E3A8A;text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #DBEAFE}'
    +'.ast-sub-label{font-size:12px;font-weight:600;color:#334155;margin-bottom:6px;margin-top:2px}'
    +'.ast-sync-btn{padding:4px 10px;font-size:11px;font-weight:600;border-radius:5px;cursor:pointer;border:1px solid #93C5FD;background:#EFF6FF;color:#2563EB;white-space:nowrap;display:flex;align-items:center;gap:4px;transition:background .15s,border-color .15s}'
    +'.ast-sync-btn:hover{background:#DBEAFE;border-color:#60A5FA}'
    +'.ast-sync-btn i{font-size:10px}'
    +'.ast-sync-msg{font-size:10px;color:#64748B;margin-top:2px;display:block;min-height:14px}'
    +'.ast-subtotal-row,.ast-total-row{display:flex;align-items:center;justify-content:space-between;padding:6px 0;font-size:13px;margin-top:6px}'
    +'.ast-subtotal-row span:first-child,.ast-total-row span:first-child{font-weight:600;color:#475569}'
    +'.ast-subtotal-row span:last-child,.ast-total-row span:last-child{font-weight:700;color:#1E293B}'
    +'.ast-total-row{border-top:2px solid #CBD5E1;padding-top:10px;margin-top:10px}'
    +'.ast-total-row span:last-child{font-size:15px;color:#1E40AF}'
    +'.ast-acct-row{margin-bottom:8px;border:1px solid #E2E8F0;border-radius:8px;padding:10px 12px;background:#fff;transition:background .1s}'
    +'.ast-acct-row:hover{background:#F8FAFC}'
    +'.ast-acct-fields{display:flex;align-items:flex-end;gap:8px;flex:1;min-width:0}'
    +'.ast-acct-fields .ff{margin-bottom:0}'
    +'.ast-acct-fields .ff label{font-size:11px;font-weight:600;color:#64748B;margin-bottom:3px}'
    +'.ast-acct-fields .ff select,.ast-acct-fields .ff input{font-size:13px;padding:7px 10px}'
    +'.ast-remove-btn{background:none;border:none;color:#CBD5E1;cursor:pointer;font-size:16px;padding:6px;border-radius:4px;transition:all .15s;line-height:1;flex-shrink:0;align-self:flex-end;margin-bottom:2px}'
    +'.ast-remove-btn:hover{color:#EF4444;background:#FEF2F2}'
    +'.ast-acct-desc-row{display:flex;gap:8px;margin-top:6px}'
    +'.ast-acct-desc-row.hidden{display:none}'
    +'.ast-add-btn{display:flex;align-items:center;gap:6px;padding:8px 12px;border:1px dashed #CBD5E1;border-radius:6px;background:#FAFBFE;color:#64748B;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s}'
    +'.ast-add-btn:hover{border-color:#93C5FD;color:#3B82F6;background:#EFF6FF}'
    +'.ast-add-btn i{font-size:11px}'
    +'.ast-acct-total{display:flex;align-items:center;gap:8px;font-size:13px}'
    +'.ast-acct-total span:first-child{font-weight:600;color:#475569}'
    +'.ast-acct-total .ast-total-val{font-weight:700;color:#1E293B;font-size:14px}'
    +'.ast-acct-grand-total{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;margin-top:12px;border-radius:8px;background:linear-gradient(135deg,#EFF6FF 0%,#DBEAFE 100%);border:1px solid #93C5FD}'
    +'.ast-acct-grand-total span:first-child{font-size:13px;font-weight:700;color:#1E3A8A}'
    +'.ast-acct-grand-val{font-size:16px;font-weight:800;color:#1D4ED8}'
    /* v13.1: Asset Summary card (Excess / Shortage) */
    +'.ast-summary-card{max-width:none!important}'
    +'.ast-summary-grid{display:flex;align-items:center;justify-content:center;gap:16px;padding:12px 0;flex-wrap:wrap}'
    +'.ast-summary-item{text-align:center;min-width:140px}'
    +'.ast-summary-label{font-size:11px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px}'
    +'.ast-summary-value{font-size:18px;font-weight:700;color:#1E293B}'
    +'.ast-summary-op{font-size:20px;font-weight:300;color:#94A3B8;padding:0 4px}'
    +'.ast-summary-result{padding:10px 20px;border-radius:8px;background:#F8FAFC;border:1px solid #E2E8F0}'
    +'.ast-summary-result-val{font-size:22px;font-weight:800}'
    +'.ast-excess{color:#15803D!important}'
    +'.ast-shortage{color:#DC2626!important}'
    +'.ast-summary-result:has(.ast-excess){background:#F0FDF4;border-color:#86EFAC}'
    +'.ast-summary-result:has(.ast-shortage){background:#FEF2F2;border-color:#FECACA}'
    +'.ast-grand-total{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;margin-top:12px;border-radius:8px;background:linear-gradient(135deg,#EFF6FF 0%,#DBEAFE 100%);border:1px solid #93C5FD}'
    +'.ast-grand-total span:first-child{font-size:14px;font-weight:700;color:#1E3A8A}'
    +'.ast-grand-val{font-size:17px;font-weight:800;color:#1D4ED8}'
    +'.ast-hint{font-size:11px;color:#94A3B8;font-weight:400;margin-left:auto;margin-right:8px}'
    +'@media(max-width:600px){.ast-acct-fields{flex-wrap:wrap}.ast-acct-fields .ff{min-width:100%!important}}'
    /* v12.1: Pricing summary */
    +'.ld-col-left{grid-column:1!important;max-width:none!important;justify-self:stretch!important;width:100%!important}'
    +'.ld-col-right{grid-column:2!important;grid-row:1/span 4!important;max-width:none!important;justify-self:stretch!important;width:100%!important;align-self:start;min-width:0!important}'
    +'.ld-pe-strip{padding:8px 0;margin-bottom:10px;border-bottom:1px solid #F1F5F9}'
    +'.ld-pe-label{font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}'
    +'.ld-pe-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}'
    +'.ld-pe-btn{display:flex;align-items:center;gap:6px;padding:8px 10px;border:1px solid #E2E8F0;border-radius:6px;background:#fff;text-decoration:none;transition:all .15s}'
    +'.ld-pe-btn:hover{background:#EFF6FF;border-color:#93C5FD}'
    +'.ld-pe-logo{width:16px;height:16px;border-radius:3px;object-fit:contain;flex-shrink:0}'
    +'.ld-pe-name{font-size:11px;font-weight:600;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    +'.ld-pe-arrow{width:12px;height:12px;flex-shrink:0;color:#94A3B8;margin-left:auto}'
    +'.ps-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}'
    +'.ps-label{font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.5px}'
    +'.ps-refresh{font-size:10px;font-weight:600;color:#3B82F6;background:none;border:none;cursor:pointer;padding:2px 6px;border-radius:4px;transition:background .15s}'
    +'.ps-refresh:hover{background:#EFF6FF}'
    +'.ps-table{width:100%;border-collapse:collapse;font-size:13px}'
    +'.ps-table tr{border-bottom:1px solid #F1F5F9}.ps-table tr:last-child{border-bottom:none}'
    +'.ps-table td{padding:7px 0;vertical-align:middle}'
    +'.ps-table td:first-child{color:#64748B;font-weight:500;padding-right:12px;white-space:nowrap}'
    +'.ps-table td:last-child{text-align:right;font-weight:600;color:#1E293B}'
    +'.ps-empty{color:#CBD5E1!important;font-weight:400!important;font-style:italic}'
    +'.ps-purchase-only{display:none}.ps-purchase-only.ps-show{display:table-row}'
    +'.ps-notes-textarea{width:100%;min-height:80px;padding:8px 10px;border:1px solid #E2E8F0;border-radius:6px;font-size:13px;font-family:inherit;color:#1E293B;background:#F8FAFC;resize:vertical;transition:all .15s;box-sizing:border-box}'
    +'.ps-notes-textarea:focus{outline:none;border-color:#3B82F6;background:#fff;box-shadow:0 0 0 3px rgba(59,130,246,.1)}'
    +'.ps-notes-textarea::placeholder{color:#CBD5E1}'
    +'@media(max-width:900px){.ld-col-left,.ld-col-right{grid-column:1/-1!important;grid-row:auto!important}}'
    /* v13.1: Pricing card in right column — 2-col engines grid, prevent text overflow */
    +'.ld-col-right .ld-pe-grid{grid-template-columns:repeat(2,1fr)!important}'
    +'.ld-col-right .ps-table td:first-child{max-width:120px;overflow:hidden;text-overflow:ellipsis}'
    /* v12.9: Assets 2-column layout (left: Cash/Reserves, right: Accounts) */
    +'.ast-col-left{grid-column:1!important;max-width:none!important;justify-self:stretch!important;width:100%!important}'
    +'.ast-col-right{grid-column:2!important;max-width:none!important;justify-self:stretch!important;width:100%!important;align-self:start;min-width:0!important}'
    +'@media(max-width:900px){.ast-col-left,.ast-col-right,.ast-summary-card{grid-column:1/-1!important;grid-row:auto!important}}'
    /* v12.9: Loan Detail Bar */
    +'.loan-detail-bar{display:flex;align-items:center;gap:6px;padding:6px 24px;background:#F8FAFC;border-bottom:1px solid #E2E8F0;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}'
    +'.loan-detail-bar::-webkit-scrollbar{display:none}'
    +'.loan-detail-bar.hidden{display:none}'
    +'.ldb-chip{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;background:#fff;border:1px solid #E2E8F0;border-radius:6px;font-size:12px;font-weight:500;color:#334155;cursor:pointer;white-space:nowrap;transition:all .15s;flex-shrink:0;line-height:1.3}'
    +'.ldb-chip:hover{background:#EFF6FF;border-color:#93C5FD;color:#1E40AF}'
    +'.ldb-label{font-size:10px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.4px}'
    +'.ldb-chip:hover .ldb-label{color:#60A5FA}'
    +'.ldb-dot{width:3px;height:3px;border-radius:50%;background:#CBD5E1;flex-shrink:0}'
    +'.ldb-val{font-size:12px;font-weight:600;color:#1E293B}'
    +'.ldb-chip:hover .ldb-val{color:#1E40AF}'
    +'.ldb-val.ldb-empty{color:#CBD5E1;font-weight:400;font-style:italic}'
    +'@media(max-width:900px){.loan-detail-bar{padding:5px 12px;gap:5px}.ldb-chip{padding:3px 8px}.ldb-label{font-size:9px}.ldb-val{font-size:11px}}'
    /* v13.8: Deal String — clickable copy element in deal-status-bar */
    +'.deal-string-wrap{flex:1;min-width:0;display:flex;align-items:center;overflow:hidden}'
    +'.deal-string-btn{display:flex;align-items:center;gap:6px;padding:4px 10px;background:rgba(255,255,255,.6);border:1px solid #D4A017;border-radius:6px;cursor:pointer;max-width:100%;min-width:0;transition:all .15s}'
    +'.deal-string-btn:hover{background:#fff;border-color:#B8860B;box-shadow:0 1px 4px rgba(0,0,0,.08)}'
    +'.deal-string-text{font-size:11px;color:#6B4F00;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500;line-height:1.3}'
    +'.deal-string-icon{flex-shrink:0;font-size:12px;color:#9A7B00;transition:color .15s}'
    +'.deal-string-btn:hover .deal-string-icon{color:#6B4F00}'
    +'.deal-string-btn.ds-copied{background:#ECFDF5;border-color:#34D399}'
    +'.deal-string-btn.ds-copied .deal-string-text{color:#047857}'
    +'.deal-string-btn.ds-copied .deal-string-icon{color:#059669}'
    +'.deal-string-empty{font-size:11px;color:#B8A060;font-style:italic;padding:0 8px}'
    +'@media(max-width:900px){.deal-string-wrap{display:none}}';
  document.head.appendChild(css);


  /* ══════════════════════════════════════════════
     PRICING CARD HTML TEMPLATES
     ══════════════════════════════════════════════ */
  var arrow = '<svg class="ld-pe-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>';
  var lsLogo = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAAAAAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCABAAEADASIAAhEBAxEB/8QAGwAAAgIDAQAAAAAAAAAAAAAABwgACQEFBgr/xAA3EAABAwMCBAQBCwUDAAAAAAABAgMEBQYRAAcIEiFBEzFRYXEJFCIjMlKBgpGhsRVCQ2IWNXL/xAAZAQEBAQEBAQAAAAAAAAAAAAAGBQQHAAP/xAAwEQABAwIDBAkEAwAAAAAAAAABAgMEAAURITETQVGRBhJhcYGhwdHwFBUy8SKx4f/aAAwDAQACEQMRAD8AtT1NTWCca9XqzqaHF97/AFm2DIciTKgqZUEHCoUBHiuIPoo5CUn2Jz7aGznGlSg7hu16gpr7ypLYV+nX+dR37xAjL6jroB5/1jVmPZrhKRtGmSRx05Y4UyGtbcVxUy0qFPrVZnMU2lQWVSJMuSsIbabSMlSifIDQxs7ijsm53240mQ/QpKyEhNSQEtk58vESSkfjjQ4+UkpFauDhUraqEHJDEaZEm1BEf6RXDQ5lZwPNKT4az7IJ8hqlBkR55GxcBBO7dU+XFkQj1X0FJ7d/dxqUL5SzY+u3YiiCr1KA0474TdWn05bMJRJwCVk8yEn7y0pA7kaaRpxLzaVoUFIUAQpJyCPXXnKAyPLmB6YAzzZ7D1z6d9X18MlGrtvcP23tMuVLqK5FokVqU2+SXG1BsYQrP9yU8qT7jVydERHAKDrUxh1ThINEzS1cSm/MqmTHrPtqQucce6G0l5b11g21ZDr9ShyVR6rXo1VVFaqL6DyrKWUoUCQUlPi9CrHkRgln+Gfiw2Z2v4WK7XqFbT1rroEhtqoUBEj5zKmzHgQytL6sF0OchHMrHIG1DACRlEOIDh4u/aHcKqwpVInVCjSpTj9KrMSOt+POjuLK21JcQCOblUAUk5Bz2wSWtvOBTci5uGi8LiNGlwq1ImQplKoElJakzY7Ae8VXIrBSpQfy2lWCeQ/eGuuuNx1MIBX/HLfr88q5qkuBass+6i1aPyuc527Gk3PYUSJbDjvK47TJq3ZcZsn7eFpCXMDqQOUnt16ab7iUrtPq2xL0+JIblQ6guG7DfbOUupWtK0qT7FPX4apltHZK/b5u1u2KLaNYkVtbngqjvQXWQwc4KnlLSA2kdyrGP21Y3uxW2qHZ1k7W0yb/U49p0+PCly2eqZEptoNYT6hOFfirHbQ7pauNBt6urkpYKQOOOVKejDD0y4N8EEKJ4Ye+lGjgzZcTYVacVkNrqh5D64abzpgNcHshY7lg7b0mmSE8k5SDIlD0dWeZSfw6J/LrvNY7UwqNBaaXqAMfHOvl2fTJnvOo0JOHdpU0HN+thmtzYyapS1NxLjjI5EqX0RKQMkIWexHXlV2zg9PIx6xjWqVFamNFl4YpNZIkt6E8H2DgofMD2Uj1obtXzsTNVQqjDWqG2r/q6mFJ5OvUsrHkD7cyevlopMcaFKMb662Kgh/HVCJDak5/9HB/bR/rNu0y4Yhi1SnxqjHP+KUylxP6EdNcW5w8bdOulxVqwwo9cJU4lP6BWNF0Wu6wxs4ckFG4KGnkfTupWu62madpNjEL3lJyPhiPU9tLtfHE7dd+hVGoEJVGZk/V+HDUp+Y6D05QoDp+UZ99dxsBw3SKPOjXLdjAblMkOQ6YrCi0rs4725h2T2PU9egPNuWLb9otlNFo8KmZGCqMwlKlfFXmf11vAMa0RrItT4lXF3aLGg0SPD9Vnk3xCWDEtrWyQdTqo+P8AprOpqamldEa//9k=';

  var pricingCardHtml = '<div class="card section-card section-hidden" id="pricing-summary-card" data-page="section-pricing"><div class="card-title"><i class="fa-solid fa-tags"></i> Pricing</div><div class="ld-pe-strip"><div class="ld-pe-label">Pricing Engines</div><div class="ld-pe-grid"><a href="https://marketplace.digitallending.com/#/login" target="_blank" rel="noopener noreferrer" class="ld-pe-btn"><img src="https://www.google.com/s2/favicons?domain=lenderprice.com&sz=32" alt="" class="ld-pe-logo"><span class="ld-pe-name">LenderPrice</span>'+arrow+'</a><a href="https://web.loannex.com/" target="_blank" rel="noopener noreferrer" class="ld-pe-btn"><img src="https://www.google.com/s2/favicons?domain=loannex.com&sz=32" alt="" class="ld-pe-logo"><span class="ld-pe-name">LoanNEX</span>'+arrow+'</a><a href="https://loansifternow.optimalblue.com/" target="_blank" rel="noopener noreferrer" class="ld-pe-btn"><img src="'+lsLogo+'" alt="" class="ld-pe-logo"><span class="ld-pe-name">LoanSifter</span>'+arrow+'</a><a href="https://lx.pollyex.com/accounts/login/" target="_blank" rel="noopener noreferrer" class="ld-pe-btn"><img src="https://www.google.com/s2/favicons?domain=polly.io&sz=32" alt="" class="ld-pe-logo"><span class="ld-pe-name">Polly</span>'+arrow+'</a></div></div><div class="ps-hdr"><div class="ps-label">Pricing Summary</div><button type="button" class="ps-refresh" onclick="refreshPricingSummary()" title="Refresh from form fields"><i class="fa-solid fa-arrows-rotate" style="margin-right:4px;font-size:10px;"></i> Refresh</button></div><table class="ps-table" id="ps-table"><tbody><tr><td>Loan Type</td><td id="ps-loan-type">\\u2014</td></tr><tr><td>Loan Term (Years)</td><td id="ps-loan-term">\\u2014</td></tr><tr><td>Loan Purpose</td><td id="ps-loan-purpose">\\u2014</td></tr><tr><td>Property Value</td><td id="ps-property-value">\\u2014</td></tr><tr class="ps-purchase-only" id="ps-row-purchase-price"><td>Purchase Price</td><td id="ps-purchase-price">\\u2014</td></tr><tr><td>Base Loan Amount</td><td id="ps-loan-amount">\\u2014</td></tr><tr><td>LTV</td><td id="ps-ltv">\\u2014</td></tr><tr class="ps-purchase-only" id="ps-row-down-pct"><td>Down Payment %</td><td id="ps-down-pct">\\u2014</td></tr><tr class="ps-purchase-only" id="ps-row-down-amt"><td>Down Payment $</td><td id="ps-down-amt">\\u2014</td></tr><tr><td>Loan Level FICO</td><td id="ps-fico">\\u2014</td></tr><tr><td>Total Monthly Income</td><td id="ps-monthly-income">\\u2014</td></tr><tr><td>Occupancy</td><td id="ps-occupancy">\\u2014</td></tr><tr><td>Zip Code</td><td id="ps-zip">\\u2014</td></tr><tr><td>Address</td><td id="ps-address">\\u2014</td></tr></tbody></table></div>';

  /* v8.3: Renamed "Pricing Notes" → "Loan Details Notes" (stays in loan-details) */
  var loanDetailsNotesHtml = '<div class="card section-card section-hidden" id="loan-details-notes-card" data-page="section-loan-details"><div class="card-title"><i class="fa-solid fa-pen-to-square"></i> Loan Details Notes</div><div class="ff"><textarea class="ps-notes-textarea" id="loan-details-notes" placeholder="Loan details notes, conditions, special requirements..."></textarea></div></div>';

  /* v8.3: New Pricing Notes card for Pricing tab */
  var pricingNotesHtml = '<div class="card section-card section-hidden" id="pricing-notes-card" data-page="section-pricing"><div class="card-title"><i class="fa-solid fa-pen-to-square"></i> Notes</div><div class="ff"><textarea class="ps-notes-textarea" id="pricing-notes" placeholder="Rate lock details, pricing adjustments, LLPAs, etc..."></textarea></div></div>';


  /* ══════════════════════════════════════════════
     PRICING SUMMARY HELPERS + REFRESH
     ══════════════════════════════════════════════ */
  function fmtCurrency(val) {
    var num = parseFloat(String(val).replace(/[^0-9.\\-]/g, ''));
    if (isNaN(num)) return '';
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function getVal(id) {
    var el = document.getElementById(id); if (!el) return '';
    if (el.tagName === 'SELECT') { var o = el.options[el.selectedIndex]; return o ? o.text : ''; }
    return (el.value || '').trim();
  }
  function getNum(id) { return parseFloat(getVal(id).replace(/[^0-9.\\-]/g, '')) || 0; }
  function setCell(id, value) {
    var el = document.getElementById(id); if (!el) return;
    if (!value || value === 'Select...' || value === '\\u2014') { el.textContent = '\\u2014'; el.className = 'ps-empty'; }
    else { el.textContent = value; el.className = ''; }
  }

  window.refreshPricingSummary = function() {
    var loanType=getVal('loan-type'),loanTerm=getVal('loan-term'),loanPurpose=getVal('loan-purpose');
    var propValue=getNum('property-value'),purchasePrice=getNum('purchase-price'),loanAmt=getNum('loan-amount'),ltv=getNum('ltv');
    var fico=getVal('credit-score'),occupancy=getVal('occupancy'),zip=getVal('property-zip'),street=getVal('property-street');
    var occDisplay = occupancy;
    if (occupancy === 'Primary Residence') occDisplay = 'Primary';
    if (occupancy === 'Investment Property') occDisplay = 'Investment';
    var isPurchase = loanPurpose.toLowerCase().indexOf('purchase') !== -1;
    document.querySelectorAll('.ps-purchase-only').forEach(function(row) {
      row.classList.toggle('ps-show', isPurchase);
    });
    var basis=purchasePrice||propValue, downPct=0, downAmt=0;
    if (isPurchase && basis > 0 && loanAmt > 0) { downAmt=basis-loanAmt; downPct=(downAmt/basis)*100; }
    else if (isPurchase && ltv > 0) { downPct=100-ltv; if(basis>0)downAmt=basis*(downPct/100); }
    var bVal=getNum('borrower-income'),cVal=getNum('coborrower-income');
    var bMode=window.borrowerIncomeMode||'annual',cMode=window.coBorrowerIncomeMode||'annual';
    var bA=(bMode==='monthly')?bVal*12:bVal, cA=(cMode==='monthly')?cVal*12:cVal;
    var monthlyIncome=(bA+cA)/12;
    setCell('ps-loan-type',loanType); setCell('ps-loan-term',loanTerm||'');
    setCell('ps-loan-purpose',loanPurpose);
    setCell('ps-property-value',propValue?fmtCurrency(propValue):'');
    setCell('ps-purchase-price',purchasePrice?fmtCurrency(purchasePrice):'');
    setCell('ps-loan-amount',loanAmt?fmtCurrency(loanAmt):'');
    setCell('ps-ltv',ltv?(ltv+'%'):'');
    setCell('ps-down-pct',downPct?(downPct.toFixed(2)+'%'):'');
    setCell('ps-down-amt',downAmt?fmtCurrency(downAmt):'');
    setCell('ps-fico',fico); setCell('ps-occupancy',occDisplay);
    setCell('ps-zip',zip); setCell('ps-address',street);
    setCell('ps-monthly-income',monthlyIncome?fmtCurrency(monthlyIncome):'');
  };


  /* ══════════════════════════════════════════════
     v12.9: LOAN DETAIL BAR — clickable info chips
     ══════════════════════════════════════════════ */
  function buildLoanDetailBar() {
    var header = document.querySelector('.modal-header');
    if (!header || document.getElementById('loan-detail-bar')) return;
    var bar = document.createElement('div');
    bar.id = 'loan-detail-bar';
    bar.className = 'loan-detail-bar hidden';
    header.insertAdjacentElement('afterend', bar);
  }

  function updateLoanDetailBar() {
    var bar = document.getElementById('loan-detail-bar');
    if (!bar) return;
    var isNew = document.getElementById('modal-title').textContent === 'New Loan';
    if (isNew) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');

    function chip(label, valId, navTarget) {
      var el = document.getElementById(valId);
      var val = el ? (el.tagName === 'SELECT' ? (el.options[el.selectedIndex]||{}).text||'' : el.value||'') : '';
      if (val === 'Select...' || val === '-') val = '';
      var isEmpty = !val;
      var display = val;
      if (valId === 'ltv' && val) display = val + '%';
      if (valId === 'loan-interest-rate' && val) display = val + '%';
      return '<div class="ldb-chip" onclick="'+navTarget+'" title="Go to '+escapeHtml(label)+'">'
        +'<span class="ldb-label">'+escapeHtml(label)+'</span>'
        +'<span class="ldb-dot"></span>'
        +'<span class="ldb-val'+(isEmpty?' ldb-empty':'')+'">'+(display?escapeHtml(display):'\\u2014')+'</span>'
        +'</div>';
    }

    var checklistBadge = document.getElementById('checklist-badge');
    var checklistVal = checklistBadge ? checklistBadge.textContent : '0/43';

    bar.innerHTML = ''
      + chip('Stage', 'loan-stage', "showSection('main')")
      + chip('Address', 'property-street', "showSection('section-property')")
      + chip('Credit', 'credit-score', "showSection('section-credit')")
      + chip('Occupancy', 'occupancy', "showSection('main')")
      + chip('Purpose', 'loan-purpose', "showSection('main')")
      + chip('Type', 'loan-type', "showSection('section-loan-details')")
      + chip('Lender', 'loan-lender', "showSection('main')")
      + chip('Rate', 'loan-interest-rate', "showSection('section-loan-details')")
      + '<div class="ldb-chip" onclick="toggleChecklistPanel()" title="Open Checklist">'
      + '<span class="ldb-label">Checklist</span><span class="ldb-dot"></span>'
      + '<span class="ldb-val">'+checklistVal+'</span></div>';
  }

  /* Debounced updater for field changes */
  var ldbTimer = null;
  function scheduleLdbUpdate() {
    clearTimeout(ldbTimer);
    ldbTimer = setTimeout(function() {
      updateLoanDetailBar();
      updateDealString(); /* v13.8: also refresh deal string */
    }, 200);
  }


  /* ══════════════════════════════════════════════
     v13.8: DEAL STRING — copy-to-clipboard in deal-status-bar
     Builds " - " delimited string from form fields.
     Empty segments skipped. Placeholder IDs for future fields:
     processor, title-rep, loan-number, affordable-loan-type
     ══════════════════════════════════════════════ */

  /* Inject the deal string container into the deal-status-bar */
  function injectDealStringEl() {
    var statusBar = document.getElementById('deal-status-bar');
    if (!statusBar || document.getElementById('deal-string-wrap')) return;
    /* Find the right side (Last Contact) to insert before it */
    var rightDiv = statusBar.querySelector('.deal-status-right');
    var wrap = document.createElement('div');
    wrap.id = 'deal-string-wrap';
    wrap.className = 'deal-string-wrap';
    wrap.innerHTML = '<div class="deal-string-btn" onclick="copyDealString()" title="Click to copy deal string">'
      + '<i class="fa-regular fa-copy deal-string-icon"></i>'
      + '<span class="deal-string-text" id="deal-string-text"></span></div>';
    if (rightDiv) {
      statusBar.insertBefore(wrap, rightDiv);
    } else {
      statusBar.appendChild(wrap);
    }
  }

  /* Build the deal string from form fields */
  function buildDealString() {
    /* Helper: get trimmed value from an element by ID (supports input + select) */
    function gv(id) {
      var el = document.getElementById(id);
      if (!el) return '';
      if (el.tagName === 'SELECT') {
        var opt = el.options[el.selectedIndex];
        var txt = opt ? opt.text : '';
        return (txt === 'Select...' || txt === '-' || txt === '') ? '' : txt.trim();
      }
      return (el.value || '').trim();
    }

    /* Borrower Name (first + last combined) */
    var bFirst = gv('borrower-first'), bLast = gv('borrower-last');
    var borrower = [bFirst, bLast].filter(Boolean).join(' ');

    /* Co-Borrower Name */
    var cFirst = gv('co-borrower-first'), cLast = gv('co-borrower-last');
    var coBorrower = [cFirst, cLast].filter(Boolean).join(' ');

    /* Names portion: "Borrower & Co-Borrower" or just "Borrower" */
    var names = borrower;
    if (coBorrower) names += ' & ' + coBorrower;

    /* Buyer Agent + Seller Agent from Purchase Agreement tab */
    var buyerAgent = gv('pa-buyers-agent');
    var sellerAgent = gv('pa-sellers-agent');

    /* Processor + Title Rep — placeholder IDs (not yet in form) */
    var processor = gv('processor');
    var titleRep = gv('title-rep');

    /* Lender */
    var lender = gv('loan-lender');

    /* Loan Number — placeholder ID (not yet in form) */
    var loanNumber = gv('loan-number');

    /* Loan Type + Affordable Loan Type */
    var loanType = gv('loan-type');
    var affordableType = gv('affordable-loan-type');
    var loanTypeStr = [loanType, affordableType].filter(Boolean).join(' ');

    /* Occupancy */
    var occupancy = gv('occupancy');

    /* Address: Street, City State Zip */
    var street = gv('property-street');
    var city = gv('property-city');
    var state = gv('property-state');
    var zip = gv('property-zip');
    var cityStateZip = [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    var fullAddress = street;
    if (cityStateZip) fullAddress += (street ? ', ' : '') + cityStateZip;

    /* Build segments array — labeled items get their prefix,
       unlabeled items (names, agents, lender) are bare values.
       Empty segments are skipped entirely. */
    var segments = [];
    if (names) segments.push(names);
    if (buyerAgent) segments.push(buyerAgent);
    if (sellerAgent) segments.push(sellerAgent);
    if (processor) segments.push(processor);
    if (titleRep) segments.push(titleRep);
    if (lender) segments.push(lender);
    if (loanNumber) segments.push('Loan#: ' + loanNumber);
    if (loanTypeStr) segments.push('Loan Type: ' + loanTypeStr);
    if (occupancy) segments.push('Occupancy: ' + occupancy);
    if (fullAddress) segments.push(fullAddress);

    return segments.join(' - ');
  }

  /* Update the deal string display */
  function updateDealString() {
    var textEl = document.getElementById('deal-string-text');
    if (!textEl) return;
    var str = buildDealString();
    var wrap = document.getElementById('deal-string-wrap');
    if (!str) {
      if (wrap) wrap.style.display = 'none';
      return;
    }
    if (wrap) wrap.style.display = '';
    textEl.textContent = str;
    textEl.title = str; /* full text on hover */
  }

  /* Copy deal string to clipboard + visual feedback */
  window.copyDealString = function() {
    var str = buildDealString();
    if (!str) return;
    navigator.clipboard.writeText(str).then(function() {
      var btn = document.querySelector('.deal-string-btn');
      if (!btn) return;
      btn.classList.add('ds-copied');
      var icon = btn.querySelector('.deal-string-icon');
      var textEl = btn.querySelector('.deal-string-text');
      var origText = textEl.textContent;
      if (icon) icon.className = 'fa-solid fa-check deal-string-icon';
      textEl.textContent = 'Copied!';
      setTimeout(function() {
        btn.classList.remove('ds-copied');
        if (icon) icon.className = 'fa-regular fa-copy deal-string-icon';
        textEl.textContent = origText;
      }, 1500);
    }).catch(function() {
      /* Fallback for older browsers */
      var ta = document.createElement('textarea');
      ta.value = str;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    });
  };


  /* ══════════════════════════════════════════════
     INJECTION ON DOM READY
     ══════════════════════════════════════════════ */
  function injectPricingCards() {
    var pages = document.getElementById('section-pages');
    if (!pages) return;
    if (document.getElementById('pricing-summary-card')) return;
    /* v8.3: Pricing card + Pricing Notes → Pricing tab; Loan Details Notes → Loan Details tab */
    pages.insertAdjacentHTML('beforeend', pricingCardHtml);
    pages.insertAdjacentHTML('beforeend', pricingNotesHtml);
    pages.insertAdjacentHTML('beforeend', loanDetailsNotesHtml);
  }

  function setup() {
    injectPricingCards();
    buildLoanDetailBar();
    injectDealStringEl(); /* v13.8: inject deal string container */

    /* Listen for form changes to update detail bar + deal string */
    var form = document.getElementById('loan-form');
    if (form) {
      form.addEventListener('change', scheduleLdbUpdate);
      form.addEventListener('input', scheduleLdbUpdate);
    }

    /* Watch checklist badge changes via MutationObserver */
    var checkBadge = document.getElementById('checklist-badge');
    if (checkBadge) {
      var obs = new MutationObserver(scheduleLdbUpdate);
      obs.observe(checkBadge, { childList: true, characterData: true, subtree: true });
    }

    /* Watch modal open/close to update detail bar + deal string */
    var modal = document.getElementById('loan-modal');
    if (modal) {
      var lastHidden = modal.classList.contains('hidden');
      new MutationObserver(function() {
        var h = modal.classList.contains('hidden');
        if (h !== lastHidden) {
          lastHidden = h;
          if (!h) setTimeout(function() { refreshPricingSummary(); updateLoanDetailBar(); updateDealString(); }, 200);
        }
      }).observe(modal, { attributes: true, attributeFilter: ['class'] });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(setup, 600); });
  } else {
    setTimeout(setup, 600);
  }
})();
</script>

<!-- ============================================================
     v12.8: Pipeline Assets JS Module Loader
     ============================================================ -->
<script>
(function(){var s=document.createElement('script');s.src='https://mtg-broker-pipeline.rich-e00.workers.dev/static/pipeline-assets.js';s.defer=true;document.body.appendChild(s);})();
</script>

<!-- v8.3: Pipeline Liabilities JS Module Loader -->
<script>
(function(){var s=document.createElement('script');s.src='https://mtg-broker-pipeline.rich-e00.workers.dev/static/pipeline-liabilities.js';s.defer=true;document.body.appendChild(s);})();
</script>

<!-- v13.1: showSection 2-column layout fix -->
<script>
(function() {
  'use strict';
  var TWO_COL_PAGES = ['section-loan-details', 'section-assets', 'section-comp-pay', 'section-notes', 'section-pricing', 'section-liabilities'];

  function hookShowSection() {
    if (typeof window.showSection !== 'function') return false;
    if (window._showSectionHooked) return true;
    var origShowSection = window.showSection;

    window.showSection = function(pageId) {
      origShowSection(pageId);
      if (TWO_COL_PAGES.indexOf(pageId) === -1) return;

      var pages = document.getElementById('section-pages');
      if (!pages) return;

      var cards = pages.querySelectorAll('[data-page="' + pageId + '"]');

      /* ── LOAN DETAILS ── */
      if (pageId === 'section-loan-details') {
        cards.forEach(function(card) {
          card.classList.remove('section-full');
          if (!card.classList.contains('ld-col-right') && !card.classList.contains('ld-col-left')) card.classList.add('ld-col-left');
        });
      }
      /* ── ASSETS ── */
      if (pageId === 'section-assets') {
        cards.forEach(function(card) {
          card.classList.remove('section-full');
          if (card.id === 'section-assets-right') { if (!card.classList.contains('ast-col-right')) card.classList.add('ast-col-right'); }
          else { if (!card.classList.contains('ast-col-left')) card.classList.add('ast-col-left'); }
        });
      }
      /* ── PRICING v8.3 ── */
      if (pageId === 'section-pricing') {
        cards.forEach(function(card) { card.classList.remove('section-full'); });
      }
      /* ── LIABILITIES v8.3 ── */
      if (pageId === 'section-liabilities') {
        cards.forEach(function(card) { card.classList.remove('section-full'); });
      }
      /* ── COMP/PAY ── */
      if (pageId === 'section-comp-pay') { cards.forEach(function(card) { card.classList.remove('section-full'); }); }
      /* ── NOTES ── */
      if (pageId === 'section-notes') {
        var visibleNoteCards = 0;
        cards.forEach(function(card) {
          if (!card.classList.contains('hidden')) visibleNoteCards++;
        });
        if (visibleNoteCards >= 2) {
          cards.forEach(function(card) {
            if (!card.classList.contains('hidden')) {
              card.classList.remove('section-full');
            }
          });
        }
      }
    };

    window._showSectionHooked = true;
    return true;
  }

  /* Poll until showSection is available (pipeline-app.js loads async) */
  if (!hookShowSection()) {
    var attempts = 0;
    var timer = setInterval(function() {
      if (hookShowSection() || ++attempts > 50) clearInterval(timer);
    }, 100);
  }
})();
</script>

<!-- ============================================================
     Lender Searchable Dropdown (v1.0)
     Fetches lender names from /api/lenders, builds a filterable
     dropdown with "Other" option + manual entry fallback.
     ============================================================ -->
<script>
(function() {
  'use strict';
  /* Local escapeHtml for XSS safety (mirrors the one in pipeline-app.js) */
  function escapeHtml(str) { if (!str) return ''; return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  var WORKER_BASE = 'https://mtg-broker-pipeline.rich-e00.workers.dev';
  var allLenders = [];    /* array of {name, website_url, tpo_portal_url, ...} */
  var lenderMap = {};     /* name → lender object for quick lookup */
  var dropdownOpen = false;
  var activeIndex = -1;

  /* DOM references (set in init) */
  var searchInput, hiddenInput, dropdown, otherWrap, otherInput, clearBtn, linksDiv;

  /* Fetch lender list from API (now returns objects with URLs) */
  function fetchLenders() {
    fetch(WORKER_BASE + '/api/lenders')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        allLenders = data || [];
        /* Build lookup map: name → lender object */
        lenderMap = {};
        for (var i = 0; i < allLenders.length; i++) {
          lenderMap[allLenders[i].name] = allLenders[i];
        }
      })
      .catch(function(err) { console.warn('Failed to load lenders:', err); });
  }

  /* Highlight matching text in lender name */
  function highlightMatch(name, query) {
    if (!query) return escapeHtml(name);
    var idx = name.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return escapeHtml(name);
    return escapeHtml(name.substring(0, idx))
      + '<span class="lender-match">' + escapeHtml(name.substring(idx, idx + query.length)) + '</span>'
      + escapeHtml(name.substring(idx + query.length));
  }

  /* Render dropdown items */
  function renderDropdown(query) {
    var filtered;
    if (!query) {
      filtered = allLenders.slice();
    } else {
      var q = query.toLowerCase();
      filtered = allLenders.filter(function(l) { return l.name.toLowerCase().indexOf(q) !== -1; });
    }

    var html = '';
    html += '<div class="lender-dropdown-item lender-other-item" data-value="__OTHER__">Other (not in list)</div>';

    for (var i = 0; i < filtered.length; i++) {
      html += '<div class="lender-dropdown-item" data-value="' + filtered[i].name.replace(/"/g, '&quot;') + '">'
        + highlightMatch(filtered[i].name, query) + '</div>';
    }

    if (filtered.length === 0 && query) {
      html += '<div class="lender-dropdown-item" style="color:#9ca3af;cursor:default;">No matches found</div>';
    }

    dropdown.innerHTML = html;
    activeIndex = -1;
  }

  /* Open / close dropdown */
  function openDropdown() {
    dropdown.classList.add('open');
    dropdownOpen = true;
  }
  function closeDropdown() {
    dropdown.classList.remove('open');
    dropdownOpen = false;
    activeIndex = -1;
  }

  /* Show lender quick links for the selected lender */
  function showLenderLinks(lenderName) {
    if (!linksDiv) return;
    var lender = lenderMap[lenderName];
    if (!lender) {
      linksDiv.classList.remove('visible');
      linksDiv.innerHTML = '';
      return;
    }

    var links = [];
    if (lender.website_url) {
      var url = lender.website_url;
      if (url.indexOf('://') === -1) url = 'https://' + url;
      links.push('<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener"><i class="fa-solid fa-globe"></i> Website</a>');
    }
    if (lender.tpo_portal_url) {
      links.push('<a href="' + escapeHtml(lender.tpo_portal_url) + '" target="_blank" rel="noopener"><i class="fa-solid fa-key"></i> TPO Portal</a>');
    }
    if (lender.correspondent_portal_url) {
      links.push('<a href="' + escapeHtml(lender.correspondent_portal_url) + '" target="_blank" rel="noopener"><i class="fa-solid fa-building-columns"></i> Correspondent</a>');
    }
    if (lender.turn_times_url) {
      links.push('<a href="' + escapeHtml(lender.turn_times_url) + '" target="_blank" rel="noopener"><i class="fa-solid fa-clock"></i> Turn Times</a>');
    }

    if (links.length > 0) {
      linksDiv.innerHTML = links.join('');
      linksDiv.classList.add('visible');
    } else {
      linksDiv.classList.remove('visible');
      linksDiv.innerHTML = '';
    }
  }

  /* Select a lender value */
  function selectLender(value) {
    if (value === '__OTHER__') {
      hiddenInput.value = '';
      searchInput.value = 'Other (not in list)';
      searchInput.disabled = true;
      otherWrap.classList.remove('hidden');
      otherInput.focus();
      updateClearBtn();
      closeDropdown();
      showLenderLinks('');
      triggerUpdates();
      return;
    }
    hiddenInput.value = value;
    searchInput.value = value;
    otherWrap.classList.add('hidden');
    otherInput.value = '';
    updateClearBtn();
    closeDropdown();
    showLenderLinks(value);
    triggerUpdates();
  }

  /* Clear selection */
  function clearSelection() {
    hiddenInput.value = '';
    searchInput.value = '';
    searchInput.disabled = false;
    otherWrap.classList.add('hidden');
    otherInput.value = '';
    updateClearBtn();
    showLenderLinks('');
    searchInput.focus();
    triggerUpdates();
  }

  /* Show/hide clear button */
  function updateClearBtn() {
    if (!clearBtn) return;
    clearBtn.style.display = (hiddenInput.value || searchInput.disabled) ? 'block' : 'none';
  }

  /* Trigger deal string + loan detail bar updates */
  function triggerUpdates() {
    if (typeof updateDealString === 'function') setTimeout(updateDealString, 50);
    if (typeof updateLoanDetailBar === 'function') setTimeout(updateLoanDetailBar, 50);
  }

  /* Keyboard navigation */
  function handleKeydown(e) {
    if (!dropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        renderDropdown(searchInput.value);
        openDropdown();
        e.preventDefault();
      }
      return;
    }
    var items = dropdown.querySelectorAll('.lender-dropdown-item[data-value]');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      updateActiveItem(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      updateActiveItem(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && items[activeIndex]) {
        selectLender(items[activeIndex].getAttribute('data-value'));
      }
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  }

  function updateActiveItem(items) {
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('active', i === activeIndex);
    }
    if (items[activeIndex]) items[activeIndex].scrollIntoView({ block: 'nearest' });
  }

  /* Set lender value programmatically (called from editLoan) */
  window.setLenderValue = function(val) {
    if (!searchInput || !hiddenInput) return;
    if (!val) {
      clearSelection();
      return;
    }
    /* Check if value is in the lender list */
    var found = !!lenderMap[val];
    if (found) {
      hiddenInput.value = val;
      searchInput.value = val;
      searchInput.disabled = false;
      otherWrap.classList.add('hidden');
      otherInput.value = '';
      showLenderLinks(val);
    } else {
      /* Value not in list — treat as "Other" */
      hiddenInput.value = val;
      searchInput.value = 'Other (not in list)';
      searchInput.disabled = true;
      otherWrap.classList.remove('hidden');
      otherInput.value = val;
      showLenderLinks('');
    }
    updateClearBtn();
  };

  /* Initialize */
  function init() {
    searchInput = document.getElementById('loan-lender-search');
    hiddenInput = document.getElementById('loan-lender');
    dropdown = document.getElementById('lender-dropdown');
    otherWrap = document.getElementById('lender-other-wrap');
    otherInput = document.getElementById('loan-lender-other');
    linksDiv = document.getElementById('lender-links');
    if (!searchInput || !hiddenInput || !dropdown) return;

    /* Add clear button */
    clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'lender-clear-btn';
    clearBtn.innerHTML = '&times;';
    clearBtn.title = 'Clear lender';
    clearBtn.style.display = 'none';
    clearBtn.addEventListener('click', function(e) { e.stopPropagation(); clearSelection(); });
    searchInput.parentNode.appendChild(clearBtn);

    /* Search input events */
    searchInput.addEventListener('input', function() {
      renderDropdown(searchInput.value);
      openDropdown();
    });
    searchInput.addEventListener('focus', function() {
      renderDropdown(searchInput.value);
      openDropdown();
    });
    searchInput.addEventListener('keydown', handleKeydown);

    /* Dropdown click delegation */
    dropdown.addEventListener('mousedown', function(e) {
      e.preventDefault();
      var item = e.target.closest('.lender-dropdown-item[data-value]');
      if (item) selectLender(item.getAttribute('data-value'));
    });

    /* Close dropdown on outside click */
    document.addEventListener('mousedown', function(e) {
      if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
        closeDropdown();
        if (!hiddenInput.value && searchInput.value && !searchInput.disabled) {
          searchInput.value = '';
        }
      }
    });

    /* "Other" text input syncs to hidden lender field */
    if (otherInput) {
      otherInput.addEventListener('input', function() {
        hiddenInput.value = otherInput.value;
        triggerUpdates();
      });
    }

    fetchLenders();
    updateClearBtn();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 300); });
  } else {
    setTimeout(init, 300);
  }
})();
</script>`;
  return new Response(htmlContent, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      ...getCorsHeaders(request)
    }
  });
}

// ============================================================
// MAIN WORKER HANDLER
// ============================================================

export default {
  async fetch(request, env, ctx) {
    // Handle OPTIONS preflight for CORS
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

    // ============================================================
    // PUBLIC ROUTES (No authentication required)
    // ============================================================

    // Pipeline App main JS module (bypasses Webflow 50K embed limit)
    if (path === '/static/pipeline-app.js' && method === 'GET') {
      return await getPipelineAppJS(request);
    }

    // Pipeline Calculators external JS module
    if (path === '/static/pipeline-calcs.js' && method === 'GET') {
      return await getPipelineCalcsJS(request);
    }

    // Pipeline Checklist external JS module (50-item loan workflow checklist)
    if (path === '/static/pipeline-checklist.js' && method === 'GET') {
      return await getPipelineChecklistJS(request);
    }

    // Pipeline Assets external JS module (Assets tab builder)
    if (path === '/static/pipeline-assets.js' && method === 'GET') {
      return await getPipelineAssetsJS(request);
    }

    // Pipeline Liabilities external JS module (Liabilities tab builder)
    if (path === '/static/pipeline-liabilities.js' && method === 'GET') {
      return await getPipelineLiabilitiesJS(request);
    }

    // Pipeline Documents external JS module (document tracking checklist)
    if (path === '/static/pipeline-documents.js' && method === 'GET') {
      return await getPipelineDocumentsJS(request);
    }

    // Pipeline Purchase Agreement external JS module (PA tab builder)
    if (path === '/static/pipeline-purchase-agreement.js' && method === 'GET') {
      return await getPurchaseAgreementJS(request);
    }

    // Pipeline Closing Costs Calculator external JS module
    if (path === '/static/pipeline-closing-costs.js' && method === 'GET') {
      return await getClosingCostsJS(request);
    }

    // --- Pipeline page static files (migrated from Webflow embeds) ---

    // Pipeline CSS (was Webflow CSS embed, ~49K)
    if (path === '/static/pipeline.css' && method === 'GET') {
      return await getPipelineCSS(request);
    }

    // Pipeline HTML template (was Webflow HTML embed, ~49K)
    if (path === '/static/pipeline-template.html' && method === 'GET') {
      return await getPipelineTemplateHTML(request);
    }

    // Pipeline bootstrap HTML (was Webflow JS embed — Google Maps, address autocomplete, showSection hooks, module loaders)
    if (path === '/static/pipeline-bootstrap.html' && method === 'GET') {
      return await getPipelineBootstrapHTML(request);
    }

    // Lender directory names for searchable dropdown (public, no auth)
    if (path === '/api/lenders' && method === 'GET') {
      return await getLenderList(env, request);
    }

    // Health check
    if (path === '/health' || path === '/') {
      return jsonResponse({
        status: 'ok',
        service: 'mtg-broker-pipeline',
        version: '8.2',
        database: 'Supabase (loans, tasks, usage)',
        timestamp: new Date().toISOString(),
        endpoints: [
          'GET    /api/pipeline/loans              - List loans (cached)',
          'POST   /api/pipeline/loans              - Create loan',
          'PUT    /api/pipeline/loans/:id          - Update loan',
          'DELETE /api/pipeline/loans/:id          - Delete loan',
          'GET    /api/pipeline/loans/clear-cache  - Clear cache',
          'GET    /api/pipeline/tasks              - List tasks (?loanId=...)',
          'POST   /api/pipeline/tasks              - Create task',
          'PUT    /api/pipeline/tasks/:id          - Update task',
          'DELETE /api/pipeline/tasks/:id          - Delete task',
          'GET    /api/plan-limits                 - Check plan limits',
          'GET    /api/usage                       - Get usage',
          'PUT    /api/usage                       - Update usage',
          'GET    /static/pipeline-app.js           - Main pipeline app JS module',
          'GET    /static/pipeline-calcs.js        - Calculator JS module',
          'GET    /static/pipeline-closing-costs.js - Closing Costs calculator module',
          'GET    /static/pipeline.css              - Pipeline page CSS (migrated from Webflow embed)',
          'GET    /static/pipeline-template.html    - Pipeline HTML template (migrated from Webflow embed)',
          'GET    /static/pipeline-bootstrap.html   - Pipeline bootstrap JS/HTML (Google Maps, hooks, loaders)',
          'GET    /static/pipeline-checklist.js    - Checklist JS module',
          'GET    /static/pipeline-assets.js       - Assets tab JS module',
          'GET    /static/pipeline-documents.js   - Documents tab JS module',
          'GET    /static/pipeline-purchase-agreement.js - Purchase Agreement tab JS module',
          'POST   /api/pipeline/extract-purchase-agreement - Extract PA fields from PDF via Claude AI',
          'GET    /api/lenders                      - Lender directory names (public)',
          'GET    /health                          - This health check'
        ]
      }, 200, request);
    }

    // ============================================================
    // AUTHENTICATED ROUTES (CRIT-1: JWT signature verification)
    // ============================================================

    // Extract the raw JWT from the Authorization header and VERIFY its RS256 signature.
    // The verified payload contains the user's email — we never trust a plain email string.
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') || '';
    const jwtPayload = await verifyOutsetaJWT(token);
    const userEmail = jwtPayload ? sanitizeEmailForFormula(jwtPayload.email) : null;

    if (!userEmail) {
      return jsonResponse({ error: 'Unauthorized' }, 401, request);
    }

    try {
      // ---- PIPELINE LOANS (Supabase v8.0) ----
      // Route regex matches UUIDs (Supabase) — e.g. /api/pipeline/loans/4e0a2341-3fc1-4aca-8a15-a462a005af0e
      if (path === '/api/pipeline/loans' && method === 'GET') {
        return await getLoans(userEmail, env, request);
      }
      if (path === '/api/pipeline/loans/clear-cache' && method === 'GET') {
        return await clearPipelineCache(userEmail, request);
      }
      if (path === '/api/pipeline/loans' && method === 'POST') {
        const body = await request.json();
        return await createLoan(userEmail, body, env, request);
      }
      if (path.match(/^\/api\/pipeline\/loans\/[0-9a-f-]+$/) && method === 'PUT') {
        const recordId = path.split('/').pop();
        const body = await request.json();
        return await updateLoan(userEmail, recordId, body, env, request);
      }
      if (path.match(/^\/api\/pipeline\/loans\/[0-9a-f-]+$/) && method === 'DELETE') {
        const recordId = path.split('/').pop();
        return await deleteLoan(userEmail, recordId, env, request);
      }

      // ---- PIPELINE TASKS (Supabase v8.0) ----
      if (path === '/api/pipeline/tasks' && method === 'GET') {
        const loanId = url.searchParams.get('loanId');
        return await getTasks(userEmail, loanId, env, request);
      }
      if (path === '/api/pipeline/tasks' && method === 'POST') {
        const body = await request.json();
        return await createTask(userEmail, body, env, request);
      }
      if (path.match(/^\/api\/pipeline\/tasks\/[0-9a-f-]+$/) && method === 'PUT') {
        const recordId = path.split('/').pop();
        const body = await request.json();
        return await updateTask(userEmail, recordId, body, env, request);
      }
      if (path.match(/^\/api\/pipeline\/tasks\/[0-9a-f-]+$/) && method === 'DELETE') {
        const recordId = path.split('/').pop();
        return await deleteTask(userEmail, recordId, env, request);
      }

      // ---- PLAN LIMITS ----
      if (path === '/api/plan-limits' && method === 'GET') {
        return await checkPlanLimits(userEmail, env, request);
      }

      // ---- USAGE TRACKING (Supabase v8.1) ----
      if (path === '/api/usage' && method === 'GET') {
        return await getUsage(userEmail, env, request);
      }
      if (path === '/api/usage' && method === 'PUT') {
        return await updateUsage(userEmail, env, request);
      }

      // ---- PURCHASE AGREEMENT PDF EXTRACTION ----
      if (path === '/api/pipeline/extract-purchase-agreement' && method === 'POST') {
        return await extractPurchaseAgreement(request, env);
      }

      // No matching route
      return jsonResponse({ error: 'Not found' }, 404, request);

    } catch (error) {
      console.error('Pipeline worker error:', error);
      return jsonResponse({ error: 'Internal server error' }, 500, request);
    }
  }
};

"""
Sync Pipeline JSON blobs from Airtable export to Supabase.
Reads the Airtable MCP export file, extracts JSON blob fields
(Checklist JSON, Documents JSON, Asset Accounts, Purchase Agreement JSON),
and patches them into the existing pipeline_loans rows in Supabase.

Also migrates Pipeline Tasks (9 records) into the pipeline_tasks table.
"""
import json
import os
import sys
import urllib.request
import urllib.error

# --- Config ---
SUPABASE_URL = "https://tcmahfwhdknxhhdvqpum.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

# Airtable export files (from MCP tool results)
DATA_DIR = r"C:\Users\rich2\.claude\projects\C--Users-rich2-projects-mtg-broker--claude-worktrees-determined-aryabhata\9eca2169-dd9b-4909-8ecc-6264516e039c\tool-results"
# Loans file: filtered to records that have at least one JSON field
LOANS_JSON_FILE = os.path.join(DATA_DIR, "mcp-airtable-list_records-1774360159076.txt")
# Full loans file (all records, for re-syncing ALL fields)
LOANS_FULL_FILE = os.path.join(DATA_DIR, "mcp-airtable-list_records-1774360129766.txt")

if not SUPABASE_KEY:
    print("ERROR: Set SUPABASE_ANON_KEY environment variable")
    sys.exit(1)


# JSON blob field mapping: Airtable field name -> Supabase column name
JSON_FIELDS = {
    "Checklist JSON": "checklist_json",
    "Documents JSON": "documents_json",
    "Asset Accounts": "asset_accounts",
    "Purchase Agreement JSON": "purchase_agreement_json",
}


def parse_json_field(val):
    """Try to parse a JSON string, return None if invalid."""
    if not val:
        return None
    try:
        return json.loads(val)
    except (json.JSONDecodeError, TypeError):
        return None


def supabase_request(path, data=None, method="PATCH", query_params=""):
    """Make a request to Supabase REST API."""
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    if query_params:
        url += f"?{query_params}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        print(f"  ERROR {e.code}: {error_body}")
        return None


def sync_json_blobs():
    """Read Airtable export and patch JSON blobs into Supabase."""
    print("=" * 60)
    print("STEP 1: Sync JSON blobs for pipeline_loans")
    print("=" * 60)

    with open(LOANS_JSON_FILE, "r", encoding="utf-8") as f:
        raw = json.load(f)
    records = json.loads(raw[0]["text"])
    print(f"Loaded {len(records)} records with JSON fields from Airtable export\n")

    updated = 0
    skipped = 0
    failed = 0

    for rec in records:
        fields = rec.get("fields", {})
        airtable_id = rec["id"]
        borrower = fields.get("Borrower Name", fields.get("Loan Name", "?"))

        # Build patch with only the JSON blob fields that exist
        patch = {}
        for at_field, sb_col in JSON_FIELDS.items():
            val = fields.get(at_field)
            if val:
                parsed = parse_json_field(val)
                if parsed is not None:
                    patch[sb_col] = parsed

        if not patch:
            skipped += 1
            continue

        field_names = ", ".join(patch.keys())
        print(f"  Patching {borrower} ({airtable_id}): {field_names}")

        # PATCH using airtable_id filter
        result = supabase_request(
            "pipeline_loans",
            data=patch,
            method="PATCH",
            query_params=f"airtable_id=eq.{airtable_id}"
        )

        if result is not None:
            if len(result) == 0:
                print(f"    WARNING: No matching row found for airtable_id={airtable_id}")
                failed += 1
            else:
                updated += 1
        else:
            failed += 1

    print(f"\nJSON blob sync: {updated} updated, {skipped} skipped (no JSON), {failed} failed")
    return updated, failed


def sync_all_scalar_fields():
    """Re-sync all scalar fields from the full Airtable export to catch any truncation."""
    print("\n" + "=" * 60)
    print("STEP 2: Re-sync ALL scalar fields for pipeline_loans")
    print("=" * 60)

    # Full field mapping (same as migrate-pipeline-to-supabase.py)
    FIELD_MAP = {
        "Loan Name": "loan_name",
        "Loan Purpose": "loan_purpose",
        "Occupancy": "occupancy",
        "Credit Pull Type": "credit_pull_type",
        "User Email": "user_email",
        "Stage": "stage",
        "Borrower Name": "borrower_name",
        "Borrower Email": "borrower_email",
        "Borrower Phone": "borrower_phone",
        "Co-Borrower": "co_borrower",
        "Property Street": "property_street",
        "Property City": "property_city",
        "Property State": "property_state",
        "Property Zip": "property_zip",
        "Property Type": "property_type",
        "Property Value": "property_value",
        "Purchase Price": "purchase_price",
        "Loan Type": "loan_type",
        "Loan Amount": "loan_amount",
        "Interest Rate": "interest_rate",
        "Loan Term": "loan_term",
        "LTV": "ltv",
        "Expected Close": "expected_close",
        "Lead Source": "lead_source",
        "Calculator Link": "calculator_link",
        "Notes": "notes",
        "Comp BPS": "comp_bps",
        "HELOC Line Amount": "heloc_line_amount",
        "HELOC Initial Draw": "heloc_initial_draw",
        "Credit Score": "credit_score",
        "Date Credit Pulled": "date_credit_pulled",
        "Scores Pulled": "scores_pulled",
        "Credit Vendor": "credit_vendor",
        "Credit Report Number": "credit_report_number",
        "Compensation Amount": "compensation_amount",
        "Qualifying Interest Rate": "qualifying_interest_rate",
        "Other Loan Type": "other_loan_type",
        "Deal Status": "deal_status",
        "Lost Reason": "lost_reason",
        "Lock Date": "lock_date",
        "Lock Expiration Date": "lock_expiration_date",
        "Lock Status": "lock_status",
        "Payroll Submitted Date": "payroll_submitted_date",
        "Payroll Processed Date": "payroll_processed_date",
        "Pay Received Date": "pay_received_date",
        "Pay Status": "pay_status",
        "Co-Borrower Email": "co_borrower_email",
        "Co-Borrower Phone": "co_borrower_phone",
        "Last Contact Date": "last_contact_date",
        "Gross Annual Income": "gross_annual_income",
        "Monthly Debt Payments": "monthly_debt_payments",
        "Target DTI": "target_dti",
        "Afford Max Purchase": "afford_max_purchase",
        "Afford Max Loan Amt": "afford_max_loan_amt",
        "Afford Max PITIA": "afford_max_pitia",
        "Borrower First Name": "borrower_first_name",
        "Borrower Middle Name": "borrower_middle_name",
        "Borrower Last Name": "borrower_last_name",
        "Co-Borrower First Name": "co_borrower_first_name",
        "Co-Borrower Middle Name": "co_borrower_middle_name",
        "Co-Borrower Last Name": "co_borrower_last_name",
        "HOI": "hoi",
        "Property Taxes": "property_taxes",
        "Supplemental Insurance": "supplemental_insurance",
        "HOA": "hoa",
        "Lender": "lender",
        "Co-Borrower Role": "co_borrower_role",
        "Property County": "property_county",
        "Channel": "channel",
        "Comp Type": "comp_type",
        "Link Application": "link_application",
        "Link Documents": "link_documents",
        "Link Lender Portal": "link_lender_portal",
        "Link Appraisal Portal": "link_appraisal_portal",
        "Link Other 1 Name": "link_other_1_name",
        "Link Other 1 URL": "link_other_1_url",
        "Link Other 2 Name": "link_other_2_name",
        "Link Other 2 URL": "link_other_2_url",
        "Link Other 3 Name": "link_other_3_name",
        "Link Other 3 URL": "link_other_3_url",
        "Borrower Income": "borrower_income",
        "Co-Borrower Income": "co_borrower_income",
        "Income Notes": "income_notes",
        "Borrower Employment Type": "borrower_employment_type",
        "Borrower SE Doc Type": "borrower_se_doc_type",
        "Borrower Bank Statement": "borrower_bank_statement",
        "Borrower BS Months": "borrower_bs_months",
        "Borrower Expense Factor": "borrower_expense_factor",
        "Co-Borrower Employment Type": "co_borrower_employment_type",
        "Co-Borrower SE Doc Type": "co_borrower_se_doc_type",
        "Co-Borrower Bank Statement": "co_borrower_bank_statement",
        "Co-Borrower BS Months": "co_borrower_bs_months",
        "Co-Borrower Expense Factor": "co_borrower_expense_factor",
        "Borrower Income Details": "borrower_income_details",
        "Co-Borrower Income Details": "co_borrower_income_details",
        "Borrower DOB": "borrower_dob",
        "Borrower SSN Last 4": "borrower_ssn_last_4",
        "Co-Borrower DOB": "co_borrower_dob",
        "Co-Borrower SSN Last 4": "co_borrower_ssn_last_4",
        "Deal Notes": "deal_notes",
        "Pricing Notes": "pricing_notes",
        "Points": "points",
        "YSP": "ysp",
        "Payroll Notes": "payroll_notes",
        "Down Payment": "down_payment",
        "Closing Costs": "closing_costs",
        "Months of Reserves": "months_of_reserves",
        "Estimated Monthly Payment": "estimated_monthly_payment",
        "Other Reserves Months": "other_reserves_months",
        "Other Reserves Monthly Amount": "other_reserves_monthly_amount",
        "Other Reserves Total": "other_reserves_total",
        "Lien Position": "lien_position",
        "Existing 1st Mortgage Balance": "existing_1st_mortgage_balance",
        "Existing 2nd Mortgage Balance": "existing_2nd_mortgage_balance",
        "Max CLTV": "max_cltv",
    }

    with open(LOANS_FULL_FILE, "r", encoding="utf-8") as f:
        raw = json.load(f)
    records = json.loads(raw[0]["text"])
    print(f"Loaded {len(records)} total records from full Airtable export\n")

    updated = 0
    failed = 0

    for rec in records:
        fields = rec.get("fields", {})
        airtable_id = rec["id"]
        borrower = fields.get("Borrower Name", fields.get("Loan Name", "?"))

        # Build patch with all scalar fields
        patch = {}
        for at_field, sb_col in FIELD_MAP.items():
            val = fields.get(at_field)
            if val is not None:
                patch[sb_col] = val

        # Also include JSON blob fields
        for at_field, sb_col in JSON_FIELDS.items():
            val = fields.get(at_field)
            if val:
                parsed = parse_json_field(val)
                if parsed is not None:
                    patch[sb_col] = parsed

        if not patch:
            continue

        print(f"  Updating {borrower} ({airtable_id}): {len(patch)} fields")

        result = supabase_request(
            "pipeline_loans",
            data=patch,
            method="PATCH",
            query_params=f"airtable_id=eq.{airtable_id}"
        )

        if result is not None and len(result) > 0:
            updated += 1
        else:
            failed += 1

    print(f"\nFull re-sync: {updated} updated, {failed} failed")
    return updated, failed


def migrate_tasks():
    """Migrate Pipeline Tasks from Airtable to Supabase."""
    print("\n" + "=" * 60)
    print("STEP 3: Migrate Pipeline Tasks to Supabase")
    print("=" * 60)

    # Tasks data (from Airtable MCP query - 9 records)
    tasks = [
        {"id": "rec7UJOA8Uf2iU7xz", "fields": {"Task Name": "Order appraisal", "Loan": ["recDVivcLyt4dv3cF"], "Due Date": "2026-01-15", "Assigned To": "test@example.com"}},
        {"id": "recH8oTgfPN1SOmMv", "fields": {"Task Name": "Collect pay stubs", "Loan": ["recDVivcLyt4dv3cF"], "Due Date": "2026-01-10", "Completed": True, "Assigned To": "test@example.com"}},
        {"id": "recQg9f23qV5mJ6Fc", "fields": {"Task Name": "Send Shannon an email with the NFTY link", "Loan": ["rechX5hfJZuF3f98B"], "Due Date": "2026-03-15", "Assigned To": "rich@prestonlending.com"}},
        {"id": "recTN7VefRP39WADq", "fields": {"Task Name": "Collect 12 months bank statements or bank statement loan", "Loan": ["rechdTBhYgNHmWkCE"], "Due Date": "2026-03-14", "Assigned To": "rich@prestonlending.com"}},
        {"id": "recdJIRC6P1ndyHD5", "fields": {"Task Name": "Create a refinance comparison and email to Mike", "Loan": ["recs1P7nC0YHDl6zy"], "Due Date": "2026-03-19", "Assigned To": "rich@prestonlending.com"}},
        {"id": "recgI1yzW0DyMTV7z", "fields": {"Task Name": "Send pre-approval letter to realtor", "Loan": ["recDVivcLyt4dv3cF"], "Due Date": "2026-01-08", "Assigned To": "test@example.com"}},
        {"id": "recjMlVXZbVnFx5zN", "fields": {"Task Name": "Restart Figure Loan", "Loan": ["recDNUz86ckm8xCOT"], "Due Date": "2026-01-10", "Assigned To": "rich@prestonlending.com"}},
        {"id": "recqLUQ9K0qj5ftLs", "fields": {"Task Name": "WF - NFTY HELOC TO BE FILLED OUT", "Loan": ["rechX5hfJZuF3f98B"], "Due Date": "2026-03-15", "Assigned To": "rich@prestonlending.com"}},
        {"id": "reczACsfewTM2KOBc", "fields": {"Task Name": "Need copy of marriage cert", "Loan": ["recDNUz86ckm8xCOT"], "Due Date": "2026-01-13", "Assigned To": "rich@prestonlending.com"}},
    ]

    print(f"Migrating {len(tasks)} tasks...\n")

    # First, get the airtable_id -> supabase uuid mapping from pipeline_loans
    print("  Fetching loan ID mapping from Supabase...")
    loan_mapping = supabase_request(
        "pipeline_loans",
        method="GET",
        query_params="select=id,airtable_id"
    )

    if not loan_mapping:
        print("  ERROR: Could not fetch loan mapping from Supabase")
        return 0, len(tasks)

    # Build airtable_id -> supabase uuid dict
    id_map = {}
    for loan in loan_mapping:
        if loan.get("airtable_id"):
            id_map[loan["airtable_id"]] = loan["id"]

    print(f"  Mapped {len(id_map)} loans (airtable_id -> supabase uuid)\n")

    inserted = 0
    failed = 0

    for task in tasks:
        f = task["fields"]
        airtable_id = task["id"]
        task_name = f.get("Task Name", "?")

        # Resolve the loan link
        loan_airtable_ids = f.get("Loan", [])
        loan_id = None
        if loan_airtable_ids:
            loan_id = id_map.get(loan_airtable_ids[0])

        if not loan_id:
            print(f"  WARNING: Task '{task_name}' has no matching loan in Supabase (Airtable loan: {loan_airtable_ids})")

        row = {
            "airtable_id": airtable_id,
            "task_name": task_name,
            "loan_id": loan_id,
            "due_date": f.get("Due Date"),
            "completed": f.get("Completed", False),
            "assigned_to": f.get("Assigned To"),
        }

        # Remove None values
        row = {k: v for k, v in row.items() if v is not None}

        print(f"  Inserting: {task_name} (assigned to {row.get('assigned_to', '?')})")

        result = supabase_request("pipeline_tasks", data=row, method="POST")
        if result and len(result) > 0:
            inserted += 1
        else:
            failed += 1

    print(f"\nTasks: {inserted} inserted, {failed} failed")
    return inserted, failed


if __name__ == "__main__":
    # Step 1: Sync JSON blobs
    json_updated, json_failed = sync_json_blobs()

    # Step 2: Re-sync all scalar fields (catches any truncation from initial migration)
    scalar_updated, scalar_failed = sync_all_scalar_fields()

    # Step 3: Migrate tasks
    tasks_inserted, tasks_failed = migrate_tasks()

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  JSON blobs:   {json_updated} updated, {json_failed} failed")
    print(f"  Scalar fields: {scalar_updated} updated, {scalar_failed} failed")
    print(f"  Tasks:         {tasks_inserted} inserted, {tasks_failed} failed")
    print("=" * 60)

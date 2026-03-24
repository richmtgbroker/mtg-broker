"""
Migrate Pipeline Loans + Tasks from Airtable to Supabase.
Reads Airtable export JSON, maps fields, inserts via Supabase REST API.
"""
import json
import os
import sys
import urllib.request
import urllib.error

# --- Config ---
SUPABASE_URL = "https://tcmahfwhdknxhhdvqpum.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
DATA_DIR = r"C:\Users\rich2\.claude\projects\C--Users-rich2-projects-mtg-broker--claude-worktrees-frosty-colden\4fe18746-716b-4f1d-91d6-295564e9a2a4\tool-results"

if not SUPABASE_KEY:
    print("ERROR: Set SUPABASE_ANON_KEY environment variable")
    sys.exit(1)

# --- Field mapping: Airtable field name -> Supabase column name ---
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

# Fields that store JSON strings in Airtable -> jsonb in Supabase
JSON_FIELDS = {
    "Checklist JSON": "checklist_json",
    "Asset Accounts": "asset_accounts",
    "Documents JSON": "documents_json",
    "Purchase Agreement JSON": "purchase_agreement_json",
}

# Fields to skip (not columns in Supabase)
SKIP_FIELDS = {"Pipeline Tasks"}  # This is a reverse link, handled via tasks table


def parse_json_field(val):
    """Try to parse a JSON string, return None if invalid."""
    if not val:
        return None
    try:
        return json.loads(val)
    except (json.JSONDecodeError, TypeError):
        return None


def map_loan_record(airtable_record):
    """Map an Airtable record to a Supabase row dict."""
    fields = airtable_record.get("fields", {})
    row = {"airtable_id": airtable_record["id"]}

    for at_field, sb_col in FIELD_MAP.items():
        val = fields.get(at_field)
        if val is not None:
            row[sb_col] = val

    for at_field, sb_col in JSON_FIELDS.items():
        val = fields.get(at_field)
        if val:
            parsed = parse_json_field(val)
            if parsed is not None:
                row[sb_col] = parsed

    # Ensure user_email is set (required field)
    if "user_email" not in row or not row["user_email"]:
        print(f"  WARNING: Record {airtable_record['id']} has no User Email, skipping")
        return None

    return row


def supabase_request(path, data, method="POST"):
    """Make a request to Supabase REST API."""
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    body = json.dumps(data).encode("utf-8")
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        print(f"  ERROR {e.code}: {error_body}")
        return None


def main():
    # Load Airtable data
    data_file = os.path.join(DATA_DIR, "mcp-airtable-list_records-1774338387859.txt")
    with open(data_file, "r", encoding="utf-8") as f:
        raw = json.load(f)
    records = json.loads(raw[0]["text"])
    print(f"Loaded {len(records)} Pipeline Loans from Airtable export")

    # Map and insert loans
    success = 0
    failed = 0
    airtable_to_supabase_id = {}  # airtable_id -> supabase uuid (for tasks)

    for rec in records:
        row = map_loan_record(rec)
        if not row:
            failed += 1
            continue

        borrower = row.get("borrower_name", row.get("borrower_first_name", "?"))
        print(f"  Inserting: {borrower} ({row['airtable_id']})")

        result = supabase_request("pipeline_loans", row)
        if result and len(result) > 0:
            supabase_id = result[0].get("id")
            airtable_to_supabase_id[row["airtable_id"]] = supabase_id
            success += 1
        else:
            failed += 1

    print(f"\nLoans: {success} inserted, {failed} failed")

    # Save the ID mapping for tasks
    mapping_file = os.path.join(DATA_DIR, "pipeline-id-mapping.json")
    with open(mapping_file, "w", encoding="utf-8") as f:
        json.dump(airtable_to_supabase_id, f, indent=2)
    print(f"ID mapping saved to {mapping_file}")

    print(f"\nDone! {success} loans migrated to Supabase.")


if __name__ == "__main__":
    main()

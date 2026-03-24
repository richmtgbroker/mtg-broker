"""
Sync Pipeline JSON blobs + Tasks from Airtable export to Supabase.
Uses the update_loan_json() SECURITY DEFINER function to bypass RLS.
Also migrates Pipeline Tasks via direct SQL inserts through a helper function.
"""
import json
import os
import sys
import urllib.request
import urllib.error

SUPABASE_URL = "https://tcmahfwhdknxhhdvqpum.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

DATA_DIR = r"C:\Users\rich2\.claude\projects\C--Users-rich2-projects-mtg-broker--claude-worktrees-determined-aryabhata\9eca2169-dd9b-4909-8ecc-6264516e039c\tool-results"

if not SUPABASE_KEY:
    print("ERROR: Set SUPABASE_ANON_KEY environment variable")
    sys.exit(1)


def rpc_call(function_name, params):
    """Call a Supabase RPC function."""
    url = f"{SUPABASE_URL}/rest/v1/rpc/{function_name}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    body = json.dumps(params).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        print(f"  ERROR {e.code}: {error_body[:300]}")
        return None


def main():
    # ============================================================
    # STEP 1: Sync JSON blobs
    # ============================================================
    print("=" * 60)
    print("STEP 1: Sync JSON blobs via update_loan_json() RPC")
    print("=" * 60)

    json_file = os.path.join(DATA_DIR, "mcp-airtable-list_records-1774360159076.txt")
    with open(json_file, "r", encoding="utf-8") as f:
        raw = json.load(f)
    records = json.loads(raw[0]["text"])

    json_fields = {
        "Checklist JSON": "checklist_json",
        "Documents JSON": "documents_json",
        "Asset Accounts": "asset_accounts",
        "Purchase Agreement JSON": "purchase_agreement_json",
    }

    updated = 0
    failed = 0

    for rec in records:
        fields = rec.get("fields", {})
        aid = rec["id"]
        name = fields.get("Borrower Name", "?")

        params = {"p_airtable_id": aid}
        has_data = False

        for at_field, sb_col in json_fields.items():
            val = fields.get(at_field)
            # Map Airtable field name to RPC parameter name
            param_name = f"p_{sb_col}"
            if val:
                try:
                    parsed = json.loads(val)
                    params[param_name] = parsed
                    has_data = True
                except (json.JSONDecodeError, TypeError):
                    pass

        if not has_data:
            continue

        cols = [k.replace("p_", "") for k in params if k != "p_airtable_id"]
        print(f"  {name} ({aid}): {', '.join(cols)}")

        result = rpc_call("update_loan_json", params)
        if result is not None:
            updated += 1
        else:
            failed += 1

    print(f"\nJSON blobs: {updated} synced, {failed} failed")

    # ============================================================
    # STEP 2: Migrate Pipeline Tasks
    # ============================================================
    print("\n" + "=" * 60)
    print("STEP 2: Migrate Pipeline Tasks via insert_pipeline_task() RPC")
    print("=" * 60)

    # First get the loan ID mapping
    url = f"{SUPABASE_URL}/rest/v1/pipeline_loans?select=id,airtable_id"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        loans = json.loads(resp.read().decode("utf-8"))

    # This will be empty if RLS blocks it. Check:
    if not loans:
        print("  WARNING: Could not fetch loans (RLS may be blocking).")
        print("  Will use execute_sql via MCP tool instead for tasks.")
        return

    id_map = {l["airtable_id"]: l["id"] for l in loans if l.get("airtable_id")}
    print(f"  Mapped {len(id_map)} loans\n")

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

    inserted = 0
    task_failed = 0

    for t in tasks:
        f = t["fields"]
        loan_at_ids = f.get("Loan", [])
        loan_id = id_map.get(loan_at_ids[0]) if loan_at_ids else None

        params = {
            "p_airtable_id": t["id"],
            "p_task_name": f["Task Name"],
            "p_loan_id": loan_id,
            "p_due_date": f.get("Due Date"),
            "p_completed": f.get("Completed", False),
            "p_assigned_to": f["Assigned To"],
            "p_user_email": f["Assigned To"],
        }

        print(f"  Inserting: {params['p_task_name']}")
        result = rpc_call("insert_pipeline_task", params)
        if result is not None:
            inserted += 1
        else:
            task_failed += 1

    print(f"\nTasks: {inserted} inserted, {task_failed} failed")

    # ============================================================
    # SUMMARY
    # ============================================================
    print("\n" + "=" * 60)
    print("MIGRATION SUMMARY")
    print("=" * 60)
    print(f"  JSON blobs:  {updated} synced, {failed} failed")
    print(f"  Tasks:       {inserted} inserted, {task_failed} failed")


if __name__ == "__main__":
    main()

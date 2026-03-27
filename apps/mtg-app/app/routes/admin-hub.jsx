import { useState, useEffect } from "react";
import { Link } from "react-router";
import Navbar from "../components/Navbar";
import { isAdmin, getAccessToken } from "../lib/auth";

// API endpoints for the lender email ingestion system
const INGEST_EMAIL_URL = "https://mtg-loan-finder.pages.dev/api/ingest-email";
const MANAGE_EMAILS_URL = "https://mtg-loan-finder.pages.dev/api/manage-emails";

export function meta() {
  return [{ title: "Admin Hub — MtgBroker" }];
}

// ─── Update type badge colors ─────────────────────────────────────────────────
const TYPE_COLORS = {
  guideline_change: "bg-blue-100 text-blue-800",
  rate_special: "bg-amber-100 text-amber-800",
  pricing_promo: "bg-pink-100 text-pink-800",
  new_program: "bg-emerald-100 text-emerald-800",
  program_suspension: "bg-red-100 text-red-800",
  general_announcement: "bg-gray-100 text-gray-500",
};


// ─── Lender Email Ingestion Section ───────────────────────────────────────────

function LenderUpdatesSection() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [recentUpdates, setRecentUpdates] = useState(null);

  useEffect(() => {
    loadStats();
    loadRecent();
  }, []);

  const loadStats = async () => {
    try {
      const token = getAccessToken();
      const res = await fetch(`${MANAGE_EMAILS_URL}?action=stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setStats(await res.json());
    } catch (e) {
      /* stats are optional */
    }
  };

  const loadRecent = async () => {
    try {
      const token = getAccessToken();
      const res = await fetch(`${MANAGE_EMAILS_URL}?action=list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRecentUpdates(data.updates || []);
      }
    } catch (e) {
      /* recent list is optional */
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;

    setIsSubmitting(true);
    setResult(null);
    setError(null);

    try {
      const token = getAccessToken();
      const res = await fetch(INGEST_EMAIL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject: subject.trim(),
          body: body.trim(),
          sender_email: senderEmail.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ingestion failed");

      setResult(data);
      setSubject("");
      setBody("");
      setSenderEmail("");
      loadStats();
      loadRecent();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAction = async (action) => {
    if (action === "purge_all" && !confirm("Delete ALL email-sourced data? This cannot be undone. PDF guideline data is not affected.")) return;
    if (action === "disable_all" && !confirm("Disable all email data in search results?")) return;

    try {
      const token = getAccessToken();
      const res = await fetch(MANAGE_EMAILS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      alert(data.message);
      loadStats();
      loadRecent();
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div className="mt-10">
      <h2 className="text-lg font-bold text-text mb-1">Lender Email Updates</h2>
      <p className="text-sm text-text-muted mb-5">
        Paste lender emails to add them to the AI Guideline Search database.
      </p>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { value: stats.email_chunks_active, label: "Active Email Chunks" },
            { value: stats.email_chunks_inactive, label: "Inactive / Expired" },
            { value: stats.pdf_chunks, label: "PDF Chunks" },
            { value: stats.total_lender_updates, label: "Emails Ingested" },
          ].map((s) => (
            <div key={s.label} className="bg-surface border border-border-light rounded-xl p-4 text-center">
              <span className="block text-2xl font-bold text-primary-600">{s.value}</span>
              <span className="text-[0.6875rem] text-text-muted uppercase tracking-wide">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Paste Email Form */}
      <div className="bg-surface border border-border-light rounded-xl p-6 mb-6 shadow-sm">
        <h3 className="text-base font-bold text-text mb-1 flex items-center gap-2">
          <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Paste Lender Email
        </h3>
        <p className="text-xs text-text-muted mb-5">
          It will be automatically classified, chunked, and embedded — searchable in AI Guideline Search within seconds.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-text mb-1">
              Sender Email <span className="font-normal text-text-muted">(optional — helps identify lender)</span>
            </label>
            <input
              type="email"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              placeholder="ae@lender.com"
              disabled={isSubmitting}
              className="w-full px-3 py-2.5 text-sm border-2 border-border-light rounded-lg bg-white text-text placeholder:text-gray-400 focus:outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-600/10 disabled:bg-gray-50 disabled:cursor-not-allowed transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1">
              Email Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="UWM — FHA Minimum FICO Reduced to 580"
              disabled={isSubmitting}
              required
              className="w-full px-3 py-2.5 text-sm border-2 border-border-light rounded-lg bg-white text-text placeholder:text-gray-400 focus:outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-600/10 disabled:bg-gray-50 disabled:cursor-not-allowed transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1">
              Email Body <span className="text-red-500">*</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Paste the full email body here..."
              rows={10}
              disabled={isSubmitting}
              required
              className="w-full px-3 py-2.5 text-sm border-2 border-border-light rounded-lg bg-white text-text placeholder:text-gray-400 focus:outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-600/10 disabled:bg-gray-50 disabled:cursor-not-allowed resize-y min-h-[200px] transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={!subject.trim() || !body.trim() || isSubmitting}
            className="self-start inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Processing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Ingest Email
              </>
            )}
          </button>
        </form>

        {/* Success card */}
        {result && (
          <div className="mt-5 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="flex items-center gap-2 font-bold text-emerald-800 mb-3">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Email Ingested Successfully
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {[
                ["Lender", result.lender],
                ["Topic", result.topic],
                ["Type", result.update_type],
                ["Chunks", result.chunks_created],
                ["Superseded", `${result.superseded_count} old`],
                ["Expires", new Date(result.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-0.5 border-b border-emerald-200/60">
                  <span className="text-emerald-700">{label}</span>
                  <strong className="text-emerald-900">{value}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-5 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}
      </div>

      {/* Recent Updates */}
      {recentUpdates && recentUpdates.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-text mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Recent Lender Updates
          </h3>
          <div className="flex flex-col gap-2">
            {recentUpdates.slice(0, 15).map((update) => (
              <div
                key={update.id}
                className="flex items-center justify-between gap-3 p-3 bg-surface border border-border-light rounded-lg"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="text-xs font-bold text-primary-600 whitespace-nowrap">
                    {update.lender_name || "Unknown"}
                  </span>
                  <span className="text-xs text-text truncate">{update.subject}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[0.625rem] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap ${TYPE_COLORS[update.update_type] || TYPE_COLORS.general_announcement}`}>
                    {(update.update_type || "").replace(/_/g, " ")}
                  </span>
                  <span className="text-[0.6875rem] text-text-muted">
                    {update.chunks_created} chunk{update.chunks_created !== 1 ? "s" : ""}
                  </span>
                  <span className="text-[0.6875rem] text-text-muted whitespace-nowrap">
                    {new Date(update.received_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manage Email Data */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-text mb-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Manage Email Data
        </h3>
        <div className="flex flex-wrap gap-2 mb-2">
          <button
            onClick={() => handleAction("cleanup_expired")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded-lg hover:bg-sky-100 transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Cleanup Expired
          </button>
          <button
            onClick={() => handleAction("disable_all")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
            </svg>
            Disable All
          </button>
          <button
            onClick={() => handleAction("enable_all")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Enable All
          </button>
          <button
            onClick={() => handleAction("purge_all")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Purge All Email Data
          </button>
        </div>
        <p className="text-[0.6875rem] text-text-muted flex items-center gap-1.5">
          <svg className="w-3 h-3 text-primary-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          These actions only affect email-sourced data. PDF guideline data is never modified.
        </p>
      </div>
    </div>
  );
}


// ─── Main Admin Hub Page ──────────────────────────────────────────────────────

export default function AdminHub() {
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    setAuthorized(isAdmin());
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <main className="max-w-[800px] mx-auto px-6 py-16">
        {!authorized ? (
          <div className="text-center py-16">
            <h1 className="text-2xl font-bold text-text mb-2">Access Denied</h1>
            <p className="text-text-muted mb-6">This page is restricted to administrators.</p>
            <Link to="/app/dashboard" className="text-primary-600 no-underline hover:underline">
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-text mb-2">Admin Hub</h1>
            <p className="text-text-muted mb-8">Platform administration tools.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <a
                href="https://dash.cloudflare.com"
                target="_blank"
                rel="noopener noreferrer"
                className="block p-5 bg-surface border border-border-light rounded-xl no-underline hover:border-primary-200 transition-colors"
              >
                <h3 className="text-sm font-bold text-text mb-1">Cloudflare Dashboard</h3>
                <p className="text-xs text-text-muted">Workers, Pages, DNS</p>
              </a>
              <a
                href="https://mtgbroker.outseta.com/nocode"
                target="_blank"
                rel="noopener noreferrer"
                className="block p-5 bg-surface border border-border-light rounded-xl no-underline hover:border-primary-200 transition-colors"
              >
                <h3 className="text-sm font-bold text-text mb-1">Outseta</h3>
                <p className="text-xs text-text-muted">Users, billing, auth</p>
              </a>
              <a
                href="https://supabase.com/dashboard/project/tcmahfwhdknxhhdvqpum"
                target="_blank"
                rel="noopener noreferrer"
                className="block p-5 bg-surface border border-border-light rounded-xl no-underline hover:border-primary-200 transition-colors"
              >
                <h3 className="text-sm font-bold text-text mb-1">Supabase</h3>
                <p className="text-xs text-text-muted">Database, tables, queries</p>
              </a>
              <a
                href="https://airtable.com/appuJgI9X93OLaf0u"
                target="_blank"
                rel="noopener noreferrer"
                className="block p-5 bg-surface border border-border-light rounded-xl no-underline hover:border-primary-200 transition-colors"
              >
                <h3 className="text-sm font-bold text-text mb-1">Airtable</h3>
                <p className="text-xs text-text-muted">Loan products, lenders</p>
              </a>
            </div>

            {/* Lender Email Updates Section */}
            <LenderUpdatesSection />
          </>
        )}
      </main>
    </div>
  );
}

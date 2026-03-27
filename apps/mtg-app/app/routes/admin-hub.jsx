import { useState, useEffect } from "react";
import { Link } from "react-router";
import Navbar from "../components/Navbar";
import { isAdmin, getAccessToken } from "../lib/auth";

// API endpoints for the lender email ingestion system
const INGEST_EMAIL_URL = "https://mtg-loan-finder.pages.dev/api/ingest-email";
const MANAGE_EMAILS_URL = "https://mtg-loan-finder.pages.dev/api/manage-emails";
const ADD_LENDER_URL = "https://mtg-loan-finder.pages.dev/api/add-lender";

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


// ─── Add Lender from URL Section ─────────────────────────────────────────────

const PROGRESS_MSGS = [
  "Fetching lender website...",
  "Checking sub-pages (about, wholesale, contact)...",
  "Extracting lender details with AI...",
  "Checking for duplicates in Airtable...",
  "Creating lender record...",
];

function AddLenderSection() {
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    setResult(null);

    let msgIdx = 0;
    setProgress(PROGRESS_MSGS[0]);
    const interval = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, PROGRESS_MSGS.length - 1);
      setProgress(PROGRESS_MSGS[msgIdx]);
    }, 3000);

    try {
      const token = getAccessToken();
      const res = await fetch(ADD_LENDER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add lender");

      setResult(data);
      if (data.success) setUrl("");
    } catch (err) {
      setError(err.message);
    } finally {
      clearInterval(interval);
      setIsSubmitting(false);
      setProgress("");
    }
  };

  const handleForceCreate = async () => {
    if (!result?.extracted) return;
    setIsSubmitting(true);
    setError(null);
    setProgress("Creating lender record (override)...");

    try {
      const token = getAccessToken();
      const res = await fetch(ADD_LENDER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: url.trim(), force: true }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create record");
      setResult(data);
      if (data.success) setUrl("");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
      setProgress("");
    }
  };

  // Handler: update existing record (merge blank fields only)
  const handleUpdateExisting = async (recordId) => {
    if (!result?.extracted) return;
    setIsSubmitting(true);
    setError(null);
    setProgress("Updating existing record (filling blank fields)...");

    try {
      const token = getAccessToken();
      const res = await fetch(ADD_LENDER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: url.trim(), update_existing: recordId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update record");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
      setProgress("");
    }
  };

  // Friendly labels for extracted field keys
  const fieldLabels = {
    lender_name: "Lender Name",
    description: "Description",
    corporate_website: "Corporate Website",
    tpo_broker_portal: "TPO Broker Portal",
    nmls: "NMLS",
    fha_id: "FHA ID",
    va_id: "VA ID",
    usda_id: "USDA ID",
    licensed_states: "Licensed States",
    licensed_states_url: "Licensed States URL",
    scenario_desk: "Scenario Desk",
    facebook: "Facebook",
    linkedin: "LinkedIn",
    instagram: "Instagram",
    youtube: "YouTube",
    x_twitter: "X (Twitter)",
  };

  return (
    <div className="mt-10">
      <h2 className="text-lg font-bold text-text mb-1 flex items-center gap-2">
        <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        Add Lender from URL
      </h2>
      <p className="text-sm text-text-muted mb-5">
        Paste a lender's website URL — AI will scrape the site and create an Airtable record with extracted details.
      </p>

      {/* URL Input Form */}
      <div className="bg-surface border border-border-light rounded-xl p-6 mb-6 shadow-sm">
        <form onSubmit={handleSubmit} className="flex gap-3 items-stretch">
          <div className="flex-1 relative">
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.lendername.com"
              disabled={isSubmitting}
              className="w-full pl-10 pr-3 py-2.5 text-sm border-2 border-border-light rounded-lg bg-white text-text placeholder:text-gray-400 focus:outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-600/10 disabled:bg-gray-50 disabled:cursor-not-allowed transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={!url.trim() || isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
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
                Fetch &amp; Add
              </>
            )}
          </button>
        </form>

        {/* Progress indicator */}
        {isSubmitting && progress && (
          <div className="mt-4 flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <svg className="w-4 h-4 animate-spin text-primary-600 shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <span className="text-sm text-primary-600">{progress}</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* Duplicate Warning */}
        {result && result.duplicate && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-center gap-2 font-bold text-amber-800 mb-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Possible Duplicate Found
            </div>
            <p className="text-sm text-amber-900 mb-3">{result.message}</p>

            <div className="flex flex-wrap gap-2 mb-3">
              {result.existing_records?.map((rec) => (
                <a
                  key={rec.id}
                  href={`https://airtable.com/appuJgI9X93OLaf0u/tbl1mpg3KFakZsFK7/${rec.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-800 bg-white border border-amber-300 rounded-lg no-underline hover:bg-amber-100 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  {rec.name}
                </a>
              ))}
            </div>

            <div className="flex gap-2 flex-wrap">
              {/* Update Existing — fills blank fields on the first matching record */}
              {result.existing_records?.length > 0 && (
                <button
                  onClick={() => handleUpdateExisting(result.existing_records[0].id)}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Update Existing
                </button>
              )}
              <button
                onClick={handleForceCreate}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-primary-600 bg-white border-2 border-primary-600 rounded-lg hover:bg-primary-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Anyway
              </button>
              <button
                onClick={() => setResult(null)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-text-muted bg-white border border-border-light rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>

            {/* Show extracted data preview */}
            {result.extracted && (
              <div className="mt-4 pt-4 border-t border-amber-200">
                <h4 className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Extracted Details
                </h4>
                <ExtractedTable data={result.extracted} labels={fieldLabels} />
              </div>
            )}
          </div>
        )}

        {/* Success Result — handles both "created" and "updated" */}
        {result && result.success && (
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex items-center gap-2 font-bold text-emerald-800 mb-3">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {result.updated
                ? result.no_changes
                  ? "No New Data to Add"
                  : "Existing Record Updated"
                : "Lender Added Successfully"}
            </div>

            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <span className="text-base font-bold text-text">{result.lender_name}</span>
              <a
                href={result.airtable_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 no-underline hover:underline"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open in Airtable
              </a>
            </div>

            {/* Updated record: show what was filled vs skipped */}
            {result.updated && !result.no_changes && (
              <>
                <div className="mb-3">
                  <h4 className="text-xs font-bold text-emerald-700 mb-1.5 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Fields Filled In ({result.fields_updated?.length || 0})
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {result.fields_updated?.map((f) => (
                      <span key={f} className="px-2 py-0.5 text-[0.6875rem] font-medium bg-emerald-100 text-emerald-800 rounded-full">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
                {result.fields_skipped?.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-xs font-bold text-gray-500 mb-1.5 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Already Had Data — Not Overwritten ({result.fields_skipped.length})
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {result.fields_skipped?.map((f) => (
                        <span key={f} className="px-2 py-0.5 text-[0.6875rem] font-medium bg-blue-50 text-blue-700 rounded-full">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Updated record: no changes needed */}
            {result.updated && result.no_changes && (
              <p className="text-sm text-emerald-700 mb-3">
                All extractable fields already have data — nothing new to add.
              </p>
            )}

            {/* New record: show fields populated */}
            {!result.updated && (
              <div className="mb-3">
                <h4 className="text-xs font-bold text-emerald-700 mb-1.5 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Fields Populated ({result.fields_populated?.length || 0})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {result.fields_populated?.map((f) => (
                    <span key={f} className="px-2 py-0.5 text-[0.6875rem] font-medium bg-emerald-100 text-emerald-800 rounded-full">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Fields still needed (shown for both create and update) */}
            {result.fields_missing?.length > 0 && (
              <div className="mb-3">
                <h4 className="text-xs font-bold text-gray-500 mb-1.5 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Still Needs Manual Entry ({result.fields_missing.length})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {result.fields_missing?.map((f) => (
                    <span key={f} className="px-2 py-0.5 text-[0.6875rem] font-medium bg-gray-100 text-gray-500 rounded-full">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* All extracted values */}
            {result.extracted && (
              <div className="mt-3 pt-3 border-t border-emerald-200">
                <h4 className="text-xs font-bold text-emerald-700 mb-2 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  All Extracted Values
                </h4>
                <ExtractedTable data={result.extracted} labels={fieldLabels} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Reusable table showing extracted lender data
function ExtractedTable({ data, labels }) {
  const rows = Object.entries(data).filter(([, v]) => v !== null && v !== "");
  if (rows.length === 0) return <p className="text-xs text-text-muted">No fields extracted.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-border-light">
      <table className="w-full text-xs">
        <tbody>
          {rows.map(([key, value]) => (
            <tr key={key} className="border-b border-border-light last:border-0">
              <td className="px-3 py-2 font-semibold text-text-muted whitespace-nowrap w-[140px] bg-gray-50">
                {labels[key] || key}
              </td>
              <td className="px-3 py-2 text-text break-all">
                {typeof value === "string" && value.startsWith("http") ? (
                  <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary-600 no-underline hover:underline">
                    {value}
                  </a>
                ) : (
                  String(value).length > 200 ? String(value).slice(0, 200) + "..." : String(value)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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

            {/* Add Lender from URL */}
            <AddLenderSection />

            {/* Lender Email Updates Section */}
            <LenderUpdatesSection />
          </>
        )}
      </main>
    </div>
  );
}

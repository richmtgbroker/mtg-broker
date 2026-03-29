import { useState, useEffect, useCallback } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { isAdmin as checkIsAdmin, getAccessToken } from "../../lib/auth";

const SUPABASE_URL = "https://tcmahfwhdknxhhdvqpum.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjbWFoZndoZGtueGhoZHZxcHVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMzQ5MTgsImV4cCI6MjA4NDYxMDkxOH0.xtc5YiU0Gzemj3SJN5UHXUiG9ys7O6mjz1qlmk-3qlQ";
const MAGIC_LINK_API = "/api/contact-edit";
const CACHE_KEY_PREFIX = "mtg_contact_detail_";
const CACHE_TTL = 10 * 60 * 1000;

export function meta() {
  return [{ title: "Contact — MtgBroker" }];
}

/* ── Helpers ── */
function formatPhone(raw) {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const num = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (num.length === 10) return `(${num.slice(0, 3)}) ${num.slice(3, 6)}-${num.slice(6)}`;
  return raw;
}

function rawDigits(raw) {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function copyToClipboard(text, showToast) {
  navigator.clipboard.writeText(text).then(() => showToast("Copied to clipboard"));
}

function buildAllContactText(c) {
  const lines = [c.name];
  if (c.job_title) lines.push(c.job_title);
  if (c.company_name) lines.push(c.company_name);
  if (c.email) lines.push(`Email: ${c.email}`);
  if (c.mobile) lines.push(`Mobile: ${formatPhone(c.mobile)}`);
  if (c.office) {
    let ph = `Office: ${formatPhone(c.office)}`;
    if (c.extension) ph += ` x${c.extension}`;
    lines.push(ph);
  }
  if (c.nmls) lines.push(`NMLS# ${c.nmls}`);
  if (c.linkedin) lines.push(`LinkedIn: ${c.linkedin}`);
  if (c.zoom_room) lines.push(`Zoom: ${c.zoom_room}`);
  return lines.join("\n");
}

/* ── Toast ── */
function Toast({ message }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: "#0F172A",
        color: "#fff",
        padding: "10px 24px",
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 500,
        zIndex: 10000,
        boxShadow: "0 4px 20px rgba(0,0,0,.25)",
      }}
    >
      <i className="fa-solid fa-check" style={{ marginRight: 8, color: "#4ADE80" }} />
      {message}
    </div>
  );
}

/* ── Breadcrumb ── */
function Breadcrumb({ name }) {
  return (
    <nav style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748B", marginBottom: 16, flexWrap: "wrap" }}>
      <Link to="/app/contacts" style={{ color: "#2563EB", textDecoration: "none", fontWeight: 500 }}>
        <i className="fa-solid fa-arrow-left" style={{ marginRight: 5, fontSize: 11 }} />
        Contacts
      </Link>
      {name && (
        <>
          <span style={{ color: "#CBD5E1" }}>/</span>
          <span style={{ color: "#0F172A", fontWeight: 600 }}>{name}</span>
        </>
      )}
    </nav>
  );
}

/* ── Action Row (contact info row with copy button) ── */
function ActionRow({ icon, iconBg, label, href, displayText, copyText, showToast }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 0",
        borderBottom: "1px solid #F1F5F9",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <i className={icon} style={{ color: "#fff", fontSize: 14 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {label}
        </div>
        <a
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
          style={{ fontSize: 14, color: "#2563EB", textDecoration: "none", wordBreak: "break-all" }}
        >
          {displayText}
        </a>
      </div>
      <button
        onClick={() => copyToClipboard(copyText, showToast)}
        style={{
          background: "none",
          border: "1px solid #E2E8F0",
          borderRadius: 6,
          padding: "6px 8px",
          cursor: "pointer",
          color: "#64748B",
          flexShrink: 0,
        }}
        title="Copy"
      >
        <i className="fa-regular fa-copy" style={{ fontSize: 13 }} />
      </button>
    </div>
  );
}

/* ── Magic Link Request Form ── */
function MagicLinkForm({ contactEmail, contactSlug, showToast }) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email.trim()) return;

    setSending(true);
    try {
      const res = await fetch(`${MAGIC_LINK_API}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), slug: contactSlug }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSent(true);
        showToast("Magic link sent! Check your email.");
      } else {
        setError(data.error || "Unable to send magic link. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setSending(false);
  }

  if (sent) {
    return (
      <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: "20px 24px", textAlign: "center" }}>
        <i className="fa-solid fa-envelope-circle-check" style={{ fontSize: 32, color: "#16A34A", marginBottom: 8, display: "block" }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: "#166534", marginBottom: 4 }}>Check your email!</div>
        <div style={{ fontSize: 13, color: "#15803D" }}>
          We sent an edit link to <strong>{email}</strong>. It expires in 48 hours.
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "20px 24px" }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "0 0 8px 0" }}>
        <i className="fa-solid fa-pen-to-square" style={{ marginRight: 8, color: "#2563EB" }} />
        Update Your Information
      </h3>
      <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 14px 0", lineHeight: 1.5 }}>
        Enter the email address associated with this contact to receive an edit link.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            flex: "1 1 200px",
            padding: "9px 14px",
            border: "1px solid #E2E8F0",
            borderRadius: 8,
            fontSize: 14,
            outline: "none",
            fontFamily: "inherit",
          }}
        />
        <button
          type="submit"
          disabled={sending}
          style={{
            padding: "9px 20px",
            borderRadius: 8,
            border: "none",
            background: sending ? "#94A3B8" : "#2563EB",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: sending ? "default" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {sending ? "Sending..." : "Send Edit Link"}
        </button>
      </form>
      {error && (
        <div style={{ fontSize: 13, color: "#DC2626", marginTop: 8 }}>
          <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 4 }} />
          {error}
        </div>
      )}
    </div>
  );
}

/* ── Self-Edit Form ── */
function EditForm({ contact, token, onSaved, showToast }) {
  const [form, setForm] = useState({
    preferred_name: contact.preferred_name || "",
    job_title: contact.job_title || "",
    mobile: contact.mobile || "",
    office: contact.office || "",
    extension: contact.extension || "",
    linkedin: contact.linkedin || "",
    zoom_room: contact.zoom_room || "",
    bio: contact.bio || "",
    nmls: contact.nmls || "",
    territory_states: contact.territory_states || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`${MAGIC_LINK_API}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, slug: contact.slug, changes: form }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast("Changes submitted for review!");
        onSaved(form);
      } else {
        setError(data.error || "Failed to save changes.");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setSaving(false);
  }

  function InputField({ label, field, type = "text", placeholder = "" }) {
    return (
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {label}
        </label>
        <input
          type={type}
          value={form[field]}
          onChange={(e) => handleChange(field, e.target.value)}
          placeholder={placeholder}
          style={{
            width: "100%",
            padding: "9px 14px",
            border: "1px solid #E2E8F0",
            borderRadius: 8,
            fontSize: 14,
            outline: "none",
            fontFamily: "inherit",
            boxSizing: "border-box",
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", border: "2px solid #2563EB", borderRadius: 10, padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <i className="fa-solid fa-pen" style={{ color: "#fff", fontSize: 14 }} />
        </div>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: 0 }}>Edit Your Information</h3>
          <div style={{ fontSize: 12, color: "#64748B" }}>Changes will be submitted for review</div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <InputField label="Preferred Name" field="preferred_name" placeholder="How you'd like to be called" />
        <InputField label="Job Title" field="job_title" placeholder="e.g. Account Executive" />
        <InputField label="NMLS#" field="nmls" placeholder="e.g. 123456" />
        <InputField label="Mobile Phone" field="mobile" placeholder="(555) 123-4567" type="tel" />
        <InputField label="Office Phone" field="office" placeholder="(555) 123-4567" type="tel" />
        <InputField label="Extension" field="extension" placeholder="e.g. 123" />
        <InputField label="LinkedIn URL" field="linkedin" placeholder="https://linkedin.com/in/..." type="url" />
        <InputField label="Zoom Room" field="zoom_room" placeholder="https://zoom.us/j/..." type="url" />
        <InputField label="Licensed States" field="territory_states" placeholder="e.g. CA, TX, FL" />

        {/* Bio — textarea */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Bio
          </label>
          <textarea
            value={form.bio}
            onChange={(e) => handleChange("bio", e.target.value)}
            placeholder="Tell us about yourself..."
            rows={4}
            style={{
              width: "100%",
              padding: "9px 14px",
              border: "1px solid #E2E8F0",
              borderRadius: 8,
              fontSize: 14,
              outline: "none",
              fontFamily: "inherit",
              boxSizing: "border-box",
              resize: "vertical",
            }}
          />
        </div>

        {error && (
          <div style={{ fontSize: 13, color: "#DC2626", marginBottom: 12 }}>
            <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 4 }} />
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              flex: 1,
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              background: saving ? "#94A3B8" : "#2563EB",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: saving ? "default" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {saving ? "Submitting..." : "Submit Changes for Review"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── Main Page ── */
export default function ContactDetailPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const editToken = searchParams.get("edit_token");

  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copyMsg, setCopyMsg] = useState("");
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenChecked, setTokenChecked] = useState(!editToken);

  const adminUser = checkIsAdmin();

  /* Load Font Awesome 6 */
  useEffect(() => {
    if (document.querySelector('link[href*="font-awesome"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css";
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  }, []);

  /* Fetch contact from Supabase */
  useEffect(() => {
    if (!slug) return;
    async function load() {
      const cacheKey = CACHE_KEY_PREFIX + slug;

      // Check cache (skip if we have an edit token — always load fresh)
      if (!editToken) {
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed?.ts && Date.now() - parsed.ts < CACHE_TTL) {
              setContact(parsed.data);
              setLoading(false);
              fetchData(slug, cacheKey, true);
              return;
            }
          }
        } catch {}
      }

      await fetchData(slug, cacheKey, false);
    }

    async function fetchData(s, cacheKey, background) {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/contacts?slug=eq.${encodeURIComponent(s)}&limit=1`,
          {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          }
        );
        if (!res.ok) {
          if (!background) { setError("Contact not found"); setLoading(false); }
          return;
        }
        const data = await res.json();
        if (data.length > 0) {
          setContact(data[0]);
          try {
            localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: data[0] }));
          } catch {}
        } else if (!background) {
          setError("Contact not found");
        }
      } catch {
        if (!background) setError("Failed to load contact.");
      }
      if (!background) setLoading(false);
    }

    load();
  }, [slug, editToken]);

  /* Verify edit token if present */
  useEffect(() => {
    if (!editToken || !contact) return;
    async function verifyToken() {
      try {
        const res = await fetch(`${MAGIC_LINK_API}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: editToken, slug }),
        });
        const data = await res.json();
        setTokenValid(data.valid === true);
      } catch {
        setTokenValid(false);
      }
      setTokenChecked(true);
    }
    verifyToken();
  }, [editToken, contact, slug]);

  /* Toast helper */
  function showToast(msg) {
    setCopyMsg(msg);
    setTimeout(() => setCopyMsg(""), 2500);
  }

  const copyLink = useCallback(() => {
    const url = window.location.origin + `/app/contacts/${slug}`;
    navigator.clipboard.writeText(url).then(() => showToast("Link copied!")).catch(() => {});
  }, [slug]);

  const shareLink = useCallback(() => {
    if (navigator.share) {
      navigator.share({ title: contact?.preferred_name || contact?.name || "Contact", url: window.location.origin + `/app/contacts/${slug}` }).catch(() => {});
    } else {
      copyLink();
    }
  }, [contact, copyLink, slug]);

  function handleSaved(newData) {
    // Merge saved data into local contact state for immediate UI feedback
    setContact((prev) => ({ ...prev, ...newData, pending_review: true }));
    // Clear cache so next visit loads fresh
    try { localStorage.removeItem(CACHE_KEY_PREFIX + slug); } catch {}
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div>
        <Breadcrumb />
        <div style={{ background: "linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", borderRadius: 10, height: 200, marginBottom: 14 }} />
        <div style={{ background: "linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", borderRadius: 10, height: 150, marginBottom: 14 }} />
        <style>{`@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>
      </div>
    );
  }

  /* ── Error ── */
  if (error || !contact) {
    return (
      <div>
        <Breadcrumb />
        <div style={{ textAlign: "center", padding: "64px 20px", background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10 }}>
          <i className="fa-solid fa-user-slash" style={{ fontSize: 40, color: "#CBD5E1", marginBottom: 12, display: "block" }} />
          <div style={{ fontSize: 18, fontWeight: 600, color: "#0F172A", marginBottom: 4 }}>{error || "Contact not found"}</div>
          <Link to="/app/contacts" style={{ fontSize: 14, color: "#2563EB", textDecoration: "none", marginTop: 8, display: "inline-block" }}>
            &larr; Back to Contacts
          </Link>
        </div>
      </div>
    );
  }

  const c = contact;
  const displayName = c.preferred_name || c.name;

  return (
    <div>
      {/* Toast */}
      {copyMsg && <Toast message={copyMsg} />}

      {/* Breadcrumb */}
      <Breadcrumb name={displayName} />

      {/* Pending review banner */}
      {c.pending_review && adminUser && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "12px 20px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <i className="fa-solid fa-clock" style={{ color: "#D97706", fontSize: 16 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#92400E" }}>Pending Review</div>
            <div style={{ fontSize: 12, color: "#A16207" }}>This contact has submitted changes that need review.</div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ background: "linear-gradient(135deg, #0C4A6E, #1D4ED8)", borderRadius: 12, padding: "28px 24px", marginBottom: 20, textAlign: "center", position: "relative" }}>
        {/* Action buttons - top right */}
        <div style={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 6 }}>
          <button onClick={copyLink} style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#CBD5E1", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <i className="fa-solid fa-link" style={{ marginRight: 4 }} />Copy Link
          </button>
          <button onClick={shareLink} style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#CBD5E1", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <i className="fa-solid fa-share-nodes" style={{ marginRight: 4 }} />Share
          </button>
          {adminUser && (
            <a
              href={`https://airtable.com/appuJgI9X93OLaf0u/tblEEDPa1vXeR6cnT/viwXP46Ml5H2RHml3/${c.airtable_id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid rgba(245,158,11,0.5)", background: "rgba(245,158,11,0.15)", color: "#FBBF24", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textDecoration: "none", display: "inline-flex", alignItems: "center" }}
            >
              <i className="fa-solid fa-table" style={{ marginRight: 4 }} />Airtable
            </a>
          )}
        </div>

        {/* Avatar */}
        {c.headshot_url ? (
          <img
            src={c.headshot_url}
            alt={c.name}
            style={{ width: 88, height: 88, borderRadius: "50%", objectFit: "cover", border: "3px solid rgba(255,255,255,.3)", margin: "0 auto 14px", display: "block" }}
          />
        ) : (
          <div style={{ width: 88, height: 88, borderRadius: "50%", background: "rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 30, fontWeight: 700, color: "#fff" }}>
            {getInitials(c.name)}
          </div>
        )}

        <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{displayName}</div>
        {c.job_title && <div style={{ fontSize: 14, color: "rgba(255,255,255,.8)" }}>{c.job_title}</div>}
        {c.company_name && <div style={{ fontSize: 14, color: "rgba(255,255,255,.6)", marginTop: 2 }}>{c.company_name}</div>}

        {/* Badges */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginTop: 12 }}>
          {c.nmls && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: "rgba(255,255,255,0.15)", color: "#CBD5E1" }}>
              NMLS# {c.nmls}
            </span>
          )}
          {c.lender_or_vendor && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: "rgba(255,255,255,0.15)", color: "#CBD5E1" }}>
              {c.lender_or_vendor}
            </span>
          )}
          {c.nationwide_territory && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: "rgba(16,185,129,0.2)", color: "#6EE7B7" }}>
              <i className="fa-solid fa-globe" style={{ marginRight: 4 }} />Nationwide
            </span>
          )}
        </div>
      </div>

      {/* Two-column layout on desktop */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
        {/* ── Contact Info ── */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "20px 24px" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "0 0 12px 0" }}>
            <i className="fa-solid fa-address-card" style={{ marginRight: 8, color: "#2563EB" }} />
            Contact Information
          </h2>

          {c.email && (
            <ActionRow icon="fa-solid fa-envelope" iconBg="#2563EB" label="Email" href={`mailto:${c.email}`} displayText={c.email} copyText={c.email} showToast={showToast} />
          )}
          {c.mobile && (
            <ActionRow icon="fa-solid fa-mobile-screen" iconBg="#16A34A" label="Mobile" href={`tel:${rawDigits(c.mobile)}`} displayText={formatPhone(c.mobile)} copyText={formatPhone(c.mobile)} showToast={showToast} />
          )}
          {c.office && (
            <ActionRow icon="fa-solid fa-phone" iconBg="#7C3AED" label="Office" href={`tel:${rawDigits(c.office)}`} displayText={formatPhone(c.office) + (c.extension ? ` x${c.extension}` : "")} copyText={formatPhone(c.office) + (c.extension ? ` x${c.extension}` : "")} showToast={showToast} />
          )}
          {c.linkedin && (
            <ActionRow icon="fa-brands fa-linkedin-in" iconBg="#0A66C2" label="LinkedIn" href={c.linkedin} displayText="View Profile" copyText={c.linkedin} showToast={showToast} />
          )}
          {c.zoom_room && (
            <ActionRow icon="fa-solid fa-video" iconBg="#DC2626" label="Zoom Room" href={c.zoom_room} displayText="Join Meeting" copyText={c.zoom_room} showToast={showToast} />
          )}

          {/* Copy All */}
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => copyToClipboard(buildAllContactText(c), showToast)}
              style={{
                width: "100%",
                padding: "10px 0",
                borderRadius: 8,
                border: "1px solid #E2E8F0",
                background: "#F8FAFC",
                color: "#334155",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontFamily: "inherit",
              }}
            >
              <i className="fa-regular fa-copy" />
              Copy All Contact Info
            </button>
          </div>
        </div>

        {/* ── Bio ── */}
        {c.bio && (
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "20px 24px" }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "0 0 10px 0" }}>
              <i className="fa-solid fa-user" style={{ marginRight: 8, color: "#2563EB" }} />
              About
            </h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: "#334155", margin: 0, whiteSpace: "pre-wrap" }}>
              {c.bio}
            </p>
          </div>
        )}

        {/* ── Licensed States ── */}
        {c.territory_states && (
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "20px 24px" }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "0 0 10px 0" }}>
              <i className="fa-solid fa-map" style={{ marginRight: 8, color: "#2563EB" }} />
              Licensed States
            </h2>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {c.territory_states.split(",").map((state) => state.trim()).filter(Boolean).map((state) => (
                <span
                  key={state}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "4px 12px",
                    borderRadius: 100,
                    background: "#EFF6FF",
                    color: "#2563EB",
                  }}
                >
                  {state}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Self-Edit Section ── */}
        {editToken && tokenChecked && tokenValid && (
          <EditForm
            contact={c}
            token={editToken}
            onSaved={handleSaved}
            showToast={showToast}
          />
        )}

        {editToken && tokenChecked && !tokenValid && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "20px 24px", textAlign: "center" }}>
            <i className="fa-solid fa-link-slash" style={{ fontSize: 32, color: "#DC2626", marginBottom: 8, display: "block" }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: "#991B1B", marginBottom: 4 }}>Edit link expired or invalid</div>
            <div style={{ fontSize: 13, color: "#B91C1C" }}>
              Please request a new edit link below.
            </div>
          </div>
        )}

        {/* Magic link request form — show if no active edit token */}
        {(!editToken || (tokenChecked && !tokenValid)) && c.email && (
          <MagicLinkForm contactEmail={c.email} contactSlug={slug} showToast={showToast} />
        )}
      </div>

      {/* Bottom spacing */}
      <div style={{ height: 40 }} />
    </div>
  );
}

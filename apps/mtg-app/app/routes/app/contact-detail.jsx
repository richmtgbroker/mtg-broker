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

/* ── Magic Link Request Form (collapsed by default, subtle) ── */
function MagicLinkForm({ contactEmail, contactSlug, showToast }) {
  const [expanded, setExpanded] = useState(false);
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
      <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: "14px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#166534" }}>
          <i className="fa-solid fa-check" style={{ marginRight: 6, color: "#16A34A" }} />
          Edit link sent to <strong>{email}</strong>
        </div>
      </div>
    );
  }

  // Collapsed state — just a subtle text link
  if (!expanded) {
    return (
      <div style={{ textAlign: "center", padding: "8px 0" }}>
        <button
          onClick={() => setExpanded(true)}
          style={{
            background: "none",
            border: "none",
            color: "#94A3B8",
            fontSize: 12,
            cursor: "pointer",
            fontFamily: "inherit",
            padding: "4px 8px",
          }}
        >
          <i className="fa-solid fa-pen-to-square" style={{ marginRight: 5 }} />
          Is this your profile? Request edit access
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "14px 20px" }}>
      <div style={{ fontSize: 12, color: "#64748B", marginBottom: 8 }}>
        Enter your email to receive an edit link.
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            flex: "1 1 180px",
            padding: "7px 12px",
            border: "1px solid #E2E8F0",
            borderRadius: 6,
            fontSize: 13,
            outline: "none",
            fontFamily: "inherit",
            background: "#fff",
          }}
        />
        <button
          type="submit"
          disabled={sending}
          style={{
            padding: "7px 14px",
            borderRadius: 6,
            border: "none",
            background: sending ? "#94A3B8" : "#64748B",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: sending ? "default" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {sending ? "Sending..." : "Send Link"}
        </button>
      </form>
      {error && (
        <div style={{ fontSize: 12, color: "#DC2626", marginTop: 6 }}>
          <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 4 }} />
          {error}
        </div>
      )}
    </div>
  );
}

/* ── Photo Upload Component ── */
function PhotoUpload({ contact, token, showToast }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [uploaded, setUploaded] = useState(false);

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate client-side
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      showToast("Please use JPEG, PNG, WebP, or GIF");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("Image must be under 5MB");
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(file);

    // Upload
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("token", token);
      formData.append("slug", contact.slug);
      formData.append("file", file);

      const res = await fetch(`${MAGIC_LINK_API}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUploaded(true);
        showToast("Photo uploaded — pending review");
      } else {
        setPreview(null);
        showToast(data.error || "Upload failed");
      }
    } catch {
      setPreview(null);
      showToast("Upload failed — please try again");
    }
    setUploading(false);
  }

  const currentPhoto = preview || contact.headshot_url;

  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Profile Photo
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Current / preview photo */}
        {currentPhoto ? (
          <img
            src={currentPhoto}
            alt="Profile"
            style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: "2px solid #E2E8F0", flexShrink: 0 }}
          />
        ) : (
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 22, fontWeight: 700, flexShrink: 0 }}>
            {getInitials(contact.name)}
          </div>
        )}

        <div>
          {uploaded ? (
            <div style={{ fontSize: 13, color: "#16A34A", fontWeight: 500 }}>
              <i className="fa-solid fa-check-circle" style={{ marginRight: 4 }} />
              Photo uploaded — pending review
            </div>
          ) : (
            <>
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                  background: uploading ? "#F1F5F9" : "#fff",
                  color: uploading ? "#94A3B8" : "#334155",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: uploading ? "default" : "pointer",
                }}
              >
                <i className={uploading ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-camera"} style={{ fontSize: 13 }} />
                {uploading ? "Uploading..." : "Upload Photo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleFileChange}
                  disabled={uploading}
                  style={{ display: "none" }}
                />
              </label>
              <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>
                JPEG, PNG, WebP, or GIF • Max 5MB
              </div>
            </>
          )}
        </div>
      </div>
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
        <PhotoUpload contact={contact} token={token} showToast={showToast} />
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

      {/* ── Header (matches lender/vendor detail pattern) ── */}
      <div style={{ background: "#1E3A5F", padding: "18px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", borderRadius: 12, marginBottom: 20 }}>
        {/* Avatar — with onError fallback for broken images */}
        {c.headshot_url ? (
          <img
            src={c.headshot_url}
            alt={c.name}
            onError={(e) => {
              // Replace broken image with initials div
              const parent = e.target.parentNode;
              const fallback = document.createElement("div");
              Object.assign(fallback.style, { width: "80px", height: "80px", borderRadius: "12px", border: "2px solid rgba(255,255,255,0.22)", background: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0", fontSize: "28px", fontWeight: "700", color: "#fff" });
              fallback.textContent = getInitials(c.name);
              parent.replaceChild(fallback, e.target);
            }}
            style={{ width: 80, height: 80, borderRadius: 12, objectFit: "cover", border: "2px solid rgba(255,255,255,0.22)", flexShrink: 0 }}
          />
        ) : (
          <div style={{ width: 80, height: 80, borderRadius: 12, border: "2px solid rgba(255,255,255,0.22)", background: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 28, fontWeight: 700, color: "#fff" }}>
            {getInitials(c.name)}
          </div>
        )}

        {/* Name + badges */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#FFFFFF", lineHeight: 1.2, margin: "0 0 4px 0" }}>
            {displayName}
          </h1>
          {c.job_title && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginBottom: 2 }}>{c.job_title}</div>}
          {c.company_name && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>{c.company_name}</div>}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
          <button onClick={copyLink} title="Copy Link" style={{ width: 38, height: 38, borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#CBD5E1", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
            <i className="fa-solid fa-link" />
          </button>
          <button onClick={shareLink} title="Share" style={{ width: 38, height: 38, borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#CBD5E1", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
            <i className="fa-solid fa-share-nodes" />
          </button>
          <button onClick={() => copyToClipboard(buildAllContactText(c), showToast)} title="Copy All Info" style={{ width: 38, height: 38, borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#CBD5E1", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
            <i className="fa-regular fa-copy" />
          </button>
          {adminUser && (
            <a
              href={`https://airtable.com/appuJgI9X93OLaf0u/tblEEDPa1vXeR6cnT/viwXP46Ml5H2RHml3/${c.airtable_id}`}
              target="_blank"
              rel="noopener noreferrer"
              title="View in Airtable"
              style={{ width: 38, height: 38, borderRadius: 8, border: "1px solid rgba(245,158,11,0.5)", background: "rgba(245,158,11,0.15)", color: "#FBBF24", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, textDecoration: "none" }}
            >
              <i className="fa-solid fa-table" />
            </a>
          )}
        </div>
      </div>

      {/* ── Two-column content grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>

        {/* ── Contact Info card ── */}
        <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #2563EB55" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 16px", background: "#2563EB20", borderBottom: "1px solid #2563EB45" }}>
            <div style={{ width: 3, height: 16, borderRadius: 2, flexShrink: 0, background: "#2563EB" }} />
            <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.01em", textTransform: "uppercase", color: "#2563EB" }}>Contact Information</span>
          </div>
          <div style={{ padding: "4px 16px 12px" }}>
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
          </div>
        </div>

        {/* ── Licensed States card ── */}
        {c.territory_states && (
          <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #2563EB55" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 16px", background: "#2563EB20", borderBottom: "1px solid #2563EB45" }}>
              <div style={{ width: 3, height: 16, borderRadius: 2, flexShrink: 0, background: "#2563EB" }} />
              <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.01em", textTransform: "uppercase", color: "#2563EB" }}>Licensed States</span>
            </div>
            <div style={{ padding: "16px", display: "flex", gap: 6, flexWrap: "wrap" }}>
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

        {/* ── Bio card (full width) ── */}
        {c.bio && (
          <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #2563EB55", gridColumn: "1 / -1" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 16px", background: "#2563EB20", borderBottom: "1px solid #2563EB45" }}>
              <div style={{ width: 3, height: 16, borderRadius: 2, flexShrink: 0, background: "#2563EB" }} />
              <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.01em", textTransform: "uppercase", color: "#2563EB" }}>About</span>
            </div>
            <div style={{ padding: "16px" }}>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: "#334155", margin: 0, whiteSpace: "pre-wrap" }}>
                {c.bio}
              </p>
            </div>
          </div>
        )}

        {/* ── Self-Edit Section (full width) ── */}
        {editToken && tokenChecked && tokenValid && (
          <div style={{ gridColumn: "1 / -1" }}>
            <EditForm
              contact={c}
              token={editToken}
              onSaved={handleSaved}
              showToast={showToast}
            />
          </div>
        )}

        {editToken && tokenChecked && !tokenValid && (
          <div style={{ gridColumn: "1 / -1", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "14px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#991B1B" }}>
              <i className="fa-solid fa-link-slash" style={{ marginRight: 6 }} />
              Edit link expired or invalid — request a new one below.
            </div>
          </div>
        )}
      </div>

      {/* Magic link request — subtle, below the grid */}
      {(!editToken || (tokenChecked && !tokenValid)) && c.email && (
        <MagicLinkForm contactEmail={c.email} contactSlug={slug} showToast={showToast} />
      )}

      {/* Bottom spacing */}
      <div style={{ height: 40 }} />
    </div>
  );
}

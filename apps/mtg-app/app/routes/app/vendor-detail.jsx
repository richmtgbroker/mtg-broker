import { useState, useEffect, useCallback } from "react";
import { Link, useParams } from "react-router";
import { isAdmin as checkIsAdmin, isNexaUser, checkNexaAccess } from "../../lib/auth";

const VENDORS_API = "/api/vendors";
const FAVORITES_API = "/api/favorites";
const CACHE_KEY_PREFIX = "mtg_vendor_detail_";
const CACHE_TTL = 30 * 60 * 1000;

/* ── Section icon mapping ── */
function getSectionIcon(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("link")) return "fa-solid fa-link";
  if (n.includes("pricing") || n.includes("cost")) return "fa-solid fa-dollar-sign";
  if (n.includes("contact")) return "fa-solid fa-address-book";
  if (n.includes("nexa")) return "fa-solid fa-shield-halved";
  if (n.includes("feature")) return "fa-solid fa-list-check";
  if (n.includes("support")) return "fa-solid fa-headset";
  if (n.includes("integration")) return "fa-solid fa-plug";
  return "fa-solid fa-circle-info";
}

/* ── Section header color ── */
function getSectionColor(name) {
  if (name && name.toUpperCase().indexOf("NEXA") !== -1) return "#1E3A5F";
  return "#2563EB";
}

/* ── Format field value for display ── */
function renderFieldValue(field, copyToClipboard) {
  const { value, renderMode, displayName } = field;
  if (value === null || value === undefined || value === "") return <span style={{ color: "#94A3B8" }}>—</span>;

  // Link
  if (renderMode === "link") {
    return (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "#2563EB", textDecoration: "none", fontSize: 13, wordBreak: "break-all" }}
      >
        {displayName || "Open Link"} <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: 10, marginLeft: 3 }} />
      </a>
    );
  }

  // Copyable (e.g. email, phone)
  if (renderMode === "copyable") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 13, color: "#0F172A" }}>{String(value)}</span>
        <button
          onClick={(e) => { e.stopPropagation(); copyToClipboard(String(value), displayName); }}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 12, padding: 2 }}
          title="Copy"
        >
          <i className="fa-regular fa-copy" />
        </button>
      </span>
    );
  }

  // Boolean
  if (renderMode === "boolean") {
    // Value might be "🟢 Yes", "🔴 No", or an actual boolean
    if (typeof value === "boolean") {
      return value
        ? <span style={{ color: "#16A34A", fontWeight: 600 }}>✓ Yes</span>
        : <span style={{ color: "#DC2626", fontWeight: 600 }}>✗ No</span>;
    }
    return <span style={{ fontSize: 13 }}>{String(value)}</span>;
  }

  // Currency — format numbers with $ sign
  if (typeof value === "number") {
    if (displayName && (displayName.toLowerCase().includes("cost") || displayName.toLowerCase().includes("fee") || displayName.toLowerCase().includes("price"))) {
      return <span style={{ fontSize: 13, color: "#0F172A", fontWeight: 600 }}>{value === 0 ? "Free" : `$${value.toLocaleString()}`}</span>;
    }
    return <span style={{ fontSize: 13, color: "#0F172A" }}>{value.toLocaleString()}</span>;
  }

  // Default text
  const str = String(value);
  if (str.startsWith("http")) {
    return (
      <a href={str} target="_blank" rel="noopener noreferrer" style={{ color: "#2563EB", textDecoration: "none", fontSize: 13 }}>
        Open Link <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: 10, marginLeft: 3 }} />
      </a>
    );
  }
  return <span style={{ fontSize: 13, color: "#0F172A" }}>{str}</span>;
}

/* ── Breadcrumb ── */
function Breadcrumb({ vendorName }) {
  return (
    <nav style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748B", marginBottom: 16, flexWrap: "wrap" }}>
      <Link to="/app/vendors" style={{ color: "#2563EB", textDecoration: "none", fontWeight: 500 }}>
        <i className="fa-solid fa-arrow-left" style={{ marginRight: 5, fontSize: 11 }} />
        Vendors
      </Link>
      {vendorName && (
        <>
          <span style={{ color: "#CBD5E1" }}>/</span>
          <span style={{ color: "#0F172A", fontWeight: 600 }}>{vendorName}</span>
        </>
      )}
    </nav>
  );
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

export function meta() {
  return [{ title: "Vendor Detail — MtgBroker" }];
}

export default function VendorDetailPage() {
  const { slug } = useParams();
  const [vendor, setVendor] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [logoError, setLogoError] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");
  const [nexaAuthorized, setNexaAuthorized] = useState(() => isNexaUser());

  /* Async NEXA check (Outseta custom field fallback) */
  useEffect(() => {
    if (!nexaAuthorized) {
      checkNexaAccess().then((result) => { if (result) setNexaAuthorized(true); });
    }
  }, []);

  /* Load Font Awesome 6 */
  useEffect(() => {
    if (document.querySelector('link[href*="font-awesome"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css";
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  }, []);

  /* Load vendor data */
  useEffect(() => {
    if (!slug) return;
    async function load() {
      const cacheKey = CACHE_KEY_PREFIX + slug;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.ts && Date.now() - parsed.ts < CACHE_TTL) {
            setVendor(parsed.data.vendor);
            setCategories(parsed.data.categories || []);
            setLoading(false);
            // Background refresh
            fetchVendor(slug, cacheKey, true);
            return;
          }
        }
      } catch {}
      await fetchVendor(slug, cacheKey, false);
    }
    async function fetchVendor(s, cacheKey, background) {
      try {
        const res = await fetch(`${VENDORS_API}/${s}`);
        if (!res.ok) {
          if (!background) { setError("Vendor not found"); setLoading(false); }
          return;
        }
        const data = await res.json();
        if (data.success && data.vendor) {
          setVendor(data.vendor);
          setCategories(data.categories || []);
          try {
            localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: { vendor: data.vendor, categories: data.categories || [] } }));
          } catch {}
        } else if (!background) {
          setError("Vendor not found");
        }
      } catch {
        if (!background) setError("Failed to load vendor data. Please try again.");
      }
      if (!background) setLoading(false);
    }
    load();
  }, [slug]);

  /* Load favorite state */
  useEffect(() => {
    if (!vendor) return;
    async function loadFavorites() {
      try {
        const token = localStorage.getItem("Outseta.nocode.accessToken");
        if (!token) return;
        const res = await fetch(`${FAVORITES_API}?type=Vendor`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && Array.isArray(data.favorites)) {
          setIsFav(data.favorites.some((f) => f.record_id === vendor.id));
        }
      } catch {}
    }
    loadFavorites();
  }, [vendor]);

  /* Toggle favorite */
  const toggleFav = useCallback(async () => {
    if (!vendor) return;
    const token = localStorage.getItem("Outseta.nocode.accessToken");
    if (!token) return;
    try {
      const method = isFav ? "DELETE" : "POST";
      const res = await fetch(FAVORITES_API, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "Vendor", record_id: vendor.id, name: vendor.name }),
      });
      if (res.ok) {
        setIsFav(!isFav);
        showToast(isFav ? "Removed from favorites" : "Added to favorites");
      }
    } catch {}
  }, [vendor, isFav]);

  /* Toast + clipboard helpers */
  function showToast(msg) {
    setCopyMsg(msg);
    setTimeout(() => setCopyMsg(""), 2500);
  }

  function copyToClipboard(text, label) {
    navigator.clipboard.writeText(text).then(() => showToast((label || "Value") + " copied!")).catch(() => {});
  }

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => showToast("Link copied!")).catch(() => {});
  }, []);

  const shareLink = useCallback(() => {
    if (navigator.share) {
      navigator.share({ title: vendor?.name || "Vendor", url: window.location.href }).catch(() => {});
    } else {
      copyLink();
    }
  }, [vendor, copyLink]);

  const adminUser = checkIsAdmin();

  /* ── Loading ── */
  if (loading) {
    return (
      <div style={{ background: "#F8FAFC", minHeight: "100vh" }}>
        <Breadcrumb />
        <div style={{ background: "linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", borderRadius: 10, height: 100, marginBottom: 14 }} />
        <div style={{ background: "linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", borderRadius: 10, height: 200, marginBottom: 14 }} />
        <style>{`@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>
      </div>
    );
  }

  /* ── Error ── */
  if (error || !vendor) {
    return (
      <div style={{ background: "#F8FAFC", minHeight: "100vh" }}>
        <Breadcrumb />
        <div style={{ textAlign: "center", padding: "64px 20px", background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#0F172A", marginBottom: 4 }}>{error || "Vendor not found"}</div>
          <Link to="/app/vendors" style={{ fontSize: 14, color: "#2563EB", textDecoration: "none", marginTop: 8, display: "inline-block" }}>
            ← Back to Vendors
          </Link>
        </div>
      </div>
    );
  }

  const sections = vendor.sections || [];
  const accountReps = vendor.accountReps || [];
  const otherContacts = vendor.otherContacts || [];
  let faviconUrl = !logoError && vendor.logo ? vendor.logo : null;

  /* Filter NEXA sections for non-NEXA users */
  const visibleSections = sections.filter((s) => {
    if (s.hasNexa && !nexaAuthorized) return false;
    return true;
  });

  return (
    <div style={{ background: "#F8FAFC", minHeight: "100vh" }}>
      {/* Toast */}
      {copyMsg && <Toast message={copyMsg} />}

      {/* Breadcrumb */}
      <Breadcrumb vendorName={vendor.name} />

      {/* ── Header ── */}
      <div style={{ background: "#1E3A5F", padding: "18px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", borderRadius: 12, marginBottom: 20 }}>
        {/* Logo */}
        <div style={{ width: 80, height: 80, borderRadius: 12, border: "2px solid rgba(255,255,255,0.22)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff", fontWeight: 800, fontSize: 26, background: "#2563EB" }}>
          {faviconUrl ? (
            <img src={faviconUrl} alt={vendor.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setLogoError(true)} />
          ) : (
            vendor.name.charAt(0).toUpperCase()
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#FFFFFF", lineHeight: 1.2, margin: "0 0 6px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {vendor.name}
          </h1>
          {/* Category badges */}
          {vendor.categoryNames && vendor.categoryNames.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {vendor.categoryNames.map((cat) => (
                <span key={cat} style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: "rgba(255,255,255,0.15)", color: "#CBD5E1", letterSpacing: "0.03em" }}>
                  {cat}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
          {/* Favorite heart */}
          <button
            onClick={toggleFav}
            title={isFav ? "Remove from favorites" : "Add to favorites"}
            style={{
              width: 38, height: 38, borderRadius: 8,
              border: isFav ? "1px solid rgba(251,113,133,0.6)" : "1px solid rgba(255,255,255,0.2)",
              background: isFav ? "rgba(251,113,133,0.2)" : "rgba(255,255,255,0.08)",
              color: isFav ? "#FB7185" : "rgba(255,255,255,0.5)",
              fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, transition: "all 0.15s",
            }}
          >
            <i className={isFav ? "fa-solid fa-heart" : "fa-regular fa-heart"} />
          </button>

          {/* Copy Link */}
          <button onClick={copyLink} style={{ padding: "7px 14px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#CBD5E1", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <i className="fa-solid fa-link" style={{ marginRight: 5 }} />Copy Link
          </button>

          {/* Share */}
          <button onClick={shareLink} style={{ padding: "7px 14px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#CBD5E1", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <i className="fa-solid fa-share-nodes" style={{ marginRight: 5 }} />Share
          </button>

          {/* Admin-only: Airtable record */}
          {adminUser && vendor.airtableLink && (
            <a href={vendor.airtableLink} target="_blank" rel="noopener noreferrer" style={{ padding: "7px 14px", borderRadius: 7, border: "1px solid rgba(245,158,11,0.5)", background: "rgba(245,158,11,0.15)", color: "#FBBF24", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
              <i className="fa-solid fa-table" style={{ marginRight: 5 }} />Airtable
            </a>
          )}
        </div>
      </div>

      {/* ── Description ── */}
      {vendor.description && (
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "20px 24px", marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "0 0 10px 0" }}>
            <i className="fa-solid fa-circle-info" style={{ marginRight: 8, color: "#2563EB" }} />
            About {vendor.name}
          </h2>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: "#334155", margin: 0 }}>
            {vendor.description}
          </p>
        </div>
      )}

      {/* ── Category Info ── */}
      {categories.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "20px 24px", marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "0 0 10px 0" }}>
            <i className="fa-solid fa-tags" style={{ marginRight: 8, color: "#2563EB" }} />
            Categories
          </h2>
          {categories.map((cat) => (
            <div key={cat.id} style={{ marginBottom: categories.length > 1 ? 12 : 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", marginBottom: 4 }}>{cat.name}</div>
              {cat.description && (
                <p style={{ fontSize: 13, lineHeight: 1.6, color: "#64748B", margin: 0 }}>{cat.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Sections (Links, Pricing, Contact, etc.) ── */}
      {visibleSections.map((section) => {
        const sectionColor = getSectionColor(section.name);
        const fields = (section.fields || []).filter((f) => {
          // Hide NEXA-gated fields from non-NEXA users
          if (f.nexaGated && !nexaAuthorized) return false;
          return true;
        });
        if (fields.length === 0) return null;

        return (
          <div key={section.name} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "20px 24px", marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "0 0 14px 0" }}>
              <i className={getSectionIcon(section.name)} style={{ marginRight: 8, color: sectionColor }} />
              {section.name}
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {fields.map((field) => (
                <div key={field.fieldName} style={{ padding: "10px 14px", background: "#F8FAFC", borderRadius: 8, border: "1px solid #F1F5F9" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                    {field.displayName}
                  </div>
                  <div>{renderFieldValue(field, copyToClipboard)}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* ── Account Reps ── */}
      {accountReps.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "20px 24px", marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "0 0 14px 0" }}>
            <i className="fa-solid fa-user-tie" style={{ marginRight: 8, color: "#2563EB" }} />
            Account Representatives
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {accountReps.map((rep, i) => (
              <div key={i} style={{ padding: "14px 16px", background: "#F8FAFC", borderRadius: 8, border: "1px solid #F1F5F9" }}>
                {rep.name && <div style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", marginBottom: 4 }}>{rep.name}</div>}
                {rep.title && <div style={{ fontSize: 12, color: "#64748B", marginBottom: 6 }}>{rep.title}</div>}
                {rep.email && (
                  <div style={{ fontSize: 13, marginBottom: 3 }}>
                    <i className="fa-solid fa-envelope" style={{ marginRight: 6, color: "#94A3B8", fontSize: 11 }} />
                    <a href={`mailto:${rep.email}`} style={{ color: "#2563EB", textDecoration: "none" }}>{rep.email}</a>
                    <button onClick={() => copyToClipboard(rep.email, "Email")} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 11, marginLeft: 4, padding: 2 }}><i className="fa-regular fa-copy" /></button>
                  </div>
                )}
                {rep.phone && (
                  <div style={{ fontSize: 13 }}>
                    <i className="fa-solid fa-phone" style={{ marginRight: 6, color: "#94A3B8", fontSize: 11 }} />
                    <a href={`tel:${rep.phone}`} style={{ color: "#2563EB", textDecoration: "none" }}>{rep.phone}</a>
                    <button onClick={() => copyToClipboard(rep.phone, "Phone")} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 11, marginLeft: 4, padding: 2 }}><i className="fa-regular fa-copy" /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Other Contacts ── */}
      {otherContacts.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "20px 24px", marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "0 0 14px 0" }}>
            <i className="fa-solid fa-address-book" style={{ marginRight: 8, color: "#2563EB" }} />
            Other Contacts
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {otherContacts.map((contact, i) => (
              <div key={i} style={{ padding: "14px 16px", background: "#F8FAFC", borderRadius: 8, border: "1px solid #F1F5F9" }}>
                {contact.name && <div style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", marginBottom: 4 }}>{contact.name}</div>}
                {contact.title && <div style={{ fontSize: 12, color: "#64748B", marginBottom: 6 }}>{contact.title}</div>}
                {contact.email && (
                  <div style={{ fontSize: 13, marginBottom: 3 }}>
                    <i className="fa-solid fa-envelope" style={{ marginRight: 6, color: "#94A3B8", fontSize: 11 }} />
                    <a href={`mailto:${contact.email}`} style={{ color: "#2563EB", textDecoration: "none" }}>{contact.email}</a>
                  </div>
                )}
                {contact.phone && (
                  <div style={{ fontSize: 13 }}>
                    <i className="fa-solid fa-phone" style={{ marginRight: 6, color: "#94A3B8", fontSize: 11 }} />
                    <a href={`tel:${contact.phone}`} style={{ color: "#2563EB", textDecoration: "none" }}>{contact.phone}</a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom spacing */}
      <div style={{ height: 40 }} />
    </div>
  );
}

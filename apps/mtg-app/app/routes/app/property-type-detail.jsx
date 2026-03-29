import { useState, useEffect, useCallback } from "react";
import { Link, useParams } from "react-router";
import { isAdmin as checkIsAdmin } from "../../lib/auth";

const API_URL = "https://mtg-broker-property-types.rich-e00.workers.dev/api/property-types";
const CACHE_KEY_PREFIX = "mtg_property_type_detail_";
const CACHE_TTL = 10 * 60 * 1000;

export function meta() {
  return [{ title: "Property Type Detail — MtgBroker" }];
}

/* ── Breadcrumb ── */
function Breadcrumb({ name }) {
  return (
    <nav style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748B", marginBottom: 16, flexWrap: "wrap" }}>
      <Link to="/app/property-types" style={{ color: "#2563EB", textDecoration: "none", fontWeight: 500 }}>
        <i className="fa-solid fa-arrow-left" style={{ marginRight: 5, fontSize: 11 }} />
        Property Types
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

export default function PropertyTypeDetailPage() {
  const { slug } = useParams();
  const [propertyType, setPropertyType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copyMsg, setCopyMsg] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  /* Load Font Awesome 6 */
  useEffect(() => {
    if (document.querySelector('link[href*="font-awesome"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css";
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  }, []);

  /* Fetch property type data */
  useEffect(() => {
    if (!slug) return;
    async function load() {
      const cacheKey = CACHE_KEY_PREFIX + slug;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.ts && Date.now() - parsed.ts < CACHE_TTL) {
            setPropertyType(parsed.data);
            setLoading(false);
            // Background refresh
            fetchData(slug, cacheKey, true);
            return;
          }
        }
      } catch {}
      await fetchData(slug, cacheKey, false);
    }
    async function fetchData(s, cacheKey, background) {
      try {
        const res = await fetch(`${API_URL}/${s}`);
        if (!res.ok) {
          if (!background) { setError("Property type not found"); setLoading(false); }
          return;
        }
        const data = await res.json();
        if (data.success && data.propertyType) {
          setPropertyType(data.propertyType);
          try {
            localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: data.propertyType }));
          } catch {}
        } else if (!background) {
          setError("Property type not found");
        }
      } catch {
        if (!background) setError("Failed to load data. Please try again.");
      }
      if (!background) setLoading(false);
    }
    load();
  }, [slug]);

  /* Helpers */
  function showToast(msg) {
    setCopyMsg(msg);
    setTimeout(() => setCopyMsg(""), 2500);
  }

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => showToast("Link copied!")).catch(() => {});
  }, []);

  const shareLink = useCallback(() => {
    if (navigator.share) {
      navigator.share({ title: propertyType?.name || "Property Type", url: window.location.href }).catch(() => {});
    } else {
      copyLink();
    }
  }, [propertyType, copyLink]);

  const adminUser = checkIsAdmin();

  /* Filter lenders by search */
  const lenders = propertyType?.lenders || [];
  const filteredLenders = searchTerm
    ? lenders.filter((l) => l.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : lenders;

  /* ── Loading ── */
  if (loading) {
    return (
      <div>
        <Breadcrumb />
        <div style={{ background: "linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", borderRadius: 10, height: 100, marginBottom: 14 }} />
        <div style={{ background: "linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", borderRadius: 10, height: 200, marginBottom: 14 }} />
        <style>{`@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>
      </div>
    );
  }

  /* ── Error ── */
  if (error || !propertyType) {
    return (
      <div>
        <Breadcrumb />
        <div style={{ textAlign: "center", padding: "64px 20px", background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>&#128269;</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#0F172A", marginBottom: 4 }}>{error || "Property type not found"}</div>
          <Link to="/app/property-types" style={{ fontSize: 14, color: "#2563EB", textDecoration: "none", marginTop: 8, display: "inline-block" }}>
            &larr; Back to Property Types
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Toast */}
      {copyMsg && <Toast message={copyMsg} />}

      {/* Breadcrumb */}
      <Breadcrumb name={propertyType.name} />

      {/* ── Header ── */}
      <div style={{ background: "#1E3A5F", padding: "18px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", borderRadius: 12, marginBottom: 20 }}>
        {/* Icon */}
        <div style={{ width: 64, height: 64, borderRadius: 12, border: "2px solid rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "#2563EB" }}>
          <i className="fa-solid fa-building" style={{ color: "#fff", fontSize: 24 }} />
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#FFFFFF", lineHeight: 1.2, margin: "0 0 6px 0" }}>
            {propertyType.name}
          </h1>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: "rgba(255,255,255,0.15)", color: "#CBD5E1", letterSpacing: "0.03em" }}>
              {propertyType.lenderCount} lender{propertyType.lenderCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
          {/* Copy Link */}
          <button onClick={copyLink} style={{ padding: "7px 14px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#CBD5E1", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <i className="fa-solid fa-link" style={{ marginRight: 5 }} />Copy Link
          </button>

          {/* Share */}
          <button onClick={shareLink} style={{ padding: "7px 14px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#CBD5E1", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <i className="fa-solid fa-share-nodes" style={{ marginRight: 5 }} />Share
          </button>

          {/* Admin-only: Airtable record */}
          {adminUser && propertyType.airtableUrl && (
            <a href={propertyType.airtableUrl} target="_blank" rel="noopener noreferrer" style={{ padding: "7px 14px", borderRadius: 7, border: "1px solid rgba(245,158,11,0.5)", background: "rgba(245,158,11,0.15)", color: "#FBBF24", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
              <i className="fa-solid fa-table" style={{ marginRight: 5 }} />Airtable
            </a>
          )}
        </div>
      </div>

      {/* ── Description ── */}
      {propertyType.description && (
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "20px 24px", marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "0 0 10px 0" }}>
            <i className="fa-solid fa-circle-info" style={{ marginRight: 8, color: "#2563EB" }} />
            About This Property Type
          </h2>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: "#334155", margin: 0 }}>
            {propertyType.description}
          </p>
        </div>
      )}

      {/* ── Lenders Section ── */}
      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "20px 24px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: 0 }}>
            <i className="fa-solid fa-building-columns" style={{ marginRight: 8, color: "#2563EB" }} />
            Available Lenders
            <span style={{
              fontSize: 12, fontWeight: 600, marginLeft: 10, padding: "2px 10px", borderRadius: 100,
              background: searchTerm ? "#EFF6FF" : "#F1F5F9",
              color: searchTerm ? "#2563EB" : "#64748B"
            }}>
              {searchTerm ? `${filteredLenders.length} of ${lenders.length}` : lenders.length}
            </span>
          </h2>

          {/* Search lenders (only show if 10+) */}
          {lenders.length >= 10 && (
            <div style={{ position: "relative", width: 220 }}>
              <i className="fa-solid fa-magnifying-glass" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#94A3B8", pointerEvents: "none" }} />
              <input
                type="text"
                placeholder="Search lenders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%", padding: "7px 30px 7px 30px", borderRadius: 8, border: "1px solid #E2E8F0",
                  fontSize: 13, color: "#0F172A", outline: "none", fontFamily: "inherit", boxSizing: "border-box"
                }}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 12, padding: 2 }}
                >
                  &#10005;
                </button>
              )}
            </div>
          )}
        </div>

        {lenders.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 16px", color: "#94A3B8" }}>
            <i className="fa-solid fa-building-columns" style={{ fontSize: 28, marginBottom: 8, display: "block", opacity: 0.4 }} />
            <div style={{ fontSize: 14, fontWeight: 500 }}>No lenders available for this property type yet</div>
          </div>
        ) : filteredLenders.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 16px", color: "#94A3B8" }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>No lenders match "{searchTerm}"</div>
            <button onClick={() => setSearchTerm("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#2563EB", fontSize: 13, fontWeight: 500, fontFamily: "inherit" }}>Clear search</button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
            {filteredLenders.map((lender) => (
              <Link
                key={lender.slug}
                to={`/app/lenders/${lender.slug}`}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 16px", borderRadius: 8, border: "1px solid #F1F5F9",
                  background: "#F8FAFC", textDecoration: "none", color: "#0F172A",
                  transition: "all 0.15s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#EFF6FF";
                  e.currentTarget.style.borderColor = "#BFDBFE";
                  e.currentTarget.style.borderLeftWidth = "2px";
                  e.currentTarget.style.borderLeftColor = "#2563EB";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#F8FAFC";
                  e.currentTarget.style.borderColor = "#F1F5F9";
                  e.currentTarget.style.borderLeftWidth = "1px";
                  e.currentTarget.style.borderLeftColor = "#F1F5F9";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 6, background: "#2563EB",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: 13, fontWeight: 700, flexShrink: 0
                  }}>
                    {lender.name.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {searchTerm ? highlightMatch(lender.name, searchTerm) : lender.name}
                  </span>
                </div>
                <i className="fa-solid fa-chevron-right" style={{ fontSize: 10, color: "#94A3B8", flexShrink: 0 }} />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Bottom spacing */}
      <div style={{ height: 40 }} />
    </div>
  );
}

/* Highlight search matches in lender names */
function highlightMatch(text, term) {
  if (!term) return text;
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: "#fef08a", padding: "0 1px", borderRadius: 2 }}>{text.slice(idx, idx + term.length)}</mark>
      {text.slice(idx + term.length)}
    </>
  );
}

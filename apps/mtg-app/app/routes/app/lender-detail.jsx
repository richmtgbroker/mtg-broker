import { useState, useEffect, useCallback } from "react";
import { Link, useParams } from "react-router";
import {
  getLenderNotes, saveLenderNotes,
  getLenderRating, saveLenderRating,
  getLenderFavorite, toggleLenderFavorite,
  syncFromSupabase, getUserEmail,
} from "../../hooks/useUserPreferences";
import { isAdmin as checkIsAdmin, isNexaUser, checkNexaAccess } from "../../lib/auth";

const LENDERS_API = "https://mtg-broker-lenders.rich-e00.workers.dev/api/lenders";
const CACHE_KEY_PREFIX = "mtg_lender_detail_";
const CACHE_TTL = 30 * 60 * 1000;

/* ── Config maps (match Worker JS) ── */
const SOCIAL_CONFIG = {
  Facebook:      { icon: "fa-brands fa-facebook",  color: "#1877F2", label: "Facebook" },
  LinkedIn:      { icon: "fa-brands fa-linkedin",  color: "#0A66C2", label: "LinkedIn" },
  Instagram:     { icon: "fa-brands fa-instagram", color: "#E1306C", label: "Instagram" },
  "X (Twitter)": { icon: "fa-brands fa-x-twitter", color: "#000000", label: "X" },
  YouTube:       { icon: "fa-brands fa-youtube",   color: "#FF0000", label: "YouTube" },
};

const PRICING_ENGINE_CONFIG = {
  LenderPrice: { icon: "fa-solid fa-chart-line",              label: "LenderPrice", url: "https://marketplace.digitallending.com/#/login" },
  Loansifter:  { icon: "fa-solid fa-magnifying-glass-dollar", label: "Loansifter",  url: "https://loansifternow.optimalblue.com/" },
  Polly:       { icon: "fa-solid fa-wave-square",             label: "Polly",       url: "https://lx.pollyex.com/accounts/login/" },
  Arive:       { icon: "fa-solid fa-rocket",                  label: "Arive",       url: "https://www.arive.com/" },
};

const LINK_ICON_CONFIG = {
  Website:                 "fa-solid fa-globe",
  "Broker Portal":         "fa-solid fa-arrow-right-to-bracket",
  "Correspondent Website": "fa-solid fa-building",
  "Correspondent Portal":  "fa-solid fa-door-open",
  Products:                "fa-solid fa-file-invoice-dollar",
  "Scenario Desk":         "fa-solid fa-comments-dollar",
  "Turn Times":            "fa-solid fa-clock",
  "Lender Fees":           "fa-solid fa-receipt",
  "Quick Pricer":          "fa-solid fa-bolt",
  "TPO Portal Pricer":     "fa-solid fa-calculator",
  "Guidelines & Matrices": "fa-solid fa-book-open",
  "NEXA Drive Folder":     "fa-brands fa-google-drive",
  "Licensed States":       "fa-solid fa-map",
};

function getSectionColor(name) {
  if (name && name.toUpperCase().indexOf("NEXA") !== -1) return "#1E3A5F";
  return "#2563EB";
}

function isValidURL(str) {
  try { new URL(str); return true; } catch { return false; }
}

/* simple markdown-ish → HTML (bold, italic, links, newlines) */
function parseMarkdown(text) {
  let s = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:#2563EB;text-decoration:underline;">$1</a>')
    .replace(/\n/g, "<br/>");
  return s;
}

export function meta() {
  return [{ title: "Lender Detail — MtgBroker" }];
}

export default function LenderDetailPage() {
  const { slug } = useParams();
  const [lender, setLender] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [logoError, setLogoError] = useState(false);
  const [selectedAE, setSelectedAE] = useState(null);
  const [copyMsg, setCopyMsg] = useState("");
  const [isFav, setIsFav] = useState(false);
  const [starRating, setStarRating] = useState(0);
  const [privateNotes, setPrivateNotes] = useState("");
  const [notesSaveStatus, setNotesSaveStatus] = useState("");
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

  /* Load lender data */
  useEffect(() => {
    if (!slug) return;
    async function load() {
      const cacheKey = CACHE_KEY_PREFIX + slug;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.ts && Date.now() - parsed.ts < CACHE_TTL) {
            setLender(parsed.data);
            setLoading(false);
            fetchLender(slug, cacheKey, true);
            return;
          }
        }
      } catch {}
      await fetchLender(slug, cacheKey, false);
    }
    async function fetchLender(s, cacheKey, background) {
      try {
        const res = await fetch(`${LENDERS_API}/${s}`);
        if (!res.ok) { if (!background) { setError("Lender not found"); setLoading(false); } return; }
        const data = await res.json();
        if (data.success && data.lender) {
          setLender(data.lender);
          try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: data.lender })); } catch {}
        } else if (!background) { setError("Lender not found"); }
      } catch { if (!background) setError("Failed to load lender data. Please try again."); }
      if (!background) setLoading(false);
    }
    load();
  }, [slug]);

  /* Load preferences from localStorage cache, then background-sync from Supabase */
  useEffect(() => {
    if (!slug) return;
    // Instant read from localStorage cache
    setIsFav(getLenderFavorite(slug));
    setStarRating(getLenderRating(slug));
    setPrivateNotes(getLenderNotes(slug));
    // Background sync from Supabase → update state if cloud has newer data
    (async () => {
      const favRow = await syncFromSupabase("lender_favorite", slug);
      if (favRow) setIsFav(favRow.value_bool === true);
      const ratingRow = await syncFromSupabase("lender_rating", slug);
      if (ratingRow) setStarRating(ratingRow.value_number || 0);
      const notesRow = await syncFromSupabase("lender_notes", slug);
      if (notesRow) setPrivateNotes(notesRow.value_text || "");
    })();
  }, [slug]);

  const toggleFav = useCallback(() => {
    toggleLenderFavorite(slug).then((next) => setIsFav(next));
  }, [slug]);

  const handleStarClick = useCallback((n) => {
    setStarRating(n);
    saveLenderRating(slug, n);
  }, [slug]);

  const handleNotesChange = useCallback((e) => {
    const v = e.target.value;
    setPrivateNotes(v);
    saveLenderNotes(slug, v);
    setNotesSaveStatus("Saved");
    setTimeout(() => setNotesSaveStatus(""), 2000);
  }, [slug]);

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      showToast("Link copied!");
    }).catch(() => {});
  }, []);

  const shareLink = useCallback(() => {
    if (navigator.share) {
      navigator.share({ title: lender?.name || "Lender", url: window.location.href }).catch(() => {});
    } else {
      copyLink();
    }
  }, [lender, copyLink]);

  function showToast(msg) {
    setCopyMsg(msg);
    setTimeout(() => setCopyMsg(""), 2500);
  }

  function copyToClipboard(text, label) {
    navigator.clipboard.writeText(text).then(() => showToast((label || "Value") + " copied!")).catch(() => {});
  }

  let faviconUrl = null;
  if (!logoError && lender?.logo) faviconUrl = lender.logo;

  /* ── Loading ── */
  if (loading) {
    return (
      <div style={{ background: "#F8FAFC", minHeight: "100vh" }}>
        <Breadcrumb />
        <div className="rounded-[10px] h-[100px] mb-3.5" style={{ background: "linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)", backgroundSize: "200% 100%", animation: "ld-shimmer 1.5s infinite" }} />
        <div className="rounded-[10px] h-[200px] mb-3.5" style={{ background: "linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)", backgroundSize: "200% 100%", animation: "ld-shimmer 1.5s infinite" }} />
        <style>{`@keyframes ld-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>
      </div>
    );
  }

  /* ── Error ── */
  if (error || !lender) {
    return (
      <div style={{ background: "#F8FAFC", minHeight: "100vh" }}>
        <Breadcrumb />
        <div className="text-center py-16 bg-white border border-[#E2E8F0] rounded-[10px]">
          <div className="text-4xl mb-3">&#128269;</div>
          <div className="text-lg font-semibold text-[#0F172A] mb-1">{error || "Lender not found"}</div>
          <Link to="/app/lenders" className="text-sm text-[#2563EB] no-underline hover:underline mt-2 inline-block">&larr; Back to Lenders</Link>
        </div>
      </div>
    );
  }

  const sections = lender.sections || [];
  const accountExecs = lender.accountExecs || [];
  const otherContacts = lender.otherContacts || [];
  const loanProducts = lender.loanProducts || [];
  const loanTypes = lender.loanTypes || [];

  /* Channel badges — NEXA tags only visible to NEXA-authorized users.
     Styles match the lender directory card tags. */
  const badges = [];
  if (lender.nexaWholesale) badges.push({ label: "Broker", style: { background: "#FEF3C7", color: "#92400E" } });
  if (lender.nexaNondel) badges.push({ label: "NonDel", style: { background: "#DCFCE7", color: "#15803D" } });
  if (nexaAuthorized && lender.nexa100) badges.push({ label: "NEXA\u{1F4AF}", style: { background: "#1a1a1a", color: "#FFFFFF" } });
  if (nexaAuthorized && lender.nexaOnly) badges.push({ label: "NEXA Only", style: { background: "#EDE9FE", color: "#6D28D9" } });

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "products", label: "Loan Products" },
    { id: "contacts", label: "Contacts" },
  ];

  /* Check if user is admin — uses shared ADMIN_EMAILS list from lib/auth.js */
  const adminUser = checkIsAdmin();

  return (
    <div style={{ background: "#F8FAFC", minHeight: "100vh" }}>
      {/* Breadcrumb */}
      <Breadcrumb lenderName={lender.name} />

      {/* Header — dark navy */}
      <div style={{ background: "#1E3A5F", padding: "18px 24px", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", borderRadius: "12px" }}>
        {/* Logo */}
        <div style={{ width: 80, height: 80, borderRadius: 12, border: "2px solid rgba(255,255,255,0.22)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff", fontWeight: 800, fontSize: 26, background: "#2563EB" }}>
          {faviconUrl ? (
            <img src={faviconUrl} alt={lender.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setLogoError(true)} />
          ) : (
            lender.name.charAt(0).toUpperCase()
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#FFFFFF", lineHeight: 1.2, margin: "0 0 8px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lender.name}</h1>
          {badges.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {badges.map((b) => (
                <span key={b.label} style={{ ...b.style, fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 100, letterSpacing: "0.05em" }}>{b.label}</span>
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
            style={{ width: 38, height: 38, borderRadius: 8, border: isFav ? "1px solid rgba(251,113,133,0.6)" : "1px solid rgba(255,255,255,0.2)", background: isFav ? "rgba(251,113,133,0.2)" : "rgba(255,255,255,0.08)", color: isFav ? "#FB7185" : "rgba(255,255,255,0.5)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
          >
            <i className={isFav ? "fa-solid fa-heart" : "fa-regular fa-heart"} />
          </button>

          {/* Copy Link */}
          <button onClick={copyLink} style={{ padding: "7px 14px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#CBD5E1", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s" }}>
            <i className="fa-solid fa-link" style={{ marginRight: 5 }} />Copy Link
          </button>

          {/* Share */}
          <button onClick={shareLink} style={{ padding: "7px 14px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#CBD5E1", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s" }}>
            <i className="fa-solid fa-share-nodes" style={{ marginRight: 5 }} />Share
          </button>

          {/* Admin-only: Airtable lender record */}
          {adminUser && lender.airtableLink && (
            <a href={lender.airtableLink} target="_blank" rel="noopener noreferrer" style={{ padding: "7px 14px", borderRadius: 7, border: "1px solid rgba(245,158,11,0.5)", background: "rgba(245,158,11,0.15)", color: "#FBBF24", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
              <i className="fa-solid fa-table" style={{ marginRight: 5 }} />Airtable
            </a>
          )}

          {/* Admin-only: Lender Detail Config table */}
          {adminUser && (
            <a href="https://airtable.com/appuJgI9X93OLaf0u/tblFuFTmTs0cZmWfO" target="_blank" rel="noopener noreferrer" style={{ padding: "7px 14px", borderRadius: 7, border: "1px solid rgba(168,85,247,0.5)", background: "rgba(168,85,247,0.15)", color: "#C084FC", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
              <i className="fa-solid fa-sliders" style={{ marginRight: 5 }} />Config
            </a>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12, padding: "10px 16px", flexWrap: "wrap", marginTop: 8 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "6px 16px", borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", transition: "all 0.15s",
              background: activeTab === tab.id ? "#2563EB" : "#F8FAFC",
              color: activeTab === tab.id ? "#FFFFFF" : "#64748B",
              border: activeTab === tab.id ? "1px solid #2563EB" : "1px solid #E2E8F0",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div style={{ marginTop: 20 }}>
        {/* ── Overview Tab ── */}
        {activeTab === "overview" && (
          <div>
            {/* Section cards grid */}
            {sections.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
                {sections.map((section, i) => (
                  <SectionCard key={i} section={section} copyToClipboard={copyToClipboard} />
                ))}
              </div>
            )}

            {/* Private Notes */}
            <div style={{ marginTop: 20 }}>
              <PrivateNotes
                starRating={starRating}
                onStarClick={handleStarClick}
                notes={privateNotes}
                onNotesChange={handleNotesChange}
                saveStatus={notesSaveStatus}
              />
            </div>
          </div>
        )}

        {/* ── Loan Products Tab ── */}
        {activeTab === "products" && (
          <div>
            {/* Loan Types */}
            {loanTypes.length > 0 && (
              <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden", marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                <SectionHeader title="Loan Types" color="#2563EB" />
                <div style={{ padding: "14px 16px", display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {loanTypes.map((lt) => (
                    <span key={lt} style={{ fontSize: 13, fontWeight: 500, padding: "5px 13px", borderRadius: 20, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}>{lt}</span>
                  ))}
                </div>
              </div>
            )}

            {loanProducts.length === 0 && loanTypes.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748B", fontSize: 13, background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 10 }}>
                <i className="fa-solid fa-file-invoice-dollar" style={{ fontSize: 28, color: "#94A3B8", marginBottom: 10, display: "block" }} />
                No loan products linked yet.
              </div>
            ) : loanProducts.length > 0 && (
              <>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#94A3B8", textTransform: "uppercase", margin: "0 0 10px 0" }}>Loan Product Types</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                  {loanProducts.map((prod, i) => (
                    <a
                      key={i}
                      href={prod.slug ? `/app/products/${prod.slug}` : "#"}
                      style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, textDecoration: "none", transition: "border-color 0.15s, background 0.15s, box-shadow 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#93C5FD"; e.currentTarget.style.background = "#F0F7FF"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.background = "#FFFFFF"; }}
                    >
                      <span style={{ fontSize: 15, color: "#0F172A", fontWeight: 500 }}>{prod.name || prod}</span>
                      <span style={{ fontSize: 14, color: "#2563EB", fontWeight: 600, flexShrink: 0 }}>&rsaquo;</span>
                    </a>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Contacts Tab ── */}
        {activeTab === "contacts" && (
          <div>
            {accountExecs.length === 0 && otherContacts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748B", fontSize: 13, background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 10 }}>
                <i className="fa-solid fa-users" style={{ fontSize: 28, color: "#94A3B8", marginBottom: 10, display: "block" }} />
                No contacts listed for this lender.
              </div>
            ) : (
              <>
                {/* Account Executives */}
                {accountExecs.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#94A3B8", textTransform: "uppercase", margin: "0 0 10px 0" }}>Account Executives</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
                      {accountExecs.map((ae, i) => (
                        <div
                          key={i}
                          onClick={() => setSelectedAE(ae)}
                          style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 10, padding: "18px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "center", transition: "border-color 0.15s, box-shadow 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#93C5FD"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(37,99,235,0.12)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)"; }}
                        >
                          <div style={{ width: 52, height: 52, borderRadius: "50%", overflow: "hidden", border: "2px solid #E2E8F0", flexShrink: 0 }}>
                            {ae.photo ? (
                              <img src={ae.photo} alt={ae.name} style={{ width: 52, height: 52, objectFit: "cover", borderRadius: "50%" }} />
                            ) : (
                              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563EB", fontWeight: 700, fontSize: 18 }}>
                                {ae.name?.charAt(0)?.toUpperCase() || "?"}
                              </div>
                            )}
                          </div>
                          <div>
                            <p style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", margin: 0, lineHeight: 1.3 }}>{ae.name}</p>
                            {ae.title && <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>{ae.title}</p>}
                          </div>
                          <span style={{ fontSize: 11, color: "#94A3B8" }}>Tap for details</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Other Contacts */}
                {otherContacts.length > 0 && (
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#94A3B8", textTransform: "uppercase", margin: "0 0 10px 0" }}>Other Contacts</p>
                    <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                      {otherContacts.map((oc, i) => (
                        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "12px 16px", alignItems: "center", gap: 8, background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC", borderBottom: i < otherContacts.length - 1 ? "1px solid #E2E8F0" : "none" }}>
                          <div>
                            <p style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", margin: 0 }}>{oc.name}</p>
                            {oc.title && <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>{oc.title}</p>}
                          </div>
                          <div />
                          <div style={{ textAlign: "right" }}>
                            {oc.email && <a href={`mailto:${oc.email}`} style={{ display: "block", fontSize: 13, color: "#2563EB", textDecoration: "none" }}>{oc.email}</a>}
                            {oc.phone && <a href={`tel:${oc.phone}`} style={{ display: "block", fontSize: 13, color: "#2563EB", textDecoration: "none" }}>{oc.phone}</a>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* AE Detail Modal */}
      {selectedAE && (
        <AEModal ae={selectedAE} onClose={() => setSelectedAE(null)} copyToClipboard={copyToClipboard} />
      )}

      {/* Copy Toast */}
      {copyMsg && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#1E293B", color: "#fff", padding: "8px 18px", borderRadius: 100, fontSize: 13, fontWeight: 500, zIndex: 10000 }}>
          {copyMsg}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   Breadcrumb
   ════════════════════════════════════════ */
function Breadcrumb({ lenderName }) {
  return (
    <nav style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#94A3B8", padding: "12px 0 10px" }}>
      <Link to="/app/lenders" style={{ color: "#2563EB", textDecoration: "none", fontWeight: 600 }}>Lenders</Link>
      <span style={{ color: "#E2E8F0" }}>/</span>
      <span style={{ color: "#64748B", fontWeight: 500 }}>{lenderName || "..."}</span>
    </nav>
  );
}

/* ════════════════════════════════════════
   Section Header (matches Worker)
   ════════════════════════════════════════ */
function SectionHeader({ title, color }) {
  const isDarkNavy = color === "#1E3A5F";
  if (isDarkNavy) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 16px", background: "#1E3A5F", borderBottom: "1px solid #152D4A" }}>
        <div style={{ width: 3, height: 16, borderRadius: 2, flexShrink: 0, background: "#FFFFFF", opacity: 0.5 }} />
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#FFFFFF" }}>{title}</span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 16px", background: color + "20", borderBottom: "1px solid " + color + "45" }}>
      <div style={{ width: 3, height: 16, borderRadius: 2, flexShrink: 0, background: color }} />
      <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.01em", textTransform: "uppercase", color: color }}>{title}</span>
    </div>
  );
}

/* ════════════════════════════════════════
   Section Card
   ════════════════════════════════════════ */
function SectionCard({ section, copyToClipboard }) {
  const fields = section.fields || [];
  if (fields.length === 0) return null;

  const color = getSectionColor(section.name);
  const isDarkNavy = color === "#1E3A5F";
  const cardBorder = isDarkNavy ? "#8EB5D4" : color + "55";

  // Detect if ALL fields share a single renderMode
  const modes = {};
  fields.forEach((f) => { modes[f.renderMode] = true; });
  const modeKeys = Object.keys(modes);
  const allSocial = modeKeys.length === 1 && modes["social"];
  const allPricing = modeKeys.length === 1 && modes["pricing-engine"];
  const allLinks = modeKeys.length === 1 && modes["link"];

  // About section spans full width
  const fullWidth = section.name === "About";

  // Pricing: filter to available only
  if (allPricing) {
    const available = fields.filter((f) => {
      const v = String(f.value || "").toLowerCase();
      return v.indexOf("yes") !== -1 || v.indexOf("\u2705") !== -1;
    });
    if (available.length === 0) return null;
  }

  return (
    <div style={{ background: "#FFFFFF", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid " + cardBorder, gridColumn: fullWidth ? "1 / -1" : undefined }}>
      <SectionHeader title={section.name} color={color} />

      {allSocial ? (
        <div style={{ padding: "12px 16px" }}>
          <SocialRow fields={fields} />
        </div>
      ) : allPricing ? (
        <PricingGrid fields={fields} />
      ) : allLinks ? (
        <LinkRows fields={fields} />
      ) : (
        fields.map((field, i) => (
          <FieldRow key={i} field={field} isLast={i === fields.length - 1} copyToClipboard={copyToClipboard} />
        ))
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   Field Row — handles ALL render modes
   ════════════════════════════════════════ */
function FieldRow({ field, isLast, copyToClipboard }) {
  const mode = field.renderMode || "text";
  const value = field.value;
  const label = field.displayName;

  if (value === null || value === undefined) return null;
  if (typeof value === "string" && (!value.trim() || value.trim() === "-")) return null;

  const rowStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", padding: "11px 16px", alignItems: "center", gap: 10, borderBottom: isLast ? "none" : "1px solid rgba(0,0,0,0.15)" };
  const labelEl = <span style={{ fontSize: 13, color: "#64748B", fontWeight: 500 }}>{label}</span>;

  switch (mode) {
    case "link": {
      if (!isValidURL(String(value))) return null;
      const icon = LINK_ICON_CONFIG[label] || "fa-solid fa-link";
      return (
        <div style={rowStyle}>
          {labelEl}
          <a href={String(value)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 6, background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#2563EB", fontSize: 12, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
            <i className={icon + " ld-link-btn-icon"} style={{ fontSize: 12, opacity: 0.8 }} />
            {label}
          </a>
        </div>
      );
    }

    case "boolean": {
      const isYes = value === true || String(value).toLowerCase().includes("yes") || value === "TRUE" || value === "true";
      return (
        <div style={rowStyle}>
          {labelEl}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 600, padding: "4px 11px", borderRadius: 100, whiteSpace: "nowrap", background: isYes ? "#F0FDF4" : "#F8FAFC", color: isYes ? "#15803D" : "#94A3B8", border: isYes ? "1px solid #BBF7D0" : "1px solid #E2E8F0" }}>
            {isYes ? "\u2713 Yes" : "\u2717 No"}
          </span>
        </div>
      );
    }

    case "pills": {
      const pillVal = String(value).trim();
      if (!pillVal) return null;
      const lv = pillVal.toLowerCase();
      const isYes = lv.includes("yes") || lv.includes("true");
      const isNo = lv.includes("no") || lv.includes("false");
      const pillStyle = isYes
        ? { background: "#F0FDF4", color: "#15803D", border: "1px solid #BBF7D0" }
        : isNo
        ? { background: "#F8FAFC", color: "#94A3B8", border: "1px solid #E2E8F0" }
        : { background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE" };
      return (
        <div style={rowStyle}>
          {labelEl}
          <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 13px", borderRadius: 100, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", ...pillStyle }}>{pillVal}</span>
        </div>
      );
    }

    case "notes": {
      const noteText = String(value).trim();
      if (!noteText) return null;
      return (
        <div style={{ padding: "10px 16px", borderBottom: isLast ? "none" : "1px solid rgba(0,0,0,0.15)" }}>
          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "12px 16px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#94A3B8", textTransform: "uppercase", margin: "0 0 8px 0" }}>{label}</p>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: "#64748B" }} dangerouslySetInnerHTML={{ __html: parseMarkdown(noteText) }} />
          </div>
        </div>
      );
    }

    case "richtext": {
      const proseText = String(value).trim();
      if (!proseText) return null;
      return (
        <div style={{ padding: "10px 16px", borderBottom: isLast ? "none" : "1px solid rgba(0,0,0,0.15)" }}>
          <div style={{ fontSize: 14, lineHeight: 1.7, color: "#64748B" }} dangerouslySetInnerHTML={{ __html: parseMarkdown(proseText) }} />
        </div>
      );
    }

    case "copyable": {
      const textVal = String(value);
      return (
        <div style={{ ...rowStyle, alignItems: "flex-start" }}>
          {labelEl}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flex: 1 }}>
            <pre style={{ flex: 1, fontSize: 13, lineHeight: 1.5, color: "#0F172A", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "8px 10px", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit" }}>{textVal}</pre>
            <button
              onClick={() => copyToClipboard(textVal, label)}
              style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#64748B", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}
              title="Copy to clipboard"
            >
              <i className="fa-solid fa-copy" />
            </button>
          </div>
        </div>
      );
    }

    case "list": {
      const listVal = String(value).trim();
      if (!listVal) return null;
      const items = listVal.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
      if (items.length === 0) return null;
      if (items.length === 1) {
        return (
          <div style={rowStyle}>
            {labelEl}
            <span style={{ fontSize: 15, fontWeight: 600, color: "#0F172A" }}>{items[0]}</span>
          </div>
        );
      }
      return (
        <div style={{ padding: "10px 16px", borderBottom: isLast ? "none" : "1px solid rgba(0,0,0,0.15)" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 6 }}>{label}</p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {items.map((item, j) => (
              <li key={j} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "5px 0", fontSize: 14, color: "#64748B", borderBottom: j < items.length - 1 ? "1px solid #E2E8F0" : "none", lineHeight: 1.5 }}>
                <span style={{ color: "#94A3B8", flexShrink: 0 }}>&ndash;</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      );
    }

    case "attachment": {
      if (!Array.isArray(value) || value.length === 0) return null;
      return (
        <div style={{ padding: "10px 16px", borderBottom: isLast ? "none" : "1px solid rgba(0,0,0,0.15)" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 6 }}>{label}</p>
          <div>
            {value.map((att, j) => {
              const ext = att.filename ? att.filename.split(".").pop().toUpperCase() : "FILE";
              return (
                <a key={j} href={att.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, textDecoration: "none", color: "#0F172A", fontSize: 13, fontWeight: 500, margin: "0 8px 8px 0" }}>
                  <i className="fa-solid fa-file-arrow-down" style={{ marginRight: 6, color: "#2563EB" }} />
                  {att.filename || "Download"}
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 5px", background: "#E2E8F0", borderRadius: 3, color: "#64748B", marginLeft: 4 }}>{ext}</span>
                </a>
              );
            })}
          </div>
        </div>
      );
    }

    case "social":
    case "pricing-engine":
      return null; // handled at section level

    default: // text
      return (
        <div style={rowStyle}>
          {labelEl}
          <span style={{ fontSize: 15, fontWeight: 600, color: "#0F172A" }}>{String(value)}</span>
        </div>
      );
  }
}

/* ════════════════════════════════════════
   Social Row — colored platform buttons
   ════════════════════════════════════════ */
function SocialRow({ fields }) {
  const valid = fields.filter((f) => f.value && isValidURL(String(f.value)));
  if (valid.length === 0) return <span style={{ fontSize: 13, color: "#94A3B8" }}>No links</span>;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "4px 0" }}>
      {valid.map((field, i) => {
        const cfg = SOCIAL_CONFIG[field.displayName] || { icon: "fa-solid fa-share-nodes", color: "#64748B", label: field.displayName };
        return (
          <a
            key={i}
            href={String(field.value)}
            target="_blank"
            rel="noopener noreferrer"
            title={cfg.label}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, background: cfg.color, color: "#FFFFFF", textDecoration: "none", fontSize: 13, fontWeight: 500, transition: "opacity 0.15s, transform 0.1s" }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            <i className={cfg.icon} style={{ fontSize: 15 }} />
            <span style={{ fontSize: 12 }}>{cfg.label}</span>
          </a>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════
   Pricing Grid — rows with icon/label/launch
   ════════════════════════════════════════ */
function PricingGrid({ fields }) {
  const available = fields.filter((f) => {
    const v = String(f.value || "").toLowerCase();
    return v.indexOf("yes") !== -1 || v.indexOf("\u2705") !== -1;
  });
  if (available.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {available.map((field, i) => {
        const pe = PRICING_ENGINE_CONFIG[field.displayName] || { icon: "fa-solid fa-chart-bar", label: field.displayName, url: "" };
        return (
          <a
            key={i}
            href={pe.url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", textDecoration: "none", borderBottom: i < available.length - 1 ? "1px solid #E2E8F0" : "none", transition: "background 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#F0F7FF"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 9, background: "#EFF6FF", border: "1px solid #BFDBFE", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563EB", fontSize: 15, flexShrink: 0 }}>
              <i className={pe.icon} />
            </div>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#0F172A" }}>{pe.label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#94A3B8", opacity: 0.6, display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
              Open <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: 11 }} />
            </span>
          </a>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════
   Link Rows — displayName as button text with FA icon
   ════════════════════════════════════════ */
function LinkRows({ fields }) {
  const valid = fields.filter((f) => f.value && isValidURL(String(f.value)));
  if (valid.length === 0) return null;
  return (
    <>
      {valid.map((field, i) => {
        const icon = LINK_ICON_CONFIG[field.displayName] || "fa-solid fa-link";
        return (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "11px 16px", alignItems: "center", gap: 10, borderBottom: i < valid.length - 1 ? "1px solid rgba(0,0,0,0.15)" : "none" }}>
            <span style={{ fontSize: 13, color: "#64748B", fontWeight: 500 }}>{field.displayName}</span>
            <a href={String(field.value)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 6, background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#2563EB", fontSize: 12, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
              <i className={icon} style={{ fontSize: 12, opacity: 0.8 }} />
              {field.displayName}
            </a>
          </div>
        );
      })}
    </>
  );
}

/* ════════════════════════════════════════
   AE Detail Modal
   ════════════════════════════════════════ */
function AEModal({ ae, onClose, copyToClipboard }) {
  const initials = ae.name ? ae.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) : "?";

  function buildSummary() {
    let parts = [ae.name];
    if (ae.title) parts.push(ae.title);
    if (ae.email) parts.push(ae.email);
    if (ae.phone) parts.push(ae.phone);
    return parts.join("\n");
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "ld-fade-in 0.15s ease" }}
    >
      <style>{`@keyframes ld-fade-in { from { opacity: 0; } to { opacity: 1; } } @keyframes ld-slide-up { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 14, width: "100%", maxWidth: 380, position: "relative", overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.2)", animation: "ld-slide-up 0.18s ease" }}
      >
        {/* Close */}
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.8)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, zIndex: 1 }}>
          <i className="fa-solid fa-xmark" />
        </button>

        {/* Header */}
        <div style={{ background: "linear-gradient(135deg, #0C4A6E 0%, #1D4ED8 100%)", padding: "28px 24px 22px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          {ae.photo ? (
            <img src={ae.photo} alt={ae.name} style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "3px solid rgba(255,255,255,0.35)" }} />
          ) : (
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(255,255,255,0.18)", border: "3px solid rgba(255,255,255,0.35)", color: "#fff", fontSize: 26, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{initials}</div>
          )}
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: "0 0 4px 0" }}>{ae.name}</p>
            {ae.title && <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", margin: 0 }}>{ae.title}</p>}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          {ae.email && (
            <ContactRow icon="fa-solid fa-envelope" label={ae.email} href={`mailto:${ae.email}`} onCopy={() => copyToClipboard(ae.email, "Email")} />
          )}
          {ae.phone && (
            <ContactRow icon="fa-solid fa-phone" label={ae.phone} href={`tel:${ae.phone}`} onCopy={() => copyToClipboard(ae.phone, "Phone")} />
          )}
        </div>

        {/* Footer — copy all */}
        <div style={{ padding: "0 20px 18px" }}>
          <button
            onClick={() => copyToClipboard(buildSummary(), "Contact info")}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "10px 16px", background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}
          >
            <i className="fa-solid fa-copy" /> Copy All Info
          </button>
        </div>
      </div>
    </div>
  );
}

function ContactRow({ icon, label, href, onCopy }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8 }}>
      <div style={{ width: 34, height: 34, minWidth: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, background: "#EFF6FF", color: "#2563EB", flexShrink: 0 }}>
        <i className={icon} />
      </div>
      <a href={href} style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "#0F172A", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</a>
      <button onClick={onCopy} style={{ width: 28, height: 28, minWidth: 28, borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#94A3B8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 }}>
        <i className="fa-solid fa-copy" />
      </button>
    </div>
  );
}

/* ════════════════════════════════════════
   Private Notes (localStorage)
   ════════════════════════════════════════ */
function PrivateNotes({ starRating, onStarClick, notes, onNotesChange, saveStatus }) {
  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 10, padding: 16 }}>
      <SectionHeader title="Private Notes" color="#2563EB" />
      <div style={{ padding: "12px 16px" }}>
        {/* Star rating */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => onStarClick(n)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 2, fontSize: 18, color: n <= starRating ? "#F59E0B" : "#94A3B8", transition: "color 0.1s" }}
            >
              <i className={n <= starRating ? "fa-solid fa-star" : "fa-regular fa-star"} />
            </button>
          ))}
          <span style={{ fontSize: 12, color: "#64748B", marginLeft: 6 }}>Your rating</span>
        </div>

        {/* Textarea */}
        <textarea
          value={notes}
          onChange={onNotesChange}
          placeholder="Add private notes about this lender..."
          style={{ width: "100%", minHeight: 120, marginTop: 12, padding: 10, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, fontFamily: "inherit", fontSize: 13, color: "#0F172A", resize: "vertical", boxSizing: "border-box" }}
        />
        {saveStatus && <div style={{ fontSize: 12, color: "#64748B", marginTop: 6 }}>{saveStatus}</div>}
      </div>
    </div>
  );
}

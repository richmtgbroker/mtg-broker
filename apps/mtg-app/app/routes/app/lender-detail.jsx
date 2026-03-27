import { useState, useEffect } from "react";
import { Link, useParams } from "react-router";

const LENDERS_API = "https://mtg-broker-lenders.rich-e00.workers.dev/api/lenders";
const CACHE_KEY_PREFIX = "mtg_lender_detail_";
const CACHE_TTL = 30 * 60 * 1000;

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

  useEffect(() => {
    if (!slug) return;

    async function load() {
      // Check localStorage cache
      const cacheKey = CACHE_KEY_PREFIX + slug;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.ts && Date.now() - parsed.ts < CACHE_TTL) {
            setLender(parsed.data);
            setLoading(false);
            // Background refresh
            fetchLender(slug, cacheKey, true);
            return;
          }
        }
      } catch {}

      await fetchLender(slug, cacheKey, false);
    }

    async function fetchLender(slug, cacheKey, background) {
      try {
        const res = await fetch(`${LENDERS_API}/${slug}`);
        if (!res.ok) {
          if (!background) setError("Lender not found");
          if (!background) setLoading(false);
          return;
        }
        const data = await res.json();
        if (data.success && data.lender) {
          setLender(data.lender);
          try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: data.lender })); } catch {}
        } else if (!background) {
          setError("Lender not found");
        }
      } catch (e) {
        // CORS or network error — show helpful message
        if (!background) setError("Unable to load lender data. This page requires the production domain (mtg.broker) to fetch lender details.");
      }
      if (!background) setLoading(false);
    }

    load();
  }, [slug]);

  // Build favicon URL
  let faviconUrl = null;
  if (!logoError && lender?.logo) {
    faviconUrl = lender.logo;
  }

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

  // Channel badges
  const badges = [];
  if (lender.nexaWholesale) badges.push({ label: "Wholesale", cls: "bg-[#DBEAFE] text-[#1D4ED8]" });
  if (lender.nexaNondel) badges.push({ label: "Non-Del", cls: "bg-[#DCFCE7] text-[#15803D]" });
  if (lender.nexa100) badges.push({ label: "NEXA 100", cls: "bg-white/10 text-[#CBD5E1]" });
  if (lender.nexaOnly) badges.push({ label: "NEXA Only", cls: "bg-[#EDE9FE] text-[#6D28D9]" });

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "products", label: "Loan Products" },
  ];
  if (accountExecs.length > 0 || otherContacts.length > 0) {
    tabs.push({ id: "contacts", label: "Contacts" });
  }

  return (
    <div style={{ background: "#F8FAFC", minHeight: "100vh" }}>
      {/* Breadcrumb */}
      <Breadcrumb lenderName={lender.name} />

      {/* Header — dark navy */}
      <div className="flex items-center gap-4 flex-wrap rounded-[12px] p-[18px_24px]" style={{ background: "#1E3A5F" }}>
        {/* Logo */}
        <div className="w-[80px] h-[80px] rounded-[12px] border-2 border-white/20 overflow-hidden flex items-center justify-center shrink-0 text-white font-extrabold text-[26px]" style={{ background: "#2563EB" }}>
          {faviconUrl ? (
            <img src={faviconUrl} alt={lender.name} className="w-full h-full object-cover" onError={() => setLogoError(true)} />
          ) : (
            lender.name.charAt(0).toUpperCase()
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h1 className="text-[20px] font-bold text-white leading-[1.2] m-0 mb-2 truncate">{lender.name}</h1>
          {badges.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {badges.map((b) => (
                <span key={b.label} className={`text-[10px] font-bold py-[3px] px-2 rounded-[4px] uppercase tracking-wide ${b.cls}`}>{b.label}</span>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 shrink-0">
          {lender.website_url && (
            <a href={lender.website_url} target="_blank" rel="noopener noreferrer" className="py-[7px] px-3.5 rounded-[7px] border border-white/20 bg-white/[0.08] text-[#CBD5E1] text-xs font-semibold no-underline hover:bg-white/[0.14] transition-colors">
              Website
            </a>
          )}
          {lender.tpo_portal_url && (
            <a href={lender.tpo_portal_url} target="_blank" rel="noopener noreferrer" className="py-[7px] px-3.5 rounded-[7px] border border-white/20 bg-white/[0.08] text-[#CBD5E1] text-xs font-semibold no-underline hover:bg-white/[0.14] transition-colors">
              TPO Portal
            </a>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1.5 bg-white border border-[#E2E8F0] rounded-[12px] p-[10px_16px] flex-wrap mt-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-1.5 px-4 border rounded-full text-[13px] font-semibold cursor-pointer font-inherit whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? "bg-[#2563EB] text-white border-[#2563EB]"
                : "bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0] hover:bg-white hover:text-[#0F172A] hover:border-[#CBD5E1]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="mt-5">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div>
            {/* Description */}
            {lender.description && (
              <p className="text-[15px] text-[#64748B] leading-[1.8] mb-4">{lender.description}</p>
            )}

            {/* Loan Types */}
            {loanTypes.length > 0 && (
              <div className="bg-white border border-[#E2E8F0] rounded-[10px] overflow-hidden mb-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                <div className="flex items-center gap-[9px] py-[11px] px-4" style={{ background: "#EFF6FF", borderBottom: "1px solid #BFDBFE" }}>
                  <div className="w-[3px] h-4 rounded-[2px] bg-[#2563EB] shrink-0" />
                  <span className="text-[13px] font-extrabold uppercase tracking-[0.01em] text-[#1D4ED8]">Loan Types</span>
                </div>
                <div className="p-3.5 flex flex-wrap gap-1.5">
                  {loanTypes.map((lt) => (
                    <span key={lt} className="text-[13px] font-medium py-[5px] px-[13px] rounded-[20px] bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">{lt}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Section cards grid */}
            {sections.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {sections.map((section, i) => (
                  <SectionCard key={i} section={section} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Loan Products Tab */}
        {activeTab === "products" && (
          <div>
            {loanProducts.length === 0 ? (
              <div className="text-center py-10 bg-white border border-[#E2E8F0] rounded-[10px] text-[#64748B] text-[13px]">
                No loan products found for this lender.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {loanProducts.map((prod, i) => (
                  <a
                    key={i}
                    href={prod.slug ? `/app/products/${prod.slug}` : "#"}
                    className="bg-white border border-[#E2E8F0] rounded-[8px] py-3.5 px-4 flex justify-between items-center gap-3 no-underline shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all hover:border-[#93C5FD] hover:bg-[#F0F7FF] hover:shadow-[0_2px_8px_rgba(37,99,235,0.1)]"
                  >
                    <span className="text-[15px] text-[#0F172A] font-medium">{prod.name || prod}</span>
                    <span className="text-[14px] text-[#2563EB] font-semibold shrink-0">&rsaquo;</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Contacts Tab */}
        {activeTab === "contacts" && (
          <div>
            {/* Account Executives */}
            {accountExecs.length > 0 && (
              <div className="mb-5">
                <div className="text-[11px] font-bold tracking-[0.08em] text-[#94A3B8] uppercase mb-2.5">Account Executives</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {accountExecs.map((ae, i) => (
                    <div key={i} className="bg-white border border-[#E2E8F0] rounded-[10px] py-[18px] px-3 flex flex-col items-center gap-2.5 text-center shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                      <div className="w-[52px] h-[52px] rounded-full border-2 border-[#E2E8F0] overflow-hidden bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] font-bold text-lg shrink-0">
                        {ae.photo ? (
                          <img src={ae.photo} alt={ae.name} className="w-full h-full object-cover rounded-full" />
                        ) : (
                          ae.name?.charAt(0)?.toUpperCase() || "?"
                        )}
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold text-[#0F172A] m-0 leading-[1.3]">{ae.name}</p>
                        {ae.title && <p className="text-[12px] text-[#64748B] m-0">{ae.title}</p>}
                      </div>
                      {ae.email && (
                        <a href={`mailto:${ae.email}`} className="text-[12px] text-[#2563EB] no-underline hover:underline truncate max-w-full">{ae.email}</a>
                      )}
                      {ae.phone && (
                        <a href={`tel:${ae.phone}`} className="text-[12px] text-[#2563EB] no-underline hover:underline">{ae.phone}</a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Other Contacts */}
            {otherContacts.length > 0 && (
              <div>
                <div className="text-[11px] font-bold tracking-[0.08em] text-[#94A3B8] uppercase mb-2.5">Other Contacts</div>
                <div className="bg-white border border-[#E2E8F0] rounded-[10px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                  {otherContacts.map((oc, i) => (
                    <div key={i} className={`grid grid-cols-3 py-3 px-4 items-center gap-2 ${i % 2 === 0 ? "bg-white" : "bg-[#F8FAFC]"} ${i < otherContacts.length - 1 ? "border-b border-[#E2E8F0]" : ""}`}>
                      <div>
                        <p className="text-[14px] font-semibold text-[#0F172A] m-0">{oc.name}</p>
                        {oc.title && <p className="text-[12px] text-[#64748B] m-0">{oc.title}</p>}
                      </div>
                      <div />
                      <div className="text-right">
                        {oc.email && <a href={`mailto:${oc.email}`} className="block text-[13px] text-[#2563EB] no-underline hover:underline">{oc.email}</a>}
                        {oc.phone && <a href={`tel:${oc.phone}`} className="block text-[13px] text-[#2563EB] no-underline hover:underline">{oc.phone}</a>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Breadcrumb({ lenderName }) {
  return (
    <nav className="flex items-center gap-2 text-[14px] text-[#94A3B8] py-3">
      <Link to="/app/lenders" className="text-[#2563EB] no-underline font-semibold hover:underline">Lenders</Link>
      <span className="text-[#E2E8F0]">/</span>
      <span className="text-[#64748B] font-medium">{lenderName || "..."}</span>
    </nav>
  );
}

function SectionCard({ section }) {
  // Section color map based on section title
  const colorMap = {
    "Links": { bg: "#EFF6FF", border: "#BFDBFE", bar: "#2563EB", text: "#1D4ED8" },
    "Pricing Engines": { bg: "#F0FDF4", border: "#BBF7D0", bar: "#15803D", text: "#15803D" },
    "Fees & Compensation": { bg: "#FFF7ED", border: "#FED7AA", bar: "#C2410C", text: "#C2410C" },
    "Requirements": { bg: "#FDF2F8", border: "#FBCFE8", bar: "#BE185D", text: "#BE185D" },
    "Notes": { bg: "#F5F3FF", border: "#DDD6FE", bar: "#7C3AED", text: "#7C3AED" },
  };

  const defaultColor = { bg: "#F8FAFC", border: "#E2E8F0", bar: "#64748B", text: "#64748B" };
  // Try to find a matching color by checking if the section title contains any key
  let colors = defaultColor;
  for (const [key, val] of Object.entries(colorMap)) {
    if (section.title?.toLowerCase().includes(key.toLowerCase())) {
      colors = val;
      break;
    }
  }

  const fields = section.fields || [];

  return (
    <div className="bg-white rounded-[10px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)]" style={{ border: `1px solid ${colors.border}` }}>
      {/* Header */}
      <div className="flex items-center gap-[9px] py-[11px] px-4" style={{ background: colors.bg, borderBottom: `1px solid ${colors.border}` }}>
        <div className="w-[3px] h-4 rounded-[2px] shrink-0" style={{ background: colors.bar }} />
        <span className="text-[13px] font-extrabold uppercase tracking-[0.01em]" style={{ color: colors.text }}>{section.title}</span>
      </div>

      {/* Fields */}
      {fields.map((field, i) => (
        <div key={i} className="grid grid-cols-2 py-[11px] px-4 items-center gap-2.5" style={{ borderBottom: i < fields.length - 1 ? "1px solid rgba(0,0,0,0.15)" : "none" }}>
          <span className="text-[13px] text-[#64748B] font-medium">{field.label}</span>
          <FieldValue field={field} />
        </div>
      ))}

      {fields.length === 0 && (
        <div className="py-4 px-4 text-[13px] text-[#94A3B8]">No data available</div>
      )}
    </div>
  );
}

function FieldValue({ field }) {
  const value = field.value;
  const renderMode = field.renderMode || "text";

  if (!value && value !== 0 && value !== false) {
    return <span className="text-[15px] font-semibold text-[#94A3B8]">—</span>;
  }

  // Boolean badge
  if (renderMode === "boolean" || typeof value === "boolean" || value === "Yes" || value === "No" || value === "TRUE" || value === "FALSE") {
    const isYes = value === true || value === "Yes" || value === "TRUE" || value === "true";
    return (
      <span className={`inline-flex items-center gap-1 text-[13px] font-semibold py-1 px-[11px] rounded-full whitespace-nowrap ${isYes ? "bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]" : "bg-[#F8FAFC] text-[#94A3B8] border border-[#E2E8F0]"}`}>
        {isYes ? "Yes" : "No"}
      </span>
    );
  }

  // URL link
  if (renderMode === "link" || (typeof value === "string" && value.startsWith("http"))) {
    return (
      <a href={value} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-[7px] py-[5px] px-3 rounded-[6px] bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] text-[12px] font-semibold no-underline whitespace-nowrap hover:bg-[#DBEAFE] hover:border-[#93C5FD] transition-colors">
        Open &rsaquo;
      </a>
    );
  }

  // Notes / long text
  if (renderMode === "notes" || (typeof value === "string" && value.length > 100)) {
    return (
      <div className="col-span-2 mt-1">
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] p-3 text-[14px] leading-[1.7] text-[#64748B]">{value}</div>
      </div>
    );
  }

  // Default text
  return <span className="text-[15px] font-semibold text-[#0F172A]">{String(value)}</span>;
}

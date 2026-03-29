import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router";
import { isNexaUser, checkNexaAccess } from "../../lib/auth";

const LENDERS_API_PRIMARY = "https://mtg-broker-lenders.rich-e00.workers.dev/api/lenders";
const LENDERS_API_FALLBACK = "https://mtg-broker-pipeline.rich-e00.workers.dev/api/lenders";
const CACHE_KEY = "mtg_lenders_v3";
const CACHE_TTL = 30 * 60 * 1000;
const FAVORITES_KEY = "mtg_lender_favorites";

export function meta() {
  return [{ title: "Lender Directory — MtgBroker" }];
}

export default function LendersPage() {
  const [lenders, setLenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [channelFilter, setChannelFilter] = useState(null);
  const [showTbdOnly, setShowTbdOnly] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]"); } catch { return []; }
  });
  const searchRef = useRef(null);
  const [nexaAuthorized, setNexaAuthorized] = useState(() => isNexaUser());

  // Async NEXA check (Outseta custom field fallback)
  useEffect(() => {
    if (!nexaAuthorized) {
      checkNexaAccess().then((result) => { if (result) setNexaAuthorized(true); });
    }
  }, []);

  useEffect(() => {
    async function load() {
      // Try cache
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.ts && Date.now() - parsed.ts < CACHE_TTL) {
            setLenders(parsed.data);
            setLoading(false);
            return;
          }
        }
      } catch {}

      try {
        let lenderList = null;
        try {
          const res = await fetch(LENDERS_API_PRIMARY + "?_v=3");
          if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.lenders)) lenderList = data.lenders;
          }
        } catch {}

        if (!lenderList) {
          const res = await fetch(LENDERS_API_FALLBACK);
          if (!res.ok) throw new Error("API error");
          const data = await res.json();
          lenderList = Array.isArray(data) ? data : [];
        }

        const sorted = lenderList.sort((a, b) => a.name.localeCompare(b.name));
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: sorted })); } catch {}
        setLenders(sorted);
      } catch {
        setLenders([]);
      }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)); } catch {}
  }, [favorites]);

  function toggleFavorite(name) {
    setFavorites((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]);
  }

  // Build channel tags for a lender
  function getChannels(lender) {
    const channels = [];
    // Primary API fields
    if (lender.nexaWholesale || lender.tpoPortal) channels.push("Broker");
    if (lender.nexaNondel) channels.push("NonDel");
    if (lender.nexa100) channels.push("NEXA");
    // Fallback: channel_types array from pipeline API
    if (channels.length === 0 && (lender.channel_types || lender.channels)) {
      const ch = lender.channel_types || lender.channels || [];
      if (Array.isArray(ch)) {
        ch.forEach(c => {
          if (c.toLowerCase().includes("broker") && !channels.includes("Broker")) channels.push("Broker");
          else if (c.toLowerCase().includes("nondel") && !channels.includes("NonDel")) channels.push("NonDel");
          else if (c.toLowerCase().includes("nexa") && !channels.includes("NEXA")) channels.push("NEXA");
        });
      }
    }
    return channels;
  }

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return lenders.filter((l) => {
      if (term && !l.name.toLowerCase().includes(term)) return false;
      if (channelFilter) {
        const channels = getChannels(l);
        if (!channels.includes(channelFilter)) return false;
      }
      if (showTbdOnly && !l.tbdUnderwriting) return false;
      if (showFavoritesOnly && !favorites.includes(l.name)) return false;
      return true;
    });
  }, [lenders, searchTerm, channelFilter, showTbdOnly, showFavoritesOnly, favorites]);

  const isFiltered = searchTerm.length > 0 || channelFilter !== null || showTbdOnly || showFavoritesOnly;

  function clearFilters() {
    setSearchTerm("");
    setChannelFilter(null);
    setShowTbdOnly(false);
    setShowFavoritesOnly(false);
    searchRef.current?.focus();
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-text mb-6">Lender Directory</h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
          {Array.from({ length: 21 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-2xl bg-surface-active animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-text">Lender Directory</h1>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isFiltered ? "bg-primary-50 text-primary-600" : "bg-surface-active text-text-muted"}`}>
          {isFiltered ? `${filtered.length} of ${lenders.length}` : `${lenders.length} lenders`}
        </span>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[280px]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-faint pointer-events-none">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            placeholder="Search lenders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setSearchTerm("")}
            className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-border bg-white text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100 transition-colors"
          />
          {searchTerm && (
            <button onClick={() => { setSearchTerm(""); searchRef.current?.focus(); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-faint hover:text-text cursor-pointer text-sm bg-transparent border-none">&#10005;</button>
          )}
        </div>

        <div className="w-px h-8 bg-border hidden md:block" />

        {/* Channel Filters — NEXA-gated */}
        {nexaAuthorized && ["Broker", "NonDel", "NEXA"].map((ch) => (
          <button
            key={ch}
            onClick={() => setChannelFilter(channelFilter === ch ? null : ch)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium border cursor-pointer transition-colors ${
              channelFilter === ch
                ? "bg-primary-600 text-white border-primary-600"
                : "bg-white text-text-secondary border-border hover:border-text-muted"
            }`}
          >
            {ch === "NEXA" ? "NEXA\u{1F4AF}" : ch}
          </button>
        ))}

        {nexaAuthorized && <div className="w-px h-10 bg-border hidden md:block" />}

        {/* TBD Underwriting Filter */}
        <button
          onClick={() => setShowTbdOnly(!showTbdOnly)}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border cursor-pointer transition-colors ${
            showTbdOnly
              ? "bg-orange-50 text-orange-700 border-orange-300"
              : "bg-white text-text-secondary border-border hover:border-text-muted"
          }`}
        >
          <span className={`inline-block w-2.5 h-2.5 rounded-sm font-bold text-[9px] leading-[10px] text-center text-white ${showTbdOnly ? "bg-orange-500" : "bg-orange-400"}`}>T</span>
          TBD UW
        </button>

        <div className="w-px h-10 bg-border hidden md:block" />

        {/* Favorites Toggle */}
        <button
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border cursor-pointer transition-colors ${
            showFavoritesOnly
              ? "bg-red-50 text-red-600 border-red-200"
              : "bg-white text-text-secondary border-border hover:border-text-muted"
          }`}
        >
          <svg viewBox="0 0 24 24" fill={showFavoritesOnly ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          Favorites
          {favorites.length > 0 && (
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${showFavoritesOnly ? "bg-red-100 text-red-600" : "bg-surface-active text-text-muted"}`}>
              {favorites.length}
            </span>
          )}
        </button>

        {/* Clear Filters */}
        {isFiltered && (
          <button onClick={clearFilters} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-primary-600 bg-primary-50 border border-primary-200 cursor-pointer hover:bg-primary-100 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
            Clear Filters
          </button>
        )}
      </div>

      {/* Cards Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">&#128269;</div>
          <div className="text-lg font-semibold text-text mb-1">No lenders found</div>
          <div className="text-sm text-text-muted mb-4">Try a different search or filter</div>
          <button onClick={clearFilters} className="text-sm text-primary-600 font-medium cursor-pointer bg-transparent border-none hover:underline">Clear filters</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
          {filtered.map((lender) => (
            <LenderCard
              key={lender.name}
              lender={lender}
              channels={nexaAuthorized ? getChannels(lender) : []}
              isFavorite={favorites.includes(lender.name)}
              onToggleFavorite={() => toggleFavorite(lender.name)}
              searchTerm={searchTerm}
              channelFilter={channelFilter}
              onChannelFilter={setChannelFilter}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Tag pill styles — default and active (darker shade when selected)
const TAG_STYLES = {
  Broker: { default: "bg-[#FEF3C7] text-[#92400E]", active: "bg-[#F59E0B] text-white ring-2 ring-[#B45309] ring-offset-1" },
  NonDel: { default: "bg-[#DCFCE7] text-[#15803D]", active: "bg-[#16A34A] text-white ring-2 ring-[#15803D] ring-offset-1" },
  NEXA: { default: "bg-[#1a1a1a] text-white", active: "bg-[#000000] text-white ring-2 ring-[#555] ring-offset-1" },
};

function LenderCard({ lender, channels, isFavorite, onToggleFavorite, searchTerm, channelFilter, onChannelFilter }) {
  const [logoError, setLogoError] = useState(false);

  // Logo: API logo → Google favicon → null
  let logoUrl = null;
  if (!logoError) {
    if (lender.logo) {
      logoUrl = lender.logo;
    } else {
      const website = lender.website_url || lender.website;
      if (website) {
        try { logoUrl = `https://www.google.com/s2/favicons?domain=${new URL(website).hostname}&sz=128`; } catch {}
      }
    }
  }

  const slug = lender.slug || lender.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // Display name: show abbreviation in parens if present
  const displayName = lender.name;

  return (
    <div className="relative bg-white border border-[#cbd5e1] rounded-2xl overflow-hidden shadow-[0_3px_12px_rgba(0,0,0,0.1)] hover:shadow-[0_8px_24px_rgba(37,99,235,0.15)] hover:border-[#93c5fd] transition-all hover:-translate-y-0.5 flex flex-col">
      {/* Logo Area */}
      <Link
        to={`/app/lenders/${slug}`}
        className="relative bg-[#f8fafc] flex items-center justify-center p-5 no-underline border-b border-[#cbd5e1]"
        style={{ minHeight: "140px" }}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={lender.name}
            className="max-w-[90%] max-h-[105px] object-contain"
            onError={() => setLogoError(true)}
          />
        ) : (
          <div className="text-3xl font-bold text-[#94a3b8]">
            {lender.name.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Favorite heart - top right of logo area */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(); }}
          className="absolute top-2 right-2 bg-transparent border-none cursor-pointer p-0 transition-colors"
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <svg viewBox="0 0 24 24" fill={isFavorite ? "#ef4444" : "none"} stroke={isFavorite ? "#ef4444" : "#cbd5e1"} strokeWidth="2" className="w-4 h-4">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </Link>

      {/* Lender Name — flex-1 so it absorbs variable height */}
      <Link
        to={`/app/lenders/${slug}`}
        className="flex-1 flex items-center justify-center text-center px-3 pt-3 pb-1.5 no-underline"
      >
        <h3 className="text-[13px] font-bold text-[#0f172a] leading-snug m-0">
          <span dangerouslySetInnerHTML={{ __html: highlightMatch(displayName, searchTerm) }} />
        </h3>
      </Link>

      {/* Bottom section — fixed position relative to card bottom */}
      <div>
        {/* Channel Tags - small rounded pills, distinct from squared action buttons */}
        {channels.length > 0 && (
          <div className="flex items-center justify-center gap-1.5 px-3 pb-2">
            {channels.map((ch) => (
              <button
                key={ch}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChannelFilter(channelFilter === ch ? null : ch);
                }}
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full cursor-pointer border-none transition-colors ${channelFilter === ch ? (TAG_STYLES[ch]?.active || "bg-gray-600 text-white") : (TAG_STYLES[ch]?.default || "bg-gray-100 text-gray-600")} ${channelFilter !== ch ? "hover:opacity-80" : ""}`}
              >
                {ch === "NEXA" ? "NEXA\u{1F4AF}" : ch}
              </button>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-2 px-3 py-2.5">
          {lender.website && (
            <a
              href={lender.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex-1 text-center py-1.5 rounded-lg border border-[#93c5fd] bg-[#f0f7ff] text-[#1a56db] text-[11px] font-semibold no-underline hover:bg-[#dbeafe] transition-colors"
            >
              Website
            </a>
          )}
          {lender.tpoPortal && (
            <a
              href={lender.tpoPortal}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex-1 text-center py-1.5 rounded-lg border border-[#93c5fd] bg-[#f0f7ff] text-[#1a56db] text-[11px] font-semibold no-underline hover:bg-[#dbeafe] transition-colors"
            >
              TPO Portal
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function highlightMatch(text, term) {
  if (!term) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const escapedTerm = escapeHtml(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return escaped.replace(new RegExp(`(${escapedTerm})`, "gi"), '<mark style="background:#fef08a;color:#0f172a;padding:0 1px;border-radius:2px;">$1</mark>');
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

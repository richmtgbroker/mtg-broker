import { useState, useEffect, useMemo, useRef } from "react";

const LENDERS_API = "https://mtg-broker-pipeline.rich-e00.workers.dev/api/lenders";
const CACHE_KEY = "mtg_lenders_v1";
const CACHE_TTL = 30 * 60 * 1000;
const FAVORITES_KEY = "mtg_lender_favorites";

// Color palette for avatar circles
const AVATAR_COLORS = [
  "#2563eb", "#7c3aed", "#0891b2", "#059669", "#d97706",
  "#dc2626", "#c026d3", "#4f46e5", "#0d9488", "#ea580c",
];

function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function meta() {
  return [{ title: "Lender Directory — MtgBroker" }];
}

export default function LendersPage() {
  const [lenders, setLenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [channelFilter, setChannelFilter] = useState(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]"); } catch { return []; }
  });
  const searchRef = useRef(null);

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
        const res = await fetch(LENDERS_API);
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        const sorted = (Array.isArray(data) ? data : []).sort((a, b) => a.name.localeCompare(b.name));
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: sorted })); } catch {}
        setLenders(sorted);
      } catch {
        setLenders([]);
      }
      setLoading(false);
    }
    load();
  }, []);

  // Save favorites to localStorage
  useEffect(() => {
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)); } catch {}
  }, [favorites]);

  function toggleFavorite(name) {
    setFavorites((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]);
  }

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return lenders.filter((l) => {
      if (term && !l.name.toLowerCase().includes(term)) return false;
      if (channelFilter) {
        const channels = l.channel_types || l.channels || [];
        if (!channels.some((c) => c.toLowerCase().includes(channelFilter.toLowerCase()))) return false;
      }
      if (showFavoritesOnly && !favorites.includes(l.name)) return false;
      return true;
    });
  }, [lenders, searchTerm, channelFilter, showFavoritesOnly, favorites]);

  const isFiltered = searchTerm.length > 0 || channelFilter !== null || showFavoritesOnly;

  function clearFilters() {
    setSearchTerm("");
    setChannelFilter(null);
    setShowFavoritesOnly(false);
    searchRef.current?.focus();
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-text mb-6">Lender Directory</h1>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="h-48 rounded-xl bg-surface-active animate-pulse" />
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

        {/* Channel Filters */}
        {["Broker", "NonDel", "NEXA"].map((ch) => (
          <button
            key={ch}
            onClick={() => setChannelFilter(channelFilter === ch ? null : ch)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${
              channelFilter === ch
                ? "bg-primary-600 text-white border-primary-600"
                : "bg-white text-text-secondary border-border hover:border-text-muted"
            }`}
          >
            {ch}
          </button>
        ))}

        <div className="w-px h-8 bg-border hidden md:block" />

        {/* Favorites Toggle */}
        <button
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${
            showFavoritesOnly
              ? "bg-red-50 text-red-600 border-red-200"
              : "bg-white text-text-secondary border-border hover:border-text-muted"
          }`}
        >
          <svg viewBox="0 0 24 24" fill={showFavoritesOnly ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          Favorites
          {favorites.length > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${showFavoritesOnly ? "bg-red-100 text-red-600" : "bg-surface-active text-text-muted"}`}>
              {favorites.length}
            </span>
          )}
        </button>

        {/* Clear Filters */}
        {isFiltered && (
          <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-600 bg-primary-50 border border-primary-200 cursor-pointer hover:bg-primary-100 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {filtered.map((lender) => (
            <LenderCard
              key={lender.name}
              lender={lender}
              isFavorite={favorites.includes(lender.name)}
              onToggleFavorite={() => toggleFavorite(lender.name)}
              searchTerm={searchTerm}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LenderCard({ lender, isFavorite, onToggleFavorite, searchTerm }) {
  const initial = lender.name.charAt(0).toUpperCase();
  const color = getAvatarColor(lender.name);
  const channels = lender.channel_types || lender.channels || [];
  const [logoError, setLogoError] = useState(false);

  // Build favicon URL from lender website
  const faviconUrl = !logoError && lender.website_url
    ? `https://www.google.com/s2/favicons?domain=${new URL(lender.website_url).hostname}&sz=64`
    : null;

  const channelColors = {
    broker: "bg-blue-50 text-blue-700",
    nondel: "bg-purple-50 text-purple-700",
    nexa: "bg-emerald-50 text-emerald-700",
  };

  return (
    <div className="bg-white rounded-xl border border-border p-4 hover:border-primary-200 hover:shadow-sm transition-all relative flex flex-col items-center text-center">
      {/* Favorite button */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(); }}
        className="absolute top-3 right-3 bg-transparent border-none cursor-pointer p-0 text-text-faint hover:text-red-500 transition-colors"
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
      >
        <svg viewBox="0 0 24 24" fill={isFavorite ? "#ef4444" : "none"} stroke={isFavorite ? "#ef4444" : "currentColor"} strokeWidth="2" className="w-5 h-5">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>

      {/* Lender logo or fallback avatar circle */}
      {faviconUrl ? (
        <div className="w-[60px] h-[60px] rounded-full flex items-center justify-center bg-white border border-border-light mb-3 shrink-0 overflow-hidden">
          <img
            src={faviconUrl}
            alt={lender.name}
            className="w-8 h-8 object-contain"
            onError={() => setLogoError(true)}
          />
        </div>
      ) : (
        <div
          className="w-[60px] h-[60px] rounded-full flex items-center justify-center text-white text-xl font-bold mb-3 shrink-0"
          style={{ backgroundColor: color }}
        >
          {initial}
        </div>
      )}

      {/* Name */}
      <div className="text-sm font-semibold text-text mb-2 line-clamp-2">
        <span dangerouslySetInnerHTML={{ __html: highlightMatch(lender.name, searchTerm) }} />
      </div>

      {/* Link pill buttons */}
      <div className="flex flex-wrap gap-1.5 justify-center mb-2">
        {lender.website_url && (
          <a href={lender.website_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 no-underline px-2.5 py-1 rounded-full bg-primary-50 hover:bg-primary-100 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
            Website
          </a>
        )}
        {lender.tpo_portal_url && (
          <a href={lender.tpo_portal_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 no-underline px-2.5 py-1 rounded-full bg-primary-50 hover:bg-primary-100 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
            TPO Portal
          </a>
        )}
      </div>

      {/* Channel type badges */}
      {channels.length > 0 && (
        <div className="flex flex-wrap gap-1 justify-center">
          {channels.map((ch) => {
            const key = ch.toLowerCase().replace(/[^a-z]/g, "");
            const colorClass = channelColors[key] || "bg-surface-active text-text-muted";
            return (
              <span key={ch} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colorClass}`}>
                {ch}
              </span>
            );
          })}
        </div>
      )}
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

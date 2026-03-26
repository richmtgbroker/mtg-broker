import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router";

const API_URL = "https://mtg-broker-property-types.rich-e00.workers.dev/api/property-types";
const CACHE_KEY = "mtg_property_types_v1";
const CACHE_TTL = 10 * 60 * 1000;

export function meta() {
  return [{ title: "Property Types — MtgBroker" }];
}

export default function PropertyTypesPage() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const searchRef = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.ts && Date.now() - parsed.ts < CACHE_TTL) {
            setTypes(parsed.data);
            setLoading(false);
            return;
          }
        }
      } catch {}

      try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        const pts = (data.propertyTypes || []).sort((a, b) => a.name.localeCompare(b.name));
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: pts })); } catch {}
        setTypes(pts);
      } catch { setTypes([]); }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return term ? types.filter((t) => t.name.toLowerCase().includes(term)) : types;
  }, [types, searchTerm]);

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-text mb-6">Property Types</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-surface-active animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text">Property Types</h1>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${searchTerm ? "bg-primary-50 text-primary-600" : "bg-surface-active text-text-muted"}`}>
            {searchTerm ? `${filtered.length} of ${types.length}` : `${types.length} types`}
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-[320px]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-faint pointer-events-none">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            placeholder="Search property types..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setSearchTerm("")}
            className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-border bg-white text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100 transition-colors"
          />
          {searchTerm && (
            <button onClick={() => { setSearchTerm(""); searchRef.current?.focus(); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-faint hover:text-text cursor-pointer text-sm bg-transparent border-none">&#10005;</button>
          )}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">&#128269;</div>
          <div className="text-lg font-semibold text-text mb-1">No property types found</div>
          <button onClick={() => setSearchTerm("")} className="text-sm text-primary-600 font-medium cursor-pointer bg-transparent border-none hover:underline">Clear search</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((pt) => (
            <Link
              key={pt.slug}
              to={`/app/property-types/${pt.slug}`}
              className="flex items-center justify-between px-4 py-3.5 rounded-xl border border-border bg-white no-underline text-text hover:border-primary-200 hover:shadow-sm hover:bg-primary-50/30 transition-all group"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium" dangerouslySetInnerHTML={{ __html: highlight(pt.name, searchTerm) }} />
                {pt.lenderCount > 0 && (
                  <div className="text-xs text-text-faint mt-0.5">{pt.lenderCount} lender{pt.lenderCount !== 1 ? "s" : ""}</div>
                )}
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-text-faint group-hover:text-primary-600 transition-colors shrink-0">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function highlight(text, term) {
  if (!term) return esc(text);
  const e = esc(text);
  const t = esc(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return e.replace(new RegExp(`(${t})`, "gi"), '<mark style="background:#fef08a;padding:0 1px;border-radius:2px;">$1</mark>');
}

function esc(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

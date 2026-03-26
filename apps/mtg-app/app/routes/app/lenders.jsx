import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router";

const LENDERS_API = "https://mtg-broker-pipeline.rich-e00.workers.dev/api/lenders";
const CACHE_KEY = "mtg_lenders_v1";
const CACHE_TTL = 30 * 60 * 1000;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function meta() {
  return [{ title: "Lender Directory — MtgBroker" }];
}

export default function LendersPage() {
  const [lenders, setLenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeLetter, setActiveLetter] = useState(null);
  const searchRef = useRef(null);
  const resultsRef = useRef(null);

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

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return lenders.filter((l) => {
      if (term && !l.name.toLowerCase().includes(term)) return false;
      if (activeLetter) {
        const first = l.name.charAt(0).toUpperCase();
        const letter = /[A-Z]/.test(first) ? first : "#";
        if (letter !== activeLetter) return false;
      }
      return true;
    });
  }, [lenders, searchTerm, activeLetter]);

  const lettersWithLenders = useMemo(() => {
    const set = new Set();
    lenders.forEach((l) => {
      const first = l.name.charAt(0).toUpperCase();
      set.add(/[A-Z]/.test(first) ? first : "#");
    });
    return set;
  }, [lenders]);

  // Group by first letter
  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach((l) => {
      const first = l.name.charAt(0).toUpperCase();
      const letter = /[A-Z]/.test(first) ? first : "#";
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(l);
    });
    return groups;
  }, [filtered]);

  const isFiltered = searchTerm.length > 0 || activeLetter !== null;

  function resetAll() {
    setSearchTerm("");
    setActiveLetter(null);
    searchRef.current?.focus();
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-text mb-6">Lender Directory</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-surface-active animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text">Lender Directory</h1>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isFiltered ? "bg-primary-50 text-primary-600" : "bg-surface-active text-text-muted"}`}>
            {isFiltered ? `${filtered.length} of ${lenders.length}` : `${lenders.length} lenders`}
          </span>
        </div>
      </div>

      {/* Search + Alphabet */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
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
            <button onClick={() => { setSearchTerm(""); searchRef.current?.focus(); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-faint hover:text-text cursor-pointer text-sm bg-transparent border-none">
              &#10005;
            </button>
          )}
        </div>

        <div className="w-px h-8 bg-border hidden md:block" />

        <div className="flex flex-wrap gap-0.5 items-center">
          <button
            onClick={() => setActiveLetter(null)}
            className={`px-2 py-1 text-[11px] font-semibold rounded-md cursor-pointer border-none transition-colors ${activeLetter === null ? "bg-primary-600 text-white" : "bg-surface-active text-text-muted hover:bg-surface-section"}`}
          >
            All
          </button>
          {ALPHABET.map((letter) => {
            const has = lettersWithLenders.has(letter);
            return (
              <button
                key={letter}
                onClick={() => has && setActiveLetter(letter)}
                disabled={!has}
                className={`w-7 h-7 text-[11px] font-semibold rounded-md border-none transition-colors ${
                  activeLetter === letter ? "bg-primary-600 text-white cursor-pointer" : has ? "bg-surface-active text-text-secondary hover:bg-surface-section cursor-pointer" : "bg-transparent text-text-faint/40 cursor-default"
                }`}
              >
                {letter}
              </button>
            );
          })}
        </div>

        {isFiltered && (
          <button onClick={resetAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-600 bg-primary-50 border border-primary-200 cursor-pointer hover:bg-primary-100 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
            Reset
          </button>
        )}
      </div>

      {/* Results */}
      <div ref={resultsRef}>
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">&#128269;</div>
            <div className="text-lg font-semibold text-text mb-1">No lenders found</div>
            <div className="text-sm text-text-muted mb-4">Try a different search or letter</div>
            <button onClick={resetAll} className="text-sm text-primary-600 font-medium cursor-pointer bg-transparent border-none hover:underline">
              Reset filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.keys(grouped).sort().map((letter) => (
              <LenderGroup key={letter} letter={letter} lenders={grouped[letter]} searchTerm={searchTerm} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LenderGroup({ letter, lenders, searchTerm }) {
  return (
    <>
      <div className="col-span-full flex items-center gap-3 mt-6 mb-2 first:mt-0">
        <span className="text-lg font-bold text-text">{letter}</span>
        <div className="flex-1 h-px bg-border" />
      </div>
      {lenders.map((lender) => (
        <LenderCard key={lender.name} lender={lender} searchTerm={searchTerm} />
      ))}
    </>
  );
}

function LenderCard({ lender, searchTerm }) {
  const slug = lender.name.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").trim().replace(/\s+/g, "-").replace(/-+/g, "-");
  const hasLinks = lender.website_url || lender.tpo_portal_url || lender.correspondent_portal_url;

  return (
    <div className="bg-white rounded-xl border border-border p-4 hover:border-primary-200 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link to={`/app/lenders/${slug}`} className="text-sm font-semibold text-text no-underline hover:text-primary-600 transition-colors">
          <span dangerouslySetInnerHTML={{ __html: highlightMatch(lender.name, searchTerm) }} />
        </Link>
      </div>
      {hasLinks && (
        <div className="flex flex-wrap gap-2">
          {lender.website_url && (
            <a href={lender.website_url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium text-text-muted no-underline px-2 py-0.5 rounded-md bg-surface-active hover:bg-surface-section hover:text-primary-600 transition-colors">
              Website
            </a>
          )}
          {lender.tpo_portal_url && (
            <a href={lender.tpo_portal_url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium text-text-muted no-underline px-2 py-0.5 rounded-md bg-surface-active hover:bg-surface-section hover:text-primary-600 transition-colors">
              TPO Portal
            </a>
          )}
          {lender.correspondent_portal_url && (
            <a href={lender.correspondent_portal_url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium text-text-muted no-underline px-2 py-0.5 rounded-md bg-surface-active hover:bg-surface-section hover:text-primary-600 transition-colors">
              Correspondent
            </a>
          )}
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

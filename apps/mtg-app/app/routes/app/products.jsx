import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router";

const API_URL = "https://mtg-broker-api.rich-e00.workers.dev/api/products-list";
const CACHE_KEY = "mtg_products_v5";
const CACHE_TTL = 30 * 60 * 1000;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function meta() {
  return [{ title: "Loan Product Types — MtgBroker" }];
}

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategories, setActiveCategories] = useState([]);
  const [activeLetter, setActiveLetter] = useState(null);
  const searchRef = useRef(null);
  const resultsRef = useRef(null);

  // Load products on mount
  useEffect(() => {
    async function load() {
      // Try cache
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.ts && Date.now() - parsed.ts < CACHE_TTL) {
            setProducts(normalizeProducts(parsed.products));
            setLoading(false);
            return;
          }
        }
      } catch {}

      // Fetch from API
      try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        const prods = data.products || [];
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), products: prods })); } catch {}
        setProducts(normalizeProducts(prods));
      } catch (e) {
        setError("Error loading products. Please refresh the page.");
      }
      setLoading(false);
    }
    load();
  }, []);

  // Derive filtered products
  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return products.filter((p) => {
      if (term && !p.sortName.includes(term)) return false;
      if (activeCategories.length > 0 && !activeCategories.every((c) => p.tags.includes(c))) return false;
      if (activeLetter && p.firstLetter !== activeLetter) return false;
      return true;
    });
  }, [products, searchTerm, activeCategories, activeLetter]);

  // Derive category tag counts
  const tagCounts = useMemo(() => {
    const counts = {};
    products.forEach((p) => p.tags.forEach((t) => { counts[t] = (counts[t] || 0) + 1; }));
    return counts;
  }, [products]);

  // Derive which letters have products
  const lettersWithProducts = useMemo(() => {
    const set = new Set();
    products.forEach((p) => set.add(p.firstLetter));
    return set;
  }, [products]);

  // Group filtered products by letter
  const groupedProducts = useMemo(() => {
    const groups = {};
    filtered.forEach((p) => {
      if (!groups[p.firstLetter]) groups[p.firstLetter] = [];
      groups[p.firstLetter].push(p);
    });
    return groups;
  }, [filtered]);

  const isFiltered = searchTerm.length > 0 || activeCategories.length > 0 || activeLetter !== null;

  function resetAll() {
    setSearchTerm("");
    setActiveCategories([]);
    setActiveLetter(null);
    searchRef.current?.focus();
  }

  function toggleCategory(tag) {
    setActiveCategories((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    setActiveLetter(null);
  }

  function handleLetterClick(letter) {
    setActiveLetter(letter);
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handlePrint() {
    if (filtered.length === 0) return;
    window.print();
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-text mb-6">Loan Product Types</h1>
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-surface-active animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text">Loan Product Types</h1>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isFiltered ? "bg-primary-50 text-primary-600" : "bg-surface-active text-text-muted"}`}>
            {isFiltered ? `${filtered.length} of ${products.length}` : `${products.length} products`}
          </span>
        </div>
        <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-white text-sm font-medium text-text-secondary hover:bg-surface-hover cursor-pointer transition-colors print:hidden">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
          </svg>
          Print List
        </button>
      </div>

      {/* Toolbar: Search + Alphabet + Reset */}
      <div className="flex items-center gap-3 mb-4 flex-wrap print:hidden">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-faint pointer-events-none">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            placeholder="Search products..."
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

        {/* Divider */}
        <div className="w-px h-8 bg-border hidden md:block" />

        {/* Alphabet nav */}
        <div className="flex flex-wrap gap-0.5 items-center">
          <button
            onClick={() => setActiveLetter(null)}
            className={`px-2 py-1 text-[11px] font-semibold rounded-md cursor-pointer border-none transition-colors ${activeLetter === null ? "bg-primary-600 text-white" : "bg-surface-active text-text-muted hover:bg-surface-section"}`}
          >
            All
          </button>
          {ALPHABET.map((letter) => {
            const has = lettersWithProducts.has(letter);
            return (
              <button
                key={letter}
                onClick={() => has && handleLetterClick(letter)}
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

        {/* Reset */}
        {isFiltered && (
          <button onClick={resetAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-600 bg-primary-50 border border-primary-200 cursor-pointer hover:bg-primary-100 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
            Reset
          </button>
        )}
      </div>

      {/* Category pills */}
      {Object.keys(tagCounts).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6 print:hidden">
          <button
            onClick={() => setActiveCategories([])}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${activeCategories.length === 0 ? "bg-primary-600 text-white border-primary-600" : "bg-white text-text-secondary border-border hover:border-text-muted"}`}
          >
            All <span className="opacity-60 ml-1">{products.length}</span>
          </button>
          {Object.keys(tagCounts).sort().map((tag) => (
            <button
              key={tag}
              onClick={() => toggleCategory(tag)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${activeCategories.includes(tag) ? "bg-primary-600 text-white border-primary-600" : "bg-white text-text-secondary border-border hover:border-text-muted"}`}
            >
              {tag} <span className="opacity-60 ml-1">{tagCounts[tag]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      <div ref={resultsRef}>
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">&#128269;</div>
            <div className="text-lg font-semibold text-text mb-1">No products found</div>
            <div className="text-sm text-text-muted mb-4">Try a different search or adjust your filters</div>
            <button onClick={resetAll} className="text-sm text-primary-600 font-medium cursor-pointer bg-transparent border-none hover:underline">
              Reset all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.keys(groupedProducts).sort().map((letter) => (
              <LetterGroup key={letter} letter={letter} products={groupedProducts[letter]} searchTerm={searchTerm} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// LETTER GROUP + PRODUCT CARD
// ============================================================
function LetterGroup({ letter, products, searchTerm }) {
  return (
    <>
      <div className="col-span-full flex items-center gap-3 mt-6 mb-2 first:mt-0">
        <span className="text-lg font-bold text-text">{letter}</span>
        <div className="flex-1 h-px bg-border" />
      </div>
      {products.map((product) => (
        <Link
          key={product.href}
          to={product.href}
          className="flex items-center justify-between px-4 py-3.5 rounded-xl border border-border bg-white no-underline text-text hover:border-primary-200 hover:shadow-sm hover:bg-primary-50/30 transition-all group"
        >
          <span className="text-sm font-medium" dangerouslySetInnerHTML={{ __html: highlightMatch(product.name, searchTerm) }} />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-text-faint group-hover:text-primary-600 transition-colors shrink-0">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      ))}
    </>
  );
}

// ============================================================
// UTILITIES
// ============================================================
function normalizeProducts(raw) {
  return raw.map((p) => ({
    name: p.name,
    href: p.slug ? `/app/products/${p.slug}` : "#",
    tags: p.categoryTags || [],
    sortName: (p.sortName || p.name).toLowerCase(),
    firstLetter: p.firstLetter || getFirstLetter(p.sortName || p.name),
  })).sort((a, b) => a.sortName.localeCompare(b.sortName));
}

function getFirstLetter(name) {
  const first = (name || "").charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}

function highlightMatch(text, term) {
  if (!term) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const escapedTerm = escapeHtml(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return escaped.replace(
    new RegExp(`(${escapedTerm})`, "gi"),
    '<mark style="background:#fef08a;color:#0f172a;padding:0 1px;border-radius:2px;">$1</mark>'
  );
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

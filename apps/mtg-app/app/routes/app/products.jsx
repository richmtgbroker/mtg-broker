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
        <h1 className="text-[24px] font-bold text-[#334155] mb-4 tracking-[-0.01em]">Loan Product Types</h1>
        <div className="grid grid-cols-2 gap-1.5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-12 rounded-[10px] bg-surface-active animate-pulse" />
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
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2.5">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-[24px] font-bold text-[#334155] tracking-[-0.01em] m-0">Loan Product Types</h1>
          <span className={`text-[14px] font-semibold px-3 py-1 rounded-[20px] inline-block transition-all ${isFiltered ? "bg-[#dbeafe] text-[#2563eb]" : "bg-[#f1f5f9] text-[#64748b]"}`}>
            {isFiltered ? `${filtered.length} of ${products.length}` : `${products.length} products`}
          </span>
        </div>
        <button onClick={handlePrint} className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg border border-[#e2e8f0] bg-white text-[13px] font-semibold text-[#64748b] hover:bg-[#f1f5f9] hover:border-[#cbd5e1] hover:text-[#334155] active:bg-[#e2e8f0] cursor-pointer whitespace-nowrap transition-all self-center print:hidden">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0">
            <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
          </svg>
          Print List
        </button>
      </div>

      {/* Toolbar: Search + Alphabet + Reset */}
      <div className="flex items-center gap-3 mb-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] px-3.5 py-2.5 flex-nowrap print:hidden">
        {/* Search */}
        <div className="relative w-[220px] min-w-[160px] shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 w-[15px] h-[15px] pointer-events-none">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setSearchTerm("")}
            className="w-full h-[38px] pl-9 pr-8 rounded-lg border border-[#CBD5E1] bg-white text-[14px] text-text placeholder:text-text-faint focus:outline-none focus:border-[#2563EB] focus:ring-[3px] focus:ring-[rgba(37,99,235,0.1)] transition-all"
          />
          {searchTerm && (
            <button onClick={() => { setSearchTerm(""); searchRef.current?.focus(); }} className="absolute right-2 top-1/2 -translate-y-1/2 w-[22px] h-[22px] rounded-full bg-[#e2e8f0] hover:bg-[#cbd5e1] text-[#64748b] hover:text-[#334155] cursor-pointer text-[13px] font-bold flex items-center justify-center border-none transition-all z-[2]">
              &#10005;
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-[#e2e8f0] shrink-0 hidden md:block" />

        {/* Alphabet nav */}
        <div className="flex items-center gap-px flex-1 min-w-0 flex-nowrap overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveLetter(null)}
            className={`w-7 h-7 text-[12px] font-bold rounded-md cursor-pointer border-none transition-all shrink-0 flex items-center justify-center ${activeLetter === null ? "bg-[#0f172a] text-white" : "bg-transparent text-[#475569] hover:bg-[#e2e8f0] hover:text-[#2563eb]"}`}
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
                className={`w-7 h-7 text-[12px] font-bold rounded-md border-none transition-all shrink-0 flex items-center justify-center select-none p-0 ${
                  activeLetter === letter ? "bg-[#0f172a] text-white cursor-pointer" : has ? "bg-transparent text-[#475569] hover:bg-[#e2e8f0] hover:text-[#2563eb] cursor-pointer" : "bg-transparent text-[#d1d5db] cursor-default pointer-events-none"
                }`}
              >
                {letter}
              </button>
            );
          })}
        </div>

        {/* Reset */}
        {isFiltered && (
          <button onClick={resetAll} className="inline-flex items-center gap-1.5 h-[38px] px-3.5 rounded-lg text-[13px] font-semibold text-[#64748b] bg-white border border-[#e2e8f0] cursor-pointer hover:bg-[#f1f5f9] hover:border-[#cbd5e1] hover:text-[#334155] whitespace-nowrap shrink-0 transition-all">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
            Reset
          </button>
        )}
      </div>

      {/* Category pills */}
      {Object.keys(tagCounts).length > 0 && (
        <div className="flex gap-2 py-3 pb-2 mb-4 overflow-x-auto scrollbar-none print:hidden">
          <button
            onClick={() => setActiveCategories([])}
            className={`inline-flex items-center gap-1.5 px-4 py-[7px] rounded-full text-[14px] font-bold border cursor-pointer whitespace-nowrap shrink-0 transition-all select-none ${activeCategories.length === 0 ? "bg-[#2563eb] text-white border-[#2563eb] shadow-[0_2px_6px_rgba(37,99,235,0.25)]" : "bg-white text-[#475569] border-[#e2e8f0] hover:bg-[#f1f5f9] hover:border-[#cbd5e1]"}`}
          >
            All <span className="text-[12px] font-bold opacity-65">{products.length}</span>
          </button>
          {Object.keys(tagCounts).sort().map((tag) => (
            <button
              key={tag}
              onClick={() => toggleCategory(tag)}
              className={`inline-flex items-center gap-1.5 px-4 py-[7px] rounded-full text-[14px] font-semibold border cursor-pointer whitespace-nowrap shrink-0 transition-all select-none ${activeCategories.includes(tag) ? "bg-[#2563eb] text-white border-[#2563eb] shadow-[0_2px_6px_rgba(37,99,235,0.25)] hover:bg-[#1d4ed8] hover:border-[#1d4ed8]" : "bg-white text-[#475569] border-[#e2e8f0] hover:bg-[#f1f5f9] hover:border-[#cbd5e1]"}`}
            >
              {tag} <span className={`text-[12px] font-bold ${activeCategories.includes(tag) ? "opacity-90" : "opacity-65"}`}>{tagCounts[tag]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      <div ref={resultsRef}>
        {filtered.length === 0 ? (
          <div className="text-center py-10 px-5 rounded-2xl bg-white border border-[rgba(15,23,42,0.08)] shadow-[0_4px_12px_rgba(15,23,42,0.04)] mt-3">
            <div className="text-[40px] mb-3 opacity-40">&#128269;</div>
            <div className="text-[18px] font-bold text-text m-0 mb-1.5">No products found</div>
            <div className="text-[15px] text-[rgba(15,23,42,0.55)] m-0">Try a different search or adjust your filters</div>
            <button onClick={resetAll} className="inline-block mt-3.5 text-[15px] font-semibold text-[#2563eb] cursor-pointer bg-transparent border-none hover:text-[#1d4ed8] hover:underline">
              Reset all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
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
      <div className="col-span-full flex items-center gap-2.5 pt-3.5 pb-1 first:pt-0.5">
        <span className="text-[14px] font-extrabold text-[#94a3b8] shrink-0 tracking-[0.5px]">{letter}</span>
        <div className="flex-1 h-px bg-[#f1f5f9]" />
      </div>
      {products.map((product) => (
        <Link
          key={product.href}
          to={product.href}
          className="relative overflow-hidden flex items-center gap-2 px-4 py-3.5 rounded-[10px] border border-[#E2E8F0] bg-white no-underline text-inherit min-h-[48px] hover:bg-[#f8fafc] hover:border-[#cbd5e1] hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:bg-[#f1f5f9] transition-all group before:content-[''] before:absolute before:top-0 before:left-0 before:bottom-0 before:w-[3px] before:bg-[#2563eb] before:opacity-0 before:transition-opacity hover:before:opacity-100"
        >
          <span className="text-[15px] font-semibold text-[#0f172a] flex-1 leading-[1.3] min-w-0" dangerouslySetInnerHTML={{ __html: highlightMatch(product.name, searchTerm) }} />
          <span className="text-[22px] font-light text-[#cbd5e1] shrink-0 transition-all group-hover:text-[#2563eb] group-hover:translate-x-0.5">&#8250;</span>
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

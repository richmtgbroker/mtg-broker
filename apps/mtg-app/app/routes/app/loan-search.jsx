import { useState, useEffect, useMemo, useRef } from "react";
import { isNexaUser as checkNexa, isAdmin as checkAdmin } from "../../lib/auth";

const API_URL = "https://mtg-broker-api.rich-e00.workers.dev/api/loan-products";
const PAGE_SIZE = 50;

// Featured category pills — shown as tabs with counts
const CATEGORIES = [
  { id: "all", label: "All Loans", values: null },
  { id: "bank-stmt", label: "Bank Statement", values: ["Bank Statements Loans"] },
  { id: "dpa", label: "DPA", values: ["Down Payment Assistance (DPA)", "Down  Payment Assistance (DPA)"] },
  { id: "dscr", label: "DSCR", values: ["Debt Service Coverage Ratio (DSCR)"] },
  { id: "fnf", label: "Fix N Flip", values: ["Fix N Flip (FNF)"] },
  { id: "heloan", label: "HELOAN | HELOC | 2NDS", values: ["HELOAN", "HELOC", "2nd Mortgage (Non-QM)", "2nd CES Mortgage (Standalone)"] },
];

// Overflow categories — shown under "More >" dropdown
const MORE_CATEGORIES = [
  { id: "fha", label: "FHA", values: ["FHA", "FHA 203(b) / 203b", "FHA 203(h)", "FHA 203(k) / 203k Renovation", "FHA EZ E-Z"] },
  { id: "jumbo", label: "Jumbo", values: ["Jumbo", "Jumbo (Non-QM)"] },
  { id: "usda", label: "USDA", values: ["USDA"] },
  { id: "va", label: "VA", values: ["VA", "VA IRRRL"] },
  { id: "conv", label: "Conventional", values: ["Conventional"] },
];

export function meta() {
  return [{ title: "Loan Search — MtgBroker" }];
}

export default function LoanSearchPage() {
  const [products, setProducts] = useState([]);
  const [fieldMeta, setFieldMeta] = useState({});
  const [coreColumns, setCoreColumns] = useState([]);
  const [lenderLogos, setLenderLogos] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [nexa, setNexa] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  const searchRef = useRef(null);
  const searchTimeout = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Filter state
  const [minFico, setMinFico] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [occupancy, setOccupancy] = useState("");

  useEffect(() => {
    setNexa(checkNexa());
    setAdmin(checkAdmin());
  }, []);

  // Debounce search
  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(searchTimeout.current);
  }, [searchTerm]);

  // Close "More" dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // Fetch data
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        let prods = data.products || [];

        // NEXA gating
        if (!checkNexa()) {
          prods = prods.filter((p) => {
            const lender = (p.Lender || p.lender || "").toLowerCase();
            return !lender.includes("nexa") && !lender.includes("axen");
          });
        }

        setProducts(prods);
        setFieldMeta(data.fieldMetadata || {});
        setCoreColumns(data.coreColumns || Object.keys(prods[0] || {}).slice(0, 8));
        setLenderLogos(data.lenderLogos || {});
      } catch (e) {
        setError("Error loading loan products. Please refresh.");
      }
      setLoading(false);
    }
    load();
  }, []);

  // Resolve field keys
  const lenderKey = useMemo(() => {
    if (products.length === 0) return "Lender";
    const keys = Object.keys(products[0]);
    return keys.find((k) => k.toLowerCase().replace(/[^a-z]/g, "") === "lender") || "Lender";
  }, [products]);

  const productTypeKey = useMemo(() => {
    if (products.length === 0) return "Loan Product";
    const keys = Object.keys(products[0]);
    return keys.find((k) => k.toLowerCase().replace(/[^a-z]/g, "").includes("loanproduct")) || "Loan Product";
  }, [products]);

  // Derive unique values for Purpose and Occupancy dropdowns
  const purposeOptions = useMemo(() => {
    const set = new Set();
    products.forEach((p) => {
      const val = p["Loan Purpose"] || p["Purpose"] || p.loan_purpose || "";
      if (typeof val === "string" && val) set.add(val);
      if (Array.isArray(val)) val.forEach((v) => set.add(v));
    });
    return Array.from(set).sort();
  }, [products]);

  const occupancyOptions = useMemo(() => {
    const set = new Set();
    products.forEach((p) => {
      const val = p["Occupancy"] || p["Occupancy Type"] || p.occupancy || "";
      if (typeof val === "string" && val) set.add(val);
      if (Array.isArray(val)) val.forEach((v) => set.add(v));
    });
    return Array.from(set).sort();
  }, [products]);

  // Compute category counts from unfiltered products
  const allCategories = [...CATEGORIES, ...MORE_CATEGORIES];
  const categoryCounts = useMemo(() => {
    const counts = {};
    allCategories.forEach((cat) => {
      if (!cat.values) {
        counts[cat.id] = products.length;
      } else {
        counts[cat.id] = products.filter((p) => {
          const val = p[productTypeKey] || "";
          return cat.values.some((v) => val.includes(v));
        }).length;
      }
    });
    return counts;
  }, [products, productTypeKey]);

  // Filter
  const filtered = useMemo(() => {
    let result = products;

    // Category filter
    if (activeCategory !== "all") {
      const cat = allCategories.find((c) => c.id === activeCategory);
      if (cat?.values) {
        result = result.filter((p) => {
          const val = p[productTypeKey] || "";
          return cat.values.some((v) => val.includes(v));
        });
      }
    }

    // Search
    if (debouncedSearch) {
      const term = debouncedSearch.toLowerCase();
      result = result.filter((p) =>
        Object.values(p).some((v) => String(v).toLowerCase().includes(term))
      );
    }

    // Min FICO filter
    if (minFico) {
      const ficoVal = parseInt(minFico);
      if (!isNaN(ficoVal)) {
        result = result.filter((p) => {
          const pFico = parseFloat(p["Min FICO"] || p["Min Credit Score"] || p.min_fico || "0");
          return !isNaN(pFico) && pFico <= ficoVal;
        });
      }
    }

    // Loan Amount filter
    if (loanAmount) {
      const amtVal = parseFloat(loanAmount.replace(/[^0-9.]/g, ""));
      if (!isNaN(amtVal)) {
        result = result.filter((p) => {
          const minAmt = parseFloat(String(p["Min Loan Amount"] || p.min_loan_amount || "0").replace(/[^0-9.]/g, ""));
          const maxAmt = parseFloat(String(p["Max Loan Amount"] || p.max_loan_amount || "999999999").replace(/[^0-9.]/g, ""));
          return amtVal >= (isNaN(minAmt) ? 0 : minAmt) && amtVal <= (isNaN(maxAmt) ? 999999999 : maxAmt);
        });
      }
    }

    // Purpose filter
    if (purpose) {
      result = result.filter((p) => {
        const val = p["Loan Purpose"] || p["Purpose"] || p.loan_purpose || "";
        if (Array.isArray(val)) return val.includes(purpose);
        return String(val).includes(purpose);
      });
    }

    // Occupancy filter
    if (occupancy) {
      result = result.filter((p) => {
        const val = p["Occupancy"] || p["Occupancy Type"] || p.occupancy || "";
        if (Array.isArray(val)) return val.includes(occupancy);
        return String(val).includes(occupancy);
      });
    }

    return result;
  }, [products, activeCategory, debouncedSearch, productTypeKey, minFico, loanAmount, purpose, occupancy]);

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      let va = a[sortKey] ?? "";
      let vb = b[sortKey] ?? "";
      const na = parseFloat(String(va).replace(/[^0-9.-]/g, ""));
      const nb = parseFloat(String(vb).replace(/[^0-9.-]/g, ""));
      if (!isNaN(na) && !isNaN(nb)) {
        return sortDir === "asc" ? na - nb : nb - na;
      }
      va = String(va).toLowerCase();
      vb = String(vb).toLowerCase();
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [filtered, sortKey, sortDir]);

  // Pagination
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Visible columns
  const visibleCols = coreColumns.length > 0 ? coreColumns : Object.keys(products[0] || {}).slice(0, 8);

  const hasActiveFilters = minFico || loanAmount || purpose || occupancy || debouncedSearch;

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setCurrentPage(1);
  }

  function handleCategoryChange(id) {
    setActiveCategory(id);
    setCurrentPage(1);
    setMoreOpen(false);
  }

  function clearAllFilters() {
    setSearchTerm("");
    setMinFico("");
    setLoanAmount("");
    setPurpose("");
    setOccupancy("");
    setActiveCategory("all");
    setCurrentPage(1);
  }

  function getLabel(key) {
    return fieldMeta[key]?.label || key.replace(/_/g, " ");
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-text mb-6">Loan Search</h1>
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-surface-active animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-red-500 mb-4">{error}</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium cursor-pointer border-none">Refresh</button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-text">Loan Search</h1>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-surface-active text-text-muted">
          {sorted.length} product{sorted.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategoryChange(cat.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${
              activeCategory === cat.id
                ? "bg-primary-600 text-white border-primary-600"
                : "bg-white text-text-secondary border-border hover:border-text-muted"
            }`}
          >
            {cat.label} <span className="opacity-70">({categoryCounts[cat.id] || 0})</span>
          </button>
        ))}

        {/* More > dropdown */}
        <div className="relative" ref={moreRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setMoreOpen(!moreOpen); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${
              MORE_CATEGORIES.some((c) => c.id === activeCategory)
                ? "bg-primary-600 text-white border-primary-600"
                : "bg-white text-text-secondary border-border hover:border-text-muted"
            }`}
          >
            {MORE_CATEGORIES.find((c) => c.id === activeCategory)?.label || "More"} &gt;
          </button>
          {moreOpen && (
            <div className="absolute top-[calc(100%+4px)] left-0 bg-white border border-border rounded-xl shadow-lg z-50 py-1 min-w-[160px]">
              {MORE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryChange(cat.id)}
                  className={`w-full text-left px-4 py-2 text-sm cursor-pointer border-none bg-transparent hover:bg-surface-hover transition-colors ${
                    activeCategory === cat.id ? "text-primary-600 font-semibold" : "text-text-secondary"
                  }`}
                >
                  {cat.label} <span className="text-text-faint">({categoryCounts[cat.id] || 0})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-[260px]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-faint pointer-events-none">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            placeholder="Search all fields..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            onKeyDown={(e) => e.key === "Escape" && setSearchTerm("")}
            className="w-full pl-10 pr-8 py-2 rounded-lg border border-border bg-white text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100 transition-colors"
          />
          {searchTerm && (
            <button onClick={() => { setSearchTerm(""); searchRef.current?.focus(); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-faint hover:text-text cursor-pointer text-sm bg-transparent border-none">&#10005;</button>
          )}
        </div>

        {/* Min FICO */}
        <input
          type="text"
          placeholder="Min FICO"
          value={minFico}
          onChange={(e) => { setMinFico(e.target.value.replace(/\D/g, "")); setCurrentPage(1); }}
          className="w-[100px] px-3 py-2 rounded-lg border border-border bg-white text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100 transition-colors"
        />

        {/* Loan Amount */}
        <input
          type="text"
          placeholder="Loan Amount"
          value={loanAmount}
          onChange={(e) => { setLoanAmount(e.target.value); setCurrentPage(1); }}
          className="w-[130px] px-3 py-2 rounded-lg border border-border bg-white text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100 transition-colors"
        />

        {/* Purpose Dropdown */}
        <select
          value={purpose}
          onChange={(e) => { setPurpose(e.target.value); setCurrentPage(1); }}
          className="px-3 py-2 rounded-lg border border-border bg-white text-sm text-text focus:outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100 transition-colors cursor-pointer"
        >
          <option value="">Purpose</option>
          {purposeOptions.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>

        {/* Occupancy Dropdown */}
        <select
          value={occupancy}
          onChange={(e) => { setOccupancy(e.target.value); setCurrentPage(1); }}
          className="px-3 py-2 rounded-lg border border-border bg-white text-sm text-text focus:outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100 transition-colors cursor-pointer"
        >
          <option value="">Occupancy</option>
          {occupancyOptions.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => {}}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-600 text-white border border-primary-600 cursor-pointer hover:bg-primary-700 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
          Filters
        </button>
        <button
          onClick={() => {}}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-text-secondary border border-border cursor-pointer hover:bg-surface-hover transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M12 3v18M3 12h18" /></svg>
          Columns
        </button>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary bg-white border border-border cursor-pointer hover:bg-surface-hover transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      {paginated.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-border">
          <div className="text-4xl mb-3">&#128269;</div>
          <div className="text-lg font-semibold text-text mb-1">No products found</div>
          <div className="text-sm text-text-muted mb-4">Try a different search or category</div>
          <button onClick={clearAllFilters} className="text-sm text-primary-600 font-medium cursor-pointer bg-transparent border-none hover:underline">Reset filters</button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-primary-600 border-b border-primary-700">
                  {visibleCols.map((col) => (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide cursor-pointer hover:text-primary-100 transition-colors whitespace-nowrap select-none"
                    >
                      <span className="inline-flex items-center gap-1">
                        {getLabel(col)}
                        {sortKey === col && (
                          <span className="text-primary-200">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((product, i) => (
                  <tr
                    key={i}
                    onClick={() => setSelectedProduct(product)}
                    className="border-b border-border last:border-b-0 hover:bg-primary-50/30 cursor-pointer transition-colors"
                  >
                    {visibleCols.map((col) => {
                      const val = product[col];
                      const isLender = col.toLowerCase().replace(/[^a-z]/g, "") === "lender";
                      const logoUrl = isLender ? lenderLogos[val] : null;
                      return (
                        <td key={col} className="px-4 py-3 text-text whitespace-nowrap max-w-[250px] truncate">
                          {isLender && logoUrl ? (
                            <span className="inline-flex items-center gap-2">
                              <img src={logoUrl} alt="" className="w-5 h-5 rounded object-contain" />
                              {String(val || "")}
                            </span>
                          ) : (
                            formatCell(val)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-xs text-text-muted">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, sorted.length)} of {sorted.length}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-white text-text-secondary cursor-pointer disabled:opacity-40 disabled:cursor-default hover:bg-surface-hover transition-colors"
                >
                  Prev
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                  let page;
                  if (totalPages <= 7) page = i + 1;
                  else if (currentPage <= 4) page = i + 1;
                  else if (currentPage >= totalPages - 3) page = totalPages - 6 + i;
                  else page = currentPage - 3 + i;

                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                        page === currentPage
                          ? "bg-primary-600 text-white border-primary-600"
                          : "border-border bg-white text-text-secondary hover:bg-surface-hover"
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-white text-text-secondary cursor-pointer disabled:opacity-40 disabled:cursor-default hover:bg-surface-hover transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          fieldMeta={fieldMeta}
          lenderLogos={lenderLogos}
          admin={admin}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// PRODUCT DETAIL MODAL
// ============================================================
function ProductModal({ product, fieldMeta, lenderLogos, admin, onClose }) {
  useEffect(() => {
    function handleEsc(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handleEsc); document.body.style.overflow = ""; };
  }, [onClose]);

  // Group fields by groupName from fieldMeta
  const groups = {};
  Object.entries(product).forEach(([key, val]) => {
    if (val === null || val === undefined || val === "" || val === "-") return;
    if (typeof val === "object" && !Array.isArray(val)) return;
    const meta = fieldMeta[key] || {};
    const group = meta.groupName || "General";
    if (!groups[group]) groups[group] = { order: meta.groupOrder || 99, fields: [] };
    groups[group].fields.push({ key, label: meta.label || key, value: val, order: meta.fieldOrder || 99 });
  });

  const sortedGroups = Object.entries(groups)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([name, g]) => ({
      name,
      fields: g.fields.sort((a, b) => a.order - b.order),
    }));

  const lenderName = product.Lender || product.lender || "";
  const logoUrl = lenderLogos[lenderName];

  return (
    <div className="fixed inset-0 z-[99999] flex items-start justify-center p-4 pt-16">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {logoUrl && <img src={logoUrl} alt="" className="w-8 h-8 rounded object-contain shrink-0" />}
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-text truncate">{product[Object.keys(product).find((k) => k.toLowerCase().includes("loanproduct")) || ""] || lenderName}</h2>
              <p className="text-xs text-text-muted">{lenderName}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg border border-border bg-white flex items-center justify-center cursor-pointer hover:bg-surface-hover transition-colors text-text-muted shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6">
          {sortedGroups.map((group) => (
            <div key={group.name} className="mb-6 last:mb-0">
              <h3 className="text-sm font-bold text-text-faint uppercase tracking-wide mb-3">{group.name}</h3>
              <div className="bg-surface-hover rounded-xl overflow-hidden">
                {group.fields.map((field, i) => (
                  <div key={field.key} className={`flex items-start px-4 py-2.5 ${i > 0 ? "border-t border-white" : ""}`}>
                    <span className="text-xs font-medium text-text-muted w-[180px] shrink-0 pt-0.5">{field.label}</span>
                    <span className="text-sm text-text flex-1" dangerouslySetInnerHTML={{ __html: formatModalValue(field.value) }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// UTILITIES
// ============================================================
function formatCell(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (Array.isArray(val)) return val.join(", ");
  return String(val);
}

function formatModalValue(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "boolean") return val ? "&#10003; Yes" : "&#10007; No";
  if (Array.isArray(val)) {
    if (val.length > 0 && val[0]?.url) {
      return val.map((a) => `<a href="${esc(a.url)}" target="_blank" rel="noopener" style="color:#2563eb;">${esc(a.filename || "Download")}</a>`).join("<br>");
    }
    return val.map((v) => `<span style="display:inline-block;padding:2px 8px;background:#e2e8f0;border-radius:6px;font-size:12px;margin:2px 2px;">${esc(String(v))}</span>`).join(" ");
  }
  const str = String(val).trim();
  if (str.startsWith("http")) return `<a href="${esc(str)}" target="_blank" rel="noopener" style="color:#2563eb;">Open Link &#8599;</a>`;
  return esc(str).replace(/\n/g, "<br>");
}

function esc(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

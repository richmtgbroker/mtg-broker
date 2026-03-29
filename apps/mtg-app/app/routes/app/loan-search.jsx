import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { isNexaUser as checkNexa, isAdmin as checkAdmin } from "../../lib/auth";

const API_URL = "https://mtg-broker-api.rich-e00.workers.dev/api/loan-products";
const PAGE_SIZE = 50;

// ============================================================
// CATEGORY CONFIGURATION — matches vanilla JS v8.0
// ============================================================
const CATEGORY_CONFIG = [
  { id: "all",          label: "All Loans",             values: null, columnGroups: [] },
  { id: "1099",         label: "1099",                  values: ["1099 Only"], columnGroups: [] },
  { id: "asset-dep",    label: "Asset Depletion",       values: ["Asset Depletion | Utilization"], columnGroups: [] },
  { id: "bank-stmt",    label: "Bank Statement",        values: ["Bank Statements Loans"], columnGroups: ["Bank Statements"] },
  { id: "blanket",      label: "Blanket (Portfolio)",    values: ["Blanket (Portfolio)"], columnGroups: [] },
  { id: "bridge",       label: "Bridge Loan",           values: ["Bridge Loan"], columnGroups: [] },
  { id: "dpa",          label: "DPA",                   values: ["Down Payment Assistance (DPA)", "Down  Payment Assistance (DPA)"], columnGroups: ["Down Payment Assistance (DPA)"] },
  { id: "dscr",         label: "DSCR",                  values: ["Debt Service Coverage Ratio (DSCR)"], columnGroups: ["DSCR"] },
  { id: "fha",          label: "FHA",                   values: ["FHA", "FHA 203(b) / 203b", "FHA 203(h)", "FHA 203(k) / 203k Renovation", "FHA EZ E-Z"], columnGroups: [] },
  { id: "fnf",          label: "Fix N Flip",            values: ["Fix N Flip (FNF)"], columnGroups: ["Fix N Flip"] },
  { id: "guc",          label: "GUC",                   values: ["Ground Up Construction (GUC)"], columnGroups: [] },
  { id: "heloan",       label: "HELOAN | 2NDS",         values: ["HELOAN", "2nd Mortgage (Non-QM)", "2nd CES Mortgage (Standalone)"], columnGroups: [] },
  { id: "heloan-group", label: "HELOAN | HELOC | 2NDS", values: ["HELOAN", "HELOC (Standalone)", "2nd Mortgage (Non-QM)", "2nd CES Mortgage (Standalone)"], columnGroups: ["HELOC"] },
  { id: "heloc",        label: "HELOC",                 values: ["HELOC (Standalone)"], columnGroups: ["HELOC"] },
  { id: "jumbo",        label: "Jumbo",                 values: ["Jumbo", "Jumbo (Non-QM)"], columnGroups: [] },
  { id: "otc",          label: "OTC",                   values: ["One-Time Close (OTC) - Conv", "One-Time Close (OTC) - FHA", "One-Time Close (OTC) - VA"], columnGroups: [] },
  { id: "p-and-l",      label: "P&L",                   values: ["P&L", "P&L (Profit and Loss) Statement"], columnGroups: ["Profit & Loss (P&L)"] },
  { id: "usda",         label: "USDA",                  values: ["USDA", "USDA | RD (Guaranteed)"], columnGroups: [] },
  { id: "va",           label: "VA",                    values: ["VA"], columnGroups: [] },
];

// Featured pills shown in the main bar; everything else goes in "More" dropdown
const FEATURED_IDS = ["all", "bank-stmt", "dpa", "dscr", "fnf", "heloan-group"];

// Fields that should NOT appear as filter controls
const NON_FILTERABLE_PATTERNS = new Set(["matrix", "lenderproductnameversionfinal"]);
function isNonFilterable(key) {
  return NON_FILTERABLE_PATTERNS.has(String(key).toLowerCase().replace(/[^a-z0-9]/g, ""));
}

// Quick-access filter labels — these appear inline, skip them from the panel
const QUICK_FILTER_LABELS = ["min fico", "purpose", "occupancy"];
function isQuickFilterField(key, fieldMeta) {
  const label = (fieldMeta[key]?.label || key).toLowerCase().replace(/[^a-z ]/g, "").trim();
  return QUICK_FILTER_LABELS.some((qf) => label === qf);
}

// Range filter sub-fields — hide from individual filter list
const RANGE_SUB_FIELDS = ["minloanamount", "maxloanamount"];
function isRangeSubField(key) {
  return RANGE_SUB_FIELDS.includes(String(key).toLowerCase().replace(/[^a-z0-9]/g, ""));
}

// Numeric threshold fields (borrower enters their FICO, filter shows products at or below)
function isNumericThresholdKey(key) {
  const k = String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
  return k === "minfico";
}

export function meta() {
  return [{ title: "Loan Search — MtgBroker" }];
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function LoanSearchPage() {
  // --- Data state ---
  const [products, setProducts] = useState([]);
  const [fieldMeta, setFieldMeta] = useState({});
  const [allFields, setAllFields] = useState([]);
  const [coreColumns, setCoreColumns] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [lenderLogos, setLenderLogos] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- UI state ---
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [nexa, setNexa] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [columnsPanelOpen, setColumnsPanelOpen] = useState(false);

  // --- Quick-access filter state ---
  const [minFico, setMinFico] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [occupancy, setOccupancy] = useState("");

  // --- Panel filter state: multi-checkbox selections keyed by field ---
  const [panelFilters, setPanelFilters] = useState({});

  const moreRef = useRef(null);
  const searchRef = useRef(null);
  const searchTimeout = useRef(null);

  // --- Auth ---
  useEffect(() => {
    setNexa(checkNexa());
    setAdmin(checkAdmin());
  }, []);

  // --- Debounce search ---
  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(searchTimeout.current);
  }, [searchTerm]);

  // --- Close "More" dropdown on outside click ---
  useEffect(() => {
    function handleClick(e) {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // --- Close panels on Escape ---
  useEffect(() => {
    function handleEsc(e) {
      if (e.key === "Escape") {
        setFilterPanelOpen(false);
        setColumnsPanelOpen(false);
      }
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, []);

  // --- Fetch data ---
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        let prods = data.products || [];
        const meta = data.fieldMetadata || {};
        const fields = data.allFields || Object.keys(prods[0] || {});

        // NEXA gating — resolve lender field key from metadata
        if (!checkNexa()) {
          let nexaLenderKey = null;
          for (const k of fields) {
            const label = (meta[k]?.label || "").toLowerCase();
            if (label === "lender") { nexaLenderKey = k; break; }
          }
          if (!nexaLenderKey) {
            nexaLenderKey = fields.find((k) => k.toLowerCase() === "lender") || null;
          }
          if (nexaLenderKey) {
            prods = prods.filter((p) => {
              const v = String(p[nexaLenderKey] || "").toLowerCase();
              return !v.includes("nexa");
            });
          }
        }

        // Remove Purpose and Occupancy from default visible columns
        const hiddenFromDefaults = ["purpose", "occupancy"];
        let cores = (data.coreColumns || Object.keys(prods[0] || {}).slice(0, 8)).filter((k) => {
          const label = (meta[k]?.label || k).toLowerCase().replace(/[^a-z]/g, "");
          return !hiddenFromDefaults.includes(label);
        });

        setProducts(prods);
        setFieldMeta(meta);
        setAllFields(fields);
        setCoreColumns(cores);
        setVisibleColumns(cores.slice());
        setLenderLogos(data.lenderLogos || {});
      } catch (e) {
        setError("Error loading loan products. Please refresh.");
      }
      setLoading(false);
    }
    load();
  }, []);

  // --- Resolve key field names ---
  const lenderKey = useMemo(() => {
    if (allFields.length === 0) return "Lender";
    for (const k of allFields) {
      if ((fieldMeta[k]?.label || "").toLowerCase() === "lender") return k;
    }
    return allFields.find((k) => k.toLowerCase().replace(/[^a-z]/g, "") === "lender") || "Lender";
  }, [allFields, fieldMeta]);

  const productTypeKey = useMemo(() => {
    if (allFields.length === 0) return "Loan Product";
    for (const k of allFields) {
      const label = (fieldMeta[k]?.label || "").toLowerCase().replace(/[^a-z]/g, "");
      if (label === "loanproduct") return k;
    }
    return allFields.find((k) => k.toLowerCase().replace(/[^a-z0-9]/g, "").includes("loanproduct")) || "Loan Product";
  }, [allFields, fieldMeta]);

  function resolveFieldKey(pattern) {
    const normalized = String(pattern).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (allFields.includes(pattern)) return pattern;
    for (const key of allFields) {
      if (String(key).toLowerCase().replace(/[^a-z0-9]/g, "") === normalized) return key;
    }
    for (const key of Object.keys(fieldMeta)) {
      if (String(key).toLowerCase().replace(/[^a-z0-9]/g, "") === normalized) return key;
      if ((fieldMeta[key]?.label || "").toLowerCase().replace(/[^a-z0-9]/g, "") === normalized) return key;
    }
    return null;
  }

  // --- Derive unique values for dropdowns ---
  function buildUniqueOptions(key) {
    const set = new Set();
    products.forEach((p) => {
      const v = p[key];
      if (v === null || v === undefined) return;
      if (Array.isArray(v)) { v.forEach((x) => x && set.add(String(x).trim())); return; }
      const s = String(v).trim();
      if (s.includes("|")) { s.split("|").forEach((x) => x.trim() && set.add(x.trim())); return; }
      if (s) set.add(s);
    });
    return Array.from(set).sort((a, b) => {
      const na = parseFloat(a.replace(/[$,%\s]/g, ""));
      const nb = parseFloat(b.replace(/[$,%\s]/g, ""));
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
  }

  const purposeOptions = useMemo(() => {
    const key = resolveFieldKey("purpose") || resolveFieldKey("Purpose") || resolveFieldKey("Loan Purpose");
    return key ? buildUniqueOptions(key) : [];
  }, [products, allFields, fieldMeta]);

  const occupancyOptions = useMemo(() => {
    const key = resolveFieldKey("occupancy") || resolveFieldKey("Occupancy");
    return key ? buildUniqueOptions(key) : [];
  }, [products, allFields, fieldMeta]);

  // --- Category counts (from unfiltered products) ---
  const categoryCounts = useMemo(() => {
    const counts = {};
    CATEGORY_CONFIG.forEach((cat) => {
      if (!cat.values) {
        counts[cat.id] = products.length;
      } else {
        counts[cat.id] = products.filter((p) => {
          const val = String(p[productTypeKey] || "").toLowerCase();
          return cat.values.some((v) => val === v.toLowerCase());
        }).length;
      }
    });
    return counts;
  }, [products, productTypeKey]);

  // Split categories into featured pills and overflow
  const featuredCats = useMemo(() => {
    return CATEGORY_CONFIG
      .filter((c) => FEATURED_IDS.includes(c.id) && (categoryCounts[c.id] > 0 || c.id === "all"))
      .sort((a, b) => FEATURED_IDS.indexOf(a.id) - FEATURED_IDS.indexOf(b.id));
  }, [categoryCounts]);

  const overflowCats = useMemo(() => {
    return CATEGORY_CONFIG
      .filter((c) => !FEATURED_IDS.includes(c.id) && categoryCounts[c.id] > 0)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categoryCounts]);

  // --- Effective columns (only user-selected via column picker) ---
  const effectiveColumns = visibleColumns;

  // --- Filtering ---
  const filtered = useMemo(() => {
    let result = products;

    // Category filter
    if (activeCategory !== "all") {
      const cat = CATEGORY_CONFIG.find((c) => c.id === activeCategory);
      if (cat?.values) {
        result = result.filter((p) => {
          const val = String(p[productTypeKey] || "").toLowerCase();
          return cat.values.some((v) => val === v.toLowerCase());
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

    // Min FICO filter (threshold: product's min FICO must be <= entered value)
    if (minFico) {
      const ficoVal = parseInt(minFico);
      if (!isNaN(ficoVal)) {
        const ficoKey = resolveFieldKey("min_fico") || resolveFieldKey("Min FICO");
        if (ficoKey) {
          result = result.filter((p) => {
            const pFico = parseFloat(String(p[ficoKey] || "0").replace(/[^0-9.]/g, ""));
            return !isNaN(pFico) && pFico <= ficoVal;
          });
        }
      }
    }

    // Loan Amount range filter
    if (loanAmount) {
      const amtVal = parseFloat(loanAmount.replace(/[^0-9.]/g, ""));
      if (!isNaN(amtVal)) {
        const minKey = resolveFieldKey("min_loan_amount") || resolveFieldKey("Min Loan Amount");
        const maxKey = resolveFieldKey("max_loan_amount") || resolveFieldKey("Max Loan Amount");
        result = result.filter((p) => {
          const minAmt = minKey ? parseFloat(String(p[minKey] || "0").replace(/[^0-9.]/g, "")) : 0;
          const maxAmt = maxKey ? parseFloat(String(p[maxKey] || "999999999").replace(/[^0-9.]/g, "")) : 999999999;
          return amtVal >= (isNaN(minAmt) ? 0 : minAmt) && amtVal <= (isNaN(maxAmt) ? 999999999 : maxAmt);
        });
      }
    }

    // Purpose filter
    if (purpose) {
      const purposeKey = resolveFieldKey("purpose") || resolveFieldKey("Purpose") || resolveFieldKey("Loan Purpose");
      if (purposeKey) {
        result = result.filter((p) => {
          const val = p[purposeKey] || "";
          if (Array.isArray(val)) return val.includes(purpose);
          return String(val).includes(purpose);
        });
      }
    }

    // Occupancy filter
    if (occupancy) {
      const occKey = resolveFieldKey("occupancy") || resolveFieldKey("Occupancy");
      if (occKey) {
        result = result.filter((p) => {
          const val = p[occKey] || "";
          if (Array.isArray(val)) return val.includes(occupancy);
          return String(val).includes(occupancy);
        });
      }
    }

    // Panel multi-checkbox filters
    for (const [key, selectedSet] of Object.entries(panelFilters)) {
      if (!selectedSet || selectedSet.size === 0) continue;
      result = result.filter((p) => {
        const raw = p[key];
        if (raw === null || raw === undefined) return false;
        if (Array.isArray(raw)) return raw.some((x) => selectedSet.has(String(x).trim()));
        const s = String(raw).trim();
        if (s.includes("|")) return s.split("|").some((x) => selectedSet.has(x.trim()));
        return selectedSet.has(s);
      });
    }

    return result;
  }, [products, activeCategory, debouncedSearch, productTypeKey, minFico, loanAmount, purpose, occupancy, panelFilters]);

  // --- Sorting ---
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      let va = a[sortKey] ?? "";
      let vb = b[sortKey] ?? "";
      const na = parseFloat(String(va).replace(/[^0-9.-]/g, ""));
      const nb = parseFloat(String(vb).replace(/[^0-9.-]/g, ""));
      if (!isNaN(na) && !isNaN(nb)) return sortDir === "asc" ? na - nb : nb - na;
      va = String(va).toLowerCase();
      vb = String(vb).toLowerCase();
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [filtered, sortKey, sortDir]);

  // --- Pagination ---
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // --- Active filter count ---
  const panelFilterCount = Object.values(panelFilters).reduce((n, set) => n + (set?.size || 0), 0);
  const quickFilterCount = (minFico ? 1 : 0) + (loanAmount ? 1 : 0) + (purpose ? 1 : 0) + (occupancy ? 1 : 0);
  const totalFilterCount = panelFilterCount + quickFilterCount + (debouncedSearch ? 1 : 0);
  const hasActiveFilters = totalFilterCount > 0 || activeCategory !== "all";

  // --- Active filter chips ---
  const activeChips = useMemo(() => {
    const chips = [];
    if (minFico) chips.push({ id: "fico", label: "Min FICO", value: minFico, onRemove: () => setMinFico("") });
    if (loanAmount) chips.push({ id: "amount", label: "Loan Amount", value: loanAmount, onRemove: () => setLoanAmount("") });
    if (purpose) chips.push({ id: "purpose", label: "Purpose", value: purpose, onRemove: () => setPurpose("") });
    if (occupancy) chips.push({ id: "occupancy", label: "Occupancy", value: occupancy, onRemove: () => setOccupancy("") });
    for (const [key, selectedSet] of Object.entries(panelFilters)) {
      if (!selectedSet || selectedSet.size === 0) continue;
      const label = fieldMeta[key]?.label || key.replace(/_/g, " ");
      for (const val of selectedSet) {
        chips.push({
          id: `${key}:${val}`,
          label,
          value: val,
          onRemove: () => {
            setPanelFilters((prev) => {
              const next = { ...prev };
              const s = new Set(next[key]);
              s.delete(val);
              if (s.size === 0) delete next[key];
              else next[key] = s;
              return next;
            });
          },
        });
      }
    }
    return chips;
  }, [minFico, loanAmount, purpose, occupancy, panelFilters, fieldMeta]);

  // --- Handlers ---
  function handleSort(key) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setCurrentPage(1);
  }

  function handleCategoryChange(id) {
    setActiveCategory(id);
    setCurrentPage(1);
    setMoreOpen(false);
    setVisibleColumns(coreColumns.slice());
  }

  function clearAllFilters() {
    setSearchTerm("");
    setMinFico("");
    setLoanAmount("");
    setPurpose("");
    setOccupancy("");
    setPanelFilters({});
    setActiveCategory("all");
    setVisibleColumns(coreColumns.slice());
    setCurrentPage(1);
  }

  function getLabel(key) {
    return fieldMeta[key]?.label || key.replace(/_/g, " ");
  }

  function togglePanelFilter(key, value) {
    setPanelFilters((prev) => {
      const next = { ...prev };
      const s = new Set(next[key] || []);
      if (s.has(value)) s.delete(value);
      else s.add(value);
      if (s.size === 0) delete next[key];
      else next[key] = s;
      return next;
    });
    setCurrentPage(1);
  }

  function clearPanelFilter(key) {
    setPanelFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setCurrentPage(1);
  }

  // --- Results count text ---
  const resultsText = useMemo(() => {
    const cat = CATEGORY_CONFIG.find((c) => c.id === activeCategory);
    const catLabel = cat && cat.id !== "all" ? cat.label + ": " : "";
    if (sorted.length === products.length) return catLabel + products.length + " products";
    return catLabel + sorted.length + " of " + products.length + " products";
  }, [sorted.length, products.length, activeCategory]);

  // ============================================================
  // RENDER
  // ============================================================
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
      {/* Category Bar */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        {featuredCats.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategoryChange(cat.id)}
            className={`h-[38px] px-4 rounded-full text-[13px] font-semibold cursor-pointer transition-colors ${
              activeCategory === cat.id
                ? "bg-primary-600 text-white border-[1.5px] border-primary-600 shadow-[0_2px_8px_rgba(37,99,235,.25)]"
                : "bg-white text-text-secondary border-[1.5px] border-[#e2e8f0] hover:border-text-muted"
            }`}
          >
            {cat.label} <span className="opacity-70">({categoryCounts[cat.id] || 0})</span>
          </button>
        ))}

        {/* More dropdown */}
        {overflowCats.length > 0 && (
          <div className="relative" ref={moreRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setMoreOpen(!moreOpen); }}
              className={`h-[38px] px-4 rounded-full text-[13px] font-semibold cursor-pointer transition-colors ${
                overflowCats.some((c) => c.id === activeCategory)
                  ? "bg-primary-600 text-white border-[1.5px] border-primary-600 shadow-[0_2px_8px_rgba(37,99,235,.25)]"
                  : "bg-[#f8fafc] text-text-secondary border-[1.5px] border-dashed border-[#cbd5e1] hover:border-text-muted"
              }`}
            >
              {overflowCats.find((c) => c.id === activeCategory)?.label || "More"} <span className="text-[10px]">&#9662;</span>
            </button>
            {moreOpen && (
              <div className="absolute top-[calc(100%+4px)] left-0 bg-white border border-border rounded-xl shadow-[0_8px_24px_rgba(0,0,0,.12)] z-50 p-1.5 min-w-[240px]">
                {overflowCats.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryChange(cat.id)}
                    className={`w-full text-left px-3.5 py-2.5 text-sm cursor-pointer border-none rounded-lg transition-colors ${
                      activeCategory === cat.id ? "bg-primary-600 text-white font-semibold" : "bg-transparent text-text-secondary hover:bg-surface-hover"
                    }`}
                  >
                    {cat.label} <span className={activeCategory === cat.id ? "text-white/70" : "text-text-faint"}>({categoryCounts[cat.id] || 0})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search + Quick Filters Row */}
      <div className="flex items-end gap-3 mb-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-[260px]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-faint pointer-events-none">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            placeholder="Search loans..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            onKeyDown={(e) => e.key === "Escape" && setSearchTerm("")}
            className="w-full h-[38px] pl-10 pr-8 rounded-[10px] border border-[#cbd5e1] bg-white text-[13px] text-text placeholder:text-text-faint focus:outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100 shadow-[0_1px_4px_rgba(15,23,42,0.04)] transition-colors"
          />
          {searchTerm && (
            <button onClick={() => { setSearchTerm(""); searchRef.current?.focus(); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-faint hover:text-text cursor-pointer text-sm bg-transparent border-none">&#10005;</button>
          )}
        </div>

        {/* Min FICO */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wide">Min FICO</label>
          <input
            type="text"
            placeholder="e.g. 620"
            value={minFico}
            onChange={(e) => { setMinFico(e.target.value.replace(/\D/g, "")); setCurrentPage(1); }}
            className="w-[100px] h-[38px] px-3 rounded-[10px] border border-[#cbd5e1] bg-white text-[13px] text-text placeholder:text-text-faint focus:outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100 transition-colors"
          />
        </div>

        {/* Loan Amount */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wide">Loan Amount</label>
          <input
            type="text"
            placeholder="e.g. 350000"
            value={loanAmount}
            onChange={(e) => { setLoanAmount(e.target.value); setCurrentPage(1); }}
            className="w-[130px] h-[38px] px-3 rounded-[10px] border border-[#cbd5e1] bg-white text-[13px] text-text placeholder:text-text-faint focus:outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100 transition-colors"
          />
        </div>

        {/* Purpose */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wide">Purpose</label>
          <select
            value={purpose}
            onChange={(e) => { setPurpose(e.target.value); setCurrentPage(1); }}
            className="h-[38px] px-3 rounded-[10px] border border-[#cbd5e1] bg-white text-[13px] text-text focus:outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100 transition-colors cursor-pointer"
          >
            <option value="">All</option>
            {purposeOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>

        {/* Occupancy */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wide">Occupancy</label>
          <select
            value={occupancy}
            onChange={(e) => { setOccupancy(e.target.value); setCurrentPage(1); }}
            className="h-[38px] px-3 rounded-[10px] border border-[#cbd5e1] bg-white text-[13px] text-text focus:outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100 transition-colors cursor-pointer"
          >
            <option value="">All</option>
            {occupancyOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setFilterPanelOpen(!filterPanelOpen); setColumnsPanelOpen(false); }}
            className={`flex items-center gap-1.5 h-[38px] px-3 rounded-[10px] text-xs font-bold cursor-pointer transition-colors ${
              filterPanelOpen
                ? "bg-primary-600 text-white border border-primary-600"
                : "bg-[#dbeafe] text-[#1d4ed8] border border-[#bfdbfe] hover:bg-[#bfdbfe]"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
            Filters
            {totalFilterCount > 0 && (
              <span className="ml-0.5 bg-white/20 text-[10px] rounded-full px-1.5 py-0.5 font-bold min-w-[18px] text-center">
                {totalFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={() => { setColumnsPanelOpen(!columnsPanelOpen); setFilterPanelOpen(false); }}
            className={`flex items-center gap-1.5 h-[38px] px-3 rounded-[10px] text-xs font-medium cursor-pointer transition-colors ${
              columnsPanelOpen
                ? "bg-primary-600 text-white border border-primary-600"
                : "bg-white text-text-secondary border border-[#cbd5e1] hover:bg-surface-hover shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><rect x="3" y="3" width="7" height="18" rx="1" /><rect x="14" y="3" width="7" height="18" rx="1" /></svg>
            Columns
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1.5 h-[38px] px-3 rounded-[10px] text-xs font-medium text-red-600 bg-red-50 border border-red-200 cursor-pointer hover:bg-red-100 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M3 6h18M8 6V4h8v2M5 6v14a2 2 0 002 2h10a2 2 0 002-2V6" /></svg>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Active Filter Chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {activeChips.map((chip) => (
            <span key={chip.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#dbeafe] text-[#1d4ed8] text-[11px] font-medium">
              {chip.label}: {chip.value}
              <button
                onClick={chip.onRemove}
                className="ml-0.5 text-[#1d4ed8]/60 hover:text-[#1d4ed8] cursor-pointer bg-transparent border-none text-sm leading-none"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Results Count */}
      <div className="mb-3">
        <span className="text-xs font-semibold text-text-muted">{resultsText}</span>
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
        <div className="bg-white rounded-xl border border-[#e5e7eb] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0f172a]">
                  {effectiveColumns.map((col) => (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      className="px-2.5 py-1.5 text-left text-[11px] font-semibold text-white uppercase tracking-wide cursor-pointer hover:bg-[#1e293b] border-r border-[#1e293b] last:border-r-0 transition-colors whitespace-nowrap select-none"
                    >
                      <span className="inline-flex items-center gap-1">
                        {getLabel(col)}
                        {sortKey === col ? (
                          <span className="text-white/60">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>
                        ) : (
                          <span className="text-white/25">{"\u2195"}</span>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((product, i) => (
                  <tr
                    key={product.id || i}
                    onClick={(e) => { if (e.target.tagName !== "A") setSelectedProduct(product); }}
                    className={`border-b border-border last:border-b-0 hover:bg-[#eff6ff] cursor-pointer transition-colors ${
                      i % 2 === 0 ? "bg-white" : "bg-[#f8fafc]"
                    }`}
                  >
                    {effectiveColumns.map((col) => {
                      const val = product[col];
                      const isLenderCol = col === lenderKey;
                      const isMatrix = typeof val === "string" && val.startsWith("http") && String(col).toLowerCase().includes("matrix");

                      if (isMatrix) {
                        return (
                          <td key={col} className="px-2 py-[3px] text-[12px] whitespace-nowrap">
                            <a
                              href={val}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-primary-600 hover:underline font-medium"
                            >
                              View Matrix
                            </a>
                          </td>
                        );
                      }

                      if (isLenderCol) {
                        const lenderName = Array.isArray(val) ? val[0] : (val || "");
                        const logoUrl = lenderLogos[lenderName];
                        return (
                          <td key={col} className="px-2 py-[3px] text-[12px] text-text whitespace-nowrap">
                            <span className="inline-flex items-center gap-2">
                              {logoUrl && (
                                <img
                                  src={logoUrl}
                                  alt=""
                                  className="w-[22px] h-[22px] rounded object-contain shrink-0 bg-[#f8fafc]"
                                  loading="lazy"
                                  onError={(e) => { e.target.style.display = "none"; }}
                                />
                              )}
                              {lenderName || "\u2014"}
                            </span>
                          </td>
                        );
                      }

                      return (
                        <td key={col} className="px-2 py-[3px] text-[12px] text-text whitespace-nowrap max-w-[250px] truncate">
                          {formatCell(val)}
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
                Showing {(currentPage - 1) * PAGE_SIZE + 1}&ndash;{Math.min(currentPage * PAGE_SIZE, sorted.length)} of {sorted.length}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-white text-text-secondary cursor-pointer disabled:opacity-40 disabled:cursor-default hover:bg-surface-hover transition-colors"
                >
                  Prev
                </button>
                {getPaginationPages(currentPage, totalPages).map((p, i) =>
                  p === "..." ? (
                    <span key={`ellipsis-${i}`} className="px-1 py-1.5 text-xs text-text-faint">&hellip;</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                        p === currentPage
                          ? "bg-primary-600 text-white border-primary-600"
                          : "border-border bg-white text-text-secondary hover:bg-surface-hover"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
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

      {/* Filter Panel (slide-in from right) */}
      <FilterPanel
        open={filterPanelOpen}
        onClose={() => setFilterPanelOpen(false)}
        allFields={allFields}
        fieldMeta={fieldMeta}
        products={products}
        panelFilters={panelFilters}
        onToggle={togglePanelFilter}
        onClearField={clearPanelFilter}
        onClearAll={() => { setPanelFilters({}); setCurrentPage(1); }}
        buildUniqueOptions={buildUniqueOptions}
      />

      {/* Columns Panel (slide-in from right) */}
      <ColumnsPanel
        open={columnsPanelOpen}
        onClose={() => setColumnsPanelOpen(false)}
        allFields={allFields}
        fieldMeta={fieldMeta}
        visibleColumns={visibleColumns}
        coreColumns={coreColumns}
        onToggleColumn={(key) => {
          setVisibleColumns((prev) =>
            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
          );
        }}
        onReset={() => setVisibleColumns(coreColumns.slice())}
      />

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          fieldMeta={fieldMeta}
          lenderLogos={lenderLogos}
          lenderKey={lenderKey}
          admin={admin}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// FILTER PANEL — slide-in from right with accordion groups
// ============================================================
function FilterPanel({ open, onClose, allFields, fieldMeta, products, panelFilters, onToggle, onClearField, onClearAll, buildUniqueOptions }) {
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [searchTerms, setSearchTerms] = useState({});

  // Build filterable fields grouped by groupName
  const groupedFields = useMemo(() => {
    const filterKeys = allFields.filter(
      (k) =>
        fieldMeta[k]?.filterable !== false &&
        !isRangeSubField(k) &&
        !isNonFilterable(k) &&
        !isQuickFilterField(k, fieldMeta) &&
        !isNumericThresholdKey(k) &&
        !fieldMeta[k]?.detailOnly
    );

    const groups = {};
    filterKeys.forEach((key) => {
      const groupName = fieldMeta[key]?.groupName || "Other";
      const groupOrder = fieldMeta[key]?.groupOrder || 99;
      if (!groups[groupName]) groups[groupName] = { order: groupOrder, fields: [] };
      groups[groupName].fields.push(key);
    });

    return Object.entries(groups)
      .sort(([, a], [, b]) => a.order - b.order)
      .map(([name, g]) => ({
        name,
        fields: g.fields.sort(
          (a, b) => (fieldMeta[a]?.fieldOrder || 99) - (fieldMeta[b]?.fieldOrder || 99)
        ),
      }));
  }, [allFields, fieldMeta]);

  // Auto-expand first group on mount
  useEffect(() => {
    if (expandedGroups.size === 0 && groupedFields.length > 0) {
      setExpandedGroups(new Set([groupedFields[0].name]));
    }
  }, [groupedFields]);

  function toggleGroup(name) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const activeCount = Object.values(panelFilters).reduce((n, s) => n + (s?.size || 0), 0);

  return (
    <>
      {/* Backdrop (mobile) */}
      {open && (
        <div className="fixed inset-0 bg-black/30 z-[9998] md:hidden" onClick={onClose} />
      )}
      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-[340px] max-w-[90vw] bg-white shadow-[-4px_0_24px_rgba(0,0,0,.1)] z-[9999] flex flex-col transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-text">Filters</h3>
            {activeCount > 0 && (
              <span className="text-[11px] font-bold text-primary-600 bg-[#dbeafe] px-2 py-0.5 rounded-full">
                {activeCount}
              </span>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-hover cursor-pointer bg-transparent border-none text-text-muted text-xl">
            &times;
          </button>
        </div>

        {/* Reset bar */}
        {activeCount > 0 && (
          <div className="px-5 py-2 border-b border-border">
            <button
              onClick={onClearAll}
              className="text-xs font-medium text-red-600 cursor-pointer bg-transparent border-none hover:underline"
            >
              Reset All Filters
            </button>
          </div>
        )}

        {/* Accordion groups */}
        <div className="flex-1 overflow-y-auto">
          {groupedFields.map((group) => {
            const isExpanded = expandedGroups.has(group.name);
            const groupHasActive = group.fields.some((k) => panelFilters[k]?.size > 0);

            return (
              <div key={group.name} className="border-b border-border">
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.name)}
                  className="w-full flex items-center justify-between px-5 py-3 text-left cursor-pointer bg-transparent border-none hover:bg-surface-hover transition-colors"
                >
                  <span className={`text-sm font-semibold ${groupHasActive ? "text-primary-600" : "text-text"}`}>
                    {group.name}
                    {groupHasActive && <span className="ml-1.5 text-[10px] text-primary-600">&bull;</span>}
                  </span>
                  <span className={`text-text-faint text-xs transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                    &#9660;
                  </span>
                </button>

                {/* Group fields */}
                {isExpanded && (
                  <div className="px-5 pb-4">
                    {group.fields.map((key) => {
                      const label = fieldMeta[key]?.label || key.replace(/_/g, " ");
                      const options = buildUniqueOptions(key);
                      const selected = panelFilters[key] || new Set();
                      const searchTerm = searchTerms[key] || "";
                      const filteredOptions = searchTerm
                        ? options.filter((o) => o.toLowerCase().includes(searchTerm.toLowerCase()))
                        : options;

                      if (options.length === 0) return null;

                      return (
                        <div key={key} className="mb-4 last:mb-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-medium text-text-muted">{label}</span>
                            {selected.size > 0 && (
                              <button
                                onClick={() => onClearField(key)}
                                className="text-[10px] text-red-500 cursor-pointer bg-transparent border-none hover:underline"
                              >
                                Clear
                              </button>
                            )}
                          </div>

                          {/* Search within options (if many) */}
                          {options.length > 8 && (
                            <input
                              type="text"
                              placeholder="Search..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerms((prev) => ({ ...prev, [key]: e.target.value }))}
                              className="w-full h-7 px-2 mb-1.5 rounded-md border border-[#e2e8f0] bg-[#f8fafc] text-[11px] text-text placeholder:text-text-faint focus:outline-none focus:border-primary-600 transition-colors"
                            />
                          )}

                          {/* Checkbox list */}
                          <div className="max-h-[160px] overflow-y-auto rounded-lg border border-[#e2e8f0] bg-[#f8fafc]">
                            {filteredOptions.map((opt) => (
                              <label
                                key={opt}
                                className="flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-text cursor-pointer hover:bg-white transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={selected.has(opt)}
                                  onChange={() => onToggle(key, opt)}
                                  className="accent-[#2563eb] cursor-pointer"
                                />
                                <span className="truncate">{opt}</span>
                              </label>
                            ))}
                            {filteredOptions.length === 0 && (
                              <div className="px-2.5 py-2 text-[11px] text-text-faint">No matches</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ============================================================
// COLUMNS PANEL — slide-in from right with grouped checkboxes
// ============================================================
function ColumnsPanel({ open, onClose, allFields, fieldMeta, visibleColumns, coreColumns, onToggleColumn, onReset }) {
  const groupedColumns = useMemo(() => {
    const groups = {};
    allFields.forEach((k) => {
      if (fieldMeta[k]?.detailOnly) return;
      const groupName = fieldMeta[k]?.groupName || "Other";
      const groupOrder = fieldMeta[k]?.groupOrder || 99;
      if (!groups[groupName]) groups[groupName] = { order: groupOrder, fields: [] };
      groups[groupName].fields.push(k);
    });

    return Object.entries(groups)
      .sort(([, a], [, b]) => a.order - b.order)
      .map(([name, g]) => ({
        name,
        fields: g.fields.sort(
          (a, b) => (fieldMeta[a]?.fieldOrder || 99) - (fieldMeta[b]?.fieldOrder || 99)
        ),
      }));
  }, [allFields, fieldMeta]);

  const isDefault = visibleColumns.length === coreColumns.length && visibleColumns.every((k) => coreColumns.includes(k));

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/30 z-[9998] md:hidden" onClick={onClose} />
      )}
      <div
        className={`fixed top-0 right-0 h-full w-[300px] max-w-[90vw] bg-white shadow-[-4px_0_24px_rgba(0,0,0,.1)] z-[9999] flex flex-col transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h3 className="text-base font-bold text-text">Columns</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-hover cursor-pointer bg-transparent border-none text-text-muted text-xl">
            &times;
          </button>
        </div>

        {!isDefault && (
          <div className="px-5 py-2 border-b border-border">
            <button
              onClick={onReset}
              className="text-xs font-medium text-primary-600 cursor-pointer bg-transparent border-none hover:underline"
            >
              Reset to Default
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {groupedColumns.map((group) => (
            <div key={group.name} className="border-b border-border">
              <div className="px-5 pt-3 pb-1.5 text-[11px] font-bold text-text-faint uppercase tracking-wide">
                {group.name}
              </div>
              <div className="px-5 pb-3">
                {group.fields.map((k) => {
                  const label = fieldMeta[k]?.label || k.replace(/_/g, " ");
                  return (
                    <label
                      key={k}
                      className="flex items-center gap-2 py-1.5 text-[13px] text-text cursor-pointer hover:text-primary-600 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns.includes(k)}
                        onChange={() => onToggleColumn(k)}
                        className="accent-[#2563eb] cursor-pointer"
                      />
                      <span className="truncate">{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ============================================================
// PRODUCT DETAIL MODAL
// ============================================================
function ProductModal({ product, fieldMeta, lenderLogos, lenderKey, admin, onClose }) {
  useEffect(() => {
    function handleEsc(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handleEsc); document.body.style.overflow = ""; };
  }, [onClose]);

  const sortedGroups = useMemo(() => {
    const groups = {};
    const configuredFields = Object.keys(fieldMeta);
    if (configuredFields.length === 0) {
      Object.entries(product).forEach(([key, val]) => {
        if (isFieldEmpty(val)) return;
        if (typeof val === "object" && !Array.isArray(val)) return;
        if (!groups["General"]) groups["General"] = { order: 0, fields: [] };
        groups["General"].fields.push({ key, label: key, value: val, order: 0 });
      });
    } else {
      configuredFields.forEach((key) => {
        if (key === "id") return;
        const meta = fieldMeta[key];
        if (!meta) return;
        const val = product[key];
        if (isFieldEmpty(val)) return;
        const groupName = meta.groupName || "Other Details";
        const groupOrder = meta.groupOrder || 99;
        if (!groups[groupName]) groups[groupName] = { order: groupOrder, fields: [] };
        groups[groupName].fields.push({
          key,
          label: meta.label || key.replace(/_/g, " "),
          value: val,
          order: meta.fieldOrder || 99,
        });
      });
    }

    return Object.entries(groups)
      .sort(([, a], [, b]) => a.order - b.order)
      .filter(([, g]) => g.fields.length > 0)
      .map(([name, g]) => ({
        name,
        fields: g.fields.sort((a, b) => a.order - b.order),
      }));
  }, [product, fieldMeta]);

  const rawLender = product[lenderKey] || product.Lender || product.lender || "";
  const resolvedLender = Array.isArray(rawLender) ? rawLender[0] : rawLender;
  // If lender value is an Airtable record ID, look up the display name from lenderLogos keys
  const lenderDisplay = (() => {
    if (resolvedLender && !resolvedLender.startsWith("rec")) return resolvedLender;
    // Try to find the lender name from fieldMeta-labeled fields
    for (const k of Object.keys(fieldMeta)) {
      const label = (fieldMeta[k]?.label || "").toLowerCase();
      if (label === "lender" && product[k] && !String(product[k]).startsWith("rec")) {
        return Array.isArray(product[k]) ? product[k][0] : product[k];
      }
    }
    return resolvedLender;
  })();
  const logoUrl = lenderLogos[resolvedLender] || lenderLogos[lenderDisplay];

  const productName = (() => {
    // Try "Product Name" field first
    if (product["Product Name"]) return product["Product Name"];
    if (product["product_name"]) return product["product_name"];
    // Try "Lender Product Name | Version (Final)" for more specific name
    if (product["Lender Product Name | Version (Final)"]) return product["Lender Product Name | Version (Final)"];
    if (product["Lender Product Name | Version"]) return product["Lender Product Name | Version"];
    // Try any field with "loanproduct" in its name
    for (const k of Object.keys(product)) {
      if (k.toLowerCase().replace(/[^a-z0-9]/g, "").includes("loanproduct")) return product[k];
    }
    // Try any field with "productname" in its name
    for (const k of Object.keys(product)) {
      if (k.toLowerCase().replace(/[^a-z0-9]/g, "").includes("productname")) return product[k];
    }
    return "Product Details";
  })();

  const airtableUrl = product["Link to this Airtable LOAN (Formula)"] || "";

  return (
    <div className="fixed inset-0 z-[99999] flex items-start justify-center p-4 pt-16">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {logoUrl && (
              <img
                src={logoUrl}
                alt=""
                className="w-8 h-8 rounded object-contain shrink-0"
                onError={(e) => { e.target.style.display = "none"; }}
              />
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-text truncate">{productName}</h2>
              <p className="text-xs text-text-muted">{lenderDisplay}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {admin && airtableUrl && (
              <a
                href={airtableUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-primary-600 hover:underline flex items-center gap-1"
              >
                Edit in Airtable &#8599;
              </a>
            )}
            <button onClick={onClose} className="w-9 h-9 rounded-lg border border-border bg-white flex items-center justify-center cursor-pointer hover:bg-surface-hover transition-colors text-text-muted shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-6">
          {sortedGroups.map((group) => (
            <div key={group.name} style={{ background: "#FFFFFF", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #2563eb55", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 16px", background: "#2563eb20", borderBottom: "1px solid #2563eb45" }}>
                <div style={{ width: 3, height: 16, borderRadius: 2, flexShrink: 0, background: "#2563eb" }} />
                <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.01em", textTransform: "uppercase", color: "#2563eb" }}>{group.name}</span>
              </div>
              {group.fields.map((field, i) => (
                <div key={field.key} style={{ display: "flex", alignItems: "flex-start", padding: "10px 16px", borderBottom: i < group.fields.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#64748B", width: 180, flexShrink: 0, paddingTop: 1 }}>{field.label}</span>
                  <span className="text-sm text-text flex-1" dangerouslySetInnerHTML={{ __html: formatModalValue(field.value, field.key) }} />
                </div>
              ))}
            </div>
          ))}
          {sortedGroups.length === 0 && (
            <p className="text-text-muted text-sm">No data available for this product.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// UTILITIES
// ============================================================
function isFieldEmpty(value) {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "boolean" || typeof value === "number") return false;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return true;
    if (/^[-\u2014\u2013]+$/.test(trimmed)) return true;
    if (/^n\/?a$/i.test(trimmed)) return true;
  }
  return false;
}

function formatCell(val) {
  if (val === null || val === undefined) return "\u2014";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (Array.isArray(val)) return val.join(" | ");
  return String(val);
}

function formatModalValue(val, key) {
  if (val === null || val === undefined || val === "") return "\u2014";
  if (typeof val === "boolean") return val ? "&#10003; Yes" : "&#10007; No";
  if (Array.isArray(val)) {
    if (val.length === 0) return "\u2014";
    if (val[0]?.url) {
      return val
        .map((a) => {
          const fname = esc(a.filename || "Attachment");
          const isImage = a.type && a.type.startsWith("image/");
          if (isImage && a.thumbnails?.large) {
            return `<a href="${esc(a.url)}" target="_blank" rel="noopener" style="display:inline-block;margin:4px 4px 4px 0"><img src="${esc(a.thumbnails.large.url)}" alt="${fname}" style="max-width:200px;max-height:120px;border-radius:8px;border:1px solid #e2e8f0"></a>`;
          }
          return `<a href="${esc(a.url)}" target="_blank" rel="noopener" style="color:#2563eb;">${fname} &#8599;</a>`;
        })
        .join("<br>");
    }
    return val
      .map((v) => `<span style="display:inline-block;padding:2px 8px;background:#e2e8f0;border-radius:6px;font-size:12px;margin:2px 2px;">${esc(String(v))}</span>`)
      .join(" ");
  }
  const str = String(val).trim();
  if (str.startsWith("http")) {
    const isMatrix = key && key.toLowerCase().includes("matrix");
    if (isMatrix) return `<a href="${esc(str)}" target="_blank" rel="noopener" style="color:#2563eb;font-weight:600;">View Matrix &#8599;</a>`;
    return `<a href="${esc(str)}" target="_blank" rel="noopener" style="color:#2563eb;">Open Link &#8599;</a>`;
  }
  let h = esc(str);
  if (str.length > 100 || str.includes("\n")) {
    h = h.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");
    h = h.replace(/\n/g, "<br>");
    return `<div style="white-space:normal;line-height:1.7;font-size:13px">${h}</div>`;
  }
  return h;
}

function esc(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getPaginationPages(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  let start = Math.max(1, current - 3);
  let end = Math.min(total, start + 6);
  start = Math.max(1, end - 6);
  if (start > 1) { pages.push(1); if (start > 2) pages.push("..."); }
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total) { if (end < total - 1) pages.push("..."); pages.push(total); }
  return pages;
}

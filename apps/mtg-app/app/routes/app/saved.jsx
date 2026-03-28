import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router";
import { getAccessToken, isLoggedIn } from "../../lib/auth";

export function meta() {
  return [{ title: "Saved Scenarios — MtgBroker" }];
}

const C = {
  bg: "#F8FAFC",
  card: "#FFFFFF",
  border: "#E2E8F0",
  blue: "#2563EB",
  blueBg: "#EFF6FF",
  text: "#0F172A",
  muted: "#64748B",
  dim: "#94A3B8",
  red: "#DC2626",
  redBg: "#FEF2F2",
  green: "#059669",
  greenBg: "#ECFDF5",
  radius: 10,
};

const CALC_TYPE_ICONS = {
  "Refinance Analysis": "fa-solid fa-arrows-rotate",
  "Mortgage Calculator": "fa-solid fa-calculator",
  "Affordability Calculator": "fa-solid fa-house-circle-check",
  "Buy Down Calculator": "fa-solid fa-arrow-down-short-wide",
  "Blended Rate": "fa-solid fa-chart-pie",
  "DSCR Calculator": "fa-solid fa-building",
  "Loan Scenario Comparison": "fa-solid fa-code-compare",
  "Rent vs Buy": "fa-solid fa-scale-balanced",
  "Lender Pricing Comparison": "fa-solid fa-ranking-star",
  "Gift of Equity": "fa-solid fa-gift",
  "Income Calculation": "fa-solid fa-money-bill-trend-up",
  "Fix N Flip": "fa-solid fa-hammer",
  "Construction Loan": "fa-solid fa-helmet-safety",
  "Closing Costs": "fa-solid fa-file-invoice-dollar",
  "VA Entitlement": "fa-solid fa-flag-usa",
};

const CALC_TYPE_COLORS = {
  "Refinance Analysis": "#2563EB",
  "Mortgage Calculator": "#2563EB",
  "Affordability Calculator": "#059669",
  "Buy Down Calculator": "#7C3AED",
  "Blended Rate": "#D97706",
  "DSCR Calculator": "#0891B2",
  "Loan Scenario Comparison": "#4F46E5",
  "Rent vs Buy": "#BE185D",
  "Lender Pricing Comparison": "#EA580C",
  "Gift of Equity": "#DB2777",
  "Income Calculation": "#059669",
  "Fix N Flip": "#92400E",
  "Construction Loan": "#D97706",
  "Closing Costs": "#2563EB",
  "VA Entitlement": "#1D4ED8",
};

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return "—"; }
}

function estimateSize(scenarios) {
  const bytes = new Blob([JSON.stringify(scenarios)]).size;
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function SavedScenariosPage() {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [deleting, setDeleting] = useState(null);

  const fetchScenarios = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/calculator-scenarios", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load scenarios");
      const data = await res.json();
      setScenarios(data.scenarios || []);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchScenarios(); }, [fetchScenarios]);

  const handleDelete = useCallback(async (id) => {
    const token = getAccessToken();
    if (!token) return;
    setDeleting(id);
    const prev = scenarios;
    setScenarios((s) => s.filter((x) => x.id !== id));
    try {
      const res = await fetch(`/api/calculator-scenarios/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
    } catch {
      setScenarios(prev);
    }
    setDeleting(null);
  }, [scenarios]);

  const handleClearAll = useCallback(async () => {
    if (!confirm("Are you sure you want to delete ALL saved scenarios? This cannot be undone.")) return;
    const token = getAccessToken();
    if (!token) return;
    const prev = scenarios;
    const ids = prev.map((s) => s.id);
    setScenarios([]);
    for (const id of ids) {
      try {
        await fetch(`/api/calculator-scenarios/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {}
    }
  }, [scenarios]);

  // Filters
  const uniqueTypes = [...new Set(scenarios.map((s) => s.calculatorType))].sort();
  const query = search.toLowerCase().trim();
  const filtered = scenarios.filter((s) => {
    if (typeFilter !== "All" && s.calculatorType !== typeFilter) return false;
    if (query && !(s.scenarioName || "").toLowerCase().includes(query)) return false;
    return true;
  });

  // Stats
  const totalCount = scenarios.length;
  const typeCount = uniqueTypes.length;
  const storageUsed = estimateSize(scenarios);

  if (!isLoggedIn()) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh", padding: "24px 0" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 20px" }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: C.radius, padding: 40, textAlign: "center" }}>
            <i className="fa-solid fa-right-to-bracket" style={{ fontSize: 36, color: C.dim, marginBottom: 16 }} />
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: "0 0 8px" }}>Sign In Required</h2>
            <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>Please sign in to view your saved scenarios.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, minHeight: "100vh", padding: "24px 0" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 20px" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: 0 }}>
              <i className="fa-solid fa-bookmark" style={{ color: C.blue, marginRight: 10 }} />
              Saved Scenarios
            </h1>
            <p style={{ fontSize: 14, color: C.muted, margin: "6px 0 0" }}>View and manage all your saved calculator scenarios</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={fetchScenarios}
              disabled={loading}
              style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}
            >
              <i className={`fa-solid fa-arrows-rotate ${loading ? "fa-spin" : ""}`} /> Refresh
            </button>
            {scenarios.length > 0 && (
              <button
                onClick={handleClearAll}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #FECACA", background: C.redBg, color: C.red, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}
              >
                <i className="fa-solid fa-trash-can" /> Clear All
              </button>
            )}
          </div>
        </div>

        {/* ── Stats Bar ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
          <StatCard icon="fa-solid fa-bookmark" label="Total Scenarios" value={totalCount} color={C.blue} />
          <StatCard icon="fa-solid fa-calculator" label="Calculator Types" value={typeCount} color="#7C3AED" />
          <StatCard icon="fa-solid fa-database" label="Storage Used" value={storageUsed} color="#059669" />
        </div>

        {/* ── Search & Filter ── */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
            <i className="fa-solid fa-magnifying-glass" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.dim, fontSize: 13 }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search scenarios by name..."
              style={{ width: "100%", padding: "10px 14px 10px 38px", border: `1px solid ${C.border}`, borderRadius: C.radius, fontSize: 14, fontFamily: "inherit", background: C.card, color: C.text, outline: "none", boxSizing: "border-box" }}
              onFocus={(e) => { e.target.style.borderColor = C.blue; }}
              onBlur={(e) => { e.target.style.borderColor = C.border; }}
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{ padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: C.radius, fontSize: 14, fontFamily: "inherit", background: C.card, color: C.text, cursor: "pointer", minWidth: 200 }}
          >
            <option value="All">All Calculator Types</option>
            {uniqueTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{ background: C.redBg, border: "1px solid #FECACA", borderRadius: C.radius, padding: "16px 20px", color: "#991B1B", fontSize: 14, marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
            <i className="fa-solid fa-circle-exclamation" />
            {error}
            <button onClick={fetchScenarios} style={{ marginLeft: "auto", background: "none", border: "none", color: C.blue, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Retry</button>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: C.radius, padding: 20, height: 80, animation: "ld-shimmer 1.5s infinite", backgroundImage: "linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)", backgroundSize: "200% 100%" }} />
            ))}
            <style>{`@keyframes ld-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>
          </div>
        )}

        {/* ── Empty State ── */}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: C.radius, padding: "60px 20px", textAlign: "center" }}>
            <i className="fa-solid fa-bookmark" style={{ fontSize: 48, color: C.dim, marginBottom: 16 }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: "0 0 8px" }}>
              {query || typeFilter !== "All" ? "No Matching Scenarios" : "No Saved Scenarios"}
            </h3>
            <p style={{ fontSize: 14, color: C.muted, margin: "0 0 20px", maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>
              {query || typeFilter !== "All"
                ? "No scenarios match your current filters. Try adjusting your search or filter."
                : "You haven't saved any calculator scenarios yet. Start by using any calculator and clicking the Save button."}
            </p>
            {!query && typeFilter === "All" && (
              <Link
                to="/app/calculators"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", background: C.blue, color: "#FFFFFF", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none" }}
              >
                <i className="fa-solid fa-calculator" /> Go to Calculators
              </Link>
            )}
          </div>
        )}

        {/* ── Scenario Cards ── */}
        {!loading && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((s) => {
              const icon = CALC_TYPE_ICONS[s.calculatorType] || "fa-solid fa-calculator";
              const color = CALC_TYPE_COLORS[s.calculatorType] || C.blue;
              return (
                <div
                  key={s.id}
                  style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: C.radius, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, transition: "border-color 0.15s, box-shadow 0.15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#93C5FD"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(37,99,235,0.08)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = "none"; }}
                >
                  {/* Icon */}
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: color + "15", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <i className={icon} style={{ fontSize: 18, color: color }} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {s.scenarioName || "Untitled Scenario"}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 100, background: color + "15", color: color }}>
                        {s.calculatorType}
                      </span>
                      <span style={{ fontSize: 12, color: C.dim }}>
                        {formatDate(s.dateCreated)}
                      </span>
                    </div>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(s.id)}
                    disabled={deleting === s.id}
                    title="Delete scenario"
                    style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.dim, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.redBg; e.currentTarget.style.color = C.red; e.currentTarget.style.borderColor = "#FECACA"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = C.card; e.currentTarget.style.color = C.dim; e.currentTarget.style.borderColor = C.border; }}
                  >
                    <i className={deleting === s.id ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-trash-can"} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: C.radius, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: color + "15", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <i className={icon} style={{ fontSize: 16, color: color }} />
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.dim, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}

import { useState, useMemo } from "react";
import { Link } from "react-router";

export function meta() {
  return [{ title: "Lender Pricing Comparison — MtgBroker" }];
}

/* ── Helpers ── */
const fmt = (v) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
const fmtDec = (v) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const fmtPct = (v) => v.toFixed(3) + "%";

function calcMonthlyPI(principal, annualRate, termYears) {
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return principal / n;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

/* blank lender template */
function blankLender(idx) {
  return {
    id: Date.now() + idx,
    name: `Lender ${idx + 1}`,
    rate: 6.75,
    points: 0, // negative = rebate, positive = cost
    compBps: 275,
  };
}

export default function LenderPricingComparison() {
  const [loanAmount, setLoanAmount] = useState(350000);
  const [termYears, setTermYears] = useState(30);
  const [lenders, setLenders] = useState([blankLender(0), blankLender(1)]);

  const updateLender = (id, field, value) => {
    setLenders((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const addLender = () => {
    if (lenders.length >= 4) return;
    setLenders((prev) => [...prev, blankLender(prev.length)]);
  };

  const removeLender = (id) => {
    if (lenders.length <= 2) return;
    setLenders((prev) => prev.filter((l) => l.id !== id));
  };

  // Computed results for each lender
  const results = useMemo(() => {
    return lenders.map((l) => {
      const monthlyPI = calcMonthlyPI(loanAmount, l.rate, termYears);
      const pointsCost = (l.points / 100) * loanAmount; // points as % of loan
      const compDollars = (l.compBps / 10000) * loanAmount;
      const totalInterest = monthlyPI * termYears * 12 - loanAmount;
      // Effective rate: rate adjusted for points cost amortized over term
      // Simple approach: add points cost to total interest, back-solve for rate
      const totalCostWithPoints = totalInterest + pointsCost;
      const effectiveRate = ((totalCostWithPoints / (loanAmount * termYears)) * 100).toFixed(3);

      return {
        ...l,
        monthlyPI,
        pointsCost,
        compDollars,
        totalInterest,
        effectiveRate: Number(effectiveRate),
      };
    });
  }, [lenders, loanAmount, termYears]);

  // Find best (lowest effective rate)
  const bestIdx = results.reduce((best, r, i) => (r.effectiveRate < results[best].effectiveRate ? i : best), 0);
  // Find lowest monthly payment
  const lowestPmtIdx = results.reduce((best, r, i) => (r.monthlyPI < results[best].monthlyPI ? i : best), 0);

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-slate-500 mb-4 flex-wrap">
        <Link to="/app/calculators" className="text-[#2563EB] no-underline font-medium hover:underline">
          <i className="fa-solid fa-arrow-left mr-1 text-[11px]" />
          Calculators
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-900 font-semibold">Lender Pricing Comparison</span>
      </nav>

      {/* Header */}
      <div className="flex items-start gap-5 mb-8 pb-6 border-b border-slate-200">
        <div
          className="w-14 h-14 min-w-[56px] rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)", boxShadow: "0 4px 12px rgba(37,99,235,0.25)" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
        </div>
        <div>
          <h1 className="text-[28px] font-extrabold text-slate-900 mb-1" style={{ letterSpacing: "-0.5px" }}>Lender Pricing Comparison</h1>
          <p className="text-[15px] text-slate-500 leading-normal">Compare rates, pricing, and compensation across multiple wholesale lenders side-by-side.</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8">
        {/* Left: Inputs */}
        <div className="space-y-6">
          {/* Global inputs */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <h2 className="text-base font-bold text-slate-800 mb-2">Loan Details</h2>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Loan Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input type="number" value={loanAmount} onChange={(e) => setLoanAmount(Number(e.target.value))} className="w-full border border-slate-300 rounded-lg py-2 pl-7 pr-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Term (years)</label>
              <select value={termYears} onChange={(e) => setTermYears(Number(e.target.value))} className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white">
                <option value={30}>30 years</option>
                <option value={25}>25 years</option>
                <option value={20}>20 years</option>
                <option value={15}>15 years</option>
                <option value={10}>10 years</option>
              </select>
            </div>
          </div>

          {/* Per-lender inputs */}
          {lenders.map((l, i) => (
            <div key={l.id} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-slate-800">Lender {i + 1}</h3>
                {lenders.length > 2 && (
                  <button onClick={() => removeLender(l.id)} className="text-xs text-red-500 hover:text-red-700 bg-transparent border-none cursor-pointer font-medium">
                    Remove
                  </button>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Lender Name</label>
                <input type="text" value={l.name} onChange={(e) => updateLender(l.id, "name", e.target.value)} className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Rate (%)</label>
                  <input type="number" step="0.125" value={l.rate} onChange={(e) => updateLender(l.id, "rate", Number(e.target.value))} className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Points</label>
                  <input type="number" step="0.125" value={l.points} onChange={(e) => updateLender(l.id, "points", Number(e.target.value))} className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Comp (bps)</label>
                  <input type="number" step="1" value={l.compBps} onChange={(e) => updateLender(l.id, "compBps", Number(e.target.value))} className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
              </div>
            </div>
          ))}

          {lenders.length < 4 && (
            <button
              onClick={addLender}
              className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 text-sm font-semibold text-slate-500 hover:border-[#2563EB] hover:text-[#2563EB] transition-colors bg-transparent cursor-pointer"
            >
              + Add Lender
            </button>
          )}
        </div>

        {/* Right: Comparison Table */}
        <div>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">Side-by-Side Comparison</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-3">Metric</th>
                    {results.map((r, i) => (
                      <th key={r.id} className="px-6 py-3 text-center min-w-[140px]">
                        <div className="flex items-center justify-center gap-1.5">
                          {r.name}
                          {i === bestIdx && (
                            <span className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded" style={{ background: "#059669" }}>BEST</span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <CompRow label="Interest Rate" values={results.map((r) => fmtPct(r.rate))} bestIdx={lowestPmtIdx} />
                  <CompRow label="Points / Price" values={results.map((r) => (r.points >= 0 ? `+${r.points}` : String(r.points)))} />
                  <CompRow label="Points Cost ($)" values={results.map((r) => r.pointsCost >= 0 ? fmt(r.pointsCost) : `-${fmt(Math.abs(r.pointsCost))}`)} />
                  <CompRow label="Monthly P&I" values={results.map((r) => fmtDec(r.monthlyPI))} bestIdx={lowestPmtIdx} />
                  <CompRow label="Comp Rate" values={results.map((r) => `${r.compBps} bps`)} />
                  <CompRow label="Comp ($)" values={results.map((r) => fmt(r.compDollars))} />
                  <CompRow label="Total Interest" values={results.map((r) => fmt(r.totalInterest))} />
                  <CompRow label="Effective Rate" values={results.map((r) => fmtPct(r.effectiveRate))} bestIdx={bestIdx} highlight />
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          <div className="mt-4 text-xs text-slate-400 px-2 space-y-1">
            <p>Points: negative = rebate/credit, positive = cost to borrower.</p>
            <p>Effective Rate accounts for points cost amortized over the full loan term.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Comparison row ── */
function CompRow({ label, values, bestIdx = -1, highlight = false }) {
  return (
    <tr className={`border-t border-slate-100 ${highlight ? "bg-blue-50/50" : "hover:bg-slate-50/50"}`}>
      <td className={`px-6 py-3 font-medium ${highlight ? "text-[#2563EB] font-bold" : "text-slate-700"}`}>{label}</td>
      {values.map((v, i) => (
        <td
          key={i}
          className={`px-6 py-3 text-center ${
            i === bestIdx ? "font-bold text-green-700" :
            highlight ? "font-bold text-[#2563EB]" :
            "text-slate-700"
          }`}
        >
          {v}
          {i === bestIdx && !highlight && (
            <span className="ml-1 text-[10px] text-green-600">
              <i className="fa-solid fa-trophy text-[9px]" />
            </span>
          )}
        </td>
      ))}
    </tr>
  );
}

import { useState, useMemo } from "react";
import { Link } from "react-router";

export function meta() {
  return [{ title: "Loan Scenario Comparison — MtgBroker" }];
}

/* ── Helpers ── */
const fmt = (v) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
const fmtDec = (v) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

function calcMonthlyPI(principal, annualRate, termYears) {
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return principal / n;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function blankScenario(idx) {
  return {
    id: Date.now() + idx,
    label: `Scenario ${idx + 1}`,
    loanAmount: 350000,
    rate: 6.75,
    term: 30,
    downPayment: 50000,
    monthlyInsurance: 150,
    monthlyTax: 417,
    monthlyHOA: 0,
    monthlyPMI: 0,
    closingCosts: 8000,
  };
}

export default function LoanScenarioComparison() {
  const [scenarios, setScenarios] = useState([blankScenario(0), blankScenario(1)]);

  const updateScenario = (id, field, value) => {
    setScenarios((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const addScenario = () => {
    if (scenarios.length >= 6) return;
    setScenarios((prev) => [...prev, blankScenario(prev.length)]);
  };

  const removeScenario = (id) => {
    if (scenarios.length <= 2) return;
    setScenarios((prev) => prev.filter((s) => s.id !== id));
  };

  // Compute results
  const results = useMemo(() => {
    return scenarios.map((s) => {
      const monthlyPI = calcMonthlyPI(s.loanAmount, s.rate, s.term);
      // PITI: Insurance listed before Tax
      const monthlyPITI = monthlyPI + s.monthlyInsurance + s.monthlyTax + s.monthlyHOA + s.monthlyPMI;
      const totalPayments = monthlyPI * s.term * 12;
      const totalInterest = totalPayments - s.loanAmount;
      const totalCost = totalPayments + (s.monthlyInsurance + s.monthlyTax + s.monthlyHOA + s.monthlyPMI) * s.term * 12 + s.closingCosts;
      const cashToClose = s.downPayment + s.closingCosts;
      return { ...s, monthlyPI, monthlyPITI, totalInterest, totalCost, cashToClose };
    });
  }, [scenarios]);

  // Find lowest monthly payment and lowest total cost
  const lowestPmtIdx = results.reduce((b, r, i) => (r.monthlyPITI < results[b].monthlyPITI ? i : b), 0);
  const lowestCostIdx = results.reduce((b, r, i) => (r.totalCost < results[b].totalCost ? i : b), 0);

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-slate-500 mb-4 flex-wrap">
        <Link to="/app/calculators" className="text-[#2563EB] no-underline font-medium hover:underline">
          <i className="fa-solid fa-arrow-left mr-1 text-[11px]" />
          Calculators
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-900 font-semibold">Loan Scenario Comparison</span>
      </nav>

      {/* Header */}
      <div className="flex items-start gap-5 mb-8 pb-6 border-b border-slate-200">
        <div
          className="w-14 h-14 min-w-[56px] rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)", boxShadow: "0 4px 12px rgba(37,99,235,0.25)" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
            <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18" />
          </svg>
        </div>
        <div>
          <h1 className="text-[28px] font-extrabold text-slate-900 mb-1" style={{ letterSpacing: "-0.5px" }}>Loan Scenario Comparison</h1>
          <p className="text-[15px] text-slate-500 leading-normal">Compare up to 6 loan options side-by-side to find the best fit for your client.</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8">
        {/* Left: Scenario inputs */}
        <div className="space-y-5">
          {scenarios.map((s, i) => (
            <div key={s.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: i === lowestPmtIdx ? "#059669" : i === lowestCostIdx ? "#2563EB" : "#64748B" }}
                  >
                    {i + 1}
                  </div>
                  <input
                    type="text"
                    value={s.label}
                    onChange={(e) => updateScenario(s.id, "label", e.target.value)}
                    className="text-sm font-bold text-slate-800 border-none outline-none bg-transparent w-[160px]"
                    placeholder="Scenario name"
                  />
                </div>
                {scenarios.length > 2 && (
                  <button onClick={() => removeScenario(s.id)} className="text-xs text-red-500 hover:text-red-700 bg-transparent border-none cursor-pointer font-medium">
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <InputField label="Loan Amount" value={s.loanAmount} onChange={(v) => updateScenario(s.id, "loanAmount", v)} prefix="$" />
                <InputField label="Rate (%)" value={s.rate} onChange={(v) => updateScenario(s.id, "rate", v)} prefix="%" step={0.125} />
                <InputField label="Term (yrs)" value={s.term} onChange={(v) => updateScenario(s.id, "term", v)} prefix="" />
                <InputField label="Down Payment" value={s.downPayment} onChange={(v) => updateScenario(s.id, "downPayment", v)} prefix="$" />
                <InputField label="Mo. Insurance" value={s.monthlyInsurance} onChange={(v) => updateScenario(s.id, "monthlyInsurance", v)} prefix="$" />
                <InputField label="Mo. Tax" value={s.monthlyTax} onChange={(v) => updateScenario(s.id, "monthlyTax", v)} prefix="$" />
                <InputField label="Mo. HOA" value={s.monthlyHOA} onChange={(v) => updateScenario(s.id, "monthlyHOA", v)} prefix="$" />
                <InputField label="Mo. PMI" value={s.monthlyPMI} onChange={(v) => updateScenario(s.id, "monthlyPMI", v)} prefix="$" />
              </div>
              <InputField label="Closing Costs" value={s.closingCosts} onChange={(v) => updateScenario(s.id, "closingCosts", v)} prefix="$" />
            </div>
          ))}

          {scenarios.length < 6 && (
            <button
              onClick={addScenario}
              className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 text-sm font-semibold text-slate-500 hover:border-[#2563EB] hover:text-[#2563EB] transition-colors bg-transparent cursor-pointer"
            >
              + Add Scenario
            </button>
          )}
        </div>

        {/* Right: Comparison */}
        <div className="space-y-6">
          {/* Highlight cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border-2 border-green-500 bg-green-50 p-5" style={{ boxShadow: "0 4px 12px rgba(5,150,105,0.1)" }}>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Lowest Monthly Payment</div>
              <div className="text-2xl font-extrabold text-green-700">{fmtDec(results[lowestPmtIdx].monthlyPITI)}</div>
              <div className="text-sm text-green-600 mt-0.5">{results[lowestPmtIdx].label}</div>
            </div>
            <div className="rounded-2xl border-2 border-[#2563EB] bg-blue-50 p-5" style={{ boxShadow: "0 4px 12px rgba(37,99,235,0.1)" }}>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Lowest Total Cost</div>
              <div className="text-2xl font-extrabold text-[#2563EB]">{fmt(results[lowestCostIdx].totalCost)}</div>
              <div className="text-sm text-blue-600 mt-0.5">{results[lowestCostIdx].label}</div>
            </div>
          </div>

          {/* Comparison table */}
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
                      <th key={r.id} className="px-5 py-3 text-center min-w-[130px]">
                        <span className={i === lowestPmtIdx ? "text-green-700" : i === lowestCostIdx ? "text-[#2563EB]" : ""}>
                          {r.label}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <CRow label="Loan Amount" values={results.map((r) => fmt(r.loanAmount))} />
                  <CRow label="Rate" values={results.map((r) => r.rate.toFixed(3) + "%")} />
                  <CRow label="Term" values={results.map((r) => r.term + " yrs")} />
                  <CRow label="Monthly P&I" values={results.map((r) => fmtDec(r.monthlyPI))} />
                  <CRow label="Mo. Insurance" values={results.map((r) => fmt(r.monthlyInsurance))} />
                  <CRow label="Mo. Tax" values={results.map((r) => fmt(r.monthlyTax))} />
                  <CRow label="Mo. HOA" values={results.map((r) => fmt(r.monthlyHOA))} />
                  <CRow label="Mo. PMI" values={results.map((r) => fmt(r.monthlyPMI))} />
                  <CRow
                    label="Monthly PITI"
                    values={results.map((r) => fmtDec(r.monthlyPITI))}
                    bestIdx={lowestPmtIdx}
                    highlight
                    highlightColor="green"
                  />
                  <CRow label="Total Interest" values={results.map((r) => fmt(r.totalInterest))} />
                  <CRow
                    label="Total Cost"
                    values={results.map((r) => fmt(r.totalCost))}
                    bestIdx={lowestCostIdx}
                    highlight
                    highlightColor="blue"
                  />
                  <CRow label="Cash to Close" values={results.map((r) => fmt(r.cashToClose))} />
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Small input field ── */
function InputField({ label, value, onChange, prefix = "$", step = 1 }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          step={step}
          className="w-full border border-slate-300 rounded-lg py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          style={{ paddingLeft: prefix ? 24 : 10, paddingRight: 8 }}
        />
      </div>
    </div>
  );
}

/* ── Comparison row ── */
function CRow({ label, values, bestIdx = -1, highlight = false, highlightColor = "green" }) {
  const isGreen = highlightColor === "green";
  return (
    <tr className={`border-t border-slate-100 ${highlight ? (isGreen ? "bg-green-50/50" : "bg-blue-50/50") : "hover:bg-slate-50/50"}`}>
      <td className={`px-6 py-3 font-medium ${highlight ? (isGreen ? "text-green-800 font-bold" : "text-[#2563EB] font-bold") : "text-slate-700"}`}>{label}</td>
      {values.map((v, i) => (
        <td
          key={i}
          className={`px-5 py-3 text-center ${
            i === bestIdx ? (isGreen ? "font-bold text-green-700" : "font-bold text-[#2563EB]") :
            highlight ? (isGreen ? "font-semibold text-green-700" : "font-semibold text-[#2563EB]") :
            "text-slate-700"
          }`}
        >
          {v}
          {i === bestIdx && <span className="ml-1 text-[10px]"><i className="fa-solid fa-trophy text-[9px]" /></span>}
        </td>
      ))}
    </tr>
  );
}

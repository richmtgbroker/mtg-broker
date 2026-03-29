import { useState, useMemo } from "react";
import { Link } from "react-router";

export function meta() {
  return [{ title: "Refinance Analysis — MtgBroker" }];
}

/* ── Helpers ── */

// Calculate monthly P&I payment
function calcPI(principal, annualRate, termYears) {
  if (principal <= 0 || annualRate <= 0 || termYears <= 0) return 0;
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

// Calculate total interest over the life of the loan
function calcTotalInterest(principal, monthlyPayment, termMonths) {
  if (monthlyPayment <= 0 || termMonths <= 0) return 0;
  return monthlyPayment * termMonths - principal;
}

// Format currency
function fmtCurrency(n) {
  if (n == null || isNaN(n)) return "--";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtCurrency2(n) {
  if (n == null || isNaN(n)) return "--";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function fmtMonths(m) {
  if (m == null || isNaN(m) || m <= 0 || !isFinite(m)) return "--";
  const months = Math.ceil(m);
  if (months < 12) return `${months} month${months !== 1 ? "s" : ""}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} year${years !== 1 ? "s" : ""}`;
  return `${years}y ${rem}m`;
}

/* ── Styled input component ── */
function InputField({ label, value, onChange, type = "number", step, prefix, suffix, placeholder, children }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
      {children ? children : (
        <div className="relative">
          {prefix && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium pointer-events-none">{prefix}</span>
          )}
          <input
            type={type}
            step={step}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
            style={prefix ? { paddingLeft: "28px" } : suffix ? { paddingRight: "28px" } : {}}
          />
          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium pointer-events-none">{suffix}</span>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Result row ── */
function ResultRow({ label, value, subtext, highlight, bold, large }) {
  return (
    <div className={`flex items-center justify-between py-2.5 ${bold ? "border-t border-slate-200 mt-1 pt-3" : ""}`}>
      <span className={`text-sm ${bold ? "font-semibold text-slate-800" : "text-slate-500"}`}>{label}</span>
      <div className="text-right">
        <span className={`
          ${large ? "text-xl" : bold ? "text-base" : "text-sm"}
          ${bold ? "font-bold" : "font-semibold"}
          ${highlight === "green" ? "text-emerald-600" : highlight === "red" ? "text-red-600" : highlight === "blue" ? "text-[#2563EB]" : "text-slate-800"}
        `}>
          {value}
        </span>
        {subtext && <div className="text-xs text-slate-400 mt-0.5">{subtext}</div>}
      </div>
    </div>
  );
}

/* ── Badge component for break-even period ── */
function BreakEvenBadge({ months }) {
  if (months == null || isNaN(months) || months <= 0 || !isFinite(months)) return null;
  const m = Math.ceil(months);
  let color, bg, label;
  if (m <= 24) {
    color = "#16A34A"; bg = "#DCFCE7"; label = "Excellent";
  } else if (m <= 36) {
    color = "#2563EB"; bg = "#DBEAFE"; label = "Good";
  } else if (m <= 60) {
    color = "#D97706"; bg = "#FEF3C7"; label = "Consider Carefully";
  } else {
    color = "#DC2626"; bg = "#FEE2E2"; label = "Long Recoup";
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold" style={{ background: bg, color }}>
      {label}
    </span>
  );
}

/* ── Main Component ── */
export default function RefiAnalysisCalculator() {
  // Current loan inputs
  const [currentBalance, setCurrentBalance] = useState("300000");
  const [currentRate, setCurrentRate] = useState("7.25");
  const [currentRemaining, setCurrentRemaining] = useState("27");
  const [currentPIOverride, setCurrentPIOverride] = useState("");

  // New loan inputs
  const [newLoanAmount, setNewLoanAmount] = useState("300000");
  const [newRate, setNewRate] = useState("6.25");
  const [newTerm, setNewTerm] = useState("30");
  const [closingCosts, setClosingCosts] = useState("6000");
  const [cashOut, setCashOut] = useState("0");

  // Calculations
  const results = useMemo(() => {
    const curBal = parseFloat(currentBalance) || 0;
    const curRate = parseFloat(currentRate) || 0;
    const curRemYears = parseFloat(currentRemaining) || 0;
    const curRemMonths = curRemYears * 12;

    const newAmt = parseFloat(newLoanAmount) || 0;
    const nRate = parseFloat(newRate) || 0;
    const nTermYears = parseFloat(newTerm) || 0;
    const nTermMonths = nTermYears * 12;

    const cc = parseFloat(closingCosts) || 0;
    const co = parseFloat(cashOut) || 0;

    // Current monthly P&I (auto-calculated or override)
    const autoCurrentPI = calcPI(curBal, curRate, curRemYears);
    const overridePI = parseFloat(currentPIOverride);
    const currentPI = overridePI > 0 ? overridePI : autoCurrentPI;

    // New monthly P&I
    const newPI = calcPI(newAmt, nRate, nTermYears);

    // Monthly savings
    const monthlySavings = currentPI - newPI;

    // Break-even (months)
    const breakEven = monthlySavings > 0 ? cc / monthlySavings : null;

    // Total interest on current path (remaining payments)
    const currentTotalInterest = curRemMonths > 0 ? (currentPI * curRemMonths) - curBal : 0;

    // Total interest on new path
    const newTotalInterest = nTermMonths > 0 ? (newPI * nTermMonths) - newAmt : 0;

    // Interest savings (current path interest minus new path interest minus closing costs)
    const interestSavings = currentTotalInterest - newTotalInterest;

    // Lifetime savings (monthly savings x remaining months on new loan - closing costs)
    // Use the shorter of: current remaining months or new term months for comparison
    const comparisonMonths = nTermMonths;
    const lifetimeSavings = (monthlySavings * comparisonMonths) - cc;

    // Total cost of each path
    const currentTotalCost = currentPI * curRemMonths;
    const newTotalCost = (newPI * nTermMonths) + cc;

    return {
      currentPI,
      autoCurrentPI,
      newPI,
      monthlySavings,
      breakEven,
      currentTotalInterest,
      newTotalInterest,
      interestSavings,
      lifetimeSavings,
      currentTotalCost,
      newTotalCost,
      curRemMonths,
      nTermMonths,
      cc,
      co,
    };
  }, [currentBalance, currentRate, currentRemaining, currentPIOverride, newLoanAmount, newRate, newTerm, closingCosts, cashOut]);

  const savingsPositive = results.monthlySavings > 0;

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-400 mb-6">
        <Link to="/app/calculators" className="text-[#2563EB] hover:underline font-medium">Calculators</Link>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><polyline points="9 18 15 12 9 6" /></svg>
        <span className="text-slate-600 font-medium">Refinance Analysis</span>
      </nav>

      {/* Header */}
      <div className="flex items-start gap-5 mb-8 pb-6 border-b border-slate-200">
        <div className="w-14 h-14 min-w-[56px] rounded-2xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)", boxShadow: "0 4px 12px rgba(37,99,235,0.25)" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 21h5v-5" />
          </svg>
        </div>
        <div>
          <h1 className="text-[28px] font-extrabold text-slate-900 mb-1" style={{ letterSpacing: "-0.5px" }}>Refinance Analysis</h1>
          <p className="text-[15px] text-slate-500 leading-normal">Compare your current loan against a refinance option. See monthly savings, break-even period, and lifetime cost comparison.</p>
        </div>
      </div>

      {/* Two-column inputs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Current Loan */}
        <div className="bg-white border border-slate-200 rounded-xl p-6" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#FEF3C7" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-800">Current Loan</h2>
          </div>

          <InputField label="Current Loan Balance" value={currentBalance} onChange={(e) => setCurrentBalance(e.target.value)} prefix="$" placeholder="300,000" />
          <InputField label="Current Interest Rate" value={currentRate} onChange={(e) => setCurrentRate(e.target.value)} suffix="%" step="0.01" placeholder="7.25" />
          <InputField label="Remaining Term (years)" value={currentRemaining} onChange={(e) => setCurrentRemaining(e.target.value)} placeholder="27" />
          <InputField label="Current Monthly P&I">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium pointer-events-none">$</span>
              <input
                type="number"
                value={currentPIOverride}
                onChange={(e) => setCurrentPIOverride(e.target.value)}
                placeholder={results.autoCurrentPI > 0 ? results.autoCurrentPI.toFixed(2) : "Auto-calculated"}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
                style={{ paddingLeft: "28px" }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">Leave blank to auto-calculate, or enter to override</p>
          </InputField>

          {/* Current loan summary */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Monthly P&I</span>
              <span className="font-semibold text-slate-800">{fmtCurrency2(results.currentPI)}</span>
            </div>
          </div>
        </div>

        {/* New Loan */}
        <div className="bg-white border border-slate-200 rounded-xl p-6" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#DBEAFE" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-800">New Loan</h2>
          </div>

          <InputField label="New Loan Amount" value={newLoanAmount} onChange={(e) => setNewLoanAmount(e.target.value)} prefix="$" placeholder="300,000" />
          <InputField label="New Interest Rate" value={newRate} onChange={(e) => setNewRate(e.target.value)} suffix="%" step="0.01" placeholder="6.25" />
          <InputField label="New Loan Term">
            <select
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
            >
              <option value="15">15 years</option>
              <option value="20">20 years</option>
              <option value="25">25 years</option>
              <option value="30">30 years</option>
            </select>
          </InputField>
          <InputField label="Closing Costs" value={closingCosts} onChange={(e) => setClosingCosts(e.target.value)} prefix="$" placeholder="6,000" />
          <InputField label="Cash Out Amount" value={cashOut} onChange={(e) => setCashOut(e.target.value)} prefix="$" placeholder="0" />

          {/* New loan summary */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">New Monthly P&I</span>
              <span className="font-semibold text-[#2563EB]">{fmtCurrency2(results.newPI)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Monthly Savings Card */}
        <div className={`rounded-xl border p-6 ${savingsPositive ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
          <div className="text-sm font-medium text-slate-500 mb-1">Monthly Savings</div>
          <div className={`text-3xl font-extrabold ${savingsPositive ? "text-emerald-600" : "text-red-600"}`}>
            {fmtCurrency2(Math.abs(results.monthlySavings))}
          </div>
          <div className={`text-sm mt-1 ${savingsPositive ? "text-emerald-500" : "text-red-500"}`}>
            {savingsPositive ? "per month saved" : "per month increase"}
          </div>
        </div>

        {/* Break-Even Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="text-sm font-medium text-slate-500 mb-1">Break-Even Period</div>
          <div className="text-3xl font-extrabold text-slate-800">
            {fmtMonths(results.breakEven)}
          </div>
          <div className="mt-2">
            <BreakEvenBadge months={results.breakEven} />
          </div>
        </div>

        {/* Lifetime Savings Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="text-sm font-medium text-slate-500 mb-1">Net Lifetime Savings</div>
          <div className={`text-3xl font-extrabold ${results.lifetimeSavings >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {fmtCurrency(Math.abs(results.lifetimeSavings))}
          </div>
          <div className="text-xs text-slate-400 mt-1">Over {parseFloat(newTerm) || 0}-year new term, minus closing costs</div>
        </div>
      </div>

      {/* Side-by-Side Comparison Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-8" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-base font-bold text-slate-800">Side-by-Side Comparison</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-6 py-3 text-slate-500 font-semibold w-1/3"></th>
                <th className="text-right px-6 py-3 text-slate-500 font-semibold">Current Loan</th>
                <th className="text-right px-6 py-3 text-[#2563EB] font-semibold">New Loan</th>
                <th className="text-right px-6 py-3 text-slate-500 font-semibold">Difference</th>
              </tr>
            </thead>
            <tbody>
              <CompareRow
                label="Loan Amount"
                current={fmtCurrency(parseFloat(currentBalance) || 0)}
                newVal={fmtCurrency(parseFloat(newLoanAmount) || 0)}
                diff={fmtCurrency((parseFloat(newLoanAmount) || 0) - (parseFloat(currentBalance) || 0))}
              />
              <CompareRow
                label="Interest Rate"
                current={`${currentRate || 0}%`}
                newVal={`${newRate || 0}%`}
                diff={`${((parseFloat(newRate) || 0) - (parseFloat(currentRate) || 0)).toFixed(2)}%`}
                highlight={(parseFloat(newRate) || 0) < (parseFloat(currentRate) || 0)}
              />
              <CompareRow
                label="Loan Term"
                current={`${currentRemaining || 0} years`}
                newVal={`${newTerm || 0} years`}
                diff={`${((parseFloat(newTerm) || 0) - (parseFloat(currentRemaining) || 0)).toFixed(0)} years`}
              />
              <CompareRow
                label="Monthly P&I"
                current={fmtCurrency2(results.currentPI)}
                newVal={fmtCurrency2(results.newPI)}
                diff={fmtCurrency2(results.monthlySavings)}
                highlight={results.monthlySavings > 0}
                bold
              />
              <CompareRow
                label="Total Interest"
                current={fmtCurrency(results.currentTotalInterest)}
                newVal={fmtCurrency(results.newTotalInterest)}
                diff={fmtCurrency(results.interestSavings)}
                highlight={results.interestSavings > 0}
              />
              <CompareRow
                label="Total Cost"
                current={fmtCurrency(results.currentTotalCost)}
                newVal={fmtCurrency(results.newTotalCost)}
                diff={fmtCurrency(results.currentTotalCost - results.newTotalCost)}
                highlight={results.currentTotalCost > results.newTotalCost}
                bold
              />
            </tbody>
          </table>
        </div>
        {results.cc > 0 && (
          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-400">
            * New loan total cost includes {fmtCurrency(results.cc)} in closing costs.
            {results.co > 0 && ` Cash out amount: ${fmtCurrency(results.co)}.`}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-slate-400 text-center leading-relaxed">
        This calculator provides estimates for comparison purposes only. Actual rates, payments, and costs may vary.
        Consult with a licensed mortgage professional for personalized advice. Does not include taxes, insurance, or MI.
      </p>
    </div>
  );
}

/* ── Comparison table row ── */
function CompareRow({ label, current, newVal, diff, highlight, bold }) {
  return (
    <tr className="border-b border-slate-50 last:border-b-0">
      <td className={`px-6 py-3 ${bold ? "font-semibold text-slate-800" : "text-slate-600"}`}>{label}</td>
      <td className="px-6 py-3 text-right font-medium text-slate-700">{current}</td>
      <td className="px-6 py-3 text-right font-medium text-[#2563EB]">{newVal}</td>
      <td className={`px-6 py-3 text-right font-semibold ${highlight ? "text-emerald-600" : "text-slate-500"}`}>{diff}</td>
    </tr>
  );
}

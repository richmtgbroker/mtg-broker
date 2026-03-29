import { useState, useMemo } from "react";
import { Link } from "react-router";

export function meta() {
  return [{ title: "DSCR Calculator — MtgBroker" }];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Format number as currency */
function fmt(n) {
  if (n == null || isNaN(n)) return "$0";
  return "$" + Math.round(n).toLocaleString("en-US");
}

/** Format to 2 decimal places */
function fmt2(n) {
  if (n == null || isNaN(n)) return "0.00";
  return n.toFixed(2);
}

/** Parse a numeric input — returns 0 for empty/NaN */
function num(v) {
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
}

// ── Input Field Component ────────────────────────────────────────────────────

function InputField({ label, value, onChange, prefix, suffix, step, min, max, helpText }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          step={step || "any"}
          min={min}
          max={max}
          className={[
            "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
            "transition-colors",
            prefix ? "pl-7" : "",
            suffix ? "pr-10" : "",
          ].join(" ")}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {helpText && <p className="mt-1 text-xs text-gray-400">{helpText}</p>}
    </div>
  );
}

// ── Toggle Component ─────────────────────────────────────────────────────────

function Toggle({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold text-gray-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={[
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
          checked ? "bg-blue-600" : "bg-gray-300",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm",
            checked ? "translate-x-6" : "translate-x-1",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

// ── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({ title, icon, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      {title && (
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
          {icon && (
            <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5 shrink-0" style={{ width: 18, height: 18 }}>
              {icon}
            </svg>
          )}
          <h3 className="text-sm font-bold text-gray-800">{title}</h3>
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

// ── Result Row ───────────────────────────────────────────────────────────────

function ResultRow({ label, value, sub, bold, color }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className={`text-sm ${bold ? "font-semibold text-gray-800" : "text-gray-600"}`}>{label}</span>
      <div className="text-right">
        <span className={`text-sm font-semibold ${color || "text-gray-900"}`}>{value}</span>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function DSCRCalculator() {
  // ── State: Income ──
  const [monthlyRent, setMonthlyRent] = useState("3000");
  const [vacancyRate, setVacancyRate] = useState("5");

  // ── State: Expenses (Insurance BEFORE Tax per project rules) ──
  const [monthlyInsurance, setMonthlyInsurance] = useState("150");
  const [monthlyTax, setMonthlyTax] = useState("400");
  const [monthlyHoa, setMonthlyHoa] = useState("0");
  const [monthlyFlood, setMonthlyFlood] = useState("0");
  const [otherExpenses, setOtherExpenses] = useState("0");

  // ── State: Loan ──
  const [loanAmount, setLoanAmount] = useState("300000");
  const [interestRate, setInterestRate] = useState("7.25");
  const [loanTerm, setLoanTerm] = useState("30");
  const [isIO, setIsIO] = useState(false);

  // ── Calculations ──
  const calc = useMemo(() => {
    const rent = num(monthlyRent);
    const vacancy = num(vacancyRate) / 100;
    const insurance = num(monthlyInsurance);
    const tax = num(monthlyTax);
    const hoa = num(monthlyHoa);
    const flood = num(monthlyFlood);
    const other = num(otherExpenses);
    const loan = num(loanAmount);
    const rate = num(interestRate) / 100;
    const term = num(loanTerm);

    // Effective Gross Income
    const effectiveIncome = rent * (1 - vacancy);

    // Total monthly operating expenses
    const totalExpenses = insurance + tax + hoa + flood + other;

    // Net Operating Income (monthly)
    const noiMonthly = effectiveIncome - totalExpenses;
    const noiAnnual = noiMonthly * 12;

    // Debt Service (monthly)
    let debtService = 0;
    if (isIO) {
      // Interest-Only: Loan Amount * Annual Rate / 12
      debtService = loan * rate / 12;
    } else {
      // Amortizing: standard P&I formula
      const monthlyRate = rate / 12;
      const numPayments = term * 12;
      if (monthlyRate > 0 && numPayments > 0) {
        debtService = loan * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
          (Math.pow(1 + monthlyRate, numPayments) - 1);
      } else if (numPayments > 0) {
        debtService = loan / numPayments;
      }
    }

    // DSCR
    const dscr = debtService > 0 ? noiMonthly / debtService : 0;

    // Cash Flow
    const monthlyCashFlow = noiMonthly - debtService;
    const annualCashFlow = monthlyCashFlow * 12;

    // Minimum rent needed for DSCR 1.0 and 1.25
    // Min Rent = (Debt Service * target DSCR + expenses) / (1 - vacancy)
    const divisor = (1 - vacancy) || 1;
    const minRent100 = (debtService * 1.0 + totalExpenses) / divisor;
    const minRent125 = (debtService * 1.25 + totalExpenses) / divisor;

    return {
      effectiveIncome,
      totalExpenses,
      noiMonthly,
      noiAnnual,
      debtService,
      dscr,
      monthlyCashFlow,
      annualCashFlow,
      minRent100,
      minRent125,
    };
  }, [monthlyRent, vacancyRate, monthlyInsurance, monthlyTax, monthlyHoa, monthlyFlood, otherExpenses, loanAmount, interestRate, loanTerm, isIO]);

  // DSCR color and eligibility
  const dscrColor = calc.dscr >= 1.25 ? "#16a34a" : calc.dscr >= 1.0 ? "#ca8a04" : "#dc2626";
  const dscrBg = calc.dscr >= 1.25 ? "#f0fdf4" : calc.dscr >= 1.0 ? "#fefce8" : "#fef2f2";
  const dscrBorder = calc.dscr >= 1.25 ? "#bbf7d0" : calc.dscr >= 1.0 ? "#fef08a" : "#fecaca";
  const dscrLabel = calc.dscr >= 1.25
    ? "Eligible — Strong"
    : calc.dscr >= 1.0
      ? "Eligible — Minimum"
      : "Not Eligible";
  const dscrLabelColor = calc.dscr >= 1.25
    ? "text-green-700 bg-green-100"
    : calc.dscr >= 1.0
      ? "text-yellow-700 bg-yellow-100"
      : "text-red-700 bg-red-100";

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-5">
        <Link to="/app/calculators" className="hover:text-blue-600 transition-colors">Calculators</Link>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="text-gray-700 font-medium">DSCR Calculator</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-start gap-5 mb-8 pb-6 border-b border-gray-200">
        <div
          className="w-14 h-14 min-w-[56px] rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)", boxShadow: "0 4px 12px rgba(37,99,235,0.25)" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1" style={{ letterSpacing: "-0.5px" }}>
            DSCR Calculator
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            Calculate Debt Service Coverage Ratio for investment property loans. Determine loan eligibility based on rental income vs. debt obligations.
          </p>
        </div>
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ── LEFT: Inputs ── */}
        <div className="lg:col-span-5 space-y-5">

          {/* Rental Income */}
          <SectionCard
            title="Rental Income"
            icon={<><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>}
          >
            <InputField
              label="Monthly Gross Rental Income"
              value={monthlyRent}
              onChange={setMonthlyRent}
              prefix="$"
              step="50"
              min="0"
            />
            <InputField
              label="Vacancy Rate"
              value={vacancyRate}
              onChange={setVacancyRate}
              suffix="%"
              step="0.5"
              min="0"
              max="100"
              helpText="Typical: 5% for stable markets, 8-10% for higher turnover"
            />
          </SectionCard>

          {/* Operating Expenses — Insurance BEFORE Tax */}
          <SectionCard
            title="Monthly Operating Expenses"
            icon={<><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>}
          >
            <InputField
              label="Homeowner's Insurance"
              value={monthlyInsurance}
              onChange={setMonthlyInsurance}
              prefix="$"
              step="10"
              min="0"
            />
            <InputField
              label="Property Tax"
              value={monthlyTax}
              onChange={setMonthlyTax}
              prefix="$"
              step="10"
              min="0"
            />
            <InputField
              label="HOA Dues"
              value={monthlyHoa}
              onChange={setMonthlyHoa}
              prefix="$"
              step="10"
              min="0"
            />
            <InputField
              label="Flood Insurance"
              value={monthlyFlood}
              onChange={setMonthlyFlood}
              prefix="$"
              step="10"
              min="0"
            />
            <InputField
              label="Other Monthly Expenses"
              value={otherExpenses}
              onChange={setOtherExpenses}
              prefix="$"
              step="10"
              min="0"
              helpText="Property management, maintenance reserves, etc."
            />
          </SectionCard>

          {/* Loan Details */}
          <SectionCard
            title="Loan Details"
            icon={<><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></>}
          >
            <InputField
              label="Loan Amount"
              value={loanAmount}
              onChange={setLoanAmount}
              prefix="$"
              step="1000"
              min="0"
            />
            <InputField
              label="Interest Rate"
              value={interestRate}
              onChange={setInterestRate}
              suffix="%"
              step="0.125"
              min="0"
              max="25"
            />
            <InputField
              label="Loan Term (Years)"
              value={loanTerm}
              onChange={setLoanTerm}
              suffix="yrs"
              step="1"
              min="1"
              max="40"
            />
            <Toggle
              label="Interest-Only"
              checked={isIO}
              onChange={setIsIO}
            />
            {isIO && (
              <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                Interest-only payment: {fmt(calc.debtService)}/mo. Principal is deferred.
              </p>
            )}
          </SectionCard>
        </div>

        {/* ── RIGHT: Results (sticky) ── */}
        <div className="lg:col-span-7 lg:sticky lg:top-6 space-y-5">

          {/* Big DSCR Display */}
          <div
            className="rounded-xl border-2 p-6 text-center shadow-sm"
            style={{ backgroundColor: dscrBg, borderColor: dscrBorder }}
          >
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Debt Service Coverage Ratio
            </p>
            <p className="text-6xl font-black mb-3" style={{ color: dscrColor, letterSpacing: "-2px" }}>
              {fmt2(calc.dscr)}
            </p>

            {/* Eligibility Badge */}
            <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold ${dscrLabelColor}`}>
              {calc.dscr >= 1.0 ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-4 h-4">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-4 h-4">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
              {dscrLabel}
            </span>

            {/* DSCR Scale Bar */}
            <div className="mt-5 px-2">
              <div className="relative h-3 rounded-full bg-gray-200 overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-red-400 rounded-l-full" style={{ width: "40%" }} />
                <div className="absolute inset-y-0 bg-yellow-400" style={{ left: "40%", width: "20%" }} />
                <div className="absolute inset-y-0 bg-green-400 rounded-r-full" style={{ left: "60%", width: "40%" }} />
                {/* Indicator */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md transition-all duration-300"
                  style={{
                    backgroundColor: dscrColor,
                    left: `clamp(0%, ${Math.min(calc.dscr / 2 * 100, 100)}%, 100%)`,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              </div>
              <div className="flex justify-between mt-1.5 text-xs text-gray-400 font-medium">
                <span>0.00</span>
                <span>1.00</span>
                <span>1.25</span>
                <span>2.00</span>
              </div>
            </div>
          </div>

          {/* Income & Expense Breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-800 mb-3 pb-2 border-b border-gray-100">
              Income & NOI Breakdown
            </h3>
            <div className="divide-y divide-gray-100">
              <ResultRow label="Gross Monthly Rent" value={fmt(num(monthlyRent))} />
              <ResultRow label="Less: Vacancy" value={`-${fmt(num(monthlyRent) * num(vacancyRate) / 100)}`} sub={`${vacancyRate}% vacancy rate`} color="text-red-500" />
              <ResultRow label="Effective Gross Income" value={fmt(calc.effectiveIncome)} bold />
              <div className="pt-2 mt-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Operating Expenses</p>
              </div>
              {/* Insurance BEFORE Tax */}
              <ResultRow label="Homeowner's Insurance" value={`-${fmt(num(monthlyInsurance))}`} color="text-red-500" />
              <ResultRow label="Property Tax" value={`-${fmt(num(monthlyTax))}`} color="text-red-500" />
              {num(monthlyHoa) > 0 && <ResultRow label="HOA Dues" value={`-${fmt(num(monthlyHoa))}`} color="text-red-500" />}
              {num(monthlyFlood) > 0 && <ResultRow label="Flood Insurance" value={`-${fmt(num(monthlyFlood))}`} color="text-red-500" />}
              {num(otherExpenses) > 0 && <ResultRow label="Other Expenses" value={`-${fmt(num(otherExpenses))}`} color="text-red-500" />}
              <ResultRow label="Total Operating Expenses" value={`-${fmt(calc.totalExpenses)}`} bold color="text-red-600" />
              <div className="bg-blue-50 -mx-5 px-5 py-2 mt-1">
                <ResultRow label="Net Operating Income (NOI)" value={fmt(calc.noiMonthly)} sub={`${fmt(calc.noiAnnual)}/year`} bold color="text-blue-700" />
              </div>
            </div>
          </div>

          {/* Debt Service & Cash Flow */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-800 mb-3 pb-2 border-b border-gray-100">
              Debt Service & Cash Flow
            </h3>
            <div className="divide-y divide-gray-100">
              <ResultRow
                label={isIO ? "Monthly Payment (IO)" : "Monthly Payment (P&I)"}
                value={fmt(calc.debtService)}
                sub={`${fmt(calc.debtService * 12)}/year`}
                bold
              />
              <ResultRow
                label="Monthly Cash Flow"
                value={fmt(calc.monthlyCashFlow)}
                bold
                color={calc.monthlyCashFlow >= 0 ? "text-green-600" : "text-red-600"}
              />
              <ResultRow
                label="Annual Cash Flow"
                value={fmt(calc.annualCashFlow)}
                bold
                color={calc.annualCashFlow >= 0 ? "text-green-600" : "text-red-600"}
              />
            </div>
          </div>

          {/* Minimum Rent Targets */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-800 mb-3 pb-2 border-b border-gray-100">
              Minimum Rent Needed
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 text-center">
                <p className="text-xs font-semibold text-yellow-600 uppercase tracking-wider mb-1">For 1.00 DSCR</p>
                <p className="text-xl font-bold text-yellow-700">{fmt(calc.minRent100)}</p>
                <p className="text-xs text-yellow-500 mt-0.5">per month</p>
              </div>
              <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
                <p className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-1">For 1.25 DSCR</p>
                <p className="text-xl font-bold text-green-700">{fmt(calc.minRent125)}</p>
                <p className="text-xs text-green-500 mt-0.5">per month</p>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
            <div className="flex gap-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <div className="text-xs text-gray-500 leading-relaxed">
                <p className="font-semibold text-gray-600 mb-1">How DSCR Works</p>
                <p>DSCR measures whether rental income covers the mortgage payment. Most lenders require a minimum DSCR of 1.0 (break-even), with 1.25+ preferred for better rates and terms. Higher DSCR = lower risk = better pricing.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

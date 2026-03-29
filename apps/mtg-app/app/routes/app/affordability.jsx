import { useState, useMemo } from "react";
import { Link } from "react-router";

export function meta() {
  return [{ title: "Affordability Calculator — MtgBroker" }];
}

// ── Formatting helpers ──────────────────────────────────

function fmtCurrency(n) {
  if (n == null || isNaN(n) || !isFinite(n)) return "$0";
  return "$" + Math.round(n).toLocaleString("en-US");
}

function fmtCurrencyDetailed(n) {
  if (n == null || isNaN(n) || !isFinite(n)) return "$0.00";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n) {
  if (n == null || isNaN(n)) return "0%";
  return n.toFixed(1) + "%";
}

// DTI color coding: green < 36%, yellow 36-43%, red > 43%
function dtiColor(pct) {
  if (pct < 36) return { bg: "#DEF7EC", text: "#03543F", border: "#A7F3D0" };
  if (pct <= 43) return { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" };
  return { bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5" };
}

function dtiLabel(pct) {
  if (pct < 36) return "Good";
  if (pct <= 43) return "Caution";
  return "High";
}

// ── Main Component ──────────────────────────────────────

export default function AffordabilityCalculator() {
  // Form state with defaults
  const [annualIncome, setAnnualIncome] = useState(100000);
  const [monthlyDebts, setMonthlyDebts] = useState(500);
  const [interestRate, setInterestRate] = useState(6.75);
  const [loanTerm, setLoanTerm] = useState(30);
  const [downPaymentPct, setDownPaymentPct] = useState(20);
  const [taxRate, setTaxRate] = useState(1.25);
  const [annualInsurance, setAnnualInsurance] = useState(1800);
  const [monthlyHoa, setMonthlyHoa] = useState(0);
  const [maxFrontDti, setMaxFrontDti] = useState(28);
  const [maxBackDti, setMaxBackDti] = useState(43);

  // ── Calculations ────────────────────────────────────
  const results = useMemo(() => {
    const monthlyIncome = annualIncome / 12;

    // Max total housing payment from back-end DTI
    const maxHousingFromBackEnd = (monthlyIncome * (maxBackDti / 100)) - monthlyDebts;

    // Max housing from front-end DTI (housing only, no other debts)
    const maxHousingFromFrontEnd = monthlyIncome * (maxFrontDti / 100);

    // Use the lesser of front-end and back-end limits
    const maxHousing = Math.min(maxHousingFromBackEnd, maxHousingFromFrontEnd);

    if (maxHousing <= 0) {
      return {
        maxHousing: 0,
        maxLoanAmount: 0,
        maxHomePrice: 0,
        monthlyPI: 0,
        monthlyTax: 0,
        monthlyInsurance: 0,
        monthlyHoaVal: 0,
        totalPayment: 0,
        frontEndDti: 0,
        backEndDti: 0,
        monthlyIncome,
        constrainedBy: "back-end",
      };
    }

    // Monthly insurance and HOA are fixed
    const monthlyInsurance = annualInsurance / 12;
    const monthlyHoaVal = monthlyHoa;

    // We need to solve for home price iteratively because tax depends on home price.
    // Available for P&I = maxHousing - monthlyTax - monthlyInsurance - HOA
    // monthlyTax = (homePrice * taxRate) / 12
    // homePrice = loanAmount / (1 - downPaymentPct/100)
    // loanAmount = P&I / [r(1+r)^n / ((1+r)^n - 1)]
    //
    // Let's derive it algebraically:
    // Let dp = downPaymentPct / 100
    // homePrice = loanAmount / (1 - dp)
    // monthlyTax = (loanAmount / (1 - dp)) * (taxRate / 100) / 12
    //
    // availablePI = maxHousing - monthlyInsurance - monthlyHoaVal - monthlyTax
    // availablePI = maxHousing - monthlyInsurance - monthlyHoaVal - (loanAmount / (1-dp)) * (taxRate/100/12)
    //
    // loanAmount = availablePI / mortgageFactor
    //   where mortgageFactor = r(1+r)^n / ((1+r)^n - 1), r = monthly rate, n = months
    //
    // Substituting:
    // loanAmount = [maxHousing - monthlyInsurance - monthlyHoaVal - (loanAmount/(1-dp))*(taxRate/100/12)] / mortgageFactor
    //
    // loanAmount * mortgageFactor = maxHousing - monthlyInsurance - monthlyHoaVal - loanAmount * taxRate/(100*12*(1-dp))
    // loanAmount * mortgageFactor + loanAmount * taxRate/(100*12*(1-dp)) = maxHousing - monthlyInsurance - monthlyHoaVal
    // loanAmount * [mortgageFactor + taxRate/(100*12*(1-dp))] = maxHousing - monthlyInsurance - monthlyHoaVal
    // loanAmount = (maxHousing - monthlyInsurance - monthlyHoaVal) / [mortgageFactor + taxRate/(100*12*(1-dp))]

    const r = interestRate / 100 / 12; // monthly rate
    const n = loanTerm * 12; // total months
    const dp = downPaymentPct / 100;

    let mortgageFactor;
    if (r === 0) {
      mortgageFactor = 1 / n;
    } else {
      const compounded = Math.pow(1 + r, n);
      mortgageFactor = (r * compounded) / (compounded - 1);
    }

    const taxMonthlyFactor = taxRate / (100 * 12 * (1 - dp));
    const netAvailable = maxHousing - monthlyInsurance - monthlyHoaVal;

    if (netAvailable <= 0) {
      return {
        maxHousing: 0,
        maxLoanAmount: 0,
        maxHomePrice: 0,
        monthlyPI: 0,
        monthlyTax: 0,
        monthlyInsurance,
        monthlyHoaVal,
        totalPayment: 0,
        frontEndDti: 0,
        backEndDti: 0,
        monthlyIncome,
        constrainedBy: maxHousingFromFrontEnd < maxHousingFromBackEnd ? "front-end" : "back-end",
      };
    }

    const maxLoanAmount = netAvailable / (mortgageFactor + taxMonthlyFactor);
    const maxHomePrice = maxLoanAmount / (1 - dp);
    const monthlyPI = maxLoanAmount * mortgageFactor;
    const monthlyTax = (maxHomePrice * taxRate / 100) / 12;
    const totalPayment = monthlyPI + monthlyTax + monthlyInsurance + monthlyHoaVal;

    // Actual DTI ratios at the calculated max
    const frontEndDti = monthlyIncome > 0 ? (totalPayment / monthlyIncome) * 100 : 0;
    const backEndDti = monthlyIncome > 0 ? ((totalPayment + monthlyDebts) / monthlyIncome) * 100 : 0;

    const constrainedBy = maxHousingFromFrontEnd < maxHousingFromBackEnd ? "front-end" : "back-end";

    return {
      maxHousing: Math.max(0, maxHousing),
      maxLoanAmount: Math.max(0, maxLoanAmount),
      maxHomePrice: Math.max(0, maxHomePrice),
      monthlyPI: Math.max(0, monthlyPI),
      monthlyTax: Math.max(0, monthlyTax),
      monthlyInsurance,
      monthlyHoaVal,
      totalPayment: Math.max(0, totalPayment),
      frontEndDti: Math.max(0, frontEndDti),
      backEndDti: Math.max(0, backEndDti),
      monthlyIncome,
      constrainedBy,
    };
  }, [annualIncome, monthlyDebts, interestRate, loanTerm, downPaymentPct, taxRate, annualInsurance, monthlyHoa, maxFrontDti, maxBackDti]);

  // Breakdown bar percentages for visual display
  const breakdownItems = useMemo(() => {
    const total = results.totalPayment || 1;
    return [
      { label: "Principal & Interest", value: results.monthlyPI, color: "#2563EB", pct: (results.monthlyPI / total) * 100 },
      { label: "Insurance", value: results.monthlyInsurance, color: "#7C3AED", pct: (results.monthlyInsurance / total) * 100 },
      { label: "Property Tax", value: results.monthlyTax, color: "#059669", pct: (results.monthlyTax / total) * 100 },
      { label: "HOA", value: results.monthlyHoaVal, color: "#D97706", pct: (results.monthlyHoaVal / total) * 100 },
    ].filter((item) => item.value > 0);
  }, [results]);

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-500 mb-6">
        <Link to="/app/calculators" className="hover:text-blue-600 transition-colors">
          Calculators
        </Link>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="text-slate-800 font-medium">Affordability Calculator</span>
      </nav>

      {/* Header */}
      <div className="flex items-start gap-5 mb-10 pb-7 border-b border-slate-200">
        <div
          className="w-14 h-14 min-w-[56px] rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)", boxShadow: "0 4px 12px rgba(37,99,235,0.25)" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
            <path d="M3 3v18h18" />
            <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
          </svg>
        </div>
        <div>
          <h1 className="text-[28px] font-extrabold text-slate-900 mb-1.5" style={{ letterSpacing: "-0.5px" }}>
            Affordability Calculator
          </h1>
          <p className="text-[15px] text-slate-500 leading-normal">
            Calculate the maximum home price your borrower can afford based on income, debts, and DTI limits.
          </p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Column — Inputs */}
        <div className="flex-1 min-w-0">
          {/* Income & Debts */}
          <InputSection title="Income & Debts" icon={<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />}>
            <InputRow label="Annual Gross Income">
              <CurrencyInput value={annualIncome} onChange={setAnnualIncome} />
            </InputRow>
            <InputRow label="Total Monthly Debts" hint="Car payments, student loans, credit cards, etc.">
              <CurrencyInput value={monthlyDebts} onChange={setMonthlyDebts} />
            </InputRow>
          </InputSection>

          {/* Loan Details */}
          <InputSection title="Loan Details" icon={<><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M12 12h.01M17 12h.01M7 12h.01" /></>}>
            <InputRow label="Interest Rate">
              <PercentInput value={interestRate} onChange={setInterestRate} step="0.125" />
            </InputRow>
            <InputRow label="Loan Term">
              <select
                value={loanTerm}
                onChange={(e) => setLoanTerm(Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value={15}>15 years</option>
                <option value={20}>20 years</option>
                <option value={25}>25 years</option>
                <option value={30}>30 years</option>
              </select>
            </InputRow>
            <InputRow label="Down Payment">
              <PercentInput value={downPaymentPct} onChange={setDownPaymentPct} min="0" max="99" step="1" />
            </InputRow>
          </InputSection>

          {/* Property Costs */}
          <InputSection title="Property Costs" icon={<><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>}>
            <InputRow label="Homeowner's Insurance ($/year)">
              <CurrencyInput value={annualInsurance} onChange={setAnnualInsurance} />
            </InputRow>
            <InputRow label="Property Tax Rate (annual)">
              <PercentInput value={taxRate} onChange={setTaxRate} step="0.05" />
            </InputRow>
            <InputRow label="HOA (monthly)">
              <CurrencyInput value={monthlyHoa} onChange={setMonthlyHoa} />
            </InputRow>
          </InputSection>

          {/* DTI Limits */}
          <InputSection title="DTI Limits" icon={<><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></>}>
            <InputRow label="Max Front-End DTI" hint="Housing payment / gross income">
              <PercentInput value={maxFrontDti} onChange={setMaxFrontDti} min="1" max="65" step="1" />
            </InputRow>
            <InputRow label="Max Back-End DTI" hint="(Housing + debts) / gross income">
              <PercentInput value={maxBackDti} onChange={setMaxBackDti} min="1" max="65" step="1" />
            </InputRow>
          </InputSection>
        </div>

        {/* Right Column — Results (sticky) */}
        <div className="lg:w-[420px] lg:shrink-0">
          <div className="lg:sticky lg:top-6">
            {/* Main result */}
            <div
              className="rounded-2xl border border-slate-200 overflow-hidden mb-6"
              style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}
            >
              {/* Top hero section */}
              <div className="px-6 py-8 text-center text-white" style={{ background: "linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)" }}>
                <p className="text-sm font-medium text-blue-200 mb-1">Maximum Home Price</p>
                <p className="text-4xl font-extrabold tracking-tight">{fmtCurrency(results.maxHomePrice)}</p>
                <p className="text-xs text-blue-300 mt-2">
                  {results.constrainedBy === "front-end" ? "Limited by front-end DTI" : "Limited by back-end DTI"}
                </p>
              </div>

              {/* Key metrics row */}
              <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200">
                <div className="px-4 py-4 text-center">
                  <p className="text-xs text-slate-500 mb-0.5">Max Loan Amount</p>
                  <p className="text-lg font-bold text-slate-900">{fmtCurrency(results.maxLoanAmount)}</p>
                </div>
                <div className="px-4 py-4 text-center">
                  <p className="text-xs text-slate-500 mb-0.5">Monthly Payment</p>
                  <p className="text-lg font-bold text-slate-900">{fmtCurrency(results.totalPayment)}</p>
                </div>
              </div>

              {/* PITI Breakdown */}
              <div className="px-6 py-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Monthly Breakdown</p>

                {/* Stacked bar */}
                {results.totalPayment > 0 && (
                  <div className="flex rounded-full overflow-hidden h-3 mb-4">
                    {breakdownItems.map((item) => (
                      <div
                        key={item.label}
                        style={{ width: item.pct + "%", backgroundColor: item.color }}
                        title={item.label + ": " + fmtCurrencyDetailed(item.value)}
                      />
                    ))}
                  </div>
                )}

                {/* Line items — Insurance BEFORE Property Tax */}
                <div className="space-y-3">
                  <BreakdownRow label="Principal & Interest" value={results.monthlyPI} color="#2563EB" />
                  <BreakdownRow label="Homeowner's Insurance" value={results.monthlyInsurance} color="#7C3AED" />
                  <BreakdownRow label="Property Tax" value={results.monthlyTax} color="#059669" />
                  {results.monthlyHoaVal > 0 && (
                    <BreakdownRow label="HOA" value={results.monthlyHoaVal} color="#D97706" />
                  )}
                  <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">Total PITI{results.monthlyHoaVal > 0 ? " + HOA" : ""}</span>
                    <span className="text-sm font-bold text-slate-900">{fmtCurrencyDetailed(results.totalPayment)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* DTI Ratios */}
            <div
              className="rounded-2xl border border-slate-200 p-6"
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
            >
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">DTI Ratios</p>
              <div className="space-y-4">
                <DtiGauge
                  label="Front-End DTI"
                  sublabel="Housing / Income"
                  value={results.frontEndDti}
                  limit={maxFrontDti}
                />
                <DtiGauge
                  label="Back-End DTI"
                  sublabel="(Housing + Debts) / Income"
                  value={results.backEndDti}
                  limit={maxBackDti}
                />
              </div>

              {/* Income context */}
              <div className="mt-5 pt-4 border-t border-slate-200">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Gross Monthly Income</span>
                  <span className="font-semibold text-slate-900">{fmtCurrency(results.monthlyIncome)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1.5">
                  <span className="text-slate-500">Down Payment Amount</span>
                  <span className="font-semibold text-slate-900">{fmtCurrency(results.maxHomePrice * (downPaymentPct / 100))}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────

function InputSection({ title, icon, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-6 mb-6 bg-white" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            {icon}
          </svg>
        </div>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function InputRow({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
      </label>
      {hint && <p className="text-xs text-slate-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

function CurrencyInput({ value, onChange }) {
  const [focused, setFocused] = useState(false);
  const [displayValue, setDisplayValue] = useState(formatWithCommas(value));

  function formatWithCommas(n) {
    if (n == null || n === "" || isNaN(n)) return "";
    return Number(n).toLocaleString("en-US");
  }

  function handleFocus() {
    setFocused(true);
    // Show raw number for easy editing
    setDisplayValue(value === 0 ? "" : String(value));
  }

  function handleBlur() {
    setFocused(false);
    const parsed = parseFloat(String(displayValue).replace(/[^0-9.]/g, "")) || 0;
    onChange(parsed);
    setDisplayValue(formatWithCommas(parsed));
  }

  function handleChange(e) {
    const raw = e.target.value;
    if (focused) {
      setDisplayValue(raw);
    } else {
      const parsed = parseFloat(raw.replace(/[^0-9.]/g, "")) || 0;
      onChange(parsed);
      setDisplayValue(formatWithCommas(parsed));
    }
  }

  // Keep display in sync if value changes externally while not focused
  if (!focused && formatWithCommas(value) !== displayValue) {
    setDisplayValue(formatWithCommas(value));
  }

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none">$</span>
      <input
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="w-full pl-7 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
      />
    </div>
  );
}

function PercentInput({ value, onChange, min = "0", max = "100", step = "0.01" }) {
  return (
    <div className="relative">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        min={min}
        max={max}
        step={step}
        className="w-full pr-8 pl-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none">%</span>
    </div>
  );
}

function BreakdownRow({ label, value, color }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-sm text-slate-600">{label}</span>
      </div>
      <span className="text-sm font-semibold text-slate-800">{fmtCurrencyDetailed(value)}</span>
    </div>
  );
}

function DtiGauge({ label, sublabel, value, limit }) {
  const pct = Math.min(value, 65); // cap the bar at 65%
  const colors = dtiColor(value);
  const barWidth = (pct / 65) * 100; // scale to 65% as full width

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <div>
          <span className="text-sm font-semibold text-slate-800">{label}</span>
          <span className="text-xs text-slate-400 ml-1.5">{sublabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: colors.bg, color: colors.text, border: "1px solid " + colors.border }}
          >
            {dtiLabel(value)}
          </span>
          <span className="text-lg font-bold" style={{ color: colors.text }}>
            {fmtPct(value)}
          </span>
        </div>
      </div>
      {/* Bar */}
      <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
          style={{ width: barWidth + "%", backgroundColor: value < 36 ? "#10B981" : value <= 43 ? "#F59E0B" : "#EF4444" }}
        />
        {/* Limit marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-slate-400"
          style={{ left: (limit / 65) * 100 + "%" }}
          title={"Limit: " + limit + "%"}
        />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[10px] text-slate-400">0%</span>
        <span className="text-[10px] text-slate-400">Limit: {limit}%</span>
      </div>
    </div>
  );
}

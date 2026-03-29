import { useState, useMemo } from "react";
import { Link } from "react-router";

export function meta() {
  return [{ title: "Mortgage Calculator — MtgBroker" }];
}

/* ── Formatting helpers ─────────────────────────────── */

function fmtCurrency(n) {
  if (n == null || isNaN(n)) return "$0";
  return "$" + Math.round(n).toLocaleString("en-US");
}

function fmtCurrencyDecimal(n) {
  if (n == null || isNaN(n)) return "$0.00";
  return "$" + Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPercent(n, decimals = 2) {
  if (n == null || isNaN(n)) return "0%";
  return Number(n).toFixed(decimals) + "%";
}

function parseNum(str) {
  if (!str && str !== 0) return 0;
  var cleaned = String(str).replace(/[^0-9.\-]/g, "");
  var val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

/* ── Donut Chart Component ──────────────────────────── */

function DonutChart({ segments }) {
  // segments: [{ label, value, color }]
  var total = segments.reduce(function (s, seg) { return s + seg.value; }, 0);
  if (total === 0) return null;

  var radius = 70;
  var strokeWidth = 28;
  var circumference = 2 * Math.PI * radius;
  var offset = 0;

  return (
    <svg viewBox="0 0 200 200" className="w-48 h-48 mx-auto">
      {segments.map(function (seg, i) {
        if (seg.value <= 0) return null;
        var pct = seg.value / total;
        var dashLen = pct * circumference;
        var dashOffset = -offset * circumference;
        offset += pct;
        return (
          <circle
            key={i}
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={dashLen + " " + (circumference - dashLen)}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 100 100)"
            style={{ transition: "stroke-dasharray 0.3s ease" }}
          />
        );
      })}
      {/* Center text */}
      <text x="100" y="94" textAnchor="middle" className="text-sm" fill="#64748b" fontSize="12">
        Monthly
      </text>
      <text x="100" y="114" textAnchor="middle" className="font-bold" fill="#0f172a" fontSize="16">
        {fmtCurrencyDecimal(total)}
      </text>
    </svg>
  );
}

/* ── Legend Item ─────────────────────────────────────── */

function LegendItem({ color, label, value, total }) {
  var pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2">
        <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      <div className="text-right">
        <span className="text-sm font-semibold text-gray-900">{fmtCurrencyDecimal(value)}</span>
        <span className="text-xs text-gray-500 ml-1">({pct}%)</span>
      </div>
    </div>
  );
}

/* ── Input Components ───────────────────────────────── */

function CurrencyInput({ label, value, onChange, id, helpText }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={value ? Number(value).toLocaleString("en-US") : ""}
          onChange={function (e) {
            onChange(parseNum(e.target.value));
          }}
          className="w-full pl-7 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
        />
      </div>
      {helpText && <p className="text-xs text-gray-500 mt-1">{helpText}</p>}
    </div>
  );
}

function PercentInput({ label, value, onChange, id, step, helpText }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          id={id}
          type="number"
          step={step || "0.01"}
          value={value}
          onChange={function (e) { onChange(parseFloat(e.target.value) || 0); }}
          className="w-full pl-3 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
      </div>
      {helpText && <p className="text-xs text-gray-500 mt-1">{helpText}</p>}
    </div>
  );
}

/* ── Main Component ─────────────────────────────────── */

export default function MortgageCalculator() {
  // Form state
  var _homePrice = useState(400000);
  var homePrice = _homePrice[0];
  var setHomePrice = _homePrice[1];

  var _downPaymentDollar = useState(80000);
  var downPaymentDollar = _downPaymentDollar[0];
  var setDownPaymentDollar = _downPaymentDollar[1];

  var _downPaymentMode = useState("dollar"); // "dollar" or "percent"
  var downPaymentMode = _downPaymentMode[0];
  var setDownPaymentMode = _downPaymentMode[1];

  var _downPaymentPercent = useState(20);
  var downPaymentPercent = _downPaymentPercent[0];
  var setDownPaymentPercent = _downPaymentPercent[1];

  var _interestRate = useState(6.75);
  var interestRate = _interestRate[0];
  var setInterestRate = _interestRate[1];

  var _loanTerm = useState(30);
  var loanTerm = _loanTerm[0];
  var setLoanTerm = _loanTerm[1];

  var _taxMode = useState("rate"); // "rate" or "dollar"
  var taxMode = _taxMode[0];
  var setTaxMode = _taxMode[1];

  var _taxRate = useState(1.25);
  var taxRate = _taxRate[0];
  var setTaxRate = _taxRate[1];

  var _taxDollar = useState(5000);
  var taxDollar = _taxDollar[0];
  var setTaxDollar = _taxDollar[1];

  var _insuranceAnnual = useState(1800);
  var insuranceAnnual = _insuranceAnnual[0];
  var setInsuranceAnnual = _insuranceAnnual[1];

  var _hoaMonthly = useState(0);
  var hoaMonthly = _hoaMonthly[0];
  var setHoaMonthly = _hoaMonthly[1];

  var _pmiRate = useState(0.5);
  var pmiRate = _pmiRate[0];
  var setPmiRate = _pmiRate[1];

  /* ── Derived calculations ─────────────────────────── */

  var calc = useMemo(function () {
    // Down payment
    var dp = downPaymentMode === "dollar"
      ? downPaymentDollar
      : (homePrice * downPaymentPercent) / 100;
    var dpPct = homePrice > 0 ? (dp / homePrice) * 100 : 0;

    // Loan amount
    var loanAmount = Math.max(homePrice - dp, 0);

    // LTV
    var ltv = homePrice > 0 ? (loanAmount / homePrice) * 100 : 0;

    // Monthly P&I
    var r = interestRate / 100 / 12;
    var n = loanTerm * 12;
    var monthlyPI = 0;
    if (r > 0 && n > 0 && loanAmount > 0) {
      monthlyPI = loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    } else if (n > 0 && loanAmount > 0) {
      // 0% interest — just divide evenly
      monthlyPI = loanAmount / n;
    }

    // Monthly tax
    var monthlyTax = taxMode === "rate"
      ? (homePrice * (taxRate / 100)) / 12
      : taxDollar / 12;

    // Monthly insurance (listed BEFORE tax per project rules)
    var monthlyInsurance = insuranceAnnual / 12;

    // Monthly PMI (only if LTV > 80%)
    var monthlyPMI = ltv > 80 ? (loanAmount * (pmiRate / 100)) / 12 : 0;

    // Total monthly
    var totalMonthly = monthlyPI + monthlyInsurance + monthlyTax + hoaMonthly + monthlyPMI;

    // Amortization summary
    var totalPIPayments = monthlyPI * n;
    var totalInterest = totalPIPayments - loanAmount;
    var totalCost = totalMonthly * n;

    return {
      dp: dp,
      dpPct: dpPct,
      loanAmount: loanAmount,
      ltv: ltv,
      monthlyPI: monthlyPI,
      monthlyTax: monthlyTax,
      monthlyInsurance: monthlyInsurance,
      monthlyPMI: monthlyPMI,
      hoaMonthly: hoaMonthly,
      totalMonthly: totalMonthly,
      totalInterest: totalInterest,
      totalCost: totalCost,
      totalPIPayments: totalPIPayments,
      n: n,
    };
  }, [homePrice, downPaymentDollar, downPaymentPercent, downPaymentMode, interestRate, loanTerm, taxMode, taxRate, taxDollar, insuranceAnnual, hoaMonthly, pmiRate]);

  /* ── Chart segments — Insurance before Tax ────────── */

  var chartColors = {
    pi: "#2563EB",       // blue
    insurance: "#F59E0B", // amber
    tax: "#10B981",       // green
    hoa: "#8B5CF6",       // purple
    pmi: "#EF4444",       // red
  };

  var segments = [
    { label: "Principal & Interest", value: calc.monthlyPI, color: chartColors.pi },
    { label: "Insurance", value: calc.monthlyInsurance, color: chartColors.insurance },
    { label: "Property Tax", value: calc.monthlyTax, color: chartColors.tax },
  ];
  if (calc.hoaMonthly > 0) {
    segments.push({ label: "HOA", value: calc.hoaMonthly, color: chartColors.hoa });
  }
  if (calc.monthlyPMI > 0) {
    segments.push({ label: "PMI", value: calc.monthlyPMI, color: chartColors.pmi });
  }

  /* ── Handlers for down payment toggle ─────────────── */

  function handleDownPaymentDollar(val) {
    setDownPaymentDollar(val);
    if (homePrice > 0) {
      setDownPaymentPercent(Math.round((val / homePrice) * 10000) / 100);
    }
  }

  function handleDownPaymentPercent(val) {
    setDownPaymentPercent(val);
    setDownPaymentDollar(Math.round((homePrice * val) / 100));
  }

  function handleHomePriceChange(val) {
    setHomePrice(val);
    // Keep percent stable, recalculate dollar
    if (downPaymentMode === "percent") {
      setDownPaymentDollar(Math.round((val * downPaymentPercent) / 100));
    } else {
      // Keep dollar stable, recalculate percent
      if (val > 0) {
        setDownPaymentPercent(Math.round((downPaymentDollar / val) * 10000) / 100);
      }
    }
    // Also recalculate tax dollar if in rate mode
    if (taxMode === "rate") {
      setTaxDollar(Math.round(val * (taxRate / 100)));
    }
  }

  /* ── Render ───────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link to="/app/calculators" className="hover:text-blue-600 transition-colors">
            Calculators
          </Link>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-900 font-medium">Mortgage Calculator</span>
        </nav>

        {/* Page Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <line x1="8" y1="6" x2="16" y2="6" />
              <line x1="16" y1="14" x2="16" y2="18" />
              <path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mortgage Calculator</h1>
            <p className="text-gray-500 text-sm mt-0.5">Estimate monthly PITI payments for any loan scenario</p>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* ── LEFT: Inputs ──────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Loan Details Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Loan Details</h2>
              <div className="space-y-4">
                {/* Home Price */}
                <CurrencyInput
                  id="homePrice"
                  label="Home Price"
                  value={homePrice}
                  onChange={handleHomePriceChange}
                />

                {/* Down Payment with toggle */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">Down Payment</label>
                    <div className="flex bg-gray-100 rounded-md p-0.5">
                      <button
                        type="button"
                        onClick={function () { setDownPaymentMode("dollar"); }}
                        className={"px-2.5 py-1 text-xs font-medium rounded transition-colors " +
                          (downPaymentMode === "dollar"
                            ? "bg-white text-blue-600 shadow-sm"
                            : "text-gray-500 hover:text-gray-700")}
                      >
                        $
                      </button>
                      <button
                        type="button"
                        onClick={function () { setDownPaymentMode("percent"); }}
                        className={"px-2.5 py-1 text-xs font-medium rounded transition-colors " +
                          (downPaymentMode === "percent"
                            ? "bg-white text-blue-600 shadow-sm"
                            : "text-gray-500 hover:text-gray-700")}
                      >
                        %
                      </button>
                    </div>
                  </div>
                  {downPaymentMode === "dollar" ? (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={downPaymentDollar ? Number(downPaymentDollar).toLocaleString("en-US") : ""}
                        onChange={function (e) { handleDownPaymentDollar(parseNum(e.target.value)); }}
                        className="w-full pl-7 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                      />
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        value={downPaymentPercent}
                        onChange={function (e) { handleDownPaymentPercent(parseFloat(e.target.value) || 0); }}
                        className="w-full pl-3 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {downPaymentMode === "dollar"
                      ? fmtPercent(calc.dpPct) + " of home price"
                      : fmtCurrency(calc.dp) + " down"}
                  </p>
                </div>

                {/* Loan Amount (read-only) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loan Amount</label>
                  <div className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-medium">
                    {fmtCurrency(calc.loanAmount)}
                  </div>
                </div>

                {/* Interest Rate */}
                <PercentInput
                  id="interestRate"
                  label="Interest Rate"
                  value={interestRate}
                  onChange={setInterestRate}
                  step="0.125"
                />

                {/* Loan Term */}
                <div>
                  <label htmlFor="loanTerm" className="block text-sm font-medium text-gray-700 mb-1">Loan Term</label>
                  <select
                    id="loanTerm"
                    value={loanTerm}
                    onChange={function (e) { setLoanTerm(parseInt(e.target.value)); }}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors bg-white"
                  >
                    <option value={10}>10 years</option>
                    <option value={15}>15 years</option>
                    <option value={20}>20 years</option>
                    <option value={25}>25 years</option>
                    <option value={30}>30 years</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Taxes, Insurance & Fees Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Taxes, Insurance & Fees</h2>
              <div className="space-y-4">
                {/* Insurance BEFORE Tax per project rules */}
                <CurrencyInput
                  id="insurance"
                  label="Homeowner's Insurance (Annual)"
                  value={insuranceAnnual}
                  onChange={setInsuranceAnnual}
                  helpText={fmtCurrencyDecimal(insuranceAnnual / 12) + "/mo"}
                />

                {/* Property Tax with toggle */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">Property Tax</label>
                    <div className="flex bg-gray-100 rounded-md p-0.5">
                      <button
                        type="button"
                        onClick={function () { setTaxMode("rate"); }}
                        className={"px-2.5 py-1 text-xs font-medium rounded transition-colors " +
                          (taxMode === "rate"
                            ? "bg-white text-blue-600 shadow-sm"
                            : "text-gray-500 hover:text-gray-700")}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        onClick={function () { setTaxMode("dollar"); }}
                        className={"px-2.5 py-1 text-xs font-medium rounded transition-colors " +
                          (taxMode === "dollar"
                            ? "bg-white text-blue-600 shadow-sm"
                            : "text-gray-500 hover:text-gray-700")}
                      >
                        $/yr
                      </button>
                    </div>
                  </div>
                  {taxMode === "rate" ? (
                    <>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          value={taxRate}
                          onChange={function (e) {
                            var val = parseFloat(e.target.value) || 0;
                            setTaxRate(val);
                            setTaxDollar(Math.round(homePrice * (val / 100)));
                          }}
                          className="w-full pl-3 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {fmtCurrency(homePrice * (taxRate / 100))}/yr &middot; {fmtCurrencyDecimal(calc.monthlyTax)}/mo
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={taxDollar ? Number(taxDollar).toLocaleString("en-US") : ""}
                          onChange={function (e) {
                            var val = parseNum(e.target.value);
                            setTaxDollar(val);
                            if (homePrice > 0) setTaxRate(Math.round((val / homePrice) * 10000) / 100);
                          }}
                          className="w-full pl-7 pr-12 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">/yr</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {fmtPercent(homePrice > 0 ? (taxDollar / homePrice) * 100 : 0)} rate &middot; {fmtCurrencyDecimal(taxDollar / 12)}/mo
                      </p>
                    </>
                  )}
                </div>

                {/* HOA */}
                <CurrencyInput
                  id="hoa"
                  label="HOA (Monthly)"
                  value={hoaMonthly}
                  onChange={setHoaMonthly}
                />

                {/* PMI — only shown when LTV > 80% */}
                {calc.ltv > 80 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <span className="text-sm font-medium text-amber-800">PMI Required (LTV {fmtPercent(calc.ltv, 1)})</span>
                    </div>
                    <PercentInput
                      id="pmiRate"
                      label="PMI Rate (Annual)"
                      value={pmiRate}
                      onChange={setPmiRate}
                      helpText={fmtCurrencyDecimal(calc.monthlyPMI) + "/mo"}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Results (sticky) ───────────────── */}
          <div className="lg:col-span-3">
            <div className="lg:sticky lg:top-6 space-y-6">
              {/* Total Monthly Payment */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="text-center mb-6">
                  <p className="text-sm text-gray-500 mb-1">Estimated Monthly Payment</p>
                  <p className="text-4xl font-bold text-blue-600 tracking-tight">
                    {fmtCurrencyDecimal(calc.totalMonthly)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{loanTerm}-year fixed at {fmtPercent(interestRate, 3)}</p>
                </div>

                {/* Donut Chart */}
                <DonutChart segments={segments} />

                {/* Legend / Breakdown */}
                <div className="mt-6 px-2">
                  {segments.map(function (seg, i) {
                    return (
                      <LegendItem
                        key={i}
                        color={seg.color}
                        label={seg.label}
                        value={seg.value}
                        total={calc.totalMonthly}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Loan Summary Card */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Loan Summary</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-0.5">Loan Amount</p>
                    <p className="text-sm font-semibold text-gray-900">{fmtCurrency(calc.loanAmount)}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-0.5">Down Payment</p>
                    <p className="text-sm font-semibold text-gray-900">{fmtCurrency(calc.dp)} ({fmtPercent(calc.dpPct, 1)})</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-0.5">Loan-to-Value (LTV)</p>
                    <p className="text-sm font-semibold text-gray-900">{fmtPercent(calc.ltv, 1)}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-0.5">Number of Payments</p>
                    <p className="text-sm font-semibold text-gray-900">{calc.n}</p>
                  </div>
                </div>
              </div>

              {/* Amortization Summary Card */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Amortization Summary</h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Monthly P&I Payment</span>
                    <span className="text-sm font-semibold text-gray-900">{fmtCurrencyDecimal(calc.monthlyPI)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Total P&I Payments</span>
                    <span className="text-sm font-semibold text-gray-900">{fmtCurrency(calc.totalPIPayments)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Total Interest Paid</span>
                    <span className="text-sm font-semibold text-red-600">{fmtCurrency(calc.totalInterest)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Total Cost (all payments)</span>
                    <span className="text-sm font-semibold text-gray-900">{fmtCurrency(calc.totalCost)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-600">Interest-to-Loan Ratio</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {calc.loanAmount > 0 ? fmtPercent((calc.totalInterest / calc.loanAmount) * 100, 1) : "0%"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Principal vs Interest Bar */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-3">Principal vs. Interest</h2>
                <div className="w-full h-6 bg-gray-100 rounded-full overflow-hidden flex">
                  {calc.totalPIPayments > 0 && (
                    <>
                      <div
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{ width: ((calc.loanAmount / calc.totalPIPayments) * 100) + "%" }}
                        title={"Principal: " + fmtCurrency(calc.loanAmount)}
                      />
                      <div
                        className="h-full bg-red-400 transition-all duration-300"
                        style={{ width: ((calc.totalInterest / calc.totalPIPayments) * 100) + "%" }}
                        title={"Interest: " + fmtCurrency(calc.totalInterest)}
                      />
                    </>
                  )}
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                    Principal: {fmtCurrency(calc.loanAmount)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
                    Interest: {fmtCurrency(calc.totalInterest)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

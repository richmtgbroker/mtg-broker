import { useState, useMemo } from "react";
import { Link } from "react-router";

export function meta() {
  return [{ title: "VA Entitlement Calculator — MtgBroker" }];
}

/* ── Constants ── */
const BASIC_ENTITLEMENT = 36000;
const DEFAULT_COUNTY_LIMIT = 766550;

// VA Funding Fee rates by usage type and down payment tier
const FUNDING_FEE_RATES = {
  first: {
    zero: 0.0215,   // 2.15% — 0% down
    five: 0.015,    // 1.50% — 5-9% down
    ten: 0.0125,    // 1.25% — 10%+ down
  },
  subsequent: {
    zero: 0.033,    // 3.30% — 0% down
    five: 0.015,    // 1.50% — 5-9% down
    ten: 0.0125,    // 1.25% — 10%+ down
  },
};

/* ── Helpers ── */
function fmtCurrency(n) {
  if (n == null || isNaN(n)) return "--";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtPct(n) {
  if (n == null || isNaN(n)) return "--";
  return (n * 100).toFixed(2) + "%";
}

/* ── Styled input component ── */
function InputField({ label, value, onChange, type = "number", prefix, suffix, step, placeholder, helpText, children }) {
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
      {helpText && <p className="text-xs text-slate-400 mt-1">{helpText}</p>}
    </div>
  );
}

/* ── Toggle switch ── */
function Toggle({ label, value, onChange }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !value
              ? "bg-[#2563EB] text-white shadow-sm"
              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
          }`}
        >
          No
        </button>
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            value
              ? "bg-[#2563EB] text-white shadow-sm"
              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
          }`}
        >
          Yes
        </button>
      </div>
    </div>
  );
}

/* ── Entitlement bar visual ── */
function EntitlementBar({ used, remaining, total }) {
  if (total <= 0) return null;
  const usedPct = Math.min((used / total) * 100, 100);
  const remainPct = Math.min((remaining / total) * 100, 100);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
        <span>Entitlement Used vs Remaining</span>
        <span>{fmtCurrency(total)} total</span>
      </div>
      <div className="w-full h-6 bg-slate-100 rounded-full overflow-hidden flex">
        {usedPct > 0 && (
          <div
            className="h-full flex items-center justify-center text-xs font-semibold text-white transition-all duration-300"
            style={{ width: `${usedPct}%`, background: "#94A3B8", minWidth: usedPct > 5 ? "auto" : "0px" }}
          >
            {usedPct > 15 ? "Used" : ""}
          </div>
        )}
        {remainPct > 0 && (
          <div
            className="h-full flex items-center justify-center text-xs font-semibold text-white transition-all duration-300"
            style={{ width: `${remainPct}%`, background: "#2563EB", minWidth: remainPct > 5 ? "auto" : "0px" }}
          >
            {remainPct > 15 ? "Available" : ""}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Result card ── */
function ResultCard({ label, value, subtext, color, large }) {
  const colorMap = {
    green: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-600" },
    blue: { bg: "bg-blue-50", border: "border-[#BFDBFE]", text: "text-[#2563EB]" },
    amber: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-600" },
    red: { bg: "bg-red-50", border: "border-red-200", text: "text-red-600" },
    slate: { bg: "bg-white", border: "border-slate-200", text: "text-slate-800" },
  };
  const c = colorMap[color] || colorMap.slate;

  return (
    <div className={`${c.bg} ${c.border} border rounded-xl p-5`} style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</div>
      <div className={`${large ? "text-2xl" : "text-xl"} font-extrabold ${c.text}`}>{value}</div>
      {subtext && <div className="text-xs text-slate-400 mt-1">{subtext}</div>}
    </div>
  );
}

/* ── Main Component ── */
export default function VAEntitlementCalculator() {
  const [countyLimit, setCountyLimit] = useState("766550");
  const [hasExistingVA, setHasExistingVA] = useState(false);
  const [currentVABalance, setCurrentVABalance] = useState("250000");
  const [originalVAAmount, setOriginalVAAmount] = useState("300000");
  const [fundingFeeExempt, setFundingFeeExempt] = useState(false);
  const [usageType, setUsageType] = useState("first");
  const [downPayment, setDownPayment] = useState("0");

  const results = useMemo(() => {
    const limit = parseFloat(countyLimit) || DEFAULT_COUNTY_LIMIT;
    const dp = parseFloat(downPayment) || 0;

    // Full entitlement = County Limit x 25%
    const fullEntitlement = limit * 0.25;

    // Bonus entitlement = (County Limit x 25%) - Basic Entitlement
    const bonusEntitlement = fullEntitlement - BASIC_ENTITLEMENT;

    // Used entitlement (if existing VA loan)
    let usedEntitlement = 0;
    if (hasExistingVA) {
      const origAmt = parseFloat(originalVAAmount) || 0;
      usedEntitlement = origAmt * 0.25;
    }

    // Remaining entitlement
    const remainingEntitlement = Math.max(0, fullEntitlement - usedEntitlement);

    // Max loan with $0 down = Remaining Entitlement x 4
    const maxLoanNoDown = remainingEntitlement * 4;

    // Determine funding fee rate based on usage type and down payment percentage
    // Down payment percentage is relative to the max loan (or a purchase price)
    // For simplicity, we calculate based on the max loan no-down amount
    const loanAmount = maxLoanNoDown > 0 ? maxLoanNoDown - dp : 0;
    const dpPct = maxLoanNoDown > 0 ? (dp / maxLoanNoDown) * 100 : 0;

    let feeRateKey = "zero";
    if (dpPct >= 10) feeRateKey = "ten";
    else if (dpPct >= 5) feeRateKey = "five";

    const rates = usageType === "first" ? FUNDING_FEE_RATES.first : FUNDING_FEE_RATES.subsequent;
    const fundingFeeRate = rates[feeRateKey];
    const fundingFeeAmount = fundingFeeExempt ? 0 : loanAmount * fundingFeeRate;

    // Remaining entitlement color
    let entitlementColor = "green";
    const pctRemaining = fullEntitlement > 0 ? (remainingEntitlement / fullEntitlement) * 100 : 0;
    if (pctRemaining <= 25) entitlementColor = "red";
    else if (pctRemaining <= 50) entitlementColor = "amber";
    else if (pctRemaining <= 75) entitlementColor = "blue";

    return {
      fullEntitlement,
      basicEntitlement: BASIC_ENTITLEMENT,
      bonusEntitlement,
      usedEntitlement,
      remainingEntitlement,
      maxLoanNoDown,
      fundingFeeRate,
      fundingFeeAmount,
      fundingFeeExempt,
      entitlementColor,
      pctRemaining,
      loanAmount,
      dpPct,
    };
  }, [countyLimit, hasExistingVA, currentVABalance, originalVAAmount, fundingFeeExempt, usageType, downPayment]);

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-400 mb-6">
        <Link to="/app/calculators" className="text-[#2563EB] hover:underline font-medium">Calculators</Link>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><polyline points="9 18 15 12 9 6" /></svg>
        <span className="text-slate-600 font-medium">VA Entitlement</span>
      </nav>

      {/* Header */}
      <div className="flex items-start gap-5 mb-8 pb-6 border-b border-slate-200">
        <div className="w-14 h-14 min-w-[56px] rounded-2xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)", boxShadow: "0 4px 12px rgba(37,99,235,0.25)" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" y1="22" x2="4" y2="15" />
          </svg>
        </div>
        <div>
          <h1 className="text-[28px] font-extrabold text-slate-900 mb-1" style={{ letterSpacing: "-0.5px" }}>VA Entitlement Calculator</h1>
          <p className="text-[15px] text-slate-500 leading-normal">Calculate remaining VA loan entitlement, bonus entitlement, maximum loan amount, and funding fee estimates.</p>
        </div>
      </div>

      {/* Two-column layout: inputs left, results right (sticky) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Inputs — left side (3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          {/* County & Entitlement Settings */}
          <div className="bg-white border border-slate-200 rounded-xl p-6" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#DBEAFE" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-800">Loan Limits & Settings</h2>
            </div>

            <InputField
              label="County Loan Limit"
              value={countyLimit}
              onChange={(e) => setCountyLimit(e.target.value)}
              prefix="$"
              placeholder="766,550"
              helpText="2024 standard conforming limit is $766,550. High-cost areas may be higher."
            />

            <InputField label="Usage Type">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setUsageType("first")}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    usageType === "first"
                      ? "bg-[#2563EB] text-white shadow-sm"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  First Use
                </button>
                <button
                  type="button"
                  onClick={() => setUsageType("subsequent")}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    usageType === "subsequent"
                      ? "bg-[#2563EB] text-white shadow-sm"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  Subsequent Use
                </button>
              </div>
            </InputField>

            <Toggle
              label="Funding Fee Exempt? (Disability, Purple Heart, Surviving Spouse)"
              value={fundingFeeExempt}
              onChange={setFundingFeeExempt}
            />

            <InputField
              label="Down Payment Amount"
              value={downPayment}
              onChange={(e) => setDownPayment(e.target.value)}
              prefix="$"
              placeholder="0"
              helpText="Enter $0 for no down payment (most common for VA)."
            />
          </div>

          {/* Existing VA Loan Section */}
          <div className="bg-white border border-slate-200 rounded-xl p-6" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#FEF3C7" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-800">Existing VA Loan</h2>
            </div>

            <Toggle
              label="Do you have an existing VA loan?"
              value={hasExistingVA}
              onChange={setHasExistingVA}
            />

            {hasExistingVA && (
              <div className="mt-2 pt-4 border-t border-slate-100 space-y-0">
                <InputField
                  label="Original VA Loan Amount"
                  value={originalVAAmount}
                  onChange={(e) => setOriginalVAAmount(e.target.value)}
                  prefix="$"
                  placeholder="300,000"
                  helpText="The original loan amount when the VA loan was originated."
                />
                <InputField
                  label="Current VA Loan Balance"
                  value={currentVABalance}
                  onChange={(e) => setCurrentVABalance(e.target.value)}
                  prefix="$"
                  placeholder="250,000"
                  helpText="Current outstanding balance (for reference only - entitlement is based on original amount)."
                />
              </div>
            )}
          </div>
        </div>

        {/* Results — right side (2 cols), sticky */}
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-6 space-y-4">
            {/* Entitlement Breakdown Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-6" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <h3 className="text-base font-bold text-slate-800 mb-4">Entitlement Breakdown</h3>

              <EntitlementBar
                used={results.usedEntitlement}
                remaining={results.remainingEntitlement}
                total={results.fullEntitlement}
              />

              <div className="space-y-3 mt-4">
                <div className="flex items-center justify-between py-2 border-b border-slate-50">
                  <span className="text-sm text-slate-500">Basic Entitlement</span>
                  <span className="text-sm font-semibold text-slate-800">{fmtCurrency(results.basicEntitlement)}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-50">
                  <span className="text-sm text-slate-500">Bonus Entitlement</span>
                  <span className="text-sm font-semibold text-slate-800">{fmtCurrency(results.bonusEntitlement)}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-50">
                  <span className="text-sm text-slate-500">Full Entitlement</span>
                  <span className="text-sm font-bold text-slate-800">{fmtCurrency(results.fullEntitlement)}</span>
                </div>
                {hasExistingVA && (
                  <div className="flex items-center justify-between py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-500">Used Entitlement</span>
                    <span className="text-sm font-semibold text-red-500">-{fmtCurrency(results.usedEntitlement)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2.5 border-t border-slate-200 mt-1">
                  <span className="text-sm font-semibold text-slate-700">Remaining Entitlement</span>
                  <span className={`text-base font-extrabold ${
                    results.entitlementColor === "green" ? "text-emerald-600" :
                    results.entitlementColor === "blue" ? "text-[#2563EB]" :
                    results.entitlementColor === "amber" ? "text-amber-600" :
                    "text-red-600"
                  }`}>
                    {fmtCurrency(results.remainingEntitlement)}
                  </span>
                </div>
              </div>
            </div>

            {/* Max Loan Card */}
            <ResultCard
              label="Max Loan - No Down Payment"
              value={fmtCurrency(results.maxLoanNoDown)}
              subtext="Remaining Entitlement x 4"
              color={results.entitlementColor}
              large
            />

            {/* Funding Fee Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">VA Funding Fee</h3>

              {results.fundingFeeExempt ? (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" className="w-3.5 h-3.5"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600">Exempt - No Funding Fee</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Fee Rate</span>
                    <span className="text-sm font-semibold text-slate-800">{fmtPct(results.fundingFeeRate)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Down Payment %</span>
                    <span className="text-sm font-semibold text-slate-800">{results.dpPct.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-sm font-semibold text-slate-700">Fee Amount</span>
                    <span className="text-base font-bold text-[#2563EB]">{fmtCurrency(results.fundingFeeAmount)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Funding Fee Reference Table */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Funding Fee Rate Table</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400">
                    <th className="text-left py-1.5 font-semibold">Down Payment</th>
                    <th className="text-right py-1.5 font-semibold">First Use</th>
                    <th className="text-right py-1.5 font-semibold">Subsequent</th>
                  </tr>
                </thead>
                <tbody className="text-slate-600">
                  <tr className={`${usageType === "first" && results.dpPct < 5 && !fundingFeeExempt ? "font-bold text-[#2563EB]" : ""} ${usageType === "subsequent" && results.dpPct < 5 && !fundingFeeExempt ? "font-bold text-[#2563EB]" : ""}`}>
                    <td className="py-1.5">0% down</td>
                    <td className={`py-1.5 text-right ${usageType === "first" && results.dpPct < 5 && !fundingFeeExempt ? "font-bold" : ""}`}>2.15%</td>
                    <td className={`py-1.5 text-right ${usageType === "subsequent" && results.dpPct < 5 && !fundingFeeExempt ? "font-bold" : ""}`}>3.30%</td>
                  </tr>
                  <tr>
                    <td className="py-1.5">5% - 9.99%</td>
                    <td className={`py-1.5 text-right ${usageType === "first" && results.dpPct >= 5 && results.dpPct < 10 && !fundingFeeExempt ? "font-bold text-[#2563EB]" : ""}`}>1.50%</td>
                    <td className={`py-1.5 text-right ${usageType === "subsequent" && results.dpPct >= 5 && results.dpPct < 10 && !fundingFeeExempt ? "font-bold text-[#2563EB]" : ""}`}>1.50%</td>
                  </tr>
                  <tr>
                    <td className="py-1.5">10%+</td>
                    <td className={`py-1.5 text-right ${usageType === "first" && results.dpPct >= 10 && !fundingFeeExempt ? "font-bold text-[#2563EB]" : ""}`}>1.25%</td>
                    <td className={`py-1.5 text-right ${usageType === "subsequent" && results.dpPct >= 10 && !fundingFeeExempt ? "font-bold text-[#2563EB]" : ""}`}>1.25%</td>
                  </tr>
                </tbody>
              </table>
              {fundingFeeExempt && (
                <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-emerald-600 font-medium">
                  Veteran is exempt from funding fee.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-slate-400 text-center leading-relaxed mt-8">
        This calculator provides estimates for educational purposes only. VA entitlement and funding fee calculations
        may vary based on individual circumstances. Always verify with the VA Certificate of Eligibility (COE).
        County loan limits are based on 2024 FHFA limits.
      </p>
    </div>
  );
}

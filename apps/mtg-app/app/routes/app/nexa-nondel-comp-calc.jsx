import { useState, useMemo } from "react";
import { Link } from "react-router";

export function meta() {
  return [{ title: "NonDel Compensation Calculator — MtgBroker" }];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Format number as currency string */
function fmt(val) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

/** Format number as whole-dollar currency */
function fmtWhole(val) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
}

/** Format BPS with 1 decimal */
function fmtBps(val) {
  return val.toFixed(1) + " bps";
}

/** Format as percentage with 3 decimals */
function fmtPct(val) {
  return val.toFixed(3) + "%";
}

/** Parse a numeric input value, returning 0 if empty/invalid */
function parseNum(val) {
  const n = parseFloat(String(val).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function NexaNonDelCompCalc() {
  // Input state
  const [loanAmount, setLoanAmount] = useState(350000);
  const [basePrice, setBasePrice] = useState(100.5);
  const [adjustedPrice, setAdjustedPrice] = useState(99.75);
  const [srpBps, setSrpBps] = useState(25);           // SRP in bps
  const [compRate, setCompRate] = useState(100);       // LO comp in bps
  const [adminFee, setAdminFee] = useState(895);
  const [processingFee, setProcessingFee] = useState(500);
  const [branchPct, setBranchPct] = useState(0);       // 0-50%

  // ── Calculations ─────────────────────────────────────────────────────────

  const results = useMemo(() => {
    const amt = parseNum(loanAmount);
    const base = parseNum(basePrice);
    const adj = parseNum(adjustedPrice);
    const srp = parseNum(srpBps);
    const comp = parseNum(compRate);
    const admin = parseNum(adminFee);
    const proc = parseNum(processingFee);
    const branch = parseNum(branchPct);

    // Gross Margin = (Base Price - 100) + SRP (both in points, so SRP bps / 100)
    const basePremium = base - 100;               // e.g. 100.50 - 100 = 0.50 points
    const srpPoints = srp / 100;                  // e.g. 25 bps = 0.25 points
    const grossMarginPts = basePremium + srpPoints; // total margin in points

    // Price Adjustment Hit = Base Price - Adjusted Price (in points)
    const priceHitPts = base - adj;                // e.g. 100.50 - 99.75 = 0.75 points

    // Net Margin in points
    const netMarginPts = grossMarginPts - priceHitPts;

    // Convert to dollars
    const grossMarginDollars = amt * (grossMarginPts / 100);
    const priceHitDollars = amt * (priceHitPts / 100);
    const netMarginDollars = amt * (netMarginPts / 100);

    // LO Comp = Loan Amount x (Comp Rate / 10000)
    const loComp = amt * (comp / 10000);

    // Branch split on (LO Comp - Admin Fee)
    const branchSplit = (loComp - admin) * (branch / 100);

    // Net After Fees
    const netAfterFees = loComp - admin - proc - branchSplit;

    // Effective BPS to LO
    const effectiveBps = amt > 0 ? (netAfterFees / amt) * 10000 : 0;

    // Company margin (net margin revenue minus LO comp)
    const companyMargin = netMarginDollars - loComp;

    return {
      basePremium,
      srpPoints,
      grossMarginPts,
      grossMarginDollars,
      priceHitPts,
      priceHitDollars,
      netMarginPts,
      netMarginDollars,
      loComp,
      adminFee: admin,
      processingFee: proc,
      branchSplit,
      netAfterFees,
      effectiveBps,
      companyMargin,
    };
  }, [loanAmount, basePrice, adjustedPrice, srpBps, compRate, adminFee, processingFee, branchPct]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#64748B] mb-6">
        <Link to="/app/calculators" className="hover:text-[#2563EB] transition-colors no-underline text-[#64748B]">
          Calculators
        </Link>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="text-[#1E293B] font-medium">NonDel Compensation</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-5 mb-10 pb-7 border-b border-[#E2E8F0]">
        <div
          className="w-14 h-14 min-w-[56px] rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)", boxShadow: "0 4px 12px rgba(15,23,42,0.25)" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        </div>
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <h1 className="text-[28px] font-extrabold text-[#1E293B]" style={{ letterSpacing: "-0.5px" }}>
              NonDel Compensation Calculator
            </h1>
            <span
              className="text-[10px] font-extrabold text-white px-2 py-[3px] rounded tracking-[0.06em] uppercase"
              style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)" }}
            >
              NEXA
            </span>
          </div>
          <p className="text-[15px] text-[#64748B] leading-normal">
            Calculate your net compensation on non-delegated correspondent deals. Analyze pricing margins, SRP, and fee impacts.
          </p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── LEFT: Inputs ───────────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Loan Amount */}
          <InputCard label="Loan Amount">
            <DollarInput value={loanAmount} onChange={setLoanAmount} />
          </InputCard>

          {/* Pricing */}
          <InputCard label="Pricing">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1.5">Base Price</label>
                  <PriceInput value={basePrice} onChange={setBasePrice} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1.5">Adjusted Price (after LLPAs)</label>
                  <PriceInput value={adjustedPrice} onChange={setAdjustedPrice} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1.5">SRP (Service Release Premium)</label>
                <BpsInput value={srpBps} onChange={setSrpBps} />
                <p className="text-xs text-[#94A3B8] mt-1.5">Premium received for releasing servicing rights</p>
              </div>
            </div>
          </InputCard>

          {/* LO Comp Rate */}
          <InputCard label="LO Comp Rate (BPS)">
            <BpsInput value={compRate} onChange={setCompRate} />
            <p className="text-xs text-[#94A3B8] mt-1.5">Your compensation rate in basis points on the loan amount</p>
          </InputCard>

          {/* Fees */}
          <InputCard label="Fees & Splits">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1.5">Admin Fee</label>
                <DollarInput value={adminFee} onChange={setAdminFee} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1.5">Processing Fee</label>
                <DollarInput value={processingFee} onChange={setProcessingFee} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1.5">
                  Branch Fee / Split — {parseNum(branchPct)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={branchPct}
                  onChange={(e) => setBranchPct(Number(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#2563EB]"
                  style={{ background: `linear-gradient(to right, #2563EB 0%, #2563EB ${branchPct * 2}%, #E2E8F0 ${branchPct * 2}%, #E2E8F0 100%)` }}
                />
                <div className="flex justify-between text-[11px] text-[#94A3B8] mt-1">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                </div>
              </div>
            </div>
          </InputCard>
        </div>

        {/* ── RIGHT: Results ─────────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Net to LO — big prominent number */}
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)", boxShadow: "0 8px 24px rgba(15,23,42,0.3)" }}
          >
            <p className="text-[#94A3B8] text-sm font-medium mb-2">Net to LO</p>
            <p className="text-[42px] font-extrabold text-white mb-1" style={{ letterSpacing: "-1px" }}>
              {fmt(results.netAfterFees)}
            </p>
            <p className="text-[#60A5FA] text-lg font-semibold">
              {fmtBps(results.effectiveBps)} effective
            </p>
          </div>

          {/* Pricing Breakdown */}
          <ResultCard title="Pricing Breakdown">
            <ResultRow label="Base Price" value={parseNum(basePrice).toFixed(3)} />
            <ResultRow label="Base Premium (above par)" value={`${results.basePremium >= 0 ? "+" : ""}${(results.basePremium).toFixed(3)} pts`} highlight={results.basePremium > 0} />
            <ResultRow label={`SRP (${parseNum(srpBps)} bps)`} value={`+${results.srpPoints.toFixed(3)} pts`} highlight />
            <div className="border-t border-[#E2E8F0] my-3" />
            <ResultRow label="Gross Margin" value={`${results.grossMarginPts.toFixed(3)} pts (${fmt(results.grossMarginDollars)})`} bold />
            <div className="border-t border-[#E2E8F0] my-3" />
            <ResultRow label="Adjusted Price (after LLPAs)" value={parseNum(adjustedPrice).toFixed(3)} />
            <ResultRow label="LLPA Price Hit" value={`-${results.priceHitPts.toFixed(3)} pts (${fmt(results.priceHitDollars)})`} deduction />
            <div className="border-t border-[#E2E8F0] my-3" />
            <ResultRow label="Net Margin" value={`${results.netMarginPts.toFixed(3)} pts (${fmt(results.netMarginDollars)})`} bold />
          </ResultCard>

          {/* LO Compensation */}
          <ResultCard title="LO Compensation">
            <ResultRow label={`LO Comp (${parseNum(compRate)} bps on ${fmtWhole(parseNum(loanAmount))})`} value={fmt(results.loComp)} highlight />
            <div className="border-t border-[#E2E8F0] my-3" />
            <ResultRow label="Less: Admin Fee" value={`- ${fmt(results.adminFee)}`} deduction />
            <ResultRow label="Less: Processing Fee" value={`- ${fmt(results.processingFee)}`} deduction />
            <ResultRow label={`Less: Branch Split (${parseNum(branchPct)}%)`} value={`- ${fmt(results.branchSplit)}`} deduction />
            <div className="border-t border-[#E2E8F0] my-3" />
            <ResultRow label="Net to LO" value={fmt(results.netAfterFees)} bold />
            <ResultRow label="Effective BPS" value={fmtBps(results.effectiveBps)} bold />
          </ResultCard>

          {/* Margin Analysis */}
          <ResultCard title="Margin Analysis">
            <div className="grid grid-cols-3 gap-4 text-center mb-4">
              <div className="rounded-xl bg-[#EFF6FF] p-4">
                <p className="text-xs text-[#64748B] font-medium mb-1">Net Margin</p>
                <p className="text-lg font-bold text-[#2563EB]">{fmt(results.netMarginDollars)}</p>
                <p className="text-xs text-[#94A3B8] mt-0.5">{results.netMarginPts.toFixed(3)} pts</p>
              </div>
              <div className="rounded-xl bg-[#F0FDF4] p-4">
                <p className="text-xs text-[#64748B] font-medium mb-1">LO Comp</p>
                <p className="text-lg font-bold text-[#16A34A]">{fmt(results.loComp)}</p>
                <p className="text-xs text-[#94A3B8] mt-0.5">{parseNum(compRate)} bps</p>
              </div>
              <div className={`rounded-xl p-4 ${results.companyMargin >= 0 ? "bg-[#EFF6FF]" : "bg-[#FEF2F2]"}`}>
                <p className="text-xs text-[#64748B] font-medium mb-1">Company Margin</p>
                <p className={`text-lg font-bold ${results.companyMargin >= 0 ? "text-[#2563EB]" : "text-[#DC2626]"}`}>
                  {fmt(results.companyMargin)}
                </p>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  {parseNum(loanAmount) > 0 ? fmtBps((results.companyMargin / parseNum(loanAmount)) * 10000) : "0.0 bps"}
                </p>
              </div>
            </div>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Company margin = Net margin revenue minus LO compensation (before LO fees).
              {results.companyMargin < 0
                ? " Negative margin means LO comp exceeds the deal's net margin — review pricing or comp rate."
                : " Positive margin indicates the deal covers LO comp with room for company overhead."}
            </p>
          </ResultCard>
        </div>
      </div>
    </div>
  );
}

// ── Shared Sub-Components ────────────────────────────────────────────────────

/** Card wrapper for input sections */
function InputCard({ label, children }) {
  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <label className="block text-sm font-semibold text-[#1E293B] mb-3">{label}</label>
      {children}
    </div>
  );
}

/** Card wrapper for result sections */
function ResultCard({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-6" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <h3 className="text-sm font-bold text-[#1E293B] mb-4">{title}</h3>
      {children}
    </div>
  );
}

/** Single row in a result card */
function ResultRow({ label, value, highlight, bold, deduction, sublabel }) {
  if (sublabel) {
    return <p className="text-xs text-[#94A3B8] -mt-1 mb-2">{label}</p>;
  }
  return (
    <div className={`flex justify-between items-center py-1.5 ${bold ? "font-bold" : ""}`}>
      <span className={`text-sm ${bold ? "text-[#1E293B]" : "text-[#64748B]"}`}>{label}</span>
      <span className={`text-sm font-semibold ${
        highlight ? "text-[#2563EB]" :
        deduction ? "text-[#DC2626]" :
        bold ? "text-[#1E293B]" :
        "text-[#1E293B]"
      }`}>
        {value}
      </span>
    </div>
  );
}

/** Dollar input with $ prefix */
function DollarInput({ value, onChange }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] text-sm font-medium">$</span>
      <input
        type="text"
        value={Number(value).toLocaleString("en-US")}
        onChange={(e) => onChange(parseNum(e.target.value))}
        className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm text-[#1E293B] font-medium focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
      />
    </div>
  );
}

/** BPS input */
function BpsInput({ value, onChange }) {
  return (
    <div className="relative">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full pr-12 pl-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm text-[#1E293B] font-medium focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] text-xs font-medium">bps</span>
    </div>
  );
}

/** Price input (e.g. 100.500) */
function PriceInput({ value, onChange }) {
  return (
    <input
      type="number"
      step="0.125"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm text-[#1E293B] font-medium focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
    />
  );
}

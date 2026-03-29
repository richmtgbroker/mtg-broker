import { useState, useMemo } from "react";
import { Link } from "react-router";

export function meta() {
  return [{ title: "Broker Compensation Calculator — MtgBroker" }];
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

/** Parse a numeric input value, returning 0 if empty/invalid */
function parseNum(val) {
  const n = parseFloat(String(val).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function NexaBrokerCompCalc() {
  // Input state
  const [loanAmount, setLoanAmount] = useState(350000);
  const [compType, setCompType] = useState("LPC"); // LPC or BPC
  const [compRate, setCompRate] = useState(275);     // bps
  const [basePrice, setBasePrice] = useState(100.0);
  const [adjustedPrice, setAdjustedPrice] = useState(99.5);
  const [adminFee, setAdminFee] = useState(895);
  const [branchPct, setBranchPct] = useState(0);     // 0-50%
  const [processingFee, setProcessingFee] = useState(500);

  // ── Calculations ─────────────────────────────────────────────────────────

  const results = useMemo(() => {
    const amt = parseNum(loanAmount);
    const rate = parseNum(compRate);
    const admin = parseNum(adminFee);
    const proc = parseNum(processingFee);
    const branch = parseNum(branchPct);
    const base = parseNum(basePrice);
    const adj = parseNum(adjustedPrice);

    // Gross Revenue = Loan Amount x (Comp Rate / 10000)
    const grossRevenue = amt * (rate / 10000);

    // Branch split is applied to (Gross Revenue - Admin Fee)
    const branchSplit = (grossRevenue - admin) * (branch / 100);

    // Net to LO
    const netToLO = grossRevenue - admin - proc - branchSplit;

    // Effective BPS to LO
    const effectiveBps = amt > 0 ? (netToLO / amt) * 10000 : 0;

    // Price adjustment (for BPC context — how much the rate impacts borrower)
    const priceHit = base - adj; // in points

    // Comparison: +/- 25 bps
    const compPlus25 = amt * ((rate + 25) / 10000);
    const branchPlus25 = (compPlus25 - admin) * (branch / 100);
    const netPlus25 = compPlus25 - admin - proc - branchPlus25;
    const bpsPlus25 = amt > 0 ? (netPlus25 / amt) * 10000 : 0;

    const compMinus25 = amt * ((rate - 25) / 10000);
    const branchMinus25 = (compMinus25 - admin) * (branch / 100);
    const netMinus25 = compMinus25 - admin - proc - branchMinus25;
    const bpsMinus25 = amt > 0 ? (netMinus25 / amt) * 10000 : 0;

    return {
      grossRevenue,
      adminFee: admin,
      processingFee: proc,
      branchSplit,
      netToLO,
      effectiveBps,
      priceHit,
      compPlus25,
      netPlus25,
      bpsPlus25,
      compMinus25,
      netMinus25,
      bpsMinus25,
    };
  }, [loanAmount, compRate, adminFee, processingFee, branchPct, basePrice, adjustedPrice, compType]);

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
        <span className="text-[#1E293B] font-medium">Broker Compensation</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-5 mb-10 pb-7 border-b border-[#E2E8F0]">
        <div
          className="w-14 h-14 min-w-[56px] rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)", boxShadow: "0 4px 12px rgba(15,23,42,0.25)" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <h1 className="text-[28px] font-extrabold text-[#1E293B]" style={{ letterSpacing: "-0.5px" }}>
              Broker Compensation Calculator
            </h1>
            <span
              className="text-[10px] font-extrabold text-white px-2 py-[3px] rounded tracking-[0.06em] uppercase"
              style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)" }}
            >
              NEXA
            </span>
          </div>
          <p className="text-[15px] text-[#64748B] leading-normal">
            Calculate your net compensation on broker channel deals. Toggle between LPC (Lender Paid) and BPC (Borrower Paid) structures.
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

          {/* Comp Type Toggle */}
          <InputCard label="Compensation Type">
            <div className="flex rounded-lg overflow-hidden border border-[#E2E8F0]">
              <button
                onClick={() => setCompType("LPC")}
                className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                  compType === "LPC"
                    ? "bg-[#2563EB] text-white"
                    : "bg-white text-[#64748B] hover:bg-[#F8FAFC]"
                }`}
              >
                LPC (Lender Paid)
              </button>
              <button
                onClick={() => setCompType("BPC")}
                className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                  compType === "BPC"
                    ? "bg-[#2563EB] text-white"
                    : "bg-white text-[#64748B] hover:bg-[#F8FAFC]"
                }`}
              >
                BPC (Borrower Paid)
              </button>
            </div>
          </InputCard>

          {/* Comp Rate */}
          <InputCard label="Comp Rate (BPS)">
            <BpsInput value={compRate} onChange={setCompRate} />
            <p className="text-xs text-[#94A3B8] mt-1.5">
              {compType === "LPC" ? "Lender-paid compensation in basis points" : "Borrower-paid compensation in basis points"}
            </p>
          </InputCard>

          {/* Pricing */}
          <InputCard label="Pricing">
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
              {fmt(results.netToLO)}
            </p>
            <p className="text-[#60A5FA] text-lg font-semibold">
              {fmtBps(results.effectiveBps)} effective
            </p>
          </div>

          {/* Compensation Breakdown */}
          <ResultCard title="Compensation Breakdown">
            <ResultRow label="Gross Revenue" value={fmt(results.grossRevenue)} highlight />
            <ResultRow label={`Comp Rate: ${parseNum(compRate)} bps on ${fmtWhole(parseNum(loanAmount))}`} value="" sublabel />
            <div className="border-t border-[#E2E8F0] my-3" />
            <ResultRow label="Less: Admin Fee" value={`- ${fmt(results.adminFee)}`} deduction />
            <ResultRow label="Less: Processing Fee" value={`- ${fmt(results.processingFee)}`} deduction />
            <ResultRow label={`Less: Branch Split (${parseNum(branchPct)}%)`} value={`- ${fmt(results.branchSplit)}`} deduction />
            <div className="border-t border-[#E2E8F0] my-3" />
            <ResultRow label="Net to LO" value={fmt(results.netToLO)} bold />
            <ResultRow label="Effective BPS" value={fmtBps(results.effectiveBps)} bold />
          </ResultCard>

          {/* Pricing Impact (BPC context) */}
          {compType === "BPC" && (
            <ResultCard title="Borrower Impact">
              <ResultRow label="Base Price" value={parseNum(basePrice).toFixed(3)} />
              <ResultRow label="Adjusted Price (after LLPAs)" value={parseNum(adjustedPrice).toFixed(3)} />
              <ResultRow label="LLPA Price Hit" value={`${(results.priceHit * 100).toFixed(1)} bps`} deduction={results.priceHit > 0} />
              <div className="border-t border-[#E2E8F0] my-3" />
              <p className="text-xs text-[#64748B] leading-relaxed">
                With BPC, the borrower pays the compensation directly. The comp of {parseNum(compRate)} bps ({fmt(results.grossRevenue)}) adds to
                the borrower's closing costs. LLPA adjustments reduce the net price by {(results.priceHit * 100).toFixed(1)} bps.
              </p>
            </ResultCard>
          )}

          {/* Comparison: +/- 25 bps */}
          <ResultCard title="What If: Comp Rate +/- 25 bps">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-xl bg-[#FEF2F2] p-4">
                <p className="text-xs text-[#64748B] font-medium mb-1">{parseNum(compRate) - 25} bps</p>
                <p className="text-lg font-bold text-[#DC2626]">{fmt(results.netMinus25)}</p>
                <p className="text-xs text-[#94A3B8] mt-0.5">{fmtBps(results.bpsMinus25)}</p>
              </div>
              <div className="rounded-xl bg-[#EFF6FF] p-4 ring-2 ring-[#2563EB]">
                <p className="text-xs text-[#64748B] font-medium mb-1">{parseNum(compRate)} bps</p>
                <p className="text-lg font-bold text-[#2563EB]">{fmt(results.netToLO)}</p>
                <p className="text-xs text-[#94A3B8] mt-0.5">{fmtBps(results.effectiveBps)}</p>
              </div>
              <div className="rounded-xl bg-[#F0FDF4] p-4">
                <p className="text-xs text-[#64748B] font-medium mb-1">{parseNum(compRate) + 25} bps</p>
                <p className="text-lg font-bold text-[#16A34A]">{fmt(results.netPlus25)}</p>
                <p className="text-xs text-[#94A3B8] mt-0.5">{fmtBps(results.bpsPlus25)}</p>
              </div>
            </div>
            <p className="text-xs text-[#94A3B8] mt-3 text-center">
              Difference: {fmt(results.netPlus25 - results.netMinus25)} spread across 50 bps
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

/** Price input (e.g. 100.000) */
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

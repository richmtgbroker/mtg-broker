import { useState, useCallback } from "react";
import { Link } from "react-router";

export function meta() {
  return [{ title: "Blended Rate — MtgBroker" }];
}

// ── Colors ──────────────────────────────────────────
var BLUE = "#2563EB";
var BLUE_DARK = "#1E40AF";
var TEXT = "#0F172A";
var MUTED = "#64748B";
var BORDER = "#E2E8F0";
var BG_LIGHT = "#F8FAFC";

// Bar colors for each loan (up to 5)
var BAR_COLORS = ["#2563EB", "#F59E0B", "#10B981", "#8B5CF6", "#EF4444"];
var BAR_BG_COLORS = ["#DBEAFE", "#FEF3C7", "#D1FAE5", "#EDE9FE", "#FEE2E2"];

// ── Helpers ─────────────────────────────────────────
function formatCurrency(n) {
  if (n == null || isNaN(n)) return "$0";
  return "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatRate(n) {
  if (n == null || isNaN(n)) return "0.000%";
  return n.toFixed(3) + "%";
}

function formatRateShort(n) {
  if (n == null || isNaN(n)) return "0.00%";
  return n.toFixed(2) + "%";
}

/**
 * Monthly P&I for a fixed-rate fully-amortizing loan (30 year)
 * M = P * [r(1+r)^n] / [(1+r)^n - 1]
 */
function calcMonthlyPI(principal, annualRate) {
  if (!principal || principal <= 0 || !annualRate || annualRate <= 0) return 0;
  var r = annualRate / 100 / 12;
  var n = 360; // 30 years
  var factor = Math.pow(1 + r, n);
  return principal * (r * factor) / (factor - 1);
}

// Default loan templates
function makeDefaultLoans() {
  return [
    { id: 1, label: "1st Lien", amount: 350000, rate: 6.75 },
    { id: 2, label: "2nd Lien", amount: 50000, rate: 9.5 },
  ];
}

var nextId = 3;

// ── Main Component ──────────────────────────────────
export default function BlendedRateCalculator() {
  var [loans, setLoans] = useState(makeDefaultLoans);

  var updateLoan = useCallback(function (id, field, value) {
    setLoans(function (prev) {
      return prev.map(function (loan) {
        if (loan.id !== id) return loan;
        var updated = Object.assign({}, loan);
        updated[field] = value;
        return updated;
      });
    });
  }, []);

  var addLoan = useCallback(function () {
    setLoans(function (prev) {
      if (prev.length >= 5) return prev;
      var num = prev.length + 1;
      var label = num === 3 ? "HELOC" : num + getSuffix(num) + " Lien";
      return prev.concat([{ id: nextId++, label: label, amount: 0, rate: 0 }]);
    });
  }, []);

  var removeLoan = useCallback(function (id) {
    setLoans(function (prev) {
      if (prev.length <= 2) return prev;
      return prev.filter(function (l) { return l.id !== id; });
    });
  }, []);

  // ── Calculations ──────────────────────────────────
  var totalAmount = 0;
  var weightedSum = 0;
  var monthlyPayments = [];

  loans.forEach(function (loan) {
    var amt = parseFloat(loan.amount) || 0;
    var rate = parseFloat(loan.rate) || 0;
    totalAmount += amt;
    weightedSum += amt * rate;
    monthlyPayments.push(calcMonthlyPI(amt, rate));
  });

  var blendedRate = totalAmount > 0 ? weightedSum / totalAmount : 0;
  var totalMonthly = 0;
  monthlyPayments.forEach(function (p) { totalMonthly += p; });

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] mb-4 flex-wrap" style={{ color: MUTED }}>
        <Link to="/app/calculators" className="no-underline font-medium" style={{ color: BLUE }}>
          <i className="fa-solid fa-arrow-left mr-1.5" style={{ fontSize: 11 }} />
          Calculators
        </Link>
        <span style={{ color: "#CBD5E1" }}>/</span>
        <span className="font-semibold" style={{ color: TEXT }}>Blended Rate</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-start gap-5 mb-8 pb-6 border-b border-[#E2E8F0]">
        <div
          className="w-14 h-14 min-w-[56px] rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, " + BLUE + " 0%, " + BLUE_DARK + " 100%)", boxShadow: "0 4px 12px rgba(37,99,235,0.25)" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
        </div>
        <div>
          <h1 className="text-[28px] font-extrabold mb-1.5" style={{ color: TEXT, letterSpacing: "-0.5px" }}>
            Blended Rate Calculator
          </h1>
          <p className="text-[15px] leading-normal" style={{ color: MUTED }}>
            Calculate the weighted average interest rate across multiple loans or liens.
          </p>
        </div>
      </div>

      {/* Two-column layout on desktop, stacked on mobile */}
      <div className="grid gap-8" style={{ gridTemplateColumns: "1fr" }}>
        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Left: Loan Input Cards */}
          <div>
            {loans.map(function (loan, idx) {
              return (
                <LoanCard
                  key={loan.id}
                  loan={loan}
                  index={idx}
                  canRemove={loans.length > 2}
                  onUpdate={updateLoan}
                  onRemove={removeLoan}
                  color={BAR_COLORS[idx] || BAR_COLORS[0]}
                />
              );
            })}

            {/* Add Loan Button */}
            {loans.length < 5 && (
              <button
                onClick={addLoan}
                className="w-full py-3.5 rounded-xl border-2 border-dashed text-sm font-semibold cursor-pointer transition-all duration-200 hover:border-[#2563EB] hover:bg-[#EFF6FF]"
                style={{ background: "transparent", borderColor: "#CBD5E1", color: BLUE }}
              >
                <i className="fa-solid fa-plus mr-2" style={{ fontSize: 11 }} />
                Add Loan ({loans.length}/5)
              </button>
            )}
          </div>

          {/* Right: Results Panel */}
          <div className="lg:sticky lg:top-4 lg:self-start">
            <ResultsPanel
              loans={loans}
              blendedRate={blendedRate}
              totalAmount={totalAmount}
              monthlyPayments={monthlyPayments}
              totalMonthly={totalMonthly}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Loan Input Card ─────────────────────────────────
function LoanCard({ loan, index, canRemove, onUpdate, onRemove, color }) {
  function handleAmountChange(e) {
    var raw = e.target.value.replace(/[^0-9]/g, "");
    onUpdate(loan.id, "amount", raw === "" ? "" : parseInt(raw, 10));
  }

  function handleRateChange(e) {
    var val = e.target.value;
    // Allow empty, digits, and one decimal point
    if (val === "" || /^\d*\.?\d{0,4}$/.test(val)) {
      onUpdate(loan.id, "rate", val);
    }
  }

  function handleLabelChange(e) {
    onUpdate(loan.id, "label", e.target.value);
  }

  var displayAmount = loan.amount === "" || loan.amount === 0 ? "" : Number(loan.amount).toLocaleString("en-US");

  return (
    <div
      className="rounded-2xl border p-6 mb-4 relative transition-all duration-200"
      style={{ background: "#FFFFFF", borderColor: BORDER, borderLeft: "4px solid " + color, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
    >
      {/* Loan number badge + remove button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: color }}
          >
            {index + 1}
          </div>
          <input
            type="text"
            value={loan.label}
            onChange={handleLabelChange}
            className="text-base font-semibold border-none outline-none bg-transparent"
            style={{ color: TEXT, width: Math.max(80, loan.label.length * 10) }}
          />
        </div>
        {canRemove && (
          <button
            onClick={function () { onRemove(loan.id); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center border cursor-pointer transition-colors duration-150 hover:bg-red-50 hover:border-red-200"
            style={{ background: "transparent", borderColor: BORDER, color: MUTED }}
            title="Remove loan"
          >
            <i className="fa-solid fa-xmark" style={{ fontSize: 13 }} />
          </button>
        )}
      </div>

      {/* Inputs row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Loan Amount */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: MUTED }}>
            Loan Amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: MUTED }}>$</span>
            <input
              type="text"
              inputMode="numeric"
              value={displayAmount}
              onChange={handleAmountChange}
              placeholder="0"
              className="w-full py-2.5 pl-7 pr-3 rounded-lg border text-sm font-medium outline-none transition-colors duration-150 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
              style={{ borderColor: BORDER, color: TEXT, background: "#FFFFFF" }}
            />
          </div>
        </div>

        {/* Interest Rate */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: MUTED }}>
            Interest Rate
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              value={loan.rate}
              onChange={handleRateChange}
              placeholder="0.00"
              className="w-full py-2.5 pl-3 pr-8 rounded-lg border text-sm font-medium outline-none transition-colors duration-150 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
              style={{ borderColor: BORDER, color: TEXT, background: "#FFFFFF" }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: MUTED }}>%</span>
          </div>
        </div>
      </div>

      {/* Monthly P&I preview */}
      {(parseFloat(loan.amount) > 0 && parseFloat(loan.rate) > 0) && (
        <div className="mt-3 pt-3 border-t flex items-center justify-between" style={{ borderColor: "#F1F5F9" }}>
          <span className="text-xs" style={{ color: MUTED }}>Monthly P&I (30yr)</span>
          <span className="text-sm font-semibold" style={{ color: TEXT }}>
            {formatCurrency(calcMonthlyPI(parseFloat(loan.amount), parseFloat(loan.rate)))}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Results Panel ───────────────────────────────────
function ResultsPanel({ loans, blendedRate, totalAmount, monthlyPayments, totalMonthly }) {
  var hasData = totalAmount > 0;

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ background: "#FFFFFF", borderColor: BORDER, boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}
    >
      {/* Blended Rate Hero */}
      <div
        className="px-6 py-8 text-center"
        style={{ background: "linear-gradient(135deg, " + BLUE + " 0%, " + BLUE_DARK + " 100%)" }}
      >
        <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.7)" }}>
          Blended Rate
        </div>
        <div className="text-[48px] font-extrabold leading-none mb-1" style={{ color: "#FFFFFF", letterSpacing: "-1px" }}>
          {hasData ? formatRate(blendedRate) : "—"}
        </div>
        <div className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.7)" }}>
          Weighted average across {loans.length} loan{loans.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="px-6 py-5 border-b" style={{ borderColor: BORDER, background: BG_LIGHT }}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: MUTED }}>Total Amount</div>
            <div className="text-lg font-bold" style={{ color: TEXT }}>{formatCurrency(totalAmount)}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: MUTED }}>Total Monthly P&I</div>
            <div className="text-lg font-bold" style={{ color: TEXT }}>{formatCurrency(totalMonthly)}</div>
          </div>
        </div>
      </div>

      {/* Visual Proportion Bar */}
      {hasData && (
        <div className="px-6 py-5 border-b" style={{ borderColor: BORDER }}>
          <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: MUTED }}>
            Loan Proportion
          </div>
          <div className="flex rounded-lg overflow-hidden h-5 gap-[2px]">
            {loans.map(function (loan, idx) {
              var amt = parseFloat(loan.amount) || 0;
              var pct = totalAmount > 0 ? (amt / totalAmount) * 100 : 0;
              if (pct <= 0) return null;
              return (
                <div
                  key={loan.id}
                  className="h-full relative group"
                  style={{
                    width: pct + "%",
                    background: BAR_COLORS[idx] || BAR_COLORS[0],
                    minWidth: pct > 0 ? 8 : 0,
                    transition: "width 0.3s ease",
                  }}
                  title={loan.label + ": " + pct.toFixed(1) + "%"}
                />
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
            {loans.map(function (loan, idx) {
              var amt = parseFloat(loan.amount) || 0;
              var pct = totalAmount > 0 ? (amt / totalAmount) * 100 : 0;
              return (
                <div key={loan.id} className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: BAR_COLORS[idx] || BAR_COLORS[0] }} />
                  {loan.label} ({pct.toFixed(1)}%)
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Weighted Breakdown */}
      <div className="px-6 py-5">
        <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: MUTED }}>
          Loan Breakdown
        </div>
        <div className="flex flex-col gap-3">
          {loans.map(function (loan, idx) {
            var amt = parseFloat(loan.amount) || 0;
            var rate = parseFloat(loan.rate) || 0;
            var contribution = totalAmount > 0 ? (amt * rate) / totalAmount : 0;
            var monthly = monthlyPayments[idx] || 0;

            return (
              <div
                key={loan.id}
                className="rounded-xl p-4"
                style={{ background: BAR_BG_COLORS[idx] || BAR_BG_COLORS[0] }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ background: BAR_COLORS[idx] || BAR_COLORS[0] }}
                    >
                      {idx + 1}
                    </div>
                    <span className="text-sm font-semibold" style={{ color: TEXT }}>{loan.label}</span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: BAR_COLORS[idx] || BAR_COLORS[0] }}>
                    {formatRateShort(rate)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs" style={{ color: MUTED }}>
                  <div>
                    <div className="font-medium mb-0.5">Amount</div>
                    <div className="font-semibold" style={{ color: TEXT }}>{formatCurrency(amt)}</div>
                  </div>
                  <div>
                    <div className="font-medium mb-0.5">Contribution</div>
                    <div className="font-semibold" style={{ color: TEXT }}>+{formatRateShort(contribution)}</div>
                  </div>
                  <div>
                    <div className="font-medium mb-0.5">Monthly P&I</div>
                    <div className="font-semibold" style={{ color: TEXT }}>{formatCurrency(monthly)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Total row */}
        {hasData && (
          <div className="mt-4 pt-4 border-t flex items-center justify-between" style={{ borderColor: BORDER }}>
            <span className="text-sm font-semibold" style={{ color: TEXT }}>Combined Monthly P&I</span>
            <span className="text-lg font-bold" style={{ color: BLUE }}>{formatCurrency(totalMonthly)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Utility ─────────────────────────────────────────
function getSuffix(n) {
  if (n === 1) return "st";
  if (n === 2) return "nd";
  if (n === 3) return "rd";
  return "th";
}

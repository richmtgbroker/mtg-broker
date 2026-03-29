import { useState, useMemo } from "react";
import { Link } from "react-router";

export function meta() {
  return [{ title: "Closing Costs Estimator — MtgBroker" }];
}

/* ── US States ── */
const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

/* ── Helpers ── */
const fmt = (v) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
const fmtDec = (v) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

function NumberInput({ label, value, onChange, prefix = "$", step = 1, min = 0, small = false }) {
  return (
    <div className={small ? "flex-1 min-w-[120px]" : ""}>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          step={step}
          min={min}
          className="w-full border border-slate-300 rounded-lg py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          style={{ paddingLeft: prefix ? 28 : 12, paddingRight: 12 }}
        />
      </div>
    </div>
  );
}

function SelectInput({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
      >
        {options.map((o) => (
          <option key={typeof o === "string" ? o : o.value} value={typeof o === "string" ? o : o.value}>
            {typeof o === "string" ? o : o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ── Default line items factory ── */
function buildDefaults(loanAmount, homePrice, rate) {
  const dailyInterest = (loanAmount * (rate / 100)) / 365;
  return [
    { id: "origination",   label: "Origination Fee",          default: Math.round(loanAmount * 0.01), editable: true },
    { id: "appraisal",     label: "Appraisal",                default: 550, editable: true },
    { id: "credit",        label: "Credit Report",            default: 65, editable: true },
    { id: "title-ins",     label: "Title Insurance",          default: Math.round(homePrice * 0.005), editable: true },
    { id: "title-search",  label: "Title Search",             default: 250, editable: true },
    { id: "recording",     label: "Recording Fees",           default: 150, editable: true },
    { id: "survey",        label: "Survey",                   default: 400, editable: true },
    { id: "attorney",      label: "Attorney / Settlement Fee",default: 750, editable: true },
    { id: "prepaid-int",   label: "Prepaid Interest (15 days)", default: Math.round(dailyInterest * 15), editable: true },
    { id: "insurance",     label: "Homeowner's Insurance (3 mo prepaid)", default: 450, editable: true },
    { id: "tax-escrow",    label: "Property Tax Escrow (3 mo)", default: Math.round((homePrice * 0.0125 / 12) * 3), editable: true },
    { id: "flood",         label: "Flood Certification",      default: 15, editable: true },
  ];
}

export default function ClosingCostsEstimator() {
  // Inputs
  const [loanAmount, setLoanAmount] = useState(350000);
  const [homePrice, setHomePrice] = useState(400000);
  const [state, setState] = useState("CA");
  const [loanType, setLoanType] = useState("Conventional");
  const [isPurchase, setIsPurchase] = useState("yes");
  const [rate, setRate] = useState(6.75);
  const [lenderCredit, setLenderCredit] = useState(0);

  // Editable line items: store overrides keyed by id
  const [overrides, setOverrides] = useState({});

  const defaults = useMemo(() => buildDefaults(loanAmount, homePrice, rate), [loanAmount, homePrice, rate]);

  const lineItems = defaults.map((item) => ({
    ...item,
    amount: overrides[item.id] !== undefined ? overrides[item.id] : item.default,
  }));

  const totalClosingCosts = lineItems.reduce((sum, li) => sum + li.amount, 0);
  const downPayment = isPurchase === "yes" ? homePrice - loanAmount : 0;
  const cashToClose = isPurchase === "yes" ? downPayment + totalClosingCosts - lenderCredit : totalClosingCosts - lenderCredit;

  const handleOverride = (id, val) => {
    setOverrides((prev) => ({ ...prev, [id]: val }));
  };

  const resetOverrides = () => setOverrides({});

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-slate-500 mb-4 flex-wrap">
        <Link to="/app/calculators" className="text-[#2563EB] no-underline font-medium hover:underline">
          <i className="fa-solid fa-arrow-left mr-1 text-[11px]" />
          Calculators
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-900 font-semibold">Closing Costs Estimator</span>
      </nav>

      {/* Header */}
      <div className="flex items-start gap-5 mb-8 pb-6 border-b border-slate-200">
        <div
          className="w-14 h-14 min-w-[56px] rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)", boxShadow: "0 4px 12px rgba(37,99,235,0.25)" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
            <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
        <div>
          <h1 className="text-[28px] font-extrabold text-slate-900 mb-1" style={{ letterSpacing: "-0.5px" }}>Closing Costs Estimator</h1>
          <p className="text-[15px] text-slate-500 leading-normal">Estimate title fees, recording fees, and pre-paids for a clear cash-to-close picture.</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-8">
        {/* Left: Inputs */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <h2 className="text-base font-bold text-slate-800 mb-2">Loan Details</h2>
            <NumberInput label="Loan Amount" value={loanAmount} onChange={setLoanAmount} />
            <NumberInput label="Home Price" value={homePrice} onChange={setHomePrice} />
            <NumberInput label="Interest Rate" value={rate} onChange={setRate} prefix="%" step={0.125} />
            <SelectInput label="State" value={state} onChange={setState} options={US_STATES} />
            <SelectInput
              label="Loan Type"
              value={loanType}
              onChange={setLoanType}
              options={["Conventional", "FHA", "VA", "USDA"]}
            />
            <SelectInput
              label="Is Purchase?"
              value={isPurchase}
              onChange={setIsPurchase}
              options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No (Refinance)" }]}
            />
            <NumberInput label="Lender Credit" value={lenderCredit} onChange={setLenderCredit} />
          </div>
        </div>

        {/* Right: Results */}
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard label="Total Closing Costs" value={fmt(totalClosingCosts)} color="#2563EB" />
            {isPurchase === "yes" && <SummaryCard label="Down Payment" value={fmt(downPayment)} color="#0891B2" />}
            <SummaryCard
              label={isPurchase === "yes" ? "Cash to Close" : "Costs After Credits"}
              value={fmt(cashToClose)}
              color="#059669"
              highlight
            />
          </div>

          {/* Line items table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">Cost Breakdown</h2>
              <button
                onClick={resetOverrides}
                className="text-xs text-[#2563EB] font-semibold hover:underline cursor-pointer bg-transparent border-none"
              >
                Reset to Defaults
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Item</th>
                  <th className="px-6 py-3 text-right w-[160px]">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((li) => (
                  <tr key={li.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="px-6 py-3 text-slate-700">{li.label}</td>
                    <td className="px-6 py-3 text-right">
                      <div className="relative inline-block">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                        <input
                          type="number"
                          value={li.amount}
                          onChange={(e) => handleOverride(li.id, Number(e.target.value))}
                          className="w-[120px] border border-slate-200 rounded-md py-1 pl-6 pr-2 text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {lenderCredit > 0 && (
                  <tr className="border-t border-slate-100">
                    <td className="px-6 py-3 text-green-700 font-medium">Lender Credit</td>
                    <td className="px-6 py-3 text-right text-green-700 font-medium">-{fmt(lenderCredit)}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td className="px-6 py-3 font-bold text-slate-900">Total Closing Costs</td>
                  <td className="px-6 py-3 text-right font-bold text-slate-900">{fmt(totalClosingCosts)}</td>
                </tr>
                {isPurchase === "yes" && (
                  <>
                    <tr className="border-t border-slate-100 bg-slate-50">
                      <td className="px-6 py-3 text-slate-600 font-medium">+ Down Payment</td>
                      <td className="px-6 py-3 text-right text-slate-600 font-medium">{fmt(downPayment)}</td>
                    </tr>
                    {lenderCredit > 0 && (
                      <tr className="border-t border-slate-100 bg-slate-50">
                        <td className="px-6 py-3 text-green-700 font-medium">- Lender Credit</td>
                        <td className="px-6 py-3 text-right text-green-700 font-medium">{fmt(lenderCredit)}</td>
                      </tr>
                    )}
                  </>
                )}
                <tr className="border-t-2 border-[#2563EB]/20 bg-blue-50">
                  <td className="px-6 py-4 font-extrabold text-[#2563EB] text-base">
                    {isPurchase === "yes" ? "Cash to Close" : "Net Closing Costs"}
                  </td>
                  <td className="px-6 py-4 text-right font-extrabold text-[#2563EB] text-base">{fmt(cashToClose)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Summary Card ── */
function SummaryCard({ label, value, color, highlight = false }) {
  return (
    <div
      className={`rounded-2xl p-5 border ${highlight ? "border-2" : "border-slate-200"}`}
      style={{
        borderColor: highlight ? color : undefined,
        background: highlight ? `${color}08` : "#fff",
        boxShadow: highlight ? `0 4px 12px ${color}15` : "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#64748B" }}>{label}</div>
      <div className="text-2xl font-extrabold" style={{ color }}>{value}</div>
    </div>
  );
}

import { useState, useMemo } from "react";
import { Link } from "react-router";

export function meta() {
  return [{ title: "Rent vs Buy — MtgBroker" }];
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

/* Calculate remaining loan balance after N months */
function remainingBalance(principal, annualRate, termYears, monthsPaid) {
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return principal - (principal / n) * monthsPaid;
  return principal * (Math.pow(1 + r, n) - Math.pow(1 + r, monthsPaid)) / (Math.pow(1 + r, n) - 1);
}

function NumberInput({ label, value, onChange, prefix = "$", step = 1, min, helpText }) {
  return (
    <div>
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
      {helpText && <p className="text-xs text-slate-400 mt-0.5">{helpText}</p>}
    </div>
  );
}

export default function RentVsBuyCalculator() {
  // Buy inputs
  const [homePrice, setHomePrice] = useState(400000);
  const [downPct, setDownPct] = useState(20);
  const [rate, setRate] = useState(6.75);
  const [term, setTerm] = useState(30);

  // Rent inputs
  const [monthlyRent, setMonthlyRent] = useState(2500);
  const [annualRentIncrease, setAnnualRentIncrease] = useState(3);

  // Cost inputs
  const [taxRate, setTaxRate] = useState(1.25);
  const [annualInsurance, setAnnualInsurance] = useState(1800);
  const [monthlyHOA, setMonthlyHOA] = useState(0);

  // Growth/return inputs
  const [homeAppreciation, setHomeAppreciation] = useState(3);
  const [investmentReturn, setInvestmentReturn] = useState(7);
  const [marginalTaxRate, setMarginalTaxRate] = useState(24);
  const [yearsToCompare, setYearsToCompare] = useState(7);

  // Computed results
  const analysis = useMemo(() => {
    const downPayment = homePrice * (downPct / 100);
    const loanAmount = homePrice - downPayment;
    const monthlyPI = calcMonthlyPI(loanAmount, rate, term);
    const monthlyInsurance = annualInsurance / 12;
    const monthlyTax = (homePrice * (taxRate / 100)) / 12;
    const monthlyBuyCost = monthlyPI + monthlyInsurance + monthlyTax + monthlyHOA;

    // Year-by-year analysis
    const years = [];
    let cumulativeRentCost = 0;
    let cumulativeBuyCost = downPayment; // include down payment in buy costs
    let currentRent = monthlyRent;
    let breakEvenYear = null;

    // For the renter: invest the down payment + monthly savings
    let renterInvestmentBalance = downPayment;

    for (let y = 1; y <= yearsToCompare; y++) {
      // Rent cost this year
      const yearRent = currentRent * 12;
      cumulativeRentCost += yearRent;

      // Buy cost this year (insurance listed before tax in display, but summed here)
      const yearBuyCost = monthlyBuyCost * 12;
      cumulativeBuyCost += yearBuyCost;

      // Home value at end of year y
      const homeValueAtYear = homePrice * Math.pow(1 + homeAppreciation / 100, y);

      // Remaining balance after y years
      const balance = remainingBalance(loanAmount, rate, term, y * 12);

      // Equity = home value - remaining balance
      const equity = homeValueAtYear - balance;

      // Tax benefit estimate (simplified: interest is roughly deductible)
      // Interest paid this year (approximate using average balance)
      const avgBalance = (remainingBalance(loanAmount, rate, term, (y - 1) * 12) + balance) / 2;
      const interestThisYear = avgBalance * (rate / 100);
      const taxSavings = interestThisYear * (marginalTaxRate / 100);

      // Renter invests savings (buy cost - rent cost, if positive)
      const monthlySavings = monthlyBuyCost - currentRent;
      if (monthlySavings > 0) {
        // Renter saves money, invests it
        for (let m = 0; m < 12; m++) {
          renterInvestmentBalance *= (1 + investmentReturn / 100 / 12);
          renterInvestmentBalance += monthlySavings;
        }
      } else {
        // Buyer is cheaper monthly, renter still invests down payment
        for (let m = 0; m < 12; m++) {
          renterInvestmentBalance *= (1 + investmentReturn / 100 / 12);
        }
      }

      // Net wealth: Buying
      const buyNetWealth = equity - cumulativeBuyCost + homeValueAtYear + taxSavings * y;
      // Simplification: buyer wealth = equity built (home value - loan balance)
      const buyerWealth = homeValueAtYear - balance;

      // Net wealth: Renting = investment balance - rent paid
      const renterWealth = renterInvestmentBalance;

      // Advantage: positive = buying is better
      const buyAdvantage = buyerWealth - renterWealth;

      if (buyAdvantage > 0 && breakEvenYear === null) {
        breakEvenYear = y;
      }

      // Rent increases for next year
      currentRent *= (1 + annualRentIncrease / 100);

      years.push({
        year: y,
        yearRent,
        yearBuyCost,
        cumulativeRentCost,
        cumulativeBuyCost,
        homeValue: homeValueAtYear,
        equity,
        balance,
        buyerWealth,
        renterWealth,
        buyAdvantage,
      });
    }

    const finalYear = years[years.length - 1];

    return {
      downPayment,
      loanAmount,
      monthlyPI,
      monthlyInsurance,
      monthlyTax,
      monthlyBuyCost,
      years,
      breakEvenYear,
      totalRentCost: finalYear.cumulativeRentCost,
      totalBuyCost: finalYear.cumulativeBuyCost,
      finalHomeValue: finalYear.homeValue,
      finalEquity: finalYear.equity,
      finalBuyerWealth: finalYear.buyerWealth,
      finalRenterWealth: finalYear.renterWealth,
    };
  }, [homePrice, downPct, rate, term, monthlyRent, annualRentIncrease, taxRate, annualInsurance, monthlyHOA, homeAppreciation, investmentReturn, marginalTaxRate, yearsToCompare]);

  const buyWins = analysis.finalBuyerWealth > analysis.finalRenterWealth;

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-slate-500 mb-4 flex-wrap">
        <Link to="/app/calculators" className="text-[#2563EB] no-underline font-medium hover:underline">
          <i className="fa-solid fa-arrow-left mr-1 text-[11px]" />
          Calculators
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-900 font-semibold">Rent vs. Buy</span>
      </nav>

      {/* Header */}
      <div className="flex items-start gap-5 mb-8 pb-6 border-b border-slate-200">
        <div
          className="w-14 h-14 min-w-[56px] rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)", boxShadow: "0 4px 12px rgba(37,99,235,0.25)" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <div>
          <h1 className="text-[28px] font-extrabold text-slate-900 mb-1" style={{ letterSpacing: "-0.5px" }}>Rent vs. Buy Calculator</h1>
          <p className="text-[15px] text-slate-500 leading-normal">Compare the long-term financial impact of renting versus buying, including equity, appreciation, and investment returns.</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-8">
        {/* Left: Inputs */}
        <div className="space-y-5">
          {/* Buy inputs */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <i className="fa-solid fa-house text-[#2563EB] text-sm" /> Buy Details
            </h2>
            <NumberInput label="Home Price" value={homePrice} onChange={setHomePrice} />
            <NumberInput label="Down Payment (%)" value={downPct} onChange={setDownPct} prefix="%" step={1} min={0} />
            <NumberInput label="Interest Rate (%)" value={rate} onChange={setRate} prefix="%" step={0.125} />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Loan Term</label>
              <select value={term} onChange={(e) => setTerm(Number(e.target.value))} className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white">
                <option value={30}>30 years</option>
                <option value={20}>20 years</option>
                <option value={15}>15 years</option>
              </select>
            </div>
          </div>

          {/* Rent inputs */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <i className="fa-solid fa-building text-amber-500 text-sm" /> Rent Details
            </h2>
            <NumberInput label="Monthly Rent" value={monthlyRent} onChange={setMonthlyRent} />
            <NumberInput label="Annual Rent Increase (%)" value={annualRentIncrease} onChange={setAnnualRentIncrease} prefix="%" step={0.5} />
          </div>

          {/* Costs & assumptions */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <i className="fa-solid fa-sliders text-slate-500 text-sm" /> Costs & Assumptions
            </h2>
            <NumberInput label="Homeowner's Insurance ($/yr)" value={annualInsurance} onChange={setAnnualInsurance} />
            <NumberInput label="Property Tax Rate (%)" value={taxRate} onChange={setTaxRate} prefix="%" step={0.05} />
            <NumberInput label="Monthly HOA" value={monthlyHOA} onChange={setMonthlyHOA} />
            <NumberInput label="Home Appreciation (%/yr)" value={homeAppreciation} onChange={setHomeAppreciation} prefix="%" step={0.5} />
            <NumberInput label="Investment Return (%/yr)" value={investmentReturn} onChange={setInvestmentReturn} prefix="%" step={0.5} helpText="Return on cash if renting instead" />
            <NumberInput label="Marginal Tax Rate (%)" value={marginalTaxRate} onChange={setMarginalTaxRate} prefix="%" step={1} />
            <NumberInput label="Years to Compare" value={yearsToCompare} onChange={setYearsToCompare} prefix="" step={1} min={1} />
          </div>
        </div>

        {/* Right: Results */}
        <div className="space-y-6">
          {/* Verdict banner */}
          <div
            className="rounded-2xl p-6 border-2"
            style={{
              borderColor: buyWins ? "#059669" : "#D97706",
              background: buyWins ? "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)" : "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
              boxShadow: buyWins ? "0 4px 16px rgba(5,150,105,0.12)" : "0 4px 16px rgba(217,119,6,0.12)",
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg" style={{ background: buyWins ? "#059669" : "#D97706" }}>
                <i className={buyWins ? "fa-solid fa-house" : "fa-solid fa-building"} />
              </div>
              <div>
                <div className="text-lg font-extrabold" style={{ color: buyWins ? "#065F46" : "#92400E" }}>
                  {buyWins ? "Buying wins" : "Renting wins"} after {yearsToCompare} years
                </div>
                {analysis.breakEvenYear ? (
                  <div className="text-sm" style={{ color: buyWins ? "#047857" : "#B45309" }}>
                    Break-even at year {analysis.breakEvenYear}
                  </div>
                ) : (
                  <div className="text-sm" style={{ color: "#B45309" }}>
                    Buying doesn't break even within {yearsToCompare} years
                  </div>
                )}
              </div>
            </div>
            <div className="text-sm" style={{ color: buyWins ? "#065F46" : "#92400E" }}>
              Net wealth difference: <strong>{fmt(Math.abs(analysis.finalBuyerWealth - analysis.finalRenterWealth))}</strong>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard label="Monthly Buy Cost" sublabel="PITI + HOA" value={fmtDec(analysis.monthlyBuyCost)} color="#2563EB" />
            <SummaryCard label="Home Value" sublabel={`Year ${yearsToCompare}`} value={fmt(analysis.finalHomeValue)} color="#059669" />
            <SummaryCard label="Equity Built" sublabel={`Year ${yearsToCompare}`} value={fmt(analysis.finalEquity)} color="#0891B2" />
            <SummaryCard label="Buyer Wealth" sublabel={`Year ${yearsToCompare}`} value={fmt(analysis.finalBuyerWealth)} color="#7C3AED" />
          </div>

          {/* Monthly cost breakdown */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <h2 className="text-base font-bold text-slate-800 mb-4">Monthly Buy Breakdown</h2>
            <div className="space-y-2">
              <BreakdownRow label="Principal & Interest" value={fmtDec(analysis.monthlyPI)} />
              <BreakdownRow label="Homeowner's Insurance" value={fmtDec(analysis.monthlyInsurance)} />
              <BreakdownRow label="Property Tax" value={fmtDec(analysis.monthlyTax)} />
              {monthlyHOA > 0 && <BreakdownRow label="HOA" value={fmt(monthlyHOA)} />}
              <div className="border-t-2 border-slate-200 pt-2 flex justify-between text-base font-extrabold text-[#2563EB]">
                <span>Total Monthly</span>
                <span>{fmtDec(analysis.monthlyBuyCost)}</span>
              </div>
            </div>
          </div>

          {/* Year-by-year table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">Year-by-Year Comparison</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Year</th>
                    <th className="px-4 py-3 text-right">Rent Cost</th>
                    <th className="px-4 py-3 text-right">Buy Cost</th>
                    <th className="px-4 py-3 text-right">Home Value</th>
                    <th className="px-4 py-3 text-right">Equity</th>
                    <th className="px-4 py-3 text-right">Buyer Wealth</th>
                    <th className="px-4 py-3 text-right">Renter Wealth</th>
                    <th className="px-4 py-3 text-right">Advantage</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.years.map((yr) => {
                    const isBuyWin = yr.buyAdvantage > 0;
                    return (
                      <tr key={yr.year} className="border-t border-slate-100 hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 font-medium text-slate-700">{yr.year}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{fmt(yr.cumulativeRentCost)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{fmt(yr.cumulativeBuyCost)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{fmt(yr.homeValue)}</td>
                        <td className="px-4 py-2.5 text-right text-cyan-700 font-medium">{fmt(yr.equity)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-700 font-medium">{fmt(yr.buyerWealth)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-700 font-medium">{fmt(yr.renterWealth)}</td>
                        <td className={`px-4 py-2.5 text-right font-bold ${isBuyWin ? "text-green-700" : "text-amber-600"}`}>
                          {isBuyWin ? "+" : ""}{fmt(yr.buyAdvantage)}
                          {yr.year === analysis.breakEvenYear && (
                            <span className="ml-1.5 text-[10px] font-bold text-white px-1.5 py-0.5 rounded bg-green-600">BREAK-EVEN</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Assumptions note */}
          <div className="text-xs text-slate-400 px-2 space-y-1">
            <p>Buyer wealth = home value minus remaining loan balance. Renter wealth = invested down payment + monthly savings, compounded at the investment return rate.</p>
            <p>This is a simplified model. Actual results depend on maintenance costs, transaction fees, tax law changes, and market conditions.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Summary Card ── */
function SummaryCard({ label, sublabel, value, color }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4 bg-white" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-0.5">{label}</div>
      {sublabel && <div className="text-[10px] text-slate-400 mb-1">{sublabel}</div>}
      <div className="text-xl font-extrabold" style={{ color }}>{value}</div>
    </div>
  );
}

/* ── Breakdown row ── */
function BreakdownRow({ label, value }) {
  return (
    <div className="flex justify-between text-sm py-1.5">
      <span className="text-slate-600">{label}</span>
      <span className="text-slate-800 font-medium">{value}</span>
    </div>
  );
}

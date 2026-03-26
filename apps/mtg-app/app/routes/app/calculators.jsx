import { useState, useEffect } from "react";
import { Link } from "react-router";
import { getUserPlan, isNexaUser as checkNexa } from "../../lib/auth";

export function meta() {
  return [{ title: "Calculators — MtgBroker" }];
}

// Calculator data — static card definitions
const CALCULATORS = [
  // FREE
  { id: "affordability", title: "Affordability Calculator", desc: "Determine the maximum home price your client can afford based on income, debts, and DTI limits.", href: "/app/affordability", section: "free", icon: `<path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>` },
  { id: "blended-rate", title: "Blended Rate", desc: "Calculate the average interest rate across multiple liens or loan scenarios.", href: "/app/blended-rate", section: "free", icon: `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>` },
  { id: "dscr", title: "DSCR Calculator", desc: "Calculate Debt Service Coverage Ratio for investment properties to determine loan eligibility.", href: "/app/dscr-calc", section: "free", icon: `<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>` },
  { id: "mortgage", title: "Mortgage Calculator", desc: "Quickly estimate monthly payments including Principal, Interest, Taxes, and Insurance (PITI).", href: "/app/calc-mortgage", section: "free", icon: `<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01"/>` },
  { id: "refi", title: "Refinance Analysis", desc: "Compare current loan to a new refinance option. Calculate monthly savings, recoup period, and break-even.", href: "/app/refi-analysis", section: "free", icon: `<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/>` },
  { id: "va", title: "Remaining VA Entitlement", desc: "Determine remaining VA loan entitlement, bonus entitlement, and maximum loan amount without a down payment.", href: "/app/va-entitlement", section: "free", icon: `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>` },

  // PLUS/PRO
  { id: "closing-costs", title: "Closing Costs", desc: "Estimate title fees, recording fees, and pre-paids to give your client a clear cash-to-close picture.", href: "/app/closing-costs-estimate", section: "plus", icon: `<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>` },
  { id: "lender-pricing", title: "Lender Pricing Comparison", desc: "Compare rates, pricing adjustments, and compensation across multiple wholesale lenders.", href: "/app/lender-pricing-comparison", section: "plus", icon: `<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>` },
  { id: "loan-scenario", title: "Loan Scenario Comparison", desc: "Compare up to 6 loan options side-by-side. Analyze rates, terms, closing costs, and monthly payments.", href: "/app/loan-scenario-compare", section: "plus", icon: `<path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18"/>` },
  { id: "rent-vs-buy", title: "Rent vs. Buy", desc: "Compare the long-term financial impact of renting versus buying a home, including equity and tax benefits.", href: "/app/rent-vs-buy", section: "plus", icon: `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>` },

  // COMING SOON
  { id: "all-in-one", title: "All-in-One Calculator", desc: "Compare All-in-One loan savings against a traditional forward-amortized mortgage.", section: "coming-soon", icon: `<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>` },
  { id: "construction", title: "Construction Loan", desc: "Estimate leverage, draw schedules, and funds needed for new construction projects.", section: "coming-soon", icon: `<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 12h.01M17 12h.01M7 12h.01"/>` },
  { id: "fix-n-flip", title: "Fix N Flip", desc: "Estimate leverage, rehab costs, ARV, and funds needed for fix and flip investment projects.", section: "coming-soon", icon: `<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>` },
  { id: "gift-equity", title: "Gift of Equity", desc: "Calculate gift of equity amounts, down payment credits, and the impact on LTV for family transactions.", section: "coming-soon", icon: `<path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>` },
  { id: "income", title: "Income Calculation", desc: "Calculate qualifying income from W-2, self-employment, and variable income sources using standard methods.", section: "coming-soon", icon: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>` },

  // NEXA
  { id: "nexa-broker-comp", title: "Broker Compensation Calculator", desc: "Calculate broker compensation, admin fees, and payroll breakdown for LPC and BPC commission structures.", href: "/app/nexa-broker-comp-calc", section: "nexa", icon: `<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>` },
  { id: "nexa-nondel-comp", title: "NonDel Compensation Calculator", desc: "Calculate non-delegated compensation scenarios, including pricing adjustments and margin analysis.", href: "/app/nexa-nondel-comp-calc", section: "nexa", icon: `<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>` },
];

export default function CalculatorsPage() {
  const [plan, setPlan] = useState(null);
  const [nexa, setNexa] = useState(false);

  useEffect(() => {
    setPlan(getUserPlan());
    setNexa(checkNexa());
  }, []);

  const isLite = plan === "LITE" || plan === null;
  const freeCalcs = CALCULATORS.filter((c) => c.section === "free");
  const plusCalcs = CALCULATORS.filter((c) => c.section === "plus");
  const comingSoonCalcs = CALCULATORS.filter((c) => c.section === "coming-soon");
  const nexaCalcs = CALCULATORS.filter((c) => c.section === "nexa");
  const availableCount = freeCalcs.length + plusCalcs.length + (nexa ? nexaCalcs.length : 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600 shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <rect x="4" y="2" width="16" height="20" rx="2" /><line x1="8" x2="16" y1="6" y2="6" /><line x1="16" x2="16" y1="14" y2="18" /><path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text mb-1">Calculators</h1>
          <p className="text-text-muted text-sm mb-3">Run the numbers, compare scenarios, and build confidence with every client conversation.</p>
          <div className="flex gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-50 text-primary-600 text-xs font-semibold">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><polyline points="20 6 9 17 4 12" /></svg>
              {availableCount} Available
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-active text-text-muted text-xs font-semibold">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              {comingSoonCalcs.length} Coming Soon
            </span>
          </div>
        </div>
      </div>

      {/* Free Tools */}
      <Section label="Free Tools">
        {freeCalcs.map((c) => <CalcCard key={c.id} calc={c} />)}
      </Section>

      {/* PLUS/PRO Tools */}
      <Section label="PLUS / PRO Tools">
        {plusCalcs.map((c) => <CalcCard key={c.id} calc={c} locked={isLite} />)}
      </Section>

      {/* Coming Soon */}
      <Section label="Coming Soon">
        {comingSoonCalcs.map((c) => <CalcCard key={c.id} calc={c} comingSoon />)}
      </Section>

      {/* NEXA */}
      {nexa && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-bold text-text">NEXA Calculators</span>
            <span className="text-[9px] font-bold text-white bg-gradient-to-br from-primary-600 to-primary-800 px-2 py-0.5 rounded uppercase tracking-wider">NEXA</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {nexaCalcs.map((c) => <CalcCard key={c.id} calc={c} isNexa />)}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div className="mb-8">
      <div className="text-sm font-bold text-text-faint uppercase tracking-wide mb-4">{label}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {children}
      </div>
    </div>
  );
}

function CalcCard({ calc, locked = false, comingSoon = false, isNexa = false }) {
  const cardClasses = `rounded-2xl border p-5 flex flex-col transition-all ${
    comingSoon ? "bg-surface-hover border-border opacity-60" :
    locked ? "bg-surface-hover border-border cursor-pointer" :
    isNexa ? "bg-gradient-to-br from-primary-50 to-white border-primary-200 hover:shadow-md" :
    "bg-white border-border hover:border-primary-200 hover:shadow-md"
  }`;

  const content = (
    <>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${isNexa ? "bg-primary-600 text-white" : "bg-surface-active text-text-muted"}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" dangerouslySetInnerHTML={{ __html: calc.icon }} />
      </div>
      <div className="text-sm font-bold text-text mb-1 flex items-center gap-2">
        {calc.title}
        {comingSoon && <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded uppercase">Soon</span>}
        {isNexa && <span className="text-[9px] font-bold text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded uppercase">NEXA</span>}
      </div>
      <p className="text-xs text-text-muted leading-relaxed flex-1 mb-4">{calc.desc}</p>
      <div className={`text-xs font-semibold flex items-center gap-1 ${locked ? "text-text-faint" : comingSoon ? "text-text-faint" : "text-primary-600"}`}>
        {locked ? (
          <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg> Upgrade to Unlock</>
        ) : comingSoon ? "Coming Soon" : (
          <>Open Tool <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg></>
        )}
      </div>
    </>
  );

  if (locked || comingSoon || !calc.href) {
    return <div className={cardClasses}>{content}</div>;
  }

  return (
    <Link to={calc.href} className={`${cardClasses} no-underline`}>
      {content}
    </Link>
  );
}

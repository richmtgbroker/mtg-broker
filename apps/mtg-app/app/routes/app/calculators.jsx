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
      <div className="flex items-start gap-5 mb-10 pb-7 border-b border-border">
        <div className="w-14 h-14 min-w-[56px] rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
            <rect x="4" y="2" width="16" height="20" rx="2" /><line x1="8" x2="16" y1="6" y2="6" /><line x1="16" x2="16" y1="14" y2="18" /><path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01" />
          </svg>
        </div>
        <div>
          <h1 className="text-[28px] font-extrabold text-text mb-1.5" style={{ letterSpacing: '-0.5px' }}>Calculators</h1>
          <p className="text-[15px] text-text-muted mb-3 leading-normal">Run the numbers, compare scenarios, and build confidence with every client conversation.</p>
          <div className="flex gap-2">
            <span className="inline-flex items-center gap-[5px] px-2.5 py-1 rounded-[20px] text-xs font-semibold" style={{ background: '#DBEAFE', color: '#2563EB' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" className="w-[13px] h-[13px]"><polyline points="20 6 9 17 4 12" /></svg>
              {availableCount} Available
            </span>
            <span className="inline-flex items-center gap-[5px] px-2.5 py-1 rounded-[20px] text-xs font-semibold" style={{ background: '#F1F5F9', color: '#64748B' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" className="w-[13px] h-[13px]"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
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
        <div className="mb-[50px]">
          <div className="flex items-center gap-2.5 text-[13px] font-bold uppercase tracking-[0.1em] mb-5 pb-2.5 border-b-2" style={{ borderColor: '#334155', color: '#94A3B8' }}>
            NEXA Calculators
            <span className="text-[10px] font-extrabold text-white px-2 py-[3px] rounded tracking-[0.06em] uppercase" style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)' }}>NEXA</span>
          </div>
          <div className="grid gap-[30px]" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
            {nexaCalcs.map((c) => <CalcCard key={c.id} calc={c} isNexa />)}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div className="mb-[50px]">
      <div className="text-[13px] font-bold uppercase tracking-[0.1em] mb-5 pb-2.5 border-b-2 border-border" style={{ color: '#6B7280' }}>{label}</div>
      <div className="grid gap-[30px]" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
        {children}
      </div>
    </div>
  );
}

function CalcCard({ calc, locked = false, comingSoon = false, isNexa = false }) {
  const baseCard = "relative rounded-2xl border p-8 flex flex-col transition-all duration-200 h-full";
  const cardClasses = `${baseCard} ${
    comingSoon ? "bg-white border-border opacity-60 pointer-events-none" :
    locked ? "bg-white border-border opacity-60 grayscale-[40%] cursor-not-allowed" :
    isNexa ? "bg-[#0F172A] border-[#334155] hover:-translate-y-[5px]" :
    "bg-white border-border hover:-translate-y-[5px] hover:border-[#BFDBFE]"
  }`;
  const cardShadow = comingSoon || locked
    ? "0 4px 6px -1px rgba(0,0,0,0.05)"
    : "0 4px 6px -1px rgba(0,0,0,0.05)";
  const cardHoverShadow = isNexa
    ? "0 15px 30px -5px rgba(0,0,0,0.3)"
    : "0 15px 30px -5px rgba(0,0,0,0.1)";

  const content = (
    <>
      {/* Lock badge for locked cards */}
      {locked && (
        <div className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center z-10 pointer-events-none" style={{ background: 'linear-gradient(135deg, #FDE68A 0%, #F59E0B 100%)', boxShadow: '0 2px 6px rgba(245,158,11,0.4)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="w-3.5 h-3.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
        </div>
      )}
      <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-6 transition-colors duration-200 ${
        isNexa ? "bg-[#1E293B] group-hover:bg-[#334155]" :
        comingSoon ? "bg-[#F3F4F6]" :
        "bg-[#EFF6FF] group-hover:bg-[#DBEAFE]"
      }`}>
        <svg viewBox="0 0 24 24" fill="none" stroke={isNexa ? "#60A5FA" : comingSoon ? "#9CA3AF" : "#0066CC"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7" dangerouslySetInnerHTML={{ __html: calc.icon }} />
      </div>
      <div className={`text-xl font-bold mb-2.5 flex items-center gap-2 ${isNexa ? "text-[#F1F5F9]" : "text-text"}`}>
        {calc.title}
        {comingSoon && <span className="text-[11px] font-semibold px-2 py-[3px] rounded" style={{ background: '#FEF3C7', color: '#92400E' }}>Soon</span>}
        {isNexa && <span className="text-[11px] font-semibold px-2 py-[3px] rounded border" style={{ background: '#1E293B', color: '#60A5FA', borderColor: '#334155' }}>NEXA</span>}
      </div>
      <p className={`text-[15px] leading-[1.6] flex-1 mb-6 ${isNexa ? "text-[#94A3B8]" : "text-text-muted"}`}>{calc.desc}</p>
      <div className={`text-sm font-semibold flex items-center gap-1.5 ${
        locked ? "text-[#F59E0B]" :
        comingSoon ? "text-[#9CA3AF]" :
        isNexa ? "text-[#60A5FA]" :
        "text-[#0066CC]"
      }`}>
        {locked ? (
          <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg> Upgrade to Unlock</>
        ) : comingSoon ? "Coming Soon" : (
          <>Open Tool <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg></>
        )}
      </div>
    </>
  );

  const styleProps = {
    boxShadow: cardShadow,
  };

  if (locked || comingSoon || !calc.href) {
    return (
      <div
        className={`${cardClasses} group`}
        style={styleProps}
        onMouseEnter={(e) => { if (!locked && !comingSoon) e.currentTarget.style.boxShadow = cardHoverShadow; }}
        onMouseLeave={(e) => { if (!locked && !comingSoon) e.currentTarget.style.boxShadow = cardShadow; }}
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      to={calc.href}
      className={`${cardClasses} no-underline group`}
      style={styleProps}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = cardHoverShadow; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = cardShadow; }}
    >
      {content}
    </Link>
  );
}

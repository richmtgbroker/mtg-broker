import { useState, useEffect } from 'react'

/* ================================================
   CALCULATOR CARD DATA
   Each card has: id, title, description, icon (SVG path), href, section, tags
   Sections: free, plus, coming-soon, nexa
   ================================================ */

const CALCULATORS = [
  // ---- FREE TOOLS (available to all plans) ----
  {
    id: 'affordability',
    title: 'Affordability Calculator',
    description: 'Determine the maximum home price your client can afford based on income, debts, and DTI limits.',
    href: '/app/affordability',
    section: 'free',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" /><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
      </svg>
    ),
  },
  {
    id: 'blended-rate',
    title: 'Blended Rate',
    description: 'Calculate the average interest rate across multiple liens or loan scenarios.',
    href: '/app/blended-rate',
    section: 'free',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
  {
    id: 'dscr',
    title: 'DSCR Calculator',
    description: 'Calculate Debt Service Coverage Ratio for investment properties to determine loan eligibility.',
    href: '/app/dscr-calc',
    section: 'free',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
      </svg>
    ),
  },
  {
    id: 'mortgage',
    title: 'Mortgage Calculator',
    description: 'Quickly estimate monthly payments including Principal, Interest, Taxes, and Insurance (PITI).',
    href: '/app/calc-mortgage',
    section: 'free',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="16" y1="14" x2="16" y2="18" />
        <path d="M16 10h.01" /><path d="M12 10h.01" /><path d="M8 10h.01" />
        <path d="M12 14h.01" /><path d="M8 14h.01" /><path d="M12 18h.01" /><path d="M8 18h.01" />
      </svg>
    ),
  },
  {
    id: 'refi-analysis',
    title: 'Refinance Analysis',
    description: 'Compare current loan to a new refinance option. Calculate monthly savings, recoup period, and break-even analysis.',
    href: '/app/refi-analysis',
    section: 'free',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 21h5v-5" />
      </svg>
    ),
  },
  {
    id: 'va-entitlement',
    title: 'Remaining VA Entitlement',
    description: "Determine a veteran's remaining VA loan entitlement, bonus entitlement, and maximum loan amount without a down payment.",
    href: '/app/va-entitlement',
    section: 'free',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
      </svg>
    ),
  },

  // ---- PLUS / PRO TOOLS ----
  {
    id: 'closing-costs',
    title: 'Closing Costs',
    description: 'Estimate title fees, recording fees, and pre-paids to give your client a clear cash-to-close picture.',
    href: '/app/closing-costs-estimate',
    section: 'plus',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    id: 'lender-pricing',
    title: 'Lender Pricing Comparison',
    description: 'Compare rates, pricing adjustments, and compensation across multiple wholesale lenders.',
    href: '/app/lender-pricing-comparison',
    section: 'plus',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    ),
  },
  {
    id: 'loan-scenario',
    title: 'Loan Scenario Comparison',
    description: 'Compare up to 6 loan options side-by-side. Analyze rates, terms, closing costs, and monthly payments in one view.',
    href: '/app/loan-scenario-compare',
    section: 'plus',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18" />
      </svg>
    ),
  },
  {
    id: 'rent-vs-buy',
    title: 'Rent vs. Buy',
    description: 'Compare the long-term financial impact of renting versus buying a home, including equity and tax benefits.',
    href: '/app/rent-vs-buy',
    section: 'plus',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },

  // ---- COMING SOON ----
  {
    id: 'all-in-one',
    title: 'All-in-One Calculator',
    description: 'Compare All-in-One loan savings against a traditional forward-amortized mortgage side-by-side across multiple scenarios.',
    section: 'coming-soon',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    id: 'construction-loan',
    title: 'Construction Loan',
    description: 'Estimate leverage, draw schedules, and funds needed for new construction projects.',
    section: 'coming-soon',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2" /><path d="M12 12h.01" /><path d="M17 12h.01" /><path d="M7 12h.01" />
      </svg>
    ),
  },
  {
    id: 'fix-n-flip',
    title: 'Fix N Flip',
    description: 'Estimate leverage, rehab costs, ARV, and funds needed for fix and flip investment projects.',
    section: 'coming-soon',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    id: 'gift-of-equity',
    title: 'Gift of Equity',
    description: 'Calculate gift of equity amounts, down payment credits, and the impact on loan-to-value ratios for family transactions.',
    section: 'coming-soon',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 12v10H4V12" /><path d="M2 7h20v5H2z" /><path d="M12 22V7" />
        <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
      </svg>
    ),
  },
  {
    id: 'income-calculation',
    title: 'Income Calculation',
    description: 'Calculate qualifying income from W-2, self-employment, and variable income sources using standard underwriting methods.',
    section: 'coming-soon',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
      </svg>
    ),
  },

  // ---- NEXA CALCULATORS (visible only to NEXA employees) ----
  {
    id: 'nexa-broker-comp',
    title: 'Broker Compensation Calculator',
    description: 'Calculate broker compensation, admin fees, and payroll breakdown for LPC and BPC commission structures.',
    href: '/app/nexa-broker-comp-calc',
    section: 'nexa',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    id: 'nexa-nondel-comp',
    title: 'NonDel Compensation Calculator',
    description: 'Calculate non-delegated compensation scenarios, including pricing adjustments and margin analysis.',
    href: '/app/nexa-nondel-comp-calc',
    section: 'nexa',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
]

/* ================================================
   ARROW ICON (reused across cards)
   ================================================ */
const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
)

/* ================================================
   PLAN BADGE (star icon on PLUS/PRO cards)
   ================================================ */
const PlanBadge = () => (
  <div className="plan-badge">
    <svg viewBox="0 0 24 24"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7L12 16.4 5.7 21l2.3-7L2 9.4h7.6L12 2z" /></svg>
    <div className="plan-badge-tooltip">PLUS or PRO plan required</div>
  </div>
)

/* ================================================
   TOOL CARD COMPONENT
   ================================================ */
function ToolCard({ calc, isLocked, onLockedClick }) {
  const isComingSoon = calc.section === 'coming-soon'
  const isNexa = calc.section === 'nexa'
  const isPlus = calc.section === 'plus'

  // Build class names
  let className = 'tool-card'
  if (isComingSoon) className += ' coming-soon'
  if (isNexa) className += ' nexa-card'
  if (isLocked) className += ' locked'

  // Locked PLUS cards: show as div, not link
  if (isLocked) {
    return (
      <div className={className} onClick={onLockedClick} role="button" tabIndex={0}>
        {/* Lock badge (replaces plan badge when locked) */}
        <div className="lock-badge">
          <i className="fa-solid fa-lock"></i>
        </div>
        <div className="icon-box">{calc.icon}</div>
        <div className="tool-title">{calc.title}</div>
        <div className="tool-desc">{calc.description}</div>
        <div className="tool-link tool-link-locked">
          <i className="fa-solid fa-lock" style={{ marginRight: 6, fontSize: 12 }}></i>
          Upgrade to Unlock
        </div>
      </div>
    )
  }

  // Coming soon cards: not clickable
  if (isComingSoon) {
    return (
      <div className={className}>
        <div className="icon-box">{calc.icon}</div>
        <div className="tool-title">
          {calc.title} <span className="tag-soon">Coming Soon</span>
        </div>
        <div className="tool-desc">{calc.description}</div>
        <div className="tool-link">Coming Soon</div>
      </div>
    )
  }

  // Active cards (free, plus, nexa)
  return (
    <a href={calc.href} className={className}>
      {isPlus && <PlanBadge />}
      <div className="icon-box">{calc.icon}</div>
      <div className="tool-title">
        {calc.title}
        {isNexa && <span className="tag-nexa">NEXA</span>}
      </div>
      <div className="tool-desc">{calc.description}</div>
      <div className="tool-link">Open Tool <ArrowIcon /></div>
    </a>
  )
}

/* ================================================
   MAIN APP COMPONENT
   ================================================ */
export default function App() {
  const [isLiteUser, setIsLiteUser] = useState(false)
  const [isNexaUser, setIsNexaUser] = useState(false)
  const [billingReady, setBillingReady] = useState(false)

  // Wait for billing system to determine plan gating
  useEffect(() => {
    let cancelled = false

    async function checkBilling() {
      // Wait for MTG_Billing (max 8 seconds)
      let attempts = 0
      while (attempts < 80) {
        if (window.MTG_Billing && window.MTG_Billing.state === 'ready') break
        await new Promise(r => setTimeout(r, 100))
        attempts++
      }

      if (cancelled) return

      if (!window.MTG_Billing || window.MTG_Billing.state !== 'ready') {
        // Billing never loaded — fail open (all cards accessible)
        setBillingReady(true)
        return
      }

      const result = await window.MTG_Billing.canAccessFeature('advanced-calc')
      if (!cancelled) {
        setIsLiteUser(!result.allowed)
        setBillingReady(true)
      }
    }

    checkBilling()

    return () => { cancelled = true }
  }, [])

  // NEXA detection: The sidebar worker adds body.nexa-user class via a
  // 3-step check (sessionStorage cache → JWT email domain → Outseta
  // NexaAccess custom field). We watch for that class instead of
  // duplicating the logic here.
  useEffect(() => {
    // Check immediately (sidebar may have already set it)
    if (document.body.classList.contains('nexa-user')) {
      setIsNexaUser(true)
    }

    // Watch for the class being added/removed by the sidebar script
    const observer = new MutationObserver(() => {
      const hasClass = document.body.classList.contains('nexa-user')
      setIsNexaUser(hasClass)
    })

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    })

    // Also poll briefly in case sidebar hasn't run yet (up to 5 seconds)
    let attempts = 0
    const poll = setInterval(() => {
      attempts++
      if (document.body.classList.contains('nexa-user')) {
        setIsNexaUser(true)
        clearInterval(poll)
      } else if (attempts >= 50) {
        clearInterval(poll)
      }
    }, 100)

    return () => {
      observer.disconnect()
      clearInterval(poll)
    }
  }, [])

  // Handle locked card click — show upgrade modal
  function handleLockedClick() {
    if (window.MTG_Billing && window.MTG_Billing.showUpgradeModal) {
      window.MTG_Billing.showUpgradeModal(
        'Advanced calculators are available on PLUS and PRO plans. Upgrade to unlock Loan Scenario Comparison, Rent vs. Buy, Lender Pricing, and Closing Costs.',
        'PLUS'
      )
    }
  }

  // Filter calculators by section
  const freeCalcs = CALCULATORS.filter(c => c.section === 'free')
  const plusCalcs = CALCULATORS.filter(c => c.section === 'plus')
  const comingSoonCalcs = CALCULATORS.filter(c => c.section === 'coming-soon')
  const nexaCalcs = CALCULATORS.filter(c => c.section === 'nexa')

  // Count available and coming soon (include NEXA if visible)
  const availableCount = freeCalcs.length + plusCalcs.length + (isNexaUser ? nexaCalcs.length : 0)
  const comingSoonCount = comingSoonCalcs.length

  return (
    <div className="app-page-content">
      <div className="app-container">

        {/* Page Header */}
        <div className="calc-page-header">
          <div className="calc-page-header-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <line x1="8" x2="16" y1="6" y2="6" />
              <line x1="16" x2="16" y1="14" y2="18" />
              <path d="M16 10h.01" /><path d="M12 10h.01" /><path d="M8 10h.01" />
              <path d="M12 14h.01" /><path d="M8 14h.01" /><path d="M12 18h.01" /><path d="M8 18h.01" />
            </svg>
          </div>
          <div className="calc-page-header-text">
            <h1>Calculators</h1>
            <p>Run the numbers, compare scenarios, and build confidence with every client conversation.</p>
            <div className="calc-header-chips">
              <span className="calc-header-chip chip-active">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                {availableCount} Available
              </span>
              <span className="calc-header-chip">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                {comingSoonCount} Coming Soon
              </span>
            </div>
          </div>
        </div>

        {/* Free Tools Section */}
        <div className="section-group">
          <div className="section-label">Free Tools</div>
          <div className="tools-grid">
            {freeCalcs.map(calc => (
              <ToolCard key={calc.id} calc={calc} />
            ))}
          </div>
        </div>

        {/* PLUS / PRO Tools Section */}
        <div className="section-group">
          <div className="section-label">PLUS / PRO Tools</div>
          <div className="tools-grid">
            {plusCalcs.map(calc => (
              <ToolCard
                key={calc.id}
                calc={calc}
                isLocked={billingReady && isLiteUser}
                onLockedClick={handleLockedClick}
              />
            ))}
          </div>
        </div>

        {/* Coming Soon Section */}
        <div className="section-group">
          <div className="section-label">Coming Soon</div>
          <div className="tools-grid">
            {comingSoonCalcs.map(calc => (
              <ToolCard key={calc.id} calc={calc} />
            ))}
          </div>
        </div>

        {/* NEXA Calculators Section (only visible to NEXA employees) */}
        {isNexaUser && (
          <div className="nexa-section-group">
            <div className="nexa-section-label">
              NEXA Calculators
              <span className="nexa-label-badge">NEXA</span>
            </div>
            <div className="tools-grid">
              {nexaCalcs.map(calc => (
                <ToolCard key={calc.id} calc={calc} />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

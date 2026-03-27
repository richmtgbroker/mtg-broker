import { useState, useEffect, useCallback } from 'react'

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const API_URL              = 'https://mtg-loan-finder.pages.dev/api/search'
const GUIDELINE_API_URL    = 'https://mtg-loan-finder.pages.dev/api/guideline-search'
const PRODUCT_LOOKUP_URL   = 'https://mtg-loan-finder.pages.dev/api/product-lookup'
const ADD_LENDER_API_URL   = 'https://mtg-loan-finder.pages.dev/api/add-lender'

// Admin emails that can see admin-only features
const ADMIN_EMAILS = ['rich@mtg.broker', 'rich@prestonlending.com']

// Get Outseta JWT from localStorage (set by Outseta auth on the Webflow page)
function getOutsetaToken() {
  try {
    return localStorage.getItem('Outseta.nocode.accessToken') || null
  } catch (e) {
    return null
  }
}

// Check if the current user is an admin by decoding the Outseta JWT
function isAdmin() {
  try {
    const token = getOutsetaToken()
    if (!token) return false
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    const email = (payload.email || payload.sub || '').toLowerCase()
    return ADMIN_EMAILS.includes(email)
  } catch (e) {
    return false
  }
}

// ─── CONSTANTS — FIND A LOAN MODE ─────────────────────────────────────────────

const EXAMPLE_SCENARIOS = [
  {
    label: 'Self-employed investor',
    icon: 'fa-briefcase',
    query: '640 FICO, self-employed 2 years, buying a duplex as investment property, 25% down in Florida',
  },
  {
    label: 'First-time homebuyer',
    icon: 'fa-house',
    query: '720 credit score, first-time homebuyer, looking at a condo, 5% down, primary residence',
  },
  {
    label: 'Bank statement loan',
    icon: 'fa-file-invoice',
    query: 'Who does bank statement loans for self-employed borrowers with a 680 score?',
  },
  {
    label: 'DSCR investment',
    icon: 'fa-building',
    query: 'DSCR loan for a 4-unit investment property, 700 FICO, 30% down',
  },
  {
    label: 'ITIN borrower',
    icon: 'fa-id-card',
    query: 'What lender does ITIN loans? Borrower has a 600 score.',
  },
  {
    label: 'VA manufactured home',
    icon: 'fa-shield-halved',
    query: 'VA loan options for a manufactured home, 660 credit score',
  },
]

const PROGRESS_MESSAGES = [
  "Analyzing your borrower scenario...",
  "Searching loan products database...",
  "Matching criteria against 625+ products...",
  "Ranking best fits for your scenario...",
  "Preparing results..."
]

// ─── CONSTANTS — SEARCH GUIDELINES MODE ───────────────────────────────────────

const GUIDELINE_EXAMPLES = [
  {
    label: 'Gift funds',
    icon: 'fa-gift',
    query: 'Which lenders allow gift funds on investment properties?',
  },
  {
    label: 'Bankruptcy seasoning',
    icon: 'fa-clock',
    query: 'What are the seasoning requirements after bankruptcy for non-QM loans?',
  },
  {
    label: 'LLC vesting',
    icon: 'fa-building',
    query: 'Which products allow vesting title in an LLC?',
  },
  {
    label: 'STR income',
    icon: 'fa-house',
    query: 'Can short-term rental income be used for DSCR qualification?',
  },
  {
    label: 'ITIN requirements',
    icon: 'fa-id-card',
    query: 'What documentation is required for ITIN borrowers?',
  },
  {
    label: 'Non-warrantable condo',
    icon: 'fa-city',
    query: 'Which lenders finance non-warrantable condos?',
  },
]

const GUIDELINE_PROGRESS_MESSAGES = [
  "Searching guideline documents...",
  "Finding relevant lender policies...",
  "Reading through the guidelines...",
  "Synthesizing answer from sources...",
  "Preparing response..."
]

// ─── MODAL FIELD SECTIONS ─────────────────────────────────────────────────────
// Organizes all 55 Supabase fields into logical sections for the product detail modal.

const MODAL_SECTIONS = [
  {
    title: 'Loan Overview',
    icon: 'fa-file-invoice-dollar',
    fields: [
      { key: 'loan_product_type',  label: 'Product Type' },
      { key: 'product_status',     label: 'Status' },
      { key: 'terms',              label: 'Terms' },
      { key: 'min_loan_amount',    label: 'Min Loan Amount',  format: 'currency' },
      { key: 'max_loan_amount',    label: 'Max Loan Amount',  format: 'currency' },
    ],
  },
  {
    title: 'Credit & LTV',
    icon: 'fa-chart-simple',
    fields: [
      { key: 'min_fico',              label: 'Min FICO' },
      { key: 'min_fico_investment',   label: 'Min FICO (Investment)' },
      { key: 'max_ltv_purchase',      label: 'Max LTV (Purchase)' },
      { key: 'max_ltv_cashout',       label: 'Max LTV (Cash-Out)' },
      { key: 'max_ltv_rate_term',     label: 'Max LTV (Rate-Term)' },
      { key: 'max_ltv_2_4_units',     label: 'Max LTV (2-4 Units)' },
      { key: 'max_cltv',              label: 'Max CLTV' },
      { key: 'max_cltv_investment',   label: 'Max CLTV (Investment)' },
      { key: 'max_dti',               label: 'Max DTI' },
    ],
  },
  {
    title: 'Property & Eligibility',
    icon: 'fa-house',
    fields: [
      { key: 'occupancy_choices',       label: 'Occupancy' },
      { key: 'property_types',          label: 'Property Types' },
      { key: 'property_types_notes',    label: 'Property Type Notes' },
      { key: 'purposes',                label: 'Purposes' },
      { key: 'state_restrictions',      label: 'States Available' },
      { key: 'rural_properties_allowed', label: 'Rural Properties' },
      { key: 'max_acreage',             label: 'Max Acreage' },
    ],
  },
  {
    title: 'Income & DSCR',
    icon: 'fa-money-bill-wave',
    fields: [
      { key: 'income_types',          label: 'Income Types' },
      { key: 'dscr_min_ratio',        label: 'DSCR Min Ratio' },
      { key: 'dscr_str_income_usable', label: 'STR Income Usable' },
      { key: 'dscr_min_ratio_str',    label: 'DSCR Min Ratio (STR)' },
    ],
  },
  {
    title: 'Borrower Eligibility',
    icon: 'fa-user',
    fields: [
      { key: 'itin_allowed',                  label: 'ITIN Allowed' },
      { key: 'foreign_national_eligible',     label: 'Foreign National' },
      { key: 'daca_eligible',                 label: 'DACA Eligible' },
      { key: 'fthb_allowed',                  label: 'First-Time Homebuyer' },
      { key: 'first_time_investors_allowed',  label: 'First-Time Investor' },
      { key: 'non_occupant_coborrower',       label: 'Non-Occupant Co-Borrower' },
    ],
  },
  {
    title: 'Credit Events & Seasoning',
    icon: 'fa-clock',
    fields: [
      { key: 'bankruptcy_seasoning',           label: 'Bankruptcy Seasoning' },
      { key: 'foreclosure_seasoning',          label: 'Foreclosure / SS / DIL' },
      { key: 'mortgage_lates',                 label: 'Mortgage Lates' },
      { key: 'ownership_seasoning_cashout',    label: 'Ownership Seasoning (Cash-Out)' },
      { key: 'ownership_seasoning_rate_term',  label: 'Ownership Seasoning (Rate-Term)' },
      { key: 'asset_seasoning',                label: 'Asset Seasoning' },
    ],
  },
  {
    title: 'Loan Features',
    icon: 'fa-sliders',
    fields: [
      { key: 'interest_only_available', label: 'Interest Only' },
      { key: 'cash_out_available',      label: 'Cash-Out Available' },
      { key: 'max_cash_out',            label: 'Max Cash-Out' },
      { key: 'prepayment_penalty',      label: 'Prepayment Penalty' },
      { key: 'vest_in_llc',             label: 'Vest in LLC' },
      { key: 'manual_uw_allowed',       label: 'Manual UW' },
    ],
  },
  {
    title: 'Requirements',
    icon: 'fa-list-check',
    fields: [
      { key: 'reserves_required',        label: 'Reserves Required' },
      { key: 'additional_reserves',      label: 'Additional Reserves' },
      { key: 'gift_funds_allowed',       label: 'Gift Funds Allowed' },
      { key: 'max_seller_concessions',   label: 'Max Seller Concessions' },
      { key: 'max_financed_properties',  label: 'Max Financed Properties' },
    ],
  },
  {
    title: 'Program Details',
    icon: 'fa-file-lines',
    fields: [
      { key: 'description',    label: 'Description' },
      { key: 'program_notes',  label: 'Program Notes' },
      { key: 'matrix_url',     label: 'Rate Matrix',   format: 'link' },
      { key: 'matrix_date',    label: 'Matrix Date' },
    ],
  },
]

// ─── HELPERS ──────────────────────────────────────────────────────────────────

// Format a field value for display in the modal
function formatFieldValue(value, format) {
  if (value === null || value === undefined || value === '') return null

  if (format === 'currency' && typeof value === 'number') {
    return '$' + value.toLocaleString()
  }

  if (format === 'link' && typeof value === 'string' && value.startsWith('http')) {
    return { type: 'link', href: value, text: 'View Matrix ↗' }
  }

  const str = String(value)

  // Auto-detect URLs in any field
  if (str.startsWith('http')) {
    return { type: 'link', href: str, text: 'Open Link ↗' }
  }

  // Long text: preserve line breaks
  if (str.length > 120 || str.includes('\n')) {
    return { type: 'longtext', text: str }
  }

  return str
}

// Match a Claude result card to the full Supabase product record.
function findRawProduct(match, rawProducts) {
  if (!rawProducts || !rawProducts.length) return null

  const matchName = (match.product_name || '').toLowerCase().trim()
  const matchLender = (match.lender || '').toLowerCase().trim()

  // 1. Best: exact match on BOTH product_name + lender (most specific)
  let found = rawProducts.find(p =>
    (p.product_name || '').toLowerCase().trim() === matchName &&
    (p.lender_name || '').toLowerCase().trim() === matchLender
  )

  // 2. Exact match on product_name only
  if (!found) {
    found = rawProducts.find(p =>
      (p.product_name || '').toLowerCase().trim() === matchName
    )
  }

  // 3. Partial name match — prefer results that also match the lender
  if (!found && matchName.length > 10) {
    const partialMatches = rawProducts.filter(p => {
      const rawName = (p.product_name || '').toLowerCase().trim()
      return rawName.includes(matchName) || matchName.includes(rawName)
    })
    // If multiple partial matches, prefer the one matching the lender
    if (partialMatches.length > 1 && matchLender) {
      found = partialMatches.find(p =>
        (p.lender_name || '').toLowerCase().trim() === matchLender
      ) || partialMatches[0]
    } else {
      found = partialMatches[0] || null
    }
  }

  // 4. Match by lender name only as last resort
  if (!found && matchLender.length > 2) {
    found = rawProducts.find(p =>
      (p.lender_name || '').toLowerCase().trim() === matchLender
    )
  }

  return found || null
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────

// Tab switcher between "Find a Loan" and "Search Guidelines" modes
function ModeSwitcher({ activeMode, onChange, showAdmin }) {
  return (
    <div className="mode-tabs">
      <button
        className={`mode-tab ${activeMode === 'find' ? 'active' : ''}`}
        onClick={() => onChange('find')}
      >
        <i className="fas fa-magnifying-glass-dollar"></i>
        Find a Loan
      </button>
      <button
        className={`mode-tab ${activeMode === 'guidelines' ? 'active' : ''}`}
        onClick={() => onChange('guidelines')}
      >
        <i className="fas fa-book-open"></i>
        Search Guidelines
      </button>
      {showAdmin && (
        <button
          className={`mode-tab ${activeMode === 'addLender' ? 'active' : ''}`}
          onClick={() => onChange('addLender')}
        >
          <i className="fas fa-building-circle-arrow-right"></i>
          Add Lender
        </button>
      )}
    </div>
  )
}

// Search textarea + submit button (shared by both modes via props)
function SearchInput({ value, onChange, onSubmit, isLoading, placeholder, buttonLabel }) {
  const handleSubmit = (e) => {
    e.preventDefault()
    if (value.trim() && !isLoading) onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="search-form">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="search-input"
        rows={3}
        disabled={isLoading}
      />
      <button
        type="submit"
        className="search-button"
        disabled={!value.trim() || isLoading}
      >
        {isLoading ? (
          <>
            <i className="fas fa-circle-notch fa-spin"></i>
            Searching...
          </>
        ) : (
          <>
            <i className="fas fa-magnifying-glass"></i>
            {buttonLabel}
          </>
        )}
      </button>
    </form>
  )
}

// Clickable example chips (shared by both modes via scenarios prop)
function ExampleChips({ scenarios, onSelect, disabled }) {
  return (
    <div className="example-section">
      <p className="example-label">
        <i className="fas fa-bolt example-label-icon"></i>
        Try an example:
      </p>
      <div className="example-chips">
        {scenarios.map((scenario, index) => (
          <button
            key={index}
            onClick={() => onSelect(scenario.query)}
            className="example-chip"
            disabled={disabled}
            title={scenario.query}
          >
            <i className={`fas ${scenario.icon} example-chip-icon`}></i>
            {scenario.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function LoadingState({ message }) {
  return (
    <div className="loading-state">
      <div className="loading-spinner"></div>
      <p className="loading-message">{message}</p>
    </div>
  )
}

function ErrorMessage({ error, onRetry }) {
  return (
    <div className="error-message">
      <h3>Something went wrong</h3>
      <p>{error}</p>
      <button onClick={onRetry} className="retry-button">
        Try Again
      </button>
    </div>
  )
}

// ─── FIND A LOAN COMPONENTS ───────────────────────────────────────────────────

function ParsedScenario({ data }) {
  if (!data) return null

  const fields = [
    { label: 'FICO',          icon: 'fa-star', value: data.fico },
    { label: 'LTV',           icon: 'fa-percent', value: data.ltv ? `${data.ltv}%` : null },
    { label: 'Loan Amount',   icon: 'fa-dollar-sign', value: data.loan_amount ? `$${data.loan_amount.toLocaleString()}` : null },
    { label: 'Property',      icon: 'fa-house', value: data.property_type },
    { label: 'Occupancy',     icon: 'fa-user', value: data.occupancy },
    { label: 'Purpose',       icon: 'fa-bullseye', value: data.purpose },
    { label: 'State',         icon: 'fa-location-dot', value: data.state },
  ].filter(f => f.value)

  return (
    <div className="parsed-scenario">
      <div className="parsed-scenario-label">
        <i className="fas fa-wand-magic-sparkles"></i>
        Parsed Scenario
      </div>
      <div className="parsed-fields">
        {fields.map((field, index) => (
          <div key={index} className="parsed-field">
            <i className={`fas ${field.icon} parsed-field-icon`}></i>
            <span className="field-label">{field.label}</span>
            <span className="field-value">{field.value}</span>
          </div>
        ))}
        {data.other_factors && data.other_factors.length > 0 && (
          <div className="parsed-field other-factors">
            <i className="fas fa-tags parsed-field-icon"></i>
            <span className="field-label">Other</span>
            <span className="field-value">{data.other_factors.join(' · ')}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// Clickable loan result card — clicking opens the full detail modal
function LoanCard({ product, rawProduct, onViewDetails, rank }) {
  return (
    <div className="loan-card" onClick={onViewDetails} title="Click to view full details">

      {/* Rank badge */}
      <div className={`loan-rank rank-${rank}`}>#{rank}</div>

      <div className="loan-card-header">
        <span className="loan-product-type">{product.product_type}</span>
        <h3 className="loan-product-name">{product.product_name}</h3>
        <p className="loan-lender">
          <i className="fas fa-building"></i>
          {product.lender}
        </p>
      </div>

      {/* Key stats grid */}
      <div className="loan-details">
        <div className="loan-detail">
          <span className="detail-label">Min FICO</span>
          <span className="detail-value">{product.min_fico || '—'}</span>
        </div>
        <div className="loan-detail">
          <span className="detail-label">Max LTV</span>
          <span className="detail-value">{product.max_ltv || '—'}</span>
        </div>
        <div className="loan-detail">
          <span className="detail-label">Loan Range</span>
          <span className="detail-value">{product.loan_range || '—'}</span>
        </div>
        <div className="loan-detail">
          <span className="detail-label">Terms</span>
          <span className="detail-value">{product.terms || '—'}</span>
        </div>
      </div>

      {/* AI explanations */}
      {product.why_it_fits && (
        <div className="loan-fit">
          <div className="loan-fit-label">
            <i className="fas fa-circle-check"></i>
            Why it fits
          </div>
          <p>{product.why_it_fits}</p>
        </div>
      )}

      {product.watch_out && (
        <div className="loan-watchout">
          <div className="loan-watchout-label">
            <i className="fas fa-triangle-exclamation"></i>
            Watch out
          </div>
          <p>{product.watch_out}</p>
        </div>
      )}

      <div className="loan-card-footer">
        <button className="view-details-btn" onClick={(e) => { e.stopPropagation(); onViewDetails() }}>
          View Full Details
          <i className="fas fa-arrow-right"></i>
        </button>
      </div>
    </div>
  )
}

// ─── PRODUCT DETAIL MODAL ─────────────────────────────────────────────────────

function FieldValue({ value, format }) {
  const formatted = formatFieldValue(value, format)

  if (formatted === null) return <span className="detail-value empty">—</span>

  if (typeof formatted === 'object' && formatted.type === 'link') {
    return (
      <span className="detail-value">
        <a href={formatted.href} target="_blank" rel="noopener noreferrer">
          {formatted.text}
        </a>
      </span>
    )
  }

  if (typeof formatted === 'object' && formatted.type === 'longtext') {
    return (
      <span className="detail-value long-text">
        {formatted.text.split('\n').map((line, i) => (
          <span key={i}>{line}{i < formatted.text.split('\n').length - 1 && <br />}</span>
        ))}
      </span>
    )
  }

  return <span className="detail-value">{String(formatted)}</span>
}

function ProductModal({ product, onClose }) {
  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [handleKey])

  if (!product) return null

  const lenderName = product.lender_name || ''
  const productName = product.product_name || 'Product Details'

  return (
    <div className="pdm-overlay" role="dialog" aria-modal="true">
      <div className="pdm-backdrop" onClick={onClose}></div>

      <div className="pdm-content">
        {/* Dark navy header */}
        <div className="pdm-header">
          <div className="pdm-header-text">
            {lenderName && (
              <p className="pdm-lender">{lenderName.toUpperCase()}</p>
            )}
            <h2 className="pdm-title">{productName}</h2>
          </div>
          <button className="pdm-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {/* Scrollable body */}
        <div className="pdm-body">
          {MODAL_SECTIONS.map((section) => {
            const visibleFields = section.fields.filter(f => {
              const v = product[f.key]
              return v !== null && v !== undefined && v !== ''
            })
            if (visibleFields.length === 0) return null

            return (
              <div key={section.title} className="pdm-section">
                <h3 className="pdm-section-title">
                  <i className={`section-icon fas ${section.icon}`}></i>
                  {section.title}
                </h3>
                <div className="pdm-grid">
                  {visibleFields.map((field) => (
                    <div key={field.key} className="pdm-item">
                      <span className="detail-label">{field.label}</span>
                      <FieldValue value={product[field.key]} format={field.format} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── FIND A LOAN RESULTS ──────────────────────────────────────────────────────

function LoanResults({ data, onOpenModal }) {
  if (!data) return null

  return (
    <div className="results">
      {data.summary && (
        <div className="results-summary">
          <i className="fas fa-robot results-summary-icon"></i>
          <p>{data.summary}</p>
        </div>
      )}

      <ParsedScenario data={data.parsed_scenario} />

      {data.matches && data.matches.length > 0 ? (
        <div className="results-grid">
          <div className="results-heading">
            <h2>Matching Loan Products</h2>
            <span className="results-count">{data.matches.length} found</span>
          </div>
          <div className="loan-cards">
            {data.matches.map((product, index) => {
              const rawProduct = findRawProduct(product, data.raw_products)
              return (
                <LoanCard
                  key={index}
                  product={product}
                  rawProduct={rawProduct}
                  rank={index + 1}
                  onViewDetails={() => onOpenModal(rawProduct || product)}
                />
              )
            })}
          </div>
        </div>
      ) : (
        <div className="no-results">
          <i className="fas fa-magnifying-glass no-results-icon"></i>
          <p>No matching loan products found for this scenario.</p>
        </div>
      )}

      {data.data_gaps && (
        <div className="data-gaps">
          <strong>Data Gaps:</strong> {data.data_gaps}
        </div>
      )}
    </div>
  )
}

// ─── SEARCH GUIDELINES COMPONENTS ────────────────────────────────────────────

// Renders **bold** inline markdown within a line of text
function renderInline(text) {
  const parts = text.split(/(\*\*(?:[^*]|\*(?!\*))+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return part || null
  })
}

// Converts Claude's markdown response into structured JSX.
// Handles: # h1, ## h2, ### h3, - / • / * / numbered bullets, **bold**, plain paragraphs.
function GuidelineMarkdown({ text }) {
  const lines = text.split('\n')
  const elements = []
  let listItems = []

  const flushList = (key) => {
    if (listItems.length > 0) {
      elements.push(<ul key={`ul-${key}`} className="gs-md-list">{listItems}</ul>)
      listItems = []
    }
  }

  // Match bullet lines: - , * , • , or numbered like "1. ", "2) "
  const bulletMatch = (line) => {
    const m = line.match(/^(?:[-*•]\s+|\d+[.)]\s+)(.*)/)
    return m ? m[1] : null
  }

  lines.forEach((line, i) => {
    if (line.startsWith('# ')) {
      flushList(i)
      elements.push(<h3 key={i} className="gs-md-h1">{renderInline(line.slice(2))}</h3>)
    } else if (line.startsWith('## ')) {
      flushList(i)
      elements.push(<h4 key={i} className="gs-md-h2">{renderInline(line.slice(3))}</h4>)
    } else if (line.startsWith('### ')) {
      flushList(i)
      elements.push(<h5 key={i} className="gs-md-h3">{renderInline(line.slice(4))}</h5>)
    } else if (bulletMatch(line) !== null) {
      listItems.push(<li key={i}>{renderInline(bulletMatch(line))}</li>)
    } else if (line.trim() === '') {
      flushList(i)
    } else {
      flushList(i)
      elements.push(<p key={i} className="gs-md-p">{renderInline(line)}</p>)
    }
  })

  flushList('end')
  return <>{elements}</>
}

// A single source citation card — clickable to open the product detail modal
function GuidelineSourceCard({ source, rank, onOpenProduct }) {
  return (
    <div
      className="gs-source-card gs-source-clickable"
      onClick={() => onOpenProduct(source.product_name, source.lender_name)}
      title="Click to view full product details"
    >
      <div className="gs-source-rank">{rank}</div>
      <div className="gs-source-body">
        <div className="gs-source-header">
          <span className="gs-source-lender">
            <i className="fas fa-building"></i>
            {source.lender_name}
          </span>
          <span className="gs-source-product">{source.product_name}</span>
          {source.similarity > 0 && (
            <span
              className="gs-source-relevance"
              title={`${source.similarity}% similarity to your question`}
            >
              {source.similarity}% match
            </span>
          )}
        </div>
        <span className="gs-source-view-link">
          View Full Details <i className="fas fa-arrow-right"></i>
        </span>
      </div>
    </div>
  )
}

// The full guidelines search results: synthesized answer + source citations
function GuidelineResults({ data, onOpenProduct }) {
  if (!data) return null

  return (
    <div className="gs-results">

      {/* Synthesized answer box */}
      <div className="gs-answer">
        <div className="gs-answer-header">
          <i className="fas fa-robot gs-answer-icon"></i>
          <span className="gs-answer-label">AI Answer</span>
        </div>
        <div className="gs-answer-text">
          <GuidelineMarkdown text={data.answer} />
        </div>
        <p className="gs-answer-disclaimer">
          <i className="fas fa-circle-info"></i>{' '}
          Answer synthesized from lender matrices and guidelines. Always verify directly with the lender before presenting to borrowers.
        </p>
      </div>

      {/* Source citations */}
      {data.sources && data.sources.length > 0 && (
        <div className="gs-sources">
          <div className="gs-sources-heading">
            <h3>
              <i className="fas fa-file-pdf"></i>
              Sources
            </h3>
            <span className="results-count">{data.sources.length} document{data.sources.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="gs-source-list">
            {data.sources.map((source, i) => (
              <GuidelineSourceCard key={i} source={source} rank={i + 1} onOpenProduct={onOpenProduct} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ADD LENDER (ADMIN-ONLY) ─────────────────────────────────────────────────

function AddLenderPanel() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const PROGRESS_MSGS = [
    'Fetching lender website...',
    'Checking sub-pages (about, wholesale, contact)...',
    'Extracting lender details with AI...',
    'Checking for duplicates in Airtable...',
    'Creating lender record...',
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!url.trim() || loading) return

    setLoading(true)
    setError(null)
    setResult(null)

    let msgIdx = 0
    setProgress(PROGRESS_MSGS[0])
    const interval = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, PROGRESS_MSGS.length - 1)
      setProgress(PROGRESS_MSGS[msgIdx])
    }, 3000)

    try {
      const token = getOutsetaToken()
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const response = await fetch(ADD_LENDER_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: url.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`)
      }

      setResult(data)
      if (data.success) setUrl('') // Clear input on success
    } catch (err) {
      console.error('Add lender error:', err)
      setError(err.message || 'Failed to add lender. Please try again.')
    } finally {
      clearInterval(interval)
      setLoading(false)
      setProgress('')
    }
  }

  // Handle "Create Anyway" when a duplicate is found
  const handleForceCreate = async () => {
    if (!result?.extracted) return

    setLoading(true)
    setError(null)
    setProgress('Creating lender record (override)...')

    try {
      const token = getOutsetaToken()
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const response = await fetch(ADD_LENDER_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: url.trim(), force: true }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to create record')
      setResult(data)
      if (data.success) setUrl('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setProgress('')
    }
  }

  return (
    <div className="add-lender-panel">
      <div className="add-lender-header">
        <h2>
          <i className="fas fa-building-circle-arrow-right"></i>
          Add New Lender
        </h2>
        <p>Paste a lender's website URL and AI will extract their details and create an Airtable record.</p>
      </div>

      <form onSubmit={handleSubmit} className="add-lender-form">
        <div className="add-lender-input-row">
          <div className="add-lender-input-wrap">
            <i className="fas fa-globe add-lender-input-icon"></i>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.lendername.com"
              className="add-lender-input"
              disabled={loading}
            />
          </div>
          <button type="submit" className="add-lender-btn" disabled={!url.trim() || loading}>
            {loading ? (
              <>
                <i className="fas fa-circle-notch fa-spin"></i>
                Processing...
              </>
            ) : (
              <>
                <i className="fas fa-wand-magic-sparkles"></i>
                Fetch &amp; Add
              </>
            )}
          </button>
        </div>
      </form>

      {/* Loading progress */}
      {loading && (
        <div className="add-lender-loading">
          <div className="loading-spinner"></div>
          <p className="loading-message">{progress}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="add-lender-error">
          <i className="fas fa-circle-exclamation"></i>
          <p>{error}</p>
        </div>
      )}

      {/* Duplicate warning */}
      {result && result.duplicate && (
        <div className="add-lender-duplicate">
          <div className="add-lender-duplicate-header">
            <i className="fas fa-triangle-exclamation"></i>
            <h3>Possible Duplicate Found</h3>
          </div>
          <p>{result.message}</p>
          <div className="add-lender-duplicate-list">
            {result.existing_records?.map((rec) => (
              <a
                key={rec.id}
                href={`https://airtable.com/appuJgI9X93OLaf0u/tbl1mpg3KFakZsFK7/${rec.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="add-lender-duplicate-link"
              >
                <i className="fas fa-arrow-up-right-from-square"></i>
                {rec.name}
              </a>
            ))}
          </div>
          <div className="add-lender-duplicate-actions">
            <button onClick={handleForceCreate} className="add-lender-btn add-lender-btn-secondary">
              <i className="fas fa-plus"></i>
              Create Anyway
            </button>
            <button onClick={() => setResult(null)} className="add-lender-btn add-lender-btn-ghost">
              Cancel
            </button>
          </div>

          {/* Show what was extracted */}
          {result.extracted && (
            <div className="add-lender-preview">
              <h4><i className="fas fa-eye"></i> Extracted Details</h4>
              <ExtractedFieldsTable extracted={result.extracted} />
            </div>
          )}
        </div>
      )}

      {/* Success result */}
      {result && result.success && (
        <div className="add-lender-success">
          <div className="add-lender-success-header">
            <i className="fas fa-circle-check"></i>
            <h3>Lender Added Successfully</h3>
          </div>

          <div className="add-lender-success-meta">
            <span className="add-lender-lender-name">{result.lender_name}</span>
            <a
              href={result.airtable_url}
              target="_blank"
              rel="noopener noreferrer"
              className="add-lender-airtable-link"
            >
              <i className="fas fa-arrow-up-right-from-square"></i>
              Open in Airtable
            </a>
          </div>

          {/* Fields populated */}
          <div className="add-lender-fields-section">
            <h4>
              <i className="fas fa-check"></i>
              Fields Populated ({result.fields_populated?.length || 0})
            </h4>
            <div className="add-lender-field-tags">
              {result.fields_populated?.map((f) => (
                <span key={f} className="add-lender-field-tag populated">{f}</span>
              ))}
            </div>
          </div>

          {/* Fields still needed */}
          {result.fields_missing?.length > 0 && (
            <div className="add-lender-fields-section">
              <h4>
                <i className="fas fa-pen"></i>
                Still Needs Manual Entry ({result.fields_missing.length})
              </h4>
              <div className="add-lender-field-tags">
                {result.fields_missing?.map((f) => (
                  <span key={f} className="add-lender-field-tag missing">{f}</span>
                ))}
              </div>
            </div>
          )}

          {/* Show all extracted values */}
          {result.extracted && (
            <div className="add-lender-preview">
              <h4><i className="fas fa-table"></i> All Extracted Values</h4>
              <ExtractedFieldsTable extracted={result.extracted} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Table showing what Claude extracted from the website
function ExtractedFieldsTable({ extracted }) {
  const rows = Object.entries(extracted).filter(([, v]) => v !== null && v !== '')
  if (rows.length === 0) return <p>No fields extracted.</p>

  // Friendly labels for the Claude response keys
  const labels = {
    lender_name: 'Lender Name',
    description: 'Description',
    corporate_website: 'Corporate Website',
    tpo_broker_portal: 'TPO Broker Portal',
    nmls: 'NMLS',
    fha_id: 'FHA ID',
    va_id: 'VA ID',
    usda_id: 'USDA ID',
    licensed_states: 'Licensed States',
    scenario_desk: 'Scenario Desk',
    facebook: 'Facebook',
    linkedin: 'LinkedIn',
    instagram: 'Instagram',
    youtube: 'YouTube',
    x_twitter: 'X (Twitter)',
    lender_or_broker: 'Lender or Broker',
  }

  return (
    <table className="add-lender-table">
      <tbody>
        {rows.map(([key, value]) => (
          <tr key={key}>
            <td className="add-lender-table-label">{labels[key] || key}</td>
            <td className="add-lender-table-value">
              {typeof value === 'string' && value.startsWith('http') ? (
                <a href={value} target="_blank" rel="noopener noreferrer">{value}</a>
              ) : (
                String(value).length > 200 ? String(value).slice(0, 200) + '...' : String(value)
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
// Note: Navbar, sidebar, and footer are handled by Webflow (Navbar_App,
// Sidebar_App, Footer_App components). Auth gating is handled by Outseta.

function App() {
  // Which search mode is active
  const [activeMode, setActiveMode] = useState('find')
  const [showAdmin] = useState(() => isAdmin())

  // ── Find a Loan state ──
  const [scenario, setScenario] = useState('')
  const [loanResults, setLoanResults] = useState(null)
  const [loanLoading, setLoanLoading] = useState(false)
  const [loanError, setLoanError] = useState(null)
  const [loanProgress, setLoanProgress] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)

  // ── Search Guidelines state ──
  const [guidelineQuery, setGuidelineQuery] = useState('')
  const [guidelineResults, setGuidelineResults] = useState(null)
  const [guidelineLoading, setGuidelineLoading] = useState(false)
  const [guidelineError, setGuidelineError] = useState(null)
  const [guidelineProgress, setGuidelineProgress] = useState('')

  // ── Search usage tracking (for LITE plan daily limit) ──
  const [searchUsage, setSearchUsage] = useState(null) // { plan, searches_today, daily_limit }

  // ── Loan search handler ──
  const handleLoanSearch = async () => {
    if (!scenario.trim()) return

    setLoanLoading(true)
    setLoanError(null)
    setLoanResults(null)

    let msgIdx = 0
    setLoanProgress(PROGRESS_MESSAGES[0])
    const interval = setInterval(() => {
      msgIdx = (msgIdx + 1) % PROGRESS_MESSAGES.length
      setLoanProgress(PROGRESS_MESSAGES[msgIdx])
    }, 3000)

    try {
      // Include Outseta JWT so the API can identify the user and their plan
      const token = getOutsetaToken()
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const response = await fetch(API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ scenario }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        // Update usage info even on limit error (429)
        if (errorData.plan) {
          setSearchUsage({
            plan: errorData.plan,
            searches_today: errorData.used || 0,
            daily_limit: errorData.limit || null,
          })
        }
        throw new Error(errorData.error || `Request failed with status ${response.status}`)
      }

      const data = await response.json()
      setLoanResults(data)
      // Update usage info from successful response
      if (data.usage) setSearchUsage(data.usage)
    } catch (err) {
      console.error('Loan search error:', err)
      setLoanError(err.message || 'Failed to search for loan products. Please try again.')
    } finally {
      clearInterval(interval)
      setLoanLoading(false)
      setLoanProgress('')
    }
  }

  // ── Guideline search handler ──
  const handleGuidelineSearch = async () => {
    if (!guidelineQuery.trim()) return

    setGuidelineLoading(true)
    setGuidelineError(null)
    setGuidelineResults(null)

    let msgIdx = 0
    setGuidelineProgress(GUIDELINE_PROGRESS_MESSAGES[0])
    const interval = setInterval(() => {
      msgIdx = (msgIdx + 1) % GUIDELINE_PROGRESS_MESSAGES.length
      setGuidelineProgress(GUIDELINE_PROGRESS_MESSAGES[msgIdx])
    }, 3000)

    try {
      const token = getOutsetaToken()
      const glHeaders = { 'Content-Type': 'application/json' }
      if (token) glHeaders['Authorization'] = `Bearer ${token}`

      const response = await fetch(GUIDELINE_API_URL, {
        method: 'POST',
        headers: glHeaders,
        body: JSON.stringify({ query: guidelineQuery }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Request failed with status ${response.status}`)
      }

      const data = await response.json()
      setGuidelineResults(data)
    } catch (err) {
      console.error('Guideline search error:', err)
      setGuidelineError(err.message || 'Failed to search guidelines. Please try again.')
    } finally {
      clearInterval(interval)
      setGuidelineLoading(false)
      setGuidelineProgress('')
    }
  }

  // ── Look up a product by name (used by guideline source cards) ──
  const handleOpenProduct = async (productName, lenderName) => {
    try {
      const token = getOutsetaToken()
      const plHeaders = { 'Content-Type': 'application/json' }
      if (token) plHeaders['Authorization'] = `Bearer ${token}`

      const response = await fetch(PRODUCT_LOOKUP_URL, {
        method: 'POST',
        headers: plHeaders,
        body: JSON.stringify({ product_name: productName, lender_name: lenderName }),
      })
      if (!response.ok) return
      const data = await response.json()
      if (data.product) setSelectedProduct(data.product)
    } catch (err) {
      console.error('Product lookup error:', err)
    }
  }

  const isAnyLoading = loanLoading || guidelineLoading

  return (
    <main className="main-content">
      <div className="hero-compact">
        <div className="hero-top-row">
          <h1>
            AI Loan Finder
            <span className="beta-badge">BETA</span>
          </h1>
          <ModeSwitcher activeMode={activeMode} onChange={setActiveMode} showAdmin={showAdmin} />
        </div>
        <p className="hero-tagline">
          {activeMode === 'find'
            ? 'Describe a borrower scenario to instantly find matching wholesale loan products.'
            : activeMode === 'guidelines'
            ? 'Ask any question about lender guidelines — answers sourced from lender matrices and guidelines.'
            : 'Paste a lender URL to auto-populate a new Airtable record.'
          }
          <span className="hero-disclaimer">Always verify with the lender before presenting to borrowers.</span>
        </p>
      </div>

      {/* ── Find a Loan Mode ── */}
      {activeMode === 'find' && (
        <>
          <div className="search-container">
            <SearchInput
              value={scenario}
              onChange={setScenario}
              onSubmit={handleLoanSearch}
              isLoading={loanLoading}
              placeholder="Describe your borrower scenario in plain English... (e.g., '680 FICO, self-employed, buying investment property with 20% down')"
              buttonLabel="Find Loan Products"
            />
            <ExampleChips
              scenarios={EXAMPLE_SCENARIOS}
              onSelect={(q) => { setScenario(q); setLoanResults(null); setLoanError(null) }}
              disabled={isAnyLoading}
            />

            {/* Daily search usage indicator for LITE plan users */}
            {searchUsage && searchUsage.daily_limit && (
              <div className="search-usage-banner">
                <i className="fas fa-chart-simple"></i>{' '}
                <span>
                  {searchUsage.searches_today}/{searchUsage.daily_limit} daily searches used
                </span>
                {searchUsage.searches_today >= searchUsage.daily_limit && (
                  <span className="usage-limit-hit">
                    {' '}&mdash; <a href="https://mtg.broker/pricing" target="_blank" rel="noopener noreferrer">Upgrade to PLUS or PRO</a> for unlimited searches
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="results-container">
            {loanLoading && <LoadingState message={loanProgress} />}
            {loanError && <ErrorMessage error={loanError} onRetry={handleLoanSearch} />}
            {loanResults && !loanLoading && (
              <LoanResults
                data={loanResults}
                onOpenModal={(product) => setSelectedProduct(product)}
              />
            )}
          </div>
        </>
      )}

      {/* ── Search Guidelines Mode ── */}
      {activeMode === 'guidelines' && (
        <>
          <div className="search-container">
            <SearchInput
              value={guidelineQuery}
              onChange={setGuidelineQuery}
              onSubmit={handleGuidelineSearch}
              isLoading={guidelineLoading}
              placeholder="Ask about lender guidelines... (e.g., 'Which lenders allow gift funds on investment properties?')"
              buttonLabel="Search Guidelines"
            />
            <ExampleChips
              scenarios={GUIDELINE_EXAMPLES}
              onSelect={(q) => { setGuidelineQuery(q); setGuidelineResults(null); setGuidelineError(null) }}
              disabled={isAnyLoading}
            />
          </div>

          <div className="results-container">
            {guidelineLoading && <LoadingState message={guidelineProgress} />}
            {guidelineError && <ErrorMessage error={guidelineError} onRetry={handleGuidelineSearch} />}
            {guidelineResults && !guidelineLoading && (
              <GuidelineResults data={guidelineResults} onOpenProduct={handleOpenProduct} />
            )}
          </div>
        </>
      )}

      {/* ── Add Lender Mode (Admin Only) ── */}
      {activeMode === 'addLender' && showAdmin && (
        <AddLenderPanel />
      )}

      {/* Product Detail Modal — only used in Find a Loan mode */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </main>
  )
}

export default App

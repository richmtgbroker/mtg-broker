import { useState, useEffect, useCallback } from 'react'

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const API_URL = 'https://mtg-loan-finder.pages.dev/api/search'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const EXAMPLE_SCENARIOS = [
  "640 FICO, self-employed 2 years, buying a duplex as investment property, 25% down in Florida",
  "720 credit score, first-time homebuyer, looking at a condo, 5% down, primary residence",
  "Who does bank statement loans for self-employed borrowers with a 680 score?",
  "DSCR loan for a 4-unit investment property, 700 FICO, 30% down",
  "What lender does ITIN loans? Borrower has a 600 score.",
  "VA loan options for a manufactured home, 660 credit score"
]

const PROGRESS_MESSAGES = [
  "Analyzing your borrower scenario...",
  "Searching loan products database...",
  "Matching criteria against 625+ products...",
  "Ranking best fits for your scenario...",
  "Preparing results..."
]

// ─── MODAL FIELD SECTIONS ─────────────────────────────────────────────────────
// Organizes all 55 Supabase fields into logical sections for the product detail modal.
// Mirrors the Loan Search page modal design (Loan Search v7.7).

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
// Claude returns product_name — match against Supabase product_name field.
function findRawProduct(match, rawProducts) {
  if (!rawProducts || !rawProducts.length) return null

  const matchName = (match.product_name || '').toLowerCase().trim()
  const matchLender = (match.lender || '').toLowerCase().trim()

  // 1. Exact match on product_name
  let found = rawProducts.find(p =>
    (p.product_name || '').toLowerCase().trim() === matchName
  )

  // 2. Exact match on product_name + lender
  if (!found) {
    found = rawProducts.find(p =>
      (p.product_name || '').toLowerCase().trim() === matchName &&
      (p.lender_name || '').toLowerCase().trim() === matchLender
    )
  }

  // 3. Partial match — Supabase name contains Claude name (Claude may have truncated it)
  if (!found && matchName.length > 10) {
    found = rawProducts.find(p =>
      (p.product_name || '').toLowerCase().includes(matchName) ||
      matchName.includes((p.product_name || '').toLowerCase().trim())
    )
  }

  // 4. Match by lender name only as last resort
  if (!found && matchLender.length > 2) {
    found = rawProducts.find(p =>
      (p.lender_name || '').toLowerCase().trim() === matchLender
    )
  }

  return found || null
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function SearchInput({ value, onChange, onSubmit, isLoading }) {
  const handleSubmit = (e) => {
    e.preventDefault()
    if (value.trim() && !isLoading) onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="search-form">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe your borrower scenario in plain English... (e.g., '680 FICO, self-employed, buying investment property with 20% down')"
        className="search-input"
        rows={3}
        disabled={isLoading}
      />
      <button
        type="submit"
        className="search-button"
        disabled={!value.trim() || isLoading}
      >
        {isLoading ? 'Searching...' : 'Find Loan Products'}
      </button>
    </form>
  )
}

function ExampleChips({ onSelect, disabled }) {
  return (
    <div className="example-section">
      <p className="example-label">Try an example:</p>
      <div className="example-chips">
        {EXAMPLE_SCENARIOS.map((scenario, index) => (
          <button
            key={index}
            onClick={() => onSelect(scenario)}
            className="example-chip"
            disabled={disabled}
          >
            {scenario}
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

function ParsedScenario({ data }) {
  if (!data) return null

  const fields = [
    { label: 'FICO Score',    value: data.fico },
    { label: 'LTV',           value: data.ltv ? `${data.ltv}%` : null },
    { label: 'Loan Amount',   value: data.loan_amount ? `$${data.loan_amount.toLocaleString()}` : null },
    { label: 'Property Type', value: data.property_type },
    { label: 'Occupancy',     value: data.occupancy },
    { label: 'Purpose',       value: data.purpose },
    { label: 'State',         value: data.state },
  ].filter(f => f.value)

  return (
    <div className="parsed-scenario">
      <h3>Parsed Scenario</h3>
      <div className="parsed-fields">
        {fields.map((field, index) => (
          <div key={index} className="parsed-field">
            <span className="field-label">{field.label}:</span>
            <span className="field-value">{field.value}</span>
          </div>
        ))}
        {data.other_factors && data.other_factors.length > 0 && (
          <div className="parsed-field other-factors">
            <span className="field-label">Other Factors:</span>
            <span className="field-value">{data.other_factors.join(', ')}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// Clickable loan result card — clicking opens the full detail modal
function LoanCard({ product, rawProduct, onViewDetails }) {
  return (
    <div className="loan-card" onClick={onViewDetails} title="Click to view full details">
      <div className="loan-card-header">
        <h3 className="loan-product-name">{product.product_name}</h3>
        <span className="loan-product-type">{product.product_type}</span>
      </div>
      <p className="loan-lender">{product.lender}</p>

      <div className="loan-details">
        <div className="loan-detail">
          <span className="detail-label">Min FICO</span>
          <span className="detail-value">{product.min_fico || 'N/A'}</span>
        </div>
        <div className="loan-detail">
          <span className="detail-label">Max LTV</span>
          <span className="detail-value">{product.max_ltv || 'N/A'}</span>
        </div>
        <div className="loan-detail">
          <span className="detail-label">Loan Range</span>
          <span className="detail-value">{product.loan_range || 'N/A'}</span>
        </div>
        <div className="loan-detail">
          <span className="detail-label">Terms</span>
          <span className="detail-value">{product.terms || 'N/A'}</span>
        </div>
      </div>

      {product.why_it_fits && (
        <div className="loan-fit">
          <strong>Why it fits:</strong> {product.why_it_fits}
        </div>
      )}

      {product.watch_out && (
        <div className="loan-watchout">
          <strong>Watch out:</strong> {product.watch_out}
        </div>
      )}

      <div className="loan-card-footer">
        <button className="view-details-btn" onClick={(e) => { e.stopPropagation(); onViewDetails() }}>
          <i className="fas fa-list-ul"></i> View Full Details
        </button>
      </div>
    </div>
  )
}

// ─── PRODUCT DETAIL MODAL ─────────────────────────────────────────────────────
// Matches the Loan Search page modal design (v7.7):
//   - Dark navy header with lender + product name
//   - White section cards organized by category
//   - Responsive grid of label/value pairs

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
  // Close on Escape key
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
      {/* Backdrop — click to close */}
      <div className="pdm-backdrop" onClick={onClose}></div>

      <div className="pdm-content">
        {/* Header — dark navy, matches Loan Search modal */}
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
            // Only render sections that have at least one non-empty field
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

// ─── RESULTS ──────────────────────────────────────────────────────────────────

function Results({ data, onOpenModal }) {
  if (!data) return null

  return (
    <div className="results">
      {data.summary && (
        <div className="results-summary">
          <p>{data.summary}</p>
        </div>
      )}

      <ParsedScenario data={data.parsed_scenario} />

      {data.matches && data.matches.length > 0 ? (
        <div className="results-grid">
          <h2>Matching Loan Products ({data.matches.length})</h2>
          <div className="loan-cards">
            {data.matches.map((product, index) => {
              const rawProduct = findRawProduct(product, data.raw_products)
              return (
                <LoanCard
                  key={index}
                  product={product}
                  rawProduct={rawProduct}
                  onViewDetails={() => onOpenModal(rawProduct || product)}
                />
              )
            })}
          </div>
        </div>
      ) : (
        <div className="no-results">
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

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
// Note: Navbar, sidebar, and footer are handled by Webflow (Navbar_App,
// Sidebar_App, Footer_App components). Auth gating is handled by Outseta
// on the Webflow page. This app renders search UI only.

function App() {
  const [scenario, setScenario] = useState('')
  const [results, setResults] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [progressMessage, setProgressMessage] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)

  const handleSearch = async () => {
    if (!scenario.trim()) return

    setIsLoading(true)
    setError(null)
    setResults(null)

    let messageIndex = 0
    setProgressMessage(PROGRESS_MESSAGES[0])
    const progressInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % PROGRESS_MESSAGES.length
      setProgressMessage(PROGRESS_MESSAGES[messageIndex])
    }, 3000)

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Request failed with status ${response.status}`)
      }

      const data = await response.json()
      setResults(data)
    } catch (err) {
      console.error('Search error:', err)
      setError(err.message || 'Failed to search for loan products. Please try again.')
    } finally {
      clearInterval(progressInterval)
      setIsLoading(false)
      setProgressMessage('')
    }
  }

  const handleExampleSelect = (example) => {
    setScenario(example)
    setResults(null)
    setError(null)
  }

  return (
    <main className="main-content">
      <div className="hero">
        <h1>AI Loan Finder</h1>
        <p className="hero-subtitle">
          Describe your borrower scenario in plain English and instantly find matching wholesale loan products.
        </p>
      </div>

      <div className="search-container">
        <SearchInput
          value={scenario}
          onChange={setScenario}
          onSubmit={handleSearch}
          isLoading={isLoading}
        />
        <ExampleChips
          onSelect={handleExampleSelect}
          disabled={isLoading}
        />
      </div>

      <div className="results-container">
        {isLoading && <LoadingState message={progressMessage} />}
        {error && <ErrorMessage error={error} onRetry={handleSearch} />}
        {results && !isLoading && (
          <Results
            data={results}
            onOpenModal={(product) => setSelectedProduct(product)}
          />
        )}
      </div>

      {/* Product Detail Modal */}
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

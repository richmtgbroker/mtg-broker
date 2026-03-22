import { useState } from 'react'

// ─── CONFIG ──────────────────────────────────────────────────────────────────
// API URL for the Cloudflare Pages Function backend.
// Update this to the actual Cloudflare Pages domain once deployed.
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

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function SearchInput({ value, onChange, onSubmit, isLoading }) {
  const handleSubmit = (e) => {
    e.preventDefault()
    if (value.trim() && !isLoading) {
      onSubmit()
    }
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
    { label: 'FICO Score', value: data.fico },
    { label: 'LTV', value: data.ltv ? `${data.ltv}%` : null },
    { label: 'Loan Amount', value: data.loan_amount ? `$${data.loan_amount.toLocaleString()}` : null },
    { label: 'Property Type', value: data.property_type },
    { label: 'Occupancy', value: data.occupancy },
    { label: 'Purpose', value: data.purpose },
    { label: 'State', value: data.state }
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

function LoanCard({ product }) {
  return (
    <div className="loan-card">
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
    </div>
  )
}

function Results({ data }) {
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
            {data.matches.map((product, index) => (
              <LoanCard key={index} product={product} />
            ))}
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

  const handleSearch = async () => {
    if (!scenario.trim()) return

    setIsLoading(true)
    setError(null)
    setResults(null)

    // Cycle through progress messages while waiting
    let messageIndex = 0
    setProgressMessage(PROGRESS_MESSAGES[0])
    const progressInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % PROGRESS_MESSAGES.length
      setProgressMessage(PROGRESS_MESSAGES[messageIndex])
    }, 3000)

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ scenario })
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
        <div className="hero-title-row">
          <h1>AI Loan Finder</h1>
          <span className="beta-badge">BETA</span>
        </div>
        <p className="hero-subtitle">
          Describe your borrower scenario in plain English and instantly find matching wholesale loan products.
        </p>
        <p className="hero-disclaimer">Results may not be perfect. We're actively improving accuracy.</p>
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
        {results && !isLoading && <Results data={results} />}
      </div>
    </main>
  )
}

export default App

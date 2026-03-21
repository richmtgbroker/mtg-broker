import { useState, useEffect } from 'react'

// Example scenarios from CLAUDE.md
const EXAMPLE_SCENARIOS = [
  "640 FICO, self-employed 2 years, buying a duplex as investment property, 25% down in Florida",
  "720 credit score, first-time homebuyer, looking at a condo, 5% down, primary residence",
  "Who does bank statement loans for self-employed borrowers with a 680 score?",
  "DSCR loan for a 4-unit investment property, 700 FICO, 30% down",
  "What lender does ITIN loans? Borrower has a 600 score.",
  "VA loan options for a manufactured home, 660 credit score"
]

// Navigation links - now using same-domain paths
const NAV_LINKS = [
  { label: 'Dashboard', url: '/dashboard' },
  { label: 'AI Loan Finder', url: '/app/ai-search', active: true },
  { label: 'Loan Search', url: '/loan-search' },
  { label: 'Lenders', url: '/lenders' },
  { label: 'Calculators', url: '/calculators' }
]

// Progress messages to show during search
const PROGRESS_MESSAGES = [
  "Analyzing your borrower scenario...",
  "Searching loan products database...",
  "Matching criteria against 625+ products...",
  "Ranking best fits for your scenario...",
  "Preparing results..."
]

// Decode JWT token (without verification - client-side only)
function decodeJwt(token) {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch (e) {
    return null
  }
}

// Check if JWT is expired
function isTokenExpired(token) {
  const decoded = decodeJwt(token)
  if (!decoded || !decoded.exp) return true
  return decoded.exp * 1000 < Date.now()
}

// Get user info from token
function getUserFromToken(token) {
  const decoded = decodeJwt(token)
  if (!decoded) return null
  return {
    email: decoded.email || decoded['https://outseta.com/email'] || null,
    name: decoded.name || decoded['https://outseta.com/name'] || null
  }
}

// Check auth state from localStorage
function getAuthState() {
  const token = localStorage.getItem('Outseta.nocode.accessToken')
  if (!token || isTokenExpired(token)) {
    return { isAuthenticated: false, user: null }
  }
  const user = getUserFromToken(token)
  return { isAuthenticated: true, user }
}

function Navbar({ user, onSignOut }) {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <a href="/" className="navbar-logo">
          <div className="logo-icon">
            <span>mtg</span>
          </div>
          <span className="logo-text">mtg.broker</span>
        </a>
        <div className="navbar-links">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.url}
              className={`navbar-link ${link.active ? 'active' : ''}`}
            >
              {link.label}
            </a>
          ))}
        </div>
        {user && (
          <div className="navbar-user">
            <span className="user-email">{user.email}</span>
            <button onClick={onSignOut} className="sign-out-button">
              Sign Out
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}

function LoginPrompt() {
  return (
    <div className="login-prompt">
      <div className="login-prompt-content">
        <h2>Sign in to use AI Loan Finder</h2>
        <p>Access our AI-powered loan matching tool to find the best wholesale products for your borrowers.</p>
        <a href="/login?redirect=/app/ai-search/" className="login-button">
          Sign In
        </a>
      </div>
    </div>
  )
}

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

function App() {
  const [scenario, setScenario] = useState('')
  const [results, setResults] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [progressMessage, setProgressMessage] = useState('')
  const [authState, setAuthState] = useState({ isAuthenticated: false, user: null })

  // Check auth state on mount and when localStorage changes
  useEffect(() => {
    // Check if access_token is in URL query params (from login redirect)
    const urlParams = new URLSearchParams(window.location.search)
    const accessToken = urlParams.get('access_token')

    if (accessToken) {
      // Save token to localStorage
      localStorage.setItem('Outseta.nocode.accessToken', accessToken)

      // Remove token from URL without page reload
      urlParams.delete('access_token')
      const newUrl = urlParams.toString()
        ? `${window.location.pathname}?${urlParams.toString()}`
        : window.location.pathname
      window.history.replaceState({}, '', newUrl)
    }

    const checkAuth = () => {
      setAuthState(getAuthState())
    }

    // Check immediately
    checkAuth()

    // Listen for storage changes (e.g., login in another tab)
    window.addEventListener('storage', checkAuth)

    // Also check periodically for Outseta auth changes
    const interval = setInterval(checkAuth, 1000)

    return () => {
      window.removeEventListener('storage', checkAuth)
      clearInterval(interval)
    }
  }, [])

  const handleSignOut = () => {
    // Clear localStorage token
    localStorage.removeItem('Outseta.nocode.accessToken')
    // Redirect to login page
    window.location.href = '/login'
  }

  const handleSearch = async () => {
    if (!scenario.trim()) return

    setIsLoading(true)
    setError(null)
    setResults(null)

    // Cycle through progress messages
    let messageIndex = 0
    setProgressMessage(PROGRESS_MESSAGES[0])
    const progressInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % PROGRESS_MESSAGES.length
      setProgressMessage(PROGRESS_MESSAGES[messageIndex])
    }, 3000)

    try {
      const response = await fetch('/app/ai-search/api/search', {
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
    <div className="app">
      <Navbar user={authState.user} onSignOut={handleSignOut} />

      <main className="main-content">
        <div className="hero">
          <h1>AI Loan Finder</h1>
          <p className="hero-subtitle">
            Describe your borrower scenario in plain English and instantly find matching wholesale loan products.
          </p>
        </div>

        {authState.isAuthenticated ? (
          <>
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
          </>
        ) : (
          <LoginPrompt />
        )}
      </main>

      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} mtg.broker. All rights reserved.</p>
      </footer>
    </div>
  )
}

export default App

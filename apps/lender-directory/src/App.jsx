import { useState, useEffect, useRef, useCallback } from 'react'

// ============================================
// CONFIGURATION
// ============================================
const LENDERS_API_URL = 'https://mtg-broker-lenders.rich-e00.workers.dev'
const FAVORITES_API_URL = 'https://mtg-broker-favorites.rich-e00.workers.dev'

// Cache settings
const LENDERS_CACHE_KEY = 'lenders_directory_v6'
const LENDERS_CACHE_TTL = 2 * 60 * 60 * 1000      // 2 hours — "fresh" window
const LENDERS_STALE_TTL = 24 * 60 * 60 * 1000     // 24 hours — "stale but usable"

// Old cache keys to clean up on mount
const OLD_CACHE_KEYS = [
  'lenders_directory_cache',
  'lenders_directory_cache_v2',
  'lenders_directory_v2',
  'lenders_directory_v3',
  'lenders_directory_v4',
  'lenders_directory_v5',
]

// ============================================
// HELPER: Extract user email from Outseta JWT
// ============================================
function getUserEmail() {
  try {
    const token = localStorage.getItem('Outseta.nocode.accessToken')
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return (payload.email || '').toLowerCase()
    }
  } catch (e) { /* ignore */ }
  return ''
}

// ============================================
// HELPER: Check NEXA status via JWT (instant)
// ============================================
function checkNexaViaJWT() {
  try {
    const token = localStorage.getItem('Outseta.nocode.accessToken')
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const email = (payload.email || '').toLowerCase()
      if (email.endsWith('@nexamortgage.com') || email.endsWith('@nexalending.com')) {
        return true
      }
    }
  } catch (e) { /* ignore */ }
  return false
}

// ============================================
// HELPER: Check NEXA via Outseta (slow, async)
// ============================================
async function checkNexaViaOutseta() {
  try {
    if (typeof window.getCachedOutsetaUser !== 'function') {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    if (typeof window.getCachedOutsetaUser === 'function') {
      const user = await window.getCachedOutsetaUser()
      if (user && user.NexaAccess === 'true') {
        return true
      }
    }
  } catch (e) { /* ignore */ }
  return false
}

// ============================================
// HELPER: URL validation
// ============================================
function isValidURL(val) {
  if (!val) return false
  const trimmed = val.trim()
  if (trimmed === '' || trimmed === '#' || trimmed === '-') return false
  if (trimmed.includes('{') || trimmed.includes('%7B')) return false
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('//')) return false
  return true
}

// ============================================
// HELPER: HTML/attribute escaping
// ============================================
function escapeHtml(str) {
  if (!str) return ''
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ============================================
// CACHE: Read from localStorage
// Returns { lenders, timestamp } or null
// ============================================
function getCachedLenders() {
  try {
    const cached = localStorage.getItem(LENDERS_CACHE_KEY)
    if (!cached) return null
    const parsed = JSON.parse(cached)

    // If older than stale window (24h), discard
    if (Date.now() - parsed.timestamp > LENDERS_STALE_TTL) {
      localStorage.removeItem(LENDERS_CACHE_KEY)
      return null
    }
    if (!parsed.lenders || !Array.isArray(parsed.lenders) || parsed.lenders.length === 0) {
      localStorage.removeItem(LENDERS_CACHE_KEY)
      return null
    }
    return parsed
  } catch (e) {
    localStorage.removeItem(LENDERS_CACHE_KEY)
    return null
  }
}

// ============================================
// CACHE: Save to localStorage
// ============================================
function saveLendersToCache(lenders) {
  try {
    localStorage.setItem(LENDERS_CACHE_KEY, JSON.stringify({
      lenders,
      timestamp: Date.now(),
      count: lenders.length,
    }))
  } catch (e) {
    console.log('Could not save lenders cache:', e.message)
  }
}

// ============================================
// FAVORITES API helpers
// ============================================
async function fetchFavoritesAPI(userEmail) {
  if (!userEmail) return new Map()
  try {
    const res = await fetch(FAVORITES_API_URL + '/api/favorites?type=Lender', {
      headers: { Authorization: 'Bearer ' + userEmail },
    })
    if (!res.ok) return new Map()
    const data = await res.json()
    const map = new Map()
    if (data.favorites && Array.isArray(data.favorites)) {
      data.favorites.forEach(fav => map.set(fav.itemId, fav.id))
    }
    return map
  } catch (e) {
    console.warn('Could not load favorites:', e.message)
    return new Map()
  }
}

async function addFavoriteAPI(userEmail, lenderId, lenderName) {
  if (!userEmail) return null
  try {
    const res = await fetch(FAVORITES_API_URL + '/api/favorites', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + userEmail,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ itemType: 'Lender', itemId: lenderId, itemName: lenderName }),
    })
    const data = await res.json()
    if (res.ok && data.favorite) return data.favorite.id
    return null
  } catch (e) {
    console.error('Add favorite error:', e.message)
    return null
  }
}

async function removeFavoriteAPI(userEmail, airtableRecordId) {
  if (!userEmail || !airtableRecordId) return false
  try {
    const res = await fetch(FAVORITES_API_URL + '/api/favorites/' + airtableRecordId, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + userEmail },
    })
    return res.ok
  } catch (e) {
    console.error('Remove favorite error:', e.message)
    return false
  }
}


// ============================================
// COMPONENTS
// ============================================

// Searchable loan type dropdown
function LoanTypeDropdown({ sortedLoanTypes, selectedLoanType, onSelect }) {
  const [open, setOpen] = useState(false)
  const [filterText, setFilterText] = useState('')
  const wrapRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  const inputValue = open ? filterText : (selectedLoanType || '')
  const hasValue = !open && selectedLoanType !== ''

  function handleFocus() {
    setOpen(true)
    setFilterText('')
  }

  function handleBlur() {
    // Delay so mousedown on option fires first
    setTimeout(() => setOpen(false), 150)
  }

  function handleSelect(value) {
    onSelect(value)
    setOpen(false)
    setFilterText('')
  }

  const filter = filterText.toLowerCase().trim()
  const filtered = filter
    ? sortedLoanTypes.filter(lt => lt.toLowerCase().includes(filter))
    : sortedLoanTypes

  return (
    <div className="lenders-dropdown-wrap" ref={wrapRef}>
      <input
        type="text"
        className={'lenders-dropdown-input' + (hasValue ? ' has-value' : '')}
        placeholder="All Loan Types"
        autoComplete="off"
        value={inputValue}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={e => setFilterText(e.target.value)}
        onClick={() => { if (!open) handleFocus() }}
      />
      <div className={'lenders-dropdown-list' + (open ? ' open' : '')}>
        <div
          className={'lenders-dropdown-option' + (selectedLoanType === '' ? ' selected' : '')}
          onMouseDown={e => { e.preventDefault(); handleSelect('') }}
        >
          All Loan Types
        </div>
        {filtered.map(lt => (
          <div
            key={lt}
            className={'lenders-dropdown-option' + (lt === selectedLoanType ? ' selected' : '')}
            onMouseDown={e => { e.preventDefault(); handleSelect(lt) }}
          >
            {lt}
          </div>
        ))}
        {filtered.length === 0 && filter && (
          <div className="lenders-dropdown-option no-results">No matching loan types</div>
        )}
      </div>
    </div>
  )
}


// Single lender card
function LenderCard({ lender, isFav, isNexaUser, onToggleFav, onNavigate }) {
  const [animating, setAnimating] = useState(false)

  function handleHeartClick(e) {
    e.stopPropagation()
    setAnimating(true)
    setTimeout(() => setAnimating(false), 600)
    onToggleFav(lender.id, lender.name)
  }

  function handleCardClick(e) {
    if (e.target.closest('.lender-action-btn') || e.target.closest('.lender-fav-heart')) return
    if (lender.slug) onNavigate('/app/lenders/' + lender.slug)
  }

  function handleImgError(e) {
    // Replace logo wrap with placeholder
    const wrap = e.target.parentElement
    if (wrap) {
      wrap.outerHTML = '<div class="lender-card-placeholder">' + escapeHtml(lender.name.charAt(0)) + '</div>'
    }
  }

  return (
    <div className="lender-card" onClick={handleCardClick}>
      <button
        className={'lender-fav-heart' + (isFav ? ' is-fav' : '') + (animating ? ' animating' : '')}
        title="Toggle favorite"
        onClick={handleHeartClick}
      >
        <i className={isFav ? 'fa-solid fa-heart' : 'fa-regular fa-heart'} />
      </button>

      {isValidURL(lender.logo) ? (
        <div className="lender-card-logo-wrap">
          <img
            className="lender-card-logo"
            src={lender.logo}
            alt={lender.name}
            loading="lazy"
            onError={handleImgError}
          />
        </div>
      ) : (
        <div className="lender-card-placeholder">{lender.name.charAt(0)}</div>
      )}

      <h3 className="lender-card-name">{lender.name}</h3>

      {(isValidURL(lender.website) || isValidURL(lender.tpoPortal)) && (
        <div className="lender-card-actions">
          {isValidURL(lender.website) && (
            <a
              href={lender.website}
              target="_blank"
              rel="noopener noreferrer"
              className="lender-action-btn"
              onClick={e => e.stopPropagation()}
            >
              <i className="fa-solid fa-globe" /> Website
            </a>
          )}
          {isValidURL(lender.tpoPortal) && (
            <a
              href={lender.tpoPortal}
              target="_blank"
              rel="noopener noreferrer"
              className="lender-action-btn"
              onClick={e => e.stopPropagation()}
            >
              <i className="fa-solid fa-arrow-right-to-bracket" /> TPO Portal
            </a>
          )}
        </div>
      )}

      {isNexaUser && (lender.nexaWholesale || lender.nexaNondel || lender.nexa100) && (
        <div className="lender-card-nexa-badges">
          {lender.nexaWholesale && <span className="nexa-badge nexa-badge-wholesale">Broker</span>}
          {lender.nexaNondel && <span className="nexa-badge nexa-badge-nondel">NonDel</span>}
          {lender.nexa100 && <span className="nexa-badge nexa-badge-nexa100">NEXA&#x1F4AF;</span>}
        </div>
      )}
    </div>
  )
}


// ============================================
// MAIN APP COMPONENT
// ============================================
export default function App() {
  // --------------- State ---------------
  const [allLenders, setAllLenders] = useState([])
  const [sortedLoanTypes, setSortedLoanTypes] = useState([])
  const [favorites, setFavorites] = useState(new Map())
  const [isNexaUser, setIsNexaUser] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusText, setStatusText] = useState('Loading lenders...')

  // Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedLoanType, setSelectedLoanType] = useState('')
  const [nexaFilters, setNexaFilters] = useState({ wholesale: false, nondel: false, nexa100: false })
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)

  // Refs for stable values in callbacks
  const userEmailRef = useRef(getUserEmail())
  const favoritesRef = useRef(favorites)
  favoritesRef.current = favorites

  // --------------- Derived: filtered + sorted lenders ---------------
  const filteredLenders = filterAndSort(allLenders, searchTerm, selectedLoanType, nexaFilters, showFavoritesOnly, isNexaUser, favorites)

  const hasActiveFilters = searchTerm.trim() !== '' || selectedLoanType !== '' ||
    nexaFilters.wholesale || nexaFilters.nondel || nexaFilters.nexa100 || showFavoritesOnly

  // --------------- Init: load data on mount ---------------
  useEffect(() => {
    console.log('Lender Directory v13.0 — React + Cloudflare Pages')

    // Clean up old cache keys
    OLD_CACHE_KEYS.forEach(key => {
      try { sessionStorage.removeItem(key) } catch (e) { /* ignore */ }
      try { localStorage.removeItem(key) } catch (e) { /* ignore */ }
    })

    const userEmail = userEmailRef.current
    if (userEmail) console.log('User email extracted from JWT')

    init(userEmail)
  }, [])

  async function init(userEmail) {
    try {
      // Start favorites loading in parallel
      const favPromise = fetchFavoritesAPI(userEmail)

      // Check NEXA status via JWT (instant)
      let nexa = checkNexaViaJWT()
      if (nexa) setIsNexaUser(true)

      // Check local cache
      const cacheResult = getCachedLenders()

      if (cacheResult) {
        // Cache exists — render instantly
        const cacheAge = Date.now() - cacheResult.timestamp
        const isFresh = cacheAge < LENDERS_CACHE_TTL
        console.log('Cache hit! ' + cacheResult.lenders.length + ' lenders — ' + (isFresh ? 'fresh' : 'stale'))

        const lenders = cacheResult.lenders
        const loanTypes = buildLoanTypes(lenders)

        // Wait for favorites
        const favMap = await favPromise
        setFavorites(favMap)

        setAllLenders(lenders)
        setSortedLoanTypes(loanTypes)
        setLoading(false)

        // Background NEXA check via Outseta
        checkNexaViaOutseta().then(outsetaNexa => {
          if (outsetaNexa && !nexa) {
            setIsNexaUser(true)
          }
        })

        // Stale-while-revalidate: refresh in background if stale
        if (!isFresh) {
          setStatusText(prev => prev + '  ·  Updating...')
          backgroundRefresh(lenders, favMap)
        }
      } else {
        // No cache — full fetch
        console.log('No cache — fetching from API...')

        // Also check NEXA via Outseta while fetching
        if (!nexa) {
          const outsetaNexa = await checkNexaViaOutseta()
          if (outsetaNexa) {
            nexa = true
            setIsNexaUser(true)
          }
        }

        const res = await fetch(LENDERS_API_URL + '/api/lenders')
        if (!res.ok) throw new Error('Lenders API returned ' + res.status)

        const apiData = await res.json()
        if (!apiData.success || !apiData.lenders) throw new Error(apiData.error || 'Invalid API response')

        const lenders = apiData.lenders
        const loanTypes = buildLoanTypes(lenders)

        // Wait for favorites
        const favMap = await favPromise
        setFavorites(favMap)

        saveLendersToCache(lenders)
        setAllLenders(lenders)
        setSortedLoanTypes(loanTypes)
        setLoading(false)
      }
    } catch (err) {
      console.error('Error loading lenders:', err)
      setError('Error loading lenders. Please refresh the page.')
      setLoading(false)
    }
  }

  async function backgroundRefresh(currentLenders) {
    try {
      const res = await fetch(LENDERS_API_URL + '/api/lenders')
      if (!res.ok) return

      const apiData = await res.json()
      if (!apiData.success || !apiData.lenders) return

      const newLenders = apiData.lenders
      saveLendersToCache(newLenders)

      // Check if data changed
      const changed = newLenders.length !== currentLenders.length ||
        (newLenders.length > 0 && (
          (newLenders[0]?.name !== currentLenders[0]?.name) ||
          (newLenders[newLenders.length - 1]?.name !== currentLenders[currentLenders.length - 1]?.name)
        ))

      if (changed) {
        setAllLenders(newLenders)
        setSortedLoanTypes(buildLoanTypes(newLenders))
        console.log('Background refresh: grid updated with new data')
      } else {
        console.log('Background refresh: data unchanged')
      }
    } catch (err) {
      console.warn('Background refresh error:', err.message)
    }
  }

  // --------------- Favorite toggle ---------------
  const handleToggleFav = useCallback(async (lenderId, lenderName) => {
    const userEmail = userEmailRef.current
    const currentFavs = favoritesRef.current
    const wasFav = currentFavs.has(lenderId)

    // Optimistic update
    setFavorites(prev => {
      const next = new Map(prev)
      if (wasFav) {
        next.delete(lenderId)
      } else {
        next.set(lenderId, '__pending__')
      }
      return next
    })

    // API call
    if (wasFav) {
      const airtableId = currentFavs.get(lenderId)
      const ok = await removeFavoriteAPI(userEmail, airtableId)
      if (!ok) {
        // Revert
        setFavorites(prev => {
          const next = new Map(prev)
          next.set(lenderId, airtableId)
          return next
        })
      }
    } else {
      const newId = await addFavoriteAPI(userEmail, lenderId, lenderName)
      if (newId) {
        setFavorites(prev => {
          const next = new Map(prev)
          next.set(lenderId, newId)
          return next
        })
      } else {
        // Revert
        setFavorites(prev => {
          const next = new Map(prev)
          next.delete(lenderId)
          return next
        })
      }
    }
  }, [])

  // --------------- Navigation ---------------
  const handleNavigate = useCallback((href) => {
    if (href) window.location.href = href
  }, [])

  // --------------- NEXA filter toggle ---------------
  function toggleNexaFilter(key) {
    setNexaFilters(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // --------------- Clear all filters ---------------
  function clearFilters() {
    setSearchTerm('')
    setSelectedLoanType('')
    setNexaFilters({ wholesale: false, nondel: false, nexa100: false })
    setShowFavoritesOnly(false)
  }

  // --------------- Update status text ---------------
  useEffect(() => {
    if (loading || error) return

    const visibleTotal = allLenders.filter(l => !(l.nexaOnly && !isNexaUser)).length
    const count = filteredLenders.length

    if (count === 0) {
      if (showFavoritesOnly && favorites.size === 0) {
        setStatusText('No favorites yet — tap the heart on any lender to save them')
      } else {
        setStatusText('No lenders found')
      }
    } else if (count === visibleTotal) {
      setStatusText('Showing all ' + count + ' lenders')
    } else {
      setStatusText('Showing ' + count + ' of ' + visibleTotal + ' lenders')
    }
  }, [filteredLenders, allLenders, isNexaUser, showFavoritesOnly, favorites, loading, error])


  // --------------- Render ---------------
  if (error) {
    return <div className="lenders-error">{error}</div>
  }

  return (
    <>
      {/* Sticky header + toolbar (desktop only) */}
      <div className="lenders-sticky-header">

      {/* Page header */}
      <h1 className="lender-card-name" style={{
        fontSize: '24px', textAlign: 'left', marginBottom: '8px', fontWeight: 700, color: '#1E293B'
      }}>
        Lender Directory
      </h1>

      {/* Search & Filter Toolbar */}
      <div className="lenders-toolbar">
        <input
          type="text"
          className="lenders-search-input"
          placeholder="Search lenders by name or loan type..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />

        <LoanTypeDropdown
          sortedLoanTypes={sortedLoanTypes}
          selectedLoanType={selectedLoanType}
          onSelect={setSelectedLoanType}
        />

        {/* NEXA divider + filters — hidden unless NEXA user */}
        {isNexaUser && (
          <>
            <div className="lenders-toolbar-divider" />
            <div className="nexa-filters-group">
              <button
                className={'nexa-toggle-btn' + (nexaFilters.wholesale ? ' active' : '')}
                onClick={() => toggleNexaFilter('wholesale')}
              >
                Broker
              </button>
              <button
                className={'nexa-toggle-btn' + (nexaFilters.nondel ? ' active' : '')}
                onClick={() => toggleNexaFilter('nondel')}
              >
                NonDel
              </button>
              <button
                className={'nexa-toggle-btn' + (nexaFilters.nexa100 ? ' active' : '')}
                onClick={() => toggleNexaFilter('nexa100')}
              >
                NEXA&#x1F4AF;
              </button>
            </div>
          </>
        )}

        <div className="lenders-toolbar-divider" />

        {/* Favorites toggle */}
        <button
          className={'lenders-fav-btn' + (showFavoritesOnly ? ' active' : '')}
          onClick={() => setShowFavoritesOnly(prev => !prev)}
        >
          <i className="fa-solid fa-heart" /> Favorites
          <span className="lenders-fav-count">{favorites.size}</span>
        </button>

        <div className="lenders-toolbar-divider" />

        {/* Clear filters */}
        <button
          className={'lenders-clear-btn' + (hasActiveFilters ? ' has-filters' : '')}
          onClick={clearFilters}
        >
          <i className="fa-solid fa-xmark" /> Clear Filters
        </button>
      </div>
      </div>{/* end .lenders-sticky-header */}

      {/* Status bar */}
      <div className="lenders-status">{statusText}</div>

      {/* Loading state */}
      {loading && (
        <div className="lenders-loading">
          <div className="lenders-loading-spinner" />
          <div>Loading all lenders...</div>
        </div>
      )}

      {/* Card grid */}
      {!loading && (
        <div className="lenders-grid">
          {filteredLenders.length === 0 ? (
            <div className="lenders-empty">
              <div className="lenders-empty-icon">
                <i className={'fa-solid ' + (showFavoritesOnly ? 'fa-heart' : 'fa-building')} />
              </div>
              <p className="lenders-empty-title">
                {showFavoritesOnly ? 'No favorites yet' : 'No lenders found'}
              </p>
              <p className="lenders-empty-text">
                {showFavoritesOnly
                  ? 'Tap the \u2661 on any lender card to add them to your favorites'
                  : 'Try adjusting your search or filter'}
              </p>
            </div>
          ) : (
            filteredLenders.map(lender => (
              <LenderCard
                key={lender.id}
                lender={lender}
                isFav={favorites.has(lender.id)}
                isNexaUser={isNexaUser}
                onToggleFav={handleToggleFav}
                onNavigate={handleNavigate}
              />
            ))
          )}
        </div>
      )}
    </>
  )
}


// ============================================
// PURE HELPERS
// ============================================

// Build sorted unique loan types from lender data
function buildLoanTypes(lenders) {
  const set = new Set()
  lenders.forEach(lender => {
    if (lender.loanTypes) {
      lender.loanTypes.forEach(lt => set.add(lt))
    }
  })
  return Array.from(set).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
}

// Filter + sort lenders based on current filters
function filterAndSort(allLenders, searchTerm, selectedLoanType, nexaFilters, showFavoritesOnly, isNexaUser, favorites) {
  const term = searchTerm.toLowerCase().trim()

  const filtered = allLenders.filter(lender => {
    // NEXA-only gating
    if (lender.nexaOnly && !isNexaUser) return false

    // Text search
    if (term) {
      const nameMatch = lender.name.toLowerCase().includes(term)
      const loanMatch = lender.loanTypesRaw.toLowerCase().includes(term)
      const descMatch = lender.description.toLowerCase().includes(term)
      if (!nameMatch && !loanMatch && !descMatch) return false
    }

    // Loan type filter
    if (selectedLoanType) {
      if (!lender.loanTypes.some(lt => lt === selectedLoanType)) return false
    }

    // NEXA filters
    if (nexaFilters.wholesale && !lender.nexaWholesale) return false
    if (nexaFilters.nondel && !lender.nexaNondel) return false
    if (nexaFilters.nexa100 && !lender.nexa100) return false

    // Favorites filter
    if (showFavoritesOnly && !favorites.has(lender.id)) return false

    return true
  })

  // Sort: favorites first, then alphabetical
  filtered.sort((a, b) => {
    const aFav = favorites.has(a.id) ? 0 : 1
    const bFav = favorites.has(b.id) ? 0 : 1
    if (aFav !== bFav) return aFav - bFav
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  })

  return filtered
}

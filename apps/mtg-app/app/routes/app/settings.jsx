import { useState, useEffect, useRef, useCallback } from 'react'
import "../../styles/settings.css"

export function meta() {
  return [{ title: "Settings — MtgBroker" }]
}

// ============================================================
// CONFIGURATION
// ============================================================
var API_BASE = 'https://mtg-broker-api.rich-e00.workers.dev'
var CACHE_KEY = 'mtgbroker_settings_v3'

// Preferred link field definitions
var PREF_LINK_FIELDS = [
  { key: 'pricingEngine', label: 'Pricing Engine', hint: '' },
  { key: 'crm', label: 'CRM', hint: '' },
  { key: 'los', label: 'LOS', hint: '(Loan Origination System)' },
  { key: 'pos', label: 'POS', hint: '(Point of Sale)' },
]

// ============================================================
// HELPERS
// ============================================================

/** Format US phone number */
function formatPhoneUS(value) {
  if (!value) return ''
  var digits = value.replace(/\D/g, '')
  var cleaned = digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits
  if (cleaned.length !== 10) return value
  return '(' + cleaned.slice(0, 3) + ') ' + cleaned.slice(3, 6) + '-' + cleaned.slice(6)
}

/** Decode JWT from Outseta localStorage token */
function getJwtData() {
  try {
    var token = localStorage.getItem('Outseta.nocode.accessToken')
    if (!token) return null
    var payload = JSON.parse(atob(token.split('.')[1]))
    return { email: payload.email || '', name: payload.name || '' }
  } catch (e) {
    return null
  }
}

/** Get user email from JWT or Outseta cache */
async function getUserEmail() {
  var jwt = getJwtData()
  if (jwt && jwt.email) return jwt.email
  if (typeof window !== 'undefined' && typeof window.getCachedOutsetaUser === 'function') {
    try {
      var u = await window.getCachedOutsetaUser()
      return u?.Email || null
    } catch (e) {}
  }
  return null
}

/** API call helper — uses email as Bearer token */
async function apiCall(endpoint, method, body) {
  method = method || 'GET'
  body = body || null
  var email = await getUserEmail()
  if (!email) throw new Error('Not logged in')
  var opts = { method: method, headers: { Authorization: 'Bearer ' + email } }
  if (body && !(body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  if (body instanceof FormData) opts.body = body
  var resp = await fetch(API_BASE + endpoint, opts)
  var data = await resp.json()
  if (!resp.ok) throw new Error(data.error || 'API error')
  return data
}

/** Extract root domain for favicon lookup */
function getRootDomain(url) {
  try {
    var parts = new URL(url).hostname.split('.')
    return parts.length > 2 ? parts.slice(-2).join('.') : parts.join('.')
  } catch (e) {
    return null
  }
}

/** Load Outseta user object (polls up to 6 seconds) */
async function loadOutsetaUser() {
  if (typeof window === 'undefined') return null
  if (typeof window.getCachedOutsetaUser === 'function') {
    try {
      var u = await window.getCachedOutsetaUser()
      if (u) return u
    } catch (e) {}
  }
  for (var i = 0; i < 30; i++) {
    if (window.Outseta && typeof window.Outseta.getUser === 'function') {
      try {
        var u = await window.Outseta.getUser()
        if (u) return u
      } catch (e) {}
    }
    await new Promise(function (r) {
      setTimeout(r, 200)
    })
  }
  return null
}

/** Load Airtable broker profile */
async function loadAirtableProfile() {
  try {
    var result = await apiCall('/api/broker-profile', 'GET')
    if (result.profile && result.profile.data) {
      return { id: result.profile.id, data: result.profile.data }
    }
  } catch (err) {
    console.warn('No profile found:', err.message)
  }
  return null
}

// ============================================================
// CACHE HELPERS
// ============================================================
function getCachedSettings() {
  try {
    var raw = sessionStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

function saveCacheSettings(data) {
  try {
    data._cachedAt = Date.now()
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(data))
  } catch (e) {}
}

function clearCacheSettings() {
  try {
    sessionStorage.removeItem(CACHE_KEY)
  } catch (e) {}
}

/** Open Outseta profile widget with 3-method fallback */
function openOutsetaProfile(tab) {
  if (typeof window === 'undefined') return
  if (typeof Outseta !== 'undefined' && Outseta.profile && typeof Outseta.profile.open === 'function') {
    Outseta.profile.open({ tab: tab })
    return
  }
  if (typeof Outseta !== 'undefined' && typeof Outseta.showProfile === 'function') {
    Outseta.showProfile({ tab: tab })
    return
  }
  window.location.href = 'https://mtgbroker.outseta.com/profile#o-authenticated'
}

// ============================================================
// PREFERRED LINK ROW COMPONENT
// ============================================================
function PrefLinkRow({ field, value, onChange }) {
  var isValid = value && (value.startsWith('http://') || value.startsWith('https://'))
  var rootDomain = isValid ? getRootDomain(value) : null
  var faviconUrl = rootDomain
    ? 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(rootDomain) + '&sz=32'
    : null

  var [faviconError, setFaviconError] = useState(false)

  useEffect(function () {
    setFaviconError(false)
  }, [value])

  return (
    <div className="pref-link-row">
      <label className="pref-link-label">
        {faviconUrl && !faviconError && (
          <img
            className="pref-link-fav"
            src={faviconUrl}
            width="16"
            height="16"
            alt=""
            onError={function () {
              setFaviconError(true)
            }}
          />
        )}
        {field.label}
        {field.hint && <span className="settings-label-hint">{field.hint}</span>}
      </label>
      <div className="pref-link-input-wrap">
        <input
          type="url"
          className="pref-link-input"
          placeholder="https://..."
          value={value}
          onChange={function (e) {
            onChange(field.key, e.target.value)
          }}
        />
        {isValid && (
          <a
            className="pref-link-open-btn"
            href={value}
            target="_blank"
            rel="noopener noreferrer"
          >
            <i className="fas fa-arrow-up-right-from-square"></i> Open
          </a>
        )}
      </div>
    </div>
  )
}

// ============================================================
// MAIN SETTINGS PAGE
// ============================================================
export default function SettingsPage() {
  // --- Status bar state ---
  var [statusState, setStatusState] = useState('')
  var [statusText, setStatusText] = useState('Loading your settings...')

  function setStatus(state, text) {
    setStatusState(state)
    setStatusText(text)
  }

  // --- Form state ---
  var [fullName, setFullName] = useState('')
  var [email, setEmail] = useState('')
  var [phoneMobile, setPhoneMobile] = useState('')
  var [phoneWork, setPhoneWork] = useState('')
  var [jobTitle, setJobTitle] = useState('')
  var [nmls, setNmls] = useState('')
  var [companyName, setCompanyName] = useState('')
  var [street, setStreet] = useState('')
  var [city, setCity] = useState('')
  var [state, setState] = useState('')
  var [zip, setZip] = useState('')
  var [disclaimer, setDisclaimer] = useState('')
  var [prefLinks, setPrefLinks] = useState({
    pricingEngine: '',
    crm: '',
    los: '',
    pos: '',
  })

  // --- Image state ---
  var [avatarUrl, setAvatarUrl] = useState('')
  var [logoUrl, setLogoUrl] = useState('')
  var [avatarUploading, setAvatarUploading] = useState(false)
  var [logoUploading, setLogoUploading] = useState(false)
  var [logoLoadError, setLogoLoadError] = useState(false)
  var [avatarLoadError, setAvatarLoadError] = useState(false)

  // --- Profile record ID (Airtable) ---
  var profileRecordIdRef = useRef(null)

  // --- Save button state ---
  var [saving, setSaving] = useState(false)
  var [saveLabel, setSaveLabel] = useState('Save Settings')
  var [saveIcon, setSaveIcon] = useState('fa-save')

  // --- File input refs ---
  var avatarFileRef = useRef(null)
  var logoFileRef = useRef(null)

  // --- Build form snapshot for caching ---
  var buildCacheData = useCallback(
    function () {
      return {
        fullName: fullName,
        email: email,
        phoneMobile: phoneMobile,
        phoneWork: phoneWork,
        jobTitle: jobTitle,
        nmls: nmls,
        companyName: companyName,
        street: street,
        city: city,
        state: state,
        zip: zip,
        disclaimer: disclaimer,
        logoUrl: logoUrl,
        avatarUrl: avatarUrl,
        profileRecordId: profileRecordIdRef.current,
        preferredLinks: prefLinks,
      }
    },
    [fullName, email, phoneMobile, phoneWork, jobTitle, nmls, companyName, street, city, state, zip, disclaimer, logoUrl, avatarUrl, prefLinks]
  )

  // --- Apply cached or server data to form ---
  function applyData(c) {
    if (c.fullName) setFullName(c.fullName)
    if (c.email) setEmail(c.email)
    if (c.phoneMobile) setPhoneMobile(formatPhoneUS(c.phoneMobile))
    if (c.phoneWork) setPhoneWork(formatPhoneUS(c.phoneWork))
    if (c.jobTitle) setJobTitle(c.jobTitle)
    if (c.nmls) setNmls(c.nmls)
    if (c.companyName) setCompanyName(c.companyName)
    if (c.street) setStreet(c.street)
    if (c.city) setCity(c.city)
    if (c.state) setState(c.state)
    if (c.zip) setZip(c.zip)
    if (c.disclaimer) setDisclaimer(c.disclaimer)
    if (c.profileRecordId) profileRecordIdRef.current = c.profileRecordId
    if (c.logoUrl) setLogoUrl(c.logoUrl)
    if (c.avatarUrl) setAvatarUrl(c.avatarUrl)
    if (c.preferredLinks) {
      setPrefLinks(function (prev) {
        return { ...prev, ...c.preferredLinks }
      })
    }
  }

  // --- Refresh from servers ---
  async function refreshFromServers(silent) {
    try {
      var results = await Promise.allSettled([loadOutsetaUser(), loadAirtableProfile()])
      var userResult = results[0]
      var profileResult = results[1]

      if (userResult.status === 'fulfilled' && userResult.value) {
        var u = userResult.value
        if (u.FullName) setFullName(u.FullName)
        if (u.Email) setEmail(u.Email)
        if (u.PhoneMobile) setPhoneMobile(formatPhoneUS(u.PhoneMobile))
        if (u.PhoneWork) setPhoneWork(formatPhoneUS(u.PhoneWork))
        setJobTitle(u.Title || '')
        setNmls(u.NmlsNumber || '')
        setCompanyName(u.CompanyName || '')
        if (u.ProfileImageS3Url) setAvatarUrl(function (prev) { return prev || u.ProfileImageS3Url })
      }

      if (profileResult.status === 'fulfilled' && profileResult.value) {
        var d = profileResult.value.data
        profileRecordIdRef.current = profileResult.value.id
        setStreet(d.companyStreet || '')
        setCity(d.companyCity || '')
        setState(d.companyState || '')
        setZip(d.companyZip || '')
        setDisclaimer(d.disclaimerText || '')
        if (d.logoUrl) setLogoUrl(d.logoUrl)
        if (d.avatarUrl) setAvatarUrl(d.avatarUrl)
        if (d.preferredLinks) {
          setPrefLinks(function (prev) {
            return { ...prev, ...d.preferredLinks }
          })
        }
      }

      if (!silent) setStatus('saved', 'Settings loaded')
    } catch (err) {
      console.error('Error loading settings:', err)
      if (!silent) setStatus('error', 'Error loading some settings')
    }
  }

  // --- Initial load ---
  useEffect(function () {
    async function init() {
      var cached = getCachedSettings()
      if (cached) {
        applyData(cached)
        setStatus('saved', 'Settings loaded')
        refreshFromServers(true)
        return
      }

      setStatus('', 'Loading your settings...')
      var jwt = getJwtData()
      if (jwt) {
        setFullName(jwt.name)
        setEmail(jwt.email)
      }
      await refreshFromServers(false)
    }
    init()
  }, [])

  // --- Save cache whenever form data changes ---
  useEffect(
    function () {
      if (email) {
        saveCacheSettings(buildCacheData())
      }
    },
    [buildCacheData, email]
  )

  // --- Update preferred link ---
  function handlePrefLinkChange(key, value) {
    setPrefLinks(function (prev) {
      return { ...prev, [key]: value }
    })
  }

  // ============================================================
  // SAVE ALL
  // ============================================================
  async function handleSave() {
    setSaving(true)
    setSaveLabel('Saving...')
    setSaveIcon('fa-spinner fa-spin')
    setStatus('saving', 'Saving your settings...')

    try {
      await Promise.all([saveOutsetaFields(), saveAirtableProfile()])
      saveCacheSettings(buildCacheData())
      setStatus('saved', 'All settings saved!')
      setSaveLabel('Saved!')
      setSaveIcon('fa-check')
      setTimeout(function () {
        setSaveLabel('Save Settings')
        setSaveIcon('fa-save')
        setSaving(false)
      }, 2000)
    } catch (err) {
      console.error('Save error:', err)
      setStatus('error', 'Error saving: ' + err.message)
      setSaveLabel('Save Settings')
      setSaveIcon('fa-save')
      setSaving(false)
    }
  }

  async function saveOutsetaFields() {
    if (typeof window === 'undefined') return
    if (!window.Outseta || typeof window.Outseta.getUser !== 'function') return
    var user = await window.Outseta.getUser()
    if (!user) return
    try {
      await user.update({
        Title: jobTitle.trim(),
        NmlsNumber: nmls.trim(),
        CompanyName: companyName.trim(),
      })
      if (window.OUTSETA_USER_CACHE) window.OUTSETA_USER_CACHE = null
    } catch (err) {
      console.error('Outseta update error:', err)
      throw new Error('Failed to save profile fields')
    }
  }

  async function saveAirtableProfile() {
    var profileData = {
      companyStreet: street.trim(),
      companyCity: city.trim(),
      companyState: state.trim().toUpperCase(),
      companyZip: zip.trim(),
      logoUrl: logoUrl || '',
      avatarUrl: avatarUrl || '',
      disclaimerText: disclaimer.trim(),
      preferredLinks: prefLinks,
    }
    if (profileRecordIdRef.current) {
      await apiCall('/api/broker-profile/' + profileRecordIdRef.current, 'PUT', {
        profileData: profileData,
      })
    } else {
      var result = await apiCall('/api/broker-profile', 'POST', { profileData: profileData })
      profileRecordIdRef.current = result.profile.id
    }
  }

  // ============================================================
  // AVATAR UPLOAD / REMOVE
  // ============================================================
  async function handleAvatarUpload(event) {
    var file = event.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      alert('Max 2MB.')
      event.target.value = ''
      return
    }
    setAvatarUploading(true)
    setStatus('saving', 'Uploading photo...')
    try {
      var fd = new FormData()
      fd.append('avatar', file)
      var result = await apiCall('/api/broker-profile/avatar', 'POST', fd)
      setAvatarLoadError(false)
      setAvatarUrl(result.avatarUrl)
      setStatus('saved', 'Photo uploaded! Click Save to keep it.')
    } catch (err) {
      console.error('Avatar upload error:', err)
      setStatus('error', 'Upload failed: ' + err.message)
    } finally {
      setAvatarUploading(false)
      event.target.value = ''
    }
  }

  async function handleRemoveAvatar() {
    if (!confirm('Remove your profile picture?')) return
    setStatus('saving', 'Removing...')
    try {
      await apiCall('/api/broker-profile/avatar', 'DELETE')
      setAvatarUrl('')
      setStatus('saved', 'Photo removed.')
    } catch (err) {
      setStatus('error', 'Failed to remove photo')
    }
  }

  // ============================================================
  // LOGO UPLOAD / REMOVE
  // ============================================================
  async function handleLogoUpload(event) {
    var file = event.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      alert('Max 2MB.')
      event.target.value = ''
      return
    }
    setLogoUploading(true)
    setStatus('saving', 'Uploading logo...')
    try {
      var fd = new FormData()
      fd.append('logo', file)
      var result = await apiCall('/api/broker-profile/logo', 'POST', fd)
      setLogoLoadError(false)
      setLogoUrl(result.logoUrl)
      setStatus('saved', 'Logo uploaded! Click Save to keep it.')
    } catch (err) {
      console.error('Logo upload error:', err)
      setStatus('error', 'Upload failed: ' + err.message)
    } finally {
      setLogoUploading(false)
      event.target.value = ''
    }
  }

  async function handleRemoveLogo() {
    if (!confirm('Remove your company logo?')) return
    setStatus('saving', 'Removing...')
    try {
      await apiCall('/api/broker-profile/logo', 'DELETE')
      setLogoUrl('')
      setStatus('saved', 'Logo removed.')
    } catch (err) {
      setStatus('error', 'Failed to remove logo')
    }
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="settings-wrapper">
      {/* PAGE HEADER */}
      <div className="settings-page-header">
        <h1 className="settings-page-title">Settings</h1>
        <p className="settings-page-subtitle">Manage your profile and company information</p>
      </div>

      {/* SAVE STATUS BAR */}
      <div className="settings-save-bar">
        <div className="settings-save-left">
          <div className={'settings-save-dot ' + statusState}></div>
          <span>{statusText}</span>
        </div>
      </div>

      {/* MAIN FORM */}
      <div className="settings-grid">
        {/* ====== YOUR PROFILE (full width) ====== */}
        <div className="settings-section settings-card-full">
          <div className="settings-section-header" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="settings-section-icon">
                <i className="fas fa-user"></i>
              </div>
              <div>
                <h2 className="settings-section-title">Your Profile</h2>
                <p className="settings-section-desc">Your photo and account info</p>
              </div>
            </div>
            <button
              type="button"
              className="settings-btn-secondary"
              onClick={() => { clearCacheSettings(); openOutsetaProfile('profile') }}
              style={{ fontSize: '11px', padding: '5px 12px', whiteSpace: 'nowrap' }}
            >
              <i className="fas fa-pen"></i> Manage Profile
            </button>
          </div>

          {/* Avatar + Name/Email inline row */}
          <div className="profile-header-row">
            <div className={'avatar-preview-box' + (avatarUrl && !avatarLoadError ? ' has-image' : '')}>
              {(!avatarUrl || avatarLoadError) && <i className="fas fa-user avatar-placeholder"></i>}
              {avatarUrl && (
                <img
                  src={avatarUrl}
                  alt="Profile picture"
                  style={avatarLoadError ? { display: 'none' } : {}}
                  onLoad={function () { setAvatarLoadError(false) }}
                  onError={function () { setAvatarLoadError(true) }}
                />
              )}
            </div>
            <div className="profile-header-info">
              <p className="profile-header-name">{fullName || '\u2014'}</p>
              <p className="profile-header-email">{email || '\u2014'}</p>
            </div>
            <div className="profile-header-actions">
              <button
                type="button"
                className={'avatar-upload-btn' + (avatarUploading ? ' uploading' : '')}
                onClick={function () {
                  avatarFileRef.current.click()
                }}
              >
                {avatarUploading ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : (
                  <>
                    <i className="fas fa-upload"></i> Photo
                  </>
                )}
              </button>
              {avatarUrl && (
                <button type="button" className="avatar-remove-btn" onClick={handleRemoveAvatar}>
                  <i className="fas fa-trash-alt"></i> Remove
                </button>
              )}
            </div>
            <input
              type="file"
              ref={avatarFileRef}
              accept="image/png,image/jpeg,image/jpg,image/webp"
              style={{ display: 'none' }}
              onChange={handleAvatarUpload}
            />
          </div>

          {/* Phone Numbers (read-only) */}
          <div className="settings-row">
            <div className="settings-field">
              <label className="settings-label">Mobile Phone</label>
              <input
                type="tel"
                className="settings-input"
                readOnly
                placeholder="Set via Manage Profile"
                value={phoneMobile}
              />
            </div>
            <div className="settings-field">
              <label className="settings-label">Work Phone</label>
              <input
                type="tel"
                className="settings-input"
                readOnly
                placeholder="Set via Manage Profile"
                value={phoneWork}
              />
            </div>
          </div>

          {/* Job Title + NMLS side by side */}
          <div className="settings-row">
            <div className="settings-field">
              <label className="settings-label">
                Job Title <span className="settings-label-hint">(e.g. Loan Officer)</span>
              </label>
              <input
                type="text"
                className="settings-input"
                placeholder="Enter your job title"
                value={jobTitle}
                onChange={function (e) {
                  setJobTitle(e.target.value)
                }}
              />
            </div>
            <div className="settings-field">
              <label className="settings-label">
                NMLS # <span className="settings-label-hint">(individual)</span>
              </label>
              <input
                type="text"
                className="settings-input"
                placeholder="e.g. 1234567"
                value={nmls}
                onChange={function (e) {
                  setNmls(e.target.value)
                }}
              />
            </div>
          </div>
        </div>

        {/* ====== COMPANY INFO (left column) ====== */}
        <div className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-icon">
              <i className="fas fa-building"></i>
            </div>
            <div>
              <h2 className="settings-section-title">Company Information</h2>
              <p className="settings-section-desc">Details for documents and branding</p>
            </div>
          </div>

          <div className="settings-field">
            <label className="settings-label">Company Name</label>
            <input
              type="text"
              className="settings-input"
              placeholder="e.g. ABC Mortgage Group"
              value={companyName}
              onChange={function (e) {
                setCompanyName(e.target.value)
              }}
            />
          </div>

          <div className="settings-field">
            <label className="settings-label">Street Address</label>
            <input
              type="text"
              className="settings-input"
              placeholder="e.g. 123 Main Street, Suite 200"
              value={street}
              onChange={function (e) {
                setStreet(e.target.value)
              }}
            />
          </div>

          <div className="settings-row">
            <div className="settings-field">
              <label className="settings-label">City</label>
              <input
                type="text"
                className="settings-input"
                placeholder="e.g. Pensacola"
                value={city}
                onChange={function (e) {
                  setCity(e.target.value)
                }}
              />
            </div>
            <div className="settings-field small">
              <label className="settings-label">State</label>
              <input
                type="text"
                className="settings-input"
                placeholder="FL"
                maxLength="2"
                value={state}
                onChange={function (e) {
                  setState(e.target.value)
                }}
              />
            </div>
            <div className="settings-field small">
              <label className="settings-label">ZIP</label>
              <input
                type="text"
                className="settings-input"
                placeholder="32501"
                maxLength="10"
                value={zip}
                onChange={function (e) {
                  setZip(e.target.value)
                }}
              />
            </div>
          </div>
        </div>

        {/* ====== PREFERRED LINKS (right column) ====== */}
        <div className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-icon">
              <i className="fas fa-link"></i>
            </div>
            <div>
              <h2 className="settings-section-title">Preferred Links</h2>
              <p className="settings-section-desc">Quick access to your key tools</p>
            </div>
          </div>

          {PREF_LINK_FIELDS.map(function (field) {
            return (
              <PrefLinkRow
                key={field.key}
                field={field}
                value={prefLinks[field.key] || ''}
                onChange={handlePrefLinkChange}
              />
            )
          })}

          <div className="pref-links-hint">
            <i className="fas fa-info-circle"></i> Paste the full URL. The Open button appears
            automatically.
          </div>
        </div>

        {/* ====== LOGO (left column) ====== */}
        <div className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-icon">
              <i className="fas fa-image"></i>
            </div>
            <div>
              <h2 className="settings-section-title">Company Logo</h2>
              <p className="settings-section-desc">For documents and branding</p>
            </div>
          </div>

          <div className="logo-upload-area">
            <div className="logo-preview-box">
              {(!logoUrl || logoLoadError) && <i className="fas fa-camera logo-placeholder"></i>}
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="Company logo"
                  style={logoLoadError ? { display: 'none' } : {}}
                  onLoad={function () { setLogoLoadError(false) }}
                  onError={function () { setLogoLoadError(true) }}
                />
              )}
            </div>
            <div className="logo-upload-controls">
              <button
                type="button"
                className={'logo-upload-btn' + (logoUploading ? ' uploading' : '')}
                onClick={function () {
                  logoFileRef.current.click()
                }}
              >
                {logoUploading ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : (
                  <>
                    <i className="fas fa-upload"></i> Upload Logo
                  </>
                )}
              </button>
              {logoUrl && !logoLoadError && (
                <button type="button" className="logo-remove-btn" onClick={handleRemoveLogo}>
                  <i className="fas fa-trash-alt"></i> Remove
                </button>
              )}
              <span className="logo-upload-hint">PNG, JPG, WebP, or SVG — Max 2MB</span>
              <input
                type="file"
                ref={logoFileRef}
                accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                style={{ display: 'none' }}
                onChange={handleLogoUpload}
              />
            </div>
          </div>
        </div>

        {/* ====== DISCLAIMER (right column) ====== */}
        <div className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-icon">
              <i className="fas fa-file-alt"></i>
            </div>
            <div>
              <h2 className="settings-section-title">Disclaimer Text</h2>
              <p className="settings-section-desc">For generated documents and marketing</p>
            </div>
          </div>

          <div className="settings-field">
            <label className="settings-label">
              Disclaimer{' '}
              <span className="settings-label-hint">(NMLS info, Equal Housing, licensing)</span>
            </label>
            <textarea
              className="settings-textarea"
              rows="4"
              placeholder="e.g. NMLS #12345. Licensed in FL, AL, GA. Equal Housing Lender."
              value={disclaimer}
              onChange={function (e) {
                setDisclaimer(e.target.value)
              }}
            ></textarea>
          </div>
        </div>

        {/* ====== SAVE BUTTONS (full width) ====== */}
        <div className="settings-card-full settings-actions">
          <button
            type="button"
            className="settings-btn-save"
            disabled={saving}
            onClick={handleSave}
          >
            <i className={'fas ' + saveIcon}></i> {saveLabel}
          </button>
          <button
            type="button"
            className="settings-btn-secondary"
            onClick={() => openOutsetaProfile('plan')}
          >
            <i className="fas fa-credit-card"></i> Manage Account & Billing
          </button>
        </div>
      </div>
    </div>
  )
}

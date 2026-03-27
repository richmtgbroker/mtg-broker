// functions/api/add-lender.js
// Cloudflare Pages Function — fetches a lender's website, uses Claude to extract details,
// checks for duplicates, and creates a record in the Airtable Lender List table.
//
// POST { url }
//   1. Verify JWT (admin-only)
//   2. Fetch the lender's website (main page + /about, /wholesale, /contact)
//   3. Send page content to Claude to extract lender details
//   4. Check Airtable for duplicate lender names
//   5. Create Airtable record with extracted fields
//   6. Return { success, lender_name, record_id, fields_populated, fields_missing }
//
// Required env vars: ANTHROPIC_API_KEY, AIRTABLE_API_KEY

const AIRTABLE_BASE_ID = 'appuJgI9X93OLaf0u'
const AIRTABLE_LENDER_TABLE_ID = 'tbl1mpg3KFakZsFK7'

const ALLOWED_ORIGINS = [
  'https://mtg.broker',
  'https://www.mtg.broker',
  'https://mtg-loan-finder.pages.dev',
  'https://mtg-app-staging.pages.dev',
]

const ADMIN_EMAILS = ['rich@mtg.broker', 'rich@prestonlending.com']

// ─── All writable fields we can auto-populate ────────────────────────────────
const EXTRACTABLE_FIELDS = [
  'Lender Name',
  'Description',
  'Corporate Website',
  'TPO Broker Portal',
  'NMLS',
  'FHA ID',
  'VA ID',
  'USDA ID',
  'Licensed States',
  'Licensed States URL',
  'Scenario Desk',
  'Facebook',
  'LinkedIn',
  'Instagram',
  'X (Twitter)',
  'YouTube',
]

// All writable fields in the table (for reporting what's missing)
const ALL_KEY_FIELDS = [
  ...EXTRACTABLE_FIELDS,
  'WHOLESALE Approved Lender',
  'In Loansifter (Wholesale)',
  'LPC Comp',
  'Max $ Comp',
  'Quick Quote Pricer',
  "Lender's Product Page",
  'Turn Times (Wholesale)',
  'Admin or UW Fee',
  'Tax Service Fee',
  'Flood Cert Fee',
  'Mortgagee Clause (Wholesale)',
]


// ─── CORS ────────────────────────────────────────────────────────────────────
function isAllowedOrigin(origin) {
  if (!origin) return false
  if (ALLOWED_ORIGINS.includes(origin)) return true
  if (/^https:\/\/[a-f0-9]+\.mtg-loan-finder\.pages\.dev$/.test(origin)) return true
  if (/^https:\/\/[a-f0-9]+\.mtg-app-staging\.pages\.dev$/.test(origin)) return true
  if (/^https:\/\/[a-f0-9]+\.mtg-app\.pages\.dev$/.test(origin)) return true
  return false
}

function getCorsHeaders(request) {
  const origin = request ? request.headers.get('Origin') : null
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

function jsonError(request, message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request) },
  })
}

function jsonSuccess(request, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request) },
  })
}


// ─── JWT VERIFICATION (RS256, Outseta) ───────────────────────────────────────
let jwksCache = null
let jwksCacheTimestamp = null
const JWKS_CACHE_DURATION = 60 * 60 * 1000

async function getOutsetaJwks() {
  const now = Date.now()
  if (jwksCache && jwksCacheTimestamp && (now - jwksCacheTimestamp < JWKS_CACHE_DURATION)) {
    return jwksCache
  }
  const res = await fetch('https://mtgbroker.outseta.com/.well-known/jwks')
  if (!res.ok) throw new Error('Failed to fetch JWKS')
  jwksCache = await res.json()
  jwksCacheTimestamp = now
  return jwksCache
}

async function verifyOutsetaJWT(token) {
  try {
    if (!token || typeof token !== 'string') return null
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const b64 = (s) => s.replace(/-/g, '+').replace(/_/g, '/')
    const header  = JSON.parse(atob(b64(parts[0])))
    const payload = JSON.parse(atob(b64(parts[1])))

    if (header.alg !== 'RS256') return null
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp && payload.exp < now) return null
    if (payload.iss !== 'https://mtgbroker.outseta.com') return null

    const jwks = await getOutsetaJwks()
    const key = (header.kid ? jwks.keys?.find(k => k.kid === header.kid) : null) || jwks.keys?.[0]
    if (!key) return null

    const publicKey = await crypto.subtle.importKey(
      'jwk', key,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['verify']
    )

    const encoder  = new TextEncoder()
    const data     = encoder.encode(`${parts[0]}.${parts[1]}`)
    const sigBytes = Uint8Array.from(atob(b64(parts[2])), c => c.charCodeAt(0))

    const isValid = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' }, publicKey, sigBytes, data
    )
    return isValid ? payload : null
  } catch (e) {
    console.error('JWT verification error:', e.message)
    return null
  }
}


// ─── Fetch a URL with timeout and error handling ─────────────────────────────
async function fetchPage(url, timeoutMs = 10000) {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MtgBrokerBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const html = await res.text()
    // Strip HTML tags for a rough text extraction (good enough for Claude)
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 30000) // Cap at 30k chars to stay within Claude context
  } catch (e) {
    return null
  }
}


// ─── Use Claude to extract lender details from page content ──────────────────
async function extractLenderDetails(pageTexts, url, apiKey) {
  const combined = Object.entries(pageTexts)
    .filter(([, text]) => text)
    .map(([page, text]) => `=== ${page} ===\n${text}`)
    .join('\n\n')

  if (!combined.trim()) {
    throw new Error('Could not fetch any content from the website')
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `You are a Data Architect for a wholesale mortgage broker platform.
You are extracting information about a wholesale mortgage lender from their website content.

The website URL is: ${url}

Here is the text content from their website pages:

${combined}

## Extraction Rules

1. **Only use data clearly found in the content.** Use null for anything you cannot confidently identify. Never guess or fabricate values.
2. **Lender Name:** Use the official company name, not the domain name.
3. **NMLS:** Look in the footer, "About Us", or licensing pages. Digits only.
4. **Social Media:** Prioritize "Wholesale" or "TPO" specific channels when available. Only include verified business accounts found on the site.
5. **Licensed States:** Look for a "State Licensing," "Availability," or "Where We Lend" page link.
   - If you find a list of states, return comma-separated abbreviations (e.g., "AL, FL, TX").
   - If the site says "All 50 States" or equivalent, return "All 50 States".
   - If no licensing info is found, return null.
   - For the licensed_states_url, ONLY use a URL from the lender's corporate website. NEVER use third-party sites (FREEandCLEAR, loanbase.com, NMLS Consumer Access, etc.).
6. **TPO/Broker Portal:** Look for a wholesale login, TPO portal, or broker portal URL.
7. **Description:** Extract 1-2 paragraphs from the About section. Keep it factual.

## Required Output

Return ONLY a JSON object with these exact keys. No other text.

{
  "lender_name": "Official company name",
  "description": "1-2 paragraph company description/about section",
  "corporate_website": "Clean main corporate URL (no tracking params)",
  "tpo_broker_portal": "Wholesale/TPO/broker portal login URL if found",
  "nmls": "NMLS ID number (digits only)",
  "fha_id": "FHA lender ID if found",
  "va_id": "VA lender ID if found",
  "usda_id": "USDA lender ID if found",
  "licensed_states": "Comma-separated state abbreviations, or 'All 50 States'",
  "licensed_states_url": "URL of the licensing/availability page on the lender's corporate website ONLY",
  "scenario_desk": "Scenario desk email address if found",
  "facebook": "Facebook page URL",
  "linkedin": "LinkedIn company page URL",
  "instagram": "Instagram profile URL",
  "youtube": "YouTube channel URL",
  "x_twitter": "X/Twitter profile URL"
}`,
      }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API error: ${response.status} — ${err}`)
  }

  const result = await response.json()
  const text = result.content?.[0]?.text || ''

  // Parse JSON from Claude's response (handle potential markdown wrapping)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Claude did not return valid JSON')

  return JSON.parse(jsonMatch[0])
}


// ─── Check Airtable for duplicate lender names ──────────────────────────────
async function checkDuplicate(lenderName, apiKey) {
  if (!lenderName) return null

  const formula = encodeURIComponent(`FIND(LOWER("${lenderName.replace(/"/g, '\\"')}"), LOWER({Lender Name}))`)
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_LENDER_TABLE_ID}?filterByFormula=${formula}&maxRecords=5&fields%5B%5D=Lender+Name`

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  })

  if (!res.ok) return null
  const data = await res.json()
  return data.records?.length > 0 ? data.records : null
}


// ─── Create Airtable record ─────────────────────────────────────────────────
async function createAirtableRecord(fields, apiKey) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_LENDER_TABLE_ID}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Airtable create error: ${res.status} — ${err}`)
  }

  return await res.json()
}


// ─── Map Claude's extracted fields to Airtable field names ──────────────────
function mapToAirtableFields(extracted, originalUrl) {
  const fields = {}

  if (extracted.lender_name) fields['Lender Name'] = extracted.lender_name
  if (extracted.description) fields['Description'] = extracted.description
  if (extracted.corporate_website) fields['Corporate Website'] = extracted.corporate_website
  else fields['Corporate Website'] = originalUrl // Fallback to the URL they pasted
  if (extracted.tpo_broker_portal) fields['TPO Broker Portal'] = extracted.tpo_broker_portal
  if (extracted.nmls) fields['NMLS'] = String(extracted.nmls)
  if (extracted.fha_id) fields['FHA ID'] = String(extracted.fha_id)
  if (extracted.va_id) fields['VA ID'] = String(extracted.va_id)
  if (extracted.usda_id) fields['USDA ID'] = String(extracted.usda_id)
  if (extracted.licensed_states) fields['Licensed States'] = extracted.licensed_states
  if (extracted.licensed_states_url) fields['Licensed States URL'] = extracted.licensed_states_url
  if (extracted.scenario_desk) fields['Scenario Desk'] = extracted.scenario_desk
  if (extracted.facebook) fields['Facebook'] = extracted.facebook
  if (extracted.linkedin) fields['LinkedIn'] = extracted.linkedin
  if (extracted.instagram) fields['Instagram'] = extracted.instagram
  if (extracted.youtube) fields['YouTube'] = extracted.youtube
  if (extracted.x_twitter) fields['X (Twitter)'] = extracted.x_twitter

  return fields
}


// ─── CORS preflight ─────────────────────────────────────────────────────────
export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request) })
}


// ─── Main handler ───────────────────────────────────────────────────────────
export async function onRequestPost(context) {
  const { request, env } = context

  try {
    // ── Auth: admin only ──────────────────────────────────────────────
    const authHeader = request.headers.get('Authorization')
    const rawToken = authHeader?.replace('Bearer ', '') || null
    if (!rawToken) return jsonError(request, 'Authentication required', 401)

    const payload = await verifyOutsetaJWT(rawToken)
    if (!payload) return jsonError(request, 'Invalid or expired token', 401)

    const userEmail = (payload.email || payload.sub || '').toLowerCase()
    if (!ADMIN_EMAILS.includes(userEmail)) {
      return jsonError(request, 'Admin access required', 403)
    }

    // ── Parse input ──────────────────────────────────────────────────
    const body = await request.json()
    let { url, force } = body

    if (!url || typeof url !== 'string') {
      return jsonError(request, 'url is required', 400)
    }

    // Clean up URL
    url = url.trim()
    if (!url.startsWith('http')) url = 'https://' + url

    // ── Step 1: Fetch the website pages ──────────────────────────────
    // Parse the base URL for sub-page fetching
    let baseUrl
    try {
      const parsed = new URL(url)
      baseUrl = `${parsed.protocol}//${parsed.hostname}`
    } catch (e) {
      return jsonError(request, 'Invalid URL format', 400)
    }

    // Fetch main page and common sub-pages in parallel
    const [mainPage, aboutPage, wholesalePage, tpoPage, contactPage, licensingPage] = await Promise.all([
      fetchPage(url),
      fetchPage(`${baseUrl}/about`),
      fetchPage(`${baseUrl}/wholesale`),
      fetchPage(`${baseUrl}/tpo`),
      fetchPage(`${baseUrl}/contact`),
      fetchPage(`${baseUrl}/licensing`),
    ])

    const pageTexts = {
      'Main Page': mainPage,
      'About Page': aboutPage,
      'Wholesale Page': wholesalePage,
      'TPO Page': tpoPage,
      'Contact Page': contactPage,
      'Licensing Page': licensingPage,
    }

    // ── Step 2: Extract details with Claude ──────────────────────────
    const anthropicKey = env.ANTHROPIC_API_KEY
    if (!anthropicKey) return jsonError(request, 'ANTHROPIC_API_KEY not configured', 500)

    const extracted = await extractLenderDetails(pageTexts, url, anthropicKey)

    if (!extracted.lender_name) {
      return jsonError(request, 'Could not determine the lender name from the website', 422)
    }

    // ── Step 3: Check for duplicates ─────────────────────────────────
    const airtableKey = env.AIRTABLE_API_KEY
    if (!airtableKey) return jsonError(request, 'AIRTABLE_API_KEY not configured', 500)

    const duplicates = await checkDuplicate(extracted.lender_name, airtableKey)

    if (duplicates && !force) {
      // Return the extracted data + duplicate warning so the UI can handle it
      return jsonSuccess(request, {
        success: false,
        duplicate: true,
        existing_records: duplicates.map(r => ({
          id: r.id,
          name: r.fields?.['Lender Name'],
        })),
        extracted,
        message: `A lender named "${extracted.lender_name}" may already exist in the database.`,
      })
    }

    // ── Step 4: Create the Airtable record ───────────────────────────
    const airtableFields = mapToAirtableFields(extracted, url)
    const record = await createAirtableRecord(airtableFields, airtableKey)

    // ── Step 5: Report results ───────────────────────────────────────
    const populatedFields = Object.keys(airtableFields)
    const missingFields = ALL_KEY_FIELDS.filter(f => !populatedFields.includes(f))

    return jsonSuccess(request, {
      success: true,
      lender_name: extracted.lender_name,
      record_id: record.id,
      airtable_url: `https://airtable.com/${AIRTABLE_BASE_ID}/${AIRTABLE_LENDER_TABLE_ID}/${record.id}`,
      fields_populated: populatedFields,
      fields_missing: missingFields,
      extracted,
    })

  } catch (err) {
    console.error('Add lender error:', err)
    return jsonError(request, err.message || 'Internal server error', 500)
  }
}

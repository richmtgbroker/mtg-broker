// functions/api/add-lender.js
// Cloudflare Pages Function — uses Claude with web search to research a lender,
// checks for duplicates, and creates/updates a record in the Airtable Lender List table.
//
// POST { url }
//   1. Verify JWT (admin-only)
//   2. Use Claude + web search to research the lender from their URL
//   3. Check Airtable for duplicate lender names
//   4. Create Airtable record with extracted fields
//   5. Return { success, lender_name, record_id, fields_populated, fields_missing }
//
// Required env vars: ANTHROPIC_API_KEY, AIRTABLE_API_KEY

const AIRTABLE_BASE_ID = 'appuJgI9X93OLaf0u'
const AIRTABLE_LENDER_TABLE_ID = 'tbl1mpg3KFakZsFK7'

const ALLOWED_ORIGINS = [
  'https://mtg.broker',
  'https://www.mtg.broker',
  'https://mtg-loan-finder.pages.dev',
  'https://mtg-app-staging.pages.dev',
  'https://mtg-app.pages.dev',
  'https://mtg-app-stage.pages.dev',
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


// ─── Use Claude with web search to research a lender ─────────────────────────
async function researchLenderWithWebSearch(url, apiKey) {
  // Use Claude's web_search tool to research the lender — no direct HTML scraping needed.
  // This works even on Cloudflare-protected sites, bot-blocked sites, etc.
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 5,
        },
      ],
      messages: [{
        role: 'user',
        content: `You are a Data Architect for a wholesale mortgage broker platform.
Research this wholesale mortgage lender and extract their details: ${url}

Use web search to find information about this company. Search their website, LinkedIn, NMLS Consumer Access, and any other relevant sources.

## What to Research

1. **Lender Name** — official company name (not domain name)
2. **Description** — 1-2 paragraph company description
3. **Corporate Website** — clean main URL (no tracking params)
4. **NMLS** — NMLS ID number (digits only). Search "site:nmlsconsumeraccess.org [company name]" if not found on their site
5. **TPO/Broker Portal** — wholesale/TPO/broker portal login URL
6. **FHA ID, VA ID, USDA ID** — government lender IDs if found
7. **Licensed States** — comma-separated state abbreviations, or "All 50 States"
8. **Scenario Desk** — email address if found
10. **Social Media** — Facebook, LinkedIn, Instagram, YouTube, X/Twitter profile URLs
    - Prioritize wholesale/TPO-specific channels when available
    - Only include verified business accounts

## Rules

- **Only use data you can verify.** Use null for anything you cannot confidently identify.
- For social media, only include actual company profile URLs, not share/intent links.

## Required Output

Return ONLY a JSON object with these exact keys. No other text before or after the JSON.

{
  "lender_name": "Official company name",
  "description": "1-2 paragraph company description",
  "corporate_website": "Clean main corporate URL",
  "tpo_broker_portal": "Wholesale/TPO portal URL or null",
  "nmls": "NMLS ID (digits only) or null",
  "fha_id": "FHA lender ID or null",
  "va_id": "VA lender ID or null",
  "usda_id": "USDA lender ID or null",
  "licensed_states": "Comma-separated abbreviations, 'All 50 States', or null",
  "scenario_desk": "Email address or null",
  "facebook": "Facebook page URL or null",
  "linkedin": "LinkedIn company page URL or null",
  "instagram": "Instagram profile URL or null",
  "youtube": "YouTube channel URL or null",
  "x_twitter": "X/Twitter profile URL or null"
}`,
      }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API error: ${response.status} — ${err}`)
  }

  const result = await response.json()

  // Extract the final text response from Claude (skip tool_use and tool_result blocks)
  const textBlocks = (result.content || []).filter(b => b.type === 'text')
  const text = textBlocks.map(b => b.text).join('\n')

  if (!text) {
    throw new Error('Claude did not return a text response')
  }

  // Parse JSON from Claude's response (handle potential markdown wrapping)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Claude did not return valid JSON')

  return JSON.parse(jsonMatch[0])
}


// ─── Extract the core company name (strip legal suffixes, dba, separators) ──
function extractCoreName(name) {
  if (!name) return ''
  return name
    .toLowerCase()
    .replace(/\(dba[^)]*\)/gi, '')       // Remove (dba ...)
    .replace(/\bdba\b.*/gi, '')           // Remove "dba" and everything after
    .replace(/\b(llc|inc|corp|ltd|co|lp|llp|plc|na|n\.a\.)\b/gi, '') // Legal suffixes
    .replace(/[|/\\–—-]/g, ' ')           // Separators to spaces
    .replace(/[^a-z0-9\s]/g, '')          // Strip punctuation
    .replace(/\s+/g, ' ')                 // Collapse whitespace
    .trim()
}

// ─── Extract domain from URL (e.g. "renofi.com" from "https://www.renofi.com/about") ──
function extractDomain(urlStr) {
  try {
    const parsed = new URL(urlStr.startsWith('http') ? urlStr : 'https://' + urlStr)
    return parsed.hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

// ─── Check Airtable for duplicate lenders (by URL domain + name keywords) ───
async function checkDuplicate(lenderName, websiteUrl, apiKey) {
  const results = new Map() // recordId → record (deduped)

  // Strategy 1: Match by website domain in Corporate Website field
  const domain = extractDomain(websiteUrl)
  if (domain) {
    const domainFormula = encodeURIComponent(
      `FIND("${domain}", LOWER({Corporate Website}))`
    )
    const domainUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_LENDER_TABLE_ID}?filterByFormula=${domainFormula}&maxRecords=5&fields%5B%5D=Lender+Name`
    try {
      const res = await fetch(domainUrl, { headers: { 'Authorization': `Bearer ${apiKey}` } })
      if (res.ok) {
        const data = await res.json()
        for (const rec of (data.records || [])) {
          results.set(rec.id, rec)
        }
      }
    } catch { /* continue to name check */ }
  }

  // Strategy 2: Match by core name keywords
  if (lenderName) {
    const coreName = extractCoreName(lenderName)
    if (coreName.length >= 3) {
      const nameFormula = encodeURIComponent(
        `FIND("${coreName.replace(/"/g, '\\"')}", LOWER({Lender Name}))`
      )
      const nameUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_LENDER_TABLE_ID}?filterByFormula=${nameFormula}&maxRecords=5&fields%5B%5D=Lender+Name`
      try {
        const res = await fetch(nameUrl, { headers: { 'Authorization': `Bearer ${apiKey}` } })
        if (res.ok) {
          const data = await res.json()
          for (const rec of (data.records || [])) {
            results.set(rec.id, rec)
          }
        }
      } catch { /* continue */ }
    }

    // Strategy 3: Also try the full extracted name as a substring
    const fullFormula = encodeURIComponent(
      `FIND(LOWER("${lenderName.replace(/"/g, '\\"')}"), LOWER({Lender Name}))`
    )
    const fullUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_LENDER_TABLE_ID}?filterByFormula=${fullFormula}&maxRecords=5&fields%5B%5D=Lender+Name`
    try {
      const res = await fetch(fullUrl, { headers: { 'Authorization': `Bearer ${apiKey}` } })
      if (res.ok) {
        const data = await res.json()
        for (const rec of (data.records || [])) {
          results.set(rec.id, rec)
        }
      }
    } catch { /* continue */ }
  }

  const matches = Array.from(results.values())
  return matches.length > 0 ? matches : null
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


// ─── Update existing Airtable record (only fill blank fields) ───────────────
async function updateAirtableRecord(recordId, newFields, apiKey) {
  // First, fetch the existing record to see which fields are already populated
  const getUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_LENDER_TABLE_ID}/${recordId}`
  const getRes = await fetch(getUrl, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  })

  if (!getRes.ok) {
    const err = await getRes.text()
    throw new Error(`Airtable get error: ${getRes.status} — ${err}`)
  }

  const existing = await getRes.json()
  const existingFields = existing.fields || {}

  // Only include fields that are currently blank/empty on the existing record
  const fieldsToUpdate = {}
  const skippedFields = [] // Already had data — not overwritten
  const updatedFields = [] // Were blank — now filled

  for (const [key, value] of Object.entries(newFields)) {
    const existingValue = existingFields[key]
    const isEmpty = existingValue === undefined || existingValue === null || existingValue === ''
    if (isEmpty && value) {
      fieldsToUpdate[key] = value
      updatedFields.push(key)
    } else if (!isEmpty) {
      skippedFields.push(key)
    }
  }

  if (Object.keys(fieldsToUpdate).length === 0) {
    return { record: existing, updatedFields: [], skippedFields, noChanges: true }
  }

  // PATCH the record with only the blank fields
  const patchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_LENDER_TABLE_ID}/${recordId}`
  const patchRes = await fetch(patchUrl, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: fieldsToUpdate }),
  })

  if (!patchRes.ok) {
    const err = await patchRes.text()
    throw new Error(`Airtable update error: ${patchRes.status} — ${err}`)
  }

  const updated = await patchRes.json()
  return { record: updated, updatedFields, skippedFields, noChanges: false }
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
    let { url, force, update_existing, selected_fields } = body

    if (!url || typeof url !== 'string') {
      return jsonError(request, 'url is required', 400)
    }

    // Clean up URL
    url = url.trim()
    if (!url.startsWith('http')) url = 'https://' + url

    // Validate URL format
    try {
      new URL(url)
    } catch (e) {
      return jsonError(request, 'Invalid URL format', 400)
    }

    // ── Step 1: Research lender with Claude + web search ─────────────
    const anthropicKey = env.ANTHROPIC_API_KEY
    if (!anthropicKey) return jsonError(request, 'ANTHROPIC_API_KEY not configured', 500)

    const extracted = await researchLenderWithWebSearch(url, anthropicKey)

    if (!extracted.lender_name) {
      return jsonError(request, 'Could not determine the lender name', 422)
    }

    // ── Step 2: Check for duplicates ─────────────────────────────────
    const airtableKey = env.AIRTABLE_API_KEY
    if (!airtableKey) return jsonError(request, 'AIRTABLE_API_KEY not configured', 500)

    const duplicates = await checkDuplicate(extracted.lender_name, url, airtableKey)

    if (duplicates && !force && !update_existing) {
      // Fetch full details of the first matching record for comparison
      const firstDupe = duplicates[0]
      let existingFields = {}
      try {
        const getUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_LENDER_TABLE_ID}/${firstDupe.id}`
        const getRes = await fetch(getUrl, {
          headers: { 'Authorization': `Bearer ${airtableKey}` },
        })
        if (getRes.ok) {
          const fullRecord = await getRes.json()
          existingFields = fullRecord.fields || {}
        }
      } catch { /* continue with empty existing fields */ }

      // Build a comparison: for each extractable field, show current vs new
      const airtableFields = mapToAirtableFields(extracted, url)
      const comparison = {}
      for (const field of EXTRACTABLE_FIELDS) {
        const newVal = airtableFields[field] || null
        const curVal = existingFields[field] || null
        if (newVal || curVal) {
          comparison[field] = { current: curVal, new: newVal }
        }
      }

      // Use the interface URL from the existing record, or fall back to generic
      const interfaceUrl = existingFields['Link to this Airtable LENDER (Formula)'] || null

      return jsonSuccess(request, {
        success: false,
        duplicate: true,
        existing_records: duplicates.map(r => ({
          id: r.id,
          name: r.fields?.['Lender Name'],
          airtable_url: r.id === firstDupe.id && interfaceUrl
            ? interfaceUrl
            : `https://airtable.com/${AIRTABLE_BASE_ID}/${AIRTABLE_LENDER_TABLE_ID}/${r.id}`,
        })),
        extracted,
        comparison,
        message: `A lender named "${extracted.lender_name}" may already exist in the database.`,
      })
    }

    // ── Step 3a: Update existing record with user-selected fields ───
    if (update_existing) {
      let airtableFields = mapToAirtableFields(extracted, url)

      // If user selected specific fields, only include those
      if (selected_fields && Array.isArray(selected_fields) && selected_fields.length > 0) {
        const filtered = {}
        for (const field of selected_fields) {
          if (airtableFields[field] !== undefined) {
            filtered[field] = airtableFields[field]
          }
        }
        airtableFields = filtered
      }

      const { record, updatedFields, skippedFields, noChanges } = await updateAirtableRecord(
        update_existing, airtableFields, airtableKey
      )

      // Fetch the interface URL from the updated record
      const updatedRecordFields = record.fields || {}
      const updatedInterfaceUrl = updatedRecordFields['Link to this Airtable LENDER (Formula)']
        || `https://airtable.com/${AIRTABLE_BASE_ID}/${AIRTABLE_LENDER_TABLE_ID}/${record.id}`

      return jsonSuccess(request, {
        success: true,
        updated: true,
        no_changes: noChanges,
        lender_name: extracted.lender_name,
        record_id: record.id,
        airtable_url: updatedInterfaceUrl,
        fields_updated: updatedFields,
        fields_skipped: skippedFields,
        fields_missing: ALL_KEY_FIELDS.filter(f => !updatedFields.includes(f) && !skippedFields.includes(f)),
        extracted,
      })
    }

    // ── Step 3b: Create new Airtable record ──────────────────────────
    const airtableFields = mapToAirtableFields(extracted, url)
    const record = await createAirtableRecord(airtableFields, airtableKey)

    // Fetch the interface URL from the newly created record (formula field needs a re-fetch)
    let newRecordUrl = `https://airtable.com/${AIRTABLE_BASE_ID}/${AIRTABLE_LENDER_TABLE_ID}/${record.id}`
    try {
      const refetchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_LENDER_TABLE_ID}/${record.id}`
      const refetchRes = await fetch(refetchUrl, {
        headers: { 'Authorization': `Bearer ${airtableKey}` },
      })
      if (refetchRes.ok) {
        const refetched = await refetchRes.json()
        const formulaUrl = refetched.fields?.['Link to this Airtable LENDER (Formula)']
        if (formulaUrl) newRecordUrl = formulaUrl
      }
    } catch { /* use fallback URL */ }

    // ── Step 4: Report results ───────────────────────────────────────
    const populatedFields = Object.keys(airtableFields)
    const missingFields = ALL_KEY_FIELDS.filter(f => !populatedFields.includes(f))

    return jsonSuccess(request, {
      success: true,
      lender_name: extracted.lender_name,
      record_id: record.id,
      airtable_url: newRecordUrl,
      fields_populated: populatedFields,
      fields_missing: missingFields,
      extracted,
    })

  } catch (err) {
    console.error('Add lender error:', err)
    return jsonError(request, err.message || 'Internal server error', 500)
  }
}

// functions/api/manage-emails.js
// Cloudflare Pages Function — admin tools for managing email-sourced guideline data.
//
// v1.0 — Initial build
//
// Endpoints:
//   GET  /api/manage-emails?action=stats     — View email chunk stats
//   GET  /api/manage-emails?action=list       — List recent lender updates
//   POST /api/manage-emails { action: "purge_all" }         — Delete ALL email chunks
//   POST /api/manage-emails { action: "purge_lender", lender: "UWM" } — Delete one lender's email chunks
//   POST /api/manage-emails { action: "disable_all" }       — Soft-disable all email chunks (reversible)
//   POST /api/manage-emails { action: "enable_all" }        — Re-enable all email chunks
//   POST /api/manage-emails { action: "cleanup_expired" }   — Expire chunks past their TTL
//
// Auth: Admin-only (rich@mtg.broker, rich@prestonlending.com)
//
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY (or SUPABASE_ANON_KEY)

const ALLOWED_ORIGINS = ['https://mtg.broker', 'https://www.mtg.broker']
const ADMIN_EMAILS = ['rich@mtg.broker', 'rich@prestonlending.com']

function getCorsHeaders(request) {
  const origin = request ? request.headers.get('Origin') : null
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

// ─── JWT VERIFICATION (RS256) ───────────────────────────────────────────────
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
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
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
    return null
  }
}

// Verify admin access — shared by GET and POST handlers
async function verifyAdmin(request) {
  const authHeader = request.headers.get('Authorization')
  const rawToken = authHeader?.replace('Bearer ', '') || null
  if (!rawToken) return { error: 'Authentication required', status: 401 }
  const payload = await verifyOutsetaJWT(rawToken)
  if (!payload) return { error: 'Invalid or expired token', status: 401 }
  const userEmail = (payload.email || payload.sub || '').toLowerCase()
  if (!ADMIN_EMAILS.includes(userEmail)) return { error: 'Admin access required', status: 403 }
  return { email: userEmail }
}


// ─── CORS preflight ─────────────────────────────────────────────────────────
export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request) })
}


// ─── GET: Stats and listing ─────────────────────────────────────────────────
export async function onRequestGet(context) {
  const { request, env } = context

  const auth = await verifyAdmin(request)
  if (auth.error) return jsonError(request, auth.error, auth.status)

  const url = new URL(request.url)
  const action = url.searchParams.get('action') || 'stats'
  const supabaseUrl = env.SUPABASE_URL || 'https://tcmahfwhdknxhhdvqpum.supabase.co'
  const supabaseKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_ANON_KEY
  const headers = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
  }

  try {
    if (action === 'stats') {
      // Count email chunks (active vs inactive)
      const [activeRes, inactiveRes, totalRes, updatesRes] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/guideline_chunks?source_type=eq.email_update&active=eq.true&select=id`, { headers, method: 'HEAD' }),
        fetch(`${supabaseUrl}/rest/v1/guideline_chunks?source_type=eq.email_update&active=eq.false&select=id`, { headers, method: 'HEAD' }),
        fetch(`${supabaseUrl}/rest/v1/guideline_chunks?source_type=eq.pdf_matrix&select=id`, { headers, method: 'HEAD' }),
        fetch(`${supabaseUrl}/rest/v1/lender_updates?select=id`, { headers, method: 'HEAD' }),
      ])

      // Use Supabase count headers (Prefer: count=exact) — fallback to query
      // Simple approach: just run count queries
      const statsQuery = `
        SELECT
          (SELECT count(*) FROM guideline_chunks WHERE source_type = 'email_update' AND active = true) as email_active,
          (SELECT count(*) FROM guideline_chunks WHERE source_type = 'email_update' AND active = false) as email_inactive,
          (SELECT count(*) FROM guideline_chunks WHERE source_type = 'pdf_matrix') as pdf_chunks,
          (SELECT count(*) FROM lender_updates) as total_updates,
          (SELECT count(*) FROM lender_updates WHERE processed = true) as processed_updates
      `
      const statsRes = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
        method: 'POST',
        headers,
        body: '{}',
      })

      // Simpler: use individual count queries via PostgREST
      const countHeaders = { ...headers, 'Prefer': 'count=exact', 'Range': '0-0' }
      const [c1, c2, c3, c4, c5] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/guideline_chunks?source_type=eq.email_update&active=eq.true&select=id`, { headers: countHeaders }),
        fetch(`${supabaseUrl}/rest/v1/guideline_chunks?source_type=eq.email_update&active=eq.false&select=id`, { headers: countHeaders }),
        fetch(`${supabaseUrl}/rest/v1/guideline_chunks?source_type=eq.pdf_matrix&select=id`, { headers: countHeaders }),
        fetch(`${supabaseUrl}/rest/v1/lender_updates?select=id`, { headers: countHeaders }),
        fetch(`${supabaseUrl}/rest/v1/lender_updates?processed=eq.true&select=id`, { headers: countHeaders }),
      ])

      // Parse content-range header: "0-0/123" → 123
      const getCount = (res) => {
        const range = res.headers.get('content-range')
        if (!range) return 0
        const match = range.match(/\/(\d+)/)
        return match ? parseInt(match[1]) : 0
      }

      return jsonResponse(request, {
        email_chunks_active: getCount(c1),
        email_chunks_inactive: getCount(c2),
        pdf_chunks: getCount(c3),
        total_lender_updates: getCount(c4),
        processed_updates: getCount(c5),
      })
    }

    if (action === 'list') {
      // List recent lender updates (last 50)
      const listRes = await fetch(
        `${supabaseUrl}/rest/v1/lender_updates?order=received_at.desc&limit=50&select=id,lender_name,subject,update_type,topic_tag,ttl_days,processed,chunks_created,received_at`,
        { headers }
      )
      const updates = await listRes.json()
      return jsonResponse(request, { updates })
    }

    return jsonError(request, 'Unknown action. Use: stats, list', 400)

  } catch (err) {
    console.error('Manage emails error:', err)
    return jsonError(request, 'Internal server error', 500)
  }
}


// ─── POST: Purge, disable, enable, cleanup ──────────────────────────────────
export async function onRequestPost(context) {
  const { request, env } = context

  const auth = await verifyAdmin(request)
  if (auth.error) return jsonError(request, auth.error, auth.status)

  const body = await request.json()
  const { action, lender } = body

  const supabaseUrl = env.SUPABASE_URL || 'https://tcmahfwhdknxhhdvqpum.supabase.co'
  const supabaseKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_ANON_KEY
  const headers = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
  }

  try {
    // ── PURGE ALL: Permanently delete all email-sourced chunks ──────
    if (action === 'purge_all') {
      // Delete email chunks
      const delChunks = await fetch(
        `${supabaseUrl}/rest/v1/guideline_chunks?source_type=eq.email_update`,
        { method: 'DELETE', headers: { ...headers, 'Prefer': 'return=representation' } }
      )
      const deleted = delChunks.ok ? (await delChunks.json()).length : 0

      // Delete lender_updates records
      const delUpdates = await fetch(
        `${supabaseUrl}/rest/v1/lender_updates`,
        { method: 'DELETE', headers: { ...headers, 'Prefer': 'return=representation' },
          // PostgREST requires a filter for DELETE — use a wildcard match
        }
      )

      return jsonResponse(request, {
        action: 'purge_all',
        chunks_deleted: deleted,
        message: `Permanently deleted ${deleted} email-sourced chunks. PDF data is untouched.`,
      })
    }

    // ── PURGE LENDER: Delete email chunks for a specific lender ─────
    if (action === 'purge_lender') {
      if (!lender) return jsonError(request, 'lender name is required for purge_lender', 400)

      const delRes = await fetch(
        `${supabaseUrl}/rest/v1/guideline_chunks?source_type=eq.email_update&lender_name=eq.${encodeURIComponent(lender)}`,
        { method: 'DELETE', headers: { ...headers, 'Prefer': 'return=representation' } }
      )
      const deleted = delRes.ok ? (await delRes.json()).length : 0

      return jsonResponse(request, {
        action: 'purge_lender',
        lender,
        chunks_deleted: deleted,
        message: `Deleted ${deleted} email chunks for ${lender}.`,
      })
    }

    // ── DISABLE ALL: Soft-disable all email chunks (reversible) ─────
    if (action === 'disable_all') {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/guideline_chunks?source_type=eq.email_update&active=eq.true`,
        {
          method: 'PATCH',
          headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify({ active: false, updated_at: new Date().toISOString() }),
        }
      )
      const affected = res.ok ? (await res.json()).length : 0

      return jsonResponse(request, {
        action: 'disable_all',
        chunks_disabled: affected,
        message: `Disabled ${affected} email chunks. They won't appear in search. Use enable_all to reverse.`,
      })
    }

    // ── ENABLE ALL: Re-enable all email chunks ──────────────────────
    if (action === 'enable_all') {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/guideline_chunks?source_type=eq.email_update&active=eq.false`,
        {
          method: 'PATCH',
          headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify({ active: true, updated_at: new Date().toISOString() }),
        }
      )
      const affected = res.ok ? (await res.json()).length : 0

      return jsonResponse(request, {
        action: 'enable_all',
        chunks_enabled: affected,
        message: `Re-enabled ${affected} email chunks. They will now appear in search again.`,
      })
    }

    // ── CLEANUP EXPIRED: Deactivate chunks past their TTL ───────────
    if (action === 'cleanup_expired') {
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/cleanup_expired_chunks`, {
        method: 'POST',
        headers,
        body: '{}',
      })
      const count = res.ok ? await res.json() : 0

      return jsonResponse(request, {
        action: 'cleanup_expired',
        chunks_expired: count,
        message: `Expired ${count} chunks that were past their TTL.`,
      })
    }

    return jsonError(request, 'Unknown action. Use: purge_all, purge_lender, disable_all, enable_all, cleanup_expired', 400)

  } catch (err) {
    console.error('Manage emails error:', err)
    return jsonError(request, 'Internal server error', 500)
  }
}


// ─── Helpers ────────────────────────────────────────────────────────────────

function jsonResponse(request, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' },
  })
}

function jsonError(request, message, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' },
  })
}

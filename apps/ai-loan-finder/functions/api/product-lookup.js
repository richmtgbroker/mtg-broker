// Cloudflare Pages Function — look up a loan product by product_name + lender_name
// Used by the Search Guidelines tab to open the product detail modal for a source.
//
// v1.1 — Security: sanitized error messages (no internal details leaked to client),
//         added JWT verification to prevent unauthenticated access.

const ALLOWED_ORIGINS = [
  'https://mtg.broker',
  'https://www.mtg.broker',
  'https://mtg-loan-finder.pages.dev',
  'https://mtg-app.pages.dev',
  'https://mtg-app-staging.pages.dev',
  'https://mtg-app-stage.pages.dev',
]

function isAllowedOrigin(origin) {
  if (!origin) return false
  if (ALLOWED_ORIGINS.includes(origin)) return true
  if (/^https:\/\/[a-f0-9]+\.mtg-app-staging\.pages\.dev$/.test(origin)) return true
  if (/^https:\/\/[a-f0-9]+\.mtg-app-stage\.pages\.dev$/.test(origin)) return true
  if (/^https:\/\/[a-f0-9]+\.mtg-app\.pages\.dev$/.test(origin)) return true
  if (/^https:\/\/[a-f0-9]+\.mtg-loan-finder\.pages\.dev$/.test(origin)) return true
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


// ─── JWT VERIFICATION (RS256) ───────────────────────────────────────────────
let jwksCache = null
let jwksCacheTimestamp = null
const JWKS_CACHE_DURATION = 60 * 60 * 1000 // 1 hour

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
      'jwk',
      key,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    )

    const encoder  = new TextEncoder()
    const data     = encoder.encode(`${parts[0]}.${parts[1]}`)
    const sigBytes = Uint8Array.from(atob(b64(parts[2])), c => c.charCodeAt(0))

    const isValid = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      publicKey,
      sigBytes,
      data
    )

    return isValid ? payload : null
  } catch (e) {
    console.error('JWT verification error:', e.message)
    return null
  }
}


export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request) })
}

export async function onRequestPost(context) {
  const { request, env } = context

  try {
    // ── Verify JWT — reject unauthenticated requests ──────────────────
    const authHeader = request.headers.get('Authorization')
    const rawToken = authHeader?.replace('Bearer ', '') || null

    if (!rawToken) {
      return jsonResponse(request, { error: 'Authentication required' }, 401)
    }

    const payload = await verifyOutsetaJWT(rawToken)
    if (!payload) {
      return jsonResponse(request, { error: 'Invalid or expired token' }, 401)
    }

    const { product_name, lender_name } = await request.json()
    if (!product_name) {
      return jsonResponse(request, { error: 'product_name is required' }, 400)
    }

    const supabaseUrl = env.SUPABASE_URL || 'https://tcmahfwhdknxhhdvqpum.supabase.co'
    const supabaseKey = env.SUPABASE_ANON_KEY
    if (!supabaseKey) {
      console.error('SUPABASE_ANON_KEY not configured')
      return jsonResponse(request, { error: 'Service configuration error' }, 500)
    }

    // Query Supabase for the product — match on product_name, optionally lender_name
    let url = `${supabaseUrl}/rest/v1/loan_products?product_name=eq.${encodeURIComponent(product_name)}&limit=5`
    if (lender_name) {
      url += `&lender_name=eq.${encodeURIComponent(lender_name)}`
    }

    const resp = await fetch(url, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    })

    if (!resp.ok) {
      const err = await resp.text()
      // Log full error server-side, return generic message to client
      console.error('Supabase product lookup error:', resp.status, err)
      return jsonResponse(request, { error: 'Product lookup failed' }, 500)
    }

    const products = await resp.json()
    return jsonResponse(request, { product: products[0] || null })

  } catch (err) {
    // Log full error server-side, return generic message to client
    console.error('Product lookup error:', err)
    return jsonResponse(request, { error: 'Product lookup failed' }, 500)
  }
}

function jsonResponse(request, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' },
  })
}

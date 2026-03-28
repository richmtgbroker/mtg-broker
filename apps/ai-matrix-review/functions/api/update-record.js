// Cloudflare Pages Function — Update a loan product record in Airtable
// v1.0 — Allows updating AI review fields (status, confidence, etc.)
// Admin-only access via Outseta JWT verification.

// ─── CORS ───────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://mtg.broker',
  'https://www.mtg.broker',
  'https://mtg-matrix-review.pages.dev',
  'https://mtg-app.pages.dev',
  'https://mtg-app-staging.pages.dev',
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/[a-f0-9]+\.mtg-matrix-review\.pages\.dev$/.test(origin)) return true;
  if (/^https:\/\/[a-f0-9]+\.mtg-app-staging\.pages\.dev$/.test(origin)) return true;
  if (/^https:\/\/[a-f0-9]+\.mtg-app\.pages\.dev$/.test(origin)) return true;
  if (/^http:\/\/localhost:\d+$/.test(origin)) return true;
  return false;
}

function getCorsHeaders(request) {
  const origin = request ? request.headers.get('Origin') : null;
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// ─── JWT VERIFICATION (RS256) ───────────────────────────────────────────────
let jwksCache = null;
let jwksCacheTimestamp = null;
const JWKS_CACHE_DURATION = 60 * 60 * 1000;

async function getOutsetaJwks() {
  const now = Date.now();
  if (jwksCache && jwksCacheTimestamp && (now - jwksCacheTimestamp < JWKS_CACHE_DURATION)) {
    return jwksCache;
  }
  const res = await fetch('https://mtgbroker.outseta.com/.well-known/jwks');
  if (!res.ok) throw new Error('Failed to fetch JWKS');
  jwksCache = await res.json();
  jwksCacheTimestamp = now;
  return jwksCache;
}

async function verifyOutsetaJWT(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const b64 = (s) => s.replace(/-/g, '+').replace(/_/g, '/');
    const header  = JSON.parse(atob(b64(parts[0])));
    const payload = JSON.parse(atob(b64(parts[1])));

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    const jwks = await getOutsetaJwks();
    const key = jwks.keys.find(k => k.kid === header.kid);
    if (!key) return null;

    const cryptoKey = await crypto.subtle.importKey(
      'jwk', key, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
    );

    const signatureBytes = Uint8Array.from(atob(b64(parts[2])), c => c.charCodeAt(0));
    const dataBytes = new TextEncoder().encode(parts[0] + '.' + parts[1]);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signatureBytes, dataBytes);
    return valid ? payload : null;
  } catch {
    return null;
  }
}

// ─── ADMIN CHECK ────────────────────────────────────────────────────────────
const ADMIN_EMAILS = ['rich@mtg.broker', 'rich@prestonlending.com'];

function isAdmin(payload) {
  if (!payload || !payload.email) return false;
  return ADMIN_EMAILS.includes(payload.email.toLowerCase());
}

// ─── ALLOWED FIELDS ─────────────────────────────────────────────────────────
// Only these fields can be updated via this endpoint (safety measure)
const UPDATABLE_FIELDS = [
  'AI: Review Status',
];

// ─── HANDLER ────────────────────────────────────────────────────────────────
const AIRTABLE_BASE_ID = 'appuJgI9X93OLaf0u';
const AIRTABLE_TABLE_ID = 'tblVSU5z4WSxreX7l';

export async function onRequestPatch(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    // Verify JWT — admin only
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const payload = await verifyOutsetaJWT(token);

    if (!payload) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isAdmin(payload)) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const body = await request.json();
    const { recordId, fields } = body;

    if (!recordId || !fields || typeof fields !== 'object') {
      return new Response(JSON.stringify({ error: 'recordId and fields are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate that only allowed fields are being updated
    for (const fieldName of Object.keys(fields)) {
      if (!UPDATABLE_FIELDS.includes(fieldName)) {
        return new Response(JSON.stringify({ error: `Field "${fieldName}" is not updatable` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const apiKey = env.AIRTABLE_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update record in Airtable
    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${recordId}`;
    const airtableRes = await fetch(airtableUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });

    if (!airtableRes.ok) {
      const errText = await airtableRes.text();
      return new Response(JSON.stringify({ error: 'Airtable update failed', details: errText }), {
        status: airtableRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const updatedRecord = await airtableRes.json();

    return new Response(JSON.stringify({ record: updatedRecord }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// Handle OPTIONS preflight for CORS
export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context.request),
  });
}

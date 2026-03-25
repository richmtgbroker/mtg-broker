// functions/api/guideline-search.js
// Cloudflare Pages Function — semantic search through lender PDF guidelines.
//
// v1.1 — Security: Added JWT verification (RS256) to prevent unauthenticated
//         API abuse. Only verified Outseta users can call this endpoint.
//
// NEW endpoint — does NOT modify or replace the existing /api/search endpoint.
//
// Flow:
//   POST { query: "Which lenders allow gift funds on investment properties?" }
//   1. Verify JWT (reject unauthenticated requests)
//   2. Generate embedding for the query (OpenAI text-embedding-3-small)
//   3. Query Supabase pgvector for the 35 most similar guideline chunks
//   4. Send query + chunks to Claude Haiku to synthesize a cited answer
//   5. Return { answer, sources, query }
//
// Required env vars (set in Cloudflare Pages dashboard + .dev.vars):
//   OPENAI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, ANTHROPIC_API_KEY

const ALLOWED_ORIGINS = ['https://mtg.broker', 'https://www.mtg.broker']

// Return CORS headers reflecting the request origin if it's allowed
function getCorsHeaders(request) {
  const origin = request ? request.headers.get('Origin') : null
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
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


// Handle CORS preflight
export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request) })
}

// Main handler
export async function onRequestPost(context) {
  const { request, env } = context

  try {
    // ── Verify JWT — reject unauthenticated requests ──────────────────
    const authHeader = request.headers.get('Authorization')
    const rawToken = authHeader?.replace('Bearer ', '') || null

    if (!rawToken) {
      return jsonError(request, 'Authentication required', 401)
    }

    const payload = await verifyOutsetaJWT(rawToken)
    if (!payload) {
      return jsonError(request, 'Invalid or expired token', 401)
    }

    const userEmail = payload.email || payload.sub || 'unknown'
    console.log('Guideline search by:', userEmail)

    const body = await request.json()
    const { query } = body

    if (!query || typeof query !== 'string' || !query.trim()) {
      return jsonError(request, 'query is required', 400)
    }

    const queryText = query.trim()

    // Step 1: Generate embedding for the user's question
    const embedding = await generateEmbedding(queryText, env.OPENAI_API_KEY)

    // Step 2: Search Supabase for the most relevant guideline chunks
    const chunks = await searchChunks(embedding, env)

    // If no chunks exist yet (PDFs not processed), return a helpful message
    if (!chunks || chunks.length === 0) {
      return jsonResponse(request, {
        answer: 'No guideline documents have been indexed yet. Run the PDF processing script (`node scripts/process-pdfs.js --limit 5`) to start indexing lender guidelines.',
        sources: [],
        query: queryText,
      })
    }

    // Step 3: Synthesize an answer with Claude Haiku, citing sources
    const { answer, sources } = await synthesizeAnswer(queryText, chunks, env.ANTHROPIC_API_KEY)

    return jsonResponse(request, { answer, sources, query: queryText })

  } catch (err) {
    console.error('Guideline search error:', err)
    return jsonError(request, 'Internal server error', 500)
  }
}

// ─── OpenAI Embedding ─────────────────────────────────────────────────────────

async function generateEmbedding(text, apiKey) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    console.error('OpenAI embedding error:', response.status, err)
    throw new Error('Embedding generation failed')
  }

  const data = await response.json()
  return data.data[0].embedding
}

// ─── Supabase Vector Search ───────────────────────────────────────────────────

async function searchChunks(embedding, env) {
  const supabaseUrl = env.SUPABASE_URL || 'https://tcmahfwhdknxhhdvqpum.supabase.co'
  const supabaseKey = env.SUPABASE_ANON_KEY

  // Call the match_guideline_chunks RPC function defined in the migration
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/match_guideline_chunks`, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query_embedding: embedding,
      match_count: 35,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    console.error('Supabase search error:', response.status, err)
    throw new Error('Guideline search failed')
  }

  return response.json()
}

// ─── Claude Haiku Answer Synthesis ───────────────────────────────────────────

async function synthesizeAnswer(query, chunks, apiKey) {
  // Build context block from the top chunks, labeled by source
  const contextBlock = chunks.map((chunk, i) =>
    `[Source ${i + 1}: ${chunk.lender_name} — ${chunk.product_name}]\n${chunk.chunk_text}`
  ).join('\n\n---\n\n')

  const systemPrompt = `You are a mortgage lending guidelines expert helping loan officers understand lender policies.

Your job:
- Answer the question based ONLY on the provided guideline excerpts
- Use clear markdown formatting: ## headings for major sections, ### for subsections, **bold** for key values
- Use bullet points (- ) when listing requirements, options, or conditions
- Group related information under clear headings (e.g., "## Minimum Loan Amounts", "## Qualification Rules")
- For source citations: put the lender/product name in **bold** at the start of each bullet rather than in brackets at the end. Example: "- **Acra Lending — Investor Cash Flow DSCR**: $100,000 minimum, 660 FICO"
- If excerpts don't contain enough to fully answer, say so clearly and explain what's missing
- Be concise and specific — loan officers use this for real transactions
- Never invent or infer details not present in the excerpts`

  const userMessage = `Question: ${query}

Guideline Excerpts:
${contextBlock}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    console.error('Anthropic API error:', response.status, err)
    throw new Error('Answer synthesis failed')
  }

  const data = await response.json()
  const answer = data.content[0].text

  // Deduplicate sources by lender+product, keeping highest-similarity chunk per product
  const seen = new Set()
  const sources = []
  for (const chunk of chunks) {
    const key = `${chunk.lender_name}|${chunk.product_name}`
    if (!seen.has(key)) {
      seen.add(key)
      sources.push({
        lender_name: chunk.lender_name,
        product_name: chunk.product_name,
        similarity: Math.round((chunk.similarity || 0) * 100),  // as integer percent
        excerpt: chunk.chunk_text.length > 280
          ? chunk.chunk_text.slice(0, 280) + '…'
          : chunk.chunk_text,
      })
    }
  }

  return { answer, sources }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

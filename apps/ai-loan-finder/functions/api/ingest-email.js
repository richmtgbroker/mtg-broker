// functions/api/ingest-email.js
// Cloudflare Pages Function — ingests lender email content into the guideline search system.
//
// v1.0 — Initial build
//
// Flow:
//   POST { subject, body, sender_email (optional) }
//   1. Verify JWT (admin-only: must be rich@mtg.broker or rich@prestonlending.com)
//   2. Send email to Claude to classify: lender name, topic tag, update type, TTL
//   3. Store raw email in lender_updates table
//   4. Supersede old chunks from same lender + topic
//   5. Chunk the email body text
//   6. Generate OpenAI embeddings for each chunk
//   7. Store chunks in guideline_chunks with source_type = 'email_update'
//   8. Mark lender_updates record as processed
//   9. Return { success, lender, topic, chunks_created, superseded_count }
//
// Required env vars (set in Cloudflare Pages dashboard):
//   OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY

const ALLOWED_ORIGINS = [
  'https://mtg.broker',
  'https://www.mtg.broker',
  'https://mtg-app.pages.dev',
  'https://mtg-app-staging.pages.dev',
]

// Admin emails allowed to ingest updates
const ADMIN_EMAILS = ['rich@mtg.broker', 'rich@prestonlending.com']

function isAllowedOrigin(origin) {
  if (!origin) return false
  if (ALLOWED_ORIGINS.includes(origin)) return true
  // Allow Cloudflare Pages preview deployments (random subdomain pattern)
  if (/^https:\/\/[a-f0-9]+\.mtg-app-staging\.pages\.dev$/.test(origin)) return true
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
    const { subject, body: emailBody, sender_email } = body

    if (!subject || !emailBody) {
      return jsonError(request, 'subject and body are required', 400)
    }

    const supabaseUrl = env.SUPABASE_URL || 'https://tcmahfwhdknxhhdvqpum.supabase.co'
    const supabaseKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_ANON_KEY

    // Debug: log which key we're using (first 10 chars only)
    console.log('Supabase key source:', env.SUPABASE_SERVICE_KEY ? 'SERVICE_KEY' : (env.SUPABASE_ANON_KEY ? 'ANON_KEY' : 'NONE'))
    console.log('Supabase URL:', supabaseUrl)

    if (!supabaseKey) {
      return jsonError(request, 'Server misconfiguration: no Supabase key available. Add SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY to Cloudflare Pages env vars.', 500)
    }

    // ── Step 1: Classify the email with Claude ──────────────────────
    console.log('Classifying email:', subject)
    console.log('Anthropic key available:', !!env.ANTHROPIC_API_KEY)
    const classification = await classifyEmail(subject, emailBody, sender_email, env.ANTHROPIC_API_KEY)
    console.log('Classification:', JSON.stringify(classification))

    // If classification hit fallback, include a warning in the response
    if (classification._fallback) {
      console.warn('Classification used fallback — Claude API may have failed:', classification._fallbackReason)
    }

    // ── Step 2: Store raw email in lender_updates ───────────────────
    const updateRecord = {
      lender_name: classification.lender_name,
      sender_email: sender_email || null,
      subject: subject,
      body: emailBody,
      update_type: classification.update_type,
      topic_tag: classification.topic_tag,
      ttl_days: classification.ttl_days,
      processed: false,
    }

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/lender_updates`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(updateRecord),
    })

    if (!insertRes.ok) {
      const err = await insertRes.text()
      console.error('Failed to store lender update:', insertRes.status, err)
      return jsonError(request, 'Failed to store email record: ' + err, 500)
    }

    const [savedUpdate] = await insertRes.json()
    console.log('Stored lender update:', savedUpdate.id)

    // ── Step 3: Supersede old chunks with same lender + topic ───────
    let supersededCount = 0
    if (classification.lender_name && classification.topic_tag) {
      const supersedeRes = await fetch(`${supabaseUrl}/rest/v1/rpc/supersede_email_chunks`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_lender_name: classification.lender_name,
          p_topic_tag: classification.topic_tag,
        }),
      })

      if (supersedeRes.ok) {
        supersededCount = await supersedeRes.json()
        console.log(`Superseded ${supersededCount} old chunks for ${classification.lender_name} / ${classification.topic_tag}`)
      }
    }

    // ── Step 4: Chunk the email text ────────────────────────────────
    // Prepend subject + lender context so each chunk is self-contained
    const contextPrefix = `[Lender Update from ${classification.lender_name || 'Unknown Lender'}] Subject: ${subject}\n\n`
    const fullText = contextPrefix + emailBody
    const chunks = chunkText(fullText, 800, 100) // 800 tokens target, 100 token overlap

    console.log(`Created ${chunks.length} chunks from email`)

    // ── Step 5: Generate embeddings for each chunk ──────────────────
    const embeddings = await generateEmbeddings(chunks, env.OPENAI_API_KEY)

    // ── Step 6: Store chunks in guideline_chunks ────────────────────
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + classification.ttl_days)

    const chunkRecords = chunks.map((chunkText, i) => ({
      lender_name: classification.lender_name || 'Unknown',
      product_name: classification.topic_tag || subject.slice(0, 100),
      chunk_text: chunkText,
      chunk_index: i,
      page_number: null,
      token_count: estimateTokens(chunkText),
      embedding: JSON.stringify(embeddings[i]),
      source_type: 'email_update',
      topic_tag: classification.topic_tag,
      subject: subject,
      source_email: sender_email || null,
      received_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      active: true,
    }))

    const chunkInsertRes = await fetch(`${supabaseUrl}/rest/v1/guideline_chunks`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(chunkRecords),
    })

    if (!chunkInsertRes.ok) {
      const err = await chunkInsertRes.text()
      console.error('Failed to insert chunks:', chunkInsertRes.status, err)
      return jsonError(request, 'Failed to store guideline chunks: ' + err, 500)
    }

    const insertedChunks = await chunkInsertRes.json()
    console.log(`Inserted ${insertedChunks.length} chunks`)

    // ── Step 7: Mark lender_updates as processed ────────────────────
    await fetch(`${supabaseUrl}/rest/v1/lender_updates?id=eq.${savedUpdate.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        processed: true,
        chunks_created: insertedChunks.length,
        processed_at: new Date().toISOString(),
      }),
    })

    // ── Return success ──────────────────────────────────────────────
    const result = {
      success: true,
      lender: classification.lender_name,
      topic: classification.topic_tag,
      update_type: classification.update_type,
      ttl_days: classification.ttl_days,
      chunks_created: insertedChunks.length,
      superseded_count: supersededCount,
      expires_at: expiresAt.toISOString(),
      update_id: savedUpdate.id,
    }

    // Surface classification issues to the caller
    if (classification._fallback) {
      result.warning = 'Classification used fallback defaults — Claude API issue'
      result.fallback_reason = classification._fallbackReason
    }

    return jsonResponse(request, result)

  } catch (err) {
    console.error('Email ingestion error:', err)
    return jsonError(request, 'Internal server error: ' + err.message, 500)
  }
}


// ─── Claude Classification ──────────────────────────────────────────────────
// Asks Claude to identify the lender, topic, update type, and recommended TTL
// from the email subject + body.

async function classifyEmail(subject, body, senderEmail, apiKey) {
  const systemPrompt = `You are a mortgage industry email classifier. You will be given an email from a wholesale lender or account executive. Extract 4 fields as JSON.

RULES FOR EACH FIELD:

1. "lender_name" — The wholesale lender company name. This is CRITICAL — try hard to find it.
   - Check the email subject first (e.g., "UWM — FHA Update" → "UWM")
   - Check the sender email domain (e.g., "@uwm.com" → "UWM", "@angeloakms.com" → "Angel Oak")
   - Check the email body signature block
   - Normalize to the common short name used in the industry:
     UWM, Acra Lending, Angel Oak, NewFi, Kiavi, A&D Mortgage, Deephaven,
     Finance of America, Plaza Home, Flagstar, AmeriHome, Caliber, loanDepot,
     Pennymac, Freedom Mortgage, Rocket Pro TPO, PRMG, Homepoint, etc.
   - Only use "Unknown" as an absolute last resort if the lender truly cannot be identified anywhere.

2. "topic_tag" — A SHORT normalized tag (2-5 words) describing the topic. Examples:
   - "FHA FICO minimum", "VA funding fee", "DSCR pricing", "jumbo LTV limits"
   - "conventional overlays", "bank statement requirements", "ITIN program"
   - "rate special", "pricing promotion", "comp adjustment"
   - "new program launch", "program suspension"
   - Do NOT repeat the lender name in the tag. Do NOT use the full email subject as the tag.

3. "update_type" — One of: "rate_special", "guideline_change", "new_program", "program_suspension", "pricing_promo", "general_announcement"
   - If the email mentions specific guideline changes (FICO, LTV, DTI, eligibility), use "guideline_change"
   - If it mentions temporary rate/pricing specials, use "rate_special" or "pricing_promo"

4. "ttl_days" — How many days this info stays relevant:
   - rate_special / pricing_promo: 7-14 days
   - guideline_change: 90 days
   - new_program: 90 days
   - program_suspension / discontinuation: 90 days
   - general_announcement: 30 days

Return ONLY a valid JSON object. No markdown fences, no explanation, no extra text.`

  const userMessage = `Email subject: ${subject}
Sender: ${senderEmail || 'unknown'}

Email body:
${body.slice(0, 4000)}`  // Cap at 4000 chars to stay within token budget

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    console.error('Classification API error:', response.status, err)
    return {
      lender_name: 'Unknown',
      topic_tag: subject.slice(0, 50).toLowerCase(),
      update_type: 'general_announcement',
      ttl_days: 30,
      _fallback: true,
      _fallbackReason: `Anthropic API returned ${response.status}: ${err.slice(0, 200)}`,
    }
  }

  const data = await response.json()
  const text = data.content[0].text.trim()
  console.log('Claude raw classification response:', text)

  try {
    // Parse Claude's JSON response — handle markdown fences if Claude wraps it
    let jsonStr = text
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }
    const parsed = JSON.parse(jsonStr)
    return {
      lender_name: parsed.lender_name || 'Unknown',
      topic_tag: parsed.topic_tag || subject.slice(0, 50).toLowerCase(),
      update_type: parsed.update_type || 'general_announcement',
      ttl_days: parsed.ttl_days || 30,
    }
  } catch (e) {
    console.error('Failed to parse classification JSON:', text, 'Error:', e.message)
    return {
      lender_name: 'Unknown',
      topic_tag: subject.slice(0, 50).toLowerCase(),
      update_type: 'general_announcement',
      ttl_days: 30,
    }
  }
}


// ─── Text Chunking ──────────────────────────────────────────────────────────
// Splits text into overlapping chunks by approximate token count.
// Uses paragraph boundaries when possible for cleaner splits.

function chunkText(text, targetTokens = 800, overlapTokens = 100) {
  const paragraphs = text.split(/\n\s*\n/)  // Split on blank lines
  const chunks = []
  let currentChunk = ''
  let currentTokens = 0

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para)

    // If a single paragraph is bigger than the target, split it by sentences
    if (paraTokens > targetTokens) {
      // Flush current chunk first
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim())
        // Keep overlap from end of current chunk
        const overlapText = getLastNTokens(currentChunk, overlapTokens)
        currentChunk = overlapText
        currentTokens = estimateTokens(overlapText)
      }
      // Split the big paragraph by sentences
      const sentences = para.match(/[^.!?]+[.!?]+\s*/g) || [para]
      for (const sentence of sentences) {
        const sentTokens = estimateTokens(sentence)
        if (currentTokens + sentTokens > targetTokens && currentChunk.trim()) {
          chunks.push(currentChunk.trim())
          const overlapText = getLastNTokens(currentChunk, overlapTokens)
          currentChunk = overlapText
          currentTokens = estimateTokens(overlapText)
        }
        currentChunk += sentence
        currentTokens += sentTokens
      }
      continue
    }

    // Normal case: add paragraph to current chunk
    if (currentTokens + paraTokens > targetTokens && currentChunk.trim()) {
      chunks.push(currentChunk.trim())
      // Keep overlap from the end of the current chunk
      const overlapText = getLastNTokens(currentChunk, overlapTokens)
      currentChunk = overlapText + '\n\n'
      currentTokens = estimateTokens(overlapText)
    }
    currentChunk += (currentChunk ? '\n\n' : '') + para
    currentTokens += paraTokens
  }

  // Don't forget the last chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  // If no chunks were created (very short email), use the whole text
  if (chunks.length === 0) {
    chunks.push(text.trim())
  }

  return chunks
}

// Rough token estimate: ~4 chars per token for English text
function estimateTokens(text) {
  return Math.ceil((text || '').length / 4)
}

// Get approximately the last N tokens of text
function getLastNTokens(text, n) {
  const charCount = n * 4
  if (text.length <= charCount) return text
  return text.slice(-charCount)
}


// ─── OpenAI Embeddings ──────────────────────────────────────────────────────
// Batch-generates embeddings for multiple chunks in a single API call.

async function generateEmbeddings(chunks, apiKey) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: chunks,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    console.error('OpenAI embedding error:', response.status, err)
    throw new Error('Embedding generation failed')
  }

  const data = await response.json()
  // OpenAI returns embeddings in the same order as input
  return data.data.map(d => d.embedding)
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

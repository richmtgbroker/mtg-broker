// functions/api/guideline-search.js
// Cloudflare Pages Function — semantic search through lender PDF guidelines.
//
// NEW endpoint — does NOT modify or replace the existing /api/search endpoint.
//
// Flow:
//   POST { query: "Which lenders allow gift funds on investment properties?" }
//   1. Generate embedding for the query (OpenAI text-embedding-3-small)
//   2. Query Supabase pgvector for the 20 most similar guideline chunks
//   3. Send query + chunks to Claude Haiku to synthesize a cited answer
//   4. Return { answer, sources, query }
//
// Required env vars (set in Cloudflare Pages dashboard + .dev.vars):
//   OPENAI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, ANTHROPIC_API_KEY

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://mtg.broker',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

// Main handler
export async function onRequestPost(context) {
  const { request, env } = context

  try {
    const body = await request.json()
    const { query } = body

    if (!query || typeof query !== 'string' || !query.trim()) {
      return jsonError('query is required', 400)
    }

    const queryText = query.trim()

    // Step 1: Generate embedding for the user's question
    const embedding = await generateEmbedding(queryText, env.OPENAI_API_KEY)

    // Step 2: Search Supabase for the most relevant guideline chunks
    const chunks = await searchChunks(embedding, env)

    // If no chunks exist yet (PDFs not processed), return a helpful message
    if (!chunks || chunks.length === 0) {
      return jsonResponse({
        answer: 'No guideline documents have been indexed yet. Run the PDF processing script (`node scripts/process-pdfs.js --limit 5`) to start indexing lender guidelines.',
        sources: [],
        query: queryText,
      })
    }

    // Step 3: Synthesize an answer with Claude Haiku, citing sources
    const { answer, sources } = await synthesizeAnswer(queryText, chunks, env.ANTHROPIC_API_KEY)

    return jsonResponse({ answer, sources, query: queryText })

  } catch (err) {
    console.error('Guideline search error:', err)
    return jsonError(err.message || 'Internal server error', 500)
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
    throw new Error(`OpenAI embedding error (${response.status}): ${err}`)
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
      match_count: 20,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Supabase search error (${response.status}): ${err}`)
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
- Cite sources inline as [Lender Name — Product Name] for every specific claim
- Use bullet points when listing requirements, options, or conditions
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
    throw new Error(`Anthropic API error (${response.status}): ${err}`)
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

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function jsonError(message, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

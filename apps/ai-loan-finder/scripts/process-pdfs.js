// scripts/process-pdfs.js
// Downloads lender PDF matrix documents from Airtable, extracts text,
// chunks it, generates OpenAI embeddings, and stores them in Supabase.
//
// Usage:
//   node scripts/process-pdfs.js              # Process all unprocessed PDFs
//   node scripts/process-pdfs.js --limit 5    # Test with 5 records first
//
// Required env vars (loaded from .dev.vars automatically, or set manually):
//   AIRTABLE_API_KEY  — Airtable personal access token
//   OPENAI_API_KEY    — OpenAI API key (for text-embedding-3-small)
//   SUPABASE_SERVICE_KEY — Supabase service role key (write access)
//   SUPABASE_URL      — Supabase project URL (optional, defaults to project URL)

import { createRequire } from 'module'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ─── Load env vars ─────────────────────────────────────────────────────────
// Try .dev.vars first (Cloudflare local dev format = same as .env syntax),
// then fall back to process.env (if vars are set in the shell).
const devVarsPath = join(__dirname, '..', '.dev.vars')
if (existsSync(devVarsPath)) {
  const lines = readFileSync(devVarsPath, 'utf8').split('\n')
  for (const line of lines) {
    const match = line.match(/^([A-Z0-9_]+)=(.+)$/)
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim()
    }
  }
  console.log('Loaded env vars from .dev.vars')
}

// Use createRequire to import pdf-parse (CommonJS) from ESM context.
// The direct lib path avoids pdf-parse's test file loading issue.
const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse/lib/pdf-parse.js')

// ─── Config ────────────────────────────────────────────────────────────────

const AIRTABLE_BASE_ID = 'appuJgI9X93OLaf0u'
const AIRTABLE_TABLE_ID = 'tblVSU5z4WSxreX7l'
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tcmahfwhdknxhhdvqpum.supabase.co'

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

// Validate required env vars
const missing = []
if (!AIRTABLE_API_KEY) missing.push('AIRTABLE_API_KEY')
if (!OPENAI_API_KEY) missing.push('OPENAI_API_KEY')
if (!SUPABASE_SERVICE_KEY) missing.push('SUPABASE_SERVICE_KEY')
if (missing.length > 0) {
  console.error(`ERROR: Missing required env vars: ${missing.join(', ')}`)
  console.error('Add them to apps/ai-loan-finder/.dev.vars or set in your shell.')
  process.exit(1)
}

// Parse --limit flag (e.g. node process-pdfs.js --limit 5)
const limitIdx = process.argv.indexOf('--limit')
const LIMIT = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1], 10) : null

// ─── Chunking ──────────────────────────────────────────────────────────────
// Target ~600 tokens per chunk (~2400 chars), with ~100 token overlap (~400 chars).
// We try to break at paragraph/sentence boundaries to preserve context.

const CHUNK_SIZE = 2400
const OVERLAP = 400

function chunkText(text, recordId, lenderName, productName) {
  // Normalize whitespace but preserve paragraph breaks
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const chunks = []
  let start = 0
  let chunkIndex = 0

  while (start < normalized.length) {
    let end = start + CHUNK_SIZE

    // Try to break at a natural boundary (paragraph > sentence > word)
    if (end < normalized.length) {
      const searchFrom = start + Math.floor(CHUNK_SIZE * 0.6) // don't break too early
      const candidates = [
        normalized.lastIndexOf('\n\n', end),
        normalized.lastIndexOf('\n', end),
        normalized.lastIndexOf('. ', end),
        normalized.lastIndexOf('! ', end),
        normalized.lastIndexOf('? ', end),
        normalized.lastIndexOf(' ', end),
      ]
      const best = candidates.filter(p => p >= searchFrom).reduce((a, b) => Math.max(a, b), -1)
      if (best > searchFrom) end = best + 1
    }

    const chunkText = normalized.slice(start, end).trim()

    // Skip chunks that are too short to be meaningful
    if (chunkText.length >= 100) {
      chunks.push({
        airtable_record_id: recordId,
        lender_name: lenderName,
        product_name: productName,
        chunk_text: chunkText,
        chunk_index: chunkIndex,
        token_count: Math.ceil(chunkText.length / 4),
        page_number: null, // pdf-parse doesn't give per-chunk page numbers easily
      })
      chunkIndex++
    }

    start = end - OVERLAP
    if (start >= normalized.length) break
  }

  return chunks
}

// ─── OpenAI Embeddings ─────────────────────────────────────────────────────

// Generate embeddings for up to 100 texts at a time (well within OpenAI's limits)
async function generateEmbeddings(texts) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: texts,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI error (${response.status}): ${err}`)
  }

  const data = await response.json()
  // Sort by index in case OpenAI returns them out of order
  return data.data
    .sort((a, b) => a.index - b.index)
    .map(item => item.embedding)
}

// ─── Supabase ──────────────────────────────────────────────────────────────

// Upsert chunks to Supabase (on conflict: update existing row)
async function upsertChunksToSupabase(chunksWithEmbeddings) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/guideline_chunks?on_conflict=airtable_record_id,chunk_index`,
    {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(chunksWithEmbeddings),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Supabase upsert error (${response.status}): ${err}`)
  }
}

// Get the set of airtable_record_ids that already have chunks in Supabase
async function getAlreadyProcessedIds() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/guideline_chunks?select=airtable_record_id`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    }
  )

  if (!response.ok) {
    console.warn('Could not fetch processed IDs, will process all records')
    return new Set()
  }

  const rows = await response.json()
  return new Set(rows.map(r => r.airtable_record_id))
}

// ─── Airtable ──────────────────────────────────────────────────────────────

// Fetch all Airtable records that have a "Matrix Document" PDF attachment
async function fetchAirtableRecords() {
  const allRecords = []
  let offset = null
  let page = 1

  console.log('Fetching records from Airtable...')

  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`)
    url.searchParams.set('pageSize', '100')
    // Only fetch the fields we need (reduces response size)
    url.searchParams.append('fields[]', 'Lender Product Name | Version')
    url.searchParams.append('fields[]', 'Lender Name (from Lender Name)')
    url.searchParams.append('fields[]', 'Matrix Document')
    if (offset) url.searchParams.set('offset', offset)

    const response = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` },
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Airtable error (${response.status}): ${err}`)
    }

    const data = await response.json()
    const records = (data.records || []).filter(r => {
      const attachments = r.fields['Matrix Document']
      return Array.isArray(attachments) && attachments.some(a => a.filename?.toLowerCase().endsWith('.pdf'))
    })

    allRecords.push(...records)
    console.log(`  Page ${page}: ${records.length} records with PDFs (running total: ${allRecords.length})`)

    offset = data.offset || null
    page++

    // Small delay to avoid Airtable rate limits
    if (offset) await sleep(200)
  } while (offset)

  return allRecords
}

// ─── PDF Processing ────────────────────────────────────────────────────────

// Download a PDF from a URL and extract its text
async function extractTextFromPdfUrl(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download PDF (${response.status})`)

  const buffer = await response.arrayBuffer()
  const data = await pdfParse(Buffer.from(buffer))
  return data.text
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60))
  console.log('PDF GUIDELINE PROCESSOR')
  console.log('='.repeat(60))
  if (LIMIT) console.log(`TEST MODE: Processing at most ${LIMIT} records`)
  console.log(`Supabase: ${SUPABASE_URL}`)
  console.log('')

  // Step 1: Fetch all Airtable records with PDF attachments
  let records = await fetchAirtableRecords()
  console.log(`\nTotal Airtable records with PDFs: ${records.length}`)

  // Step 2: Skip records already in Supabase
  console.log('Checking which records are already processed...')
  const processedIds = await getAlreadyProcessedIds()
  const unprocessed = records.filter(r => !processedIds.has(r.id))
  console.log(`Already processed: ${processedIds.size} | Remaining: ${unprocessed.length}`)

  // Apply --limit
  const toProcess = LIMIT ? unprocessed.slice(0, LIMIT) : unprocessed

  if (toProcess.length === 0) {
    console.log('\n✓ All records already processed! Nothing to do.')
    return
  }

  console.log(`\nProcessing ${toProcess.length} records...\n`)

  let totalChunks = 0
  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < toProcess.length; i++) {
    const record = toProcess[i]
    const fields = record.fields
    const productName = fields['Lender Product Name | Version'] || 'Unknown Product'
    const lenderArr = fields['Lender Name (from Lender Name)']
    const lenderName = Array.isArray(lenderArr) ? lenderArr[0] : (lenderArr || 'Unknown Lender')
    const attachments = fields['Matrix Document'] || []

    console.log(`[${i + 1}/${toProcess.length}] ${lenderName} — ${productName}`)

    let recordChunks = 0

    for (const attachment of attachments) {
      if (!attachment.filename?.toLowerCase().endsWith('.pdf')) {
        console.log(`  Skipping non-PDF: ${attachment.filename}`)
        continue
      }

      try {
        // Download and extract text
        process.stdout.write(`  ↓ Downloading ${attachment.filename}... `)
        const text = await extractTextFromPdfUrl(attachment.url)
        console.log(`${text.length.toLocaleString()} chars extracted`)

        // Chunk the text
        const chunks = chunkText(text, record.id, lenderName, productName)
        console.log(`  ✂ ${chunks.length} chunks created`)

        if (chunks.length === 0) {
          console.log('  ⚠ No usable text found in PDF, skipping')
          continue
        }

        // Generate embeddings in batches of 100
        process.stdout.write(`  ⚡ Generating embeddings... `)
        const EMBED_BATCH = 100
        const chunksWithEmbeddings = []

        for (let b = 0; b < chunks.length; b += EMBED_BATCH) {
          const batch = chunks.slice(b, b + EMBED_BATCH)
          const embeddings = await generateEmbeddings(batch.map(c => c.chunk_text))
          for (let j = 0; j < batch.length; j++) {
            chunksWithEmbeddings.push({ ...batch[j], embedding: embeddings[j] })
          }
          // Small delay between embedding batches to avoid rate limits
          if (b + EMBED_BATCH < chunks.length) await sleep(500)
        }
        console.log('done')

        // Upsert to Supabase
        process.stdout.write(`  ↑ Upserting ${chunksWithEmbeddings.length} chunks to Supabase... `)
        await upsertChunksToSupabase(chunksWithEmbeddings)
        console.log('done')

        recordChunks += chunks.length
        totalChunks += chunks.length

      } catch (err) {
        console.error(`  ✗ ERROR: ${err.message}`)
        errorCount++
      }
    }

    if (recordChunks > 0) {
      console.log(`  ✓ ${recordChunks} chunks stored\n`)
      successCount++
    } else {
      console.log('  — No chunks stored for this record\n')
    }
  }

  // Summary
  console.log('='.repeat(60))
  console.log('DONE')
  console.log('='.repeat(60))
  console.log(`Records processed successfully: ${successCount}`)
  console.log(`Records with errors:            ${errorCount}`)
  console.log(`Total chunks stored:            ${totalChunks}`)

  if (totalChunks > 0) {
    console.log('')
    console.log('⚠️  IMPORTANT: Rebuild the IVFFlat index for best search performance.')
    console.log('   Run this SQL in the Supabase dashboard → SQL Editor:')
    console.log('   REINDEX INDEX guideline_chunks_embedding_idx;')
  }

  if (LIMIT) {
    console.log('')
    console.log(`(Ran with --limit ${LIMIT}. Run without --limit to process all remaining records.)`)
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

main().catch(err => {
  console.error('\nFATAL ERROR:', err.message)
  process.exit(1)
})

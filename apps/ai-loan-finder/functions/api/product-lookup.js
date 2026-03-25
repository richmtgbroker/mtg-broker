// Cloudflare Pages Function — look up a loan product by product_name + lender_name
// Used by the Search Guidelines tab to open the product detail modal for a source.

const ALLOWED_ORIGINS = ['https://mtg.broker', 'https://www.mtg.broker']

function getCorsHeaders(request) {
  const origin = request ? request.headers.get('Origin') : null
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request) })
}

export async function onRequestPost(context) {
  const { request, env } = context

  try {
    const { product_name, lender_name } = await request.json()
    if (!product_name) {
      return jsonResponse(request, { error: 'product_name is required' }, 400)
    }

    const supabaseUrl = env.SUPABASE_URL || 'https://tcmahfwhdknxhhdvqpum.supabase.co'
    const supabaseKey = env.SUPABASE_ANON_KEY
    if (!supabaseKey) throw new Error('SUPABASE_ANON_KEY not configured')

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
      throw new Error(`Supabase error (${resp.status}): ${err}`)
    }

    const products = await resp.json()
    return jsonResponse(request, { product: products[0] || null })

  } catch (err) {
    console.error('Product lookup error:', err)
    return jsonResponse(request, { error: err.message || 'Lookup failed' }, 500)
  }
}

function jsonResponse(request, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' },
  })
}

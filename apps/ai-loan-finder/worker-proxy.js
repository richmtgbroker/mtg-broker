// Cloudflare Worker to proxy /app/ai-search/* to the Pages deployment
// Deploy this as 'mtg-broker-ai-search-proxy'

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Strip /app/ai-search prefix from the path
    let path = url.pathname.replace(/^\/app\/ai-search/, '') || '/';

    // Build the target URL to the Pages deployment
    const targetUrl = `https://mtg-loan-finder.pages.dev${path}${url.search}`;

    // Create a new request with the same method, headers, and body
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'follow'
    });

    // Fetch from the Pages deployment
    const response = await fetch(proxyRequest);

    // Return the response with CORS headers if needed
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  }
};

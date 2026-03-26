// Serves /robots.txt — allows public pages, disallows app pages
export function loader() {
  const content = `User-agent: *
Allow: /
Allow: /pricing
Allow: /privacy-policy
Allow: /terms-of-service
Disallow: /app/
Disallow: /login
Disallow: /admin-hub

Sitemap: https://mtg.broker/sitemap.xml
`;

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

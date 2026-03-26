// Serves /sitemap.xml — lists all public pages
export function loader() {
  const baseUrl = "https://mtg.broker";
  const pages = [
    { url: "/", priority: "1.0", changefreq: "weekly" },
    { url: "/pricing", priority: "0.9", changefreq: "monthly" },
    { url: "/privacy-policy", priority: "0.3", changefreq: "yearly" },
    { url: "/terms-of-service", priority: "0.3", changefreq: "yearly" },
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (p) => `  <url>
    <loc>${baseUrl}${p.url}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

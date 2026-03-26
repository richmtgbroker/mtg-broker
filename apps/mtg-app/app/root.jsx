import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import "./app.css";

export function meta() {
  return [
    { title: "MtgBroker — Mortgage Broker Tools" },
    { name: "description", content: "Find wholesale loan products, manage lender relationships, and run your business more efficiently." },
    { name: "theme-color", content: "#2563eb" },
  ];
}

export function links() {
  return [
    // Host Grotesk font
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
    { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Host+Grotesk:wght@300;400;500;600;700;800&display=swap" },
    // Font Awesome (used by AI Loan Finder, Settings, Pipeline)
    { rel: "stylesheet", href: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" },
    // Favicon
    { rel: "icon", href: "https://cdn.prod.website-files.com/694e4aaf5f511ad7901b74bc/69b4d53aa7b7dc239acc2e95_MtgBroker_Favicon_Adaptive.svg", type: "image/svg+xml" },
    // PWA
    { rel: "manifest", href: "https://mtg-broker-api.rich-e00.workers.dev/manifest.json" },
    { rel: "apple-touch-icon", href: "https://i.ibb.co/Rkg1kd76/web-app-manifest-192x192.png" },
  ];
}

export default function Root() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="MtgBroker" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />

        {/* Outseta Authentication SDK */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              var o_options = {
                domain: 'mtgbroker.outseta.com',
                load: 'auth,customForm,emailList,leadCapture,nocode,profile,support',
                tokenStorage: 'local'
              };
            `,
          }}
        />
        <script src="https://cdn.outseta.com/outseta.min.js" data-options="o_options" />

        {/* Rewardful Referral Tracking */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,r){w._rwq=r;w[r]=w[r]||function(){(w[r].q=w[r].q||[]).push(arguments)}})(window,'rewardful');`,
          }}
        />
        <script async src="https://r.wdfl.co/rw.js" data-rewardful="a3ca66" />
      </body>
    </html>
  );
}

export function ErrorBoundary({ error }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <div style={{ padding: "40px", textAlign: "center", fontFamily: "Host Grotesk, system-ui, sans-serif" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "12px" }}>Something went wrong</h1>
          <p style={{ color: "#64748B" }}>Please try refreshing the page.</p>
        </div>
        <Scripts />
      </body>
    </html>
  );
}

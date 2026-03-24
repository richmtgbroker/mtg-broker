# Social Media Graphics Generator — App-Specific Details

> This app lives inside the mtg-broker monorepo at `apps/social-media/`.
> See the root `CLAUDE.md` for platform-wide docs (tech stack, services, design system).

## What This App Does

Lets loan officers create professional, branded social media graphics (Just Closed, Rate Update, Testimonial, Mortgage Tips, New Listing templates). Users pick a template, customize colors/fonts/branding, enter data, and download PNG images in Instagram/Facebook/Story sizes. Includes a post caption generator.

## Architecture

```
User visits mtg.broker/app/social-media (Webflow page, Outseta-gated)
  → Webflow renders: Navbar_App + Sidebar_App + [mount div] + Footer_App
  → Cloudflare Pages bundle (index.js) loads into <div id="social-media-app">
    → Bundle injects CSS + HTML UI into mount point
    → Bundle loads SMG canvas engine from Cloudflare Worker
  → SMG engine handles canvas rendering, downloads, captions
```

## Key Files

- `src/main.js` — Entry point: injects HTML + CSS, loads engine script
- `src/styles.css` — All UI styles (inlined into JS bundle by Vite)
- `vite.config.js` — IIFE build config (single output file, no hash)
- `public/_headers` — Cloudflare Pages cache headers
- `index.html` — Local dev entry point only (not deployed)

## External Dependencies

- **SMG Canvas Engine**: Served from Cloudflare Worker at `mtg-broker-social-media.rich-e00.workers.dev/static/social-media.js`
  - The engine handles all canvas rendering, template logic, image compositing, and download functionality
  - Engine version is tracked in `main.js` as `ENGINE_VERSION`
- **Font Awesome**: Icons loaded from CDN (already on the Webflow page)
- **Host Grotesk**: Font loaded from Google Fonts (already on the Webflow page)

## Deployment

### Build
```bash
cd apps/social-media
npm install
npm run build
```
Output goes to `dist/`:
- `dist/index.js` — everything bundled (JS + CSS inlined), fixed filename
- `dist/_headers` — copied from `public/_headers`

### Deploy to Cloudflare Pages
```bash
npx wrangler pages deploy dist --project-name mtg-social-media
```
- Bundle URL (permanent): `https://mtg-social-media.pages.dev/index.js`
- Cache headers: `public, max-age=300, stale-while-revalidate=3600`

> No Webflow step needed after initial embed setup. Deploy = build + push to Cloudflare Pages.

## Webflow Page Structure

The page at `/app/social-media` has this structure:
```
Body
├── Navbar_App (component)
├── Sidebar_App (component)
├── Div Block [style: main-content-section]
│   └── HtmlEmbed (loads this bundle)
└── Footer_App (component)
```

## HtmlEmbed Code (set once in Webflow, never changes)

```html
<div id="social-media-app"></div>
<script>
  (function() {
    var s = document.createElement('script');
    s.src = 'https://mtg-social-media.pages.dev/index.js';
    s.defer = true;
    document.head.appendChild(s);
  })();
</script>
```

## What This App Does NOT Handle

Handled by Webflow and Outseta — do NOT add to this app:
- Navbar / navigation
- Sidebar
- Footer
- Login prompt / auth gating
- Font Awesome / Google Fonts loading (already on the Webflow page)

## Updating the Engine

When the SMG canvas engine is updated on the Worker:
1. Deploy the new engine to the Worker (`mtg-broker-social-media`)
2. Update `ENGINE_VERSION` in `src/main.js`
3. Rebuild and deploy: `npm run build && npx wrangler pages deploy dist --project-name mtg-social-media`

## What Changed from the Embed-Based Version

Previously, the Social Media page had code in 3 Webflow locations:
- **Page Head CSS** (~204 lines) → Now in `src/styles.css`, inlined into JS bundle
- **HTML Embed** (~419 lines) → Now in `src/main.js` as template, injected at runtime
- **Before Body JS** (1 script tag) → Replaced by the Cloudflare Pages bundle loader

Now there's only **one small HtmlEmbed** in Webflow (5 lines). All CSS, HTML, and engine loading is handled by the Cloudflare Pages bundle.

### Webflow Cleanup After Migration
Remove from the Social Media page in Webflow:
- [ ] Page Settings → Head Code (delete the CSS)
- [ ] Page Settings → Before `</body>` Code (delete the engine loader script)
- [ ] Update the HTML Embed to the new 5-line loader (replaces the ~419 line embed)

# Settings App

React app for the mtg.broker Settings page (`/app/settings`).

## What It Does

- Displays and edits broker profile (name, email, phone, job title, NMLS #)
- Manages company info (name, address)
- Manages preferred links (Pricing Engine, CRM, LOS, POS) with favicon preview
- Uploads/removes profile avatar and company logo (via Cloudflare R2)
- Saves profile fields to Outseta and extended data to Airtable broker profile
- Session cache for fast page revisits

## Tech

- **Framework**: Vite + React (IIFE build, CSS inlined)
- **Hosted**: Cloudflare Pages at `mtg-settings.pages.dev`
- **API**: Calls existing `mtg-broker-api.rich-e00.workers.dev` worker
- **Auth**: Outseta (JWT from localStorage, user object from `window.Outseta`)
- **No backend functions** — uses the shared broker-profile API worker

## Storage Map

| Field | Storage |
|-------|---------|
| Profile Picture | Cloudflare R2 via `/api/broker-profile/avatar` |
| Job Title | Outseta `user.Title` |
| NMLS # | Outseta `user.NmlsNumber` (custom property) |
| Company Name | Outseta `user.CompanyName` (custom property) |
| Company Address | Airtable Broker Profiles table (JSON) |
| Company Logo | Cloudflare R2 via `/api/broker-profile/logo` |
| Disclaimer Text | Airtable Broker Profiles table (JSON) |
| Preferred Links | Airtable Broker Profiles table (JSON) |

## Build & Deploy

```bash
cd apps/settings
npm install
npm run build          # outputs dist/index.js
npx wrangler pages deploy dist --project-name mtg-settings
```

## Fixed URLs

- **Production bundle**: `https://mtg-settings.pages.dev/index.js`
- **Webflow page**: `mtg.broker/app/settings`

## Webflow Embed

The Webflow HtmlEmbed on `/app/settings` contains:

```html
<div id="settings-app"></div>
<script>
  (function() {
    var s = document.createElement('script');
    s.src = 'https://mtg-settings.pages.dev/index.js';
    s.defer = true;
    document.head.appendChild(s);
  })();
</script>
```

The `<style>` tag in Page Settings > Head Code can be **removed** — all CSS is now inlined in the JS bundle.

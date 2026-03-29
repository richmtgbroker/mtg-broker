import { createRequestHandler } from "react-router";
import * as serverBuild from "./build/server/index.js";

const requestHandler = createRequestHandler(serverBuild);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Try serving static assets first via Cloudflare Pages asset binding.
    // This handles /assets/*.js, /assets/*.css, /favicon.ico, etc.
    try {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        return assetResponse;
      }
    } catch (e) {
      // ASSETS binding not available or failed — fall through to SSR
    }

    // API proxy routes — forward to external Workers to avoid CORS issues.
    // These Workers don't have proper CORS for *.pages.dev origins,
    // so we proxy through the same-origin _worker.js instead.
    if (url.pathname.startsWith("/api/contacts")) {
      const target = "https://mtg-broker-contacts.rich-e00.workers.dev" + url.pathname + url.search;
      const proxyHeaders = { "Content-Type": "application/json" };
      const auth = request.headers.get("Authorization");
      if (auth) proxyHeaders["Authorization"] = auth;
      const res = await fetch(target, { method: request.method, headers: proxyHeaders });
      return new Response(await res.text(), { status: res.status, headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname.startsWith("/api/vendors")) {
      const target = "https://mtg-broker-vendors.rich-e00.workers.dev" + url.pathname + url.search;
      const proxyHeaders = { "Content-Type": "application/json" };
      const auth = request.headers.get("Authorization");
      if (auth) proxyHeaders["Authorization"] = auth;
      const res = await fetch(target, { method: request.method, headers: proxyHeaders });
      return new Response(await res.text(), { status: res.status, headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname.startsWith("/api/calculator-scenarios")) {
      const target = "https://mtg-broker-api.rich-e00.workers.dev" + url.pathname + url.search;
      const proxyHeaders = { "Content-Type": "application/json" };
      const auth = request.headers.get("Authorization");
      if (auth) proxyHeaders["Authorization"] = auth;
      const init = { method: request.method, headers: proxyHeaders };
      if (request.method === "POST" || request.method === "PUT") {
        init.body = await request.text();
      }
      const res = await fetch(target, init);
      return new Response(await res.text(), { status: res.status, headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname.startsWith("/api/lenders")) {
      const target = "https://mtg-broker-pipeline.rich-e00.workers.dev" + url.pathname + url.search;
      const proxyHeaders = { "Content-Type": "application/json" };
      const auth = request.headers.get("Authorization");
      if (auth) proxyHeaders["Authorization"] = auth;
      const res = await fetch(target, { method: request.method, headers: proxyHeaders });
      return new Response(await res.text(), { status: res.status, headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname.startsWith("/api/pipeline")) {
      const target = "https://mtg-broker-pipeline.rich-e00.workers.dev" + url.pathname + url.search;
      const proxyHeaders = { "Content-Type": "application/json" };
      const auth = request.headers.get("Authorization");
      if (auth) proxyHeaders["Authorization"] = auth;
      const init = { method: request.method, headers: proxyHeaders };
      if (request.method === "POST" || request.method === "PUT") {
        init.body = await request.text();
      }
      const res = await fetch(target, init);
      return new Response(await res.text(), { status: res.status, headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname.startsWith("/api/favorites")) {
      const target = "https://mtg-broker-favorites.rich-e00.workers.dev" + url.pathname + url.search;
      const proxyHeaders = { "Content-Type": "application/json" };
      const auth = request.headers.get("Authorization");
      if (auth) proxyHeaders["Authorization"] = auth;
      const init = { method: request.method, headers: proxyHeaders };
      if (request.method === "POST" || request.method === "PUT") {
        init.body = await request.text();
      }
      const res = await fetch(target, init);
      return new Response(await res.text(), { status: res.status, headers: { "Content-Type": "application/json" } });
    }

    // Not a static asset or API proxy — handle via React Router SSR
    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
};

import { createRequestHandler } from "react-router";
import * as serverBuild from "./build/server/index.js";

const requestHandler = createRequestHandler(serverBuild);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // API proxy routes FIRST — check before static assets so POST requests
    // to /api/* don't get blocked by the ASSETS binding returning 405.
    // (ASSETS.fetch returns 405 for POST requests instead of 404.)
    // These Workers don't have proper CORS for *.pages.dev origins,
    // so we proxy through the same-origin _worker.js instead.
    if (url.pathname.startsWith("/api/contact-edit")) {
      const target = "https://mtg-broker-contact-edit.rich-e00.workers.dev" + url.pathname + url.search;
      // For file uploads (/upload), pass through original content-type and body as-is
      const isUpload = url.pathname.endsWith("/upload");
      const proxyHeaders = {};
      const contentType = request.headers.get("Content-Type");
      if (contentType) proxyHeaders["Content-Type"] = contentType;
      const auth = request.headers.get("Authorization");
      if (auth) proxyHeaders["Authorization"] = auth;
      const init = { method: request.method, headers: proxyHeaders };
      if (request.method === "POST" || request.method === "PUT") {
        init.body = isUpload ? request.body : await request.text();
        // Duplex required for streaming body in Workers
        if (isUpload) init.duplex = "half";
      }
      const res = await fetch(target, init);
      return new Response(await res.text(), { status: res.status, headers: { "Content-Type": "application/json" } });
    }
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

    // Try serving static assets (after API routes, so POST /api/* doesn't get 405'd)
    try {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        return assetResponse;
      }
    } catch (e) {
      // ASSETS binding not available or failed — fall through to SSR
    }

    // Not a static asset or API proxy — handle via React Router SSR
    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
};

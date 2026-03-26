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

    // Not a static asset — handle via React Router SSR
    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
};

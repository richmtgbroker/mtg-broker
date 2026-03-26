// Post-build script: bundles the React Router server build into a Cloudflare Pages _worker.js
import { build } from "esbuild";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [join(__dirname, "_worker-entry.js")],
  bundle: true,
  outfile: join(__dirname, "build/client/_worker.js"),
  format: "esm",
  platform: "browser",
  target: "es2022",
  conditions: ["workerd", "worker", "browser"],
  minify: false,
  logLevel: "info",
  external: [],
});

console.log("✓ _worker.js bundled into build/client/");

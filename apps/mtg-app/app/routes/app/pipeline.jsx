import { useState, useEffect } from "react";

export function meta() {
  return [{ title: "Pipeline — MtgBroker" }];
}

// The Pipeline is a 13K-line Cloudflare Worker app (v8.7) with full CRUD for
// loans, tasks, calculators, documents, and more. It's embedded here via iframe
// until a full React conversion is done. The Worker handles its own auth via
// Outseta JWT from localStorage.
const PIPELINE_URL = "https://mtg-broker-pipeline.rich-e00.workers.dev/app";

export default function PipelinePage() {
  const [token, setToken] = useState(null);

  // Pass the Outseta JWT to the iframe via URL param so the Worker can authenticate
  useEffect(() => {
    try {
      const t = localStorage.getItem("Outseta.nocode.accessToken");
      setToken(t);
    } catch (e) {
      // localStorage not available (SSR)
    }
  }, []);

  // Build iframe URL with token param
  const iframeUrl = token
    ? `${PIPELINE_URL}?token=${encodeURIComponent(token)}`
    : PIPELINE_URL;

  return (
    <div style={{ margin: "-24px -32px 0", height: "calc(100vh - 77px)" }}>
      <iframe
        src={iframeUrl}
        title="Pipeline"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
        }}
        allow="clipboard-write"
      />
    </div>
  );
}

import { useEffect, useRef } from "react";

export function meta() {
  return [{ title: "Social Media Graphics — MtgBroker" }];
}

// The Social Media Graphics Generator is a vanilla JS app that injects its own
// HTML/CSS and loads an external canvas engine from a Cloudflare Worker.
// It uses global `SMG.*` functions for onclick handlers.
// We load the existing Cloudflare Pages bundle into a mount div.
const BUNDLE_URL = "https://mtg-social-media.pages.dev/index.js";

export default function SocialMediaPage() {
  const mountRef = useRef(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    // Only load once
    if (loadedRef.current) return;
    loadedRef.current = true;

    // The bundle expects a <div id="social-media-app"> to mount into.
    // It injects CSS + HTML + loads the engine script.
    const script = document.createElement("script");
    script.src = BUNDLE_URL;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      // Cleanup on unmount — remove the script tag
      script.remove();
    };
  }, []);

  return (
    <div>
      <div id="social-media-app" ref={mountRef}></div>
    </div>
  );
}

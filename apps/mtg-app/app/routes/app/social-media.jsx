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

  useEffect(() => {
    // Track elements we inject so we can clean up on unmount
    const injectedElements = [];

    // The bundle expects a <div id="social-media-app"> to mount into.
    // It injects CSS via <style> tags and loads the engine script.
    const script = document.createElement("script");
    script.src = BUNDLE_URL;
    script.defer = true;
    document.head.appendChild(script);
    injectedElements.push(script);

    // Watch for <style> tags the bundle injects so we can remove them later.
    // The bundle injects styles into <head> when the script runs.
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.tagName === "STYLE" || (node.tagName === "SCRIPT" && node.src && node.src.includes("social-media"))) {
            injectedElements.push(node);
          }
        }
      }
    });
    observer.observe(document.head, { childList: true });

    return () => {
      // Cleanup on unmount — remove all injected elements
      observer.disconnect();
      for (const el of injectedElements) {
        el.remove();
      }
      // Clear the mount point content (injected HTML)
      if (mountRef.current) {
        mountRef.current.innerHTML = "";
      }
      // Clean up global SMG object if it exists
      if (typeof window !== "undefined" && window.SMG) {
        delete window.SMG;
      }
    };
  }, []);

  return (
    <div>
      <div id="social-media-app" ref={mountRef}></div>
    </div>
  );
}

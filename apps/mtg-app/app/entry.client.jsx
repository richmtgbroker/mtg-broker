import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import { startTransition } from "react";

startTransition(() => {
  hydrateRoot(document, <HydratedRouter />);
});

// Ybug feedback widget — loaded after hydration so the launcher appends to the real DOM
setTimeout(() => {
  window.ybug_settings = { id: "rp6gm9qcm7g7qvw2vkb2" };
  const ybug = document.createElement("script");
  ybug.async = true;
  ybug.src = "https://widget.ybug.io/button/" + window.ybug_settings.id + ".js";
  document.head.appendChild(ybug);
}, 0);

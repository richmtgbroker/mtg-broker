// Plan UIDs from Outseta
export const PLAN_UIDS = {
  LITE: "NmdnZg90",
  PLUS: "Dmw8leQ4",
  PRO: "yWobBP9D",
};

// Map planUid → plan name
export const PLAN_MAP = {
  [PLAN_UIDS.LITE]: "LITE",
  [PLAN_UIDS.PLUS]: "PLUS",
  [PLAN_UIDS.PRO]: "PRO",
};

// Admin emails
export const ADMIN_EMAILS = ["rich@prestonlending.com"];

// NEXA email domains
export const NEXA_DOMAINS = ["@nexamortgage.com", "@nexalending.com"];

// Outseta domain
export const OUTSETA_DOMAIN = "mtgbroker.outseta.com";

// Build an Outseta hosted auth URL that redirects back to the current site after auth.
// For plan-specific signup: getOutsetaAuthUrl("register", "NmdnZg90")
// For general login: getOutsetaAuthUrl("login")
// During SSR, falls back to mtg.broker as the redirect target.
export function getOutsetaAuthUrl(mode = "register", planUid = null) {
  const base = `https://${OUTSETA_DOMAIN}/auth`;
  const origin = typeof window !== "undefined" ? window.location.origin : "https://mtg.broker";
  const params = new URLSearchParams({ widgetMode: mode });
  if (planUid) params.set("planUid", planUid);
  params.set("authenticationCallbackUrl", origin + "/app/dashboard");
  return `${base}?${params.toString()}`;
}

// Navigate to Outseta login page
export function goToLogin() {
  if (typeof window !== "undefined") {
    window.location.href = getOutsetaAuthUrl("login");
  }
}

// Navigate to Outseta signup page
export function goToSignup(planUid = null) {
  if (typeof window !== "undefined") {
    window.location.href = getOutsetaAuthUrl("register", planUid);
  }
}

// API endpoints
export const API_BASE = "https://mtg-broker-api.rich-e00.workers.dev";
export const SUPABASE_URL = "https://tcmahfwhdknxhhdvqpum.supabase.co";

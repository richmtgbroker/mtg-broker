import { PLAN_MAP, PLAN_UIDS, ADMIN_EMAILS, NEXA_DOMAINS } from "./constants";

/**
 * Get the JWT access token from localStorage.
 * Returns null if not present or on server.
 */
export function getAccessToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("Outseta.nocode.accessToken") || null;
}

/**
 * Decode JWT payload (no verification — just parse claims).
 * Returns null if token is missing or malformed.
 */
export function decodeToken() {
  const token = getAccessToken();
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

/**
 * Check if the user is logged in (has a valid-looking token).
 */
export function isLoggedIn() {
  return !!getAccessToken();
}

/**
 * Get user's email from JWT.
 */
export function getUserEmail() {
  const payload = decodeToken();
  if (!payload) return null;
  return (payload.email || "").toLowerCase();
}

/**
 * Get user's plan name from JWT (LITE, PLUS, PRO, or null).
 */
export function getUserPlan() {
  const payload = decodeToken();
  if (!payload) return null;
  const planUid = payload["outseta:planUid"] || "";
  return PLAN_MAP[planUid] || null;
}

/**
 * Check if user is on the PRO plan.
 */
export function isProUser() {
  const payload = decodeToken();
  if (!payload) return false;
  return (payload["outseta:planUid"] || "") === PLAN_UIDS.PRO;
}

/**
 * Check if user is an admin.
 */
export function isAdmin() {
  const email = getUserEmail();
  if (!email) return false;
  return ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email);
}

/**
 * Check if user has NEXA access (sync — checks email domain + sessionStorage cache).
 * For the async Outseta custom field check, use checkNexaAccess().
 */
export function isNexaUser() {
  // Check sessionStorage cache (set by async checkNexaAccess)
  if (typeof window !== "undefined") {
    const cached = sessionStorage.getItem("mtg_nexa_access");
    if (cached === "true") return true;
  }
  // Fast path: email domain check
  const email = getUserEmail();
  if (!email) return false;
  return NEXA_DOMAINS.some((domain) => email.endsWith(domain));
}

/**
 * Async NEXA access check — checks Outseta NexaAccess custom field.
 * Caches result in sessionStorage so isNexaUser() picks it up on next call.
 * Returns true if user has NEXA access.
 */
export async function checkNexaAccess() {
  if (typeof window === "undefined") return false;

  // Already confirmed via email domain
  if (isNexaUser()) {
    sessionStorage.setItem("mtg_nexa_access", "true");
    return true;
  }

  // Slow path: check Outseta NexaAccess custom field
  try {
    let user = null;
    if (typeof window.getCachedOutsetaUser === "function") {
      user = await window.getCachedOutsetaUser();
    } else if (window.Outseta && typeof window.Outseta.getUser === "function") {
      user = await window.Outseta.getUser();
    }

    if (user) {
      // Check direct field
      if (user.NexaAccess === "true") {
        sessionStorage.setItem("mtg_nexa_access", "true");
        return true;
      }
      // Check nested in Account.Metadata
      try {
        if (user.Account?.Metadata?.NexaAccess?.toLowerCase() === "true") {
          sessionStorage.setItem("mtg_nexa_access", "true");
          return true;
        }
      } catch {}
    }
  } catch {}

  return false;
}

/**
 * Get user's display name from JWT.
 */
export function getUserName() {
  const payload = decodeToken();
  if (!payload) return null;
  return payload.name || null;
}

/**
 * Get the user's avatar URL.
 * Priority: Airtable/R2 upload → Outseta ProfileImageS3Url → null.
 * Caches in sessionStorage to avoid repeated API calls across navigations.
 */
export async function getAvatarUrl() {
  if (typeof window === "undefined") return null;
  const email = getUserEmail();
  if (!email) return null;

  // Check sessionStorage cache first
  const cacheKey = "mtgbroker_avatar_url";
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) return cached === "__none__" ? null : cached;

  let avatarUrl = null;

  // 1) Try broker profile from API (R2-stored avatar)
  try {
    const resp = await fetch(
      "https://mtg-broker-api.rich-e00.workers.dev/api/broker-profile",
      { headers: { Authorization: "Bearer " + getAccessToken() } }
    );
    if (resp.ok) {
      const data = await resp.json();
      if (data.profile?.data?.avatarUrl) {
        avatarUrl = data.profile.data.avatarUrl;
      }
    }
  } catch (e) {
    // API unavailable — continue to fallback
  }

  // 2) Fallback: Outseta ProfileImageS3Url
  if (!avatarUrl) {
    try {
      if (typeof window.getCachedOutsetaUser === "function") {
        const u = await window.getCachedOutsetaUser();
        if (u?.ProfileImageS3Url) avatarUrl = u.ProfileImageS3Url;
      } else if (window.Outseta && typeof window.Outseta.getUser === "function") {
        const u = await window.Outseta.getUser();
        if (u?.ProfileImageS3Url) avatarUrl = u.ProfileImageS3Url;
      }
    } catch (e) {
      // Outseta not loaded — give up
    }
  }

  // Cache result (use "__none__" sentinel so we don't re-fetch on null)
  sessionStorage.setItem(cacheKey, avatarUrl || "__none__");
  return avatarUrl;
}

/**
 * Clear the cached avatar URL (call after uploading/removing avatar in settings).
 */
export function clearAvatarCache() {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("mtgbroker_avatar_url");
  }
}

/**
 * Logout — clear token, call Outseta logout if available, redirect home.
 */
export function logout() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("Outseta.nocode.accessToken");
  // Try to call Outseta's logout to clear their session cookies
  try {
    if (window.Outseta && typeof window.Outseta.getUser === "function") {
      const user = window.Outseta.getUser();
      if (user && typeof user.logout === "function") {
        user.logout();
      }
    }
  } catch (e) {
    // Outseta not loaded or logout failed — continue with redirect
  }
  window.location.href = "/";
}

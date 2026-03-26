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
 * Check if user is a NEXA employee (by email domain).
 */
export function isNexaUser() {
  const email = getUserEmail();
  if (!email) return false;
  return NEXA_DOMAINS.some((domain) => email.endsWith(domain));
}

/**
 * Logout — clear token and redirect.
 */
export function logout() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("Outseta.nocode.accessToken");
  window.location.href = "/";
}

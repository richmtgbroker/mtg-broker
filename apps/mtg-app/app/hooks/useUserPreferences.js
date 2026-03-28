/**
 * useUserPreferences — Supabase-backed user preferences with localStorage cache.
 *
 * Reads instantly from localStorage for fast UI, then syncs from Supabase
 * in the background. Writes go to both localStorage and Supabase.
 * Falls back to localStorage-only when the user is not logged in.
 */

const SUPABASE_URL = "https://tcmahfwhdknxhhdvqpum.supabase.co/rest/v1";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjbWFoZndoZGtueGhoZHZxcHVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMzQ5MTgsImV4cCI6MjA4NDYxMDkxOH0.xtc5YiU0Gzemj3SJN5UHXUiG9ys7O6mjz1qlmk-3qlQ";

/* ── JWT helpers ── */

function getOutsetaToken() {
  try {
    return localStorage.getItem("Outseta.nocode.accessToken") || null;
  } catch {
    return null;
  }
}

function decodeJWTPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

function getUserEmail() {
  const token = getOutsetaToken();
  if (!token) return null;
  const payload = decodeJWTPayload(token);
  return payload?.email || payload?.Email || null;
}

/* ── localStorage keys ── */

function lsKey(type, targetId) {
  return `mtg_pref_${type}_${targetId}`;
}

function lsRead(type, targetId) {
  try {
    const raw = localStorage.getItem(lsKey(type, targetId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function lsWrite(type, targetId, values) {
  try {
    localStorage.setItem(lsKey(type, targetId), JSON.stringify(values));
  } catch {}
}

/* ── Supabase REST helpers ── */

function supabaseHeaders(token) {
  const h = {
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  if (token) {
    h["Authorization"] = `Bearer ${token}`;
  }
  return h;
}

async function supabaseGet(email, type, targetId) {
  const token = getOutsetaToken();
  if (!token || !email) return null;
  try {
    const params = new URLSearchParams({
      user_email: `eq.${email}`,
      preference_type: `eq.${type}`,
      target_id: `eq.${targetId}`,
      select: "*",
    });
    const res = await fetch(`${SUPABASE_URL}/user_preferences?${params}`, {
      headers: supabaseHeaders(token),
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows.length > 0 ? rows[0] : null;
  } catch {
    return null;
  }
}

async function supabaseUpsert(email, type, targetId, values) {
  const token = getOutsetaToken();
  if (!token || !email) return;
  try {
    const body = {
      user_email: email,
      preference_type: type,
      target_id: targetId,
      ...values,
      updated_at: new Date().toISOString(),
    };
    await fetch(`${SUPABASE_URL}/user_preferences`, {
      method: "POST",
      headers: {
        ...supabaseHeaders(token),
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(body),
    });
  } catch {}
}

async function supabaseGetAll(email, type) {
  const token = getOutsetaToken();
  if (!token || !email) return [];
  try {
    const params = new URLSearchParams({
      user_email: `eq.${email}`,
      preference_type: `eq.${type}`,
      select: "*",
    });
    const res = await fetch(`${SUPABASE_URL}/user_preferences?${params}`, {
      headers: supabaseHeaders(token),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/* ── Public API ── */

/** Get lender notes (text). Returns from localStorage instantly. */
export function getLenderNotes(slug) {
  const cached = lsRead("lender_notes", slug);
  return cached?.value_text || "";
}

/** Save lender notes to both localStorage and Supabase. */
export async function saveLenderNotes(slug, text) {
  const values = { value_text: text };
  lsWrite("lender_notes", slug, values);
  const email = getUserEmail();
  if (email) await supabaseUpsert(email, "lender_notes", slug, values);
}

/** Get star rating (number 0-5). Returns from localStorage instantly. */
export function getLenderRating(slug) {
  const cached = lsRead("lender_rating", slug);
  return cached?.value_number || 0;
}

/** Save star rating. */
export async function saveLenderRating(slug, number) {
  const values = { value_number: number };
  lsWrite("lender_rating", slug, values);
  const email = getUserEmail();
  if (email) await supabaseUpsert(email, "lender_rating", slug, values);
}

/** Get lender favorite state (boolean). Returns from localStorage instantly. */
export function getLenderFavorite(slug) {
  const cached = lsRead("lender_favorite", slug);
  return cached?.value_bool === true;
}

/** Toggle favorite and return new state. */
export async function toggleLenderFavorite(slug) {
  const current = getLenderFavorite(slug);
  const next = !current;
  const values = { value_bool: next };
  lsWrite("lender_favorite", slug, values);
  const email = getUserEmail();
  if (email) await supabaseUpsert(email, "lender_favorite", slug, values);
  return next;
}

/** Get all favorites for the current user. */
export async function getAllFavorites() {
  const email = getUserEmail();
  if (!email) return [];
  return supabaseGetAll(email, "lender_favorite");
}

/** Generic preference getter. */
export function getPreference(type, targetId) {
  return lsRead(type, targetId);
}

/** Generic preference setter. */
export async function setPreference(type, targetId, values) {
  lsWrite(type, targetId, values);
  const email = getUserEmail();
  if (email) await supabaseUpsert(email, type, targetId, values);
}

/**
 * Background sync — pulls the latest value from Supabase and updates localStorage.
 * Call this after initial render to reconcile cloud → local.
 * Returns the Supabase row (or null if not found / not logged in).
 */
export async function syncFromSupabase(type, targetId) {
  const email = getUserEmail();
  if (!email) return null;
  const row = await supabaseGet(email, type, targetId);
  if (row) {
    const values = {};
    if (row.value_text !== null && row.value_text !== undefined) values.value_text = row.value_text;
    if (row.value_number !== null && row.value_number !== undefined) values.value_number = row.value_number;
    if (row.value_bool !== null && row.value_bool !== undefined) values.value_bool = row.value_bool;
    if (row.value_json !== null && row.value_json !== undefined) values.value_json = row.value_json;
    lsWrite(type, targetId, values);
  }
  return row;
}

/** Returns the user email extracted from the Outseta JWT (or null). */
export { getUserEmail };

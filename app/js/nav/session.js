// nav/session.js — Active rental session state over localStorage.
//
// Session key: "sa-blava.session"
// Shape: {
//   routeId: string,             "sud" | "nord"
//   durationHours: number,       1 | 1.5 | 2 | 3
//   startedAtMs: number,         Date.now() at session start
//   code: string,                raw code string entered by user
//   includedPoiIndices: number[] canonical POI indices to navigate
// }
//
// Wall-clock countdown: timeRemainingMs = (startedAtMs + durationHours*3_600_000) - Date.now()
// Refreshing / re-opening the app continues the same countdown automatically.

const SESSION_KEY = "sa-blava.session";
const DRAFT_PREFIX = "sa-blava.draft.";

// ─── Session ──────────────────────────────────────────────────────────────────

/**
 * Start a new session. Overwrites any existing session.
 * @param {{ routeId: string, durationHours: number, code: string, includedPoiIndices: number[] }} opts
 */
export function startSession({ routeId, durationHours, code, includedPoiIndices }) {
  const session = {
    routeId,
    durationHours,
    startedAtMs: Date.now(),
    code,
    includedPoiIndices,
  };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    console.warn("[Sa Blava] Could not write session to localStorage", e);
  }
  return session;
}

/**
 * Read the current session. Returns null if none exists or data is corrupt.
 * @returns {{ routeId, durationHours, startedAtMs, code, includedPoiIndices } | null}
 */
export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session?.routeId || !session?.startedAtMs) return null;
    return session;
  } catch {
    return null;
  }
}

/** Remove the active session. */
export function endSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {}
}

/** Returns true if a session exists (does not check if time has run out). */
export function isActive() {
  return getSession() !== null;
}

/**
 * Milliseconds remaining in the current session.
 * Negative when overtime. Returns NaN if no session.
 */
export function timeRemainingMs() {
  const s = getSession();
  if (!s) return NaN;
  return s.startedAtMs + s.durationHours * 3_600_000 - Date.now();
}

// ─── Draft ────────────────────────────────────────────────────────────────────
// A draft persists the user's POI selection between the modal and "Accepta".

const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 h

/**
 * Write draft for a given route.
 * @param {string} routeId
 * @param {{ durationHours: number, includedPoiIndices: number[] }} data
 */
export function saveDraft(routeId, data) {
  try {
    localStorage.setItem(
      DRAFT_PREFIX + routeId,
      JSON.stringify({ ...data, savedAt: Date.now() })
    );
  } catch {}
}

/**
 * Read draft. Returns null if missing, stale (>24h), or corrupt.
 * @param {string} routeId
 * @returns {{ durationHours: number, includedPoiIndices: number[] } | null}
 */
export function getDraft(routeId) {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + routeId);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d?.savedAt || Date.now() - d.savedAt > DRAFT_MAX_AGE_MS) return null;
    return { durationHours: d.durationHours, includedPoiIndices: d.includedPoiIndices };
  } catch {
    return null;
  }
}

/** Delete draft for a route (call after promoting draft → session). */
export function clearDraft(routeId) {
  try {
    localStorage.removeItem(DRAFT_PREFIX + routeId);
  } catch {}
}

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

import { getKayakId } from "../kayak.js";

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

// ─── Fired time-warning thresholds ──────────────────────────────────────────────
// Persisted on the session so a refresh, tab switch, or device lock can neither
// replay an already-fired warning nor lose one. The nav alert scheduler
// (nav/alerts.js) owns WHICH thresholds are due; this just durably records the
// ones already announced. Additive field — never written by startSession, so a
// fresh trip starts with none.

/**
 * Threshold keys ("t30" | "t15" | "t5" | "t0") already announced this session.
 * @returns {string[]}
 */
export function getFiredThresholds() {
  const s = getSession();
  return Array.isArray(s?.firedThresholds) ? s.firedThresholds : [];
}

/**
 * Mark one or more threshold keys as fired, persisting to the session. Merges
 * with any already recorded; a no-op if there is no active session or nothing
 * new to add.
 * @param {string[]} keys
 */
export function markThresholdsFired(keys) {
  const s = getSession();
  if (!s) return;
  const set = new Set(Array.isArray(s.firedThresholds) ? s.firedThresholds : []);
  let changed = false;
  for (const k of keys) {
    if (!set.has(k)) { set.add(k); changed = true; }
  }
  if (!changed) return;
  s.firedThresholds = [...set];
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
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

/**
 * Reconcile the local timer with the server's authoritative clock.
 *
 * The reset bug this fixes: the countdown used to live only in localStorage, so
 * a reload / re-scan / dead phone restarted it. The server records `started_at`
 * once (POST /api/session/start); here we read it back and adopt it, so the
 * countdown continues from the true start no matter how many times the page
 * reloads. Purely additive and best-effort: with no kayak id, no local session,
 * or the API down, the local timer is left exactly as it is today (offline
 * fallback). Safe to call unawaited — `timeRemainingMs()` re-reads storage each
 * tick, so the corrected start time is picked up on the next second.
 */
export async function rehydrateFromServer() {
  const local = getSession();
  if (!local) return; // nothing started on this phone — nothing to reconcile

  const kayakId = getKayakId();
  if (!kayakId) return; // no QR scanned — the server has no row to match

  try {
    const res = await fetch(
      `/api/session/current?kayak_id=${encodeURIComponent(kayakId)}`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) return;
    const { session } = await res.json();
    if (!session?.started_at) return; // kayak at dock / no open session

    // Server is the source of truth for the clock. Keep the local route + POI
    // selection (the server doesn't track those); adopt only the timing.
    const durationHours = session.duration_min
      ? session.duration_min / 60
      : local.durationHours;
    const merged = { ...local, startedAtMs: session.started_at, durationHours };
    localStorage.setItem(SESSION_KEY, JSON.stringify(merged));
  } catch {
    // Offline / API unreachable — keep the local timer, exactly as today.
  }
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

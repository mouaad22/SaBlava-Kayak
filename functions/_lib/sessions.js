// functions/_lib/sessions.js — the session domain logic, shared by every route.
//
// Two lifecycles (SESSION-TRACKING-DESIGN.md §2 — do NOT conflate):
//   • time axis:     active -> time_off, derived from now >= expires_at
//   • physical axis: out -> returned, set only by staff (status -> 'closed')
// A session is fully 'closed' only when returned.

import { first, all } from "./db.js";

// The 20 kayaks, matching the per-kayak QR codes (?k=01..20).
export const KAYAKS = Array.from({ length: 20 }, (_, i) => String(i + 1).padStart(2, "0"));

const MS_PER_MIN = 60_000;

/** Latest non-closed (open) session for a kayak, or null. */
export function openSessionForKayak(db, kayakId) {
  return first(
    db,
    `SELECT * FROM sessions
       WHERE kayak_id = ? AND status != 'closed'
       ORDER BY started_at DESC
       LIMIT 1`,
    [kayakId],
  );
}

/** Every open session, keyed by kayak_id (one board read instead of 20). */
export async function openSessionsByKayak(db) {
  const rows = await all(
    db,
    `SELECT * FROM sessions WHERE status != 'closed' ORDER BY started_at DESC`,
  );
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.kayak_id)) map.set(row.kayak_id, row); // newest wins
  }
  return map;
}

/** True if any second_device event was logged against this session. */
export async function hasSecondDevice(db, sessionId) {
  if (!sessionId) return false;
  const row = await first(
    db,
    `SELECT 1 AS hit FROM events WHERE session_id = ? AND type = 'second_device' LIMIT 1`,
    [sessionId],
  );
  return !!row;
}

/**
 * Derive the board state for a kayak from its open session (or null).
 *   no open session            -> 'available'
 *   open & now < expires_at     -> 'active'
 *   open & now >= expires_at    -> 'time_off'
 *   closed                      -> 'closed' (not shown on the live board)
 */
export function deriveState(session, now = Date.now()) {
  if (!session) return "available";
  if (session.status === "closed") return "closed";
  return now >= session.expires_at ? "time_off" : "active";
}

/**
 * The Part-2 rule table for POST /api/session/start. Pure decision — the caller
 * performs the writes. `existing` is the kayak's current open session (or null);
 * `deviceTokenHash` is the SHA-256 of the scanning device's token.
 *
 *   none                          -> 'start'         (new session)
 *   expired (time off)            -> 'supersede'     (close old, start new = handover)
 *   active, same device           -> 'resume'        (return existing unchanged)
 *   active, different device       -> 'second_device' (return existing, log only — never block)
 */
export function decideStartAction(existing, deviceTokenHash, now = Date.now()) {
  if (!existing) return "start";
  if (now >= existing.expires_at) return "supersede";
  return existing.device_token === deviceTokenHash ? "resume" : "second_device";
}

/** Build one board item per kayak in the API shape (SESSION-TRACKING-DESIGN.md §4). */
export async function buildBoard(db, now = Date.now()) {
  const open = await openSessionsByKayak(db);
  const items = [];
  for (const kayakId of KAYAKS) {
    const s = open.get(kayakId) ?? null;
    const state = deriveState(s, now);
    items.push({
      kayak_id: kayakId,
      state,
      session_id: s?.id ?? null,
      started_at: s?.started_at ?? null,
      expires_at: s?.expires_at ?? null,
      remaining_ms: s ? s.expires_at - now : null, // negative when over (time_off)
      duration_min: s?.duration_min ?? null,
      second_device: s ? await hasSecondDevice(db, s.id) : false,
    });
  }
  // time_off first (needs action), then active by soonest expiry, then available.
  const rank = { time_off: 0, active: 1, available: 2, closed: 3 };
  items.sort((a, b) => {
    if (rank[a.state] !== rank[b.state]) return rank[a.state] - rank[b.state];
    if (a.state === "active") return (a.expires_at ?? 0) - (b.expires_at ?? 0);
    return a.kayak_id.localeCompare(b.kayak_id);
  });
  return items;
}

export function expiresAt(startedAtMs, durationMin) {
  return startedAtMs + durationMin * MS_PER_MIN;
}

// functions/api/panel/history.js — GET /api/panel/history  (staff only)
//
// Read-only dispute record: the most recent CLOSED sessions, each with its
// append-only event timeline. The board shows only what's on the water now;
// this is where staff settle "how long was I really out / when did it come
// back / did a second phone scan it". Closed sessions retain started_at,
// duration, returned_at/returned_by and closed_reason, and the events table is
// append-only, so nothing here is derived or destructible.

import { json, all } from "../../_lib/db.js";
import { requireStaff } from "../../_lib/auth.js";

const LIMIT = 40;

export async function onRequestGet({ request, env }) {
  const denied = await requireStaff(request, env);
  if (denied) return denied;

  const db = env.DB;

  // Newest-closed first. `superseded` handovers have no returned_at, so fall
  // back to updated_at (always stamped on close) for the sort key.
  const sessions = await all(
    db,
    `SELECT id, kayak_id, started_at, duration_min, expires_at,
            returned_at, returned_by, closed_reason, updated_at
       FROM sessions
      WHERE status = 'closed'
      ORDER BY COALESCE(returned_at, updated_at) DESC
      LIMIT ?`,
    [LIMIT],
  );

  if (sessions.length === 0) return json({ server_now: Date.now(), sessions: [] });

  // One round-trip for every event of the sessions in view, grouped in JS.
  const ids = sessions.map((s) => s.id);
  const placeholders = ids.map(() => "?").join(",");
  const events = await all(
    db,
    `SELECT session_id, type, at FROM events
      WHERE session_id IN (${placeholders})
      ORDER BY at ASC`,
    ids,
  );

  const bySession = new Map();
  for (const e of events) {
    if (!bySession.has(e.session_id)) bySession.set(e.session_id, []);
    bySession.get(e.session_id).push({ type: e.type, at: e.at });
  }

  const out = sessions.map((s) => {
    const evs = bySession.get(s.id) ?? [];
    return {
      id: s.id,
      kayak_id: s.kayak_id,
      started_at: s.started_at,
      duration_min: s.duration_min,
      expires_at: s.expires_at,
      // returned_at is null for superseded handovers — fall back to updated_at.
      closed_at: s.returned_at ?? s.updated_at,
      returned_by: s.returned_by,
      closed_reason: s.closed_reason,
      second_device: evs.some((e) => e.type === "second_device"),
      events: evs,
    };
  });

  return json({ server_now: Date.now(), sessions: out });
}

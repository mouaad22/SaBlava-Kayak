// functions/api/panel/finish.js — POST /api/panel/finish { kayak_id }  (staff only)
//
// The one-tap "Kayak returned" action. This is the ONLY place the physical-return
// axis (out -> returned) flips: status -> 'closed', returned_at stamped. The clock
// (time) axis is independent — `closed_reason` records whether the kayak came back
// before its time ran out ('finished_early') or after ('staff_return'), and the
// matching event (finished_early | return_confirmed) is appended to the audit log.

import { json, run } from "../../_lib/db.js";
import { requireStaff } from "../../_lib/auth.js";
import { openSessionForKayak } from "../../_lib/sessions.js";

export async function onRequestPost({ request, env }) {
  const denied = await requireStaff(request, env);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_request" }, { status: 400 });
  }

  const kayakId = String(body?.kayak_id ?? "").trim();
  if (!kayakId) return json({ error: "bad_request" }, { status: 400 });

  const db = env.DB;
  const session = await openSessionForKayak(db, kayakId);
  // Idempotent: if there is nothing open (already returned, or a stale tap), say so
  // without erroring — the board will just show the kayak as available.
  if (!session) return json({ error: "no_open_session" }, { status: 404 });

  const now = Date.now();
  const early = now < session.expires_at;
  const closedReason = early ? "finished_early" : "staff_return";
  const eventType = early ? "finished_early" : "return_confirmed";

  await run(
    db,
    `UPDATE sessions
        SET status = 'closed', returned_at = ?, returned_by = 'staff',
            closed_reason = ?, updated_at = ?
      WHERE id = ?`,
    [now, closedReason, now, session.id],
  );
  await run(
    db,
    `INSERT INTO events (id, session_id, kayak_id, type, at)
     VALUES (?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), session.id, kayakId, eventType, now],
  );

  return json({ ok: true, kayak_id: kayakId, closed_reason: closedReason });
}

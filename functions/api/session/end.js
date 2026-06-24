// functions/api/session/end.js — POST /api/session/end  (no auth)
//
// The customer's "Finish trip" tap on their phone lands here. It is a SIGNAL, not
// a close: it tells staff "I'm done / heading back" so the kayak stops being
// invisible on the board — but the kayak is still physically out on the water, so
// the session stays open until staff confirm the return (POST /api/panel/finish).
//
// We append a single `customer_ended` event to the append-only audit log. The
// board reads that flag (sessions.js#hasCustomerEnded) to bubble the kayak to the
// top as a pending return; the history shows the event inline. The physical
// return axis (out -> returned) is still staff-only — see SESSION-TRACKING-DESIGN.md §2.
//
// Body: { kayak_id, device_token? }. Fire-and-forget from the phone, so this is
// fully idempotent and never errors on a missing/closed session: a double-tap, a
// reload re-post, or an offline-started trip with no server row all return ok.

import { json, run } from "../../_lib/db.js";
import { KAYAKS, openSessionForKayak, hasCustomerEnded } from "../../_lib/sessions.js";
import { sha256Hex } from "../../_lib/crypto.js";

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_request" }, { status: 400 });
  }

  const kayakId = String(body?.kayak_id ?? "").trim();
  if (!KAYAKS.includes(kayakId)) {
    return json({ error: "unknown_kayak" }, { status: 400 });
  }

  const db = env.DB;
  const session = await openSessionForKayak(db, kayakId);
  // Nothing open (already returned by staff, or the trip was never reported to the
  // server — no QR / offline at start). The phone clears its local session anyway;
  // there is simply nothing to flag here.
  if (!session) return json({ ok: true, flagged: false });

  // Idempotent: only the first finish flags the session, so a double-tap or a
  // re-post on reload doesn't spam the dispute timeline. Never closes the session.
  if (await hasCustomerEnded(db, session.id)) {
    return json({ ok: true, flagged: true });
  }

  const now = Date.now();
  const rawToken = String(body?.device_token ?? "").trim();
  const tokenHash = rawToken ? await sha256Hex(rawToken) : null;

  await run(
    db,
    `INSERT INTO events (id, session_id, kayak_id, type, device_token, at)
     VALUES (?, ?, ?, 'customer_ended', ?, ?)`,
    [crypto.randomUUID(), session.id, kayakId, tokenHash, now],
  );
  // Touch updated_at so the board's open-session read reflects the flag promptly.
  await run(db, `UPDATE sessions SET updated_at = ? WHERE id = ?`, [now, session.id]);

  return json({ ok: true, flagged: true });
}

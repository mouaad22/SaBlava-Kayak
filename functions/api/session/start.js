// functions/api/session/start.js — POST /api/session/start  (no auth)
//
// The customer's "Start route" tap lands here and becomes the authoritative
// rental clock: `started_at` is recorded once on the server, so a reload / a
// re-scan / a dead phone can never reset the countdown (the bug this fixes).
//
// Body: { kayak_id, device_token, duration_min? }
// Returns the authoritative session { id, kayak_id, started_at, expires_at,
// duration_min, status }. The phone only ever *displays* this — see
// GET /api/session/current for the reload rehydrate.
//
// The decision is the Part-2 rule table (SESSION-TRACKING-DESIGN.md §2), kept
// pure in _lib/sessions.js#decideStartAction; this route performs the writes:
//
//   none                       -> start         (new active session)
//   open but expired           -> supersede     (close old handover) + start
//   open, active, same device  -> resume        (return it unchanged)
//   open, active, diff device  -> second_device (return it, log only, NEVER block)

import { json, run } from "../../_lib/db.js";
import {
  KAYAKS,
  openSessionForKayak,
  decideStartAction,
  expiresAt,
} from "../../_lib/sessions.js";
import { sha256Hex } from "../../_lib/crypto.js";

// The durations the rental codes can issue (nav/code.js: 1 / 1.5 / 2 / 3 h).
const ALLOWED_DURATION_MIN = new Set([60, 90, 120, 180]);
const DEFAULT_DURATION_MIN = 60;

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

  const rawToken = String(body?.device_token ?? "").trim();
  if (!rawToken) return json({ error: "bad_request" }, { status: 400 });

  let durationMin = Math.round(Number(body?.duration_min));
  if (!ALLOWED_DURATION_MIN.has(durationMin)) durationMin = DEFAULT_DURATION_MIN;

  const db = env.DB;
  const now = Date.now();
  const tokenHash = await sha256Hex(rawToken);

  const existing = await openSessionForKayak(db, kayakId);
  const action = decideStartAction(existing, tokenHash, now);

  // Same phone re-tapping a live trip → just resume; don't reset, don't log noise.
  if (action === "resume") {
    await logEvent(db, existing.id, kayakId, "resumed", tokenHash, now);
    return json(sessionView(existing));
  }

  // A different phone scanned a kayak whose clock is still running. The kayak is
  // on the water, so the scanner is on that trip — hand back the REAL remaining
  // time, never a reset, never a block. Just record the access for disputes.
  if (action === "second_device") {
    await logEvent(db, existing.id, kayakId, "second_device", tokenHash, now);
    return json(sessionView(existing));
  }

  // Handover: the previous trip's time was already up — close it so the new
  // renter gets a clean session on the same kayak.
  if (action === "supersede") {
    await run(
      db,
      `UPDATE sessions
          SET status = 'closed', closed_reason = 'superseded', updated_at = ?
        WHERE id = ?`,
      [now, existing.id],
    );
    await logEvent(db, existing.id, kayakId, "superseded", tokenHash, now);
  }

  // start (also the tail of supersede): create the new active session.
  const id = crypto.randomUUID();
  const exp = expiresAt(now, durationMin);
  await run(
    db,
    `INSERT INTO sessions
       (id, kayak_id, started_at, duration_min, expires_at, status, device_token, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
    [id, kayakId, now, durationMin, exp, tokenHash, now, now],
  );
  await logEvent(db, id, kayakId, "started", tokenHash, now);

  return json(
    sessionView({
      id,
      kayak_id: kayakId,
      started_at: now,
      duration_min: durationMin,
      expires_at: exp,
      status: "active",
    }),
  );
}

/** The authoritative shape the phone reads back (clock fields only). */
function sessionView(s) {
  return {
    id: s.id,
    kayak_id: s.kayak_id,
    started_at: s.started_at,
    duration_min: s.duration_min,
    expires_at: s.expires_at,
    status: s.status,
  };
}

function logEvent(db, sessionId, kayakId, type, tokenHash, at) {
  return run(
    db,
    `INSERT INTO events (id, session_id, kayak_id, type, device_token, at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), sessionId, kayakId, type, tokenHash, at],
  );
}

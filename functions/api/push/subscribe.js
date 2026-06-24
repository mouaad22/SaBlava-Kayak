// functions/api/push/subscribe.js — POST /api/push/subscribe  (no auth)
//
// The phone registers its Web Push subscription so the once-a-minute cron
// (wrangler-push/) can deliver the timed return-to-base alerts even with the
// screen off. The subscription is scoped to the kayak's CURRENTLY OPEN session,
// so a future rental on the same kayak (a new session id) never inherits it.
//
// Body: { kayak_id, lang?, subscription: { endpoint, keys: { p256dh, auth } } }
// Returns { ok: true } once stored, or 409 when the kayak has no open session
// (nothing to time) — the client treats that as "skip, fall back to foreground".

import { json, run, first } from "../../_lib/db.js";
import { KAYAKS, openSessionForKayak } from "../../_lib/sessions.js";

const LANGS = new Set(["ca", "es", "en", "fr"]);

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_request" }, { status: 400 });
  }

  const kayakId = String(body?.kayak_id ?? "").trim();
  if (!KAYAKS.includes(kayakId)) return json({ error: "unknown_kayak" }, { status: 400 });

  const sub = body?.subscription;
  const endpoint = String(sub?.endpoint ?? "").trim();
  const p256dh = String(sub?.keys?.p256dh ?? "").trim();
  const auth = String(sub?.keys?.auth ?? "").trim();
  if (!endpoint || !p256dh || !auth) return json({ error: "bad_subscription" }, { status: 400 });

  const lang = LANGS.has(body?.lang) ? body.lang : "ca";

  // Bind to the open session — without one there's no clock to fire against.
  const session = await openSessionForKayak(env.DB, kayakId);
  if (!session) return json({ error: "no_open_session" }, { status: 409 });

  // Upsert on endpoint: a re-subscribe (new trip, renewed key) re-points the
  // same endpoint at the current session/lang instead of duplicating.
  const existing = await first(env.DB, `SELECT id FROM push_subscriptions WHERE endpoint = ?`, [endpoint]);
  const now = Date.now();
  if (existing) {
    await run(
      env.DB,
      `UPDATE push_subscriptions
          SET session_id = ?, kayak_id = ?, p256dh = ?, auth = ?, lang = ?
        WHERE endpoint = ?`,
      [session.id, kayakId, p256dh, auth, lang, endpoint],
    );
  } else {
    await run(
      env.DB,
      `INSERT INTO push_subscriptions (id, session_id, kayak_id, endpoint, p256dh, auth, lang, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), session.id, kayakId, endpoint, p256dh, auth, lang, now],
    );
  }

  return json({ ok: true });
}

// functions/api/session/current.js — GET /api/session/current?kayak_id=  (no auth)
//
// The reload rehydrate: the customer phone asks "what's the live session on my
// kayak?" and re-reads the authoritative started_at/expires_at so a refresh or
// re-scan continues the same countdown instead of starting a fresh one.
// Returns { session: {...} } or { session: null } when the kayak is at the dock.

import { json } from "../../_lib/db.js";
import { openSessionForKayak } from "../../_lib/sessions.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const kayakId = String(url.searchParams.get("kayak_id") ?? "").trim();
  if (!kayakId) return json({ error: "bad_request" }, { status: 400 });

  const s = await openSessionForKayak(env.DB, kayakId);
  if (!s) return json({ session: null });

  return json({
    session: {
      id: s.id,
      kayak_id: s.kayak_id,
      started_at: s.started_at,
      duration_min: s.duration_min,
      expires_at: s.expires_at,
      status: s.status,
    },
  });
}

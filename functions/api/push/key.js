// functions/api/push/key.js — GET /api/push/key  (no auth)
//
// Hands the phone the VAPID application-server public key so it can call
// pushManager.subscribe({ applicationServerKey }). The public key is not a
// secret (it's sent to every push service in the `k=` param), but it IS
// environment-specific, so the client fetches it rather than hard-coding it.
// Returns { key: null } when push isn't configured, so the client cleanly
// skips subscribing instead of erroring.

import { json } from "../../_lib/db.js";

export function onRequestGet({ env }) {
  return json({ key: env.VAPID_PUBLIC_KEY ?? null });
}

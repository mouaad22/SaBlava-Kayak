// functions/api/panel/board.js — GET /api/panel/board  (staff only)
//
// One item per kayak with derived state for the dashboard. Polled ~15s by the
// panel; the client ticks the countdown locally between polls.

import { json } from "../../_lib/db.js";
import { requireStaff } from "../../_lib/auth.js";
import { buildBoard } from "../../_lib/sessions.js";

export async function onRequestGet({ request, env }) {
  const denied = await requireStaff(request, env);
  if (denied) return denied;

  const now = Date.now();
  const kayaks = await buildBoard(env.DB, now);
  return json({ server_now: now, kayaks });
}

// functions/api/dev/seed.js — POST /api/dev/seed
//
// DEV ONLY. Guarded by env.ALLOW_SEED — leave it UNSET in production so this
// endpoint is disabled there (returns 404). Wipes sessions/events and seeds
// kayaks in every board state so the panel can be built/demoed before the
// customer app is wired (SESSION-TRACKING-DESIGN.md Phase 0).

import { run, json } from "../../_lib/db.js";
import { expiresAt } from "../../_lib/sessions.js";
import { sha256Hex } from "../../_lib/crypto.js";

const MIN = 60_000;

export async function onRequestPost({ env }) {
  if (!env.ALLOW_SEED) {
    return json({ error: "not_found" }, { status: 404 });
  }

  const db = env.DB;
  const now = Date.now();

  await run(db, `DELETE FROM events`);
  await run(db, `DELETE FROM sessions`);

  const tokenA = await sha256Hex("seed-device-a");
  const tokenB = await sha256Hex("seed-device-b");

  // [kayak, minutesAgoStarted, durationMin, deviceToken, extraSecondDevice]
  const seeds = [
    ["03", 20, 60, tokenA, false], // active — 40 min left
    ["07", 50, 120, tokenA, true], // active — second device scanned this trip
    ["09", 12, 90, tokenB, false], // active — fresh
    ["12", 75, 60, tokenB, false], // time_off — 15 min over
    ["18", 95, 90, tokenA, false], // time_off — 5 min over
    // all other kayaks left available (no open session)
  ];

  for (const [kayakId, agoMin, durMin, token, second] of seeds) {
    const id = crypto.randomUUID();
    const startedAt = now - agoMin * MIN;
    await run(
      db,
      `INSERT INTO sessions
         (id, kayak_id, started_at, duration_min, expires_at, status, device_token, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
      [id, kayakId, startedAt, durMin, expiresAt(startedAt, durMin), token, startedAt, startedAt],
    );
    await run(
      db,
      `INSERT INTO events (id, session_id, kayak_id, type, device_token, at)
       VALUES (?, ?, ?, 'started', ?, ?)`,
      [crypto.randomUUID(), id, kayakId, token, startedAt],
    );
    if (second) {
      await run(
        db,
        `INSERT INTO events (id, session_id, kayak_id, type, device_token, at)
         VALUES (?, ?, ?, 'second_device', ?, ?)`,
        [crypto.randomUUID(), id, kayakId, tokenB, startedAt + 5 * MIN],
      );
    }
  }

  return json({ ok: true, seeded: seeds.length });
}

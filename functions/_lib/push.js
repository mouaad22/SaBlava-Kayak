// functions/_lib/push.js — server-side timed-alert dispatch.
//
// The customer phone can only run its alert timer while the screen is on (the
// browser freezes a backgrounded page — see app/js/screens/navigate.js). This
// module is the OTHER half: a once-a-minute server tick (the cron Worker in
// wrangler-push/) that pushes the time warnings to a locked/pocketed phone,
// because they're a pure function of the wall clock and the session's expiry —
// no GPS needed. POI-arrival alerts stay foreground-only by design (the web has
// no background geolocation), so they're deliberately NOT pushed here.
//
// Thresholds mirror the in-app ones (config.OVERTIME_WARNINGS_MIN): 30/15/5/0
// minutes before expiry. The pure decision (pickDuePush) is unit-tested in
// push.test.mjs; dispatchDuePushes does the D1 reads/writes and the send.

import { all, run } from "./db.js";
import { sendPush, importVapidPrivateKey } from "./webpush.js";

const MS_PER_MIN = 60_000;

// Minutes-before-expiry, most-relaxed first. t0 = expiry ("return to base").
export const THRESHOLDS_MIN = [30, 15, 5, 0];

export const thresholdKey = (min) => `t${min}`;

/** Wall-clock instant a threshold crosses for a session. */
export const thresholdCrossAtMs = (min, expiresAt) => expiresAt - min * MS_PER_MIN;

/**
 * Decide what to push for one session right now. Pure — no I/O.
 *
 * Collapses a backlog the same way the in-app reconciler does: if several
 * thresholds have crossed unsent (e.g. the first tick after the cron was down,
 * or a long first run), only the MOST URGENT is actually sent; the older ones
 * are returned in `collapse` to be marked sent without firing, so the paddler
 * gets one fresh, correct cue instead of a stale burst.
 *
 * @param {{ expires_at: number }} session
 * @param {number} now
 * @param {Set<string>} sentKeys — thresholds already recorded for this session
 * @returns {{ send: string|null, collapse: string[] }}
 */
export function pickDuePush(session, now, sentKeys) {
  const crossedUnsent = THRESHOLDS_MIN.filter((min) => {
    const key = thresholdKey(min);
    return now >= thresholdCrossAtMs(min, session.expires_at) && !sentKeys.has(key);
  }).map(thresholdKey);

  if (crossedUnsent.length === 0) return { send: null, collapse: [] };

  // THRESHOLDS_MIN is relaxed→urgent, so the last crossed entry is the most urgent.
  const send = crossedUnsent[crossedUnsent.length - 1];
  const collapse = crossedUnsent.slice(0, -1);
  return { send, collapse };
}

// Localized notification copy. Kept here (not in app/js/i18n.js) because the
// dispatcher runs on the server with no DOM; the subscription carries the lang.
const TITLE = "Sa Blava Kayak";
const BODIES = {
  ca: { t30: "Queden 30 minuts de lloguer", t15: "Queden 15 minuts", t5: "Queden 5 minuts · comença a tornar", t0: "Temps esgotat · torna a la base" },
  es: { t30: "Quedan 30 minutos de alquiler", t15: "Quedan 15 minutos", t5: "Quedan 5 minutos · vuelve a la base", t0: "Tiempo agotado · vuelve a la base" },
  en: { t30: "30 minutes left", t15: "15 minutes left", t5: "5 minutes left · start heading back", t0: "Time's up · return to base" },
  fr: { t30: "Il reste 30 minutes", t15: "Il reste 15 minutes", t5: "Il reste 5 minutes · rentrez", t0: "Temps écoulé · retour à la base" },
};

/** Build the JSON the service worker renders into a Notification. */
export function buildMessage(key, lang, session) {
  const table = BODIES[lang] ?? BODIES.ca;
  return {
    title: TITLE,
    body: table[key] ?? BODIES.ca[key],
    tag: "nav-time",       // coalesces with the in-app banner's tag
    renotify: true,
    urgent: key === "t5" || key === "t0",
    url: "/",
    kayak_id: session.kayak_id,
  };
}

/** Read + import the VAPID material from env, or null if not configured. */
async function loadVapid(env) {
  if (!env?.VAPID_PRIVATE_KEY || !env?.VAPID_PUBLIC_KEY || !env?.VAPID_SUBJECT) return null;
  const privateKey = await importVapidPrivateKey(env.VAPID_PRIVATE_KEY);
  return { privateKey, publicKey: env.VAPID_PUBLIC_KEY, subject: env.VAPID_SUBJECT };
}

/**
 * The once-a-minute tick: for every open session with subscriptions, send any
 * due time warning and prune dead subscriptions. Idempotent across overlapping
 * runs — a threshold is recorded in push_sent before/at send so it never
 * double-fires (and the notification tag coalesces any rare duplicate anyway).
 *
 * @returns {Promise<{ ok: boolean, reason?: string, sessions?: number, sent?: number, pruned?: number }>}
 */
export async function dispatchDuePushes(db, env, now = Date.now()) {
  const vapid = await loadVapid(env);
  if (!vapid) return { ok: false, reason: "vapid_unconfigured" };

  const sessions = await all(
    db,
    `SELECT id, kayak_id, started_at, duration_min, expires_at
       FROM sessions WHERE status != 'closed'`,
  );

  let touched = 0, sent = 0, pruned = 0;
  for (const s of sessions) {
    const subs = await all(db, `SELECT * FROM push_subscriptions WHERE session_id = ?`, [s.id]);
    if (subs.length === 0) continue;

    const sentRows = await all(db, `SELECT threshold FROM push_sent WHERE session_id = ?`, [s.id]);
    const sentKeys = new Set(sentRows.map((r) => r.threshold));

    const { send, collapse } = pickDuePush(s, now, sentKeys);
    if (!send && collapse.length === 0) continue;
    touched++;

    // Older crossed thresholds we're deliberately skipping — record so they
    // never fire late.
    for (const key of collapse) {
      await run(db, `INSERT OR IGNORE INTO push_sent (session_id, threshold, sent_at) VALUES (?, ?, ?)`, [s.id, key, now]);
    }
    if (!send) continue;

    const message = (lang) => buildMessage(send, lang, s);
    let delivered = 0, prunedThis = 0;
    for (const sub of subs) {
      const status = await sendPush(sub, message(sub.lang), vapid).catch(() => 0);
      if (status === 404 || status === 410) {
        await run(db, `DELETE FROM push_subscriptions WHERE id = ?`, [sub.id]);
        prunedThis++;
        pruned++;
      } else if (status >= 200 && status < 300) {
        delivered++;
        sent++;
      }
    }

    // Mark the active threshold sent only once it actually reached someone (or
    // every sub for this session was dead and pruned) — so a transient
    // push-service blip retries next minute instead of silently dropping a
    // safety alert.
    if (delivered > 0 || prunedThis === subs.length) {
      await run(db, `INSERT OR IGNORE INTO push_sent (session_id, threshold, sent_at) VALUES (?, ?, ?)`, [s.id, send, now]);
    }
  }

  return { ok: true, sessions: touched, sent, pruned };
}

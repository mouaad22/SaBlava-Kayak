// nav/push.js — register this phone for server-sent timed alerts.
//
// The in-app alert timer (navigate.js) only runs while the screen is on. This
// registers a Web Push subscription so the server cron (functions/_lib/push.js)
// can also deliver the time warnings — "5 min left · head back", "time's up" —
// to a locked or pocketed phone. POI-arrival cues are deliberately NOT pushed:
// the web has no background geolocation, so they stay foreground-only.
//
// All best-effort: every failure path (no SW, permission not granted, push
// unconfigured server-side, offline, iOS Safari without "Add to Home Screen")
// degrades silently to the existing foreground voice/chime/banner.

import { getKayakId } from "../kayak.js";

let inFlight = null;

/**
 * Ensure a push subscription exists for this trip, prompting for Notification
 * permission if it hasn't been decided yet. Idempotent and safe to call on every
 * mount / visibility change — concurrent calls share one in-flight attempt and a
 * granted, already-subscribed phone just re-points its subscription at the
 * current session server-side.
 * @param {string} lang — i18n language code, stored so pushes arrive localized
 */
export function ensurePushSubscription(lang) {
  if (inFlight) return inFlight;
  inFlight = subscribe(lang).finally(() => { inFlight = null; });
  return inFlight;
}

async function subscribe(lang) {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;

    const kayakId = getKayakId();
    if (!kayakId) return; // no QR scanned — the server has no session to time

    // Resolve permission. "default" → ask now (we're called from a user-gesture
    // context: the start tap / a visibilitychange iOS treats as a gesture).
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm !== "granted") return;

    const keyRes = await fetch("/api/push/key", { headers: { accept: "application/json" } });
    if (!keyRes.ok) return;
    const { key } = await keyRes.json();
    if (!key) return; // push not configured in this environment

    const reg = await navigator.serviceWorker.ready;
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64urlToUint8Array(key),
      });
    }

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kayak_id: kayakId, lang, subscription: subscription.toJSON() }),
      keepalive: true,
    });
  } catch (e) {
    console.warn("[Sa Blava] Push subscribe skipped:", e?.message ?? e);
  }
}

/** applicationServerKey wants a Uint8Array, not the base64url string. */
function b64urlToUint8Array(base64url) {
  const padded = base64url.replace(/-/g, "+").replace(/_/g, "/") +
    "===".slice((base64url.length + 3) % 4);
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

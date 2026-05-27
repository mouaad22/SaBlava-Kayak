// nav/wake-lock.js — Screen Wake Lock API wrapper.
//
// Keeps the screen on during navigation so GPS tracking isn't paused
// by auto-sleep. Re-acquires on visibilitychange (iOS releases the lock
// when the device is locked then unlocked).
//
// Falls back silently on browsers that don't support the API (older iOS Safari).

let sentinel = null;

/**
 * Request a screen wake lock. No-ops if API is unavailable or already held.
 * @returns {Promise<void>}
 */
export async function acquire() {
  if (!("wakeLock" in navigator)) return;
  if (sentinel) return; // already held
  try {
    sentinel = await navigator.wakeLock.request("screen");
    sentinel.addEventListener("release", () => {
      // Released by the system (e.g. tab hidden). Clear ref so we can re-acquire.
      sentinel = null;
    });
  } catch (e) {
    // Permission denied or API error — non-fatal.
    console.warn("[Sa Blava] Wake lock unavailable:", e.message);
  }
}

/**
 * Release the current wake lock if held.
 * @returns {Promise<void>}
 */
export async function release() {
  if (!sentinel) return;
  try {
    await sentinel.release();
  } catch {}
  sentinel = null;
}

/**
 * Call this once when mounting the navigate screen.
 * Re-acquires the lock whenever the tab becomes visible again.
 * Returns a cleanup function; call it on screen teardown.
 * @returns {() => void}
 */
export function attachVisibilityHandler() {
  async function onVisibility() {
    if (document.visibilityState === "visible") await acquire();
  }
  document.addEventListener("visibilitychange", onVisibility);
  return () => document.removeEventListener("visibilitychange", onVisibility);
}

// nav/device.js — the anonymous per-device token, plus platform detection.
//
// Each phone holds one random token (SESSION-TRACKING-DESIGN.md §2). It is sent
// with POST /api/session/start so the server can tell "same device resuming"
// from "a second device scanned this kayak" — never as identity, only equality.
// The server stores it hashed (SHA-256); the raw value never leaves as PII.
//
// isIOS() exists only to pick the right recovery copy when location is blocked:
// iOS keeps that switch in the OS Settings app, not in the browser, so the
// generic "check your browser settings" line sends iPhone users nowhere.

const STORAGE_KEY = "sa-blava.device";

function randomToken() {
  try {
    if (crypto?.randomUUID) return crypto.randomUUID();
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // No Web Crypto (ancient browser) — a Math.random token is plenty for a
    // soft "same device?" check, the only thing the token is used for.
    return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  }
}

/**
 * True on iPhone/iPad, including iPadOS which reports itself as a Mac.
 *
 * UA sniffing is the wrong tool for feature questions, but this is a genuine
 * platform question — WHERE the location switch lives — and no feature test can
 * answer it.
 *
 * @returns {boolean}
 */
export function isIOS() {
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS 13+ sends a desktop Safari UA; the touch points give it away.
  return /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
}

/**
 * True when running as a home-screen web app rather than inside the browser.
 *
 * Matters here because an installed PWA gets its OWN entry in iOS Location
 * Services, separate from "Safari Websites" — so the recovery instructions
 * differ from the in-Safari case.
 *
 * @returns {boolean}
 */
export function isStandalone() {
  if (navigator.standalone === true) return true;
  return !!window.matchMedia?.("(display-mode: standalone)").matches;
}

/**
 * The stable anonymous token for this device. Created once and persisted; if
 * storage is unavailable (private mode) a fresh ephemeral token is returned for
 * this load — start still works, it just can't be recognised on the next visit.
 * @returns {string}
 */
export function getDeviceToken() {
  try {
    let token = localStorage.getItem(STORAGE_KEY);
    if (!token) {
      token = randomToken();
      localStorage.setItem(STORAGE_KEY, token);
    }
    return token;
  } catch {
    return randomToken();
  }
}

// nav/device.js — the anonymous per-device token.
//
// Each phone holds one random token (SESSION-TRACKING-DESIGN.md §2). It is sent
// with POST /api/session/start so the server can tell "same device resuming"
// from "a second device scanned this kayak" — never as identity, only equality.
// The server stores it hashed (SHA-256); the raw value never leaves as PII.

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

// Per-kayak identity from the QR code.
//
// Each kayak's QR encodes a query param, e.g. https://routes.sablavakayaks.com/?k=07
// The query string lives *before* the hash, and the router only ever touches
// location.hash — so ?k=07 rides along untouched as the customer navigates
// between screens. We read it once at boot and remember it.
//
// localStorage is the safety net: if the customer reloads from a bookmark, or
// the eventual session API (see SESSION-TRACKING-DESIGN.md) needs the kayak id
// after a re-scan on the same phone, we can still recover the last known kayak.

const STORAGE_KEY = "ab.kayakId";

// Kayak ids are short tokens off a physical sticker (e.g. "07", "12", "k3").
// Be strict about what we accept so a junk/hostile query can't poison storage.
function sanitize(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  return /^[A-Za-z0-9-]{1,8}$/.test(trimmed) ? trimmed : null;
}

let kayakId = null;

// Call once at boot, before the first screen renders.
export function captureKayakId() {
  const fromUrl = sanitize(new URLSearchParams(location.search).get("k"));
  if (fromUrl) {
    kayakId = fromUrl;
    try {
      localStorage.setItem(STORAGE_KEY, fromUrl);
    } catch {
      // Private mode / storage disabled — in-memory value still works for this load.
    }
    return kayakId;
  }

  // No ?k= this load (e.g. a manual reload that dropped the query) — fall back
  // to the last kayak this phone scanned.
  try {
    kayakId = sanitize(localStorage.getItem(STORAGE_KEY));
  } catch {
    kayakId = null;
  }
  return kayakId;
}

// The kayak this phone is associated with, or null if it never scanned a QR
// (e.g. someone opened the bare site or the kiosk link).
export function getKayakId() {
  return kayakId;
}

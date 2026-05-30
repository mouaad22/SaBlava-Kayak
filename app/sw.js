// sw.js — Service Worker for Sa Blava Kayak app.
//
// Strategy:
//   • App shell (HTML, JS, CSS, fonts, icons): cache-first.
//     On first fetch the response is stored; subsequent fetches
//     are served from cache immediately (no network round-trip).
//   • Mapbox tile URLs (api.mapbox.com/styles/.../tiles/*,
//     api.mapbox.com/v4/*): network-first with cache fallback.
//     This covers the pre-cached tiles from nav/tile-cache.js.
//   • All other requests: network-pass-through (no caching).
//
// The tile pre-caching from nav/tile-cache.js uses caches.open()
// directly from the page context — the SW just intercepts the
// cached URLs on subsequent requests.

const SHELL_CACHE = "sablava-shell-v1";
const TILE_CACHE  = "sablava-tiles-v1";

const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/styles/tokens.css",
  "/styles/base.css",
  "/styles/components.css",
  "/styles/screens.css",
  "/js/app.js",
];

// ── Install ───────────────────────────────────────────────────────────────────

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(SHELL_ASSETS).catch((err) => {
        // Non-fatal: some assets may not exist at install time (dev env).
        console.warn("[SW] Shell cache partial install:", err.message);
      })
    )
  );
  self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────────────────────────────

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== TILE_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (e) => {
  const url = e.request.url;

  // Ignore non-GET and analytics/events requests.
  if (e.request.method !== "GET") return;
  if (url.includes("events.mapbox.com")) return;

  // Mapbox tile URLs → network-first with tile cache fallback.
  if (isTileRequest(url)) {
    e.respondWith(networkFirstTile(e.request));
    return;
  }

  // App shell → cache-first.
  if (isShellRequest(url)) {
    e.respondWith(cacheFirst(e.request, SHELL_CACHE));
    return;
  }

  // Everything else → network pass-through.
});

// ── Strategies ────────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, res.clone());
    }
    return res;
  } catch {
    // Offline and not cached.
    return new Response("Offline", { status: 503 });
  }
}

async function networkFirstTile(request) {
  try {
    const res = await fetch(request);
    if (res.ok) {
      const cache = await caches.open(TILE_CACHE);
      cache.put(request, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response("Tile unavailable offline", { status: 503 });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isTileRequest(url) {
  return (
    url.includes("api.mapbox.com/styles/") ||
    url.includes("api.mapbox.com/v4/") ||
    url.includes("api.mapbox.com/fonts/")
  );
}

function isShellRequest(url) {
  // Same origin and not a third-party CDN.
  try {
    const u = new URL(url);
    return u.origin === self.location.origin;
  } catch {
    return false;
  }
}

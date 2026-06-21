// sw.js — Service Worker for Sa Blava Kayak app.
//
// Strategy:
//   • Navigations + HTML + JS + CSS: NETWORK-FIRST.
//     Always fetch the latest from the network when online, falling
//     back to cache only when offline. This guarantees that a freshly
//     deployed design shows up on the next load — no manual cache
//     version bump required, no device getting "frozen" on an old
//     snapshot. (The previous cache-first strategy froze index.html
//     and every JS module on first visit, which is why different
//     devices showed different, stale designs.)
//   • Fonts / images / icons: CACHE-FIRST.
//     These rarely change and are safe to serve from cache for speed.
//     When you do change one, give it a new filename (or bump the
//     SHELL_CACHE version below) to force a refresh.
//   • Mapbox tile URLs: NETWORK-FIRST with cache fallback (offline maps).
//   • All other (third-party) requests: network pass-through.
//
// Self-heal: install() calls skipWaiting() and activate() calls
// clients.claim(), so a newly deployed SW takes control immediately.
// index.html listens for `controllerchange` and reloads once, so an
// already-open page also picks up the new version automatically.

const SHELL_CACHE = "sablava-shell-v18";
const TILE_CACHE  = "sablava-tiles-v2";

// Core shell, pre-cached so the app boots offline even on first run.
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/styles/tokens.css",
  "/styles/base.css",
  "/styles/components.css",
  "/styles/screens.css",
  "/js/app.js",
  // Arrival cue — precached so it rings offline on the very first trip.
  "/assets/sounds/arrived-at-poi.mp3",
];

const STATIC_ASSET_RE = /\.(?:woff2?|ttf|otf|eot|png|jpe?g|svg|webp|gif|ico|avif|mp3|wav|ogg|m4a|aac)$/i;

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
  const req = e.request;
  const url = req.url;

  // Ignore non-GET and analytics/events requests.
  if (req.method !== "GET") return;
  if (url.includes("events.mapbox.com")) return;

  // Mapbox tile URLs → network-first with tile cache fallback.
  if (isTileRequest(url)) {
    e.respondWith(networkFirst(req, TILE_CACHE));
    return;
  }

  // Only manage same-origin requests; let third parties pass through.
  if (!isSameOrigin(url)) return;

  // Static assets (fonts, images, icons) → cache-first.
  if (STATIC_ASSET_RE.test(new URL(url).pathname)) {
    e.respondWith(cacheFirst(req, SHELL_CACHE));
    return;
  }

  // Everything else same-origin (navigations, HTML, JS, CSS) → network-first.
  e.respondWith(networkFirst(req, SHELL_CACHE));
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
    return new Response("Offline", { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const res = await fetch(request);
    if (res.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, res.clone());
    }
    return res;
  } catch (err) {
    // Mapbox GL aborts its own in-flight style/sprite/glyph/tile requests
    // during map init and panning (via AbortController). Those aborts must
    // NOT be turned into a fabricated 503 — Mapbox reads that as a failed
    // resource and the custom style ends up blank until you change styles.
    // Let the abort propagate so Mapbox handles its own cancellation.
    if (request.signal?.aborted || err?.name === "AbortError") {
      throw err;
    }
    const cached = await caches.match(request);
    if (cached) return cached;
    // For navigations, fall back to the cached app shell so the app
    // still opens offline even on an uncached deep link.
    if (request.mode === "navigate") {
      const shell = await caches.match("/index.html");
      if (shell) return shell;
    }
    return new Response("Offline", { status: 503 });
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

function isSameOrigin(url) {
  try {
    return new URL(url).origin === self.location.origin;
  } catch {
    return false;
  }
}

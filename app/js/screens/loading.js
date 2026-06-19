// Splash screen with a watercolor brush stroke that paints across the bar
// as real assets load. Progress jumps in stages (one chunk per stage), each
// chunk transitions via CSS for 250ms ease-out. A minimum gap between chunks
// keeps the animation visible even when everything is cached.

import { ROUTES } from "../data.js";

const PHASE_IDLE_MS = 1000;
const CHUNK_TRANSITION_MS = 250; // must match --progress transition in CSS
const PHASE_HOLD_MS = 1000; // bar held fully filled before tearing down
const MIN_CHUNK_GAP_MS = 180;
const TEARDOWN_FADE_MS = 280;
const MAX_WAIT_MS = 8000;

const BRUSH_BASE = "./assets/illustrations/progress-bar/base.webp";
const BRUSH_FILL = "./assets/illustrations/progress-bar/full.webp";

function uniq(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}

function collectRouteCards() {
  return uniq(ROUTES.flatMap((r) => [r.cardImage, r.image]));
}

// Per-POI map illustrations for each route's default duration carousel on
// the route screen. The route screen re-preloads its current duration on
// mount, so warming the default set here means screen 3 lands without
// flicker.
function collectRouteMapSlides() {
  const urls = [];
  for (const route of ROUTES) {
    const durations = route.durations;
    const defaultId = durations?.default;
    const map = route.mapByDuration?.[defaultId];
    if (!map) continue;
    urls.push(map.base);
    const count =
      durations?.countByDuration?.[defaultId] ?? route.pois?.length ?? 9;
    for (let i = 0; i < count; i++) {
      urls.push(encodeURI(map.overlay.replace("{i}", String(i + 1))));
    }
  }
  return uniq(urls);
}

function collectPoiThumbnails() {
  return uniq(ROUTES.flatMap((r) => (r.pois ?? []).map((p) => p.thumbnail)));
}

// Gallery images for every POI — videos are intentionally skipped. They are
// large and load lazily inside the gallery/POI screen anyway.
function collectPoiGalleryImages() {
  return uniq(
    ROUTES.flatMap((r) =>
      (r.pois ?? []).flatMap((p) =>
        (p.gallery ?? [])
          .filter((g) => g.type === "image")
          .map((g) => g.src)
      )
    )
  );
}

// Force the brand fonts to download + parse before the splash tears down.
// Without this, the language screen renders in a system fallback, then the
// real font arrives mid-frame and every glyph visibly re-flows (FOUT).
// `document.fonts.load(spec)` returns a promise that resolves once the
// matching font face has been fetched and is ready to paint.
function preloadFonts() {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const specs = [
    // Body — DM Sans is loaded from Google Fonts; cover every weight used.
    "400 16px 'DM Sans'",
    "500 16px 'DM Sans'",
    "600 16px 'DM Sans'",
    "700 16px 'DM Sans'",
    // Display — Recoleta is a single local @font-face at weight 500.
    "500 24px 'Recoleta'",
  ];
  return Promise.all(
    specs.map((spec) => document.fonts.load(spec).catch(() => null))
  ).then(() => {});
}

// Preload work is grouped into stages — each stage advances the bar by one
// chunk when every URL/task in it has resolved (or 404'd). Batching keeps
// the bar at a readable cadence; without it, 50+ assets would paint faster
// than the MIN_CHUNK_GAP can render, and the bar would feel jittery or stuck
// at the safety cap.
const PRELOAD_STAGES = [
  // Brush bar art itself — must be on disk before painting starts.
  { name: "brush", urls: [BRUSH_BASE, BRUSH_FILL] },
  // Brand fonts — block teardown so the next screen never FOUTs.
  { name: "fonts", task: preloadFonts },
  // Language screen hero — first full-bleed image users see after splash.
  { name: "language-hero", urls: ["./assets/illustrations/hero-2.webp"] },
  // Watercolor weather scene on the routes list.
  { name: "routes-hero", urls: ["./assets/illustrations/mascot-ref-2.webp"] },
  // Route card thumbnails (sud / nord) on the routes list.
  { name: "route-cards", urls: collectRouteCards() },
  // Per-POI illustrated maps that swap as the route carousel scrolls.
  { name: "route-maps", urls: collectRouteMapSlides() },
  // POI thumbnails used in route cards and the POI sheet.
  { name: "poi-thumbnails", urls: collectPoiThumbnails() },
  // POI gallery photos. Videos are excluded — they're large and load lazily
  // inside the POI / gallery screens on demand.
  { name: "poi-gallery", urls: collectPoiGalleryImages() },
];

function preloadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => resolve();
    img.src = src;
  });
}

function preloadStage(stage) {
  const imageWork = (stage.urls || []).map(preloadImage);
  const taskWork = stage.task ? [stage.task()] : [];
  if (!imageWork.length && !taskWork.length) return Promise.resolve();
  return Promise.all([...taskWork, ...imageWork]).then(() => {});
}

export function renderLoadingScreen(host, onComplete) {
  const screen = document.createElement("section");
  screen.className = "screen loading-screen";
  screen.dataset.screen = "loading";

  screen.innerHTML = `
    <div class="loading-screen__inner">
      <img
        class="loading-screen__logo"
        src="./assets/vectors/logo-saBlava.svg"
        alt="Sa Blava — Kayaks & Paddle Surf"
        width="329"
        height="179"
      />

      <div class="loading-screen__brush" aria-hidden="true">
        <img class="loading-screen__brush-layer loading-screen__brush-base" src="${BRUSH_BASE}" alt="" />
        <img class="loading-screen__brush-layer loading-screen__brush-fill" src="${BRUSH_FILL}" alt="" />
      </div>
    </div>
  `;

  host.appendChild(screen);
  requestAnimationFrame(() => screen.classList.add("is-active"));

  const brush = screen.querySelector(".loading-screen__brush");
  const total = PRELOAD_STAGES.length;

  let loaded = 0;
  let displayedProgress = 0;
  let paintingActive = false;
  let lastChunkAt = 0;
  let flushScheduled = false;
  let completed = false;
  let teardownInProgress = false;

  function setProgress(p) {
    displayedProgress = Math.max(0, Math.min(1, p));
    brush.style.setProperty("--progress", String(displayedProgress));
  }

  function scheduleFlush(delay = 0) {
    if (flushScheduled) return;
    flushScheduled = true;
    setTimeout(() => {
      flushScheduled = false;
      flushChunks();
    }, delay);
  }

  function flushChunks() {
    if (!paintingActive || completed) return;
    const target = loaded / total;
    if (target <= displayedProgress) {
      if (target >= 1) finish();
      return;
    }
    const now = performance.now();
    const elapsed = now - lastChunkAt;
    if (elapsed >= MIN_CHUNK_GAP_MS) {
      // Advance one chunk's worth toward the target so multiple completions
      // queued up don't all collapse into a single transition.
      const next = Math.min(target, displayedProgress + 1 / total);
      setProgress(next);
      lastChunkAt = now;
      if (next < target) {
        scheduleFlush(MIN_CHUNK_GAP_MS);
      } else if (next >= 1) {
        finish();
      }
    } else {
      scheduleFlush(MIN_CHUNK_GAP_MS - elapsed);
    }
  }

  function startPainting() {
    paintingActive = true;
    screen.classList.add("is-painting");
    lastChunkAt = performance.now() - MIN_CHUNK_GAP_MS; // allow first chunk immediately
    flushChunks();
  }

  function finish() {
    if (completed) return;
    completed = true;
    // Let the last chunk's --progress transition land, then unmask the fill
    // so the bar appears 100% painted, and hold before advancing.
    setTimeout(() => {
      screen.classList.add("is-complete");
      setTimeout(advance, PHASE_HOLD_MS);
    }, CHUNK_TRANSITION_MS);
  }

  function advance() {
    if (teardownInProgress) return;
    teardownInProgress = true;
    screen.classList.remove("is-active");
    setTimeout(() => {
      screen.remove();
      if (typeof onComplete === "function") onComplete();
    }, TEARDOWN_FADE_MS);
  }

  PRELOAD_STAGES.forEach((stage) => {
    preloadStage(stage).then(() => {
      loaded++;
      if (paintingActive) flushChunks();
    });
  });

  const paintStartTimer = setTimeout(() => {
    startPainting();
  }, PHASE_IDLE_MS);

  // Safety net: if something stalls forever, force-complete after the cap.
  const maxTimer = setTimeout(() => {
    if (completed) return;
    loaded = total;
    setProgress(1);
    finish();
  }, MAX_WAIT_MS);

  return {
    teardown() {
      clearTimeout(paintStartTimer);
      clearTimeout(maxTimer);
      if (teardownInProgress) return;
      teardownInProgress = true;
      screen.classList.remove("is-active");
      setTimeout(() => screen.remove(), TEARDOWN_FADE_MS);
    },
  };
}

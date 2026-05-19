// Splash screen with a watercolor brush stroke that paints across the bar
// as real assets load. Progress jumps in chunks (one per asset), each chunk
// transitions via CSS for 250ms ease-out. A minimum gap between chunks keeps
// the animation visible even when everything is cached.

const PHASE_IDLE_MS = 1000;
const PHASE_FADE_IN_MS = 300;
const PHASE_FADE_OUT_MS = 400;
const MIN_CHUNK_GAP_MS = 180;
const TEARDOWN_FADE_MS = 280;
const MAX_WAIT_MS = 8000;

const BRUSH_BASE = "./assets/illustrations/progress-bar/base.jpg";
const BRUSH_FILL = "./assets/illustrations/progress-bar/full.jpg";
const BRUSH_TIP = "./assets/illustrations/progress-bar/first-stroke.jpg";

// Assets whose loading drives the progress bar. Brush images go first so the
// bar is paintable before phase 3 starts; the hero is the heaviest asset on
// the next screen (language) and dominates real-world load time.
const ASSETS_TO_PRELOAD = [
  BRUSH_BASE,
  BRUSH_FILL,
  BRUSH_TIP,
  "./assets/illustrations/hero-2.jpg",
];

function preloadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => resolve();
    img.src = src;
  });
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
        <img class="loading-screen__brush-layer loading-screen__brush-tip" src="${BRUSH_TIP}" alt="" />
      </div>
    </div>
  `;

  host.appendChild(screen);
  requestAnimationFrame(() => screen.classList.add("is-active"));

  const brush = screen.querySelector(".loading-screen__brush");
  const total = ASSETS_TO_PRELOAD.length;

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
    screen.classList.add("is-complete");
    setTimeout(advance, PHASE_FADE_OUT_MS);
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

  ASSETS_TO_PRELOAD.forEach((src) => {
    preloadImage(src).then(() => {
      loaded++;
      if (paintingActive) flushChunks();
    });
  });

  const fadeInTimer = setTimeout(() => {
    screen.classList.add("is-tip-visible");
  }, PHASE_IDLE_MS);

  const paintStartTimer = setTimeout(() => {
    startPainting();
  }, PHASE_IDLE_MS + PHASE_FADE_IN_MS);

  // Safety net: if something stalls forever, force-complete after the cap.
  const maxTimer = setTimeout(() => {
    if (completed) return;
    loaded = total;
    setProgress(1);
    finish();
  }, MAX_WAIT_MS);

  return {
    teardown() {
      clearTimeout(fadeInTimer);
      clearTimeout(paintStartTimer);
      clearTimeout(maxTimer);
      if (teardownInProgress) return;
      teardownInProgress = true;
      screen.classList.remove("is-active");
      setTimeout(() => screen.remove(), TEARDOWN_FADE_MS);
    },
  };
}

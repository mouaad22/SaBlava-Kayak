// Screen 5 — POI photo gallery (Paper A1P-1).
//
// Full-screen viewer for a POI's gallery, opened from the POI sheet's image
// frame. Swipe left/right (or tap the image edges) to advance slides; tap
// the X to go back to the POI sheet. The starting slide is read from
// sessionStorage so the sheet's currently-visible slide carries over.

import { findRoute } from "../data.js";
import { t, getLanguage } from "../i18n.js";
import { navigate } from "../router.js";

const ICON_CLOSE = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0" aria-hidden="true"><path d="M19.546 17.954C19.757 18.165 19.876 18.452 19.876 18.751C19.876 19.05 19.757 19.336 19.546 19.548C19.335 19.759 19.048 19.878 18.749 19.878C18.45 19.878 18.163 19.759 17.952 19.548L12 13.594L6.046 19.546C5.835 19.757 5.548 19.876 5.249 19.876C4.95 19.876 4.663 19.757 4.452 19.546C4.241 19.334 4.122 19.048 4.122 18.749C4.122 18.45 4.241 18.163 4.452 17.952L10.406 12L4.454 6.046C4.243 5.835 4.124 5.548 4.124 5.249C4.124 4.95 4.243 4.663 4.454 4.452C4.665 4.241 4.952 4.122 5.251 4.122C5.55 4.122 5.836 4.241 6.048 4.452L12 10.406L17.954 4.451C18.165 4.24 18.452 4.121 18.751 4.121C19.05 4.121 19.336 4.24 19.548 4.451C19.759 4.663 19.878 4.949 19.878 5.248C19.878 5.547 19.759 5.834 19.548 6.045L13.594 12L19.546 17.954Z" fill="#1A1A1A"/></svg>`;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function renderGalleryScreen(host, routeId, poiIndex) {
  const route = findRoute(routeId);
  if (!route || !route.pois || !route.pois[poiIndex]) {
    navigate(`/route/${routeId}`);
    return { name: "gallery", teardown() {} };
  }

  const poi = route.pois[poiIndex];
  const gallery = poi.gallery ?? [];
  const lang = getLanguage();
  const poiName = poi.name[lang] ?? poi.name.ca;

  // Resume on the slide the sheet was showing when the user tapped through.
  // Falls back to slide 0 if the key is missing or out of range.
  const stored = parseInt(
    sessionStorage.getItem("sa-blava.gallery.slide") || "0",
    10
  );
  let currentSlide = clamp(
    Number.isFinite(stored) ? stored : 0,
    0,
    Math.max(0, gallery.length - 1)
  );

  const screen = document.createElement("section");
  screen.className = "screen gallery-screen";
  screen.dataset.screen = "gallery";
  host.appendChild(screen);
  requestAnimationFrame(() => screen.classList.add("is-active"));

  screen.innerHTML = `
    <header class="gallery-screen__header">
      <button class="gallery-screen__close" type="button" aria-label="${t("poi.close")}">
        ${ICON_CLOSE}
      </button>
      <h1 class="gallery-screen__title">${poiName}</h1>
    </header>

    <div class="gallery-screen__media" role="region" aria-label="${poiName}">
      <div class="gallery-screen__stack"></div>
    </div>

    <div class="gallery-screen__counter">
      <span data-counter></span>
    </div>
  `;

  const stackEl = screen.querySelector(".gallery-screen__stack");
  const counterEl = screen.querySelector("[data-counter]");
  const mediaEl = screen.querySelector(".gallery-screen__media");

  // Build one slide per gallery item. Only the active slide has its <img>
  // src set; siblings get their src on demand to keep memory low when the
  // gallery has many high-res photos. Videos are also lazy.
  gallery.forEach((_, i) => {
    const slide = document.createElement("div");
    slide.className = "gallery-screen__slide";
    if (i === currentSlide) slide.classList.add("is-active");
    slide.dataset.slide = String(i);
    stackEl.appendChild(slide);
  });

  function hydrateSlide(i) {
    const slide = stackEl.children[i];
    if (!slide || slide.dataset.hydrated === "1") return;
    const item = gallery[i];
    if (!item) return;
    if (item.type === "video") {
      const v = document.createElement("video");
      v.src = item.src;
      if (item.poster) v.poster = item.poster;
      v.controls = true;
      v.playsInline = true;
      v.preload = "metadata";
      v.className = "gallery-screen__video";
      slide.appendChild(v);
    } else {
      const img = document.createElement("img");
      img.src = item.src;
      img.alt = "";
      img.className = "gallery-screen__img";
      slide.appendChild(img);
    }
    slide.dataset.hydrated = "1";
  }

  function showSlide(i) {
    const next = clamp(i, 0, gallery.length - 1);
    if (next === currentSlide && stackEl.children[next]?.classList.contains("is-active")) {
      return;
    }
    // Pause any video that was playing on the slide we're leaving
    const prevVid = stackEl.children[currentSlide]?.querySelector("video");
    if (prevVid) {
      try {
        prevVid.pause();
      } catch {}
    }
    Array.from(stackEl.children).forEach((s, j) =>
      s.classList.toggle("is-active", j === next)
    );
    currentSlide = next;
    sessionStorage.setItem("sa-blava.gallery.slide", String(currentSlide));
    hydrateSlide(currentSlide);
    // Preload immediate neighbours so a swipe shows instantly
    hydrateSlide(currentSlide + 1);
    hydrateSlide(currentSlide - 1);
    renderCounter();
  }

  function renderCounter() {
    counterEl.textContent =
      gallery.length > 0
        ? t("gallery.counter", currentSlide + 1, gallery.length)
        : "";
  }

  hydrateSlide(currentSlide);
  hydrateSlide(currentSlide + 1);
  hydrateSlide(currentSlide - 1);
  renderCounter();

  screen
    .querySelector(".gallery-screen__close")
    .addEventListener("click", () => {
      // history.back keeps the natural stack so iOS swipe-back also works
      if (history.length > 1) history.back();
      else navigate(`/route/${routeId}/poi/${poiIndex}`);
    });

  // After a real swipe the browser still fires a synthetic `click` at the
  // touchend position — left-swipes ending on the left edge would then trip
  // the tap-zone handler below and cancel the swipe out. We stamp a
  // suppression window when the swipe fires and the click handler honours it.
  let suppressClickUntil = 0;

  // Swipe between slides on the media area only — the header tap should not
  // accidentally advance, and the counter row is unimportant.
  attachSwipe(mediaEl, {
    onLeft: () => {
      suppressClickUntil = Date.now() + 350;
      showSlide(currentSlide + 1);
    },
    onRight: () => {
      suppressClickUntil = Date.now() + 350;
      showSlide(currentSlide - 1);
    },
  });

  // Instagram-stories-style tap zones: left half → previous slide, right
  // half → next slide. Taps on the <video> element are ignored so the
  // browser's native controls (play/pause, seek, fullscreen) keep working.
  // attachSwipe ignores movement < 60 px so a plain tap still fires `click`.
  mediaEl.addEventListener("click", (e) => {
    if (Date.now() < suppressClickUntil) return;
    if (e.target instanceof HTMLVideoElement) return;
    const rect = mediaEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 2) showSlide(currentSlide - 1);
    else showSlide(currentSlide + 1);
  });

  function teardown() {
    // Pause any in-flight video before the screen leaves the DOM so its
    // audio (if it ever unmutes) doesn't keep playing while the next screen
    // animates in.
    const v = stackEl.querySelector("video");
    if (v) {
      try {
        v.pause();
      } catch {}
    }
    screen.classList.remove("is-active");
    setTimeout(() => screen.remove(), 280);
  }

  return {
    name: "gallery",
    routeId,
    poiIndex,
    teardown,
  };
}

// Lightweight horizontal-swipe detector — shared shape with the one in poi.js
// but kept local so gallery.js is standalone.
function attachSwipe(el, { onLeft, onRight, threshold = 60 }) {
  let startX = 0;
  let startY = 0;
  let active = false;

  function start(x, y) {
    startX = x;
    startY = y;
    active = true;
  }
  function end(x, y) {
    if (!active) return;
    active = false;
    const dx = x - startX;
    const dy = y - startY;
    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) onLeft?.();
    else onRight?.();
  }

  el.addEventListener(
    "touchstart",
    (e) => {
      const t0 = e.touches[0];
      start(t0.clientX, t0.clientY);
    },
    { passive: true }
  );
  el.addEventListener(
    "touchend",
    (e) => {
      const t0 = e.changedTouches[0];
      end(t0.clientX, t0.clientY);
    },
    { passive: true }
  );

  el.addEventListener("mousedown", (e) => start(e.clientX, e.clientY));
  el.addEventListener("mouseup", (e) => end(e.clientX, e.clientY));
  el.addEventListener("mouseleave", () => {
    active = false;
  });
}

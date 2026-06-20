// Screen 4 — POI details (Paper A1P-1).
//
// Markup + inline styles for the card come from Paper's get_jsx of A1P-1.
// On top of that this screen adds, per user request:
//   • Live Mapbox map as the full-bleed background.
//   • POI markers as 32×32 thumbnails (the POI's first image) wearing a
//     4-px white ring; the active POI gets a teal ring + scale-up.
//   • The card is a fixed-height (60vh) iOS-style bottom sheet that scrolls
//     internally. Tap the drag handle (or the title row when collapsed) to
//     fold the sheet to header-only.
//   • Three distance rows under the description: from start, from previous
//     POI, from next POI (km + minutes).
//   • Horizontal swipe (and the existing next-arrow) to move between POIs.

import { findRoute } from "../data.js";
import { t, getLanguage } from "../i18n.js";
import { navigate } from "../router.js";
import { MAPBOX_TOKEN, MAPBOX_STYLE, MAPBOX_SATELLITE_STYLE } from "../config.js";
import { addRouteTrack } from "./map.js";

const ICON_BACK = `<img src="./assets/icons/regular/CaretLeft.svg" width="24" height="24" style="flex-shrink:0" alt="" aria-hidden="true" />`;

const ICON_NEXT = `<img src="./assets/icons/regular/ArrowRight.svg" width="24" height="24" style="flex-shrink:0" alt="" aria-hidden="true" />`;

const ICON_PREV = `<img src="./assets/icons/regular/ArrowLeft.svg" width="24" height="24" style="flex-shrink:0" alt="" aria-hidden="true" />`;

const ICON_STACK = `<img src="./assets/icons/regular/Stack.svg" width="24" height="24" style="flex-shrink:0" alt="" aria-hidden="true" />`;

const ICON_STACK_FILLED = `<img src="./assets/icons/regular/Stack-filled.svg" width="24" height="24" style="flex-shrink:0" alt="" aria-hidden="true" />`;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// Great-circle distance in km between [lon, lat] pairs.
function haversineKm([lon1, lat1], [lon2, lat2]) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function formatKm(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function renderPoiScreen(host, routeId, poiIndex) {
  const route = findRoute(routeId);
  if (!route || !route.pois || route.pois.length === 0) {
    navigate("/routes");
    return { name: "poi", teardown() {} };
  }
  let currentIndex = clamp(poiIndex, 0, route.pois.length - 1);
  let isCollapsed = false;
  let isSatellite = false;
  const lang = getLanguage();

  const screen = document.createElement("section");
  screen.className = "screen poi-screen";
  screen.dataset.screen = "poi";
  host.appendChild(screen);
  requestAnimationFrame(() => screen.classList.add("is-active"));

  // Layer 1 — Mapbox map (full bleed)
  const mapEl = document.createElement("div");
  mapEl.className = "poi-screen__map";
  screen.appendChild(mapEl);

  // Layer 2 — back button (top-left, over the map)
  const headerEl = document.createElement("div");
  headerEl.className = "poi-screen__header";
  headerEl.innerHTML = `
    <button class="poi-screen__back" type="button" aria-label="${t("route.back")}">
      ${ICON_BACK}
    </button>
  `;
  screen.appendChild(headerEl);

  // Layer 3 — POI card (collapsible bottom sheet)
  const cardEl = document.createElement("section");
  cardEl.className = "poi-screen__card";
  screen.appendChild(cardEl);

  // Mapbox handle + markers, populated on load
  let map = null;
  const markers = new Map(); // poiId -> mapboxgl.Marker

  // Carousel state machine for the POI media slot. Replaced on every
  // buildCard() (i.e. when navigating between POIs) — must be destroyed
  // first so its timers and video pause handlers detach cleanly.
  let carousel = null;

  function buildCard() {
    const poi = route.pois[currentIndex];
    const poiName = poi.name[lang] ?? poi.name.ca;
    const description =
      poi.description?.[lang] ?? t("poi.description.placeholder");
    const numberLabel = String(currentIndex + 1).padStart(2, "0");

    const prevPoi = currentIndex > 0 ? route.pois[currentIndex - 1] : null;
    const nextPoi =
      currentIndex < route.pois.length - 1
        ? route.pois[currentIndex + 1]
        : null;

    const firstPoi = route.pois[0];
    const kmFromStart = haversineKm(firstPoi.coords, poi.coords);
    const minFromStart = poi.minutesFromStart ?? 0;

    const kmFromPrev = prevPoi ? haversineKm(prevPoi.coords, poi.coords) : null;
    const minFromPrev = prevPoi
      ? Math.max(0, (poi.minutesFromStart ?? 0) - (prevPoi.minutesFromStart ?? 0))
      : null;

    const kmToNext = nextPoi ? haversineKm(poi.coords, nextPoi.coords) : null;
    const minToNext = nextPoi
      ? Math.max(0, (nextPoi.minutesFromStart ?? 0) - (poi.minutesFromStart ?? 0))
      : null;

    const gallery = poi.gallery ?? [];
    const slidesHTML = gallery
      .map((item, i) => {
        const cls = `poi-carousel__slide${i === 0 ? " is-active" : ""}`;
        if (item.type === "video") {
          // muted+playsinline so iOS allows inline autoplay; preload metadata so
          // the poster frame is available without downloading the full video
          // until the slide actually becomes active.
          const poster = item.poster ? ` poster="${item.poster}"` : "";
          return `
            <div class="${cls}" data-slide="${i}" data-type="video">
              <video class="poi-carousel__video" src="${item.src}"${poster} muted playsinline preload="metadata"></video>
            </div>
          `;
        }
        return `
          <div class="${cls}" data-slide="${i}" data-type="image">
            <img class="poi-carousel__img" src="${item.src}" alt="" loading="${i === 0 ? "eager" : "lazy"}" />
          </div>
        `;
      })
      .join("");

    const dotsHTML =
      gallery.length > 1
        ? `<div class="poi-carousel__dots" aria-hidden="true">${gallery
            .map(
              (_, i) =>
                `<span class="poi-carousel__dot${i === 0 ? " is-active" : ""}" data-dot="${i}"></span>`
            )
            .join("")}</div>`
        : "";

    cardEl.innerHTML = `
      <div class="poi-card__handle" role="button" tabindex="0" aria-label="Mostra o oculta el detall"></div>

      <button class="poi-screen__map-toggle" type="button" aria-label="${t("map.toggleLayer")}" aria-pressed="${isSatellite}">
        ${isSatellite ? ICON_STACK_FILLED : ICON_STACK}
      </button>

      <div class="poi-card-row poi-card__title-row">
        <div class="poi-card__heading">
          <span class="poi-card__number">${numberLabel}</span>
          <span class="poi-card__name">${poiName}</span>
        </div>
        <div class="poi-card__nav">
          ${
            prevPoi
              ? `<button class="poi-card__nav-btn" data-dir="prev" type="button" aria-label="${t("poi.prev")}">${ICON_PREV}</button>`
              : ""
          }
          ${
            nextPoi
              ? `<button class="poi-card__nav-btn" data-dir="next" type="button" aria-label="${t("poi.next")}">${ICON_NEXT}</button>`
              : ""
          }
        </div>
      </div>

      <div class="poi-card__scroll">
        <button class="poi-card__media" type="button" aria-label="${t("poi.openGallery")}">
          <div class="poi-carousel">${slidesHTML}</div>
          ${dotsHTML}
        </button>

        <div class="poi-card__description">${description}</div>

        <ul class="poi-card__distances">
          <li class="poi-card__distance">
            <span class="poi-card__distance-label">${t("poi.dist.fromStart")}</span>
            <span class="poi-card__distance-value">${formatKm(kmFromStart)} · ${t("poi.dist.minutes", minFromStart)}</span>
          </li>
          ${
            prevPoi
              ? `<li class="poi-card__distance">
                  <span class="poi-card__distance-label">${t("poi.dist.fromPrev", prevPoi.name[lang] ?? prevPoi.name.ca)}</span>
                  <span class="poi-card__distance-value">${formatKm(kmFromPrev)} · ${t("poi.dist.minutes", minFromPrev)}</span>
                </li>`
              : ""
          }
          ${
            nextPoi
              ? `<li class="poi-card__distance">
                  <span class="poi-card__distance-label">${t("poi.dist.toNext", nextPoi.name[lang] ?? nextPoi.name.ca)}</span>
                  <span class="poi-card__distance-value">${formatKm(kmToNext)} · ${t("poi.dist.minutes", minToNext)}</span>
                </li>`
              : ""
          }
        </ul>
      </div>
    `;

    const prevBtn = cardEl.querySelector('.poi-card__nav-btn[data-dir="prev"]');
    if (prevBtn) {
      prevBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        goTo(currentIndex - 1);
      });
    }
    const nextBtn = cardEl.querySelector('.poi-card__nav-btn[data-dir="next"]');
    if (nextBtn) {
      nextBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        goTo(currentIndex + 1);
      });
    }

    const layerToggleEl = cardEl.querySelector(".poi-screen__map-toggle");
    layerToggleEl.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSatellite();
    });
    // Prevent the surrounding card from interpreting a tap on this button as
    // a swipe-start or a collapsed-title tap-to-expand.
    layerToggleEl.addEventListener("pointerdown", (e) => e.stopPropagation());
    layerToggleEl.addEventListener("touchstart", (e) => e.stopPropagation(), {
      passive: true,
    });
    layerToggleEl.addEventListener("mousedown", (e) => e.stopPropagation());

    const handleEl = cardEl.querySelector(".poi-card__handle");
    attachSheetDrag(handleEl);
    handleEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleCollapse();
      }
    });

    // When collapsed, tapping anywhere on the title row (outside the nav
    // buttons, which stop propagation) expands the sheet — feels iOS-ish.
    const titleRow = cardEl.querySelector(".poi-card__title-row");
    titleRow.addEventListener("click", () => {
      if (isCollapsed) toggleCollapse();
    });

    // Wire up the media carousel — autoplay every 3s for images, full-length
    // playback for videos, then advance. Tap the frame to open the gallery.
    if (carousel) carousel.destroy();
    const mediaEl = cardEl.querySelector(".poi-card__media");
    carousel = attachCarousel(mediaEl, gallery, (slideIndex) => {
      sessionStorage.setItem("sa-blava.gallery.slide", String(slideIndex));
      navigate(`/route/${routeId}/poi/${currentIndex}/gallery`);
    });

    recalcPeek();
  }

  function goTo(targetIndex) {
    const next = clamp(targetIndex, 0, route.pois.length - 1);
    if (next === currentIndex) return;
    currentIndex = next;
    history.replaceState(null, "", `#/route/${routeId}/poi/${currentIndex}`);
    buildCard();
    focusMapOnCurrentPoi();
  }

  // Visible height of the bottom sheet, in CSS pixels.
  //   • Expanded → 60% of the viewport (matches the CSS height).
  //   • Collapsed → just the header strip; we read the JS-set CSS var.
  function sheetVisibleHeightPx() {
    if (isCollapsed) {
      const v = parseFloat(
        getComputedStyle(cardEl).getPropertyValue("--poi-collapsed-peek")
      );
      return Number.isFinite(v) ? v : 96;
    }
    return Math.round(window.innerHeight * 0.6);
  }

  // Re-frame the map so the active POI sits in the middle of the *visible*
  // map band — i.e., the strip above the sheet — instead of behind it.
  // Mapbox's `offset` shifts the target center from the geometric screen
  // center by N pixels; we move it up by half the sheet's visible height.
  function focusMapOnCurrentPoi() {
    if (!map) return;
    const poi = route.pois[currentIndex];
    const offsetY = -sheetVisibleHeightPx() / 2;
    map.easeTo({
      center: poi.coords,
      zoom: 15.5,
      offset: [0, offsetY],
      duration: 600,
    });
    for (const [id, marker] of markers) {
      const el = marker.getElement();
      el.classList.toggle("is-active", id === poi.id);
    }
  }

  function toggleCollapse() {
    isCollapsed = !isCollapsed;
    cardEl.classList.toggle("is-collapsed", isCollapsed);
    // Visible band changed — re-frame the map for the new center.
    focusMapOnCurrentPoi();
  }

  // Swap between the outdoor base map and the satellite-streets style.
  // setStyle wipes user-added sources/layers (the GPX track lives in those),
  // but mapboxgl.Marker instances are DOM and persist — the `style.load`
  // listener below re-adds the track every time a new style finishes loading.
  function toggleSatellite() {
    if (!map) return;
    isSatellite = !isSatellite;
    const btn = cardEl.querySelector(".poi-screen__map-toggle");
    if (btn) {
      btn.innerHTML = isSatellite ? ICON_STACK_FILLED : ICON_STACK;
      btn.setAttribute("aria-pressed", String(isSatellite));
    }
    map.setStyle(isSatellite ? MAPBOX_SATELLITE_STYLE : MAPBOX_STYLE);
  }

  // Measure the header strip (handle + title row) and stash it on the card
  // as --poi-collapsed-peek, which the CSS uses for the translateY offset.
  function recalcPeek() {
    const titleRowEl = cardEl.querySelector(".poi-card__title-row");
    if (!titleRowEl) return;
    const cardRect = cardEl.getBoundingClientRect();
    const titleRect = titleRowEl.getBoundingClientRect();
    const peek = Math.ceil(titleRect.bottom - cardRect.top) + 16;
    cardEl.style.setProperty("--poi-collapsed-peek", `${peek}px`);
  }

  // Drag-to-resize: pointerdown on the handle starts a drag, pointermove
  // tracks the finger 1:1 (transitions are paused via .is-dragging), and
  // pointerup snaps to whichever state the drag ended closer to. A tap
  // (no real movement) just toggles. Pointer events cover mouse/touch/pen.
  function attachSheetDrag(handleEl) {
    let dragging = false;
    let wasDragging = false;
    let startY = 0;
    let startTranslate = 0;
    let activePointerId = null;

    function maxOffset() {
      const peek = parseFloat(
        getComputedStyle(cardEl).getPropertyValue("--poi-collapsed-peek")
      );
      const h = cardEl.getBoundingClientRect().height;
      return Math.max(0, h - (Number.isFinite(peek) ? peek : 96));
    }

    handleEl.addEventListener("pointerdown", (e) => {
      if (dragging) return;
      if (e.button && e.button !== 0) return;
      dragging = true;
      wasDragging = false;
      activePointerId = e.pointerId;
      startY = e.clientY;
      startTranslate = isCollapsed ? maxOffset() : 0;
      try {
        handleEl.setPointerCapture(activePointerId);
      } catch {}
      cardEl.classList.add("is-dragging");
    });

    handleEl.addEventListener("pointermove", (e) => {
      if (!dragging || e.pointerId !== activePointerId) return;
      const dy = e.clientY - startY;
      if (Math.abs(dy) > 6) wasDragging = true;
      const next = Math.max(0, Math.min(maxOffset(), startTranslate + dy));
      cardEl.style.transform = `translateY(${next}px)`;
    });

    function finish(e) {
      if (!dragging || e.pointerId !== activePointerId) return;
      dragging = false;
      try {
        handleEl.releasePointerCapture(activePointerId);
      } catch {}
      activePointerId = null;

      const dy = e.clientY - startY;
      const max = maxOffset();
      let shouldCollapse;
      if (!wasDragging) {
        shouldCollapse = !isCollapsed;
      } else if (max <= 0) {
        shouldCollapse = isCollapsed;
      } else {
        const ratio = Math.min(1, Math.max(0, (startTranslate + dy) / max));
        shouldCollapse = ratio > 0.5;
      }

      if (shouldCollapse !== isCollapsed) {
        isCollapsed = shouldCollapse;
        cardEl.classList.toggle("is-collapsed", isCollapsed);
        focusMapOnCurrentPoi();
      }

      // Re-enable transition, then clear the inline transform so the
      // class-driven transform takes over and the sheet animates the rest
      // of the way to its snap target.
      cardEl.classList.remove("is-dragging");
      cardEl.style.transform = "";
      wasDragging = false;
    }

    handleEl.addEventListener("pointerup", finish);
    handleEl.addEventListener("pointercancel", finish);
  }

  // Back button → previous route screen
  headerEl
    .querySelector(".poi-screen__back")
    .addEventListener("click", () => navigate(`/route/${routeId}`));

  // Swipe gesture on the card (left = next, right = prev)
  attachSwipe(cardEl, {
    onLeft: () => goTo(currentIndex + 1),
    onRight: () => goTo(currentIndex - 1),
  });

  buildCard();

  // Mount Mapbox
  if (typeof mapboxgl !== "undefined" && MAPBOX_TOKEN) {
    mapboxgl.accessToken = MAPBOX_TOKEN;
    map = new mapboxgl.Map({
      container: mapEl,
      style: MAPBOX_STYLE,
      center: route.pois[currentIndex].coords,
      zoom: 15.5,
      attributionControl: false,
      interactive: true,
    });

    // Track lives in user-added sources/layers, which setStyle wipes — so
    // re-add it on every style.load (fires for the initial style AND for
    // every setStyle call from the layer toggle).
    map.on("style.load", () => {
      if (route.track && route.track.length > 1) {
        addRouteTrack(map, route);
      }
    });

    map.on("load", () => {
      // Markers — thumbnails using each POI's `mapThumbnail` override (for
      // POIs whose first gallery item is a video) or first image. The active POI
      // is styled in CSS via `.is-active` (grows to 40×40). Tapping any
      // marker jumps to that POI.
      route.pois.forEach((p, idx) => {
        const el = document.createElement("div");
        el.className = "poi-marker";
        const img = p.mapThumbnail ?? p.gallery?.[0]?.src;
        if (img) el.style.backgroundImage = `url("${img}")`;
        if (p.id === route.pois[currentIndex].id) {
          el.classList.add("is-active");
        }
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          if (idx !== currentIndex) goTo(idx);
        });
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat(p.coords)
          .addTo(map);
        markers.set(p.id, marker);
      });

      // First-frame framing: shift the initial center up so the POI lands
      // above the sheet rather than behind it.
      focusMapOnCurrentPoi();
    });
  } else {
    // No Mapbox available — keep the teal placeholder background
    mapEl.classList.add("poi-screen__map--placeholder");
  }

  function teardown() {
    if (carousel) {
      carousel.destroy();
      carousel = null;
    }
    if (map) {
      try {
        map.remove();
      } catch {}
      map = null;
    }
    screen.classList.remove("is-active");
    setTimeout(() => screen.remove(), 280);
  }

  return {
    name: "poi",
    routeId,
    poiIndex: currentIndex,
    teardown,
  };
}

// Media carousel for the POI sheet. One slide per `gallery` item.
//   • Images sit on the slide for 3 seconds, then advance.
//   • Videos play to their natural end (muted+playsinline so iOS allows
//     inline autoplay); on `ended` we advance. Failed autoplay falls back
//     to the 3-second image timer so the carousel never gets stuck.
//   • The wrapper button is tappable: a clean tap on the frame opens the
//     full-screen gallery at the currently visible slide.
//   • destroy() must be called whenever the parent rebuilds (POI nav, screen
//     teardown). It clears the timer, pauses videos, and detaches listeners.
const SLIDE_MS = 3000;

function attachCarousel(rootEl, gallery, onTapGallery) {
  if (!rootEl || gallery.length === 0) {
    return { destroy() {}, current: () => 0 };
  }

  const slides = Array.from(rootEl.querySelectorAll(".poi-carousel__slide"));
  const dots = Array.from(rootEl.querySelectorAll(".poi-carousel__dot"));
  const videos = slides.map((s) => s.querySelector("video"));
  let current = 0;
  let timer = null;
  let destroyed = false;

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function setActive(i) {
    if (destroyed) return;
    const prev = current;
    current = ((i % gallery.length) + gallery.length) % gallery.length;
    slides.forEach((s, j) => s.classList.toggle("is-active", j === current));
    dots.forEach((d, j) => d.classList.toggle("is-active", j === current));

    if (prev !== current && videos[prev]) {
      try {
        videos[prev].pause();
        videos[prev].currentTime = 0;
      } catch {}
    }

    schedule();
  }

  function next() {
    setActive(current + 1);
  }

  function schedule() {
    clearTimer();
    const item = gallery[current];
    const v = videos[current];
    if (item.type === "video" && v) {
      try {
        v.currentTime = 0;
      } catch {}
      const p = v.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          // Autoplay refused (rare with muted+playsinline) — fall back to
          // the image cadence so the carousel keeps moving.
          if (!destroyed) timer = setTimeout(next, SLIDE_MS);
        });
      }
    } else {
      timer = setTimeout(next, SLIDE_MS);
    }
  }

  videos.forEach((v, i) => {
    if (!v) return;
    v.addEventListener("ended", () => {
      if (!destroyed && i === current) next();
    });
  });

  dots.forEach((d, i) => {
    d.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      setActive(i);
    });
  });

  rootEl.addEventListener("click", (e) => {
    if (e.target.closest(".poi-carousel__dot")) return;
    onTapGallery?.(current);
  });

  schedule();

  return {
    destroy() {
      destroyed = true;
      clearTimer();
      videos.forEach((v) => {
        if (!v) return;
        try {
          v.pause();
        } catch {}
      });
    },
    current: () => current,
  };
}

// Horizontal swipe detector — left/right swipes on touch and mouse drag.
// Vertical drags are ignored so the inner description text remains tappable.
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

  // Don't swallow gestures that began on the sheet's drag handle — those
  // belong to attachSheetDrag (vertical resize), not to prev/next swipe.
  function isOnHandle(target) {
    return !!(target && target.closest && target.closest(".poi-card__handle"));
  }

  el.addEventListener(
    "touchstart",
    (e) => {
      if (isOnHandle(e.target)) return;
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

  el.addEventListener("mousedown", (e) => {
    if (isOnHandle(e.target)) return;
    start(e.clientX, e.clientY);
  });
  el.addEventListener("mouseup", (e) => end(e.clientX, e.clientY));
  el.addEventListener("mouseleave", () => {
    active = false;
  });
}

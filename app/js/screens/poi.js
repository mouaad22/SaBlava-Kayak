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
import { MAPBOX_TOKEN, MAPBOX_STYLE } from "../config.js";

const ICON_BACK = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:24px;height:24px;flex-shrink:0" aria-hidden="true"><path d="M10 3L5 8L10 13" stroke="#1A1A1A" stroke-width="2" stroke-linecap="round"/></svg>`;

const ICON_NEXT = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0" aria-hidden="true"><path d="M21.046 12.796L14.296 19.546C14.085 19.757 13.798 19.876 13.499 19.876C13.2 19.876 12.914 19.757 12.702 19.546C12.491 19.334 12.372 19.048 12.372 18.749C12.372 18.45 12.491 18.163 12.702 17.952L17.531 13.125H3.75C3.452 13.125 3.165 13.006 2.954 12.795C2.744 12.584 2.625 12.298 2.625 12C2.625 11.702 2.744 11.415 2.954 11.204C3.165 10.993 3.452 10.875 3.75 10.875H17.531L12.704 6.045C12.493 5.834 12.374 5.547 12.374 5.248C12.374 4.949 12.493 4.663 12.704 4.451C12.915 4.24 13.202 4.121 13.501 4.121C13.8 4.121 14.086 4.24 14.298 4.451L21.048 11.201C21.153 11.306 21.236 11.43 21.293 11.567C21.349 11.704 21.378 11.851 21.378 11.999C21.378 12.147 21.349 12.294 21.292 12.431C21.235 12.567 21.151 12.691 21.046 12.796Z" fill="#1A1A1A"/></svg>`;

// Mirrored ICON_NEXT — same chunky arrow glyph, scaled horizontally so it
// reads as a left-pointing twin of the "next" button.
const ICON_PREV = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;transform:scaleX(-1)" aria-hidden="true"><path d="M21.046 12.796L14.296 19.546C14.085 19.757 13.798 19.876 13.499 19.876C13.2 19.876 12.914 19.757 12.702 19.546C12.491 19.334 12.372 19.048 12.372 18.749C12.372 18.45 12.491 18.163 12.702 17.952L17.531 13.125H3.75C3.452 13.125 3.165 13.006 2.954 12.795C2.744 12.584 2.625 12.298 2.625 12C2.625 11.702 2.744 11.415 2.954 11.204C3.165 10.993 3.452 10.875 3.75 10.875H17.531L12.704 6.045C12.493 5.834 12.374 5.547 12.374 5.248C12.374 4.949 12.493 4.663 12.704 4.451C12.915 4.24 13.202 4.121 13.501 4.121C13.8 4.121 14.086 4.24 14.298 4.451L21.048 11.201C21.153 11.306 21.236 11.43 21.293 11.567C21.349 11.704 21.378 11.851 21.378 11.999C21.378 12.147 21.349 12.294 21.292 12.431C21.235 12.567 21.151 12.691 21.046 12.796Z" fill="#1A1A1A"/></svg>`;

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

    const heroImage = poi.images?.[0] ?? "";

    cardEl.innerHTML = `
      <div class="poi-card__handle" role="button" tabindex="0" aria-label="Mostra o oculta el detall"></div>

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
        <div class="poi-card__media">
          <div class="poi-card__media-inner" style="background-image:url('${heroImage}')"></div>
        </div>

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

    map.on("load", () => {
      // Markers — thumbnails using each POI's first image. The active POI
      // is styled in CSS via `.is-active` (grows to 40×40). Tapping any
      // marker jumps to that POI.
      route.pois.forEach((p, idx) => {
        const el = document.createElement("div");
        el.className = "poi-marker";
        const img = p.images?.[0];
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

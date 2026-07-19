// Screen 3 — Route details (Paper AZH-0 + AQB-0).
//
// Layout, copy, and inline styles come from Paper's get_jsx. Interactions
// added on top per spec:
//   • Horizontal POI carousel; as a card scrolls into the centre the map
//     illustration swaps to mapa-ruta/map-ruta-{routeId}-{N}.webp (falls back
//     to N=1 when the indexed file 404s).
//   • Duració chip opens a bottom sheet; selection persists per-route in
//     localStorage and filters how many POIs are shown
//     (1h → 6, 1h30 / 2h → 8, 3h → 9).
//   • POI card tap → /route/:id/poi/:i (POI detail screen built in session 4).
//   • "Comença ruta" opens the Phase-2 safety+code modal → summary → navigate.

import { findRoute } from "../data.js";
import { t, getLanguage } from "../i18n.js";
import { navigate } from "../router.js";

const FALLBACK_DURATIONS = {
  available: ["1h", "1h30", "2h", "3h"],
  countByDuration: { "1h": 5, "1h30": 8, "2h": 8, "3h": 9 },
  default: "3h",
};
function durationKey(routeId) {
  return `sa-blava.duration.${routeId}`;
}
function loadDuration(routeId, durations) {
  try {
    const saved = localStorage.getItem(durationKey(routeId));
    if (saved && durations.countByDuration[saved] !== undefined) return saved;
  } catch {}
  return durations.default;
}
function saveDuration(routeId, id) {
  try {
    localStorage.setItem(durationKey(routeId), id);
  } catch {}
}

// Compact, language-neutral labels for the segmented duration control.
const DURATION_SHORT = { "1h": "1h", "1h30": "90m", "2h": "2h", "3h": "3h" };

const ICON_BACK = `<img src="./assets/icons/regular/CaretLeft.svg" width="24" height="24" alt="" aria-hidden="true" />`;

const ICON_MAP = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M21.461 4.659C21.371 4.589 21.267 4.54 21.155 4.516C21.044 4.493 20.929 4.495 20.818 4.523L15.087 5.955L9.336 3.079C9.175 2.999 8.992 2.979 8.818 3.023L2.818 4.523C2.656 4.563 2.512 4.657 2.409 4.789C2.306 4.92 2.25 5.083 2.25 5.25V18.75C2.25 18.864 2.276 18.977 2.326 19.079C2.376 19.181 2.449 19.271 2.538 19.341C2.628 19.411 2.733 19.46 2.844 19.484C2.956 19.507 3.071 19.505 3.182 19.478L8.913 18.045L14.664 20.921C14.769 20.973 14.884 21 15 21C15.061 21 15.122 20.992 15.182 20.978L21.182 19.478C21.344 19.437 21.488 19.343 21.591 19.212C21.694 19.08 21.75 18.917 21.75 18.75V5.25C21.75 5.136 21.724 5.023 21.674 4.921C21.624 4.818 21.551 4.729 21.461 4.659ZM9 16.5C8.939 16.5 8.878 16.508 8.818 16.523L3.75 17.789V5.836L8.913 4.545L9 4.588V16.5ZM20.25 18.164L15.087 19.455L15 19.412V7.5C15.061 7.5 15.122 7.493 15.182 7.479L20.25 6.211V18.164Z" fill="#1E5670"/></svg>`;

const ICON_KITE = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true"><path d="M0.75 11.398C0.752 11.715 0.856 12.023 1.047 12.276C1.237 12.529 1.504 12.714 1.808 12.804L1.827 12.81L9.139 14.857L11.187 22.17L11.192 22.189C11.282 22.493 11.468 22.759 11.721 22.95C11.974 23.141 12.282 23.245 12.599 23.247H12.627C12.938 23.25 13.241 23.155 13.495 22.976C13.748 22.796 13.939 22.541 14.04 22.247L20.156 5.757C20.158 5.752 20.159 5.747 20.16 5.742C20.252 5.477 20.267 5.191 20.204 4.917C20.141 4.644 20.002 4.393 19.804 4.195C19.606 3.996 19.356 3.857 19.082 3.793C18.809 3.729 18.523 3.744 18.257 3.834L18.242 3.839L1.75 9.957C1.451 10.059 1.193 10.254 1.013 10.514C0.833 10.773 0.741 11.083 0.75 11.398Z" fill="#FFFFFF"/></svg>`;

function poiDescription(poi, lang) {
  if (poi.description && poi.description[lang]) return poi.description[lang];
  return t("poi.description.placeholder");
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function poiCardHTML(poi, idx, lang, visible) {
  return `
    <article class="poi-card${visible ? "" : " is-hidden"}" data-poi-index="${idx}" role="button" tabindex="0" aria-label="${poi.name[lang]}">
      <div class="poi-card__media" style="background-image:url('${poi.thumbnail ?? poi.gallery?.[0]?.src ?? ""}')"></div>
      <div class="poi-card__heading">
        <span class="poi-card__number">${pad2(idx + 1)}</span>
        <span class="poi-card__title">${poi.name[lang]}</span>
      </div>
      <p class="poi-card__desc">${poiDescription(poi, lang)}</p>
    </article>
  `;
}

function templateHTML(route, lang, durationId, durations) {
  const visibleCount = durations.countByDuration[durationId];
  return `
    <header class="route-screen__header">
      <button class="route-screen__back" type="button" data-action="back" aria-label="${t("route.back")}">${ICON_BACK}</button>
      <h1 class="route-screen__heading">${route.name[lang]}</h1>
    </header>

    <div class="route-screen__scroll">
      <section class="route-screen__section">
        <div class="route-map" role="img" aria-label="${route.name[lang]}">
          <div class="route-map__image" data-route-map>
            <div class="route-map__base" data-map-base></div>
            <div class="route-map__layer" data-map-layer></div>
            <div class="route-map__layer" data-map-layer></div>
          </div>
          <div class="route-map__title-bar">
            <div class="duration-bar" role="group" aria-label="${t("route.duration.title")}">
              <span class="duration-bar__label">${t("route.duration.title")}</span>
              <div class="duration-bar__segments">
                ${durations.available
                  .map(
                    (id) =>
                      `<button class="duration-seg${id === durationId ? " is-selected" : ""}" type="button" data-duration-id="${id}" aria-pressed="${id === durationId}">${DURATION_SHORT[id] ?? id}</button>`
                  )
                  .join("")}
              </div>
            </div>
          </div>
        </div>

        <div class="poi-carousel" data-poi-carousel>
          ${route.pois
            .map((poi, idx) => poiCardHTML(poi, idx, lang, idx < visibleCount))
            .join("")}
        </div>
      </section>
    </div>

    <div class="route-screen__cta">
      <button class="map-cta-button" type="button" data-action="open-map" aria-label="${t("route.fullmap")}">
        <span class="map-cta-button__icon">${ICON_MAP}</span>
        <span class="map-cta-button__label">${t("route.mapLabel")}</span>
      </button>
      <button class="start-button" type="button" data-action="start">
        ${ICON_KITE}
        <span class="start-button__label">${t("route.start")}</span>
      </button>
    </div>
  `;
}

export function renderRouteScreen(host, routeId) {
  const route = findRoute(routeId);
  if (!route) {
    navigate("/routes");
    return { teardown() {} };
  }
  const lang = getLanguage();
  const durations = route.durations ?? FALLBACK_DURATIONS;
  let durationId = loadDuration(routeId, durations);

  const screen = document.createElement("section");
  screen.className = "screen route-screen";
  screen.dataset.screen = "route";
  screen.dataset.routeId = routeId;
  screen.innerHTML = templateHTML(route, lang, durationId, durations);
  host.appendChild(screen);

  // --- Map illustration: a base JPG (one per duration) with a per-POI SVG
  //     overlay stacked on top. As the carousel scrolls only the overlay
  //     swaps; the base is re-set whenever the duration changes (different
  //     illustrated maps exist for 1h / 1h30+2h / 3h).
  const mapEl = screen.querySelector("[data-route-map]");
  const baseEl = mapEl.querySelector("[data-map-base]");
  const mapLayers = [...mapEl.querySelectorAll("[data-map-layer]")];
  const carousel = screen.querySelector("[data-poi-carousel]");

  function mapForDuration(id) {
    return route.mapByDuration?.[id] ?? null;
  }
  function overlayUrlAt(map, idx) {
    return encodeURI(map.overlay.replace("{i}", String(idx + 1)));
  }

  let currentMap = mapForDuration(durationId);

  function setBaseImage() {
    if (!currentMap) return;
    baseEl.style.backgroundImage = `url("${encodeURI(currentMap.base)}")`;
  }
  setBaseImage();

  function preloadCurrentMap() {
    if (!currentMap) return;
    const baseImg = new Image();
    baseImg.src = encodeURI(currentMap.base);
    const count = durations.countByDuration[durationId] ?? route.pois.length;
    for (let i = 0; i < count; i++) {
      const im = new Image();
      im.src = overlayUrlAt(currentMap, i);
    }
  }
  preloadCurrentMap();

  // Double-buffered crossfade for the overlay: two stacked layers ping-pong so
  // the visible overlay is never cleared mid-swap. Swapping `background-image`
  // on a single element paints the box empty for a frame while the new image
  // re-decodes; instead we paint the next overlay onto the hidden layer and
  // fade it in over the old one, which stays on screen until the new one is
  // ready. The base JPG sits behind both and shows through the transparent SVG.
  let currentUrl = null;
  let front = 0; // index of the layer currently shown

  function crossfadeTo(url) {
    const back = mapLayers[front ^ 1];
    back.style.backgroundImage = `url("${url}")`;
    back.classList.add("is-visible");
    mapLayers[front].classList.remove("is-visible");
    front ^= 1;
  }

  function setMapOverlayForIndex(idx) {
    if (!currentMap) return;
    const url = overlayUrlAt(currentMap, idx);
    if (currentUrl === url) return;
    currentUrl = url;
    const probe = new Image();
    probe.onload = () => {
      if (currentUrl !== url) return; // a newer scroll already won
      crossfadeTo(url);
    };
    probe.onerror = () => {
      if (currentUrl !== url) return;
      const fallback = overlayUrlAt(currentMap, 0);
      currentUrl = fallback;
      crossfadeTo(fallback);
    };
    probe.src = url;
  }
  setMapOverlayForIndex(0);

  let activeIdx = 0;
  function markActive(idx) {
    carousel.querySelectorAll("[data-poi-index]").forEach((card) => {
      card.classList.toggle("is-active", Number(card.dataset.poiIndex) === idx);
    });
  }
  markActive(0);
  function recomputeActive() {
    const cards = carousel.querySelectorAll(
      "[data-poi-index]:not(.is-hidden)"
    );
    if (!cards.length) return;
    const r = carousel.getBoundingClientRect();
    const center = r.left + r.width / 2;
    let best = 0;
    let bestDist = Infinity;
    cards.forEach((card) => {
      const cardRect = card.getBoundingClientRect();
      const dist = Math.abs(cardRect.left + cardRect.width / 2 - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = Number(card.dataset.poiIndex);
      }
    });
    if (best !== activeIdx) {
      activeIdx = best;
      markActive(best);
      setMapOverlayForIndex(best);
    }
  }
  carousel.addEventListener("scroll", recomputeActive, { passive: true });

  // --- Scroll-linked header glass (S-06) -----------------------------------
  // --header-p goes 0 → 1 over the first 64px of scroll; the CSS derives the
  // header's translucency, backdrop blur, and shadow from it, so the glass
  // tracks the finger 1:1. The listener dies with the screen element.
  const headerEl = screen.querySelector(".route-screen__header");
  const headerScroller = screen.querySelector(".route-screen__scroll");
  function syncHeaderGlass() {
    const p = Math.min(1, headerScroller.scrollTop / 64);
    headerEl.style.setProperty("--header-p", p.toFixed(3));
  }
  headerScroller.addEventListener("scroll", syncHeaderGlass, { passive: true });
  syncHeaderGlass();

  // --- Header buttons -----------------------------------------------------
  screen
    .querySelector("[data-action=back]")
    .addEventListener("click", () => navigate("/routes"));

  // --- Open full-screen map ----------------------------------------------
  screen
    .querySelector("[data-action=open-map]")
    .addEventListener("click", () => navigate(`/route/${routeId}/map`));

  // --- POI cards → POI detail screen --------------------------------------
  carousel.querySelectorAll("[data-poi-index]").forEach((card) => {
    const go = () => {
      // Opened from the route carousel → back from the POI returns here.
      sessionStorage.setItem("sa-blava.poi.from", "route");
      navigate(`/route/${routeId}/poi/${card.dataset.poiIndex}`);
    };
    card.addEventListener("click", go);
    card.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        go();
      }
    });
  });

  // --- Duration segments: filter visible POIs + swap the illustrated map ---
  function applyDuration(id) {
    const visibleCount = durations.countByDuration[id];
    carousel.querySelectorAll("[data-poi-index]").forEach((card) => {
      card.classList.toggle(
        "is-hidden",
        Number(card.dataset.poiIndex) >= visibleCount
      );
    });
    screen.querySelectorAll(".duration-seg").forEach((seg) => {
      const selected = seg.dataset.durationId === id;
      seg.classList.toggle("is-selected", selected);
      seg.setAttribute("aria-pressed", String(selected));
    });
  }

  screen.querySelectorAll(".duration-seg").forEach((seg) => {
    seg.addEventListener("click", () => {
      const id = seg.dataset.durationId;
      if (id === durationId || durations.countByDuration[id] === undefined)
        return;
      durationId = id;
      saveDuration(routeId, id);
      applyDuration(id);
      // Pull the new map (base + overlay set), warm its cache, swap the base,
      // then refresh the overlay for the (possibly moved) centred POI.
      currentMap = mapForDuration(durationId);
      currentUrl = null;
      setBaseImage();
      preloadCurrentMap();
      requestAnimationFrame(() => {
        recomputeActive();
        setMapOverlayForIndex(activeIdx);
      });
    });
  });

  // --- CTA: navigate to code entry screen (Phase 2) -----------------------
  // Confirm pulse (S-07): the button plays a quick scale pulse, then the
  // navigation fires 180ms in — late enough to see the press-and-release,
  // early enough to feel instant.
  const startBtn = screen.querySelector("[data-action=start]");
  startBtn.addEventListener("click", () => {
    startBtn.classList.add("is-confirming");
    startBtn.addEventListener(
      "animationend",
      () => startBtn.classList.remove("is-confirming"),
      { once: true }
    );
    setTimeout(() => navigate(`/route/${routeId}/code`), 180);
  });

  requestAnimationFrame(() => {
    screen.classList.add("is-active");
    // Always land at the top of the scrollable section, never wherever a
    // previous mount left it.
    const scroller = screen.querySelector(".route-screen__scroll");
    if (scroller) scroller.scrollTop = 0;
  });

  return {
    name: "route",
    routeId,
    el: screen,
    teardown() {
      screen.classList.remove("is-active");
      setTimeout(() => screen.remove(), 320);
    },
  };
}

// Screen 3 — Route details (Paper AZH-0 + AQB-0).
//
// Layout, copy, and inline styles come from Paper's get_jsx. Interactions
// added on top per spec:
//   • Header next-route arrow toggles sud ↔ nord.
//   • Play button on the map runs a 5s circular border fill on click, looped.
//   • Horizontal POI carousel; as a card scrolls into the centre the map
//     illustration swaps to mapa-ruta/map-ruta-{routeId}-{N}.jpg (falls back
//     to N=1 when the indexed file 404s).
//   • Duració chip opens a bottom sheet; selection persists per-route in
//     localStorage and filters how many POIs are shown
//     (1h → 6, 1h30 / 2h → 8, 3h → 9).
//   • POI card tap → /route/:id/poi/:i (POI detail screen built in session 4).
//   • "Comença ruta" is a Phase-2 stub (console.log).

import { findRoute } from "../data.js";
import { t, getLanguage } from "../i18n.js";
import { navigate } from "../router.js";

const POI_COUNT_BY_DURATION = { "1h": 5, "1h30": 8, "2h": 8, "3h": 9 };
const DURATIONS = ["1h", "1h30", "2h", "3h"];
const DEFAULT_DURATION = "3h";
const ROUTE_TOGGLE = { sud: "nord", nord: "sud" };

function durationKey(routeId) {
  return `sa-blava.duration.${routeId}`;
}
function loadDuration(routeId) {
  try {
    const saved = localStorage.getItem(durationKey(routeId));
    if (saved && POI_COUNT_BY_DURATION[saved]) return saved;
  } catch {}
  return DEFAULT_DURATION;
}
function saveDuration(routeId, id) {
  try {
    localStorage.setItem(durationKey(routeId), id);
  } catch {}
}

const ICON_BACK = `<svg viewBox="0 0 16 16" width="24" height="24" fill="none" aria-hidden="true"><path d="M10 3L5 8L10 13" stroke="#000" stroke-width="2" stroke-linecap="round"/></svg>`;

const ICON_NEXT = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true"><path d="M21.046 12.796L14.296 19.546C14.085 19.757 13.798 19.876 13.499 19.876C13.2 19.876 12.914 19.757 12.702 19.546C12.491 19.334 12.372 19.048 12.372 18.749C12.372 18.45 12.491 18.163 12.702 17.952L17.531 13.125H3.75C3.452 13.125 3.165 13.006 2.954 12.795C2.744 12.584 2.625 12.298 2.625 12C2.625 11.702 2.744 11.415 2.954 11.204C3.165 10.993 3.452 10.875 3.75 10.875H17.531L12.704 6.045C12.493 5.834 12.374 5.547 12.374 5.248C12.374 4.949 12.493 4.663 12.704 4.451C12.915 4.24 13.202 4.121 13.501 4.121C13.8 4.121 14.086 4.24 14.298 4.451L21.048 11.201C21.153 11.306 21.236 11.43 21.293 11.567C21.349 11.704 21.378 11.851 21.378 11.999C21.378 12.147 21.349 12.294 21.292 12.431C21.235 12.567 21.151 12.691 21.046 12.796Z" fill="#1A1A1A"/></svg>`;

const ICON_PLAY = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true"><path d="M21.983 10.413L8.476 2.151C8.193 1.978 7.869 1.884 7.537 1.877C7.205 1.871 6.878 1.952 6.588 2.114C6.298 2.275 6.056 2.51 5.887 2.796C5.718 3.081 5.627 3.406 5.625 3.738V20.263C5.627 20.594 5.718 20.919 5.887 21.205C6.056 21.49 6.298 21.726 6.588 21.887C6.878 22.048 7.205 22.13 7.537 22.123C7.869 22.117 8.193 22.022 8.476 21.85L21.983 13.588C22.256 13.422 22.481 13.189 22.637 12.911C22.793 12.633 22.875 12.319 22.875 12C22.875 11.681 22.793 11.368 22.637 11.09C22.481 10.812 22.256 10.579 21.983 10.413ZM7.875 19.58V4.421L20.265 12L7.875 19.58Z" fill="#1A1A1A"/></svg>`;

const ICON_PAUSE = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true"><path d="M18.75 2.625H15C14.5027 2.625 14.0258 2.82254 13.6742 3.17417C13.3225 3.52581 13.125 4.00272 13.125 4.5V19.5C13.125 19.9973 13.3225 20.4742 13.6742 20.8258C14.0258 21.1775 14.5027 21.375 15 21.375H18.75C19.2473 21.375 19.7242 21.1775 20.0758 20.8258C20.4275 20.4742 20.625 19.9973 20.625 19.5V4.5C20.625 4.00272 20.4275 3.52581 20.0758 3.17417C19.7242 2.82254 19.2473 2.625 18.75 2.625ZM18.375 19.125H15.375V4.875H18.375V19.125ZM9 2.625H5.25C4.75272 2.625 4.27581 2.82254 3.92417 3.17417C3.57254 3.52581 3.375 4.00272 3.375 4.5V19.5C3.375 19.9973 3.57254 20.4742 3.92417 20.8258C4.27581 21.1775 4.75272 21.375 5.25 21.375H9C9.49728 21.375 9.97419 21.1775 10.3258 20.8258C10.6775 20.4742 10.875 19.9973 10.875 19.5V4.5C10.875 4.00272 10.6775 3.52581 10.3258 3.17417C9.97419 2.82254 9.49728 2.625 9 2.625ZM8.625 19.125H5.625V4.875H8.625V19.125Z" fill="#1A1A1A"/></svg>`;

const ICON_MAP = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true"><path d="M21.4612 4.65854C21.3714 4.58854 21.2668 4.53992 21.1554 4.51636C21.0439 4.49281 20.9286 4.49494 20.8181 4.5226L15.0872 5.9551L9.33563 3.07885C9.17537 2.99892 8.99181 2.97897 8.81812 3.0226L2.81812 4.5226C2.65587 4.56316 2.51183 4.65679 2.40889 4.7886C2.30595 4.92042 2.25003 5.08286 2.25 5.2501V18.7501C2.25002 18.8641 2.27601 18.9765 2.32599 19.0789C2.37598 19.1814 2.44864 19.271 2.53847 19.3412C2.62831 19.4113 2.73294 19.46 2.84442 19.4837C2.95591 19.5073 3.07131 19.5052 3.18187 19.4776L8.91281 18.0451L14.6644 20.9214C14.7688 20.9728 14.8836 20.9998 15 21.0001C15.0613 21.0001 15.1224 20.9925 15.1819 20.9776L21.1819 19.4776C21.3441 19.437 21.4882 19.3434 21.5911 19.2116C21.694 19.0798 21.75 18.9174 21.75 18.7501V5.2501C21.75 5.13603 21.724 5.02346 21.674 4.92095C21.624 4.81844 21.5512 4.7287 21.4612 4.65854ZM9 16.5001C8.93868 16.5001 8.8776 16.5077 8.81812 16.5226L3.75 17.7892V5.83604L8.91281 4.5451L9 4.58823V16.5001ZM20.25 18.1642L15.0872 19.4551L15 19.412V7.5001C15.0613 7.50037 15.1224 7.49313 15.1819 7.47854L20.25 6.21104V18.1642Z" fill="#1A1A1A"/></svg>`;

const ICON_CHEVRON_DOWN = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true"><path d="M20.297 9.796L12.797 17.296C12.692 17.401 12.568 17.484 12.431 17.541C12.295 17.598 12.148 17.627 12 17.627C11.852 17.627 11.705 17.598 11.569 17.541C11.432 17.484 11.308 17.401 11.203 17.296L3.703 9.796C3.492 9.585 3.373 9.298 3.373 8.999C3.373 8.7 3.492 8.413 3.703 8.202C3.914 7.991 4.201 7.872 4.5 7.872C4.799 7.872 5.086 7.991 5.297 8.202L12.001 14.906L18.705 8.201C18.916 7.99 19.203 7.871 19.502 7.871C19.801 7.871 20.087 7.99 20.299 8.201C20.51 8.413 20.629 8.699 20.629 8.998C20.629 9.297 20.51 9.584 20.299 9.795L20.297 9.796Z" fill="#1B6B8A"/></svg>`;

const ICON_KITE = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true"><path d="M0.75 11.398C0.752 11.715 0.856 12.023 1.047 12.276C1.237 12.529 1.504 12.714 1.808 12.804L1.827 12.81L9.139 14.857L11.187 22.17L11.192 22.189C11.282 22.493 11.468 22.759 11.721 22.95C11.974 23.141 12.282 23.245 12.599 23.247H12.627C12.938 23.25 13.241 23.155 13.495 22.976C13.748 22.796 13.939 22.541 14.04 22.247L20.156 5.757C20.158 5.752 20.159 5.747 20.16 5.742C20.252 5.477 20.267 5.191 20.204 4.917C20.141 4.644 20.002 4.393 19.804 4.195C19.606 3.996 19.356 3.857 19.082 3.793C18.809 3.729 18.523 3.744 18.257 3.834L18.242 3.839L1.75 9.957C1.451 10.059 1.193 10.254 1.013 10.514C0.833 10.773 0.741 11.083 0.75 11.398Z" fill="#FFFFFF"/></svg>`;

const ICON_CHECK = `<svg viewBox="0 0 50 50" width="24" height="24" fill="#1B6B8A" aria-hidden="true"><path d="M 42.875 8.625 C 42.844 8.633 42.813 8.645 42.781 8.656 C 42.52 8.723 42.293 8.891 42.156 9.125 L 21.719 40.813 L 7.656 28.125 C 7.41 27.813 7 27.676 6.613 27.777 C 6.227 27.879 5.941 28.203 5.883 28.598 C 5.824 28.992 6.004 29.383 6.344 29.594 L 21.25 43.094 C 21.469 43.285 21.762 43.371 22.051 43.328 C 22.34 43.285 22.594 43.121 22.75 42.875 L 43.844 10.188 C 44.074 9.859 44.086 9.426 43.875 9.086 C 43.664 8.746 43.27 8.566 42.875 8.625 Z"/></svg>`;

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
      <div class="poi-card__heading">
        <span class="poi-card__number">${pad2(idx + 1)}</span>
        <span class="poi-card__title">${poi.name[lang]}</span>
      </div>
      <div class="poi-card__media" style="background-image:url('${poi.thumbnail ?? poi.gallery?.[0]?.src ?? ""}')"></div>
      <p class="poi-card__desc">${poiDescription(poi, lang)}</p>
    </article>
  `;
}

function durationSheetHTML(durationId) {
  return `
    <div class="duration-sheet" data-duration-sheet aria-hidden="true">
      <div class="duration-sheet__card" role="dialog" aria-modal="true" aria-labelledby="duration-title">
        <p class="duration-sheet__title" id="duration-title">${t("route.duration.title")}</p>
        <ul class="duration-list">
          ${DURATIONS.map(
            (id) => `
            <li>
              <button class="duration-row${id === durationId ? " is-selected" : ""}" type="button" data-duration-id="${id}">
                <span class="duration-row__label">${t("route.duration." + id)}</span>
                <span class="duration-row__check">${ICON_CHECK}</span>
              </button>
            </li>
          `
          ).join("")}
        </ul>
      </div>
    </div>
  `;
}

function templateHTML(route, lang, durationId) {
  const visibleCount = POI_COUNT_BY_DURATION[durationId];
  return `
    <header class="route-screen__header">
      <button class="route-screen__back" type="button" data-action="back" aria-label="${t("route.back")}">${ICON_BACK}</button>
      <button class="route-screen__change" type="button" data-action="change-route" aria-label="${t("route.change")}">${ICON_NEXT}</button>
    </header>

    <div class="route-screen__scroll">
      <section class="route-screen__section">
        <h1 class="route-screen__heading">${route.name[lang]}</h1>

        <div class="route-map" data-route-map role="img" aria-label="${route.name[lang]}">
          <button class="map-button" type="button" data-action="open-map" aria-label="${t("route.fullmap")}">
            <span class="map-button__icon">${ICON_MAP}</span>
            <span class="map-button__label">${t("route.mapLabel")}</span>
          </button>
          <button class="play-button" type="button" data-action="play" aria-label="${t("route.play")}">
            <span class="play-button__icon" data-play-icon>${ICON_PLAY}</span>
          </button>
        </div>

        <div class="poi-carousel" data-poi-carousel>
          ${route.pois
            .map((poi, idx) => poiCardHTML(poi, idx, lang, idx < visibleCount))
            .join("")}
        </div>
      </section>

      <section class="recorda-section">
        <h2 class="recorda-section__title">${t("route.recorda.title")}</h2>
        <p class="recorda-section__body">${t("route.recorda.body")}</p>
      </section>
    </div>

    <div class="route-screen__cta">
      <button class="duration-chip" type="button" data-action="open-duration" aria-haspopup="dialog">
        <span class="duration-chip__label" data-duration-label>${t("route.duration." + durationId)}</span>
        ${ICON_CHEVRON_DOWN}
      </button>
      <button class="start-button" type="button" data-action="start">
        ${ICON_KITE}
        <span class="start-button__label">${t("route.start")}</span>
      </button>
    </div>

    ${durationSheetHTML(durationId)}
  `;
}

function updateDurationUI(screen, durationId) {
  const visibleCount = POI_COUNT_BY_DURATION[durationId];
  screen.querySelectorAll("[data-poi-index]").forEach((card) => {
    const idx = Number(card.dataset.poiIndex);
    card.classList.toggle("is-hidden", idx >= visibleCount);
  });
  screen.querySelector("[data-duration-label]").textContent = t(
    "route.duration." + durationId
  );
  screen.querySelectorAll("[data-duration-id]").forEach((row) => {
    row.classList.toggle("is-selected", row.dataset.durationId === durationId);
  });
}

export function renderRouteScreen(host, routeId) {
  const route = findRoute(routeId);
  if (!route) {
    navigate("/routes");
    return { teardown() {} };
  }
  const lang = getLanguage();
  let durationId = loadDuration(routeId);

  const screen = document.createElement("section");
  screen.className = "screen route-screen";
  screen.dataset.screen = "route";
  screen.dataset.routeId = routeId;
  screen.innerHTML = templateHTML(route, lang, durationId);
  host.appendChild(screen);

  // --- Map illustration: one per POI, swaps as carousel scrolls. The map
  //     pattern depends on the selected duration (different illustrated maps
  //     exist for 1h / 1h30+2h / 3h). Updated whenever duration changes.
  const mapEl = screen.querySelector("[data-route-map]");
  const carousel = screen.querySelector("[data-poi-carousel]");

  function patternForDuration(id) {
    return (
      route.mapImagePatternByDuration?.[id] ?? route.mapImagePattern ?? null
    );
  }
  function mapUrlAt(pattern, idx) {
    return encodeURI(pattern.replace("{i}", String(idx + 1)));
  }

  let currentPattern = patternForDuration(durationId);

  function preloadCurrentPattern() {
    if (!currentPattern) return;
    const count = POI_COUNT_BY_DURATION[durationId] ?? route.pois.length;
    for (let i = 1; i <= count; i++) {
      const im = new Image();
      im.src = mapUrlAt(currentPattern, i - 1);
    }
  }
  preloadCurrentPattern();

  function setMapImageForIndex(idx) {
    if (!currentPattern) return;
    const url = mapUrlAt(currentPattern, idx);
    if (mapEl.dataset.currentUrl === url) return;
    mapEl.dataset.currentUrl = url;
    const probe = new Image();
    probe.onload = () => {
      if (mapEl.dataset.currentUrl === url) {
        mapEl.style.backgroundImage = `url("${url}")`;
      }
    };
    probe.onerror = () => {
      const fallback = mapUrlAt(currentPattern, 0);
      mapEl.dataset.currentUrl = fallback;
      mapEl.style.backgroundImage = `url("${fallback}")`;
    };
    probe.src = url;
  }
  setMapImageForIndex(0);

  let activeIdx = 0;
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
      setMapImageForIndex(best);
    }
  }
  carousel.addEventListener("scroll", recomputeActive, { passive: true });

  // --- Header buttons -----------------------------------------------------
  screen
    .querySelector("[data-action=back]")
    .addEventListener("click", () => navigate("/routes"));
  screen
    .querySelector("[data-action=change-route]")
    .addEventListener("click", () =>
      navigate(`/route/${ROUTE_TOGGLE[routeId] || "sud"}`)
    );

  // --- Open full-screen map ----------------------------------------------
  screen
    .querySelector("[data-action=open-map]")
    .addEventListener("click", () => navigate(`/route/${routeId}/map`));

  // --- Play button --------------------------------------------------------
  // Tap to auto-advance the POI carousel; one POI per 3 s. The animated
  // border ring (CSS ::after) sweeps in lockstep. Reaching the last visible
  // POI loops back to the first. Toggling stops playback and resets the
  // ring; the icon swaps to Pause while playing.
  const playBtn = screen.querySelector("[data-action=play]");
  const playIconHost = playBtn.querySelector("[data-play-icon]");
  const POI_PLAY_MS = 3000;
  let playTimer = null;

  function visibleCards() {
    return Array.from(
      carousel.querySelectorAll("[data-poi-index]:not(.is-hidden)")
    );
  }
  function scrollToCard(card) {
    const cardRect = card.getBoundingClientRect();
    const cRect = carousel.getBoundingClientRect();
    const target =
      carousel.scrollLeft +
      (cardRect.left - cRect.left) -
      (cRect.width - cardRect.width) / 2;
    carousel.scrollTo({ left: target, behavior: "smooth" });
  }
  function stopPlay() {
    if (playTimer) {
      clearInterval(playTimer);
      playTimer = null;
    }
    playBtn.classList.remove("is-playing");
    playIconHost.innerHTML = ICON_PLAY;
  }
  function startPlay() {
    const cards = visibleCards();
    if (!cards.length) return;
    playBtn.classList.add("is-playing");
    playIconHost.innerHTML = ICON_PAUSE;
    // Advance one card every 3 s, starting from wherever the user already is.
    playTimer = setInterval(() => {
      const current = visibleCards();
      if (!current.length) return;
      const nextIdx = (activeIdx + 1) % current.length;
      const target = current.find(
        (c) => Number(c.dataset.poiIndex) === nextIdx
      ) ?? current[0];
      scrollToCard(target);
    }, POI_PLAY_MS);
  }
  playBtn.addEventListener("click", () => {
    if (playTimer) stopPlay();
    else startPlay();
  });

  // --- POI cards → POI detail screen --------------------------------------
  carousel.querySelectorAll("[data-poi-index]").forEach((card) => {
    const go = () =>
      navigate(`/route/${routeId}/poi/${card.dataset.poiIndex}`);
    card.addEventListener("click", go);
    card.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        go();
      }
    });
  });

  // --- Duration sheet -----------------------------------------------------
  const sheetEl = screen.querySelector("[data-duration-sheet]");
  const chipEl = screen.querySelector("[data-action=open-duration]");
  function openSheet() {
    sheetEl.classList.add("is-open");
    sheetEl.setAttribute("aria-hidden", "false");
  }
  function closeSheet() {
    sheetEl.classList.remove("is-open");
    sheetEl.setAttribute("aria-hidden", "true");
  }
  chipEl.addEventListener("click", openSheet);
  sheetEl.addEventListener("click", (ev) => {
    if (ev.target === sheetEl) closeSheet();
  });
  sheetEl.querySelectorAll("[data-duration-id]").forEach((row) => {
    row.addEventListener("click", () => {
      const id = row.dataset.durationId;
      if (!POI_COUNT_BY_DURATION[id]) return;
      durationId = id;
      saveDuration(routeId, id);
      updateDurationUI(screen, durationId);
      closeSheet();
      // Filtered POI set just changed — playback would otherwise advance to a
      // now-hidden index, so reset to a clean state.
      stopPlay();
      // Pull the new map pattern + warm its cache, then refresh the map.
      currentPattern = patternForDuration(durationId);
      mapEl.dataset.currentUrl = "";
      preloadCurrentPattern();
      // Filtering may move the centred POI; recheck after the layout settles.
      requestAnimationFrame(() => {
        recomputeActive();
        setMapImageForIndex(activeIdx);
      });
    });
  });

  // --- CTA: Phase-2 stub --------------------------------------------------
  screen.querySelector("[data-action=start]").addEventListener("click", () => {
    console.log("[Sa Blava] Comença ruta (Phase 2 stub)", {
      routeId,
      durationId,
    });
  });

  requestAnimationFrame(() => screen.classList.add("is-active"));

  return {
    name: "route",
    routeId,
    el: screen,
    teardown() {
      stopPlay();
      screen.classList.remove("is-active");
      setTimeout(() => screen.remove(), 320);
    },
  };
}

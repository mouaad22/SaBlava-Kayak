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

const ICON_BACK = `<img src="./assets/icons/regular/CaretLeft.png" width="24" height="24" alt="" aria-hidden="true" />`;

const ICON_NEXT = `<img src="./assets/icons/regular/ArrowRight.png" width="24" height="24" alt="" aria-hidden="true" />`;

const ICON_PLAY = `<img src="./assets/icons/regular/Play.png" width="24" height="24" alt="" aria-hidden="true" />`;

const ICON_PAUSE = `<img src="./assets/icons/regular/Pause.png" width="24" height="24" alt="" aria-hidden="true" />`;

const ICON_MAP = `<img src="./assets/icons/regular/MapTrifold.png" width="24" height="24" alt="" aria-hidden="true" />`;

const ICON_CHEVRON_DOWN = `<img src="./assets/icons/regular/CaretDown.png" width="24" height="24" alt="" aria-hidden="true" />`;

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
      stopPlay();
      screen.classList.remove("is-active");
      setTimeout(() => screen.remove(), 320);
    },
  };
}

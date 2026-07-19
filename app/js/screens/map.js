// Screen — Full-screen map (route POIs as markers).
//
// Same Mapbox setup as the POI detail screen (screen 4), but without the
// bottom sheet. Tapping a marker opens screen 4 (which renders the sheet
// for that POI). Back button returns to the route detail screen.

import { findRoute } from "../data.js";
import { t, getLanguage } from "../i18n.js";
import { navigate } from "../router.js";
import { trackThroughPois } from "../nav/geo.js";
import { MAPBOX_TOKEN, MAPBOX_STYLE, MAPBOX_SATELLITE_STYLE } from "../config.js";

// Duration handling mirrors the route detail screen (same localStorage key and
// fallbacks) so the full-screen map opens on — and keeps in sync with — the
// duration the user last picked there.
const FALLBACK_DURATIONS = {
  available: ["1h", "1h30", "2h", "3h"],
  countByDuration: { "1h": 5, "1h30": 8, "2h": 8, "3h": 9 },
  default: "3h",
};
// Compact, language-neutral labels for the segmented duration control.
const DURATION_SHORT = { "1h": "1h", "1h30": "90m", "2h": "2h", "3h": "3h" };

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

const ICON_BACK = `<img src="./assets/icons/regular/CaretLeft.svg" width="24" height="24" style="flex-shrink:0" alt="" aria-hidden="true" />`;

const ICON_STACK = `<img src="./assets/icons/regular/Stack.svg" width="24" height="24" style="flex-shrink:0" alt="" aria-hidden="true" />`;

const ICON_STACK_FILLED = `<img src="./assets/icons/regular/Stack-filled.svg" width="24" height="24" style="flex-shrink:0" alt="" aria-hidden="true" />`;

// Path glyph (Phosphor) recoloured to the secondary-CTA teal, mirroring the
// inline ICON_MAP on the route screen so the "Ruta" button matches "Mapa".
const ICON_PATH = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M18.75 15.375C18.0523 15.376 17.372 15.5927 16.8024 15.9956C16.2327 16.3984 15.8016 16.9675 15.5681 17.625H6.75C6.05381 17.625 5.38613 17.3484 4.89385 16.8562C4.40156 16.3639 4.125 15.6962 4.125 15C4.125 14.3038 4.40156 13.6361 4.89385 13.1438C5.38613 12.6516 6.05381 12.375 6.75 12.375H15.75C16.844 12.375 17.8932 11.9404 18.6668 11.1668C19.4404 10.3932 19.875 9.34402 19.875 8.25C19.875 7.15598 19.4404 6.10677 18.6668 5.33318C17.8932 4.5596 16.844 4.125 15.75 4.125H6.75C6.45163 4.125 6.16548 4.24353 5.95451 4.4545C5.74353 4.66548 5.625 4.95163 5.625 5.25C5.625 5.54837 5.74353 5.83452 5.95451 6.0455C6.16548 6.25647 6.45163 6.375 6.75 6.375H15.75C16.2473 6.375 16.7242 6.57254 17.0758 6.92417C17.4275 7.27581 17.625 7.75272 17.625 8.25C17.625 8.74728 17.4275 9.22419 17.0758 9.57583C16.7242 9.92746 16.2473 10.125 15.75 10.125H6.75C5.45707 10.125 4.21709 10.6386 3.30285 11.5529C2.38861 12.4671 1.875 13.7071 1.875 15C1.875 16.2929 2.38861 17.5329 3.30285 18.4471C4.21709 19.3614 5.45707 19.875 6.75 19.875H15.5681C15.7744 20.4584 16.137 20.9738 16.6164 21.365C17.0959 21.7561 17.6736 22.008 18.2865 22.093C18.8993 22.178 19.5238 22.0929 20.0916 21.847C20.6593 21.601 21.1486 21.2037 21.5058 20.6985C21.863 20.1933 22.0745 19.5996 22.1171 18.9823C22.1597 18.365 22.0318 17.7479 21.7473 17.1984C21.4629 16.649 21.0328 16.1882 20.5042 15.8666C19.9756 15.5451 19.3688 15.375 18.75 15.375ZM18.75 19.875C18.5275 19.875 18.31 19.809 18.125 19.6854C17.94 19.5618 17.7958 19.3861 17.7106 19.1805C17.6255 18.975 17.6032 18.7488 17.6466 18.5305C17.69 18.3123 17.7972 18.1118 17.9545 17.9545C18.1118 17.7972 18.3123 17.69 18.5305 17.6466C18.7488 17.6032 18.975 17.6255 19.1805 17.7106C19.3861 17.7958 19.5618 17.94 19.6854 18.125C19.809 18.31 19.875 18.5275 19.875 18.75C19.875 19.0484 19.7565 19.3345 19.5455 19.5455C19.3345 19.7565 19.0484 19.875 18.75 19.875Z" fill="#1E5670"/></svg>`;

const ICON_KITE = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true"><path d="M0.75 11.398C0.752 11.715 0.856 12.023 1.047 12.276C1.237 12.529 1.504 12.714 1.808 12.804L1.827 12.81L9.139 14.857L11.187 22.17L11.192 22.189C11.282 22.493 11.468 22.759 11.721 22.95C11.974 23.141 12.282 23.245 12.599 23.247H12.627C12.938 23.25 13.241 23.155 13.495 22.976C13.748 22.796 13.939 22.541 14.04 22.247L20.156 5.757C20.158 5.752 20.159 5.747 20.16 5.742C20.252 5.477 20.267 5.191 20.204 4.917C20.141 4.644 20.002 4.393 19.804 4.195C19.606 3.996 19.356 3.857 19.082 3.793C18.809 3.729 18.523 3.744 18.257 3.834L18.242 3.839L1.75 9.957C1.451 10.059 1.193 10.254 1.013 10.514C0.833 10.773 0.741 11.083 0.75 11.398Z" fill="#FFFFFF"/></svg>`;

export function renderMapScreen(host, routeId) {
  const route = findRoute(routeId);
  if (!route || !route.pois || route.pois.length === 0) {
    navigate("/routes");
    return { name: "map", teardown() {} };
  }

  const lang = getLanguage();
  const durations = route.durations ?? FALLBACK_DURATIONS;
  let durationId = loadDuration(routeId, durations);

  const screen = document.createElement("section");
  screen.className = "screen poi-screen map-screen";
  screen.dataset.screen = "map";
  host.appendChild(screen);
  requestAnimationFrame(() => screen.classList.add("is-active"));

  const mapEl = document.createElement("div");
  mapEl.className = "poi-screen__map";
  screen.appendChild(mapEl);

  // Top overlay — mirrors the route screen: round back button + route title,
  // with the interactive duration bar below, all over the same white gradient.
  const topEl = document.createElement("div");
  topEl.className = "map-screen__top";
  topEl.innerHTML = `
    <div class="map-screen__header-row">
      <button class="route-screen__back" type="button" aria-label="${t("route.back")}">${ICON_BACK}</button>
      <h1 class="route-screen__heading">${route.name[lang]}</h1>
    </div>
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
  `;
  screen.appendChild(topEl);

  topEl
    .querySelector(".route-screen__back")
    .addEventListener("click", () => navigate(`/route/${routeId}`));

  // Layer toggle — Paper map-stack-layer. CSS pins it bottom-right, 8px
  // above the Comença button in the CTA bar.
  const layerToggleEl = document.createElement("button");
  layerToggleEl.className = "poi-screen__map-toggle";
  layerToggleEl.type = "button";
  layerToggleEl.setAttribute("aria-label", t("map.toggleLayer"));
  layerToggleEl.setAttribute("aria-pressed", "false");
  layerToggleEl.innerHTML = ICON_STACK;
  screen.appendChild(layerToggleEl);

  let isSatellite = false;
  layerToggleEl.addEventListener("click", () => {
    if (!map) return;
    isSatellite = !isSatellite;
    layerToggleEl.innerHTML = isSatellite ? ICON_STACK_FILLED : ICON_STACK;
    layerToggleEl.setAttribute("aria-pressed", String(isSatellite));
    map.setStyle(isSatellite ? MAPBOX_SATELLITE_STYLE : MAPBOX_STYLE);
  });

  // Bottom CTA — same bar as the route screen, but the secondary button is
  // "Ruta" (path icon) returning to the detail screen, the inverse of "Mapa".
  const ctaEl = document.createElement("div");
  ctaEl.className = "route-screen__cta";
  ctaEl.innerHTML = `
    <button class="map-cta-button" type="button" data-action="ruta" aria-label="${t("route.back")}">
      <span class="map-cta-button__icon">${ICON_PATH}</span>
      <span class="map-cta-button__label">${t("route.routeLabel")}</span>
    </button>
    <button class="start-button" type="button" data-action="start">
      ${ICON_KITE}
      <span class="start-button__label">${t("route.start")}</span>
    </button>
  `;
  screen.appendChild(ctaEl);

  ctaEl
    .querySelector("[data-action=ruta]")
    .addEventListener("click", () => navigate(`/route/${routeId}`));
  ctaEl
    .querySelector("[data-action=start]")
    .addEventListener("click", () => navigate(`/route/${routeId}/code`));

  // --- Map data for the current duration ---------------------------------
  function visibleForDuration(id) {
    const count = durations.countByDuration[id] ?? route.pois.length;
    const visiblePois = route.pois.slice(0, count);
    const trackCoords =
      route.track && route.track.length > 1
        ? trackThroughPois(route.track, visiblePois.map((p) => p.coords))
        : null;
    return { visiblePois, trackCoords };
  }

  function boundsFor(visiblePois, trackCoords) {
    const lonLats = visiblePois.map((p) => p.coords);
    const bounds = lonLats.reduce(
      (b, c) => b.extend(c),
      new mapboxgl.LngLatBounds(lonLats[0], lonLats[0])
    );
    // If the route ships a precise GPX-derived track, frame around the
    // (sliced) track rather than the POIs alone.
    if (trackCoords) trackCoords.forEach((c) => bounds.extend(c));
    return bounds;
  }

  let map = null;
  let markers = [];
  // Track currently drawn on the map; the style.load handler re-adds it after
  // every setStyle (which wipes user sources/layers), and duration changes
  // update it in place.
  let currentTrack = null;

  function clearMarkers() {
    markers.forEach((m) => m.remove());
    markers = [];
  }

  function renderMarkers(visiblePois) {
    clearMarkers();
    visiblePois.forEach((p, idx) => {
      const el = document.createElement("div");
      el.className = "poi-marker";
      const img = p.gallery?.[0]?.src;
      if (img) el.style.backgroundImage = `url("${img}")`;
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        // Remember the POI was opened from the full-screen map so its back
        // button returns here rather than to the route detail screen.
        sessionStorage.setItem("sa-blava.poi.from", "map");
        navigate(`/route/${routeId}/poi/${idx}`);
      });
      markers.push(
        new mapboxgl.Marker({ element: el }).setLngLat(p.coords).addTo(map)
      );
    });
  }

  // Apply a duration to the live map: swap markers, redraw the (sliced) track,
  // and re-frame. `animate` controls the fitBounds easing (skip on first paint).
  function applyDurationToMap(animate) {
    if (!map) return;
    const { visiblePois, trackCoords } = visibleForDuration(durationId);
    currentTrack = trackCoords;
    renderMarkers(visiblePois);
    if (currentTrack) addRouteTrack(map, route, currentTrack);
    map.fitBounds(boundsFor(visiblePois, trackCoords), {
      padding: 64,
      duration: animate ? 600 : 0,
    });
  }

  // Duration segments — persist + re-render the map, matching the route screen.
  topEl.querySelectorAll(".duration-seg").forEach((seg) => {
    seg.addEventListener("click", () => {
      const id = seg.dataset.durationId;
      if (id === durationId || durations.countByDuration[id] === undefined)
        return;
      durationId = id;
      saveDuration(routeId, id);
      topEl.querySelectorAll(".duration-seg").forEach((s) => {
        const selected = s.dataset.durationId === id;
        s.classList.toggle("is-selected", selected);
        s.setAttribute("aria-pressed", String(selected));
      });
      applyDurationToMap(true);
    });
  });

  if (typeof mapboxgl !== "undefined" && MAPBOX_TOKEN) {
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const initial = visibleForDuration(durationId);
    currentTrack = initial.trackCoords;

    map = new mapboxgl.Map({
      container: mapEl,
      style: MAPBOX_STYLE,
      bounds: boundsFor(initial.visiblePois, initial.trackCoords),
      fitBoundsOptions: { padding: 64 },
      attributionControl: false,
      interactive: true,
    });

    // Track lives in user-added sources/layers, which setStyle wipes — so
    // re-add it on every style.load (fires for the initial style AND for
    // every setStyle call from the layer toggle).
    map.on("style.load", () => {
      if (currentTrack) addRouteTrack(map, route, currentTrack);
    });

    map.on("load", () => renderMarkers(initial.visiblePois));
  } else {
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
    name: "map",
    routeId,
    teardown,
  };
}

// Draws the GPX-derived paddle track as a dashed line. Two layers: a soft
// white halo underneath, then the dashed teal line on top so it stays legible
// over both light land and dark water. Pass `coords` to draw a coastal subset
// of the track (e.g. a shorter duration); defaults to the full route track.
export function addRouteTrack(map, route, coords = route.track) {
  const sourceId = "route-track";
  const geojson = {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: coords },
  };

  if (map.getSource(sourceId)) {
    map.getSource(sourceId).setData(geojson);
  } else {
    map.addSource(sourceId, { type: "geojson", data: geojson });
  }

  if (!map.getLayer("route-track-halo")) {
    map.addLayer({
      id: "route-track-halo",
      type: "line",
      source: sourceId,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#ffffff",
        "line-width": 5,
        "line-opacity": 0.7,
      },
    });
  }

  if (!map.getLayer("route-track-line")) {
    map.addLayer({
      id: "route-track-line",
      type: "line",
      source: sourceId,
      layout: { "line-cap": "butt", "line-join": "round" },
      paint: {
        "line-color": route.color || "#1B6B8A",
        "line-width": 2.5,
        "line-dasharray": [2, 1.5],
        "line-opacity": 0.95,
      },
    });
  }
}

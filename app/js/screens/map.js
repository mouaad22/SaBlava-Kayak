// Screen — Full-screen map (route POIs as markers).
//
// Same Mapbox setup as the POI detail screen (screen 4), but without the
// bottom sheet. Tapping a marker opens screen 4 (which renders the sheet
// for that POI). Back button returns to the route detail screen.

import { findRoute } from "../data.js";
import { t } from "../i18n.js";
import { navigate } from "../router.js";
import { MAPBOX_TOKEN, MAPBOX_STYLE, MAPBOX_SATELLITE_STYLE } from "../config.js";

const ICON_BACK = `<img src="./assets/icons/regular/CaretLeft.svg" width="24" height="24" style="flex-shrink:0" alt="" aria-hidden="true" />`;

const ICON_STACK = `<img src="./assets/icons/regular/Stack.svg" width="24" height="24" style="flex-shrink:0" alt="" aria-hidden="true" />`;

const ICON_STACK_FILLED = `<img src="./assets/icons/regular/Stack-filled.svg" width="24" height="24" style="flex-shrink:0" alt="" aria-hidden="true" />`;

export function renderMapScreen(host, routeId) {
  const route = findRoute(routeId);
  if (!route || !route.pois || route.pois.length === 0) {
    navigate("/routes");
    return { name: "map", teardown() {} };
  }

  const screen = document.createElement("section");
  screen.className = "screen poi-screen map-screen";
  screen.dataset.screen = "map";
  host.appendChild(screen);
  requestAnimationFrame(() => screen.classList.add("is-active"));

  const mapEl = document.createElement("div");
  mapEl.className = "poi-screen__map";
  screen.appendChild(mapEl);

  const headerEl = document.createElement("div");
  headerEl.className = "poi-screen__header";
  headerEl.innerHTML = `
    <button class="poi-screen__back" type="button" aria-label="${t("route.back")}">
      ${ICON_BACK}
    </button>
  `;
  screen.appendChild(headerEl);

  headerEl
    .querySelector(".poi-screen__back")
    .addEventListener("click", () => navigate(`/route/${routeId}`));

  // Layer toggle — Paper map-stack-layer. No bottom sheet on this screen, so
  // the CSS pins it 24px above the viewport bottom (see screens.css).
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

  let map = null;
  if (typeof mapboxgl !== "undefined" && MAPBOX_TOKEN) {
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const lonLats = route.pois.map((p) => p.coords);
    const bounds = lonLats.reduce(
      (b, c) => b.extend(c),
      new mapboxgl.LngLatBounds(lonLats[0], lonLats[0])
    );

    // If the route ships a precise GPX-derived track, frame the map around
     // the track (which extends past the POIs) rather than the POIs alone.
    if (route.track && route.track.length > 1) {
      route.track.forEach((c) => bounds.extend(c));
    }

    map = new mapboxgl.Map({
      container: mapEl,
      style: MAPBOX_STYLE,
      bounds,
      fitBoundsOptions: { padding: 64 },
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
      route.pois.forEach((p, idx) => {
        const el = document.createElement("div");
        el.className = "poi-marker";
        const img = p.gallery?.[0]?.src;
        if (img) el.style.backgroundImage = `url("${img}")`;
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          navigate(`/route/${routeId}/poi/${idx}`);
        });
        new mapboxgl.Marker({ element: el }).setLngLat(p.coords).addTo(map);
      });
    });
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
// over both light land and dark water.
export function addRouteTrack(map, route) {
  const sourceId = "route-track";
  const geojson = {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: route.track },
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

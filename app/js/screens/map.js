// Screen — Full-screen map (route POIs as markers).
//
// Same Mapbox setup as the POI detail screen (screen 4), but without the
// bottom sheet. Tapping a marker opens screen 4 (which renders the sheet
// for that POI). Back button returns to the route detail screen.

import { findRoute } from "../data.js";
import { t } from "../i18n.js";
import { navigate } from "../router.js";
import { MAPBOX_TOKEN, MAPBOX_STYLE } from "../config.js";

const ICON_BACK = `<img src="./assets/icons/regular/CaretLeft.png" width="24" height="24" style="flex-shrink:0" alt="" aria-hidden="true" />`;

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

  let map = null;
  if (typeof mapboxgl !== "undefined" && MAPBOX_TOKEN) {
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const lonLats = route.pois.map((p) => p.coords);
    const bounds = lonLats.reduce(
      (b, c) => b.extend(c),
      new mapboxgl.LngLatBounds(lonLats[0], lonLats[0])
    );

    map = new mapboxgl.Map({
      container: mapEl,
      style: MAPBOX_STYLE,
      bounds,
      fitBoundsOptions: { padding: 64 },
      attributionControl: false,
      interactive: true,
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

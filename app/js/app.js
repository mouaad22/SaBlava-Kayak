import { loadLanguage } from "./i18n.js";
import { parseHash, onRouteChange } from "./router.js";
import { renderLoadingScreen } from "./screens/loading.js";
import { renderLanguageScreen } from "./screens/language.js";
import { renderRoutesScreen } from "./screens/routes.js";
import { renderRouteScreen } from "./screens/route.js";
import { renderPoiScreen } from "./screens/poi.js";
import { renderGalleryScreen } from "./screens/gallery.js";

const host = document.getElementById("screen-stack");

// Single screen slot — every route mounts its own screen and tears down the
// previous one. Screen 4 (POI) is no longer an overlay on top of screen 3;
// it's a sibling that owns the full viewport with Mapbox underneath.
let main = null;

function ensureMain(target) {
  if (
    main &&
    main.name === target.name &&
    (target.routeId === undefined || main.routeId === target.routeId) &&
    (target.poiIndex === undefined || main.poiIndex === target.poiIndex)
  ) {
    return;
  }
  if (main?.teardown) main.teardown();
  main = target.factory();
}

function render(route) {
  switch (route.name) {
    case "language":
      ensureMain({
        name: "language",
        factory: () => renderLanguageScreen(host),
      });
      break;
    case "routes":
      ensureMain({
        name: "routes",
        factory: () => renderRoutesScreen(host),
      });
      break;
    case "route":
      ensureMain({
        name: "route",
        routeId: route.params.routeId,
        factory: () => renderRouteScreen(host, route.params.routeId),
      });
      break;
    case "poi":
      ensureMain({
        name: "poi",
        routeId: route.params.routeId,
        poiIndex: route.params.poiIndex,
        factory: () =>
          renderPoiScreen(host, route.params.routeId, route.params.poiIndex),
      });
      break;
    case "gallery":
      ensureMain({
        name: "gallery",
        routeId: route.params.routeId,
        poiIndex: route.params.poiIndex,
        factory: () =>
          renderGalleryScreen(
            host,
            route.params.routeId,
            route.params.poiIndex
          ),
      });
      break;
    default:
      ensureMain({
        name: "language",
        factory: () => renderLanguageScreen(host),
      });
  }
}

loadLanguage();
renderLoadingScreen(host, () => {
  render(parseHash());
  onRouteChange(render);
});

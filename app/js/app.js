import { loadLanguage } from "./i18n.js";
import { parseHash, onRouteChange } from "./router.js";
import { renderLanguageScreen } from "./screens/language.js";
import { renderRoutesScreen } from "./screens/routes.js";
import { renderRouteScreen } from "./screens/route.js";
import { renderPoiOverlay } from "./screens/poi.js";

const host = document.getElementById("screen-stack");

// Two layers: a main screen (lang/routes/route) and an optional POI overlay.
let main = null;
let overlay = null;

function ensureMain(target) {
  if (
    main &&
    main.name === target.name &&
    (target.routeId === undefined || main.routeId === target.routeId)
  ) {
    return;
  }
  if (main?.teardown) main.teardown();
  main = target.factory();
}

function tearDownOverlay() {
  if (overlay?.teardown) overlay.teardown();
  overlay = null;
}

function render(route) {
  switch (route.name) {
    case "language":
      tearDownOverlay();
      ensureMain({
        name: "language",
        factory: () => renderLanguageScreen(host),
      });
      break;
    case "routes":
      tearDownOverlay();
      ensureMain({
        name: "routes",
        factory: () => renderRoutesScreen(host),
      });
      break;
    case "route":
      tearDownOverlay();
      ensureMain({
        name: "route",
        routeId: route.params.routeId,
        factory: () => renderRouteScreen(host, route.params.routeId),
      });
      break;
    case "poi":
      ensureMain({
        name: "route",
        routeId: route.params.routeId,
        factory: () => renderRouteScreen(host, route.params.routeId),
      });
      tearDownOverlay();
      overlay = renderPoiOverlay(
        host,
        route.params.routeId,
        route.params.poiIndex
      );
      break;
    default:
      tearDownOverlay();
      ensureMain({
        name: "language",
        factory: () => renderLanguageScreen(host),
      });
  }
}

loadLanguage();
render(parseHash());
onRouteChange(render);

import { loadLanguage } from "./i18n.js";
import { captureKayakId } from "./kayak.js";
import { rehydrateFromServer } from "./nav/session.js";
import { parseHash, onRouteChange } from "./router.js";
import { renderLoadingScreen } from "./screens/loading.js";
import { renderLanguageScreen } from "./screens/language.js";
import { renderRoutesScreen } from "./screens/routes.js";
import { renderRouteScreen } from "./screens/route.js";
import { renderPoiScreen } from "./screens/poi.js";
import { renderGalleryScreen } from "./screens/gallery.js";
import { renderMapScreen } from "./screens/map.js";
import { renderCodeEntryScreen } from "./screens/code-entry.js";
import { renderRouteSummaryScreen } from "./screens/route-summary.js";
import { renderNavigateScreen } from "./screens/navigate.js";
import { renderWeatherScreen } from "./screens/weather.js";

// Native-app feel: never let the browser restore a previous scroll position
// when navigating between hash routes — every screen lands at the top.
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

const host = document.getElementById("screen-stack");

// Depth of each named route in the conceptual navigation tree. Used to pick
// a direction (forward / backward) for screen transitions: deeper or equal
// depth = forward (slide in from right), shallower = backward (from left).
const SCREEN_DEPTH = {
  language: 0,
  weather: 1,
  routes: 1,
  route: 2,
  map: 2,
  poi: 3,
  gallery: 4,
  code: 3,
  summary: 4,
  navigate: 4,
};

// Single screen slot — every route mounts its own screen and tears down the
// previous one. Screen 4 (POI) is no longer an overlay on top of screen 3;
// it's a sibling that owns the full viewport with Mapbox underneath.
let main = null;
let prevRouteName = null;

function ensureMain(target) {
  if (
    main &&
    main.name === target.name &&
    (target.routeId === undefined || main.routeId === target.routeId) &&
    (target.poiIndex === undefined || main.poiIndex === target.poiIndex)
  ) {
    return;
  }

  // First navigation (from the loading splash) is a pure fade — no slide.
  const isFirstNav = prevRouteName === null;
  const direction =
    isFirstNav ||
    (SCREEN_DEPTH[target.name] ?? 0) >= (SCREEN_DEPTH[prevRouteName] ?? 0)
      ? "forward"
      : "backward";

  // Route detail ⇄ full-screen map share an identical bottom CTA and header
  // position, so a horizontal slide would make those fixed elements appear to
  // slide off and back on. Crossfade in place instead (no translate); only the
  // left CTA button's content swap (Mapa ⇄ Ruta) animates, drawing the eye to
  // the one thing that actually changed.
  const isFixedPair =
    !isFirstNav &&
    ((prevRouteName === "route" && target.name === "map") ||
      (prevRouteName === "map" && target.name === "route"));

  if (main?.teardown) {
    if (!isFirstNav && !isFixedPair) {
      const outgoing = host.querySelector(".screen.is-active");
      if (outgoing) {
        outgoing.classList.add(
          direction === "forward" ? "is-exiting-left" : "is-exiting-right"
        );
      }
    }
    main.teardown();
  }

  main = target.factory();

  if (!isFirstNav) {
    const incoming = host.lastElementChild;
    if (incoming && incoming.classList.contains("screen")) {
      if (isFixedPair) {
        // No slide — the screen just crossfades. Mark it so the left CTA
        // button (and only that button) plays its content-swap animation.
        incoming.classList.add("is-cta-swap");
      } else {
        incoming.classList.add(
          direction === "forward"
            ? "is-entering-from-right"
            : "is-entering-from-left"
        );
        // Force a reflow so the entering style (translated + opacity:0) is
        // committed before the renderer's RAF adds .is-active. Without this
        // the browser collapses both class additions into one style cycle and
        // the transform transition never fires — the screen just appears.
        void incoming.offsetWidth;
      }
    }
  }

  prevRouteName = target.name;
}

function render(route) {
  switch (route.name) {
    case "language":
      ensureMain({
        name: "language",
        factory: () => renderLanguageScreen(host),
      });
      break;
    case "weather":
      ensureMain({
        name: "weather",
        factory: () => renderWeatherScreen(host),
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
    case "map":
      ensureMain({
        name: "map",
        routeId: route.params.routeId,
        factory: () => renderMapScreen(host, route.params.routeId),
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
    case "code":
      ensureMain({
        name: "code",
        routeId: route.params.routeId,
        factory: () => renderCodeEntryScreen(host, route.params.routeId),
      });
      break;
    case "summary":
      ensureMain({
        name: "summary",
        routeId: route.params.routeId,
        factory: () => renderRouteSummaryScreen(host, route.params.routeId),
      });
      break;
    case "navigate":
      ensureMain({
        name: "navigate",
        routeId: route.params.routeId,
        factory: () => renderNavigateScreen(host, route.params.routeId),
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

// Capture the kayak id from the QR's ?k= (falls back to the last scanned one in
// storage) so the session API can report which kayak is on the water. Then
// best-effort reconcile the rental clock with the server: a reload mid-trip
// re-reads the authoritative started_at instead of restarting the countdown.
captureKayakId();
rehydrateFromServer();

renderLoadingScreen(host, () => {
  render(parseHash());
  onRouteChange(render);
});

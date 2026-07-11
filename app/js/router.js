// Lightweight hash router. Routes:
//   #/                              → language selection
//   #/weather                       → weather screen
//   #/legal                         → privacy & legal notice
//   #/routes                        → routes browser
//   #/route/:id                     → route detail
//   #/route/:id/map                 → full-screen map (markers only)
//   #/route/:id/poi/:i              → POI screen (Mapbox + sheet)
//   #/route/:id/poi/:i/gallery      → full-screen gallery
//   #/route/:id/code                → 6-digit rental code entry
//   #/route/:id/summary             → route summary (edit POIs, confirm)
//   #/route/:id/navigate            → full-screen GPS navigation

const listeners = [];

export function parseHash() {
  const raw = (location.hash || "#/").replace(/^#/, "");
  const parts = raw.split("/").filter(Boolean);
  if (parts.length === 0) return { name: "language", params: {} };
  if (parts[0] === "weather") return { name: "weather", params: {} };
  if (parts[0] === "legal") return { name: "legal", params: {} };
  if (parts[0] === "routes") return { name: "routes", params: {} };
  if (
    parts[0] === "route" &&
    parts[1] &&
    parts[2] === "poi" &&
    parts[3] &&
    parts[4] === "gallery"
  ) {
    return {
      name: "gallery",
      params: { routeId: parts[1], poiIndex: +parts[3] },
    };
  }
  if (parts[0] === "route" && parts[1] && parts[2] === "poi" && parts[3]) {
    return { name: "poi", params: { routeId: parts[1], poiIndex: +parts[3] } };
  }
  if (parts[0] === "route" && parts[1] && parts[2] === "map") {
    return { name: "map", params: { routeId: parts[1] } };
  }
  if (parts[0] === "route" && parts[1] && parts[2] === "code") {
    return { name: "code", params: { routeId: parts[1] } };
  }
  if (parts[0] === "route" && parts[1] && parts[2] === "summary") {
    return { name: "summary", params: { routeId: parts[1] } };
  }
  if (parts[0] === "route" && parts[1] && parts[2] === "navigate") {
    return { name: "navigate", params: { routeId: parts[1] } };
  }
  if (parts[0] === "route" && parts[1]) {
    return { name: "route", params: { routeId: parts[1] } };
  }
  return { name: "language", params: {} };
}

export function navigate(path) {
  if (location.hash === `#${path}`) return;
  location.hash = path;
}

export function onRouteChange(fn) {
  listeners.push(fn);
}

window.addEventListener("hashchange", () => {
  const route = parseHash();
  for (const fn of listeners) fn(route);
});

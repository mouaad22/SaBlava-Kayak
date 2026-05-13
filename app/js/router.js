// Lightweight hash router. Routes:
//   #/        → language selection
//   #/routes  → routes browser
//   #/route/:id        (Phase 2)
//   #/route/:id/poi/:i (Phase 2)

const listeners = [];

export function parseHash() {
  const raw = (location.hash || "#/").replace(/^#/, "");
  const parts = raw.split("/").filter(Boolean);
  if (parts.length === 0) return { name: "language", params: {} };
  if (parts[0] === "routes") return { name: "routes", params: {} };
  if (parts[0] === "route" && parts[1] && parts[2] === "poi" && parts[3]) {
    return { name: "poi", params: { routeId: parts[1], poiIndex: +parts[3] } };
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

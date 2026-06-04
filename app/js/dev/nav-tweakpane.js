// Dev-only Tweakpane panel for the navigate screen.
// Only activates on localhost. No-ops silently in production.

const IS_DEV = location.hostname === "localhost" || location.hostname === "127.0.0.1";

function loadTweakpane() {
  return new Promise((resolve, reject) => {
    if (window.Tweakpane) { resolve(window.Tweakpane); return; }
    const s = document.createElement("script");
    s.src = "./assets/vendor/tweakpane.min.js";
    s.onload = () => resolve(window.Tweakpane);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function css(prop, value) {
  document.documentElement.style.setProperty(prop, value);
}

/**
 * @param {mapboxgl.Map | null} map  — pass the Mapbox instance (or null for no-map mode)
 */
export async function mountNavTweakpane(map) {
  if (!IS_DEV) return null;

  const Tweakpane = await loadTweakpane();
  const pane = new Tweakpane.Pane({ title: "Navigate Dev", expanded: true });

  // ── CSS tokens ────────────────────────────────────────────────────────────
  const tokens = {
    primaryColor:     "#1b6b8a",
    accentColor:      "#ff8c6b",
    dadesBackground:  "#e8ece4",
    statusBarOpacity: 0.94,
    dadesTimeSize:    72,
    routeLineColor:   "#1B6B8A",
  };

  const uiFolder = pane.addFolder({ title: "CSS tokens" });

  uiFolder.addBinding(tokens, "primaryColor", { label: "Primary" }).on("change", ({ value }) => {
    css("--color-primary", value);
  });
  uiFolder.addBinding(tokens, "accentColor", { label: "Accent" }).on("change", ({ value }) => {
    css("--color-accent", value);
  });
  uiFolder.addBinding(tokens, "dadesBackground", { label: "Dades bg" }).on("change", ({ value }) => {
    document.querySelectorAll(".navigate-dades-view").forEach((el) => {
      el.style.background = value;
    });
  });
  uiFolder.addBinding(tokens, "statusBarOpacity", { label: "Status bar opacity", min: 0, max: 1, step: 0.01 }).on("change", ({ value }) => {
    document.querySelectorAll(".navigate-screen__status-bar").forEach((el) => {
      el.style.background = `rgba(255,255,255,${value})`;
    });
  });
  uiFolder.addBinding(tokens, "dadesTimeSize", { label: "Dades time size", min: 36, max: 96, step: 1 }).on("change", ({ value }) => {
    document.querySelectorAll(".dades-time").forEach((el) => {
      el.style.fontSize = `${value}px`;
    });
  });

  // ── Map settings (only when Mapbox is active) ─────────────────────────────
  if (!map) return pane;

  const mapParams = {
    zoom:         map.getZoom(),
    bearing:      map.getBearing(),
    pitch:        map.getPitch(),
    style:        "outdoors",
    routeColor:   "#1B6B8A",
    routeWidth:   3,
    routeOpacity: 0.8,
  };

  const mapFolder = pane.addFolder({ title: "Map" });

  mapFolder.addBinding(mapParams, "zoom", { label: "Zoom", min: 10, max: 18, step: 0.1 }).on("change", ({ value }) => {
    map.setZoom(value);
  });
  mapFolder.addBinding(mapParams, "bearing", { label: "Bearing", min: -180, max: 180, step: 1 }).on("change", ({ value }) => {
    map.setBearing(value);
  });
  mapFolder.addBinding(mapParams, "pitch", { label: "Pitch", min: 0, max: 60, step: 1 }).on("change", ({ value }) => {
    map.setPitch(value);
  });
  mapFolder.addBinding(mapParams, "style", {
    label: "Style",
    options: { Outdoors: "outdoors", Satellite: "satellite" },
  }).on("change", ({ value }) => {
    const styles = {
      outdoors:  "mapbox://styles/mapbox/outdoors-v12",
      satellite: "mapbox://styles/mapbox/satellite-streets-v12",
    };
    map.setStyle(styles[value]);
  });

  const lineFolder = pane.addFolder({ title: "Route line" });

  lineFolder.addBinding(mapParams, "routeColor", { label: "Color" }).on("change", ({ value }) => {
    for (const id of ["nav-route-line", "nav-route-track-line"]) {
      if (map.getLayer(id)) map.setPaintProperty(id, "line-color", value);
    }
  });
  lineFolder.addBinding(mapParams, "routeWidth", { label: "Width", min: 1, max: 10, step: 0.5 }).on("change", ({ value }) => {
    for (const id of ["nav-route-line", "nav-route-track-line"]) {
      if (map.getLayer(id)) map.setPaintProperty(id, "line-width", value);
    }
  });
  lineFolder.addBinding(mapParams, "routeOpacity", { label: "Opacity", min: 0, max: 1, step: 0.01 }).on("change", ({ value }) => {
    for (const id of ["nav-route-line", "nav-route-track-line"]) {
      if (map.getLayer(id)) map.setPaintProperty(id, "line-opacity", value);
    }
  });

  // Sync zoom/bearing/pitch back to pane when user pans/zooms the map.
  map.on("moveend", () => {
    mapParams.zoom    = map.getZoom();
    mapParams.bearing = map.getBearing();
    mapParams.pitch   = map.getPitch();
    pane.refresh();
  });

  return pane;
}

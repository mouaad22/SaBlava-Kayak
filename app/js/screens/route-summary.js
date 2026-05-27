// screens/route-summary.js — Editable route preview before navigation starts.
//
// Flow: user sees the full route drawn on a Mapbox map (Marina → POIs → Marina),
// can toggle individual POIs on/off, and sees live-updating distance + ETA.
// Tapping "Accepta i comença" pre-caches Mapbox tiles then starts the session.
//
// Screen depth: 3 (same level as poi screen, deeper than route detail).

import { findRoute, MARINA } from "../data.js";
import { t, getLanguage } from "../i18n.js";
import { navigate } from "../router.js";
import { getDraft, saveDraft, startSession, clearDraft } from "../nav/session.js";
import { totalPathKm, estimatedHours, haversineKm } from "../nav/geo.js";
import { precacheBbox } from "../nav/tile-cache.js";
import { MAPBOX_TOKEN, MAPBOX_STYLE, KAYAK_SPEED_KMH } from "../config.js";

const POI_COUNT_BY_DURATION = { 1: 5, 1.5: 8, 2: 8, 3: 9 };

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} host
 * @param {string} routeId
 * @returns {{ name: string, routeId: string, teardown(): void }}
 */
export function renderRouteSummaryScreen(host, routeId) {
  const route = findRoute(routeId);

  // Guard: if there's no draft (user navigated here directly), redirect back.
  const draft = getDraft(routeId);
  if (!draft) {
    navigate(`/route/${routeId}`);
    return { name: "summary", routeId, teardown() {} };
  }

  const { durationHours, includedPoiIndices: initialIndices, code: draftCode = "" } = draft;

  // ── Mutable state ─────────────────────────────────────────────────────────
  let includedSet = new Set(initialIndices);
  let mapInstance = null;
  let mapReady = false;

  // ── DOM ───────────────────────────────────────────────────────────────────
  const screen = document.createElement("section");
  screen.className = "screen summary-screen";
  screen.setAttribute("aria-label", t("summary.title"));

  screen.innerHTML = `
    <div class="summary-screen__header">
      <button class="summary-screen__back btn btn--icon" aria-label="${t("summary.back")}">
        <img src="./assets/icons/regular/CaretLeft.svg" width="24" height="24" alt="" aria-hidden="true" />
      </button>
      <h1 class="summary-screen__title">${t("summary.title")}</h1>
    </div>

    <div class="summary-screen__map" id="summary-map"></div>

    <div class="summary-screen__content">
      <div class="summary-screen__stats">
        <p class="summary-screen__stat-line" data-stat="dist"></p>
        <p class="summary-screen__stat-line" data-stat="eta"></p>
        <p class="summary-screen__stat-line summary-screen__paid" data-stat="paid">
          ${t("summary.paid", formatDuration(durationHours))}
        </p>
      </div>

      <p class="summary-screen__over-budget" hidden></p>

      <div class="summary-screen__poi-section">
        <h2 class="summary-screen__poi-heading">${t("summary.pois.title")}</h2>
        <ul class="summary-poi-list" role="list"></ul>
      </div>

      <button class="summary-screen__accept btn btn--primary" type="button">
        ${t("summary.accept")}
      </button>
    </div>

    <div class="preparing-overlay" hidden>
      <div class="preparing-overlay__card">
        <p class="preparing-overlay__title">${t("prepare.title")}</p>
        <p class="preparing-overlay__subtitle">${t("prepare.subtitle")}</p>
        <div class="preparing-overlay__bar-track">
          <div class="preparing-overlay__bar-fill"></div>
        </div>
        <p class="preparing-overlay__pct">0%</p>
      </div>
    </div>
  `;

  host.appendChild(screen);

  // ── Element refs ──────────────────────────────────────────────────────────
  const mapEl       = screen.querySelector("#summary-map");
  const poiList     = screen.querySelector(".summary-poi-list");
  const statDist    = screen.querySelector('[data-stat="dist"]');
  const statEta     = screen.querySelector('[data-stat="eta"]');
  const overBudget  = screen.querySelector(".summary-screen__over-budget");
  const btnAccept   = screen.querySelector(".summary-screen__accept");
  const btnBack     = screen.querySelector(".summary-screen__back");
  const preparing   = screen.querySelector(".preparing-overlay");
  const barFill     = screen.querySelector(".preparing-overlay__bar-fill");
  const barPct      = screen.querySelector(".preparing-overlay__pct");

  // ── Helpers ───────────────────────────────────────────────────────────────

  function buildPath() {
    const pts = [MARINA.coords];
    for (const idx of [...includedSet].sort((a, b) => a - b)) {
      pts.push(route.pois[idx].coords);
    }
    pts.push(MARINA.coords);
    return pts;
  }

  function computeStats() {
    const pts = buildPath();
    const km  = totalPathKm(pts);
    const hrs = estimatedHours(km);
    const totalMin = Math.round(hrs * 60);
    const h   = Math.floor(totalMin / 60);
    const m   = totalMin % 60;
    return { km: km.toFixed(1), h, m, hrs };
  }

  function updateStats() {
    const { km, h, m, hrs } = computeStats();
    statDist.textContent = t("summary.distance", km);
    statEta.textContent  = t("summary.estimated", h, m);

    if (hrs > durationHours) {
      overBudget.hidden      = false;
      overBudget.textContent = t("summary.over_budget");
    } else {
      overBudget.hidden = true;
    }
  }

  function syncCheckboxes() {
    poiList.querySelectorAll('.summary-poi-item__checkbox').forEach((cb) => {
      const idx = Number(cb.dataset.poiIdx);
      cb.checked = includedSet.has(idx);
      // Disable the last checked box so ≥1 POI is always selected.
      cb.disabled = includedSet.has(idx) && includedSet.size === 1;
    });
    poiList.querySelectorAll('.summary-poi-item__min-hint').forEach((hint) => {
      const idx = Number(hint.dataset.poiIdx);
      hint.hidden = !(includedSet.has(idx) && includedSet.size === 1);
    });
  }

  function updateMap() {
    if (!mapReady) return;
    const pts = buildPath();
    const geojson = {
      type: "Feature",
      geometry: { type: "LineString", coordinates: pts },
    };

    // Update route line.
    const src = mapInstance.getSource("summary-route");
    if (src) src.setData(geojson);

    // Update POI marker visibility.
    route.pois.forEach((poi, idx) => {
      const marker = screen.querySelector(`[data-poi-marker="${idx}"]`);
      if (marker) {
        marker.style.opacity = includedSet.has(idx) ? "1" : "0.25";
      }
    });

    // Fit map to the new path with padding.
    const allLngs = pts.map(([lng]) => lng);
    const allLats = pts.map(([, lat]) => lat);
    mapInstance.fitBounds(
      [[Math.min(...allLngs), Math.min(...allLats)],
       [Math.max(...allLngs), Math.max(...allLats)]],
      { padding: 48, duration: 300 }
    );
  }

  // ── Render POI list ───────────────────────────────────────────────────────
  route.pois.forEach((poi, idx) => {
    const li = document.createElement("li");
    li.className = "summary-poi-item";
    li.innerHTML = `
      <label class="summary-poi-item__label">
        <input
          class="summary-poi-item__checkbox"
          type="checkbox"
          data-poi-idx="${idx}"
          ${includedSet.has(idx) ? "checked" : ""}
        />
        <span class="summary-poi-item__content">
          <span class="summary-poi-item__icon">${poi.typeIcon}</span>
          <span class="summary-poi-item__name">${poi.name[getLanguage()] ?? poi.name.ca}</span>
        </span>
      </label>
      <span
        class="summary-poi-item__min-hint"
        data-poi-idx="${idx}"
        ${!(includedSet.has(idx) && includedSet.size === 1) ? "hidden" : ""}
      >${t("summary.pois.min")}</span>
    `;
    poiList.appendChild(li);
  });

  // ── Checkbox interaction ──────────────────────────────────────────────────
  poiList.addEventListener("change", (e) => {
    const cb = e.target.closest('.summary-poi-item__checkbox');
    if (!cb) return;
    const idx = Number(cb.dataset.poiIdx);

    if (cb.checked) {
      includedSet.add(idx);
    } else {
      if (includedSet.size <= 1) { cb.checked = true; return; } // prevent empty
      includedSet.delete(idx);
    }

    syncCheckboxes();
    saveDraft(routeId, {
      durationHours,
      includedPoiIndices: [...includedSet].sort((a, b) => a - b),
      code: draftCode,
    });
    updateStats();
    updateMap();
  });

  // ── Back button ───────────────────────────────────────────────────────────
  btnBack.addEventListener("click", () => navigate(`/route/${routeId}`));

  // ── Accept button ─────────────────────────────────────────────────────────
  btnAccept.addEventListener("click", async () => {
    const sortedIndices = [...includedSet].sort((a, b) => a - b);

    // Show preparing overlay.
    preparing.hidden = false;
    barFill.style.width = "0%";
    barPct.textContent = "0%";

    let cacheOk = true;
    try {
      await precacheBbox(route.bbox, (done, total) => {
        const pct = Math.round((done / total) * 100);
        barFill.style.width = `${pct}%`;
        barPct.textContent = `${pct}%`;
      });
    } catch (e) {
      cacheOk = false;
      console.warn("[Sa Blava] Tile pre-cache failed — continuing online-only", e);
    }

    // Start the session (tile cache success or not).
    startSession({
      routeId,
      durationHours,
      code: draftCode,
      includedPoiIndices: sortedIndices,
    });
    clearDraft(routeId);

    // Show a brief warning toast if caching failed.
    if (!cacheOk) {
      showToast(screen, "Mapa pot no estar disponible sense xarxa", 4000);
    }

    navigate(`/route/${routeId}/navigate`);
  });

  // ── Mapbox map ────────────────────────────────────────────────────────────
  if (window.mapboxgl && MAPBOX_TOKEN) {
    mapboxgl.accessToken = MAPBOX_TOKEN;
    mapInstance = new mapboxgl.Map({
      container: mapEl,
      style: MAPBOX_STYLE,
      center: MARINA.coords,
      zoom: 13,
      interactive: true,
      attributionControl: false,
    });

    mapInstance.on("load", () => {
      mapReady = true;
      const pts = buildPath();

      // Route line source + layer.
      mapInstance.addSource("summary-route", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: { type: "LineString", coordinates: pts },
        },
      });
      mapInstance.addLayer({
        id: "summary-route-line",
        type: "line",
        source: "summary-route",
        paint: {
          "line-color": "#1B6B8A",
          "line-width": 3,
          "line-opacity": 0.85,
          "line-dasharray": [2, 1.5],
        },
      });

      // Marina start/end marker.
      const marinaEl = document.createElement("div");
      marinaEl.className = "summary-marker summary-marker--marina";
      marinaEl.innerHTML = `<span>⚓</span>`;
      new mapboxgl.Marker({ element: marinaEl })
        .setLngLat(MARINA.coords)
        .addTo(mapInstance);

      // POI markers.
      route.pois.forEach((poi, idx) => {
        const el = document.createElement("div");
        el.className = "summary-marker summary-marker--poi";
        el.setAttribute("data-poi-marker", idx);
        el.style.opacity = includedSet.has(idx) ? "1" : "0.25";
        el.textContent = idx + 1;
        new mapboxgl.Marker({ element: el })
          .setLngLat(poi.coords)
          .addTo(mapInstance);
      });

      updateMap();
    });
  } else {
    // No Mapbox — show a simple fallback message.
    mapEl.innerHTML = `
      <div class="summary-screen__map-fallback">
        <p>${route.pois.filter((_, i) => includedSet.has(i)).length} parades seleccionades</p>
      </div>
    `;
  }

  // ── Initial render ────────────────────────────────────────────────────────
  updateStats();
  syncCheckboxes();

  requestAnimationFrame(() => {
    screen.classList.add("is-active");
    const content = screen.querySelector(".summary-screen__content");
    if (content) content.scrollTop = 0;
  });

  // ── Teardown ──────────────────────────────────────────────────────────────
  return {
    name: "summary",
    routeId,
    teardown() {
      if (mapInstance) {
        mapInstance.remove();
        mapInstance = null;
      }
      screen.classList.remove("is-active");
      setTimeout(() => screen.remove(), 320);
    },
  };
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatDuration(hours) {
  if (hours === 1.5) return "1h 30m";
  if (Number.isInteger(hours)) return `${hours}h`;
  return `${hours}h`;
}

function showToast(parent, message, durationMs = 3000) {
  const toast = document.createElement("div");
  toast.className = "summary-toast";
  toast.textContent = message;
  parent.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  setTimeout(() => {
    toast.classList.remove("is-visible");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, durationMs);
}

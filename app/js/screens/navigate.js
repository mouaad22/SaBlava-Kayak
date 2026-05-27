// screens/navigate.js — Full-screen GPS navigation screen.
//
// Layout:
//   ┌─────────────────────────────────────┐
//   │ Status bar: ⏱ time | POI n/N | dist │  ← always visible
//   ├─────────────────────────────────────┤
//   │                                     │
//   │      [Mapa tab]  OR  [Dades tab]    │
//   │                                     │
//   ├─────────────────────────────────────┤
//   │   [ Mapa ]  [ Dades ]  [ × Acabar ] │  ← bottom tab bar
//   └─────────────────────────────────────┘
//
// Mapa tab: live Mapbox + live position marker.
// Dades tab: 96pt countdown | POI name + distance | base distance.
//            Mapbox canvas is display:none while Dades is active (saves GPU).
//
// A single rAF loop ticks ~1/second; threshold events fire exactly once each.

import { findRoute, MARINA } from "../data.js";
import { t, getLanguage } from "../i18n.js";
import { navigate } from "../router.js";
import {
  getSession, endSession, timeRemainingMs, isActive,
} from "../nav/session.js";
import { haversineM } from "../nav/geo.js";
import { speak, chime } from "../nav/audio.js";
import { acquire, release, attachVisibilityHandler } from "../nav/wake-lock.js";
import { MAPBOX_TOKEN, MAPBOX_STYLE, OVERTIME_WARNINGS_MIN, NAV_ARRIVAL_THRESHOLD_M, KAYAK_SPEED_KMH } from "../config.js";

const TABS = { MAP: "map", DATA: "data" };

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} host
 * @param {string} routeId
 * @returns {{ name: string, routeId: string, teardown(): void }}
 */
export function renderNavigateScreen(host, routeId) {
  // Guard: session must exist.
  if (!isActive()) {
    navigate(`/route/${routeId}`);
    return { name: "navigate", routeId, teardown() {} };
  }

  const session = getSession();
  const route   = findRoute(routeId);
  const lang    = getLanguage();

  // The POIs the user is navigating (canonical indices).
  const activePois = (session.includedPoiIndices ?? route.pois.map((_, i) => i))
    .map((idx) => route.pois[idx]);

  // ── Mutable state ─────────────────────────────────────────────────────────
  let activeTab        = TABS.MAP;
  let activePOIIdx     = 0;        // index into activePois
  let userCoords       = null;     // [lng, lat] | null
  let mapInstance      = null;
  let mapReady         = false;
  let positionMarker   = null;
  let watchCleanup     = null;
  let rafId            = null;
  let lastTickMs       = 0;
  const firedThresholds = new Set(); // "t30" | "t15" | "t5" | "t0"

  // ── DOM ───────────────────────────────────────────────────────────────────
  const screen = document.createElement("section");
  screen.className = "screen navigate-screen";
  screen.setAttribute("aria-label", t("nav.tab.map"));

  screen.innerHTML = `
    <div class="navigate-screen__status-bar">
      <span class="nav-status-time" aria-live="polite">--:--</span>
      <span class="nav-status-poi"></span>
      <span class="nav-status-dist"></span>
    </div>

    <div class="navigate-screen__content">
      <div class="navigate-map-view" id="nav-map"></div>
      <div class="navigate-dades-view" hidden>
        <div class="dades-block dades-block--time">
          <span class="dades-time">--</span>
          <span class="dades-remaining">${t("nav.dades.remaining")}</span>
        </div>
        <div class="dades-block dades-block--poi">
          <span class="dades-poi-label"></span>
          <span class="dades-poi-dist">--</span>
        </div>
        <div class="dades-block dades-block--base">
          <span class="dades-base-label"></span>
        </div>
      </div>
    </div>

    <div class="navigate-screen__tabbar">
      <button class="nav-tab-btn is-active" data-tab="${TABS.MAP}" aria-pressed="true">
        ${t("nav.tab.map")}
      </button>
      <button class="nav-tab-btn" data-tab="${TABS.DATA}" aria-pressed="false">
        ${t("nav.tab.data")}
      </button>
      <button class="nav-tab-btn nav-tab-btn--end" data-action="end">
        ${t("nav.end")}
      </button>
    </div>

    <div class="navigate-screen__overtime-banner" hidden></div>

    <dialog class="nav-end-dialog">
      <p class="nav-end-dialog__text">${t("nav.end.confirm")}</p>
      <div class="nav-end-dialog__actions">
        <button class="btn btn--ghost nav-end-dialog__cancel">${t("modal.cancel")}</button>
        <button class="btn btn--danger nav-end-dialog__confirm">${t("nav.end")}</button>
      </div>
    </dialog>

    <div class="navigate-screen__gps-banner" hidden>
      ${t("nav.permission.denied")}
    </div>
  `;

  host.appendChild(screen);

  // ── Element refs ──────────────────────────────────────────────────────────
  const statusTime    = screen.querySelector(".nav-status-time");
  const statusPoi     = screen.querySelector(".nav-status-poi");
  const statusDist    = screen.querySelector(".nav-status-dist");
  const mapView       = screen.querySelector(".navigate-map-view");
  const dadesView     = screen.querySelector(".navigate-dades-view");
  const dadesTime     = screen.querySelector(".dades-time");
  const dadesRemaining = screen.querySelector(".dades-remaining");
  const dadesPoi      = screen.querySelector(".dades-poi-label");
  const dadesDist     = screen.querySelector(".dades-poi-dist");
  const dadesBase     = screen.querySelector(".dades-base-label");
  const overtimeBanner = screen.querySelector(".navigate-screen__overtime-banner");
  const gpsBanner     = screen.querySelector(".navigate-screen__gps-banner");
  const endDialog     = screen.querySelector(".nav-end-dialog");
  const tabBtns       = screen.querySelectorAll(".nav-tab-btn[data-tab]");

  // ── Tab switching ─────────────────────────────────────────────────────────
  screen.querySelector(".navigate-screen__tabbar").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tab]");
    if (btn) {
      switchTab(btn.dataset.tab);
      return;
    }
    if (e.target.closest("[data-action=end]")) {
      endDialog.showModal?.() ?? (endDialog.open = true);
    }
  });

  endDialog.querySelector(".nav-end-dialog__cancel").addEventListener("click", () => {
    endDialog.close?.() ?? (endDialog.open = false);
  });
  endDialog.querySelector(".nav-end-dialog__confirm").addEventListener("click", () => {
    endSession();
    navigate(`/route/${routeId}`);
  });

  function switchTab(tab) {
    activeTab = tab;
    tabBtns.forEach((b) => {
      b.classList.toggle("is-active", b.dataset.tab === tab);
      b.setAttribute("aria-pressed", b.dataset.tab === tab ? "true" : "false");
    });
    const isMap = tab === TABS.MAP;
    mapView.hidden   = !isMap;
    dadesView.hidden = isMap;
    dadesRemaining.textContent = t("nav.dades.remaining");
  }

  // ── GPS watch ─────────────────────────────────────────────────────────────
  if (navigator.geolocation) {
    watchCleanup = (() => {
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          userCoords = [pos.coords.longitude, pos.coords.latitude];
          gpsBanner.hidden = true;
          updatePositionMarker();
          checkProximity();
        },
        (err) => {
          gpsBanner.hidden = false;
          console.warn("[Sa Blava] GPS error", err.code, err.message);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5_000 }
      );
      return () => navigator.geolocation.clearWatch(id);
    })();
  } else {
    gpsBanner.hidden = false;
  }

  // ── Mapbox map ────────────────────────────────────────────────────────────
  if (window.mapboxgl && MAPBOX_TOKEN) {
    mapboxgl.accessToken = MAPBOX_TOKEN;
    mapInstance = new mapboxgl.Map({
      container: mapView,
      style: MAPBOX_STYLE,
      center: MARINA.coords,
      zoom: 14,
      bearing: 0,
      interactive: true,
      attributionControl: false,
    });

    mapInstance.on("load", () => {
      mapReady = true;

      // Route line.
      const coords = [MARINA.coords, ...activePois.map((p) => p.coords), MARINA.coords];
      mapInstance.addSource("nav-route", {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "LineString", coordinates: coords } },
      });
      mapInstance.addLayer({
        id: "nav-route-line",
        type: "line",
        source: "nav-route",
        paint: { "line-color": "#1B6B8A", "line-width": 3, "line-opacity": 0.8, "line-dasharray": [2, 1.5] },
      });

      // POI markers.
      activePois.forEach((poi, i) => {
        const el = document.createElement("div");
        el.className = "nav-poi-marker";
        el.textContent = i + 1;
        el.dataset.poiMarker = i;
        new mapboxgl.Marker({ element: el }).setLngLat(poi.coords).addTo(mapInstance);
      });

      // Live position marker (blue dot with pulse).
      const posEl = document.createElement("div");
      posEl.className = "nav-position-marker";
      positionMarker = new mapboxgl.Marker({ element: posEl })
        .setLngLat(userCoords ?? MARINA.coords)
        .addTo(mapInstance);

      // Recenter button.
      const recenterEl = document.createElement("button");
      recenterEl.className = "nav-recenter-btn";
      recenterEl.innerHTML = `<img src="./assets/icons/regular/NavigationArrow.svg" width="20" height="20" alt="Recentrar" />`;
      recenterEl.addEventListener("click", () => {
        if (userCoords) mapInstance.flyTo({ center: userCoords, zoom: 15, duration: 600 });
      });
      mapView.appendChild(recenterEl);

      if (userCoords) mapInstance.flyTo({ center: userCoords, zoom: 15 });
      highlightActivePOI();
    });
  }

  function updatePositionMarker() {
    if (!mapReady || !userCoords || !positionMarker) return;
    positionMarker.setLngLat(userCoords);
  }

  function highlightActivePOI() {
    screen.querySelectorAll("[data-poi-marker]").forEach((el) => {
      el.classList.toggle("is-active", Number(el.dataset.poiMarker) === activePOIIdx);
    });
  }

  // ── Proximity check ───────────────────────────────────────────────────────
  function checkProximity() {
    if (!userCoords || activePOIIdx >= activePois.length) return;
    const nextPoi = activePois[activePOIIdx];
    const dist = haversineM(userCoords, nextPoi.coords);
    if (dist <= NAV_ARRIVAL_THRESHOLD_M) {
      speak("nav.voice.approach", lang, nextPoi.name[lang] ?? nextPoi.name.ca);
      advancePOI();
    }
  }

  function advancePOI() {
    activePOIIdx = Math.min(activePOIIdx + 1, activePois.length);
    highlightActivePOI();
  }

  // ── rAF tick loop (~1/sec) ────────────────────────────────────────────────
  function tick(ts) {
    if (ts - lastTickMs >= 1000) {
      lastTickMs = ts;
      updateUI();
      checkThresholds();
    }
    rafId = requestAnimationFrame(tick);
  }

  function updateUI() {
    const remMs   = timeRemainingMs();
    const isOver  = remMs < 0;
    const absMs   = Math.abs(remMs);
    const totalSec = Math.floor(absMs / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const timeStr = h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
    const displayStr = isOver ? `+${timeStr}` : timeStr;

    // Status bar.
    statusTime.textContent = displayStr;
    statusTime.classList.toggle("is-overtime", isOver);

    const poi = activePois[activePOIIdx];
    if (poi) {
      statusPoi.textContent = `POI ${activePOIIdx + 1}/${activePois.length}`;
      const dist = userCoords ? Math.round(haversineM(userCoords, poi.coords)) : null;
      statusDist.textContent = dist !== null ? `${dist} m` : "";
    } else {
      statusPoi.textContent = `✓ ${activePois.length}/${activePois.length}`;
      const baseDist = userCoords ? Math.round(haversineM(userCoords, MARINA.coords)) : null;
      statusDist.textContent = baseDist !== null ? `${baseDist} m` : "";
    }

    // Overtime banner.
    if (isOver) {
      const overMin = Math.floor(absMs / 60_000);
      overtimeBanner.hidden      = false;
      overtimeBanner.textContent = t("nav.overtime.banner", overMin);
      overtimeBanner.classList.add("is-overtime");
    }

    // Dades view.
    if (activeTab === TABS.DATA) {
      dadesTime.textContent = displayStr;
      dadesTime.classList.toggle("is-overtime", isOver);

      if (poi) {
        const distM = userCoords ? Math.round(haversineM(userCoords, poi.coords)) : null;
        dadesPoi.textContent  = t("nav.dades.next", activePOIIdx + 1, poi.name[lang] ?? poi.name.ca);
        dadesDist.textContent = distM !== null ? `${distM} m` : "--";
      } else {
        dadesPoi.textContent  = `✓ Ruta completada`;
        dadesDist.textContent = "";
      }

      const baseDist = userCoords ? Math.round(haversineM(userCoords, MARINA.coords)) : null;
      if (baseDist !== null) {
        const baseMin = Math.round((baseDist / 1000) / KAYAK_SPEED_KMH * 60);
        dadesBase.textContent = t("nav.dades.base", baseMin, baseDist);
      } else {
        dadesBase.textContent = "";
      }
    }
  }

  // ── Threshold warnings ────────────────────────────────────────────────────
  function checkThresholds() {
    const remMs  = timeRemainingMs();
    if (isNaN(remMs)) return;
    const remMin = remMs / 60_000;

    for (const threshMin of OVERTIME_WARNINGS_MIN) {
      const key = `t${threshMin}`;
      if (!firedThresholds.has(key) && remMin <= threshMin) {
        firedThresholds.add(key);
        fireWarning(threshMin);
      }
    }
  }

  function fireWarning(threshMin) {
    const voiceKey = threshMin === 0 ? "nav.voice.t0"
      : threshMin === 5  ? "nav.voice.t5"
      : threshMin === 15 ? "nav.voice.t15"
      : "nav.voice.t30";

    if (threshMin === 0) chime();
    speak(voiceKey, lang);

    // Flash a banner overlay for 4 seconds.
    const banner = document.createElement("div");
    banner.className = "nav-threshold-banner";
    banner.textContent = t(voiceKey);
    screen.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add("is-visible"));
    setTimeout(() => {
      banner.classList.remove("is-visible");
      banner.addEventListener("transitionend", () => banner.remove(), { once: true });
    }, 4000);
  }

  // ── Wake lock ─────────────────────────────────────────────────────────────
  acquire();
  const cleanupVisibility = attachVisibilityHandler();

  // ── Activate ──────────────────────────────────────────────────────────────
  requestAnimationFrame(() => {
    screen.classList.add("is-active");
    rafId = requestAnimationFrame(tick);
    // Immediately render UI without waiting for first 1s tick.
    updateUI();
  });

  // ── Teardown ──────────────────────────────────────────────────────────────
  return {
    name: "navigate",
    routeId,
    teardown() {
      if (rafId) cancelAnimationFrame(rafId);
      if (watchCleanup) watchCleanup();
      cleanupVisibility();
      release();
      if (mapInstance) { mapInstance.remove(); mapInstance = null; }
      screen.classList.remove("is-active");
      setTimeout(() => screen.remove(), 320);
    },
  };
}

// screens/navigate.js — Full-screen GPS navigation screen.
//
// Layout:
//   - Map fills full screen (z-index 0)
//   - Floating header at top (z-index 4): back/end btn | Punt N · POI name
//   - Dades overlay (z-index 2): shown over map when Dades tab active
//   - Bottom panel (z-index 3): Mapa/Dades toggle | stats | timeline | kayak
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
import { MAPBOX_TOKEN, MAPBOX_STYLE, MAPBOX_SATELLITE_STYLE, OVERTIME_WARNINGS_MIN, NAV_ARRIVAL_THRESHOLD_M, KAYAK_SPEED_KMH } from "../config.js";
import { addRouteTrack } from "./map.js";
import { mountNavTweakpane } from "../dev/nav-tweakpane.js";

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
  let isSatellite      = false;
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
    <div class="nav-float-header">
      <button class="nav-map-btn nav-end-trigger" type="button" aria-label="${t("nav.end")}">
        <img src="./assets/icons/regular/CaretLeft.svg" width="20" height="20" alt="" aria-hidden="true" />
      </button>

      <div class="nav-float-header__poi">
        <span class="nav-float-poi-label"></span>
        <span class="nav-float-poi-name"></span>
      </div>

      <div class="nav-map-btn-group">
        <button class="nav-map-btn nav-layer-btn" type="button" aria-label="${t("map.toggleLayer")}" aria-pressed="false">
          <img src="./assets/icons/regular/Stack.svg" width="20" height="20" alt="" aria-hidden="true" />
        </button>
        <button class="nav-map-btn nav-recenter-btn" type="button" aria-label="Recentrar">
          <img src="./assets/icons/regular/NavigationArrow.svg" width="20" height="20" alt="" aria-hidden="true" />
        </button>
        <button class="nav-map-btn nav-sos-btn" type="button" aria-label="SOS">SOS</button>
      </div>
    </div>

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

    <div class="nav-bottom">
      <div class="nav-tab-toggle">
        <button class="nav-tab-btn is-active" data-tab="${TABS.MAP}" type="button" aria-pressed="true">
          ${t("nav.tab.map")}
        </button>
        <button class="nav-tab-btn" data-tab="${TABS.DATA}" type="button" aria-pressed="false">
          ${t("nav.tab.data")}
        </button>
      </div>

      <div class="navigate-screen__panel">
        <div class="nav-panel-map-content">
          <div class="nav-stats-row">
            <div class="nav-stat">
              <span class="nav-stat__label">${t("nav.stat.time")}</span>
              <span class="nav-stat__value nav-status-time" aria-live="polite">--</span>
            </div>
            <div class="nav-stat">
              <span class="nav-stat__label">${t("nav.stat.next")}</span>
              <span class="nav-stat__value nav-status-dist">--</span>
            </div>
            <div class="nav-stat">
              <span class="nav-stat__label">${t("nav.stat.progress")}</span>
              <div class="nav-stat__value-row">
                <span class="nav-stat__value nav-status-progress">0%</span>
                <span class="nav-direction-badge"></span>
              </div>
            </div>
          </div>

          <div class="nav-timeline">
            <div class="nav-timeline__scroll">
              <div class="nav-timeline__track"></div>
              <div class="nav-timeline__needle"></div>
            </div>
          </div>

          <div class="nav-kayak">
            <img src="./assets/illustrations/kayak/kayak.jpg" alt="" aria-hidden="true" />
          </div>
        </div>
      </div>
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

  // ── Timeline ticks (decorative ruler) ─────────────────────────────────────
  // ── Element refs ──────────────────────────────────────────────────────────
  const floatPoiLabel    = screen.querySelector(".nav-float-poi-label");
  const floatPoiName     = screen.querySelector(".nav-float-poi-name");
  const layerBtn         = screen.querySelector(".nav-layer-btn");
  const recenterBtn      = screen.querySelector(".nav-recenter-btn");
  const mapView          = screen.querySelector(".navigate-map-view");
  const dadesView        = screen.querySelector(".navigate-dades-view");
  const panelMapContent  = screen.querySelector(".nav-panel-map-content");
  const statusTime       = screen.querySelector(".nav-status-time");
  const statusDist       = screen.querySelector(".nav-status-dist");
  const statusProgress   = screen.querySelector(".nav-status-progress");
  const dirBadge         = screen.querySelector(".nav-direction-badge");
  const timelineTrack    = screen.querySelector(".nav-timeline__track");
  const dadesTime        = screen.querySelector(".dades-time");
  const dadesRemaining   = screen.querySelector(".dades-remaining");
  const dadesPoi         = screen.querySelector(".dades-poi-label");
  const dadesDist        = screen.querySelector(".dades-poi-dist");
  const dadesBase        = screen.querySelector(".dades-base-label");
  const overtimeBanner   = screen.querySelector(".navigate-screen__overtime-banner");
  const gpsBanner        = screen.querySelector(".navigate-screen__gps-banner");
  const endDialog        = screen.querySelector(".nav-end-dialog");
  const tabBtns          = screen.querySelectorAll(".nav-tab-btn");

  // ── End-trip trigger (back button) ────────────────────────────────────────
  screen.querySelector(".nav-end-trigger").addEventListener("click", () => {
    endDialog.showModal?.() ?? (endDialog.open = true);
  });

  // ── Layer toggle ──────────────────────────────────────────────────────────
  layerBtn.addEventListener("click", () => {
    if (!mapInstance) return;
    isSatellite = !isSatellite;
    layerBtn.innerHTML = isSatellite
      ? `<img src="./assets/icons/regular/Stack-filled.svg" width="20" height="20" alt="" aria-hidden="true" />`
      : `<img src="./assets/icons/regular/Stack.svg" width="20" height="20" alt="" aria-hidden="true" />`;
    layerBtn.setAttribute("aria-pressed", String(isSatellite));
    mapInstance.setStyle(isSatellite ? MAPBOX_SATELLITE_STYLE : MAPBOX_STYLE);
  });

  // ── Recenter button ───────────────────────────────────────────────────────
  recenterBtn.addEventListener("click", () => {
    if (userCoords && mapInstance) mapInstance.flyTo({ center: userCoords, zoom: 15, duration: 600 });
  });

  // ── SOS button ────────────────────────────────────────────────────────────
  screen.querySelector(".nav-sos-btn").addEventListener("click", () => {
    window.location.href = "tel:112";
  });

  endDialog.querySelector(".nav-end-dialog__cancel").addEventListener("click", () => {
    endDialog.close?.() ?? (endDialog.open = false);
  });
  endDialog.querySelector(".nav-end-dialog__confirm").addEventListener("click", () => {
    endSession();
    navigate(`/route/${routeId}`);
  });

  // ── Timeline — build once based on real route distance ───────────────────
  // Each vertical line = 100 m. POI lines are taller and darker.
  // The track translates so the current position always aligns with the needle.
  const METERS_PER_TICK = 20;
  const LINE_STEP = 16; // px per tick — must match .nav-timeline__tick { flex: 0 0 16px }

  function initTimeline() {
    const totalDistM = (route.distanceKm ?? 4) * 1000;
    const tickCount  = Math.ceil(totalDistM / METERS_PER_TICK);

    // First active POI is anchored at tick 0 (under the needle at trip start).
    // Subsequent POIs placed at their cumulative distances from the first.
    const poiTicks = new Map(); // tickIndex → { n, name }
    if (activePois.length > 0) {
      poiTicks.set(0, { n: 1, name: activePois[0].name[lang] ?? activePois[0].name.ca });
    }
    let cum = 0;
    for (let i = 1; i < activePois.length; i++) {
      cum += haversineM(activePois[i - 1].coords, activePois[i].coords);
      const tidx = Math.round(cum / METERS_PER_TICK);
      poiTicks.set(tidx, { n: i + 1, name: activePois[i].name[lang] ?? activePois[i].name.ca });
    }

    for (let i = 0; i < tickCount; i++) {
      const tick    = document.createElement("div");
      const poiData = poiTicks.get(i);
      if (poiData) {
        tick.className = "nav-timeline__tick nav-timeline__tick--poi";
        const line = document.createElement("div");
        line.className = "nav-timeline__line nav-timeline__line--poi";
        tick.appendChild(line);
        const lbl = document.createElement("span");
        lbl.className = "nav-timeline__tick-label";
        lbl.textContent = `${poiData.n} – ${poiData.name}`;
        tick.appendChild(lbl);
      } else {
        tick.className = "nav-timeline__tick";
        const line = document.createElement("div");
        line.className = "nav-timeline__line";
        tick.appendChild(line);
      }
      timelineTrack.appendChild(tick);
    }
  }
  initTimeline();

  function updateTimeline() {
    // Distance is measured from activePois[0] (tick 0).
    // The marina → first POI leg is not reflected; needle stays at tick 0
    // until the user reaches the first POI and activePOIIdx advances.
    let distM = 0;
    for (let i = 1; i <= activePOIIdx && i < activePois.length; i++) {
      distM += haversineM(activePois[i - 1].coords, activePois[i].coords);
    }
    if (userCoords && activePOIIdx > 0 && activePOIIdx < activePois.length) {
      const legTotal = haversineM(activePois[activePOIIdx - 1].coords, activePois[activePOIIdx].coords);
      const toNext   = haversineM(userCoords, activePois[activePOIIdx].coords);
      distM += Math.max(0, legTotal - toNext);
    }

    const currentTick = Math.round(distM / METERS_PER_TICK);
    const needleX     = timelineTrack.parentElement.offsetWidth / 2;
    timelineTrack.style.transform = `translateX(${needleX - currentTick * LINE_STEP}px)`;
  }

  // ── Tab switching ─────────────────────────────────────────────────────────
  screen.querySelector(".nav-tab-toggle").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tab]");
    if (btn) switchTab(btn.dataset.tab);
  });

  function switchTab(tab) {
    activeTab = tab;
    tabBtns.forEach((b) => {
      b.classList.toggle("is-active", b.dataset.tab === tab);
      b.setAttribute("aria-pressed", b.dataset.tab === tab ? "true" : "false");
    });
    const isMap = tab === TABS.MAP;
    // Hide map canvas when showing dades (saves GPU).
    mapView.style.display = isMap ? "" : "none";
    panelMapContent.hidden = !isMap;
    dadesView.hidden = isMap;
    if (!isMap) dadesRemaining.textContent = t("nav.dades.remaining");
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

  // ── Dev panel ─────────────────────────────────────────────────────────────
  if (!window.mapboxgl || !MAPBOX_TOKEN) mountNavTweakpane(null);

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

    // Re-add route on every style load (covers initial load + satellite toggle).
    // When the user removes POIs, draw straight segments so the line doesn't
    // pass through excluded locations.
    const allPoisIncluded = !session.includedPoiIndices ||
      session.includedPoiIndices.length === route.pois.length;

    mapInstance.on("style.load", () => {
      if (route.track && route.track.length > 1 && allPoisIncluded) {
        addRouteTrack(mapInstance, route);
      } else {
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
      }
    });

    mapInstance.on("load", () => {
      mapReady = true;

      // POI markers (DOM-based, survive style changes — add once).
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

      if (userCoords) mapInstance.flyTo({ center: userCoords, zoom: 15 });
      highlightActivePOI();
      mountNavTweakpane(mapInstance);
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
    const remMs    = timeRemainingMs();
    const isOver   = remMs < 0;
    const absMs    = Math.abs(remMs);
    const totalSec = Math.floor(absMs / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const timeStr = h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
    const displayStr = isOver ? `+${timeStr}` : timeStr;

    // Time stat.
    statusTime.textContent = displayStr;
    statusTime.classList.toggle("is-overtime", isOver);

    const poi = activePois[activePOIIdx];

    // Floating header: current target POI.
    if (poi) {
      floatPoiLabel.textContent = t("nav.float.poi", activePOIIdx + 1);
      floatPoiName.textContent  = poi.name[lang] ?? poi.name.ca;
    } else {
      floatPoiLabel.textContent = t("nav.float.poi.done");
      floatPoiName.textContent  = "";
    }

    // Next-point distance stat.
    if (poi) {
      const dist = userCoords ? Math.round(haversineM(userCoords, poi.coords)) : null;
      statusDist.textContent = dist !== null ? `${dist} m` : "--";
    } else {
      const baseDist = userCoords ? Math.round(haversineM(userCoords, MARINA.coords)) : null;
      statusDist.textContent = baseDist !== null ? `${baseDist} m` : "--";
    }

    // Progress stat + direction badge.
    const progressPct = Math.round((activePOIIdx / activePois.length) * 100);
    statusProgress.textContent = `${progressPct}%`;
    const isReturn = activePOIIdx >= Math.ceil(activePois.length / 2);
    dirBadge.textContent = isReturn ? t("nav.direction.back") : t("nav.direction.out");

    // Timeline.
    updateTimeline();

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

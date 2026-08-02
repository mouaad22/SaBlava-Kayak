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
  getFiredThresholds, markThresholdsFired,
} from "../nav/session.js";
import { haversineM, trackThroughPois, watchFilteredPosition, planDeniedBanner } from "../nav/geo.js";
import { createTripProgress } from "../nav/trip-progress.js";
import { reconcileThresholds } from "../nav/alerts.js";
import { speak, chime, announceArrival, notify, vibrate, prime } from "../nav/audio.js";
import { acquire, release, attachVisibilityHandler } from "../nav/wake-lock.js";
import { ensurePushSubscription } from "../nav/push.js";
import { MAPBOX_TOKEN, MAPBOX_STYLE, MAPBOX_SATELLITE_STYLE, ALERT_RESUME_GRACE_MS, KAYAK_SPEED_KMH } from "../config.js";
import { addRouteTrack } from "./map.js";
import { mountNavTweakpane } from "../dev/nav-tweakpane.js";
import { getKayakId } from "../kayak.js";
import { getDeviceToken, isIOS, isStandalone } from "../nav/device.js";

const TABS = { MAP: "map", DATA: "data" };

// Vibration patterns (ms; arrays are on/off/on…). A pocketed phone still buzzes
// these where navigator.vibrate is supported (Android Chrome; ignored on iOS).
const VIBE_ARRIVAL = [120];            // gentle single pulse — a POI is reached
const VIBE_URGENT  = [200, 100, 200];  // double buzz — T-0 / "head back" / unsafe

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
    .map((idx) => route.pois[idx])
    .filter(Boolean);

  // ── Mutable state ─────────────────────────────────────────────────────────
  let activeTab        = TABS.MAP;
  let activePOIIdx     = 0;        // index into activePois
  let isSatellite      = false;
  let userCoords       = null;     // [lng, lat] | null
  let mapInstance      = null;
  let mapReady         = false;
  let positionMarker   = null;
  let watchCleanup     = null;
  // Consecutive code-1 denials across watch attempts. Drives whether the denied
  // banner offers just a retry (1st) or the settings path too (2nd+); reset on
  // any accepted fix so a later, unrelated denial starts from the gentle case.
  let deniedCount      = 0;
  let rafId            = null;
  let clockId          = null;     // setInterval id for the wall-clock alert tick
  let lastTickMs       = 0;
  // Seed from the session so a refresh / background-lock mid-trip cannot replay
  // an already-fired time warning. nav/alerts.js owns which are due; we persist
  // the ones announced (see markThresholdsFired).
  const firedThresholds = new Set(getFiredThresholds()); // "t30" | "t15" | "t5" | "t0"

  // Trip phase mirrors the reducer below: "out" = anada (heading through the
  // POIs), "back" = tornada (returning to base). updateUI and the threshold net
  // read these; trip-progress.js owns the authoritative transitions.
  let phase            = "out";
  let shortWarned      = false; // "not enough time to get back" warned once

  // ── Trip-progress state machine (pure; owns arrival/turnaround/progress) ────
  // navigate.js only feeds it accepted fixes and renders/announces its output.
  const progress = createTripProgress({
    track: route.track && route.track.length > 1 ? route.track : null,
    activePois,
    marinaCoords: MARINA.coords,
    durationMs: (session.durationHours ?? 0) * 3_600_000,
    startedAtMs: session.startedAtMs,
  });
  let snap = progress.getSnapshot(); // latest reducer snapshot, read by updateUI

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
    <div class="nav-map-gradient" aria-hidden="true"></div>

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

          <!-- TODO(next session): timeline + kayak are broken — hidden for now. -->
          <div class="nav-timeline" hidden>
            <div class="nav-timeline__scroll">
              <div class="nav-timeline__track"></div>
              <div class="nav-timeline__needle"></div>
            </div>
          </div>

          <div class="nav-kayak" hidden>
            <img src="./assets/illustrations/kayak/kayak.webp" alt="" aria-hidden="true" />
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
      <span class="nav-gps-banner__msg"></span>
      <span class="nav-gps-banner__help" hidden></span>
      <button class="nav-gps-banner__retry" type="button" hidden>${t("nav.gps.retry")}</button>
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
  const gpsBannerMsg     = screen.querySelector(".nav-gps-banner__msg");
  const gpsBannerHelp    = screen.querySelector(".nav-gps-banner__help");
  const gpsBannerRetry   = screen.querySelector(".nav-gps-banner__retry");
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
  // With a fix in hand it recenters the map on the paddler. With no fix yet —
  // GPS still acquiring, or permission accidentally denied — it doubles as a
  // permission re-trigger: restarting the watch re-requests geolocation (the
  // same path as the banner's retry button). Browsers that have hard-denied
  // won't re-prompt, but a dismissed/soft "no" gets another chance.
  recenterBtn.addEventListener("click", () => {
    if (userCoords && mapInstance) {
      mapInstance.flyTo({ center: userCoords, zoom: 15, duration: 600 });
    } else {
      startWatch();
    }
  });

  // ── SOS button ────────────────────────────────────────────────────────────
  screen.querySelector(".nav-sos-btn").addEventListener("click", () => {
    window.location.href = "tel:+34615243384";
  });

  endDialog.querySelector(".nav-end-dialog__cancel").addEventListener("click", () => {
    endDialog.close?.() ?? (endDialog.open = false);
  });
  endDialog.querySelector(".nav-end-dialog__confirm").addEventListener("click", () => {
    // Tell the server the customer finished so the kayak shows as a pending return
    // on the staff board instead of silently staying "active". Best-effort and not
    // awaited (keepalive lets it outlive teardown) — it only flags the session;
    // staff still confirm the physical return. A failure must never block exit.
    reportSessionEnd();
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

    // Layer 1 — lines only (no labels, so tick widths are never polluted by text)
    const linesEl = document.createElement("div");
    linesEl.className = "nav-timeline__lines";
    for (let i = 0; i < tickCount; i++) {
      const tick = document.createElement("div");
      tick.className = "nav-timeline__tick";
      const line = document.createElement("div");
      line.className = poiTicks.has(i)
        ? "nav-timeline__line nav-timeline__line--poi"
        : "nav-timeline__line";
      tick.appendChild(line);
      linesEl.appendChild(tick);
    }

    // Layer 2 — POI labels at their exact x positions, no layout impact on lines
    const poisEl = document.createElement("div");
    poisEl.className = "nav-timeline__pois";
    for (const [tidx, poiData] of poiTicks) {
      const lbl = document.createElement("span");
      lbl.className = "nav-timeline__poi-label";
      lbl.style.left = `${tidx * LINE_STEP}px`;
      lbl.textContent = `${poiData.n} – ${poiData.name}`;
      poisEl.appendChild(lbl);
    }

    timelineTrack.style.width = `${tickCount * LINE_STEP}px`;
    timelineTrack.appendChild(linesEl);
    timelineTrack.appendChild(poisEl);
  }
  // TODO(next session): timeline hidden while broken — skip init + ticks.
  // initTimeline();

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
  // Reflect a coarse GPS state to the banner. "acquiring" is non-alarming and
  // auto-hides on the first accepted fix; timeout/unavailable/denied surface an
  // honest message and ALWAYS offer a retry — a wasted tap costs nothing, while
  // a missing button strands a paddler who could have recovered in one tap.
  function setGpsState(state) {
    switch (state) {
      case "ok":
        deniedCount = 0;
        gpsBanner.hidden = true;
        return;
      case "acquiring":
        showGpsBanner(t("nav.gps.acquiring"), { tone: "info" });
        return;
      case "low-accuracy":
        showGpsBanner(t("nav.gps.weak"), { tone: "info" });
        return;
      case "timeout":
        // A timeout is the MOST recoverable state there is — the fix is usually
        // just "wait a bit longer under open sky". It previously offered no way
        // back at all.
        showGpsBanner(t("nav.gps.timeout"), { tone: "warn", retry: true });
        return;
      case "unavailable":
        showGpsBanner(t("nav.gps.unavailable"), { tone: "warn", retry: true });
        return;
      case "denied":
        deniedCount++;
        showDeniedBanner();
        return;
    }
  }

  // A code-1 denial can't be classified from the error alone, so the escalation
  // (retry first, settings path only once a retry has been spent) lives in the
  // pure planDeniedBanner — see its docblock for why.
  function showDeniedBanner() {
    const plan = planDeniedBanner(deniedCount, { ios: isIOS(), standalone: isStandalone() });
    showGpsBanner(t(plan.messageKey), {
      tone:  "warn",
      retry: plan.retry,
      help:  plan.helpKey ? t(plan.helpKey) : "",
    });
  }

  function showGpsBanner(msg, { tone = "warn", retry = false, help = "" } = {}) {
    gpsBannerMsg.textContent  = msg;
    gpsBannerHelp.textContent = help;
    gpsBannerHelp.hidden      = !help;
    gpsBannerRetry.hidden     = !retry;
    gpsBanner.classList.toggle("is-info", tone === "info");
    gpsBanner.hidden          = false;
  }

  function startWatch() {
    if (watchCleanup) { watchCleanup(); watchCleanup = null; }
    watchCleanup = watchFilteredPosition(
      (pos) => {
        userCoords = [pos.coords.longitude, pos.coords.latitude];
        updatePositionMarker();
        checkProximity();
      },
      setGpsState,
    );
  }

  gpsBannerRetry.addEventListener("click", startWatch);
  startWatch();

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
    // Follow the recorded GPS track so the drawn line hugs the coast — even for
    // shorter durations or after the user removes a POI, where the navigated
    // POIs are only a subset. Each active POI is projected onto the track and
    // the track is walked between them (see trackThroughPois). Only routes that
    // ship no GPS track fall back to straight segments through the POIs.
    mapInstance.on("style.load", () => {
      if (route.track && route.track.length > 1) {
        const coords = trackThroughPois(route.track, activePois.map((p) => p.coords));
        addRouteTrack(mapInstance, route, coords);
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

      // Live position marker is created lazily on the first accepted GPS fix
      // (see updatePositionMarker) so the marina dot is never mistaken for the
      // paddler's position while GPS is still acquiring.
      updatePositionMarker();
      highlightActivePOI();
      mountNavTweakpane(mapInstance);
    });
  }

  function updatePositionMarker() {
    if (!mapReady || !userCoords || !mapInstance) return;
    // Create the blue dot on the first accepted fix, then just move it.
    if (!positionMarker) {
      const posEl = document.createElement("div");
      posEl.className = "nav-position-marker";
      positionMarker = new mapboxgl.Marker({ element: posEl })
        .setLngLat(userCoords)
        .addTo(mapInstance);
      mapInstance.flyTo({ center: userCoords, zoom: 15 });
      return;
    }
    positionMarker.setLngLat(userCoords);
  }

  function highlightActivePOI() {
    screen.querySelectorAll("[data-poi-marker]").forEach((el) => {
      el.classList.toggle("is-active", Number(el.dataset.poiMarker) === activePOIIdx);
    });
  }

  // ── Proximity check ───────────────────────────────────────────────────────
  // Feed each accepted fix into the trip-progress reducer, mirror the bits the
  // rest of the screen reads (phase, activePOIIdx), and turn its events into the
  // chimes / voice cues / banners. All arrival + turnaround LOGIC lives in
  // trip-progress.js; navigate.js only does the DOM/announce wiring.
  function checkProximity() {
    if (!userCoords) return;
    snap = progress.update({ coords: userCoords, tMs: Date.now() });
    activePOIIdx = snap.activePOIIdx;
    phase = snap.phase;
    highlightActivePOI();
    snap.events.forEach(handleProgressEvent);
  }

  function handleProgressEvent(ev) {
    switch (ev.type) {
      case "arrival":
      case "pass": {
        // Both mean the paddler genuinely got to / past this POI — warm cue,
        // plus a notification + buzz so it lands on a pocketed/hidden phone.
        const poi = activePois[ev.poiIdx];
        if (poi) {
          const name = poi.name[lang] ?? poi.name.ca;
          announceArrival(name, lang);
          notify({ title: t("nav.notify.arrival"), body: name, tag: "nav-arrival", vibrate: VIBE_ARRIVAL });
          vibrate(VIBE_ARRIVAL);
        }
        return;
      }
      case "turnaround":
        announceTurnaround(ev);
        return;
      case "return-unsafe": {
        // Decoupled safety net: fires even if the last POI was never reached
        // within 50 m. One-time voice + banner; suppress the legacy net.
        shortWarned = true;
        const m = Math.max(0, Math.round(ev.remainingMs / 60_000));
        speak("nav.voice.short", lang, m);
        flashBanner(t("nav.voice.short", m));
        notify({ title: t("nav.notify.return"), body: t("nav.voice.short", m), tag: "nav-return", vibrate: VIBE_URGENT });
        vibrate(VIBE_URGENT);
        return;
      }
    }
  }

  // Turnaround cue: chime + a spoken line that ALWAYS states the remaining time
  // and tells the paddler to head back. The reducer decides `short` (the
  // wall-clock can't cover the paddle home) — the urgent variant plays and the
  // live time stat goes red (see updateUI).
  function announceTurnaround(ev) {
    const lastPoi  = activePois[ev.poiIdx];
    const lastName = lastPoi ? (lastPoi.name[lang] ?? lastPoi.name.ca) : "";
    const remMin   = Math.max(0, Math.round(timeRemainingMs() / 60_000));
    shortWarned    = ev.short; // a short turnaround already warns → suppress the mid-return net

    const key = ev.short ? "nav.voice.turnaround.short" : "nav.voice.turnaround";
    chime();
    // Let the chime ring first, then speak — same two-beat feel as arrivals.
    setTimeout(() => speak(key, lang, lastName, remMin), 1200);
    flashBanner(t(key, lastName, remMin));
    notify({ title: t("nav.notify.turnaround"), body: t(key, lastName, remMin), tag: "nav-turnaround", vibrate: VIBE_URGENT });
    vibrate(VIBE_URGENT);
  }

  // ── rAF repaint loop (~1/sec) ─────────────────────────────────────────────
  // rAF drives the SMOOTH UI repaint only (countdown, progress, distances — all
  // already derived from the wall clock via timeRemainingMs/the reducer). It is
  // intentionally NOT responsible for time-warning correctness: rAF throttles
  // hard when the tab is backgrounded or the screen locks, which used to drop or
  // delay the 30/15/5/0-min cues. Those run off the wall-clock interval below.
  function tick(ts) {
    if (ts - lastTickMs >= 1000) {
      lastTickMs = ts;
      updateUI();
    }
    rafId = requestAnimationFrame(tick);
  }

  // ── Wall-clock alert tick (independent of rAF) ────────────────────────────
  // A plain interval whose correctness comes from Date.now inside checkThresholds,
  // so the warnings fire at the right wall-clock times even if rAF stalls.
  // Coalesced / late / dropped interval ticks are harmless: checkThresholds
  // reconciles against the clock, not against tick count, and a tick missed while
  // the page is hidden is recovered by onVisible below.
  function startClock() {
    clockId = setInterval(checkThresholds, 1000);
  }

  // Resume reconciliation: on returning to a visible page, immediately recompute
  // (don't wait up to a second for the interval) so a missed warning that
  // crossed while hidden surfaces at once — reconcileThresholds collapses a
  // backlog to a single fresh cue. Also repaints the countdown right away.
  function onVisible() {
    if (document.visibilityState !== "visible") return;
    // iOS drops the audio/TTS unlock after a lock or long inactivity. Re-prime
    // (idempotent) on resume so the next voice cue still speaks. This runs
    // inside the visibilitychange handler, which iOS treats as a user gesture.
    prime(lang);
    // Permission may have just been granted via this gesture — (re)register for
    // server-sent timed pushes so a backgrounded phone still gets the warnings.
    ensurePushSubscription(lang);
    updateUI();
    checkThresholds();
  }
  document.addEventListener("visibilitychange", onVisible);

  function updateUI() {
    const remMs    = timeRemainingMs();
    const isOver   = remMs < 0;
    const absMs    = Math.abs(remMs);
    const totalSec = Math.floor(absMs / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const u = (s) => `<span class="nav-stat__unit">${s}</span>`;
    const timeHtml = h > 0
      ? `${isOver ? "+" : ""}${h}${u("h")} ${String(m).padStart(2, "0")}${u("m")}`
      : `${isOver ? "+" : ""}${m}${u("m")}`;
    // Plain-text twin of timeHtml for the Dades tab (set via textContent).
    const timeText = h > 0
      ? `${isOver ? "+" : ""}${h}h ${String(m).padStart(2, "0")}m`
      : `${isOver ? "+" : ""}${m}m`;

    // Distance to base + whether the remaining time still covers the paddle
    // home (distance ÷ paddling speed). The reducer measures this ALONG the
    // track (the real coastline paddle home), not as the crow flies. On the
    // tornada a shortfall paints the time stat red, same as being overtime.
    const baseDistM = userCoords ? snap.baseDistAlongM : null;
    const etaBackMs = baseDistM != null ? (baseDistM / 1000) / KAYAK_SPEED_KMH * 3_600_000 : 0;
    const timeShort = phase === "back" && !isOver && baseDistM != null && remMs < etaBackMs;

    // Time stat.
    statusTime.innerHTML = timeHtml;
    statusTime.classList.toggle("is-overtime", isOver || timeShort);

    // On the tornada the target is the base, so there is no "current POI":
    // header, next-dist, and dades all switch to the return-to-base view.
    const poi = phase === "back" ? null : activePois[activePOIIdx];

    // Floating header: current target POI.
    if (poi) {
      floatPoiLabel.textContent = t("nav.float.poi", activePOIIdx + 1);
      floatPoiName.textContent  = poi.name[lang] ?? poi.name.ca;
    } else {
      floatPoiLabel.textContent = t("nav.float.poi.done");
      floatPoiName.textContent  = "";
    }

    // Next-point distance stat — coastline metres along the track to the next
    // POI (or to base after the last POI), from the reducer. NOT straight-line.
    if (poi) {
      const dist = userCoords ? Math.round(snap.distToTargetM) : null;
      statusDist.innerHTML = dist !== null ? `${dist}${u("m")}` : "--";
    } else {
      statusDist.innerHTML = baseDistM !== null ? `${Math.round(baseDistM)}${u("m")}` : "--";
    }

    // Progress stat + direction badge. The reducer owns the two-period model:
    // anada fills 0→100% as the paddler advances ALONG the track, then the
    // tornada resets and fills as the remaining track distance to base shrinks.
    statusProgress.innerHTML = `${snap.progressPct}${u("%")}`;
    dirBadge.textContent = phase === "back" ? t("nav.direction.back") : t("nav.direction.out");

    // Timeline — hidden while broken (see TODO above).
    // updateTimeline();

    // Overtime banner.
    if (isOver) {
      const overMin = Math.floor(absMs / 60_000);
      overtimeBanner.hidden      = false;
      overtimeBanner.textContent = t("nav.overtime.banner", overMin);
      overtimeBanner.classList.add("is-overtime");
    }

    // Dades view.
    if (activeTab === TABS.DATA) {
      dadesTime.textContent = timeText;
      dadesTime.classList.toggle("is-overtime", isOver || timeShort);

      if (poi) {
        const distM = userCoords ? Math.round(snap.distToTargetM) : null;
        dadesPoi.textContent  = t("nav.dades.next", activePOIIdx + 1, poi.name[lang] ?? poi.name.ca);
        dadesDist.textContent = distM !== null ? `${distM} m` : "--";
      } else {
        dadesPoi.textContent  = `✓ Ruta completada`;
        dadesDist.textContent = "";
      }

      if (baseDistM !== null) {
        const baseMin = Math.round((baseDistM / 1000) / KAYAK_SPEED_KMH * 60);
        dadesBase.textContent = t("nav.dades.base", baseMin, Math.round(baseDistM));
      } else {
        dadesBase.textContent = "";
      }
    }
  }

  // ── Threshold warnings (wall-clock scheduler) ─────────────────────────────
  // Correctness derives from Date.now vs the session's start+duration, NOT from
  // how many ticks ran (nav/alerts.js). reconcileThresholds fires at most one
  // cue — the most recently crossed, and only if within ALERT_RESUME_GRACE_MS —
  // and tells us every threshold to mark fired, so returning from a long
  // background gap announces a single fresh warning instead of a stale backlog.
  // Fired keys are persisted to the session so a reload can't replay them.
  function checkThresholds() {
    const s = getSession();
    if (!s) return;

    const { fire, markFired } = reconcileThresholds({
      nowMs: Date.now(),
      startedAtMs: s.startedAtMs,
      durationMs: s.durationHours * 3_600_000,
      fired: [...firedThresholds],
      graceMs: ALERT_RESUME_GRACE_MS,
    });
    if (markFired.length) {
      markFired.forEach((k) => firedThresholds.add(k));
      markThresholdsFired(markFired);
    }
    if (fire) fireWarning(fire.threshMin);

    // Tornada safety net: if a shortfall develops mid-return (and wasn't already
    // flagged at the turnaround), warn once. The red time stat is live-driven
    // in updateUI; this just adds the one-time voice + banner.
    if (phase === "back" && !shortWarned && userCoords) {
      const remMs     = timeRemainingMs();
      const etaBackMs = (snap.baseDistAlongM / 1000) / KAYAK_SPEED_KMH * 3_600_000;
      if (remMs < etaBackMs) {
        shortWarned = true;
        const m = Math.max(0, Math.round(remMs / 60_000));
        speak("nav.voice.short", lang, m);
        flashBanner(t("nav.voice.short", m));
        notify({ title: t("nav.notify.return"), body: t("nav.voice.short", m), tag: "nav-return", vibrate: VIBE_URGENT });
        vibrate(VIBE_URGENT);
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
    flashBanner(t(voiceKey));
    // Background reach for the time warnings. Only T-0 buzzes (the urgent one);
    // the earlier 30/15/5 cues notify quietly so a pocketed phone isn't nagged.
    notify({ title: t("nav.notify.time"), body: t(voiceKey), tag: "nav-time", vibrate: threshMin === 0 ? VIBE_URGENT : undefined });
    if (threshMin === 0) vibrate(VIBE_URGENT);
  }

  // One-time honesty advisory shown once at trip start: the alert channels are
  // best-effort (esp. iOS Safari, which has no background notifications and a
  // silent switch that can mute the chime), so the only reliable setup is to
  // keep the app open with the screen on. Tap to dismiss; auto-hides after 9s.
  function showStartAdvisory() {
    const el = document.createElement("div");
    el.className = "nav-advisory";
    el.setAttribute("role", "status");
    el.innerHTML = `
      <img src="./assets/icons/regular/Info.svg" width="20" height="20" alt="" aria-hidden="true" />
      <span class="nav-advisory__text">${t("nav.advisory.keepOpen")}</span>
    `;
    const dismiss = () => {
      el.classList.remove("is-visible");
      el.addEventListener("transitionend", () => el.remove(), { once: true });
    };
    el.addEventListener("click", dismiss);
    screen.appendChild(el);
    requestAnimationFrame(() => el.classList.add("is-visible"));
    setTimeout(dismiss, 9000);
  }

  // Transient centered banner that fades itself out after 4s.
  function flashBanner(text) {
    const banner = document.createElement("div");
    banner.className = "nav-threshold-banner";
    banner.textContent = text;
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

  // Register for server-sent timed pushes. No-op unless a QR was scanned and
  // notifications are granted; silently subscribes if a prior trip already
  // granted permission, otherwise the onVisible handler picks it up post-grant.
  ensurePushSubscription(lang);

  // ── Activate ──────────────────────────────────────────────────────────────
  requestAnimationFrame(() => {
    screen.classList.add("is-active");
    rafId = requestAnimationFrame(tick);
    startClock();
    updateUI();
    showStartAdvisory();
  });

  // ── Teardown ──────────────────────────────────────────────────────────────
  return {
    name: "navigate",
    routeId,
    teardown() {
      if (rafId) cancelAnimationFrame(rafId);
      if (clockId) clearInterval(clockId);
      document.removeEventListener("visibilitychange", onVisible);
      if (watchCleanup) watchCleanup();
      cleanupVisibility();
      release();
      if (mapInstance) { mapInstance.remove(); mapInstance = null; }
      screen.classList.remove("is-active");
      setTimeout(() => screen.remove(), 320);
    },
  };
}

// Report the customer's "finish trip" tap to the session API so the staff board
// shows the kayak as a pending return (it never closes the session — staff still
// confirm the physical return). No-op when no QR was scanned (getKayakId() is
// null), and intentionally not awaited: the request is dispatched immediately
// (keepalive lets it outlive the screen teardown) and any failure is swallowed so
// exiting the trip is never blocked by the network.
function reportSessionEnd() {
  const kayakId = getKayakId();
  if (!kayakId) return;
  try {
    fetch("/api/session/end", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kayak_id: kayakId, device_token: getDeviceToken() }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* fetch unavailable — ignore, the local session is cleared regardless */
  }
}

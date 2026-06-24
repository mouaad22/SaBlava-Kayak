// dev/sim.js — Kayak trip simulator for testing the navigate screen.
//
// Paste the contents of this file into the browser DevTools console while the
// app is open at the dev server (python app/server.py → http://localhost:5173).
//
// Controls:
//   __stopSim()          — end simulation and clear session
//   __simSpeed(n)        — change speed multiplier (default 10 = 35 km/h)
//
//   ── Fault injection (session-5 / S5.T1) — exercise the hardening paths the
//      plain happy-path replay can't reach: ──────────────────────────────────
//   __simAccuracy(m)     — set the accuracy (metres) reported on every fix.
//                          Set it ABOVE GPS_MAX_ACCURACY_M (35) to verify the
//                          accuracy filter drops fixes (marker must NOT jump;
//                          a sustained spell raises the "weak signal" banner).
//                          Back to <=35 to recover. Default 4.
//   __simDenied()        — fire the geolocation error callback with code 1
//                          (permission denied) → the denied banner + retry path.
//   __simTimeout()       — error code 3 (timeout) banner.
//   __simUnavailable()   — error code 2 (position unavailable) banner.
//   __simError(code)     — fire an arbitrary geolocation error code.
//   __simGap(sec)        — suspend GPS fixes for `sec` real seconds, simulating
//                          the watch stalling while the screen is locked /
//                          backgrounded. The wall clock keeps running, so the
//                          countdown self-corrects on resume. NOTE: this pauses
//                          GPS only — it does NOT make the browser throttle rAF
//                          or set document.hidden, so the TRUE background-alert
//                          behaviour (system notification, on-resume re-prime)
//                          still has to be confirmed on a real device (S5.T2).

(function startSim() {
  // ── Configuration ─────────────────────────────────────────────────────────
  const ROUTE_ID      = 'sud';
  const DURATION_H    = 1;          // session duration in hours
  const POI_INDICES   = [0,1,2,3,4]; // which sud POIs to include
  let   SPEED_MULT    = 10;          // real-time multiplier (10 = 10× faster)
  const KAYAK_KMH     = 3.5;        // realistic base speed

  // Fault-injection state (driven by the __sim* controls below).
  let   ACCURACY      = 4;            // metres reported on every fix
  let   gapUntil      = 0;            // Date.now() until which fixes are suspended

  // ── Sud-route waypoints (Marina → POIs → Marina) ─────────────────────────
  const WAYPOINTS = [
    [3.2155,   41.9326  ],  // Marina (start / return)
    [3.216217, 41.934067],  // POI 1 – Platja d'Aiguablava
    [3.218867, 41.932333],  // POI 2
    [3.215333, 41.929250],  // POI 3
    [3.217500, 41.927600],  // POI 4
    [3.218300, 41.927133],  // POI 5
    [3.2155,   41.9326  ],  // Marina (return)
  ];

  // ── Geometry helpers ──────────────────────────────────────────────────────
  function haversine([lon1, lat1], [lon2, lat2]) {
    const R = 6371000, r = x => x * Math.PI / 180;
    const dLat = r(lat2 - lat1), dLon = r(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 +
              Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLon/2)**2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  function lerp([a,b], [c,d], t) { return [a + (c-a)*t, b + (d-b)*t]; }

  // Segment table — computed once
  const segs = WAYPOINTS.slice(0,-1).map((p,i) => ({
    from: p,
    to: WAYPOINTS[i+1],
    dist: haversine(p, WAYPOINTS[i+1]),
  }));
  const totalDist = segs.reduce((s,g) => s + g.dist, 0);

  // Return [lon, lat] at simulated elapsed seconds
  function posAt(simSec) {
    const speedMs = (KAYAK_KMH * SPEED_MULT * 1000) / 3600;
    let rem = simSec * speedMs;
    for (const { from, to, dist } of segs) {
      if (rem <= dist) return lerp(from, to, rem / dist);
      rem -= dist;
    }
    return WAYPOINTS.at(-1);
  }

  // ── Mock navigator.geolocation ────────────────────────────────────────────
  const watchers = {};      // id → { success, error }
  let nextId = 1;
  const simStart = Date.now();

  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      watchPosition(success, error) {
        const id = nextId++;
        watchers[id] = { success, error };
        return id;
      },
      clearWatch(id) { delete watchers[id]; },
      getCurrentPosition(success) {
        const [lon, lat] = posAt((Date.now() - simStart) / 1000);
        success({ coords: { longitude: lon, latitude: lat, accuracy: ACCURACY } });
      },
    },
  });

  // Fire every active watch's success callback with the current position.
  function emitFix() {
    if (Date.now() < gapUntil) return; // suspended (simulated background gap)
    const [lon, lat] = posAt((Date.now() - simStart) / 1000);
    Object.values(watchers).forEach(w =>
      w.success && w.success({ coords: { longitude: lon, latitude: lat, accuracy: ACCURACY } })
    );
  }

  // Fire every active watch's error callback.
  function emitError(code) {
    Object.values(watchers).forEach(w =>
      w.error && w.error({ code, message: `[Sim] injected error ${code}` })
    );
  }

  // Tick every second.
  const iv = setInterval(emitFix, 1000);

  // ── Seed session in localStorage ──────────────────────────────────────────
  localStorage.setItem('sa-blava.session', JSON.stringify({
    routeId:            ROUTE_ID,
    durationHours:      DURATION_H,
    startedAtMs:        Date.now(),
    code:               '010530',
    includedPoiIndices: POI_INDICES,
  }));

  // ── Navigate to the navigate screen ───────────────────────────────────────
  location.hash = `/route/${ROUTE_ID}/navigate`;

  // ── Dev controls exposed on window ───────────────────────────────────────
  window.__stopSim = () => {
    clearInterval(iv);
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
    localStorage.removeItem('sa-blava.session');
    location.hash = '/routes';
    console.log('%c[Sim] Stopped', 'color:red;font-weight:bold');
  };

  window.__simSpeed = (mult) => {
    SPEED_MULT = mult;
    const etaMin = (totalDist / 1000 / KAYAK_KMH / mult * 60).toFixed(1);
    console.log(`%c[Sim] Speed ×${mult} — full route ETA ~${etaMin} min`, 'color:#1b6b8a');
  };

  // ── Fault injection ────────────────────────────────────────────────────────
  window.__simAccuracy = (m) => {
    ACCURACY = m;
    const drop = m > 35 ? ' (> GPS_MAX_ACCURACY_M 35 → fixes DROPPED by the filter)' : '';
    console.log(`%c[Sim] Accuracy = ${m} m${drop}`, 'color:#b26b00');
  };
  window.__simError       = (code) => { emitError(code); console.log(`%c[Sim] error code ${code}`, 'color:#b00'); };
  window.__simDenied      = () => window.__simError(1);
  window.__simUnavailable = () => window.__simError(2);
  window.__simTimeout     = () => window.__simError(3);
  window.__simGap = (sec = 30) => {
    gapUntil = Date.now() + sec * 1000;
    console.log(`%c[Sim] GPS suspended ${sec}s (simulated background gap — wall clock keeps running)`, 'color:#b26b00');
  };

  // ── Report ────────────────────────────────────────────────────────────────
  const etaMin = (totalDist / 1000 / KAYAK_KMH / SPEED_MULT * 60).toFixed(1);
  console.log('%c[Sa Blava Sim] Running', 'color:#1b6b8a;font-weight:bold;font-size:14px');
  console.log(`  Route:    Sud — ${POI_INDICES.length} POIs`);
  console.log(`  Session:  ${DURATION_H}h (${DURATION_H*60} min countdown)`);
  console.log(`  Speed:    ${KAYAK_KMH} km/h × ${SPEED_MULT} = ${KAYAK_KMH*SPEED_MULT} km/h simulated`);
  console.log(`  ETA full: ~${etaMin} min of real time`);
  console.log('  __stopSim()         — end simulation');
  console.log('  __simSpeed(n)       — change speed multiplier');
  console.log('  __simAccuracy(m)    — set fix accuracy (m > 35 → dropped)');
  console.log('  __simDenied() / __simTimeout() / __simUnavailable() / __simError(code)');
  console.log('  __simGap(sec)       — suspend GPS fixes for sec seconds');
})();

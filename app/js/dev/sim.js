// dev/sim.js — Kayak trip simulator for testing the navigate screen.
//
// Paste the contents of this file into the browser DevTools console while
// the app is open at http://localhost:8080
//
// Controls:
//   __stopSim()          — end simulation and clear session
//   __simSpeed(n)        — change speed multiplier (default 10 = 35 km/h)

(function startSim() {
  // ── Configuration ─────────────────────────────────────────────────────────
  const ROUTE_ID      = 'sud';
  const DURATION_H    = 1;          // session duration in hours
  const POI_INDICES   = [0,1,2,3,4]; // which sud POIs to include
  let   SPEED_MULT    = 10;          // real-time multiplier (10 = 10× faster)
  const KAYAK_KMH     = 3.5;        // realistic base speed

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
  const watchers = {};
  let nextId = 1;
  const simStart = Date.now();

  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      watchPosition(success) {
        const id = nextId++;
        watchers[id] = success;
        return id;
      },
      clearWatch(id) { delete watchers[id]; },
      getCurrentPosition(success) {
        const [lon, lat] = posAt((Date.now() - simStart) / 1000);
        success({ coords: { longitude: lon, latitude: lat, accuracy: 4 } });
      },
    },
  });

  // Tick every second — fires all active watch callbacks
  const iv = setInterval(() => {
    const [lon, lat] = posAt((Date.now() - simStart) / 1000);
    Object.values(watchers).forEach(cb =>
      cb && cb({ coords: { longitude: lon, latitude: lat, accuracy: 4 } })
    );
  }, 1000);

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

  // ── Report ────────────────────────────────────────────────────────────────
  const etaMin = (totalDist / 1000 / KAYAK_KMH / SPEED_MULT * 60).toFixed(1);
  console.log('%c[Sa Blava Sim] Running', 'color:#1b6b8a;font-weight:bold;font-size:14px');
  console.log(`  Route:    Sud — ${POI_INDICES.length} POIs`);
  console.log(`  Session:  ${DURATION_H}h (${DURATION_H*60} min countdown)`);
  console.log(`  Speed:    ${KAYAK_KMH} km/h × ${SPEED_MULT} = ${KAYAK_KMH*SPEED_MULT} km/h simulated`);
  console.log(`  ETA full: ~${etaMin} min of real time`);
  console.log('  __stopSim()      — end simulation');
  console.log('  __simSpeed(n)    — change speed multiplier');
})();

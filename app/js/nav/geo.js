// nav/geo.js — Geolocation utilities for on-water navigation.
//
// All coordinate pairs are [longitude, latitude] (GeoJSON / Mapbox convention).
// Distance is always in metres unless the function name says otherwise.

import {
  KAYAK_SPEED_KMH,
  GPS_MAX_ACCURACY_M,
  GPS_ACQUIRE_TIMEOUT_MS,
  GPS_STALE_FIX_MS,
} from "../config.js";

/** Earth radius in metres (WGS-84 mean). */
const R = 6_371_000;

/**
 * Haversine great-circle distance between two [lng, lat] coordinates.
 * @param {[number, number]} a — [lng, lat]
 * @param {[number, number]} b — [lng, lat]
 * @returns {number} distance in metres
 */
export function haversineM([lng1, lat1], [lng2, lat2]) {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Haversine distance in kilometres.
 * @param {[number, number]} a
 * @param {[number, number]} b
 * @returns {number} km
 */
export function haversineKm(a, b) {
  return haversineM(a, b) / 1000;
}

/**
 * Total path distance across an array of [lng, lat] waypoints.
 * @param {Array<[number, number]>} pts
 * @returns {number} metres
 */
export function totalPathM(pts) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += haversineM(pts[i - 1], pts[i]);
  return d;
}

/**
 * Total path distance in kilometres.
 * @param {Array<[number, number]>} pts
 * @returns {number} km
 */
export function totalPathKm(pts) {
  return totalPathM(pts) / 1000;
}

/**
 * Cumulative along-track distance (metres) at each vertex of a polyline.
 * `cum[0]` is 0; `cum[i]` is the summed segment length from the start to
 * vertex `i`. Used as the metric base for projecting a live position onto a
 * route track (see {@link projectOntoTrack}).
 * @param {Array<[number, number]>} track
 * @returns {number[]}
 */
export function cumulativeDistancesM(track) {
  const cum = new Array(track.length);
  cum[0] = 0;
  for (let i = 1; i < track.length; i++) {
    cum[i] = cum[i - 1] + haversineM(track[i - 1], track[i]);
  }
  return cum;
}

/**
 * Project a [lng, lat] position onto a polyline track and report where, and how
 * far along, it lands. This is the geometric core of continuous trip progress:
 * "how far along the coast am I" is the distance along the track to the nearest
 * point ON the track, not the straight-line distance to a POI (which reads
 * falsely on a curving coast).
 *
 * Each segment uses a local equirectangular approximation (metres relative to
 * the segment's start), which is accurate to well under a metre at kayak scale
 * (sub-kilometre segments, ~42°N).
 *
 * @param {Array<[number, number]>} track — dense [lng, lat] polyline
 * @param {[number, number]} coord — live position [lng, lat]
 * @param {number[]} [cum] — precomputed {@link cumulativeDistancesM}(track) for perf
 * @returns {{ distAlongM: number, crossDistM: number, segIdx: number, t: number, point: [number, number] }}
 *   distAlongM — metres along the track to the projection;
 *   crossDistM — perpendicular metres from `coord` to the track;
 *   segIdx — index of the segment start vertex; t — 0..1 position within it;
 *   point — the projected [lng, lat] on the track.
 */
export function projectOntoTrack(track, coord, cum = cumulativeDistancesM(track)) {
  if (!track || track.length === 0) {
    return { distAlongM: 0, crossDistM: Infinity, segIdx: 0, t: 0, point: coord };
  }
  if (track.length === 1) {
    return { distAlongM: 0, crossDistM: haversineM(coord, track[0]), segIdx: 0, t: 0, point: track[0] };
  }

  const M_PER_DEG_LAT = 111_320;
  // Convert a point to local metres relative to `origin` ([lng, lat]).
  const toXY = ([lng, lat], [lng0, lat0]) => {
    const mPerDegLng = M_PER_DEG_LAT * Math.cos((lat0 * Math.PI) / 180);
    return [(lng - lng0) * mPerDegLng, (lat - lat0) * M_PER_DEG_LAT];
  };

  let best = {
    distAlongM: 0,
    crossDistM: Infinity,
    segIdx: 0,
    t: 0,
    point: track[0],
  };

  for (let i = 0; i < track.length - 1; i++) {
    const a = track[i];
    const b = track[i + 1];
    const [bx, by] = toXY(b, a);
    const [px, py] = toXY(coord, a);
    const segLen2 = bx * bx + by * by;
    const t = segLen2 === 0 ? 0 : Math.min(1, Math.max(0, (px * bx + py * by) / segLen2));
    const cx = t * bx;
    const cy = t * by;
    const crossDistM = Math.hypot(px - cx, py - cy);
    if (crossDistM < best.crossDistM) {
      const segLenM = Math.sqrt(segLen2);
      best = {
        distAlongM: cum[i] + t * segLenM,
        crossDistM,
        segIdx: i,
        t,
        point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
      };
    }
  }
  return best;
}

/**
 * Estimated paddling time for a given distance.
 * @param {number} km
 * @param {number} [speedKmh] — defaults to config value
 * @returns {number} hours (fractional)
 */
export function estimatedHours(km, speedKmh = KAYAK_SPEED_KMH) {
  return km / speedKmh;
}

/**
 * Build a coastal polyline that follows the recorded GPS `track` but only
 * spans the given POIs. Each POI is projected onto its nearest track vertex,
 * then the track is walked (in whichever direction is needed) between
 * consecutive POIs, so the line hugs the real coast instead of cutting across
 * land. Used whenever the paddler navigates a subset of the route — a shorter
 * duration (fewer POIs) or after removing a POI.
 *
 * @param {Array<[number, number]>} track     — dense [lng, lat] GPS polyline
 * @param {Array<[number, number]>} poiCoords — ordered POI [lng, lat] to pass through
 * @returns {Array<[number, number]>} polyline coordinates following the track
 */
export function trackThroughPois(track, poiCoords) {
  if (!track || track.length < 2) return poiCoords.slice();
  if (poiCoords.length === 0) return [];

  // Nearest track vertex index for a POI.
  const nearestIdx = (coord) => {
    let best = Infinity;
    let bi = 0;
    for (let i = 0; i < track.length; i++) {
      const d = haversineM(coord, track[i]);
      if (d < best) { best = d; bi = i; }
    }
    return bi;
  };

  const idxs = poiCoords.map(nearestIdx);

  // Walk the track between each consecutive pair of projected POIs. The start
  // vertex of each leg is pushed by the previous leg (or, for the first leg,
  // by being the leg's own start), so every vertex is emitted exactly once.
  const out = [];
  for (let leg = 0; leg < idxs.length - 1; leg++) {
    const a = idxs[leg];
    const b = idxs[leg + 1];
    const step = a <= b ? 1 : -1;
    for (let k = a; k !== b; k += step) out.push(track[k]);
  }
  out.push(track[idxs[idxs.length - 1]]); // final POI's vertex
  return out;
}

/**
 * Initial bearing (0–360°, clockwise from north) from point A to point B.
 * @param {[number, number]} from — [lng, lat]
 * @param {[number, number]} to   — [lng, lat]
 * @returns {number} degrees 0–360
 */
export function bearingDeg([lng1, lat1], [lng2, lat2]) {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Cardinal direction string for a bearing.
 * @param {number} deg — 0–360
 * @returns {"N"|"NE"|"E"|"SE"|"S"|"SW"|"W"|"NW"}
 */
export function cardinalDir(deg) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

/**
 * Start watching the device's GPS position.
 * @param {(pos: GeolocationPosition) => void} onUpdate
 * @param {(err: GeolocationPositionError) => void} onError
 * @returns {() => void} clearWatch function
 */
export function watchPosition(onUpdate, onError) {
  if (!navigator.geolocation) {
    onError({ code: 2, message: "Geolocation not supported" });
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(onUpdate, onError, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 5_000,
  });
  return () => navigator.geolocation.clearWatch(id);
}

/**
 * Accuracy-filtered GPS watch with typed state reporting.
 *
 * Wraps `navigator.geolocation.watchPosition`, DROPS fixes whose
 * `coords.accuracy` is worse than the accuracy threshold (so a noisy fix never
 * jumps the marker or falsely "arrives" at a POI), and reports a coarse state
 * to the caller so the UI can show honest banners instead of always blaming a
 * denied permission.
 *
 * States emitted via `onState`:
 *   - "acquiring"    — watching, no usable fix yet (initial state)
 *   - "ok"           — a fix within the accuracy threshold was just delivered
 *   - "low-accuracy" — fixes arrive but stay worse than the threshold for
 *                      longer than GPS_STALE_FIX_MS
 *   - "timeout"      — no fix within the acquire timeout (err.code 3)
 *   - "unavailable"  — position unavailable / geolocation unsupported (err.code 2)
 *   - "denied"       — permission denied (err.code 1)
 *
 * @param {(pos: GeolocationPosition) => void} onFix   — called only for accepted fixes
 * @param {(state: string) => void}           onState — coarse state changes
 * @param {{ maxAccuracyM?: number, acquireTimeoutMs?: number, staleFixMs?: number }} [opts]
 * @returns {() => void} cleanup function (clears the watch)
 */
export function watchFilteredPosition(onFix, onState, opts = {}) {
  const maxAccuracyM     = opts.maxAccuracyM     ?? GPS_MAX_ACCURACY_M;
  const acquireTimeoutMs = opts.acquireTimeoutMs ?? GPS_ACQUIRE_TIMEOUT_MS;
  const staleFixMs       = opts.staleFixMs       ?? GPS_STALE_FIX_MS;

  if (!navigator.geolocation) {
    onState?.("unavailable");
    return () => {};
  }

  let gotUsableFix   = false;
  let lowAccuracyAt  = null; // timestamp of the first sustained over-threshold fix
  let lastState      = null;

  // Collapse repeated identical states so the UI isn't churned every second.
  const emit = (state) => {
    if (state === lastState) return;
    lastState = state;
    onState?.(state);
  };

  emit("acquiring");

  const id = navigator.geolocation.watchPosition(
    (pos) => {
      const acc = pos.coords?.accuracy;
      if (typeof acc === "number" && acc > maxAccuracyM) {
        // A fix arrived but it is too imprecise to trust — drop it.
        const now = Date.now();
        if (lowAccuracyAt == null) lowAccuracyAt = now;
        if (now - lowAccuracyAt >= staleFixMs) emit("low-accuracy");
        return;
      }
      // Accepted fix.
      lowAccuracyAt = null;
      gotUsableFix  = true;
      emit("ok");
      onFix?.(pos);
    },
    (err) => {
      // While usable fixes are flowing, transient errors are noise — ignore them.
      if (gotUsableFix && err.code !== 1) return;
      if (err.code === 1) emit("denied");
      else if (err.code === 3) emit("timeout");
      else emit("unavailable");
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: acquireTimeoutMs,
    }
  );

  return () => navigator.geolocation.clearWatch(id);
}

/**
 * Decide what a `code 1` denial should show the paddler.
 *
 * Pure so the escalation is testable without a browser — it is the recovery
 * path for the most common on-water failure, and it used to be wrong.
 *
 * A denial cannot be classified from the error alone: the same `code 1` covers
 * a hard block, a dismissed prompt and a mis-tapped "Don't Allow", and the
 * Permissions API cannot separate them either (see geoPermissionState). So the
 * distinction is made empirically, by spending a retry:
 *
 *   1st denial  → offer the retry alone. Re-requesting re-prompts whenever the
 *                 refusal was soft, which is the common case, and an extra line
 *                 of settings instructions would just be noise.
 *   2nd denial  → the retry was spent and still failed, so treat it as a real
 *                 block and name the settings path. The retry stays, because the
 *                 paddler may fix it in Settings and come back to this screen.
 *
 * @param {number} deniedCount  consecutive code-1 denials (reset on any fix)
 * @param {{ios?: boolean, standalone?: boolean}} [env]
 * @returns {{messageKey: string, helpKey: string|null, retry: boolean}}
 */
export function planDeniedBanner(deniedCount, env = {}) {
  if (deniedCount < 2) {
    return { messageKey: "nav.permission.denied", helpKey: null, retry: true };
  }
  // iOS keeps the switch in the OS Settings app, and an installed PWA has its
  // own entry there separate from Safari's — so "browser settings" is a dead
  // end on the platform that makes up most of this app's traffic.
  const helpKey = !env.ios
    ? "nav.gps.denied.help"
    : env.standalone
      ? "nav.gps.denied.help.ios.pwa"
      : "nav.gps.denied.help.ios";
  return { messageKey: "nav.gps.denied", helpKey, retry: true };
}

/**
 * Current geolocation permission state via the Permissions API.
 *
 * DO NOT gate recovery UI on this. It was previously used to tell a hard block
 * from a dismissed prompt, but that is not safe: a real-device run on iOS 18.7 /
 * Safari 26.5 returned "denied" while watchPosition was streaming 10 good fixes
 * (best 7 m). Safari appears to collapse the never-asked "prompt" state onto
 * "denied", so on iPhone — the majority of this app's traffic — the answer is
 * wrong in exactly the case the UI cared about, and the paddler loses the retry
 * button they needed. navigate.js now establishes the difference empirically
 * instead, by spending a retry and seeing whether it re-prompts.
 *
 * Still useful as corroboration ("granted" is trustworthy — nothing reports
 * granted when it is blocked) and for diagnostics. See /diag.html.
 *
 * @returns {Promise<"granted"|"denied"|"prompt"|"unknown">} "unknown" when the
 *   Permissions API is unavailable — callers should then assume a retry may work.
 */
export async function geoPermissionState() {
  if (!navigator.permissions?.query) return "unknown";
  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state; // "granted" | "denied" | "prompt"
  } catch {
    return "unknown";
  }
}

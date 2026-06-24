// nav/trip-progress.js — Pure trip-progress state machine.
//
// The single source of truth navigate.js renders. NO DOM, NO globals, NO
// wall-clock reads (time arrives via each fix's `tMs`), so the whole thing is
// unit-testable by replaying synthetic tracks (see dev/trip-progress.test.mjs).
//
// It replaces three fragile pieces of the old inline navigate.js logic:
//   1. Discrete progress (activePOIIdx / count) → continuous distance ALONG the
//      route track, projected from the live position. The tornada measures the
//      remaining track distance to base, not a straight line, so a curving coast
//      reads honestly.
//   2. Strict in-order arrival within 50 m (one drifted/skipped POI jammed the
//      whole chain) → debounced proximity OR "passed along the track" tolerance.
//   3. Turnaround gated solely on reaching the LAST POI within 50 m → flips on
//      ANY of: chain complete, furthest point passed and now closing, or time
//      critical. The return-safety warning is decoupled from that 50 m gate.
//
// Two-period progress model (confirmed with the owner 2026-06-24): anada fills
// 0→100 % out to the turnaround, then the tornada resets and fills 0→100 % home.

import { haversineM, projectOntoTrack, cumulativeDistancesM } from "./geo.js";
import {
  NAV_ARRIVAL_THRESHOLD_M,
  ARRIVAL_DEBOUNCE_FIXES,
  ARRIVAL_SKIP_MARGIN_M,
  RETURN_SAFETY_MARGIN_RATIO,
  KAYAK_SPEED_KMH,
  NAV_OFFROUTE_THRESHOLD_M,
} from "../config.js";

/**
 * @typedef {{ type: "arrival"|"pass", poiIdx: number }
 *   | { type: "turnaround", poiIdx: number, reason: "pois-done"|"time"|"early", short: boolean }
 *   | { type: "return-unsafe", remainingMs: number, etaBackMs: number }} TripEvent
 */

/**
 * @typedef {object} TripSnapshot
 * @property {"out"|"back"} phase
 * @property {number} activePOIIdx — index of the next un-passed POI (== length when all passed)
 * @property {{ poiIdx: number, coords: [number,number] } | { marina: true, coords: [number,number] }} nextTarget
 * @property {number} progressPct — 0..100, two-period (resets at turnaround)
 * @property {number} distAlongM — metres along the track to the live projection
 * @property {number} totalAnadaM — track metres from base to the furthest active POI
 * @property {number} distToTargetM — metres ALONG the track from the live projection to
 *   the current target (next POI on the anada, the marina on the tornada). This is the
 *   coastline paddle distance the UI shows, NOT a straight line.
 * @property {number} baseDistAlongM — metres ALONG the track from the live projection back
 *   to the marina (the real paddle-home distance; drives the return ETA + safety)
 * @property {boolean} offRoute — the last fix was implausibly far from the track (logic held)
 * @property {number|null} baseDistM — straight-line metres to the marina (kept for reference)
 * @property {number|null} returnStartDistM — straight-line base distance captured at turnaround
 * @property {{ remainingMs: number, etaBackMs: number, safe: boolean }} returnSafety
 * @property {TripEvent[]} events — events produced by the update that returned this snapshot
 */

/**
 * Build a trip-progress reducer for one navigation session.
 *
 * @param {object} cfg
 * @param {Array<[number,number]>} cfg.track — route GPS polyline ([lng,lat]); pass a
 *   synthetic [marina, ...pois] polyline for routes that ship no track.
 * @param {Array<{ coords: [number,number] }>} cfg.activePois — ordered POIs being navigated
 * @param {[number,number]} cfg.marinaCoords — base [lng,lat]
 * @param {number} cfg.durationMs — session length in ms
 * @param {number} cfg.startedAtMs — session start (same clock as the fix `tMs`)
 * @param {object} [cfg.opts] — test/tuning overrides for the config constants
 * @returns {{ update(fix: { coords: [number,number], tMs: number }): TripSnapshot, getSnapshot(): TripSnapshot }}
 */
export function createTripProgress({
  track,
  activePois,
  marinaCoords,
  durationMs,
  startedAtMs,
  opts = {},
}) {
  const arrivalThresholdM = opts.arrivalThresholdM ?? NAV_ARRIVAL_THRESHOLD_M;
  const debounceFixes     = opts.debounceFixes     ?? ARRIVAL_DEBOUNCE_FIXES;
  const skipMarginM       = opts.skipMarginM       ?? ARRIVAL_SKIP_MARGIN_M;
  const safetyRatio       = opts.safetyRatio       ?? RETURN_SAFETY_MARGIN_RATIO;
  const speedKmh          = opts.speedKmh          ?? KAYAK_SPEED_KMH;
  const offRouteThresholdM = opts.offRouteThresholdM ?? NAV_OFFROUTE_THRESHOLD_M;

  // A usable polyline is required; fall back to base→POIs if the track is thin.
  const line = track && track.length > 1
    ? track
    : [marinaCoords, ...activePois.map((p) => p.coords)];
  const cum = cumulativeDistancesM(line);

  // Pre-project each POI and the marina onto the track once.
  const marinaAlong = projectOntoTrack(line, marinaCoords, cum).distAlongM;
  const poiAlong = activePois.map((p) => projectOntoTrack(line, p.coords, cum).distAlongM);
  // The furthest active POI defines the anada length. Using the max (not just the
  // last in list order) keeps progress honest if a route's POIs aren't perfectly
  // monotonic along the track.
  const furthestAlong = poiAlong.length ? Math.max(...poiAlong) : marinaAlong;
  const totalAnadaM = Math.max(0, furthestAlong - marinaAlong);

  const etaMs = (distM) => (distM / 1000) / speedKmh * 3_600_000;
  const clampPct = (frac) => Math.round(Math.min(1, Math.max(0, frac)) * 100);

  // ── Mutable state ──────────────────────────────────────────────────────────
  let phase             = "out";
  let idx               = 0;     // next un-passed POI
  let proximityCount    = 0;     // consecutive accepted fixes within threshold of activePois[idx]
  let maxDistAlongM     = marinaAlong;
  let returnStartAlongM = null;
  let returnStartDistM  = null;
  let returnUnsafeFired = false;

  let lastCoords      = null;
  let lastDistAlongM  = marinaAlong;
  let lastBaseDistM   = null;
  let lastRemainingMs = durationMs;
  let offRoute        = false;   // last fix was implausibly far from the track

  // Remaining paddle-home distance measured ALONG the track (from the live
  // projection back to the marina's projection), not as the crow flies. On a
  // curving coast the straight line badly under-counts the real paddle home, so
  // every distance/ETA the paddler sees — and the return-safety math — uses this.
  const baseAlongM = () => Math.max(0, lastDistAlongM - marinaAlong);

  function progressPct() {
    if (phase === "out") {
      if (totalAnadaM <= 0) return idx >= activePois.length ? 100 : 0;
      return clampPct((lastDistAlongM - marinaAlong) / totalAnadaM);
    }
    const denom = returnStartAlongM != null ? returnStartAlongM - marinaAlong : 0;
    if (denom <= 0) return 100;
    return clampPct(1 - (lastDistAlongM - marinaAlong) / denom);
  }

  function snapshot(events = []) {
    const nextTarget = phase === "out" && idx < activePois.length
      ? { poiIdx: idx, coords: activePois[idx].coords }
      : { marina: true, coords: marinaCoords };
    const baseDistAlongM = baseAlongM();
    const distToTargetM = phase === "out" && idx < activePois.length
      ? Math.max(0, poiAlong[idx] - lastDistAlongM)
      : baseDistAlongM;
    const etaBackMs = lastBaseDistM != null ? etaMs(baseDistAlongM) : 0;
    return {
      phase,
      activePOIIdx: idx,
      nextTarget,
      progressPct: progressPct(),
      distAlongM: lastDistAlongM,
      totalAnadaM,
      distToTargetM,
      baseDistAlongM,
      offRoute,
      baseDistM: lastBaseDistM,
      returnStartDistM,
      returnSafety: {
        remainingMs: lastRemainingMs,
        etaBackMs,
        safe: lastBaseDistM == null || lastRemainingMs >= etaBackMs * safetyRatio,
      },
      events,
    };
  }

  /**
   * Feed one accepted GPS fix. Returns the resulting snapshot (with any events
   * produced by THIS fix). Callers should only pass accuracy-accepted fixes —
   * accuracy filtering lives in geo.watchFilteredPosition.
   * @param {{ coords: [number,number], tMs: number }} fix
   */
  function update({ coords, tMs }) {
    lastCoords = coords;
    const proj = projectOntoTrack(line, coords, cum);
    lastBaseDistM = haversineM(coords, marinaCoords);
    lastRemainingMs = durationMs - (tMs - startedAtMs);

    // ── Off-route guard ──────────────────────────────────────────────────────
    // A fix far from the route track is precise-but-wrong (testing from the
    // city, or a stray fix that passed the accuracy filter): its huge distance
    // home would read as "out of time" and instantly false-complete the trip,
    // and its projection would mass-"pass" the POIs. Hold progress where it is
    // and emit nothing until the paddler is actually on the route.
    if (proj.crossDistM > offRouteThresholdM) {
      offRoute = true;
      return snapshot([]);
    }
    offRoute = false;

    lastDistAlongM = proj.distAlongM;
    maxDistAlongM = Math.max(maxDistAlongM, lastDistAlongM);

    /** @type {TripEvent[]} */
    const events = [];

    // ── Arrival / advance (anada only) ───────────────────────────────────────
    if (phase === "out") {
      // Skip-tolerance: advance past any POI we've clearly paddled BEYOND along
      // the track, so a missed or GPS-drifted POI never jams the chain.
      while (idx < activePois.length && lastDistAlongM >= poiAlong[idx] + skipMarginM) {
        events.push({ type: "pass", poiIdx: idx });
        idx++;
        proximityCount = 0;
      }
      // Proximity arrival for the current target, debounced over consecutive fixes
      // so a single drifted fix can't false-trigger.
      if (idx < activePois.length) {
        const dToTarget = haversineM(coords, activePois[idx].coords);
        if (dToTarget <= arrivalThresholdM) {
          proximityCount++;
          if (proximityCount >= debounceFixes) {
            events.push({ type: "arrival", poiIdx: idx });
            idx++;
            proximityCount = 0;
          }
        } else {
          proximityCount = 0;
        }
      }
    }

    // ── Turnaround: flip to tornada on ANY trigger ───────────────────────────
    if (phase === "out") {
      const etaBackMs = etaMs(baseAlongM());
      const allPoisDone = idx >= activePois.length;
      const timeCritical = lastRemainingMs <= etaBackMs;
      // Furthest point passed and now closing back toward base — catches a manual
      // early turnaround. Require meaningful outbound progress first so a brief
      // backtrack near the start can't false-flip.
      const closingEarly =
        totalAnadaM > 0 &&
        maxDistAlongM - marinaAlong >= 0.5 * totalAnadaM &&
        lastDistAlongM <= maxDistAlongM - skipMarginM;

      if (allPoisDone || timeCritical || closingEarly) {
        phase = "back";
        returnStartAlongM = Math.max(lastDistAlongM, marinaAlong);
        returnStartDistM = lastBaseDistM;
        const reason = allPoisDone ? "pois-done" : timeCritical ? "time" : "early";
        const short = lastRemainingMs < etaBackMs;

        // The POI that "ends" the anada is announced AS the turnaround, not as a
        // separate arrival — so when the final POI completes the chain, drop the
        // arrival/pass event for it (matches the old single turnaround cue).
        if (reason === "pois-done" && events.length) {
          const last = events[events.length - 1];
          if (last.type === "arrival" || last.type === "pass") events.pop();
        }
        events.push({
          type: "turnaround",
          poiIdx: Math.max(0, Math.min(idx, activePois.length) - 1),
          reason,
          short,
        });
        // A short (can't-make-it) turnaround already speaks the urgent cue, so
        // suppress the separate return-unsafe event for it.
        if (short) returnUnsafeFired = true;
      }
    }

    // ── Return safety (decoupled from the 50 m last-POI gate) ─────────────────
    // Fires once when, on the way back, the remaining time no longer covers the
    // paddle home with the safety margin — regardless of whether the last POI was
    // ever reached within 50 m.
    if (phase === "back" && !returnUnsafeFired) {
      const etaBackMs = etaMs(baseAlongM());
      if (lastRemainingMs < etaBackMs * safetyRatio) {
        returnUnsafeFired = true;
        events.push({ type: "return-unsafe", remainingMs: lastRemainingMs, etaBackMs });
      }
    }

    return snapshot(events);
  }

  return { update, getSnapshot: () => snapshot([]) };
}

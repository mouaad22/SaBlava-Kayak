// dev/integration.test.mjs — nav-hardening session-5 integration sign-off.
//
// Run from the repo root:  node --test app/js/dev/integration.test.mjs
//
// Sessions 1-4 each unit-tested ONE module in isolation (geo / trip-progress /
// alerts / audio). This file wires the REAL modules together exactly as
// navigate.js does — the accuracy-filtered GPS watch FEEDS the trip-progress
// reducer, and the wall-clock scheduler runs alongside — and replays a full
// out-and-back trip with the two things the in-browser sim still can't inject:
// low-accuracy fixes and background (screen-lock) gaps. It is the headless,
// CI-able half of the session-5 field sign-off; the device half (real GPS,
// system notifications, screen-lock TTS re-prime) is S5.T2, run off
// docs/nav-hardening-field-test.md.
//
// Pure-logic seam only: this asserts the geo→progress→alerts pipeline. The
// navigate.js DOM/announce wiring (notify()/vibrate()/speak() at each call
// site) is covered by audio.test.mjs + code review; its real-device DELIVERY is
// S5.T2.

import { test } from "node:test";
import assert from "node:assert/strict";

import { watchFilteredPosition } from "../nav/geo.js";
import { createTripProgress } from "../nav/trip-progress.js";
import { reconcileThresholds } from "../nav/alerts.js";
import {
  cumulativeDistancesM,
} from "../nav/geo.js";
import {
  GPS_MAX_ACCURACY_M,
  ALERT_RESUME_GRACE_MS,
} from "../config.js";

// ── Synthetic course (mirrors trip-progress.test.mjs) ────────────────────────
// 21 points ~41 m apart along a straight E–W line, so along-track distance is
// predictable. POIs sit at indices 5, 10, 20; the marina is track[0]. Arrival
// threshold is 50 m, so a POI's immediate neighbours (~41 m) feed the 2-fix
// debounce.
const LAT = 41.93;
const LNG0 = 3.20;
const TRACK = Array.from({ length: 21 }, (_, i) => [LNG0 + i * 0.0005, LAT]);
const POI_IDX = [5, 10, 20];
const ACTIVE_POIS = POI_IDX.map((i) => ({ coords: TRACK[i], name: { ca: `P${i}` } }));
const MARINA = TRACK[0];
const CUM = cumulativeDistancesM(TRACK);
const TOTAL_ANADA = CUM[20] - CUM[0];

const MIN = 60_000;

/** Replace globalThis.navigator (read-only in modern node) for one test. */
function setNavigator(value) {
  Object.defineProperty(globalThis, "navigator", { configurable: true, value });
}

/**
 * Build the same pipeline navigate.js assembles: an accuracy-filtered GPS watch
 * whose accepted fixes feed the trip-progress reducer, plus a wall-clock alert
 * scheduler (reconcileThresholds with the app's grace window). The harness owns
 * a single simulated clock used for BOTH the fix tMs and the alert nowMs, so a
 * "background gap" is just a jump of that clock with no fixes delivered in
 * between (the watch suspends when the screen locks).
 */
function makePipeline({ durationMs = 60 * MIN, startedAtMs = 0 } = {}) {
  let success = null;
  let error = null;
  setNavigator({
    geolocation: {
      watchPosition(onSuccess, onError) { success = onSuccess; error = onError; return 1; },
      clearWatch() {},
    },
  });

  const trip = createTripProgress({
    track: TRACK,
    activePois: ACTIVE_POIS,
    marinaCoords: MARINA,
    durationMs,
    startedAtMs,
  });

  const states = [];     // every GPS state the filter emitted
  const acceptedFixes = []; // [lng,lat] of fixes that passed the accuracy filter
  const events = [];     // every trip-progress event, in order
  const firedWarnings = []; // threshMin values the alert scheduler announced
  const fired = new Set();  // persisted "tNN" keys (mirrors session.firedThresholds)

  let clockMs = startedAtMs;
  let snap = trip.getSnapshot();

  // watchFilteredPosition: accepted fixes drive the reducer at the current clock.
  watchFilteredPosition(
    (pos) => {
      acceptedFixes.push([pos.coords.longitude, pos.coords.latitude]);
      snap = trip.update({ coords: [pos.coords.longitude, pos.coords.latitude], tMs: clockMs });
      for (const e of snap.events) events.push(e);
    },
    (s) => states.push(s),
  );

  // The wall-clock alert tick (navigate.js checkThresholds, minus the DOM): fire
  // at most one fresh threshold, mark every crossed one so a backlog never dumps.
  function reconcile() {
    const { fire, markFired } = reconcileThresholds({
      nowMs: clockMs,
      startedAtMs,
      durationMs,
      fired: [...fired],
      graceMs: ALERT_RESUME_GRACE_MS,
    });
    for (const k of markFired) fired.add(k);
    if (fire) firedWarnings.push(fire.threshMin);
    return fire;
  }

  return {
    /** Deliver a fix at track[idx] with the given accuracy (m). */
    fix(idx, accuracy = 4) {
      success?.({ coords: { longitude: TRACK[idx][0], latitude: TRACK[idx][1], accuracy } });
    },
    /** Deliver a fix at an explicit [lng,lat]. */
    fixAt(lng, lat, accuracy = 4) {
      success?.({ coords: { longitude: lng, latitude: lat, accuracy } });
    },
    /** Trigger the geolocation error callback. */
    fail(code) { error?.({ code, message: `mock ${code}` }); },
    /** Advance / set the simulated wall clock (ms since startedAtMs epoch). */
    setClock(ms) { clockMs = ms; },
    advanceClock(ms) { clockMs += ms; },
    reconcile,
    get snap() { return snap; },
    states,
    acceptedFixes,
    events,
    firedWarnings,
    firedKeys: () => [...fired],
  };
}

const eventTypes = (p) => p.events.map((e) => e.type);

test("S5: low-accuracy fixes never reach the reducer (S1 filter → S2 progress seam)", () => {
  const p = makePipeline();

  // First accurate fix at the marina establishes a baseline.
  p.fix(0, 4);
  const before = p.snap;
  assert.equal(p.acceptedFixes.length, 1);

  // A wildly off, low-accuracy fix planted exactly ON the last POI — if it were
  // accepted it would jump progress to ~100% and false-arrive. The filter must
  // drop it: no new accepted fix, no progress change, no events.
  p.fixAt(TRACK[20][0], TRACK[20][1], GPS_MAX_ACCURACY_M + 100);
  assert.equal(p.acceptedFixes.length, 1, "imprecise fix must not reach the reducer");
  assert.equal(p.snap.distAlongM, before.distAlongM, "progress must not jump to a dropped fix");
  assert.equal(p.snap.activePOIIdx, 0, "a dropped fix must not advance the POI chain");
  assert.equal(p.events.length, 0, "a dropped fix must not emit arrival/turnaround events");
});

test("S5: a far-away first fix (testing from the city) does not false-complete the trip", () => {
  // Regression for the field-reported bug: opening the navigate screen from
  // Barcelona (~100 km away, but an ACCURATE 8 m fix) instantly said "arrived"
  // + showed 'completat' / 0% tornada, because the huge distance home read as
  // "out of time". An accurate-but-off-route fix must pass the accuracy filter
  // yet drive NO arrival/turnaround logic.
  const p = makePipeline();
  p.setClock(0);
  p.fixAt(2.17, 41.39, 8); // Barcelona-ish, accurate → passes session-1's filter
  assert.equal(p.acceptedFixes.length, 1, "an accurate fix still passes the accuracy filter");
  assert.equal(p.events.length, 0, "but an off-route fix emits no arrival/turnaround");
  assert.equal(p.snap.phase, "out", "no instant flip to tornada");
  assert.equal(p.snap.activePOIIdx, 0, "no POIs marked passed");
  assert.equal(p.snap.progressPct, 0, "progress stays at 0%");
  assert.equal(p.snap.offRoute, true);
});

test("S5: full out-and-back through the integrated geo→progress pipeline", () => {
  const p = makePipeline();

  // Out: accurate fixes every ~1 s along the whole track.
  let maxOutPct = 0;
  for (let i = 0; i <= 20; i++) {
    p.setClock(i * 1000);
    p.fix(i, 4);
    if (p.snap.phase === "out") maxOutPct = Math.max(maxOutPct, p.snap.progressPct);
  }

  const arrivals = p.events.filter((e) => e.type === "arrival").map((e) => e.poiIdx);
  const turn = p.events.find((e) => e.type === "turnaround");
  assert.deepEqual(arrivals, [0, 1], "first two POIs arrive by proximity");
  assert.ok(turn && turn.reason === "pois-done", "last POI carries the turnaround");
  assert.ok(maxOutPct >= 90, `anada should approach 100% (got ${maxOutPct})`);
  assert.ok(Math.abs(p.snap.totalAnadaM - TOTAL_ANADA) < 1, "totalAnadaM matches the track");

  // Tornada: walk home; progress climbs back to ~100% AT the base.
  for (let i = 19; i >= 0; i--) {
    p.setClock(30_000 + (20 - i) * 1000);
    p.fix(i, 4);
  }
  assert.equal(p.snap.phase, "back");
  assert.ok(p.snap.progressPct >= 95, `tornada should reach ~100% at base (got ${p.snap.progressPct})`);
});

test("S5: a GPS-drift spike (in-range, single fix) does not false-arrive through the pipeline", () => {
  const p = makePipeline();
  p.setClock(0); p.fix(5, 4);          // one fix at POI 0 (idx 5) → debounce count 1
  assert.ok(!p.events.some((e) => e.type === "arrival"), "one in-range fix must not arrive");
  p.setClock(1000); p.fix(2, 4);       // drift away → resets the debounce
  assert.equal(p.snap.phase, "out", "a brief backtrack near the start must not turn around");
  p.setClock(2000); p.fix(4, 4);       // approaching again → count 1
  p.setClock(3000); p.fix(5, 4);       // two consecutive in-range → arrival
  assert.ok(p.events.some((e) => e.type === "arrival" && e.poiIdx === 0), "debounced arrival fires");
});

test("S5: denied → recovery, the reducer only starts once a usable fix arrives", () => {
  const p = makePipeline();
  assert.equal(p.states[0], "acquiring", "acquiring shown at mount, before any fix");

  p.fail(1); // permission denied
  assert.equal(p.states.at(-1), "denied", "code 1 maps to denied, not a blanket error");
  assert.equal(p.acceptedFixes.length, 0, "no fix accepted while denied");
  assert.equal(p.snap.activePOIIdx, 0, "reducer has not advanced without a fix");

  // User grants on retry; a good fix now flows and the trip begins.
  p.setClock(1000); p.fix(0, 4);
  assert.equal(p.states.at(-1), "ok");
  assert.equal(p.acceptedFixes.length, 1, "the recovery fix drives the reducer");
});

test("S5: background gap — locked phone, clock jumps across thresholds → one fresh cue", () => {
  // 60-min trip. Foreground the first threshold (30 min remaining = 30 min in),
  // then 'lock' the phone (no fixes, no ticks) and jump the clock to 4.5 min
  // remaining. On resume, the scheduler must fire exactly ONE fresh cue (t5, the
  // most recent within the 60 s grace) and silently mark the skipped t30/t15.
  const p = makePipeline({ durationMs: 60 * MIN });

  p.setClock(30 * MIN); // remaining 30 → t30 crosses
  p.reconcile();
  assert.deepEqual(p.firedWarnings, [30], "the 30-min warning fires in the foreground");

  // Background gap: jump straight to 55.5 min in (4.5 min remaining).
  p.setClock(55.5 * MIN);
  p.reconcile(); // the single "onVisible" reconcile after resume
  assert.deepEqual(p.firedWarnings, [30, 5], "resume fires only the most-recent fresh cue (t5), not a backlog");
  assert.ok(p.firedKeys().includes("t15"), "the skipped t15 is marked fired, never to replay");
  assert.ok(!p.firedWarnings.includes(15), "t15 was crossed-but-stale → marked, not announced");

  // A later reconcile must not re-announce anything already fired/marked.
  p.reconcile();
  assert.deepEqual(p.firedWarnings, [30, 5], "no double-fire on the next tick");
});

test("S5: field-equivalent full trip — acquire → out → arrivals → gap → resume cue → return", () => {
  const p = makePipeline({ durationMs: 60 * MIN });

  // 1. Acquiring, then a dropped low-accuracy fix (no effect), then a good one.
  assert.equal(p.states[0], "acquiring");
  p.fixAt(TRACK[10][0], TRACK[10][1], GPS_MAX_ACCURACY_M + 80); // dropped
  assert.equal(p.acceptedFixes.length, 0);

  // 2. Paddle the whole anada (clock barely moves — a few minutes).
  for (let i = 0; i <= 20; i++) {
    p.setClock(i * 6000); // ~2 min total out
    p.fix(i, 4);
    p.reconcile();
  }
  assert.ok(p.events.some((e) => e.type === "turnaround"), "turnaround reached at the last POI");
  assert.deepEqual(p.firedWarnings, [], "no time warnings yet, plenty of clock left");
  assert.equal(p.snap.phase, "back");

  // 3. Background gap on the way back: phone pocketed, clock jumps to 4 min left.
  p.setClock(56 * MIN);
  const fire = p.reconcile(); // resume reconcile
  assert.ok(fire && fire.threshMin === 5, "resume surfaces the 5-min warning as the single fresh cue");

  // 4. Keep paddling home but the clock has run down → return is now unsafe.
  for (let i = 15; i >= 8; i--) {
    p.advanceClock(20_000);
    p.fix(i, 4);
  }
  assert.ok(
    p.events.some((e) => e.type === "return-unsafe") || p.snap.returnSafety.safe === false,
    "the late return registers as unsafe (decoupled from the 50 m last-POI gate)",
  );

  // 5. Clock past the end → the 0-min warning fires, exactly once.
  p.setClock(60 * MIN + 5000);
  p.reconcile();
  p.reconcile();
  assert.equal(p.firedWarnings.filter((m) => m === 0).length, 1, "T-0 fires exactly once");
});

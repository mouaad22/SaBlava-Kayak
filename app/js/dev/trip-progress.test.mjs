// dev/trip-progress.test.mjs — unit tests for nav/trip-progress.js.
//
// Run from the repo root:  node --test app/js/dev/trip-progress.test.mjs
//
// Pure module → no browser globals to mock. We replay synthetic tracks (a
// straight E–W line of fixes so along-track distance is predictable) and assert
// phase / progress / events, per the verification baseline in
// docs/nav-hardening.json (session-2 → S2.T6).

import { test } from "node:test";
import assert from "node:assert/strict";

import { createTripProgress } from "../nav/trip-progress.js";
import { cumulativeDistancesM } from "../nav/geo.js";

// ── Synthetic course ─────────────────────────────────────────────────────────
// 21 points, ~41 m apart (0.0005° lng at 41.93°N), total ~828 m. POIs sit at
// track indices 5, 10, 20; the marina is track[0]. Arrival threshold is 50 m,
// so the immediate neighbours of a POI (~41 m) count toward the 2-fix debounce.
const LAT = 41.93;
const LNG0 = 3.20;
const TRACK = Array.from({ length: 21 }, (_, i) => [LNG0 + i * 0.0005, LAT]);
const POI_IDX = [5, 10, 20];
const ACTIVE_POIS = POI_IDX.map((i) => ({ coords: TRACK[i], name: { ca: `P${i}` } }));
const MARINA = TRACK[0];
const CUM = cumulativeDistancesM(TRACK);
const TOTAL_ANADA = CUM[20] - CUM[0];

const HOUR = 3_600_000;

/** Fresh reducer; plenty of time unless overridden. */
function makeTrip(overrides = {}) {
  return createTripProgress({
    track: TRACK,
    activePois: ACTIVE_POIS,
    marinaCoords: MARINA,
    durationMs: 2 * HOUR,
    startedAtMs: 0,
    ...overrides,
  });
}

/** Feed track[i] at time tMs; return the snapshot. */
const feed = (trip, i, tMs = 0) => trip.update({ coords: TRACK[i], tMs });
const types = (snap) => snap.events.map((e) => e.type);

test("totalAnadaM equals the along-track distance to the furthest POI", () => {
  const trip = makeTrip();
  assert.ok(Math.abs(trip.getSnapshot().totalAnadaM - TOTAL_ANADA) < 1);
});

test("normal full loop: in-order arrivals, ~100% at turnaround, then tornada home", () => {
  const trip = makeTrip();
  const arrivals = [];
  let turnaround = null;
  let maxOutPct = 0;

  // Out: walk every track point. Neighbours within 50 m satisfy the 2-fix debounce.
  for (let i = 0; i <= 20; i++) {
    const snap = feed(trip, i, i * 1000);
    for (const e of snap.events) {
      if (e.type === "arrival") arrivals.push(e.poiIdx);
      if (e.type === "turnaround") turnaround = e;
    }
    if (snap.phase === "out") maxOutPct = Math.max(maxOutPct, snap.progressPct);
  }

  // POIs 0 and 1 arrive by proximity; the final POI is carried by the turnaround
  // event (not a separate arrival), exactly like the old single turnaround cue.
  assert.deepEqual(arrivals, [0, 1], "first two POIs announced as arrivals");
  assert.ok(turnaround, "turnaround fired at the last POI");
  assert.equal(turnaround.reason, "pois-done");
  assert.ok(maxOutPct >= 90, `anada should approach 100% (got ${maxOutPct})`);

  // Tornada: walk back to base; progress climbs from ~0 to ~100% along the track.
  let snap;
  for (let i = 19; i >= 0; i--) snap = feed(trip, i, 30_000 + (20 - i) * 1000);
  assert.equal(snap.phase, "back");
  assert.ok(snap.progressPct >= 95, `tornada should reach ~100% at base (got ${snap.progressPct})`);
});

test("anada progress is continuous (monotonic, not discrete jumps)", () => {
  const trip = makeTrip();
  let prev = -1;
  const pcts = [];
  for (let i = 0; i <= 19; i++) {
    const snap = feed(trip, i, i * 1000);
    if (snap.phase !== "out") break;
    pcts.push(snap.progressPct);
    assert.ok(snap.progressPct >= prev, "progress never goes backwards on the way out");
    prev = snap.progressPct;
  }
  // More than the 3 distinct values a discrete activePOIIdx/length model could yield.
  assert.ok(new Set(pcts).size > 5, `expected smooth progress, got steps: ${[...new Set(pcts)]}`);
});

test("skipped POI: never within 50 m of POI 1, chain still advances + turns around", () => {
  const trip = makeTrip();
  const events = [];
  // Reach POI 0 normally, then jump past POI 1 (track[10]) without going near it.
  for (const i of [0, 1, 2, 3, 4, 5, 12, 13, 19, 20]) {
    feed(trip, i, i * 1000).events.forEach((e) => events.push(e));
  }
  const pass = events.find((e) => e.type === "pass");
  assert.ok(pass && pass.poiIdx === 1, "skipped POI 1 emits a 'pass', not a jam");
  assert.ok(events.some((e) => e.type === "arrival" && e.poiIdx === 0), "POI 0 still arrived");
  assert.ok(events.some((e) => e.type === "turnaround"), "turnaround still fires after a skip");
});

test("GPS drift spike: a single in-range fix does NOT arrive (2-fix debounce)", () => {
  const trip = makeTrip();
  feed(trip, 5, 0);                  // one fix at POI 0 → count 1, no arrival yet
  let snap = feed(trip, 2, 1000);    // drift away → count resets
  assert.ok(!snap.events.some((e) => e.type === "arrival"), "single fix must not arrive");
  assert.equal(snap.phase, "out", "a brief backtrack near the start must not turn around");
  feed(trip, 4, 2000);               // count 1
  snap = feed(trip, 5, 3000);        // count 2 → arrival
  assert.ok(snap.events.some((e) => e.type === "arrival" && e.poiIdx === 0));
});

test("early turnaround: paddle out past halfway then back flips to tornada", () => {
  const trip = makeTrip();
  // Out to index 15 (past 50% of the anada), arriving POIs 0 and 1 en route.
  for (let i = 0; i <= 15; i++) feed(trip, i, i * 1000);
  assert.equal(trip.getSnapshot().phase, "out");
  assert.equal(trip.getSnapshot().activePOIIdx, 2, "still heading to the last POI");

  // Turn back without ever reaching POI 2 within 50 m.
  let turnaround = null;
  for (const i of [14, 13, 12]) {
    feed(trip, i, 20_000).events.forEach((e) => { if (e.type === "turnaround") turnaround = e; });
  }
  assert.ok(turnaround, "turning back early still flips to tornada");
  assert.equal(turnaround.reason, "early");
  assert.equal(trip.getSnapshot().phase, "back");
});

test("too-slow return: a single return-unsafe fires once on the way home", () => {
  // 20-minute trip: the turnaround at the last POI is comfortably SAFE. Then the
  // clock is run down (~13 min in) while still well offshore, so the paddle home
  // no longer fits the safety margin — return-unsafe must fire, exactly once.
  const trip = makeTrip({ durationMs: 20 * 60_000 });
  for (let i = 0; i <= 20; i++) feed(trip, i, i * 1000); // out + turnaround, safe
  const turn = trip.getSnapshot();
  assert.equal(turn.phase, "back");
  assert.equal(turn.returnSafety.safe, true, "turnaround itself is within the safety margin");

  const unsafe = [];
  for (const [i, t] of [[15, 800_000], [12, 810_000], [10, 820_000]]) {
    feed(trip, i, t).events.forEach((e) => { if (e.type === "return-unsafe") unsafe.push(e); });
  }
  assert.equal(unsafe.length, 1, "return-unsafe fires exactly once, not every fix");
  assert.equal(trip.getSnapshot().returnSafety.safe, false);
});

test("off-route: a fix far from the track holds progress and emits nothing", () => {
  // Regression for the Barcelona bug: a precise fix ~111 km from the route
  // (passes the accuracy filter, but nowhere near the water) used to read as
  // "out of time" → instant false turnaround + "arrived" + 'completat'.
  const trip = makeTrip();
  const snap = trip.update({ coords: [LNG0, LAT + 1.0], tMs: 0 });
  assert.equal(snap.offRoute, true, "the fix is flagged off-route");
  assert.equal(snap.events.length, 0, "no arrival/turnaround from an off-route fix");
  assert.equal(snap.phase, "out", "phase must not flip to tornada");
  assert.equal(snap.activePOIIdx, 0, "the POI chain must not advance");
  assert.equal(snap.progressPct, 0, "progress stays at 0%");

  // Once genuinely on the route, the state machine resumes normally.
  const back = trip.update({ coords: TRACK[5], tMs: 1000 });
  assert.equal(back.offRoute, false);
  assert.equal(back.phase, "out");
});

test("return-safety is decoupled from the 50 m last-POI gate", () => {
  // 8-minute trip: the paddler runs low on time mid-anada and the reducer flips
  // to the tornada on the time trigger (the last POI is never reached within
  // 50 m). The safety warning must still come through.
  const trip = makeTrip({ durationMs: 8 * 60_000 });
  const evs = [];
  for (let i = 0; i <= 15; i++) feed(trip, i, i * 1000).events.forEach((e) => evs.push(e));

  const turnaround = evs.find((e) => e.type === "turnaround");
  assert.ok(turnaround, "turned around without reaching the last POI");
  assert.equal(turnaround.reason, "time");
  assert.equal(trip.getSnapshot().activePOIIdx, 2, "the last POI was never reached within 50 m");
  const warned = turnaround.short || evs.some((e) => e.type === "return-unsafe");
  assert.ok(warned, "return-safety warning still fired despite the skipped last POI");
});

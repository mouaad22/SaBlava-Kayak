// dev/alerts.test.mjs — unit tests for nav/alerts.js.
//
// Run from the repo root:  node --test app/js/dev/alerts.test.mjs
//
// Pure module → no browser globals to mock. We drive the wall clock by passing
// nowMs directly, exactly as navigate.js does from Date.now(), and assert which
// time-warning fires and which are marked fired — per the verification baseline
// in docs/nav-hardening.json (session-3 → S3.T5). Thresholds come from
// config.OVERTIME_WARNINGS_MIN = [30, 15, 5, 0].

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  dueThresholds,
  reconcileThresholds,
  thresholdCrossAtMs,
  thresholdKey,
} from "../nav/alerts.js";

const MIN = 60_000;
const DUR = 60 * MIN;          // a 1-hour trip starting at t=0
const GRACE = 60_000;          // ALERT_RESUME_GRACE_MS default

// Crossing instants for the 60-min trip: t30→30min, t15→45min, t5→55min, t0→60min.
const CROSS = { t30: 30 * MIN, t15: 45 * MIN, t5: 55 * MIN, t0: 60 * MIN };

test("thresholdCrossAtMs / thresholdKey are wall-clock correct", () => {
  assert.equal(thresholdKey(15), "t15");
  for (const [key, at] of Object.entries(CROSS)) {
    const threshMin = Number(key.slice(1));
    assert.equal(thresholdCrossAtMs(threshMin, 0, DUR), at, `${key} crosses at ${at}ms`);
  }
});

test("normal foreground: 30/15/5/0 each fire once, in order, on their tick", () => {
  let fired = [];
  const announced = [];
  for (let min = 0; min <= 60; min++) {
    const { fire, markFired } = reconcileThresholds({
      nowMs: min * MIN, startedAtMs: 0, durationMs: DUR, fired, graceMs: GRACE,
    });
    if (fire) announced.push(fire.key);
    fired = [...new Set([...fired, ...markFired])];
  }
  assert.deepEqual(announced, ["t30", "t15", "t5", "t0"]);
});

test("dueThresholds returns crossed-but-unfired, oldest crossing first", () => {
  // At 55 min, t30/t15/t5 have crossed; t30 already fired → expect t15 then t5.
  const due = dueThresholds(CROSS.t5, 0, DUR, ["t30"]);
  assert.deepEqual(due.map((d) => d.key), ["t15", "t5"]);
});

test("background gap across multiple: fire only the most recent, mark them all", () => {
  // Hidden from t=0, return at 55 min: t30, t15, t5 all crossed (t0 not yet).
  const { fire, markFired } = reconcileThresholds({
    nowMs: CROSS.t5, startedAtMs: 0, durationMs: DUR, fired: [], graceMs: GRACE,
  });
  assert.equal(fire.key, "t5", "announces only the most recent missed warning");
  assert.deepEqual([...markFired].sort(), ["t15", "t30", "t5"], "older ones marked fired, never replayed");
});

test("stale gap beyond grace: announce nothing, but still mark crossed fired", () => {
  // Return 3.3 min after the t30 crossing — outside the 60 s grace window.
  const r = reconcileThresholds({
    nowMs: CROSS.t30 + 200_000, startedAtMs: 0, durationMs: DUR, fired: [], graceMs: GRACE,
  });
  assert.equal(r.fire, null, "a stale warning is not dumped on resume");
  assert.deepEqual(r.markFired, ["t30"], "but it is marked so it can never replay");
});

test("persisted fired state prevents a double-fire across a reload", () => {
  // Reload exactly at the t30 crossing with t30 already recorded on the session.
  const r = reconcileThresholds({
    nowMs: CROSS.t30, startedAtMs: 0, durationMs: DUR, fired: ["t30"], graceMs: GRACE,
  });
  assert.equal(r.fire, null);
  assert.deepEqual(r.markFired, []);
});

test("nothing is due before the first threshold", () => {
  const r = reconcileThresholds({
    nowMs: 10 * MIN, startedAtMs: 0, durationMs: DUR, fired: [], graceMs: GRACE,
  });
  assert.equal(r.fire, null);
  assert.deepEqual(r.markFired, []);
});

test("default grace is Infinity (foreground primitive never suppresses)", () => {
  // Without an explicit grace, a long-crossed threshold still fires — used only
  // where the caller has not opted into backlog suppression.
  const r = reconcileThresholds({
    nowMs: CROSS.t30 + 10 * MIN, startedAtMs: 0, durationMs: DUR, fired: [],
  });
  assert.equal(r.fire.key, "t30");
});

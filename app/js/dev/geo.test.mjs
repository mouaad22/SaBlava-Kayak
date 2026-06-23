// dev/geo.test.mjs — unit tests for nav/geo.js GPS helpers.
//
// Run from the repo root:  node --test app/js/dev/geo.test.mjs
//
// This is the verification baseline for the nav-hardening work
// (docs/nav-hardening.json → agent_protocol.verification_baseline.unit_tests):
// pure-ish ESM modules are tested with the built-in node test runner, mocking
// only the browser globals the module touches (here: navigator.geolocation).

import { test } from "node:test";
import assert from "node:assert/strict";

import { watchFilteredPosition, geoPermissionState, haversineM } from "../nav/geo.js";
import { GPS_MAX_ACCURACY_M, GPS_STALE_FIX_MS } from "../config.js";

/** Replace globalThis.navigator (read-only in modern node) for one test. */
function setNavigator(value) {
  Object.defineProperty(globalThis, "navigator", { configurable: true, value });
}

/** Install a fake geolocation; returns a handle to drive the watch callbacks. */
function mockGeolocation() {
  let success = null;
  let error = null;
  setNavigator({
    geolocation: {
      watchPosition(onSuccess, onError) {
        success = onSuccess;
        error = onError;
        return 1;
      },
      clearWatch() {},
    },
  });
  return {
    fix: (lng, lat, accuracy) =>
      success?.({ coords: { longitude: lng, latitude: lat, accuracy } }),
    fail: (code) => error?.({ code, message: `mock ${code}` }),
  };
}

test("emits 'acquiring' immediately, then 'ok' + onFix for an accurate fix", () => {
  const geo = mockGeolocation();
  const states = [];
  const fixes = [];
  watchFilteredPosition((p) => fixes.push(p), (s) => states.push(s));

  assert.equal(states[0], "acquiring");
  geo.fix(3.21, 41.93, 5);
  assert.deepEqual(states, ["acquiring", "ok"]);
  assert.equal(fixes.length, 1);
});

test("drops fixes worse than GPS_MAX_ACCURACY_M (no onFix, no 'ok')", () => {
  const geo = mockGeolocation();
  const states = [];
  const fixes = [];
  watchFilteredPosition((p) => fixes.push(p), (s) => states.push(s));

  geo.fix(3.21, 41.93, GPS_MAX_ACCURACY_M + 100);
  assert.equal(fixes.length, 0, "imprecise fix must not reach onFix");
  assert.ok(!states.includes("ok"), "imprecise fix must not report 'ok'");
});

test("'low-accuracy' after fixes stay over threshold for GPS_STALE_FIX_MS", () => {
  const geo = mockGeolocation();
  const states = [];
  const realNow = Date.now;
  let now = 1_000_000;
  Date.now = () => now;
  try {
    watchFilteredPosition(() => {}, (s) => states.push(s));
    geo.fix(3.21, 41.93, GPS_MAX_ACCURACY_M + 50); // starts the stale clock
    assert.ok(!states.includes("low-accuracy"));
    now += GPS_STALE_FIX_MS + 1;
    geo.fix(3.21, 41.93, GPS_MAX_ACCURACY_M + 50); // sustained → low-accuracy
    assert.ok(states.includes("low-accuracy"));
  } finally {
    Date.now = realNow;
  }
});

test("error codes map to denied / unavailable / timeout (not a blanket 'denied')", () => {
  for (const [code, expected] of [[1, "denied"], [2, "unavailable"], [3, "timeout"]]) {
    const geo = mockGeolocation();
    const states = [];
    watchFilteredPosition(() => {}, (s) => states.push(s));
    geo.fail(code);
    assert.equal(states.at(-1), expected, `code ${code} → ${expected}`);
  }
});

test("recovers to 'ok' after a timeout when a good fix later arrives", () => {
  const geo = mockGeolocation();
  const states = [];
  watchFilteredPosition(() => {}, (s) => states.push(s));
  geo.fail(3);
  assert.equal(states.at(-1), "timeout");
  geo.fix(3.21, 41.93, 4);
  assert.equal(states.at(-1), "ok");
});

test("transient errors are ignored once usable fixes are flowing", () => {
  const geo = mockGeolocation();
  const states = [];
  watchFilteredPosition(() => {}, (s) => states.push(s));
  geo.fix(3.21, 41.93, 4);          // ok
  geo.fail(2);                       // unavailable blip — should be ignored
  assert.equal(states.at(-1), "ok", "a transient blip must not clobber 'ok'");
});

test("missing navigator.geolocation reports 'unavailable'", () => {
  setNavigator({});
  const states = [];
  const cleanup = watchFilteredPosition(() => {}, (s) => states.push(s));
  assert.equal(states.at(-1), "unavailable");
  assert.equal(typeof cleanup, "function");
});

test("geoPermissionState returns 'unknown' without the Permissions API", async () => {
  setNavigator({}); // no navigator.permissions
  assert.equal(await geoPermissionState(), "unknown");
});

test("geoPermissionState reports the Permissions API state", async () => {
  for (const state of ["granted", "denied", "prompt"]) {
    setNavigator({ permissions: { query: async () => ({ state }) } });
    assert.equal(await geoPermissionState(), state);
  }
});

test("geoPermissionState falls back to 'unknown' when query throws", async () => {
  setNavigator({ permissions: { query: async () => { throw new Error("nope"); } } });
  assert.equal(await geoPermissionState(), "unknown");
});

test("haversineM sanity: ~111 m for 0.001° of latitude", () => {
  const d = haversineM([3.21, 41.93], [3.21, 41.931]);
  assert.ok(Math.abs(d - 111) < 2, `expected ~111 m, got ${d}`);
});

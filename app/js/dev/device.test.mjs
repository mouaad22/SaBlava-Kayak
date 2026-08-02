// dev/device.test.mjs — unit tests for nav/device.js platform detection.
//
// Run from the repo root:  node --test app/js/dev/device.test.mjs
//
// isIOS()/isStandalone() exist to pick the recovery copy shown when location is
// blocked. Getting them wrong sends an iPhone user to a settings screen that
// does not exist, which is the failure these tests guard against.

import { test } from "node:test";
import assert from "node:assert/strict";

import { isIOS, isStandalone } from "../nav/device.js";

/** Replace globalThis.navigator (read-only in modern node) for one test. */
function setNavigator(value) {
  Object.defineProperty(globalThis, "navigator", { configurable: true, value });
}

/** Replace globalThis.window for one test. */
function setWindow(value) {
  Object.defineProperty(globalThis, "window", { configurable: true, value });
}

const IPHONE_18 =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1";
const MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/120.0.0.0 Mobile Safari/537.36";

// ── isIOS ─────────────────────────────────────────────────────────────────────

test("isIOS is true for the real iPhone UA from the field diagnostic", () => {
  setNavigator({ userAgent: IPHONE_18, maxTouchPoints: 5 });
  assert.equal(isIOS(), true);
});

test("isIOS is true for iPadOS, which reports a desktop Mac UA", () => {
  // iPadOS 13+ masquerades as Safari on macOS; only maxTouchPoints betrays it.
  setNavigator({ userAgent: MAC_SAFARI, maxTouchPoints: 5 });
  assert.equal(isIOS(), true);
});

test("isIOS is false for a genuine desktop Mac", () => {
  setNavigator({ userAgent: MAC_SAFARI, maxTouchPoints: 0 });
  assert.equal(isIOS(), false);
});

test("isIOS is false on Android", () => {
  setNavigator({ userAgent: ANDROID, maxTouchPoints: 5 });
  assert.equal(isIOS(), false);
});

test("isIOS survives a missing userAgent instead of throwing", () => {
  setNavigator({ maxTouchPoints: 0 });
  assert.equal(isIOS(), false);
});

// ── isStandalone ──────────────────────────────────────────────────────────────

test("isStandalone is true when iOS sets navigator.standalone", () => {
  setNavigator({ userAgent: IPHONE_18, standalone: true, maxTouchPoints: 5 });
  setWindow({ matchMedia: () => ({ matches: false }) });
  assert.equal(isStandalone(), true);
});

test("isStandalone is true from the display-mode media query alone", () => {
  setNavigator({ userAgent: ANDROID, maxTouchPoints: 5 });
  setWindow({ matchMedia: (q) => ({ matches: q === "(display-mode: standalone)" }) });
  assert.equal(isStandalone(), true);
});

test("isStandalone is false in a normal browser tab", () => {
  setNavigator({ userAgent: IPHONE_18, standalone: false, maxTouchPoints: 5 });
  setWindow({ matchMedia: () => ({ matches: false }) });
  assert.equal(isStandalone(), false);
});

test("isStandalone returns a boolean when matchMedia is unavailable", () => {
  // Older WebViews have no matchMedia; the optional call must not throw, and
  // callers branch on the result so it has to be a real boolean, not undefined.
  setNavigator({ userAgent: IPHONE_18, maxTouchPoints: 5 });
  setWindow({});
  assert.equal(isStandalone(), false);
});

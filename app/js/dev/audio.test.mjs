// audio.test.mjs — unit coverage for the session-4 alert-delivery channels.
//
// audio.js is mostly browser glue (TTS/HTMLAudio), but notify() and vibrate()
// carry the "no-op gracefully where unsupported, prefer the service worker"
// branching that the on-water reliability depends on. Those branches are pure
// enough to test in node with mocked globals.
//
// audio.js reads `window` / `navigator` both at module scope and inside the
// functions under test, so we alias window→globalThis (one set of mocks visible
// to both `("X" in window)` checks and bare `X` lookups) BEFORE importing.
//
// Run: node --test app/js/dev/audio.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";

// navigator is a read-only getter on globalThis in modern node — install a
// mutable mock via defineProperty (per the verification baseline). The same
// object is reused; tests add/remove vibrate / serviceWorker on it.
const navMock = {};
Object.defineProperty(globalThis, "navigator", { configurable: true, value: navMock });
globalThis.window = globalThis;

const { notify, vibrate } = await import("../nav/audio.js");

test("vibrate: no-op (false) where navigator.vibrate is unsupported", () => {
  delete globalThis.navigator.vibrate;
  assert.equal(vibrate([100]), false);
});

test("vibrate: forwards the pattern to navigator.vibrate and returns its result", () => {
  let got = null;
  globalThis.navigator.vibrate = (p) => { got = p; return true; };
  assert.equal(vibrate([200, 100, 200]), true);
  assert.deepEqual(got, [200, 100, 200]);
  delete globalThis.navigator.vibrate;
});

test("notify: false when the Notification API is absent (iOS Safari non-PWA)", () => {
  delete globalThis.Notification;
  assert.equal(notify({ title: "x" }), false);
});

test("notify: false when permission is not granted", () => {
  globalThis.Notification = function () {};
  globalThis.Notification.permission = "default";
  assert.equal(notify({ title: "x" }), false);
});

test("notify: false when no title is given", () => {
  globalThis.Notification = function () {};
  globalThis.Notification.permission = "granted";
  assert.equal(notify({ body: "no title" }), false);
});

test("notify: granted + no service worker → page Notification fallback fires", () => {
  const calls = [];
  function MockNotification(title, options) { calls.push({ title, options }); }
  MockNotification.permission = "granted";
  globalThis.Notification = MockNotification;
  delete globalThis.navigator.serviceWorker; // force the constructor fallback path

  const ok = notify({ title: "Punt assolit ✓", body: "Cala", tag: "nav-arrival", vibrate: [120] });
  assert.equal(ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].title, "Punt assolit ✓");
  assert.equal(calls[0].options.body, "Cala");
  assert.equal(calls[0].options.tag, "nav-arrival");
  assert.deepEqual(calls[0].options.vibrate, [120]);
});

test("notify: prefers the service worker's showNotification when one is active", async () => {
  const shown = [];
  const reg = { showNotification: (title, options) => { shown.push({ title, options }); } };
  globalThis.navigator.serviceWorker = { ready: Promise.resolve(reg) };
  function MockNotification() { throw new Error("page Notification must not be used when a SW is active"); }
  MockNotification.permission = "granted";
  globalThis.Notification = MockNotification;

  const ok = notify({ title: "Hora de tornar", body: "20 min" });
  assert.equal(ok, true); // dispatched optimistically, then awaited off the ready promise
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(shown.length, 1);
  assert.equal(shown[0].title, "Hora de tornar");
  delete globalThis.navigator.serviceWorker;
});

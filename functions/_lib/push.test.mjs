// _lib/push.test.mjs — the pure threshold decision behind the server push tick.
//
// Run:  node --test functions/_lib/push.test.mjs
//
// Mirrors the in-app reconciler's contract (app/js/dev/alerts.test.mjs): each of
// 30/15/5/0 fires once, in order, and a backlog collapses to the most urgent.

import { test } from "node:test";
import assert from "node:assert/strict";

import { pickDuePush, thresholdKey, thresholdCrossAtMs, buildMessage, THRESHOLDS_MIN } from "./push.js";

const MIN = 60_000;
const START = 0;
const DUR = 60 * MIN;                  // 1-hour rental
const session = { expires_at: START + DUR, kayak_id: "07" };

// Crossing instants: t30→30min, t15→45min, t5→55min, t0→60min.
test("thresholdCrossAtMs matches the expiry-relative schedule", () => {
  assert.equal(thresholdCrossAtMs(30, DUR), 30 * MIN);
  assert.equal(thresholdCrossAtMs(0, DUR), 60 * MIN);
});

test("normal minute-by-minute: each threshold fires once, in order", () => {
  const sent = new Set();
  const fired = [];
  for (let min = 0; min <= 60; min++) {
    const { send, collapse } = pickDuePush(session, min * MIN, sent);
    assert.deepEqual(collapse, [], `no backlog at minute ${min}`);
    if (send) { fired.push(`${min}:${send}`); sent.add(send); }
  }
  assert.deepEqual(fired, ["30:t30", "45:t15", "55:t5", "60:t0"]);
});

test("nothing fires before the first threshold", () => {
  assert.deepEqual(pickDuePush(session, 29 * MIN, new Set()), { send: null, collapse: [] });
});

test("backlog after downtime collapses to the most urgent, marks the rest", () => {
  // First tick happens at minute 56: t30, t15, t5 have all crossed unsent.
  const { send, collapse } = pickDuePush(session, 56 * MIN, new Set());
  assert.equal(send, "t5", "only the most urgent is actually sent");
  assert.deepEqual(collapse.sort(), ["t15", "t30"], "older ones are recorded, not fired");
});

test("already-sent thresholds are never re-picked", () => {
  const sent = new Set(["t30", "t15", "t5"]);
  assert.equal(pickDuePush(session, 56 * MIN, sent).send, null);
  assert.equal(pickDuePush(session, 60 * MIN, sent).send, "t0");
});

test("overtime keeps t0 as the only due item, once", () => {
  const sent = new Set(["t30", "t15", "t5"]);
  assert.equal(pickDuePush(session, 75 * MIN, sent).send, "t0");
  sent.add("t0");
  assert.deepEqual(pickDuePush(session, 90 * MIN, sent), { send: null, collapse: [] });
});

test("buildMessage is localized and tags/urgency are set", () => {
  assert.equal(THRESHOLDS_MIN.map(thresholdKey).join(","), "t30,t15,t5,t0");
  const es = buildMessage("t5", "es", session);
  assert.match(es.body, /vuelve a la base/i);
  assert.equal(es.tag, "nav-time");
  assert.equal(es.urgent, true);
  assert.equal(es.kayak_id, "07");
  // Unknown lang falls back to Catalan, never throws.
  assert.equal(buildMessage("t0", "de", session).body, "Temps esgotat · torna a la base");
});

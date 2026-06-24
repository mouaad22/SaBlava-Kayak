// nav/alerts.js — Pure wall-clock alert scheduler.
//
// NO DOM, NO globals, NO timers, NO Date.now reads (the caller passes `nowMs`),
// so the whole thing is unit-testable by jumping the clock (see
// dev/alerts.test.mjs). It exists to make the time-warning (30/15/5/0 min)
// CORRECTNESS derive from the wall clock, not from how many rAF/interval ticks
// actually ran — the old code fired thresholds from a once-per-rAF loop that
// stalls when the tab is backgrounded or the screen locks.
//
// Two responsibilities:
//   1. dueThresholds(...)   — which thresholds have been crossed but not fired.
//   2. reconcileThresholds  — what to announce NOW: at most ONE cue (the most
//      recently crossed), and only if it crossed within `graceMs`. Older missed
//      thresholds are returned to be marked fired WITHOUT announcing, so coming
//      back from a long background gap never dumps a backlog of stale alerts.
//
// The same reconcile path serves both the normal per-second foreground tick
// (where exactly one threshold crosses at a time, well within grace → it fires)
// and the visibilitychange→visible resume (where several may have crossed while
// hidden → only the latest fresh one fires, the rest are silently marked fired).

import { OVERTIME_WARNINGS_MIN } from "../config.js";

/** Stable storage/key form for a minutes-remaining threshold. */
export const thresholdKey = (threshMin) => `t${threshMin}`;

/** Wall-clock instant at which `threshMin` minutes-remaining is reached. */
export function thresholdCrossAtMs(threshMin, startedAtMs, durationMs) {
  return startedAtMs + durationMs - threshMin * 60_000;
}

/**
 * Every threshold whose cross time has passed at `nowMs` and is not already in
 * `alreadyFired`. Returned oldest-crossed first, so the LAST element is the most
 * recently crossed (closest to the end of the trip).
 *
 * @param {number} nowMs
 * @param {number} startedAtMs
 * @param {number} durationMs
 * @param {string[]} [alreadyFired]
 * @returns {{ key: string, threshMin: number, crossedAtMs: number }[]}
 */
export function dueThresholds(nowMs, startedAtMs, durationMs, alreadyFired = []) {
  const fired = new Set(alreadyFired);
  return OVERTIME_WARNINGS_MIN
    .map((threshMin) => ({
      key: thresholdKey(threshMin),
      threshMin,
      crossedAtMs: thresholdCrossAtMs(threshMin, startedAtMs, durationMs),
    }))
    .filter((d) => !fired.has(d.key) && nowMs >= d.crossedAtMs)
    .sort((a, b) => a.crossedAtMs - b.crossedAtMs);
}

/**
 * Decide what to announce at `nowMs`. Fires at most ONE threshold — the most
 * recently crossed — and only if it crossed within `graceMs`. Either way, ALL
 * crossed-but-unfired thresholds are returned in `markFired` so the older
 * skipped ones (and the one that fired) are never replayed.
 *
 * @param {object} args
 * @param {number} args.nowMs
 * @param {number} args.startedAtMs
 * @param {number} args.durationMs
 * @param {string[]} [args.fired]
 * @param {number} [args.graceMs] — defaults to Infinity (always fresh enough)
 * @returns {{ fire: { key: string, threshMin: number, crossedAtMs: number } | null, markFired: string[] }}
 */
export function reconcileThresholds({ nowMs, startedAtMs, durationMs, fired = [], graceMs = Infinity }) {
  const due = dueThresholds(nowMs, startedAtMs, durationMs, fired);
  if (due.length === 0) return { fire: null, markFired: [] };

  const mostRecent = due[due.length - 1];
  const fresh = nowMs - mostRecent.crossedAtMs <= graceMs;
  return {
    fire: fresh ? mostRecent : null,
    markFired: due.map((d) => d.key),
  };
}

# Navigation field-test checklist

Run this before trusting the GPS navigation flow with a paying customer. It
signs off the five on-water reliability fixes shipped in phase 2.1
(`docs/nav-hardening.json`). The logic layer is covered by automated tests
(`node --test app/js/dev/`, incl. `integration.test.mjs`); **this checklist is
the part a machine can't verify** — real GPS, a real screen lock, and real
system notifications on the two target phones.

Do the indoor sim pre-check first (5 min, at a desk), then the on-water pass on
**both** devices: **iPhone Safari** and **Android Chrome**.

---

## 0. Indoor sim pre-check (desk, ~5 min)

Serve the app (`python app/server.py` → http://localhost:5173), open it, then
paste `app/js/dev/sim.js` into the DevTools console. Drive the fault-injection
controls:

- [ ] `__simAccuracy(120)` → blue marker does **not** jump; after a few seconds a
      calm "weak signal" banner appears. `__simAccuracy(4)` → it clears, marker
      tracks again.
- [ ] `__simDenied()` → **"permission denied"** banner with a retry affordance
      (not a generic error). `__simTimeout()` / `__simUnavailable()` → their own
      distinct banners, **never** "denied".
- [ ] `__simGap(20)` mid-trip → marker freezes for 20 s, then jumps to the
      correct current position on resume and the countdown is still accurate
      (it never paused).
- [ ] Full happy path: progress climbs smoothly (not in discrete jumps),
      arrival chimes fire, the turnaround flips to **Tornada**, console is clean.

> The sim pauses GPS only — it cannot throttle rAF or set `document.hidden`, so
> the **true** background-alert behaviour below must be confirmed on a device.

---

## 1. GPS reliability (risk #3)

On each device, on the water (or a waterfront with open sky):

- [ ] On the navigate screen before the first fix, an **"acquiring GPS"** state
      shows — the marina dot is **not** presented as your position.
- [ ] Grant permission → within a few seconds the banner clears and the blue
      marker tracks your real position.
- [ ] Stand still near a cliff / under cover (Cap de Begur is the worst case):
      confirm the marker doesn't teleport to wild low-accuracy fixes. If the
      "weak signal" banner shows constantly in open water, `GPS_MAX_ACCURACY_M`
      (config.js, currently 35) is too strict — note the typical accuracy seen.
- [ ] **Deny** permission once, then use the **retry** button: on Android it
      re-prompts; on iOS it shows the settings-guidance line (expected — iOS
      can't re-prompt once set).

## 2. Continuous progress + arrival + turnaround (risks #4, #5)

- [ ] Progress % rises **smoothly** as you paddle between POIs, not in big steps.
- [ ] Arriving within ~50 m of a POI chimes **once** (not repeatedly, not on a
      single GPS spike).
- [ ] **Deliberately skip a POI** (paddle past without going within 50 m): the
      next-target and progress do **not** freeze — the chain advances.
- [ ] **Turn back early** (before the last POI): the screen flips to **Tornada**
      and the return-to-base distance shows. The return-safety warning can fire
      even though you never reached the last POI within 50 m.
- [ ] On the way home, progress reflects **track distance to base** (it should
      not read falsely optimistic on the curved sections of the coast).

## 3. Wall-clock time warnings, incl. background (risks #1, #2)

Use a short test duration so the 30/15/5/0-min warnings come quickly (seed a
short session, or test near the end of a real one).

- [ ] Foregrounded, the 30 / 15 / 5 / 0-min warnings fire at the right times.
- [ ] **Lock the phone** across a threshold boundary, wait, unlock: you get
      **exactly one** fresh warning on resume — **not** a burst of stale ones —
      and the countdown is correct (self-corrected for the locked interval).
- [ ] **Reload** mid-trip → an already-fired warning does **not** replay.
      (Check `localStorage['sa-blava.session'].firedThresholds` grows.)
- [ ] **Android Chrome:** background the app, then cross a threshold / arrive at
      a POI → a **system notification + vibration** arrives (not just an in-app
      banner). Pocket the phone and confirm the buzz on arrival / T-0.
- [ ] After lock + unlock, the next voice cue **still speaks** (TTS re-prime).
- [ ] Permission for notifications is asked **on the start tap**, not mid-trip;
      denying it degrades silently to the in-app banner (no errors).
- [ ] The one-time **"keep the app open + screen on"** advisory shows once at
      trip start.

---

## Residual known limits — document these for the operator

These are **by design / platform constraints**, not bugs. The trip-start
advisory exists because of them:

- **iOS Safari (not installed as a PWA) has NO background notifications.** When
  the screen is locked or the app is backgrounded, alerts do **not** reach the
  paddler until they reopen the app (then the on-resume reconcile fires the
  single most-recent warning). Making the app an installable PWA is the open
  follow-up that would fix this — see `global_open_questions` in
  `docs/nav-hardening.json`.
- **The iOS hardware silent switch can mute the `<audio>` chime.** Voice/TTS
  still plays; the chime may not.
- **Catalan TTS voice is usually absent** on both platforms → it falls back to
  Spanish. Acceptable, but the voice won't be Catalan.
- **The accuracy gate (`GPS_MAX_ACCURACY_M = 35`) is untuned against a real
  track.** If open-water fixes are routinely worse than 35 m, raise it.
- **Reliable alerts require the app open with the screen on.** This is the
  honest operating instruction to give customers until/unless the PWA path lands.

> Bottom line for customer use today: treat the on-screen, app-foregrounded
> experience as the reliable one. The background channels (Android system
> notifications, vibration) are a best-effort bonus; iOS background delivery is
> a known gap.

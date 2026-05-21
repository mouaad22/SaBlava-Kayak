# Phase 2 — Start Modal, Countdown & Sun-Readable Navigation

## Context

Phase 1 of SaBlava-Kayak ships: route browser, route detail screen, POI carousel, hand-drawn map fallback, 4-language i18n, real GPS coords for the South route. The "Comença ruta" button is currently a `console.log` stub at [app/js/screens/route.js:373](../../../../Documents/GitHub/SaBlava-Kayak/app/js/screens/route.js).

The existing PRD ([docs/PRD-phase2-gps-navigation.md](../../../../Documents/GitHub/SaBlava-Kayak/docs/PRD-phase2-gps-navigation.md)) sprawled into admin panel + Rive intro + mascot system + share card. **This plan supersedes it for Phase 2 and narrows scope** to the single user journey that turns the app from a brochure into an in-water tool:

1. User taps **Comença ruta** → safety/payment modal opens
2. User ticks 3 safety items + types the day's code (handed out by staff)
3. **Route summary screen** opens: drawn route line on Mapbox (base → POIs → base), POI checklist with live remove/add, computed distance + estimated time, warning if estimate exceeds paid duration
4. User taps **Accepta i comença** → app pre-caches Mapbox tiles for the route's bounding box (progress bar)
5. App enters full-screen navigation with a wall-clock countdown sized to the hours they paid for
6. User toggles between **Mapa** (live Mapbox + position) and **Dades** (giant sun-readable HUD)
7. Audio + visual warnings at T-30, T-15, T-5, T-0; navigation never hard-locks

Everything else from the old PRD (admin, Rive, mascot, route-complete, weather text) is **deferred to Phase 3+**.

---

## Decisions locked with the user

| Question | Answer |
|---|---|
| Code security | Friction gate only. Format: `sablava{HH}{MMDD}` |
| Duration convention | Lookup: `01`=1h, `15`=1.5h, `02`=2h, `03`=3h |
| Duration source of truth | Encoded in the code (the `HH` segment) |
| Map UX | Two persistent tabs: **Mapa** and **Dades** |
| Dades content | Time remaining · Next POI (number + name + distance) · Distance to base (min + m) |
| Tile pre-cache | Auto on "Comença ruta" tap, modal shows progress bar |
| Overtime | Voice + visual at T-30 / T-15 / T-5 / T-0; navigation continues past 0 in red |
| Safety checklist | (1) Life jacket on, (2) checked weather, (3) will return on time |

---

## Out of scope (do not build)

- Admin panel / staff dashboard
- Rive intro animation
- Mascot system + weather-based text
- Route-complete shareable card
- Off-route detection / re-routing
- "Return to base" routing (we show straight-line distance only)
- Backend / shared-secret HMAC validation
- Real payment integration
- Multi-route concurrent sessions (one active session at a time)

---

## User journey (the new flow)

```
[Route detail screen, duration "3 hores" selected]
        │
        ▼  tap "Comença ruta"
┌──────────────────────────────────────────────────┐
│ Modal: "Abans de començar"                       │
│                                                  │
│ ☐ Porto armilla salvavides                       │
│ ☐ He revisat la previsió meteorològica           │
│ ☐ Tornaré abans que s'acabi el temps             │
│                                                  │
│ Codi:  [ sablava___________ ]                    │
│                                                  │
│ [Comença]  ← disabled until 3✓ + valid code      │
└──────────────────────────────────────────────────┘
        │ valid code → duration parsed from code (overrides selector)
        ▼
┌──────────────────────────────────────────────────┐
│ ROUTE SUMMARY  (#/route/:id/summary)             │
│ ┌────────────────────────────────────────────┐   │
│ │   [Mapbox map with route line drawn:       │   │
│ │    Base → POI1 → POI2 → … → POIn → Base ]  │   │
│ └────────────────────────────────────────────┘   │
│                                                  │
│ Distància: 4.2 km · Temps estimat: ~1h 12m       │
│ Has pagat: 3h                  (no warning)      │
│                                                  │
│ POIs a la teva ruta:                             │
│   ☑ 01 · Platja d'Aiguablava                     │
│   ☑ 02 · Cala ses Herbes                         │
│   ☐ 03 · Cala d'en Gispert    ← user unchecked  │
│   ☑ 04 · …                                       │
│                                                  │
│ [Accepta i comença]                              │
└──────────────────────────────────────────────────┘
        │ tap accept
        ▼
┌──────────────────────────────────────────────────┐
│ "Preparant el mapa per fora de línia…"           │
│ ████████░░░░ 62%                                 │
└──────────────────────────────────────────────────┘
        │ done
        ▼
┌──────────────────────────────────────────────────┐
│ NAVIGATE SCREEN  (#/route/:id/navigate)          │
│ ┌────────────────────────────────────────────┐   │
│ │ ⏱ 2h 47m   ·   POI 1/9 · 320 m            │   │ ← always-visible status bar
│ └────────────────────────────────────────────┘   │
│                                                  │
│      [Mapa tab content OR Dades tab content]     │
│                                                  │
│ ┌────────────────────────────────────────────┐   │
│ │       [ Mapa ]  [ Dades ]    [ × End ]     │   │ ← bottom tab bar
│ └────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

---

## Architecture

### Persistent state (localStorage)

| Key | Value | Lifetime |
|---|---|---|
| `sa-blava.lang` | `ca` / `es` / `en` / `fr` | already exists |
| `sa-blava.duration.{routeId}` | `"1h"` / `"3h"` … | already exists; **becomes display-only once a session starts** (duration is overridden by the code's `HH` segment) |
| `sa-blava.draft.{routeId}` | `{ includedPoiIndices: [0,1,2,4,5,7,8], durationHours }` | survives between modal close and accept; cleared on accept or after 24h |
| `sa-blava.session` | `{ routeId, durationHours, startedAtMs, code, includedPoiIndices }` | until session ends |

Wall-clock semantics: `timeRemainingMs = (startedAtMs + durationHours*3600_000) - Date.now()`. Refresh / re-open continues correctly. Closing the tab does not pause.

### New modules (all under `app/js/`)

```
app/js/
├── nav/
│   ├── code.js          parseCode, validateForToday
│   ├── session.js       start, end, get, isActive, timeRemainingMs
│   ├── geo.js           watchPosition wrapper + haversine() + bearing()
│   ├── audio.js         speak(textKey, lang), chime()
│   ├── wake-lock.js     acquire, release, re-acquire on visibilitychange
│   └── tile-cache.js    precacheBoundingBox(bbox, zoomMin..zoomMax, onProgress)
└── screens/
    ├── start-modal.js   the safety+code modal (rendered into route.js)
    ├── route-summary.js the customisable route preview screen (new route)
    └── navigate.js      the new full-screen nav route
```

### Code parser (`nav/code.js`)

```js
const DURATION_TABLE = { "01": 1, "15": 1.5, "02": 2, "03": 3 };

export function parseCode(input) {
  const match = /^sablava(\d{2})(\d{2})(\d{2})$/i.exec(input.trim().toLowerCase());
  if (!match) return null;
  const [, hh, mm, dd] = match;
  if (!(hh in DURATION_TABLE)) return null;
  return { durationHours: DURATION_TABLE[hh], month: Number(mm), day: Number(dd) };
}

export function isValidForToday(parsed, now = new Date()) {
  return parsed.month === now.getMonth() + 1 && parsed.day === now.getDate();
}
```

Today (2026-05-21) a 3-hour code is `sablava030521`. Once a session is started, the date check is *not* re-run — overnight sessions are allowed.

### Countdown engine (`nav/session.js`)

Pure functions over the `sa-blava.session` localStorage key. Components subscribe via a single `requestAnimationFrame` loop running in `navigate.js`. No internal `setInterval` per component — one tick per second is sufficient and a single rAF loop polling `Date.now()` is cheaper and self-corrects after backgrounding.

Threshold events fired once each: `t-30m`, `t-15m`, `t-5m`, `t-0`. Each fires a voice cue (i18n'd) + a banner overlay. Past `t-0`, the timer flips to red and counts up as "+0h 03m" overtime.

### Geo engine (`nav/geo.js`)

- `navigator.geolocation.watchPosition` with `enableHighAccuracy: true, maximumAge: 0, timeout: 5000`
- **Vanilla Haversine** for distance; no Turf.js (Turf is ~80KB minified for one function we need)
- Speed assumption for ETA in minutes: `KAYAK_SPEED_KMH = 3.5` (constant, in `config.js` so it's tunable)
- Permission denied → hard block with an explanation screen + retry button (no demo mode)

### Map view (Mapa tab)

- Mapbox GL JS already loaded (CDN) — token in `app/js/config.js:4`
- Style: `mapbox://styles/mapbox/outdoors-v12` (good for coves & paths; satellite reserved for Phase 3 toggle if requested)
- Layers on top: route line (from `data.routes[id].geometry`), POI markers (from `data.routes[id].pois`), live position marker (pulse). Camera follows user with bearing if heading available, else north-up
- No interactive panning gestures hijacked — leave Mapbox defaults; floating "recenter" button when user pans away

### Dades view

Three blocks, full-width, stacked, large type:

```
┌──────────────────────────────┐
│         2h 47m               │   font: 96pt, weight 900
│         restant              │   font: 18pt
├──────────────────────────────┤
│  POI 2/9 · Cala d'en Gispert │   font: 22pt
│         180 m                │   font: 72pt
├──────────────────────────────┤
│   Base: 12 min · 720 m       │   font: 28pt
└──────────────────────────────┘
```

White text on near-black background (`#0a0a0a` not pure `#000` — slightly easier on the eyes than #000 and equally power-friendly on OLED). When in Dades tab, the Mapbox container is `display: none` (drops WebGL canvas — same trick as the doc's pocket mode, just always-on for this tab).

### Audio cues (`nav/audio.js`)

- Web Speech API, voice tag = current i18n language with fallbacks: `ca-ES → es-ES → en-US`
- Primed once on the modal's "Comença" tap (empty utterance) so iOS unlocks the audio context
- Triggers:
  - `t-30m` → "Falten 30 minuts. Comença a pensar en tornar."
  - `t-15m` → "Falten 15 minuts. Si us plau, comença a tornar."
  - `t-5m` → "Falten 5 minuts. Torna ja a la base."
  - `t-0` → chime + "S'ha acabat el temps. Torna a la base."
  - POI approach (≤50m) → "T'apropes a {POI name}."
- All strings live in `i18n.js`; no hardcoded copy in `audio.js`

### Wake Lock (`nav/wake-lock.js`)

- Acquire on entering navigate screen
- Re-acquire on `visibilitychange` → visible (iOS releases on lock/unlock)
- Release on leaving navigate screen
- Silently no-op if API unavailable (older iOS Safari); we don't try to fake it

### Tile pre-cache (`nav/tile-cache.js`) + Service Worker

- New `sw.js` at app root: cache-first for app shell, network-first with cache fallback for Mapbox tile URLs (`api.mapbox.com/styles/...`, `api.mapbox.com/v4/...`, `events.mapbox.com` ignored)
- New `manifest.json` at app root (name, short_name, theme_color from `--color-primary`, 192/512 icons, `display: standalone`, `orientation: portrait`)
- Precache strategy: compute XYZ tiles for `data.routes[id].bbox` (need to add this to data.js — derive from `geometry`) at zoom 12–16, `fetch()` each, response handed to the Service Worker via `cache.put`
- Progress = `done / total` reported through a `BroadcastChannel` to the modal
- **Compliance note**: Mapbox standard terms allow ephemeral caching for a single user session. We are not redistributing tiles; this is browser-side caching only. Acceptable for this use case.

### Route summary screen (`screens/route-summary.js`)

This is the new step between the modal and tile pre-caching. Its job: let the user **see and edit** what they're about to do, in concrete terms.

**Reused data (no new structures needed):**
- `MARINA` constant at [data.js:509-512](../../../../Documents/GitHub/SaBlava-Kayak/app/js/data.js) — start/end coordinate for the route line. Do **not** add a new "base" field; reuse `MARINA`.
- `POI_COUNT_BY_DURATION` at [app/js/screens/route.js:20](../../../../Documents/GitHub/SaBlava-Kayak/app/js/screens/route.js) — defines the curated default selection per duration (`1h`→5, `1h30`→8, `2h`→8, `3h`→9). On first entry to the summary screen, default `includedPoiIndices = [0..N-1]` where N comes from this table for the **paid** duration.
- Each POI's `minutesFromStart` field in [data.js](../../../../Documents/GitHub/SaBlava-Kayak/app/js/data.js) is **only valid for the full curated route**. Once the user removes a POI it stops being meaningful — we recompute everything from haversine.
- Existing Mapbox LineString pattern at [map.js:248-288](../../../../Documents/GitHub/SaBlava-Kayak/app/js/map.js) — copy the `addSource`/`addLayer` shape. For live edits, call `map.getSource('summary-route').setData(newGeoJSON)` (smooth, no debounce needed for a few-vertex line).

**Coordinate path computation:**

```js
function buildPath(routePois, includedIndices) {
  const pts = [MARINA.coords];
  for (const idx of includedIndices) pts.push(routePois[idx].coords);
  pts.push(MARINA.coords);  // round trip
  return pts;
}

function totalKm(pts) {
  let km = 0;
  for (let i = 1; i < pts.length; i++) km += haversine(pts[i-1], pts[i]);
  return km;
}

function estimatedHours(pts, speedKmh = KAYAK_SPEED_KMH) {
  return totalKm(pts) / speedKmh;
}
```

**UX rules:**
- **Minimum 1 POI** must remain checked. If user tries to uncheck the last one, disable that checkbox with a tooltip "Has d'incloure almenys un punt".
- POI cards reuse the existing `.poi-card` styling from [route.js:66-77](../../../../Documents/GitHub/SaBlava-Kayak/app/js/screens/route.js) — wrap each in a label with a leading checkbox. Cards stay visually consistent with the route detail screen so the user understands "this is the same thing, but editable".
- "Has pagat: 3h" line shows the duration parsed from the code (single source of truth).
- If `estimatedHours > paidHours`: orange warning banner "El recorregut estimat supera el temps que has pagat." Does **not** block accepting — user might paddle faster, or accept the risk.
- Map auto-fits to the path bounds on every change (`map.fitBounds(...)` with padding).
- **No reordering** in MVP — POIs stay in canonical order. Adding drag-to-reorder is a Phase 3 candidate.

**State flow with the draft:**
- On enter: read `sa-blava.draft.{routeId}` if exists (and not stale); else use defaults from `POI_COUNT_BY_DURATION[paidDuration]`.
- On every checkbox toggle: write `sa-blava.draft.{routeId}` (so a refresh restores the user's edits).
- On "Accepta i comença": promote draft → `sa-blava.session` (with `startedAtMs: Date.now()` and the `code`), delete the draft key, transition to PREPARING.
- On back gesture / cancel: leave the draft intact (so they can resume).

**Index mapping caveat:** the POI detail route is `#/route/:id/poi/:i` where `i` is the canonical index into `route.pois`. Because we only **filter** (never reorder), indices stay stable — the POI detail screen and navigation engine can both keep using canonical indices. The `includedPoiIndices` array is the only place that diverges.

### State diagram

```
ROUTE_DETAIL
  │ tap Comença ruta
  ▼
MODAL_OPEN ─── 3✓ + valid code ───► SUMMARY ─── tap Accepta ───► PREPARING ─── tiles done ───► NAVIGATING
   ▲                                   │  ▲                          │                              │
   │── cancel ─────────────────────────┤  │── back gesture ──┐       │                              │
                                       │                    │       │── tile fetch fails ──► NAVIGATING (warning toast: "Mapa pot no estar disponible sense xarxa")
                                       │   (draft preserved)│                                      │
                                       │                                                          │── tap End ──► CONFIRM_END ──► ROUTE_DETAIL (session cleared)
                                       │                                                          │── T-0 reached ──► continues, overtime mode ──► (manual end)
                                       └── toggle POIs ──► live re-draw map + recompute stats ──► (loop in SUMMARY)
```

---

## File-by-file changes

### Modify

- **[app/js/screens/route.js](../../../../Documents/GitHub/SaBlava-Kayak/app/js/screens/route.js)** — replace the `console.log` stub on line 373 with a call to `openStartModal({ routeId, durationId })`. Modal is a child component, not a new route.
- **[app/js/router.js](../../../../Documents/GitHub/SaBlava-Kayak/app/js/router.js)** — register new routes `#/route/:id/summary` and `#/route/:id/navigate`. Guards: summary requires a valid draft (or fresh paid duration in memory); navigate requires an active session. Otherwise redirect to `#/route/:id`.
- **[app/js/data.js](../../../../Documents/GitHub/SaBlava-Kayak/app/js/data.js)** — add `bbox: [minLon, minLat, maxLon, maxLat]` to each route (derive from existing `geometry`/POI coords; computed offline once, hardcoded). Note: a hardcoded `BBOX` already exists at [map.js:11](../../../../Documents/GitHub/SaBlava-Kayak/app/js/map.js) for the SVG fallback — keep it consistent or move that constant onto the route object too.
- **[app/js/i18n.js](../../../../Documents/GitHub/SaBlava-Kayak/app/js/i18n.js)** — add ~25 new keys per language (modal title, checklist labels, code placeholder, validation errors, preparing-map, navigate tabs, end button, voice cue templates, overtime banner). See "i18n keys" section below.
- **[app/js/config.js](../../../../Documents/GitHub/SaBlava-Kayak/app/js/config.js)** — add `KAYAK_SPEED_KMH = 3.5`, `TILE_CACHE_ZOOM_MIN = 12`, `TILE_CACHE_ZOOM_MAX = 16`, `OVERTIME_WARNINGS_MIN = [30, 15, 5]`.
- **[app/styles/screens.css](../../../../Documents/GitHub/SaBlava-Kayak/app/styles/screens.css)** — new `.navigate-screen`, `.navigate-screen__status-bar`, `.navigate-screen__tabbar`, Dades layout, Mapa layout.
- **[app/styles/components.css](../../../../Documents/GitHub/SaBlava-Kayak/app/styles/components.css)** — new `.start-modal`, `.start-modal__checklist`, `.start-modal__code-input`, `.preparing-overlay`, `.overtime-banner`.
- **[app/index.html](../../../../Documents/GitHub/SaBlava-Kayak/app/index.html)** — add `<link rel="manifest" href="/manifest.json">`, theme-color meta, service worker registration script.

### Create

- `app/js/nav/code.js`
- `app/js/nav/session.js`
- `app/js/nav/geo.js`
- `app/js/nav/audio.js`
- `app/js/nav/wake-lock.js`
- `app/js/nav/tile-cache.js`
- `app/js/screens/start-modal.js`
- `app/js/screens/route-summary.js`
- `app/js/screens/navigate.js`
- `app/manifest.json`
- `app/sw.js`
- `app/assets/icon-192.png`, `app/assets/icon-512.png` (placeholder — Mou to design)
- `app/assets/alert-chime.mp3` (small 0.5s royalty-free chime for T-0)

### Existing patterns to reuse (do not reinvent)

- Hash router with regex param parsing: [app/js/router.js](../../../../Documents/GitHub/SaBlava-Kayak/app/js/router.js) — extend, don't rewrite
- Screen lifecycle (`renderXxxScreen`, scrollTop reset, animation classes): pattern in [app/js/screens/route.js](../../../../Documents/GitHub/SaBlava-Kayak/app/js/screens/route.js) — `navigate.js` follows the same shape
- localStorage helpers (get/set with namespace): the duration getter/setter at `route.js:25–39` — generalise into a tiny `nav/storage.js` if it becomes more than 3 keys, otherwise inline
- i18n function templates (e.g. `"stat.km": (n) => …`): use the same pattern for voice strings — `(poiName) => "T'apropes a " + poiName`
- Map abstraction with Mapbox / SVG fallback: [app/js/map.js](../../../../Documents/GitHub/SaBlava-Kayak/app/js/map.js) — Mapa tab uses the Mapbox branch directly (no SVG fallback for navigation; if Mapbox can't load, show Dades-only with a warning)

---

## i18n keys (new)

Catalan baseline shown; mirror in es / en / fr.

```
modal.title          → "Abans de començar"
modal.check.jacket   → "Porto armilla salvavides"
modal.check.weather  → "He revisat la previsió meteorològica"
modal.check.return   → "Tornaré abans que s'acabi el temps"
modal.code.label     → "Codi rebut a la base"
modal.code.placeholder → "sablava031221"
modal.code.invalid   → "Codi invàlid o caducat"
modal.start          → "Comença"
modal.cancel         → "Cancel·la"

summary.title        → "La teva ruta"
summary.distance     → (km) => `Distància: ${km} km`
summary.estimated    → (h, m) => `Temps estimat: ~${h}h ${m}m`
summary.paid         → (h) => `Has pagat: ${h}h`
summary.over_budget  → "El recorregut estimat supera el temps que has pagat."
summary.pois.title   → "POIs a la teva ruta"
summary.pois.min     → "Has d'incloure almenys un punt"
summary.accept       → "Accepta i comença"
summary.back         → "Tornar"

prepare.title        → "Preparant el mapa per fora de línia…"
prepare.subtitle     → "No tanquis l'aplicació"

nav.tab.map          → "Mapa"
nav.tab.data         → "Dades"
nav.end              → "Acabar"
nav.end.confirm      → "Segur que vols acabar la ruta?"
nav.dades.remaining  → "restant"
nav.dades.next       → (n, name) => `POI ${n} · ${name}`
nav.dades.base       → (min, m) => `Base: ${min} min · ${m} m`
nav.permission.denied → "Cal permís d'ubicació per navegar"

nav.voice.t30        → "Falten 30 minuts. Comença a pensar en tornar."
nav.voice.t15        → "Falten 15 minuts. Si us plau, comença a tornar."
nav.voice.t5         → "Falten 5 minuts. Torna ja a la base."
nav.voice.t0         → "S'ha acabat el temps. Torna a la base."
nav.voice.approach   → (name) => `T'apropes a ${name}.`

nav.overtime.banner  → (min) => `Temps excedit · +${min} min`
```

---

## Verification

End-to-end checklist (manual, mobile browser preferred):

1. **Code parse unit test** — node REPL or browser console: `parseCode("sablava030521")` returns `{durationHours:3, month:5, day:21}`; `parseCode("sablava030521", new Date("2026-05-22"))` → today-check fails; `parseCode("sablava04xxxx")` returns null (04 not in table).
2. **Modal flow** — open route detail, tap Comença, verify Start button disabled until all 3 boxes checked AND valid code typed. Invalid code → shake + error text. Cancel returns to route detail with no session.
3. **Summary screen** — after valid code, summary screen appears with default POI selection matching `POI_COUNT_BY_DURATION[paidDuration]`. Toggle a POI off → route line redraws live, distance + estimated time both update. Toggle all but one off → that last checkbox disables with tooltip. Refresh page → POI selection survives (draft persisted). Tap "Accepta i comença" → progresses to PREPARING.
4. **Over-budget warning** — force a long custom route (uncheck nothing on `sud` if it's already ~3h; otherwise select 1h paid and check all POIs) → orange warning banner shows. Accept still works.
5. **Tile pre-cache** — DevTools → Application → Cache Storage → confirm Mapbox tile URLs present after the progress bar completes. Force airplane mode, reload `#/route/sud/navigate`, confirm map still renders.
6. **Wall-clock countdown** — start a fake 1-min session (temporarily map `01` to 0.0167h in dev), refresh mid-session, confirm timer resumes correctly. Close tab, reopen, same.
7. **Threshold cues** — speed up by mapping `01` to 30s in dev; verify T-30/T-15/T-5/T-0 voice + banner all fire exactly once each. Verify overtime banner appears at T-0 and counts up.
8. **Geo math** — drop a known coordinate into `geo.js`, set position to second known coord, verify haversine output matches a reference calculator within ±1m.
9. **Wake lock** — start nav, leave phone idle 2 minutes, screen stays on. Lock phone manually, unlock → wake lock re-acquired (check console log).
10. **Voice in 4 languages** — start session in each language, verify T-30 cue fires in correct language (or falls back to es-ES / en-US silently with a console warning if Catalan voice missing).
11. **Sun-readability** — open Dades tab outdoors at noon. If you can't read it at arm's length, the type is too small. Iterate.
12. **PWA install** — Chrome → "Install app" appears. Installed app launches standalone, portrait-locked, theme color applied.

### What I can't verify automatically

- Real GPS drift behavior on the actual water (Cala Aiguablava)
- iOS Safari Web Speech voice availability for Catalan (notoriously spotty)
- Real battery drain over 3 hours of active session
- Whether the 96pt time-remaining digits actually survive bright sun glare through a vinyl dry pouch

Plan an in-water dry run before handing this to a paying customer.

---

## Open questions to revisit before Phase 3

- Should the staff have a way to *extend* a session mid-route (customer pays for another hour at sea, calls base, base sends a "+1h" code)?
- Catalan TTS quality on iOS — if it's bad, do we record human voice cues as MP3s instead?
- Mapbox cost per session at scale — pre-caching 4 zoom levels × bbox tiles × N sessions/day. Budget check before launch.
- Recovery flow if user accidentally clears localStorage mid-session (rare but possible).

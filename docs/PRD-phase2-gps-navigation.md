# PRD — Sa Blava Phase 2: GPS Navigation & Admin Panel

**Status:** Ready for implementation  
**Date:** 2026-05-13  
**Project:** SaBlava-Kayak (extension of Phase 1)

---

## Problem Statement

Customers who rent kayaks at Sa Blava have no way to navigate the coastal routes once they're on the water. They either memorise the route beforehand, rely on a paper map, or open Google Maps — which shows roads, not kayak routes, and has no knowledge of local POIs, sea conditions, or recommended stops.

Staff currently have no tool to communicate daily recommendations, sea conditions, or safety guidance to customers in a timely, friendly way. When conditions change mid-morning, there is no mechanism to update what customers see on their phones.

The competing agency proposal confirms the client has budget and intent to solve this. Our solution must match their feature set and exceed it in the one area that matters most: on-water guidance.

---

## Solution

Extend the existing Phase 1 Sa Blava web app with three interconnected systems:

1. **GPS Navigation Mode** — a dedicated on-water navigation screen that tracks the user's live position along the kayak route, shows distance and direction to the next POI, and auto-advances when they arrive. Pre-caches map tiles so it works in areas with poor signal.

2. **Daily Code System** — a date-based unlock code generated each day. Staff share the code with customers at rental time. The code gates GPS navigation and GPX file downloads, turning a marketing-grade web app into a value-added rental tool.

3. **Admin Panel** — a password-protected screen where staff can display today's code, select the recommended route, and write the mascot's daily message. Staff text expires after 2 hours and falls back to auto-generated weather-based copy so the app is never stale.

---

## User Stories

### Hero intro & language selection (first-touch)

*These stories happen chronologically first but are listed here to preserve existing numbering. Numbers 41–46 below.*

### Browsing (unauthenticated)

1. As a visitor, I want to select my preferred language (Catalan, Spanish, English, French) so that the entire app is in my language.
2. As a visitor, I want to see a friendly mascot message on the routes screen so that I get a quick human-readable summary of today's sea conditions before choosing a route.
3. As a visitor, I want the mascot to speak in my chosen language so that I understand the message without translating.
4. As a visitor, I want to see all available kayak routes on an interactive map so that I can understand where each route goes relative to the marina.
5. As a visitor, I want routes drawn on the map in different colours by difficulty (green/yellow/red) so that I can visually distinguish easy from hard routes at a glance.
6. As a visitor, I want to see difficulty tags on each route card so that I can quickly assess which route suits my level without opening it.
7. As a visitor, I want to toggle the map between terrain view and satellite view so that I can see the real coastline and water when planning.
8. As a visitor, I want to tap a crosshair button on the map so that the map centres on my current GPS position and I can orient myself relative to the marina.
9. As a visitor, I want to tap a route card to open its detail screen so that I can read the full description, see all POIs, and understand the full experience.
10. As a visitor, I want to see a weather widget showing current wind speed, direction, temperature, and wave height so that I can make an informed decision before getting on the water.
11. As a visitor, I want to see a Go / Caution / No-Go safety indicator per route so that I know at a glance whether conditions are appropriate for that difficulty level.
12. As a visitor, I want safety thresholds to match each route's difficulty so that an experienced paddler and a beginner get relevant advice for their level.
13. As a visitor on the route detail screen, I want to use the duration selector (1h / 1.5h / 2h / 3h) so that I see only the POIs reachable in my available time.
14. As a visitor, I want to see a "Recomanem avui" badge on the staff-recommended route card so that I know which route the Sa Blava team thinks is best today.
15. As a visitor, I want to see the reason the staff recommends a route (via the mascot) so that the recommendation feels personal and trustworthy, not algorithmic.

### Authentication & Code

16. As a customer who has rented a kayak, I want to tap "Comença ruta" and be prompted to enter today's code so that I can unlock GPS navigation for my rental session.
17. As a customer, I want my unlock session to persist across page refreshes so that I don't have to re-enter the code if I close and reopen the app during my trip.
18. As a customer who enters a wrong code, I want to see a clear error message so that I know the code was incorrect and can try again.
19. As a customer without a code, I want to continue browsing routes and POIs freely so that the app is still useful for trip planning even without a rental.
20. As a customer with a valid code, I want a GPX download button on the route detail screen so that I can load the route into a GPS device or external app if I prefer.

### GPS Navigation

21. As a customer starting a route, I want the app to pre-cache the map tiles for my route so that the map works even if I lose mobile signal near the cliffs or caves.
22. As a customer on the navigation screen, I want to see my live position as a blue dot on a fullscreen map so that I always know where I am relative to the coast.
23. As a customer navigating, I want a persistent chip at the bottom of the screen showing the next POI name, my distance to it, and its cardinal direction so that I can glance at my phone without studying the map.
24. As a customer navigating, I want the chip to auto-advance to the next POI when I'm within 50 metres so that the experience feels seamless and I don't have to tap anything.
25. As a customer who paddles past a POI without stopping, I want a "Skip" button on the chip so that I can manually advance without waiting for the proximity trigger.
26. As a customer arriving at a POI, I want the POI card to expand (photo, name, description, depth, snorkel rating) so that I can read about the spot I've just reached.
27. As a customer navigating, I want to see my progress through the route (e.g. "3 of 6 POIs visited") on the navigation screen so that I know how far I've come and how much remains.
28. As a customer who finishes the last POI, I want to see a route complete screen with my stats (distance paddled, time elapsed, POIs visited) so that I can feel a sense of accomplishment.
29. As a customer on the route complete screen, I want the mascot to appear with a celebratory message so that the ending feels delightful and memorable.
30. As a customer on the route complete screen, I want a share button that generates a screenshot-ready summary card so that I can post it and organically promote Sa Blava.
31. As a customer who has finished, I want a clear "Back to routes" CTA so that I can plan a second trip or return to the marina.

### Admin Panel

32. As a Sa Blava staff member, I want to navigate to a protected admin panel so that I can manage the daily experience without accessing any code or config files.
33. As staff, I want to enter an admin password to access the panel so that customers cannot accidentally reach it.
34. As staff, I want to see today's daily code displayed prominently so that I can read it aloud or write it on the rental receipt for each customer.
35. As staff, I want to select which route we recommend today so that the "Recomanem avui" badge appears on the correct route card for all customers.
36. As staff, I want to write a short mascot message (in any language) so that the routes screen mascot speaks in my voice about today's specific conditions.
37. As staff, I want the mascot message to expire after 2 hours so that I don't accidentally leave yesterday's message visible to afternoon customers if I forget to update it.
38. As staff, I want the mascot to automatically fall back to a weather-based default message after expiry so that the app is never empty or stale even if I'm busy.
39. As staff, I want the fallback mascot text to reflect live weather conditions (wind, waves, overall safety) so that the auto-message is always relevant and accurate.
40. As staff, I want the admin panel to work on my phone at the front desk so that I don't need a computer to run the daily setup.

### Hero intro & language selection

41. As a first-time visitor, I want a short cinematic intro (aerial beach → logo appears in sand → camera pans up over the water → a buoy appears → I pick my language → the buoy turns to face me and reveals the mascot) so that the app feels alive and on-brand from the first second.
42. As a returning visitor, I want the intro to skip to the final state instantly so that I'm not forced to watch the same animation every time I open the app.
43. As a visitor who is impatient or on a slow phone, I want a "Skip" button to appear after 1 second so that I can bypass the intro at any time.
44. As a visitor with motion sensitivity (system setting `prefers-reduced-motion`), I want the intro to be skipped automatically so that the app respects my accessibility setting.
45. As a visitor on a slow connection, I want a static fallback splash to appear if the animation file hasn't loaded after 3 seconds so that I'm never staring at a blank screen.
46. As a visitor, I want my language selection during the intro to persist so that the app remembers my choice on the next visit without re-prompting.

---

## Implementation Decisions

### Modules to build or modify

#### 1. GPX Loader (new — `js/gpx.js`)
Pure function module. Accepts a GPX XML string, returns a GeoJSON LineString feature and a bounding box. No side effects. Used by the navigation engine and the tile cache manager. GPX files are bundled as static assets in `/rutes/`.

Interface shape:
```
parseGPX(xmlString) → { geojson: GeoJSON.Feature, bbox: [w, s, e, n], totalDistanceKm: number }
```

#### 2. Navigation Engine (new — `js/navigation.js`)
The most critical module. Pure functions only — no DOM, no GPS calls, no Mapbox references. Receives the route's GeoJSON track, the array of POI coordinates, and the user's current GPS position. Returns navigation state.

Key responsibilities:
- Project the user's position onto the nearest point along the track geometry
- Compute along-track distance from projected position to the next POI
- Compute cardinal direction (N, NE, E, SE, S, SW, W, NW) from current position to next POI
- Detect arrival (distance ≤ 50m threshold)
- Compute overall route progress ratio

Interface shape:
```
computeNavState(track, pois, activePOIIndex, userLatLon) → {
  distanceToNextM: number,
  cardinalDir: string,
  arrived: boolean,
  progressRatio: number
}
```

The arrival threshold (50m) and cardinal direction bucket count are sourced from `config.js`.

#### 3. Daily Code Module (new — `js/dailyCode.js`)
Two pure functions: one that generates a 6-character alphanumeric code from today's date and a secret salt, one that validates a user input against it. Session persistence (unlock state) lives in `localStorage` keyed by date so it auto-expires at midnight. The secret salt lives in `config.js` as `DAILY_CODE_SALT`.

#### 4. Tile Cache Manager (new — `js/tileCache.js` + `service-worker.js`)
**Correction to prior assumption:** Mapbox GL JS on the web has no native offline tile API — that exists only in the mobile SDKs. On web we must implement pre-caching ourselves via a Service Worker + the Cache Storage API.

Approach:
- A Service Worker registered at app boot intercepts all requests matching `https://api.mapbox.com/styles/v1/*/tiles/*` and `https://api.mapbox.com/v4/*` and serves cached responses when available.
- `tileCache.js` runs in the page context. Called when "Comença ruta" is tapped after code validation. Given the route's bounding box, it enumerates the tile coordinates at zoom levels 12–16 using slippy-map math (`lon/lat → x/y` mercator projection), then fetches each tile URL. The Service Worker stores them in a named Cache (`sablava-tiles-v1`).
- Runs in the background; navigation starts immediately. A small progress indicator ("Caching map: 47 / 240 tiles") sits in the corner. Caching is idempotent — already-cached tiles short-circuit.
- Cache eviction: on every successful new-route cache, prune tiles older than 7 days to keep storage bounded (target ≤ 50 MB).
- Falls back gracefully if Service Worker registration fails (older iOS Safari): app still works online, just no offline guarantee.

#### 5. Mascot System (new — `js/mascot.js`)
Reads `localStorage` for `{ text, savedAt, lang }` written by the admin panel. If `Date.now() - savedAt < 2h` and text is non-empty, returns the staff text. Otherwise returns a weather-based template string from `i18n.js`, selected by evaluating the worst-case route safety status (No-Go > Caution > Go). Mascot text is language-aware.

#### 6. Weather Safety Engine (extend `js/weather.js`)
Add a `evaluateSafety(windKn, waveM, difficulty)` pure function. Reads thresholds from `config.js` (see structure below). Returns `"go" | "caution" | "no-go"`. Add configurable threshold table to `config.js`:

```js
export const WEATHER_THRESHOLDS = {
  easy:   { go: { wind: 12, wave: 0.5 }, caution: { wind: 18, wave: 0.8 } },
  medium: { go: { wind: 18, wave: 0.8 }, caution: { wind: 25, wave: 1.2 } },
  hard:   { go: { wind: 25, wave: 1.2 }, caution: { wind: 30, wave: 1.8 } }
}
```

#### 7. Navigation Screen (new — `js/screens/navigate.js`)
New router entry: `#/route/:id/navigate`. Mounts a fullscreen Mapbox map, starts GPS watching via `navigator.geolocation.watchPosition`, calls the Navigation Engine on each position update, renders the navigation chip, handles POI arrival events, and triggers the route complete screen on final POI arrival. Calls Tile Cache Manager on mount.

#### 8. Route Complete Screen (new — `js/screens/complete.js`)
New screen (or full-screen overlay). Receives session stats (accumulated distance, elapsed time, POIs visited count). Displays mascot with celebratory message. Renders a shareable summary card (CSS-printable / canvas snapshot). "Back to routes" navigates to `#/routes`.

#### 9. Admin Panel Screen (new — `js/screens/admin.js`)
New router entry: `#/admin`. Password gate using value from `config.js` (`ADMIN_PASSWORD`). Session stored in `localStorage`. Panel contains: today's code (read-only, generated by Daily Code Module), route recommendation radio buttons, mascot text textarea with character limit, save button that writes to `localStorage` with current timestamp.

#### 10. Map Enhancements (extend `js/map.js`)
- Activate Mapbox GL JS using token from `config.js`
- Load GPX route geometries via GPX Loader; render as GeoJSON layers coloured by difficulty
- Add style toggle button (terrain ↔ satellite) using Mapbox `setStyle()`
- Add crosshair button that calls `navigator.geolocation.getCurrentPosition` and flies to result
- In navigation mode: render live position marker, highlight active route segment

#### 11. Config additions (`js/config.js`)
Add: `DAILY_CODE_SALT`, `ADMIN_PASSWORD`, `WEATHER_THRESHOLDS`, `NAV_ARRIVAL_THRESHOLD_M` (default 50), `MAPBOX_TOKEN`, `MAPBOX_TERRAIN_STYLE` (default `mapbox://styles/mapbox/outdoors-v12`), `MAPBOX_SATELLITE_STYLE` (default `mapbox://styles/mapbox/satellite-streets-v12`), `TILE_CACHE_ZOOMS` (default `[12,13,14,15,16]`), `RIVE_INTRO_ASSET_URL`.

#### 12. Rive Hero Animation (new — `js/screens/intro.js` + `assets/rive/sablava-intro.riv`)

A single Rive file orchestrates the entire opening sequence as one state machine. The choreography:

1. **`beach-overview`** — top-down aerial of the sand, water visible in the upper ~20% of frame, gentle wave motion looping.
2. **`logo-reveal`** — Sa Blava logo drawn into the sand (as if finger-traced), 1.5s ease-out.
3. **`pan-up-to-water`** — virtual camera pans upward; sand exits the bottom of frame, the buoy enters from the top. Ends with full water + buoy floating in upper third.
4. **`language-select`** — language picker overlay fades in over the still-animating water. This is HTML (not Rive), positioned absolutely over the canvas; it triggers a Rive boolean input on selection.
5. **`descend-to-horizon`** — camera tilts 90°: top-down view rotates to horizon view. The buoy grows and rotates to face the camera, revealing the mascot's face on the buoy's side.
6. **`final-layout`** — settles into the routes-screen layout: upper 25% is sky + mascot + weather widget, separated from the lower 75% (routes list, rendered as DOM over a "below water" gradient background) by the animated wave line. The wave line continues to animate subtly forever.

Implementation:
- **Runtime:** `@rive-app/canvas` (smaller bundle than the WebGL build; vector quality is identical for our use case).
- **Single state machine** named `IntroFlow` with these inputs:
  - `start` (trigger) — fired on canvas mount
  - `languageSelected` (trigger) — fired by the HTML language picker
  - `skipToFinal` (boolean) — set true on return visits and when `prefers-reduced-motion` is set
- **DOM/Rive handoff:** the mascot, weather widget, and routes list in the final layout are HTML elements — Rive only owns the background canvas (sky, water, wave divider, buoy → mascot anchor). At the end of `final-layout`, Rive exposes a "mascot anchor point" via a Rive listener; the DOM mascot is positioned to that point so the transition from Rive-painted mascot to DOM mascot is invisible. **The Rive mascot character and the DOM mascot must share the same illustration** — design them together, export the mascot SVG from the same source.
- **Skip logic:**
  - First visit (no `localStorage.sablava_introSeen`): play full sequence.
  - Return visits: set `skipToFinal = true`, sequence jumps to `final-layout` in ~200ms.
  - After 1s of playback, show a small "Skip ›" button (top-right). Tapping it sets `skipToFinal = true`.
  - On `prefers-reduced-motion: reduce`, skip directly to `final-layout` with no exception.
- **Preload:** add `<link rel="preload" as="fetch" href="/assets/rive/sablava-intro.riv" crossorigin>` in `index.html`. Show a static fallback splash (logo on sand JPEG) until the .riv file is fetched. Hard timeout at 3s — if .riv isn't ready, render the static `final-layout` and forget the intro.
- **File budget:** ≤ 400 KB compressed. Use Rive's vector primitives over imported raster art. Audit before shipping.
- **Frame rate:** 30 FPS for ambient water; the camera-move keyframes can interpolate at 60 FPS. Test on a 3-year-old mid-range Android before locking the design.
- **Language picker UX during step 4:** the picker is HTML overlay (not Rive) so language strings are easy to update without re-exporting the .riv. Pulls language list from `i18n.js`.

#### 13. Mapbox setup, costs, and token strategy (new operational notes — not a code module)

This section is operational because Mapbox is mostly a service, not code. Treat the following as day-one prerequisites and recurring obligations:

- **Account & token:** create one Mapbox account (the client's, not yours — they own this). Generate a **public token** (`pk.*`), and in the token settings:
  - Restrict by URL to the deployed domain (e.g. `https://sablava.com/*`). This is the primary defense against bill-running abuse if the token leaks.
  - Scopes needed: `styles:read`, `fonts:read`, `tiles:read`. Nothing else.
  - **Never** put a secret token (`sk.*`) in client code. If a build process requires one, gate it behind a server.
- **Costs (Mapbox pricing as of writing — verify on signup):**
  - Map loads (each Mapbox GL JS `new mapboxgl.Map()` call): free tier covers 50,000 loads/month.
  - Tile requests: separate free tier, generous.
  - With ~100 customers/day × 1 nav session = ~3,000 loads/month → comfortably free. Two safeguards: URL-restricted token (above), and a `mapboxgl.Map` instance reused across screen transitions instead of re-instantiated.
- **Styles:**
  - Terrain default: `mapbox://styles/mapbox/outdoors-v12` (shows trails, terrain shading; good for kayak coastal context).
  - Satellite toggle: `mapbox://styles/mapbox/satellite-streets-v12` (satellite imagery + minimal labels).
  - Both are stock Mapbox styles — no custom Studio work required for v1. Custom styling is a Phase 3 nice-to-have.
- **Tile pre-caching math:** at zoom 16, a single 1 km² area is roughly 16 tiles. A typical kayak route covers ~3 km of coastline × 500 m corridor = ~24 tiles at z16, plus ~30 at z12-15. Budget ~250 tiles per route, ~50 KB each → ~12 MB cached per route. Stay under 50 MB total Cache Storage.
- **Geolocation accuracy on the water:** open sea has excellent GPS sky view, so `enableHighAccuracy: true` is fine. Set `timeout: 10000`, `maximumAge: 0`. iOS Safari throttles `watchPosition` heavily when the tab is backgrounded — assume the user keeps the screen on (see Performance section).
- **Failure modes to handle in code:**
  - Permission denied → show a banner explaining nav requires GPS, fall back to map-only view.
  - Position fix lost > 30s → chip turns grey, "Waiting for GPS…" text.
  - Token rejected (server returns 401) → show a clear "Service temporarily unavailable, contact staff" message rather than a broken map.

### Router additions (`js/router.js`)
- `#/route/:id/navigate` → NavigationScreen
- `#/admin` → AdminScreen
- `#/route/:id/complete` → RouteCompleteScreen

### Data additions (`js/data.js`)
- Add `gpxFile` field to each route pointing to the bundled static GPX asset path
- Add `difficulty` field normalised to `"easy" | "medium" | "hard"` for threshold lookup

---

## Performance, Permissions & PWA

These cross-cutting concerns are not modules but must be designed in from day one. They are the difference between an app that demos well and one that survives 90 minutes on the water.

- **Wake lock:** on the Navigation Screen, request a screen wake lock via the [Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API). Re-acquire on `visibilitychange`. Without this, the screen sleeps mid-route and GPS tracking pauses on iOS.
- **Battery budget:** `watchPosition` at high accuracy + active Mapbox canvas + wake lock will drain ~25–35% of a modern phone over a 90-min route. Document this for staff so they advise customers to start with ≥ 70% battery.
- **Geolocation permission flow:**
  - Request permission only at the moment the user taps "Comença ruta" (not at app boot — that kills trust).
  - If denied: show a non-blocking banner with instructions to enable Location in browser settings, and keep the map view available without live tracking.
  - If lost mid-route: chip degrades to "Waiting for GPS…" rather than crashing.
- **PWA / install:** ship a `manifest.webmanifest` so customers can "Add to Home Screen". This also enables the Service Worker (tile cache) without a noticeable cold start.
- **iOS Safari quirks:** `watchPosition` stops firing when the tab is backgrounded or the device locks. The wake lock and the "screen on" recommendation cover most cases; if the user truly backgrounds the app, the chip will still be correct on return because the engine is pure-functional and recomputes from the latest fix.
- **Asset preloading:** `<link rel="preload">` for the Rive .riv file, the Mapbox CSS, and the mascot SVG. The intro should never block on a blocking script tag.

---

## Technical Risks & Open Questions

These are unknowns to resolve before or during early implementation — explicit list so nothing surprises us in week 4.

1. **Mascot illustration parity** — the Rive mascot and the DOM mascot must look identical at the handoff frame. Who designs the mascot — same artist for both? If different, the handoff will snap visibly. **Action:** lock the mascot SVG source first, import into Rive, never diverge.
2. **GPX accuracy near cliffs and caves** — the route source is caiacdemar.com; we have not verified the GPX tracks are accurate enough that "50 m arrival" feels right. **Action:** during the day-on-the-water test, walk through each route's POI list and tune the arrival threshold per route if needed (`pois[i].arrivalRadius` override).
3. **Service Worker on iOS** — older iOS versions (< 15) have known SW bugs. **Action:** confirm minimum supported iOS during the client conversation. If they need iOS 14, the offline tile guarantee weakens to "best effort".
4. **Mapbox token leak** — even with URL restriction, the token is visible in the JS bundle. URL restriction is the defense; document the monitoring plan (Mapbox dashboard, alert at 80% of free tier).
5. **Rive file too heavy** — until the artist exports a first pass, the 400 KB budget is a guess. **Action:** define a hard fallback path (static intro JPG + CSS transition to final layout) so a missed budget doesn't block ship.
6. **Daily code distribution** — what happens when a customer arrives at 10 AM and another at 4 PM? Same code? **Confirmed in PRD:** yes, one code per calendar day. Verify with client this is how they want it (vs. per-session codes which would require staff entering each rental into the panel).

---

## Testing Decisions

Good tests for this project test behaviour at module boundaries — they call the module's exported functions with realistic inputs and assert on outputs. They do not test DOM rendering, internal variable names, or Mapbox internals.

### Modules to test

**Navigation Engine** — highest priority. Pure functions with no dependencies make it perfectly testable. Tests should cover:
- Distance calculation between two GPS coordinates
- Along-track projection of a point onto a LineString
- Cardinal direction calculation for all 8 directions
- Arrival detection at exactly 50m, 49m, and 51m
- Progress ratio at start (0), mid-route, and final POI

**Daily Code Module** — second priority. Tests should cover:
- Same date + same salt always produces the same code
- Different dates produce different codes
- Valid code returns true, off-by-one character returns false
- Midnight boundary (code changes at 00:00)

**GPX Loader** — tests should cover:
- Parsing a minimal valid GPX file produces correct GeoJSON coordinates
- Bounding box is computed correctly from coordinate extremes
- Total distance is approximately correct for a known segment

**Mascot System** — tests should cover:
- Staff text within 2h is returned as-is
- Staff text older than 2h returns a weather template
- Missing staff text returns a weather template
- Template selection matches worst-case route safety (No-Go overrides Go)

**Weather Safety Engine** — tests should cover:
- Wind and wave below Go threshold → "go"
- Wind above Go, wave below → "caution"
- Both above Caution threshold → "no-go"
- Thresholds are read from config (not hardcoded in the function)

**Rive intro and Mapbox tile cache** — explicitly not unit-tested. Both are integration concerns with side effects (canvas, network, Cache Storage). Validate via manual QA on a real phone outdoors. Define a written test script: first-visit intro plays, return-visit skips, reduced-motion skips, language persists, tiles available offline (airplane mode test after caching).

---

## Out of Scope

- **Backend / server-side storage** — all state lives in `localStorage`. No database, no API server.
- **User accounts or persistent history** — no registration, no trip history across sessions.
- **Dark mode** — explicitly excluded; contradicts the design principle of high-contrast outdoor legibility.
- **Route filters** — 3 routes do not warrant a filter UI. Revisit if routes expand to 8+.
- **Audio guide** — Phase 1 hooks exist; implementation deferred to Phase 3.
- **Real-time multi-user tracking** — no "see other kayakers on the map" feature.
- **Turn-by-turn voice navigation** — the cardinal direction chip covers the use case without requiring the Web Speech API.
- **Activity log / analytics** — `localStorage` is unreliable across browsers/devices for this. Deferred to a proper backend phase.
- **Weather threshold editor in admin panel** — thresholds change rarely; `config.js` is sufficient for Phase 2. Admin panel stays focused on daily operations.

---

## Further Notes

- **GPX files** — one file exists (`Platja-d_Aiguablava---Aigua-Xelida-costejant-semidirecta`). Two more must be downloaded from caiacdemar.com for the Penya-segats and Familiar routes before the Navigation Screen can be completed for all routes.
- **Mapbox token** — must be obtained from mapbox.com (free tier) and added to `config.js` before any map work can be tested or deployed. This is a day-one prerequisite.
- **Daily code security** — the HMAC-based daily code is not cryptographically bulletproof (salt lives in client-side JS). It is appropriate for a kayak rental business model, not for sensitive data. The goal is a low-friction rental perk, not a paywall.
- **Mascot character** — the emoji weather face already present on the routes screen. Its speech bubble appears on: (1) the routes screen as the daily conditions summary, and (2) the route complete screen as a celebratory message. These are the only two locations — not per-route, not during navigation.
- **Share card on route complete** — implement as a CSS-styled div that looks good in a screenshot. Avoid canvas/html2canvas complexity unless native sharing via the Web Share API is insufficient.
- **caiacdemar.com** — the source site for GPX route data. The GPX format contains only dense track coordinates; named waypoints are not embedded. POI coordinates continue to come from `data.js`.
- **The buoy ("boya")** — in English this is a *buoy* (specifically a swim-area marker buoy in this context). It's the central visual hook of the hero: a real-looking floating buoy in the top-down water shot that, when the camera tilts to horizon view, anthropomorphizes into the mascot's face. Treat the buoy and the mascot as the same character at different camera angles — not two separate illustrations.
- **Rive tooling** — designs are exported from the Rive editor (rive.app). The animator works in Rive, exports a `.riv` file with one state machine named `IntroFlow`. The developer integrates via `@rive-app/canvas`. If you don't yet have a Rive animator, Phase 2 can ship with a CSS/JS fallback intro and the Rive intro can land as a Phase 2.1 polish drop without changing any other module.
- **i18n storage** — all UI strings, mascot fallback templates, and language picker labels live in `i18n.js` as a flat object keyed by `lang.key`. No external translation service for Phase 2. Selected language persists in `localStorage.sablava_lang`.
- **Mapbox monitoring** — set up a billing alert in the Mapbox dashboard at 80% of the free tier. The dashboard also shows real-time map load counts, useful in week one to confirm usage matches the model (~100/day).

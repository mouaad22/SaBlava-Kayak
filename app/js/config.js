// Drop a Mapbox public token here when ready. Without it the app falls back
// to a hand-drawn nautical-chart SVG (intentional, not just a placeholder).
// Public token, URL-restricted in the Mapbox dashboard to routes.sablavakayaks.com,
// *.pages.dev, and localhost:5173. Safe to ship in client code (pk. = public).
export const MAPBOX_TOKEN = "pk.eyJ1IjoibW91YWFkMjIiLCJhIjoiY21xOGoxNjJoMDkwMzJyczhvcGE3cXhociJ9.ja_qMm4VL9HeVlzA0yIvkg";

export const MAPBOX_STYLE = "mapbox://styles/mouaad22/cmped7edg001m01sjav2f5b88";
export const MAPBOX_SATELLITE_STYLE = "mapbox://styles/mapbox/satellite-streets-v12";

// Aiguablava marina, Costa Brava
export const AIGUABLAVA_CENTER = [3.2167, 41.9333];

export const EMERGENCY_PHONE = {
  label: "Salvament Marítim",
  number: "900 202 202",
};

// ─── Phase 2: Navigation ──────────────────────────────────────────────────────

// Average kayak paddling speed used for ETA estimates in route summary.
export const KAYAK_SPEED_KMH = 3.5;

// Mapbox tile zoom levels to pre-cache for offline navigation.
export const TILE_CACHE_ZOOM_MIN = 12;
export const TILE_CACHE_ZOOM_MAX = 16;

// Minutes-before-end at which to fire voice + visual overtime warnings.
// Values are minutes remaining; 0 = time's up.
export const OVERTIME_WARNINGS_MIN = [30, 15, 5, 0];

// Metres radius within which a POI is considered "arrived".
export const NAV_ARRIVAL_THRESHOLD_M = 50;

// ─── Phase 2.1: Navigation hardening tuning constants ─────────────────────────
// Single source of truth for the on-water reliability fixes (docs/nav-hardening.json).
// Kept here so each hardening session reads them and never re-touches this file.

// GPS fixes with accuracy worse than this (metres) are dropped — a 200 m fix
// would otherwise jump the marker and falsely "arrive" at a POI.
export const GPS_MAX_ACCURACY_M = 35;
// How long to wait for the first usable fix before showing the timeout state.
export const GPS_ACQUIRE_TIMEOUT_MS = 15_000;
// If every fix stays over GPS_MAX_ACCURACY_M for this long, surface "weak signal".
export const GPS_STALE_FIX_MS = 8_000;

// A POI counts as reached only after this many consecutive accepted fixes
// inside NAV_ARRIVAL_THRESHOLD_M (debounces a single drifted fix). [session-2]
export const ARRIVAL_DEBOUNCE_FIXES = 2;
// How much closer to a later POI (metres) before an earlier one is marked passed,
// so a skipped / GPS-drifted POI never jams the arrival chain. [session-2]
export const ARRIVAL_SKIP_MARGIN_M = 80;
// Require remaining_time >= eta_back * this ratio before a trip is "safe". [session-2]
export const RETURN_SAFETY_MARGIN_RATIO = 1.15;

// On resume from background, only re-announce a missed time-warning if it
// crossed within this window — avoids dumping a backlog of stale alerts. [session-3]
export const ALERT_RESUME_GRACE_MS = 60_000;

// A fix whose perpendicular distance from the route track exceeds this (metres)
// is treated as "off-route" and does NOT drive arrival/turnaround/progress — it
// is precise but in the wrong place (e.g. testing from the city, or a stray
// fix), so the huge distance home must not read as "out of time" and instantly
// false-complete the trip. Generous vs. the coastal track so a real paddler in
// a wide bay is never suppressed. [session-5]
export const NAV_OFFROUTE_THRESHOLD_M = 1500;

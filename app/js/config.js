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

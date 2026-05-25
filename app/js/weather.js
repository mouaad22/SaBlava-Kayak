// Weather data layer for Sa Blava.
//
// Pulls from Open-Meteo (free, no key, no signup):
//   - Forecast API: wind, temp, UV, sunset, hourly wind
//   - Marine API: wave height/direction/period, hourly wave height
//
// Cached in localStorage for 30 min; treated as stale after 2h. On fetch
// failure, falls back to last cached payload with an `offline` flag so the
// UI can show "showing last reading".

import { AIGUABLAVA_CENTER } from "./config.js";

const CACHE_KEY = "sa-blava.weather.v1";
const CACHE_TTL = 30 * 60 * 1000; // 30 min
const STALE_MAX = 2 * 60 * 60 * 1000; // 2 h

const [LON, LAT] = AIGUABLAVA_CENTER;

async function fetchOpenMeteo() {
  const forecastUrl =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${LAT}&longitude=${LON}` +
    `&current=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,is_day` +
    `&hourly=wind_speed_10m,wind_direction_10m,temperature_2m` +
    `&daily=sunset` +
    `&timezone=auto&windspeed_unit=kn&forecast_days=1`;

  const marineUrl =
    `https://marine-api.open-meteo.com/v1/marine` +
    `?latitude=${LAT}&longitude=${LON}` +
    `&current=wave_height,wave_direction,wave_period,sea_surface_temperature` +
    `&hourly=wave_height` +
    `&timezone=auto&forecast_days=1`;

  const [forecastRes, marineRes] = await Promise.all([
    fetch(forecastUrl),
    fetch(marineUrl),
  ]);
  if (!forecastRes.ok) throw new Error("forecast http " + forecastRes.status);
  if (!marineRes.ok) throw new Error("marine http " + marineRes.status);
  const [f, m] = await Promise.all([forecastRes.json(), marineRes.json()]);

  return {
    fetchedAt: Date.now(),
    wind: {
      speed: round(f.current?.wind_speed_10m, 0),
      gusts: round(f.current?.wind_gusts_10m, 0),
      direction: f.current?.wind_direction_10m,
      cardinal: cardinalDirection(f.current?.wind_direction_10m),
      named: namedWind(f.current?.wind_direction_10m),
      strength: windStrength(f.current?.wind_speed_10m),
      hourly: f.hourly?.wind_speed_10m || [],
      hourlyTimes: f.hourly?.time || [],
    },
    wave: {
      height: round(m.current?.wave_height, 1),
      direction: m.current?.wave_direction,
      period: round(m.current?.wave_period, 1),
      seaTemp: round(m.current?.sea_surface_temperature, 0),
      hourly: m.hourly?.wave_height || [],
    },
    air: {
      temp: round(f.current?.temperature_2m, 0),
      uv: round(f.current?.uv_index, 0),
      isDay: !!f.current?.is_day,
    },
    sunset: f.daily?.sunset?.[0] || null,
  };
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.fetchedAt) return null;
    if (Date.now() - data.fetchedAt > STALE_MAX) return null;
    return data;
  } catch {
    return null;
  }
}

function saveCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {}
}

// Returns { data, cached, offline? }. Throws only if no cache + fetch fails.
export async function getWeather({ force = false } = {}) {
  const cached = loadCache();
  if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return { data: cached, cached: true };
  }
  try {
    const fresh = await fetchOpenMeteo();
    saveCache(fresh);
    return { data: fresh, cached: false };
  } catch (err) {
    if (cached) return { data: cached, cached: true, offline: true };
    throw err;
  }
}

export function cardinalDirection(deg) {
  if (typeof deg !== "number" || isNaN(deg)) return "—";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

// Costa Brava / Empordà local wind names. Always returns a name based on
// direction alone — intensity is a separate concern handled by windStrength().
// Full 8-sector compass: xaloc (SE) and mestral (NW) fill the previously
// missing sectors so every direction resolves to a local name.
export function namedWind(deg) {
  if (typeof deg !== "number" || isNaN(deg)) return null;
  if (deg >= 337.5 || deg < 22.5) return "tramuntana"; // N — locally feared
  if (deg >= 22.5 && deg < 67.5) return "gregal";      // NE — brings swell
  if (deg >= 67.5 && deg < 112.5) return "llevant";    // E — brings swell
  if (deg >= 112.5 && deg < 157.5) return "xaloc";     // SE
  if (deg >= 157.5 && deg < 202.5) return "migjorn";   // S
  if (deg >= 202.5 && deg < 247.5) return "garbí";     // SW — afternoon thermal
  if (deg >= 247.5 && deg < 292.5) return "ponent";    // W
  if (deg >= 292.5 && deg < 337.5) return "mestral";   // NW
  return null;
}

// Speed tier in knots — mirrors the speedTiers defined in
// docs/aiguablava-winds.json (the authoritative source for all copy and
// design decisions on this project). Keep thresholds in sync with that file.
//   suau     — 0–4 kn
//   moderat  — 5–11 kn
//   fort     — 12–17 kn
//   moltFort — ≥18 kn  (also triggers safetyOverride in the banner)
export function windStrength(speed) {
  if (typeof speed !== "number" || isNaN(speed) || speed < 5) return "suau";
  if (speed < 12) return "moderat";
  if (speed < 18) return "fort";
  return "moltFort";
}

// Decide GO / CAUTION / NO-GO for a given route given current weather.
// route.conditions = { wind: {ok, caution}, wave: {ok, caution} } in kn / m.
export function statusForRoute(route, weather) {
  const wind = weather?.wind?.speed ?? 0;
  const wave = weather?.wave?.height ?? 0;
  const c = route.conditions;
  if (!c) return "go";

  // Treat the local "tramuntana" name as a hard caution flag at any speed
  // above ~12 kn — it's notoriously gusty even when the average looks tame.
  const tramuntanaSpike =
    weather?.wind?.named === "tramuntana" && wind >= 12;

  if (
    wind > c.wind.caution ||
    wave > c.wave.caution ||
    (tramuntanaSpike && c.wind.ok < 12)
  ) {
    return "no-go";
  }
  if (wind > c.wind.ok || wave > c.wave.ok || tramuntanaSpike) {
    return "caution";
  }
  return "go";
}

export function relativeAge(fetchedAt) {
  if (!fetchedAt) return null;
  const mins = Math.max(0, Math.round((Date.now() - fetchedAt) / 60000));
  return mins;
}

function round(n, decimals = 0) {
  if (typeof n !== "number" || isNaN(n)) return null;
  const p = Math.pow(10, decimals);
  return Math.round(n * p) / p;
}

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

// Per-factor traffic-light verdict — "green" | "coral" | "red" — for the weather
// overlay's wind-arrow tint and swell dot. Thresholds mirror the combined
// verdict in conditionsSummary() below, so a single rough factor here reads the
// same colour it contributes to the summary line. Keep the two in sync.
export function windVerdict(speed) {
  if (typeof speed !== "number") return "green";
  if (speed > 18) return "red";
  if (speed > 12) return "coral";
  return "green";
}

export function waveVerdict(height) {
  if (typeof height !== "number") return "green";
  if (height > 0.8) return "red";
  if (height > 0.5) return "coral";
  return "green";
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

// ─── Wind banner data ────────────────────────────────────────────────────────
// Mirrors docs/wind-simple.json. Given a weather payload and a language code,
// returns everything needed to render the Vent panel banner:
//   speedKmh      — speed converted from knots for display
//   cardinalLetter — N / NE / E / … (null when calm)
//   windName      — local wind name e.g. "Tramuntana" (null when unknown)
//   tier          — suau | moderat | fort | moltFort
//   tierLabel     — localised full label e.g. "Vent suau" / "Vent molt fort"
//   tierCss       — BEM modifier e.g. "wind-tag--suau"
//   recommendation — localised sentence
//   flourish      — localised flavour sentence (may be null)
//   isCalm        — true when speed < 1 km/h
//   isSafetyOverride — true when speed ≥ 38 km/h

const _CALM = {
  tierLabel:     { ca: "Mar de mirall",       es: "Mar de espejo",          en: "Mirror sea",                  fr: "Mer d'huile" },
  recommendation:{ ca: "Qualsevol ruta és bona opció.", es: "Cualquier ruta es una buena opción.", en: "Any route is a good choice.", fr: "N'importe quel itinéraire est une bonne option." },
  flourish:      { ca: "Dia rar a Aiguablava.",          es: "Día raro en Aiguablava.",              en: "Rare day at Aiguablava.",      fr: "Journée rare à Aiguablava." },
};

const _SAFETY = {
  recommendation:{ ca: "Condicions massa fortes per sortir avui.", es: "Condiciones demasiado fuertes para salir hoy.", en: "Conditions too strong to paddle today.", fr: "Conditions trop fortes pour sortir aujourd'hui." },
  flourish:      { ca: "Millor esperar.", es: "Mejor esperar.", en: "Better to wait.", fr: "Mieux vaut attendre." },
};

const _TIERS_M = {
  suau:     { ca: "suau",      es: "suave",     en: "gentle",      fr: "léger" },
  moderat:  { ca: "moderat",   es: "moderado",  en: "moderate",    fr: "modéré" },
  fort:     { ca: "fort",      es: "fuerte",    en: "strong",      fr: "fort" },
  moltFort: { ca: "molt fort", es: "muy fuerte",en: "very strong", fr: "très fort" },
};

const _TIERS_F = {
  suau:     { ca: "suau",       es: "suave",      en: "gentle",      fr: "légère" },
  moderat:  { ca: "moderada",   es: "moderada",   en: "moderate",    fr: "modérée" },
  fort:     { ca: "forta",      es: "fuerte",     en: "strong",      fr: "forte" },
  moltFort: { ca: "molt forta", es: "muy fuerte", en: "very strong", fr: "très forte" },
};

const _WINDS = {
  tramuntana: { name: "Tramuntana", gender: "f",
    recommendation: { ca: "Ruta nord recomanada.",                  es: "Ruta norte recomendada.",             en: "North route recommended.",             fr: "Itinéraire nord recommandé." },
    flourish:       { ca: "El vent t'empeny mar endins, no t'allunyis.", es: "El viento te empuja mar adentro, no te alejes.", en: "The wind pushes you out to sea, stay close.", fr: "Le vent te pousse vers le large, ne t'éloigne pas." } },
  gregal: { name: "Gregal", gender: "m",
    recommendation: { ca: "Ruta nord recomanada.",                  es: "Ruta norte recomendada.",             en: "North route recommended.",             fr: "Itinéraire nord recommandé." },
    flourish:       { ca: "Aixeca onatge a l'entrada de la cala.",  es: "Levanta oleaje en la entrada de la cala.", en: "Builds waves at the cove entrance.", fr: "Lève la houle à l'entrée de la crique." } },
  llevant: { name: "Llevant", gender: "m",
    recommendation: { ca: "Qualsevol ruta, queda't a prop de la costa.", es: "Cualquier ruta, quédate cerca de la costa.", en: "Either route, stay close to the shore.", fr: "N'importe quel itinéraire, reste près de la côte." },
    flourish:       { ca: "El vent de mar entra directament a la cala.", es: "El viento de mar entra directamente en la cala.", en: "The sea breeze blows straight into the cove.", fr: "Le vent de mer entre directement dans la crique." } },
  xaloc: { name: "Xaloc", gender: "m",
    recommendation: { ca: "Ruta sud recomanada.",                   es: "Ruta sur recomendada.",               en: "South route recommended.",             fr: "Itinéraire sud recommandé." },
    flourish:       { ca: "Càlid i humit, porta aigua.",             es: "Cálido y húmedo, lleva agua.",        en: "Warm and humid, bring water.",          fr: "Chaud et humide, prends de l'eau." } },
  migjorn: { name: "Migjorn", gender: "m",
    recommendation: { ca: "Ruta sud recomanada.",                   es: "Ruta sur recomendada.",               en: "South route recommended.",             fr: "Itinéraire sud recommandé." },
    flourish:       { ca: "Et porta de tornada a la platja.",        es: "Te lleva de vuelta a la playa.",      en: "Carries you back to the beach.",        fr: "Il te ramène jusqu'à la plage." } },
  "garbí": { name: "Garbí", gender: "m",
    recommendation: { ca: "Ruta sud recomanada.",                   es: "Ruta sur recomendada.",               en: "South route recommended.",             fr: "Itinéraire sud recommandé." },
    flourish:       { ca: "Brisa de tarda, surt al matí si vols tranquil·litat.", es: "Brisa de tarde, sal por la mañana si quieres tranquilidad.", en: "Afternoon breeze, paddle in the morning for calmer water.", fr: "Brise d'après-midi, sors le matin pour une eau plus calme." } },
  ponent: { name: "Ponent", gender: "m",
    recommendation: { ca: "Ruta sud, queda't a prop de la costa.",  es: "Ruta sur, quédate cerca de la costa.", en: "South route, stay close to the shore.", fr: "Itinéraire sud, reste près de la côte." },
    flourish:       { ca: "Sembla un mirall, però t'empeny mar endins.", es: "Parece un espejo, pero te empuja mar adentro.", en: "Looks like a mirror, but pushes you out to sea.", fr: "Ressemble à un miroir, mais te pousse vers le large." } },
  mestral: { name: "Mestral", gender: "m",
    recommendation: { ca: "Ruta nord recomanada.",                  es: "Ruta norte recomendada.",             en: "North route recommended.",             fr: "Itinéraire nord recommandé." },
    flourish:       { ca: "Sec i ratxejat, imprevisible fora de la cala.", es: "Seco y racheado, impredecible fuera de la cala.", en: "Dry and gusty, unpredictable outside the cove.", fr: "Sec et rafaleux, imprévisible hors de la crique." } },
};

function _pick(obj, lang) {
  return obj?.[lang] ?? obj?.ca ?? "";
}

export function windBannerData(weather, lang = "ca") {
  const speedKn  = typeof weather?.wind?.speed === "number" ? weather.wind.speed : 0;
  const speedKmh = Math.round(speedKn * 1.852);
  const named    = weather?.wind?.named;   // e.g. "tramuntana"
  const cardinal = weather?.wind?.cardinal; // e.g. "N"
  const wind     = _WINDS[named] ?? null;

  // 1. Calm — speed < 1 km/h, Rive rose at rest
  if (speedKmh < 1) {
    return {
      isCalm: true, isSafetyOverride: false,
      speedKmh, cardinalLetter: null, windName: null,
      tier: "suau", tierLabel: _pick(_CALM.tierLabel, lang),
      tierCss: "wind-tag--suau",
      recommendation: _pick(_CALM.recommendation, lang),
      flourish:        _pick(_CALM.flourish, lang),
    };
  }

  // 2. Safety override — speed ≥ 38 km/h, any direction
  if (speedKmh >= 38) {
    const isFem  = wind?.gender === "f";
    const adjective = _pick(isFem ? _TIERS_F.moltFort : _TIERS_M.moltFort, lang);
    return {
      isCalm: false, isSafetyOverride: true,
      speedKmh, cardinalLetter: cardinal, windName: wind?.name ?? null,
      tier: "moltFort", tierLabel: `Vent ${adjective}`,
      tierCss: "wind-tag--molt-fort",
      recommendation: _pick(_SAFETY.recommendation, lang),
      flourish:        _pick(_SAFETY.flourish, lang),
    };
  }

  // 3. Normal — per-wind copy + tier colour
  const tier = speedKmh < 12 ? "suau" : speedKmh < 28 ? "moderat" : "fort";
  const isFem = wind?.gender === "f";
  const adjective = _pick(isFem ? _TIERS_F[tier] : _TIERS_M[tier], lang);
  const tierCss   = tier === "suau" ? "wind-tag--suau"
                  : tier === "moderat" ? "wind-tag--moderat"
                  : "wind-tag--fort";

  return {
    isCalm: false, isSafetyOverride: false,
    speedKmh, cardinalLetter: cardinal, windName: wind?.name ?? null,
    tier, tierLabel: `Vent ${adjective}`,
    tierCss,
    recommendation: wind ? _pick(wind.recommendation, lang) : "",
    flourish:       wind ? _pick(wind.flourish, lang) : null,
  };
}

// ─── Conditions summary line ─────────────────────────────────────────────────
// One short "good to go / not" verdict for the language screen, sitting between
// the hero image and the details button. It's a template system, not one
// string: lead with the verdict, ride a single live number behind it, then one
// short reason. Three states map to the traffic-light tokens:
//   green → --color-sage   coral → --color-accent   red → --color-emergency
// Tone rule: green & coral stay warm and friendly; red is plain and firm —
// state the condition and the recommendation, nothing playful.
//
// Verdict rule (worst factor wins), grounded in the route conditions in data.js
// and the windStrength tiers above. Wind in knots, wave in metres:
//   green  — wind ≤ 12 kn AND wave ≤ 0.5 m
//   coral  — wind 12–18 kn OR wave 0.5–0.8 m, or a tramuntana gust ≥ 12 kn
//   red    — wind > 18 kn OR wave > 0.8 m
//
// Variants are condition-mapped (never random) so the copy always names the
// real driver; the trust anchor follows the same driver — wind km/h on wind
// days, wave height on swell days.

const _SUMMARY = {
  green: {
    // Dead calm: barely any wind, glassy sea.
    calm: {
      verdict: { ca: "Mar en calma",          es: "Mar en calma",            en: "Calm sea",            fr: "Mer calme" },
      reason:  { ca: "Dia ideal per remar.",   es: "Día ideal para remar.",   en: "A perfect day to paddle.", fr: "Journée idéale pour pagayer." },
    },
    // Light breeze over a flat sea.
    light: {
      verdict: { ca: "Vent fluix i mar plana", es: "Viento flojo y mar llana", en: "Light wind, flat sea", fr: "Vent faible, mer plate" },
      reason:  { ca: "Perfecte per sortir.",   es: "Perfecto para salir.",     en: "Perfect for heading out.", fr: "Parfait pour sortir." },
    },
    // Everything's fine but nothing notable to call out.
    generic: {
      verdict: { ca: "Tot a punt",             es: "Todo listo",               en: "All set",              fr: "Tout est prêt" },
      reason:  { ca: "Bon dia per remar.",     es: "Buen día para remar.",     en: "A good day to paddle.", fr: "Belle journée pour pagayer." },
    },
  },
  coral: {
    // Wind is the limiting factor.
    wind: {
      verdict: { ca: "Una mica de vent",       es: "Algo de viento",           en: "A bit of wind",        fr: "Un peu de vent" },
      reason:  { ca: "Vés amb compte si surts.", es: "Ve con cuidado si sales.", en: "Take care if you head out.", fr: "Sois prudent si tu sors." },
    },
    // Swell is the limiting factor.
    wave: {
      verdict: { ca: "Mar moguda",             es: "Mar movida",               en: "Choppy sea",           fr: "Mer un peu agitée" },
      reason:  { ca: "Recomanat només per a experts.", es: "Recomendado solo para expertos.", en: "Recommended for experts only.", fr: "Recommandé aux experts seulement." },
    },
    // Both wind and swell are nudging the limits.
    both: {
      verdict: { ca: "Condicions justes",      es: "Condiciones justas",       en: "Marginal conditions",  fr: "Conditions limites" },
      reason:  { ca: "Millor no allunyar-se de la costa.", es: "Mejor no alejarse de la costa.", en: "Best to stay close to shore.", fr: "Mieux vaut rester près de la côte." },
    },
  },
  red: {
    // Plain and firm — no personality here.
    wind: {
      verdict: { ca: "Vent fort",              es: "Viento fuerte",            en: "Strong wind",          fr: "Vent fort" },
      reason:  { ca: "No es recomana remar.",  es: "No se recomienda remar.",  en: "Paddling is not recommended.", fr: "Il est déconseillé de pagayer." },
    },
    wave: {
      verdict: { ca: "Mar agitada",            es: "Mar agitada",              en: "Rough sea",            fr: "Mer agitée" },
      reason:  { ca: "Avui millor no sortir amb caiac.", es: "Hoy mejor no salir en kayak.", en: "Better not to kayak today.", fr: "Mieux vaut ne pas sortir en kayak aujourd'hui." },
    },
  },
};

const _ANCHOR_WAVE = { ca: "onatge", es: "oleaje", en: "swell", fr: "houle" };

export const SUMMARY_VERDICTS = ["green", "coral", "red"];

// Format a wave height (m) for display: one decimal, locale separator.
function _formatWave(m, lang) {
  const s = (Math.round(m * 10) / 10).toFixed(1);
  return lang === "en" ? s : s.replace(".", ",");
}

// Loose lang pick: accepts a plain string (same in every language) or a
// per-language map. Lets the future control panel store either form.
function _pickLoose(val, lang) {
  if (typeof val === "string") return val.trim();
  if (val && typeof val === "object") return _pick(val, lang).trim();
  return "";
}

// ── Manual-override seam for the future employee control panel ────────────────
// Mirrors the wave-state override: staff will pin a hand-written verdict + line
// from a control panel; that choice flows through `conditionsSummary(..., override)`
// and wins over the live computation. Today the override is read from
// localStorage so the seam is already wired — swap `getSummaryOverride()` for a
// backend/config read when the panel ships.
//
// Override shape (all text fields accept a plain string or a {ca,es,en,fr} map):
//   { verdict: "green"|"coral"|"red",   // required — drives the traffic light
//     verdict_text: "...",              // required — the lead phrase
//     reason_text:  "...",              // optional — the short reason
//     anchor:       "..." }             // optional — grounding figure, "" hides it
//
// Returns the same shape as the auto path (with source:"manual"), or null when
// the override is absent/invalid so the caller falls back to the live verdict.
export function resolveSummaryOverride(override, lang = "ca") {
  if (!override || typeof override !== "object") return null;
  if (!SUMMARY_VERDICTS.includes(override.verdict)) return null;
  const verdictText = _pickLoose(override.verdict_text, lang);
  if (!verdictText) return null;
  return {
    verdict: override.verdict,
    verdictText,
    reasonText: _pickLoose(override.reason_text, lang),
    anchor: typeof override.anchor === "string" ? override.anchor : _pickLoose(override.anchor, lang),
    source: "manual",
  };
}

const SUMMARY_OVERRIDE_KEY = "sa-blava.summary.override";

export function getSummaryOverride() {
  try {
    const raw = localStorage.getItem(SUMMARY_OVERRIDE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Returns { verdict: "green"|"coral"|"red", verdictText, reasonText, anchor, source }.
// `anchor` is the grounding micro-figure (e.g. "8 km/h" or "0,8 m onatge").
// `source` is "manual" when an employee override wins, else "auto".
// Pass `override` (or null/undefined for the live computation).
export function conditionsSummary(weather, lang = "ca", override = null) {
  const manual = resolveSummaryOverride(override, lang);
  if (manual) return manual;

  const wind = typeof weather?.wind?.speed === "number" ? weather.wind.speed : 0; // kn
  const wave = typeof weather?.wave?.height === "number" ? weather.wave.height : 0; // m
  const speedKmh = Math.round(wind * 1.852);
  const tramuntanaSpike = weather?.wind?.named === "tramuntana" && wind >= 12;

  let verdict, variant, driver;
  if (wind > 18 || wave > 0.8) {
    verdict = "red";
    driver = wind > 18 ? "wind" : "wave";
    variant = driver;
  } else if (wind > 12 || wave > 0.5 || tramuntanaSpike) {
    verdict = "coral";
    const windDriven = wind > 12 || tramuntanaSpike;
    const waveDriven = wave > 0.5;
    if (windDriven && waveDriven) { variant = "both"; driver = "wind"; }
    else if (waveDriven)          { variant = "wave"; driver = "wave"; }
    else                          { variant = "wind"; driver = "wind"; }
  } else {
    verdict = "green";
    driver = "wind";
    if (wind < 5 && wave <= 0.3) variant = "calm";
    else if (wind >= 5)          variant = "light";
    else                         variant = "generic";
  }

  const node = _SUMMARY[verdict][variant];
  const anchor = driver === "wave"
    ? `${_formatWave(wave, lang)} m ${_pick(_ANCHOR_WAVE, lang)}`
    : `${speedKmh} km/h`;

  return {
    verdict,
    verdictText: _pick(node.verdict, lang),
    reasonText:  _pick(node.reason, lang),
    anchor,
    source: "auto",
  };
}

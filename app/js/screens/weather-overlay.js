// screens/weather-overlay.js — "Avui a Aiguablava" weather details overlay.
//
// Injected as a bottom-sheet overlay on top of the current screen (not a new
// route). Triggered from the small "Detalls" button next to the Aiguablava
// caption on the language screen. Reads live conditions from getWeather() and
// lists wind / swell / air / sea / sunset. Closes on backdrop, ✕ or Escape.

import { t, getLanguage } from "../i18n.js";
import { getWeather } from "../weather.js";

const ICON_CLOSE = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

export function openWeatherOverlay() {
  // Guard: only one overlay at a time.
  if (document.querySelector(".weather-overlay")) return;

  const lang = getLanguage();

  const overlay = document.createElement("div");
  overlay.className = "weather-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", t("weather.label"));

  overlay.innerHTML = `
    <div class="weather-overlay__backdrop"></div>
    <div class="weather-overlay__card">
      <div class="weather-overlay__head">
        <h2 class="weather-overlay__title">${t("weather.label")}</h2>
        <button class="weather-overlay__close" type="button" aria-label="${t("poi.close")}">
          ${ICON_CLOSE}
        </button>
      </div>
      <dl class="weather-overlay__list" data-rows aria-live="polite">
        <p class="weather-overlay__status">${t("weather.loading")}</p>
      </dl>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("is-open"));

  // ── Close plumbing ──────────────────────────────────────────────────────────
  function close() {
    overlay.classList.remove("is-open");
    overlay.addEventListener("transitionend", () => overlay.remove(), { once: true });
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) {
    if (e.key === "Escape") close();
  }
  overlay.querySelector(".weather-overlay__backdrop").addEventListener("click", close);
  overlay.querySelector(".weather-overlay__close").addEventListener("click", close);
  document.addEventListener("keydown", onKey);
  requestAnimationFrame(() => overlay.querySelector(".weather-overlay__close").focus());

  // ── Data ────────────────────────────────────────────────────────────────────
  const rows = overlay.querySelector("[data-rows]");
  (async () => {
    try {
      const { data, offline } = await getWeather();
      rows.innerHTML = renderRows(data, lang) +
        (offline ? `<p class="weather-overlay__note">${t("weather.offline")}</p>` : "");
    } catch {
      rows.innerHTML = `<p class="weather-overlay__status">${t("weather.error")}</p>`;
    }
  })();

  return { close };
}

function row(label, value) {
  return `
    <div class="weather-overlay__row">
      <dt class="weather-overlay__label">${label}</dt>
      <dd class="weather-overlay__value">${value}</dd>
    </div>
  `;
}

function renderRows(d, lang) {
  if (!d) return `<p class="weather-overlay__status">${t("weather.error")}</p>`;

  const out = [];

  // Wind — speed + cardinal, local wind name, gusts.
  if (d.wind && typeof d.wind.speed === "number") {
    let wind = `${d.wind.speed} kn`;
    if (d.wind.cardinal && d.wind.cardinal !== "—") wind += ` ${d.wind.cardinal}`;
    if (d.wind.named) wind += ` · ${t(`weather.named.${d.wind.named}`)}`;
    if (typeof d.wind.gusts === "number")
      wind += ` <span class="weather-overlay__sub">${t("weather.gusts")} ${d.wind.gusts} kn</span>`;
    out.push(row(t("weather.tab.wind"), wind));
  }

  // Swell — height + period.
  if (d.wave && typeof d.wave.height === "number") {
    let wave = `${d.wave.height} m`;
    if (typeof d.wave.period === "number")
      wave += ` <span class="weather-overlay__sub">${d.wave.period} s</span>`;
    out.push(row(t("weather.wave.label"), wave));
  }

  // Air & sea temperatures.
  if (d.air && typeof d.air.temp === "number")
    out.push(row(t("weather.air.label"), t("weather.temp", d.air.temp)));
  if (d.wave && typeof d.wave.seaTemp === "number")
    out.push(row(t("weather.sea.label"), t("weather.temp", d.wave.seaTemp)));

  // Sunset — HH:MM from the ISO timestamp.
  if (d.sunset && d.sunset.length >= 16)
    out.push(row(t("weather.sunset.label"), d.sunset.slice(11, 16)));

  return out.join("");
}

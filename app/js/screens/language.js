import { LANGUAGES, t, setLanguage, getLanguage } from "../i18n.js";
import { navigate } from "../router.js";
import { getWeather } from "../weather.js";
import { mountWindRose } from "../wind-rose.js";
import { waveImageFor, getWaveOverride } from "../wave-state.js";
import { openWeatherOverlay } from "./weather-overlay.js";

const TABS = [
  { id: "wind", labelKey: "weather.tab.wind" },
  { id: "wave", labelKey: "weather.tab.wave" },
];

// Short uppercase labels shown beneath each flag card.
const LANG_SHORT = { ca: "CAT", es: "ESP", en: "ENG", fr: "FRA" };

// Painted country-flag illustrations, keyed by language code.
const FLAG_IMG = {
  ca: "./assets/illustrations/country-flags/catalan.webp",
  es: "./assets/illustrations/country-flags/spanish.webp",
  en: "./assets/illustrations/country-flags/english.webp",
  fr: "./assets/illustrations/country-flags/french.webp",
};

// Info glyph (Phosphor "Info", regular) for the weather-info tertiary button —
// matches app/assets/icons/Info.svg exactly (fill swapped to currentColor).
const ICON_INFO = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M10.125 7.875C10.125 7.57833 10.213 7.28832 10.3778 7.04164C10.5426 6.79497 10.7769 6.60271 11.051 6.48918C11.3251 6.37565 11.6267 6.34594 11.9176 6.40382C12.2086 6.4617 12.4759 6.60456 12.6857 6.81434C12.8954 7.02412 13.0383 7.29139 13.0962 7.58236C13.1541 7.87334 13.1244 8.17494 13.0108 8.44902C12.8973 8.72311 12.705 8.95738 12.4584 9.1222C12.2117 9.28703 11.9217 9.375 11.625 9.375C11.2272 9.375 10.8456 9.21696 10.5643 8.93566C10.283 8.65436 10.125 8.27282 10.125 7.875ZM22.125 12C22.125 14.0025 21.5312 15.9601 20.4186 17.6251C19.3061 19.2902 17.7248 20.5879 15.8747 21.3543C14.0246 22.1206 11.9888 22.3211 10.0247 21.9305C8.06066 21.5398 6.25656 20.5755 4.84055 19.1595C3.42454 17.7435 2.46023 15.9393 2.06955 13.9753C1.67888 12.0112 1.87939 9.97543 2.64572 8.12533C3.41206 6.27523 4.70981 4.69392 6.37486 3.58137C8.0399 2.46882 9.99747 1.875 12 1.875C14.6844 1.87798 17.258 2.94567 19.1562 4.84383C21.0543 6.74199 22.122 9.3156 22.125 12ZM19.875 12C19.875 10.4425 19.4131 8.91992 18.5478 7.62488C17.6825 6.32985 16.4526 5.32049 15.0136 4.72445C13.5747 4.12841 11.9913 3.97246 10.4637 4.27632C8.93607 4.58017 7.53288 5.3302 6.43154 6.43153C5.3302 7.53287 4.58018 8.93606 4.27632 10.4637C3.97246 11.9913 4.12841 13.5747 4.72445 15.0136C5.32049 16.4526 6.32985 17.6825 7.62489 18.5478C8.91993 19.4131 10.4425 19.875 12 19.875C14.0879 19.8728 16.0896 19.0424 17.566 17.566C19.0424 16.0896 19.8728 14.0879 19.875 12ZM13.125 15.4387V12.375C13.125 11.8777 12.9275 11.4008 12.5758 11.0492C12.2242 10.6975 11.7473 10.5 11.25 10.5C10.9843 10.4996 10.7271 10.5932 10.5238 10.7643C10.3206 10.9354 10.1844 11.173 10.1395 11.4348C10.0946 11.6967 10.1438 11.966 10.2784 12.195C10.413 12.4241 10.6244 12.5981 10.875 12.6863V15.75C10.875 16.2473 11.0725 16.7242 11.4242 17.0758C11.7758 17.4275 12.2527 17.625 12.75 17.625C13.0157 17.6254 13.2729 17.5318 13.4762 17.3607C13.6794 17.1896 13.8156 16.952 13.8605 16.6902C13.9054 16.4283 13.8562 16.159 13.7216 15.93C13.587 15.7009 13.3756 15.5269 13.125 15.4387Z" fill="currentColor"/></svg>`;

export function renderLanguageScreen(host) {
  const screen = document.createElement("section");
  screen.className = "screen lang-screen";
  screen.dataset.screen = "language";

  screen.innerHTML = `
    <div class="lang-screen__langs">
      <div class="lang-cards" role="radiogroup" aria-label="${t("lang.section")}">
        ${LANGUAGES.map(
          (l) => `
            <button
              type="button"
              class="lang-card"
              role="radio"
              aria-checked="${l.code === getLanguage() ? "true" : "false"}"
              data-lang="${l.code}"
              tabindex="${l.code === getLanguage() ? "0" : "-1"}"
            >
              <span class="lang-card__flag">
                <img src="${FLAG_IMG[l.code]}" alt="" width="40" height="40" />
              </span>
              <span class="lang-card__label">${LANG_SHORT[l.code] || l.code.toUpperCase()}</span>
            </button>
          `
        ).join("")}
      </div>
    </div>

    <div class="lang-screen__top">
      <div class="lang-screen__weather">
        <div class="lang-screen__header">
          <div class="weather-tabs" role="tablist" aria-label="${t("routes.weatherTitle")}">
            ${TABS.map((tab, i) => `
              <button type="button" role="tab"
                class="weather-tab${i === 0 ? " is-active" : ""}"
                data-tab="${tab.id}"
                data-i18n="${tab.labelKey}"
                aria-selected="${i === 0}"
              >${t(tab.labelKey)}</button>
            `).join("")}
          </div>
        </div>
        <div class="lang-screen__hero">
          <div class="lang-screen__panels">
            <div class="weather-panel" data-panel="wind">
              <canvas class="wind-rose" data-wind-rose width="708" height="708" aria-label="Wind rose"></canvas>
            </div>
            <div class="weather-panel is-hidden" data-panel="wave">
              <img class="wave-illustration" data-wave-img alt="${t("weather.tab.wave")}" />
            </div>
          </div>
          <p class="lang-screen__caption">
            <button type="button" class="lang-screen__details" data-action="weather-details">
              <span class="lang-screen__details-icon">${ICON_INFO}</span>
              <span class="lang-screen__details-label" data-i18n="weather.details">${t("weather.details")}</span>
            </button>
          </p>
        </div>
      </div>
    </div>

    <div class="lang-screen__footer">
      <button class="lang-screen__cta" type="button" data-action="continue">
        <span data-i18n="lang.cta">${t("lang.cta")}</span>
      </button>
    </div>
  `;

  // ── Language selection ─────────────────────────────────────────────────────
  screen.querySelectorAll("[data-lang]").forEach((row) => {
    row.addEventListener("click", () => {
      const code = row.dataset.lang;
      setLanguage(code);
      screen.querySelectorAll("[data-lang]").forEach((r) => {
        const checked = r.dataset.lang === code;
        r.setAttribute("aria-checked", checked ? "true" : "false");
        r.tabIndex = checked ? 0 : -1;
      });
      screen
        .querySelectorAll("[data-i18n]")
        .forEach((n) => (n.textContent = t(n.dataset.i18n)));
    });
  });

  // Weather page is skipped — the language screen continues straight to routes.
  screen
    .querySelector("[data-action=continue]")
    .addEventListener("click", () => navigate("/routes"));

  // Weather details overlay (secondary action next to the Aiguablava caption).
  screen
    .querySelector("[data-action=weather-details]")
    .addEventListener("click", () => openWeatherOverlay());

  // ── Wind / Onatge tabs ─────────────────────────────────────────────────────
  const tabs   = screen.querySelectorAll(".weather-tab");
  const panels = screen.querySelectorAll(".weather-panel");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const id = tab.dataset.tab;
      tabs.forEach((x) => {
        const on = x === tab;
        x.classList.toggle("is-active", on);
        x.setAttribute("aria-selected", String(on));
      });
      panels.forEach((p) => p.classList.toggle("is-hidden", p.dataset.panel !== id));
    });
  });

  host.appendChild(screen);
  requestAnimationFrame(() => screen.classList.add("is-active"));

  // ── Rive wind rose ─────────────────────────────────────────────────────────
  const canvas = screen.querySelector("[data-wind-rose]");
  const rose   = canvas ? mountWindRose(canvas) : null;

  // Onatge illustration — defaults to calm until live swell arrives, and a
  // worker override (when set) wins over the live reading. See wave-state.js.
  const waveImg  = screen.querySelector("[data-wave-img]");
  const override = getWaveOverride();
  if (waveImg) waveImg.src = waveImageFor(undefined, override);

  (async () => {
    try {
      const { data } = await getWeather();
      if (rose && data?.wind) {
        if (typeof data.wind.direction === "number") rose.setAngle(data.wind.direction);
        if (data.wind.named || data.wind.cardinal)   rose.setName(data.wind.named || data.wind.cardinal);
        rose.fireStart();
      }
      if (waveImg) waveImg.src = waveImageFor(data?.wave?.height, override);
    } catch {
      // No weather — leave the rose at its resting state and the swell tab on
      // its calm default; design holds without data.
    }
  })();

  return {
    teardown() {
      screen.classList.remove("is-active");
      if (rose) rose.cleanup();
      setTimeout(() => screen.remove(), 320);
    },
  };
}

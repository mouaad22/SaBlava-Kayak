import { LANGUAGES, t, setLanguage, getLanguage } from "../i18n.js";
import { navigate } from "../router.js";
import { getWeather, conditionsSummary, getSummaryOverride } from "../weather.js";
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

// Map glyph (Phosphor "MapPinArea", regular) for the Aiguablava place label —
// matches app/assets/icons/regular/MapPinArea.svg exactly (fill → currentColor).
const ICON_MAP = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M10.5 7.5C10.5 7.20333 10.588 6.91332 10.7528 6.66664C10.9176 6.41997 11.1519 6.22771 11.426 6.11418C11.7001 6.00065 12.0017 5.97094 12.2926 6.02882C12.5836 6.0867 12.8509 6.22956 13.0607 6.43934C13.2704 6.64912 13.4133 6.91639 13.4712 7.20736C13.5291 7.49834 13.4994 7.79994 13.3858 8.07402C13.2723 8.34811 13.08 8.58238 12.8334 8.7472C12.5867 8.91203 12.2967 9 12 9C11.6022 9 11.2206 8.84196 10.9393 8.56066C10.658 8.27936 10.5 7.89782 10.5 7.5ZM6 7.5C6 5.9087 6.63214 4.38258 7.75736 3.25736C8.88258 2.13214 10.4087 1.5 12 1.5C13.5913 1.5 15.1174 2.13214 16.2426 3.25736C17.3679 4.38258 18 5.9087 18 7.5C18 13.1203 12.6019 16.2694 12.375 16.4016C12.2617 16.4663 12.1334 16.5004 12.0028 16.5004C11.8723 16.5004 11.744 16.4663 11.6306 16.4016C11.3981 16.2694 6 13.125 6 7.5ZM7.5 7.5C7.5 11.4563 10.86 14.0822 12 14.8594C13.1391 14.0831 16.5 11.4563 16.5 7.5C16.5 6.30653 16.0259 5.16193 15.182 4.31802C14.3381 3.47411 13.1935 3 12 3C10.8065 3 9.66193 3.47411 8.81802 4.31802C7.97411 5.16193 7.5 6.30653 7.5 7.5ZM19.0097 13.8403C18.8251 13.7793 18.624 13.7924 18.4489 13.8768C18.2738 13.9612 18.1382 14.1102 18.0709 14.2926C18.0035 14.475 18.0096 14.6764 18.0879 14.8543C18.1661 15.0323 18.3104 15.1729 18.4903 15.2466C20.0381 15.8194 21 16.5863 21 17.25C21 18.5025 17.5762 20.25 12 20.25C6.42375 20.25 3 18.5025 3 17.25C3 16.5863 3.96188 15.8194 5.50969 15.2475C5.6896 15.1739 5.8339 15.0332 5.91215 14.8553C5.99039 14.6773 5.99648 14.4759 5.92913 14.2935C5.86178 14.1112 5.72624 13.9621 5.5511 13.8777C5.37596 13.7933 5.1749 13.7803 4.99031 13.8412C2.73937 14.6709 1.5 15.8822 1.5 17.25C1.5 20.1731 6.91031 21.75 12 21.75C17.0897 21.75 22.5 20.1731 22.5 17.25C22.5 15.8822 21.2606 14.6709 19.0097 13.8403Z" fill="currentColor"/></svg>`;

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
        <div class="lang-screen__hero">
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
            <span class="lang-screen__place">
              <span class="lang-screen__place-icon">${ICON_MAP}</span>
              <span class="lang-screen__place-label">Aiguablava</span>
            </span>
          </div>
          <div class="lang-screen__panels">
            <div class="weather-panel" data-panel="wind">
              <canvas class="wind-rose" data-wind-rose width="708" height="708" aria-label="Wind rose"></canvas>
            </div>
            <div class="weather-panel is-hidden" data-panel="wave">
              <img class="wave-illustration" data-wave-img alt="${t("weather.tab.wave")}" />
            </div>
          </div>
          <p class="conditions-summary" data-conditions-summary hidden>
            <span class="conditions-summary__dot" aria-hidden="true"></span><span class="conditions-summary__verdict" data-summary-verdict></span><span class="conditions-summary__anchor" data-summary-anchor></span><span class="conditions-summary__reason" data-summary-reason></span>
          </p>
        </div>
      </div>
    </div>

    <div class="lang-screen__footer">
      <button type="button" class="lang-screen__details" data-action="weather-details">
        <span class="lang-screen__details-icon">${ICON_INFO}</span>
        <span class="lang-screen__details-label" data-i18n="weather.details">${t("weather.details")}</span>
      </button>
      <button class="lang-screen__cta" type="button" data-action="continue">
        <span data-i18n="lang.cta">${t("lang.cta")}</span>
      </button>
      <button type="button" class="lang-screen__legal" data-action="legal">
        <span data-i18n="legal.link">${t("legal.link")}</span>
      </button>
    </div>
  `;

  // ── Conditions summary line ────────────────────────────────────────────────
  // Verdict line between the hero image and the details button. Stays hidden
  // until live weather arrives; the verdict is global (independent of the
  // wind/wave tab) and re-renders when the language changes.
  const summaryEl = screen.querySelector("[data-conditions-summary]");
  // Employee override seam — a hand-written verdict from the future control
  // panel wins over the live computation. See getSummaryOverride() in weather.js.
  const summaryOverride = getSummaryOverride();
  let latestWeather = null;
  function paintSummary() {
    // Render once we have either live weather or a manual override.
    if (!summaryEl || (!latestWeather && !summaryOverride)) return;
    const s = conditionsSummary(latestWeather, getLanguage(), summaryOverride);
    summaryEl.classList.remove(
      "conditions-summary--green",
      "conditions-summary--coral",
      "conditions-summary--red"
    );
    summaryEl.classList.add(`conditions-summary--${s.verdict}`);
    summaryEl.querySelector("[data-summary-verdict]").textContent = s.verdictText;
    // Leading non-breaking space binds the middot to the verdict so a wrapped
    // line can never start with "·"; nowrap (CSS) keeps the figure itself whole.
    summaryEl.querySelector("[data-summary-anchor]").textContent = s.anchor ? ` · ${s.anchor}` : "";
    summaryEl.querySelector("[data-summary-reason]").textContent = s.reasonText ? `. ${s.reasonText}` : "";
    summaryEl.hidden = false;
  }
  paintSummary(); // shows immediately if a manual override is present

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
      paintSummary();
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

  // Privacy & legal notice — small unobtrusive link below the primary CTA.
  screen
    .querySelector("[data-action=legal]")
    .addEventListener("click", () => navigate("/legal"));

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
      latestWeather = data;
      paintSummary();
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

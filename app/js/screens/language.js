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

// Location pin (Phosphor "MapPinArea", regular) for the Aiguablava caption.
const ICON_MAPPIN = `<svg class="lang-screen__caption-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M10.5 7.5C10.5 7.20333 10.588 6.91332 10.7528 6.66664C10.9176 6.41997 11.1519 6.22771 11.426 6.11418C11.7001 6.00065 12.0017 5.97094 12.2926 6.02882C12.5836 6.0867 12.8509 6.22956 13.0607 6.43934C13.2704 6.64912 13.4133 6.91639 13.4712 7.20736C13.5291 7.49834 13.4994 7.79994 13.3858 8.07402C13.2723 8.34811 13.08 8.58238 12.8334 8.7472C12.5867 8.91203 12.2967 9 12 9C11.6022 9 11.2206 8.84196 10.9393 8.56066C10.658 8.27936 10.5 7.89782 10.5 7.5ZM6 7.5C6 5.9087 6.63214 4.38258 7.75736 3.25736C8.88258 2.13214 10.4087 1.5 12 1.5C13.5913 1.5 15.1174 2.13214 16.2426 3.25736C17.3679 4.38258 18 5.9087 18 7.5C18 13.1203 12.6019 16.2694 12.375 16.4016C12.2617 16.4663 12.1334 16.5004 12.0028 16.5004C11.8723 16.5004 11.744 16.4663 11.6306 16.4016C11.3981 16.2694 6 13.125 6 7.5ZM7.5 7.5C7.5 11.4563 10.86 14.0822 12 14.8594C13.1391 14.0831 16.5 11.4563 16.5 7.5C16.5 6.30653 16.0259 5.16193 15.182 4.31802C14.3381 3.47411 13.1935 3 12 3C10.8065 3 9.66193 3.47411 8.81802 4.31802C7.97411 5.16193 7.5 6.30653 7.5 7.5ZM19.0097 13.8403C18.8251 13.7793 18.624 13.7924 18.4489 13.8768C18.2738 13.9612 18.1382 14.1102 18.0709 14.2926C18.0035 14.475 18.0096 14.6764 18.0879 14.8543C18.1661 15.0323 18.3104 15.1729 18.4903 15.2466C20.0381 15.8194 21 16.5863 21 17.25C21 18.5025 17.5762 20.25 12 20.25C6.42375 20.25 3 18.5025 3 17.25C3 16.5863 3.96188 15.8194 5.50969 15.2475C5.6896 15.1739 5.8339 15.0332 5.91215 14.8553C5.99039 14.6773 5.99648 14.4759 5.92913 14.2935C5.86178 14.1112 5.72624 13.9621 5.5511 13.8777C5.37596 13.7933 5.1749 13.7803 4.99031 13.8412C2.73937 14.6709 1.5 15.8822 1.5 17.25C1.5 20.1731 6.91031 21.75 12 21.75C17.0897 21.75 22.5 20.1731 22.5 17.25C22.5 15.8822 21.2606 14.6709 19.0097 13.8403Z" fill="currentColor"/></svg>`;

// Info glyph (Phosphor "Info", fill) for the weather-info tertiary button —
// matches app/assets/icons/Info-filled.svg exactly (fill swapped to currentColor).
const ICON_INFO = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 2.25C10.0716 2.25 8.18657 2.82183 6.58319 3.89317C4.97982 4.96452 3.73013 6.48726 2.99218 8.26884C2.25422 10.0504 2.06114 12.0108 2.43735 13.9021C2.81355 15.7934 3.74215 17.5307 5.10571 18.8943C6.46928 20.2579 8.20656 21.1865 10.0979 21.5627C11.9892 21.9389 13.9496 21.7458 15.7312 21.0078C17.5127 20.2699 19.0355 19.0202 20.1068 17.4168C21.1782 15.8134 21.75 13.9284 21.75 12C21.7473 9.41498 20.7192 6.93661 18.8913 5.10872C17.0634 3.28084 14.585 2.25273 12 2.25ZM11.625 6.75C11.8475 6.75 12.065 6.81598 12.25 6.9396C12.435 7.06321 12.5792 7.23891 12.6644 7.44448C12.7495 7.65005 12.7718 7.87625 12.7284 8.09448C12.685 8.31271 12.5778 8.51316 12.4205 8.6705C12.2632 8.82783 12.0627 8.93498 11.8445 8.97838C11.6263 9.02179 11.4001 8.99951 11.1945 8.91436C10.9889 8.82922 10.8132 8.68502 10.6896 8.50002C10.566 8.31501 10.5 8.0975 10.5 7.875C10.5 7.57663 10.6185 7.29048 10.8295 7.0795C11.0405 6.86853 11.3266 6.75 11.625 6.75ZM12.75 17.25C12.3522 17.25 11.9706 17.092 11.6893 16.8107C11.408 16.5294 11.25 16.1478 11.25 15.75V12C11.0511 12 10.8603 11.921 10.7197 11.7803C10.579 11.6397 10.5 11.4489 10.5 11.25C10.5 11.0511 10.579 10.8603 10.7197 10.7197C10.8603 10.579 11.0511 10.5 11.25 10.5C11.6478 10.5 12.0294 10.658 12.3107 10.9393C12.592 11.2206 12.75 11.6022 12.75 12V15.75C12.9489 15.75 13.1397 15.829 13.2803 15.9697C13.421 16.1103 13.5 16.3011 13.5 16.5C13.5 16.6989 13.421 16.8897 13.2803 17.0303C13.1397 17.171 12.9489 17.25 12.75 17.25Z" fill="currentColor"/></svg>`;

export function renderLanguageScreen(host) {
  const screen = document.createElement("section");
  screen.className = "screen lang-screen";
  screen.dataset.screen = "language";

  screen.innerHTML = `
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
            ${ICON_MAPPIN}
            <span>Aiguablava</span>
            <button type="button" class="lang-screen__details" data-action="weather-details">
              <span class="lang-screen__details-icon">${ICON_INFO}</span>
              <span class="lang-screen__details-label" data-i18n="weather.details">${t("weather.details")}</span>
            </button>
          </p>
        </div>
      </div>
    </div>

    <div class="lang-screen__bottom">
      <p class="lang-screen__prompt" data-i18n="lang.section">${t(
        "lang.section"
      )}</p>

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

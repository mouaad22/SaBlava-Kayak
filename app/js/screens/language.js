import { LANGUAGES, t, setLanguage, getLanguage } from "../i18n.js";
import { navigate } from "../router.js";
import { FLAGS } from "../flags.js";
import { getWeather } from "../weather.js";
import { mountWindRose } from "../wind-rose.js";

const CHECK_ICON = `
  <svg class="lang-row__check" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M21.7969 7.545L9.79687 19.545C9.69236 19.6499 9.56816 19.7331 9.43142 19.7899C9.29467 19.8467 9.14806 19.8759 9 19.8759C8.85193 19.8759 8.70532 19.8467 8.56858 19.7899C8.43183 19.7331 8.30764 19.6499 8.20312 19.545L2.95312 14.295C2.84848 14.1904 2.76547 14.0661 2.70883 13.9294C2.6522 13.7927 2.62305 13.6461 2.62305 13.4981C2.62305 13.3501 2.6522 13.2036 2.70883 13.0669C2.76547 12.9301 2.84848 12.8059 2.95312 12.7012C3.05777 12.5966 3.182 12.5136 3.31873 12.457C3.45546 12.4003 3.60201 12.3712 3.75 12.3712C3.89799 12.3712 4.04454 12.4003 4.18126 12.457C4.31799 12.5136 4.44223 12.5966 4.54687 12.7012L9.00094 17.1553L20.205 5.95312C20.4163 5.74178 20.703 5.62305 21.0019 5.62305C21.3008 5.62305 21.5874 5.74178 21.7987 5.95312C22.0101 6.16447 22.1288 6.45111 22.1288 6.75C22.1288 7.04888 22.0101 7.33553 21.7987 7.54687L21.7969 7.545Z" fill="#1B6B8A"/>
  </svg>
`;

const ICON_LOCATION = `<svg width="12" height="14" viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M6 0C3.24 0 1 2.24 1 5c0 3.75 5 9 5 9s5-5.25 5-9c0-2.76-2.24-5-5-5zm0 6.5A1.5 1.5 0 1 1 6 3.5a1.5 1.5 0 0 1 0 3z" fill="#3D6B4F"/></svg>`;

const TABS = [
  { id: "wind", labelKey: "weather.tab.wind" },
  { id: "wave", labelKey: "weather.tab.wave" },
  { id: "sun",  labelKey: "weather.tab.sun" },
];

export function renderLanguageScreen(host) {
  const screen = document.createElement("section");
  screen.className = "screen lang-screen";
  screen.dataset.screen = "language";

  const lang = getLanguage();

  screen.innerHTML = `
    <div class="lang-screen__top">
      <div class="lang-screen__weather">
        <div class="weather-screen__header lang-screen__weather-header">
          <div class="weather-tabs weather-screen__tabs" role="tablist" aria-label="${t(
            "routes.weatherTitle"
          )}">
            ${TABS.map(
              (tab, i) => `
              <button type="button" role="tab"
                class="weather-tab${i === 0 ? " is-active" : ""}"
                data-tab="${tab.id}"
                data-i18n="${tab.labelKey}"
                aria-selected="${i === 0}"
              >${t(tab.labelKey)}</button>
            `
            ).join("")}
          </div>
          <div class="weather-screen__location">
            ${ICON_LOCATION}
            <span>Aiguablava</span>
          </div>
        </div>

        <div class="lang-screen__panels">
          <div class="weather-panel" data-panel="wind">
            <canvas class="wind-rose" data-wind-rose width="708" height="708" aria-label="Wind rose"></canvas>
          </div>
          <div class="weather-panel is-hidden" data-panel="wave"></div>
          <div class="weather-panel is-hidden" data-panel="sun"></div>
        </div>
      </div>
    </div>

    <div class="lang-screen__bottom">
      <p class="lang-screen__prompt" data-i18n="lang.section">${t(
        "lang.section"
      )}</p>

      <div class="lang-list" role="radiogroup" aria-label="${t("lang.section")}">
        ${LANGUAGES.map(
          (l) => `
            <button
              type="button"
              class="lang-row"
              role="radio"
              aria-checked="${l.code === getLanguage() ? "true" : "false"}"
              data-lang="${l.code}"
              tabindex="${l.code === getLanguage() ? "0" : "-1"}"
            >
              <span class="lang-row__flag">${FLAGS[l.code] || ""}</span>
              <span class="lang-row__body">
                <span class="lang-row__name">${l.name}</span>
                ${CHECK_ICON}
              </span>
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

  // ── Weather tabs (wind / wave / sun) ───────────────────────────────────────
  const tabs   = screen.querySelectorAll(".weather-tab");
  const panels = screen.querySelectorAll(".weather-panel");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const id = tab.dataset.tab;
      tabs.forEach((t) => {
        const on = t === tab;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", String(on));
      });
      panels.forEach((p) => {
        p.classList.toggle("is-hidden", p.dataset.panel !== id);
      });
    });
  });

  // Weather page is skipped — the language screen continues straight to routes.
  screen
    .querySelector("[data-action=continue]")
    .addEventListener("click", () => navigate("/routes"));

  host.appendChild(screen);
  requestAnimationFrame(() => screen.classList.add("is-active"));

  // ── Rive wind rose ─────────────────────────────────────────────────────────
  const canvas = screen.querySelector("[data-wind-rose]");
  const rose   = canvas ? mountWindRose(canvas) : null;

  (async () => {
    try {
      const { data } = await getWeather();
      if (rose && data?.wind) {
        if (typeof data.wind.direction === "number") rose.setAngle(data.wind.direction);
        if (data.wind.named || data.wind.cardinal)   rose.setName(data.wind.named || data.wind.cardinal);
        rose.fireStart();
      }
    } catch {
      // No weather — leave the rose at its resting state; design holds without data.
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

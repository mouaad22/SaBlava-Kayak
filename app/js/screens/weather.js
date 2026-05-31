import { t, getLanguage } from "../i18n.js";
import { navigate } from "../router.js";
import { getWeather, windBannerData } from "../weather.js";
import { mountWindRose } from "../wind-rose.js";

const TABS = [
  { id: "wind", labelKey: "weather.tab.wind" },
  { id: "wave", labelKey: "weather.tab.wave" },
  { id: "sun",  labelKey: "weather.tab.sun" },
];

const ICON_LOCATION = `<svg width="12" height="14" viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M6 0C3.24 0 1 2.24 1 5c0 3.75 5 9 5 9s5-5.25 5-9c0-2.76-2.24-5-5-5zm0 6.5A1.5 1.5 0 1 1 6 3.5a1.5 1.5 0 0 1 0 3z" fill="#3D6B4F"/></svg>`;

export function renderWeatherScreen(host) {
  const screen = document.createElement("section");
  screen.className = "screen weather-screen";
  screen.dataset.screen = "weather";

  const lang = getLanguage();

  screen.innerHTML = `
    <div class="weather-screen__header">
      <div class="weather-tabs weather-screen__tabs" role="tablist" aria-label="${t("routes.weatherTitle")}">
        ${TABS.map((tab, i) => `
          <button type="button" role="tab"
            class="weather-tab${i === 0 ? " is-active" : ""}"
            data-tab="${tab.id}"
            aria-selected="${i === 0}"
          >${t(tab.labelKey)}</button>
        `).join("")}
      </div>
      <div class="weather-screen__location">
        ${ICON_LOCATION}
        <span>Aiguablava</span>
      </div>
    </div>

    <div class="weather-screen__body">
      <div class="weather-panel weather-screen__panel" data-panel="wind">
        <canvas class="wind-rose" data-wind-rose width="708" height="708" aria-label="Wind rose"></canvas>
        <div class="wind-banner" data-wind-banner aria-live="polite"></div>
      </div>
      <div class="weather-panel weather-screen__panel is-hidden" data-panel="wave"></div>
      <div class="weather-panel weather-screen__panel is-hidden" data-panel="sun"></div>
    </div>

    <div class="weather-screen__footer">
      <button class="lang-screen__cta" type="button" data-action="continue">
        ${t("lang.cta")}
      </button>
    </div>
  `;

  host.appendChild(screen);
  requestAnimationFrame(() => {
    screen.classList.add("is-active");
    screen.scrollTop = 0;
  });

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

  screen.querySelector("[data-action=continue]").addEventListener("click", () => navigate("/routes"));

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
      const bannerEl = screen.querySelector("[data-wind-banner]");
      if (bannerEl && data) {
        bannerEl.innerHTML = renderWindBanner(windBannerData(data, lang));
      }
    } catch {
      // No weather — leave rose at resting state; design holds without data.
    }
  })();

  return {
    name: "weather",
    teardown() {
      screen.classList.remove("is-active");
      if (rose) rose.cleanup();
      setTimeout(() => screen.remove(), 320);
    },
  };
}

function renderWindBanner(d) {
  if (!d) return "";

  const speedStr = d.isCalm
    ? `<span class="wind-banner__speed">— &nbsp;</span>`
    : `<span class="wind-banner__speed">${d.speedKmh} km/h ${d.cardinalLetter ?? ""} · </span>`;

  const flourishHTML = d.flourish
    ? `<p class="wind-banner__flourish">${d.flourish}</p>`
    : "";

  return `
    <div class="wind-banner__summary">
      ${speedStr}<span class="wind-tag ${d.tierCss}">${d.tierLabel}</span>
    </div>
    <p class="wind-banner__recommendation">${d.recommendation}</p>
    ${flourishHTML}
  `;
}

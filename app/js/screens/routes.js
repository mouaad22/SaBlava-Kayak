import { ROUTES } from "../data.js";
import { t, getLanguage } from "../i18n.js";
import { navigate } from "../router.js";
import { getWeather } from "../weather.js";
import { mountWindRose } from "../wind-rose.js";

// Paper artboard 9UR-0 — "2 - See routes".
// Weather section: "Temps a Aiguablava" heading, a 3-tab segmented control
// (Vent / Onatge / Sol), then the active tab's panel. The Vent panel renders
// the wind-rose Rive animation (354×354), bound to live wind data: windAngle
// (degrees, 0–360) drives the rotation, windName (cardinal/local name) labels
// it. Onatge and Sol are placeholders for now — same slot, different content
// when their Rive scenes land.

const TABS = [
  { id: "wind", labelKey: "weather.tab.wind" },
  { id: "wave", labelKey: "weather.tab.wave" },
  { id: "sun", labelKey: "weather.tab.sun" },
];

export function renderRoutesScreen(host) {
  const screen = document.createElement("section");
  screen.className = "screen routes-screen";
  screen.dataset.screen = "routes";

  const lang = getLanguage();

  screen.innerHTML = `
    <div class="routes-screen__weather">
      <div class="routes-screen__weather-heading-wrap">
        <h1 class="routes-screen__weather-heading">${t("routes.weatherTitle")}</h1>
      </div>

      <div class="routes-screen__weather-body">
        <div class="weather-tabs" role="tablist" aria-label="${t("routes.weatherTitle")}">
          ${TABS.map(
            (tab, i) => `
            <button
              type="button"
              role="tab"
              class="weather-tab${i === 0 ? " is-active" : ""}"
              data-tab="${tab.id}"
              aria-selected="${i === 0 ? "true" : "false"}"
            >${t(tab.labelKey)}</button>
          `
          ).join("")}
        </div>

        <div class="weather-panel" data-panel="wind">
          <canvas class="wind-rose" data-wind-rose width="708" height="708" aria-label="Wind rose"></canvas>
        </div>
        <div class="weather-panel is-hidden" data-panel="wave"></div>
        <div class="weather-panel is-hidden" data-panel="sun"></div>
      </div>
    </div>

    <div class="routes-screen__list">
      <div class="routes-screen__list-heading-wrap">
        <h2 class="routes-screen__list-heading">${t("routes.listTitle")}</h2>
      </div>
      ${ROUTES.map((r, i) => routeCard(r, lang, i === 0)).join("")}
    </div>
  `;

  host.appendChild(screen);
  requestAnimationFrame(() => {
    screen.classList.add("is-active");
    screen.scrollTop = 0;
  });

  // Tab bar — toggle the active pill and swap visible panel.
  const tabs = screen.querySelectorAll(".weather-tab");
  const panels = screen.querySelectorAll(".weather-panel");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const id = tab.dataset.tab;
      tabs.forEach((t) => {
        const on = t === tab;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });
      panels.forEach((p) => {
        p.classList.toggle("is-hidden", p.dataset.panel !== id);
      });
    });
  });

  // Route cards → detail
  screen.querySelectorAll("[data-route-id]").forEach((card) => {
    card.addEventListener("click", () => {
      navigate(`/route/${card.dataset.routeId}`);
    });
  });

  // Mount the wind rose, then push live values once weather lands.
  const canvas = screen.querySelector("[data-wind-rose]");
  const rose = canvas ? mountWindRose(canvas) : null;

  (async () => {
    try {
      const { data } = await getWeather();
      if (rose && data?.wind) {
        if (typeof data.wind.direction === "number") {
          rose.setAngle(data.wind.direction);
        }
        if (data.wind.named || data.wind.cardinal) {
          rose.setName(data.wind.named || data.wind.cardinal);
        }
        rose.fireStart();
      }
    } catch {
      // No weather → leave the rose at its default state; the design holds.
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

function routeCard(r, lang, isFirst) {
  const cls = isFirst ? "route-tile route-tile--a" : "route-tile route-tile--b";
  return `
    <button class="${cls}" type="button" data-route-id="${r.id}">
      <div class="route-tile__media" style="background-image:url('${r.cardImage}');"></div>
      <div class="route-tile__text">
        <h3 class="route-tile__title">${r.name[lang]}</h3>
        <p class="route-tile__desc">${r.description[lang]}</p>
      </div>
    </button>
  `;
}

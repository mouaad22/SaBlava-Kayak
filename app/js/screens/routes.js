import { ROUTES } from "../data.js";
import { t, getLanguage } from "../i18n.js";
import { navigate } from "../router.js";
import { getWeather } from "../weather.js";

export function renderRoutesScreen(host) {
  const screen = document.createElement("section");
  screen.className = "screen routes-screen";
  screen.dataset.screen = "routes";

  const lang = getLanguage();

  screen.innerHTML = `
    <div class="routes-screen__main">
      <h1 class="routes-screen__list-heading">${t("routes.listTitle")}</h1>

      <section class="routes-weather">
        <div class="conditions" data-conditions aria-live="polite"></div>
      </section>

      ${ROUTES.map((r, i) => routeCard(r, lang, i === 0)).join("")}
    </div>
  `;

  host.appendChild(screen);
  requestAnimationFrame(() => {
    screen.classList.add("is-active");
    screen.scrollTop = 0;
  });

  // ── Route cards → detail ──────────────────────────────────────────────────
  screen.querySelectorAll("[data-route-id]").forEach((card) => {
    card.addEventListener("click", () =>
      navigate(`/route/${card.dataset.routeId}`)
    );
  });

  // ── Weather banner (moved here from the old weather screen) ────────────────
  (async () => {
    try {
      const { data } = await getWeather();
      const el = screen.querySelector("[data-conditions]");
      if (el && data) {
        el.innerHTML = renderConditions(data);
      }
    } catch {
      // No weather — leave the section title in place without a reading.
    }
  })();

  return {
    name: "routes",
    teardown() {
      screen.classList.remove("is-active");
      setTimeout(() => screen.remove(), 320);
    },
  };
}

// ─── Route card ───────────────────────────────────────────────────────────────
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

// ─── Conditions strip ─────────────────────────────────────────────────────────
// Compact wind / wave / air summary for the "Temps a Aiguablava" card. The wind
// arrow rotates to show the direction the wind blows TOWARD — meteorological
// `direction` is the angle it comes FROM, so we add 180°.
function renderConditions(data) {
  const num = (v, d = 0) =>
    typeof v === "number" && !isNaN(v) ? Math.round(v * 10 ** d) / 10 ** d : null;
  const show = (v, unit = "") =>
    v == null ? "—" : `${v}<span class="conditions__unit">${unit}</span>`;

  const speedKmh = num(data?.wind?.speed != null ? data.wind.speed * 1.852 : null);
  const dir      = num(data?.wind?.direction);
  const cardinal = data?.wind?.cardinal ?? "—";
  const arrow =
    dir == null
      ? ""
      : `<svg class="conditions__arrow" style="transform:rotate(${Math.round(
          dir + 180
        )}deg)" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v18M12 3l-5 6M12 3l5 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const waveH   = num(data?.wave?.height, 1);
  const period  = num(data?.wave?.period);
  const airTemp = num(data?.air?.temp);
  const uv      = num(data?.air?.uv);

  return `
    <div class="conditions__cell">
      <span class="conditions__label">${t("weather.tab.wind")}</span>
      <span class="conditions__value">${arrow}${show(speedKmh, " km/h")}</span>
      <span class="conditions__sub">${cardinal}</span>
    </div>
    <div class="conditions__cell">
      <span class="conditions__label">${t("weather.tab.wave")}</span>
      <span class="conditions__value">${show(waveH, " m")}</span>
      <span class="conditions__sub">${period == null ? "—" : `${period} s`}</span>
    </div>
    <div class="conditions__cell">
      <span class="conditions__label">${t("weather.air.label")}</span>
      <span class="conditions__value">${airTemp == null ? "—" : `${airTemp}°`}</span>
      <span class="conditions__sub">UV ${uv == null ? "—" : uv}</span>
    </div>
  `;
}

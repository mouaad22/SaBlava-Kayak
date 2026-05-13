import { ROUTES } from "../data.js";
import { t, getLanguage } from "../i18n.js";
import { navigate } from "../router.js";
import { mountMap } from "../map.js";
import { attachSheet } from "../sheet.js";
import { getWeather, statusForRoute, relativeAge } from "../weather.js";

export function renderRoutesScreen(host) {
  const screen = document.createElement("section");
  screen.className = "screen routes-screen";
  screen.dataset.screen = "routes";

  const lang = getLanguage();
  let activeRouteId = ROUTES[0].id;

  screen.innerHTML = `
    <div class="routes-screen__map" data-map></div>

    <div class="routes-screen__topbar">
      <div class="brand-pill">
        <span class="brand-pill__dot">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12c4-3 6 3 9 0s5-3 9 0"/><path d="M3 17c4-3 6 3 9 0s5-3 9 0"/></svg>
        </span>
        <span>Sa Blava</span>
      </div>

      <button class="btn--icon" type="button" aria-label="Fullscreen map" data-action="map-fullscreen">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9V5a2 2 0 0 1 2-2h4"/><path d="M21 9V5a2 2 0 0 0-2-2h-4"/><path d="M3 15v4a2 2 0 0 0 2 2h4"/><path d="M21 15v4a2 2 0 0 1-2 2h-4"/></svg>
      </button>
    </div>

    <div class="map-legend" aria-hidden="true">
      ${ROUTES.map(
        (r) => `
        <span class="map-legend__chip">
          <span class="swatch" style="background:${r.color}"></span>
          ${r.name[lang]}
        </span>`
      ).join("")}
      <span class="map-legend__chip">
        <span class="swatch" style="background:#0B6E8C;border-radius:50%;width:8px;height:8px"></span>
        ${t("routes.legend.you")}
      </span>
    </div>

    <section class="sheet routes-sheet" data-sheet>
      <div class="sheet__handle" data-sheet-grip></div>

      <header class="routes-sheet__header" data-sheet-grip>
        <div class="routes-sheet__eyebrow">
          <span class="label-up">${t("routes.eyebrow")}</span>
        </div>

        <div class="routes-sheet__title-row">
          <h2 class="routes-sheet__title">${t("routes.title")}</h2>
          <span class="routes-sheet__count">${t("routes.count", ROUTES.length)}</span>
        </div>
        <p class="routes-sheet__lede">${t("routes.lede")}</p>
      </header>

      <div class="routes-sheet__cards" role="list">
        ${ROUTES.map((r, i) => routeCard(r, lang, i === 0)).join("")}
      </div>

      <section class="weather-section" data-weather data-state="loading" aria-live="polite">
        <header class="weather-section__head">
          <h3 class="weather-section__title">${t("weather.label")}</h3>
        </header>
        <div class="weather-section__body">
          <div class="weather-section__skeleton skeleton-shimmer"></div>
        </div>
      </section>

      <div class="routes-sheet__cta">
        <button class="btn btn--primary" data-action="continue-route">
          <span>${t("routes.cta")}</span>
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
        </button>
      </div>
    </section>
  `;

  host.appendChild(screen);
  requestAnimationFrame(() => screen.classList.add("is-active"));

  // Mount map
  const mapHost = screen.querySelector("[data-map]");
  mountMap(mapHost);

  // Card selection
  const cardEls = screen.querySelectorAll(".route-card");
  cardEls.forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.dataset.routeId;
      activeRouteId = id;
      cardEls.forEach((c) => c.classList.toggle("is-active", c === card));
    });
  });

  // Continue button
  screen
    .querySelector("[data-action=continue-route]")
    .addEventListener("click", () => navigate(`/route/${activeRouteId}`));

  // Bottom sheet drag
  const sheetEl = screen.querySelector("[data-sheet]");
  const sheet = attachSheet(sheetEl, { initial: "default" });

  // Tap on the handle area when collapsed → expand
  sheetEl.querySelector(".sheet__handle").addEventListener("click", () => {
    if (sheet.current === "collapsed") sheet.reset();
    else if (sheet.current === "default") sheet.expand();
  });

  // Weather + per-route status
  const weatherEl = screen.querySelector("[data-weather]");
  let weatherTimer = null;

  async function refreshWeather(force = false) {
    if (!weatherEl.dataset.state || weatherEl.dataset.state === "error") {
      weatherEl.dataset.state = "loading";
      weatherEl.innerHTML = `
        <header class="weather-section__head">
          <h3 class="weather-section__title">${t("weather.label")}</h3>
        </header>
        <div class="weather-section__body">
          <div class="weather-section__skeleton skeleton-shimmer"></div>
        </div>
      `;
    }
    try {
      const { data, offline } = await getWeather({ force });
      weatherEl.dataset.state = offline ? "offline" : "ok";
      const perRoute = ROUTES.map((r) => ({
        route: r,
        status: statusForRoute(r, data),
      }));
      weatherEl.innerHTML = renderWeatherSection(data, offline, perRoute, lang);
      weatherEl.addEventListener(
        "click",
        (e) => {
          if (e.target.closest("[data-route-jump]")) return;
          refreshWeather(true);
        },
        { once: true }
      );
      weatherEl.querySelectorAll("[data-route-jump]").forEach((el) => {
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          const id = el.dataset.routeJump;
          activeRouteId = id;
          cardEls.forEach((c) =>
            c.classList.toggle("is-active", c.dataset.routeId === id)
          );
          // scroll the matching card into view
          const cardEl = [...cardEls].find((c) => c.dataset.routeId === id);
          cardEl?.scrollIntoView({
            behavior: "smooth",
            inline: "start",
            block: "nearest",
          });
        });
      });
      // Per-route status pill on cards
      perRoute.forEach(({ route, status }, i) => {
        const slot = cardEls[i].querySelector("[data-status]");
        if (slot) {
          slot.dataset.statusValue = status;
          slot.innerHTML = renderStatusPill(status);
        }
      });
    } catch (err) {
      weatherEl.dataset.state = "error";
      weatherEl.innerHTML = `
        <header class="weather-section__head">
          <h3 class="weather-section__title">${t("weather.label")}</h3>
        </header>
        <div class="weather-section__body">
          <p class="weather-section__error">${t("weather.error")}</p>
        </div>
      `;
      weatherEl.addEventListener("click", () => refreshWeather(true), {
        once: true,
      });
    }
  }

  refreshWeather();
  // Quiet auto-refresh every 30 min while screen is mounted
  weatherTimer = setInterval(() => refreshWeather(true), 30 * 60 * 1000);

  return {
    teardown() {
      if (weatherTimer) clearInterval(weatherTimer);
      screen.classList.remove("is-active");
      setTimeout(() => screen.remove(), 320);
    },
  };
}

function routeCard(r, lang, isActive) {
  const diffKey =
    r.difficulty === "easy"
      ? "difficulty.easy"
      : r.difficulty === "medium"
      ? "difficulty.medium"
      : "difficulty.hard";

  const badgeBg =
    r.difficulty === "hard"
      ? "rgba(217,58,43,.92)"
      : r.difficulty === "medium"
      ? "rgba(232,161,74,.92)"
      : "rgba(74,155,114,.92)";

  return `
    <button class="route-card ${isActive ? "is-active" : ""}" data-route-id="${r.id}" role="listitem" aria-pressed="${isActive ? "true" : "false"}">
      <div class="route-card__media coastal-img" style="background-image:url('${r.cardImage}')">
        <span class="route-card__badge" style="background:${badgeBg}">${t(diffKey)}</span>
        <span class="route-card__status" data-status></span>
      </div>
      <div class="route-card__body">
        <h3 class="route-card__name">${r.name[lang]}</h3>
        <div class="route-card__chips">
          <span class="pill-chip">
            <svg class="icon icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/><path d="M3 18c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/></svg>
            ${t("stat.km", r.distanceKm)}
          </span>
          <span class="pill-chip pill-chip--neutral">
            <svg class="icon icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            ${t("stat.duration", r.durationHours)}
          </span>
          <span class="pill-chip pill-chip--neutral">
            <span class="difficulty-dot difficulty-dot--${r.difficulty}"></span>
            ${t("stat.pois", r.poiCount)}
          </span>
        </div>
      </div>
    </button>
  `;
}

function renderWeatherSection(w, offline, perRoute, lang) {
  const wind = w?.wind || {};
  const wave = w?.wave || {};
  const air = w?.air || {};
  const ageMin = relativeAge(w?.fetchedAt);
  const updatedLine = offline
    ? t("weather.offline")
    : ageMin === null
    ? ""
    : t("weather.updated", ageMin);
  const namedLabel = wind.named ? t("weather.named." + wind.named) : null;

  // The hero line — wind speed + direction, plus an interpretation phrase.
  const interpretation = describeWind(wind);

  return `
    <header class="weather-section__head">
      <h3 class="weather-section__title">${t("weather.label")}</h3>
    </header>

    <div class="weather-section__hero">
      <div class="weather-section__wind">
        <strong class="weather-section__wind-value">${wind.speed ?? "—"}</strong>
        <span class="weather-section__wind-unit">kn</span>
        <span class="weather-section__wind-dir">${wind.cardinal ?? "—"}</span>
      </div>
      ${
        namedLabel
          ? `<span class="weather-section__named">${namedLabel}</span>`
          : ""
      }
      ${
        interpretation
          ? `<p class="weather-section__interp">${interpretation}</p>`
          : ""
      }
    </div>

    <div class="weather-section__grid">
      ${statTile({
        label: tFallback("weather.wave.label", "Onatge"),
        value:
          wave.height != null ? `${wave.height} m` : "—",
        sub: wave.period ? `${wave.period} s` : null,
      })}
      ${statTile({
        label: tFallback("weather.air.label", "Aire"),
        value: air.temp != null ? `${air.temp}°` : "—",
        sub: air.uv != null ? `UV ${air.uv}` : null,
      })}
      ${statTile({
        label: tFallback("weather.sea.label", "Mar"),
        value: wave.seaTemp != null ? `${wave.seaTemp}°` : "—",
        sub: null,
      })}
      ${statTile({
        label: tFallback("weather.sunset.label", "Capvespre"),
        value: formatSunset(w?.sunset),
        sub: null,
      })}
    </div>

    <div class="weather-section__per-route">
      ${perRoute
        .map(
          ({ route, status }) => `
        <button class="per-route-row" data-route-jump="${route.id}" type="button">
          <span class="per-route-row__swatch" style="background:${route.color}"></span>
          <span class="per-route-row__name">${route.name[lang]}</span>
          <span class="status-pill status-pill--${status}">
            <span class="status-dot"></span>
            ${t("status." + status)}
          </span>
        </button>
      `
        )
        .join("")}
    </div>

    <footer class="weather-section__foot">
      <span>${updatedLine}</span>
    </footer>
  `;
}

// Plain-language interpretation of the current wind. Mirrors the
// adventurous-but-trustworthy voice from SKILL-sa-blava-mobile-ui.
function describeWind(wind) {
  if (!wind || typeof wind.speed !== "number") return null;
  const s = wind.speed;
  const gust = wind.gusts;
  const gustLine =
    gust && gust >= s + 5 ? ` · ${tFallback("weather.gusts", "ratxes")} ${gust} kn` : "";
  if (s < 6) return tFallback("weather.calm", "Mar plana, condicions ideals") + gustLine;
  if (s < 12) return tFallback("weather.gentle", "Brisa suau, navegació còmoda") + gustLine;
  if (s < 18)
    return tFallback("weather.fresh", "Vent fresc, atenció a la deriva") + gustLine;
  return tFallback("weather.strong", "Vent fort, condicions exigents") + gustLine;
}

function formatSunset(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function statTile({ label, value, sub }) {
  return `
    <div class="stat-tile">
      <span class="stat-tile__label">${label}</span>
      <strong class="stat-tile__value">${value}</strong>
      ${sub ? `<span class="stat-tile__sub">${sub}</span>` : ""}
    </div>
  `;
}

// Tiny shim — falls back to the literal default if a key isn't translated yet.
function tFallback(key, fallback) {
  const v = t(key);
  return v === key ? fallback : v;
}

function renderStatusPill(status) {
  const label =
    status === "go"
      ? t("status.go")
      : status === "caution"
      ? t("status.caution")
      : t("status.no-go");
  const dotClass = `status-dot status-dot--${status}`;
  return `
    <span class="status-pill status-pill--${status}">
      <span class="${dotClass}"></span>
      ${label}
    </span>
  `;
}

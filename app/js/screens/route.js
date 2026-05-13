import { findRoute } from "../data.js";
import { t, getLanguage } from "../i18n.js";
import { navigate } from "../router.js";
import { renderFocusedRouteMap } from "../map.js";
import { renderEmergencyPill } from "../emergency.js";

export function renderRouteScreen(host, routeId) {
  const route = findRoute(routeId);
  if (!route) {
    navigate("/routes");
    return { teardown() {} };
  }
  const lang = getLanguage();

  const screen = document.createElement("section");
  screen.className = "screen route-screen";
  screen.dataset.screen = "route";
  screen.dataset.routeId = routeId;

  const diffKey =
    route.difficulty === "easy"
      ? "difficulty.easy"
      : route.difficulty === "medium"
      ? "difficulty.medium"
      : "difficulty.hard";

  screen.innerHTML = `
    <div class="route-screen__scroll">
      <header class="route-hero" style="--route-color:${route.color}">
        <div class="route-hero__media coastal-img" style="background-image:url('${route.image}')"></div>
        <div class="route-hero__topbar">
          <button class="btn--icon" type="button" data-action="back" aria-label="${t("route.back")}">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <button class="btn--icon" type="button" data-action="share" aria-label="${t("route.share")}">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98"/><path d="m15.41 6.51-6.82 3.98"/></svg>
          </button>
        </div>
        <div class="route-hero__copy">
          <span class="route-hero__eyebrow">${t("routes.eyebrow")}</span>
          <h1 class="route-hero__title">${route.name[lang]}</h1>
          <p class="route-hero__tagline">${route.tagline[lang]}</p>
        </div>
      </header>

      <div class="route-stats">
        <div class="route-stats__item">
          <svg class="icon icon--lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/><path d="M3 18c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/></svg>
          <strong>${t("stat.km", route.distanceKm)}</strong>
        </div>
        <div class="route-stats__divider" aria-hidden="true"></div>
        <div class="route-stats__item">
          <svg class="icon icon--lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          <strong>${t("stat.duration", route.durationHours)}</strong>
        </div>
        <div class="route-stats__divider" aria-hidden="true"></div>
        <div class="route-stats__item">
          <span class="difficulty-dot difficulty-dot--${route.difficulty}" aria-hidden="true"></span>
          <strong>${t(diffKey)}</strong>
        </div>
      </div>

      <section class="route-section">
        <div class="route-section__head">
          <h2 class="route-section__title">${t("route.about")}</h2>
        </div>
        <p class="route-section__body">${route.description[lang]}</p>
      </section>

      <section class="route-section route-section--map">
        <div class="route-mini-map" data-mini-map></div>
      </section>

      <section class="route-section">
        <div class="route-section__head">
          <h2 class="route-section__title">${t("route.pois")}</h2>
          <span class="route-section__count">${t("route.poi.count", route.pois.length)}</span>
        </div>
        <ol class="poi-list" role="list">
          ${route.pois
            .map(
              (p, i) => `
            <li>
              <button class="poi-row" data-poi-index="${i}" type="button">
                <span class="poi-row__number" style="background:${route.color}">${i + 1}</span>
                <span class="poi-row__thumb coastal-img" style="background-image:url('${p.images[0]}')"></span>
                <span class="poi-row__copy">
                  <span class="poi-row__name">${p.name[lang]}</span>
                  <span class="poi-row__meta">${t("poi.type." + p.type)} · ${t("poi.minutes", p.minutesFromStart)}</span>
                </span>
                <svg class="icon poi-row__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </li>
          `
            )
            .join("")}
        </ol>
      </section>

      <div class="route-bottom-spacer" aria-hidden="true"></div>
    </div>

    <div class="route-screen__cta">
      <button class="btn btn--primary" data-action="start" style="background:${route.color}">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3v3"/><path d="M12 18v3"/><path d="M3 12h3"/><path d="M18 12h3"/><path d="M12 8l3 4-3 4"/></svg>
        <span>${t("route.cta")}</span>
      </button>
    </div>
  `;

  host.appendChild(screen);

  // Mini-map
  renderFocusedRouteMap(screen.querySelector("[data-mini-map]"), route, {
    height: 200,
  });

  // Emergency pill (Screens 3 + 4 only)
  const pill = renderEmergencyPill();
  screen.appendChild(pill);

  // Wire up events
  screen
    .querySelector("[data-action=back]")
    .addEventListener("click", () => navigate("/routes"));

  screen
    .querySelector("[data-action=share]")
    .addEventListener("click", async () => {
      try {
        if (navigator.share) {
          await navigator.share({
            title: `Sa Blava — ${route.name[lang]}`,
            text: route.tagline[lang],
            url: location.href,
          });
        }
      } catch {}
    });

  screen
    .querySelector("[data-action=start]")
    .addEventListener("click", () => navigate(`/route/${routeId}/poi/0`));

  screen.querySelectorAll("[data-poi-index]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = +btn.dataset.poiIndex;
      navigate(`/route/${routeId}/poi/${idx}`);
    });
  });

  requestAnimationFrame(() => screen.classList.add("is-active"));

  return {
    name: "route",
    routeId,
    el: screen,
    teardown() {
      screen.classList.remove("is-active");
      setTimeout(() => screen.remove(), 320);
    },
  };
}

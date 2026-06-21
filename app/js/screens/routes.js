import { ROUTES } from "../data.js";
import { t, getLanguage } from "../i18n.js";
import { navigate } from "../router.js";

export function renderRoutesScreen(host) {
  const screen = document.createElement("section");
  screen.className = "screen routes-screen";
  screen.dataset.screen = "routes";

  const lang = getLanguage();

  // Reuse the route detail screen's header (.route-screen__header / __back /
  // __heading) verbatim so the two pages share one header component — no visual
  // jump when navigating routes ↔ route detail.
  screen.innerHTML = `
    <header class="route-screen__header">
      <button class="route-screen__back" type="button" data-action="back" aria-label="${t("route.back")}">
        <img src="./assets/icons/regular/CaretLeft.svg" width="24" height="24" alt="" aria-hidden="true" />
      </button>
      <h1 class="route-screen__heading">${t("routes.listTitle")}</h1>
    </header>

    <div class="routes-screen__main">
      ${ROUTES.map((r, i) => routeCard(r, lang, i === 0)).join("")}
    </div>
  `;

  host.appendChild(screen);
  requestAnimationFrame(() => {
    screen.classList.add("is-active");
    screen.scrollTop = 0;
  });

  // ── Back → home (language screen) ─────────────────────────────────────────
  screen
    .querySelector("[data-action=back]")
    .addEventListener("click", () => navigate("/"));

  // ── Route cards → detail ──────────────────────────────────────────────────
  screen.querySelectorAll("[data-route-id]").forEach((card) => {
    card.addEventListener("click", () =>
      navigate(`/route/${card.dataset.routeId}`)
    );
  });

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

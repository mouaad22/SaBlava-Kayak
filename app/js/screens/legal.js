// screens/legal.js — "Privadesa i avís legal" (GDPR privacy & legal notice).
//
// Full-screen scrollable route (#/legal), reachable from the small "Privadesa
// i cookies" link on the language (home) screen footer. Content is fully
// translated (all 4 langs) and sourced from i18n.js "legal.*" keys — section
// *.body keys are arrays of paragraph strings rendered as <p> tags.

import { t } from "../i18n.js";
import { navigate } from "../router.js";

const ICON_BACK = `<img src="./assets/icons/regular/CaretLeft.svg" width="24" height="24" alt="" aria-hidden="true" />`;

// Each section pairs a heading key with a body key (array of paragraphs).
const SECTIONS = [
  ["legal.controller.heading", "legal.controller.body"],
  ["legal.data.heading", "legal.data.body"],
  ["legal.basis.heading", "legal.basis.body"],
  ["legal.cookies.heading", "legal.cookies.body"],
  ["legal.thirdparties.heading", "legal.thirdparties.body"],
  ["legal.retention.heading", "legal.retention.body"],
  ["legal.rights.heading", "legal.rights.body"],
  ["legal.changes.heading", "legal.changes.body"],
  ["legal.contact.heading", "legal.contact.body"],
];

function renderSection(headingKey, bodyKey) {
  const paragraphs = t(bodyKey);
  const body = Array.isArray(paragraphs) ? paragraphs : [paragraphs];
  return `
    <section class="legal-screen__section">
      <h2 class="legal-screen__heading">${t(headingKey)}</h2>
      ${body.map((p) => `<p class="legal-screen__p">${p}</p>`).join("")}
    </section>
  `;
}

export function renderLegalScreen(host) {
  const screen = document.createElement("section");
  screen.className = "screen legal-screen";
  screen.dataset.screen = "legal";

  screen.innerHTML = `
    <header class="legal-screen__header">
      <button class="legal-screen__back" type="button" data-action="back" aria-label="${t("route.back")}">${ICON_BACK}</button>
      <h1 class="legal-screen__title">${t("legal.title")}</h1>
    </header>
    <div class="legal-screen__body">
      <p class="legal-screen__updated">${t("legal.updated")}</p>
      <p class="legal-screen__p">${t("legal.intro")}</p>
      ${SECTIONS.map(([h, b]) => renderSection(h, b)).join("")}
    </div>
  `;

  host.appendChild(screen);
  requestAnimationFrame(() => {
    screen.classList.add("is-active");
    screen.scrollTop = 0;
  });

  screen
    .querySelector("[data-action=back]")
    .addEventListener("click", () => navigate("/"));

  return {
    name: "legal",
    teardown() {
      screen.classList.remove("is-active");
      setTimeout(() => screen.remove(), 320);
    },
  };
}

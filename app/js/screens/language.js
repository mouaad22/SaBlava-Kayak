import { LANGUAGES, t, setLanguage, getLanguage } from "../i18n.js";
import { navigate } from "../router.js";
import { FLAGS } from "../flags.js";

export function renderLanguageScreen(host) {
  const screen = document.createElement("section");
  screen.className = "screen lang-screen";
  screen.dataset.screen = "language";

  screen.innerHTML = `
    <div class="lang-screen__bg" aria-hidden="true">
      ${coastIllustration()}
    </div>

    <div class="lang-screen__content">
      <div class="lang-screen__hero">
        <div class="brand-mark" aria-hidden="true">
          ${brandGlyph()}
        </div>
        <h1 class="brand-name">Sa Blava</h1>
        <p class="brand-tagline" data-i18n="lang.tagline">${t("lang.tagline")}</p>
      </div>

      <p class="label-up lang-screen__list-label" data-i18n="lang.section">${t(
        "lang.section"
      )}</p>

      <div class="lang-list" role="radiogroup" aria-label="${t("lang.section")}">
        ${LANGUAGES.map(
          (l, i) => `
            <button
              type="button"
              class="lang-row"
              role="radio"
              aria-checked="${l.code === getLanguage() ? "true" : "false"}"
              data-lang="${l.code}"
              tabindex="${l.code === getLanguage() ? "0" : "-1"}"
            >
              <span class="lang-row__flag" aria-hidden="true">${FLAGS[l.code] || ""}</span>
              <span class="lang-row__name">${l.name}</span>
              <span class="lang-row__radio" aria-hidden="true"></span>
            </button>
          `
        ).join("")}
      </div>

      <div class="lang-screen__cta-wrap">
        <button class="btn btn--primary" data-action="continue">
          <span data-i18n="lang.cta">${t("lang.cta")}</span>
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  // Selection
  screen.querySelectorAll("[data-lang]").forEach((row) => {
    row.addEventListener("click", () => {
      const code = row.dataset.lang;
      setLanguage(code);
      screen.querySelectorAll("[data-lang]").forEach((r) => {
        const checked = r.dataset.lang === code;
        r.setAttribute("aria-checked", checked ? "true" : "false");
        r.tabIndex = checked ? 0 : -1;
      });
      // Re-localize visible strings on this screen
      screen
        .querySelectorAll("[data-i18n]")
        .forEach((n) => (n.textContent = t(n.dataset.i18n)));
    });
  });

  screen
    .querySelector("[data-action=continue]")
    .addEventListener("click", () => navigate("/routes"));

  host.appendChild(screen);
  requestAnimationFrame(() => screen.classList.add("is-active"));

  return {
    teardown() {
      screen.classList.remove("is-active");
      setTimeout(() => screen.remove(), 320);
    },
  };
}

function brandGlyph() {
  // Stylized wave + kayak silhouette
  return `
    <svg viewBox="0 0 64 64" class="brand-mark__glyph" aria-hidden="true">
      <defs>
        <linearGradient id="bm-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0B6E8C"/>
          <stop offset="100%" stop-color="#0A4D6B"/>
        </linearGradient>
      </defs>
      <path d="M 6 38 Q 18 30 32 38 T 58 38" stroke="url(#bm-grad)" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M 4 48 Q 18 42 32 48 T 60 48" stroke="url(#bm-grad)" stroke-width="2.4" fill="none" opacity="0.65" stroke-linecap="round"/>
      <path d="M 18 28 L 32 14 L 46 28 L 32 22 Z" fill="url(#bm-grad)" opacity="0.9"/>
      <circle cx="32" cy="22" r="2.2" fill="#FF8C6B"/>
    </svg>
  `;
}

function coastIllustration() {
  // Faint coastline backdrop — limestone cliff silhouette + horizon line.
  return `
    <svg viewBox="0 0 390 600" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lang-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#bbd5d8" stop-opacity="0"/>
          <stop offset="100%" stop-color="#bbd5d8" stop-opacity="0.85"/>
        </linearGradient>
      </defs>
      <!-- horizon water -->
      <rect x="0" y="380" width="390" height="220" fill="url(#lang-water)"/>
      <!-- water ripples -->
      <g stroke="#7e9aa3" stroke-width="0.6" fill="none" opacity="0.45">
        <path d="M 0 460 Q 60 454 120 460 T 240 460 T 390 460"/>
        <path d="M 0 488 Q 70 482 140 488 T 280 488 T 390 488"/>
        <path d="M 0 520 Q 80 514 160 520 T 320 520 T 390 520"/>
        <path d="M 0 552 Q 60 546 120 552 T 240 552 T 390 552"/>
      </g>
      <!-- limestone cliffs silhouette -->
      <path d="M -10 420 L 30 380 L 60 400 L 100 360 L 140 390 L 180 350 L 220 395 L 260 372 L 310 405 L 360 380 L 400 410 L 400 460 L -10 460 Z" fill="#d8c8a0" opacity="0.65"/>
      <path d="M -10 440 L 50 410 L 90 425 L 140 405 L 200 430 L 260 415 L 320 432 L 400 420 L 400 480 L -10 480 Z" fill="#c9b48a" opacity="0.55"/>
      <!-- pines -->
      <g fill="#6f8a6c" opacity="0.65">
        <circle cx="40" cy="372" r="3"/>
        <circle cx="55" cy="378" r="2.6"/>
        <circle cx="78" cy="380" r="2"/>
        <circle cx="115" cy="356" r="3"/>
        <circle cx="155" cy="378" r="2.4"/>
        <circle cx="200" cy="346" r="3"/>
        <circle cx="245" cy="368" r="2.6"/>
        <circle cx="290" cy="394" r="2.6"/>
        <circle cx="332" cy="402" r="2.4"/>
      </g>
      <!-- distant kayak -->
      <g opacity="0.75">
        <ellipse cx="170" cy="495" rx="14" ry="2.2" fill="#0A4D6B"/>
        <path d="M 162 493 q 8 -5 16 0" stroke="#0A4D6B" stroke-width="1.2" fill="none"/>
      </g>
    </svg>
  `;
}

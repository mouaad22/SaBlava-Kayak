import { ROUTES } from "../data.js";
import { t, getLanguage } from "../i18n.js";
import { navigate } from "../router.js";
import { getWeather, windBannerData } from "../weather.js";
import { mountWindRose } from "../wind-rose.js";

// Screen 2 — Rutes (Paper artboard "2 — Rutes (bottom sheet)").
//
// Layout:
//   - Full-screen scrollable routes list (main content, behind the sheet).
//   - Collapsible bottom sheet at 50 vh — "Temps a Aiguablava" weather panel.
//     Drag handle behaviour mirrors the POI screen (poi.js / attachSheetDrag).
//
// Weather sheet panels:
//   Vent  — wind-rose Rive canvas + wind banner (speed · tier pill · copy).
//   Onatge, Sol — placeholders for future Rive scenes.

const TABS = [
  { id: "wind", labelKey: "weather.tab.wind" },
  { id: "wave", labelKey: "weather.tab.wave" },
  { id: "sun",  labelKey: "weather.tab.sun" },
];

const ICON_LOCATION = `<svg width="12" height="14" viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M6 0C3.24 0 1 2.24 1 5c0 3.75 5 9 5 9s5-5.25 5-9c0-2.76-2.24-5-5-5zm0 6.5A1.5 1.5 0 1 1 6 3.5a1.5 1.5 0 0 1 0 3z" fill="#3D6B4F"/></svg>`;

export function renderRoutesScreen(host) {
  const screen = document.createElement("section");
  screen.className = "screen routes-screen";
  screen.dataset.screen = "routes";

  const lang = getLanguage();
  let isCollapsed = false;

  screen.innerHTML = `
    <div class="routes-screen__main">
      <h1 class="routes-screen__list-heading">${t("routes.listTitle")}</h1>
      ${ROUTES.map((r, i) => routeCard(r, lang, i === 0)).join("")}
    </div>

    <div class="routes-sheet" role="complementary" aria-label="${t("routes.weatherTitle")}">
      <div class="routes-sheet__handle"
           role="button" tabindex="0"
           aria-label="Mostra o oculta el temps"></div>

      <div class="routes-sheet__header">
        <div class="weather-tabs routes-sheet__tabs" role="tablist" aria-label="${t("routes.weatherTitle")}">
          ${TABS.map((tab, i) => `
            <button type="button" role="tab"
              class="weather-tab${i === 0 ? " is-active" : ""}"
              data-tab="${tab.id}"
              aria-selected="${i === 0}"
            >${t(tab.labelKey)}</button>
          `).join("")}
        </div>
        <div class="routes-sheet__location">
          ${ICON_LOCATION}
          <span>Aiguablava</span>
        </div>
      </div>

      <div class="routes-sheet__scroll">
        <div class="weather-panel" data-panel="wind">
          <canvas class="wind-rose" data-wind-rose width="708" height="708" aria-label="Wind rose"></canvas>
          <div class="wind-banner" data-wind-banner aria-live="polite"></div>
        </div>
        <div class="weather-panel is-hidden" data-panel="wave"></div>
        <div class="weather-panel is-hidden" data-panel="sun"></div>
      </div>
    </div>
  `;

  host.appendChild(screen);
  requestAnimationFrame(() => {
    screen.classList.add("is-active");
    screen.scrollTop = 0;
  });

  const sheetEl  = screen.querySelector(".routes-sheet");
  const handleEl = screen.querySelector(".routes-sheet__handle");

  // ── Tab bar ────────────────────────────────────────────────────────────────
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

  // ── Route cards → detail ──────────────────────────────────────────────────
  screen.querySelectorAll("[data-route-id]").forEach((card) => {
    card.addEventListener("click", () =>
      navigate(`/route/${card.dataset.routeId}`)
    );
  });

  // ── Drag handle ───────────────────────────────────────────────────────────
  attachSheetDrag(handleEl, sheetEl,
    () => isCollapsed,
    (v) => {
      isCollapsed = v;
      sheetEl.classList.toggle("is-collapsed", isCollapsed);
    }
  );
  handleEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      isCollapsed = !isCollapsed;
      sheetEl.classList.toggle("is-collapsed", isCollapsed);
    }
  });

  // ── Wind rose + banner ────────────────────────────────────────────────────
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
    name: "routes",
    teardown() {
      screen.classList.remove("is-active");
      if (rose) rose.cleanup();
      setTimeout(() => screen.remove(), 320);
    },
  };
}

// ─── Wind banner markup ───────────────────────────────────────────────────────
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

// ─── Drag-to-resize bottom sheet ──────────────────────────────────────────────
// Same algorithm as poi.js / attachSheetDrag. A tap (< 6 px movement) toggles;
// a real drag snaps to whichever snap point the finger ends closer to.
function attachSheetDrag(handleEl, sheetEl, getCollapsed, setCollapsed) {
  let dragging       = false;
  let wasDragging    = false;
  let startY         = 0;
  let startTranslate = 0;
  let activePointer  = null;

  function peek() {
    const v = parseFloat(
      getComputedStyle(sheetEl).getPropertyValue("--routes-collapsed-peek")
    );
    return Number.isFinite(v) ? v : 72;
  }

  function maxOffset() {
    return Math.max(0, sheetEl.getBoundingClientRect().height - peek());
  }

  handleEl.addEventListener("pointerdown", (e) => {
    if (dragging || (e.button && e.button !== 0)) return;
    dragging       = true;
    wasDragging    = false;
    activePointer  = e.pointerId;
    startY         = e.clientY;
    startTranslate = getCollapsed() ? maxOffset() : 0;
    try { handleEl.setPointerCapture(e.pointerId); } catch {}
    sheetEl.classList.add("is-dragging");
  });

  handleEl.addEventListener("pointermove", (e) => {
    if (!dragging || e.pointerId !== activePointer) return;
    const dy = e.clientY - startY;
    if (Math.abs(dy) > 6) wasDragging = true;
    const next = Math.max(0, Math.min(maxOffset(), startTranslate + dy));
    sheetEl.style.transform = `translateY(${next}px)`;
  });

  function finish(e) {
    if (!dragging || e.pointerId !== activePointer) return;
    dragging = false;
    try { handleEl.releasePointerCapture(activePointer); } catch {}
    activePointer = null;

    const dy  = e.clientY - startY;
    const max = maxOffset();
    let shouldCollapse;

    if (!wasDragging) {
      shouldCollapse = !getCollapsed();
    } else if (max <= 0) {
      shouldCollapse = getCollapsed();
    } else {
      const ratio = Math.min(1, Math.max(0, (startTranslate + dy) / max));
      shouldCollapse = ratio > 0.5;
    }

    if (shouldCollapse !== getCollapsed()) setCollapsed(shouldCollapse);

    sheetEl.classList.remove("is-dragging");
    sheetEl.style.transform = "";
    wasDragging = false;
  }

  handleEl.addEventListener("pointerup",     finish);
  handleEl.addEventListener("pointercancel", finish);
}

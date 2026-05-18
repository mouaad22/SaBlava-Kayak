import { findRoute } from "../data.js";
import { t, getLanguage } from "../i18n.js";
import { navigate } from "../router.js";
import { renderFocusedRouteMap } from "../map.js";
import { renderEmergencyPill } from "../emergency.js";
import { attachSheet } from "../sheet.js";

export function renderPoiOverlay(host, routeId, poiIndex) {
  const route = findRoute(routeId);
  if (!route) {
    navigate("/routes");
    return { teardown() {} };
  }
  const lang = getLanguage();
  let currentIndex = clamp(poiIndex, 0, route.pois.length - 1);

  // Backdrop dims the underlying route screen
  const backdrop = document.createElement("div");
  backdrop.className = "poi-backdrop";
  host.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add("is-visible"));

  // The sheet itself is its own positioned overlay
  const overlay = document.createElement("section");
  overlay.className = "poi-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");

  function buildSheet() {
    const poi = route.pois[currentIndex];
    overlay.innerHTML = `
      <div class="sheet poi-sheet" data-sheet>
        <div class="sheet__handle" data-sheet-grip></div>

        <div class="poi-sheet__scroll">
          <div class="poi-sheet__carousel" data-carousel>
            <span class="poi-sheet__badge" style="background:${route.color}">${currentIndex + 1}</span>
            <button class="btn--icon poi-sheet__close" type="button" data-action="close" aria-label="${t("poi.close")}">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
            <div class="poi-sheet__slides" data-slides>
              ${poi.images
                .map(
                  (src, i) => `
                <div class="poi-sheet__slide coastal-img" style="background-image:url('${src}')" data-slide="${i}"></div>
              `
                )
                .join("")}
            </div>
            <div class="poi-sheet__dots">
              ${poi.images
                .map(
                  (_, i) =>
                    `<span class="poi-sheet__dot ${i === 0 ? "is-active" : ""}" data-dot="${i}"></span>`
                )
                .join("")}
            </div>
          </div>

          <div class="poi-sheet__body">
            <div class="poi-sheet__header">
              <h1 class="poi-sheet__name">${poi.name[lang]}</h1>
              <p class="poi-sheet__type">${t("poi.type." + poi.type)} · ${t("poi.minutes", poi.minutesFromStart)}</p>
            </div>

            <div class="poi-sheet__chips">
              <span class="pill-chip pill-chip--neutral">
                <svg class="icon icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7-7 7-13a7 7 0 0 0-14 0c0 6 7 13 7 13z"/><circle cx="12" cy="9" r="2.5"/></svg>
                ${t("poi.depth", poi.depthM)}
              </span>
              <span class="pill-chip pill-chip--neutral">
                <svg class="icon icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17h18"/><path d="M5 17a7 7 0 0 1 14 0"/><path d="M12 4v3"/></svg>
                ${t("poi.shade." + poi.shade)}
              </span>
              <span class="pill-chip pill-chip--neutral">
                <svg class="icon icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h6"/><path d="M16 12h6"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3"/><path d="M12 19v3"/></svg>
                ${t("poi.snorkel")} ${"●".repeat(poi.snorkel)}${"○".repeat(5 - poi.snorkel)}
              </span>
            </div>

            <div class="poi-sheet__map" data-poi-map></div>

            <p class="poi-sheet__description">${
              poi.description?.[lang] ?? t("poi.description.placeholder")
            }</p>

            <div class="poi-sheet__actions">
              <button class="btn btn--ghost" type="button" data-action="open-map">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7-7 7-13a7 7 0 0 0-14 0c0 6 7 13 7 13z"/><circle cx="12" cy="9" r="2.5"/></svg>
                ${t("poi.openMap")}
              </button>
              <button class="btn btn--ghost" type="button" data-action="photos">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="m21 17-5-5-7 7"/></svg>
                ${t("poi.photos")}
              </button>
            </div>
          </div>
        </div>

        <nav class="poi-sheet__nav">
          <button class="btn btn--ghost poi-sheet__nav-btn" type="button" data-action="prev" ${currentIndex === 0 ? "disabled" : ""}>
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            <span>${t("poi.prev")}</span>
          </button>
          <span class="poi-sheet__counter">${currentIndex + 1} / ${route.pois.length}</span>
          <button class="btn btn--ghost poi-sheet__nav-btn" type="button" data-action="next" ${currentIndex === route.pois.length - 1 ? "disabled" : ""}>
            <span>${t("poi.next")}</span>
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </nav>
      </div>
    `;

    // mini map focused on current POI
    renderFocusedRouteMap(overlay.querySelector("[data-poi-map]"), route, {
      height: 140,
      focusedPoiId: poi.id,
    });

    // Carousel — simple swipe via scroll + dot click
    const slides = overlay.querySelector("[data-slides]");
    const dots = overlay.querySelectorAll("[data-dot]");

    slides.addEventListener("scroll", () => {
      const idx = Math.round(slides.scrollLeft / slides.clientWidth);
      dots.forEach((d, i) => d.classList.toggle("is-active", i === idx));
    });

    dots.forEach((dot) => {
      dot.addEventListener("click", () => {
        const i = +dot.dataset.dot;
        slides.scrollTo({ left: i * slides.clientWidth, behavior: "smooth" });
      });
    });

    // Sheet drag
    const sheetEl = overlay.querySelector("[data-sheet]");
    attachSheet(sheetEl, { initial: "expanded" });

    // Buttons
    overlay
      .querySelector("[data-action=close]")
      .addEventListener("click", () => navigate(`/route/${routeId}`));
    overlay
      .querySelector("[data-action=open-map]")
      .addEventListener("click", () => {
        const [lon, lat] = poi.coords;
        window.open(
          `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
          "_blank",
          "noopener"
        );
      });
    overlay
      .querySelector("[data-action=photos]")
      .addEventListener("click", () => {
        slides.scrollTo({ left: 0, behavior: "smooth" });
      });
    overlay
      .querySelector("[data-action=prev]")
      .addEventListener("click", () => {
        if (currentIndex > 0) {
          currentIndex -= 1;
          buildSheet();
          history.replaceState(null, "", `#/route/${routeId}/poi/${currentIndex}`);
        }
      });
    overlay
      .querySelector("[data-action=next]")
      .addEventListener("click", () => {
        if (currentIndex < route.pois.length - 1) {
          currentIndex += 1;
          buildSheet();
          history.replaceState(null, "", `#/route/${routeId}/poi/${currentIndex}`);
        }
      });
  }

  buildSheet();
  host.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("is-active"));

  // Emergency pill — overlay layer so it sits above the dimmed backdrop
  const pill = renderEmergencyPill();
  overlay.appendChild(pill);

  function teardown() {
    overlay.classList.remove("is-active");
    backdrop.classList.remove("is-visible");
    setTimeout(() => {
      overlay.remove();
      backdrop.remove();
    }, 360);
  }

  // Click on backdrop closes overlay
  backdrop.addEventListener("click", () => navigate(`/route/${routeId}`));

  return {
    name: "poi",
    routeId,
    poiIndex: currentIndex,
    teardown,
  };
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

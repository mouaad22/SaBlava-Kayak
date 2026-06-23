// screens/route-summary.js — Editable route preview before navigation starts.
//
// Shows paid duration + estimated distance as stat cards, then a vertical
// timeline of selected POIs (first POI is the fixed start; others have a
// remove button). "Accepta i comença" pre-caches tiles then starts the session.

import { findRoute, MARINA } from "../data.js";
import { t, getLanguage } from "../i18n.js";
import { navigate } from "../router.js";
import { getDraft, saveDraft, startSession, clearDraft } from "../nav/session.js";
import { totalPathKm } from "../nav/geo.js";
import { precacheBbox } from "../nav/tile-cache.js";
import { getKayakId } from "../kayak.js";
import { getDeviceToken } from "../nav/device.js";

const ICON_BACK = `<img src="./assets/icons/regular/CaretLeft.svg" width="24" height="24" alt="" aria-hidden="true" />`;

const ICON_REMOVE = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
  <circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="1.5"/>
  <path d="M6 10h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

/**
 * @param {HTMLElement} host
 * @param {string} routeId
 */
export function renderRouteSummaryScreen(host, routeId) {
  const route = findRoute(routeId);

  const draft = getDraft(routeId);
  if (!draft) {
    navigate(`/route/${routeId}`);
    return { name: "summary", routeId, teardown() {} };
  }

  const { durationHours, includedPoiIndices: initialIndices, code: draftCode = "" } = draft;

  // POI[0] is always the fixed starting point — always keep it in the set.
  let includedSet = new Set([0, ...initialIndices]);

  const screen = document.createElement("section");
  screen.className = "screen summary-screen";
  screen.setAttribute("aria-label", t("summary.title"));

  screen.innerHTML = `
    <header class="summary-screen__header">
      <button class="btn btn--icon summary-screen__back" type="button" aria-label="${t("summary.back")}">
        ${ICON_BACK}
      </button>
    </header>

    <div class="summary-screen__content">
      <h1 class="summary-screen__title">${t("summary.title")}</h1>

      <div class="summary-screen__stat-cards">
        <div class="summary-stat-card">
          <span class="summary-stat-card__label">${t("summary.stat.time")}</span>
          <span class="summary-stat-card__value">${formatDuration(durationHours)}</span>
        </div>
        <div class="summary-stat-card">
          <span class="summary-stat-card__label">${t("summary.stat.dist")}</span>
          <span class="summary-stat-card__value" data-stat-dist>—</span>
        </div>
      </div>

      <h2 class="summary-screen__poi-heading">${t("summary.pois.title")}</h2>

      <ul class="summary-timeline" role="list"></ul>
    </div>

    <div class="summary-screen__footer">
      <button class="summary-screen__accept btn btn--primary" type="button">
        ${t("summary.accept")}
      </button>
    </div>

    <div class="preparing-overlay" hidden>
      <div class="preparing-overlay__card">
        <p class="preparing-overlay__title">${t("prepare.title")}</p>
        <p class="preparing-overlay__subtitle">${t("prepare.subtitle")}</p>
        <div class="preparing-overlay__bar-track">
          <div class="preparing-overlay__bar-fill"></div>
        </div>
        <p class="preparing-overlay__pct">0%</p>
      </div>
    </div>
  `;

  host.appendChild(screen);

  const timelineEl = screen.querySelector(".summary-timeline");
  const statDist   = screen.querySelector("[data-stat-dist]");
  const btnAccept  = screen.querySelector(".summary-screen__accept");
  const btnBack    = screen.querySelector(".summary-screen__back");
  const preparing  = screen.querySelector(".preparing-overlay");
  const barFill    = screen.querySelector(".preparing-overlay__bar-fill");
  const barPct     = screen.querySelector(".preparing-overlay__pct");

  const lang = getLanguage();

  function buildPath() {
    const pts = [MARINA.coords];
    for (const idx of [...includedSet].sort((a, b) => a - b)) {
      pts.push(route.pois[idx].coords);
    }
    pts.push(MARINA.coords);
    return pts;
  }

  function updateDist() {
    const km = totalPathKm(buildPath());
    statDist.textContent = `${km.toFixed(1)} km`;
  }

  function renderTimeline() {
    timelineEl.innerHTML = "";
    const sorted = [...includedSet].sort((a, b) => a - b);

    sorted.forEach((idx) => {
      const poi = route.pois[idx];
      if (!poi) return;
      const isStart = idx === 0;
      const poiName = poi.name[lang] ?? poi.name.ca;

      const li = document.createElement("li");
      li.className = `summary-timeline__item${isStart ? " summary-timeline__item--start" : ""}`;

      li.innerHTML = `
        <span class="summary-timeline__dot${isStart ? " summary-timeline__dot--open" : ""}"></span>
        <span class="summary-timeline__name">${poiName}</span>
        ${!isStart ? `<button class="summary-timeline__remove" type="button" data-remove="${idx}" aria-label="Remove ${poiName}">${ICON_REMOVE}</button>` : ""}
      `;

      timelineEl.appendChild(li);
    });

    timelineEl.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.remove);
        includedSet.delete(idx);
        saveDraft(routeId, {
          durationHours,
          includedPoiIndices: [...includedSet].sort((a, b) => a - b),
          code: draftCode,
        });
        renderTimeline();
        updateDist();
      });
    });
  }

  btnBack.addEventListener("click", () => navigate(`/route/${routeId}`));

  btnAccept.addEventListener("click", async () => {
    const sortedIndices = [...includedSet].sort((a, b) => a - b);

    preparing.hidden = false;
    barFill.style.width = "0%";
    barPct.textContent = "0%";

    let cacheOk = true;
    try {
      await precacheBbox(route.bbox, (done, total) => {
        const pct = Math.round((done / total) * 100);
        barFill.style.width = `${pct}%`;
        barPct.textContent = `${pct}%`;
      });
    } catch (e) {
      cacheOk = false;
      console.warn("[Sa Blava] Tile pre-cache failed — continuing online-only", e);
    }

    startSession({ routeId, durationHours, code: draftCode, includedPoiIndices: sortedIndices });
    clearDraft(routeId);

    // Best-effort: tell the server this rental started so it shows on the staff
    // board and becomes the authoritative clock. Fire-and-forget — the local
    // session above is the offline source of truth, and a slow/failed API must
    // never delay or abort navigation into the trip.
    reportSessionStart(durationHours);

    if (!cacheOk) showToast(screen, "Mapa pot no estar disponible sense xarxa", 4000);

    navigate(`/route/${routeId}/navigate`);
  });

  renderTimeline();
  updateDist();

  requestAnimationFrame(() => {
    screen.classList.add("is-active");
    screen.querySelector(".summary-screen__content")?.scrollTo(0, 0);
  });

  return {
    name: "summary",
    routeId,
    teardown() {
      screen.classList.remove("is-active");
      setTimeout(() => screen.remove(), 320);
    },
  };
}

function formatDuration(hours) {
  if (hours === 1.5) return "1h 30m";
  return `${hours}h`;
}

// Report the rental start to the session API. No-op when no QR was scanned
// (getKayakId() is null), and intentionally not awaited: the request is
// dispatched immediately (keepalive lets it outlive the screen teardown) and
// any failure is swallowed so the trip starts regardless of the network.
function reportSessionStart(durationHours) {
  const kayakId = getKayakId();
  if (!kayakId) return;
  try {
    fetch("/api/session/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kayak_id: kayakId,
        device_token: getDeviceToken(),
        duration_min: Math.round(durationHours * 60),
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* fetch unavailable — ignore, local session still runs the trip */
  }
}

function showToast(parent, message, durationMs = 3000) {
  const toast = document.createElement("div");
  toast.className = "summary-toast";
  toast.textContent = message;
  parent.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  setTimeout(() => {
    toast.classList.remove("is-visible");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, durationMs);
}

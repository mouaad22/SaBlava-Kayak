import { ROUTES } from "../data.js";
import { t, getLanguage } from "../i18n.js";
import { navigate } from "../router.js";
import { getWeather } from "../weather.js";

// Paper artboard 9UR-0 — "2 - See routes".
// Section 1: weather hero (watercolor scene placeholder for a Rive animation,
// with an absolute-positioned dialog above and an absolute-positioned wind /
// temp / waves strip below). Section 2: routes list ("Rutes" + 2 route cards).
//
// The dialog copy is static brand voice (always optimistic — "Les condicions
// avui son ideals"). The strip values come from weather.js (Open-Meteo) with
// the same cached/offline fallback used elsewhere; placeholders show "—" until
// the first reading lands.

const WIND_SVG = `<img class="weather-strip__icon" src="./assets/icons/regular/Wind.png" width="24" height="24" alt="" aria-hidden="true" />`;

const TEMP_SVG = `<img class="weather-strip__icon" src="./assets/icons/regular/ThermometerSimple.png" width="24" height="24" alt="" aria-hidden="true" />`;

const WAVE_SVG = `<img class="weather-strip__icon" src="./assets/icons/regular/Waves.png" width="24" height="24" alt="" aria-hidden="true" />`;

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
      <div class="routes-screen__animation" data-rive-placeholder>
        <div
          class="routes-screen__animation-img"
          role="img"
          aria-label="Aiguablava sea conditions"
          style="background-image:url('./assets/illustrations/mascot-ref-2.jpg');"
        ></div>
      </div>
    </div>

    <div class="weather-dialog">
      <span class="weather-dialog__text">${t("weather.dialog")}</span>
    </div>

    <div class="weather-strip" data-weather-strip>
      <div class="weather-strip__stat">
        ${WIND_SVG}
        <span class="weather-strip__value" data-stat="wind">— kn</span>
      </div>
      <div class="weather-strip__stat">
        ${TEMP_SVG}
        <span class="weather-strip__value" data-stat="temp">—°</span>
      </div>
      <div class="weather-strip__stat">
        ${WAVE_SVG}
        <span class="weather-strip__value" data-stat="wave">— m</span>
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
    // .routes-screen is itself the scroller — make sure we land at the top
    // (browser hash navigation otherwise preserves the previous y-offset,
    // hiding the weather heading under mobile browser chrome).
    screen.scrollTop = 0;
  });

  // Tap a card → route detail
  screen.querySelectorAll("[data-route-id]").forEach((card) => {
    card.addEventListener("click", () => {
      navigate(`/route/${card.dataset.routeId}`);
    });
  });

  // Dialog bubble — capture the static brand copy and clear it so we can
  // typewrite it in once the value count-up has landed. Hidden by CSS until
  // we add .is-revealed.
  const dialog = screen.querySelector(".weather-dialog");
  const dialogTextEl = screen.querySelector(".weather-dialog__text");
  const dialogFullText = dialogTextEl ? dialogTextEl.textContent : "";
  if (dialogTextEl) dialogTextEl.textContent = "";

  // Live weather → fill the strip; cached + offline fallback handled by weather.js
  const strip = screen.querySelector("[data-weather-strip]");
  (async () => {
    try {
      const { data } = await getWeather();
      fillStrip(strip, data);
    } catch {
      // Leave placeholder dashes — no error UI required by the design.
    }
    // After the values finish counting up (~1600ms), fade the bubble in then
    // typewrite the dialog text. Runs whether or not the fetch succeeded —
    // the copy is static brand voice and doesn't depend on the reading.
    setTimeout(() => revealDialog(dialog, dialogTextEl, dialogFullText), 1600);
  })();

  return {
    teardown() {
      screen.classList.remove("is-active");
      setTimeout(() => screen.remove(), 320);
    },
  };
}

function routeCard(r, lang, isFirst) {
  // Paper shows route A (sud) with a 376x184 image and route B (nord) with a
  // 352x202 image. We keep both per the design rather than normalising.
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

function fillStrip(strip, data) {
  if (!strip || !data) return;
  const wind = data.wind || {};
  const air = data.air || {};
  const wave = data.wave || {};

  // Kick off the icon fade-in in sync with the count-up.
  requestAnimationFrame(() => strip.classList.add("is-revealed"));

  const windEl = strip.querySelector('[data-stat="wind"]');
  const tempEl = strip.querySelector('[data-stat="temp"]');
  const waveEl = strip.querySelector('[data-stat="wave"]');

  if (windEl) {
    if (wind.speed != null) {
      const cardinal = wind.cardinal ? ` ${wind.cardinal}` : "";
      animateCount(windEl, wind.speed, {
        step: 1,
        format: (n) => `${Math.round(n)} kn${cardinal}`,
      });
    } else {
      windEl.textContent = "— kn";
    }
  }
  if (tempEl) {
    if (air.temp != null) {
      animateCount(tempEl, air.temp, {
        step: 1,
        format: (n) => `${Math.round(n)}°`,
      });
    } else {
      tempEl.textContent = "—°";
    }
  }
  if (waveEl) {
    if (wave.height != null) {
      animateCount(waveEl, wave.height, {
        step: 0.1,
        format: (n) => `${n.toFixed(1)} m`,
      });
    } else {
      waveEl.textContent = "— m";
    }
  }
}

// Fade the dialog bubble in, then type the line out letter by letter.
function revealDialog(dialog, textEl, fullText) {
  if (!dialog || !textEl || !fullText) return;
  dialog.classList.add("is-revealed");
  // Wait for the bubble fade to mostly land before the text starts arriving.
  setTimeout(() => typewrite(textEl, fullText), 180);
}

function typewrite(el, text, speed = 38) {
  // Bold while typing and for ~1s after the last character lands, then ease
  // back to regular weight — DM Sans is variable, so font-weight animates.
  el.classList.add("is-writing");
  let i = 0;
  function tick() {
    if (i >= text.length) {
      setTimeout(() => el.classList.remove("is-writing"), 1000);
      return;
    }
    i += 1;
    el.textContent = text.slice(0, i);
    setTimeout(tick, speed);
  }
  tick();
}

// Count-up from 0 with constant motion blur during the run, sharpening to
// crisp on landing. Popular "Apple-style" reveal — the rapid number churn
// reads as motion under the blur, and the final clear-up sells the value.
function animateCount(el, target, { step = 1, format, duration = 1600 } = {}) {
  if (typeof target !== "number" || isNaN(target)) {
    el.textContent = format ? format(0) : "0";
    return;
  }
  const start = performance.now();
  el.classList.add("is-counting");
  el.textContent = format(0);

  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    // ease-out quad — fast start, gentle landing
    const eased = 1 - (1 - t) * (1 - t);
    const raw = eased * target;
    const snapped = Math.round(raw / step) * step;
    el.textContent = format(snapped);
    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      el.textContent = format(target);
      el.classList.remove("is-counting");
    }
  }
  requestAnimationFrame(tick);
}

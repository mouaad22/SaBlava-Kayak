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

const WIND_SVG = `
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M17.464 17.5C17.464 18.296 17.148 19.059 16.585 19.621C16.023 20.184 15.259 20.5 14.464 20.5C13.18 20.5 11.937 19.663 11.511 18.511C11.446 18.325 11.456 18.122 11.54 17.944C11.624 17.766 11.774 17.628 11.958 17.56C12.142 17.491 12.346 17.498 12.525 17.578C12.705 17.659 12.845 17.806 12.917 17.989C13.127 18.557 13.808 19 14.464 19C14.862 19 15.243 18.842 15.524 18.561C15.806 18.279 15.964 17.898 15.964 17.5C15.964 17.102 15.806 16.721 15.524 16.439C15.243 16.158 14.862 16 14.464 16H3.964C3.765 16 3.574 15.921 3.434 15.78C3.293 15.64 3.214 15.449 3.214 15.25C3.214 15.051 3.293 14.86 3.434 14.72C3.574 14.579 3.765 14.5 3.964 14.5H14.464C15.259 14.5 16.023 14.816 16.585 15.379C17.148 15.941 17.464 16.704 17.464 17.5ZM11.464 10C12.259 10 13.023 9.684 13.585 9.121C14.148 8.559 14.464 7.796 14.464 7C14.464 6.204 14.148 5.441 13.585 4.879C13.023 4.316 12.259 4 11.464 4C10.18 4 8.937 4.837 8.511 5.989C8.446 6.175 8.456 6.378 8.54 6.556C8.624 6.734 8.774 6.872 8.958 6.94C9.142 7.009 9.346 7.002 9.525 6.922C9.705 6.841 9.845 6.694 9.917 6.511C10.127 5.943 10.808 5.5 11.464 5.5C11.862 5.5 12.243 5.658 12.524 5.939C12.806 6.221 12.964 6.602 12.964 7C12.964 7.398 12.806 7.779 12.524 8.061C12.243 8.342 11.862 8.5 11.464 8.5H2.464C2.265 8.5 2.074 8.579 1.934 8.72C1.793 8.86 1.714 9.051 1.714 9.25C1.714 9.449 1.793 9.64 1.934 9.78C2.074 9.921 2.265 10 2.464 10H11.464ZM19.714 7C18.43 7 17.187 7.837 16.761 8.989C16.696 9.175 16.706 9.378 16.79 9.556C16.874 9.734 17.024 9.872 17.208 9.94C17.392 10.009 17.596 10.002 17.775 9.922C17.955 9.841 18.095 9.694 18.167 9.511C18.377 8.943 19.058 8.5 19.714 8.5C20.112 8.5 20.493 8.658 20.774 8.939C21.056 9.221 21.214 9.602 21.214 10C21.214 10.398 21.056 10.779 20.774 11.061C20.493 11.342 20.112 11.5 19.714 11.5H3.214C3.015 11.5 2.824 11.579 2.684 11.72C2.543 11.86 2.464 12.051 2.464 12.25C2.464 12.449 2.543 12.64 2.684 12.78C2.824 12.921 3.015 13 3.214 13H19.714C20.509 13 21.273 12.684 21.835 12.121C22.398 11.559 22.714 10.796 22.714 10C22.714 9.204 22.398 8.441 21.835 7.879C21.273 7.316 20.509 7 19.714 7Z" fill="#FFFFFF"/>
  </svg>
`;

const TEMP_SVG = `
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M12.75 14.344V8.25C12.75 8.051 12.671 7.86 12.53 7.72C12.39 7.579 12.199 7.5 12 7.5C11.801 7.5 11.61 7.579 11.47 7.72C11.329 7.86 11.25 8.051 11.25 8.25V14.344C10.543 14.526 9.927 14.96 9.517 15.565C9.107 16.169 8.932 16.902 9.024 17.627C9.116 18.351 9.469 19.017 10.017 19.5C10.565 19.982 11.27 20.248 12 20.248C12.73 20.248 13.435 19.982 13.983 19.5C14.531 19.017 14.884 18.351 14.976 17.627C15.068 16.902 14.893 16.169 14.483 15.565C14.073 14.96 13.457 14.526 12.75 14.344ZM12 18.75C11.703 18.75 11.413 18.662 11.167 18.497C10.92 18.332 10.728 18.098 10.614 17.824C10.501 17.55 10.471 17.248 10.529 16.957C10.587 16.666 10.73 16.399 10.939 16.189C11.149 15.98 11.416 15.837 11.707 15.779C11.998 15.721 12.3 15.751 12.574 15.864C12.848 15.978 13.082 16.17 13.247 16.417C13.412 16.663 13.5 16.953 13.5 17.25C13.5 17.648 13.342 18.029 13.061 18.311C12.779 18.592 12.398 18.75 12 18.75ZM15.75 12.563V4.5C15.75 3.505 15.355 2.552 14.652 1.848C13.948 1.145 12.995 0.75 12 0.75C11.005 0.75 10.052 1.145 9.348 1.848C8.645 2.552 8.25 3.505 8.25 4.5V12.563C7.28 13.339 6.574 14.399 6.232 15.594C5.89 16.789 5.927 18.061 6.339 19.233C6.75 20.406 7.516 21.422 8.53 22.141C9.544 22.86 10.757 23.246 12 23.246C13.243 23.246 14.456 22.86 15.47 22.141C16.484 21.422 17.25 20.406 17.661 19.233C18.073 18.061 18.11 16.789 17.768 15.594C17.425 14.399 16.72 13.339 15.75 12.563ZM12 21.75C11.042 21.75 10.109 21.444 9.336 20.877C8.564 20.31 7.993 19.511 7.706 18.597C7.419 17.683 7.432 16.701 7.742 15.794C8.052 14.888 8.643 14.104 9.429 13.556C9.529 13.487 9.61 13.394 9.666 13.286C9.722 13.179 9.751 13.059 9.75 12.938V4.5C9.75 3.903 9.987 3.331 10.409 2.909C10.831 2.487 11.403 2.25 12 2.25C12.597 2.25 13.169 2.487 13.591 2.909C14.013 3.331 14.25 3.903 14.25 4.5V12.938C14.25 13.058 14.279 13.177 14.335 13.284C14.391 13.391 14.472 13.483 14.571 13.553C15.359 14.099 15.952 14.883 16.263 15.791C16.574 16.698 16.587 17.681 16.3 18.596C16.013 19.512 15.441 20.311 14.667 20.879C13.894 21.446 12.959 21.751 12 21.75Z" fill="#FFFFFF"/>
  </svg>
`;

const WAVE_SVG = `
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M20.828 16.617C20.956 16.769 21.017 16.966 20.999 17.164C20.982 17.361 20.887 17.544 20.735 17.672C19.107 19.021 17.654 19.5 16.328 19.5C14.586 19.5 13.064 18.673 11.647 17.906C9.271 16.616 7.219 15.502 4.235 17.975C4.159 18.039 4.071 18.087 3.977 18.117C3.883 18.147 3.783 18.158 3.685 18.149C3.586 18.14 3.49 18.112 3.403 18.066C3.315 18.02 3.237 17.957 3.174 17.881C3.111 17.805 3.063 17.717 3.034 17.622C3.005 17.528 2.995 17.428 3.005 17.33C3.014 17.231 3.043 17.136 3.09 17.049C3.136 16.961 3.2 16.884 3.276 16.821C7.042 13.701 9.869 15.235 12.364 16.589C14.74 17.878 16.792 18.992 19.776 16.52C19.929 16.394 20.125 16.333 20.323 16.352C20.52 16.37 20.701 16.465 20.828 16.617ZM19.772 11.273C16.788 13.746 14.736 12.633 12.359 11.343C9.864 9.99 7.038 8.456 3.272 11.576C3.121 11.704 3.026 11.886 3.008 12.083C2.991 12.28 3.052 12.476 3.178 12.629C3.305 12.781 3.486 12.877 3.683 12.896C3.88 12.915 4.077 12.855 4.23 12.73C7.214 10.257 9.266 11.371 11.643 12.661C13.059 13.429 14.582 14.255 16.324 14.255C17.649 14.255 19.102 13.775 20.73 12.426C20.807 12.364 20.87 12.287 20.917 12.199C20.963 12.112 20.992 12.016 21.002 11.918C21.011 11.819 21.001 11.72 20.972 11.625C20.943 11.531 20.896 11.443 20.832 11.367C20.769 11.29 20.692 11.227 20.604 11.181C20.516 11.136 20.42 11.107 20.322 11.099C20.223 11.09 20.124 11.101 20.029 11.13C19.935 11.16 19.848 11.209 19.772 11.272V11.273ZM4.23 7.481C7.214 5.009 9.266 6.123 11.643 7.412C13.059 8.18 14.582 9.005 16.324 9.005C17.649 9.005 19.102 8.525 20.73 7.177C20.807 7.115 20.87 7.038 20.917 6.95C20.963 6.863 20.992 6.767 21.002 6.669C21.011 6.57 21.001 6.471 20.972 6.376C20.943 6.282 20.896 6.194 20.832 6.117C20.769 6.041 20.692 5.978 20.604 5.932C20.516 5.886 20.42 5.858 20.322 5.85C20.223 5.841 20.124 5.852 20.029 5.881C19.935 5.911 19.848 5.959 19.772 6.023C16.788 8.496 14.736 7.383 12.359 6.093C9.864 4.742 7.038 3.208 3.272 6.328C3.192 6.39 3.126 6.467 3.077 6.554C3.028 6.642 2.998 6.739 2.987 6.839C2.976 6.939 2.985 7.04 3.014 7.136C3.043 7.232 3.091 7.322 3.156 7.399C3.22 7.476 3.299 7.54 3.388 7.586C3.478 7.632 3.575 7.66 3.675 7.668C3.776 7.675 3.876 7.663 3.972 7.631C4.067 7.599 4.155 7.548 4.23 7.481Z" fill="#FFFFFF"/>
  </svg>
`;

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

  // Live weather → fill the strip; cached + offline fallback handled by weather.js
  const strip = screen.querySelector("[data-weather-strip]");
  (async () => {
    try {
      const { data } = await getWeather();
      fillStrip(strip, data);
    } catch {
      // Leave placeholder dashes — no error UI required by the design.
    }
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

  const windEl = strip.querySelector('[data-stat="wind"]');
  const tempEl = strip.querySelector('[data-stat="temp"]');
  const waveEl = strip.querySelector('[data-stat="wave"]');

  if (windEl) {
    windEl.textContent =
      wind.speed != null ? `${wind.speed} kn ${wind.cardinal || ""}`.trim() : "— kn";
  }
  if (tempEl) {
    tempEl.textContent = air.temp != null ? `${air.temp}°` : "—°";
  }
  if (waveEl) {
    waveEl.textContent = wave.height != null ? `${wave.height} m` : "— m";
  }
}

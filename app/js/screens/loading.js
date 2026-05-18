const DURATION_MS = 2200;

export function renderLoadingScreen(host, onComplete) {
  const screen = document.createElement("section");
  screen.className = "screen loading-screen";
  screen.dataset.screen = "loading";

  screen.innerHTML = `
    <div class="loading-screen__inner">
      <img
        class="loading-screen__logo"
        src="./assets/vectors/logo-saBlava.svg"
        alt="Sa Blava — Kayaks & Paddle Surf"
        width="329"
        height="179"
      />

      <div class="loading-screen__progress" aria-hidden="true">
        <div class="loading-screen__rail"></div>
        <div class="loading-screen__fill"></div>
        <img
          class="loading-screen__kayak"
          src="./assets/vectors/kayak.svg"
          alt=""
          width="56"
          height="39"
        />
      </div>
    </div>
  `;

  host.appendChild(screen);
  requestAnimationFrame(() => screen.classList.add("is-active"));

  // Kick off the kayak's run on the next frame so the transition catches.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => screen.classList.add("is-running"));
  });

  const advance = () => {
    screen.classList.remove("is-active");
    setTimeout(() => {
      screen.remove();
      if (typeof onComplete === "function") onComplete();
    }, 280);
  };

  const timer = setTimeout(advance, DURATION_MS);

  return {
    teardown() {
      clearTimeout(timer);
      screen.classList.remove("is-active");
      setTimeout(() => screen.remove(), 280);
    },
  };
}

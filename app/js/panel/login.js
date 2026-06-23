// app/js/panel/login.js — staff passcode screen.
// On success, calls onSuccess() so app.js can swap in the board.

import { login } from "./api.js";

export function renderLogin(host, onSuccess) {
  host.innerHTML = `
    <main class="panel-login">
      <form class="panel-login__card" novalidate>
        <h1 class="panel-login__title">Sa Blava · Control</h1>
        <p class="panel-login__subtitle">Introdueix el codi d'accés</p>
        <input
          class="panel-login__input"
          type="password"
          inputmode="numeric"
          autocomplete="off"
          aria-label="Codi d'accés"
          placeholder="••••"
        />
        <p class="panel-login__error" role="alert" hidden></p>
        <button class="panel-btn panel-btn--primary panel-login__submit" type="submit">Entrar</button>
      </form>
    </main>
  `;

  const form = host.querySelector(".panel-login__form, form");
  const input = host.querySelector(".panel-login__input");
  const error = host.querySelector(".panel-login__error");
  const submit = host.querySelector(".panel-login__submit");

  input.focus();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.hidden = true;
    submit.disabled = true;
    submit.textContent = "Comprovant…";

    const { ok } = await login(input.value);

    if (ok) {
      onSuccess();
      return;
    }

    submit.disabled = false;
    submit.textContent = "Entrar";
    error.textContent = "Codi incorrecte";
    error.hidden = false;
    input.value = "";
    input.focus();
  });
}

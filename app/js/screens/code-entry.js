// screens/code-entry.js — Full-screen 6-digit rental code entry.
//
// Replaces the old start-modal overlay. Shows individual digit boxes with
// auto-advance and paste support. On a valid code, saves the draft and
// navigates to the route summary screen.

import { t, getLanguage } from "../i18n.js";
import { navigate } from "../router.js";
import { parseCode, isValidForToday } from "../nav/code.js";
import { saveDraft } from "../nav/session.js";
import { prime as primeAudio } from "../nav/audio.js";
import { findRoute } from "../data.js";

const ICON_BACK = `<img src="./assets/icons/regular/CaretLeft.svg" width="24" height="24" alt="" aria-hidden="true" />`;

/**
 * @param {HTMLElement} host
 * @param {string} routeId
 */
export function renderCodeEntryScreen(host, routeId) {
  const screen = document.createElement("section");
  screen.className = "screen code-entry-screen";

  screen.innerHTML = `
    <header class="code-entry-screen__header">
      <button class="btn btn--icon code-entry-screen__back" type="button" aria-label="${t("code.back")}">
        ${ICON_BACK}
      </button>
    </header>

    <div class="code-entry-screen__body">
      <p class="code-entry-screen__title">${t("code.title")}</p>

      <div class="code-entry-screen__digits" role="group" aria-label="${t("code.title")}">
        ${Array.from({ length: 6 }, (_, i) => `
          <input
            class="code-entry-screen__digit"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            maxlength="1"
            data-digit-idx="${i}"
            aria-label="Digit ${i + 1} of 6"
            autocomplete="off"
          />
        `).join("")}
      </div>

      <p class="code-entry-screen__error" aria-live="polite" hidden></p>

      <button class="code-entry-screen__continue btn btn--primary" type="button" disabled>
        ${t("code.continue")}
      </button>
    </div>
  `;

  host.appendChild(screen);

  const backBtn     = screen.querySelector(".code-entry-screen__back");
  const digitInputs = [...screen.querySelectorAll(".code-entry-screen__digit")];
  const errorEl     = screen.querySelector(".code-entry-screen__error");
  const continueBtn = screen.querySelector(".code-entry-screen__continue");

  backBtn.addEventListener("click", () => navigate(`/route/${routeId}`));

  function getCode() {
    return digitInputs.map((i) => i.value).join("");
  }

  function validate() {
    const raw = getCode();
    if (raw.length < 6) return null;
    const parsed = parseCode(raw);
    return parsed && isValidForToday(parsed) ? parsed : null;
  }

  function syncButton() {
    const raw = getCode();
    if (raw.length < 6) {
      continueBtn.disabled = true;
      errorEl.hidden = true;
      return;
    }
    const parsed = validate();
    if (parsed) {
      continueBtn.disabled = false;
      errorEl.hidden = true;
    } else {
      continueBtn.disabled = true;
      errorEl.textContent = t("code.invalid");
      errorEl.hidden = false;
    }
  }

  digitInputs.forEach((input, idx) => {
    input.addEventListener("input", (e) => {
      const val = e.target.value.replace(/\D/g, "").slice(-1);
      e.target.value = val;
      if (val && idx < digitInputs.length - 1) {
        digitInputs[idx + 1].focus();
      }
      syncButton();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !input.value && idx > 0) {
        digitInputs[idx - 1].value = "";
        digitInputs[idx - 1].focus();
        syncButton();
      }
    });

    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData?.getData("text") ?? "").replace(/\D/g, "");
      for (let i = 0; i < pasted.length && idx + i < digitInputs.length; i++) {
        digitInputs[idx + i].value = pasted[i];
      }
      const next = Math.min(idx + pasted.length, digitInputs.length - 1);
      digitInputs[next].focus();
      syncButton();
    });

    // Select-all on focus so re-entering a digit replaces rather than appends.
    input.addEventListener("focus", () => input.select());
  });

  continueBtn.addEventListener("click", () => {
    const parsed = validate();
    if (!parsed) return;

    const { durationHours } = parsed;
    const route = findRoute(routeId);
    const countByHours = route?.durations?.countByHours ?? { 1: 5, 1.5: 8, 2: 8, 3: 9 };
    const defaultCount = countByHours[durationHours] ?? route?.pois?.length ?? 9;
    const includedPoiIndices = Array.from({ length: defaultCount }, (_, i) => i);

    primeAudio(getLanguage());
    saveDraft(routeId, { durationHours, includedPoiIndices, code: getCode() });
    navigate(`/route/${routeId}/summary`);
  });

  requestAnimationFrame(() => {
    screen.classList.add("is-active");
    digitInputs[0]?.focus();
  });

  return {
    name: "code",
    routeId,
    teardown() {
      screen.classList.remove("is-active");
      setTimeout(() => screen.remove(), 320);
    },
  };
}

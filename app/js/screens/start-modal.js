// screens/start-modal.js — Safety checklist + rental code modal.
//
// Injected as an overlay on top of the route detail screen (not a new route).
// On valid submit: primes audio, writes draft, navigates to #/route/:id/summary.

import { t, getLanguage } from "../i18n.js";
import { navigate } from "../router.js";
import { parseCode, isValidForToday } from "../nav/code.js";
import { saveDraft } from "../nav/session.js";
import { prime as primeAudio } from "../nav/audio.js";

// Maps durationId string → number of POIs to include by default.
// Mirrors the constant in route.js so the modal doesn't need to import route.js.
const POI_COUNT_BY_DURATION = { "1h": 5, "1h30": 8, "2h": 8, "3h": 9 };

// Maps durationId → durationHours (display-only until overridden by code).
const DURATION_HOURS = { "1h": 1, "1h30": 1.5, "2h": 2, "3h": 3 };

/**
 * Open the "Abans de començar" safety modal.
 *
 * @param {{ routeId: string, durationId: string }} opts
 *   routeId  — "sud" | "nord"
 *   durationId — "1h" | "1h30" | "2h" | "3h" (currently selected in route detail)
 */
export function openStartModal({ routeId, durationId }) {
  // Guard: only one modal at a time.
  if (document.querySelector(".start-modal")) return;

  // ── Build DOM ─────────────────────────────────────────────────────────────
  const overlay = document.createElement("div");
  overlay.className = "start-modal";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", t("modal.title"));

  overlay.innerHTML = `
    <div class="start-modal__backdrop"></div>
    <div class="start-modal__card">
      <h2 class="start-modal__title">${t("modal.title")}</h2>

      <ul class="start-modal__checklist" role="list">
        <li>
          <label class="start-modal__check-item">
            <input type="checkbox" data-check="jacket" />
            <span class="start-modal__check-label">${t("modal.check.jacket")}</span>
          </label>
        </li>
        <li>
          <label class="start-modal__check-item">
            <input type="checkbox" data-check="weather" />
            <span class="start-modal__check-label">${t("modal.check.weather")}</span>
          </label>
        </li>
        <li>
          <label class="start-modal__check-item">
            <input type="checkbox" data-check="return" />
            <span class="start-modal__check-label">${t("modal.check.return")}</span>
          </label>
        </li>
      </ul>

      <div class="start-modal__code-group">
        <label class="start-modal__code-label" for="start-modal-code">
          ${t("modal.code.label")}
        </label>
        <input
          id="start-modal-code"
          class="start-modal__code-input"
          type="text"
          inputmode="text"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="none"
          spellcheck="false"
          placeholder="${t("modal.code.placeholder")}"
          maxlength="14"
        />
        <p class="start-modal__code-error" aria-live="polite"></p>
      </div>

      <div class="start-modal__actions">
        <button class="start-modal__btn-cancel btn btn--ghost" type="button">
          ${t("modal.cancel")}
        </button>
        <button
          class="start-modal__btn-start btn btn--primary"
          type="button"
          disabled
        >
          ${t("modal.start")}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Animate in on next frame so the CSS transition fires.
  requestAnimationFrame(() => overlay.classList.add("is-open"));

  // ── Element refs ──────────────────────────────────────────────────────────
  const checkboxes = overlay.querySelectorAll('input[type="checkbox"]');
  const codeInput  = overlay.querySelector(".start-modal__code-input");
  const codeError  = overlay.querySelector(".start-modal__code-error");
  const btnStart   = overlay.querySelector(".start-modal__btn-start");
  const btnCancel  = overlay.querySelector(".start-modal__btn-cancel");

  // ── Validation helpers ────────────────────────────────────────────────────
  let parsedCode = null;

  function allChecked() {
    return [...checkboxes].every((cb) => cb.checked);
  }

  function validateCode() {
    const raw = codeInput.value.trim();
    if (!raw) {
      parsedCode = null;
      codeError.textContent = "";
      return false;
    }
    const parsed = parseCode(raw);
    if (!parsed || !isValidForToday(parsed)) {
      parsedCode = null;
      codeError.textContent = t("modal.code.invalid");
      return false;
    }
    parsedCode = parsed;
    codeError.textContent = "";
    return true;
  }

  function syncStartButton() {
    btnStart.disabled = !(allChecked() && validateCode());
  }

  // ── Event listeners ───────────────────────────────────────────────────────
  checkboxes.forEach((cb) => cb.addEventListener("change", syncStartButton));

  codeInput.addEventListener("input", () => {
    // Clear shake animation so it can re-trigger on next failed submit.
    codeInput.classList.remove("is-shaking");
    syncStartButton();
  });

  btnCancel.addEventListener("click", close);

  // Tap on backdrop also closes.
  overlay.querySelector(".start-modal__backdrop").addEventListener("click", close);

  // Trap focus: prevent Tab from escaping the modal.
  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { close(); return; }
    if (e.key !== "Tab") return;
    const focusable = [...overlay.querySelectorAll(
      'button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
    )];
    if (!focusable.length) return;
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
  });

  btnStart.addEventListener("click", () => {
    // Re-validate on submit in case the user typed a code and clicked quickly.
    if (!allChecked() || !validateCode()) {
      // Shake the code input to signal the error.
      codeInput.classList.remove("is-shaking");
      void codeInput.offsetWidth; // reflow to re-trigger animation
      codeInput.classList.add("is-shaking");
      return;
    }

    // Duration comes from the validated code (source of truth), not the
    // duration selector. durationId is only used as a fallback for POI count.
    const durationHours = parsedCode.durationHours;

    // Default POI selection: all POIs up to the count for the paid duration.
    // The closest matching durationId (by hours) determines default POI count.
    const defaultCount = defaultPoiCount(durationHours, durationId);
    const includedPoiIndices = Array.from({ length: defaultCount }, (_, i) => i);

    // Prime iOS audio context on this user gesture before any navigation.
    primeAudio(getLanguage());

    // Persist draft so the summary screen can restore it on refresh.
    // Include the raw code so the summary screen can forward it to startSession.
    saveDraft(routeId, { durationHours, includedPoiIndices, code: codeInput.value.trim() });

    close(false);
    navigate(`/route/${routeId}/summary`);
  });

  // Auto-focus the first unchecked checkbox for quick mobile interaction.
  requestAnimationFrame(() => {
    const firstCb = overlay.querySelector('input[type="checkbox"]');
    if (firstCb) firstCb.focus();
  });

  // ── Close ─────────────────────────────────────────────────────────────────
  function close(animate = true) {
    if (animate) {
      overlay.classList.remove("is-open");
      overlay.addEventListener("transitionend", () => overlay.remove(), { once: true });
    } else {
      overlay.remove();
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Map durationHours from the code to a POI count.
 * Falls back to durationId if no exact match (shouldn't happen in practice).
 */
function defaultPoiCount(durationHours, fallbackDurationId) {
  const byHours = { 1: "1h", 1.5: "1h30", 2: "2h", 3: "3h" };
  const id = byHours[durationHours] ?? fallbackDurationId;
  return POI_COUNT_BY_DURATION[id] ?? 9;
}

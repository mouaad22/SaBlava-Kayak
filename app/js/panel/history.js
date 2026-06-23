// app/js/panel/history.js — read-only session history (dispute record).
//
// A static snapshot (closed sessions don't tick), so no poll/timer: it fetches
// once on open. Each card is one closed rental — kayak, when it started, paid
// duration, when/why it closed, whether a second device scanned it — plus the
// raw event timeline underneath for the full audit trail. Catalan-only copy,
// matching the board.

import { getHistory } from "./api.js";

const REASON = {
  finished_early: { label: "Finalitzat aviat", cls: "early" },
  staff_return: { label: "Retornat", cls: "returned" },
  superseded: { label: "Relleu", cls: "handover" },
};

// Append-only event types (schema.sql) → staff-facing Catalan labels.
const EVENT_LABEL = {
  started: "Inici",
  resumed: "Représ",
  second_device: "2n dispositiu",
  expired: "Temps exhaurit",
  return_confirmed: "Retorn confirmat",
  finished_early: "Finalitzat aviat",
  superseded: "Rellevat",
};

const dtFmt = new Intl.DateTimeFormat("ca-ES", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const tFmt = new Intl.DateTimeFormat("ca-ES", { hour: "2-digit", minute: "2-digit" });

function fmtDur(min) {
  const h = min / 60;
  return `${String(h).replace(".", ",")} h`;
}

export function renderHistory(host, hooks = {}) {
  const { onUnauthorized, onBack } = hooks;

  host.innerHTML = `
    <div class="panel">
      <header class="panel__header">
        <div class="panel__heading">
          <button class="panel-btn panel-btn--ghost panel__back" data-back type="button" aria-label="Tornar">‹</button>
          <h1 class="panel__title">Historial</h1>
        </div>
        <button class="panel-btn panel-btn--ghost" data-logout type="button">Sortir</button>
      </header>
      <div class="panel__list" data-list aria-live="polite">
        <p class="panel__empty" data-empty>Carregant…</p>
      </div>
    </div>
  `;

  const listEl = host.querySelector("[data-list]");
  const emptyEl = host.querySelector("[data-empty]");
  host.querySelector("[data-back]").addEventListener("click", () => onBack?.());
  host.querySelector("[data-logout]").addEventListener("click", () => hooks.onLogout?.());

  function eventLine(events) {
    if (!events.length) return "";
    const parts = events.map((e) => `${EVENT_LABEL[e.type] ?? e.type} ${tFmt.format(e.at)}`);
    return `<div class="history-card__events">${parts.join(" · ")}</div>`;
  }

  function cardHtml(s) {
    const reason = REASON[s.closed_reason] ?? { label: s.closed_reason ?? "—", cls: "returned" };
    const badge = s.second_device
      ? `<span class="kayak-card__badge">2 dispositius</span>`
      : "";
    // Handovers (superseded) were never physically returned; label the close line accordingly.
    const closeLabel = s.closed_reason === "superseded" ? "Rellevat" : "Retorn";
    return `
      <article class="history-card" data-reason="${reason.cls}">
        <div class="history-card__num">${s.kayak_id}</div>
        <div class="history-card__main">
          <div class="history-card__row">
            <span class="history-card__t">Inici</span> ${dtFmt.format(s.started_at)}
            <span class="history-card__dur">· ${fmtDur(s.duration_min)}</span>
          </div>
          <div class="history-card__row">
            <span class="history-card__t">${closeLabel}</span> ${dtFmt.format(s.closed_at)}
          </div>
          ${eventLine(s.events)}
        </div>
        <div class="history-card__side">
          <span class="history-card__pill history-card__pill--${reason.cls}">${reason.label}</span>
          ${badge}
        </div>
      </article>
    `;
  }

  async function load() {
    const { ok, status, data } = await getHistory();
    if (status === 401) {
      onUnauthorized?.();
      return;
    }
    if (!ok || !data) {
      emptyEl.textContent = "Sense connexió — torna-ho a provar.";
      return;
    }
    if (!data.sessions.length) {
      emptyEl.textContent = "Encara no hi ha sortides tancades.";
      return;
    }
    listEl.innerHTML = data.sessions.map(cardHtml).join("");
  }

  load();

  return {
    refresh: load,
    stop() {
      /* no timers to clear — kept for app.js screen symmetry */
    },
  };
}

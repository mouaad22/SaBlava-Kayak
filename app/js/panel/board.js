// app/js/panel/board.js — the live staff board.
//
// Full-width kayak cards: col A big number · col B trip-progress bar + label ·
// col C status pill + action button. Polls /api/panel/board every 15s and ticks
// the countdown/bar locally every 1s (no per-second server calls). Cards are
// built once per poll; ticks only patch the dynamic bits so a card never flickers
// or loses an in-flight action (phase 2).
//
// Hooks (wired by app.js): onFinish(kayakId, cardEl) — phase 2 return action;
// onUnauthorized() — cookie expired, bounce to login.

import { getBoard } from "./api.js";

const POLL_MS = 15_000;
const TICK_MS = 1_000;
const MIN = 60_000;

const PILL = {
  active: "A l'aigua",
  time_off: "Temps exhaurit",
  available: "Al moll",
};

/** Pure: turn a board item + current time into everything the card displays. */
export function computeView(item, now) {
  // Client-derived state (a card can flip active -> time_off between polls).
  let state = "available";
  if (item.started_at != null) state = now >= item.expires_at ? "time_off" : "active";

  if (state === "available") {
    return { state, fillPct: 0, label: "—", pill: PILL.available, actionLabel: "", showAction: false };
  }

  const durationMs = item.duration_min * MIN;
  const elapsed = now - item.started_at;
  const fillPct = Math.max(0, Math.min(100, (elapsed / durationMs) * 100));

  if (state === "active") {
    const remainingMin = Math.ceil((item.expires_at - now) / MIN);
    return {
      state,
      fillPct,
      label: remainingMin >= 1 ? `${remainingMin} min restants` : "menys d'1 min",
      pill: PILL.active,
      actionLabel: "Finalitzar",
      showAction: true,
    };
  }

  // time_off
  const overMin = Math.max(0, Math.round((now - item.expires_at) / MIN));
  return {
    state,
    fillPct: 100,
    label: overMin >= 1 ? `${overMin} min passats` : "temps esgotat",
    pill: PILL.time_off,
    actionLabel: "Caiac retornat",
    showAction: true,
  };
}

export function renderBoard(host, hooks = {}) {
  const { onFinish, onUnauthorized } = hooks;

  host.innerHTML = `
    <div class="panel">
      <header class="panel__header">
        <h1 class="panel__title">Caiacs</h1>
        <div class="panel__meta">
          <span class="panel__status" data-status>Carregant…</span>
          <button class="panel-btn panel-btn--ghost" data-logout type="button">Sortir</button>
        </div>
      </header>
      <div class="panel__list" data-list aria-live="polite"></div>
    </div>
  `;

  const listEl = host.querySelector("[data-list]");
  const statusEl = host.querySelector("[data-status]");
  const logoutBtn = host.querySelector("[data-logout]");

  logoutBtn.addEventListener("click", () => hooks.onLogout?.());

  // kayak_id -> { el, item, refs }
  const cards = new Map();
  let lastSync = 0;

  function buildCard(item) {
    const el = document.createElement("article");
    el.className = "kayak-card";
    el.dataset.kayak = item.kayak_id;
    el.innerHTML = `
      <div class="kayak-card__num">${item.kayak_id}</div>
      <div class="kayak-card__main">
        <div class="kayak-card__track"><div class="kayak-card__fill"></div></div>
        <div class="kayak-card__label" data-label></div>
      </div>
      <div class="kayak-card__side">
        <span class="kayak-card__pill" data-pill></span>
        <button class="panel-btn kayak-card__action" data-action type="button" hidden></button>
      </div>
    `;
    const refs = {
      fill: el.querySelector(".kayak-card__fill"),
      label: el.querySelector("[data-label]"),
      pill: el.querySelector("[data-pill]"),
      action: el.querySelector("[data-action]"),
    };
    if (onFinish) {
      refs.action.addEventListener("click", () => onFinish(item.kayak_id, el));
    } else {
      refs.action.disabled = true; // phase 1: read-only
    }
    cards.set(item.kayak_id, { el, item, refs });
    return el;
  }

  function paintCard(entry, now) {
    const { item, el, refs } = entry;
    const v = computeView(item, now);
    el.dataset.state = v.state;
    refs.fill.style.width = `${v.fillPct}%`;
    refs.label.textContent = v.label;
    refs.pill.textContent = v.pill;
    if (v.showAction) {
      refs.action.hidden = false;
      refs.action.textContent = v.actionLabel;
    } else {
      refs.action.hidden = true;
    }
  }

  // Reconcile the DOM list to a fresh board payload (order may change).
  function applyBoard(items, now) {
    const seen = new Set();
    items.forEach((item, i) => {
      seen.add(item.kayak_id);
      let entry = cards.get(item.kayak_id);
      if (!entry) {
        buildCard(item);
        entry = cards.get(item.kayak_id);
      } else {
        entry.item = item;
      }
      paintCard(entry, now);
      // Keep DOM order in sync with the server's sort.
      const target = listEl.children[i];
      if (target !== entry.el) listEl.insertBefore(entry.el, target ?? null);
    });
    for (const [id, entry] of cards) {
      if (!seen.has(id)) {
        entry.el.remove();
        cards.delete(id);
      }
    }
  }

  function tick() {
    const now = Date.now();
    for (const entry of cards.values()) paintCard(entry, now);
    if (lastSync) {
      const ago = Math.round((now - lastSync) / 1000);
      statusEl.textContent = `Actualitzat fa ${ago}s`;
    }
  }

  async function poll() {
    const { ok, status, data } = await getBoard();
    if (status === 401) {
      onUnauthorized?.();
      return;
    }
    if (!ok || !data) {
      statusEl.textContent = "Sense connexió — reintentant…";
      return;
    }
    lastSync = Date.now();
    applyBoard(data.kayaks, lastSync);
  }

  let pollTimer = null;
  let tickTimer = null;

  poll();
  pollTimer = setInterval(poll, POLL_MS);
  tickTimer = setInterval(tick, TICK_MS);

  // Refresh immediately when the tab regains focus (staff glance back at it).
  const onVisible = () => document.visibilityState === "visible" && poll();
  document.addEventListener("visibilitychange", onVisible);

  return {
    refresh: poll,
    stop() {
      clearInterval(pollTimer);
      clearInterval(tickTimer);
      document.removeEventListener("visibilitychange", onVisible);
    },
  };
}

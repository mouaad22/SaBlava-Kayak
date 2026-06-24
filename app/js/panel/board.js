// app/js/panel/board.js — the live staff board.
//
// Full-width kayak cards: col A big number · col B trip-progress bar + label ·
// col C status pill + action button. Polls /api/panel/board every 15s and ticks
// the countdown/bar locally every 1s (no per-second server calls). Cards are
// built once per poll; ticks only patch the dynamic bits so a card never flickers
// or loses an in-flight action.
//
// Return action (phase 2): tapping Finalitzar / Caiac retornat confirms, removes
// the card optimistically, then POSTs /api/panel/finish. On success the next poll
// reconciles (the kayak reappears as available); on failure the card is restored
// and a toast explains. The whole interaction lives here because it needs the
// board's card/DOM state; api.js owns only the bare request.
//
// Hooks (wired by app.js): onUnauthorized() — cookie expired, bounce to login;
// onLogout() — the Sortir button.

import { getBoard, finishTrip } from "./api.js";

const POLL_MS = 15_000;
const TICK_MS = 1_000;
const MIN = 60_000;

const PILL = {
  active: "A l'aigua",
  time_off: "Temps exhaurit",
  available: "Al moll",
  pending_return: "Client ha finalitzat",
};

/** Pure: turn a board item + current time into everything the card displays. */
export function computeView(item, now) {
  // Client-derived state (a card can flip active -> time_off between polls).
  let state = "available";
  if (item.started_at != null) state = now >= item.expires_at ? "time_off" : "active";

  if (state === "available") {
    return { state, flagged: false, fillPct: 0, label: "—", pill: PILL.available, actionLabel: "", showAction: false };
  }

  // The customer tapped "finish" on their phone — a pending return. The kayak is
  // still out, so it keeps its time label (early vs overtime), but the pill flags
  // it and it sorts to the top (server-side) so staff confirm the return.
  const flagged = !!item.customer_ended;

  const durationMs = item.duration_min * MIN;
  const elapsed = now - item.started_at;
  const fillPct = Math.max(0, Math.min(100, (elapsed / durationMs) * 100));

  if (state === "active") {
    const remainingMin = Math.ceil((item.expires_at - now) / MIN);
    return {
      state,
      flagged,
      fillPct,
      label: remainingMin >= 1 ? `${remainingMin} min restants` : "menys d'1 min",
      pill: flagged ? PILL.pending_return : PILL.active,
      actionLabel: flagged ? "Caiac retornat" : "Finalitzar",
      showAction: true,
    };
  }

  // time_off
  const overMin = Math.max(0, Math.round((now - item.expires_at) / MIN));
  return {
    state,
    flagged,
    fillPct: 100,
    label: overMin >= 1 ? `${overMin} min passats` : "temps esgotat",
    pill: flagged ? PILL.pending_return : PILL.time_off,
    actionLabel: "Caiac retornat",
    showAction: true,
  };
}

export function renderBoard(host, hooks = {}) {
  const { onUnauthorized } = hooks;

  host.innerHTML = `
    <div class="panel">
      <header class="panel__header">
        <h1 class="panel__title">Caiacs</h1>
        <div class="panel__meta">
          <span class="panel__status" data-status>Carregant…</span>
          <button class="panel-btn panel-btn--ghost" data-history type="button">Historial</button>
          <button class="panel-btn panel-btn--ghost" data-logout type="button">Sortir</button>
        </div>
      </header>
      <div class="panel__list" data-list aria-live="polite"></div>
    </div>
    <div class="panel__toast" data-toast role="status" hidden></div>
  `;

  const listEl = host.querySelector("[data-list]");
  const statusEl = host.querySelector("[data-status]");
  const logoutBtn = host.querySelector("[data-logout]");
  const historyBtn = host.querySelector("[data-history]");
  const toastEl = host.querySelector("[data-toast]");

  logoutBtn.addEventListener("click", () => hooks.onLogout?.());
  historyBtn.addEventListener("click", () => hooks.onHistory?.());

  // kayak_id -> { el, item, refs }
  const cards = new Map();
  let lastSync = 0;
  let toastTimer = null;

  function buildCard(item) {
    const el = document.createElement("article");
    el.className = "kayak-card";
    el.dataset.kayak = item.kayak_id;
    el.innerHTML = `
      <div class="kayak-card__num">${item.kayak_id}</div>
      <div class="kayak-card__main">
        <div class="kayak-card__track"><div class="kayak-card__fill"></div></div>
        <div class="kayak-card__meta">
          <span class="kayak-card__label" data-label></span>
          <span class="kayak-card__badge" data-badge hidden>2 dispositius</span>
        </div>
      </div>
      <div class="kayak-card__side">
        <span class="kayak-card__pill" data-pill></span>
        <button class="panel-btn kayak-card__action" data-action type="button" hidden></button>
      </div>
    `;
    const refs = {
      fill: el.querySelector(".kayak-card__fill"),
      label: el.querySelector("[data-label]"),
      badge: el.querySelector("[data-badge]"),
      pill: el.querySelector("[data-pill]"),
      action: el.querySelector("[data-action]"),
    };
    const entry = { el, item, refs };
    refs.action.addEventListener("click", () => handleFinish(entry));
    cards.set(item.kayak_id, entry);
    return el;
  }

  function paintCard(entry, now) {
    const { item, el, refs } = entry;
    const v = computeView(item, now);
    el.dataset.state = v.state;
    // Pending return (customer finished, still out) — a styling/sort hook for CSS.
    if (v.flagged) el.dataset.flag = "pending_return";
    else delete el.dataset.flag;
    refs.fill.style.width = `${v.fillPct}%`;
    refs.label.textContent = v.label;
    // Soft, informational only: more than one phone scanned this live kayak
    // (two paddlers sharing a code, or a re-scan). Never an alarm — the clock
    // is never reset or blocked (SESSION-TRACKING-DESIGN.md §2 anti-fraud rule).
    refs.badge.hidden = !(item.second_device && v.state !== "available");
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

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
    }, 4000);
  }

  // Return action: confirm -> optimistic remove -> POST -> reconcile / restore.
  async function handleFinish(entry) {
    const { item, el, refs } = entry;
    const v = computeView(item, Date.now());
    const verb = v.state === "time_off" || v.flagged ? "retornat" : "finalitzat";
    if (!confirm(`Confirmar caiac ${item.kayak_id} ${verb}?`)) return;

    // Optimistic: drop the card now so the board feels instant.
    refs.action.disabled = true;
    el.remove();
    cards.delete(item.kayak_id);

    const { ok, status } = await finishTrip(item.kayak_id);
    if (status === 401) {
      onUnauthorized?.();
      return;
    }
    // 404 (no open session) means it was already closed — treat as success.
    if (ok || status === 404) {
      poll(); // re-sync: the kayak reappears as available
      return;
    }

    // Failure: put the card back and let the user retry.
    refs.action.disabled = false;
    cards.set(item.kayak_id, entry);
    listEl.appendChild(el);
    paintCard(entry, Date.now());
    showToast(`No s'ha pogut tancar el caiac ${item.kayak_id} — torna-ho a provar`);
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
      clearTimeout(toastTimer);
      document.removeEventListener("visibilitychange", onVisible);
    },
  };
}

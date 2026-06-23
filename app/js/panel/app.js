// app/js/panel/app.js — staff panel entry point.
// Decides login vs board, and swaps between them. Kept entirely separate from
// the customer app's module graph so a panel error can never blank the customer
// experience (the check-esm-links hook guards the customer side independently).

import { checkAuth, logout } from "./api.js";
import { renderLogin } from "./login.js";
import { renderBoard } from "./board.js";
import { renderHistory } from "./history.js";

const host = document.getElementById("panel-root");
let screen = null; // the live board/history handle, so we can stop its timers

function stopScreen() {
  screen?.stop?.();
  screen = null;
}

async function doLogout() {
  await logout();
  showLogin();
}

function showLogin() {
  stopScreen();
  renderLogin(host, showBoard);
}

function showBoard() {
  stopScreen();
  screen = renderBoard(host, {
    onUnauthorized: showLogin,
    onHistory: showHistory,
    onLogout: doLogout,
    // The return action lives inside board.js (it needs the card/DOM state);
    // the board POSTs /api/panel/finish itself.
  });
}

function showHistory() {
  stopScreen();
  screen = renderHistory(host, {
    onUnauthorized: showLogin,
    onBack: showBoard,
    onLogout: doLogout,
  });
}

async function boot() {
  const { ok, data } = await checkAuth();
  if (ok && data?.authenticated) showBoard();
  else showLogin();
}

boot();

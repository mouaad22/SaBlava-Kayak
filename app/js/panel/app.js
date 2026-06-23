// app/js/panel/app.js — staff panel entry point.
// Decides login vs board, and swaps between them. Kept entirely separate from
// the customer app's module graph so a panel error can never blank the customer
// experience (the check-esm-links hook guards the customer side independently).

import { checkAuth, logout } from "./api.js";
import { renderLogin } from "./login.js";
import { renderBoard } from "./board.js";

const host = document.getElementById("panel-root");
let board = null;

function stopBoard() {
  board?.stop();
  board = null;
}

function showLogin() {
  stopBoard();
  renderLogin(host, showBoard);
}

function showBoard() {
  stopBoard();
  board = renderBoard(host, {
    onUnauthorized: showLogin,
    onLogout: async () => {
      await logout();
      showLogin();
    },
    // onFinish (the return action) is wired in phase 2; without it the board is
    // read-only and the action buttons render disabled.
  });
}

async function boot() {
  const { ok, data } = await checkAuth();
  if (ok && data?.authenticated) showBoard();
  else showLogin();
}

boot();

#!/usr/bin/env bash
#
# smoke-test.sh — catch the kind of boot failure that turns the live site into
# a white screen BEFORE it deploys.
#
# Why this exists: ES-module import errors (e.g. importing a named export that
# doesn't exist) are invisible to `node --check` and to any tool that doesn't
# actually execute the module graph in a browser. One missing export aborts the
# whole graph rooted at app.js, so #screen-stack never mounts and every visitor
# gets a blank page. (That is exactly what happened once — map.js imported
# trackThroughPois before the export was committed to geo.js.)
#
# What it does: serves app/ locally, loads it in headless Chrome, and fails if
#   (a) the page logs an "Uncaught" error (the import/eval failure), or
#   (b) #screen-stack renders empty (nothing mounted).
#
# Usage:  bash scripts/smoke-test.sh
# Exit:   0 = app boots,  1 = white-screen / boot error,  2 = harness problem.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT=5173
URL="http://localhost:${PORT}/"
LOG="$(mktemp)"
DOM="$(mktemp)"
# Dedicated profile dir — without this a headless run collides with an already
# open Chrome on the default profile and hangs forever.
PROFILE="$(mktemp -d)"

# ── Locate Chrome (Windows + Linux/macOS fallbacks) ─────────────────────────
find_chrome() {
  local candidates=(
    "/c/Program Files/Google/Chrome/Application/chrome.exe"
    "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
    "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
    "$(command -v google-chrome 2>/dev/null)"
    "$(command -v chromium 2>/dev/null)"
    "$(command -v chromium-browser 2>/dev/null)"
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  )
  for c in "${candidates[@]}"; do
    [ -n "$c" ] && [ -x "$c" ] && { echo "$c"; return 0; }
  done
  return 1
}

CHROME="$(find_chrome)" || { echo "[smoke] SKIP: no Chrome/Chromium/Edge found." >&2; exit 2; }

# ── Start the local server ──────────────────────────────────────────────────
python "$ROOT/app/server.py" >/dev/null 2>&1 &
SERVER_PID=$!
cleanup() { kill "$SERVER_PID" 2>/dev/null; rm -rf "$LOG" "$DOM" "$PROFILE"; }
trap cleanup EXIT

# Wait (up to ~10s) for the server to answer.
for _ in $(seq 1 50); do
  if curl -sf -o /dev/null "$URL"; then ready=1; break; fi
  sleep 0.2
done
[ "${ready:-0}" = 1 ] || { echo "[smoke] FAIL: server never came up on :$PORT" >&2; exit 2; }

# ── Load the page in headless Chrome ────────────────────────────────────────
# Snapshot mid-splash: the loading screen mounts synchronously at boot but
# tears itself down after ~4s (before the first real screen mounts), so a
# late snapshot would land in the gap and see an empty stack even on success.
# A ~2.5s virtual-time budget is past import/eval (so gate 1 catches any error)
# but well inside the splash window (so gate 2 reliably sees a mounted screen).
"$CHROME" --headless=new --disable-gpu --no-sandbox \
  --user-data-dir="$PROFILE" --no-first-run --no-default-browser-check \
  --enable-logging=stderr --v=1 --virtual-time-budget=2500 \
  --dump-dom "$URL" >"$DOM" 2>"$LOG"

# ── Gate 1: any uncaught JS error during boot ───────────────────────────────
# This is the primary detector — the white-screen bug surfaced exactly here as
# "Uncaught SyntaxError: ... does not provide an export named ...".
if grep -q "INFO:CONSOLE.*Uncaught" "$LOG"; then
  echo "[smoke] FAIL: uncaught error during boot —" >&2
  grep -oE 'INFO:CONSOLE.*Uncaught.*' "$LOG" | head -3 | sed 's/^/[smoke]   /' >&2
  exit 1
fi

# ── Gate 2: did a screen actually mount into #screen-stack? ─────────────────
# If the module graph aborts, renderLoadingScreen never runs and no .screen
# element is ever appended — the hallmark of the white screen.
if ! grep -q 'class="screen' "$DOM"; then
  echo "[smoke] FAIL: no screen mounted into #screen-stack (white screen)." >&2
  exit 1
fi

echo "[smoke] OK: app booted and a screen mounted."
exit 0

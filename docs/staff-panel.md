# Staff Control Panel — Kayaks Out & Trip Timeline

> **Full spec:** [`SESSION-TRACKING-DESIGN.md`](../SESSION-TRACKING-DESIGN.md) (root). This doc is the **execution plan + phasing**; the manifest [`docs/staff-panel.json`](staff-panel.json) tracks which phase is done/next across sessions.

## Context

Staff at the dock have **no way to see which kayaks are on the water or for how long**. A rental "session" lives only in `localStorage` on the *customer's own phone* (`app/js/nav/session.js`); the rental code is validated entirely client-side (`app/js/nav/code.js`) and **nothing leaves the phone**. The `?k=07` from each kayak's QR (`app/js/kayak.js`) identifies the kayak but is never reported anywhere. There is also a real reliability bug: because the timer is client-only, a reload / re-scan / dead phone **resets the customer's clock** (it reset twice in one honest trip), with no record to settle disputes.

**Decision (owner):** go **server-authoritative** — the customer's "Start route" tap writes to a shared server; the panel reads it live — served at **`/panel/`** behind a **single shared staff passcode**.

**Outcome:** a clean, mobile-first staff board listing every kayak with a live trip-progress timeline, an "On water / Time off / At dock" status, and a one-tap "Kayak returned" action — backed by a small Cloudflare **D1** database that is the single source of truth for the rental clock.

**New for this repo:** this introduces a real backend (Cloudflare Pages **Functions + D1**), so `DEPLOYMENT-CLOUDFLARE.md`'s "100% static, no backend" note no longer holds. Provisioning D1 and setting secrets are **Cloudflare-dashboard actions only the owner can do** (see Owner setup). All code degrades gracefully: if the API is unreachable, the existing customer rental flow keeps working off `localStorage` exactly as today.

## Architecture

```
Customer phone (?k=07) ──POST /api/session/start──┐
                                                   ▼
                                          Cloudflare D1  ◄─GET /api/panel/board (15s poll)─ Staff panel /panel/
                                          sessions+events ─POST /api/panel/finish (return)─
```

- **Source of truth:** D1 `sessions`. The clock is `started_at` recorded once on the server; the phone only *displays* `now − started_at` read back, so reloads can't reset it.
- **Two lifecycles** (spec §2, don't conflate): *time axis* `active → time_off` derived from `now >= expires_at`; *physical axis* out → returned set only by staff (or early "finish trip"). A session is `closed` only when returned.
- **Anti-fraud rule (spec §2):** a second device scanning a kayak with a live clock gets the **real remaining time**, never a reset, never a block — logged `second_device`, shown as a soft badge, never an alarm.

## Phases

See [`docs/staff-panel.json`](staff-panel.json) for the per-task breakdown and verification checklist.

- **Phase 0 — Tooling, schema, dev seed.** `package.json` (wrangler), `wrangler.toml`, `schema.sql`, `functions/_lib/{db,sessions}.js`, `functions/api/dev/seed.js` (dev-flag-guarded).
- **Phase 1 — Read-only board (main deliverable).** `functions/api/panel/{login,board}.js`, `functions/_lib/auth.js`, `app/panel/index.html`, `app/js/panel/{api,login,board}.js`, `app/styles/panel.css`, `app/sw.js` `/api/` exclusion.
- **Phase 2 — Return action.** `functions/api/panel/finish.js` + button (confirm → optimistic → reconcile).
- **Phase 3 — Customer wiring (makes data real).** `app/js/nav/device.js`, `functions/api/session/{start,current}.js`, `route-summary.js` best-effort POST on accept, `session.js` server rehydrate.
- **Phase 4 — Polish + docs.** `second_device` badge, optional history view, update deploy docs.

## Owner setup (Cloudflare dashboard — cannot be scripted)

1. Create a D1 database; bind it as **`DB`** to the Pages project (and `wrangler.toml`).
2. Apply `schema.sql` (`wrangler d1 execute … --file schema.sql`, local + remote).
3. Set secrets **`STAFF_PASSCODE`** (staff login) and **`PANEL_SECRET`** (cookie signing).
4. Leave the seed endpoint's env flag **unset in production**.

## Verification

- **Local:** `npm install`, then `npx wrangler pages dev app` (serves customer app + Functions + local D1). `npm run db:init`, then `POST /api/dev/seed`. Open `http://localhost:8788/panel/`, log in, confirm the board shows `active`/`time_off`/`available`, the bar/countdown tick each second, the board refreshes ~15s, and **Kayak returned** removes a card. (`python app/server.py` still serves the plain customer app.)
- **Customer flow (phase 3):** run a rental with `?k=07`; confirm a row appears with the right duration; reload mid-trip and confirm the timer does **not** reset (rehydrated from server); kill the API and confirm the trip still starts.
- **Pre-push:** `check-esm-links.mjs` guards the customer app's module graph; panel JS stays separate ESM so a panel error can never white-screen the customer app.

## Constraints

- Vanilla JS modules + plain CSS, no bundler/framework, ESM only. Hash router stays for the customer app; the panel is a **separate entry** (`app/panel/index.html`).
- `app/server.py` stays frozen (it can't run Functions; local panel dev uses `wrangler pages dev`).
- The customer rental happy-path (code → summary → accept → navigate, wall-clock timer, map) must keep working with the API down.

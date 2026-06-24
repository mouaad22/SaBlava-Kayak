# Session Tracking + Staff Dashboard — Implementation Plan

A build plan for an agent. Goal: make rental sessions **server-authoritative** (so the customer's timer can never reset itself), and give staff a **phone dashboard** to see which kayaks are out, which are overdue, and confirm returns. Everything is logged for dispute resolution.

> Read this whole doc before coding. The dashboard (Part 5) is the deliverable, but it depends on the data model and API (Parts 3–4). A dev seed endpoint (Part 6, Phase 0) lets you build the dashboard against fake data without the customer app.

---

## 1. Why this exists (the problem)

Today the rental timer lives in the customer's browser, so a reload / re-scan / dead phone **resets it**, and there's no record. Customers dispute their time; staff can't prove anything. Real incident: the timer reset **twice** in one honest trip.

Fix: the clock is recorded **once on the server** when the customer taps **"Start route."** The phone only ever *displays* `now − started_at` read back from the server. Reloads re-read the same start time — there is nothing left to reset.

## 2. Core rules (the model — implement exactly)

Each customer phone holds an anonymous `device_token` (random id, stored in `localStorage`, also sent as a cookie). Each kayak QR carries its `kayak_id` (e.g. `?k=07`).

**On `POST /api/session/start { kayak_id, device_token }`:**

| Existing OPEN session on this kayak | Action | Logged event |
|---|---|---|
| None | Create a new active session | `started` |
| Exists, **expired** ("time off") | Close the old one, create a new one (handover) | `superseded` + `started` |
| Exists, **active**, **same** `device_token` | Return the existing session unchanged (resume) | `resumed` |
| Exists, **active**, **different** `device_token` | **Return the existing session — do NOT create a new one, do NOT block.** Just record the access. | `second_device` |

The last row is the key anti-fraud + anti-false-positive rule:

- A running clock means the kayak is **on the water**, so anyone scanning it is on that trip. There is no "next renter" to block.
- Honest renter whose phone died, on a friend's phone → sees their **real remaining time** (a feature).
- Cheater trying to reset → gets the **real countdown**, not a fresh start. Foiled silently. No "see staff" dead-end on open water.
- `second_device` is a **soft log signal**, surfaced as a small badge on the dashboard — **never** a blocking "FRAUD" alarm. Staff use the log only if a real dispute arises.

**Session has two independent lifecycles** — don't conflate them:

- **Time axis:** `active` → `expired` ("time off") when `now >= expires_at`. Automatic.
- **Physical axis:** out → returned. Only **staff** confirm return (or an early "finish trip"). A session is fully **closed** only when returned (regardless of time). An expired-but-not-returned session stays visible as 🟠 needing action.

## 3. Data model (Cloudflare D1 / SQLite)

```sql
CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,      -- uuid
  kayak_id      TEXT NOT NULL,
  started_at    INTEGER NOT NULL,      -- epoch ms
  duration_min  INTEGER NOT NULL,      -- paid duration
  expires_at    INTEGER NOT NULL,      -- started_at + duration_min*60000
  status        TEXT NOT NULL,         -- 'active' | 'expired' | 'closed'
  device_token  TEXT NOT NULL,         -- hashed
  returned_at   INTEGER,               -- staff confirm (nullable)
  returned_by   TEXT,                  -- staff name/id (nullable)
  closed_reason TEXT,                  -- 'staff_return' | 'finished_early' | 'superseded'
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX idx_sessions_kayak_open ON sessions(kayak_id) WHERE status != 'closed';

CREATE TABLE events (              -- append-only audit log; the dispute record
  id           TEXT PRIMARY KEY,
  session_id   TEXT,
  kayak_id     TEXT NOT NULL,
  type         TEXT NOT NULL,     -- started|resumed|second_device|customer_ended|expired|return_confirmed|finished_early|superseded
  device_token TEXT,              -- hashed, nullable
  at           INTEGER NOT NULL,  -- epoch ms
  meta         TEXT               -- JSON string, optional
);
CREATE INDEX idx_events_kayak ON events(kayak_id, at);
```

- `status = 'expired'` is **derived**, not stored eagerly — compute it as `status='active' AND now >= expires_at`. (Optionally a cron/Worker can flip the column for cleanliness, but the dashboard must not depend on it.)
- Kayak list: a static config array `KAYAKS = ['01','02',…]` is fine for v1 (no table needed). The board shows every kayak with its latest open session, if any.
- `device_token` and any PII-ish value is stored **hashed** (SHA-256). We never need the raw value, only equality.

## 4. API (Cloudflare Pages Functions, `functions/api/…`)

All under the same Pages project; D1 bound as `env.DB`.

| Method + path | Auth | Purpose |
|---|---|---|
| `POST /api/session/start` | none | Start/resume per the Part-2 table. Body `{ kayak_id, device_token, duration_min? }`. Returns the authoritative session `{ id, kayak_id, started_at, expires_at, status }`. |
| `GET /api/session/current?kayak_id=` | none | Latest open session for a kayak (customer timer rehydrate on reload). |
| `POST /api/session/end` | none | Customer tapped **"Finish trip"** on their phone. Body `{ kayak_id, device_token? }`. Logs `customer_ended` and flags the open session as a **pending return** — does **NOT** close it (the kayak is still physically out; staff confirm via `/api/panel/finish`). Idempotent and best-effort; a missing/closed session returns `ok` with `flagged:false`. |
| `GET /api/panel/board` | staff | Array of all kayaks with derived state for the dashboard (see shape below). |
| `POST /api/panel/finish` | staff | Body `{ kayak_id }` (or `session_id`). Sets `returned_at`, `status='closed'`, `closed_reason` = `finished_early` if before `expires_at` else `staff_return`. Logs `return_confirmed`/`finished_early`. |
| `POST /api/dev/seed` | dev only | Seeds fake kayaks/sessions in all states so the dashboard can be built standalone. Guard behind an env flag; never enabled in prod. |

`GET /api/panel/board` item shape (one per kayak):

```jsonc
{
  "kayak_id": "07",
  "state": "active",            // 'available' | 'active' | 'time_off' | 'closed'
  "session_id": "…",            // null when available
  "started_at": 1718020800000,  // null when available
  "expires_at": 1718024400000,
  "remaining_ms": 1320000,      // negative when over (time_off)
  "duration_min": 60,
  "second_device": true,        // soft badge; from a second_device event on this session
  "customer_ended": true        // pending return — customer tapped "finish"; still out, sorts to top
}
```

Derived `state`: no open session → `available`; open & `now < expires_at` → `active`; open & `now >= expires_at` → `time_off`; returned → `closed` (omit from default board, keep for history).

## 5. The staff dashboard (the deliverable)

**Where it lives:** a separate entry from the customer app — `app/panel/index.html` + `app/js/panel/` — so it never bundles into the customer experience. Reuses `app/styles/tokens.css` (colors, spacing, fonts) for consistency. Maps to `panel.sablavakayaks.com` (or `/panel/`) on the same Cloudflare Pages project. **Mobile-first / phone-sized** — staff use it on a phone at the kiosk and dock.

**Auth (v1):** a single shared staff passcode held as a Cloudflare **secret**. A login screen stores a signed token in a cookie; `panel` endpoints reject requests without it. This is a low-stakes internal tool — note the upgrade path (Cloudflare Access / per-staff logins) but don't build it now.

**Design:** follow the project's design skill (`aiguablava-kayak-design`) and existing tokens — Recoleta + DM Sans, the project palette. Utilitarian but on-brand; legibility in sunlight is the priority (high contrast, large tap targets).

### 5.1 Layout — list of full-width kayak cards

Vertical scroll list. **Each card spans the full screen width**, three columns left→right:

```
┌──────────────────────────────────────────────────────────────┐
│            │                              │   ┌────────────┐   │
│    07      │  ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░        │   │ 🟢 On water │   │
│  (big #    │   trip progress / status      │   └────────────┘   │
│  or photo) │   22 min left                 │   ┌────────────┐   │
│   ~25%     │                              │   │ Finish trip │   │
│            │                              │   └────────────┘   │
└──────────────────────────────────────────────────────────────┘
   col A (25%)        col B (flex)                col C (right)
```

- **Column A (~25% width):** the kayak **number, large** (Recoleta, big). Optionally a kayak image later; number is fine for v1.
- **Column B (flex, center):** a **progress bar / timeline** representing the trip — fills from 0→100% as elapsed time approaches `duration_min`; turns the over-time color and can overflow past 100% when in `time_off`. Below it, a short label (`22 min left` / `8 min over` / `—`). This is the "line/space that represents trip status."
- **Column C (right):** a **column of two stacked elements** —
  - **top:** the **status tag** (pill).
  - **bottom:** the **action button** — `Finish trip` (early return, when active) or `Kayak returned` (when in time_off). For `available` cards, no button (or a muted "At dock").

### 5.2 Card states (drive color + tag + button from `state`)

| `state` | Tag (top of col C) | Progress bar (col B) | Button (bottom of col C) | Notes |
|---|---|---|---|---|
| `active` | 🟢 **On water** | fills toward 100%, brand green | **Finish trip** | `remaining_ms` shown as `N min left`, counts down client-side |
| `time_off` | 🟠 **Time off** | full + overflow, amber/red | **Kayak returned** (primary, emphasized) | this is the staff's action queue — sort these to the top |
| `available` | ⚪ **At dock** | empty / muted | none | optionally collapse or filter out |
| `closed` | — | — | — | not on the live board; available in a History view |

- **`second_device` badge:** a small unobtrusive chip on the card (e.g. "2 devices") when true. Informational only — **not** styled as an alarm.
- **`customer_ended` (pending return):** when true the card overrides its tag to 🔵 **"Client ha finalitzat"** (brand-teal, not the amber alarm) and its button becomes **Kayak returned** — the customer signalled they're done, but the kayak is still out until staff confirm. The session is **not** closed by the customer's tap.
- **Sort order:** **pending return** (`customer_ended` & still out) first, then `time_off` (overtime), then `active` by soonest `expires_at`, then `available`.

### 5.3 Interactions

- **Live countdown:** compute remaining from `expires_at` and tick the label + progress bar **every second client-side** (no server call). **Poll `GET /api/panel/board` every ~15s** to pick up new sessions / state changes. Don't poll every second.
- **Finish trip / Kayak returned:** `POST /api/panel/finish { kayak_id }` → optimistic UI (card animates to closed/removed) → reconcile on next poll. On failure, restore the card and toast an error. A brief **confirm** ("Confirm 07 returned?") prevents fat-finger closes.
- **History (optional, low priority):** a tab listing recent `closed` sessions + their event log, for resolving a dispute. Read-only.

## 6. Build phases (for the agent)

- **Phase 0 — Scaffolding + seed.** D1 schema + binding. `POST /api/dev/seed` producing kayaks in every state (`active`, `time_off`, `second_device`, `available`). Lets the dashboard be built immediately.
- **Phase 1 — Dashboard read-only.** `GET /api/panel/board`, login/passcode gate, the full-width card list, all states, live countdown + 15s poll. **This is the bulk of the visible work.**
- **Phase 2 — Dashboard actions.** `POST /api/panel/finish` + the Finish/Returned buttons with confirm + optimistic update.
- **Phase 3 — Customer session API.** `POST /api/session/start` + `GET /api/session/current` with the full Part-2 rule table and the events log. Wire the customer app's **"Start route"** button to it and rehydrate the timer from the server on load.
- **Phase 4 — Polish.** `second_device` badge, sort order, History view, prod-disable the seed endpoint, error/toast states.

## 7. Assumptions / open items to confirm with the owner

- **Rental durations:** what `duration_min` values exist (fixed 60/120, or arbitrary)? Where does it come from at "Start route" — fixed, chosen, or from a booking/payment? Currently assumed passed into `start`.
- **Kayak IDs / count:** the real list and numbering of kayaks (for the `KAYAKS` config and QR generation).
- **Staff auth:** single shared passcode acceptable for v1? (Recommended yes; Cloudflare Access later.)
- **Panel hosting:** `panel.sablavakayaks.com` subdomain vs `/panel/` path — decide before DNS.
- **Customer "Start route" UX:** does tapping it need a confirm ("Start your 60-min trip now?") so a curious tap doesn't start the clock? Recommended yes.

## 8. Out of scope (v1)

- Payments / booking integration (the clock starts at "Start route"; payment linkage can come later).
- Per-staff accounts, roles, GPS tracking, push notifications.
- Customer identity beyond the anonymous `device_token`.

---

## Related docs
- [`DEPLOYMENT-CLOUDFLARE.md`](DEPLOYMENT-CLOUDFLARE.md) — hosting; the Functions + D1 live in the same Pages project.
- [`MAPBOX-TOKEN-SECURITY.md`](MAPBOX-TOKEN-SECURITY.md) — unrelated but part of go-live.

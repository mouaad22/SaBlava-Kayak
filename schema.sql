-- Sa Blava Kayak — session tracking schema (Cloudflare D1 / SQLite).
-- See SESSION-TRACKING-DESIGN.md §3 and docs/staff-panel.md.
--
-- Apply:  npm run db:init         (local dev)
--         npm run db:init:remote  (production)
--
-- The kayak list is a static config array in functions/_lib/sessions.js
-- (KAYAKS = ['01'..'20']) — no kayak table needed for v1.

-- One row per rental session. `status` 'expired' is DERIVED at read time
-- (active AND now >= expires_at), never stored — see deriveState().
CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,      -- uuid
  kayak_id      TEXT NOT NULL,
  started_at    INTEGER NOT NULL,      -- epoch ms (the authoritative clock)
  duration_min  INTEGER NOT NULL,      -- paid duration
  expires_at    INTEGER NOT NULL,      -- started_at + duration_min*60000
  status        TEXT NOT NULL,         -- 'active' | 'closed'  (expired is derived)
  device_token  TEXT NOT NULL,         -- SHA-256 hashed
  returned_at   INTEGER,               -- staff confirm (nullable)
  returned_by   TEXT,                  -- staff name/id (nullable)
  closed_reason TEXT,                  -- 'staff_return' | 'finished_early' | 'superseded'
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

-- Fast lookup of the open session for a kayak (the board + start rule).
CREATE INDEX IF NOT EXISTS idx_sessions_kayak_open
  ON sessions(kayak_id) WHERE status != 'closed';

-- Append-only audit log — the dispute record.
CREATE TABLE IF NOT EXISTS events (
  id           TEXT PRIMARY KEY,
  session_id   TEXT,
  kayak_id     TEXT NOT NULL,
  type         TEXT NOT NULL,  -- started|resumed|second_device|customer_ended|expired|return_confirmed|finished_early|superseded
  device_token TEXT,           -- hashed, nullable
  at           INTEGER NOT NULL,
  meta         TEXT            -- JSON string, optional
);

CREATE INDEX IF NOT EXISTS idx_events_kayak ON events(kayak_id, at);

-- ── Web Push (timed return-to-base alerts) ──────────────────────────────────────
-- See functions/_lib/push.js + docs/web-push.md. A subscription is scoped to the
-- session that was open when the phone subscribed, so a later rental on the same
-- kayak (a new session id) never inherits the previous paddler's subscription.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          TEXT PRIMARY KEY,      -- uuid
  session_id  TEXT NOT NULL,         -- the open session at subscribe time
  kayak_id    TEXT NOT NULL,
  endpoint    TEXT NOT NULL UNIQUE,  -- push service URL (the dedupe key)
  p256dh      TEXT NOT NULL,         -- subscription public key (base64url)
  auth        TEXT NOT NULL,         -- subscription auth secret (base64url)
  lang        TEXT NOT NULL DEFAULT 'ca',
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_push_subs_session ON push_subscriptions(session_id);

-- One row per (session, threshold) the dispatcher has fired. The PRIMARY KEY makes
-- INSERT OR IGNORE an atomic "send at most once" guard across overlapping cron runs.
CREATE TABLE IF NOT EXISTS push_sent (
  session_id TEXT NOT NULL,
  threshold  TEXT NOT NULL,          -- 't30' | 't15' | 't5' | 't0'
  sent_at    INTEGER NOT NULL,
  PRIMARY KEY (session_id, threshold)
);

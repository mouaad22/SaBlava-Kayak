-- migrations/0002_push.sql — Web Push tables (timed return-to-base alerts).
--
-- Idempotent; safe to apply on top of the live DB. The same tables also live in
-- schema.sql (the single source of truth) so a fresh db:init creates them too.
--
-- Apply:  npm run db:migrate:push         (local)
--         npm run db:migrate:push:remote  (production)

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL,
  kayak_id    TEXT NOT NULL,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  lang        TEXT NOT NULL DEFAULT 'ca',
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_push_subs_session ON push_subscriptions(session_id);

CREATE TABLE IF NOT EXISTS push_sent (
  session_id TEXT NOT NULL,
  threshold  TEXT NOT NULL,
  sent_at    INTEGER NOT NULL,
  PRIMARY KEY (session_id, threshold)
);

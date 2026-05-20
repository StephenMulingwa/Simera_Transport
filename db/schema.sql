-- Simera Transport Control Tower — run once against Neon (SQL editor or psql)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('admin', 'observer')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS login_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  logged_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS login_events_user_id_idx ON login_events (user_id);
CREATE INDEX IF NOT EXISTS login_events_logged_in_at_idx ON login_events (logged_in_at DESC);

CREATE TABLE IF NOT EXISTS incident_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  violation_type TEXT NOT NULL,
  violation_time TIMESTAMPTZ NOT NULL,
  location_text TEXT NOT NULL DEFAULT '',
  vehicle_registration TEXT NOT NULL DEFAULT '',
  comment_text TEXT NOT NULL,
  incident_fingerprint TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_text TEXT NOT NULL DEFAULT '',
  duration_sec INTEGER
);

CREATE INDEX IF NOT EXISTS incident_comments_created_at_idx ON incident_comments (created_at DESC);

-- Backfill for existing installations
ALTER TABLE incident_comments
  ADD COLUMN IF NOT EXISTS duration_text TEXT NOT NULL DEFAULT '';
ALTER TABLE incident_comments
  ADD COLUMN IF NOT EXISTS duration_sec INTEGER;

CREATE TABLE IF NOT EXISTS driver_phone_directory (
  id SERIAL PRIMARY KEY,
  phone_e164 TEXT NOT NULL UNIQUE,
  display_label TEXT
);

INSERT INTO driver_phone_directory (phone_e164, display_label) VALUES
  ('+254792162750', NULL),
  ('+254111224952', NULL),
  ('+254107600036', NULL)
ON CONFLICT (phone_e164) DO NOTHING;

-- Super Admin (non-deletable) is enforced in app code by email: lib/auth/superAdmin.ts

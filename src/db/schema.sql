-- Content Broadcasting System schema

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('principal', 'teacher');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          user_role NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ---------------------------------------------------------------------------
-- CONTENT SLOTS  (one row per subject)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_slots (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject    TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- CONTENT
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE content_status AS ENUM ('uploaded', 'pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS content (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  description      TEXT,
  subject          TEXT NOT NULL,
  file_url         TEXT NOT NULL,
  file_path        TEXT NOT NULL,
  file_type        TEXT NOT NULL,
  file_size        BIGINT NOT NULL,
  uploaded_by      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status           content_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  approved_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at      TIMESTAMPTZ,
  start_time       TIMESTAMPTZ,
  end_time         TIMESTAMPTZ,
  rotation_minutes INTEGER NOT NULL DEFAULT 5 CHECK (rotation_minutes > 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_time_window CHECK (
    (start_time IS NULL AND end_time IS NULL)
    OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  )
);

CREATE INDEX IF NOT EXISTS idx_content_uploaded_by ON content(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_content_status      ON content(status);
CREATE INDEX IF NOT EXISTS idx_content_subject     ON content(subject);
CREATE INDEX IF NOT EXISTS idx_content_window      ON content(start_time, end_time);

-- ---------------------------------------------------------------------------
-- CONTENT SCHEDULE  (rotation order per subject slot)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_schedule (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id     UUID NOT NULL REFERENCES content(id)       ON DELETE CASCADE,
  slot_id        UUID NOT NULL REFERENCES content_slots(id) ON DELETE CASCADE,
  rotation_order INTEGER NOT NULL DEFAULT 0,
  duration       INTEGER NOT NULL DEFAULT 5 CHECK (duration > 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (content_id, slot_id)
);

CREATE INDEX IF NOT EXISTS idx_schedule_slot ON content_schedule(slot_id, rotation_order);

-- ---------------------------------------------------------------------------
-- CONTENT VIEWS  (analytics — every public hit increments here)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_views (
  id         BIGSERIAL PRIMARY KEY,
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  subject    TEXT NOT NULL,
  viewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_views_content ON content_views(content_id);
CREATE INDEX IF NOT EXISTS idx_views_subject ON content_views(subject);
CREATE INDEX IF NOT EXISTS idx_views_teacher ON content_views(teacher_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger for content
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_content_updated_at ON content;
CREATE TRIGGER trg_content_updated_at
  BEFORE UPDATE ON content
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

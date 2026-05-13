-- ============================================================================
-- 001_initial_users_and_sessions.sql
-- Promet CF — Kullanıcılar, oturumlar, audit log altyapısı
-- ============================================================================

-- Eklentiler
CREATE EXTENSION IF NOT EXISTS "pgcrypto";        -- gen_random_uuid, password hashing
CREATE EXTENSION IF NOT EXISTS "citext";           -- case-insensitive email

-- Tablo tipini takip eden updated_at trigger fonksiyonu
CREATE OR REPLACE FUNCTION trg_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- USERS
-- ============================================================================
CREATE TYPE user_role AS ENUM ('viewer', 'editor', 'cfo', 'admin');

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(64) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,                    -- bcrypt/argon2
  full_name     VARCHAR(200),
  email         CITEXT UNIQUE,
  role          user_role NOT NULL DEFAULT 'viewer',
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_active ON users(active) WHERE active = TRUE;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ============================================================================
-- SESSIONS (refresh token persistence için)
-- ============================================================================
CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  ip_address    INET,
  user_agent    TEXT,
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_active ON sessions(user_id, expires_at)
  WHERE revoked_at IS NULL;

-- ============================================================================
-- AUDIT LOG
-- ============================================================================
CREATE TABLE audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INT REFERENCES users(id) ON DELETE SET NULL,
  username    VARCHAR(64),                        -- denormalize: kullanıcı silindiğinde de kalsın
  company_id  INT,                                -- FK eklenir (002)
  action      VARCHAR(80) NOT NULL,
  details     JSONB NOT NULL DEFAULT '{}',
  ip_address  INET,
  user_agent  TEXT,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user_time ON audit_logs(user_id, timestamp DESC);
CREATE INDEX idx_audit_company_time ON audit_logs(company_id, timestamp DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, timestamp DESC);
CREATE INDEX idx_audit_details_gin ON audit_logs USING GIN(details jsonb_path_ops);

-- partition önerisi: aylık partition (yüksek hacimde)
-- CREATE TABLE audit_logs_2026_01 PARTITION OF audit_logs FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

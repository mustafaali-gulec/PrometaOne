-- ============================================================================
-- 031_app_state.sql
-- Prometa One — Uygulama Durumu (app_state): genel amaçlı key→JSONB deposu.
-- Frontend'in localStorage'da tuttuğu (~5MB kotayı aşan) uygulama durumu
-- blob'unu sunucuya taşır. Anahtar (scope, key) ikilisidir; value JSONB'dir ve
-- pratikte büyüklük sınırı yoktur (çok-MB blob barındırabilir).
-- updated_at upsert sırasında açıkça set edilir; trigger gerekmez.
-- ============================================================================

CREATE TABLE app_state (
  scope      TEXT NOT NULL DEFAULT 'global',
  key        TEXT NOT NULL,
  value      JSONB NOT NULL,
  updated_by INT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope, key)
);

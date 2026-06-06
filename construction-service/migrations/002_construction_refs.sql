-- ============================================================================
-- 002_construction_refs.sql — Dış varlık read-model'leri (event-driven sync)
--
-- Construction-service, monolitin yayınladığı referans event'lerini (core.*)
-- tüketerek bu tabloları günceller. Böylece vendor/firma/kullanıcı adlarını
-- gösterebilir ve soft-ref id'lerini DOĞRULAYABİLİR — monolite senkron HTTP
-- çağrısı yapmadan (mikroservis decoupling). Bu tablolar SALT read-model'dir;
-- gerçek sahiplik monolittedir.
-- ============================================================================

CREATE TABLE cs_ref_companies (
  id        INT PRIMARY KEY,                 -- monolit company id
  name      VARCHAR(300),
  tax_no    VARCHAR(40),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cs_ref_users (
  id         INT PRIMARY KEY,                -- monolit user id
  username   VARCHAR(100),
  full_name  VARCHAR(200),
  role       VARCHAR(40),
  active     BOOLEAN,
  synced_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cs_ref_vendors (
  id        BIGINT PRIMARY KEY,              -- monolit vendor id
  code      VARCHAR(40),
  name      VARCHAR(300),
  tax_id    VARCHAR(20),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

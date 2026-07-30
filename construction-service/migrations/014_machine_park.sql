-- ============================================================================
-- 014_machine_park.sql — FAZ 9: MAKİNE PARKI ZENGİNLİĞİ
--
-- Imperium'un makine kartı: sahiplik (satın/kiralık + kiralama tarihleri),
-- plaka/şase/motor no, KM veya SAAT bazlı sayaç takibi, garanti (tarih VE
-- sayaç sınırı), bakım planı.
--
-- cs_machines GENİŞLETİLİR (ayrı detay tablosu değil): makine kartı tek
-- kayıttır, 1:1 tablo JOIN zorunluluğu ve "detayı olmayan makine" ara durumu
-- yaratırdı. Mevcut SF-6 CRUD'u yeni kolonlara dokunmaz — eski uçlar aynen
-- çalışır, park ekranı kendi uçlarını kullanır.
--
-- SAYAÇ GÜNLÜĞÜ ayrı tablodur (iş programındaki ilerleme günlüğüyle aynı
-- gerekçe): yalnız güncel sayaç tutulsaydı "geçen ay kaçtaydı" cevapsız kalır,
-- km/saat bazlı bakım planının "ne zaman dolar" kestirimi yapılamazdı.
-- Sayaç GERİYE GİTMEZ; sayaç değişimi/sıfırlama ayrı ve AÇIK bir işaretle
-- (is_reset) kaydedilir — sessiz düşüş, hem garanti hem bakım hesabını bozar.
-- ============================================================================

ALTER TABLE cs_machines
  ADD COLUMN brand          VARCHAR(100),
  ADD COLUMN model          VARCHAR(100),
  ADD COLUMN model_year     INT CHECK (model_year IS NULL OR (model_year >= 1950 AND model_year <= 2100)),
  ADD COLUMN plate_no       VARCHAR(20),
  ADD COLUMN chassis_no     VARCHAR(50),
  ADD COLUMN engine_no      VARCHAR(50),
  -- KM veya SAAT bazlı takip: ekskavatör saatle, kamyon km ile izlenir.
  ADD COLUMN meter_type     VARCHAR(10) NOT NULL DEFAULT 'hour' CHECK (meter_type IN ('km', 'hour')),
  ADD COLUMN current_meter  NUMERIC(14,1) NOT NULL DEFAULT 0 CHECK (current_meter >= 0),
  ADD COLUMN purchase_date  DATE,
  -- Kiralama: tarih aralığı + dönem bedeli. kind='rented' dışında da dolu
  -- kalabilir (kiradan satın alınan makinenin geçmişi silinmez).
  ADD COLUMN rental_start   DATE,
  ADD COLUMN rental_end     DATE,
  ADD COLUMN rental_cost    NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (rental_cost >= 0),
  ADD COLUMN rental_period  VARCHAR(10) CHECK (rental_period IS NULL OR rental_period IN ('daily', 'monthly')),
  -- Garanti iki sınırlıdır: tarih VE sayaç — hangisi önce dolarsa garanti biter
  -- (araç garantisi "2 yıl / 100.000 km" mantığı).
  ADD COLUMN warranty_until DATE,
  ADD COLUMN warranty_meter NUMERIC(14,1) CHECK (warranty_meter IS NULL OR warranty_meter >= 0),
  ADD COLUMN park_note      TEXT,
  ADD CONSTRAINT cs_machines_rental_chk CHECK (
    rental_start IS NULL OR rental_end IS NULL OR rental_start <= rental_end);

COMMENT ON COLUMN cs_machines.meter_type IS
  'Sayaç tipi: km (araç) ya da hour (iş makinesi). Bakım planı ve garanti bu birimde okunur.';
COMMENT ON COLUMN cs_machines.current_meter IS
  'Güncel sayaç — cs_machine_meter_log''dan türetilir, doğrudan yazılmaz.';

-- Sayaç okuma günlüğü. Aynı güne ikinci okuma ÜZERİNE YAZAR (düzeltme).
CREATE TABLE cs_machine_meter_log (
  id          BIGSERIAL PRIMARY KEY,
  company_id  INT    NOT NULL,
  machine_id  BIGINT NOT NULL REFERENCES cs_machines(id) ON DELETE CASCADE,
  read_at     DATE   NOT NULL,
  meter_value NUMERIC(14,1) NOT NULL CHECK (meter_value >= 0),
  -- Sayaç değişimi/sıfırlama: geriye gidişin TEK meşru yolu. İşaret + not
  -- zorunluluğu use-case'te — sessiz düşüş garanti/bakım hesabını bozar.
  is_reset    BOOLEAN NOT NULL DEFAULT FALSE,
  note        VARCHAR(500),
  created_by  INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cs_mml_uq UNIQUE (machine_id, read_at)
);
CREATE INDEX idx_cs_mml_machine ON cs_machine_meter_log(machine_id, read_at);

COMMENT ON TABLE cs_machine_meter_log IS
  'Sayaç okumaları. Geriye gidiş yalnız is_reset=true ile (sayaç değişimi); sessiz düşüş reddedilir.';

-- Bakım planı: "her 250 saatte yağ değişimi" ya da "her 180 günde muayene".
CREATE TABLE cs_machine_maintenance_plans (
  id              BIGSERIAL PRIMARY KEY,
  company_id      INT    NOT NULL,
  machine_id      BIGINT NOT NULL REFERENCES cs_machines(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  interval_type   VARCHAR(10) NOT NULL CHECK (interval_type IN ('meter', 'days')),
  interval_value  NUMERIC(12,1) NOT NULL CHECK (interval_value > 0),
  -- Son yapılan bakımın izi: bir sonraki vade buradan hesaplanır. Bakım kaydı
  -- işlendiğinde use-case günceller.
  last_done_meter NUMERIC(14,1) CHECK (last_done_meter IS NULL OR last_done_meter >= 0),
  last_done_date  DATE,
  note            VARCHAR(500),
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cs_mmp_machine ON cs_machine_maintenance_plans(machine_id) WHERE active;

-- Bakım kayıtları: plana bağlı (periyodik) ya da bağsız (arıza).
CREATE TABLE cs_machine_maintenance_records (
  id          BIGSERIAL PRIMARY KEY,
  company_id  INT    NOT NULL,
  machine_id  BIGINT NOT NULL REFERENCES cs_machines(id) ON DELETE CASCADE,
  plan_id     BIGINT REFERENCES cs_machine_maintenance_plans(id) ON DELETE SET NULL,
  done_at     DATE   NOT NULL,
  meter_at    NUMERIC(14,1) CHECK (meter_at IS NULL OR meter_at >= 0),
  cost        NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  description VARCHAR(500) NOT NULL,
  vendor_id   BIGINT,
  created_by  INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cs_mmr_machine ON cs_machine_maintenance_records(machine_id, done_at DESC);

COMMENT ON TABLE cs_machine_maintenance_records IS
  'Yapılan bakımlar. plan_id doluysa periyodik bakımdır ve planın last_done_* alanlarını günceller (use-case).';

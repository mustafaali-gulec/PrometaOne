-- =====================================================================
-- PROMETA ONE — Seed Data
-- 4 demo kullanıcı (admin, mustafa, editor, viewer) + 1 örnek şirket
-- =====================================================================

-- Şifre hash'leri seed.js tarafından güncellenir, burada placeholder
INSERT INTO users (username, password_hash, full_name, email, role, active)
VALUES
  ('admin',   'PLACEHOLDER', 'Sistem Yöneticisi',     'admin@prometahr.com',   'admin',  true),
  ('mustafa', 'PLACEHOLDER', 'Mustafa CFO',            'mustafa@prometahr.com', 'cfo',    true),
  ('editor',  'PLACEHOLDER', 'Düzenleyici Kullanıcı',  'editor@prometahr.com',  'editor', true),
  ('viewer',  'PLACEHOLDER', 'Görüntüleyici',          'viewer@prometahr.com',  'viewer', true)
ON CONFLICT (username) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name;

-- Örnek şirket (sadece companies tablosu varsa)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies') THEN
    INSERT INTO companies (name, color, tax_no, active)
    SELECT 'Prometa HR Teknoloji A.Ş.', '#0f766e', '1234567890', true
    WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Prometa HR Teknoloji A.Ş.');
  END IF;
END $$;

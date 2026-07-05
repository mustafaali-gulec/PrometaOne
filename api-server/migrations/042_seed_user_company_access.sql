-- ============================================================================
-- 042_seed_user_company_access.sql — Mevcut kullanıcılara şirket erişimi ver
-- ----------------------------------------------------------------------------
-- BAĞLAM: companyId artık istemciden DEĞİL, access-token'daki `companies`
-- kümesinden yetkilendiriliyor (çapraz-tenant sızıntı önlemi). Bu küme
-- user_company_access'ten türetilir. Ancak bu tablo bugüne dek BOŞ kalmış
-- (tüm erişim örtük olarak "herkes her şeye" idi). Enforcement açılınca
-- admin dışı kullanıcılar erişimlerini kaybetmesin diye MEVCUT durumu
-- tabloya yazıyoruz: her AKTİF kullanıcı × MEVCUT her şirket, kendi global
-- rolüyle. Böylece bugünkü davranış birebir korunur; enforcement yalnızca
-- BUNDAN SONRA açılan (grant'sız) şirketlere erişimi engeller.
--
-- Admin kullanıcılar zaten sınırsızdır (enforcement admin'i bypass eder);
-- yine de tutarlılık için onlara da satır ekliyoruz (zararsız).
-- Idempotent: ON CONFLICT DO NOTHING (PK user_id+company_id).
-- companies (002), users (001), user_company_access (002) yeniden kullanılır.
-- ============================================================================

INSERT INTO user_company_access (user_id, company_id, role, granted_at)
SELECT u.id, c.id, u.role, NOW()
FROM users u
CROSS JOIN companies c
WHERE u.active = TRUE
ON CONFLICT (user_id, company_id) DO NOTHING;

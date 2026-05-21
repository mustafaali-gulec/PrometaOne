# 0005 — `hr_manager` rolü ve Employee ↔ User opsiyonel bağlantısı

- **Status:** Accepted
- **Date:** 2026-05-21
- **Deciders:** Mustafa Gülec
- **Technical Story / Issue:** Faz 4 (HR Core) — `docs/MIGRATION_ROADMAP.md`

## Context

Faz 4 HR Core'u devreye alıyoruz: org birimi/departman/pozisyon/çalışan/aday/başvuru CRUD. İki kararı netleştirmek gerekiyor:

1. **Yetkilendirme.** Şu an `user_role` ENUM'u `viewer`, `editor`, `cfo`, `admin` içeriyor (bkz. `001_initial_users_and_sessions.sql` + `modules/auth/domain/valueObjects/UserRole.ts`). HR yönetimini (çalışan işe alma, organizasyonu değiştirme, vb.) tam `admin` yetkisi olmadan yapabilecek kullanıcılar var: İK departmanı sorumluları. Onlara `admin` vermek prensip ihlali (least-privilege) ve risk (finans, kullanıcı yönetimi de açılır). `editor` ve `cfo` ise farklı semantik taşıyor — finans odaklı.

2. **Employee ↔ User ilişkisi.** Mevcut sistemde `users` tablosu sisteme giriş yapabilen aktörleri tutuyor; `employees` (Faz 4'te oluşuyor) şirket içindeki çalışan sicilini tutacak. Bunların ilişkisi 1:1 olabilir ama her çalışanın bir sistem hesabı olmak zorunda **değil** (örn. saha personeli, taşeron, henüz işe başlamamış aday). Ters yönden: her sistem kullanıcısı bir çalışan olmak zorunda **değil** (örn. servis hesapları, dış denetçi).

## Decision

1. `user_role` ENUM'una **`hr_manager`** yeni rolü eklenir. Rol hiyerarşisinde `cfo`'nun **altında, `editor`'ün üstünde** konumlanır — yani `editor < hr_manager < cfo < admin`. HR yazma endpoint'leri `hr_manager` veya üstü yetki ister.

2. `employees.user_id` kolonu **nullable + UNIQUE** olarak tanımlanır:
   - `NULL` → Çalışanın sistem hesabı yok.
   - `NOT NULL` + UNIQUE → Bire-bir bağlantı; bir User en fazla bir Employee'ye karşılık gelir.
   - Bağlantı kurma/koparma açıkça `LinkEmployeeToUserUseCase` / `UnlinkEmployeeFromUserUseCase` üzerinden yapılır.

3. **Modül sınırı:** HR modülü Auth'a tek yönlü ve **dar bir port** üzerinden bağlanır: `UserLookupPort` (sadece okuma). Auth modülü HR'ı bilmez (zaten Faz 3'te bitti, dokunulmaz). Bu bağımlılığın yönü ARCHITECTURE.md'deki dependency rule ile tutarlı.

## Rationale

### `hr_manager` rolü için

- **Least-privilege.** İK sorumlusu finansa veya kullanıcı yönetimine erişmemeli; `admin` vermek bunu açar.
- **Mevcut hiyerarşinin korunması.** `editor`/`cfo` finans odaklı semantik taşıyor; HR için yeniden anlamlandırmak teknik borç.
- **Faz 7-9 hazırlığı.** Payroll, attendance, requests fazlarında da "İK personeli yetkili ama tam admin değil" senaryosu gelecek. Şimdi tanımlanan rol o fazlarda da kullanılır.

### Employee ↔ User opsiyonel bağlantı için

- **Gerçek dünya gereksinimi.** Tüm çalışanların sistem hesabı olmuyor (mavi yaka, taşeron, geçici eleman). Zorunlu 1:1 bunu modelleyemez.
- **Davet akışı.** Çalışan önce işe alınır, sonra (bazen gün/hafta sonra) sistem hesabı oluşturulup link kurulur. Tek transaction zorunluluğu pratik değil.
- **Dış aktörler.** Servis hesapları (CI bot, integration hesabı) çalışan değildir; ters zorunluluk da yanlış olur.
- **Anti-corruption layer.** HR'ın `UserLookupPort`'u sadece okuma sağlar; HR auth domain'ine yazmaz, auth HR'ı bilmez. Bu sınır ileri fazlarda User schema değişimini güvenli yapar.

## Consequences

### Positive

- HR sorumluları kendi kapsamlarında bağımsız çalışabilir, admin'e ihtiyaç duymaz.
- Mavi yaka / taşeron / geçici çalışan modellemesi mümkün.
- Faz 7-9 için `hr_manager` zaten hazır olur; ek rol tartışması yapılmaz.
- Auth modülünün Faz 3'te kararlı kalan public API'si bozulmaz; HR onu yalnızca okur.

### Negative

- `user_role` ENUM değişimi mevcut DB'lere `ALTER TYPE ... ADD VALUE` migration'ı gerektirir (geri dönüş yok — PG sınırlaması). 013 numaralı küçük bir migration ile yapılır.
- `UserRole.ts`'deki hiyerarşi tablosu (`LEVEL`) değişir; Faz 3 testleri `editor < hr_manager < cfo` sıralamasını test eden vakaları gözden geçirmek zorunda.
- Employee↔User UNIQUE constraint zaten DB'de uygulanır ama "her çalışanın bir hesabı olsun" politikası isteyen organizasyonlar için ek raporlama gerekir (kaçı bağlı, kaçı bağlı değil).

### Neutral

- `requireRole('hr_manager','admin')` gibi middleware kombinasyonları artık çok kullanılacak; `requireAtLeast('hr_manager')` helper'ı bunu sadeleştirir.
- Audit log'da rol değişikliklerinin yine `audit_logs` tablosuna düşmesi yeterli; ek bir HR-özel log gerekmez.

## Alternatives Considered

### Seçenek A: `editor` rolünü HR için yeniden anlamlandır

- Yeni rol gerekmez, ENUM dokunulmaz.
- **Neden tercih edilmedi:** `editor` zaten finans/cell editing semantiğiyle Faz 5-6'da kullanılacak. Aynı rol iki bağlamda farklı haklar verirse RBAC karmaşıklaşır. Çakışan permission grant'larını koordine etmek teknik borç üretir.

### Seçenek B: Permission tabanlı RBAC'a geçiş (`hr:write`, `payroll:write`)

- En esnek, en uzun ömürlü çözüm.
- **Neden tercih edilmedi:** Şu an için aşırı mühendislik. 4 fazlık bir feature için 100+ permission tanımı bakım yükü. Faz 12'de tüm modüller kararlıyken yeniden değerlendirilir (potansiyel ADR-XX olarak).

### Seçenek C: Employee = User zorunlu 1:1

- Modeli basitleştirir; her çalışana hesap = tek tablo gibi düşünmek.
- **Neden tercih edilmedi:** Gerçek dünya kullanıcısı reddediyor — mavi yaka çalışanların sistem hesabı yok. Login yapamayan kullanıcılar oluşturmak güvenlik anti-pattern'i (silinen ama "active=false" hesap envanteri).

## References

- `docs/MIGRATION_ROADMAP.md` — Faz 4 detaylı planı
- `docs/ARCHITECTURE.md` § 2 (Dependency rule), § 5 (SOLID)
- `docs/adr/0003-strangler-fig-migration.md` — modül izolasyonu
- `api-server/migrations/001_initial_users_and_sessions.sql` — mevcut `user_role` tanımı
- `api-server/src/modules/auth/domain/valueObjects/UserRole.ts` — kod tarafı hiyerarşi

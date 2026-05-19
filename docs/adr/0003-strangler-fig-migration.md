# 0003 — Strangler Fig Migration Yaklaşımı

- **Status:** Accepted
- **Date:** 2026-05-19
- **Deciders:** Mustafa

## Context

Mevcut frontend tek bir 81.159 satırlık `App.jsx` dosyası. Tüm finans, İK, bordro, projeler, raporlar burada yaşıyor. Refaktör seçenekleri:

1. **Big-bang yeniden yazım** — Eski App.jsx'i bir kenara koy, sıfırdan modüler frontend yaz, bir noktada büyük cutover yap.
2. **Strangler Fig** — App.jsx çalışmaya devam etsin, yeni modüller yan yana yazılsın, parça parça eskisi yenisiyle değiştirilsin.
3. **Sadece yeni özellikler modüler** — Eski App.jsx'e dokunma, bundan sonra yapılacak her şey modüler. Eski kuruyup zamanla yenilenir.

Kullanıcı tercihi: **Strangler Fig**.

## Decision

Strangler Fig yöntemiyle kademeli geçiş yapılır:

1. **Eski `frontend/src/App.jsx` yaşamaya devam eder.** Hâlâ default export, hâlâ `main.jsx` onu render eder.
2. **Yeni modüller `frontend/src/modules/` altına yazılır** (TypeScript strict, ARCHITECTURE.md'deki katmanlı yapı).
3. **Yeni iskelet `frontend/src/app/App.tsx`** kurulur. Şu an default değil — bir feature flag veya route alt-ağacı altında yaşar.
4. Her migration adımı bir **özellik dilimi** taşır:
   - "Notifications dropdown" gibi küçük, izole bir UI parçası `App.jsx`'ten çıkarılır → `modules/notifications/presentation/NotificationBell.tsx` olur
   - `App.jsx` içinde o parçanın yerine yeni component'i import eden bir adapter konur
   - Test, gözden geçir, deploy
5. **Bir modül %100 yenisine geçtiğinde**, `App.jsx`'ten ilgili satırlar silinir, dosya küçülür.
6. **`App.jsx` 0 satıra düştüğünde** — Strangler tamamlanır, dosya silinir, `App.tsx` default olur.

Backend tarafında benzer mantık: `legacy/backend/` arşiv olarak duruyor, `api-server/src/modules/notifications/` altında yeni implementasyon yazılıyor, hazır olunca docker-compose ona yönlendirilip `legacy/backend/` silinir.

### Hangi modülü ne zaman çıkaracağız?

Sıralama kriterleri:

1. **Küçük + izole önce** — Notifications bell, AI widget gibi 200-500 satırlık parçalar. Erken kazanım, az risk.
2. **Yüksek bug yoğunluğu olan modüller** — App.jsx'in en çok değişen kısımları. Çıkarınca testlerle koruma getirir.
3. **Tip güvenliği en kritik olanlar** — Finans/bordro hesaplamaları. Modüler hâlde TS strict ile güvenli.
4. **Birbirine bağımlı olanlar birlikte** — `payroll` çıkarılıyorsa `hr`'in çalışan modeli paylaşılmalı; o yüzden `hr/domain/Employee` önce.

Tam yol haritası: `docs/MIGRATION_ROADMAP.md`.

## Rationale

- **Risk düşük** — Eski sistem her an çalışıyor. Yeni modülün bug'ı çıkarsa adapter'ı geri al, App.jsx'in eski kodu yine orada.
- **Kullanıcılar kesintisiz** — Tek user olmasına rağmen Mustafa CFO mode'da prod kullanıyor. Big-bang olmaz.
- **Öğrenme döngüsü kısa** — İlk modül çıkarıldığında ne işe yaradığı görülür, yaklaşım iyileştirilir, sonrakiler daha kolay.
- **Big-bang neden olmaz:** 81K satırlık koda paralel implementasyon yazmak haftalar sürer ve büyük cutover kaçınılmaz olarak kritik bug'lar getirir. Tek dev (Mustafa) bunu kaldıramaz.
- **"Sadece yeni özellikler modüler" neden olmaz:** Eski App.jsx'in bug'ları çözülmüyor, sadece üstüne yenisi yığılıyor. Toplam karmaşıklık artar.

## Consequences

### Positive

- Her PR atomik ve geri alınabilir.
- Çalışan sistem her zaman var.
- İlk modülden itibaren yeni standartlar (TS strict, ESLint, test) uygulanır.
- App.jsx satır sayısı zamanla **görünür biçimde azalır** — somut ilerleme metriği.

### Negative

- **İkili kod tabanı süresi var** — Belki 6+ ay boyunca hem eski hem yeni kod yaşar. İki yerde benzer şey yapmak zorunda kalabiliriz.
- **Adapter'lar geçici kod** — Bir modül çıkarılırken App.jsx içinde "yeni component'i çağıran köprü" kodları var olur. Migration bitince silinmesi gerekir; unutulursa teknik borç artar.
- **State paylaşımı zor** — App.jsx içinde `useState` ile yaşayan global-ish state ile yeni modülün state'i nasıl konuşacak? Geçici bir "global store köprüsü" (`window.__prometaState` veya hafif zustand) gerekebilir.

### Neutral

- Karar `git log` üzerinden takip edilebilir: her commit "feat(modules/X): ..." veya "refactor(legacy): strangle X" kalıbında olur.

## Alternatives Considered

### Seçenek 1 — Big-bang yeniden yazım
**Reddedildi:** Tek dev için ölümcül risk. 81K satırlık business logic'i baştan yazmak haftalar/aylar sürer ve cutover'da kritik özellik kaybı kaçınılmazdır.

### Seçenek 3 — Sadece yeni özellikler modüler
**Reddedildi:** Eski kod hiç düzelmez, üstüne yenisi yığılır. Bug'lar oradan gelmeye devam eder.

## References

- Martin Fowler — Strangler Fig Application: <https://martinfowler.com/bliki/StranglerFigApplication.html>
- "Working Effectively with Legacy Code" — Michael Feathers

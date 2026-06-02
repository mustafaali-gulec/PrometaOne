# Dokümantasyon Analizi — prometa-one

**Tarih:** 2026-06-01
**Kapsam:** Depodaki 42 özgün Markdown dokümanı (toplam 220 `.md` dosyasının 178'i `node_modules` paket README'siydi ve hariç tutuldu).
**Amaç:** Tekrarlayan temaları ve dokümanlar arası tutarsızlıkları yüzeye çıkarmak.

---

## Genel Tablo

Dokümanlar tek bir hikâyeyi anlatıyor: 81.000+ satırlık monolitik `App.jsx`'ten, hexagonal / Clean Architecture'a fazlı **"Strangler Fig"** göçü. Faz 1'den Faz 6'ya (1 Haziran 2026 cutover'a kadar) uzanan kurulum kılavuzları, ADR'ler, faz doğrulama logları ve legacy/entegrasyon README'lerinden oluşuyor.

---

## Tekrarlayan Temalar

### 1. Strangler Fig göçü — `App.jsx`'i satır satır eritmek

En baskın ve en çok ölçülen tema. ADR-0003 tüzüğü koyuyor: "App.jsx 0 satıra düştüğünde — Strangler tamamlanır, dosya silinir." Metrik Faz 1'de doğuyor (81.159 satır) ve her fazda raporlanıyor (Faz 4: −14.193, Faz 5: −3.176). `CONTRIBUTING.md` kuralı: "Eski App.jsx'e yeni özellik eklemek" yasak.

### 2. Atomiklik / Unit of Work — çapraz-aggregate yazımlar

Düşüncenin en net evrim çizgisi. İK'da bir niyet olarak başlıyor (hr/README: "DB transaction — ileri PR, Unit of Work pattern"), Faz 4'te zayıf manuel try/catch ile çıkıyor ("inconsistency riski var"), ADR-0006'da gerçek PG ROLLBACK'e olgunlaşıyor, Faz 6'da `PgEInvoiceUnitOfWork` olarak yeniden kullanılıyor.

### 3. Hexagonal ports/adapters + sağlayıcı soyutlaması

`ARCHITECTURE.md` bağımlılık kuralını ESLint ile compile-time'da zorluyor: "domain/ → hiçbir şeye bağımlı olmaz." ADR-0005 İK→Auth için dar `UserLookupPort` anti-corruption katmanı getiriyor; ADR-0008 e-fatura entegratörlerini ("yeni entegratör = yeni adapter, domain değişmez") ve FX kur sağlayıcılarını aynı desene oturtuyor.

### 4. Finansal doğruluk — tam sayı kuruş, asla float

ADR-0002'de finans güvenliği gerekçesi olarak filizleniyor, ADR-0007'de kurala dönüşüyor ("float yuvarlama hatası yapısal olarak imkânsız"), Faz 6 FX yeniden değerlemesinde uygulanıyor. TypeScript-strict de aynı "güvenlik kalkanı" mantığından besleniyor; legacy e-fatura modülü ise bilinçli istisna (ADR-0004 → Faz 6'da kapatıldı).

### 5. Test titizliği + tekrarlayan "sandbox testleri çalıştıramıyor" açığı

489+ test, testcontainers/MSW yatırımı var; ama her faz sandbox'ın binary'leri/Docker'ı çalıştıramadığını ve "kullanıcı makinesinde doğrulanmalı" notunu tekrarlıyor (Faz 1'den Faz 6'ya).

---

## Doküman Tutarsızlıkları — Temizlik Listesi

### 1. `App.jsx` satır sayısı dokümanlar arası çelişiyor

- `README.md:249` — "Frontend kod: **41.544 satır** (App.jsx)"
- `KURULUM.md:2` ve `:127` — "**81.160 satır**"
- `INTEGRATION_AUDIT.md:4` — "**81.160 satır**"
- En güncel doğrulama dokümanları gerçek değeri **63.793** veriyor (Faz 5 sonrası).

**Aksiyon:** Tek bir kaynak-doğru belirle. README'deki 41.544 hem 81k hem 63k'dan farklı — büyük ihtimalle yanlış/eski bir metrik, güncellenmeli.

### 2. "Production Hazır" iddiası ile "backend implement edilmedi" çelişiyor

- `INTEGRATION_AUDIT.md:267-269` — "🚀 Production Hazır / Tüm entegrasyonlar test edildi ve doğrulandı."
- `EMAIL_NOTIFICATIONS_README.md:46` — "⏳ Backend (Sonra Implement Edilecek)"
- `MOBILE_PUSH_README.md:22, :81, :153` — "Backend Henüz Implement Edilmedi"

**Aksiyon:** Audit'i gerçek durumla hizala; e-posta ve push entegrasyonları "production hazır" değil.

### 3. Node sürümü tutarsız

- `CONTRIBUTING.md:13` — "node -v # **>= 20**"
- `WINDOWS_KURULUM.md:38` — "v20.x.x veya v22.x.x"
- `KURULUM.md` — Node 18+

**Aksiyon:** Tüm kurulum dokümanlarında tek minimum sürüm.

### 4. Varsayılan/zayıf kimlik bilgileri düz metin olarak dokümanlarda

- `README.md:100-101` — `admin/admin123`, `mustafa/promet`
- `WINDOWS_KURULUM.md:354-355, :359` ve `:280` (`prometa123`)
- `KURULUM.md:43-44`

**Aksiyon:** Güvenlik riski — gerçek varsayılan parolaları dokümandan çıkar, ilk-giriş zorunlu sıfırlama öner. Bu, dokümanların kendi gizli-bilgi hijyeni checklist'iyle de çelişiyor.

### 5. Legacy "iki tutarsız dünya" — referans dışı ama hâlâ duruyor

- `legacy/README.md:18-19` — "CommonJS require() kullanıyordu, api-server ESM. **Tutarsız iki dünya**" ve "db.getTasks()... hiçbir yerde tanımlı değildi — **gerçekte çalışmıyordu**."

**Aksiyon:** Kurulum dokümanlarındaki eski `backend/` yollarının `api-server/src/modules/`'a güncellendiğinden emin ol.

---

## Çözülmüş — Temizliğe Gerek Yok

ADR-0004'teki geçici e-fatura TypeScript-strict istisnası `docs/adr/0004-legacy-einvoice-typescript-exclude.md:3,:8`'de **"Closed — Faz 6 cutover ile çözüldü (2026-06-01)"** olarak doğru şekilde kapatılmış. Dokümantasyonun düzgün bakıldığında nasıl göründüğüne iyi bir örnek.

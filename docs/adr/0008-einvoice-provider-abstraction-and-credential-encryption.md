# 0008 — E-Fatura sağlayıcı soyutlaması + AES-256-GCM kimlik şifreleme

- **Status:** Accepted
- **Date:** 2026-06-01
- **Deciders:** Mustafa Gülec
- **Technical Story / Issue:** Faz 6 (Finance — E-Fatura & Döviz) — `docs/MIGRATION_ROADMAP.md`
- **İlgili:** ADR-0004 (kapanış), ADR-0006 (Unit of Work), ADR-0007 (Money)

## Context

Faz 6'da e-fatura modülü (`modules/finance/einvoice/`) GİB e-Fatura/e-Arşiv sistemine entegratör (özel entegratör) üzerinden bağlanır. Türkiye'de birden fazla entegratör var (eLogo, QNB eFinans, Foriba/Sovos, Mikro, vb.); her birinin kendi SOAP/REST API'si, WSDL'i ve kimlik doğrulama akışı farklı. Aynı zamanda:

- Müşteri (şirket) entegratör **kullanıcı adı/şifre/VKN** bilgilerini sisteme girer. Bu bilgiler GİB nezdinde fatura kesme/çekme yetkisi verir; **plaintext saklanamaz** — DB sızıntısında doğrudan kötüye kullanılabilir.
- Faz 0.5'teki legacy `services/einvoice/elogo.ts` tek entegratöre (eLogo) sıkı bağlıydı; ikinci entegratör eklemek kopyala-yapıştır gerektiriyordu (ADR-0004'te zaten teknik borç olarak işaretliydi).
- E-fatura çekme, dış sisteme ağ çağrısı yapan, yavaş ve hataya açık bir iştir (entegratör down olabilir, rate-limit, timeout). Bu, çekirdek finance domain'inden farklı bir operasyonel profil.

İki ayrı karar gerekiyor: (1) entegratör çeşitliliğini domain'den nasıl soyutlarız, (2) kimlik bilgilerini nasıl saklarız.

## Decision

### 1. `EInvoiceProvider` portu (hexagonal — sağlayıcı bağımsızlığı)

Domain/application katmanı entegratörü yalnızca bir **port** üzerinden tanır:

```
application/ports/EInvoiceProvider.ts
  testConnection(config): Promise<{ ok: boolean; message?: string }>
  fetchInvoiceList(config, { direction, dateFrom, dateTo }): Promise<ProviderInvoiceRef[]>
  fetchInvoiceXml(config, ref): Promise<string>   // UBL-TR 2.1 XML
```

Concrete adapter'lar `infrastructure/provider/` altında:

- `ELogoProvider` — eLogo SOAP (strong-soap, dinamik import + ambient `.d.ts`).
- `MockProvider` — seed UBL XML üreten, ağ çağrısı yapmayan; testlerde ve `env=test` kimliklerinde kullanılır.

Yeni entegratör (QNB eFinans, Foriba, …) eklemek = yeni bir adapter sınıfı + `ProviderType` value object'ine bir değer. Domain, use-case'ler ve REST katmanı **değişmez**. UBL-TR 2.1 ortak format olduğu için her adapter ham XML döner; parse tek bir `UblInvoiceParser` domain servisinde merkezîdir.

### 2. AES-256-GCM ile kimlik bilgisi şifreleme

Entegratör kimlikleri **uygulama katmanında şifrelenip** DB'ye şifreli yazılır; plaintext hiçbir zaman disk/log'a düşmez.

- `application/ports/CredentialCipher.ts` portu: `encrypt(config) → { ciphertext, iv, tag }`, `decrypt(...) → config`.
- `infrastructure/crypto/AesGcmCredentialCipher.ts` — **AES-256-GCM** (authenticated encryption):
  - Master key `EINVOICE_MASTER_KEY` env değişkeninden, base64 32-byte (256-bit). `fromEnv()` uzunluğu doğrular.
  - Her şifrelemede **rastgele 12-byte IV**; deterministik değil (aynı config iki kez şifrelenince farklı ciphertext).
  - **GCM auth tag** ile bütünlük: kurcalanmış ciphertext veya yanlış key → `CredentialDecryptError` (sessiz yanlış çözme yok).
- DB şeması (`016_einvoice.sql`): `einvoice_credentials` tablosunda `config_encrypted BYTEA`, `config_iv BYTEA`, `config_tag BYTEA` — plaintext kolon yok.
- `resolveCipher()` (modül `index.ts`): `EINVOICE_MASTER_KEY` yoksa **ephemeral** (process ömrü) key üretir ve uyarı loglar — dev/test çalışır ama restart'ta eski kayıtlar çözülemez; prod'da env zorunlu.

## Rationale

- **Sağlayıcı bağımsızlığı:** Port/adapter ile entegratör değişimi izole; domain saf kalır (ADR-0003 hexagonal ilkesi). Test `MockProvider` ile ağsız ve deterministik.
- **Kimlik güvenliği:** AES-256-GCM hem gizlilik hem bütünlük sağlar; IV randomizasyonu pattern sızıntısını, auth tag kurcalama tespitini garanti eder. Master key uygulama dışında (env/secret manager), DB sızıntısı tek başına yetersiz.
- **UBL-TR merkezîliği:** Parse tek yerde; entegratör adapter'ı yalnızca taşıma (transport). Yeni entegratör parse mantığını tekrar etmez.
- **Operasyonel ayrışma hazırlığı:** Port arkasındaki yavaş/dış-bağımlı iş, ileride ayrı bir servise taşınmaya en uygun aday (aşağıya bakınız).

## Consequences

### Positive

- İkinci/üçüncü entegratör eklemek domain'e dokunmadan, tek adapter + `ProviderType` değeri ile mümkün.
- Kimlik bilgileri at-rest şifreli; sızıntıda doğrudan kullanılamaz; kurcalama tespit edilir.
- Testler ağsız (`MockProvider`) → hızlı ve deterministik; CI dış entegratöre bağımlı değil.
- Parse mantığı tek `UblInvoiceParser`'da; entegratör çoğaldıkça tekrar yok.

### Negative

- `EINVOICE_MASTER_KEY` artık **kritik bir sır**: kaybı = tüm kimliklerin çözülemez olması, sızıntısı = tümünün açılması. Secret yönetimi (rotation, backup) operasyonel sorumluluk getirir. Key rotation şu an manuel/kapsam dışı.
- Ephemeral-key fallback dev kolaylığı sağlar ama prod'da yanlışlıkla env set edilmezse kayıtlar restart sonrası çözülemez — başlangıçta uyarı loglanıyor, yine de bir ayak kapanı.
- Her entegratörün WSDL/alan eşlemesi farklı; UBL-TR'ye normalize etmek adapter başına emek ister (ortak port bunu gizler ama elemez).

### Neutral

- `strong-soap` runtime bağımlılığı eklendi (dinamik import + ambient `.d.ts`); yalnızca SOAP entegratörleri için yüklenir.
- FX kurları (`modules/finance/fx`) ayrı bir port/adapter ile (`TcmbRateProvider`, EVDS) aynı hexagonal deseni izler — entegratör ve kur sağlayıcısı simetrik.

## Extract-on-demand notu (mikroservis adayı)

Daha önce (mikroservis tartışmasında) modüler monolit + "ihtiyaç oldukça çıkar" stratejisi benimsenmişti. E-fatura modülü bu stratejinin **en güçlü adayıdır**, çünkü:

- Dış sisteme (entegratör/GİB) bağımlı, yavaş ve hataya açık I/O — çekirdek finance'ten farklı ölçekleme/retry/timeout profili.
- `EInvoiceProvider` portu zaten net bir ağ-sınırı; bir HTTP/queue API'sine dönüştürmek görece düz.
- Sync işi (toplu fatura çekme) batch/asenkron doğası gereği ayrı bir worker'a taşınmaya uygun.
- **Engel:** Import use-case'i Faz 5 `Invoice` aggregate'ine `EInvoiceUnitOfWork` ile **atomik** yazıyor (ADR-0006). Ayrı servise çıkarmak bu lokal transaction'ı bozar → ya import çekirdekte kalır (provider/sync uzakta), ya da saga/eventual-consistency'ye geçilir. Bu maliyet bugün için gereksiz.

**Karar:** Şimdilik modüler monolit içinde kalır. Çıkarma tetikleyicileri: entegratör sync yükünün ana API'yi etkilemesi, ayrı ölçekleme/deploy ihtiyacı, veya ayrı ekip sahipliği. O gün geldiğinde port + UoW sınırı çıkarmayı kolaylaştıracak şekilde tasarlandı.

## Alternatives Considered

### Sağlayıcı: tek entegratöre sıkı bağ (legacy yaklaşım)

- Reddedildi: ADR-0004'te zaten teknik borç. İkinci entegratör kopyala-yapıştır gerektirir; test ağa bağımlı.

### Şifreleme A: plaintext + DB-level encryption (TDE)

- Reddedildi: TDE yalnızca disk hırsızlığına karşı korur; DB'ye yetkili erişim (veya dump) plaintext görür. Uygulama-katmanı şifreleme master key olmadan işe yaramaz.

### Şifreleme B: AES-256-CBC + ayrı HMAC

- Reddedildi: GCM tek primitive'de gizlilik + bütünlük (AEAD) verir; CBC+HMAC daha fazla parça, yanlış kullanım (encrypt-then-mac sırası) riski. GCM daha az ayak kapanı.

### Şifreleme C: bcrypt/argon2 (hash)

- Reddedildi: Kimlik bilgisini geri **çözmek** gerekiyor (entegratöre göndermek için); hash tek yönlü, uygun değil. Hash sadece doğrulama (şifre login) için.

## References

- `api-server/src/modules/finance/einvoice/application/ports/EInvoiceProvider.ts`
- `api-server/src/modules/finance/einvoice/application/ports/CredentialCipher.ts`
- `api-server/src/modules/finance/einvoice/infrastructure/crypto/AesGcmCredentialCipher.ts`
- `api-server/src/modules/finance/einvoice/infrastructure/provider/{ELogoProvider,MockProvider}.ts`
- `api-server/src/modules/finance/einvoice/domain/services/UblInvoiceParser.ts`
- `api-server/src/modules/finance/einvoice/domain/valueObjects/{Vkn,ProviderType}.ts`
- `api-server/migrations/016_einvoice.sql`
- ADR-0003 (Strangler Fig / hexagonal), ADR-0004 (kapanış), ADR-0006 (Unit of Work), ADR-0007 (Money)

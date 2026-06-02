# Faz 6 — Finance E-Fatura & Döviz Verification

**Tarih:** 2026-06-01 · **Faz:** 6 (Finance — E-Fatura [GİB/UBL-TR 2.1] + Döviz [TCMB/EVDS + UFRS 21 değerleme]) tamamlandı

Bu doküman Faz 6'nın 8 PR'ının çıktılarını ve doğrulamalarını listeler. E-fatura ve döviz, Faz 5 finance modülünün iki alt modülü olarak (`modules/finance/einvoice/`, `modules/finance/fx/`) Clean Architecture ile uçtan uca yazıldı; legacy `routes/einvoice.ts` + `services/einvoice/*` + `services/tcmb.ts` tamamen söküldü (ADR-0004 kapandı).

## 8 PR — özet

| PR    | Konu                                                                                                               | Durum |
| ----- | ------------------------------------------------------------------------------------------------------------------ | ----- |
| **1** | 016 migration (INT FK) + 009 NO-OP + e-fatura domain VO'ları (Vkn/Ettn/Provider/…) + AES-256-GCM credential cipher | ✅    |
| **2** | UBL-TR 2.1 parser + EInvoice/EInvoiceLine entity + fixture testleri                                                | ✅    |
| **3** | `EInvoiceProvider` port + `ELogoProvider` (SOAP) + `MockProvider` + testler                                        | ✅    |
| **4** | FX alt modülü — ExchangeRate/Revaluation domain + RevaluationCalculator + TcmbRateProvider + use-case'ler          | ✅    |
| **5** | Sync + Import (UoW atomik) + credential + party-mapping use-case'leri + portlar + fakes + testler                  | ✅    |
| **6** | 6 Pg repo + PgEInvoiceUnitOfWork + REST routes + DI + integration                                                  | ✅    |
| **7** | Frontend: EInvoiceApiClient + 3 hook + 3 component + FinanceDemoPage e-fatura/FX sekmeleri + Vitest                | ✅    |
| **8** | Cutover (legacy sökme + App.jsx) + ADR-0004 kapanış + ADR-0008 + bu doküman + CHANGELOG                            | ✅    |

## Backend — modül yapısı

```
api-server/src/modules/finance/
├── einvoice/
│   ├── domain/
│   │   ├── valueObjects/  Vkn (VKN+TCKN checksum), Ettn (UUID), InvoiceDirection,
│   │   │                  EInvoiceScenario, EInvoiceType, GibStatus, ProviderType
│   │   ├── entities/      EInvoiceCredential (+CredentialConfig), EInvoice (fromParsed,
│   │   │                  markImported/markIgnored), EInvoiceLine, PartyMapping
│   │   ├── services/      UblInvoiceParser (UBL-TR 2.1), EInvoiceToInvoicePolicy
│   │   └── errors/        EInvoiceErrors (FinanceError alt sınıfları)
│   ├── application/
│   │   ├── ports/         CredentialCipher, EInvoiceProvider, EInvoiceRepositories,
│   │   │                  EInvoiceUnitOfWork
│   │   └── useCases/      Credential, SyncEInvoices, ImportEInvoice, PartyMapping
│   ├── infrastructure/
│   │   ├── crypto/        AesGcmCredentialCipher (AES-256-GCM)
│   │   ├── provider/      ELogoProvider (strong-soap), MockProvider
│   │   ├── persistence/   Pg{Credential,EInvoice,SyncLog,PartyMapping}Repository
│   │   └── unitOfWork/    PgEInvoiceUnitOfWork
│   ├── presentation/      routes.ts (createEInvoiceRouter) + errorMapping.ts
│   └── index.ts           registerEInvoiceModule(pool) + resolveCipher()
└── fx/
    ├── domain/            entities/{ExchangeRate,Revaluation} + services/RevaluationCalculator + errors/FxErrors
    ├── application/       ports/FxPorts + useCases/{Rate,Revaluation}UseCases
    └── infrastructure/    rates/TcmbRateProvider (EVDS) + persistence/Pg{ExchangeRate,Revaluation}Repository
```

`api-server/src/index.ts`: `v1.route('/finance', einvoiceModule)` — e-fatura (`/einvoice/*`) ve FX (`/fx/*`) yolları Faz 5 finance ile aynı `/v1/finance` prefix'i altında.

## E-fatura sağlayıcı soyutlaması + kimlik şifreleme (ADR-0008)

- **`EInvoiceProvider` portu** — entegratör bağımsız: `testConnection / fetchInvoiceList / fetchInvoiceXml`. Adapter'lar `ELogoProvider` (SOAP) ve `MockProvider` (ağsız, seed XML). Yeni entegratör = yeni adapter + `ProviderType` değeri; domain değişmez.
- **AES-256-GCM credential cipher** — `EINVOICE_MASTER_KEY` (base64 32-byte) ile şifreleme; rastgele 12-byte IV (deterministik değil), GCM auth tag (kurcalama → `CredentialDecryptError`). DB'de `BYTEA config_encrypted/config_iv/config_tag`; plaintext yok. `resolveCipher()` env yoksa ephemeral key + uyarı (dev/test).
- **UBL-TR 2.1** tek `UblInvoiceParser` domain servisinde merkezî; SATIS/TEVKIFAT/döviz/e-Arşiv senaryoları + GİB vergi kodları (KDV 0015, Tevkifat 9015, ÖTV 0071, Konaklama 0059). VKN (10) / TCKN (11) checksum doğrulaması.

Karar gerekçesi: `docs/adr/0008-einvoice-provider-abstraction-and-credential-encryption.md`.

## Döviz (FX) — TCMB/EVDS + UFRS 21 değerleme

- `TcmbRateProvider` — EVDS API (seriler `TP.DK.USD.A.YTL` / `TP.DK.EUR.A.YTL`, DD-MM-YYYY); `fetch` enjekte edilebilir, HTTP/exception → `RateProviderError`.
- `RevaluationCalculator` — kuruş-kesin (`Money.fromMinor(Math.round(foreign.minorValue * rate), 'TRY')`); kur kârı 646 / zararı 656 hesabına net. `GetRateAtUseCase` tam tarih yoksa önceki en yakın kuru döner; TRY → 1.
- Revaluation create + post (idempotent, multi-tenant izolasyonu) use-case'leri ve Pg repository'leri.

## Migration

- `migrations/016_einvoice.sql` — **doğru INT FK'li** şema: `einvoice_credentials` (BYTEA şifreli config), `einvoice_invoices` (`UNIQUE(company_id, uuid)` → sync idempotency), `einvoice_sync_log`, `einvoice_party_mapping`, `einvoice_pending` view.
- `migrations/009_einvoice.sql` — **NO-OP'a çevrildi**: eski şema UUID FK'lerle hatalıydı (Faz 5 `invoices.id` INT ile uyumsuz); 016 onu doğru INT FK ile değiştirdi. 009 tarihsel sıralamayı bozmamak için boş bırakıldı.

## Integration testler (PR 6 — gerçek PostgreSQL)

```
api-server/src/modules/finance/einvoice/__tests__/integration/
├── setup.ts            # PG container + finance + 016 migration runner
└── PgEInvoice.itest.ts # credential şifreli round-trip, sync UPSERT idempotency,
                        # import → Faz5 invoice atomik (UoW), pending view
```

Doğrulanan DB-tarafı davranışlar: `einvoice_invoices` `ON CONFLICT (company_id, uuid)` UPSERT (ikinci sync 0 yeni); credential BYTEA şifreli yazım + decrypt round-trip; `PgEInvoiceUnitOfWork` ile import'un Faz 5 `invoices` aggregate'ine atomik yazımı + rollback; `imported_invoice_id` BIGINT string ↔ number sınır dönüşümü.

## Frontend — modül genişlemesi (PR 7)

```
frontend/src/modules/finance/
├── application/dto/EInvoiceDtos.ts + ports/EInvoiceApi.ts
├── infrastructure/api/EInvoiceApiClient.ts   # /einvoice/* + /fx/*
├── presentation/
│   ├── hooks/      useEInvoices, useCurrentRates, useRevaluations
│   └── components/ EInvoiceInbox, CurrentRatesCard, RevaluationsTable
└── demo/FinanceDemoPage.tsx   # FinanceTab union'a 'einvoice' | 'fx' eklendi
```

Test altyapısı: `test/fixtures/einvoiceFixtures.ts`, `test/msw/einvoiceHandlers.ts`, `__tests__/hooks/fakeEInvoiceApi.ts`. Testler: `EInvoiceApiClient.test.ts` (MSW + gerçek fetch, happy + error), `useEInvoices`, `EInvoiceInbox`, `CurrentRatesCard` = **+20 yeni vaka → 140 toplam**.

## Cutover (PR 8) — ADR-0004 kapanışı

Backend (PR 8a):

| Silinen / değişen        | Detay                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `src/routes/einvoice.ts` | Silindi (legacy SOAP route'ları)                                                                                   |
| `src/services/einvoice/` | Silindi (elogo/ubl-parser/crypto/index)                                                                            |
| `src/services/tcmb.ts`   | Silindi (kur çekme)                                                                                                |
| `src/routes/misc.ts`     | `fx` export bloğu + tcmb import kaldırıldı (~83 satır)                                                             |
| `src/index.ts`           | `fx` misc import + `v1.route('/', fx)` / `v1.route('/companies', fx)` mount'ları kaldırıldı                        |
| `src/services/cron.ts`   | TCMB kur job'ı (`tcmbTask` + `fetchAndStoreTodaysRates` import) söküldü; not ile `modules/finance/fx`'e devredildi |
| `tsconfig.json`          | `exclude`'dan `src/routes/einvoice.ts` + `src/services/einvoice/**` satırları kaldırıldı                           |

Frontend (PR 8b) — App.jsx tam cutover:

| Legacy küme                                                                                             | Yaklaşık satır | Durum   |
| ------------------------------------------------------------------------------------------------------- | -------------- | ------- |
| `EInvoiceManager` + `EInvoiceTable` + `ELogoCredentialsModal` + `SyncHistory` + `generateMockEinvoices` | ~709           | Silindi |
| `FxRevaluationView` + `PostRevaluationModal`                                                            | ~516           | Silindi |

- View-switch: `view === "fx"` → `<FinanceDemoPage initialTab="fx" companyId={…} />` (e-fatura sekmesi de aynı FinanceDemoPage içinde `initialTab="einvoice"`).
- **App.jsx: 63.793 → 62.570 satır (−1.223)**. `App.jsx.bak` yedeği doğrulama sonrası silindi.

## Otomatik doğrulamalar

| Kontrol                             | Durum                                                                                                                   |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Backend `npm run typecheck`         | ✅ Temiz (0 hata) — kullanıcı makinesinde doğrulandı                                                                    |
| Backend `npm test` (unit)           | ✅ 723 / 723 pass — kullanıcı makinesinde doğrulandı                                                                    |
| Backend `npm run test:integration`  | ✅ 70 / 70 pass (testcontainers, Docker) — "E-Fatura + FX Pg integration" suite dahil, kullanıcı makinesinde doğrulandı |
| Frontend `npm run typecheck`        | ✅ Temiz (0 hata) — kullanıcı makinesinde doğrulandı                                                                    |
| Frontend `npm test`                 | ✅ 140 / 140 pass — kullanıcı makinesinde doğrulandı                                                                    |
| App.jsx sözdizimi (cutover sonrası) | ✅ TS transpile: yeni sözdizimi hatası yok                                                                              |

> **Not:** `cron.ts`'teki kırık `./tcmb.js` import'u backend typecheck'i ilk turda bozmuştu; job sökülüp `modules/finance/fx`'e devredilerek çözüldü ve typecheck temizlendi.

## Test metrikleri — Faz 5 → Faz 6

| Metrik                   | Faz 5         | Faz 6                      | Δ                           |
| ------------------------ | ------------- | -------------------------- | --------------------------- |
| Backend unit test        | 649           | 723                        | +74                         |
| Backend integration test | 66            | 70                         | +4 (E-Fatura + FX Pg suite) |
| Frontend test            | 120           | 140                        | +20                         |
| App.jsx satır            | 63.793        | 62.570                     | −1.223                      |
| ADR                      | 0007'ye kadar | 0008 eklendi, 0004 kapandı | +1 / kapanış                |

## Bilinen kısıtlar

1. **`EINVOICE_MASTER_KEY` prod'da zorunlu** — env yoksa ephemeral key kullanılır (uyarı loglanır); restart sonrası eski şifreli kayıtlar çözülemez. Key rotation/backup operasyonel sorumluluk, şu an manuel (ADR-0008).
2. **Cron yeniden bağlama follow-up** — TCMB kur job'ı `cron.ts`'ten söküldü; yeni `modules/finance/fx` (`FetchAndStoreRatesUseCase` + `POST /v1/finance/fx/rates/fetch`) üzerinden zamanlanması ayrı bir küçük PR'a bırakıldı (endpoint hazır, zamanlayıcı bağı henüz yok).
3. **Tek entegratör implementasyonu** — `ELogoProvider` + `MockProvider` var; QNB eFinans/Foriba adapter'ları port hazır olduğu için ileride eklenebilir.
4. **Integration testler Docker gerektirir** — kullanıcı makinesinde `npm run test:integration` ile **70/70 doğrulandı** (sandbox'ta Docker yok; CI'da Docker servisi gerekir).
5. **e-Fatura kesme (outbound gönderim)** — bu faz çekme/içe-aktarma (inbound + listeleme) odaklı; GİB'e fatura gönderme (UBL üretip imzalayıp gönderme) sonraki kapsam.

## ADR çıktıları

- ✅ ADR-0008 — e-fatura sağlayıcı soyutlaması (`EInvoiceProvider` port/adapter) + AES-256-GCM kimlik şifreleme + extract-on-demand mikroservis notu
- ✅ ADR-0004 — **Closed** (2026-06-01): legacy einvoice exclude istisnası kalktı, bitiş checklist'i tamamen işaretlendi
- ✅ Karar dokümanları `docs/adr/0008-…md` ve `docs/adr/0004-…md` (kapanış notu)

## Sonraki adımlar

Faz 6 burada kapanır. E-fatura ve döviz modülleri Clean Architecture ile tam katmanlı, port/adapter soyutlamalı ve test edilmiş. Sonraki adımlar: cron'u FX fetch use-case'ine bağlama, ikinci entegratör adapter'ı, e-fatura kesme (outbound), ve gerekirse e-fatura modülünün ayrı servise çıkarılması (ADR-0008 extract-on-demand tetikleyicileri).

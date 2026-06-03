# Faz 5 — Finance (Bütçe & Kasa) Verification

**Tarih:** 2026-06-01 · **Faz:** 5 (Finance — Money + Bütçe + Kasa/Banka + Fatura + Commit-to-Cells) tamamlandı

Bu doküman Faz 5'in 8 PR'ının çıktılarını ve doğrulamalarını listeler. Finance modülü artık uçtan uca tam: backend domain → application → infrastructure → presentation → gerçek PG doğrulaması + frontend client → hooks → components → Vitest + App.jsx cutover.

## 8 PR — özet

| PR           | Konu                                                                                        | Durum |
| ------------ | ------------------------------------------------------------------------------------------- | ----- |
| **1**        | Money/Currency/KdvRate/FiscalYear/MonthIndex/FlowDirection/CategorySection VO + KDV servisi | ✅    |
| **2**        | Category + Cell domain + BudgetMatrix servisi + budget use-case'leri                        | ✅    |
| **3**        | Bank/Kasa/Transfer domain + CashPosition + cash use-case'leri                               | ✅    |
| **4**        | Invoice + InvoicePayment + InvoiceStatusPolicy + invoice use-case'leri                      | ✅    |
| **5**        | FinanceUnitOfWork port + CashflowCommitPolicy + commit-to-cells use-case'leri (atomik)      | ✅    |
| **6a/6b/6c** | 8 Pg\* repository + PgFinanceUnitOfWork + REST routes + DI + testcontainers integration     | ✅    |
| **7**        | Frontend: FinanceApiClient + 4 hook + 3 component + FinanceDemoPage + Vitest                | ✅    |
| **8**        | App.jsx cutover (legacy sökme + FinanceDemoPage mount) + ADR-0007 + bu doküman + CHANGELOG  | ✅    |

## Backend — modül yapısı

```
api-server/src/modules/finance/
├── domain/
│   ├── valueObjects/   Money, Currency, KdvRate, FiscalYear, MonthIndex,
│   │                   FlowDirection, CategorySection, EndpointType, InvoiceStatus
│   ├── entities/       Category, Cell, BankAccount, KasaAccount, KasaEntry,
│   │                   Transfer, Invoice, InvoicePayment, Bank
│   ├── services/       KdvCalculator, BudgetMatrix, CashPositionCalculator,
│   │                   InvoiceStatusPolicy, CashflowCommitPolicy
│   └── errors/         FinanceErrors (FinanceError + 15+ alt sınıf)
├── application/
│   ├── ports/          CategoryRepository, CellRepository, CashRepositories,
│   │                   InvoiceRepositories, Clock, FinanceUnitOfWork
│   ├── dto/            BudgetDtos, CashDtos, InvoiceDtos (Money → decimal string)
│   └── useCases/       Category, BudgetMatrix, Account, CashFlow, Invoice,
│                       CommitToCells use-case'leri
├── infrastructure/
│   ├── persistence/    Queryable + 8 Pg*Repository
│   └── unitOfWork/     PgFinanceUnitOfWork (BEGIN/COMMIT/ROLLBACK)
├── presentation/       routes.ts (25 endpoint) + errorMapping.ts
└── index.ts            registerFinanceModule(pool) — DI wiring
```

`api-server/src/index.ts`: `v1.route('/finance', registerFinanceModule(pool))`.

## Money — integer-kuruş aritmetiği (ADR-0007)

`Money` value object iç temsilini **tam sayı kuruş** (`minor`) olarak tutar; float yuvarlama hatası yapısal olarak imkânsız. `fromMajor/fromMinor/fromDecimalString/zero` fabrikaları, `plus/minus/multiply/allocate/negate/abs` aritmetiği, `CurrencyMismatchError` para birimi güvenliği, `toDecimalString` ile `NUMERIC(20,2)` round-trip. Karar gerekçesi: `docs/adr/0007-money-integer-kurus-arithmetic.md`.

## Migration

- `migrations/015_finance_category_active.sql` — `categories` tablosuna `active BOOLEAN NOT NULL DEFAULT TRUE` + kısmi index (idempotent, `IF NOT EXISTS`).
- Mevcut 003 (categories/cells), 004 (banks/kasa/transfers), 005 (invoices + paid_amount trigger + v_invoice_status view) migration'ları yeniden kullanıldı; yeniden oluşturulmadı.

## Integration testler (PR 6c — gerçek PostgreSQL)

```
api-server/src/modules/finance/__tests__/integration/
├── setup.ts                              # PG container + finance migration runner (001-005,015)
├── PgCategoryRepository.itest.ts         # active kolonu + arşivleme + UNIQUE 23505 + multi-tenant
├── PgCellRepository.itest.ts             # ON CONFLICT UPSERT (tek satır) + findOne
├── PgInvoiceRepository.itest.ts          # paid_amount trigger (INSERT+DELETE) + v_invoice_status view
└── CommitToCells.atomic.itest.ts         # UoW atomiklik: commit + ROLLBACK + idempotency guard
```

Doğrulanan DB-tarafı davranışlar (domain'de görünmeyen):

- `cells` `ON CONFLICT (company_id, category_id, fiscal_year, month_idx)` UPSERT — ikinci yazım tek satır kalır.
- `invoice_payments` AFTER INSERT/DELETE trigger → `invoices.paid_amount` otomatik (SUM).
- `v_invoice_status` view → open/partial/paid/overdue (`InvoiceStatusPolicy` ile birebir mantık).
- `PgFinanceUnitOfWork` BEGIN/ROLLBACK: transaction içinde hata → cell yazımı + committed flag geri sarılır; ikinci commit `AlreadyCommittedError` ile reddedilir, cell iki katına çıkmaz.

## Frontend — modül yapısı (PR 7)

```
frontend/src/modules/finance/
├── application/
│   ├── dto/FinanceDtos.ts          # backend JSON sözleşmesinin aynası (decimal string)
│   └── ports/                      # FinanceApi + AuthTokenProvider
├── infrastructure/api/FinanceApiClient.ts   # 27 endpoint, /v1/finance/*
├── presentation/
│   ├── hooks/      useBudgetMatrix, useCategories, useCashPosition, useInvoices
│   └── components/ BudgetMatrixGrid, CashPositionCard, InvoicesTable
├── demo/FinanceDemoPage.tsx        # Bütçe/Nakit/Faturalar sekmeleri (initialTab prop)
└── index.ts                        # public barrel
```

Test altyapısı: `src/test/fixtures/financeFixtures.ts`, `src/test/msw/financeHandlers.ts`, `__tests__/hooks/fakeFinanceApi.ts`. Testler: `FinanceApiClient.test.ts` (13, MSW + gerçek fetch), 3 hook testi (11), 3 component testi (13) = **37 yeni vaka**.

## App.jsx cutover (PR 8)

Seçilen strateji: **tam cutover** (HR PR 7 deseni). Legacy finance UI bileşenleri silindi, view-switch blokları yeni modüle bağlandı.

| Legacy bileşen    | Eski satır           | Durum   |
| ----------------- | -------------------- | ------- |
| `BudgetManager`   | 18610–19986 (~1.377) | Silindi |
| `KasaManager`     | 40319–40908 (~590)   | Silindi |
| `InvoicesUnified` | 54788–54885 (~98)    | Silindi |
| `InvoicesView`    | 54941–56053 (~1.111) | Silindi |

- View-switch: `view === "kasa"` → `<FinanceDemoPage initialTab="cash" />`, `"budget"` → `initialTab="budget"`, `"invoices"` → `initialTab="invoices"`.
- `import { FinanceDemoPage } from './modules/finance';` eklendi.
- **App.jsx: 66.966 → 63.793 satır (−3.176)**.
- Paylaşılan helper'lar (`SidebarTabButton` 7 kullanım, `CHECK_TYPES` 8, `SubTabButton` vb.) korundu — silinen bileşenlere kalan tek referans yorum satırlarıdır, build'i etkilemez.

> **Cutover notu:** Legacy `effectiveData` tabanlı bazı özellikler (e-fatura/`EInvoiceManager`, FX revaluation, manuel fatura düzenleme) yeni modülde henüz yok ve bu görünümlerden kaldırıldı. `EInvoiceManager` ve diğer artık-kullanılmayan bileşenler dosyada ölü kod olarak duruyor (build'i bozmaz); ileride temizlik PR'ı ile sökülebilir.

## Otomatik doğrulamalar

| Kontrol                             | Durum                                                                                              |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| Backend `npm run typecheck`         | ✅ Temiz (0 hata)                                                                                  |
| Backend `npm test` (unit)           | ✅ 649 / 649 pass                                                                                  |
| Backend `npm run test:integration`  | ✅ 66 / 66 pass (51 HR + 15 finance), gerçek PG (Docker) — kullanıcı makinesinde doğrulandı        |
| Frontend `npm run typecheck`        | ✅ Temiz (0 hata) — kullanıcı makinesinde doğrulandı                                               |
| Frontend `npm test`                 | ✅ 120 / 120 pass (83 HR + 37 finance) — kullanıcı makinesinde doğrulandı                          |
| App.jsx sözdizimi (cutover sonrası) | ✅ TS transpile: yeni sözdizimi hatası yok (mevcut 1 uyarı pre-existing, Babel/Vite tolere ediyor) |
| Frontend `npm run build` (vite)     | ⏳ Kullanıcı makinesinde vite binary eksik install — `npm install` sonrası doğrulanmalı            |

> **Sandbox limitleri:** Backend/frontend testleri ve typecheck kullanıcının Windows makinesinde (cmd.exe) çalıştırılıp tümü yeşil alındı. `vite build` yalnızca vite paketi eksik kurulu olduğu için çalışmadı (kod kaynaklı değil); temiz `npm install` sonrası beklenen sonuç başarılı derlemedir.

## Test metrikleri — Faz 4-bis → Faz 5

| Metrik                   | Faz 4-bis     | Faz 5            | Δ     |
| ------------------------ | ------------- | ---------------- | ----- |
| Backend unit test        | 493           | 649              | +156  |
| Backend integration test | 51 (HR)       | 66 (HR+finance)  | +15   |
| Frontend test            | 83 (HR)       | 120 (HR+finance) | +37   |
| App.jsx satır            | ~67.0k        | 63.8k            | −3.2k |
| ADR                      | 0006'ya kadar | 0007 eklendi     | +1    |

## Bilinen kısıtlar

1. **Frontend `vite build`** — ✅ **Çözüldü (2026-06-02):** kullanıcı makinesinde üretim derlemesi başarılı (2336 modül dönüştürüldü, `dist/` üretildi, ~8.7s). Kod sorunu yoktu; tek pürüz npm workspace `.bin/vite` shim'inin yerel yola işaret etmesiydi (vite kökte hoist'li — `node node_modules/vite/bin/vite.js build` ile derlenir).
2. **Yeni finance modülü ağırlıklı görüntüleme odaklı** — bütçe matrisi/kasa pozisyonu/fatura listesi görüntüleniyor; yaratma/düzenleme formları (kategori ekle, kasa hareketi gir, fatura oluştur) sonraki fazda eklenir. REST uçları (`POST /cells`, `/kasa-entries`, `/invoices` vb.) ve FinanceApiClient metodları hazır.
3. **e-Fatura / FX revaluation** — ✅ **Çözüldü (Faz 6):** `modules/finance/einvoice` + `modules/finance/fx` eklendi; App.jsx'teki legacy `EInvoiceManager` + `FxRevaluationView` cutover'da silindi (bkz. CHANGELOG Faz 6, −1.223 satır).
4. **Çoklu para birimi bütçe** — `cells` tablosunda currency kolonu yok; bütçe şirketin ana biriminde (TRY varsayılan) planlanıyor (bkz. `Cell.ts` / `PgCellRepository.ts` notu).
5. **Money 2-ondalık varsayımı** — JPY (0 ondalık) / BHD (3 ondalık) gibi para birimleri için `MINOR_PER_MAJOR` currency'den türetilmeli (ADR-0007 Consequences).

## ADR-0007 zorunlu çıktıları

- ✅ `Money` integer-kuruş VO + para birimi güvenliği (`CurrencyMismatchError`)
- ✅ `NUMERIC(20,2)` ↔ `toDecimalString`/`fromDecimalString` round-trip
- ✅ KDV/allocate/kalan tutar hesapları kuruş-kesin
- ✅ Karar dokümanı `docs/adr/0007-money-integer-kurus-arithmetic.md`

## Sonraki adımlar

Faz 5 burada kapanır. Finance modülü Clean Architecture ile tam katmanlı ve test edilmiş durumda. Sonraki fazlar (yaratma/düzenleme formları, e-fatura modülünün modülerleştirilmesi, FX revaluation, çoklu-para bütçe) bu zemin üzerine eklenir.

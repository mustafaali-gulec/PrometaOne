# Changelog

Sürüm tarihçesi. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) + [SemVer](https://semver.org).

## [Unreleased] — Faz 6 sonrası

### Added — Faz 6 (Finance — E-Fatura & Döviz)

- **E-fatura alt modülü** (`api-server/src/modules/finance/einvoice/`) — Clean Architecture, GİB e-Fatura/e-Arşiv:
  - **Domain VO'ları:** `Vkn` (VKN 10-hane + TCKN 11-hane checksum), `Ettn` (UUID), `InvoiceDirection`, `EInvoiceScenario`, `EInvoiceType`, `GibStatus`, `ProviderType`
  - **Entity'ler:** `EInvoiceCredential` (+`CredentialConfig`), `EInvoice` (`fromParsed`, `markImported/markIgnored`), `EInvoiceLine`, `PartyMapping`
  - **Domain servisleri:** `UblInvoiceParser` (UBL-TR 2.1 — SATIS/TEVKIFAT/döviz/e-Arşiv + GİB vergi kodları KDV 0015 / Tevkifat 9015 / ÖTV 0071 / Konaklama 0059), `EInvoiceToInvoicePolicy` (e-fatura → Faz 5 Invoice; incoming→'out', outgoing→'in')
  - **Use-case'ler:** Credential (save/test/delete + AES round-trip), `SyncEInvoicesUseCase` (idempotent UPSERT), `ImportEInvoiceUseCase` (UoW atomik → Faz 5 Invoice), PartyMapping
- **E-fatura sağlayıcı soyutlaması (ADR-0008):** `EInvoiceProvider` portu + `ELogoProvider` (strong-soap, dinamik import + ambient `.d.ts`) + `MockProvider` (ağsız, seed UBL XML). Yeni entegratör = yeni adapter + `ProviderType` değeri; domain değişmez.
- **AES-256-GCM kimlik şifreleme (ADR-0008):** `CredentialCipher` portu + `AesGcmCredentialCipher` (`EINVOICE_MASTER_KEY` base64 32-byte, rastgele 12-byte IV, GCM auth tag → `CredentialDecryptError`). DB'de `BYTEA config_encrypted/config_iv/config_tag`; plaintext yok. `resolveCipher()` env yoksa ephemeral key + uyarı.
- **Döviz (FX) alt modülü** (`api-server/src/modules/finance/fx/`):
  - `ExchangeRate` + `Revaluation` domain, `RevaluationCalculator` (kuruş-kesin, kur kârı 646 / zararı 656)
  - `TcmbRateProvider` (TCMB/EVDS — seriler `TP.DK.USD.A.YTL`/`TP.DK.EUR.A.YTL`, `fetch` enjekte; HTTP/exception → `RateProviderError`)
  - Use-case'ler: `FetchAndStoreRates`, `GetCurrentRates`, `GetRateAt` (tam tarih yoksa önceki en yakın; TRY→1), `CreateRevaluation`, `PostRevaluation` (idempotent, multi-tenant)
- **Infrastructure:** 6 `Pg*Repository` + `PgEInvoiceUnitOfWork` (BEGIN/COMMIT/ROLLBACK; import'u Faz 5 `invoices`'a atomik yazar) + FX için 2 Pg repo
- **REST** (`einvoice/presentation/routes.ts`) — `/v1/finance/einvoice/*` + `/v1/finance/fx/*` (Faz 5 ile aynı prefix); `errorMapping.ts` (404/409/400/502 + finance fallback)
- **Migration 016** — doğru INT FK'li e-fatura şeması (`einvoice_credentials` BYTEA, `einvoice_invoices` `UNIQUE(company_id,uuid)`, `einvoice_sync_log`, `einvoice_party_mapping`, `einvoice_pending` view). **009 NO-OP'a çevrildi** (eski UUID FK şeması Faz 5 INT ile uyumsuzdu).
- **Integration test** — `einvoice/__tests__/integration/PgEInvoice.itest.ts` (testcontainers): credential şifreli round-trip, sync UPSERT idempotency, import atomik, pending view
- **E-fatura frontend** (`frontend/src/modules/finance/`): `EInvoiceApiClient` + `EInvoiceApi` port + `EInvoiceDtos`; hook'lar `useEInvoices`/`useCurrentRates`/`useRevaluations`; component'ler `EInvoiceInbox`/`CurrentRatesCard`/`RevaluationsTable`; `FinanceDemoPage`'e `einvoice`+`fx` sekmeleri. Vitest **+20 vaka → 140 toplam**.
- **Toplam backend unit testi: 649 → 723 pass / 0 fail**
- **ADR-0008** — e-fatura sağlayıcı soyutlaması + AES-256-GCM kimlik şifreleme + extract-on-demand mikroservis notu
- **Faz 6 verification** — `docs/PHASE_6_VERIFICATION.md`

### Changed — Faz 6

- `api-server/src/index.ts` — `registerEInvoiceModule(pool)` ile e-fatura+FX modülü `/v1/finance` altına mount edildi.
- **App.jsx e-fatura + FX cutover** — `view === "fx"` görünümü `<FinanceDemoPage initialTab="fx" />`'e bağlandı (e-fatura sekmesi de aynı sayfada `initialTab="einvoice"`).

### Removed — Faz 6 (cutover + ADR-0004 kapanışı)

- Legacy backend silindi: `src/routes/einvoice.ts`, `src/services/einvoice/*` (elogo/ubl-parser/crypto/index), `src/services/tcmb.ts`. `routes/misc.ts`'ten `fx` export bloğu + tcmb import kaldırıldı; `index.ts`'ten fx mount'ları; `cron.ts`'ten TCMB kur job'ı (→ `modules/finance/fx`'e devredildi).
- `api-server/tsconfig.json` `exclude`'dan `src/routes/einvoice.ts` + `src/services/einvoice/**` satırları kaldırıldı — **ADR-0004 Closed**.
- Legacy App.jsx UI kümeleri silindi: `EInvoiceManager`+`EInvoiceTable`+`ELogoCredentialsModal`+`SyncHistory`+`generateMockEinvoices` (~709), `FxRevaluationView`+`PostRevaluationModal` (~516) — **App.jsx: 63.793 → 62.570 satır (−1.223)**.

---

## Faz 5 sonrası

### Added — Faz 5 (Finance — Bütçe & Kasa)

- **Money value object — integer-kuruş aritmetiği** (`api-server/src/modules/finance/domain/valueObjects/Money.ts`):
  - Tam sayı (kuruş) iç temsil; float yuvarlama hatası yapısal olarak imkânsız
  - `fromMajor/fromMinor/fromDecimalString/zero` + `plus/minus/multiply/allocate/negate/abs` + `compareTo/equals`
  - `CurrencyMismatchError` ile çoklu-para güvenliği; `toDecimalString` ile `NUMERIC(20,2)` round-trip
  - Diğer VO'lar: `Currency`, `KdvRate`, `FiscalYear`, `MonthIndex`, `FlowDirection`, `CategorySection`, `EndpointType`, `InvoiceStatus`
- **Finance domain** (`api-server/src/modules/finance/domain/`):
  - Entity'ler: `Category`, `Cell`, `BankAccount`, `KasaAccount`, `KasaEntry`, `Transfer`, `Invoice`, `InvoicePayment`, `Bank`
  - Servisler: `KdvCalculator`, `BudgetMatrix`, `CashPositionCalculator`, `InvoiceStatusPolicy`, `CashflowCommitPolicy`
  - `FinanceErrors` — `FinanceError` + 15+ alt sınıf
- **Finance application** — Category/BudgetMatrix/Account/CashFlow/Invoice/CommitToCells use-case'leri + portlar + DTO'lar (Money → decimal string)
- **FinanceUnitOfWork** — cross-aggregate atomik yazımlar (commit-to-cells: cell upsert + kaynak committed flag tek transaction'da)
- **Finance infrastructure** — `Queryable` + 8 `Pg*Repository` + `PgFinanceUnitOfWork` (BEGIN/COMMIT/ROLLBACK)
- **Finance REST** (`presentation/routes.ts`) — 25 endpoint (`/v1/finance/*`), `authMiddleware` + yazma için `requireRole('cfo')` + `errorMapping`
- **Migration 015** — `categories.active` kolonu (kategori arşivleme; idempotent)
- **Finance integration testleri** (`__tests__/integration/`) — testcontainers ile gerçek PG: cells ON CONFLICT UPSERT, `invoice_payments` paid_amount trigger, `v_invoice_status` view, commit-to-cells UoW atomik rollback + idempotency (**+15 integration vakası → 66 toplam**)
- **Finance frontend** (`frontend/src/modules/finance/`):
  - `FinanceApiClient` (27 endpoint) + `FinanceApi` portu + `FinanceDtos`
  - Hook'lar: `useBudgetMatrix`, `useCategories`, `useCashPosition`, `useInvoices`
  - Component'ler: `BudgetMatrixGrid`, `CashPositionCard`, `InvoicesTable` + `FinanceDemoPage` (Bütçe/Nakit/Faturalar sekmeleri)
  - Vitest: FinanceApiClient (MSW) + hook + component testleri (**+37 frontend vakası → 120 toplam**)
- **Toplam backend unit testi: 493 → 649 pass / 0 fail**
- **ADR-0007** — Money integer-kuruş aritmetiği kararı
- **Faz 5 verification** — `docs/PHASE_5_VERIFICATION.md`

### Changed — Faz 5

- `api-server/src/index.ts` — `v1.route('/finance', registerFinanceModule(pool))` ile finance modülü mount edildi.
- **App.jsx finance cutover** — `view === "kasa" | "budget" | "invoices"` görünümleri yeni `FinanceDemoPage`'e bağlandı (`initialTab` cash/budget/invoices).

### Removed — Faz 5 (App.jsx cutover)

- Legacy finance UI bileşenleri silindi: `BudgetManager`, `KasaManager`, `InvoicesUnified`, `InvoicesView` (**App.jsx: 66.966 → 63.793 satır, −3.176**).
- Not: legacy `EInvoiceManager` (e-fatura) ve FX revaluation görünümleri yeni modülde henüz yok; ilgili bileşenler ölü kod olarak duruyor (temizlik sonraki PR).

### Added — Faz 4-bis (Test sertleştirme + atomik garantiler)

- **Unit of Work pattern** (`api-server/src/modules/hr/`):
  - `application/ports/UnitOfWork.ts` — `withTransaction(fn)` port + `HrTransactionalRepositories` interface
  - `infrastructure/persistence/Queryable.ts` — `Pool | PoolClient` ortak interface
  - `infrastructure/unitOfWork/PgUnitOfWork.ts` — gerçek PG BEGIN/COMMIT/ROLLBACK
  - 7 `Pg*Repository` constructor'ı `Pool` → `Queryable` (geriye uyumlu)
  - `HireFromApplicationUseCase` refactor: manuel try/catch rollback → `uow.withTransaction`
  - In-memory `FakeUnitOfWork` (test'ler için)
  - **+4 yeni unit test** (atomik happy + rollback + domain hatası + audit COMMIT sonrası)
  - **Toplam backend unit testi: 489 → 493 pass / 0 fail**
- **testcontainers integration test altyapısı** (`api-server/src/modules/hr/__tests__/integration/`):
  - `setup.ts` — `PostgreSqlContainer` factory + migration runner + truncate helper + seed helpers
  - 8 integration test dosyası: `Pg{OrgUnit,Department,Position,Employee,Candidate,Application,ApplicationStageHistory}Repository.itest.ts` + `PgEmployeeNumberGenerator.itest.ts`
  - `HireFromApplication.atomic.itest.ts` — UoW rollback gerçek PG'de kanıtlanır (UNIQUE violation → application 'offer'da kalır)
  - DB trigger doğrulamaları: `org_units_no_cycle`, `applications_stage_history`
  - PG `'23505'` UNIQUE çakışma davranışları
  - Concurrency: `PgEmployeeNumberGenerator` 5 paralel `next()` → 5 benzersiz
  - `api-server/src/types/testcontainers-postgresql.d.ts` ambient declaration (paket `.d.ts` yayınlamadığı için)
- **Frontend test altyapısı** (`frontend/`):
  - `vitest.config.ts` + `src/test/setup.ts` — jsdom + jest-dom + MSW lifecycle
  - `src/test/msw/{server,hrHandlers}.ts` — HrApiClient MSW mock'ları
  - `src/test/fixtures/hrFixtures.ts` — paylaşılan DTO fixture'ları
  - `playwright.config.ts` — E2E config
- **Frontend unit + component testleri** (`frontend/src/modules/hr/__tests__/`):
  - `HrApiClient.test.ts` (~25 vaka, MSW ile 28 endpoint × happy + 401/403/404/422)
  - 6 hook testi (`useOrgTree`, `useEmployees`, `usePositions`, `useCandidates`, `useApplications`, `useRecruitmentFunnel` — toplam ~27 vaka)
  - 6 component testi (`OrgTreeView`, `EmployeesTable`, `PositionsList`, `RecruitmentFunnel`, `ApplicationKanban`, `CandidateForm` — toplam ~31 vaka)
- **Playwright E2E** (`frontend/e2e/hr-recruitment-flow.spec.ts`):
  - Uçtan uca akış: aday başvur → stage chain (new → screening → interview → offer) → hire → Employees'te otomatik görünür mü
  - Lokal stack (Docker + api-server + frontend dev) gerekli; CI'de webServer config açılabilir
- **ADR-0006** — Unit of Work pattern: HR modülü, atomik cross-aggregate yazımlar
- **Faz 4-bis verification** — `docs/PHASE_4_BIS_VERIFICATION.md`

### Changed — Faz 4-bis

- 7 `Pg*Repository` constructor parametresi `Pool` → `Queryable` (`Pool | PoolClient`). Mevcut çağrıcılar etkilenmez; UoW içinde aynı transaction'ın client'ı geçirilir.
- `HireFromApplicationUseCase` constructor imzası: `(uow, candidates, departments, employeeNumberGen, clock, audit)`. Eski parametreler (`applications`, `employees`) UoW içinden çekilir.
- `api-server/package.json` scripts: `test:integration` eklendi.
- `frontend/package.json` scripts: `test`, `test:watch`, `test:ui`, `test:e2e`, `test:e2e:ui` eklendi.

## [Unreleased] — Faz 4 sonrası

### Added — Faz 4 (HR Core)

- **Backend HR modülü** (`api-server/src/modules/hr/`):
  - 6 domain entity (OrgUnit, Department, Position, Employee, Candidate, Application)
  - 11 value object (TcKimlik mod 10/11, PhoneNumber TR normalize, HireDate, EmployeeNumber, OrgUnitCode, DepartmentCode, PositionStatus, EmployeeStatus, EmploymentType, CandidateSource, RecruitmentStage)
  - 4 domain service (OrgTreeBuilder, EmployeeNumberGenerator, ApplicationStageTransitionPolicy, HireFromApplicationPolicy)
  - **32 application use-case** (5 OrgUnit + 4 Department + 4 Position + 7 Employee + 4 Candidate + 8 Application)
  - **35+ REST endpoint** (Hono + zod validator), tümü `authMiddleware` ile korumalı, yazma işlemleri `hr_manager` rolü gerektirir
  - 7 PostgreSQL repository + PgAuditLogger + PgEmployeeNumberGenerator (UPSERT + RETURNING) + AuthUserLookupAdapter (anti-corruption layer)
  - **489 test pass / 0 fail** (203 domain + 286 application)
- **DB migrations:**
  - `012_hr.sql` — 7 yeni tablo (org_units, departments, positions, employees, candidates, applications, application_stage_history) + cycle-önleyici trigger + stage history audit trigger
  - `013_user_role_hr_manager.sql` — `user_role` ENUM'a `hr_manager` eklendi
  - `014_hr_employee_no_sequence.sql` — şirket bazlı employee_no sayacı
- **Frontend HR modülü** (`frontend/src/modules/hr/`):
  - DTO tipleri (6 entity + 5 response zarfı, backend ile birebir senkron)
  - `HrApiClient` — 28 metodlu fetch wrapper (tüm endpoint'lere tipli erişim)
  - 6 React hook (useOrgTree, useEmployees, usePositions, useCandidates, useApplications, useRecruitmentFunnel)
  - 6 component (OrgTreeView, EmployeesTable, PositionsList, RecruitmentFunnel, ApplicationKanban native drag-drop, CandidateForm)
  - `HrDemoPage` — 4 sekmeli standalone demo (Organizasyon / Personel / Pozisyonlar / İşe Alım)
  - `hr-demo.html` + `hr-demo-entry.tsx` vite preview
- **ADR-0005** — `hr_manager` rolü gerekçesi + Employee↔User opsiyonel link kararı
- **Modül dokümantasyonu** — `api-server/src/modules/hr/README.md`
- **Faz 4 verification** — `docs/PHASE_4_VERIFICATION.md`

### Changed

- **`App.jsx` 81.159 → 66.966 satır** (−14.193 satır). Eski HR component'leri (HRModule, OrganizationManager, EmployeesList, PositionsList + 3 form modal + 4 node) silindi; yerlerine `import { HrDemoPage } from './modules/hr'` mount edildi.
- `api-server/src/types.ts` ve `modules/auth/UserRole.ts` — yeni rol hiyerarşisi: `viewer < editor < hr_manager < cfo < admin`
- `AuditLogger.AuditEntry` interface'ine opsiyonel `at?: Date` eklendi (deterministik audit zaman damgası)
- `eslint.config.js` — test dosyaları için `@typescript-eslint/no-floating-promises` ve `require-await` `off` (node:test pattern uyumu)

### Architecture notes

- **Strangler Fig:** Eski monolitik HR kodu modüler `modules/hr/` altına taşındı. `data.hr*` client-side state'i artık kullanılmıyor — modül kendi state'ini REST API'den çeker.
- **Anti-corruption layer:** HR modülü auth modülünün domain'ine yazmaz, yalnız `UserLookupPort` üzerinden okur (ADR-0005).
- **Atomik HireFromApplication:** Application "hired" stage'i + Employee insert tek mantıksal birim — fake'lerde manuel rollback, production'da DB transaction (geliştirme PR 4-bis).

## [Earlier]

- Faz 3 (Auth & Users) — `modules/auth/`
- Faz 2 (AI Widget + ML Proxy) — `modules/ai/`
- Faz 1 (Notifications) — `modules/notifications/`
- Faz 0 (Foundation) — tooling, ADR'ler, modül iskeleti

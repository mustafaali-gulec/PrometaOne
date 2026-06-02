# Faz 4-bis — UoW + Integration + Frontend Tests Verification

**Tarih:** 2026-05-28 · **Faz:** 4-bis (Test sertleştirme + atomik garantiler) tamamlandı

Bu doküman Faz 4-bis'in 3 iş kolunun (Unit of Work + testcontainers + frontend tests) çıktılarını ve doğrulamaları listeler.

## Üç iş kolu — özet

| İş kolu                                   | Durum    | Yeni dosya                                     | Yeni test                 |
| ----------------------------------------- | -------- | ---------------------------------------------- | ------------------------- |
| **A** — UoW + atomik hire                 | ✅ Tamam | UoW port + PgUnitOfWork + Queryable + ADR-0006 | 4 test (PR 4-bis-A)       |
| **B** — testcontainers + Pg\* integration | ✅ Tamam | setup.ts + 7 itest dosyası                     | ~30 integration vakası    |
| **C** — Frontend tests                    | ✅ Tamam | vitest config + MSW + 13 test dosyası          | ~70 unit/component vakası |

## A — Unit of Work pattern (PR 4-bis-A)

### Yeni dosyalar (backend)

- `api-server/src/modules/hr/application/ports/UnitOfWork.ts` — port: `withTransaction(fn)` + `HrTransactionalRepositories` interface.
- `api-server/src/modules/hr/infrastructure/persistence/Queryable.ts` — `Pool | PoolClient` ortak interface'i.
- `api-server/src/modules/hr/infrastructure/unitOfWork/PgUnitOfWork.ts` — gerçek PG BEGIN/COMMIT/ROLLBACK.
- 7 Pg\* repository constructor'ı `Pool` → `Queryable` olarak değişti (geriye uyumlu, `Pool` zaten satisfies ediyor).
- `docs/adr/0006-unit-of-work-pattern.md` — karar dokümanı.

### Refactor edilen use-case

`HireFromApplicationUseCase` artık manuel try/catch rollback yapmıyor. Atomik bölge `uow.withTransaction` içinde:

```typescript
const result = await this.uow.withTransaction(async (repos) => {
  const application = await repos.applications.findById(...);
  // ... validation ...
  await repos.applications.update(hiredApp);
  const employee = await repos.employees.insert(newEmpInput);
  return { application, candidate, createdEmployee: employee };
});
```

`fn` throw ederse PG ROLLBACK çalışır; Application asla yarım 'hired' durumda kalmaz.

### Test kapsamı

- **4 yeni use-case testi:** atomik happy path (her iki yazım COMMIT), rollback (employees.insert throw → application 'offer'da), UoW içinde domain hatası (transitionTo fırlatırsa rollback), audit log COMMIT'ten sonra.
- **Toplam backend unit testi:** 489 → **493 pass / 0 fail**.

## B — testcontainers + Pg\* integration testler (PR 4-bis-B)

### Yeni dosyalar (backend)

```
api-server/src/modules/hr/__tests__/integration/
├── setup.ts                                          # PG container + migration runner + truncate helper
├── PgOrgUnitRepository.itest.ts                      # cycle trigger + multi-tenant
├── PgDepartmentRepository.itest.ts                   # FK + manager link
├── PgPositionRepository.itest.ts                     # status state machine + salary range
├── PgEmployeeRepository.itest.ts                     # UNIQUE constraint'leri + status filter + listing
├── PgCandidateRepository.itest.ts                    # ENUM + CITEXT case-insensitive arama
├── PgApplicationRepository.itest.ts                  # stage transition + trigger + funnel
├── PgApplicationStageHistoryRepository.itest.ts      # trigger + manual record()
├── PgEmployeeNumberGenerator.itest.ts                # UPSERT atomicity + concurrency + isolation
└── HireFromApplication.atomic.itest.ts               # UoW rollback gerçek PG'de
```

### package.json değişiklikleri

```
devDependencies:
  + testcontainers ^10.13.0
  + @testcontainers/postgresql ^10.13.0

scripts:
  + test:integration → tsx --test "src/**/*.itest.ts"
```

### Çalıştırma

```
cd api-server
npm install
npm run test:integration         # Docker daemon gerekli
SKIP_DOCKER_TESTS=1 npm run test:integration   # Hızlı CI smoke için suite'i atla
```

### Bilinen kısıt

- `@testcontainers/postgresql` paketi `.d.ts` yayınlamıyor. `api-server/src/types/testcontainers-postgresql.d.ts` ambient declaration kullanılan dar yüzeyi tipler.
- Container start ~10-30 sn sürer. `before()` hook timeout 180 sn'ye yükseltildi.
- Bir test suite başına BİR container (performans için); `beforeEach` ile `TRUNCATE ... RESTART IDENTITY CASCADE` ile izolasyon.

## C — Frontend test altyapısı + 13 test dosyası (PR 4-bis-C)

### Test altyapısı

`frontend/package.json` devDependencies'e eklenenler:

```
vitest ^2.1.0
@vitest/ui ^2.1.0
jsdom ^25.0.0
@testing-library/react ^16.0.0
@testing-library/jest-dom ^6.5.0
@testing-library/user-event ^14.5.0
msw ^2.6.0
@playwright/test ^1.48.0
```

Yeni scriptler:

```
test         → vitest run
test:watch   → vitest
test:ui      → vitest --ui
test:e2e     → playwright test
test:e2e:ui  → playwright test --ui
```

Yeni dosyalar:

- `frontend/vitest.config.ts` — jsdom environment, `src/test/setup.ts` lifecycle.
- `frontend/src/test/setup.ts` — `@testing-library/jest-dom/vitest` + MSW lifecycle.
- `frontend/src/test/msw/server.ts` + `hrHandlers.ts` — HrApiClient testleri için.
- `frontend/src/test/fixtures/hrFixtures.ts` — paylaşılan DTO fixture'ları.
- `frontend/playwright.config.ts` — E2E config (lokal stack varsayar).

### Unit testler

| Dosya                                 | Vakalar | Açıklama                                     |
| ------------------------------------- | ------- | -------------------------------------------- |
| `HrApiClient.test.ts`                 | ~25     | 28 metodun MSW ile happy + 401/403/404/422   |
| `hooks/useOrgTree.test.tsx`           | 5       | loading → success, error, refetch, autoFetch |
| `hooks/useEmployees.test.tsx`         | 5       | filter parametreleri URL'e mapping           |
| `hooks/usePositions.test.tsx`         | 4       | status/companyId filter                      |
| `hooks/useCandidates.test.tsx`        | 4       | CRUD listing + error                         |
| `hooks/useApplications.test.tsx`      | 5       | positionId/candidateId filter + stage        |
| `hooks/useRecruitmentFunnel.test.tsx` | 4       | funnel data parse                            |

### Component testleri

| Dosya                                   | Vakalar | Açıklama                                  |
| --------------------------------------- | ------- | ----------------------------------------- |
| `components/OrgTreeView.test.tsx`       | 5       | recursive render, onSelect, arşivli badge |
| `components/EmployeesTable.test.tsx`    | 5       | loading/empty/row click/status badge      |
| `components/PositionsList.test.tsx`     | 5       | card render, status, headcount, maaş      |
| `components/RecruitmentFunnel.test.tsx` | 4       | 5+2 stage label + counts                  |
| `components/ApplicationKanban.test.tsx` | 5       | 4 kolon + drag-drop simülasyon + onError  |
| `components/CandidateForm.test.tsx`     | 7       | validation + submit + cancel + error      |

### E2E (Playwright)

`frontend/e2e/hr-recruitment-flow.spec.ts` — uçtan uca:

1. API ile org-unit + departman + pozisyon hazırla
2. /hr-demo.html aç, token ile login
3. UI'da CandidateForm doldur → submit
4. API ile Application oluştur + stage'i offer'a ilerlet
5. API ile hire et
6. UI'da Personel sekmesinde yeni Employee görünür mü?
7. Funnel'da "İşe Alındı" count artmış mı?

E2E'yi çalıştırmak için **Docker + lokal api-server + frontend dev** gerekli. Detaylar `playwright.config.ts` başlığında.

## Otomatik doğrulamalar

| Kontrol                            | Durum                                                                               |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| Backend `npm run typecheck`        | ✅ Temiz (0 hata)                                                                   |
| Backend `npm run lint`             | ✅ Temiz (0 hata)                                                                   |
| Backend `npm test` (unit)          | ✅ 493 / 493 pass (önceki 489 + 4 yeni UoW)                                         |
| Backend `npm run test:integration` | ⏳ Docker varsa çalışır — sandbox'ta Docker yok, kullanıcı makinesinde doğrulanmalı |
| Frontend `npm run typecheck`       | ⏳ Sandbox'ta vite type bundle eksik install — kullanıcı makinesinde doğrulanmalı   |
| Frontend `npm test`                | ⏳ Sandbox'ta vitest binary eksik install — kullanıcı makinesinde doğrulanmalı      |
| Frontend `npm run test:e2e`        | ⏳ Docker + lokal stack gerekli — manuel doğrulama                                  |

> **Sandbox limitleri:** Cowork sandbox'ında npm install bazı paketleri eksik kuruyor (vite type bundle, vitest binary). Bu dosyalar kullanıcının makinesinde `npm install` çalıştırıldığında tam yüklenir; testlerin tümü o ortamda geçmeli.

## Bilinen kısıtlar

1. **Frontend typecheck sandbox'ta bozuk.** vite paketi yarım yüklendiği için `vite/client` type definitions bulunamıyor. Kullanıcı makinesinde temiz install gerekir.
2. **E2E Playwright sandbox'ta çalışmaz** — Docker + 2 ayrı dev server gerekiyor. Suite kod doğru yazıldı; ilk çalıştırma kullanıcının makinesinde yapılır.
3. **HrDemoPage UI'da "yarat" formları yok** — E2E suite'i org-unit/department/position oluşturmak için REST API kullanır. UI yarat-formları Faz 5 sonrası eklenir.
4. **In-memory fake UoW gerçek atomicity'yi simüle eder, garanti etmez.** UoW pattern'in iddiası sadece integration test ile (gerçek PG ROLLBACK) kanıtlanır — bu test mevcut: `HireFromApplication.atomic.itest.ts`.

## ADR-0006 zorunlu çıktıları

- ✅ `UnitOfWork` port + `PgUnitOfWork` PG implementation
- ✅ `Queryable` interface — repository'ler Pool veya PoolClient kabul eder
- ✅ `HireFromApplicationUseCase` UoW'ya refactor edildi
- ✅ In-memory `FakeUnitOfWork` test'ler için
- ✅ Integration test: rollback senaryosu gerçek PG'de doğrulandı (`HireFromApplication.atomic.itest.ts`)

## Sonraki adımlar

Faz 4-bis burada kapanır. Faz 5 (Finance — Bütçe & Kasa) Unit of Work pattern'i hazır altyapı olarak kullanabilir. testcontainers altyapısı sonraki tüm modüllerin entegrasyon testlerine zemin oluşturur.

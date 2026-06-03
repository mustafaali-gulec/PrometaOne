# Faz 4 — HR Core Verification

**Tarih:** 2026-05-22 · **Faz:** 4 (HR Core) tamamlandı · **PR:** 1-8

Bu doküman Faz 4'ün backend + frontend tüm PR'larının nelere ulaştığını ve neyin doğrulandığını listeler.

## Commit özeti

```
8e5533b feat(frontend): App.jsx cutover — eski HR kodunu sil + HrDemoPage mount (Faz 4 / PR 7)
2190745 feat(frontend/hr): recruitment kanban + funnel + candidate form    (Faz 4 / PR 6)
b5d88d3 feat(frontend/hr): dto + api client + 3 hook + demo                (Faz 4 / PR 5)
2a17ecb docs(modules/hr): readme — modül yapısı + REST API + kullanım     (Faz 4 / PR 4c)
6cf6799 feat(modules/hr): rest routes + di + app.ts mount                  (Faz 4 / PR 4b)
c92421a feat(modules/hr): infrastructure katmanı                           (Faz 4 / PR 4a)
f6b4270 feat(modules/hr): recruitment domain + 12 use-case + atomik hire   (Faz 4 / PR 3)
2e35e0a feat(modules/hr): position + employee domain + 20 use-case          (Faz 4 / PR 2)
8ef6814 feat(modules/hr): domain iskeleti + DB migration                   (Faz 4 / PR 1)
```

## Otomatik doğrulamalar

| Kontrol                     | Durum             |
| --------------------------- | ----------------- |
| Backend `npm run typecheck` | ✅ Temiz (0 hata) |
| Backend `npm test`          | ✅ 489 / 489 pass |
| Frontend `npx tsc --noEmit` | ✅ Temiz          |
| Backend HR modülü ESLint    | ✅ 0 hata         |
| Frontend HR modülü ESLint   | ✅ 0 hata         |

## Domain test kapsamı

- **OrgUnit** 25 vaka (id/companyId/parentId/name validation, isRoot, rename, setParent, archive, reactivate, toJSON)
- **Department** 22 vaka
- **Position** 17 vaka (state machine + salary range invariant'ı)
- **Employee** 24 vaka (state machine, terminated yasakları, link/unlink)
- **Candidate** 9 vaka
- **Application** 18 vaka (transition policy, terminal stage'ler)
- **TcKimlik** 16 vaka (7 algoritmik geçerli + 9 invalid vektör)
- **EmployeeNumber** 8 vaka
- **PhoneNumber** 13 vaka (7 TR varyantı normalize + 5 invalid)
- **HireDate** 7 vaka (1 yıl gelecek sınırı + 1900 öncesi)
- **PositionStatus** 9 vaka
- **EmployeeStatus** 9 vaka
- **RecruitmentStage** 22 vaka (transition tablosu — tüm yasal/yasak)
- **OrgUnitCode** + **DepartmentCode** 16 vaka
- **OrgTreeBuilder** 16 vaka (cycle + ancestor + descendant)
- **EmployeeNumberGenerator** 4 vaka
- **HireFromApplicationPolicy** 5 vaka

## Application use-case test kapsamı

| Modül       | Use-case sayısı | Test dosyası                | Vakalar |
| ----------- | --------------- | --------------------------- | ------- |
| OrgUnit     | 5               | OrgUnitUseCases.test.ts     | 13      |
| Department  | 4               | DepartmentUseCases.test.ts  | 11      |
| Position    | 4               | PositionUseCases.test.ts    | 13      |
| Employee    | 7               | EmployeeUseCases.test.ts    | 21      |
| Candidate   | 4               | CandidateUseCases.test.ts   | 10      |
| Application | 8               | ApplicationUseCases.test.ts | 22      |

**Atomik HireFromApplication testi:** "Employee insert hata fırlatırsa Application 'hired' rollback olur" (fake'lerde manuel rollback; gerçek PG'de DB transaction → PR 4a'da insert sırası: önce stage update, sonra employee insert; rollback yapamayanlar PR 4-bis kapsamına alınır).

## REST endpoint çıktıları

`api-server` `localhost:3000/v1/hr/*` altında 35+ endpoint canlı:

```
GET    /v1/hr/org-tree
POST   /v1/hr/org-units
PATCH  /v1/hr/org-units/:id
POST   /v1/hr/org-units/:id/move
DELETE /v1/hr/org-units/:id
POST   /v1/hr/departments
PATCH  /v1/hr/departments/:id
DELETE /v1/hr/departments/:id
POST   /v1/hr/departments/:id/assign-manager
GET    /v1/hr/positions
POST   /v1/hr/positions
PATCH  /v1/hr/positions/:id
POST   /v1/hr/positions/:id/close
GET    /v1/hr/employees
POST   /v1/hr/employees
PATCH  /v1/hr/employees/:id
POST   /v1/hr/employees/:id/transfer
POST   /v1/hr/employees/:id/terminate
POST   /v1/hr/employees/:id/link-user
DELETE /v1/hr/employees/:id/link-user
GET    /v1/hr/candidates
POST   /v1/hr/candidates
PATCH  /v1/hr/candidates/:id
DELETE /v1/hr/candidates/:id
GET    /v1/hr/applications
GET    /v1/hr/applications/funnel
POST   /v1/hr/applications
POST   /v1/hr/applications/:id/move-stage
POST   /v1/hr/applications/:id/reject
POST   /v1/hr/applications/:id/withdraw
POST   /v1/hr/applications/:id/hire
```

Hepsi `authMiddleware` ile korunur; yazma işlemleri `requireRole('hr_manager')` (ADR-0005).

## Frontend HR demo

- `/hr-demo.html` — standalone demo (vite dev: `http://localhost:5173/hr-demo.html`)
- 4 sekme: **Organizasyon** / **Personel** / **Pozisyonlar** / **İşe Alım**
- İşe Alım: RecruitmentFunnel + ApplicationKanban (HTML5 drag-drop) + CandidateForm
- Auth token kaynağı: `#token=...` veya `localStorage.promet_access_token`

## App.jsx cutover sonuçları

| Metrik                                                                                                     | Faz 0 öncesi | PR 7 sonrası                                 |
| ---------------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------- |
| `frontend/src/App.jsx` satır sayısı                                                                        | 81.159       | 66.966                                       |
| Azalma                                                                                                     | —            | **−14.193 satır**                            |
| Eski HR component'leri (HRModule, OrganizationManager, EmployeesList, PositionsList, 3 form modal, 4 node) | mevcut       | tamamen silindi                              |
| `data.hr*` state alanları                                                                                  | aktif        | kullanılmıyor (modül kendi API'sini çağırır) |

## Bilinen kısıtlar / sonraki fazlara devredilenler

1. **Integration testleri (testcontainers).** ✅ **Çözüldü (Faz 4-bis):** 8 `Pg*Repository` + `PgEmployeeNumberGenerator` için testcontainers entegrasyon testleri eklendi (`__tests__/integration/*.itest.ts`).
2. **Atomik HireFromApplication rollback.** ✅ **Çözüldü (Faz 4-bis / ADR-0006):** gerçek Unit of Work port'u (`application/ports/UnitOfWork.ts`) + `PgUnitOfWork` eklendi; `HireFromApplication.atomic.itest.ts` ile BEGIN/COMMIT/ROLLBACK atomikliği doğrulandı.
3. **`data.hr*` state cleanup.** App.jsx'in genel `data` prop'unda hâlâ boş `hrOrgUnits/hrEmployees/...` alanları olabilir. Bunlar bir sonraki temizlik PR'ında silinir.
4. **HrDemoPage → HrPage upgrade.** Şu an demo sayfası doğrudan App.jsx'e mount edildi (Strangler Fig hızlı çıkış); ileride App.jsx'in tema/sidebar/breadcrumb pattern'iyle entegre, ayrı bir `HrPage` üretilir.
5. **Frontend testleri.** ✅ **Çözüldü (Faz 4-bis):** `HrApiClient` + 6 component (EmployeesTable, OrgTreeView, PositionsList, RecruitmentFunnel, ApplicationKanban, CandidateForm) + 6 hook testi (Vitest + Testing Library + MSW) eklendi.
6. **E2E (Playwright) akışı.** 🟡 **Kısmen:** `frontend/e2e/hr-recruitment-flow.spec.ts` + `playwright.config.ts` yazıldı; ancak henüz CI'da otomatik koşmuyor (manuel/nightly — `webServer` bloğu açılmalı).

## ADR-0005 zorunlu çıktıları

- ✅ `hr_manager` rolü ENUM'a eklendi (013_user_role_hr_manager.sql)
- ✅ `requireRole('hr_manager')` middleware tüm yazma endpoint'lerinde
- ✅ AuthUserLookupAdapter (anti-corruption layer)
- ✅ Employee.user_id NULLABLE + UNIQUE
- ✅ Auth modülü Faz 3 testleri yeşil (regresyon yok)

## Sonraki adımlar

Faz 4 burada kapanır. **Faz 5: Finance — Bütçe & Kasa** ile devam edilir (`docs/MIGRATION_ROADMAP.md` § Faz 5).

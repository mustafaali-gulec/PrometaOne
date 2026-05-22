# HR Modülü (Faz 4)

Prometa One — İnsan Kaynakları modülü. Organizasyon ağacı, çalışan sicili, pozisyon kütüphanesi ve işe alım pipeline'ı.

> Plan dökümanı: `docs/MIGRATION_ROADMAP.md` § "Faz 4 — HR Core (DETAYLI PLAN)"
> Karar dökümanı: `docs/adr/0005-hr-manager-role-and-employee-user-link.md`

## Yapı

```
modules/hr/
├── domain/
│   ├── entities/        OrgUnit, Department, Position, Employee, Candidate, Application
│   ├── valueObjects/    OrgUnitCode, DepartmentCode, PositionStatus, EmployeeStatus,
│   │                    EmploymentType, EmployeeNumber, TcKimlik, PhoneNumber,
│   │                    HireDate, CandidateSource, RecruitmentStage
│   └── services/        OrgTreeBuilder, EmployeeNumberGenerator,
│                        ApplicationStageTransitionPolicy, HireFromApplicationPolicy
├── application/
│   ├── ports/           7 repository + UserLookupPort + Clock + AuditLogger
│   ├── useCases/        32 use-case (OrgUnit 5 + Department 4 + Position 4 +
│   │                    Employee 7 + Candidate 4 + Application 8)
│   ├── dto/             Her entity için *Dto + RecruitmentFunnelDto
│   └── errors/          HrErrors.ts — 25 tipli error sınıfı
├── infrastructure/
│   ├── persistence/     7 Pg* repository (PR 4a)
│   ├── audit/           PgAuditLogger
│   ├── sequences/       PgEmployeeNumberGenerator
│   └── auth/            AuthUserLookupAdapter (ADR-0005 anti-corruption)
├── presentation/
│   ├── routes.ts        35+ REST endpoint (Hono + zod)
│   └── errorMapping.ts  Domain error → HTTP status
└── index.ts             Public API + registerHrModule DI composition
```

## DB Tabloları

`api-server/migrations/`:

- `012_hr.sql` — `org_units`, `departments`, `positions`, `employees`,
  `candidates`, `applications`, `application_stage_history` + index/trigger'lar
- `013_user_role_hr_manager.sql` — `user_role` ENUM'a `hr_manager` ekler
- `014_hr_employee_no_sequence.sql` — `hr_employee_no_counters` (şirket bazlı sayaç)

## Domain Modeli

```
Company (companies — Faz 0/Finance'tan)
   │
   └── OrgUnit (recursive parent_id — bölüm/birim ağacı)
          │
          └── Department
                 │
                 ├── Position (job title kütüphanesi)
                 │       │
                 │       └── Application (Candidate'in Position'a başvurusu)
                 │              └── stage geçişleri (new→screening→...→hired)
                 │
                 └── Employee (Position'a atanır, opsiyonel User'a bağlanır;
                               Application "hired" → Employee otomatik üretilir)

Candidate (Application'lardan bağımsız havuz)
```

## REST API

Tüm endpoint'ler **`Authorization: Bearer <jwt>`** ister. Yazma işlemleri
**`hr_manager`** veya **`admin`** rolü gerektirir (ADR-0005).

Base path: `/v1/hr`

| Method | Path                                                    | Açıklama                                   |
| ------ | ------------------------------------------------------- | ------------------------------------------ |
| GET    | `/org-tree?companyId=`                                  | Nested OrgUnit ağacı                       |
| POST   | `/org-units`                                            | Yeni org birimi                            |
| PATCH  | `/org-units/:id`                                        | Güncelle (name/code/sortOrder)             |
| POST   | `/org-units/:id/move`                                   | Parent değiştir (cycle check)              |
| DELETE | `/org-units/:id`                                        | Arşivle (alt birimi yoksa)                 |
| POST   | `/departments`                                          | Yeni departman                             |
| PATCH  | `/departments/:id`                                      | Güncelle                                   |
| DELETE | `/departments/:id`                                      | Arşivle (aktif çalışan yoksa)              |
| POST   | `/departments/:id/assign-manager`                       | Manager Employee ata                       |
| GET    | `/positions?companyId&status&departmentId`              | Pozisyon listesi                           |
| POST   | `/positions`                                            | Yeni pozisyon (default status=draft)       |
| PATCH  | `/positions/:id`                                        | Güncelle (status geçişi de)                |
| POST   | `/positions/:id/close`                                  | Status='closed'                            |
| GET    | `/employees?companyId&status&departmentId&positionId&q` | Çalışan listesi                            |
| POST   | `/employees`                                            | İşe al (generator ile employee_no üretir)  |
| PATCH  | `/employees/:id`                                        | Profil güncelle                            |
| POST   | `/employees/:id/transfer`                               | Departman/pozisyon değiştir                |
| POST   | `/employees/:id/terminate`                              | İşten ayır                                 |
| POST   | `/employees/:id/link-user`                              | User'a bağla                               |
| DELETE | `/employees/:id/link-user`                              | User bağını kopar                          |
| GET    | `/candidates?companyId&source&q`                        | Aday listesi                               |
| POST   | `/candidates`                                           | Aday kaydet                                |
| PATCH  | `/candidates/:id`                                       | Aday güncelle                              |
| DELETE | `/candidates/:id`                                       | Aday sil (aktif başvurusu yoksa)           |
| GET    | `/applications?companyId&positionId&candidateId&stage`  | Başvuru listesi                            |
| GET    | `/applications/funnel?companyId&positionId`             | Stage başına sayım                         |
| POST   | `/applications`                                         | Yeni başvuru (Position 'open' olmalı)      |
| POST   | `/applications/:id/move-stage`                          | Stage geçişi                               |
| POST   | `/applications/:id/reject`                              | Reddet (reason kayıt)                      |
| POST   | `/applications/:id/withdraw`                            | Geri çek                                   |
| POST   | `/applications/:id/hire`                                | **Atomik:** hired stage + Employee oluştur |

### Hata mapping

| Error sınıfı                                                                                                                                                                                                                         | HTTP                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| `*NotFoundError`                                                                                                                                                                                                                     | 404                  |
| `*CompanyMismatchError`                                                                                                                                                                                                              | 403                  |
| `OrgCycleDetectedError`, `*HasActiveEmployeesError`, `EmployeeNumberAlreadyExistsError`, `*AlreadyLinkedError`, `*AlreadyTerminatedError`, `CandidateAlreadyAppliedToPositionError`, `PositionNotOpenError`, `*AlreadyTerminalError` | 409                  |
| `Invalid*TransitionError`, `Invalid*Error` (format)                                                                                                                                                                                  | 400                  |
| Bilinmeyen                                                                                                                                                                                                                           | 500 (global handler) |

## Testler

- **Domain (203 test)** — Saf TS, hiç DB yok. Coverage hedef %95+
  - State machine'ler (Position, Employee, RecruitmentStage)
  - VO validation (TcKimlik 20+ vektör, PhoneNumber TR normalize)
  - OrgTreeBuilder (cycle, ancestors, descendants)
  - HireFromApplicationPolicy field mapping
- **Application (286 test)** — In-memory fake'lerle, her use-case için
  happy + 2-3 edge. Atomik hire rollback testi dahil.

Toplam: **489 test pass / 0 fail.**

> Integration testleri (gerçek PG / testcontainers) ileri PR'da.

## Kullanım (composition root — `src/index.ts`)

```ts
import { PgUserRepository, registerAuthModule } from './modules/auth/index.js';
import { registerHrModule } from './modules/hr/index.js';

const authModule = registerAuthModule(cfg, { pool });
const hrModule = registerHrModule({
  pool,
  authUserRepository: new PgUserRepository(pool),
});

v1.route('/auth', authModule.router);
v1.route('/hr', hrModule.router);
```

## ADR ve mimari notlar

- **ADR-0005** — `hr_manager` rolü + Employee↔User opsiyonel link
- **Anti-corruption layer:** HR auth modülünün domain'ine yazmaz, yalnızca
  `UserLookupPort` üzerinden okur. `AuthUserLookupAdapter` HrUserSummary
  minimal view döner.
- **Atomik HireFromApplication:** Application 'hired' transition + Employee
  INSERT aynı use-case içinde. Fake repository'lerde manuel rollback;
  gerçek PG'de DB transaction (ileri PR — Unit of Work pattern).
- **Multi-tenant:** tüm repository sorguları `companyId` ile sınırlı.
  Cross-company erişim 403.

## Sıradaki PR'lar

- **PR 5:** Frontend HR Core (Organization + Employees + Positions)
- **PR 6:** Frontend Recruitment (kanban + funnel)
- **PR 7:** App.jsx cutover (~14.150 satır silme)
- **PR 8:** Verification + ekran görüntüleri + production smoke

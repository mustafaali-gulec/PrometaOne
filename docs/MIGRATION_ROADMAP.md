# Prometa One — Migration Yol Haritası

**Son güncelleme:** 2026-06-01 · **Faz:** 6 (Finance: E-Fatura & Döviz) tamamlandı (8/8 PR + ADR-0004 kapanışı + ADR-0008) — Faz 7 (Payroll) sıradaki

Bu dokümanın amacı: Strangler Fig migration'ının somut planı. Hangi modül hangi sırada çıkacak, her birinin tahmini büyüklüğü, risk seviyesi ve bağımlılıkları.

> Mimari hedef için `ARCHITECTURE.md`'ya, kararlar için `adr/`'ya bak.

---

## Faz Tablosu

| Faz       | Ad                           | Hedef                                                       | Durum       |
| --------- | ---------------------------- | ----------------------------------------------------------- | ----------- |
| **0**     | Foundation                   | Tooling, standartlar, ADR'ler, modül iskeleti               | ✅ Tamam    |
| **1**     | First Module — Notifications | Eski cron+email → api-server modülü + frontend bell         | ✅ Tamam    |
| **2**     | AI Widget + ML Proxy         | App.jsx'teki AI asistan → modules/ai/ + api-server ai-proxy | ✅ Tamam    |
| **3**     | Auth & Users                 | Login, JWT, RBAC → modules/auth/ (frontend + backend)       | ✅ Tamam    |
| **4**     | HR Core                      | Organizasyon, çalışanlar, pozisyonlar → modules/hr/         | ✅ Tamam    |
| **5**     | Finance — Bütçe & Kasa       | Budget calendar + bank/kasa hücreleri                       | ✅ Tamam    |
| **6**     | Finance — E-Fatura & Döviz   | eLogo + UBL parser + TCMB/EVDS + UFRS 21 değerleme          | ✅ Tamam    |
| **7**     | Payroll                      | Türkiye bordro motoru (SGK/GV/DV/AR-Ge)                     | 🟡 Sıradaki |
| **8**     | Attendance & İzin            | Puantaj + izin workflow                                     | ⏳          |
| **9**     | Talep Sistemi                | Avans/masraf/zimmet                                         | ⏳          |
| **10**    | Projeler                     | Gantt, kaynak, risk, kapsam                                 | ⏳          |
| **11**    | Self-Service Portal          | Çalışan portalı                                             | ⏳          |
| **12**    | Reports v3 + Dashboards      | 8 hazır rapor + custom dashboard                            | ⏳          |
| **Final** | Strangler Tamamlandı         | `legacy/` silindi, `App.jsx` silindi                        | ⏳          |

Toplam tahmin: **12 ana faz**. Her faz 1-3 hafta (yoğunluğa göre).

---

## Faz Sıralamasının Mantığı

Sıralama 4 kriterle belirlendi (ADR-0003 § "Hangi modülü ne zaman çıkaracağız"):

1. **Küçük + izole önce** — Faz 1 (notifications) ve Faz 2 (AI widget) tüm sistemden ayrı işlevler. Yeni mimariyi pratikte test eder.
2. **Yüksek bug yoğunluğu olan modüller** — Faz 5/6/7 (finans+bordro): App.jsx'in en sık değişen ve en kritik kısımları.
3. **Tip güvenliği en kritik olanlar** — Bordro hesaplamaları → Faz 7'ye kadar TS strict altyapısı kanıtlanmış olur.
4. **Bağımlılık zinciri** — Faz 3 (auth+users) Faz 4'ten önce çünkü employee = user; Faz 4 (hr) Faz 7'den önce çünkü employee'siz payroll olmaz.

---

## Faz 1 — Notifications (DETAYLI PLAN)

İlk gerçek migration. Tüm yaklaşımın canlı kanıtı olacak.

### Hedef

`legacy/backend/src/services/cronDaemon.js` + `emailService.js`'i api-server'a TS strict olarak taşı + App.jsx'teki bell dropdown'u modüler component olarak çıkar.

### Kapsam

#### Backend (`api-server/src/modules/notifications/`)

1. **Domain**
   - `entities/Notification.ts` — id, recipientUserId, kind, title, body, link, meta, createdAt, readAt
   - `valueObjects/NotificationKind.ts` — discriminated union (task_due_soon, invoice_overdue, approval_stale, tax_deadline_warning, check_due_soon, scheduled_report, generic)
   - `services/NotificationFactory.ts` — kind'a göre title/body inşa eden factory

2. **Application**
   - `useCases/FetchNotificationsForUser.ts`
   - `useCases/MarkNotificationAsRead.ts`
   - `useCases/CheckTaskDueSoon.ts` (cron)
   - `useCases/CheckOverdueInvoices.ts` (cron)
   - `useCases/CheckStaleApprovals.ts` (cron)
   - `useCases/CheckTaxDeadlines.ts` (cron)
   - `useCases/CheckUpcomingChecks.ts` (cron)
   - `useCases/SendScheduledReports.ts` (cron)
   - `dto/NotificationDto.ts` — REST için DTO

3. **Infrastructure**
   - `persistence/PgNotificationRepository.ts` — interface `NotificationRepository`
   - `email/NodemailerEmailService.ts` — interface `EmailService`
   - `email/templates/notificationEmail.ts` — HTML şablonu (eski emailService'ten modernize)
   - `email/templates/scheduledReportEmail.ts`
   - `cron/CronScheduler.ts` — node-cron wrapper, test edilebilir

4. **Presentation**
   - `presentation/routes.ts` — `GET /v1/notifications`, `POST /v1/notifications/:id/read`, `GET /v1/notifications/unread-count`

5. **DI Composition**
   - `index.ts`: `registerNotificationsModule(app, db, logger, config)`

#### Frontend (`frontend/src/modules/notifications/`)

1. **Domain**
   - `entities/Notification.ts` — backend ile uyumlu tip
   - `valueObjects/NotificationKind.ts`

2. **Application**
   - `useCases/fetchNotifications.ts`
   - `useCases/markAsRead.ts`
   - `dto/NotificationDto.ts`

3. **Infrastructure**
   - `api/NotificationsApiClient.ts` — fetch wrapper, auth header

4. **Presentation**
   - `components/NotificationBell.tsx` — App.jsx'teki dropdown'un yeni hâli
   - `hooks/useNotifications.ts` — polling + state

#### Migration Adapter

App.jsx içinde:

```jsx
// Eski:
// <button onClick={...}>🔔 {notifications.length}</button>
// {showDropdown && <div>...mevcut 200 satırlık dropdown...</div>}

// Yeni:
import { NotificationBell } from './modules/notifications';
<NotificationBell />;
```

### Migration Adımları (PR olarak)

1. **PR 1: Backend domain + application** — Sadece TS strict iskelet, gerçek DB yok, mock'lı testler. Coverage'ı domain %95 + application %85.
2. **PR 2: Backend infrastructure + DI** — PgNotificationRepository (testcontainers), NodemailerEmailService (test transport). Cron scheduler. `app.ts`'de registerNotificationsModule çağırılır.
3. **PR 3: Frontend modül + adapter** — NotificationBell + useNotifications. App.jsx'te eski dropdown silinir, yeni component çağrılır.
4. **PR 4: legacy/backend kaldırma** — Cron + email artık api-server'da. `legacy/backend/` silinir. `docker-compose.yml`'de tutarlılık kontrolü.

### Riskler ve Önlemleri

- **Risk:** Eski `db.getTasks()` çağrıları SQL sorgusuna dönüşürken yanlış filtreleme. **Önlem:** legacy/backend/ kodu okunur, her cron job için unit test yazılır.
- **Risk:** node-cron timezone kayması. **Önlem:** Tüm tarih hesaplamaları `Europe/Istanbul` zoned (date-fns-tz veya `Temporal` API kullan).
- **Risk:** E-posta provider değişikliği bug. **Önlem:** İlk PR'da sadece SMTP, sonradan Mailgun/SendGrid adapter'ları ayrı PR.

### Test Beklentileri

- `domain/`: %95+ — NotificationFactory'nin tüm kind'lar için doğru title üretmesi
- `application/`: %85+ — Her use-case için mock repo + mock email service ile happy path + edge cases (boş liste, expired user, vb.)
- `infrastructure/persistence/`: testcontainers ile gerçek PostgreSQL
- `infrastructure/email/`: nodemailer'ın test transport'u (kayıtlı mail içeriği assert)
- E2E: Playwright ile "bildirim geldi → bell kırmızı oldu → tıkla → liste açıldı → okundu işaretlendi → badge sıfır" akışı

### Çıkış Kriterleri

- [ ] 4 PR merge edildi
- [ ] `npm run typecheck` temiz (0 error)
- [ ] `npm run lint` temiz
- [ ] `npm run test` geçer (coverage hedefleri tutar)
- [ ] App.jsx'ten notifications dropdown kodu silindi
- [ ] `legacy/backend/` silindi
- [ ] CHANGELOG güncellendi

---

## Faz 4 — HR Core (DETAYLI PLAN)

İlk gerçek "iş alanı" modülü. Faz 1-3 altyapı kanıtı (notifications, AI, auth) sundu — Faz 4 ilk gerçek **domain-rich** modül: organizasyon ağacı, çalışan sicili, pozisyon kütüphanesi. Tüm sonraki modüllerin (payroll, attendance, requests, projects) `Employee` entity'sine dayanacak olması bu fazı kritik yapar.

### Hedef

App.jsx'in satır 56752–70900 aralığındaki ~14.150 satırlık HR kodunu (`HRModule`, `OrganizationManager`, `OrgUnitNode`, `DepartmentNode`, `EmployeeNode`, `EmployeesList`, `PositionsList` + 3 form modal + işe alım ekranları) parçalı şekilde `modules/hr/` altına TS strict olarak taşı. App.jsx'in `data` prop'unda taşınan client-side state (`data.hrOrgUnits`, `data.hrEmployees`, `data.hrPositions`, `data.hrCandidates`, `data.hrApplications`) gerçek PostgreSQL tablolarına ve REST API'ya cutover edilir.

**Kapsam:** Tüm HR sekmesi — Organizasyon + Personel + Pozisyonlar + **İşe Alım (recruitment)**. Faz 7 (Payroll) ve Faz 8 (Attendance) bu fazın `Employee` entity'sine bağlanacak.

**Veri göçü:** Mevcut App.jsx `data.hr*` state'i sadece demo verisidir; production'da gerçek HR verisi yoktur. PR 5'te fresh schema ile başlanır, eski JSON aktarımı için import script'i yazılmaz.

### Domain Modeli

Mevcut App.jsx state'inden ters mühendislik:

```
Company (var — companies tablosu, Faz 0/Finance bootstrap'inden kalan)
   │
   └── OrgUnit  ← "Birim" / "Bölüm" (recursive parent_id ile ağaç)
          │
          └── Department
                 │
                 ├── Position (job title kütüphanesi)
                 │       │
                 │       └── Application (bir Candidate'in bu Position'a başvurusu)
                 │              │
                 │              └── RecruitmentStage geçişleri
                 │                  (screening → interview → offer → hired/rejected)
                 │
                 └── Employee (Position'a atanır, opsiyonel User'a bağlanır;
                               Application "hired" stage'ine geçtiğinde otomatik üretilebilir)

Candidate (Application'lardan bağımsız havuz — bir kişi birden çok pozisyona başvurabilir)
```

"4-tier" ifadesi şu hiyerarşiyi karşılar: **Company → OrgUnit → Department → Employee** (Position ve Candidate çapraz kesen kütüphaneler). OrgUnit kendi içinde recursive olabilir (alt birim).

### Kapsam

#### Veritabanı (`api-server/migrations/012_hr.sql`)

Yeni migration. Mevcut `companies` tablosu yeniden kullanılır.

- `org_units` — `id, company_id FK, parent_id FK self, name, code, sort_order, active, created_*, updated_*`
- `departments` — `id, company_id FK, org_unit_id FK NULL, name, code, manager_employee_id FK NULL (cycle önleyici), active, created_*, updated_*`
- `positions` — `id, company_id FK, department_id FK NULL, title, description, status (open/closed/draft), headcount_target, min_salary, max_salary, created_*, updated_*`
- `employees` — `id, company_id FK, user_id FK NULL UNIQUE (Faz 3'ün User'ına opsiyonel link), department_id FK, position_id FK NULL, employee_no UNIQUE per company, first_name, last_name, tc_kimlik UNIQUE per company NULL, email, phone, hire_date, termination_date NULL, status (active/probation/on_leave/terminated), employment_type (full_time/part_time/contract/intern), source_application_id FK NULL (işe alım izi), created_*, updated_*`
- `candidates` — `id, company_id FK, first_name, last_name, email, phone NULL, source (referral/linkedin/jobboard/direct/agency/other), notes TEXT NULL, cv_url NULL, created_*, updated_*` (şirket-baz aday havuzu)
- `applications` — `id, company_id FK, candidate_id FK, position_id FK, stage (new/screening/interview/offer/hired/rejected/withdrawn), stage_changed_at, stage_changed_by FK users, rejection_reason NULL, salary_expectation NULL, notes TEXT NULL, created_*, updated_*`
- `application_stage_history` — `id, application_id FK, from_stage, to_stage, changed_by FK users, changed_at, note NULL` (audit trail)
- Index: org_units(company_id, parent_id), departments(company_id, org_unit_id), employees(company_id, status), employees(user_id), candidates(company_id, email), applications(company_id, position_id, stage), applications(candidate_id)
- Trigger: hiyerarşi cycle önleyici (org_units parent_id, departments manager); application stage geçişlerini `application_stage_history`'ye otomatik yazan trigger
- Constraint: bir Candidate aynı Position'a iki kez aktif (stage != hired/rejected/withdrawn) başvuru yapamaz (partial unique index)
- Seed data: tek bir varsayılan org_unit (root) per company (companies tablosuna yapılacak `companies_after_insert` trigger ile veya seed.sql'de)

#### Backend (`api-server/src/modules/hr/`)

1. **Domain**
   - `entities/OrgUnit.ts` — ağaç davranışı (descendantsOf, isAncestorOf)
   - `entities/Department.ts`
   - `entities/Position.ts` — value object `PositionStatus` (open/closed/draft)
   - `entities/Employee.ts` — durum makinesi (probation → active → on_leave → terminated)
   - `entities/Candidate.ts` — aday havuzu kaydı
   - `entities/Application.ts` — durum makinesi: new → screening → interview → offer → hired / rejected / withdrawn (her geçiş kısıtlı)
   - `valueObjects/EmployeeNumber.ts` — şirket içi benzersizlik invariant'ı
   - `valueObjects/TcKimlik.ts` — TC kimlik doğrulama algoritması (mod 10/11)
   - `valueObjects/EmploymentType.ts`
   - `valueObjects/PhoneNumber.ts` — TR format normalize
   - `valueObjects/HireDate.ts`
   - `valueObjects/CandidateSource.ts` — referral/linkedin/jobboard/direct/agency/other
   - `valueObjects/RecruitmentStage.ts` — geçerli geçişleri bilen durum tipi
   - `services/OrgTreeBuilder.ts` — flat liste → nested ağaç dönüşümü
   - `services/EmployeeNumberGenerator.ts` — strateji interface'i (sıralı, prefix'li, vb.)
   - `services/ApplicationStageTransitionPolicy.ts` — hangi stage'den hangisine geçilebilir
   - `services/HireFromApplicationPolicy.ts` — "hired" stage'ine geçişin yan etkisi olarak Employee üretimi

2. **Application**
   - **OrgUnit:** `CreateOrgUnitUseCase`, `UpdateOrgUnitUseCase`, `MoveOrgUnitUseCase` (parent değişimi, cycle check), `ArchiveOrgUnitUseCase`, `ListOrgTreeForCompanyUseCase`
   - **Department:** `CreateDepartmentUseCase`, `UpdateDepartmentUseCase`, `ArchiveDepartmentUseCase`, `AssignDepartmentManagerUseCase`
   - **Position:** `CreatePositionUseCase`, `UpdatePositionUseCase`, `ClosePositionUseCase`, `ListPositionsUseCase`
   - **Employee:** `HireEmployeeUseCase`, `UpdateEmployeeProfileUseCase`, `TransferEmployeeUseCase` (departman/pozisyon değişimi), `TerminateEmployeeUseCase`, `LinkEmployeeToUserUseCase`, `UnlinkEmployeeFromUserUseCase`, `ListEmployeesUseCase` (filter: status, department, position)
   - **Candidate:** `RegisterCandidateUseCase`, `UpdateCandidateUseCase`, `ArchiveCandidateUseCase`, `ListCandidatesUseCase` (filter: source, q text search)
   - **Application:** `SubmitApplicationUseCase` (Candidate + Position → Application), `MoveApplicationStageUseCase` (stage geçişi + history), `RejectApplicationUseCase`, `WithdrawApplicationUseCase`, `HireFromApplicationUseCase` (Application "hired" → Employee otomatik üretir, atomik), `ListApplicationsForPositionUseCase`, `ListApplicationsForCandidateUseCase`
   - **Ports:** `OrgUnitRepository`, `DepartmentRepository`, `PositionRepository`, `EmployeeRepository`, `CandidateRepository`, `ApplicationRepository`, `ApplicationStageHistoryRepository`, `UserLookupPort` (auth modülünden User çekmek için anti-corruption layer), `Clock`, `AuditLogger`
   - **DTO:** `OrgUnitDto`, `DepartmentDto`, `PositionDto`, `EmployeeDto`, `OrgTreeNodeDto`, `CandidateDto`, `ApplicationDto`, `ApplicationStageHistoryDto`
   - **Errors:** `EmployeeNumberAlreadyExistsError`, `OrgCycleDetectedError`, `EmployeeAlreadyLinkedError`, `DepartmentHasActiveEmployeesError` (silmeden önce), `InvalidStageTransitionError`, `CandidateAlreadyAppliedToPositionError`, `PositionNotOpenError` (kapalı pozisyona başvuru)

3. **Infrastructure**
   - `persistence/PgOrgUnitRepository.ts` (testcontainers ile gerçek PG)
   - `persistence/PgDepartmentRepository.ts`
   - `persistence/PgPositionRepository.ts`
   - `persistence/PgEmployeeRepository.ts`
   - `persistence/PgCandidateRepository.ts`
   - `persistence/PgApplicationRepository.ts`
   - `persistence/PgApplicationStageHistoryRepository.ts`
   - `auth/AuthUserLookupAdapter.ts` — auth modülünün `index.ts`'inden User bilgilerini çeker (anti-corruption)
   - `audit/PgAuditLogger.ts` — paylaşılabilir, ileri fazlarda `shared/`'a çıkarılabilir

4. **Presentation** (`presentation/routes.ts`)
   - **Org:** `GET /v1/hr/org-tree?companyId=`
   - **OrgUnit:** `POST /v1/hr/org-units`, `PATCH /v1/hr/org-units/:id`, `POST /v1/hr/org-units/:id/move`, `DELETE /v1/hr/org-units/:id`
   - **Department:** `POST /v1/hr/departments`, `PATCH /v1/hr/departments/:id`, `DELETE /v1/hr/departments/:id`
   - **Position:** `GET /v1/hr/positions?companyId=&status=`, `POST /v1/hr/positions`, `PATCH /v1/hr/positions/:id`, `POST /v1/hr/positions/:id/close`
   - **Employee:** `GET /v1/hr/employees?companyId=&status=&departmentId=&q=`, `POST /v1/hr/employees`, `PATCH /v1/hr/employees/:id`, `POST /v1/hr/employees/:id/terminate`, `POST /v1/hr/employees/:id/link-user`, `DELETE /v1/hr/employees/:id/link-user`
   - **Candidate:** `GET /v1/hr/candidates?companyId=&q=&source=`, `POST /v1/hr/candidates`, `PATCH /v1/hr/candidates/:id`, `DELETE /v1/hr/candidates/:id`
   - **Application:** `GET /v1/hr/applications?companyId=&positionId=&candidateId=&stage=`, `POST /v1/hr/applications`, `POST /v1/hr/applications/:id/move-stage`, `POST /v1/hr/applications/:id/reject`, `POST /v1/hr/applications/:id/withdraw`, `POST /v1/hr/applications/:id/hire` (Employee'yi atomik üretir, döner)
   - **Recruitment dashboard:** `GET /v1/hr/applications/funnel?companyId=&positionId=` (stage başına sayım)
   - Tüm endpoint'ler `requireAuth` middleware'i + `requireCompanyAccess(companyId)` ile korunur
   - RBAC: yazma işlemleri `admin` veya yeni `hr_manager` rolü. Yeni rol için **ADR-0005** (zorunlu, PR 1'de yazılır).

5. **DI Composition**
   - `index.ts`: `registerHrModule(app, db, logger, config, authModule)` — auth modülünün public API'sini alır

#### Frontend (`frontend/src/modules/hr/`)

1. **Domain** — backend ile uyumlu tipler (TcKimlik validator client-side de çalışır)
2. **Application** — fetch + cache (React Query veya basit hook state)
   - `useCases/fetchOrgTree.ts`, `useCases/hireEmployee.ts`, vb. (her backend use-case'inin client karşılığı)
   - `useCases/submitApplication.ts`, `useCases/moveApplicationStage.ts`, `useCases/hireFromApplication.ts`
3. **Infrastructure**
   - `api/HrApiClient.ts` — fetch wrapper, auth header (Faz 3 token store'undan)
4. **Presentation**
   - `pages/HrPage.tsx` — eski `HRModule`'un yeni hâli, sol sidebar + sağ içerik aynı UX
   - `pages/tabs/OrganizationTab.tsx` — eski `OrganizationManager`
   - `pages/tabs/EmployeesTab.tsx` — eski `EmployeesList`
   - `pages/tabs/PositionsTab.tsx` — eski `PositionsList`
   - `pages/tabs/RecruitmentTab.tsx` — Position bazlı kanban: aday havuzu, başvurular, stage drag-drop
   - `components/OrgTree.tsx` (eski OrgUnitNode + DepartmentNode + EmployeeNode'un kompozisyonu)
   - `components/forms/OrgUnitForm.tsx` (eski OrgUnitFormModal)
   - `components/forms/DepartmentForm.tsx`
   - `components/forms/EmployeeForm.tsx`
   - `components/forms/PositionForm.tsx`
   - `components/forms/CandidateForm.tsx`
   - `components/forms/ApplicationForm.tsx`
   - `components/PositionCard.tsx`
   - `components/RecruitmentFunnel.tsx` — stage başına sayım kartları
   - `components/ApplicationKanban.tsx` — drag-drop ile stage geçişi
   - `hooks/useOrgTree.ts`, `hooks/useEmployees.ts`, `hooks/usePositions.ts`, `hooks/useCandidates.ts`, `hooks/useApplications.ts`

#### Migration Adapter (App.jsx)

App.jsx → 56752-70900 satır aralığı:

```jsx
// Eski (~14.150 satır):
// function HRModule({ data, session, ... }) { ... }
// function OrganizationManager(...) { ... }
// function EmployeesList(...) { ... }
// function PositionsList(...) { ... }
// + recruitment ekranları (aynı aralıkta)

// Yeni (10-15 satır):
import { HrPage } from './modules/hr';
// Mevcut yere:
{
  activeTab === 'hr' && (
    <HrPage companyId={session.activeCompanyId} session={session} lang={lang} />
  );
}
```

App.jsx'in genel `data` prop'undan `hrOrgUnits/hrDepartments/hrPositions/hrEmployees/hrCandidates/hrApplications` alanları **silinir** — modül kendi state'ini API'dan çeker. Mevcut state demo verisidir, gerçek HR verisi production'da yoktur; göç script'i yazılmaz.

### Migration Adımları (PR olarak)

1. **PR 1: ADR-0005 + Org/Department domain + DB migration** (`Faz 4 / PR 1`)
   - `docs/adr/0005-hr-manager-role-and-employee-user-link.md` — yeni rol gerekçesi + Employee↔User opsiyonel bağlantı kararı
   - `auth/domain/valueObjects/UserRole.ts`'e `hr_manager` eklenir + migration (ENUM ALTER)
   - `api-server/migrations/012_hr.sql` (tüm tablolar — org_units, departments, positions, employees, candidates, applications, application_stage_history)
   - `modules/hr/domain/` — sadece OrgUnit, Department, value object'ler ve OrgTreeBuilder
   - `application/ports/{OrgUnitRepository, DepartmentRepository, Clock, AuditLogger}` + DTO + errors
   - Domain unit testleri (node:test, hiç DB yok). Coverage domain %95+
   - `app.ts`'e registerHrModule **henüz çağrılmaz** — sadece tip olarak yer açılır

2. **PR 2: Position + Employee domain + application** (`Faz 4 / PR 2`)
   - `domain/entities/Position.ts`, `Employee.ts`, ilgili value object'ler (TcKimlik, EmployeeNumber, EmploymentType, PhoneNumber, HireDate)
   - `domain/services/EmployeeNumberGenerator.ts`
   - **Application:** OrgUnit + Department + Position + Employee use-case'leri (~20 adet)
   - `__tests__/application/fakes.ts` — in-memory fake repository'ler
   - Her use-case için happy + 2-3 edge case. Coverage application %85+
   - Hâlâ Hono'ya bağlanmaz

3. **PR 3: Recruitment domain + application** (`Faz 4 / PR 3`)
   - `domain/entities/Candidate.ts`, `Application.ts`
   - `valueObjects/CandidateSource.ts`, `RecruitmentStage.ts`
   - `domain/services/ApplicationStageTransitionPolicy.ts`, `HireFromApplicationPolicy.ts`
   - **Application:** Candidate (4) + Application (8) use-case'leri
   - `HireFromApplicationUseCase` atomik — application "hired" + employee oluştur tek transaction
   - Fake'lerle testler. Coverage domain %95+ / application %85+

4. **PR 4: Infrastructure + REST routes + DI** (`Faz 4 / PR 4`)
   - 7 Pg\* repository (testcontainers ile gerçek PG)
   - `AuthUserLookupAdapter`
   - `presentation/routes.ts` — tüm endpoint'ler (Hono testClient contract testleri)
   - `requireRole('hr_manager','admin')` middleware
   - `registerHrModule` çağrısı `app.ts`'e eklenir
   - Smoke: `curl /v1/hr/org-tree?companyId=1` → 200; bir Application "hired" stage'ine geçince Employee tablosunda satır oluştuğu doğrulanır

5. **PR 5: Frontend HR Core (org/employee/position) + demo** (`Faz 4 / PR 5`)
   - `modules/hr/` — Organization + Employees + Positions tab'leri ve tüm form'lar
   - `frontend/src/hr-demo-entry.tsx` + `index-hr-demo.html` (Faz 1/2 pattern'i)
   - Component testleri + form validation testleri
   - App.jsx'e dokunulmaz

6. **PR 6: Frontend Recruitment (kanban + funnel)** (`Faz 4 / PR 6`)
   - RecruitmentTab.tsx + ApplicationKanban + RecruitmentFunnel + Candidate/Application form'ları
   - Drag-drop stage geçişi (HTML5 native veya react-dnd — küçük scope)
   - Demo sayfasına recruitment akışı eklenir

7. **PR 7: App.jsx cutover** (`Faz 4 / PR 7`)
   - 56752-70900 aralığındaki HR komponentleri silinir (~14.150 satır)
   - `import { HrPage } from './modules/hr'` eklenir
   - `data.hr*` referansları kaldırılır (data persistence layer'dan da)
   - Production smoke: tüm 4 sekme açılır → ağaç + personel + pozisyon + işe alım çalışır

8. **PR 8: Verification + dokümantasyon** (`Faz 4 / PR 8`)
   - `docs/PHASE_4_VERIFICATION.md` (ekran görüntüleri + manuel doğrulama matrisi)
   - MIGRATION_ROADMAP metrikleri güncellenir
   - CHANGELOG güncellenir
   - ARCHITECTURE.md'ye HR modülü örnek olarak eklenir

### Riskler ve Önlemleri

- **Risk:** TC Kimlik doğrulayıcısının yanlış implementasyonu (mod 10/11). **Önlem:** Domain testinde resmi test vektörleri kullanılır (NVI dokümantasyonundan); pozitif + negatif 20+ vaka.
- **Risk:** Org ağacında cycle (A → B → A). **Önlem:** `MoveOrgUnitUseCase` içinde DB-level recursive CTE ile path check + DB trigger ile çift güvenlik.
- **Risk:** `manager_employee_id` ↔ `department_id` arasında karşılıklı FK döngüsü. **Önlem:** Department oluşturulurken manager NULL, sonradan UPDATE; veya partial migration (DEFERRABLE constraint).
- **Risk:** Employee ↔ User bağlantısı (Faz 3 ile sınır). **Önlem:** `LinkEmployeeToUserUseCase` zayıf bağlantı; auth modülü HR'ı bilmez, HR sadece `UserLookupPort` üzerinden okur. ADR-0005'te netleşir.
- **Risk:** Recruitment stage geçiş tutarsızlığı (örn. "rejected" → "interview" geçişi). **Önlem:** `ApplicationStageTransitionPolicy` saf TS — tüm geçişler whitelisted; DB trigger ek koruma.
- **Risk:** `HireFromApplicationUseCase` yarı tamamlanmış işlem (Application "hired" oldu ama Employee oluşamadı). **Önlem:** Tek DB transaction; PgApplicationRepository ile PgEmployeeRepository aynı transaction client'ı paylaşır (Unit of Work pattern).
- **Risk:** PR 7 cutover'da büyük diff (~14.150 satır silme + import). **Önlem:** Önce App.jsx'te HR sekmesi conditional render olarak demo sayfasına yönlendirilir (mini PR), sonra silme PR'ı.
- **Risk:** PR 1'deki ENUM ALTER (user_role'e hr_manager eklemek) Faz 3 testlerini bozabilir. **Önlem:** Auth modülü testleri PR 1 öncesi gözden geçirilir; UserRole.ts'in `isHrManager()` testi eklenir.

### Test Beklentileri

- `domain/`: %95+
  - TcKimlik validator: 20+ pozitif/negatif vektör
  - OrgTreeBuilder: 0, 1, çok seviyeli, dengesiz ağaç + cycle algılama
  - Employee state machine: tüm geçişler + yasaklı geçişler
  - ApplicationStageTransitionPolicy: tüm yasal + yasak geçişler tablosu
  - HireFromApplicationPolicy: Application "hired" olduğunda Employee'nin doğru field map'lenmesi
- `application/`: %85+
  - Her use-case için happy + 2-3 edge (yetkisiz, cycle, çakışan employee_no, vb.)
  - `HireFromApplicationUseCase`: pozisyon kapalı, candidate başka pozisyona zaten hired, employee_no çakışması
- `infrastructure/persistence/`: testcontainers
  - `application_stage_history` trigger'ının çalıştığı doğrulanır
  - Atomik hire transaction'ın rollback'i (Employee oluşurken hata fırlatılırsa Application "hired" da geri alınır)
- `presentation/`: Hono testClient — 401, 403, 200, 422 davranışları; rol bazlı erişim (`user` → 403, `hr_manager` → 200)
- E2E (Playwright):
  - "Org birim ekle → Departman ekle → Pozisyon aç → Çalışan işe al → ağaçta görün → çalışanı transfer et → eski departman 0 kişi, yeni departman 1 kişi"
  - "Candidate ekle → Application gönder → kanban'da new → screening → interview → offer → hired → Employees sekmesinde otomatik görün"
- Frontend component testleri: form validation (TC kimlik, telefon, hire_date), OrgTree render, ApplicationKanban drag-drop

### Çıkış Kriterleri

- [ ] 8 PR merge edildi
- [ ] `npm run typecheck` temiz (0 error)
- [ ] `npm run lint` temiz (boundary kuralları dahil)
- [ ] `npm run test` geçer (coverage hedefleri tutar)
- [ ] App.jsx satır sayısı ~67.000'e düştü (14.150 azaldı — `wc -l` ile doğrulandı)
- [ ] `legacy/` etkilenmedi (HR zaten orada değildi)
- [ ] `modules/hr/index.ts` public API kapsamı: HrPage, hr domain tipleri, useCases barrel
- [ ] CHANGELOG güncellendi
- [ ] PHASE_4_VERIFICATION.md eklendi (ekran görüntüleri + manuel doğrulama)
- [ ] ADR-0005 yazıldı ve kabul edildi (hr_manager rolü + Employee↔User opsiyonel link)
- [ ] `user_role` ENUM'una `hr_manager` eklendi, auth modülü testleri yeşil

---

## Faz 2-12 — Yüksek Düzey Planlar

(Sadece anahatlar — gerçek detayı her fazın başında bu dokümana eklenecek.)

### Faz 2 — AI Widget + ML Proxy

- App.jsx'teki AI asistan widget → `frontend/src/modules/ai/`
- `api-server/src/routes/ai-proxy.ts` → `api-server/src/modules/ai/`
- Claude API çağrıları + ml-service köprüsü
- Boyut: ~800 satır App.jsx kod → ~600 satır modüler TS

### Faz 3 — Auth & Users

- Login, logout, JWT, password reset, RBAC
- frontend/src/modules/auth/ + api-server/src/modules/auth/
- Şu an api-server/src/routes/auth.ts'te var, modüler yapıya taşınacak
- **Önemli:** Tüm gelecek modüller User entity'sine bağlı olacağı için bu erken olmalı

### Faz 4 — HR Core _(detaylı plan yukarıda)_

- 4-tier organizasyon (şirket→bölüm→departman→birim)
- Çalışan CRUD + Recruitment
- Pozisyon kütüphanesi
- modules/hr/ (her iki tarafta)
- Bağımlılık: Faz 3 (User)

### Faz 5 — Finance: Bütçe & Kasa

- Budget calendar (12 ay × kategori matrisi)
- Kasa & banka, transferler
- Tahsilat/ödeme cell sistemi
- modules/finance/ (her iki tarafta)
- En kritik domain: Money value object, Currency, DateRange burada doğar

> **NOT — mevcut şema:** `categories`, `cells` (003), `banks/bank_accounts/kasa_accounts/kasa_entries/transfers` (004), `invoices/invoice_payments/v_invoice_status` (005) tabloları **zaten var**. Faz 5 yeni tablo eklemez (gerekirse küçük ALTER migration'lar); mevcut şemanın üstüne temiz DDD modülü kurar (Strangler Fig). UoW pattern (ADR-0006) burada yoğun kullanılır: invoice payment, transfer, commit-to-cells hepsi atomik.

#### Detaylı PR Planı

**PR 1 — Foundation (domain VO'ları + iskelet)**

- `Money` (NUMERIC(20,2) tabanlı, integer-kuruş aritmetiği — float yok), `Currency` (TRY/USD/EUR), `KdvRate` (0–1, default 0.20), `FiscalYear`, `MonthIndex` (0–11), `FlowDirection` (in/out), `CategorySection` (inflows/outflows/nonPnlOutflows/kasaCategories)
- `modules/finance/` Clean Architecture iskeleti (domain/application/infrastructure/presentation)
- Money aritmetik servisi: KDV hesaplama (subtotal→kdv→total), allocation (yuvarlama artığı dağıtımı)
- Domain testleri (Money kuruş aritmetiği + KDV + tüm VO validation)

**PR 2 — Budget: Category + Cell**

- `Category` entity (section, name, sortOrder), `Cell` entity (category×fiscalYear×monthIdx→Money value)
- `BudgetMatrix` domain service (12×N matris kurma/okuma)
- Use-case: CreateCategory, RenameCategory, ReorderCategories, ArchiveCategory, GetBudgetMatrix, SetCellValue, BulkSetCells
- Repository port'ları + DTO + errors + in-memory fakes + use-case testleri

**PR 3 — Cash: Bank/Kasa accounts + KasaEntry + Transfer**

- `Bank` (sistem geneli), `BankAccount`, `KasaAccount`, `KasaEntry`, `Transfer` entity'leri
- `CashPositionCalculator` domain service (openingBalance + entries/transfers → güncel bakiye, currency bazlı)
- Use-case: CRUD bank/kasa account, RecordKasaEntry, CreateTransfer (atomik — UoW), ListTransfers, GetCashPosition
- Multi-currency transfer kuralı (from/to currency + amount ayrı)

**PR 4 — Invoice + Payment**

- `Invoice` (AR/AP, KDV, paid_amount), `InvoicePayment` entity'leri
- `InvoiceStatusPolicy` (open/partial/paid/overdue), `Money` ile remaining hesabı
- Use-case: CreateInvoice, UpdateInvoice, RecordPayment (atomik — paid_amount + status), DeletePayment, ListInvoices (status filter), GetOverdueInvoices
- Payment → bank/kasa account bağı (opsiyonel)

**PR 5 — Commit-to-Cells (UoW yoğun)**

- `CashflowCommitPolicy` domain service: kasa entry / transfer / invoice payment → ilgili Cell'e Money ekler
- Use-case: CommitKasaEntryToCells, CommitTransferToCells, CommitInvoiceToCells, BulkCommitPending — hepsi `UnitOfWork.withTransaction` içinde (cell update + committed flag atomik)
- FinanceTransactionalRepositories (UnitOfWork genişletme)

**PR 6 — Infrastructure**

- 8+ Pg\* repository (PgCategory, PgCell, PgBankAccount, PgKasaAccount, PgKasaEntry, PgTransfer, PgInvoice, PgInvoicePayment) — hepsi `Queryable`
- PgFinanceUnitOfWork + REST routes (Hono + zod) + requireRole + DI + app.ts mount
- testcontainers integration testleri (trigger doğrulama: invoice paid_amount, v_invoice_status)

**PR 7 — Frontend**

- DTO + FinanceApiClient + hooks (useBudgetMatrix, useCashPosition, useInvoices, useCategories)
- Component: BudgetMatrix (düzenlenebilir 12×N grid), CashPositionCards, InvoicesTable, TransferForm, KasaEntryForm
- Vitest + Testing Library + MSW testleri

**PR 8 — Cutover + Verification**

- App.jsx'teki eski finance kodu sil → FinanceDemoPage mount
- PHASE_5_VERIFICATION.md + CHANGELOG + ADR-0007 (Money kuruş aritmetiği kararı)

**Tahmini:** 8 PR, ~3-4 hafta. Money VO Faz 6/7/10'un temeli.

### Faz 6 — Finance: E-Fatura _(detaylı plan aşağıda)_

- eLogo SOAP integration + UBL-TR 2.1 parser + TCMB/EVDS döviz kuru + kur farkı (revaluation)
- modules/finance/einvoice/ + modules/finance/fx/ (alt modüller)
- Bağımlılık: Faz 5 (Money, Currency, UoW)

---

## Faz 6 — Finance: E-Fatura (DETAYLI PLAN)

İlk **dış sistem entegrasyonu** ağırlıklı modül: GİB e-Fatura (eLogo/QNB eFinans entegratörü, SOAP), UBL-TR 2.1 XML parse, TCMB/EVDS döviz kuru tarihçesi ve UFRS 21 kur farkı değerleme. Faz 5'in `Money`/`Currency`/UoW altyapısı üzerine kurulur; gelen e-faturaları `invoices` tablosuna (Faz 5) atomik import eder.

### Hedef

`api-server/src/routes/einvoice.ts` + `src/services/einvoice/**` + `src/services/tcmb.ts` (toplam ~1.341 satır, **ADR-0004 ile TS-exclude'da**) legacy kodunu `modules/finance/einvoice/` ve `modules/finance/fx/` altına TS strict olarak yeniden yaz. App.jsx'teki `EInvoiceManager` (Faz 5 cutover'ında ölü kod olarak bırakıldı, ~53 referans) ve FX/revaluation görünümleri yeni modüle cutover edilir.

**ADR-0004 kapanışı:** Bu faz merge edildiğinde `api-server/tsconfig.json`'daki `src/routes/einvoice.ts` + `src/services/einvoice/**` exclude satırları silinir; legacy dosyalar kaldırılır.

### Kritik ön-koşul: migration düzeltmesi

`009_einvoice.sql` **bozuk** — `einvoice_*` tablolarını `company_id UUID`, `users(id) UUID`, `invoices(id) UUID` ile tanımlıyor; oysa gerçek şemada bunlar `INT/SERIAL/BIGSERIAL`. Bu yüzden 009 bugün hiçbir ortamda uygulanamıyor (HR integration testlerinde de patlamıştı). Faz 6:

- `009_einvoice.sql` **devre dışı bırakılır/yerine geçilir**: yeni `016_einvoice.sql` doğru INT FK tipleriyle (`company_id INT → companies(id)`, `created_by INT → users(id)`, `imported_invoice_id BIGINT → invoices(id)`) yazılır.
- Tablolar: `einvoice_credentials` (AES-256-GCM şifreli config), `einvoice_invoices` (entegratör cache), `einvoice_sync_log`, `einvoice_party_mapping` (VKN → mevcut müşteri/tedarikçi eşleme).
- `006_exchange_rates_revaluations.sql` **zaten INT tabanlı ve doğru** — olduğu gibi kullanılır (`exchange_rate_history`, `v_current_rates`, `revaluations`).

### Domain modeli

```
EInvoiceCredential (şirket × provider, şifreli config)
       │ provider: elogo | qnb_efinans | mock
       ▼
EInvoiceProvider (port)  ──SOAP──▶  GİB / entegratör
       │ fetchInvoices / fetchInvoiceXml / testConnection
       ▼
EInvoice (cache kaydı)  ──parse(UBL-TR 2.1)──▶  EInvoice + EInvoiceLine[]
       │ direction: incoming/outgoing, ETTN, VKN, tutarlar (Money)
       ▼
Import → invoices (Faz 5)  + PartyMapping (VKN → mevcut karşı taraf)  [UoW atomik]

ExchangeRate (TCMB/EVDS)  ──▶  Revaluation (kur farkı: 646 kambiyo karı / 656 zararı)
```

### Kapsam

#### Backend (`api-server/src/modules/finance/einvoice/` + `.../fx/`)

1. **Domain**
   - `valueObjects/Vkn.ts` — VKN (10 hane) / TCKN (11 hane) doğrulama algoritması
   - `valueObjects/Ettn.ts` — GİB ETTN/UUID format
   - `valueObjects/InvoiceDirection.ts` (incoming/outgoing)
   - `valueObjects/EInvoiceScenario.ts` (TEMELFATURA/TICARIFATURA/EARSIVFATURA)
   - `valueObjects/EInvoiceType.ts` (SATIS/IADE/TEVKIFAT/ISTISNA/...)
   - `valueObjects/GibStatus.ts` · `valueObjects/ProviderType.ts`
   - `entities/EInvoice.ts` + `entities/EInvoiceLine.ts` (tutarlar Faz 5 `Money`; subtotal/kdv/tevkifat/ÖTV/konaklama)
   - `entities/EInvoiceCredential.ts` · `entities/PartyMapping.ts`
   - `services/UblInvoiceParser.ts` — UBL-TR 2.1 XML → EInvoice (saf, fixture'larla test edilir)
   - **fx:** `entities/ExchangeRate.ts` · `entities/Revaluation.ts` + `services/RevaluationCalculator.ts` (kur farkı gain/loss, hesap bazlı)
   - `errors/EInvoiceErrors.ts` (CredentialNotFound, ProviderAuthError, UblParseError, AlreadyImported, PartyMappingMissing, ...)

2. **Application**
   - **EInvoice:** `SyncEInvoicesUseCase` (provider → cache, idempotent UNIQUE(company,uuid)), `ImportEInvoiceUseCase` (cache → `invoices`, party mapping, **UoW atomik**), `IgnoreEInvoiceUseCase`, `ListEInvoicesUseCase` (filter: direction/date/pending), `GetSyncLogUseCase`
   - **Credential:** `SaveCredentialUseCase` (şifreli yaz), `TestConnectionUseCase`, `DeleteCredentialUseCase`
   - **PartyMapping:** `MapPartyUseCase`, `ListUnmappedPartiesUseCase`
   - **FX:** `FetchAndStoreRatesUseCase` (TCMB/EVDS), `GetCurrentRatesUseCase`, `GetRateAtUseCase`, `CreateRevaluationUseCase`, `PostRevaluationUseCase`
   - **Ports:** `EInvoiceProvider`, `CredentialCipher`, `EInvoiceRepository`, `EInvoiceCredentialRepository`, `SyncLogRepository`, `PartyMappingRepository`, `ExchangeRateRepository`, `RevaluationRepository`, `RateProvider` (TCMB), `Clock`
   - DTO + in-memory fakes

3. **Infrastructure**
   - `provider/ELogoProvider.ts` (SOAP — legacy `elogo.ts` modernize) + `provider/MockProvider.ts` (test/demo)
   - `crypto/AesGcmCredentialCipher.ts` (AES-256-GCM — legacy `crypto.ts` modernize, key env'den)
   - `parser/` — UblInvoiceParser zaten domain'de saf; XML kütüphanesi adapter'ı burada
   - `rates/TcmbRateProvider.ts` (EVDS — legacy `tcmb.ts` modernize)
   - `persistence/` — `PgEInvoiceCredentialRepository`, `PgEInvoiceRepository`, `PgSyncLogRepository`, `PgPartyMappingRepository`, `PgExchangeRateRepository`, `PgRevaluationRepository` (hepsi `Queryable`)

4. **Presentation** (`presentation/routes.ts`)
   - E-Fatura: `GET /v1/finance/einvoice` (filter), `POST /v1/finance/einvoice/sync`, `POST /v1/finance/einvoice/:id/import`, `POST /v1/finance/einvoice/:id/ignore`, `GET /v1/finance/einvoice/sync-log`
   - Credential: `GET|PUT|DELETE /v1/finance/einvoice/credentials`, `POST /v1/finance/einvoice/credentials/test`
   - FX: `GET /v1/finance/fx/rates`, `POST /v1/finance/fx/rates/fetch`, `GET|POST /v1/finance/fx/revaluations`, `POST /v1/finance/fx/revaluations/:id/post`
   - Yazma → `requireRole('cfo')`

5. **DI:** `registerEInvoiceModule(pool, config)` — AES key + provider config env'den; `index.ts`'e mount

#### Frontend (`frontend/src/modules/finance/` genişletme)

- `infrastructure/api/EInvoiceApiClient.ts` (einvoice + fx endpoint'leri)
- Hook'lar: `useEInvoices`, `useSyncStatus`, `useExchangeRates`, `useRevaluations`
- Component'ler: `EInvoiceInbox` (gelen/giden tablo + import butonu), `SyncPanel` (sync tetikle + log), `CredentialForm`, `ExchangeRatePanel`, `RevaluationView`
- `FinanceDemoPage`'e "E-Fatura" + "Döviz/FX" sekmeleri (`FinanceTab` union genişler)
- Vitest + MSW testleri

#### Migration Adapter (App.jsx)

- `EInvoiceManager` ve FX/revaluation görünümleri silinir; ilgili view'lar `FinanceDemoPage` (initialTab="einvoice"/"fx") veya yeni view'a bağlanır.
- Faz 5'te ölü kod bırakılan `EInvoiceManager` burada gerçekten sökülür.

### Migration Adımları (PR olarak)

1. **PR 1 — Foundation: 016 migration + domain VO + crypto** — `016_einvoice.sql` (INT FK düzeltmesi), VO'lar (Vkn/Ettn/scenario/type/status/provider), `EInvoiceCredential` entity + `CredentialCipher` port + `AesGcmCredentialCipher`, domain testleri (VKN/TCKN doğrulama vektörleri + crypto round-trip).
2. **PR 2 — UBL-TR parser** — `EInvoice`/`EInvoiceLine` entity + `UblInvoiceParser` (saf domain servisi); gerçek UBL-TR 2.1 XML fixture'larıyla kapsamlı test (SATIS/IADE/TEVKIFAT/ISTISNA, döviz, çok kalemli).
3. **PR 3 — Provider port + eLogo SOAP + Mock** — `EInvoiceProvider` port, `ELogoProvider` (SOAP, legacy modernize), `MockProvider`. testConnection/fetch testleri (MockProvider ile).
4. **PR 4 — FX alt modülü** — `ExchangeRate`/`Revaluation` domain + `RevaluationCalculator` + `TcmbRateProvider` (EVDS) + use-case'ler (rate fetch/store, revaluation create/post).
5. **PR 5 — Application: sync + import** — SyncEInvoices, ImportEInvoice (UoW atomik), Ignore, ListEInvoices, credential & party-mapping use-case'leri + portlar + fakes + testler.
6. **PR 6 — Infrastructure + REST + DI + integration** — 6 Pg repo + routes + `registerEInvoiceModule` + app.ts mount; testcontainers (016+006 migration, crypto round-trip, import atomikliği, sync idempotency). **ADR-0004 exclude'ı kaldır + legacy `einvoice.ts`/`services/einvoice/**`/`tcmb.ts` sil.\*\*
7. **PR 7 — Frontend** — EInvoiceApiClient + hook'lar + component'ler + FinanceDemoPage sekmeleri + Vitest.
8. **PR 8 — Cutover + Verification** — App.jsx'ten `EInvoiceManager`+FX görünümleri sil → yeni modül mount; **ADR-0008** (e-fatura provider soyutlaması + AES kimlik şifreleme + "extract-on-demand" notu: e-fatura dış SOAP/compliance profili nedeniyle ileride ayrı servise çıkarmaya en güçlü aday); `PHASE_6_VERIFICATION.md` + CHANGELOG + roadmap metrikleri + ADR-0004 "closed" işaretle.

### Riskler ve Önlemleri

- **Risk:** 009→016 migration tip değişimi mevcut veriyi bozar. **Önlem:** einvoice verisi production'da yok (demo); 009 hiç uygulanamadığı için temiz başlanır. 016 idempotent (`IF NOT EXISTS`).
- **Risk:** SOAP entegrasyonu test edilemez (canlı GİB gerekir). **Önlem:** `MockProvider` + kaydedilmiş SOAP/XML fixture'ları; `ELogoProvider` ince adapter, mantık parser/domain'de.
- **Risk:** UBL-TR parse kenar durumları (tevkifat, istisna, ÖTV, döviz faturası). **Önlem:** Gerçek XML örnekleriyle 20+ parser testi; tutarlar `Money` ile kuruş-kesin.
- **Risk:** Kimlik bilgisi (entegratör şifresi) sızıntısı. **Önlem:** AES-256-GCM at-rest şifreleme; anahtar env'den; testlerde sahte anahtar; log'a asla plaintext yazılmaz.
- **Risk:** Aynı faturanın iki kez import'u. **Önlem:** `UNIQUE(company_id, uuid)` + `imported_invoice_id` kontrolü + import UoW atomik.
- **Risk:** TCMB/EVDS API erişimi/limit. **Önlem:** `exchange_rate_history` cache; `RateProvider` port'u mock'lanabilir.

### Test Beklentileri

- `domain/`: %95+ — VKN/TCKN vektörleri, UblInvoiceParser tüm senaryolar, RevaluationCalculator gain/loss.
- `application/`: %85+ — sync idempotency, import atomik + party mapping eksik, revaluation post.
- `infrastructure/`: testcontainers — crypto round-trip, import transaction rollback, sync UNIQUE.
- `presentation/`: rol bazlı erişim + 200/401/403/422.
- Frontend: client (MSW) + hook + component testleri.

### Çıkış Kriterleri

- [ ] 8 PR merge edildi
- [ ] Backend `npm run typecheck` + `npm test` + `npm run test:integration` temiz/geçer
- [ ] Frontend `npm run typecheck` + `npm test` geçer
- [ ] `016_einvoice.sql` INT FK ile uygulanıyor; `009` devre dışı
- [ ] ADR-0004 exclude satırları kaldırıldı; legacy `einvoice`/`tcmb` dosyaları silindi
- [ ] App.jsx'ten `EInvoiceManager` + FX görünümleri silindi
- [ ] ADR-0008 yazıldı (provider soyutlama + kimlik şifreleme + extract-on-demand)
- [ ] PHASE_6_VERIFICATION.md + CHANGELOG + roadmap metrikleri güncellendi

**Tahmini:** 8 PR, ~3-4 hafta. İlk dış-entegrasyon fazı; mikroservis "extract-on-demand" için en güçlü aday modül.

### Faz 7 — Payroll

- Türkiye bordro motoru
- SGK, GV, DV, AR-Ge teşvik
- Yıllık parametre versiyonlama (2024/2025/2026)
- Kümülatif gelir vergisi
- modules/payroll/
- Bağımlılık: Faz 4 (Employee), Faz 5 (Money)

### Faz 8 — Attendance & İzin

- Toplu/takvimli puantaj
- PDKS CSV import
- 10 izin tipi workflow
- modules/attendance/
- Bağımlılık: Faz 4 (Employee), Faz 7 (Payroll için bordro etkilemesi)

### Faz 9 — Talep Sistemi

- Avans, masraf, zimmet
- Approval workflow
- modules/requests/
- Bağımlılık: Faz 4 (Employee), Faz 7 (Avans → bordroya kesinti)

### Faz 10 — Projeler

- Gantt + dependencies
- Zaman takibi
- Kaynak planlama
- Risk matrisi
- modules/projects/
- Bağımlılık: Faz 4 (Employee — kaynak), Faz 5 (Money — bütçe)

### Faz 11 — Self-Service Portal

- Çalışan tarafı UI (8 sekme)
- modules/self-service/
- Bağımlılık: Faz 8, Faz 9 (her şey portalda görünür)

### Faz 12 — Reports v3 + Dashboard Builder

- 8 hazır rapor (Müşteri kar, Project P&L, vb.)
- Excel multi-sheet export
- Custom Dashboard Builder
- modules/reports/
- Bağımlılık: Faz 5-10 (verilerini okur)

---

## Final — Strangler Tamamlandı

- App.jsx silinir, App.tsx default olur
- `legacy/` silinir
- README.md ve KURULUM.md güncellenir
- Final commit: `chore: strangler fig complete — App.jsx and legacy/ removed`
- Versiyon: `3.0.0`

---

## Metrikler — İlerleme Takibi

Her PR'da güncellenecek:

| Metrik                   | Faz 0 (şimdi) | Faz 4 PR 1 sonrası | Hedef (Final) |
| ------------------------ | ------------- | ------------------ | ------------- |
| App.jsx satır sayısı     | 81.159        | 81.159             | 0             |
| Toplam TS/TSX dosya      | 0             | ~120               | ~400          |
| Toplam test dosyası      | 0             | ~50                | ~200          |
| Test coverage            | 0%            | %50                | %80+          |
| `legacy/` dizini         | mevcut        | mevcut             | silinmiş      |
| Strict TypeScript hatası | bilinmiyor    | 0                  | 0             |

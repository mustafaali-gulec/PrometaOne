# Changelog

Sürüm tarihçesi. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) + [SemVer](https://semver.org).

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

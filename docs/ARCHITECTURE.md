# Prometa One — Hedef Mimari

**Durum:** Bootstrap (Phase 0) · **Son güncelleme:** 2026-05-19

Bu doküman, Prometa One projesinin **yeni mimari** hedefini ve SOLID prensiplerinin nasıl uygulandığını anlatır. Mevcut monolitik durumdan (81K satırlık tek `App.jsx`) hedef duruma **Strangler Fig** yöntemiyle kademeli geçiş yapılacaktır.

> Mimari kararlar `docs/adr/` altında ADR'ler (Architectural Decision Records) olarak tutulur. Bu dosyayı okumadan önce sırasıyla `0001`, `0002`, `0003`'ü okumak önerilir.

---

## 1. Üst Düzey Bakış

```
┌─────────────────────────────────────────────────────────────────┐
│  PROMETA ONE — Polyglot Monorepo                                │
│  ─────────────────────────────────────────                      │
│                                                                 │
│   frontend/         api-server/         ml-service/   legacy/   │
│   (React+TS)        (Hono+TS)           (FastAPI+Py)  (arşiv)   │
│       ▲                  ▲                   ▲                  │
│       └──────────────────┴───────────────────┘                  │
│                          │                                      │
│                          ▼                                      │
│              shared standards & tooling                         │
│   (.editorconfig · eslint · prettier · tsconfig.base.json       │
│    · commitlint · husky · CI · docs/adr/)                       │
└─────────────────────────────────────────────────────────────────┘
```

Üç çalışan servis (`frontend`, `api-server`, `ml-service`) + bir geçici arşiv (`legacy/`). Her servis kendi runtime'ında ama **tek bir kod tabanında, tek bir standartlar setiyle** yaşar.

---

## 2. Katmanlı Mimari (Frontend ve api-server için ortak)

Her modül 4 katmana ayrılır. Bağımlılık yönü **tek yönlüdür** — dış katmanlar iç katmanlara bağlanır, tersi yasak.

```
   ┌──────────────────────────────────────────────────┐
   │ presentation/    React component'ları, UI        │   ← Frontend'de var
   │                  route handler'ları              │   ← api-server'da var
   ├──────────────────────────────────────────────────┤
   │ application/     use-case'ler, command/query     │
   │                  handler'ları, DTO mapping       │
   ├──────────────────────────────────────────────────┤
   │ domain/          iş kuralları, entity'ler,       │
   │                  value object'ler, domain        │
   │                  servisleri (saf TypeScript)     │
   ├──────────────────────────────────────────────────┤
   │ infrastructure/  DB repository'leri, HTTP        │
   │                  client'ları, SMTP, file IO      │
   └──────────────────────────────────────────────────┘
```

**Kural — Dependency Rule (Clean Architecture):**

- `domain/` → **hiçbir şeye** bağımlı olmaz (saf TS, framework'siz)
- `application/` → sadece `domain/`'e bağlanır
- `infrastructure/` → `domain/` ve `application/`'a bağlanır (interface'leri implement eder)
- `presentation/` → `application/`'a bağlanır (use-case'leri çağırır)

Bu yön bozulamaz. ESLint kuralı (`eslint-plugin-boundaries`) ile compile-time'da zorlanır.

---

## 3. Frontend Klasör Yapısı (Hedef)

```
frontend/src/
├── modules/                        ← Domain bazlı feature modülleri
│   ├── finance/
│   │   ├── presentation/
│   │   │   ├── components/         ← BudgetCalendar.tsx, KasaList.tsx
│   │   │   ├── pages/              ← BudgetPage.tsx
│   │   │   └── hooks/              ← useBudget.ts (sadece UI state)
│   │   ├── application/
│   │   │   ├── useCases/           ← createBudgetCell.ts, importEInvoice.ts
│   │   │   └── dto/                ← BudgetCellDto.ts
│   │   ├── domain/
│   │   │   ├── entities/           ← BudgetCell.ts, Invoice.ts
│   │   │   ├── valueObjects/       ← Money.ts, Currency.ts
│   │   │   └── services/           ← BudgetCalculator.ts
│   │   ├── infrastructure/
│   │   │   ├── api/                ← BudgetApiClient.ts (Axios/fetch wrap)
│   │   │   └── adapters/           ← TcmbExchangeRateAdapter.ts
│   │   ├── __tests__/
│   │   └── index.ts                ← Public API (barrel)
│   │
│   ├── hr/                         ← Organization, employees, ATS
│   ├── payroll/                    ← Türkiye bordro motoru
│   ├── attendance/                 ← Puantaj + izin
│   ├── requests/                   ← Avans, masraf, zimmet
│   ├── projects/                   ← Gantt, kaynak, risk
│   ├── notifications/              ← In-app feed, comments
│   ├── ai/                         ← Claude widget, ML proxy
│   ├── reports/                    ← Reports v3 + dashboard builder
│   └── self-service/               ← Çalışan portalı
│
├── shared/                         ← Cross-cutting concerns
│   ├── ui/                         ← Generic Button, Modal, Table
│   ├── lib/                        ← formatDate, currency, http
│   ├── types/                      ← Brand types, utility types
│   ├── hooks/                      ← useAuth, useTheme, useLocale
│   └── i18n/                       ← TR/EN/DE/AR translations
│
├── app/                            ← Bootstrap + routing
│   ├── App.tsx                     ← Yeni iskelet (eski 81K App.jsx değil)
│   ├── routes.tsx
│   ├── providers.tsx               ← Theme, QueryClient, i18n providers
│   └── main.tsx
│
└── App.jsx                         ← ⚠️ LEGACY — Strangler Fig fazında
                                       parça parça yukarıdaki modüllere taşınır
```

### Bir modül ne zaman "modül"dür?

- En az **1 domain entity** + **1 use-case** + **1 UI ekranı**
- Diğer modüllere **`index.ts` üzerinden** açılır (private kod sızdırmaz)
- Kendi `__tests__/` dizini olur
- Başka bir modüle direkt erişmez — sadece `shared/` veya başka modülün `index.ts`'i üzerinden

---

## 4. Backend (api-server) Klasör Yapısı (Hedef)

```
api-server/src/
├── modules/                        ← Frontend ile birebir hizalı
│   ├── auth/
│   │   ├── presentation/
│   │   │   └── routes.ts           ← POST /v1/auth/login (Hono handler)
│   │   ├── application/
│   │   │   ├── LoginUseCase.ts
│   │   │   └── dto/LoginDto.ts
│   │   ├── domain/
│   │   │   ├── entities/User.ts
│   │   │   ├── valueObjects/Password.ts
│   │   │   └── services/PasswordHasher.ts (interface)
│   │   ├── infrastructure/
│   │   │   ├── BcryptPasswordHasher.ts  (interface'i implement eder)
│   │   │   ├── PgUserRepository.ts
│   │   │   └── JwtTokenIssuer.ts
│   │   └── __tests__/
│   │
│   ├── finance/                    ← Bütçe + kasa + e-fatura + TCMB
│   ├── hr/
│   ├── payroll/
│   ├── notifications/              ← ← cron + email (legacy/backend buraya gelecek)
│   ├── ai/                         ← Claude proxy
│   └── ...
│
├── shared/
│   ├── db/                         ← Pg pool, transaction helper
│   ├── http/                       ← Hono middleware (auth, audit, error)
│   ├── logging/                    ← Pino logger
│   ├── config/                     ← env validation (zod)
│   └── errors/                     ← Domain/AppError sınıfları
│
├── migrations/                     ← Mevcut yapısı korunur
├── app.ts                          ← Hono app bootstrap (DI container kurulumu)
└── index.ts                        ← Server start
```

---

## 5. SOLID Prensiplerinin Bu Mimaride Karşılığı

| Prensip | Bu projede ne demek |
|---|---|
| **S** — Single Responsibility | Her dosya tek bir nedenle değişir. 81K satırlık App.jsx anti-prototip. Bir component sadece UI, bir use-case sadece bir iş akışı, bir repository sadece bir entity'nin CRUD'u. |
| **O** — Open/Closed | Yeni özellik **var olan kodu değiştirmeden** eklenebilir. Örnek: yeni bir e-fatura sağlayıcısı, `EInvoiceProvider` interface'ini implement eden yeni bir class yazılarak eklenir — mevcut kod açılmaz. |
| **L** — Liskov Substitution | Interface'i implement eden her sınıf, sözleşmenin tamamını karşılar. `PasswordHasher` interface'ini implement eden `BcryptPasswordHasher` ile `Argon2PasswordHasher` yer değiştirebilir; çağıran kod hiçbir şey bilmez. |
| **I** — Interface Segregation | Büyük interface yok. `UserRepository` ayrı, `RoleRepository` ayrı. Bir use-case yalnızca ihtiyaç duyduğu interface'i alır. |
| **D** — Dependency Inversion | Üst katmanlar concrete sınıflara değil **interface'lere** bağlanır. `LoginUseCase`, `PgUserRepository`'i tanımaz — `UserRepository` interface'ini bilir. Concrete implementasyon `app.ts`'de DI container'da inject edilir. |

### Dependency Injection Yaklaşımı

- **Frontend:** Composition pattern (provider'lar + custom hook'lar). Heavy DI framework yok.
- **api-server:** Manuel DI (composition root `app.ts`'de) veya hafif bir DI lib (`tsyringe`/`awilix`). Karar 0004 numaralı bir ADR'de verilecek.

---

## 6. Test Stratejisi

| Katman | Test türü | Araç |
|---|---|---|
| `domain/` | Unit (saf TS) | Vitest |
| `application/` | Unit + integration (mock infrastructure) | Vitest |
| `infrastructure/` | Integration (gerçek DB/HTTP, ama izole) | Vitest + testcontainers |
| `presentation/` (api-server) | Contract tests (Hono testClient) | Vitest |
| `presentation/` (frontend) | Component testleri | Vitest + Testing Library |
| End-to-end | E2E | Playwright |

Coverage hedefi: domain %95+, application %85+, infrastructure %70+, UI %60+.

---

## 7. Boundary Kuralları (ESLint ile zorlanacak)

`eslint-plugin-boundaries` + `eslint-plugin-import` ile şunlar **compile-time'da yasak**:

1. `modules/X` → `modules/Y/(domain|application|infrastructure)` (sadece `modules/Y/index.ts` ulaşılabilir)
2. `domain/` → herhangi bir framework, `application/`, `infrastructure/`, `presentation/`
3. `application/` → `infrastructure/`, `presentation/`
4. `shared/lib/` → `modules/`
5. `legacy/` → herhangi bir yer (yeni kod legacy'den import etmez)

---

## 8. Gözlemlenebilirlik (Sonraki Fazlar)

- **Logging:** Pino (api-server), browser console + Sentry (frontend)
- **Error tracking:** Sentry (her iki tarafta)
- **Metrics:** OpenTelemetry → Prometheus (sonraki faz)
- **Health checks:** `/health` + `/ready` endpoint'leri

---

## 9. Yol Haritası

Detaylı geçiş planı: `docs/MIGRATION_ROADMAP.md` (oluşturulacak).

Kısaca fazlar:

1. **Phase 0 — Foundation** (şu an): tooling, standartlar, dokümantasyon, modül iskeleti
2. **Phase 1 — Frontend Strangler Bootstrap**: `app/` yeni iskeleti, ilk modül (notifications veya ai widget) çıkarımı
3. **Phase 2 — Notifications domain'i**: legacy/backend → api-server/modules/notifications (cron, email, push)
4. **Phase 3 — Finance modülü**: budget calendar + kasa + e-fatura kademeli çıkarım
5. **Phase 4-N**: HR, payroll, projects, reports... (her biri kendi PR'ı)
6. **Phase Final**: `legacy/` silinir, `App.jsx` (eski) silinir.

---

## 10. Yaşayan Doküman

Bu dosya mimari değişikliklerin **tek doğru kaynağı**dır. Mimaride bir değişiklik yapılacaksa:

1. Yeni bir ADR yaz (`docs/adr/NNNN-baslik.md`)
2. ADR kabul edilince bu dosyayı güncelle
3. PR'da hem ADR'i hem ARCHITECTURE.md değişikliğini birlikte gönder

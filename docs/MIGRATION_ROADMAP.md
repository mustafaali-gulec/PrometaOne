# Prometa One — Migration Yol Haritası

**Son güncelleme:** 2026-05-19 · **Faz:** 0 (Foundation) tamamlandı

Bu dokümanın amacı: Strangler Fig migration'ının somut planı. Hangi modül hangi sırada çıkacak, her birinin tahmini büyüklüğü, risk seviyesi ve bağımlılıkları.

> Mimari hedef için `ARCHITECTURE.md`'ya, kararlar için `adr/`'ya bak.

---

## Faz Tablosu

| Faz | Ad | Hedef | Durum |
|---|---|---|---|
| **0** | Foundation | Tooling, standartlar, ADR'ler, modül iskeleti | ✅ Tamam |
| **1** | First Module — Notifications | Eski cron+email → api-server modülü + frontend bell | 🟡 Sıradaki |
| **2** | AI Widget + ML Proxy | App.jsx'teki AI asistan → modules/ai/ + api-server ai-proxy | ⏳ |
| **3** | Auth & Users | Login, JWT, RBAC → modules/auth/ (frontend + backend) | ⏳ |
| **4** | HR Core | Organizasyon, çalışanlar → modules/hr/ | ⏳ |
| **5** | Finance — Bütçe & Kasa | Budget calendar + bank/kasa hücreleri | ⏳ |
| **6** | Finance — E-Fatura | eLogo + UBL parser + TCMB | ⏳ |
| **7** | Payroll | Türkiye bordro motoru (SGK/GV/DV/AR-Ge) | ⏳ |
| **8** | Attendance & İzin | Puantaj + izin workflow | ⏳ |
| **9** | Talep Sistemi | Avans/masraf/zimmet | ⏳ |
| **10** | Projeler | Gantt, kaynak, risk, kapsam | ⏳ |
| **11** | Self-Service Portal | Çalışan portalı | ⏳ |
| **12** | Reports v3 + Dashboards | 8 hazır rapor + custom dashboard | ⏳ |
| **Final** | Strangler Tamamlandı | `legacy/` silindi, `App.jsx` silindi | ⏳ |

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
<NotificationBell />
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

### Faz 4 — HR Core
- 4-tier organizasyon (şirket→bölüm→departman→birim)
- Çalışan CRUD
- Pozisyon kütüphanesi
- modules/hr/ (her iki tarafta)
- Bağımlılık: Faz 3 (User)

### Faz 5 — Finance: Bütçe & Kasa
- Budget calendar (12 ay × kategori matrisi)
- Kasa & banka, transferler
- Tahsilat/ödeme cell sistemi
- modules/finance/ (her iki tarafta)
- En kritik domain: Money value object, Currency, DateRange burada doğar

### Faz 6 — Finance: E-Fatura
- eLogo SOAP integration
- UBL parser
- TCMB döviz kuru tarihçesi
- Revaluation
- modules/finance/einvoice/ (sub-module)
- Bağımlılık: Faz 5 (Money, Currency)

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

| Metrik | Faz 0 (şimdi) | Hedef (Final) |
|---|---|---|
| App.jsx satır sayısı | 81.159 | 0 |
| Toplam TS/TSX dosya | 0 | ~400 |
| Toplam test dosyası | 0 | ~200 |
| Test coverage | 0% | %80+ |
| `legacy/` dizini | mevcut | silinmiş |
| Strict TypeScript hatası | bilinmiyor (henüz çalıştırılmadı) | 0 |

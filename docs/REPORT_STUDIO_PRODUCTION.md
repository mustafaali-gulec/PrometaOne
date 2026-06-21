# Rapor Üreteci (Report Studio) — Üretim Kurulumu

Rapor Üreteci kodu üretime hazırdır; iki **ortam/ops** adımı kalmıştır:

1. **Salt-okunur DB rolü** — ad-hoc/kayıtlı SQL'i ayrı, kısıtlı bir PostgreSQL
   rolüyle çalıştırmak (derinlemesine savunmanın son halkası).
2. **SMTP** — zamanlanmış raporların e-posta ile gönderimi.

> Kod tarafı zaten hazır: `SafeSqlExecutor` her sorguyu READ ONLY transaction +
> `statement_timeout` ile çalıştırıp daima ROLLBACK eder; `SqlGuard` SELECT/WITH
> dışını ve hassas tabloları reddeder. Aşağıdaki rol, bunların **altına** gerçek
> bir DB-seviyesi duvar koyar. SMTP yoksa zamanlama yine çalışır ama e-posta
> gönderilmez (sunucu loguna `[reporting] (no-op email …)` düşer).

---

## 1) Salt-okunur DB rolü (`prometa_report`)

### 1.1 Rolü oluştur

`api-server/scripts/reporting-readonly-role.sql` betiğini DB sahibiyle çalıştır:

```bash
# Docker (çalışan stack — api-server compose projesi):
cd api-server
docker compose exec -T postgres \
  psql -U prometa -d prometa_one -v report_pw='GÜÇLÜ_PAROLA' \
  < scripts/reporting-readonly-role.sql

# veya doğrudan psql ile:
psql "postgres://prometa:***@localhost:5432/prometa_one" \
  -v report_pw='GÜÇLÜ_PAROLA' -f scripts/reporting-readonly-role.sql
```

Betik **fail-closed**'dur: yalnız `ReportCatalog.ts` allowlist'indeki 32 ilişkiye
`SELECT` verir; `users / sessions / access_* / password_resets /
einvoice_credentials` gibi hassas tablolara **erişim vermez**; rol düzeyinde
`statement_timeout = 15s` + `default_transaction_read_only = on` uygular.

> **Bakım:** `ReportCatalog.ts`'e yeni bir tablo/view eklersen, betikteki GRANT
> listesine de ekle ve betiği tekrar çalıştır (yoksa katalogda görünür ama sorgu
> "permission denied" verir).
>
> **Alternatif (daha az bakım, fail-open):** Tüm tablolara izin verip yalnız
> hassasları geri al:
>
> ```sql
> GRANT SELECT ON ALL TABLES IN SCHEMA public TO prometa_report;
> ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO prometa_report;
> REVOKE SELECT ON users, sessions, password_resets, access_custom_roles,
>   access_role_grants, access_permission_overrides, einvoice_credentials
>   FROM prometa_report;
> ```
>
> Dezavantaj: ileride eklenen **yeni hassas bir tablo** varsayılan olarak okunur
> hale gelir (fail-open). Fail-closed önerilir.

### 1.2 Doğrula

```bash
psql "postgres://prometa_report:GÜÇLÜ_PAROLA@localhost:5432/prometa_one" -c "SELECT count(*) FROM invoices;"   # ✓
psql "postgres://prometa_report:GÜÇLÜ_PAROLA@localhost:5432/prometa_one" -c "SELECT * FROM users LIMIT 1;"      # ✗ permission denied
psql "postgres://prometa_report:GÜÇLÜ_PAROLA@localhost:5432/prometa_one" -c "UPDATE invoices SET total=0;"      # ✗ read-only / denied
```

### 1.3 API'ye bağla

**a)** `api-server/.env` (compose `${...}` interpolasyonu + host çalıştırma için):

```dotenv
REPORTING_DB_PASSWORD=GÜÇLÜ_PAROLA
# Host/local (npm run dev) için ayrıca:
REPORTING_DATABASE_URL=postgres://prometa_report:GÜÇLÜ_PAROLA@localhost:5432/prometa_one
```

**b)** `api-server/docker-compose.yml` → `api.environment` bloğuna, `DATABASE_URL`
satırının hemen altına ekle (container içinde host = `postgres`):

```yaml
DATABASE_URL: postgres://${POSTGRES_USER:-prometa}:${POSTGRES_PASSWORD:-prometa123}@postgres:5432/${POSTGRES_DB:-prometa_one}
REPORTING_DATABASE_URL: postgres://prometa_report:${REPORTING_DB_PASSWORD:-}@postgres:5432/${POSTGRES_DB:-prometa_one}
```

> Tanımsız bırakılırsa `reportingPool` ana `DATABASE_URL`'e düşer (çalışır ama
> tek savunma SqlGuard + READ ONLY tx olur). Opsiyonel ayarlar (varsayılanlar
> kodda): `REPORTING_STATEMENT_TIMEOUT_MS=15000`, `REPORTING_MAX_ROWS=5000`,
> `REPORTING_POOL_MAX=5`.

**c)** api container'ını yeniden derle/başlat:

```bash
cd api-server && docker compose up -d --build --no-deps api
```

Boot logunda hata olmamalı; `GET /v1/reports/run` ile bir `SELECT` çalışmalı.

---

## 2) SMTP (zamanlanmış rapor e-postası)

Zamanlanmış raporlar saatlik cron ile vadesi gelenleri çalıştırıp **xlsx eki**
ile e-postalar. E-posta `EmailSender` portuyla gönderilir: SMTP tanımlıysa
Nodemailer, değilse Noop (loglar). **Aynı SMTP değişkenleri `notifications`
modülüyle paylaşılır** (günlük vade raporları da bunu kullanır).

`api-server/.env` (compose `api` servisi `SMTP_*`'ı zaten `${...}` ile geçiriyor):

```dotenv
SMTP_HOST=smtp.saglayici.com
SMTP_PORT=587
SMTP_SECURE=false              # 465 portu ise true
SMTP_USER=kullanici-veya-apikey
SMTP_PASS=********
SMTP_FROM=M Suite <noreply@prometbilisim.com>
```

Örnekler:

- **Gmail:** `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_SECURE=false`,
  `SMTP_USER=hesap@gmail.com`, `SMTP_PASS=<Uygulama Şifresi>` (Google Hesap →
  Güvenlik → 2 Adımlı Doğrulama → Uygulama şifresi).
- **Office365:** `smtp.office365.com:587`, secure=false.
- **SendGrid SMTP:** `smtp.sendgrid.net:587`, user=`apikey`, pass=`<API key>`.

Ardından api container'ını yeniden başlat:

```bash
cd api-server && docker compose up -d --build --no-deps api
```

> Cron yalnız `ENABLE_CRON=true` (varsayılan) iken çalışır. Çoklu-instance
> deployment'ta tek instance'da açık tutun.

---

## 3) Uçtan uca doğrulama

1. UI: Rapor Merkezi → **Üreteç (SQL)** → bir rapor çalıştır + **Kaydet** →
   **🕒 Zamanla** ile bir sonraki saate denk gelen günlük zamanlama ekle
   (geçerli alıcı e-posta).
2. Saat başında cron tetiklenir. Logu izle:
   ```bash
   docker logs prometa-one-api --tail 50 | grep -i "Zamanlanmış rapor"
   # → "📧 Zamanlanmış rapor: 1/1 gönderildi (0 hata)"
   ```
3. Alıcı kutusunu (veya SMTP yoksa `[reporting] (no-op email …)` logunu) kontrol et.
4. Denetim: `GET /v1/reports/runs?companyId=1` ve `scheduled_reports.last_status`.

---

## Güvenlik özeti (kod tarafı — hazır)

- Ayrı **reportingPool** (salt-okunur rol) · her sorgu **READ ONLY tx + statement_timeout + daima ROLLBACK** · satır cap.
- **SqlGuard:** tek statement, yalnız SELECT/WITH, DDL/DML & tehlikeli fonksiyon & gizli tablo denylist.
- **Görsel mod** yalnız allowlist katalogdan identifier üretir + otomatik `company_id` izolasyonu.
- **Ham SQL** yazma/çalıştırma yetkisi `reports.sql` (admin/cfo) ile sınırlı; `report_runs` denetim kaydı tutulur.

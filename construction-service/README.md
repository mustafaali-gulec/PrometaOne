# Construction Service — Şantiye Yönetim Mikroservisi

Prometa One'ın **bağımsız** şantiye/hakediş mikroservisi. Monolitten (`api-server`)
çıkarılmıştır; kendi process'i, kendi veritabanı (DB-per-service) ve Kafka event
yayını ile çalışır. Diğer modüllere **derleme/çalışma zamanı bağımlılığı yoktur**.

## Mimari

- **Stack:** Node 20 + TypeScript (tsx) + Hono + PostgreSQL (`pg`) + KafkaJS.
- **Katmanlama:** Clean Architecture — `src/modules/construction/{domain,application,infrastructure,presentation}`.
- **DB-per-service:** Yalnızca `cs_*` tablolar (migration `001`). `companies`,
  `users`, `vendors`, `invoices` → **soft reference** (FK'siz `id`). Bu varlıklar
  başka servislerin sahipliğindedir; tutarlılık event/iletişimle sağlanır.
- **Auth:** Monolit ile **paylaşılan `JWT_SECRET`**; token'lar stateless (HS256)
  doğrulanır, auth servisine ağ çağrısı yapılmaz.
- **Events (Kafka):** Domain olayları yayınlanır:
  - `construction.hakedis` — `status_changed` (submit/approve/reject/paid/cancel)
  - `construction.stock` — `moved` (giriş/çıkış/transfer/fire)
  - `KAFKA_BROKERS` tanımsızsa publisher **no-op** (Kafka'sız da ayağa kalkar).
  - Tüketici **henüz yok** (monolit entegrasyonu sonraki faz).

## API

`/v1/construction/*` — projeler, sözleşme/ihale, keşif/pursantaj, hakediş,
harcama/finans, malzeme/depo, işgücü/makine, raporlar. (Monolittteki uçların aynısı.)
`/v1/health` — sağlık (db + kafka durumu).

## Çalıştırma

```bash
cp .env.example .env        # JWT_SECRET'i monolit ile aynı yap
npm install
npm run migrate             # kendi DB'sine şemayı kurar
npm run dev                 # http://localhost:3002/v1
npm test                    # domain + use-case testleri (node:test)
```

Docker: kök `docker-compose.yml` içinde `construction-db` + `kafka` + `construction-service`.

## Entegrasyon (sonraki faz — ŞİMDİLİK BAĞLANMADI)

- Frontend `/v1/construction` çağrılarını bu servise (gateway/proxy) yönlendirmek.
- `users↔vendor` bağı + dış portal scope (PRD §6.3 / SF-8).
- Monolit tarafında Kafka tüketicileri (vendor/company senkron, hakediş → muhasebe).

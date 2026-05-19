# `legacy/` — Devre Dışı Kalan Eski Kod

> ⚠️ **Bu klasördeki kod artık aktif değil.** Yeni geliştirmeler `api-server/src/modules/` altına yapılır. Burası Strangler Fig migration sürecinde **referans** olarak tutulur — yeni TS implementasyonu tamamlanıp prod'a alındıktan sonra silinir.

## İçerik

### `backend/`

Eski Node.js cron + email servisi.

- `src/services/cronDaemon.js` — günlük 09:00'da çalışan 5 kontrol (görev vadesi, geciken faturalar, eski onaylar, vergi takvimi, çek/senet vadesi) + scheduled reports gönderimi.
- `src/services/emailService.js` — Nodemailer üzerinde SMTP transporter (singleton, pool, rate-limit).
- `docs/` — eski API kontratları: `EMAIL_NOTIFICATIONS_API.md`, `PUSH_NOTIFICATIONS_API.md`, `ML_SERVICE_API.md`.

**Neden devre dışı:**

1. `package.json` yoktu → docker-compose içinde `npm install` boş dizinde çalışıyordu (sessiz hata).
2. CommonJS (`require()`) kullanıyordu, api-server ESM (`import`). Tutarsız iki dünya.
3. Çağırdığı `db.getTasks()`, `db.getInvoices()` gibi API'ler hiçbir yerde tanımlı değildi — gerçekte çalışmıyordu.
4. `node-cron` + `nodemailer` zaten `api-server/package.json` içinde bağımlılık olarak var. Mükerrer.

**Yeni evi:** `api-server/src/modules/notifications/` (TypeScript strict, DI ile inject edilebilir, gerçek PostgreSQL).

**Migration durumu:** ⏳ Planda — `docs/MIGRATION_ROADMAP.md` içinden takip edilecek.

---

## Bu klasör nasıl temizlenir?

1. Yeni implementasyon `api-server/src/modules/notifications/` altında tamamlandığında,
2. End-to-end testler geçtiğinde (cron'un gerçekten tetiklendiği + mail attığı kanıtlanınca),
3. En az 1 hafta production'da sorunsuz çalıştığında,

bu klasör tamamen silinir ve commit mesajı şöyle olur:

```
chore(legacy): remove deprecated backend/ — superseded by api-server notifications module
```

## Buradaki koda dokunma kuralı

- ❌ Yeni özellik eklenmez
- ❌ Bug fix yapılmaz (kullanılmıyor zaten)
- ✅ Sadece okunur — yeni modülü yazarken referans olarak bakılır

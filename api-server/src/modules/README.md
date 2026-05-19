# `api-server/src/modules/`

Frontend ile birebir hizalı domain bazlı modüller.

```
<module>/
├── presentation/      ← Hono route handler'ları
├── application/       ← use-case, command/query handler, DTO
├── domain/            ← entity, value object, domain service (saf TS)
├── infrastructure/    ← repository, HTTP/SMTP client, cron, file IO
├── __tests__/
└── index.ts           ← Public barrel: route'lar + DI binding'leri
```

Bağımlılık yönü: presentation → application → domain ← infrastructure.

Modüller arası iletişim sadece `<module>/index.ts` üzerinden. ESLint kuralı zorlar.

`app.ts` (DI composition root) modülleri toplar, interface'leri concrete implementasyonlara bağlar, Hono app'i kurar.

Detay: `docs/ARCHITECTURE.md` bölüm 4.

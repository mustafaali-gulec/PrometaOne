# `api-server/src/shared/`

Modüllerin paylaştığı cross-cutting concerns.

```
shared/
├── db/        ← Pg pool, transaction helper, base repository
├── http/      ← Hono middleware (auth, audit, error handler, rate-limit)
├── logging/   ← Pino logger + child logger factory
├── config/    ← env validation (zod schema), config object
└── errors/    ← AppError, DomainError, ValidationError sınıfları
```

Kural: `shared/` modüllerden hiçbir şey import etmez. Tek yönlü: modüller `shared/`'tan import eder.

Bir kod sadece tek bir modülde kullanılıyorsa o modülün içine koy; sonra başka modül de ihtiyaç duyduğunda shared'a taşı.

# `frontend/src/modules/`

Feature/domain bazlı modüller. Her modül kendi içinde 4 katmana ayrılır:

```
<module>/
├── presentation/      ← React component, page, UI hook
├── application/       ← use-case, DTO mapping
├── domain/            ← saf TS, entity, value object, domain service
├── infrastructure/    ← API client, adapter
├── __tests__/
└── index.ts           ← Public barrel (dış dünyaya sadece bu açılır)
```

Bağımlılık yönü tek yönlü: presentation → application → domain ← infrastructure. ESLint kuralı zorlar.

Modüller arası iletişim sadece `<module>/index.ts` üzerinden. Başka modülün internal'ına erişmek yasak.

Detay: `docs/ARCHITECTURE.md` bölüm 3.

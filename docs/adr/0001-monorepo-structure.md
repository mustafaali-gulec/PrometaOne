# 0001 — Tek Repo Polyglot Monorepo Olarak Devam

- **Status:** Accepted
- **Date:** 2026-05-19
- **Deciders:** Mustafa

## Context

Prometa One şu an üç ayrı kod tabanı içeriyor ama aynı git deposunda yaşıyorlar:

- `frontend/` — React + Vite (JavaScript şu an, TypeScript'e geçilecek)
- `api-server/` — Hono + TypeScript + PostgreSQL
- `ml-service/` — Python + FastAPI + scikit-learn

Ayrıca `legacy/backend/` (CommonJS Node, devre dışı). Servisler arası paylaşılması gereken bilgiler var (özellikle API tipleri, domain modelleri). Şu an paylaşılmıyor — frontend kendi içinde tipsiz, api-server kendi içinde gevşek tipli, ml-service Pydantic ile ayrı bir dünya.

Seçenekler:

1. **Mevcut yapıyı sürdür** (her servis kendi `package.json`'ı, paylaşılan kod yok)
2. **npm/pnpm workspaces ile gerçek monorepo** (paylaşılan `shared/` paketi, tek `package.json` kök)
3. **Polyrepo'ya ayır** (her servis ayrı repo, npm package olarak paylaş)
4. **Nx / Turborepo gibi monorepo aracı** (cache + dependency graph)

## Decision

**Seçenek 2** — npm workspaces tabanlı polyglot monorepo. Kök seviyede `package.json` `workspaces` listesi: `frontend`, `api-server`, ve ileride `packages/contracts/` (paylaşılan tipler). `ml-service/` Python olduğu için workspace dışında, ama aynı repoda.

Karar Phase 0'da uygulamaya konmaz — sadece **bu yön doğru yön olarak kabul edilir**. Workspace setup'ı Phase 1'in parçası olur.

## Rationale

- **Tek dev (Mustafa)** — polyrepo yönetim yükü gereksiz overhead getirir.
- **Backend ↔ frontend tip paylaşımı** kritik. Aynı `Invoice`, `BudgetCell`, `User` tipleri iki tarafta da kullanılıyor. Tek repoda paylaşılan paket olarak yaşar.
- **Atomic commit** — bir özellik backend+frontend değişikliği gerektirdiğinde tek PR'da gönderilir.
- **Nx/Turbo şu an overkill.** Tek dev için CI build cache faydası küçük; bunu sonra (Faz N+) eklemek mümkün.
- **ml-service'i fiziksel olarak ayrı tutmak (Python)** workspaces'ı bozmaz — npm onu görmez.

## Consequences

### Positive
- Paylaşılan kontratlar tek yerde yaşar (tip güvenliği frontend ↔ backend).
- Atomic PR'lar.
- Tek `node_modules` (hoisting ile) — disk + install süresi kazanımı.
- Tek `lint` + `format` komutu kök seviyeden çalışır.

### Negative
- npm workspaces'ın "phantom dependency" problemi: bir paket başkasının dependency'sini import edebilir. ESLint kuralı ile yakalanmalı.
- `package-lock.json` çakışmaları olabilir (tek bir tane var artık, kök seviyede).
- Türkiye'deki bazı kütüphane sürümleri (TCMB SOAP istemcileri vs.) workspaces ile ilk başta sorun çıkarabilir.

### Neutral
- Kök `package.json` yeni bir dosya olarak eklenmesi gerekir.
- Mevcut `frontend/package.json` ve `api-server/package.json` korunur.

## Alternatives Considered

### Seçenek 1 — Mevcut yapıyı sürdür
Her servis kendi `package.json` ile yaşar, paylaşılan kod yok. **Sebep:** Tip güvenliği imkansız — frontend `Invoice` tipi ile backend'in `Invoice` tipi senkron tutulamaz. Her API değişikliğinde el yordamıyla iki taraf düzeltilir. Bu zaten bizi bugünkü çoğu hataya getiren şey.

### Seçenek 3 — Polyrepo
Her servis ayrı git deposu, npm registry üzerinden paylaşım. **Sebep:** Tek dev için aşırı yönetim. npm publish döngüsü, sürüm uyumsuzluğu, CI çoklama. Ölçek bunu gerektirmiyor.

### Seçenek 4 — Nx / Turborepo
Mükemmel araçlar ama **şu an problem değil.** Build süresi sorun değil (tek dev, küçük CI), affected-only test sorun değil. Sonra eklenebilir (additive). Bunu erkenden seçmek, basit `npm workspaces` ile yapılabilecek şeyi karmaşıklaştırır.

## References

- npm workspaces: <https://docs.npmjs.com/cli/v10/using-npm/workspaces>
- Monorepo trade-offs: <https://monorepo.tools/>
- Eski "phantom dependency" tartışması: <https://rushjs.io/pages/advanced/phantom_deps/>

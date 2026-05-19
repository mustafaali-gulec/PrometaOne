# Prometa One — Geliştirme Kılavuzu

Bu doküman projeye katkı (kendinden kendine bile) verirken uyulacak kuralları açıklar.

> Mimari hedef için `docs/ARCHITECTURE.md`'ya, kararların gerekçeleri için `docs/adr/`'ya bak.

---

## 1. İlk Kurulum

```bash
# Node.js 20+ ve npm 10+ gerekli
node -v   # >= 20
npm -v    # >= 10

# Bağımlılıklar (workspaces sayesinde tüm projeler için tek install)
npm install

# Husky hook'larını aktif et (npm install zaten "prepare": "husky" çalıştırır)
npx husky

# Ortam değişkenleri
cp api-server/.env.example api-server/.env
# Düzenle: DATABASE_URL, JWT_SECRET, SMTP_*, ANTHROPIC_API_KEY

# Veritabanı (PostgreSQL — Docker üzerinden)
cd api-server && docker-compose up -d postgres adminer
npm run migrate
npm run seed
```

## 2. Geliştirme Komutları

| Komut | Ne yapar |
|---|---|
| `npm run dev:frontend` | Frontend dev sunucu (port 5173) |
| `npm run dev:api` | api-server hot reload (port 3000) |
| `npm run lint` | Tüm projeyi ESLint ile tara |
| `npm run lint:fix` | Otomatik düzeltilebilir lint hatalarını gider |
| `npm run format` | Prettier ile tümünü formatla |
| `npm run format:check` | Format'a uygun mu kontrol et (CI için) |
| `npm run typecheck` | Tüm workspace'lerde TS strict tip kontrolü |
| `npm run typecheck:frontend` | Sadece frontend |
| `npm run typecheck:api` | Sadece api-server |
| `npm run test` | Tüm workspace'lerde testler |
| `npm run build` | Tüm workspace'lerde production build |

## 3. Git Workflow

### 3.1 Branch İsimlendirme

```
<type>/<short-description>
```

- `feat/notifications-bell-filter`
- `fix/jwt-exp-utc`
- `refactor/strangle-invoice-list`
- `docs/adr-0004-di-tooling`
- `chore/bump-typescript-5.6.3`

### 3.2 Commit Mesajları — Conventional Commits

Format:

```
<type>(<scope>)?: <subject>

[isteğe bağlı body]

[isteğe bağlı footer — BREAKING CHANGE: …, Refs: #123]
```

**Tipler:**

| Tip | Ne için |
|---|---|
| `feat` | Yeni özellik |
| `fix` | Bug fix |
| `refactor` | Davranışı değiştirmeyen düzenleme |
| `perf` | Performans iyileştirmesi |
| `style` | Sadece format/whitespace |
| `test` | Test ekleme/düzeltme |
| `docs` | Dokümantasyon |
| `build` | Build sistem / bağımlılıklar |
| `ci` | CI config |
| `chore` | Bakım |
| `revert` | Commit geri alma |

**Scope** kebab-case ve modül/dizin adıyla eşleşmeli:

- `modules/notifications`
- `api-server/auth`
- `frontend/shared`
- `legacy`
- `tooling`
- `adr`

**Örnekler:**

```
feat(modules/notifications): bell dropdown çalışan kişiye filtreliyor
fix(api-server/auth): JWT exp tarihi UTC'de değildi

Token UTC ofsetiyle üretiliyordu, Europe/Istanbul'da 3 saat erken
expire oluyordu. exp = Math.floor(Date.now() / 1000) + ttlSeconds.

Refs: #42
```

`commitlint` hook'u kuralları otomatik kontrol eder — commit reddedilirse mesajı düzelt.

### 3.3 Pre-commit Hook

`.husky/pre-commit` her commit'te staged dosyalara `lint-staged` çalıştırır:

- `*.{ts,tsx}` → ESLint --fix + Prettier --write
- `*.{js,jsx}` → ESLint --fix + Prettier --write
- `*.{css,html,md,json,yml}` → Prettier --write

Bir dosya format/lint hatası verirse commit durur. Düzelt, tekrar `git add`, tekrar commit.

### 3.4 Commit-msg Hook

`.husky/commit-msg` `commitlint`'i çağırır. Mesaj Conventional Commits formatında değilse commit reddedilir.

### 3.5 PR Şablonu

`.github/pull_request_template.md` otomatik açılır. Doldurmadan PR açma.

---

## 4. Kod Standardı

### 4.1 TypeScript

- **Her yerde strict mode** (ADR-0002). `any` kullanımı son çare; ESLint warn verir.
- **`unknown`** üzerinden zorla narrow: `catch (e: unknown)` zorunlu.
- **`type` vs `interface`**: Public API kontratları için `interface`, internal union/tuple için `type`.
- **Import order**: `eslint-plugin-import` otomatik düzenler — manuel uğraşma.
- **Path aliases**: Relative path `../../../` görüyorsan `@modules/` veya `@shared/` kullan.

### 4.2 React

- Function component + hooks. Class component yasak.
- Side-effect yöneticisi: `useEffect`, custom hook'lar. Doğrudan render içinde async iş yok.
- State management: Provider + Context (basit), TanStack Query (server state), Zustand (UI client state). Karar henüz ADR'lenmedi (TODO 0004).

### 4.3 Klasör Düzeni

Yeni özellik eklerken ARCHITECTURE.md'deki katmanlı yapıya uy:

```
modules/<feature>/
├── presentation/      ← React component'ları, route handler
├── application/       ← use-case'ler, DTO mapping
├── domain/            ← saf TS, framework yok
├── infrastructure/    ← DB/HTTP/SMTP wrapper'ları
├── __tests__/
└── index.ts           ← Public barrel
```

### 4.4 Bağımlılık Kuralı

- `domain/` → hiçbir şey
- `application/` → sadece `domain/`
- `infrastructure/` → `domain/` + `application/`'ın interface'leri
- `presentation/` → `application/`

Diğer modüllerin internal'ına dokunma; sadece `index.ts` ile konuş.

---

## 5. Strangler Fig Migration Süreci

Eski koddan parça çıkarma sırası:

1. **Hedef belirle** — `docs/MIGRATION_ROADMAP.md`'den bir item al
2. **Yeni modülü yaz** — `modules/<X>/` altında SOLID katmanlı yapıyla
3. **Test yaz** — domain + application minimum
4. **Adapter koy** — `App.jsx` içinde eski kodu yeni component ile değiştir
5. **Eski kodu sil** — adapter çalışıyorsa `App.jsx`'ten temizle
6. **Commit + PR** — `refactor(legacy): strangle X` kalıbında

Detay: `docs/adr/0003-strangler-fig-migration.md`.

---

## 6. ADR Yazma

Mimari etki yapan bir değişiklik yapacaksan önce ADR yaz:

```bash
# docs/adr/TEMPLATE.md'yi kopyala
cp docs/adr/TEMPLATE.md docs/adr/0004-baslik.md
# Doldur, PR'a hem ADR hem kod değişikliğini birlikte koy
```

Numara sıralı: bir sonraki müsait numara `ls docs/adr/ | grep -E '^[0-9]'` ile bulunur.

---

## 7. Test Yazma Kuralı

- **`domain/`**: %95+ coverage, saf unit test (Vitest)
- **`application/`**: %85+ coverage, infrastructure mock'lı
- **`infrastructure/`**: integration test (testcontainers ile gerçek PostgreSQL)
- **`presentation/` frontend**: Vitest + Testing Library
- **End-to-end**: Playwright (selected critical flows)

Test dosyaları `__tests__/` altında, `*.test.ts` ile biter.

---

## 8. Sorun Çıkarsa

1. `git log` ile son commit'i bul
2. `git diff HEAD~1 HEAD` ile değişikliği gözden geçir
3. Geri alma: `git revert <hash>` (history korunur) veya `git reset --soft HEAD~1` (sadece local)
4. Bir mimari sorun varsa: yeni ADR yaz, eski ADR'yi `Superseded by` ile işaretle

---

## 9. Yapılmayacaklar

- ❌ Eski `App.jsx`'e yeni özellik eklemek (Strangler Fig — yeni iş modüler)
- ❌ `legacy/` altında değişiklik yapmak (sadece silme / dokümantasyon)
- ❌ TypeScript strict'i bir dosya için kapatmak (`@ts-nocheck` yasak; modül exclude için ADR yaz)
- ❌ `console.log` production kodda (ESLint warn verir; `Logger` kullan)
- ❌ Hardcoded secret (env'den oku, `.env.example` güncelle)
- ❌ Doğrudan SQL string concat (parametrize sorgu zorunlu)

<!--
  Prometa One — PR Şablonu

  PR başlığını Conventional Commits formatında yaz:
    <type>(<scope>): <subject>

  Örnekler:
    feat(modules/notifications): bell dropdown çalışan kişiye filtreliyor
    fix(api-server/auth): JWT exp tarihi UTC'de değildi
    refactor(legacy): strangle invoice list out of App.jsx
-->

## Ne yapıyor?

<!-- Bir cümlede özet. -->

## Neden?

<!-- Hangi problemi çözüyor? Hangi user story / ADR / issue? -->

## Tip

- [ ] `feat` — Yeni özellik
- [ ] `fix` — Bug fix
- [ ] `refactor` — Davranış değişmiyor, kod düzeniyor
- [ ] `perf` — Performans
- [ ] `test` — Test ekleme/düzeltme
- [ ] `docs` — Dokümantasyon
- [ ] `build` — Build / bağımlılıklar
- [ ] `ci` — CI config
- [ ] `chore` — Bakım
- [ ] `style` — Sadece format

## Etki Alanı

<!-- Hangi modüller etkilendi? -->

- [ ] `frontend/src/modules/...`
- [ ] `api-server/src/modules/...`
- [ ] `ml-service/`
- [ ] `legacy/` (sadece silme/taşıma kabul)
- [ ] Shared tooling / config
- [ ] Docs / ADR

## Strangler Fig Kontrol Listesi (eski koddan parça çıkarıyorsan)

- [ ] Yeni modül `presentation/`, `application/`, `domain/`, `infrastructure/` katmanlarına ayrılmış
- [ ] `App.jsx`'ten ilgili kod silindi VEYA adapter ile yeni component'e bağlandı
- [ ] Yeni modüle test eklendi (en az domain + 1 use-case)
- [ ] Strict TypeScript geçiyor (`npm run typecheck`)
- [ ] ESLint temiz (`npm run lint`)

## Test

- [ ] Unit testler güncellendi/eklendi
- [ ] Manuel olarak test edildim:
  <!-- Hangi senaryolar denendi? -->

## Risk

<!-- Geri alma planı? Migration'sız çalışır mı? Veri taşıma var mı? -->

- [ ] Geri alınabilir (revert güvenli)
- [ ] Migration gerekli (varsa nasıl?)
- [ ] Feature flag ile kapatılabilir

## ADR Gerekli mi?

- [ ] Hayır — küçük değişiklik
- [ ] Evet — `docs/adr/NNNN-baslik.md` eklendi

## Ekran Görüntüleri / Notlar

<!-- UI değişikliği varsa before/after. -->

# Sürümleme ve yayın (release) politikası

Karar tarihi: 2026-08-06. Geçerli olduğu ürün: **M Suite** (repo: `prometa-one`).

## 1. Tek ürün sürümü

Ürünün **tek** sürüm numarası vardır. Kaynak-of-truth kök [`package.json`](../package.json);
aşağıdaki manifest'ler her yayında aynı numaraya çekilir:

| Manifest                            | Rolü                                                              |
| ----------------------------------- | ----------------------------------------------------------------- |
| `package.json` (kök)                | Kaynak-of-truth. Tag ve GitHub Release bu numarayı doğrular.      |
| `frontend/package.json`             | UI'daki sürüm rozetini besler (Vite `__APP_VERSION__` define'ı).  |
| `api-server/package.json`           | Monolit API                                                       |
| `construction-service/package.json` | Bağımsız şantiye mikroservisi — ürünle **aynı** hatta sürümlenir. |

Ayrı bir tag hattı yoktur; `construction-service` bağımsız dağıtılsa da ürün sürümünü taşır.

## 2. Ne zaman sürüm kesilir

Sürüm **master'a her merge'de değil**, yayın kesildiğinde artar. Master'a push otomatik
deploy eder ([`deploy.yml`](../.github/workflows/deploy.yml)) ama sürümü değiştirmez.

Sürüm kesme anları:

- Müşteriye on-prem paket hazırlanacakken (`tools/package-release.ps1` öncesi),
- Dışarıya duyurulacak anlamlı bir özellik kümesi tamamlandığında,
- Bilinen-iyi bir noktaya dönebilmek için sabitleme gerektiğinde.

> **Not.** "Şu an canlıda hangi kod var?" sorusunun cevabı sürüm numarası **değildir** —
> iki yayın arasında master defalarca deploy olur. O sorunun cevabı commit SHA'sıdır.

## 3. Bump kuralı (SemVer, Conventional Commits'ten türetilir)

Repoda commitlint zorunlu ([`commitlint.config.cjs`](../commitlint.config.cjs)), bu yüzden
bump elle tartışılmaz; son `v*` tag'inden beri gelen commit'lerden hesaplanır:

| Commit                                          | Bump                      |
| ----------------------------------------------- | ------------------------- |
| Gövdede `BREAKING CHANGE:` veya `type!:`        | **major** (2.1.0 → 3.0.0) |
| `feat`                                          | **minor** (2.0.0 → 2.1.0) |
| `fix`, `perf`                                   | **patch** (2.0.0 → 2.0.1) |
| Yalnızca `docs`, `chore`, `ci`, `test`, `style` | patch                     |

Hesap bir **öneridir**; `--major` / `--minor` / `--patch` / `--set X.Y.Z` ile ezilebilir.

MAJOR'ı ölçülü kullanın: API'yi üçüncü taraf tüketmediği sürece MAJOR teknik bir sözleşme
değil, müşteriye "bu büyük bir değişiklik" mesajıdır.

## 4. Yayın akışı

```bash
node tools/release.mjs
```

Kuru çalışma: son tag'den beri gelen commit'leri sınıflar, önerilen sürümü ve yazacağı
CHANGELOG bölümünü basar. **Hiçbir dosyaya dokunmaz.**

```bash
node tools/release.mjs --yes --push
```

Uygular: 4 manifest'i yeni sürüme çeker, CHANGELOG'a bölümü ekler, `chore(release): vX.Y.Z`
commit'i ve **annotated** `vX.Y.Z` tag'i atar, origin'e push eder.

Ön koşullar (script zorlar): master'dasınız, çalışma ağacı temiz, tag henüz yok.

Tag origin'e ulaşınca [`release.yml`](../.github/workflows/release.yml) GitHub Release'i
CHANGELOG bölümünü gövde yaparak açar. Tag ile kök `package.json` uyuşmazsa iş akışı
başarısız olur — sürümün her yerde aynı kalmasının garantisi budur.

## 5. CHANGELOG

[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) formatı. Yeni bölüm
`## [Unreleased]` başlığının hemen altına eklenir; `Unreleased` başlığı kalıcıdır ve bir
sonraki yayına kadar elle not düşmek için kullanılabilir.

## 6. Geçmiş

- `v2.0.0` — 2026-08-06 baseline. Bu tag'den önce sürüm tag'i yoktu; kök `package.json`
  `0.0.0`, frontend/api-server `2.0.0`, construction-service `1.0.0` ile tutarsızdı. Baseline
  hepsini `2.0.0`'a hizaladı.

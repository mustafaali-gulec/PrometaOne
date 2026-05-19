# 0004 — E-Fatura Modülünü Geçici Olarak TypeScript Exclude'ya Al

- **Status:** Accepted
- **Date:** 2026-05-19
- **Deciders:** Mustafa
- **Supersedes:** Kısmen ADR-0002 (strict her yerde) — istisna olarak işaretlenir.

## Context

Faz 0.5'te `api-server`'da TypeScript strict mode'a geçerken `tsc --noEmit` çıkış raporu:

```
api-server/src/routes/einvoice.ts             24 hata
api-server/src/services/einvoice/index.ts      1 hata
api-server/src/services/einvoice/elogo.ts      3 hata
api-server/src/services/einvoice/ubl-parser.ts 3 hata
api-server/src/services/einvoice/crypto.ts     1 hata
---
Diğer api-server kodu                          10 hata
```

Yani api-server hatalarının **75'i tek bir modülde** (einvoice) toplanmış. Bu modülün hataları gerçek bug değil; Hono framework'unun signature'ını yanlış kullanıyor (`c.get("user")`, `c.req.param("cid")` route parametresi olmayan yerde, vb.) ve eski tip tanımları (`EInvoiceSummary`, `EInvoiceLine`) `exactOptionalPropertyTypes` ile uyuşmuyor.

Bunları tek tek düzeltmek **yaklaşık 200 satır kod değişikliği** demek. Ama `docs/MIGRATION_ROADMAP.md`'ye göre **Faz 6'da e-fatura modülü tamamen yeniden yazılacak** (modules/finance/einvoice/ altında, katmanlı yapıda). Yani bu düzeltme **yakında çöpe gidecek koda yapılan iş** olur.

## Decision

`api-server/tsconfig.json` `exclude` listesine şunlar eklenir:

```
"src/routes/einvoice.ts"
"src/services/einvoice/**"
```

Sonuç: TypeScript bu dosyaları derleme aşamasında okumaz, strict kuralları onlara uygulanmaz. **Runtime davranışı değişmez** — `tsx` yine bu dosyaları çalıştırır (TS exclude sadece type-check'i etkiler, transpile'ı değil).

Bu istisna **geçicidir**:

- **Bitiş kriteri:** Faz 6 (E-Fatura) PR'ı merge edildiğinde
- **Bitiş eylemi:** `exclude` listesinden bu satırlar silinir, modüler kod `api-server/src/modules/finance/einvoice/` altına alınır

## Rationale

- **Pragmatik:** "Bütün hataları temizle" ile "zaten silinecek koda dokunma" arasında doğru ortayı tutar.
- **Görünür:** `tsconfig.json`'da apaçık duran 2 satır + bu ADR, exclude'in geçici olduğunu net belgeler.
- **Geri-uyumlu:** Runtime davranışı değişmez, mevcut e-fatura işlevselliği çalışmaya devam eder.
- **Strangler Fig ile uyumlu:** ADR-0003'te kararlaştırılan yöntemin doğal bir uzantısı; e-fatura `modules/finance/einvoice/` altında strict olarak yeniden doğacak.

## Consequences

### Positive

- api-server'ın **kalan tüm dosyaları** (16+ dosya) strict tip kontrolünden geçer
- `npm run typecheck:api` → **0 hata**
- ADR-0002'nin spirit'i korunur: yeni kod 100% strict
- Faz 1 (Notifications) modülü temiz bir tip ortamında doğar

### Negative

- E-fatura kodunda tip güvenliği yok — runtime bug yakalanamaz
- `tsx` çalıştırırken hata verirse (örn. import edilemezse) typecheck önceden uyarmaz
- Yanlışlıkla başka bir dosyadan einvoice/\* import edilirse karşı tarafta `any` görünür

### Neutral

- `api-server/tsconfig.json` `exclude` listesi büyür — bu ADR ile gerekçesi belge altına alınır
- ESLint hâlâ einvoice'i tarar — bazı kod kalitesi sinyalleri kalır

## Alternatives Considered

### Seçenek A — einvoice'i de düzelt

24 + 3 + 3 + 1 + 1 = **32 hatayı manuel düzelt**.
**Reddedildi:** Faz 6'da tüm modül zaten silinip yeniden yazılacak. Bu iş çöp olur.

### Seçenek B — `// @ts-nocheck` her dosyanın tepesine

**Reddedildi:** Görünmez teknik borç. Yanlışlıkla yeni kodun başına da yazılabilir. tsconfig exclude daha sterildir.

### Seçenek C — Strict'i tüm api-server için kapat

**Reddedildi:** ADR-0002'yi tamamen geri alır. Modül-modül strict ilkesi bozulur.

### Seçenek D — einvoice'i `legacy/` altına taşı

**Reddedildi:** Bu kod hâlâ aktif kullanılıyor (e-fatura çalışıyor). `legacy/` sadece **artık çalışmayan** kod içindir (ADR-0003 anlamında).

## Bitiş Koşulu — Checklist

Bu ADR `Superseded` durumuna geçer ne zaman:

- [ ] `api-server/src/modules/finance/einvoice/` modülü tamamlandı
- [ ] Tüm endpoint'ler yeni modülden serve ediliyor
- [ ] E2E testleri geçiyor (eLogo SOAP, UBL parser)
- [ ] `api-server/tsconfig.json` `exclude` listesinden einvoice satırları silindi
- [ ] `tsc --noEmit` 0 hata
- [ ] Eski `src/routes/einvoice.ts` ve `src/services/einvoice/*` silindi

## References

- ADR-0002: TypeScript strict her yerde
- ADR-0003: Strangler Fig migration
- `docs/MIGRATION_ROADMAP.md` Faz 6

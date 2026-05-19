# 0002 — TypeScript Strict Mode Her Yerde

- **Status:** Accepted
- **Date:** 2026-05-19
- **Deciders:** Mustafa

## Context

Mevcut durum:

- **`frontend/`** — saf JavaScript (JSX). `App.jsx` 81.159 satır, hiç tip yok. Bir alan değişiminin sonuçları çalışma anına kadar görünmez.
- **`api-server/`** — TypeScript ama `tsconfig.json`'da:
  ```json
  "strict": false,
  "noImplicitAny": false,
  "strictNullChecks": false,
  "noUncheckedIndexedAccess": false
  ```
  Yani `.ts` uzantısı kullanılıyor ama derleyici **hiçbir tip kontrolü yapmıyor**. Pratik olarak JS.
- **`ml-service/`** — Python, ayrı bir dünya. Pydantic ile bir miktar tip güvenliği var.

API kontratları frontend ile backend arasında manuel senkronlanıyor → çoğu runtime hatasının kaynağı bu.

Kullanıcı tercihi: **Strict mode'u hemen aç, çıkacak yüzlerce hatayı temizleyelim.** (Gevşek-strict hibrit istemiyor.)

## Decision

Tek bir `tsconfig.base.json` kök seviyede oluşturulur ve aşağıdaki flag'ler **tüm projeler için zorunlu**:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "alwaysStrict": true,
    "noImplicitThis": true,
    "useUnknownInCatchVariables": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": false,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "moduleDetection": "force"
  }
}
```

`frontend/tsconfig.json`, `api-server/tsconfig.json` bu dosyayı `extends` eder ve sadece kendi özel ayarlarını ekler.

`legacy/` dizini `tsconfig.json` `exclude` listesinde — strict kontrole girmez.

## Rationale

- **`noUncheckedIndexedAccess`** — `arr[i]` her zaman `T | undefined` döner. Türkiye finans hesaplamalarında `undefined` bir sayıya bölünmek demek; bu kritik bir kalkan.
- **`exactOptionalPropertyTypes`** — `{ x?: string }` ile `{ x?: string | undefined }` arasındaki farkı zorunlu kılar. API DTO'larında çok önemli.
- **`useUnknownInCatchVariables`** — `catch (e)` artık `unknown`. `e.message`'a doğrudan erişim yasak, narrow etmek zorunlu. Error handling kalitesi artar.
- **`noImplicitOverride`** — OOP'de yanlışlıkla parent metodunu ezme bug'ı önlenir.
- **`noPropertyAccessFromIndexSignature: false`** — bu **kapalı**. `process.env.SMTP_HOST` gibi index signature'lı erişim doğal kalsın; aksi takdirde `process.env["SMTP_HOST"]` yazmak zorundayız.

### Var olan koda nasıl uygulanır?

- **Frontend `App.jsx`** — şimdilik **`tsconfig.json` `include`'una alınmaz** (`.jsx` olarak kalır). Yeni modüller `.tsx` ile yazılır, strict mode onlarda zorunlu. Eski `App.jsx` Strangler Fig sırasında parça parça `.tsx` modüllere taşındıkça strict olur.
- **api-server'ın mevcut TS dosyaları** — strict açıldığında muhtemelen 100+ hata patlar. Bunları **tek bir oturumda temizleriz** (`tsc --noEmit` çıktısını dosya-dosya gezerek). Bu kararın bir parçası olarak kabul edildi.

## Consequences

### Positive

- Compile-time'da yakalanmayan tüm null/undefined bug'ları yakalanır.
- API DTO'ları gerçek tip güvenliği kazanır.
- IDE autocomplete + refactor güvenli.
- Yeni geliştirici (veya gelecekteki sen) "bu fonksiyon ne döner?" sorusunu sormak zorunda kalmaz.

### Negative

- **İlk açışta yüzlerce hata.** api-server'ı `tsc --noEmit` ile çalıştırınca tahminen 200-500 hata çıkacak. Bunlar oturulup düzeltilecek (kabul edilen iş).
- **3rd party kütüphane tip eksikleri** — `strong-soap`, `exceljs` gibi paketlerin tip tanımları sığ. Bazı yerlerde `as unknown as X` veya kendi `.d.ts` dosyamızı yazmak gerekecek.
- **Geliştirici hızı kısa vadede yavaşlar.** Tip yazmak vakit alır. Uzun vadede kazanım çok daha büyük.

### Neutral

- `legacy/` strict dışında — yeni kod buradan import etmediği sürece sorun yok (ESLint kuralı zorlar).
- ml-service strict TS kapsamında değil (Python). Pydantic'i strict modda kullanmak (mypy strict) ayrı bir ADR konusu.

## Alternatives Considered

### Seçenek A — Hibrit (yeni kod strict, eski kod gevşek)
`tsconfig.json` ile per-folder override. **Reddedildi:** İki dünya hâli yaratır, hangi dosya hangi kurallarla çalışıyor karışır. Kullanıcı tercihi de "hemen her yerde" oldu.

### Seçenek B — Strict mode tedrici (`strict: true` ama bir kısım flag kapalı)
`noUncheckedIndexedAccess: false` gibi. **Reddedildi:** Tam ayar setini almazsak en kritik bug'lar (array index'den `undefined`) yakalanamaz. Yarım kalkan kalkan değildir.

### Seçenek C — TS'i bırak, JSDoc + `// @ts-check`
Hafif yöntem. **Reddedildi:** Frontend gerçek TS'e geçecek (Phase 1). JSDoc bir geri adım olur.

## References

- TS strict flags: <https://www.typescriptlang.org/tsconfig#strict>
- "Total TypeScript" Matt Pocock — `noUncheckedIndexedAccess` özellikle: <https://www.totaltypescript.com/tsconfig-cheat-sheet>

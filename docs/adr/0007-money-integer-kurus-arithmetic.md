# 0007 — Money value object: integer-kuruş aritmetiği

- **Status:** Accepted
- **Date:** 2026-06-01
- **Deciders:** Mustafa Gülec
- **Technical Story / Issue:** Faz 5 (Finance — Bütçe & Kasa) — `docs/MIGRATION_ROADMAP.md`

## Context

Faz 5'te finance modülü (bütçe matrisi, kasa/banka, transfer, fatura/ödeme, commit-to-cells) para ile yoğun çalışıyor. Para hesabını JavaScript `number` (IEEE-754 double) ile yapmak finansal yazılımda kabul edilemez hatalara yol açar:

```js
0.1 + 0.2; // 0.30000000000000004
1000.5 * 3; // 3001.4999999999995
19.99 + 19.99 + 19.99; // 59.96999999999999
```

Finance domain'inde bu hatalar birikir: bütçe satır toplamı, KDV hesabı (`subtotal * rate`), fatura kalan tutarı (`total − paidAmount`), allocate/dağıtım (bir tutarı n parçaya bölme) gibi işlemler kuruş bazında **kesin** olmalı. Ayrıca:

- DB tarafı `NUMERIC(20,2)` kullanıyor (003/004/005 migration'ları) — kesin ondalık. Uygulama katmanı bununla **tam uyumlu** olmalı; round-trip'te kayıp olmamalı.
- Çoklu para birimi (TRY/USD/EUR) var; iki farklı para biriminin toplanması bir **programlama hatasıdır** ve sessizce yanlış sonuç değil, açık bir hata vermelidir.
- Frontend de aynı tutarları gösteriyor; serializasyon formatı belirsizlik içermemeli.

Klasik üç seçenek: (a) ham `number`, (b) bir decimal kütüphanesi (decimal.js / big.js), (c) tam sayı "minor unit" (kuruş) aritmetiği kendi VO'muzda.

## Decision

`Money` value object'i **integer-kuruş** (minor unit) olarak modellendi:

1. **İç temsil tam sayı kuruştur.** `Money` içinde `minor: number` (TL için kuruş) + `currency: Currency` tutulur. `MINOR_PER_MAJOR = 100`. Hiçbir noktada kesirli `number` saklanmaz.

2. **Fabrikalar:** `fromMajor(12.5, 'TRY')` (→ 1250 kuruş, yarı-yukarı yuvarlama ile), `fromMinor(1250, 'TRY')`, `fromDecimalString('1250.50', 'TRY')` (DB `NUMERIC` string'inden birebir), `zero(currency)`.

3. **Aritmetik tam sayı üzerinde:** `plus/minus` doğrudan integer toplama/çıkarma; `multiply(factor, roundHalfUp)` çarpım sonrası açık yuvarlama; `allocate(weights)` kalansız dağıtım (kuruş artıkları deterministik dağıtılır); `negate/abs`. Karşılaştırma `compareTo/equals/isGreaterThan/isPositive/isZero` integer kıyas.

4. **Para birimi güvenliği:** İki farklı `currency` ile `plus/minus/compareTo` çağrılırsa `CurrencyMismatchError` fırlatılır — sessiz yanlış sonuç yok.

5. **Serializasyon:** `toDecimalString()` daima 2 ondalıklı string (`'1250.50'`) — DB `NUMERIC(20,2)` ve REST JSON sözleşmesi bununla birebir. `toJSON()` aynı string'i verir. DB ↔ domain ↔ REST ↔ frontend round-trip kayıpsız.

## Rationale

- **Kesinlik.** Tam sayı aritmetiğinde float yuvarlama hatası yapısal olarak imkânsız. `0.1 + 0.2` problemi domain'e hiç girmez.
- **DB ile birebir.** `NUMERIC(20,2)` ↔ `fromDecimalString`/`toDecimalString` round-trip kayıpsız; `to_char` ile gelen string doğrudan parse edilir, `parseFloat` ara adımı yok.
- **Bağımlılık yok.** decimal.js/big.js gibi bir kütüphane eklemeye gerek kalmadı; kuruş aritmetiği basit integer matematiği. Bundle ve supply-chain yüzeyi artmıyor.
- **Hata erken yakalanır.** `CurrencyMismatchError` çoklu-para hatalarını çalışma anında açıkça gösterir; toplama yanlış sonuç üretmez.
- **Test edilebilir.** Saf, immutable VO; yan etkisiz. KDV, allocate, kalan tutar gibi kenar durumları birim testlerle kapsandı (Faz 5 / PR 1).

## Consequences

### Positive

- Finance hesapları (bütçe toplamları, KDV, kalan, dağıtım) kuruş seviyesinde kesin.
- DB `NUMERIC` ↔ uygulama ↔ REST ↔ frontend round-trip kayıpsız ve belirsizliksiz (`'1250.50'`).
- Çoklu para birimi karışıklığı sessiz değil, `CurrencyMismatchError` ile patlar.
- Harici decimal kütüphanesi bağımlılığı yok.

### Negative

- `number` ile çalışan legacy finance kodu (App.jsx) ile sınırda dönüşüm gerekir: girişte `fromMajor`/`fromDecimalString`, çıkışta `toDecimalString`. Bu sınır use-case ve DTO katmanında net tutuldu.
- `MINOR_PER_MAJOR = 100` varsayımı (2 ondalık) tüm desteklenen para birimleri için geçerli (TRY/USD/EUR). Sıfır-ondalıklı (JPY) veya 3-ondalıklı (BHD, TND) para birimi eklenirse `Money` ondalık sayısını currency'den türetmeli — şu an kapsam dışı.
- `number`'ın güvenli tam sayı aralığı (`Number.MAX_SAFE_INTEGER ≈ 9e15`) kuruş cinsinden ~90 trilyon TL'ye karşılık gelir; pratikte yeterli ama teorik üst sınır var. `NUMERIC(20,2)` bundan büyük tutabilir; bu uçta `BigInt`'e geçiş gerekirdi (şu an kapsam dışı).

### Neutral

- Frontend (PR 7) para alanlarını decimal string olarak alıp **salt görüntüler**; istemci tarafı `Money` VO'su şimdilik yok. İleride istemcide aritmetik gerekirse aynı VO TS olarak paylaşılabilir.

## Alternatives Considered

### Seçenek A: Ham `number` (float)

- Reddedildi: IEEE-754 yuvarlama hataları finansal hesapta kabul edilemez; birikerek görünür tutarsızlık üretir.

### Seçenek B: decimal.js / big.js

- Reddedildi: Kesinlik sağlar ama runtime bağımlılığı + bundle yükü ekler. Para için 2-ondalık integer aritmetiği bu genelliğe ihtiyaç duymaz; basit ve hızlı integer matematiği yeterli.

### Seçenek C: String tabanlı ondalık (her işlemde parse/serialize)

- Reddedildi: Her aritmetikte string parse/serialize maliyetli ve hataya açık; karşılaştırma/dağıtım mantığı string üzerinde çirkin. Integer minor unit daha temiz ve hızlı.

## References

- `api-server/src/modules/finance/domain/valueObjects/Money.ts`
- `api-server/src/modules/finance/domain/valueObjects/Currency.ts`
- `api-server/src/modules/finance/domain/services/KdvCalculator.ts`
- `api-server/src/modules/finance/domain/errors/FinanceErrors.ts` (`CurrencyMismatchError`)
- `api-server/src/modules/finance/application/dto/*` (decimal string serializasyonu)
- ADR 0002 — TypeScript strict everywhere
- ADR 0003 — Strangler-fig migration

---

> **Migration notu:** Legacy App.jsx finance kodu `number` ile çalışıyordu. Faz 5 cutover'ında (PR 8) bütçe/kasa/fatura görünümleri yeni modüle (backend `/v1/finance`, Money tabanlı) bağlandı; tutarlar artık kuruş-kesin hesaplanıp `NUMERIC(20,2)` olarak saklanıyor.

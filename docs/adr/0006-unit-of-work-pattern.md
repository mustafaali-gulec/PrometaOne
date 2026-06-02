# 0006 — Unit of Work pattern (HR modülü, atomik cross-aggregate yazımlar)

- **Status:** Accepted
- **Date:** 2026-05-24
- **Deciders:** Mustafa Gülec
- **Technical Story / Issue:** Faz 4-bis (HR sertleştirme) — `docs/MIGRATION_ROADMAP.md`

## Context

Faz 4 HR Core'da `HireFromApplicationUseCase` cross-aggregate iki yazma yapıyor: önce `applications.update(hiredApp)` (stage `offer` → `hired`), sonra `employees.insert(...)`. PR 3 / PR 4'te bu, use-case içinde **manuel try/catch rollback** ile çözüldü:

```ts
await this.applications.update(hiredApp);
try {
  createdEmployee = await this.employees.insert(newEmpInput);
} catch (err) {
  await this.applications.update(application); // manuel rollback
  throw err;
}
```

Bu yaklaşım PG'de **gerçek atomik değil**:

- İki update arasında process crash olursa Application 'hired'da kalır, Employee oluşturulmaz.
- Connection pool farklı bağlantılar dağıtırsa iki yazma farklı session'larda olabilir; başkasının okuduğu ara state inconsistent.
- Rollback'in kendisi de fail edebilir (network blip) — telafi yolu yok.

Yapı düzeyinde de problem: tüm `Pg*Repository`'ler constructor'da `Pool` alıyor, dolayısıyla bir use-case'in iki repo çağrısının aynı bağlantıya (ve aynı `BEGIN`/`COMMIT`'e) düşmesinin yolu yok. Domain ve application katmanları, transaction'ı taşıyacak bir port yokken bunu zorlayamaz.

Faz 7+ payroll/attendance fazlarında benzer ihtiyaç çoğalacak (örn. çalışan terminate + son ay payroll satırı + leave bakiyesi takası). Çözümün HR modülüyle sınırlı kalmaması, ama HR'da ilk denenip stabilize edilmesi gerekiyor.

## Decision

1. **Yeni port:** `application/ports/UnitOfWork.ts` — `withTransaction<T>(fn: (repos: HrTransactionalRepositories) => Promise<T>): Promise<T>` imzasıyla. `fn` resolve ederse COMMIT, throw ederse ROLLBACK. `HrTransactionalRepositories` HR modülünün tüm 7 repo'sunu tek transaction context'inde sunar.

2. **Yeni port:** `infrastructure/persistence/Queryable.ts` — `pg.Pool` ve `pg.PoolClient`'in ortak `query` sözleşmesi. Tüm `Pg*Repository` constructor'ları artık `Queryable` alır. `Pool` ve `PoolClient` her ikisi de bu interface'i structural typing ile sağlar, dolayısıyla mevcut çağıranlar (`new PgEmployeeRepository(pool)`) hiçbir değişiklik yapmadan çalışır.

3. **PG implementasyonu:** `infrastructure/unitOfWork/PgUnitOfWork.ts` — `pool.connect()` ile tek bir `PoolClient` alır, `BEGIN` ile başlar, repository instance'larını client ile yeniden inşa ederek `fn`'e geçirir, sonra `COMMIT` veya `ROLLBACK`. `client.release()` finally bloğunda.

4. **In-memory taklit:** `__tests__/application/fakes.ts` içine `InMemoryUnitOfWork` eklendi. Her fake'in `__snapshot()` / `__restore()` helper'ı var (Map kopyası); `withTransaction(fn)` `fn` throw ederse snapshot'ı geri yükler. Production semantiği test'lerde de uygulanır.

5. **Use-case refactor:** `HireFromApplicationUseCase` artık `(uow, candidates, departments, empNoGen, clock, audit)` alır. Cross-aggregate yazımlar `uow.withTransaction` içine taşındı; manuel rollback kaldırıldı.

## Rationale

- **Port-based.** `UnitOfWork` port'u domain veya application katmanında transaction kavramını açıkça konuşmaya başlar. PG implementasyonu altyapı detayı kalır; testlerde fake ile yer değiştirir.
- **Minimum invasive.** `Queryable` portu sayesinde 7 Pg\* repo'da sadece constructor type değişimi yeterli. Mevcut DI çağrıları (`new PgEmployeeRepository(pool)`) olduğu gibi geçerli — pool zaten Queryable.
- **Atomik garanti gerçek.** PG'nin BEGIN/COMMIT/ROLLBACK semantiği kullanılır; process crash, network blip, concurrent yazıcı senaryolarında veritabanı seviyesinde tutarlılık garantili.
- **Test parite.** `InMemoryUnitOfWork` snapshot/restore ile production rollback semantiğini taklit eder; aynı use-case kodu hem fake hem PG ile aynı davranışı gösterir. PR 3'te de zaten "Employee fail ederse Application rollback" testi vardı — bu test InMemoryUoW ile yeşil kalır.
- **Genişletilebilirlik.** Faz 7+'da `RepairmentTerminateEmployeeUseCase` gibi cross-aggregate use-case'ler aynı UoW port'unu kullanır; HR modülünde stabilize edilen pattern her yere taşınabilir.

## Consequences

### Positive

- `HireFromApplication` artık gerçek atomik: PG ROLLBACK ile state tutarsızlığı imkânsız.
- Cross-aggregate yazımlar için tek bir kanonik yol var (port + impl); copy/paste manuel rollback'in yayılmasının önüne geçildi.
- Pg\* repo'lar artık hem pool hem PoolClient ile çalışır — başka modüllerin transaction içine girmesi (entegrasyon testleri dahil) trivial.
- `InMemoryUnitOfWork` snapshot/restore semantiği test'lere production parite sağlar; "fake'te atomik ama gerçekte değil" sürprizi olmaz.

### Negative

- Use-case constructor imzası değişti (`HireFromApplicationUseCase`): doğrudan instantiate eden çağıranların güncellenmesi gerekti (DI registration + test'ler).
- Snapshot/restore in-memory fake'lerin internal `store` Map'lerine bağımlı (`__snapshot`/`__restore` helper'ları). Entity'ler immutable olduğu sürece Map shallow copy güvenli; ama yeni mutable field eklenirse snapshot derinliği gözden geçirilmeli.
- `Queryable` portu `pg`'nin `Pool`/`PoolClient` sözleşmesine bağlı; başka bir veritabanı sürücüsüne geçildiğinde port yeniden tanımlanmalı (ama bu Faz hedefinde değil).

### Neutral

- HR dışı modüller (Auth, Finance) için ayrı UoW port'ları açılması gerekir — modül başına `HrTransactionalRepositories` muadili. Faz 7+'da Payroll için `PayrollTransactionalRepositories` eklenir; HR pattern'i refactor edilmez, sadece kopyalanır.

## Alternatives Considered

### Seçenek A: Repository'lere `withTransaction` metodu ekle (her birinde)

- Reddedildi: imza yayılır, cross-aggregate koordinasyon yine use-case'de manuel. Asıl problem (iki repo aynı transaction'da nasıl olur) çözülmez.

### Seçenek B: Application katmanına `pg.PoolClient` sızdır

- Reddedildi: domain/application'ın altyapıya bağımlılığı kırılır (hexagonal ihlali). Test'te fake `PoolClient` üretmek garip.

### Seçenek C: ORM transaction API (TypeORM/Prisma)

- Reddedildi: Bağımlılık olarak ORM eklemek Faz 4-bis kapsamı dışı. `pg`'nin native transaction'ı zaten yeterli; soyutlama eklemek değer katmaz.

## References

- `api-server/src/modules/hr/application/ports/UnitOfWork.ts`
- `api-server/src/modules/hr/infrastructure/unitOfWork/PgUnitOfWork.ts`
- `api-server/src/modules/hr/infrastructure/persistence/Queryable.ts`
- `api-server/src/modules/hr/application/useCases/HireFromApplicationUseCase.ts`
- `api-server/src/modules/hr/__tests__/application/fakes.ts` (`InMemoryUnitOfWork`)
- ADR 0003 — Strangler-fig migration
- ADR 0005 — `hr_manager` rolü ve Employee ↔ User opsiyonel bağlantısı

---

> **Migration notu:** `Pg*Repository` constructor type'ı `Pool` → `Queryable` oldu. Structural typing nedeniyle mevcut çağıranlar (`new PgFooRepository(pool)`) hiçbir değişiklik yapmadan çalışır. Sadece `HireFromApplicationUseCase` constructor'ını instantiate eden yerlerin güncellenmesi gerekti (`registerHrModule` + `ApplicationUseCases.test.ts`).

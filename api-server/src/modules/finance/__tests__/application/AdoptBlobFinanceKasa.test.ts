/**
 * AdoptBlobFinanceKasaUseCase birim testleri — blob normalizasyonu,
 * FinanceProjection kurallarıyla düşürmeler + sayaçlar (currency/tarih/tip/
 * tutar), idempotens, kasa referans çözümü (clientId → serverId; çağrı-içi +
 * DB-önceki), clientId dedupe, boş gövde.
 *
 * FakeAdoptFinanceKasaRepository, PgAdoptFinanceKasaRepository ile aynı
 * sözleşmeyi in-memory uygular: hesaplar (companyId, clientId), hareketler
 * (clientId) anahtarıyla upsert; kasaRef önce bu çağrının haritasından, sonra
 * "DB"deki mevcut hesaplardan, en son geçerli sayısal id'den çözülür;
 * çözülemeyen hareket düşer (transaction bozulmaz), sayısı döner.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  NormalizedAdoptKasaAccount,
  NormalizedAdoptKasaEntry,
} from '../../application/dto/AdoptFinanceKasaDtos.js';
import type {
  AdoptFinanceKasaOutcome,
  AdoptFinanceKasaPayload,
  AdoptFinanceKasaRepository,
} from '../../application/ports/AdoptFinanceKasaRepository.js';
import { AdoptBlobFinanceKasaUseCase } from '../../application/useCases/AdoptBlobFinanceKasaUseCase.js';

class FakeAdoptFinanceKasaRepository implements AdoptFinanceKasaRepository {
  private nextId = 1;
  readonly accounts = new Map<string, { id: number; row: NormalizedAdoptKasaAccount }>();
  readonly entries = new Map<
    string,
    { id: number; row: NormalizedAdoptKasaEntry; kasaAccountId: number }
  >();
  calls = 0;

  private key(companyId: number, clientId: string): string {
    return `${companyId} ${clientId}`;
  }

  adoptAll(companyId: number, payload: AdoptFinanceKasaPayload): Promise<AdoptFinanceKasaOutcome> {
    this.calls += 1;
    const accountIdByClient: Record<string, number> = {};
    const entryIdByClient: Record<string, number> = {};

    for (const a of payload.accounts) {
      const k = this.key(companyId, a.clientId);
      const id = this.accounts.get(k)?.id ?? this.nextId++;
      this.accounts.set(k, { id, row: a });
      accountIdByClient[a.clientId] = id;
    }

    let unresolvedEntries = 0;
    for (const e of payload.entries) {
      // Üç kademe: çağrı-içi → "DB" client_id → geçerli sayısal id.
      let kasaAccountId: number | undefined =
        accountIdByClient[e.kasaRef] ?? this.accounts.get(this.key(companyId, e.kasaRef))?.id;
      if (kasaAccountId === undefined && /^[0-9]+$/.test(e.kasaRef)) {
        const n = Number(e.kasaRef);
        if ([...this.accounts.values()].some((a) => a.id === n)) kasaAccountId = n;
      }
      if (kasaAccountId === undefined) {
        unresolvedEntries += 1; // düşer — transaction bozulmaz
        continue;
      }
      const id = this.entries.get(e.clientId)?.id ?? this.nextId++;
      this.entries.set(e.clientId, { id, row: e, kasaAccountId });
      entryIdByClient[e.clientId] = id;
    }

    return Promise.resolve({ accountIdByClient, entryIdByClient, unresolvedEntries });
  }
}

/** Blob'daki gerçek şekillerle örnek gövde (FinanceProjection.ts doğrulanmış eşlemesi). */
const blobBody = () => ({
  companyId: 1,
  accounts: [
    {
      id: 'ksa_1719912345678_mrk',
      name: 'Merkez Kasa',
      currency: 'TL', // → TRY (CURRENCY_MAP TEK KAYNAK)
      openingBalance: '150.257', // string + 2 haneye yuvarlama
      active: true,
    },
  ],
  entries: [
    {
      id: 'kse_1719912345679_1',
      kasaAccountId: 'ksa_1719912345678_mrk',
      date: '2026-03-10',
      type: 'out',
      amount: 99.999,
      description: 'Yakıt alımı',
      category: 'Yakıt', // kategori ADI serbest metin — kasaCategories BLOB'DA
      cashflowCatId: 'out_1', // repo çözer — olduğu gibi taşınır
      paymentMethod: 'nakit', // kolon yok — taşınmaz
    },
  ],
});

describe('AdoptBlobFinanceKasaUseCase', () => {
  it('happy: blob alanları normalize edilir; TL→TRY; kategori adı serbest metin; kasaRef çağrı-içi çözülür', async () => {
    const repo = new FakeAdoptFinanceKasaRepository();
    const sut = new AdoptBlobFinanceKasaUseCase(repo);

    const res = await sut.execute(blobBody());

    assert.deepEqual(res.adopted, { accounts: 1, entries: 1 });
    assert.deepEqual(res.dropped, {});
    const accId = res.idMap.accounts['ksa_1719912345678_mrk'];
    const entId = res.idMap.entries['kse_1719912345679_1'];
    assert.ok(accId !== undefined && entId !== undefined);

    const acc = repo.accounts.get('1 ksa_1719912345678_mrk')!.row;
    assert.equal(acc.name, 'Merkez Kasa');
    assert.equal(acc.currency, 'TRY'); // TL → TRY
    assert.equal(acc.openingBalance, 150.26); // string coercion + round2

    const ent = repo.entries.get('kse_1719912345679_1')!;
    assert.equal(ent.row.date, '2026-03-10');
    assert.equal(ent.row.type, 'out');
    assert.equal(ent.row.amount, 100); // round2
    assert.equal(ent.row.category, 'Yakıt');
    assert.equal(ent.row.cashflowCatRef, 'out_1'); // olduğu gibi — repo çözer
    assert.equal(ent.kasaAccountId, accId); // çağrı-içi harita ile çözüldü
  });

  it('idempotens: aynı gövde ikinci kez → aynı idMap, dupe yok', async () => {
    const repo = new FakeAdoptFinanceKasaRepository();
    const sut = new AdoptBlobFinanceKasaUseCase(repo);

    const first = await sut.execute(blobBody());
    const second = await sut.execute(blobBody());

    assert.deepEqual(second.adopted, { accounts: 1, entries: 1 });
    assert.deepEqual(second.idMap, first.idMap); // serverId'ler kararlı
    assert.equal(repo.accounts.size, 1);
    assert.equal(repo.entries.size, 1);
  });

  it('referans çözümü: hareket, ÖNCEKİ adopt çağrısında yazılmış kasaya bağlanabilir', async () => {
    const repo = new FakeAdoptFinanceKasaRepository();
    const sut = new AdoptBlobFinanceKasaUseCase(repo);

    const body = blobBody();
    const first = await sut.execute({ companyId: 1, accounts: body.accounts });
    const second = await sut.execute({ companyId: 1, entries: body.entries });

    assert.deepEqual(second.adopted, { accounts: 0, entries: 1 });
    const ent = repo.entries.get('kse_1719912345679_1')!;
    assert.equal(ent.kasaAccountId, first.idMap.accounts['ksa_1719912345678_mrk']);
  });

  it('sayısal kasaRef: FE önbelleğinden gelen SUNUCU id doğrulanarak kullanılır', async () => {
    const repo = new FakeAdoptFinanceKasaRepository();
    const sut = new AdoptBlobFinanceKasaUseCase(repo);

    const first = await sut.execute({ companyId: 1, accounts: blobBody().accounts });
    const serverId = first.idMap.accounts['ksa_1719912345678_mrk']!;

    const res = await sut.execute({
      companyId: 1,
      entries: [
        {
          id: 'kse_num',
          kasaAccountId: serverId, // sayısal sunucu id'si (önbellek)
          date: '2026-04-01',
          type: 'in',
          amount: 10,
        },
      ],
    });

    assert.deepEqual(res.adopted, { accounts: 0, entries: 1 });
    assert.equal(repo.entries.get('kse_num')!.kasaAccountId, serverId);
  });

  it('çözülemeyen kasaRef: hareket DÜŞER (idMap dışı) + sayaç, hata fırlamaz', async () => {
    const repo = new FakeAdoptFinanceKasaRepository();
    const sut = new AdoptBlobFinanceKasaUseCase(repo);

    const res = await sut.execute({
      companyId: 1,
      entries: [
        { id: 'kse_yetim', kasaAccountId: 'ksa_yok', date: '2026-01-01', type: 'in', amount: 5 },
      ],
    });

    assert.deepEqual(res.adopted, { accounts: 0, entries: 0 });
    assert.deepEqual(res.idMap.entries, {});
    assert.deepEqual(res.dropped, { 'kasaEntries.kasaAccount': 1 });
    assert.equal(repo.entries.size, 0);
    assert.equal(repo.calls, 1); // repo'ya gitti ama orada düştü
  });

  it('düşürme kuralları (FinanceProjection ile aynı): kasa yok / tarih bozuk / tip bozuk / tutar <= 0 → sayaçlar', async () => {
    const repo = new FakeAdoptFinanceKasaRepository();
    const sut = new AdoptBlobFinanceKasaUseCase(repo);

    const res = await sut.execute({
      companyId: 1,
      accounts: blobBody().accounts,
      entries: [
        { id: 'k1', date: '2026-01-01', type: 'in', amount: 5 }, // kasaAccountId yok
        {
          id: 'k2',
          kasaAccountId: 'ksa_1719912345678_mrk',
          date: 'dün',
          type: 'in',
          amount: 5,
        },
        {
          id: 'k3',
          kasaAccountId: 'ksa_1719912345678_mrk',
          date: '2026-01-01',
          type: 'giris',
          amount: 5,
        },
        {
          id: 'k4',
          kasaAccountId: 'ksa_1719912345678_mrk',
          date: '2026-01-01',
          type: 'in',
          amount: 0,
        },
        {
          id: 'k5',
          kasaAccountId: 'ksa_1719912345678_mrk',
          date: '2026-01-01',
          type: 'in',
          amount: 7,
        }, // geçerli
      ],
    });

    assert.deepEqual(res.adopted, { accounts: 1, entries: 1 });
    assert.deepEqual(res.dropped, {
      'kasaEntries.kasaAccount': 1,
      'kasaEntries.date': 1,
      'kasaEntries.type': 1,
      'kasaEntries.amount': 1,
    });
    assert.ok(repo.entries.has('k5'));
  });

  it("hesap düşürmeleri: adsız → kasaAccounts.name; bilinmeyen para birimi → kasaAccounts.currency; boş → TRY; id'siz atlanır", async () => {
    const repo = new FakeAdoptFinanceKasaRepository();
    const sut = new AdoptBlobFinanceKasaUseCase(repo);

    const res = await sut.execute({
      companyId: 1,
      accounts: [
        { name: 'idsiz — atlanır' },
        { id: 'ksa_adsiz', name: '   ' },
        { id: 'ksa_gbp', name: 'Döviz Kasa', currency: 'GBP' },
        { id: 'ksa_bos', name: 'Yerel Kasa' }, // currency yok → TRY
      ],
    });

    assert.deepEqual(res.adopted, { accounts: 1, entries: 0 });
    assert.deepEqual(res.dropped, { 'kasaAccounts.name': 1, 'kasaAccounts.currency': 1 });
    assert.equal(repo.accounts.get('1 ksa_bos')!.row.currency, 'TRY');
  });

  it("clientId dupe'unda SON kazanır (aynı batch'te tek upsert hedefi)", async () => {
    const repo = new FakeAdoptFinanceKasaRepository();
    const sut = new AdoptBlobFinanceKasaUseCase(repo);

    const res = await sut.execute({
      companyId: 1,
      accounts: [
        { id: 'ksa_1', name: 'Eski Ad' },
        { id: 'ksa_1', name: 'Yeni Ad' },
      ],
    });

    assert.deepEqual(res.adopted, { accounts: 1, entries: 0 });
    assert.equal(repo.accounts.get('1 ksa_1')!.row.name, 'Yeni Ad');
  });

  it('boş gövde → sıfır sonuç, repo hiç çağrılmaz (idempotent no-op)', async () => {
    const repo = new FakeAdoptFinanceKasaRepository();
    const sut = new AdoptBlobFinanceKasaUseCase(repo);

    const res = await sut.execute({ companyId: 1 });

    assert.deepEqual(res, {
      adopted: { accounts: 0, entries: 0 },
      idMap: { accounts: {}, entries: {} },
      dropped: {},
    });
    assert.equal(repo.calls, 0);
  });
});

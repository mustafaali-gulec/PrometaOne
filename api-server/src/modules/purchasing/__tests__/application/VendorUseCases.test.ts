/**
 * Tedarikçi use-case testleri.
 */
import assert from 'node:assert/strict';

import { beforeEach, describe, it } from 'vitest';

import {
  CreateVendorUseCase,
  DeactivateVendorUseCase,
  ListVendorsUseCase,
  UpdateVendorUseCase,
} from '../../application/useCases/VendorUseCases.js';
import {
  DuplicateVendorCodeError,
  VendorNotFoundError,
} from '../../domain/errors/PurchasingErrors.js';
import { FixedClock, InMemoryVendorRepository } from '../fakes.js';

describe('VendorUseCases', () => {
  let repo: InMemoryVendorRepository;
  let clock: FixedClock;

  beforeEach(() => {
    repo = new InMemoryVendorRepository();
    clock = new FixedClock();
  });

  it('happy: satici default → kod 320.A001, accountCode = kod', async () => {
    const uc = new CreateVendorUseCase(repo);
    const dto = await uc.execute({ companyId: 100, name: 'ABC Tedarik' });
    assert.equal(dto.code, '320.A001');
    assert.equal(dto.cariClass, 'satici');
    assert.equal(dto.accountCode, '320.A001');
    assert.ok(dto.active);
  });

  it('happy: alici → kod 120.A001', async () => {
    const uc = new CreateVendorUseCase(repo);
    const dto = await uc.execute({ companyId: 100, name: 'XYZ', cariClass: 'alici' });
    assert.equal(dto.code, '120.A001');
  });

  it('happy: ardışık kodlar artar (320.A002)', async () => {
    const uc = new CreateVendorUseCase(repo);
    await uc.execute({ companyId: 100, name: 'A' });
    const b = await uc.execute({ companyId: 100, name: 'B' });
    assert.equal(b.code, '320.A002');
  });

  it('edge: aynı kod → DuplicateVendorCodeError', async () => {
    const uc = new CreateVendorUseCase(repo);
    await uc.execute({ companyId: 100, name: 'A', code: '320.A001' });
    await assert.rejects(
      uc.execute({ companyId: 100, name: 'B', code: '320.A001' }),
      DuplicateVendorCodeError,
    );
  });

  it('happy: update isim değiştirir', async () => {
    const create = new CreateVendorUseCase(repo);
    const v = await create.execute({ companyId: 100, name: 'Eski' });
    const update = new UpdateVendorUseCase(repo, clock);
    const dto = await update.execute({ companyId: 100, vendorId: v.id, name: 'Yeni' });
    assert.equal(dto.name, 'Yeni');
  });

  it('edge: olmayan tedarikçi update → VendorNotFoundError', async () => {
    const update = new UpdateVendorUseCase(repo, clock);
    await assert.rejects(
      update.execute({ companyId: 100, vendorId: 999, name: 'X' }),
      VendorNotFoundError,
    );
  });

  it('edge: multi-tenant — başka şirketin tedarikçisine erişemez', async () => {
    const create = new CreateVendorUseCase(repo);
    const v = await create.execute({ companyId: 100, name: 'X' });
    const update = new UpdateVendorUseCase(repo, clock);
    await assert.rejects(
      update.execute({ companyId: 200, vendorId: v.id, name: 'Y' }),
      VendorNotFoundError,
    );
  });

  it('happy: deactivate sonrası default listede görünmez', async () => {
    const create = new CreateVendorUseCase(repo);
    const v = await create.execute({ companyId: 100, name: 'X' });
    const deact = new DeactivateVendorUseCase(repo, clock);
    await deact.execute({ companyId: 100, vendorId: v.id });
    const list = new ListVendorsUseCase(repo);
    assert.equal((await list.execute({ companyId: 100 })).length, 0);
    assert.equal((await list.execute({ companyId: 100, includeInactive: true })).length, 1);
  });
});

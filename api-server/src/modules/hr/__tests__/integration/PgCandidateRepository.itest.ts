/**
 * PgCandidateRepository integration test — gerçek PostgreSQL üzerinde.
 *
 * Doğrulanan davranışlar:
 *   - insert/update/findById/listByCompany/remove
 *   - candidate_source ENUM type (PG'de)
 *   - email CITEXT case-insensitive arama (q filtresi)
 *   - source filtresi
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { PgCandidateRepository } from '../../infrastructure/persistence/PgCandidateRepository.js';

import {
  seedCompany,
  startHrPgContainer,
  truncateAuthAndHrTables,
  type HrPgContext,
} from './setup.js';

describe('PgCandidateRepository [integration]', () => {
  let ctx: HrPgContext;

  before(
    async () => {
      ctx = await startHrPgContainer();
    },
    { timeout: 180_000 },
  );

  after(async () => {
    if (ctx) {
      await ctx.cleanup();
    }
  });

  beforeEach(async () => {
    await truncateAuthAndHrTables(ctx.pool);
    await seedCompany(ctx.pool, { id: 1, name: 'Test A.Ş.' });
  });

  it('insert: aday ekler, ENUM ve PhoneNumber alanları doğru dönüşür', async () => {
    const repo = new PgCandidateRepository(ctx.pool);
    const c = await repo.insert({
      companyId: 1,
      firstName: 'Ali',
      lastName: 'Veli',
      email: 'ali@example.com',
      phone: '+905551234567',
      source: 'linkedin',
      cvUrl: 'https://example.com/cv.pdf',
      notes: 'Strong candidate',
    });

    assert.ok(c.id > 0);
    assert.equal(c.firstName, 'Ali');
    assert.equal(c.source, 'linkedin');
    assert.equal(c.phone?.value, '+905551234567');
    assert.equal(c.email, 'ali@example.com');
  });

  it('update: profil güncellenir, DB satırına yansır', async () => {
    const repo = new PgCandidateRepository(ctx.pool);
    const c = await repo.insert({
      companyId: 1,
      firstName: 'Ali',
      lastName: 'Veli',
      email: 'ali@example.com',
      phone: null,
      source: 'direct',
      cvUrl: null,
      notes: null,
    });
    const updated = c.updateProfile({ firstName: 'Ali Reha', source: 'referral' }, new Date());
    await repo.update(updated);

    const found = await repo.findById(c.id, 1);
    assert.equal(found?.firstName, 'Ali Reha');
    assert.equal(found?.source, 'referral');
  });

  it('listByCompany: source filtresi + q araması (CITEXT case-insensitive)', async () => {
    const repo = new PgCandidateRepository(ctx.pool);
    await repo.insert({
      companyId: 1,
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'ALICE@TEST.COM',
      phone: null,
      source: 'linkedin',
      cvUrl: null,
      notes: null,
    });
    await repo.insert({
      companyId: 1,
      firstName: 'Bob',
      lastName: 'Jones',
      email: 'bob@test.com',
      phone: null,
      source: 'referral',
      cvUrl: null,
      notes: null,
    });

    const linkedinOnly = await repo.listByCompany(1, { source: 'linkedin' });
    assert.equal(linkedinOnly.length, 1);
    assert.equal(linkedinOnly[0]!.firstName, 'Alice');

    // q araması email'i case-insensitive bulmalı
    const byEmail = await repo.listByCompany(1, { q: 'alice@test.com' });
    assert.equal(byEmail.length, 1);

    const byName = await repo.listByCompany(1, { q: 'JoNeS' });
    assert.equal(byName.length, 1);
    assert.equal(byName[0]!.firstName, 'Bob');
  });

  it('remove: candidate siler; tekrar findById null', async () => {
    const repo = new PgCandidateRepository(ctx.pool);
    const c = await repo.insert({
      companyId: 1,
      firstName: 'Ali',
      lastName: 'Veli',
      email: null,
      phone: null,
      source: 'direct',
      cvUrl: null,
      notes: null,
    });
    await repo.remove(c.id, 1);
    const found = await repo.findById(c.id, 1);
    assert.equal(found, null);
  });

  it('multi-tenant: farklı şirketten silme veya bulma çalışmaz', async () => {
    const repo = new PgCandidateRepository(ctx.pool);
    await seedCompany(ctx.pool, { id: 2, name: 'Şirket 2' });

    const c = await repo.insert({
      companyId: 1,
      firstName: 'Ali',
      lastName: 'Veli',
      email: null,
      phone: null,
      source: 'direct',
      cvUrl: null,
      notes: null,
    });
    // Yanlış companyId ile remove etkisiz
    await repo.remove(c.id, 2);
    const stillThere = await repo.findById(c.id, 1);
    assert.ok(stillThere, 'farklı şirket remove çağrısı kaydı silmemeli');
  });
});

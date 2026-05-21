import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Candidate } from '../../domain/entities/Candidate.js';
import { PhoneNumber } from '../../domain/valueObjects/PhoneNumber.js';

describe('Candidate', () => {
  const baseDate = new Date('2026-05-21T09:00:00Z');
  const validProps = {
    id: 1,
    companyId: 100,
    firstName: 'Ali',
    lastName: 'Veli',
    email: 'ali@example.com',
    phone: null as PhoneNumber | null,
    source: 'linkedin' as const,
    cvUrl: null as string | null,
    notes: null as string | null,
    createdAt: baseDate,
    updatedAt: baseDate,
  };

  describe('create()', () => {
    it('geçerli props', () => {
      const c = Candidate.create(validProps);
      assert.equal(c.fullName, 'Ali Veli');
      assert.equal(c.source, 'linkedin');
      assert.equal(c.email, 'ali@example.com');
    });

    it('id <= 0 fırlatır', () => {
      assert.throws(() => Candidate.create({ ...validProps, id: 0 }), /id pozitif olmalı/);
    });

    it('boş firstName fırlatır', () => {
      assert.throws(() => Candidate.create({ ...validProps, firstName: '   ' }), /firstName boş/);
    });

    it('boş lastName fırlatır', () => {
      assert.throws(() => Candidate.create({ ...validProps, lastName: '' }), /lastName boş/);
    });

    it('100 karakteri geçen firstName', () => {
      assert.throws(
        () => Candidate.create({ ...validProps, firstName: 'A'.repeat(101) }),
        /firstName 100 karakteri/,
      );
    });
  });

  describe('updateProfile()', () => {
    const now = new Date('2026-05-22T09:00:00Z');

    it('email + source güncellenir', () => {
      const c = Candidate.create(validProps);
      const r = c.updateProfile({ email: 'new@example.com', source: 'referral' }, now);
      assert.equal(r.email, 'new@example.com');
      assert.equal(r.source, 'referral');
      assert.equal(c.email, 'ali@example.com', 'orijinal değişmemeli');
    });

    it('email=null bağı koparır', () => {
      const c = Candidate.create(validProps);
      const r = c.updateProfile({ email: null }, now);
      assert.equal(r.email, null);
    });

    it('boş firstName fırlatır', () => {
      const c = Candidate.create(validProps);
      assert.throws(() => c.updateProfile({ firstName: '  ' }, now), /firstName boş/);
    });

    it('phone VO atanır', () => {
      const c = Candidate.create(validProps);
      const phone = PhoneNumber.create('05321234567');
      const r = c.updateProfile({ phone }, now);
      assert.equal(r.phone?.value, '+905321234567');
    });
  });

  it('toJSON() plain object döner', () => {
    const c = Candidate.create(validProps);
    const json = c.toJSON();
    assert.equal(json.id, 1);
    assert.equal(json.firstName, 'Ali');
    assert.equal(json.source, 'linkedin');
  });
});

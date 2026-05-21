import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Application } from '../../domain/entities/Application.js';
import { InvalidStageTransitionError } from '../../domain/valueObjects/RecruitmentStage.js';

describe('Application', () => {
  const baseDate = new Date('2026-05-21T09:00:00Z');
  const validProps = {
    id: 1,
    companyId: 100,
    candidateId: 50,
    positionId: 7,
    stage: 'new' as const,
    stageChangedAt: baseDate,
    stageChangedBy: null as number | null,
    rejectionReason: null as string | null,
    salaryExpectation: null as number | null,
    notes: null as string | null,
    createdAt: baseDate,
    updatedAt: baseDate,
  };

  describe('create()', () => {
    it('geçerli props', () => {
      const a = Application.create(validProps);
      assert.equal(a.candidateId, 50);
      assert.equal(a.positionId, 7);
      assert.equal(a.stage, 'new');
      assert.equal(a.isTerminal(), false);
      assert.equal(a.isHired(), false);
    });

    it('id <= 0', () => {
      assert.throws(() => Application.create({ ...validProps, id: 0 }), /id pozitif/);
    });

    it('candidateId <= 0', () => {
      assert.throws(
        () => Application.create({ ...validProps, candidateId: 0 }),
        /candidateId pozitif/,
      );
    });

    it('positionId <= 0', () => {
      assert.throws(
        () => Application.create({ ...validProps, positionId: -1 }),
        /positionId pozitif/,
      );
    });

    it('negatif salaryExpectation', () => {
      assert.throws(
        () => Application.create({ ...validProps, salaryExpectation: -100 }),
        /salaryExpectation negatif/,
      );
    });
  });

  describe('isTerminal() / isHired()', () => {
    it('hired → terminal + hired', () => {
      const a = Application.create({ ...validProps, stage: 'hired' });
      assert.equal(a.isTerminal(), true);
      assert.equal(a.isHired(), true);
    });

    it('rejected → terminal ama hired değil', () => {
      const a = Application.create({ ...validProps, stage: 'rejected' });
      assert.equal(a.isTerminal(), true);
      assert.equal(a.isHired(), false);
    });

    it('new → terminal değil', () => {
      const a = Application.create(validProps);
      assert.equal(a.isTerminal(), false);
    });
  });

  describe('transitionTo()', () => {
    const now = new Date('2026-05-22T09:00:00Z');

    it('happy: new → screening → interview → offer → hired', () => {
      let a = Application.create(validProps);
      a = a.transitionTo('screening', now, 1);
      assert.equal(a.stage, 'screening');
      a = a.transitionTo('interview', now, 1);
      assert.equal(a.stage, 'interview');
      a = a.transitionTo('offer', now, 1);
      assert.equal(a.stage, 'offer');
      a = a.transitionTo('hired', now, 1);
      assert.equal(a.stage, 'hired');
      assert.equal(a.isHired(), true);
    });

    it('happy: any active → withdrawn', () => {
      const a = Application.create({ ...validProps, stage: 'interview' });
      const r = a.transitionTo('withdrawn', now, 1);
      assert.equal(r.stage, 'withdrawn');
    });

    it('happy: any active → rejected (rejectionReason kayıt)', () => {
      const a = Application.create({ ...validProps, stage: 'screening' });
      const r = a.transitionTo('rejected', now, 1, { rejectionReason: 'kültür uyumsuzluğu' });
      assert.equal(r.stage, 'rejected');
      assert.equal(r.rejectionReason, 'kültür uyumsuzluğu');
    });

    it('edge: new → offer atlama YASAK', () => {
      const a = Application.create(validProps);
      assert.throws(
        () => a.transitionTo('offer', now, 1),
        (e: unknown) => e instanceof InvalidStageTransitionError,
      );
    });

    it('edge: hired → herhangi bir şey YASAK (terminal)', () => {
      const a = Application.create({ ...validProps, stage: 'hired' });
      assert.throws(
        () => a.transitionTo('screening', now, 1),
        (e: unknown) => e instanceof InvalidStageTransitionError,
      );
    });

    it('edge: rejected → interview YASAK', () => {
      const a = Application.create({ ...validProps, stage: 'rejected' });
      assert.throws(
        () => a.transitionTo('interview', now, 1),
        (e: unknown) => e instanceof InvalidStageTransitionError,
      );
    });

    it('aynı stage ise no-op', () => {
      const a = Application.create(validProps);
      assert.equal(a.transitionTo('new', now, 1), a);
    });

    it('stageChangedBy ve stageChangedAt güncellenir', () => {
      const a = Application.create(validProps);
      const r = a.transitionTo('screening', now, 42);
      assert.equal(r.stageChangedBy, 42);
      assert.equal(r.stageChangedAt.getTime(), now.getTime());
    });
  });

  describe('updateMetadata()', () => {
    const now = new Date('2026-05-22T09:00:00Z');

    it('salary + notes güncellenir', () => {
      const a = Application.create(validProps);
      const r = a.updateMetadata({ salaryExpectation: 50000, notes: 'çok deneyimli' }, now);
      assert.equal(r.salaryExpectation, 50000);
      assert.equal(r.notes, 'çok deneyimli');
    });

    it('negatif salary fırlatır', () => {
      const a = Application.create(validProps);
      assert.throws(
        () => a.updateMetadata({ salaryExpectation: -1 }, now),
        /salaryExpectation negatif/,
      );
    });
  });

  it('toJSON()', () => {
    const a = Application.create(validProps);
    const json = a.toJSON();
    assert.equal(json.id, 1);
    assert.equal(json.stage, 'new');
  });
});

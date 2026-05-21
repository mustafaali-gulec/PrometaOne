import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ACTIVE_STAGES,
  allowedStageTransitions,
  ALL_RECRUITMENT_STAGES,
  InvalidStageTransitionError,
  isStageTransitionAllowed,
  isTerminalStage,
  TERMINAL_STAGES,
} from '../../domain/valueObjects/RecruitmentStage.js';

describe('RecruitmentStage', () => {
  it('ALL_RECRUITMENT_STAGES doğru sırada 7 stage', () => {
    assert.deepEqual(
      [...ALL_RECRUITMENT_STAGES],
      ['new', 'screening', 'interview', 'offer', 'hired', 'rejected', 'withdrawn'],
    );
  });

  it('TERMINAL_STAGES hired/rejected/withdrawn', () => {
    assert.deepEqual([...TERMINAL_STAGES].sort(), ['hired', 'rejected', 'withdrawn']);
  });

  it('ACTIVE_STAGES terminal olmayan 4 stage', () => {
    assert.deepEqual([...ACTIVE_STAGES], ['new', 'screening', 'interview', 'offer']);
  });

  it('isTerminalStage doğru', () => {
    assert.equal(isTerminalStage('hired'), true);
    assert.equal(isTerminalStage('rejected'), true);
    assert.equal(isTerminalStage('withdrawn'), true);
    assert.equal(isTerminalStage('new'), false);
    assert.equal(isTerminalStage('screening'), false);
  });

  describe('allowedStageTransitions', () => {
    it('new → [screening, rejected, withdrawn]', () => {
      assert.deepEqual([...allowedStageTransitions('new')], ['screening', 'rejected', 'withdrawn']);
    });

    it('screening → [interview, rejected, withdrawn]', () => {
      assert.deepEqual(
        [...allowedStageTransitions('screening')],
        ['interview', 'rejected', 'withdrawn'],
      );
    });

    it('interview → [offer, rejected, withdrawn]', () => {
      assert.deepEqual(
        [...allowedStageTransitions('interview')],
        ['offer', 'rejected', 'withdrawn'],
      );
    });

    it('offer → [hired, rejected, withdrawn]', () => {
      assert.deepEqual([...allowedStageTransitions('offer')], ['hired', 'rejected', 'withdrawn']);
    });

    it("terminal stage'lerden geçiş yok", () => {
      assert.deepEqual([...allowedStageTransitions('hired')], []);
      assert.deepEqual([...allowedStageTransitions('rejected')], []);
      assert.deepEqual([...allowedStageTransitions('withdrawn')], []);
    });
  });

  describe('isStageTransitionAllowed — yasaklı geçişler', () => {
    it('hired → screening yasak', () => {
      assert.equal(isStageTransitionAllowed('hired', 'screening'), false);
    });

    it('rejected → interview yasak', () => {
      assert.equal(isStageTransitionAllowed('rejected', 'interview'), false);
    });

    it('new → offer yasak (atlama)', () => {
      assert.equal(isStageTransitionAllowed('new', 'offer'), false);
    });

    it('new → hired yasak (atlama)', () => {
      assert.equal(isStageTransitionAllowed('new', 'hired'), false);
    });

    it('screening → new yasak (geri)', () => {
      assert.equal(isStageTransitionAllowed('screening', 'new'), false);
    });

    it('offer → interview yasak (geri)', () => {
      assert.equal(isStageTransitionAllowed('offer', 'interview'), false);
    });

    it('hired → withdrawn yasak (terminal terminale geçemez)', () => {
      assert.equal(isStageTransitionAllowed('hired', 'withdrawn'), false);
    });
  });

  describe('isStageTransitionAllowed — yasal geçişler', () => {
    it('tüm aktif aşamalardan withdrawn olabilir', () => {
      assert.equal(isStageTransitionAllowed('new', 'withdrawn'), true);
      assert.equal(isStageTransitionAllowed('screening', 'withdrawn'), true);
      assert.equal(isStageTransitionAllowed('interview', 'withdrawn'), true);
      assert.equal(isStageTransitionAllowed('offer', 'withdrawn'), true);
    });

    it('tüm aktif aşamalardan rejected olabilir', () => {
      assert.equal(isStageTransitionAllowed('new', 'rejected'), true);
      assert.equal(isStageTransitionAllowed('offer', 'rejected'), true);
    });

    it('sadece offer → hired', () => {
      assert.equal(isStageTransitionAllowed('offer', 'hired'), true);
      assert.equal(isStageTransitionAllowed('interview', 'hired'), false);
    });
  });

  it('InvalidStageTransitionError from/to taşır', () => {
    const e = new InvalidStageTransitionError('hired', 'screening');
    assert.equal(e.from, 'hired');
    assert.equal(e.to, 'screening');
  });
});

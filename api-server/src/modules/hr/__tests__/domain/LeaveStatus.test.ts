import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  allowedLeaveTransitions,
  ALL_LEAVE_STATUSES,
  InvalidLeaveTransitionError,
  isLeaveTransitionAllowed,
  isTerminalLeaveStatus,
} from '../../domain/valueObjects/LeaveStatus.js';

describe('LeaveStatus', () => {
  it('ALL_LEAVE_STATUSES doğru sırada', () => {
    assert.deepEqual([...ALL_LEAVE_STATUSES], ['pending', 'approved', 'rejected', 'cancelled']);
  });

  describe('allowedLeaveTransitions', () => {
    it('pending → [approved, rejected, cancelled]', () => {
      assert.deepEqual(
        [...allowedLeaveTransitions('pending')],
        ['approved', 'rejected', 'cancelled'],
      );
    });

    it('approved → [cancelled]', () => {
      assert.deepEqual([...allowedLeaveTransitions('approved')], ['cancelled']);
    });

    it('rejected → [] (terminal)', () => {
      assert.deepEqual([...allowedLeaveTransitions('rejected')], []);
    });

    it('cancelled → [] (terminal)', () => {
      assert.deepEqual([...allowedLeaveTransitions('cancelled')], []);
    });
  });

  describe('isTerminalLeaveStatus', () => {
    it('rejected ve cancelled terminal', () => {
      assert.equal(isTerminalLeaveStatus('rejected'), true);
      assert.equal(isTerminalLeaveStatus('cancelled'), true);
    });
    it('pending ve approved terminal değil', () => {
      assert.equal(isTerminalLeaveStatus('pending'), false);
      assert.equal(isTerminalLeaveStatus('approved'), false);
    });
  });

  describe('isLeaveTransitionAllowed — yasaklı geçişler', () => {
    it('approved → rejected yasak', () => {
      assert.equal(isLeaveTransitionAllowed('approved', 'rejected'), false);
    });
    it('rejected → approved yasak', () => {
      assert.equal(isLeaveTransitionAllowed('rejected', 'approved'), false);
    });
    it('cancelled → pending yasak', () => {
      assert.equal(isLeaveTransitionAllowed('cancelled', 'pending'), false);
    });
    it('approved → pending yasak (geri dönmez)', () => {
      assert.equal(isLeaveTransitionAllowed('approved', 'pending'), false);
    });
  });

  it('InvalidLeaveTransitionError from/to taşır', () => {
    const e = new InvalidLeaveTransitionError('approved', 'rejected');
    assert.equal(e.from, 'approved');
    assert.equal(e.to, 'rejected');
  });
});

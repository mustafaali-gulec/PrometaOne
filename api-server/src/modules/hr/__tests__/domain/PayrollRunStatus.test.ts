import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  allowedPayrollRunTransitions,
  ALL_PAYROLL_RUN_STATUSES,
  InvalidPayrollRunTransitionError,
  isPayrollRunTransitionAllowed,
  isTerminalPayrollRunStatus,
} from '../../domain/valueObjects/PayrollRunStatus.js';

describe('PayrollRunStatus', () => {
  it('ALL_PAYROLL_RUN_STATUSES doğru sırada', () => {
    assert.deepEqual([...ALL_PAYROLL_RUN_STATUSES], ['draft', 'finalized']);
  });

  describe('allowedPayrollRunTransitions', () => {
    it('draft → [finalized]', () => {
      assert.deepEqual([...allowedPayrollRunTransitions('draft')], ['finalized']);
    });

    it('finalized → [] (terminal)', () => {
      assert.deepEqual([...allowedPayrollRunTransitions('finalized')], []);
    });
  });

  describe('isTerminalPayrollRunStatus', () => {
    it('finalized terminal', () => {
      assert.equal(isTerminalPayrollRunStatus('finalized'), true);
    });
    it('draft terminal değil', () => {
      assert.equal(isTerminalPayrollRunStatus('draft'), false);
    });
  });

  describe('isPayrollRunTransitionAllowed — yasaklı geçişler', () => {
    it('draft → finalized serbest', () => {
      assert.equal(isPayrollRunTransitionAllowed('draft', 'finalized'), true);
    });
    it('finalized → draft yasak (geri dönmez)', () => {
      assert.equal(isPayrollRunTransitionAllowed('finalized', 'draft'), false);
    });
    it('finalized → finalized yasak (tekrar kesinleşmez)', () => {
      assert.equal(isPayrollRunTransitionAllowed('finalized', 'finalized'), false);
    });
  });

  it('InvalidPayrollRunTransitionError from/to taşır', () => {
    const e = new InvalidPayrollRunTransitionError('finalized', 'draft');
    assert.equal(e.from, 'finalized');
    assert.equal(e.to, 'draft');
  });
});

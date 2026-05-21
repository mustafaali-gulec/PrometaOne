import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  allowedEmployeeTransitions,
  ALL_EMPLOYEE_STATUSES,
  InvalidEmployeeTransitionError,
  isEmployeeTransitionAllowed,
} from '../../domain/valueObjects/EmployeeStatus.js';

describe('EmployeeStatus', () => {
  it('ALL_EMPLOYEE_STATUSES doğru sırada', () => {
    assert.deepEqual([...ALL_EMPLOYEE_STATUSES], ['probation', 'active', 'on_leave', 'terminated']);
  });

  describe('allowedEmployeeTransitions', () => {
    it('probation → [active, terminated]', () => {
      assert.deepEqual([...allowedEmployeeTransitions('probation')], ['active', 'terminated']);
    });

    it('active → [on_leave, terminated]', () => {
      assert.deepEqual([...allowedEmployeeTransitions('active')], ['on_leave', 'terminated']);
    });

    it('on_leave → [active, terminated]', () => {
      assert.deepEqual([...allowedEmployeeTransitions('on_leave')], ['active', 'terminated']);
    });

    it('terminated → [] (terminal state)', () => {
      assert.deepEqual([...allowedEmployeeTransitions('terminated')], []);
    });
  });

  describe('isEmployeeTransitionAllowed — yasaklı geçişler', () => {
    it('terminated → active yasak', () => {
      assert.equal(isEmployeeTransitionAllowed('terminated', 'active'), false);
    });

    it('terminated → probation yasak', () => {
      assert.equal(isEmployeeTransitionAllowed('terminated', 'probation'), false);
    });

    it('active → probation yasak (geri taslağa dönmez)', () => {
      assert.equal(isEmployeeTransitionAllowed('active', 'probation'), false);
    });

    it('on_leave → probation yasak', () => {
      assert.equal(isEmployeeTransitionAllowed('on_leave', 'probation'), false);
    });

    it('probation → on_leave yasak (önce active olmalı)', () => {
      assert.equal(isEmployeeTransitionAllowed('probation', 'on_leave'), false);
    });
  });

  it('InvalidEmployeeTransitionError from/to taşır', () => {
    const e = new InvalidEmployeeTransitionError('terminated', 'active');
    assert.equal(e.from, 'terminated');
    assert.equal(e.to, 'active');
  });
});

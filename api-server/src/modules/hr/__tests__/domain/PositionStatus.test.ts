import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  allowedPositionTransitions,
  ALL_POSITION_STATUSES,
  InvalidPositionTransitionError,
  isPositionTransitionAllowed,
} from '../../domain/valueObjects/PositionStatus.js';

describe('PositionStatus', () => {
  it('ALL_POSITION_STATUSES doğru sırada 3 durum içerir', () => {
    assert.deepEqual([...ALL_POSITION_STATUSES], ['draft', 'open', 'closed']);
  });

  describe('allowedPositionTransitions', () => {
    it('draft → [open, closed]', () => {
      assert.deepEqual([...allowedPositionTransitions('draft')], ['open', 'closed']);
    });

    it('open → [closed]', () => {
      assert.deepEqual([...allowedPositionTransitions('open')], ['closed']);
    });

    it('closed → [open] (yeniden aç)', () => {
      assert.deepEqual([...allowedPositionTransitions('closed')], ['open']);
    });
  });

  describe('isPositionTransitionAllowed', () => {
    it('izinli geçişler true döner', () => {
      assert.equal(isPositionTransitionAllowed('draft', 'open'), true);
      assert.equal(isPositionTransitionAllowed('open', 'closed'), true);
      assert.equal(isPositionTransitionAllowed('closed', 'open'), true);
    });

    it('yasak: closed → draft', () => {
      assert.equal(isPositionTransitionAllowed('closed', 'draft'), false);
    });

    it('yasak: open → draft', () => {
      assert.equal(isPositionTransitionAllowed('open', 'draft'), false);
    });
  });

  it('InvalidPositionTransitionError from/to taşır', () => {
    const e = new InvalidPositionTransitionError('open', 'draft');
    assert.equal(e.from, 'open');
    assert.equal(e.to, 'draft');
    assert.match(e.message, /open → draft/);
  });
});

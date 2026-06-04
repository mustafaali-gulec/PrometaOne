import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  allowedAssetTransitions,
  ALL_ASSET_STATUSES,
  InvalidAssetTransitionError,
  isAssetTransitionAllowed,
  isTerminalAssetStatus,
  TERMINAL_ASSET_STATUSES,
} from '../../domain/valueObjects/AssetStatus.js';

describe('AssetStatus', () => {
  it('ALL_ASSET_STATUSES doğru sırada', () => {
    assert.deepEqual(
      [...ALL_ASSET_STATUSES],
      ['in_stock', 'assigned', 'maintenance', 'retired', 'lost'],
    );
  });

  it('TERMINAL_ASSET_STATUSES = [retired, lost]', () => {
    assert.deepEqual([...TERMINAL_ASSET_STATUSES], ['retired', 'lost']);
  });

  describe('allowedAssetTransitions', () => {
    it('in_stock → [assigned, maintenance, retired, lost]', () => {
      assert.deepEqual(
        [...allowedAssetTransitions('in_stock')],
        ['assigned', 'maintenance', 'retired', 'lost'],
      );
    });
    it('assigned → [in_stock, retired, lost]', () => {
      assert.deepEqual([...allowedAssetTransitions('assigned')], ['in_stock', 'retired', 'lost']);
    });
    it('maintenance → [in_stock, retired, lost]', () => {
      assert.deepEqual(
        [...allowedAssetTransitions('maintenance')],
        ['in_stock', 'retired', 'lost'],
      );
    });
    it('retired → [] (terminal)', () => {
      assert.deepEqual([...allowedAssetTransitions('retired')], []);
    });
    it('lost → [] (terminal)', () => {
      assert.deepEqual([...allowedAssetTransitions('lost')], []);
    });
  });

  describe('isTerminalAssetStatus', () => {
    it('retired terminal', () => {
      assert.equal(isTerminalAssetStatus('retired'), true);
    });
    it('lost terminal', () => {
      assert.equal(isTerminalAssetStatus('lost'), true);
    });
    it('in_stock terminal değil', () => {
      assert.equal(isTerminalAssetStatus('in_stock'), false);
    });
  });

  describe('isAssetTransitionAllowed — yasaklı geçişler', () => {
    it('in_stock → assigned serbest', () => {
      assert.equal(isAssetTransitionAllowed('in_stock', 'assigned'), true);
    });
    it('assigned → in_stock serbest (iade)', () => {
      assert.equal(isAssetTransitionAllowed('assigned', 'in_stock'), true);
    });
    it('assigned → maintenance yasak (önce iade gerekir)', () => {
      assert.equal(isAssetTransitionAllowed('assigned', 'maintenance'), false);
    });
    it('maintenance → assigned yasak (önce in_stock gerekir)', () => {
      assert.equal(isAssetTransitionAllowed('maintenance', 'assigned'), false);
    });
    it('retired → in_stock yasak (terminal)', () => {
      assert.equal(isAssetTransitionAllowed('retired', 'in_stock'), false);
    });
    it('lost → assigned yasak (terminal)', () => {
      assert.equal(isAssetTransitionAllowed('lost', 'assigned'), false);
    });
  });

  it('InvalidAssetTransitionError from/to taşır', () => {
    const e = new InvalidAssetTransitionError('retired', 'in_stock');
    assert.equal(e.from, 'retired');
    assert.equal(e.to, 'in_stock');
  });
});

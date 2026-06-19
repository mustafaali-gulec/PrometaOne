import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { InvalidOrderStatusTransitionError } from '../../domain/errors/ProductionErrors.js';
import { ProductionOrderStatus } from '../../domain/valueObjects/ProductionOrderStatus.js';

describe('ProductionOrderStatus — durum makinesi', () => {
  it('geçerli geçişlere izin verir', () => {
    assert.equal(ProductionOrderStatus.of('planned').canTransition('released'), true);
    assert.equal(ProductionOrderStatus.of('planned').canTransition('cancelled'), true);
    assert.equal(ProductionOrderStatus.of('released').canTransition('in_progress'), true);
    assert.equal(ProductionOrderStatus.of('in_progress').canTransition('completed'), true);
    assert.equal(ProductionOrderStatus.of('in_progress').canTransition('cancelled'), true);
  });

  it('geçersiz geçişleri reddeder', () => {
    assert.equal(ProductionOrderStatus.of('planned').canTransition('completed'), false);
    assert.equal(ProductionOrderStatus.of('planned').canTransition('in_progress'), false);
    assert.equal(ProductionOrderStatus.of('completed').canTransition('released'), false);
    assert.equal(ProductionOrderStatus.of('cancelled').canTransition('planned'), false);
  });

  it('terminal durumları doğru belirler', () => {
    assert.equal(ProductionOrderStatus.of('completed').isTerminal(), true);
    assert.equal(ProductionOrderStatus.of('cancelled').isTerminal(), true);
    assert.equal(ProductionOrderStatus.of('planned').isTerminal(), false);
  });

  it('assertTransition geçersizde fırlatır, geçerlide yeni VO döner', () => {
    const next = ProductionOrderStatus.of('planned').assertTransition('released');
    assert.equal(next.value, 'released');
    assert.throws(
      () => ProductionOrderStatus.of('planned').assertTransition('completed'),
      InvalidOrderStatusTransitionError,
    );
  });
});

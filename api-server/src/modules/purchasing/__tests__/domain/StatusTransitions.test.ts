/**
 * Statü geçiş kuralları (PrStatus/PoStatus) + entity changeStatus testleri.
 */
import assert from 'node:assert/strict';

import { describe, it } from 'vitest';

import { PurchaseOrder } from '../../domain/entities/PurchaseOrder.js';
import { PurchaseRequest } from '../../domain/entities/PurchaseRequest.js';
import { InvalidStatusTransitionError } from '../../domain/errors/PurchasingErrors.js';
import { canTransitionPo } from '../../domain/valueObjects/PoStatus.js';
import { canTransitionPr } from '../../domain/valueObjects/PrStatus.js';

const NOW = new Date('2026-06-05T00:00:00.000Z');

function makePr(status: 'draft' | 'pending_approval' | 'approved'): PurchaseRequest {
  return PurchaseRequest.create({
    id: 1,
    companyId: 100,
    prNo: 'PR-2026-0001',
    requesterUserId: 5,
    departmentId: null,
    category: 'other',
    priority: 'normal',
    status,
    currency: 'TRY',
    justification: null,
    requiredBy: null,
    requestedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    items: [{ lineNo: 1, description: 'Kalem', quantity: 2, unitPrice: 50, note: null }],
  });
}

function makePo(status: 'draft' | 'ordered' | 'received'): PurchaseOrder {
  return PurchaseOrder.create({
    id: 1,
    companyId: 100,
    poNo: 'PO-2026-0001',
    vendorId: 9,
    prId: null,
    status,
    currency: 'TRY',
    note: null,
    orderedAt: null,
    deliveredAt: null,
    createdBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    lines: [{ lineNo: 1, description: 'Satır', quantity: 2, unitPrice: 50, receivedQty: 0 }],
  });
}

describe('PrStatus geçişleri', () => {
  it('draft → pending_approval geçerli, draft → approved geçersiz', () => {
    assert.equal(canTransitionPr('draft', 'pending_approval'), true);
    assert.equal(canTransitionPr('draft', 'approved'), false);
  });

  it('rejected terminal', () => {
    assert.equal(canTransitionPr('rejected', 'approved'), false);
  });

  it('totalAmount kalemlerden hesaplanır', () => {
    assert.equal(makePr('draft').totalAmount, 100);
  });

  it('geçersiz changeStatus → InvalidStatusTransitionError', () => {
    assert.throws(
      () => makePr('draft').changeStatus('approved', NOW),
      InvalidStatusTransitionError,
    );
  });

  it('geçerli changeStatus yeni instance döner', () => {
    const pr = makePr('pending_approval').changeStatus('approved', NOW);
    assert.equal(pr.status, 'approved');
  });
});

describe('PoStatus geçişleri', () => {
  it('draft → ordered geçerli; draft → received geçersiz', () => {
    assert.equal(canTransitionPo('draft', 'ordered'), true);
    assert.equal(canTransitionPo('draft', 'received'), false);
  });

  it('ordered → received geçişinde deliveredAt damgalanır', () => {
    const po = makePo('ordered').changeStatus('received', NOW);
    assert.equal(po.status, 'received');
    assert.deepEqual(po.deliveredAt, NOW);
  });

  it('cancelled terminal', () => {
    assert.throws(
      () => makePo('draft').changeStatus('cancelled', NOW).changeStatus('ordered', NOW),
      InvalidStatusTransitionError,
    );
  });
});

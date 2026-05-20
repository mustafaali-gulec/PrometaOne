import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { VerifyPasswordResetTokenUseCase } from '../../application/useCases/VerifyPasswordResetTokenUseCase.js';

import { fakeClock, InMemoryPasswordResetTokenStore } from './fakes.js';

describe('VerifyPasswordResetTokenUseCase', () => {
  const NOW = '2026-05-19T12:00:00Z';
  function build() {
    const tokens = new InMemoryPasswordResetTokenStore();
    const useCase = new VerifyPasswordResetTokenUseCase({
      tokens,
      clock: fakeClock(NOW),
    });
    return { useCase, tokens };
  }

  it('aktif token -> valid: true', async () => {
    const { useCase, tokens } = build();
    await tokens.create({
      userId: 1,
      token: 'good',
      expiresAt: new Date('2026-05-19T12:30:00Z'),
    });
    assert.deepEqual(await useCase.execute({ token: 'good' }), { valid: true });
  });

  it('bulunamaz -> valid:false, reason:not_found', async () => {
    const { useCase } = build();
    assert.deepEqual(await useCase.execute({ token: 'yok' }), {
      valid: false,
      reason: 'not_found',
    });
  });

  it('kullanılmış -> valid:false, reason:used', async () => {
    const { useCase, tokens } = build();
    await tokens.create({
      userId: 1,
      token: 'used',
      expiresAt: new Date('2026-05-19T12:30:00Z'),
    });
    await tokens.markUsed('used');
    assert.deepEqual(await useCase.execute({ token: 'used' }), {
      valid: false,
      reason: 'used',
    });
  });

  it('expired -> valid:false, reason:expired', async () => {
    const { useCase, tokens } = build();
    await tokens.create({
      userId: 1,
      token: 'old',
      // NOW = 12:00; expiresAt 11:00 (geçmiş)
      expiresAt: new Date('2026-05-19T11:00:00Z'),
    });
    assert.deepEqual(await useCase.execute({ token: 'old' }), {
      valid: false,
      reason: 'expired',
    });
  });
});

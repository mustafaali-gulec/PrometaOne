import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { UserNotFoundError } from '../../application/errors/AuthErrors.js';
import { GetCurrentUserUseCase } from '../../application/useCases/GetCurrentUserUseCase.js';

import { InMemoryUserRepo } from './fakes.js';

describe('GetCurrentUserUseCase', () => {
  it('user bulursa DTO döner', async () => {
    const users = InMemoryUserRepo.withSeed({ id: 5, username: 'mustafa', role: 'cfo' });
    const uc = new GetCurrentUserUseCase(users);
    const dto = await uc.execute({ userId: 5 });
    assert.equal(dto.id, 5);
    assert.equal(dto.username, 'mustafa');
    assert.equal(dto.role, 'cfo');
  });

  it('user bulamazsa UserNotFoundError', async () => {
    const users = new InMemoryUserRepo();
    const uc = new GetCurrentUserUseCase(users);
    await assert.rejects(uc.execute({ userId: 999 }), UserNotFoundError);
  });
});

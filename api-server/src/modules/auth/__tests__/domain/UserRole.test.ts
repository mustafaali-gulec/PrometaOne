import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isAtLeast, ALL_USER_ROLES } from '../../domain/valueObjects/UserRole.js';

describe('UserRole', () => {
  it('viewer < editor < cfo < admin', () => {
    assert.equal(isAtLeast('admin', 'cfo'), true);
    assert.equal(isAtLeast('admin', 'admin'), true);
    assert.equal(isAtLeast('cfo', 'editor'), true);
    assert.equal(isAtLeast('editor', 'viewer'), true);
    assert.equal(isAtLeast('viewer', 'editor'), false);
    assert.equal(isAtLeast('editor', 'cfo'), false);
    assert.equal(isAtLeast('cfo', 'admin'), false);
  });

  it('ALL_USER_ROLES doğru sırada 4 rol içerir', () => {
    assert.deepEqual([...ALL_USER_ROLES], ['viewer', 'editor', 'cfo', 'admin']);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isAtLeast, ALL_USER_ROLES } from '../../domain/valueObjects/UserRole.js';

describe('UserRole', () => {
  it('viewer < editor < hr_manager < cfo < admin', () => {
    // admin tüm rollerin üzerinde
    assert.equal(isAtLeast('admin', 'cfo'), true);
    assert.equal(isAtLeast('admin', 'hr_manager'), true);
    assert.equal(isAtLeast('admin', 'editor'), true);
    assert.equal(isAtLeast('admin', 'viewer'), true);
    assert.equal(isAtLeast('admin', 'admin'), true);

    // cfo: admin altında, diğerlerinin üstünde
    assert.equal(isAtLeast('cfo', 'admin'), false);
    assert.equal(isAtLeast('cfo', 'hr_manager'), true);
    assert.equal(isAtLeast('cfo', 'editor'), true);
    assert.equal(isAtLeast('cfo', 'viewer'), true);

    // hr_manager: cfo altında, editor üstünde
    assert.equal(isAtLeast('hr_manager', 'cfo'), false);
    assert.equal(isAtLeast('hr_manager', 'admin'), false);
    assert.equal(isAtLeast('hr_manager', 'hr_manager'), true);
    assert.equal(isAtLeast('hr_manager', 'editor'), true);
    assert.equal(isAtLeast('hr_manager', 'viewer'), true);

    // editor: hr_manager altında
    assert.equal(isAtLeast('editor', 'hr_manager'), false);
    assert.equal(isAtLeast('editor', 'cfo'), false);
    assert.equal(isAtLeast('editor', 'viewer'), true);

    // viewer: en alt
    assert.equal(isAtLeast('viewer', 'editor'), false);
    assert.equal(isAtLeast('viewer', 'hr_manager'), false);
  });

  it('ALL_USER_ROLES doğru sırada 5 rol içerir', () => {
    assert.deepEqual([...ALL_USER_ROLES], ['viewer', 'editor', 'hr_manager', 'cfo', 'admin']);
  });
});

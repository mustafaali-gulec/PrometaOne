import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Notification } from '../../domain/entities/Notification.js';

describe('Notification', () => {
  const validProps = {
    id: 'n-1',
    recipientUserId: 42,
    kind: { kind: 'generic' as const },
    title: 'Test',
    body: 'Body',
    link: null,
    createdBy: 'system',
    createdAt: new Date('2026-05-19T09:00:00Z'),
    readAt: null,
  };

  it('create() geçerli prop\'larla başarılı', () => {
    const n = Notification.create(validProps);
    assert.equal(n.id, 'n-1');
    assert.equal(n.recipientUserId, 42);
    assert.equal(n.title, 'Test');
    assert.equal(n.isRead, false);
  });

  it('create() boş id ile fırlatır', () => {
    assert.throws(() => Notification.create({ ...validProps, id: '' }), /id boş olamaz/);
  });

  it('create() boş title ile fırlatır', () => {
    assert.throws(() => Notification.create({ ...validProps, title: '   ' }), /title boş/);
  });

  it('create() negatif recipientUserId ile fırlatır', () => {
    assert.throws(
      () => Notification.create({ ...validProps, recipientUserId: 0 }),
      /pozitif olmalı/,
    );
  });

  it('markAsRead() yeni instance döner, orijinal değişmez', () => {
    const original = Notification.create(validProps);
    const readDate = new Date('2026-05-19T10:00:00Z');
    const marked = original.markAsRead(readDate);

    assert.equal(original.isRead, false, 'orijinal değişmemeli');
    assert.equal(original.readAt, null);
    assert.equal(marked.isRead, true);
    assert.deepEqual(marked.readAt, readDate);
    assert.notEqual(original, marked, 'yeni instance olmalı');
  });

  it('markAsRead() zaten okunmuş ise aynı instance döner (no-op)', () => {
    const read = Notification.create({ ...validProps, readAt: new Date() });
    const result = read.markAsRead();
    assert.equal(read, result);
  });

  it('toJSON() plain object döner', () => {
    const n = Notification.create(validProps);
    const json = n.toJSON();
    assert.equal(json.id, 'n-1');
    assert.equal(json.title, 'Test');
  });
});

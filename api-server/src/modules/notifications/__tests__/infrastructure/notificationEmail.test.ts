import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Notification } from '../../domain/entities/Notification.js';
import { renderNotificationEmail } from '../../infrastructure/email/templates/notificationEmail.js';

function buildN(overrides: Partial<{ title: string; body: string; link: string | null }> = {}): Notification {
  return Notification.create({
    id: 'n-1',
    recipientUserId: 42,
    kind: { kind: 'generic' },
    title: overrides.title ?? 'Test başlığı',
    body: overrides.body ?? 'Test gövdesi',
    link: overrides.link ?? null,
    createdBy: 'system',
    createdAt: new Date('2026-05-19T09:00:00Z'),
    readAt: null,
  });
}

describe('renderNotificationEmail', () => {
  it('title + body HTML içerir', () => {
    const html = renderNotificationEmail({
      notification: buildN({ title: 'X', body: 'Y' }),
      recipientDisplayName: 'Mustafa',
      appUrl: 'https://app.example.com',
    });

    assert.match(html, /<h2>X<\/h2>/);
    assert.match(html, /<p>Y<\/p>/);
    assert.match(html, /Mustafa/);
    assert.match(html, /https:\/\/app\.example\.com/);
  });

  it('newline body içinde <br>\'a çevrilir', () => {
    const html = renderNotificationEmail({
      notification: buildN({ body: 'satir1\nsatir2' }),
      recipientDisplayName: 'X',
      appUrl: 'https://x',
    });
    assert.match(html, /satir1<br>satir2/);
  });

  it('XSS escape edilir', () => {
    const html = renderNotificationEmail({
      notification: buildN({ title: '<script>alert(1)</script>', body: '<img onerror=x>' }),
      recipientDisplayName: '<b>X</b>',
      appUrl: 'https://x',
    });
    assert.doesNotMatch(html, /<script>alert/);
    assert.doesNotMatch(html, /<img onerror/);
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /&lt;b&gt;X&lt;\/b&gt;/);
  });

  it('link verilirse appUrl/link formatında href', () => {
    const html = renderNotificationEmail({
      notification: buildN({ link: 'tasks/42' }),
      recipientDisplayName: 'X',
      appUrl: 'https://app',
    });
    assert.match(html, /href="https:\/\/app\/tasks\/42"/);
  });
});

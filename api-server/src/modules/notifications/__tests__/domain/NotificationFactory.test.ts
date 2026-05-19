import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildNotificationContent } from '../../domain/services/NotificationFactory.js';

describe('buildNotificationContent', () => {
  it('task_due_soon — title görev sayısını içerir', () => {
    const c = buildNotificationContent({
      kind: 'task_due_soon',
      taskIds: ['t1', 't2', 't3'],
      daysUntilDue: 2,
    });
    assert.match(c.title, /3 görev/);
    assert.match(c.body, /2 gün/);
  });

  it('invoice_overdue — body para birimi sembolü içerir (TRY)', () => {
    const c = buildNotificationContent({
      kind: 'invoice_overdue',
      invoiceCount: 5,
      totalAmount: 12345.67,
      currency: 'TRY',
    });
    assert.match(c.title, /5 fatura/);
    assert.match(c.body, /₺/);
  });

  it('invoice_overdue — USD sembolü', () => {
    const c = buildNotificationContent({
      kind: 'invoice_overdue',
      invoiceCount: 1,
      totalAmount: 1000,
      currency: 'USD',
    });
    assert.match(c.body, /\$/);
  });

  it('approval_stale — gün sayısı body\'de var', () => {
    const c = buildNotificationContent({
      kind: 'approval_stale',
      requestId: 'r-1',
      daysWaiting: 7,
      entitySummary: 'Avans #42',
    });
    assert.match(c.title, /Avans #42/);
    assert.match(c.body, /7 gündür/);
  });

  it('tax_deadline_warning — body her vergi için bir satır', () => {
    const c = buildNotificationContent({
      kind: 'tax_deadline_warning',
      taxes: [
        { name: 'KDV', deadline: '05-24', daysLeft: 5 },
        { name: 'Muhtasar', deadline: '05-26', daysLeft: 7 },
      ],
    });
    assert.match(c.title, /2 vergi/);
    assert.match(c.body, /KDV/);
    assert.match(c.body, /Muhtasar/);
  });

  it('check_due_soon — title çek sayısını içerir', () => {
    const c = buildNotificationContent({
      kind: 'check_due_soon',
      checkIds: ['c1', 'c2'],
    });
    assert.match(c.title, /2 çek/);
  });

  it('scheduled_report — frequency türkçeye çevrilir', () => {
    const c = buildNotificationContent({
      kind: 'scheduled_report',
      reportId: 'r-1',
      reportTitle: 'Aylık Cashflow',
      frequency: 'monthly',
    });
    assert.match(c.title, /Aylık Cashflow/);
    assert.match(c.body, /Aylık/);
  });

  it('generic — varsayılan başlık', () => {
    const c = buildNotificationContent({ kind: 'generic' });
    assert.equal(c.title, 'Bildirim');
    assert.equal(c.body, '');
  });
});

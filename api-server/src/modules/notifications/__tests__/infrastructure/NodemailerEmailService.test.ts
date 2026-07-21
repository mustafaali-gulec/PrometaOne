import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import nodemailer from 'nodemailer';

import { NodemailerEmailService } from '../../infrastructure/email/NodemailerEmailService.js';

describe('NodemailerEmailService', () => {
  it('send() doğru from + to + subject + html ile çağrılır', async () => {
    const transporter = nodemailer.createTransport({ jsonTransport: true });
    const service = new NodemailerEmailService(transporter, {
      from: 'Prometa One <noreply@prometa.local>',
    });

    let captured: unknown;
    transporter.on('idle', () => {});
    transporter.sendMail = (async (msg: unknown) => {
      captured = msg;
      return { messageId: 'm-1' };
    }) as unknown as typeof transporter.sendMail;

    await service.send({
      to: 'a@b.com',
      subject: 'Hi',
      text: 'plain text',
      html: '<p>html</p>',
    });

    assert.deepEqual(captured, {
      from: 'Prometa One <noreply@prometa.local>',
      to: 'a@b.com',
      subject: 'Hi',
      text: 'plain text',
      html: '<p>html</p>',
    });
  });

  it('fromName görünen adı değiştirir (adres sabit), replyTo geçer, messageId döner', async () => {
    const transporter = nodemailer.createTransport({ jsonTransport: true });
    const service = new NodemailerEmailService(transporter, {
      from: 'Prometa One <noreply@prometa.local>',
    });

    let captured: unknown;
    transporter.sendMail = (async (msg: unknown) => {
      captured = msg;
      return { messageId: 'm-42' };
    }) as unknown as typeof transporter.sendMail;

    const result = await service.send({
      to: 'a@b.com',
      subject: 'Hi',
      html: '<p>html</p>',
      fromName: 'İK Departmanı',
      replyTo: 'ik@firma.com',
    });

    assert.deepEqual(captured, {
      from: '"İK Departmanı" <noreply@prometa.local>',
      to: 'a@b.com',
      subject: 'Hi',
      html: '<p>html</p>',
      replyTo: 'ik@firma.com',
    });
    assert.deepEqual(result, { messageId: 'm-42' });
  });
});

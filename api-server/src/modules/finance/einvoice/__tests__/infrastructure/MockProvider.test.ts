/**
 * MockProvider testleri (PR 3) — port sözleşmesi + UblInvoiceParser entegrasyonu.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { CredentialConfig } from '../../domain/entities/EInvoiceCredential.js';
import { ProviderInvoiceNotFoundError } from '../../domain/errors/EInvoiceErrors.js';
import { UblInvoiceParser } from '../../domain/services/UblInvoiceParser.js';
import { MockProvider } from '../../infrastructure/provider/MockProvider.js';

const config: CredentialConfig = {
  username: 'u',
  password: 'p',
  vergiNo: '1234567890',
  env: 'test',
};

const range = { dateFrom: '2026-01-01', dateTo: '2026-12-31' };

describe('MockProvider', () => {
  it('testConnection: connectionOk=true → ok', async () => {
    const r = await MockProvider.demo().testConnection(config);
    assert.equal(r.ok, true);
  });

  it('testConnection: connectionOk=false → ok:false', async () => {
    const r = await new MockProvider([], false).testConnection(config);
    assert.equal(r.ok, false);
  });

  it('fetchInvoiceList: direction=both iki fatura döner', async () => {
    const list = await MockProvider.demo().fetchInvoiceList(config, {
      ...range,
      direction: 'both',
    });
    assert.equal(list.length, 2);
  });

  it('fetchInvoiceList: direction=incoming sadece gelen', async () => {
    const list = await MockProvider.demo().fetchInvoiceList(config, {
      ...range,
      direction: 'incoming',
    });
    assert.equal(list.length, 1);
    assert.equal(list[0]!.direction, 'incoming');
    assert.equal(list[0]!.partyName, 'Tedarikçi A.Ş.');
  });

  it('fetchInvoiceList: tarih aralığı filtreler', async () => {
    const list = await MockProvider.demo().fetchInvoiceList(config, {
      dateFrom: '2026-05-02',
      dateTo: '2026-05-31',
      direction: 'both',
    });
    assert.equal(list.length, 1); // 2026-05-01 incoming aralık dışı
    assert.equal(list[0]!.invoiceNo, 'TAS2026000001');
  });

  it('fetchInvoiceXml: seed XML döner ve UblInvoiceParser ile parse edilebilir', async () => {
    const provider = MockProvider.demo();
    const xml = await provider.fetchInvoiceXml(
      config,
      '11111111-1111-1111-1111-111111111111',
      'incoming',
    );
    const parsed = UblInvoiceParser.parse(xml, 'incoming');
    assert.equal(parsed.uuid, '11111111-1111-1111-1111-111111111111');
    assert.equal(parsed.party.vknTckn, '1234567890');
    assert.equal(parsed.subtotal.toDecimalString(), '1000.00');
    assert.equal(parsed.kdvTotal.toDecimalString(), '200.00');
    assert.equal(parsed.payableAmount.toDecimalString(), '1200.00');
  });

  it('fetchInvoiceXml: bilinmeyen uuid → ProviderInvoiceNotFoundError', async () => {
    await assert.rejects(
      MockProvider.demo().fetchInvoiceXml(config, 'yok', 'incoming'),
      ProviderInvoiceNotFoundError,
    );
  });

  it('fetchInvoiceXml: doğru uuid ama yanlış yön → not found', async () => {
    await assert.rejects(
      MockProvider.demo().fetchInvoiceXml(
        config,
        '11111111-1111-1111-1111-111111111111',
        'outgoing',
      ),
      ProviderInvoiceNotFoundError,
    );
  });
});

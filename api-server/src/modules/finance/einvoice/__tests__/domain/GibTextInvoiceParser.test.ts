/**
 * GibTextInvoiceParser testleri — GİB fatura görüntüsünün düz metni (PDF
 * çıkarımı / qrvalue'suz HTML fallback'i) → ParsedEInvoice.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { GibHtmlParseError } from '../../domain/errors/EInvoiceErrors.js';
import { GibTextInvoiceParser } from '../../domain/services/GibTextInvoiceParser.js';

const SAMPLE = `ARTI ENDÜSTRİYEL TEM. GIDA SAN. TİC. LTD. ŞTİ.
ATAPARK MAH TAŞOCAĞI CAD. NO 22/A
Vergi Dairesi: YILDIRIMBEYAZIT
VKN: 0850412471
e-FATURA
SAYIN
PROMET BİLGİ SİSTEMLERİ A.Ş
MUTLUKENT MAHALLESİ 1961 CAD.NO:56
Vergi Dairesi: BAŞKENT V.D
VKN: 7330959937
Senaryo: TICARIFATURA
Fatura Tipi: SATIS
Fatura No: ART2026000000207
Fatura Tarihi: 08-06-2026
ETTN: 50BC9324-9C87-4249-9732-470AFA291B27
Malzeme / Hizmet Toplam Tutarı 20.375,45TL
Toplam İskonto 0,00TL
KDV(%20,00- Matrah:3.804,00 TL) 760,80 TL
KDV(%1,00- Matrah:16.571,45 TL) 165,71 TL
Vergiler Dahil Toplam Tutar 21.301,96 TL
Ödenecek Tutar 21.301,96 TL
Genel Açıklamalar
Proje: SNT-2026-01 Vade: 30 gün
TR79 0006 4000 0014 2471 3684 17`;

describe('GibTextInvoiceParser', () => {
  it('başlık + taraflar + tutarlar metinden çözülür (incoming → satıcı)', () => {
    const p = GibTextInvoiceParser.parse(SAMPLE, 'incoming', SAMPLE);
    assert.equal(p.uuid, '50bc9324-9c87-4249-9732-470afa291b27');
    assert.equal(p.invoiceNo, 'ART2026000000207');
    assert.equal(p.issueDate, '2026-06-08');
    assert.equal(p.party.vknTckn, '0850412471');
    assert.match(p.party.name, /ARTI ENDÜSTRİYEL/);
    assert.equal(p.subtotal.toDecimalString(), '20375.45');
    assert.equal(p.kdvTotal.toDecimalString(), '926.51');
    assert.equal(p.payableAmount.toDecimalString(), '21301.96');
    assert.equal(p.scenario, 'TICARIFATURA');
    assert.equal(p.invoiceType, 'SATIS');
  });

  it('outgoing → SAYIN bloğundaki alıcı seçilir', () => {
    const p = GibTextInvoiceParser.parse(SAMPLE, 'outgoing', SAMPLE);
    assert.equal(p.party.vknTckn, '7330959937');
    assert.match(p.party.name, /PROMET BİLGİ SİSTEMLERİ/);
  });

  it('Genel Açıklamalar notları + vade/proje ipuçları (IBAN satırı atılır)', () => {
    const p = GibTextInvoiceParser.parse(SAMPLE, 'incoming', SAMPLE);
    assert.ok(p.notes);
    assert.match(p.notes, /Proje: SNT-2026-01/);
    assert.ok(!/TR79 0006/.test(p.notes), 'IBAN notlara sızmamalı');
    assert.equal(p.dueDate, '2026-07-08'); // 08-06-2026 + 30 gün
  });

  it('fatura kimliği yoksa GibHtmlParseError', () => {
    assert.throws(
      () => GibTextInvoiceParser.parse('alakasız serbest metin', 'incoming', 'x'),
      GibHtmlParseError,
    );
  });
});

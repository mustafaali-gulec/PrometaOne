/**
 * ImportEInvoiceFromFileUseCase testleri — elle dosya yükleme (XML + HTML).
 *
 * Format otomatik saptanır; parse edilip cache'e provider='manual' yazılır.
 * Aynı fatura iki kez yüklenirse (companyId, uuid) idempotent.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ImportEInvoiceFromFileUseCase,
  type UploadEInvoiceResult,
} from '../../application/useCases/ImportEInvoiceUseCases.js';
import { UnsupportedEInvoiceFileError } from '../../domain/errors/EInvoiceErrors.js';
import { InMemoryEInvoiceRepository } from '../einvoiceFakes.js';

const HTML = `<html><body><p id="qrvalue" style="display:none">{"vkntckn":"1700020847",
 "avkntckn":"7330959937","senaryo":"TICARIFATURA","tip":"SATIS","tarih":"2026-06-09",
 "no":"BIL2026000000193","ettn":"1714101e-30f0-4770-968a-b070f7060774","parabirimi":"TRY",
 "malhizmettoplam":"15100.00","hesaplanankdv(20)":"3020.00","vergidahil":"18120.00",
 "odenecek":"18120.00"}</p></body></html>`;

const XML = `<?xml version="1.0"?>
<Invoice xmlns:cbc="urn:cbc" xmlns:cac="urn:cac">
  <cbc:UUID>aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee</cbc:UUID>
  <cbc:ID>FT-XML-1</cbc:ID>
  <cbc:IssueDate>2026-05-01</cbc:IssueDate>
  <cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party>
    <cac:PartyIdentification><cbc:ID schemeID="VKN">1234567890</cbc:ID></cac:PartyIdentification>
    <cac:PartyName><cbc:Name>Satıcı A.Ş.</cbc:Name></cac:PartyName>
  </cac:Party></cac:AccountingSupplierParty>
  <cac:LegalMonetaryTotal><cbc:PayableAmount currencyID="TRY">1200.00</cbc:PayableAmount></cac:LegalMonetaryTotal>
</Invoice>`;

describe('ImportEInvoiceFromFileUseCase', () => {
  it("GİB HTML yükler → cache'e manual kayıt, format=html", async () => {
    const repo = new InMemoryEInvoiceRepository();
    const uc = new ImportEInvoiceFromFileUseCase(repo);
    const res: UploadEInvoiceResult = await uc.execute({ companyId: 7, content: HTML });

    assert.equal(res.format, 'html');
    assert.equal(res.invoiceNo, 'BIL2026000000193');
    const stored = await repo.findById(res.einvoiceId, 7);
    assert.ok(stored);
    assert.equal(stored.payableAmount.toDecimalString(), '18120.00');
    assert.equal(stored.direction, 'incoming'); // varsayılan
    assert.equal(stored.partyVknTckn, '1700020847');
  });

  it('UBL XML yükler → mevcut parser, format=xml', async () => {
    const repo = new InMemoryEInvoiceRepository();
    const uc = new ImportEInvoiceFromFileUseCase(repo);
    const res = await uc.execute({ companyId: 7, content: XML, direction: 'incoming' });

    assert.equal(res.format, 'xml');
    assert.equal(res.invoiceNo, 'FT-XML-1');
    const stored = await repo.findById(res.einvoiceId, 7);
    assert.equal(stored!.payableAmount.toDecimalString(), '1200.00');
  });

  it('aynı fatura iki kez yüklenir → idempotent (tek kayıt)', async () => {
    const repo = new InMemoryEInvoiceRepository();
    const uc = new ImportEInvoiceFromFileUseCase(repo);
    const a = await uc.execute({ companyId: 7, content: HTML });
    const b = await uc.execute({ companyId: 7, content: HTML });

    assert.equal(a.einvoiceId, b.einvoiceId);
    const list = await repo.listByCompany(7);
    assert.equal(list.length, 1);
  });

  it('tanınmayan içerik → UnsupportedEInvoiceFileError', async () => {
    const repo = new InMemoryEInvoiceRepository();
    const uc = new ImportEInvoiceFromFileUseCase(repo);
    await assert.rejects(
      () => uc.execute({ companyId: 7, content: 'düz metin, fatura değil' }),
      UnsupportedEInvoiceFileError,
    );
  });

  it('yanıt otomasyon bağlamı taşır: parti + notlardan vade/proje', async () => {
    const htmlWithNotes = HTML.replace(
      '</body>',
      `<table id="notesTable"><tr><td>Genel Açıklamalar</td></tr>
       <tr><td>Proje: PRJ-77 Vade: 30 gün</td></tr></table></body>`,
    );
    const repo = new InMemoryEInvoiceRepository();
    const uc = new ImportEInvoiceFromFileUseCase(repo);
    const res = await uc.execute({ companyId: 7, content: htmlWithNotes });

    assert.equal(res.direction, 'incoming');
    assert.equal(res.partyVknTckn, '1700020847');
    assert.equal(res.payableAmount, '18120.00');
    assert.equal(res.projectCode, 'PRJ-77');
    assert.equal(res.dueDate, '2026-07-09'); // 2026-06-09 + 30 gün
    assert.match(res.notes ?? '', /Proje: PRJ-77/);
  });

  it('PDF (contentBase64) → metin çıkarıcı üzerinden parse, format=pdf', async () => {
    const pdfText = `SATICI FİRMA LTD. ŞTİ.
VKN: 1112223334
SAYIN
ALICI A.Ş.
VKN: 7330959937
Fatura No: PDF2026000000001
Fatura Tarihi: 01-06-2026
ETTN: 11111111-2222-3333-4444-555555555555
Mal Hizmet Toplam Tutarı 1.000,00 TL
Ödenecek Tutar 1.200,00 TL
Genel Açıklamalar
Vade: 15 gün`;
    const fakePdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('dummy')]);
    const repo = new InMemoryEInvoiceRepository();
    const uc = new ImportEInvoiceFromFileUseCase(repo, {
      extractText: async () => pdfText,
    });
    const res = await uc.execute({ companyId: 7, contentBase64: fakePdf.toString('base64') });

    assert.equal(res.format, 'pdf');
    assert.equal(res.invoiceNo, 'PDF2026000000001');
    assert.equal(res.partyVknTckn, '1112223334'); // incoming → satıcı
    assert.equal(res.dueDate, '2026-06-16');
    const stored = await repo.findById(res.einvoiceId, 7);
    assert.equal(stored!.payableAmount.toDecimalString(), '1200.00');
  });

  it('PDF yüklenir ama extractor yapılandırılmamış → UnsupportedEInvoiceFileError', async () => {
    const repo = new InMemoryEInvoiceRepository();
    const uc = new ImportEInvoiceFromFileUseCase(repo);
    const fakePdf = Buffer.from('%PDF-1.4 dummy');
    await assert.rejects(
      () => uc.execute({ companyId: 7, contentBase64: fakePdf.toString('base64') }),
      UnsupportedEInvoiceFileError,
    );
  });

  it('contentBase64 ile gelen PDF olmayan içerik UTF-8 metin sayılır (HTML)', async () => {
    const repo = new InMemoryEInvoiceRepository();
    const uc = new ImportEInvoiceFromFileUseCase(repo);
    const res = await uc.execute({
      companyId: 7,
      contentBase64: Buffer.from(HTML, 'utf8').toString('base64'),
    });
    assert.equal(res.format, 'html');
    assert.equal(res.invoiceNo, 'BIL2026000000193');
  });
});

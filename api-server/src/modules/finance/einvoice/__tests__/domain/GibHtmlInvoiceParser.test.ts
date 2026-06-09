/**
 * GibHtmlInvoiceParser testleri — GİB e-Fatura görüntüleme HTML'i.
 *
 * Fixture'lar gerçek iki faturanın yapısını (gömülü `qrvalue` JSON + `#lineTable`)
 * sadeleştirilmiş hâliyle yansıtır:
 *   A) tek KDV oranı (%20), 1 kalem (BİLBAN benzeri)
 *   B) iki KDV oranı (%20 + %1), 2 kalem (ARTI benzeri)
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { GibHtmlParseError } from '../../domain/errors/EInvoiceErrors.js';
import { GibHtmlInvoiceParser } from '../../domain/services/GibHtmlInvoiceParser.js';

// --- Fixtures --------------------------------------------------------------

/** Tek oran (%20), 1 kalem. Matrah 15100, KDV 3020, ödenecek 18120. */
const SINGLE_RATE = `<html><head><title>e-Fatura</title></head><body>
  <h2>BİLBAN BİLGİSAYAR LTD. ŞTİ.</h2>
  <p id="qrvalue" style="display:none">{"vkntckn": "1700020847",
   "avkntckn": "7330959937",
   "senaryo": "TICARIFATURA",
   "tip": "SATIS",
   "tarih": "2026-06-09",
   "no": "BIL2026000000193",
   "ettn": "1714101e-30f0-4770-968a-b070f7060774",
   "parabirimi": "TRY",
   "malhizmettoplam": "15100.00",
   "kdvmatrah(20)": "15100.00",
   "hesaplanankdv(20)": "3020.00",
   "vergidahil": "18120.00",
   "odenecek": "18120.00"}</p>
  Sayın PROMET BİLGİ SİSTEMLERİ ANONİM ŞİRKETİ Vergi Dairesi: DOĞANBEY
  <table id="lineTable">
    <tr><td>S. No</td><td>Ürün Kodu</td><td>Mal Hizmet</td><td>Miktar</td><td>Fiyat</td><td>KDV %</td><td>KDV Tutarı</td><td>Tutar</td></tr>
    <tr><td>1</td><td>HİZ0014</td><td>FATİH PROJESİ SERVİS DESTEK BEDELİ</td><td>1 Adet</td><td>15.100,00 TL</td><td>20</td><td>3.020,00 TL</td><td>15.100,00 TL</td></tr>
  </table>
  <table id="notesTable"><tr><td>BANKA HESAP BİLGİLERİMİZ</td></tr></table>
</body></html>`;

/** İki oran (%20 + %1), 2 kalem. Ödenecek 21301.96. */
const MULTI_RATE = `<html><body>
  <h1>ARTI ENDÜSTRİYEL LTD. ŞTİ.</h1>
  <p id="qrvalue" style="display:none">{
   "vkntckn":"0850412471",
   "avkntckn":"7330959937",
   "senaryo":"TICARIFATURA",
   "tip":"SATIS",
   "tarih":"2026-06-08",
   "no":"ART2026000000207",
   "ettn":"50BC9324-9C87-4249-9732-470AFA291B27",
   "parabirimi":"TRY",
   "malhizmettoplam":"20375.45",
   "kdvmatrah(20.00)":"3804.00",
   "kdvmatrah(1.00)":"16571.45",
   "hesaplanankdv(20.00)":"760.80",
   "hesaplanankdv(1.00)":"165.71",
   "vergidahil":"21301.96",
   "odenecek":"21301.96"}</p>
  SAYIN PROMET BİLGİ SİSTEMLERİ A.Ş
  <table id="lineTable">
    <tr><td>Sıra No</td><td>Kod</td><td>Açıklama</td><td>Miktar</td><td>Birim Fiyat</td><td>KDV Oranı</td><td>KDV Tutarı</td><td>Tutar</td></tr>
    <tr><td>1</td><td>5132209</td><td>TÜRK KAHVESİ 100 GR</td><td>50,0 Paket</td><td>84,9000TL</td><td>%1,00</td><td>42,44TL</td><td>4.245,00TL</td></tr>
    <tr><td>2</td><td>6220047</td><td>BULAŞIK TABLETİ</td><td>2,0 Paket</td><td>239,9000TL</td><td>%20,00</td><td>95,96TL</td><td>479,80TL</td></tr>
  </table>
  <table id="notesTable"><tr><td>Banka Iban No</td></tr></table>
</body></html>`;

describe('GibHtmlInvoiceParser', () => {
  it("tek oran: başlık + tutarlar gömülü JSON'dan doğru parse edilir", () => {
    const p = GibHtmlInvoiceParser.parse(SINGLE_RATE, 'incoming');
    assert.equal(p.invoiceNo, 'BIL2026000000193');
    assert.equal(p.uuid, '1714101e-30f0-4770-968a-b070f7060774');
    assert.equal(p.invoiceType, 'SATIS');
    assert.equal(p.scenario, 'TICARIFATURA');
    assert.equal(p.issueDate, '2026-06-09');
    assert.equal(p.currency, 'TRY');
    assert.equal(p.subtotal.toDecimalString(), '15100.00');
    assert.equal(p.kdvTotal.toDecimalString(), '3020.00');
    assert.equal(p.payableAmount.toDecimalString(), '18120.00');
  });

  it('incoming → karşı taraf SATICI (vkntckn) seçilir', () => {
    const p = GibHtmlInvoiceParser.parse(SINGLE_RATE, 'incoming');
    assert.equal(p.party.vknTckn, '1700020847');
  });

  it('outgoing → karşı taraf ALICI (avkntckn) seçilir', () => {
    const p = GibHtmlInvoiceParser.parse(SINGLE_RATE, 'outgoing');
    assert.equal(p.party.vknTckn, '7330959937');
  });

  it('tek oran: kalem (ad, miktar, birim, oran, satır toplamı) okunur', () => {
    const p = GibHtmlInvoiceParser.parse(SINGLE_RATE, 'incoming');
    assert.equal(p.lines.length, 1);
    assert.equal(p.lines[0]!.name, 'FATİH PROJESİ SERVİS DESTEK BEDELİ');
    assert.equal(p.lines[0]!.quantity, 1);
    assert.equal(p.lines[0]!.unit, 'Adet');
    assert.equal(p.lines[0]!.kdvRatePercent, 20);
    assert.equal(p.lines[0]!.lineTotal.toDecimalString(), '15100.00');
  });

  it('çok oran: KDV oranları toplanır (760.80 + 165.71 = 926.51)', () => {
    const p = GibHtmlInvoiceParser.parse(MULTI_RATE, 'incoming');
    assert.equal(p.kdvTotal.toDecimalString(), '926.51');
    assert.equal(p.subtotal.toDecimalString(), '20375.45');
    assert.equal(p.payableAmount.toDecimalString(), '21301.96');
  });

  it('çok oran: 2 kalem, Türk biçimli tutarlar doğru çevrilir', () => {
    const p = GibHtmlInvoiceParser.parse(MULTI_RATE, 'incoming');
    assert.equal(p.lines.length, 2);
    assert.equal(p.lines[0]!.name, 'TÜRK KAHVESİ 100 GR');
    assert.equal(p.lines[0]!.quantity, 50);
    assert.equal(p.lines[0]!.unit, 'Paket');
    assert.equal(p.lines[0]!.kdvRatePercent, 1);
    assert.equal(p.lines[0]!.lineTotal.toDecimalString(), '4245.00');
    assert.equal(p.lines[1]!.kdvRatePercent, 20);
    assert.equal(p.lines[1]!.lineTotal.toDecimalString(), '479.80');
  });

  it('looksLikeGibHtml: qrvalue / <html> içeren içeriği tanır', () => {
    assert.equal(GibHtmlInvoiceParser.looksLikeGibHtml(SINGLE_RATE), true);
    assert.equal(GibHtmlInvoiceParser.looksLikeGibHtml('<Invoice>...</Invoice>'), false);
  });

  it('gömülü qrvalue yok → GibHtmlParseError', () => {
    assert.throws(
      () => GibHtmlInvoiceParser.parse('<html><body>boş</body></html>', 'incoming'),
      GibHtmlParseError,
    );
  });
});

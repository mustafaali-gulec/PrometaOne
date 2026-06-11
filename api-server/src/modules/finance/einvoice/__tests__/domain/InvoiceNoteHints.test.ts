/**
 * InvoiceNoteHints testleri — not metninden vade tarihi + proje kodu çıkarımı.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { InvoiceNoteHints } from '../../domain/services/InvoiceNoteHints.js';

describe('InvoiceNoteHints', () => {
  it('boş/null not → ipucu yok', () => {
    assert.deepEqual(InvoiceNoteHints.extract(null, '2026-06-08'), {
      dueDate: null,
      projectCode: null,
    });
    assert.deepEqual(InvoiceNoteHints.extract('   ', '2026-06-08'), {
      dueDate: null,
      projectCode: null,
    });
  });

  it('"Vade: 10.07.2026" → ISO tarihe çevirir', () => {
    const h = InvoiceNoteHints.extract('Vade: 10.07.2026', '2026-06-08');
    assert.equal(h.dueDate, '2026-07-10');
  });

  it('"VADE TARİHİ: 10/08/2026" — Türkçe büyük İ ile de eşleşir', () => {
    const h = InvoiceNoteHints.extract('VADE TARİHİ: 10/08/2026', '2026-06-08');
    assert.equal(h.dueDate, '2026-08-10');
  });

  it('"Vade: 60 gün" → fatura tarihi + 60 gün', () => {
    const h = InvoiceNoteHints.extract('Ödeme koşulu — Vade: 60 gün', '2026-06-08');
    assert.equal(h.dueDate, '2026-08-07');
  });

  it('"vade 45 gündür" serbest biçimi de yakalanır', () => {
    const h = InvoiceNoteHints.extract('Not: vade 45 gündür.', '2026-06-01');
    assert.equal(h.dueDate, '2026-07-16');
  });

  it('ISO tarih ("Vade: 2026-09-01") olduğu gibi alınır', () => {
    const h = InvoiceNoteHints.extract('Vade: 2026-09-01', '2026-06-08');
    assert.equal(h.dueDate, '2026-09-01');
  });

  it('"Proje: PRJ-2026-04" → proje kodu', () => {
    const h = InvoiceNoteHints.extract('Proje: PRJ-2026-04 kapsamında', '2026-06-08');
    assert.equal(h.projectCode, 'PRJ-2026-04');
  });

  it('"Proje Kodu= ANK/B-12." → ayraç ve kuyruk noktalaması toleranslı', () => {
    const h = InvoiceNoteHints.extract('proje kodu = ANK/B-12.', '2026-06-08');
    assert.equal(h.projectCode, 'ANK/B-12');
  });

  it('ayraçsız "proje kapsamında" yanlış pozitif ÜRETMEZ', () => {
    const h = InvoiceNoteHints.extract('Bu fatura proje kapsamında kesilmiştir', '2026-06-08');
    assert.equal(h.projectCode, null);
  });

  it('vade + proje aynı notta birlikte çıkarılır', () => {
    const h = InvoiceNoteHints.extract('Proje: SNT-01 | Vade: 30 gün', '2026-06-10');
    assert.equal(h.projectCode, 'SNT-01');
    assert.equal(h.dueDate, '2026-07-10');
  });
});

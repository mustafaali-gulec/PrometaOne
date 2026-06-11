-- ============================================================================
-- 031_einvoice_notes.sql — einvoice_invoices.notes
-- ============================================================================
-- Fatura not/açıklama metni (GİB "Genel Açıklamalar" / UBL cbc:Note).
-- Vade ("Vade: 60 gün") ve proje kodu ("Proje: PRJ-001") ipuçları bu metinden
-- türetilir; ham metin yeniden-türetme ve denetim için saklanır.
-- ============================================================================

ALTER TABLE einvoice_invoices
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================================================
-- /031_einvoice_notes.sql
-- ============================================================================

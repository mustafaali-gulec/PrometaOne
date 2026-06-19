/**
 * AuxDocKind — yardımcı WMS belge türü ve no öneki.
 *
 * Belge no formatı: PREFIX-YYYY-NNNN (stok hareketi no deseniyle aynı).
 *   request → TLP  (Malzeme Talep)
 *   count   → SAY  (Envanter Sayım)
 *   assignment → ZMT (Zimmet)
 *
 * Sıra (sequence) StockMovementRepository.nextSequence ile değil, ilgili
 * aux repository'nin nextSequence'i ile üretilir (her belge türü kendi
 * tablosunda sayılır).
 */
export type AuxDocKind = 'request' | 'count' | 'assignment';

export const AUX_DOC_NO_PREFIX: Readonly<Record<AuxDocKind, string>> = {
  request: 'TLP',
  count: 'SAY',
  assignment: 'ZMT',
};

/** PREFIX-YYYY-NNNN belge no üretir. */
export function formatAuxDocNo(kind: AuxDocKind, year: number, seq: number): string {
  return `${AUX_DOC_NO_PREFIX[kind]}-${year}-${String(seq).padStart(4, '0')}`;
}

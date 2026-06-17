/**
 * PartyRepository — cari kartı kalıcılık portu.
 *
 * upsertMany / replaceAll atomiktir (tek transaction). Bulk-import use-case
 * mode'a göre bunlardan birini çağırır.
 */
import type { Party } from '../../domain/entities/Party.js';

export interface PartyRepository {
  /** Şirketin tüm cari kartları (code sırasıyla). */
  listByCompany(companyId: number): Promise<Party[]>;

  /** (company_id, code) çakışmasında günceller, yoksa ekler. Tek transaction. */
  upsertMany(records: ReadonlyArray<Party>): Promise<void>;

  /** Şirketin tüm carilerini siler, sonra verilenleri ekler. Atomik. Silinen satır sayısını döner. */
  replaceAll(companyId: number, records: ReadonlyArray<Party>): Promise<number>;
}

/**
 * BulkImportPartiesUseCase — Excel/CSV'den gelen carileri toplu içe aktarır.
 *
 * Mod:
 *  - only_new    : mevcut (code veya VKN/TCKN eşleşen) cariler atlanır.
 *  - merge       : mevcutlar güncellenir, yeniler eklenir.
 *  - replace_all : şirketin tüm carileri silinir, sadece gelenler kalır.
 *
 * Eşleştirme önce `code`, yoksa `taxId` ile yapılır (frontend ile aynı kural).
 */
import { randomUUID } from 'node:crypto';

import { Party } from '../../domain/entities/Party.js';
import type {
  BulkImportPartiesRequestDto,
  BulkImportPartiesResultDto,
  PartyImportItemDto,
} from '../dto/PartyDto.js';
import type { PartyRepository } from '../ports/PartyRepository.js';

export class BulkImportPartiesUseCase {
  constructor(private readonly parties: PartyRepository) {}

  async execute(input: BulkImportPartiesRequestDto): Promise<BulkImportPartiesResultDto> {
    const items = input.parties;

    const toParty = (it: PartyImportItemDto, id: string, code: string): Party =>
      Party.create({
        id,
        companyId: input.companyId,
        code,
        name: it.name,
        type: it.type,
        personType: it.personType ?? null,
        taxId: it.taxId ?? null,
        status: it.status ?? 'active',
        data: it.data ?? {},
      });

    const newId = (it: PartyImportItemDto): string =>
      it.id && it.id.trim() ? it.id.trim() : `party_${randomUUID()}`;

    // --- replace_all: sil + topluca ekle ---
    if (input.mode === 'replace_all') {
      const records = items.map((it) => toParty(it, newId(it), it.code));
      const deleted = await this.parties.replaceAll(input.companyId, records);
      return { total: items.length, created: records.length, updated: 0, deleted, skipped: 0 };
    }

    // --- only_new / merge: mevcutlarla karşılaştır ---
    const existing = await this.parties.listByCompany(input.companyId);
    const byCode = new Map(existing.map((p) => [p.code, p]));
    const byTax = new Map(existing.filter((p) => p.taxId).map((p) => [p.taxId as string, p]));

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const records: Party[] = [];

    for (const it of items) {
      const match =
        (it.code ? byCode.get(it.code) : undefined) ??
        (it.taxId ? byTax.get(it.taxId) : undefined) ??
        null;

      if (match) {
        if (input.mode === 'only_new') {
          skipped += 1;
          continue;
        }
        // Mevcut id + code korunur (taxId ile eşleşmiş olabilir).
        records.push(toParty(it, match.id, match.code));
        updated += 1;
      } else {
        records.push(toParty(it, newId(it), it.code));
        created += 1;
      }
    }

    if (records.length > 0) await this.parties.upsertMany(records);
    return { total: items.length, created, updated, deleted: 0, skipped };
  }
}

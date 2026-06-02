/**
 * Party mapping use-case'leri: MapParty (upsert), ListUnmappedParties.
 */
import { PartyMapping } from '../../domain/entities/PartyMapping.js';
import type { EInvoiceRepository, PartyMappingRepository } from '../ports/EInvoiceRepositories.js';

export interface MapPartyInput {
  companyId: number;
  vknTckn: string;
  displayName?: string | null;
  cashflowCatId?: number | null;
  autoImport?: boolean;
  notes?: string | null;
}

export class MapPartyUseCase {
  constructor(private readonly mappings: PartyMappingRepository) {}

  async execute(input: MapPartyInput): Promise<PartyMapping> {
    const existing = await this.mappings.findByVkn(input.companyId, input.vknTckn);
    const mapping = PartyMapping.create({
      id: existing?.id ?? null,
      companyId: input.companyId,
      vknTckn: input.vknTckn,
      displayName: input.displayName ?? null,
      cashflowCatId: input.cashflowCatId ?? null,
      autoImport: input.autoImport ?? false,
      notes: input.notes ?? null,
    });
    return this.mappings.upsert(mapping);
  }
}

export interface UnmappedParty {
  vknTckn: string;
  partyName: string | null;
  count: number;
}

export class ListUnmappedPartiesUseCase {
  constructor(
    private readonly einvoices: EInvoiceRepository,
    private readonly mappings: PartyMappingRepository,
  ) {}

  /** Cache'te görünen ama party mapping'i olmayan VKN'leri sayımıyla döner. */
  async execute(input: { companyId: number }): Promise<UnmappedParty[]> {
    const [invoices, mapped] = await Promise.all([
      this.einvoices.listByCompany(input.companyId),
      this.mappings.listByCompany(input.companyId),
    ]);
    const mappedVkns = new Set(mapped.map((m) => m.vknTckn));

    const grouped = new Map<string, UnmappedParty>();
    for (const inv of invoices) {
      const vkn = inv.partyVknTckn;
      if (vkn === null || mappedVkns.has(vkn)) continue;
      const current = grouped.get(vkn);
      if (current) {
        current.count += 1;
      } else {
        grouped.set(vkn, { vknTckn: vkn, partyName: inv.partyName, count: 1 });
      }
    }
    return [...grouped.values()];
  }
}

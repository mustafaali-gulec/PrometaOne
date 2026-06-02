/**
 * E-Fatura içe aktarma use-case'leri: Import (UoW atomik), Ignore, List.
 *
 * ImportEInvoice: cache kaydını Faz 5 `invoices` tablosuna aktarır. Party
 * mapping'den cashflow kategorisi alınır. Faturanın oluşturulması + cache
 * kaydının "imported" işaretlenmesi TEK transaction'da (EInvoiceUnitOfWork).
 */
import type { Clock } from '../../../application/ports/Clock.js';
import type { EInvoice } from '../../domain/entities/EInvoice.js';
import {
  EInvoiceAlreadyImportedError,
  EInvoiceNotFoundError,
} from '../../domain/errors/EInvoiceErrors.js';
import { EInvoiceToInvoicePolicy } from '../../domain/services/EInvoiceToInvoicePolicy.js';
import type { InvoiceDirection } from '../../domain/valueObjects/InvoiceDirection.js';
import type { EInvoiceRepository, PartyMappingRepository } from '../ports/EInvoiceRepositories.js';
import type { EInvoiceUnitOfWork } from '../ports/EInvoiceUnitOfWork.js';

export interface ImportEInvoiceResult {
  einvoiceId: number;
  invoiceId: number;
}

export class ImportEInvoiceUseCase {
  constructor(
    private readonly uow: EInvoiceUnitOfWork,
    private readonly partyMappings: PartyMappingRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    companyId: number;
    einvoiceId: number;
    /** Açıkça verilen kategori; yoksa party mapping'ten çözülür. */
    cashflowCatId?: number | null;
    actorUserId: number | null;
  }): Promise<ImportEInvoiceResult> {
    const now = this.clock.now();
    return this.uow.withTransaction(async (repos) => {
      const einvoice = await repos.einvoices.findById(input.einvoiceId, input.companyId);
      if (!einvoice) {
        throw new EInvoiceNotFoundError(input.einvoiceId);
      }
      if (einvoice.isImported) {
        throw new EInvoiceAlreadyImportedError(input.einvoiceId);
      }

      let cashflowCatId = input.cashflowCatId ?? null;
      if (cashflowCatId === null && einvoice.partyVknTckn !== null) {
        const mapping = await this.partyMappings.findByVkn(input.companyId, einvoice.partyVknTckn);
        cashflowCatId = mapping?.cashflowCatId ?? null;
      }

      const invoice = EInvoiceToInvoicePolicy.toInvoice(einvoice, {
        cashflowCatId,
        createdBy: input.actorUserId,
        now,
      });
      const persistedInvoice = await repos.invoices.insert(invoice);
      await repos.einvoices.update(einvoice.markImported(persistedInvoice.id!));

      return { einvoiceId: input.einvoiceId, invoiceId: persistedInvoice.id! };
    });
  }
}

export class IgnoreEInvoiceUseCase {
  constructor(private readonly einvoices: EInvoiceRepository) {}

  async execute(input: {
    companyId: number;
    einvoiceId: number;
    reason?: string | null;
  }): Promise<void> {
    const einvoice = await this.einvoices.findById(input.einvoiceId, input.companyId);
    if (!einvoice) {
      throw new EInvoiceNotFoundError(input.einvoiceId);
    }
    await this.einvoices.update(einvoice.markIgnored(input.reason ?? null));
  }
}

export class ListEInvoicesUseCase {
  constructor(private readonly einvoices: EInvoiceRepository) {}

  execute(input: {
    companyId: number;
    direction?: InvoiceDirection;
    pendingOnly?: boolean;
  }): Promise<ReadonlyArray<EInvoice>> {
    return this.einvoices.listByCompany(input.companyId, {
      ...(input.direction !== undefined ? { direction: input.direction } : {}),
      ...(input.pendingOnly !== undefined ? { pendingOnly: input.pendingOnly } : {}),
    });
  }
}

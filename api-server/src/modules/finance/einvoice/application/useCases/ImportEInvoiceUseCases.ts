/**
 * E-Fatura içe aktarma use-case'leri: Import (UoW atomik), Ignore, List.
 *
 * ImportEInvoice: cache kaydını Faz 5 `invoices` tablosuna aktarır. Party
 * mapping'den cashflow kategorisi alınır. Faturanın oluşturulması + cache
 * kaydının "imported" işaretlenmesi TEK transaction'da (EInvoiceUnitOfWork).
 */
import type { Clock } from '../../../application/ports/Clock.js';
import { EInvoice } from '../../domain/entities/EInvoice.js';
import {
  EInvoiceAlreadyImportedError,
  EInvoiceNotFoundError,
  UnsupportedEInvoiceFileError,
} from '../../domain/errors/EInvoiceErrors.js';
import { EInvoiceToInvoicePolicy } from '../../domain/services/EInvoiceToInvoicePolicy.js';
import { GibHtmlInvoiceParser } from '../../domain/services/GibHtmlInvoiceParser.js';
import { GibTextInvoiceParser } from '../../domain/services/GibTextInvoiceParser.js';
import { InvoiceNoteHints } from '../../domain/services/InvoiceNoteHints.js';
import { UblInvoiceParser } from '../../domain/services/UblInvoiceParser.js';
import type { InvoiceDirection } from '../../domain/valueObjects/InvoiceDirection.js';
import type { EInvoiceRepository, PartyMappingRepository } from '../ports/EInvoiceRepositories.js';
import type { EInvoiceUnitOfWork } from '../ports/EInvoiceUnitOfWork.js';
import type { PdfTextExtractor } from '../ports/PdfTextExtractor.js';

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

export interface UploadEInvoiceResult {
  einvoiceId: number;
  uuid: string;
  invoiceNo: string;
  format: 'xml' | 'html' | 'pdf';
  /** Frontend otomasyonu (cari eşleme/oluşturma, proje, vade) için zengin bağlam. */
  direction: InvoiceDirection;
  partyVknTckn: string | null;
  partyName: string | null;
  issueDate: string;
  dueDate: string | null;
  currency: string;
  subtotal: string;
  kdvTotal: string;
  payableAmount: string;
  notes: string | null;
  /** Notlardan türetilen proje kodu ("Proje: PRJ-001") — yoksa null. */
  projectCode: string | null;
  /** Kalemler (transient) — ileride malzeme/hizmet kartı eşlemesi için. */
  lines: ReadonlyArray<Record<string, unknown>>;
}

/**
 * ImportEInvoiceFromFileUseCase — elle yüklenen bir UBL XML, GİB e-Fatura HTML
 * veya GİB e-Fatura/e-Arşiv PDF dosyasını parse edip cache'e
 * (einvoice_invoices) `provider='manual'` olarak yazar. Sonrasında kullanıcı
 * normal "Aktar" akışıyla `invoices`'a geçirir. (companyId, uuid) UNIQUE
 * üzerinden idempotent — aynı fatura iki kez yüklenirse mevcut kayıt güncellenir.
 *
 * PDF için içerik base64 gelir (contentBase64); metin pdfText port'u ile
 * çıkarılıp GibTextInvoiceParser'a verilir.
 */
export class ImportEInvoiceFromFileUseCase {
  constructor(
    private readonly einvoices: EInvoiceRepository,
    private readonly pdfText?: PdfTextExtractor,
  ) {}

  async execute(input: {
    companyId: number;
    /** UTF-8 metin içerik (HTML/XML). */
    content?: string;
    /** İkili içerik (PDF) — base64. Verilirse content yok sayılır. */
    contentBase64?: string;
    /** İndirilen gelen faturalar için varsayılan 'incoming'. */
    direction?: InvoiceDirection;
  }): Promise<UploadEInvoiceResult> {
    const direction = input.direction ?? 'incoming';

    let format: 'xml' | 'html' | 'pdf';
    let parsed;
    if (input.contentBase64 !== undefined && input.contentBase64 !== '') {
      const buf = Buffer.from(input.contentBase64, 'base64');
      if (buf.subarray(0, 5).toString('latin1') === '%PDF-') {
        if (!this.pdfText) {
          throw new UnsupportedEInvoiceFileError('PDF metin çıkarıcı yapılandırılmamış');
        }
        const text = await this.pdfText.extractText(buf);
        format = 'pdf';
        parsed = GibTextInvoiceParser.parse(text, direction, text);
      } else {
        // base64 ile gelen ama PDF olmayan içerik: UTF-8 metin say.
        const content = buf.toString('utf8').trim();
        format = detectFormat(content);
        parsed =
          format === 'xml'
            ? UblInvoiceParser.parse(content, direction)
            : GibHtmlInvoiceParser.parse(content, direction);
      }
    } else {
      const content = (input.content ?? '').trim();
      if (content === '') {
        throw new UnsupportedEInvoiceFileError('içerik boş — content veya contentBase64 gerekli');
      }
      format = detectFormat(content);
      parsed =
        format === 'xml'
          ? UblInvoiceParser.parse(content, direction)
          : GibHtmlInvoiceParser.parse(content, direction);
    }

    const stored = await this.einvoices.upsert(
      EInvoice.fromParsed(parsed, {
        companyId: input.companyId,
        provider: 'manual',
        gibStatus: null,
      }),
    );

    const projectCode = InvoiceNoteHints.extract(stored.notes, stored.issueDate).projectCode;

    return {
      einvoiceId: stored.id!,
      uuid: stored.uuid,
      invoiceNo: stored.invoiceNo,
      format,
      direction: stored.direction,
      partyVknTckn: stored.partyVknTckn,
      partyName: stored.partyName,
      issueDate: stored.issueDate,
      dueDate: stored.dueDate,
      currency: stored.currency,
      subtotal: stored.subtotal.toDecimalString(),
      kdvTotal: stored.kdvTotal.toDecimalString(),
      payableAmount: stored.payableAmount.toDecimalString(),
      notes: stored.notes,
      projectCode,
      lines: parsed.lines.map((l) => l.toJSON() as Record<string, unknown>),
    };
  }
}

/** Dosya içeriğinden UBL XML mi GİB HTML mi olduğunu saptar. */
function detectFormat(content: string): 'xml' | 'html' {
  // Önce HTML görüntü dosyası mı? (gömülü qrvalue / <html>)
  if (GibHtmlInvoiceParser.looksLikeGibHtml(content)) return 'html';
  // UBL XML: <Invoice> kökü (namespace prefix'li olabilir).
  if (/<(?:[A-Za-z0-9]+:)?Invoice[\s>]/.test(content)) return 'xml';
  throw new UnsupportedEInvoiceFileError('içerik UBL <Invoice> veya GİB HTML değil');
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

/**
 * Gider Kartı (master) use-case'leri.
 *
 * CreateExpenseCard kod verilmezse şirket bazında otomatik kod üretir
 * (GK0001, GK0002...). BulkUpsert kasa import'unun tespit ettiği distinct
 * kalemleri toplu eşler/oluşturur (kod ya da isim eşleşmesi).
 */
import type { ExpenseCardAttributes, FlowDirection } from '../../domain/entities/ExpenseCard.js';
import {
  DuplicateExpenseCardCodeError,
  ExpenseCardNotFoundError,
} from '../../domain/errors/ExpenseErrors.js';
import { toExpenseCardDto, type ExpenseCardDto } from '../dto/ExpenseCardDtos.js';
import type { Clock } from '../ports/Clock.js';
import type { ExpenseCardRepository } from '../ports/ExpenseCardRepository.js';

const CODE_PREFIX = 'GK';

/**
 * Eşleme anahtarı — Türkçe karakterlerde tutarlı olması için locale-aware
 * uppercase kullanılır (İ/i, I/ı problemini önler; toLowerCase combining-dot
 * üretebilir).
 */
function normKey(s: string): string {
  return s.trim().toLocaleUpperCase('tr-TR');
}

/** GK000n kodlarından en yüksek numarayı bulur, +1 döner. */
async function nextExpenseCardCode(
  cards: ExpenseCardRepository,
  companyId: number,
): Promise<string> {
  const existing = await cards.list({ companyId, includeInactive: true });
  let max = 0;
  for (const c of existing) {
    const m = /^GK0*(\d+)$/i.exec(c.code.trim());
    if (m) {
      const n = parseInt(m[1]!, 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return `${CODE_PREFIX}${String(max + 1).padStart(4, '0')}`;
}

export interface CreateExpenseCardInput {
  companyId: number;
  name: string;
  code?: string | undefined;
  category?: string | undefined;
  direction?: FlowDirection | undefined;
  defaultAccountCode?: string | null | undefined;
  note?: string | null | undefined;
  attributes?: ExpenseCardAttributes | undefined;
  createdBy?: number | null | undefined;
}

export class CreateExpenseCardUseCase {
  constructor(private readonly cards: ExpenseCardRepository) {}

  async execute(input: CreateExpenseCardInput): Promise<ExpenseCardDto> {
    const code = input.code?.trim() || (await nextExpenseCardCode(this.cards, input.companyId));

    if (await this.cards.findByCode(code, input.companyId)) {
      throw new DuplicateExpenseCardCodeError(code);
    }

    const created = await this.cards.insert({
      companyId: input.companyId,
      code,
      name: input.name.trim(),
      category: (input.category ?? '').trim(),
      direction: input.direction ?? 'out',
      defaultAccountCode: input.defaultAccountCode?.trim() || null,
      note: input.note?.trim() || null,
      attributes: input.attributes ?? {},
      createdBy: input.createdBy ?? null,
    });
    return toExpenseCardDto(created);
  }
}

export interface ListExpenseCardsInput {
  companyId: number;
  includeInactive?: boolean;
  search?: string;
}

export class ListExpenseCardsUseCase {
  constructor(private readonly cards: ExpenseCardRepository) {}

  async execute(input: ListExpenseCardsInput): Promise<ExpenseCardDto[]> {
    const list = await this.cards.list({
      companyId: input.companyId,
      ...(input.includeInactive !== undefined ? { includeInactive: input.includeInactive } : {}),
      ...(input.search !== undefined ? { search: input.search } : {}),
    });
    return list.map(toExpenseCardDto);
  }
}

export interface UpdateExpenseCardInput {
  companyId: number;
  cardId: number;
  name?: string | undefined;
  category?: string | undefined;
  direction?: FlowDirection | undefined;
  defaultAccountCode?: string | null | undefined;
  note?: string | null | undefined;
  attributes?: ExpenseCardAttributes | undefined;
}

export class UpdateExpenseCardUseCase {
  constructor(
    private readonly cards: ExpenseCardRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateExpenseCardInput): Promise<ExpenseCardDto> {
    const card = await this.cards.findById(input.cardId, input.companyId);
    if (!card) throw new ExpenseCardNotFoundError(input.cardId);
    const updated = card.update(
      {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.direction !== undefined ? { direction: input.direction } : {}),
        ...(input.defaultAccountCode !== undefined
          ? { defaultAccountCode: input.defaultAccountCode }
          : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
        ...(input.attributes !== undefined ? { attributes: input.attributes } : {}),
      },
      this.clock.now(),
    );
    await this.cards.update(updated);
    return toExpenseCardDto(updated);
  }
}

export interface DeactivateExpenseCardInput {
  companyId: number;
  cardId: number;
}

export class DeactivateExpenseCardUseCase {
  constructor(
    private readonly cards: ExpenseCardRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: DeactivateExpenseCardInput): Promise<ExpenseCardDto> {
    const card = await this.cards.findById(input.cardId, input.companyId);
    if (!card) throw new ExpenseCardNotFoundError(input.cardId);
    const deactivated = card.deactivate(this.clock.now());
    await this.cards.update(deactivated);
    return toExpenseCardDto(deactivated);
  }
}

export interface BulkUpsertCardInput {
  code?: string | null | undefined;
  name: string;
  category?: string | undefined;
  direction?: FlowDirection | undefined;
}

export interface BulkUpsertExpenseCardsInput {
  companyId: number;
  actorUserId?: number | null | undefined;
  cards: BulkUpsertCardInput[];
}

export interface BulkUpsertExpenseCardsResult {
  cards: ExpenseCardDto[];
  created: number;
  matched: number;
}

export class BulkUpsertExpenseCardsUseCase {
  constructor(private readonly cards: ExpenseCardRepository) {}

  async execute(input: BulkUpsertExpenseCardsInput): Promise<BulkUpsertExpenseCardsResult> {
    // Aktif kartları (kod + isim) eşleme için indeksle.
    const existing = await this.cards.list({ companyId: input.companyId });
    const byCode = new Map<string, (typeof existing)[number]>();
    const byName = new Map<string, (typeof existing)[number]>();
    for (const c of existing) {
      byCode.set(normKey(c.code), c);
      byName.set(normKey(c.name), c);
    }

    const result: ExpenseCardDto[] = [];
    let created = 0;
    let matched = 0;

    for (const item of input.cards) {
      const name = item.name.trim();
      if (name.length === 0) continue;
      const category = (item.category ?? '').trim();
      const direction: FlowDirection = item.direction ?? 'out';
      const codeKey = item.code?.trim() ? normKey(item.code) : undefined;

      const found = (codeKey ? byCode.get(codeKey) : undefined) ?? byName.get(normKey(name));

      if (found) {
        matched += 1;
        // Kategori daha önce boşsa, gelen değerle doldur.
        if (found.category.trim().length === 0 && category.length > 0) {
          const updated = found.update({ category }, found.updatedAt);
          await this.cards.update(updated);
          byCode.set(normKey(updated.code), updated);
          byName.set(normKey(updated.name), updated);
          result.push(toExpenseCardDto(updated));
        } else {
          result.push(toExpenseCardDto(found));
        }
        continue;
      }

      // Yeni kart — otomatik kod (verilmemişse) ile oluştur.
      const code = item.code?.trim() || (await nextExpenseCardCode(this.cards, input.companyId));
      const inserted = await this.cards.insert({
        companyId: input.companyId,
        code,
        name,
        category,
        direction,
        defaultAccountCode: null,
        note: null,
        attributes: {},
        createdBy: input.actorUserId ?? null,
      });
      created += 1;
      byCode.set(normKey(inserted.code), inserted);
      byName.set(normKey(inserted.name), inserted);
      result.push(toExpenseCardDto(inserted));
    }

    return { cards: result, created, matched };
  }
}

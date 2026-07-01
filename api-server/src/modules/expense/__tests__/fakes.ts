/**
 * Expense use-case testleri için in-memory fake repository'ler.
 * Production Pg* repository'lerin sözleşmesini taklit eder (kod auto-gen dahil).
 */
import type { Clock } from '../application/ports/Clock.js';
import type {
  ExpenseCardRepository,
  ListExpenseCardsOptions,
  NewExpenseCardInput,
} from '../application/ports/ExpenseCardRepository.js';
import { ExpenseCard } from '../domain/entities/ExpenseCard.js';

const FIXED = new Date('2026-06-05T00:00:00.000Z');

export class FixedClock implements Clock {
  constructor(private readonly fixed: Date = FIXED) {}
  now(): Date {
    return this.fixed;
  }
}

export class InMemoryExpenseCardRepository implements ExpenseCardRepository {
  private seq = 0;
  private readonly store = new Map<number, ExpenseCard>();

  async insert(input: NewExpenseCardInput): Promise<ExpenseCard> {
    this.seq += 1;
    const code = input.code.trim() || this.nextCode(input.companyId);
    const card = ExpenseCard.create({
      id: this.seq,
      companyId: input.companyId,
      code,
      name: input.name,
      category: input.category,
      direction: input.direction,
      defaultAccountCode: input.defaultAccountCode,
      note: input.note,
      attributes: input.attributes ?? {},
      active: true,
      createdBy: input.createdBy,
      createdAt: FIXED,
      updatedAt: FIXED,
    });
    this.store.set(card.id, card);
    return card;
  }

  async update(card: ExpenseCard): Promise<void> {
    this.store.set(card.id, card);
  }

  async findById(id: number, companyId: number): Promise<ExpenseCard | null> {
    const c = this.store.get(id);
    return c && c.companyId === companyId ? c : null;
  }

  async findByCode(code: string, companyId: number): Promise<ExpenseCard | null> {
    return (
      [...this.store.values()].find((c) => c.companyId === companyId && c.code === code) ?? null
    );
  }

  async list(options: ListExpenseCardsOptions): Promise<ReadonlyArray<ExpenseCard>> {
    let list = [...this.store.values()].filter((c) => c.companyId === options.companyId);
    if (options.includeInactive !== true) list = list.filter((c) => c.active);
    if (options.search) {
      const q = options.search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** GK000n auto-gen — şirket bazında en yüksek + 1. */
  private nextCode(companyId: number): string {
    let max = 0;
    for (const c of this.store.values()) {
      if (c.companyId !== companyId) continue;
      const m = /^GK0*(\d+)$/i.exec(c.code.trim());
      if (m) {
        const n = parseInt(m[1]!, 10);
        if (!Number.isNaN(n) && n > max) max = n;
      }
    }
    return `GK${String(max + 1).padStart(4, '0')}`;
  }
}

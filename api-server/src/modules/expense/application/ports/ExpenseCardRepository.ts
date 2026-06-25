/**
 * ExpenseCardRepository — gider kartı (master) kalıcılık portu.
 * Concrete: infrastructure/persistence/PgExpenseCardRepository.ts
 */
import type { ExpenseCard, FlowDirection } from '../../domain/entities/ExpenseCard.js';

export interface NewExpenseCardInput {
  companyId: number;
  code: string;
  name: string;
  category: string;
  direction: FlowDirection;
  defaultAccountCode: string | null;
  note: string | null;
  createdBy: number | null;
}

export interface ListExpenseCardsOptions {
  companyId: number;
  includeInactive?: boolean;
  search?: string;
}

export interface ExpenseCardRepository {
  insert(input: NewExpenseCardInput): Promise<ExpenseCard>;
  update(card: ExpenseCard): Promise<void>;
  findById(id: number, companyId: number): Promise<ExpenseCard | null>;
  findByCode(code: string, companyId: number): Promise<ExpenseCard | null>;
  list(options: ListExpenseCardsOptions): Promise<ReadonlyArray<ExpenseCard>>;
}

/**
 * ExpenseCard DTO'ları — REST sınırında kullanılan düz tipler.
 */
import type { ExpenseCard, FlowDirection } from '../../domain/entities/ExpenseCard.js';

export interface ExpenseCardDto {
  id: number;
  companyId: number;
  code: string;
  name: string;
  category: string;
  direction: FlowDirection;
  defaultAccountCode: string | null;
  note: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toExpenseCardDto(c: ExpenseCard): ExpenseCardDto {
  const j = c.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    code: j.code,
    name: j.name,
    category: j.category,
    direction: j.direction,
    defaultAccountCode: j.defaultAccountCode,
    note: j.note,
    active: j.active,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}

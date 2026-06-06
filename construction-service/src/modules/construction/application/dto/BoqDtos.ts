/**
 * Keşif (BoQ) DTO'ları — satırlar + toplamlar.
 */
import type { BoqLine } from '../../domain/entities/BoqLine.js';

export interface BoqLineDto {
  id: number;
  contractId: number;
  groupId: number | null;
  pozId: number | null;
  lineNo: number;
  pozNo: string | null;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  pursantajPct: number;
}

export interface BoqDto {
  contractId: number;
  lines: BoqLineDto[];
  totalAmount: number;
  pursantajTotal: number;
}

export function toBoqLineDto(l: BoqLine): BoqLineDto {
  const j = l.toJSON();
  return {
    id: j.id,
    contractId: j.contractId,
    groupId: j.groupId,
    pozId: j.pozId,
    lineNo: j.lineNo,
    pozNo: j.pozNo,
    description: j.description,
    unit: j.unit,
    quantity: j.quantity,
    unitPrice: j.unitPrice,
    amount: j.amount,
    pursantajPct: j.pursantajPct,
  };
}

export function toBoqDto(contractId: number, lines: ReadonlyArray<BoqLine>): BoqDto {
  const dtos = lines.map(toBoqLineDto);
  const totalAmount =
    Math.round((dtos.reduce((s, l) => s + l.amount, 0) + Number.EPSILON) * 100) / 100;
  const pursantajTotal =
    Math.round((dtos.reduce((s, l) => s + l.pursantajPct, 0) + Number.EPSILON) * 1e6) / 1e6;
  return { contractId, lines: dtos, totalAmount, pursantajTotal };
}

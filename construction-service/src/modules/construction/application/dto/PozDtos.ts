/**
 * Poz (birim fiyat katalog) DTO'ları.
 */
import type { Poz } from '../../domain/entities/Poz.js';

export interface PozDto {
  id: number;
  companyId: number;
  pozNo: string;
  name: string;
  unit: string;
  unitPrice: number;
  source: string | null;
  year: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toPozDto(p: Poz): PozDto {
  const j = p.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    pozNo: j.pozNo,
    name: j.name,
    unit: j.unit,
    unitPrice: j.unitPrice,
    source: j.source,
    year: j.year,
    active: j.active,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}

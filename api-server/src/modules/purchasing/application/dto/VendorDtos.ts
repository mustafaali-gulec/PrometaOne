/**
 * Vendor DTO'ları — REST sınırında kullanılan düz tipler.
 */
import type { CariClass, PersonType, Vendor } from '../../domain/entities/Vendor.js';

export interface VendorDto {
  id: number;
  companyId: number;
  code: string;
  name: string;
  taxId: string | null;
  personType: PersonType;
  cariClass: CariClass;
  accountCode: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toVendorDto(v: Vendor): VendorDto {
  const j = v.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    code: j.code,
    name: j.name,
    taxId: j.taxId,
    personType: j.personType,
    cariClass: j.cariClass,
    accountCode: j.accountCode,
    active: j.active,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}

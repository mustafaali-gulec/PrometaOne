/**
 * VendorRepository — tedarikçi (cari) kalıcılık portu.
 * Concrete: infrastructure/persistence/PgVendorRepository.ts
 */
import type { CariClass, PersonType, Vendor } from '../../domain/entities/Vendor.js';

export interface NewVendorInput {
  companyId: number;
  code: string;
  name: string;
  taxId: string | null;
  taxOffice: string | null;
  address: string | null;
  personType: PersonType;
  cariClass: CariClass;
  accountCode: string | null;
  createdBy: number | null;
}

export interface ListVendorsOptions {
  includeInactive?: boolean;
  search?: string;
}

export interface VendorRepository {
  insert(input: NewVendorInput): Promise<Vendor>;
  update(vendor: Vendor): Promise<void>;
  findById(id: number, companyId: number): Promise<Vendor | null>;
  listByCompany(companyId: number, options?: ListVendorsOptions): Promise<ReadonlyArray<Vendor>>;
  existsByCode(companyId: number, code: string, excludeId?: number): Promise<boolean>;
}

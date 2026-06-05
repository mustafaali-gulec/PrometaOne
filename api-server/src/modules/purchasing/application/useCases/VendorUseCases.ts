/**
 * Tedarikçi (cari) use-case'leri.
 *
 * CreateVendor kod verilmezse cari sınıfına göre otomatik kod üretir
 * (satici → 320.Axxx, alici → 120.Axxx) ve accountCode'u koda eşitler —
 * frontend hızlı oluşturma davranışıyla hizalı (cari hesap ilişkisi).
 */
import type { CariClass, PersonType } from '../../domain/entities/Vendor.js';
import {
  DuplicateVendorCodeError,
  VendorNotFoundError,
} from '../../domain/errors/PurchasingErrors.js';
import { toVendorDto, type VendorDto } from '../dto/VendorDtos.js';
import type { Clock } from '../ports/Clock.js';
import type { ListVendorsOptions, VendorRepository } from '../ports/VendorRepository.js';

function mainCodeFor(cariClass: CariClass): string {
  return cariClass === 'alici' ? '120' : '320';
}

async function nextVendorCode(
  vendors: VendorRepository,
  companyId: number,
  prefix: string,
): Promise<string> {
  const existing = await vendors.listByCompany(companyId, { includeInactive: true });
  let max = 0;
  for (const v of existing) {
    if (!v.code.startsWith(prefix)) continue;
    const m = /\.A?0*(\d+)$/i.exec(v.code);
    if (m) {
      const n = parseInt(m[1]!, 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return `${prefix}.A${String(max + 1).padStart(3, '0')}`;
}

export interface CreateVendorInput {
  companyId: number;
  name: string;
  code?: string | undefined;
  taxId?: string | null | undefined;
  personType?: PersonType | undefined;
  cariClass?: CariClass | undefined;
  accountCode?: string | null | undefined;
  createdBy?: number | null | undefined;
}

export class CreateVendorUseCase {
  constructor(private readonly vendors: VendorRepository) {}

  async execute(input: CreateVendorInput): Promise<VendorDto> {
    const cariClass: CariClass = input.cariClass ?? 'satici';
    const code =
      input.code?.trim() ||
      (await nextVendorCode(this.vendors, input.companyId, mainCodeFor(cariClass)));

    if (await this.vendors.existsByCode(input.companyId, code)) {
      throw new DuplicateVendorCodeError(code);
    }

    const created = await this.vendors.insert({
      companyId: input.companyId,
      code,
      name: input.name.trim(),
      taxId: input.taxId?.trim() || null,
      personType: input.personType ?? 'legal',
      cariClass,
      // accountCode verilmezse cari kodu ile aynı (cari hesap linki)
      accountCode: input.accountCode !== undefined ? input.accountCode : code,
      createdBy: input.createdBy ?? null,
    });
    return toVendorDto(created);
  }
}

export interface ListVendorsInput {
  companyId: number;
  includeInactive?: boolean;
  search?: string;
}

export class ListVendorsUseCase {
  constructor(private readonly vendors: VendorRepository) {}

  async execute(input: ListVendorsInput): Promise<VendorDto[]> {
    const options: ListVendorsOptions = {};
    if (input.includeInactive !== undefined) options.includeInactive = input.includeInactive;
    if (input.search !== undefined) options.search = input.search;
    const list = await this.vendors.listByCompany(input.companyId, options);
    return list.map(toVendorDto);
  }
}

export interface UpdateVendorInput {
  companyId: number;
  vendorId: number;
  name?: string | undefined;
  taxId?: string | null | undefined;
  personType?: PersonType | undefined;
  cariClass?: CariClass | undefined;
  accountCode?: string | null | undefined;
}

export class UpdateVendorUseCase {
  constructor(
    private readonly vendors: VendorRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateVendorInput): Promise<VendorDto> {
    const vendor = await this.vendors.findById(input.vendorId, input.companyId);
    if (!vendor) throw new VendorNotFoundError(input.vendorId);
    const updated = vendor.update(
      {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.taxId !== undefined ? { taxId: input.taxId } : {}),
        ...(input.personType !== undefined ? { personType: input.personType } : {}),
        ...(input.cariClass !== undefined ? { cariClass: input.cariClass } : {}),
        ...(input.accountCode !== undefined ? { accountCode: input.accountCode } : {}),
      },
      this.clock.now(),
    );
    await this.vendors.update(updated);
    return toVendorDto(updated);
  }
}

export interface DeactivateVendorInput {
  companyId: number;
  vendorId: number;
}

export class DeactivateVendorUseCase {
  constructor(
    private readonly vendors: VendorRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: DeactivateVendorInput): Promise<VendorDto> {
    const vendor = await this.vendors.findById(input.vendorId, input.companyId);
    if (!vendor) throw new VendorNotFoundError(input.vendorId);
    const deactivated = vendor.deactivate(this.clock.now());
    await this.vendors.update(deactivated);
    return toVendorDto(deactivated);
  }
}

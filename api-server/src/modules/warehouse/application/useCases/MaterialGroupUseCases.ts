/**
 * Malzeme Grubu (MaterialGroup) use-case'leri — CRUD.
 */
import {
  DuplicateGroupCodeError,
  MaterialGroupNotFoundError,
} from '../../domain/errors/WarehouseErrors.js';
import type { GroupStatus } from '../../domain/valueObjects/AuxStatuses.js';
import { toMaterialGroupDto, type MaterialGroupDto } from '../dto/AuxDtos.js';
import type { Clock } from '../ports/Clock.js';
import type {
  MaterialGroupRepository,
  NewMaterialGroupInput,
} from '../ports/MaterialGroupRepository.js';

export interface CreateMaterialGroupInput {
  companyId: number;
  code: string;
  name: string;
  status?: GroupStatus;
}

export class CreateMaterialGroupUseCase {
  constructor(private readonly groups: MaterialGroupRepository) {}

  async execute(input: CreateMaterialGroupInput): Promise<MaterialGroupDto> {
    const code = input.code.trim();
    if (await this.groups.existsByCode(input.companyId, code)) {
      throw new DuplicateGroupCodeError(code);
    }
    const toInsert: NewMaterialGroupInput = {
      companyId: input.companyId,
      code,
      name: input.name.trim(),
      status: input.status ?? 'active',
    };
    const created = await this.groups.insert(toInsert);
    return toMaterialGroupDto(created);
  }
}

export interface UpdateMaterialGroupInput {
  companyId: number;
  groupId: number;
  code?: string;
  name?: string;
  status?: GroupStatus;
}

export class UpdateMaterialGroupUseCase {
  constructor(
    private readonly groups: MaterialGroupRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateMaterialGroupInput): Promise<MaterialGroupDto> {
    const existing = await this.groups.findById(input.groupId, input.companyId);
    if (!existing) {
      throw new MaterialGroupNotFoundError(input.groupId);
    }
    if (input.code !== undefined) {
      const code = input.code.trim();
      if (
        code !== existing.code &&
        (await this.groups.existsByCode(input.companyId, code, input.groupId))
      ) {
        throw new DuplicateGroupCodeError(code);
      }
    }
    const updated = existing.withUpdates(
      {
        ...(input.code !== undefined ? { code: input.code.trim() } : {}),
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      this.clock.now(),
    );
    await this.groups.update(updated);
    return toMaterialGroupDto(updated);
  }
}

export class DeleteMaterialGroupUseCase {
  constructor(private readonly groups: MaterialGroupRepository) {}

  async execute(input: { companyId: number; groupId: number }): Promise<{ ok: true }> {
    const existing = await this.groups.findById(input.groupId, input.companyId);
    if (!existing) {
      throw new MaterialGroupNotFoundError(input.groupId);
    }
    await this.groups.remove(input.groupId, input.companyId);
    return { ok: true };
  }
}

export class ListMaterialGroupsUseCase {
  constructor(private readonly groups: MaterialGroupRepository) {}

  async execute(input: { companyId: number; status?: GroupStatus }): Promise<MaterialGroupDto[]> {
    const list = await this.groups.listByCompany(input.companyId, {
      ...(input.status !== undefined ? { status: input.status } : {}),
    });
    return list.map(toMaterialGroupDto);
  }
}

export class GetMaterialGroupUseCase {
  constructor(private readonly groups: MaterialGroupRepository) {}

  async execute(input: { companyId: number; groupId: number }): Promise<MaterialGroupDto> {
    const g = await this.groups.findById(input.groupId, input.companyId);
    if (!g) {
      throw new MaterialGroupNotFoundError(input.groupId);
    }
    return toMaterialGroupDto(g);
  }
}

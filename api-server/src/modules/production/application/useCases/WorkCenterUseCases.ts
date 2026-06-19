/**
 * WorkCenter (iş merkezi) use-case'leri.
 *
 * Create / Update / List / Archive. Kod benzersizliği use-case + DB UNIQUE
 * ile çift korumalı.
 */
import {
  DuplicateWorkCenterCodeError,
  WorkCenterNotFoundError,
} from '../../domain/errors/ProductionErrors.js';
import type { WorkCenterStatus } from '../../domain/valueObjects/WorkCenterStatus.js';
import { toWorkCenterDto, type WorkCenterDto } from '../dto/WorkCenterDtos.js';
import type { Clock } from '../ports/Clock.js';
import type { NewWorkCenterInput, WorkCenterRepository } from '../ports/WorkCenterRepository.js';

export interface CreateWorkCenterInput {
  companyId: number;
  code: string;
  name: string;
  dailyHours?: number;
  costPerHour?: number;
  status?: WorkCenterStatus;
}

export class CreateWorkCenterUseCase {
  constructor(private readonly workCenters: WorkCenterRepository) {}

  async execute(input: CreateWorkCenterInput): Promise<WorkCenterDto> {
    const code = input.code.trim();
    if (await this.workCenters.existsByCode(input.companyId, code)) {
      throw new DuplicateWorkCenterCodeError(code);
    }
    const payload: NewWorkCenterInput = {
      companyId: input.companyId,
      code,
      name: input.name.trim(),
      dailyHours: input.dailyHours ?? 8,
      costPerHour: input.costPerHour ?? 0,
      status: input.status ?? 'active',
    };
    const created = await this.workCenters.insert(payload);
    return toWorkCenterDto(created);
  }
}

export interface UpdateWorkCenterInput {
  companyId: number;
  workCenterId: number;
  code?: string;
  name?: string;
  dailyHours?: number;
  costPerHour?: number;
  status?: WorkCenterStatus;
}

export class UpdateWorkCenterUseCase {
  constructor(
    private readonly workCenters: WorkCenterRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateWorkCenterInput): Promise<WorkCenterDto> {
    const existing = await this.workCenters.findById(input.workCenterId, input.companyId);
    if (!existing) {
      throw new WorkCenterNotFoundError(input.workCenterId);
    }
    if (input.code !== undefined) {
      const code = input.code.trim();
      if (await this.workCenters.existsByCode(input.companyId, code, input.workCenterId)) {
        throw new DuplicateWorkCenterCodeError(code);
      }
    }
    const updated = existing.update(
      {
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.dailyHours !== undefined ? { dailyHours: input.dailyHours } : {}),
        ...(input.costPerHour !== undefined ? { costPerHour: input.costPerHour } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      this.clock.now(),
    );
    await this.workCenters.update(updated);
    return toWorkCenterDto(updated);
  }
}

export interface ListWorkCentersInput {
  companyId: number;
  includeArchived?: boolean;
}

export class ListWorkCentersUseCase {
  constructor(private readonly workCenters: WorkCenterRepository) {}

  async execute(input: ListWorkCentersInput): Promise<WorkCenterDto[]> {
    const list = await this.workCenters.listByCompany(input.companyId, {
      ...(input.includeArchived !== undefined ? { includeArchived: input.includeArchived } : {}),
    });
    return list.map(toWorkCenterDto);
  }
}

export interface ArchiveWorkCenterInput {
  companyId: number;
  workCenterId: number;
}

export class ArchiveWorkCenterUseCase {
  constructor(
    private readonly workCenters: WorkCenterRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: ArchiveWorkCenterInput): Promise<WorkCenterDto> {
    const existing = await this.workCenters.findById(input.workCenterId, input.companyId);
    if (!existing) {
      throw new WorkCenterNotFoundError(input.workCenterId);
    }
    const archived = existing.archive(this.clock.now());
    await this.workCenters.update(archived);
    return toWorkCenterDto(archived);
  }
}

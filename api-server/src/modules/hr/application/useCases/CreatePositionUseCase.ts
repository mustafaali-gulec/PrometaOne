/**
 * CreatePositionUseCase — yeni Position oluşturur.
 * Default status: 'draft'. departmentId opsiyonel ama verilirse var olmalı.
 */
import type { PositionStatus } from '../../domain/valueObjects/PositionStatus.js';
import { toPositionDto, type PositionDto } from '../dto/PositionDto.js';
import { DepartmentNotFoundError } from '../errors/HrErrors.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';
import type { DepartmentRepository } from '../ports/DepartmentRepository.js';
import type { PositionRepository } from '../ports/PositionRepository.js';

export interface CreatePositionInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  departmentId: number | null;
  title: string;
  description?: string | null;
  status?: PositionStatus;
  headcountTarget?: number;
  minSalary?: number | null;
  maxSalary?: number | null;
}

export class CreatePositionUseCase {
  constructor(
    private readonly positions: PositionRepository,
    private readonly departments: DepartmentRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: CreatePositionInput): Promise<PositionDto> {
    if (input.departmentId !== null) {
      const dept = await this.departments.findById(input.departmentId, input.companyId);
      if (!dept) {
        throw new DepartmentNotFoundError(input.departmentId);
      }
    }

    const created = await this.positions.insert({
      companyId: input.companyId,
      departmentId: input.departmentId,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? 'draft',
      headcountTarget: input.headcountTarget ?? 1,
      minSalary: input.minSalary ?? null,
      maxSalary: input.maxSalary ?? null,
    });

    await this.audit.log({
      at: this.clock.now(),
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.position.created',
      details: { id: created.id, title: created.title, status: created.status },
    });

    return toPositionDto(created);
  }
}

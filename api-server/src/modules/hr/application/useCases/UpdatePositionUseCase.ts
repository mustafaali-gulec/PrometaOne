/**
 * UpdatePositionUseCase — Position'in title/description/headcount/salary alanlarını günceller.
 * Status değişimi ClosePositionUseCase'de (closed) veya `transitionTo` ile (open) yapılır.
 */
import { Position } from '../../domain/entities/Position.js';
import type { PositionStatus } from '../../domain/valueObjects/PositionStatus.js';
import { toPositionDto, type PositionDto } from '../dto/PositionDto.js';
import { DepartmentNotFoundError, PositionNotFoundError } from '../errors/HrErrors.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';
import type { DepartmentRepository } from '../ports/DepartmentRepository.js';
import type { PositionRepository } from '../ports/PositionRepository.js';

export interface UpdatePositionInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  id: number;
  title?: string;
  description?: string | null;
  headcountTarget?: number;
  minSalary?: number | null;
  maxSalary?: number | null;
  departmentId?: number | null;
  /** Opsiyonel status değişimi (örn. draft → open). closed için ClosePositionUseCase kullan. */
  status?: PositionStatus;
}

export class UpdatePositionUseCase {
  constructor(
    private readonly positions: PositionRepository,
    private readonly departments: DepartmentRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: UpdatePositionInput): Promise<PositionDto> {
    const existing = await this.positions.findById(input.id, input.companyId);
    if (!existing) {
      throw new PositionNotFoundError(input.id);
    }

    let updated = existing;
    const now = this.clock.now();
    const changes: Record<string, unknown> = {};

    if (input.title !== undefined && input.title.trim() !== existing.title) {
      updated = updated.rename(input.title, now);
      changes.title = { from: existing.title, to: updated.title };
    }
    if (input.description !== undefined && input.description !== existing.description) {
      updated = updated.updateDescription(input.description, now);
      changes.description = { from: existing.description, to: input.description };
    }
    if (input.headcountTarget !== undefined && input.headcountTarget !== existing.headcountTarget) {
      updated = updated.updateHeadcount(input.headcountTarget, now);
      changes.headcountTarget = { from: existing.headcountTarget, to: input.headcountTarget };
    }
    if (input.minSalary !== undefined || input.maxSalary !== undefined) {
      const newMin = input.minSalary !== undefined ? input.minSalary : existing.minSalary;
      const newMax = input.maxSalary !== undefined ? input.maxSalary : existing.maxSalary;
      if (newMin !== existing.minSalary || newMax !== existing.maxSalary) {
        updated = updated.updateSalaryRange(newMin, newMax, now);
        changes.salaryRange = {
          from: { min: existing.minSalary, max: existing.maxSalary },
          to: { min: newMin, max: newMax },
        };
      }
    }
    if (input.departmentId !== undefined && input.departmentId !== existing.departmentId) {
      if (input.departmentId !== null) {
        const dept = await this.departments.findById(input.departmentId, input.companyId);
        if (!dept) throw new DepartmentNotFoundError(input.departmentId);
      }
      updated = Position.create({
        ...updated.toJSON(),
        departmentId: input.departmentId,
        updatedAt: now,
      });
      changes.departmentId = { from: existing.departmentId, to: input.departmentId };
    }
    if (input.status !== undefined && input.status !== existing.status) {
      updated = updated.transitionTo(input.status, now);
      changes.status = { from: existing.status, to: input.status };
    }

    if (updated === existing) {
      return toPositionDto(existing);
    }

    await this.positions.update(updated);
    await this.audit.log({
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.position.updated',
      details: { id: updated.id, changes },
    });

    return toPositionDto(updated);
  }
}

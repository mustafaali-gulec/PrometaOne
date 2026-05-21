/**
 * ClosePositionUseCase — Position'i kapatır (status='closed').
 *
 * Aktif çalışan varsa hata fırlatmaz (kapatma → yeni başvuru almaz, mevcut
 * çalışanları etkilemez); ancak audit log'a not düşülür.
 */
import { toPositionDto, type PositionDto } from '../dto/PositionDto.js';
import { PositionNotFoundError } from '../errors/HrErrors.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';
import type { PositionRepository } from '../ports/PositionRepository.js';

export interface ClosePositionInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  id: number;
}

export class ClosePositionUseCase {
  constructor(
    private readonly positions: PositionRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: ClosePositionInput): Promise<PositionDto> {
    const existing = await this.positions.findById(input.id, input.companyId);
    if (!existing) {
      throw new PositionNotFoundError(input.id);
    }

    if (existing.status === 'closed') {
      return toPositionDto(existing);
    }

    const closed = existing.transitionTo('closed', this.clock.now());
    await this.positions.update(closed);

    const hasActive = await this.positions.hasActiveEmployees(existing.id, input.companyId);

    await this.audit.log({
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.position.closed',
      details: {
        id: existing.id,
        title: existing.title,
        fromStatus: existing.status,
        hadActiveEmployees: hasActive,
      },
    });

    return toPositionDto(closed);
  }
}

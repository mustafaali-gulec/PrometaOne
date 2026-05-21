/**
 * ListPositionsUseCase — pozisyon listesi (filter: status, departmentId).
 */
import type { PositionStatus } from '../../domain/valueObjects/PositionStatus.js';
import { toPositionDto, type PositionDto } from '../dto/PositionDto.js';
import type { PositionRepository } from '../ports/PositionRepository.js';

export interface ListPositionsInput {
  companyId: number;
  status?: PositionStatus;
  /** null → departmana bağlı OLMAYAN pozisyonlar */
  departmentId?: number | null;
}

export class ListPositionsUseCase {
  constructor(private readonly positions: PositionRepository) {}

  async execute(input: ListPositionsInput): Promise<ReadonlyArray<PositionDto>> {
    const opts: {
      status?: PositionStatus;
      departmentId?: number | null;
    } = {};
    if (input.status !== undefined) opts.status = input.status;
    if (input.departmentId !== undefined) opts.departmentId = input.departmentId;
    const list = await this.positions.listByCompany(input.companyId, opts);
    return list.map(toPositionDto);
  }
}

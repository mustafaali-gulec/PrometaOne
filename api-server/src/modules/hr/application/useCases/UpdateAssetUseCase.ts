/**
 * UpdateAssetUseCase — varlığın metadata alanlarını günceller
 * (name, brand, model, serialNo, notes). Status/atama değişimi
 * AssignAssetUseCase / ReturnAssetUseCase ile yapılır.
 */
import { Asset } from '../../domain/entities/Asset.js';
import { toAssetDto, type AssetDto } from '../dto/AssetDto.js';
import { AssetNotFoundError } from '../errors/HrErrors.js';
import type { AssetRepository } from '../ports/AssetRepository.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';

export interface UpdateAssetInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  id: number;
  name?: string;
  brand?: string | null;
  model?: string | null;
  serialNo?: string | null;
  notes?: string | null;
}

export class UpdateAssetUseCase {
  constructor(
    private readonly assets: AssetRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: UpdateAssetInput): Promise<AssetDto> {
    const existing = await this.assets.findAssetById(input.id, input.companyId);
    if (!existing) {
      throw new AssetNotFoundError(input.id);
    }

    const now = this.clock.now();
    const changes: Record<string, unknown> = {};

    const nextName = input.name !== undefined ? input.name : existing.name;
    const nextBrand = input.brand !== undefined ? input.brand : existing.brand;
    const nextModel = input.model !== undefined ? input.model : existing.model;
    const nextSerialNo = input.serialNo !== undefined ? input.serialNo : existing.serialNo;
    const nextNotes = input.notes !== undefined ? input.notes : existing.notes;

    if (nextName !== existing.name) changes.name = { from: existing.name, to: nextName };
    if (nextBrand !== existing.brand) changes.brand = { from: existing.brand, to: nextBrand };
    if (nextModel !== existing.model) changes.model = { from: existing.model, to: nextModel };
    if (nextSerialNo !== existing.serialNo) {
      changes.serialNo = { from: existing.serialNo, to: nextSerialNo };
    }
    if (nextNotes !== existing.notes) changes.notes = { from: existing.notes, to: nextNotes };

    if (Object.keys(changes).length === 0) {
      return toAssetDto(existing);
    }

    const updated = Asset.create({
      ...existing.toJSON(),
      name: nextName,
      brand: nextBrand,
      model: nextModel,
      serialNo: nextSerialNo,
      notes: nextNotes,
      updatedAt: now,
    });

    await this.assets.updateAsset(updated);
    await this.audit.log({
      at: now,
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.asset.updated',
      details: { id: updated.id, changes },
    });

    return toAssetDto(updated);
  }
}

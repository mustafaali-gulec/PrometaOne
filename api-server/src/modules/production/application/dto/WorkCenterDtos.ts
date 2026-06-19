/**
 * WorkCenter (iş merkezi) DTO'ları.
 */
import type { WorkCenter } from '../../domain/entities/WorkCenter.js';
import type { WorkCenterStatus } from '../../domain/valueObjects/WorkCenterStatus.js';

export interface WorkCenterDto {
  id: number;
  companyId: number;
  code: string;
  name: string;
  dailyHours: number;
  costPerHour: number;
  status: WorkCenterStatus;
  createdAt: string;
  updatedAt: string;
}

export function toWorkCenterDto(w: WorkCenter): WorkCenterDto {
  const j = w.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    code: j.code,
    name: j.name,
    dailyHours: j.dailyHours,
    costPerHour: j.costPerHour,
    status: j.status,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}

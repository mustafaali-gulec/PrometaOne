/**
 * Performans repository PORT'ları — application katmanı bu interface'lere
 * bağımlıdır, infrastructure (Pg*) implemente eder.
 *
 * Full-state sync modeli: upsertMany id'ye göre insert-or-update yapar;
 * pruneExcept şirketin payload'da OLMAYAN satırlarını siler (istemci blob'u
 * kaynak-of-truth olduğundan tam yansıtma).
 */
import type { PerfCycle } from '../../domain/entities/PerfCycle.js';
import type { PerfReview } from '../../domain/entities/PerfReview.js';

export interface PerfCycleRepository {
  upsertMany(cycles: readonly PerfCycle[]): Promise<number>;
  /** companyId'nin keepIds dışındaki tüm dönemlerini siler; silinen sayısını döner. */
  pruneExcept(companyId: number, keepIds: readonly string[]): Promise<number>;
  list(companyId: number): Promise<ReadonlyArray<PerfCycle>>;
}

export interface PerfReviewRepository {
  upsertMany(reviews: readonly PerfReview[]): Promise<number>;
  /** companyId'nin keepIds dışındaki tüm değerlendirmelerini siler; silinen sayısını döner. */
  pruneExcept(companyId: number, keepIds: readonly string[]): Promise<number>;
  list(companyId: number, cycleId?: string): Promise<ReadonlyArray<PerfReview>>;
}

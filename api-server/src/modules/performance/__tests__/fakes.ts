/**
 * Performans use-case testleri için in-memory fake repository'ler.
 */
import type {
  PerfCycleRepository,
  PerfReviewRepository,
} from '../application/ports/PerformanceRepository.js';
import type { PerfCycle } from '../domain/entities/PerfCycle.js';
import type { PerfReview } from '../domain/entities/PerfReview.js';

export class FakePerfCycleRepository implements PerfCycleRepository {
  readonly rows = new Map<string, PerfCycle>();

  upsertMany(cycles: readonly PerfCycle[]): Promise<number> {
    let count = 0;
    for (const c of cycles) {
      const existing = this.rows.get(c.id);
      if (existing && existing.companyId !== c.companyId) continue; // cross-tenant no-op
      this.rows.set(c.id, c);
      count += 1;
    }
    return Promise.resolve(count);
  }

  pruneExcept(companyId: number, keepIds: readonly string[]): Promise<number> {
    const keep = new Set(keepIds);
    let deleted = 0;
    for (const [id, c] of this.rows) {
      if (c.companyId === companyId && !keep.has(id)) {
        this.rows.delete(id);
        deleted += 1;
      }
    }
    return Promise.resolve(deleted);
  }

  list(companyId: number): Promise<ReadonlyArray<PerfCycle>> {
    return Promise.resolve([...this.rows.values()].filter((c) => c.companyId === companyId));
  }
}

export class FakePerfReviewRepository implements PerfReviewRepository {
  readonly rows = new Map<string, PerfReview>();

  upsertMany(reviews: readonly PerfReview[]): Promise<number> {
    let count = 0;
    for (const r of reviews) {
      const existing = this.rows.get(r.id);
      if (existing && existing.companyId !== r.companyId) continue;
      this.rows.set(r.id, r);
      count += 1;
    }
    return Promise.resolve(count);
  }

  pruneExcept(companyId: number, keepIds: readonly string[]): Promise<number> {
    const keep = new Set(keepIds);
    let deleted = 0;
    for (const [id, r] of this.rows) {
      if (r.companyId === companyId && !keep.has(id)) {
        this.rows.delete(id);
        deleted += 1;
      }
    }
    return Promise.resolve(deleted);
  }

  list(companyId: number, cycleId?: string): Promise<ReadonlyArray<PerfReview>> {
    return Promise.resolve(
      [...this.rows.values()].filter(
        (r) => r.companyId === companyId && (!cycleId || r.cycleId === cycleId),
      ),
    );
  }
}

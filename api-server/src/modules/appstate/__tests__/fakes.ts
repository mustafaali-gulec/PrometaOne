/**
 * AppState use-case testleri için in-memory fake repository.
 * Production PgAppStateRepository sözleşmesini taklit eder (JSON round-trip
 * için value'yu stringify/parse ederek saklar — JSONB davranışını yansıtır).
 */
import type {
  AppStateRepository,
  UpsertAppStateInput,
} from '../application/ports/AppStateRepository.js';
import type { Clock } from '../application/ports/Clock.js';

const FIXED = new Date('2026-06-25T00:00:00.000Z');

export class FixedClock implements Clock {
  constructor(private readonly fixed: Date = FIXED) {}
  now(): Date {
    return this.fixed;
  }
}

interface StoredState {
  value: unknown;
  updatedAt: string;
}

export class InMemoryAppStateRepository implements AppStateRepository {
  private readonly store = new Map<string, StoredState>();

  private static composeKey(scope: string, key: string): string {
    return `${scope} ${key}`;
  }

  async get(scope: string, key: string): Promise<{ value: unknown; updatedAt: string } | null> {
    const found = this.store.get(InMemoryAppStateRepository.composeKey(scope, key));
    if (!found) return null;
    return { value: found.value, updatedAt: found.updatedAt };
  }

  async upsert(input: UpsertAppStateInput): Promise<{ updatedAt: string }> {
    const updatedAt = input.now.toISOString();
    // JSONB davranışını taklit: nesneyi serialize edip geri parse ederek sakla.
    const value: unknown = JSON.parse(JSON.stringify(input.value));
    this.store.set(InMemoryAppStateRepository.composeKey(input.scope, input.key), {
      value,
      updatedAt,
    });
    return { updatedAt };
  }
}

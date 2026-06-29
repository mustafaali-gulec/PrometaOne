/**
 * AppStateRepository — uygulama durumu (key→JSONB) kalıcılık portu.
 * Concrete: infrastructure/persistence/PgAppStateRepository.ts
 */
export interface UpsertAppStateInput {
  scope: string;
  key: string;
  value: unknown;
  actorUserId: number | null;
  now: Date;
}

export interface AppStateRepository {
  get(scope: string, key: string): Promise<{ value: unknown; updatedAt: string } | null>;
  upsert(input: UpsertAppStateInput): Promise<{ updatedAt: string }>;
}

/**
 * Uygulama Durumu (app_state) use-case'leri.
 *
 * Genel amaçlı key→JSONB deposu: frontend'in localStorage'da tuttuğu büyük
 * uygulama durumu blob'unu sunucuya taşır. İş kuralı yoktur; sadece okuma ve
 * upsert. RBAC eylem düzeyinde UI tarafında uygulanır.
 */
import type { AppStateDto } from '../dto/AppStateDtos.js';
import type { AppStateRepository } from '../ports/AppStateRepository.js';
import type { Clock } from '../ports/Clock.js';

const DEFAULT_SCOPE = 'global';

export interface GetAppStateInput {
  scope?: string | undefined;
  key: string;
}

export class GetAppStateUseCase {
  constructor(private readonly repo: AppStateRepository) {}

  async execute(input: GetAppStateInput): Promise<AppStateDto | null> {
    const scope = input.scope?.trim() || DEFAULT_SCOPE;
    const found = await this.repo.get(scope, input.key);
    if (!found) return null;
    return {
      scope,
      key: input.key,
      value: found.value,
      updatedAt: found.updatedAt,
    };
  }
}

export interface SetAppStateInput {
  scope?: string | undefined;
  key: string;
  value: unknown;
  actorUserId?: number | null | undefined;
}

export interface SetAppStateResult {
  scope: string;
  key: string;
  updatedAt: string;
}

export class SetAppStateUseCase {
  constructor(
    private readonly repo: AppStateRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetAppStateInput): Promise<SetAppStateResult> {
    const scope = input.scope?.trim() || DEFAULT_SCOPE;
    const { updatedAt } = await this.repo.upsert({
      scope,
      key: input.key,
      value: input.value,
      actorUserId: input.actorUserId ?? null,
      now: this.clock.now(),
    });
    return { scope, key: input.key, updatedAt };
  }
}

/**
 * Uygulama Durumu (app_state) use-case'leri.
 *
 * Genel amaçlı key→JSONB deposu: frontend'in localStorage'da tuttuğu büyük
 * uygulama durumu blob'unu sunucuya taşır. İş kuralı yoktur; sadece okuma ve
 * upsert. RBAC eylem düzeyinde UI tarafında uygulanır.
 *
 * MIRROR FAN-OUT: SetAppStateUseCase, upsert BAŞARILI olduktan sonra blob'u
 * app_state_entities SQL aynasına projeksiyon eder (BlobProjector →
 * AppStateMirror). Fire-and-forget'tir: await edilmez, hatası console.error
 * ile loglanıp YUTULUR — kullanıcı kaydı kutsaldır, ayna PUT yanıtını asla
 * bozmaz/geciktirmez. Yalnız 'global' scope aynalanır (farklı scope'lar tek
 * aynayı ezmesin).
 *
 * ACCESS FAN-OUT: aynı kalıpla ikinci projeksiyon — blob RBAC koleksiyonları
 * (companyData[cid].hrCustomRoles/hrRoleGrants/hrPermOverrides) access_*
 * tablolarına yansıtılır (AccessProjection → AccessProjectionMirror). Yalnız
 * 'promet:data' anahtarı + 'global' scope; hata yutulur, PUT asla bozulmaz.
 */
import { projectAccess } from '../../domain/AccessProjection.js';
import { projectBlobWithGroups } from '../../domain/BlobProjector.js';
import type { AppStateDto } from '../dto/AppStateDtos.js';
import type { AccessProjectionMirror } from '../ports/AccessProjectionMirror.js';
import type { AppStateMirror } from '../ports/AppStateMirror.js';
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

/** Access projeksiyonunun kaynağı olan blob anahtarı. */
const ACCESS_SOURCE_KEY = 'promet:data';

export class SetAppStateUseCase {
  constructor(
    private readonly repo: AppStateRepository,
    private readonly clock: Clock,
    /** Opsiyonel SQL aynası — verilmezse fan-out atlanır (geriye uyumlu). */
    private readonly mirror?: AppStateMirror,
    /** Opsiyonel access_* projeksiyonu — verilmezse fan-out atlanır (geriye uyumlu). */
    private readonly accessMirror?: AccessProjectionMirror,
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

    // Upsert başarılı → projeksiyonları ateşle (fire-and-forget; hata yutulur).
    if (scope === DEFAULT_SCOPE) {
      this.fireMirror(input.key, input.value);
      this.fireAccessProjection(input.key, input.value);
    }

    return { scope, key: input.key, updatedAt };
  }

  private fireMirror(key: string, value: unknown): void {
    if (!this.mirror) return;
    try {
      const { rows, groups } = projectBlobWithGroups(key, value, {
        onDomainSkipped: (g) =>
          console.error(
            `[appstate:mirror] domain atlandı (runaway guard, >50k eleman): company=${g.companyId} domain=${g.domain} eleman=${g.itemCount}`,
          ),
      });
      if (groups.length === 0) return; // bu anahtar aynalanmıyor
      void this.mirror.replaceAll(rows, groups).catch((err) => {
        console.error('[appstate:mirror] fan-out hatası (PUT yanıtı etkilenmez):', err);
      });
    } catch (err) {
      console.error('[appstate:mirror] projeksiyon hatası (PUT yanıtı etkilenmez):', err);
    }
  }

  private fireAccessProjection(key: string, value: unknown): void {
    if (!this.accessMirror) return;
    if (key !== ACCESS_SOURCE_KEY) return; // RBAC yalnız promet:data blob'unda yaşar
    try {
      const projection = projectAccess(value);
      void this.accessMirror.replaceAll(projection).catch((err) => {
        console.error('[appstate:access] fan-out hatası (PUT yanıtı etkilenmez):', err);
      });
    } catch (err) {
      console.error('[appstate:access] projeksiyon hatası (PUT yanıtı etkilenmez):', err);
    }
  }
}

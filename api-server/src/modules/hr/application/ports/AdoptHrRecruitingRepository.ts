/**
 * AdoptHrRecruitingRepository PORT'u — normalize blob işe alım satırlarının
 * (positions + candidates + applications) TEK transaction'da devralınması.
 * Implementasyon: PgAdoptHrRecruitingRepository. Emsal: AdoptHrOrgRepository.
 *
 * Sözleşme:
 *   - Upsert anahtarı (company_id, client_id) (047 kolonları) → ikinci çağrı
 *     duplicate üretmez.
 *   - positions.departmentRef DB'deki geçerli departman kümesiyle çözülür
 *     (client_id haritası + sayısal sunucu id doğrulaması — departments MEZUN);
 *     çözülemezse NULL (nullable FK).
 *   - applications.candidateRef/positionRef önce BU çağrıda upsert edilen,
 *     sonra tabloda zaten var olan (önceki adopt) client_id'ler, en son geçerli
 *     sayısal sunucu id'leri üzerinden çözülür; çözülemeyen başvuru DÜŞER
 *     (candidate_id/position_id NOT NULL) — transaction bozulmaz.
 *   - Aktif (candidate, position) çifti partial-unique
 *     (uq_applications_active_unique): çakışmada SON kazanır/devralınır —
 *     mevcut aktif satır adopt verisiyle güncellenip client_id'yi devralır;
 *     500 atılmaz.
 */
import type {
  NormalizedAdoptApplication,
  NormalizedAdoptCandidate,
  NormalizedAdoptPosition,
} from '../dto/AdoptHrRecruitingDtos.js';

export interface AdoptHrRecruitingPayload {
  positions: ReadonlyArray<NormalizedAdoptPosition>;
  candidates: ReadonlyArray<NormalizedAdoptCandidate>;
  applications: ReadonlyArray<NormalizedAdoptApplication>;
}

export interface AdoptHrRecruitingOutcome {
  /** clientId → serverId (bu çağrıda upsert edilen/devralınanlar). */
  positionIdByClient: Record<string, number>;
  candidateIdByClient: Record<string, number>;
  applicationIdByClient: Record<string, number>;
}

export interface AdoptHrRecruitingRepository {
  adoptAll(companyId: number, payload: AdoptHrRecruitingPayload): Promise<AdoptHrRecruitingOutcome>;
}

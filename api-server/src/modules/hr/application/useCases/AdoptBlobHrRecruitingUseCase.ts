/**
 * AdoptBlobHrRecruitingUseCase — blob (promet:data) işe alım çekirdeğinin
 * (hrPositions + hrCandidates + hrApplications) TEK SEFERLİK, İDEMPOTENT
 * devralınması. Emsal: AdoptBlobHrOrgUseCase (org yazma-cutover'ı).
 *
 * Girdi blob alan adlarıyla GEVŞEK gelir; bu use-case blob kayıtlarını
 * savunmacı coercion ile NormalizedAdopt* satırlara çevirir ve
 * AdoptHrRecruitingRepository.adoptAll'a (tek transaction) verir. Kimliksiz
 * (id'siz), başlıksız pozisyon ve adsız aday kayıtları atlanır — client_id
 * idempotens anahtarıdır ve title/first_name/last_name NOT NULL + not-empty
 * CHECK'lidir. candidateId/positionId OLMAYAN başvurular (ilan-inbox) düşer.
 *
 * Şema uyum kuralları (HrProjection ile aynı):
 *   - Enum eşlemeleri HrProjection haritalarından (TEK KAYNAK):
 *     POSITION_STATUS_MAP / CANDIDATE_SOURCE_MAP / APPLICATION_STAGE_MAP.
 *   - min>max maaş takası (CHECK positions_salary_order), headcount≥0.
 *   - Aktif (candidate, position) çiftinde çağrı-içi SON kazanır
 *     (uq_applications_active_unique); terminal stage'ler serbest. DB'deki
 *     çakışma repository'de devralınır (500 atılmaz).
 */
import {
  APPLICATION_STAGE_MAP,
  CANDIDATE_SOURCE_MAP,
  POSITION_STATUS_MAP,
} from '../../../appstate/domain/HrProjection.js';
import { isTerminalStage } from '../../domain/valueObjects/RecruitmentStage.js';
import type {
  AdoptHrRecruitingInput,
  AdoptHrRecruitingResultDto,
  NormalizedAdoptApplication,
  NormalizedAdoptCandidate,
  NormalizedAdoptPosition,
} from '../dto/AdoptHrRecruitingDtos.js';
import type { AdoptHrRecruitingRepository } from '../ports/AdoptHrRecruitingRepository.js';

// ===== yardımcı coercion'lar ================================================

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function idString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function text(value: unknown, max?: number): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  if (t === '') return null;
  return max !== undefined ? t.slice(0, max) : t;
}

/** Timestamp alanları: dolu string aynen taşınır (PG timestamptz'e cast eder). */
function timestamp(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  return null;
}

function finiteOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function mapEnum<T extends string>(
  map: Readonly<Record<string, T>>,
  value: unknown,
  fallback: T,
): T {
  if (typeof value === 'string') {
    const hit = map[value.trim()];
    if (hit !== undefined) return hit;
  }
  return fallback;
}

// ===== normalizasyon ========================================================

function normalizePosition(raw: Record<string, unknown>): NormalizedAdoptPosition | null {
  const clientId = idString(raw['id']);
  const title = text(raw['title'], 200);
  if (clientId === null || title === null) return null;
  let minSalary = finiteOrNull(raw['brutMinSalary']);
  let maxSalary = finiteOrNull(raw['brutMaxSalary']);
  if (minSalary !== null && maxSalary !== null && minSalary > maxSalary) {
    [minSalary, maxSalary] = [maxSalary, minSalary]; // CHECK positions_salary_order
  }
  const headcountRaw = finiteOrNull(raw['headcount']);
  return {
    clientId,
    title,
    description: text(raw['jobDescription']) ?? text(raw['description']),
    status: mapEnum(POSITION_STATUS_MAP, raw['status'], 'draft'),
    headcountTarget: headcountRaw !== null ? Math.max(0, Math.floor(headcountRaw)) : 1,
    minSalary,
    maxSalary,
    departmentRef: idString(raw['departmentId']),
  };
}

function normalizeCandidate(raw: Record<string, unknown>): NormalizedAdoptCandidate | null {
  const clientId = idString(raw['id']);
  const firstName = text(raw['firstName'], 100);
  const lastName = text(raw['lastName'], 100);
  if (clientId === null || firstName === null || lastName === null) return null;
  return {
    clientId,
    firstName,
    lastName,
    email: text(raw['email']),
    phone: text(raw['phone'], 32),
    source: mapEnum(CANDIDATE_SOURCE_MAP, raw['source'], 'direct'),
    cvUrl: text(raw['cvUrl']),
    notes: text(raw['notes']),
  };
}

function normalizeApplication(raw: Record<string, unknown>): NormalizedAdoptApplication | null {
  const clientId = idString(raw['id']);
  const candidateRef = idString(raw['candidateId']);
  const positionRef = idString(raw['positionId']);
  // candidateId/positionId'siz elemanlar (ilan-inbox başvuruları) düşürülür —
  // candidate_id/position_id NOT NULL (HrProjection ile aynı kural).
  if (clientId === null || candidateRef === null || positionRef === null) return null;
  return {
    clientId,
    candidateRef,
    positionRef,
    stage: mapEnum(APPLICATION_STAGE_MAP, raw['stage'], 'new'),
    stageChangedAt: timestamp(raw['updatedAt']) ?? timestamp(raw['createdAt']),
    rejectionReason: text(raw['rejectionReason']),
    salaryExpectation: finiteOrNull(raw['salaryExpectation']),
    notes: text(raw['notes']),
  };
}

/** clientId çakışmasında SON kazanır (aynı batch'te dupe upsert hedefi olmasın). */
function dedupeByClientId<T extends { clientId: string }>(rows: ReadonlyArray<T>): T[] {
  const map = new Map<string, T>();
  for (const row of rows) map.set(row.clientId, row);
  return [...map.values()];
}

/**
 * uq_applications_active_unique: aktif (candidate, position) çiftinde çağrı-içi
 * SON kazanır — öncekiler düşer (HrProjection'daki duplicateActive kalıbı).
 * Terminal stage'ler (hired/rejected/withdrawn) partial index dışıdır, kalır.
 */
function dedupeActivePairs(
  applications: ReadonlyArray<NormalizedAdoptApplication>,
): NormalizedAdoptApplication[] {
  const keep = new Map<string, NormalizedAdoptApplication>(); // clientId → satır
  const activeByPair = new Map<string, string>(); // "cand pos" → clientId (SON)
  for (const app of applications) {
    keep.set(app.clientId, app);
    if (isTerminalStage(app.stage)) continue;
    const pairKey = `${app.candidateRef} ${app.positionRef}`;
    const prev = activeByPair.get(pairKey);
    if (prev !== undefined && prev !== app.clientId) keep.delete(prev); // SON kazanır
    activeByPair.set(pairKey, app.clientId);
  }
  return [...keep.values()];
}

// ===== use case =============================================================

export class AdoptBlobHrRecruitingUseCase {
  constructor(private readonly repo: AdoptHrRecruitingRepository) {}

  async execute(input: AdoptHrRecruitingInput): Promise<AdoptHrRecruitingResultDto> {
    const positions = dedupeByClientId(
      (input.positions ?? []).filter(isPlainObject).flatMap((raw) => {
        const p = normalizePosition(raw);
        return p ? [p] : [];
      }),
    );
    const candidates = dedupeByClientId(
      (input.candidates ?? []).filter(isPlainObject).flatMap((raw) => {
        const c = normalizeCandidate(raw);
        return c ? [c] : [];
      }),
    );
    const applications = dedupeActivePairs(
      dedupeByClientId(
        (input.applications ?? []).filter(isPlainObject).flatMap((raw) => {
          const a = normalizeApplication(raw);
          return a ? [a] : [];
        }),
      ),
    );

    if (positions.length === 0 && candidates.length === 0 && applications.length === 0) {
      // Boş gövde — DB'ye hiç gitmeden boş sonuç (idempotent no-op).
      return {
        adopted: { positions: 0, candidates: 0, applications: 0 },
        idMap: { positions: {}, candidates: {}, applications: {} },
      };
    }

    const outcome = await this.repo.adoptAll(input.companyId, {
      positions,
      candidates,
      applications,
    });

    return {
      adopted: {
        positions: Object.keys(outcome.positionIdByClient).length,
        candidates: Object.keys(outcome.candidateIdByClient).length,
        applications: Object.keys(outcome.applicationIdByClient).length,
      },
      idMap: {
        positions: outcome.positionIdByClient,
        candidates: outcome.candidateIdByClient,
        applications: outcome.applicationIdByClient,
      },
    };
  }
}

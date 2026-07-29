/**
 * Adam×saat & verimlilik use-case'leri (FAZ 4).
 *
 * Rapor satırları view'dan okunur; use-case katmanı bunlara TÜREV göstergeler
 * ekler (ilerleme-işçilik makası, EAC, verim bandı) ve özetler.
 */
import {
  ContractNotFoundError,
  ConstructionValidationError,
  ProjectNotFoundError,
} from '../../domain/errors/ConstructionErrors.js';
import {
  efficiencyBand,
  estimateAtCompletion,
  safePct,
  weightedEfficiency,
  type EfficiencyBand,
} from '../../domain/valueObjects/Productivity.js';
import type { ContractRepository } from '../ports/ContractRepository.js';
import type {
  BoqPerformanceRow,
  ContractManhourSummary,
  PerformanceRepository,
} from '../ports/PerformanceRepository.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';

/** Rapor satırı — view alanları + türev göstergeler. */
export interface PerformanceRowDto extends BoqPerformanceRow {
  /**
   * İlerleme-işçilik makası: miktar% − adam×saat%. Negatif = adam×saat
   * miktardan hızlı tükeniyor (kâr kaybının en erken sinyali).
   */
  progressGap: number | null;
  /** Mevcut verimle bitişte beklenen toplam adam×saat (EAC). */
  eacManhours: number;
  /** EAC − planlanan. Pozitif = plan aşılacak. */
  eacVariance: number;
  /** Verim bandı — arayüz renklendirmesi tek yerden. */
  band: EfficiencyBand;
  /**
   * Fiziksel üretim ile hakediş arasındaki fark (produced − progress).
   * Pozitif: hakediş kesilmemiş iş var (nakit riski).
   * Negatif: hakediş fiziksel üretimin önünde (denetim riski).
   */
  productionVsProgressQty: number;
}

function decorate(row: BoqPerformanceRow): PerformanceRowDto {
  const eac = estimateAtCompletion({
    plannedQty: row.plannedQty,
    plannedUnitManhours: row.plannedUnitManhours,
    producedQty: row.producedQty,
    actualManhours: row.actualManhours,
  });
  return {
    ...row,
    progressGap:
      row.producedPct === null || row.manhourPct === null ? null : row.producedPct - row.manhourPct,
    eacManhours: eac,
    eacVariance: eac - row.plannedManhours,
    band: efficiencyBand(row.efficiency),
    productionVsProgressQty: row.producedQty - row.progressQty,
  };
}

export interface PerformanceReportDto {
  rows: ReadonlyArray<PerformanceRowDto>;
  summary: {
    lineCount: number;
    plannedManhours: number;
    actualManhours: number;
    ownManhours: number;
    subManhours: number;
    machineHours: number;
    expectedManhours: number;
    manhourVariance: number;
    manhourPct: number | null;
    /** Ağırlıklı verim. */
    efficiency: number | null;
    band: EfficiencyBand;
    eacManhours: number;
    eacVariance: number;
    plannedAmount: number;
    progressAmount: number;
    expenseAmount: number;
    earnedPursantaj: number;
    /** Planlanan a×s girilmemiş satır sayısı — verim ölçülemeyen kısmı bildirir. */
    linesWithoutPlan: number;
    // FAZ 7 — Taahhüt & maliyet
    committedAmount: number;
    openCommittedAmount: number;
    costExposure: number;
    budgetVariance: number;
  };
}

function summarize(rows: ReadonlyArray<PerformanceRowDto>): PerformanceReportDto['summary'] {
  const sum = (pick: (r: PerformanceRowDto) => number): number =>
    rows.reduce((s, r) => s + pick(r), 0);

  const plannedManhours = sum((r) => r.plannedManhours);
  const actualManhours = sum((r) => r.actualManhours);
  const expectedManhours = sum((r) => r.expectedManhours);
  const eacManhours = sum((r) => r.eacManhours);
  const efficiency = weightedEfficiency(rows);

  return {
    lineCount: rows.length,
    plannedManhours,
    actualManhours,
    ownManhours: sum((r) => r.ownManhours),
    subManhours: sum((r) => r.subManhours),
    machineHours: sum((r) => r.machineHours),
    expectedManhours,
    manhourVariance: actualManhours - expectedManhours,
    manhourPct: safePct(actualManhours, plannedManhours),
    efficiency,
    band: efficiencyBand(efficiency),
    eacManhours,
    eacVariance: eacManhours - plannedManhours,
    plannedAmount: sum((r) => r.plannedAmount),
    progressAmount: sum((r) => r.progressAmount),
    expenseAmount: sum((r) => r.expenseAmount),
    earnedPursantaj: sum((r) => r.earnedPursantaj ?? 0),
    // Planı olmayan satırı saymak şart: "verim %95" rakamı, pozların yarısında
    // plan yoksa yanıltıcıdır; arayüz bu sayıyı uyarı olarak gösterir.
    linesWithoutPlan: rows.filter((r) => r.plannedUnitManhours <= 0).length,
    committedAmount: sum((r) => r.committedAmount),
    openCommittedAmount: sum((r) => r.openCommittedAmount),
    costExposure: sum((r) => r.costExposure),
    budgetVariance: sum((r) => r.budgetVariance),
  };
}

export class GetContractPerformanceUseCase {
  constructor(
    private readonly performance: PerformanceRepository,
    private readonly contracts: ContractRepository,
  ) {}

  async execute(input: { contractId: number; companyId: number }): Promise<PerformanceReportDto> {
    const contract = await this.contracts.findById(input.contractId, input.companyId);
    if (!contract) throw new ContractNotFoundError(input.contractId);
    const rows = (await this.performance.listByContract(input.contractId, input.companyId)).map(
      decorate,
    );
    return { rows, summary: summarize(rows) };
  }
}

export class GetProjectPerformanceUseCase {
  constructor(
    private readonly performance: PerformanceRepository,
    private readonly projects: ProjectRepository,
  ) {}

  async execute(input: { projectId: number; companyId: number }): Promise<PerformanceReportDto> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);
    const rows = (await this.performance.listByProject(input.projectId, input.companyId)).map(
      decorate,
    );
    return { rows, summary: summarize(rows) };
  }
}

export class GetProjectManhourSummariesUseCase {
  constructor(
    private readonly performance: PerformanceRepository,
    private readonly projects: ProjectRepository,
  ) {}

  async execute(input: {
    projectId: number;
    companyId: number;
  }): Promise<ReadonlyArray<ContractManhourSummary & { band: EfficiencyBand }>> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);
    const list = await this.performance.projectSummaries(input.projectId, input.companyId);
    return list.map((s) => ({ ...s, band: efficiencyBand(s.efficiency) }));
  }
}

export interface SetUnitManhoursInput {
  companyId: number;
  contractId: number;
  updates: ReadonlyArray<{ boqLineId: number; unitManhours: number }>;
}

/**
 * Birim adam×saat girişi. Keşifteki diğer alanlara dokunmaz: teknik ofis
 * pursantaj/fiyat üzerinde çalışırken planlama ekibi aynı anda a×s girebilsin.
 */
export class SetUnitManhoursUseCase {
  constructor(
    private readonly performance: PerformanceRepository,
    private readonly contracts: ContractRepository,
  ) {}

  async execute(input: SetUnitManhoursInput): Promise<{ updated: number }> {
    const contract = await this.contracts.findById(input.contractId, input.companyId);
    if (!contract) throw new ContractNotFoundError(input.contractId);

    for (const u of input.updates) {
      if (!Number.isFinite(u.unitManhours) || u.unitManhours < 0) {
        throw new ConstructionValidationError('birim adam×saat negatif olamaz');
      }
    }

    // Satırların bu sözleşmeye ait olduğunu doğrula: id tahminiyle başka
    // sözleşmenin keşfine yazma girişimini burada kesiyoruz.
    const own = await this.performance.listByContract(input.contractId, input.companyId);
    const allowed = new Set(own.map((r) => r.boqLineId));
    for (const u of input.updates) {
      if (!allowed.has(u.boqLineId)) {
        throw new ConstructionValidationError(
          `keşif satırı bu sözleşmeye ait değil: ${String(u.boqLineId)}`,
        );
      }
    }

    const updated = await this.performance.setUnitManhours(input.companyId, input.updates);
    return { updated };
  }
}

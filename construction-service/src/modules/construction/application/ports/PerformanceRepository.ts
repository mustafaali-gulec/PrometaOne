/**
 * PerformanceRepository — poz bazlı adam×saat/verimlilik okuma portu (FAZ 4).
 * Concrete: infrastructure/persistence/PgPerformanceRepository.ts
 *
 * Yalnız OKUMA + tek yazma (birim adam×saat güncelleme). Performans satırları
 * türetilmiş veridir; kaynakları keşif (planlanan), puantaj + günlük rapor
 * (gerçekleşen) ve hakediş (mali gerçekleşen).
 */

/** cs_v_boq_performance satırı. Oranlar payda 0 iken null gelir. */
export interface BoqPerformanceRow {
  boqLineId: number;
  contractId: number;
  projectId: number;
  lineNo: number;
  pozNo: string | null;
  description: string;
  unit: string;
  locationId: number | null;

  plannedQty: number;
  unitPrice: number;
  plannedAmount: number;
  pursantajPct: number;
  plannedUnitManhours: number;
  plannedManhours: number;

  /** Hakedişten (onaylı/ödenmiş) kümülatif miktar — MALİ gerçeklik. */
  progressQty: number;
  progressAmount: number;
  /** Günlük rapor imalat kayıtlarından — FİZİKSEL gerçeklik. */
  producedQty: number;

  ownManhours: number;
  subManhours: number;
  actualManhours: number;
  machineHours: number;
  expenseAmount: number;

  progressPct: number | null;
  producedPct: number | null;
  manhourPct: number | null;
  earnedPursantaj: number | null;

  actualUnitManhours: number | null;
  expectedManhours: number;
  efficiency: number | null;
  manhourVariance: number;
}

export interface ContractManhourSummary {
  contractId: number;
  projectId: number;
  lineCount: number;
  plannedManhours: number;
  actualManhours: number;
  ownManhours: number;
  subManhours: number;
  machineHours: number;
  expectedManhours: number;
  manhourVariance: number;
  plannedAmount: number;
  progressAmount: number;
  expenseAmount: number;
  earnedPursantaj: number;
  manhourPct: number | null;
  /** Ağırlıklı verim (Σbeklenen / Σharcanan), satır ortalaması değil. */
  efficiency: number | null;
}

export interface PerformanceRepository {
  listByContract(contractId: number, companyId: number): Promise<ReadonlyArray<BoqPerformanceRow>>;
  listByProject(projectId: number, companyId: number): Promise<ReadonlyArray<BoqPerformanceRow>>;
  contractSummary(contractId: number, companyId: number): Promise<ContractManhourSummary | null>;
  projectSummaries(
    projectId: number,
    companyId: number,
  ): Promise<ReadonlyArray<ContractManhourSummary>>;
  /**
   * Birim adam×saat toplu güncelleme. Keşif satırının diğer alanlarına
   * dokunmaz — SaveBoqLines ile çakışmaması için ayrı yazma yolu.
   */
  setUnitManhours(
    companyId: number,
    updates: ReadonlyArray<{ boqLineId: number; unitManhours: number }>,
  ): Promise<number>;
}

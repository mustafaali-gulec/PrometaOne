/**
 * Rapor DTO'ları — proje gösterge paneli + pursantaj ilerleme eğrisi (S-eğrisi).
 * Mevcut verilerden türetilir (yeni tablo yok).
 */
export interface ProjectDashboardDto {
  projectId: number;
  projectName: string;
  currency: string;
  employerContractTotal: number; // işveren sözleşme bedeli (gelir taahhüdü)
  subcontractorContractTotal: number; // taşeron sözleşme bedeli (gider taahhüdü)
  boqTotal: number; // keşif toplamı (işveren)
  progressGrossCumul: number; // kümülatif yapılan iş (işveren hakediş)
  progressNetPaid: number; // ödenen net hakediş (işveren, paid)
  expenseTotal: number; // şantiye giderleri
  laborTotal: number; // işçilik + makine + yakıt + bakım
  costTotal: number; // expense + labor
  physicalPct: number; // fiziki gerçekleşme % (grossCumul / sözleşme)
  estimatedProfit: number; // grossCumul − costTotal
}

export interface ProgressCurvePointDto {
  seqNo: number;
  periodEnd: string | null;
  status: string;
  grossCumul: number;
  cumulPct: number;
}

export interface ProgressCurveDto {
  contractId: number;
  contractNo: string;
  contractAmount: number;
  currency: string;
  points: ProgressCurvePointDto[];
}

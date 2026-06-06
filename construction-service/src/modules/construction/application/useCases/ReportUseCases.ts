/**
 * Rapor use-case'leri (okuma/toplama): proje gösterge paneli + pursantaj eğrisi.
 * Mevcut repository'lerden beslenir; yeni kalıcılık yok.
 */
import {
  ContractNotFoundError,
  ProjectNotFoundError,
} from '../../domain/errors/ConstructionErrors.js';
import { round2 } from '../../domain/valueObjects/Currency.js';
import type {
  ProgressCurveDto,
  ProgressCurvePointDto,
  ProjectDashboardDto,
} from '../dto/ReportDtos.js';
import type { BoqRepository } from '../ports/BoqRepository.js';
import type { ContractRepository } from '../ports/ContractRepository.js';
import type { ExpenseRepository } from '../ports/FinanceRepositories.js';
import type { LaborCostRepository } from '../ports/LaborRepositories.js';
import type { ProgressPaymentRepository } from '../ports/ProgressPaymentRepository.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';

function pct(part: number, whole: number): number {
  return whole > 0 ? round2((part / whole) * 100) : 0;
}

export class GetProjectDashboardUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly contracts: ContractRepository,
    private readonly boq: BoqRepository,
    private readonly progress: ProgressPaymentRepository,
    private readonly expenses: ExpenseRepository,
    private readonly laborCost: LaborCostRepository,
  ) {}

  async execute(input: { companyId: number; projectId: number }): Promise<ProjectDashboardDto> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);

    const contracts = await this.contracts.listByCompany(input.companyId, {
      projectId: input.projectId,
    });
    const employer = contracts.filter((c) => c.partyKind === 'employer');
    const subs = contracts.filter((c) => c.partyKind === 'subcontractor');

    const employerContractTotal = round2(employer.reduce((s, c) => s + c.amount, 0));
    const subcontractorContractTotal = round2(subs.reduce((s, c) => s + c.amount, 0));

    let boqTotal = 0;
    let progressGrossCumul = 0;
    let progressNetPaid = 0;
    for (const c of employer) {
      const lines = await this.boq.listLinesByContract(c.id, input.companyId);
      boqTotal += lines.reduce((s, l) => s + l.amount, 0);
      const pps = await this.progress.listByContract(c.id, input.companyId, 'employer');
      // En yüksek kümülatif (son onaylı/işlenmiş hakediş)
      const maxGross = pps.reduce((m, p) => Math.max(m, p.toJSON().grossCumul), 0);
      progressGrossCumul += maxGross;
      progressNetPaid += pps
        .filter((p) => p.status === 'paid')
        .reduce((s, p) => s + p.toJSON().netPayable, 0);
    }
    boqTotal = round2(boqTotal);
    progressGrossCumul = round2(progressGrossCumul);
    progressNetPaid = round2(progressNetPaid);

    const byCat = await this.expenses.sumByCategory(input.projectId, input.companyId);
    const expenseTotal = round2(byCat.reduce((s, c) => s + c.amount, 0));
    const labor = await this.laborCost.costSummary(input.projectId, input.companyId);
    const laborTotal = round2(
      labor.laborCost + labor.machineWorkCost + labor.fuelCost + labor.maintCost,
    );
    const costTotal = round2(expenseTotal + laborTotal);

    return {
      projectId: input.projectId,
      projectName: project.name,
      currency: project.currency,
      employerContractTotal,
      subcontractorContractTotal,
      boqTotal,
      progressGrossCumul,
      progressNetPaid,
      expenseTotal,
      laborTotal,
      costTotal,
      physicalPct: pct(progressGrossCumul, employerContractTotal || boqTotal),
      estimatedProfit: round2(progressGrossCumul - costTotal),
    };
  }
}

export class GetProgressCurveUseCase {
  constructor(
    private readonly progress: ProgressPaymentRepository,
    private readonly contracts: ContractRepository,
  ) {}

  async execute(input: { companyId: number; contractId: number }): Promise<ProgressCurveDto> {
    const contract = await this.contracts.findById(input.contractId, input.companyId);
    if (!contract) throw new ContractNotFoundError(input.contractId);
    const pps = await this.progress.listByContract(
      input.contractId,
      input.companyId,
      contract.partyKind,
    );
    const points: ProgressCurvePointDto[] = pps
      .map((p) => p.toJSON())
      .sort((a, b) => a.seqNo - b.seqNo)
      .map((j) => ({
        seqNo: j.seqNo,
        periodEnd: j.periodEnd,
        status: j.status,
        grossCumul: j.grossCumul,
        cumulPct: pct(j.grossCumul, contract.amount),
      }));
    return {
      contractId: input.contractId,
      contractNo: contract.contractNo,
      contractAmount: contract.amount,
      currency: contract.currency,
      points,
    };
  }
}

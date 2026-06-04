/**
 * RunPayrollBatchUseCase — bir bordro koşusu için tüm AKTİF çalışanların
 * bordro satırlarını (item) PayrollCalculator ile hesaplar ve koşunun
 * satırlarını bu sonuçla değiştirir (idempotent: replaceItemsForRun).
 *
 * Sadece draft koşu yeniden hesaplanabilir; finalized koşu kilitlidir.
 *
 * SALARY KAYNAĞI (parite notu):
 *   Legacy App.jsx bordro motoru brüt ücreti `employee.brutSalary` alanından
 *   veya org-birim/pozisyon bağlamından alıyordu. Backend Employee entity'sinde
 *   ücret alanı YOK; bu yüzden brüt, çalışanın pozisyonunun `minSalary`
 *   değerinden alınır. Pozisyon yoksa veya minSalary null ise documented
 *   varsayılan DEFAULT_GROSS_SALARY (asgari ücret 2026) kullanılır.
 *   (İleride employee'ye ücret alanı eklenince burası tek noktadan değişir.)
 */
import { PayrollCalculator } from '../../domain/services/PayrollCalculator.js';
import {
  toPayrollItemDto,
  toPayrollRunDto,
  type PayrollItemDto,
  type PayrollRunDto,
} from '../dto/PayrollRunDto.js';
import { PayrollRunNotDraftError, PayrollRunNotFoundError } from '../errors/HrErrors.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';
import type { EmployeeRepository } from '../ports/EmployeeRepository.js';
import type { NewPayrollItemInput, PayrollRunRepository } from '../ports/PayrollRunRepository.js';
import type { PositionRepository } from '../ports/PositionRepository.js';

/** Pozisyondan ücret okunamayınca kullanılan varsayılan brüt (TL, 2026 asgari). */
export const DEFAULT_GROSS_SALARY = 26005.5;

export interface RunPayrollBatchInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  payrollRunId: number;
}

export interface RunPayrollBatchResult {
  run: PayrollRunDto;
  items: ReadonlyArray<PayrollItemDto>;
}

export class RunPayrollBatchUseCase {
  constructor(
    private readonly payroll: PayrollRunRepository,
    private readonly employees: EmployeeRepository,
    private readonly positions: PositionRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: RunPayrollBatchInput): Promise<RunPayrollBatchResult> {
    const run = await this.payroll.findRunById(input.payrollRunId, input.companyId);
    if (!run) {
      throw new PayrollRunNotFoundError(input.payrollRunId);
    }
    if (!run.isDraft()) {
      throw new PayrollRunNotDraftError(input.payrollRunId);
    }

    // Yalnızca aktif (probation/active) çalışanlar bordroya girer.
    const allEmployees = await this.employees.listByCompany(input.companyId);
    const activeEmployees = allEmployees.filter((e) => e.isActive());

    // Pozisyon ücretlerini önceden topla (tekrar sorgudan kaçın).
    const grossByPosition = new Map<number, number>();
    const newItems: NewPayrollItemInput[] = [];
    for (const emp of activeEmployees) {
      const gross = await this.resolveGrossSalary(emp.positionId, input.companyId, grossByPosition);
      const breakdown = PayrollCalculator.calculate(gross);
      newItems.push({
        companyId: input.companyId,
        runId: run.id,
        employeeId: emp.id,
        grossSalary: breakdown.grossSalary,
        sgkEmployee: breakdown.sgkEmployee,
        unemployment: breakdown.unemployment,
        incomeTax: breakdown.incomeTax,
        stampTax: breakdown.stampTax,
        otherDeductions: breakdown.otherDeductions,
        netSalary: breakdown.netSalary,
      });
    }

    const items = await this.payroll.replaceItemsForRun(run.id, input.companyId, newItems);

    await this.audit.log({
      at: this.clock.now(),
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.payroll.batch_run',
      details: {
        id: run.id,
        periodYear: run.periodYear,
        periodMonth: run.periodMonth,
        itemCount: items.length,
      },
    });

    return { run: toPayrollRunDto(run), items: items.map(toPayrollItemDto) };
  }

  private async resolveGrossSalary(
    positionId: number | null,
    companyId: number,
    cache: Map<number, number>,
  ): Promise<number> {
    if (positionId === null) {
      return DEFAULT_GROSS_SALARY;
    }
    const cached = cache.get(positionId);
    if (cached !== undefined) {
      return cached;
    }
    const position = await this.positions.findById(positionId, companyId);
    const gross =
      position && position.minSalary !== null && position.minSalary > 0
        ? position.minSalary
        : DEFAULT_GROSS_SALARY;
    cache.set(positionId, gross);
    return gross;
  }
}

/**
 * Reporting (Report Studio / Rapor Üreteci) modülü — Public API + DI kökü.
 *
 * registerReportingModule(pool, reportingPool, emailCfg?) repository + use-case'leri
 * wire eder ve { router, runDueScheduledReports } döner. src/index.ts router'ı
 * `/v1/reports` altına mount eder ve runDueScheduledReports'u saatlik cron'a bağlar.
 *   - pool          : ANA RW havuzu (tanım/denetim/zamanlama kalıcılığı + şema metadata)
 *   - reportingPool : SALT-OKUNUR havuz (ad-hoc/kayıtlı SQL yürütme)
 *   - emailCfg      : SMTP (yoksa Noop — e-posta konsola loglanır)
 */
import type { Pool } from 'pg';

import { CompileQueryUseCase } from './application/useCases/CompileQuery.js';
import { GetCatalogUseCase } from './application/useCases/GetCatalog.js';
import { ListReportRunsUseCase } from './application/useCases/ListReportRuns.js';
import {
  CreateReportDefinitionUseCase,
  DeleteReportDefinitionUseCase,
  GetReportDefinitionUseCase,
  ListReportDefinitionsUseCase,
  UpdateReportDefinitionUseCase,
} from './application/useCases/ReportDefinitionUseCases.js';
import { RunDueScheduledReportsUseCase } from './application/useCases/RunDueScheduledReports.js';
import { RunReportUseCase } from './application/useCases/RunReport.js';
import {
  CreateScheduledReportUseCase,
  DeleteScheduledReportUseCase,
  ListScheduledReportsUseCase,
  UpdateScheduledReportUseCase,
} from './application/useCases/ScheduledReportUseCases.js';
import {
  buildEmailSender,
  type EmailSenderConfig,
} from './infrastructure/email/NodemailerEmailSender.js';
import { PgReportDefinitionRepository } from './infrastructure/persistence/PgReportDefinitionRepository.js';
import { PgReportRunRepository } from './infrastructure/persistence/PgReportRunRepository.js';
import { PgScheduledReportRepository } from './infrastructure/persistence/PgScheduledReportRepository.js';
import { PgSchemaCatalogReader } from './infrastructure/persistence/PgSchemaCatalogReader.js';
import { SafeSqlExecutor } from './infrastructure/sql/SafeSqlExecutor.js';
import { createReportingRouter } from './presentation/routes.js';

export interface RegisteredReportingModule {
  router: ReturnType<typeof createReportingRouter>;
  /** Saatlik cron tetikler — vadesi gelen zamanlanmış raporları çalıştırır. */
  runDueScheduledReports: (now: Date) => Promise<{ due: number; ran: number; failed: number }>;
}

export function registerReportingModule(
  pool: Pool,
  reportingPool: Pool,
  emailCfg?: EmailSenderConfig,
): RegisteredReportingModule {
  const definitions = new PgReportDefinitionRepository(pool);
  const runs = new PgReportRunRepository(pool);
  const catalogReader = new PgSchemaCatalogReader(pool);
  const schedules = new PgScheduledReportRepository(pool);
  const executor = new SafeSqlExecutor(reportingPool);
  const email = buildEmailSender(emailCfg ?? { emailFrom: 'M Suite <noreply@prometa.local>' });

  const runReport = new RunReportUseCase(executor, definitions, runs, catalogReader);
  const runDue = new RunDueScheduledReportsUseCase(schedules, runReport, definitions, email);

  const router = createReportingRouter({
    getCatalog: new GetCatalogUseCase(catalogReader),
    compileQuery: new CompileQueryUseCase(catalogReader),
    runReport,
    listDefinitions: new ListReportDefinitionsUseCase(definitions),
    getDefinition: new GetReportDefinitionUseCase(definitions),
    createDefinition: new CreateReportDefinitionUseCase(definitions),
    updateDefinition: new UpdateReportDefinitionUseCase(definitions),
    deleteDefinition: new DeleteReportDefinitionUseCase(definitions),
    listRuns: new ListReportRunsUseCase(runs),
    listSchedules: new ListScheduledReportsUseCase(schedules),
    createSchedule: new CreateScheduledReportUseCase(schedules, definitions),
    updateSchedule: new UpdateScheduledReportUseCase(schedules),
    deleteSchedule: new DeleteScheduledReportUseCase(schedules),
  });

  return {
    router,
    runDueScheduledReports: (now: Date) => runDue.execute(now),
  };
}

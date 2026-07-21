/**
 * Notifications modülü — Public API + DI composition root.
 *
 * Dış dünyaya açılan tek arayüz. ESLint kuralı ile internal'a doğrudan
 * erişim yasak. api-server/src/index.ts (composition root) sadece
 * `registerNotificationsModule`'u çağırır.
 */
import type { Hono } from 'hono';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { Pool } from 'pg';

import { toNotificationDto, type NotificationDto } from './application/dto/NotificationDto.js';
import { systemClock, type Clock } from './application/ports/Clock.js';
import type {
  EmailLogEntry,
  EmailLogFilter,
  EmailLogListResult,
  EmailLogRepository,
  EmailLogStatus,
} from './application/ports/EmailLogRepository.js';
import type { EmailRecipientDirectory } from './application/ports/EmailRecipientDirectory.js';
import type {
  EmailService,
  SendEmailRequest,
  SendEmailResult,
} from './application/ports/EmailService.js';
import type { IdGenerator } from './application/ports/IdGenerator.js';
import type { NotificationRepository } from './application/ports/NotificationRepository.js';
import {
  CreateNotificationUseCase,
  type CreateNotificationInput,
} from './application/useCases/CreateNotification.js';
import {
  FetchNotificationsForUserUseCase,
  type FetchNotificationsForUserInput,
  type FetchNotificationsForUserResult,
} from './application/useCases/FetchNotificationsForUser.js';
import {
  MarkNotificationAsReadUseCase,
  NotificationForbiddenError,
  NotificationNotFoundError,
  type MarkNotificationAsReadInput,
} from './application/useCases/MarkNotificationAsRead.js';
import {
  SendNotificationEmailUseCase,
  type SendNotificationEmailInput,
  type SendNotificationEmailResult,
} from './application/useCases/SendNotificationEmail.js';
import { Notification } from './domain/entities/Notification.js';
import type { NotificationProps } from './domain/entities/Notification.js';
import {
  buildNotificationContent,
  type NotificationContent,
} from './domain/services/NotificationFactory.js';
import {
  NOTIFICATION_KIND_VALUES,
  type ApprovalStaleKind,
  type CheckDueSoonKind,
  type GenericKind,
  type InvoiceOverdueKind,
  type NotificationKind,
  type ScheduledReportKind,
  type TaskDueSoonKind,
  type TaxDeadlineWarningKind,
} from './domain/valueObjects/NotificationKind.js';
import {
  CronScheduler,
  type CronJobDefinition,
  type CronLogger,
} from './infrastructure/cron/CronScheduler.js';
import { NodemailerEmailService } from './infrastructure/email/NodemailerEmailService.js';
import { uuidGenerator } from './infrastructure/ids/UuidGenerator.js';
import { PgEmailLogRepository } from './infrastructure/persistence/PgEmailLogRepository.js';
import { PgEmailRecipientDirectory } from './infrastructure/persistence/PgEmailRecipientDirectory.js';
import { PgNotificationRepository } from './infrastructure/persistence/PgNotificationRepository.js';
import { createEmailRouter } from './presentation/emailRoutes.js';
import { createNotificationsRouter } from './presentation/routes.js';

// ===========================================================================
// Public API re-exports
// ===========================================================================
export { Notification };
export type { NotificationProps };
export type {
  ApprovalStaleKind,
  CheckDueSoonKind,
  GenericKind,
  InvoiceOverdueKind,
  NotificationKind,
  ScheduledReportKind,
  TaskDueSoonKind,
  TaxDeadlineWarningKind,
};
export { NOTIFICATION_KIND_VALUES, buildNotificationContent };
export type { NotificationContent };
export { toNotificationDto };
export type { NotificationDto };
export type { EmailService, SendEmailRequest, SendEmailResult };
export type {
  EmailLogEntry,
  EmailLogFilter,
  EmailLogListResult,
  EmailLogRepository,
  EmailLogStatus,
};
export type { EmailRecipientDirectory };
export { SendNotificationEmailUseCase };
export type { SendNotificationEmailInput, SendNotificationEmailResult };
export type { IdGenerator };
export { systemClock };
export type { Clock };
export type { NotificationRepository };
export {
  FetchNotificationsForUserUseCase,
  MarkNotificationAsReadUseCase,
  CreateNotificationUseCase,
  NotificationForbiddenError,
  NotificationNotFoundError,
};
export type {
  FetchNotificationsForUserInput,
  FetchNotificationsForUserResult,
  MarkNotificationAsReadInput,
  CreateNotificationInput,
};

// ===========================================================================
// DI composition — registerNotificationsModule
// ===========================================================================

export interface NotificationsModuleConfig {
  /** SMTP host. Boşsa email gönderilmez (no-op service). */
  smtpHost: string | undefined;
  smtpPort: number | undefined;
  smtpSecure: boolean;
  smtpUser: string | undefined;
  smtpPass: string | undefined;
  /** Gönderici. Örn: "Prometa One <noreply@prometa.local>" */
  emailFrom: string;
  /** Cron etkin mi? */
  enableCron: boolean;
}

export interface NotificationsModuleDeps {
  /** PostgreSQL pool — DI ile inject. */
  pool: Pool;
  /** Logger (opsiyonel). */
  logger?: CronLogger;
  /** Clock override (test için). Yoksa systemClock. */
  clock?: Clock;
  /** IdGenerator override (test için). Yoksa uuidGenerator. */
  ids?: IdGenerator;
  /** SMTP transporter override (test için). Yoksa nodemailer.createTransport(...). */
  transporter?: Transporter;
}

export interface RegisteredNotificationsModule {
  /** PR 2: route'lar otomatik mount edilmiş. */
  router: Hono;
  /** /v1/email altına mount edilir (POST /send, GET /log). */
  emailRouter: Hono;
  /** Cron scheduler — server start'ta `.start()`, shutdown'da `.stop()`. */
  scheduler: CronScheduler;
  /** Cron job'lar ve dış kullanım için use-case erişimi. */
  useCases: {
    fetch: FetchNotificationsForUserUseCase;
    markAsRead: MarkNotificationAsReadUseCase;
    create: CreateNotificationUseCase;
    sendEmail: SendNotificationEmailUseCase;
  };
}

export function registerNotificationsModule(
  cfg: NotificationsModuleConfig,
  deps: NotificationsModuleDeps,
): RegisteredNotificationsModule {
  // 1. Infrastructure binding
  const repo = new PgNotificationRepository(deps.pool);
  const emailLogRepo = new PgEmailLogRepository(deps.pool);
  const recipientDirectory = new PgEmailRecipientDirectory(deps.pool);

  const { service: emailService, configured: emailConfigured } = buildEmailService(cfg, deps);

  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? uuidGenerator;

  // 2. Use-cases
  const fetch = new FetchNotificationsForUserUseCase(repo);
  const markAsRead = new MarkNotificationAsReadUseCase(repo, clock);
  const create = new CreateNotificationUseCase(repo, clock, ids, emailService);
  const sendEmail = new SendNotificationEmailUseCase(
    emailService,
    emailLogRepo,
    recipientDirectory,
    ids,
    clock,
    { emailConfigured, providerName: 'smtp' },
  );

  // 3. Presentation
  const router = createNotificationsRouter({
    fetchUseCase: fetch,
    markAsReadUseCase: markAsRead,
    createUseCase: create,
  });
  const emailRouter = createEmailRouter({
    sendEmailUseCase: sendEmail,
    emailLogRepo,
  });

  // 4. Cron — PR 2'de iskelet boş; gerçek job'lar PR 3'te eklenecek
  //    (eski legacy/backend/cronDaemon.js'in modernleştirilmiş hâli).
  const cronJobs: CronJobDefinition[] = [];
  const scheduler = new CronScheduler(cronJobs, deps.logger);

  return {
    router,
    emailRouter,
    scheduler,
    useCases: { fetch, markAsRead, create, sendEmail },
  };
}

function buildEmailService(
  cfg: NotificationsModuleConfig,
  deps: NotificationsModuleDeps,
): { service: EmailService; configured: boolean } {
  if (deps.transporter) {
    return {
      service: new NodemailerEmailService(deps.transporter, { from: cfg.emailFrom }),
      configured: true,
    };
  }
  if (!cfg.smtpHost || !cfg.smtpUser || !cfg.smtpPass) {
    // SMTP konfigüre değil — email'leri sessizce yutan no-op service.
    // configured:false → /v1/email/send dürüstçe success:false döndürür.
    return { service: new NoopEmailService(), configured: false };
  }
  const transporter = nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort ?? 587,
    secure: cfg.smtpSecure ?? false,
    auth: { user: cfg.smtpUser, pass: cfg.smtpPass },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });
  return {
    service: new NodemailerEmailService(transporter, { from: cfg.emailFrom }),
    configured: true,
  };
}

class NoopEmailService implements EmailService {
  send(_req: SendEmailRequest): Promise<SendEmailResult> {
    // Bilerek no-op. Email konfigüre edilmediğinde kullanılır.
    return Promise.resolve({});
  }
}

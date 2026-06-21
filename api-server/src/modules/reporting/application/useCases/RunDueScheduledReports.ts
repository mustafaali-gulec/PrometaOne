/**
 * RunDueScheduledReports — cron'un saatlik çağırdığı use-case.
 *
 * Şu saate denk gelen enabled zamanlamaları bulur; her birini çalıştırır,
 * xlsx üretir, e-posta ile gönderir, last_run/last_status günceller. Cron
 * saatlik çalıştığından eşleşme saat granülerliğindedir; aynı saatte tekrar
 * göndermemek için lastRunAt kontrolü yapılır.
 */
import { buildXlsxBuffer } from '../../infrastructure/xlsx/buildXlsxBuffer.js';
import type { EmailSender } from '../ports/EmailSender.js';
import type { ReportDefinitionRepository } from '../ports/ReportDefinitionRepository.js';
import type {
  ScheduledReport,
  ScheduledReportRepository,
} from '../ports/ScheduledReportRepository.js';

import type { RunReportUseCase } from './RunReport.js';

const sameHour = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate() &&
  a.getHours() === b.getHours();

const safeName = (s: string): string => s.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'rapor';

export class RunDueScheduledReportsUseCase {
  constructor(
    private readonly schedules: ScheduledReportRepository,
    private readonly runReport: RunReportUseCase,
    private readonly definitions: ReportDefinitionRepository,
    private readonly email: EmailSender,
  ) {}

  /** Bir zamanlama şu an (now) çalışmalı mı? */
  isDue(s: ScheduledReport, now: Date): boolean {
    const hh = Number((s.timeOfDay || '08:00').split(':')[0]);
    if (now.getHours() !== hh) return false;
    if (s.lastRunAt && sameHour(new Date(s.lastRunAt), now)) return false; // aynı saatte tekrar yok
    switch (s.frequency) {
      case 'daily':
        return true;
      case 'weekly':
        return now.getDay() === s.dayOfWeek;
      case 'monthly':
        return now.getDate() === s.dayOfMonth;
      default:
        return false;
    }
  }

  async execute(now: Date): Promise<{ due: number; ran: number; failed: number }> {
    const all = await this.schedules.listEnabled();
    const due = all.filter((s) => this.isDue(s, now));
    let ran = 0;
    let failed = 0;

    for (const s of due) {
      try {
        const result = await this.runReport.execute({
          companyId: s.companyId,
          runBy: s.createdBy,
          reportId: s.reportId,
          params: s.paramValues,
        });
        const def = await this.definitions.findById(s.reportId, s.companyId);
        const name = def?.name || `rapor-${s.reportId}`;
        const xlsx = await buildXlsxBuffer(result, name);
        if (s.recipients.length > 0) {
          await this.email.send({
            to: s.recipients.join(','),
            subject: `Rapor: ${name}`,
            text: `${name} raporu ektedir (${result.rowCount} satır, ${new Date().toLocaleString('tr-TR')}).`,
            attachments: [
              {
                filename: `${safeName(name)}.xlsx`,
                content: xlsx,
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              },
            ],
          });
        }
        await this.schedules.markRun(s.id, 'success', now);
        ran++;
      } catch (err) {
        failed++;
        await this.schedules.markRun(s.id, 'error', now).catch(() => {});
        console.error(
          `[reporting] zamanlanmış rapor #${s.id} hatası:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
    return { due: due.length, ran, failed };
  }
}

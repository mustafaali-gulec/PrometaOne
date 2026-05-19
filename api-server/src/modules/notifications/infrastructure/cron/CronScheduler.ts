/**
 * CronScheduler — node-cron wrapper.
 *
 * Her job için ayrı schedule + executor. Stop'la temiz kapanır.
 * Test edilebilir: schedule() çağrılınca işin gerçekten kaydedildiğini
 * doğrularız, executor'ı manuel tetikleyerek davranışı assert ederiz.
 */
import cron from 'node-cron';

export interface CronJobDefinition {
  /** Yetkili isim — log'larda görünür. */
  name: string;
  /** Cron pattern (örn. '0 9 * * *' = her gün 09:00). */
  pattern: string;
  /** Çalıştırılacak iş. Hata fırlatırsa logla, scheduler durmasın. */
  execute: () => Promise<void> | void;
}

export interface CronLogger {
  info(msg: string): void;
  error(msg: string, err?: unknown): void;
}

const noopLogger: CronLogger = {
  info: () => {},
  error: () => {},
};

export class CronScheduler {
  private readonly tasks: cron.ScheduledTask[] = [];
  private started = false;

  constructor(
    private readonly jobs: ReadonlyArray<CronJobDefinition>,
    private readonly logger: CronLogger = noopLogger,
  ) {
    for (const job of this.jobs) {
      if (!cron.validate(job.pattern)) {
        throw new Error(`CronScheduler: geçersiz pattern "${job.pattern}" (job: ${job.name})`);
      }
    }
  }

  start(): void {
    if (this.started) return;
    for (const job of this.jobs) {
      const task = cron.schedule(
        job.pattern,
        () => {
          void this.runJob(job);
        },
        { timezone: 'Europe/Istanbul' },
      );
      this.tasks.push(task);
      this.logger.info(`[cron] scheduled: ${job.name} (${job.pattern})`);
    }
    this.started = true;
  }

  stop(): void {
    if (!this.started) return;
    for (const task of this.tasks) {
      task.stop();
    }
    this.tasks.length = 0;
    this.started = false;
    this.logger.info('[cron] all jobs stopped');
  }

  /** Test/debug için: bir işi pattern'ini beklemeden hemen çalıştır. */
  async runOnce(jobName: string): Promise<void> {
    const job = this.jobs.find((j) => j.name === jobName);
    if (!job) throw new Error(`Job bulunamadı: ${jobName}`);
    await this.runJob(job);
  }

  private async runJob(job: CronJobDefinition): Promise<void> {
    this.logger.info(`[cron] running: ${job.name}`);
    try {
      await job.execute();
      this.logger.info(`[cron] done: ${job.name}`);
    } catch (err: unknown) {
      this.logger.error(`[cron] failed: ${job.name}`, err);
    }
  }
}

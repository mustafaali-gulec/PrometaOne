/**
 * RunDueScheduledReports testleri — isDue mantığı + çalıştırma akışı (fakes).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { EmailSender, SendEmailRequest } from '../../application/ports/EmailSender.js';
import type { ReportDefinitionRepository } from '../../application/ports/ReportDefinitionRepository.js';
import type {
  ScheduledReport,
  ScheduledReportRepository,
} from '../../application/ports/ScheduledReportRepository.js';
import type { RunResult, SqlExecutor } from '../../application/ports/SqlExecutor.js';
import { RunDueScheduledReportsUseCase } from '../../application/useCases/RunDueScheduledReports.js';
import { RunReportUseCase } from '../../application/useCases/RunReport.js';

const NOW = new Date(2026, 5, 21, 8, 0, 0); // 21 Haz 2026, 08:00

function sched(over: Partial<ScheduledReport> = {}): ScheduledReport {
  return {
    id: 1,
    companyId: 1,
    reportId: 10,
    frequency: 'daily',
    dayOfWeek: null,
    dayOfMonth: null,
    timeOfDay: '08:00',
    recipients: ['a@x.com'],
    paramValues: {},
    format: 'xlsx',
    enabled: true,
    lastRunAt: null,
    lastStatus: null,
    createdBy: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

const okResult: RunResult = {
  columns: [{ key: 'a', type: 'number' }],
  rows: [[1]],
  rowCount: 1,
  truncated: false,
  durationMs: 1,
};

class FakeSchedRepo implements ScheduledReportRepository {
  marks: Array<{ id: number; status: string }> = [];
  constructor(private readonly enabled: ScheduledReport[]) {}
  async insert(): Promise<ScheduledReport> {
    throw new Error('n/a');
  }
  async update(): Promise<null> {
    return null;
  }
  async remove(): Promise<void> {}
  async findById(): Promise<null> {
    return null;
  }
  async listByCompany(): Promise<ScheduledReport[]> {
    return [];
  }
  async listEnabled(): Promise<ScheduledReport[]> {
    return this.enabled;
  }
  async markRun(id: number, status: string): Promise<void> {
    this.marks.push({ id, status });
  }
}

const fakeDefs = {
  async findById() {
    return { id: 10, name: 'Test Rapor' };
  },
} as unknown as ReportDefinitionRepository;

const fakeCatalog = {
  async readCatalog() {
    return [];
  },
};
const fakeExecutor: SqlExecutor = {
  async execute() {
    return okResult;
  },
};

function makeRunReport(): RunReportUseCase {
  // RunReport gerçek use-case; executor sabit sonuç döner, def fake.
  const defs = {
    async findById() {
      return { id: 10, mode: 'sql', sqlText: 'SELECT 1', params: [] };
    },
  } as unknown as ReportDefinitionRepository;
  const runs = {
    async insert() {
      return { id: 1 };
    },
    async listByCompany() {
      return [];
    },
  };
  return new RunReportUseCase(fakeExecutor, defs, runs, fakeCatalog);
}

describe('RunDueScheduledReports.isDue', () => {
  const uc = new RunDueScheduledReportsUseCase(new FakeSchedRepo([]), makeRunReport(), fakeDefs, {
    async send() {},
  });

  it('daily — eşleşen saat', () => {
    assert.equal(uc.isDue(sched(), NOW), true);
    assert.equal(uc.isDue(sched(), new Date(2026, 5, 21, 9, 0, 0)), false);
  });
  it('weekly — gün eşleşmesi', () => {
    assert.equal(uc.isDue(sched({ frequency: 'weekly', dayOfWeek: NOW.getDay() }), NOW), true);
    assert.equal(
      uc.isDue(sched({ frequency: 'weekly', dayOfWeek: (NOW.getDay() + 1) % 7 }), NOW),
      false,
    );
  });
  it('monthly — ay günü eşleşmesi', () => {
    assert.equal(uc.isDue(sched({ frequency: 'monthly', dayOfMonth: NOW.getDate() }), NOW), true);
    assert.equal(
      uc.isDue(sched({ frequency: 'monthly', dayOfMonth: NOW.getDate() + 1 }), NOW),
      false,
    );
  });
  it('aynı saatte tekrar çalışmaz (lastRunAt)', () => {
    assert.equal(uc.isDue(sched({ lastRunAt: NOW }), NOW), false);
  });
});

describe('RunDueScheduledReports.execute', () => {
  it('vadesi gelen rapor çalışır → ek dosyalı e-posta + markRun(success)', async () => {
    const repo = new FakeSchedRepo([sched()]);
    const sent: SendEmailRequest[] = [];
    const email: EmailSender = {
      async send(req) {
        sent.push(req);
      },
    };
    const uc = new RunDueScheduledReportsUseCase(repo, makeRunReport(), fakeDefs, email);
    const res = await uc.execute(NOW);

    assert.equal(res.due, 1);
    assert.equal(res.ran, 1);
    assert.equal(res.failed, 0);
    assert.equal(sent.length, 1);
    assert.equal(sent[0]!.to, 'a@x.com');
    assert.equal(sent[0]!.attachments?.length, 1);
    assert.match(sent[0]!.attachments[0]!.filename, /\.xlsx$/);
    assert.equal(repo.marks[0]?.status, 'success');
  });
});

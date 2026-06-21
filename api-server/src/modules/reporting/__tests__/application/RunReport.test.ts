/**
 * RunReport use-case testleri — sahte (fake) executor + repo'larla.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ReportDefinitionRepository } from '../../application/ports/ReportDefinitionRepository.js';
import type {
  NewReportRun,
  ReportRunRepository,
} from '../../application/ports/ReportRunRepository.js';
import type { RunResult, SqlExecutor } from '../../application/ports/SqlExecutor.js';
import { RunReportUseCase } from '../../application/useCases/RunReport.js';
import type { ReportDefinition } from '../../domain/entities/ReportDefinition.js';
import {
  QueryTimeoutError,
  ReportDefinitionNotFoundError,
  SqlNotAllowedError,
} from '../../domain/errors/ReportingErrors.js';

class FakeRunRepo implements ReportRunRepository {
  runs: NewReportRun[] = [];
  async insert(input: NewReportRun): Promise<{ id: number }> {
    this.runs.push(input);
    return { id: this.runs.length };
  }
  async listByCompany(): Promise<[]> {
    return [];
  }
}

const okResult: RunResult = {
  columns: [{ key: 'id', type: 'number' }],
  rows: [[1], [2]],
  rowCount: 2,
  truncated: false,
  durationMs: 5,
};

function makeDefRepo(def: ReportDefinition | null): ReportDefinitionRepository {
  return {
    async findById() {
      return def;
    },
    async insert() {
      throw new Error('n/a');
    },
    async update() {
      return null;
    },
    async remove() {},
    async listByCompany() {
      return [];
    },
    async existsByName() {
      return false;
    },
  };
}

const fakeCatalog = {
  async readCatalog() {
    return [];
  },
};

describe('RunReportUseCase', () => {
  it('ad-hoc düz SELECT → sonuç döner ve success denetlenir', async () => {
    let capturedSql = '';
    let capturedValues: readonly unknown[] = [];
    const executor: SqlExecutor = {
      async execute(sql, values) {
        capturedSql = sql;
        capturedValues = values;
        return okResult;
      },
    };
    const runs = new FakeRunRepo();
    const uc = new RunReportUseCase(executor, makeDefRepo(null), runs, fakeCatalog);

    const res = await uc.execute({
      companyId: 1,
      runBy: 7,
      mode: 'sql',
      sql: 'SELECT id FROM invoices WHERE total >= :minTotal',
      paramDefs: [{ name: 'minTotal', type: 'number' }],
      params: { minTotal: 100 },
    });

    assert.equal(res.rowCount, 2);
    assert.equal(capturedSql, 'SELECT id FROM invoices WHERE total >= $1');
    assert.deepEqual(capturedValues, [100]);
    assert.equal(runs.runs.length, 1);
    assert.equal(runs.runs[0]!.status, 'success');
    assert.equal(runs.runs[0]!.rowCount, 2);
    assert.equal(runs.runs[0]!.runBy, 7);
  });

  it('DML SQL → SqlNotAllowedError + blocked denetimi', async () => {
    const executor: SqlExecutor = {
      async execute() {
        throw new Error('çalıştırılmamalıydı');
      },
    };
    const runs = new FakeRunRepo();
    const uc = new RunReportUseCase(executor, makeDefRepo(null), runs, fakeCatalog);

    await assert.rejects(
      () => uc.execute({ companyId: 1, runBy: 1, mode: 'sql', sql: 'DELETE FROM invoices' }),
      SqlNotAllowedError,
    );
    assert.equal(runs.runs.length, 1);
    assert.equal(runs.runs[0]!.status, 'blocked');
  });

  it('kayıtlı rapor bulunamadı → ReportDefinitionNotFoundError', async () => {
    const executor: SqlExecutor = {
      async execute() {
        return okResult;
      },
    };
    const uc = new RunReportUseCase(executor, makeDefRepo(null), new FakeRunRepo(), fakeCatalog);
    await assert.rejects(
      () => uc.execute({ companyId: 1, runBy: 1, reportId: 999 }),
      ReportDefinitionNotFoundError,
    );
  });

  it('executor timeout → timeout denetimi + rethrow', async () => {
    const executor: SqlExecutor = {
      async execute() {
        throw new QueryTimeoutError(15000);
      },
    };
    const runs = new FakeRunRepo();
    const uc = new RunReportUseCase(executor, makeDefRepo(null), runs, fakeCatalog);
    await assert.rejects(
      () => uc.execute({ companyId: 1, runBy: 1, mode: 'sql', sql: 'SELECT * FROM invoices' }),
      QueryTimeoutError,
    );
    assert.equal(runs.runs[0]!.status, 'timeout');
  });
});

/**
 * İş Gücü & Makine use-case testleri (node:test) — personel, puantaj upsert,
 * makine + log, gün faktörü.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  CreateMachineLogUseCase,
  CreateMachineUseCase,
  CreatePersonnelUseCase,
  ListTimesheetsUseCase,
  SaveTimesheetUseCase,
} from '../../application/useCases/LaborUseCases.js';
import { CreateProjectUseCase } from '../../application/useCases/ProjectUseCases.js';
import { Machine } from '../../domain/entities/Machine.js';
import {
  DuplicateMachineCodeError,
  PersonnelNotFoundError,
  ProjectNotFoundError,
} from '../../domain/errors/ConstructionErrors.js';
import { dayFactor } from '../../domain/valueObjects/Labor.js';
import {
  InMemoryMachineLogRepository,
  InMemoryMachineRepository,
  InMemoryPersonnelRepository,
  InMemoryProjectRepository,
  InMemoryTimesheetRepository,
} from '../fakes.js';

describe('dayFactor', () => {
  it('P=1, Y=0.5, X/İ=0', () => {
    assert.equal(dayFactor('P'), 1);
    assert.equal(dayFactor('Y'), 0.5);
    assert.equal(dayFactor('X'), 0);
    assert.equal(dayFactor('I'), 0);
  });
});

describe('LaborUseCases', () => {
  let personnel: InMemoryPersonnelRepository;
  let timesheets: InMemoryTimesheetRepository;
  let machines: InMemoryMachineRepository;
  let logs: InMemoryMachineLogRepository;
  let projects: InMemoryProjectRepository;

  beforeEach(() => {
    personnel = new InMemoryPersonnelRepository();
    timesheets = new InMemoryTimesheetRepository();
    machines = new InMemoryMachineRepository();
    logs = new InMemoryMachineLogRepository();
    projects = new InMemoryProjectRepository();
  });

  async function makeProject(): Promise<number> {
    const p = await new CreateProjectUseCase(projects).execute({ companyId: 1, name: 'P' });
    return p.id;
  }

  it('proje yoksa personel eklenemez', async () => {
    await assert.rejects(
      () =>
        new CreatePersonnelUseCase(personnel, projects).execute({
          companyId: 1,
          projectId: 999,
          fullName: 'Ali',
        }),
      ProjectNotFoundError,
    );
  });

  it('personel + puantaj upsert (aynı gün üzerine yazar)', async () => {
    const projectId = await makeProject();
    const per = await new CreatePersonnelUseCase(personnel, projects).execute({
      companyId: 1,
      projectId,
      fullName: 'Ahmet Usta',
      trade: 'duvarcı',
      dailyCost: 1500,
    });
    const save = new SaveTimesheetUseCase(timesheets, personnel);
    await save.execute({
      companyId: 1,
      personnelId: per.id,
      workDate: '2026-06-01',
      statusCode: 'P',
    });
    const second = await save.execute({
      companyId: 1,
      personnelId: per.id,
      workDate: '2026-06-01',
      statusCode: 'Y',
    });
    assert.equal(second.statusCode, 'Y');
    const list = await new ListTimesheetsUseCase(timesheets).execute({ companyId: 1, projectId });
    assert.equal(list.length, 1); // upsert: tek kayıt
  });

  it('bulunmayan personele puantaj → PersonnelNotFoundError', async () => {
    await assert.rejects(
      () =>
        new SaveTimesheetUseCase(timesheets, personnel).execute({
          companyId: 1,
          personnelId: 999,
          workDate: '2026-06-01',
        }),
      PersonnelNotFoundError,
    );
  });

  it('makine + log; aynı makine kodu reddedilir', async () => {
    const projectId = await makeProject();
    const create = new CreateMachineUseCase(machines);
    const mac = await create.execute({
      companyId: 1,
      code: 'EKS-01',
      name: 'Ekskavatör',
      kind: 'owned',
      hourlyCost: 800,
    });
    assert.equal(mac.kind, 'owned');
    await assert.rejects(
      () => create.execute({ companyId: 1, code: 'EKS-01', name: 'X' }),
      DuplicateMachineCodeError,
    );
    const log = await new CreateMachineLogUseCase(logs, machines, projects).execute({
      companyId: 1,
      machineId: mac.id,
      projectId,
      logDate: '2026-06-02',
      workHours: 8,
      fuelCost: 1200,
      maintCost: 0,
    });
    assert.equal(log.workHours, 8);
    assert.equal(log.fuelCost, 1200);
  });
});

describe('Machine — pasife çekme / geri alma (SF-6 açığı)', () => {
  const NOW = new Date('2026-07-30T10:00:00.000Z');

  function machine(): Machine {
    return Machine.create({
      id: 1,
      companyId: 1,
      code: 'EKS-01',
      name: 'Ekskavatör',
      kind: 'rented',
      vendorId: null,
      hourlyCost: 1200,
      active: true,
      createdBy: 1,
      createdAt: NOW,
      updatedAt: NOW,
    });
  }

  it('update({active:false}) pasife çeker; kayıt silinmez, alanlar korunur', () => {
    const off = machine().update({ active: false }, NOW);
    assert.equal(off.active, false);
    assert.equal(off.code, 'EKS-01');
    assert.equal(off.hourlyCost, 1200);
  });

  it('pasif makine update({active:true}) ile geri alınır', () => {
    const back = machine().update({ active: false }, NOW).update({ active: true }, NOW);
    assert.equal(back.active, true);
  });

  it('active verilmezse mevcut durum DEĞİŞMEZ (yan etkisiz güncelleme)', () => {
    const off = machine().update({ active: false }, NOW);
    assert.equal(off.update({ hourlyCost: 1300 }, NOW).active, false);
  });
});

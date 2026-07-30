/**
 * Şantiye günlüğü (FAZ 3) testleri — tip başına alan kuralları, gün kilidi,
 * puantaj/makine köprüleri, İSG oranları, iş gücü raporu.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { buildDayDto, buildSafetySummary } from '../../application/dto/DailyLogDtos.js';
import {
  AddDailyLogCommentUseCase,
  ChangeDailyLogStatusUseCase,
  DeleteDailyLogEntryUseCase,
  GetDailyLogDayUseCase,
  GetDailyLogMonthUseCase,
  GetManpowerReportUseCase,
  GetProductionActualsUseCase,
  GetSafetySummaryUseCase,
  SaveDailyLogEntryUseCase,
  UpdateDailyLogUseCase,
  monthRange,
} from '../../application/useCases/DailyLogUseCases.js';
import { CreateProjectUseCase } from '../../application/useCases/ProjectUseCases.js';
import { DailyLog, DailyLogEntry } from '../../domain/entities/DailyLog.js';
import {
  ConstructionValidationError,
  DailyLogEntryNotFoundError,
  DailyLogLockedError,
} from '../../domain/errors/ConstructionErrors.js';
import {
  isFieldAllowed,
  isRecordableAccident,
  kindSpec,
} from '../../domain/valueObjects/DailyLogKind.js';
import {
  InMemoryDailyLogRepository,
  RecordingMachineLogRepository,
  RecordingTimesheetRepository,
} from '../dailyLogFakes.js';
import { FixedClock, InMemoryProjectRepository } from '../fakes.js';

const D = new Date('2026-07-28T09:00:00.000Z');

function makeEntry(over: Partial<Parameters<typeof DailyLogEntry.create>[0]>): DailyLogEntry {
  return DailyLogEntry.create({
    id: 1,
    companyId: 1,
    logId: 1,
    kind: 'note',
    locationId: null,
    vendorId: null,
    personnelId: null,
    machineId: null,
    materialId: null,
    boqLineId: null,
    trackingItemId: null,
    crewName: null,
    personName: null,
    description: 'test',
    headcount: null,
    hours: null,
    idleHours: null,
    qty: null,
    unit: null,
    amount: null,
    currency: 'TRY',
    waybillNo: null,
    occurredAt: null,
    severity: null,
    lostDays: null,
    sortOrder: 0,
    createdBy: null,
    createdAt: D,
    updatedAt: D,
    ...over,
  });
}

describe('DailyLogKind alan kuralları', () => {
  it('taşeron kaydı firma + kişi + saat ister', () => {
    assert.deepEqual([...kindSpec('subcontractor').required], ['vendorId', 'headcount', 'hours']);
  });
  it('personel ve ekipman köprü kurar, diğerleri kurmaz', () => {
    assert.equal(kindSpec('personnel').bridge, 'timesheet');
    assert.equal(kindSpec('equipment').bridge, 'machine_log');
    assert.equal(kindSpec('note').bridge, undefined);
  });
  it('not kaydı miktar alanı taşımaz', () => {
    assert.ok(!isFieldAllowed('note', 'qty'));
    assert.ok(isFieldAllowed('production', 'qty'));
  });
  it('ramak kala kaza sayılmaz, diğer şiddetler sayılır', () => {
    assert.ok(!isRecordableAccident('near_miss'));
    assert.ok(isRecordableAccident('first_aid'));
    assert.ok(isRecordableAccident('fatal'));
  });
});

describe('DailyLogEntry doğrulaması', () => {
  it('kaza kaydı şiddet olmadan oluşmaz', () => {
    assert.throws(
      () => makeEntry({ kind: 'accident', description: 'kaydı' }),
      (err: unknown) => {
        assert.ok(err instanceof ConstructionValidationError);
        assert.match(err.message, /olay şiddeti zorunlu/);
        return true;
      },
    );
  });

  it('imalat kaydı miktar ve birim olmadan oluşmaz', () => {
    assert.throws(
      () => makeEntry({ kind: 'production', description: 'shotcrete', qty: 300 }),
      /birim zorunlu/,
    );
  });

  it('imalat kaydı miktar+birim ile oluşur', () => {
    const e = makeEntry({ kind: 'production', description: 'shotcrete', qty: 300, unit: 'm3' });
    assert.equal(e.qty, 300);
    assert.equal(e.unit, 'm3');
  });

  it('tipe uygun olmayan alan sessizce kabul edilmez', () => {
    assert.throws(
      () => makeEntry({ kind: 'note', description: 'not', headcount: 5 }),
      (err: unknown) => {
        assert.ok(err instanceof ConstructionValidationError);
        assert.match(err.message, /kişi sayısı alanını taşımaz/);
        return true;
      },
    );
  });

  it('negatif saat reddedilir', () => {
    assert.throws(
      () => makeEntry({ kind: 'personnel', personnelId: 3, hours: -1 }),
      /çalışma saati negatif olamaz/,
    );
  });

  it('kayıp gün yalnız iş-günü kaybı / ölümlü olaylarda girilebilir', () => {
    assert.throws(
      () =>
        makeEntry({
          kind: 'accident',
          description: 'parmak ezilmesi',
          severity: 'first_aid',
          lostDays: 3,
        }),
      /kayıp gün yalnız/,
    );
    const ok = makeEntry({
      kind: 'accident',
      description: 'kol çatlağı',
      severity: 'lost_time',
      lostDays: 10,
    });
    assert.equal(ok.lostDays, 10);
  });
});

describe('DailyLog gün kilidi', () => {
  const base = {
    id: 1,
    companyId: 1,
    projectId: 1,
    logDate: '2026-07-15',
    status: 'open' as const,
    workState: 'working' as const,
    tempC: 23,
    weatherNote: null,
    noWorkReason: null,
    summary: null,
    lockedBy: null,
    lockedAt: null,
    createdBy: null,
    createdAt: D,
    updatedAt: D,
  };

  it('kilitli günlük düzenlenemez', () => {
    const locked = DailyLog.create(base).lock(7, D);
    assert.equal(locked.status, 'locked');
    assert.equal(locked.editable, false);
    assert.throws(() => locked.update({ summary: 'x' }, D), /kilitli günlük düzenlenemez/);
  });

  it('kilitlemek için kullanıcı bilinmek zorunda', () => {
    assert.throws(() => DailyLog.create(base).lock(null, D), /kilitleyen kullanıcı/);
  });

  it('kilit açılınca son kilitleyenin izi kalır', () => {
    const reopened = DailyLog.create(base).lock(7, D).unlock(D);
    assert.equal(reopened.status, 'open');
    assert.equal(reopened.lockedBy, 7);
    assert.notEqual(reopened.lockedAt, null);
  });

  it('çalışılmayan gün gerekçesiz olamaz', () => {
    assert.throws(
      () => DailyLog.create(base).update({ workState: 'not_working' }, D),
      /çalışılmayan gün için gerekçe zorunlu/,
    );
    const ok = DailyLog.create(base).update(
      { workState: 'not_working', noWorkReason: 'Kar yağışı' },
      D,
    );
    assert.equal(ok.noWorkReason, 'Kar yağışı');
  });

  it('kilitli günlükte create invariantı kilitleyen bilgisini şart koşar', () => {
    assert.throws(
      () => DailyLog.create({ ...base, status: 'locked' }),
      /kilitli günlükte kilitleyen/,
    );
  });
});

describe('DailyLog use-case akışları', () => {
  let logs: InMemoryDailyLogRepository;
  let projects: InMemoryProjectRepository;
  let timesheets: RecordingTimesheetRepository;
  let machineLogs: RecordingMachineLogRepository;
  let clock: FixedClock;
  let projectId: number;
  let logId: number;

  const save = (): SaveDailyLogEntryUseCase =>
    new SaveDailyLogEntryUseCase(logs, timesheets, machineLogs);

  beforeEach(async () => {
    logs = new InMemoryDailyLogRepository();
    projects = new InMemoryProjectRepository();
    timesheets = new RecordingTimesheetRepository();
    machineLogs = new RecordingMachineLogRepository();
    clock = new FixedClock(D);
    const p = await new CreateProjectUseCase(projects).execute({ companyId: 1, name: 'Günlük P' });
    projectId = p.id;
    const day = await new GetDailyLogDayUseCase(logs, projects).execute({
      companyId: 1,
      projectId,
      logDate: '2026-07-15',
      create: true,
    });
    logId = day!.log.id;
  });

  it('gün yoksa ve create=false ise null döner (hata değil)', async () => {
    const res = await new GetDailyLogDayUseCase(logs, projects).execute({
      companyId: 1,
      projectId,
      logDate: '2026-07-20',
    });
    assert.equal(res, null);
  });

  it('gün görünümü tüm kayıt tiplerini bölüm olarak döner (boşlar dahil)', async () => {
    const day = await new GetDailyLogDayUseCase(logs, projects).execute({
      companyId: 1,
      projectId,
      logDate: '2026-07-15',
    });
    assert.equal(day!.sections.length, 11);
    // Sıralama sahada okunma sırasına göre: taşeron → personel → ekipman ...
    assert.equal(day!.sections[0]!.kind, 'subcontractor');
    assert.equal(day!.sections[1]!.kind, 'personnel');
    assert.equal(day!.sections[2]!.kind, 'equipment');
    assert.equal(day!.sections.at(-1)!.kind, 'note');
  });

  it('personel satırı puantaja yazılır (köprü)', async () => {
    await save().execute({
      companyId: 1,
      logId,
      kind: 'personnel',
      personnelId: 42,
      hours: 8,
      boqLineId: 5,
      crewName: 'Kalıp ekibi',
    });
    assert.equal(timesheets.upserts.length, 1);
    const ts = timesheets.upserts[0]!;
    assert.equal(ts.personnelId, 42);
    assert.equal(ts.workDate, '2026-07-15');
    assert.equal(ts.hours, 8);
    assert.equal(ts.boqLineId, 5);
  });

  it('ekipman satırı makine kaydına yazılır (köprü)', async () => {
    await save().execute({
      companyId: 1,
      logId,
      kind: 'equipment',
      machineId: 9,
      hours: 5,
      idleHours: 3,
      description: 'Hafriyat',
    });
    assert.equal(machineLogs.inserts.length, 1);
    const ml = machineLogs.inserts[0]!;
    assert.equal(ml.machineId, 9);
    assert.equal(ml.projectId, projectId);
    assert.equal(ml.workHours, 5);
  });

  it('not satırı hiçbir köprü kurmaz', async () => {
    await save().execute({ companyId: 1, logId, kind: 'note', description: 'Drenaj konuşuldu' });
    assert.equal(timesheets.upserts.length, 0);
    assert.equal(machineLogs.inserts.length, 0);
  });

  it('kilitli günde satır eklenemez', async () => {
    await new ChangeDailyLogStatusUseCase(logs, clock).execute({
      companyId: 1,
      logId,
      status: 'locked',
      actorUserId: 7,
    });
    await assert.rejects(
      () => save().execute({ companyId: 1, logId, kind: 'note', description: 'geç kalan not' }),
      DailyLogLockedError,
    );
  });

  it('kilitli günde başlık güncellenemez', async () => {
    await new ChangeDailyLogStatusUseCase(logs, clock).execute({
      companyId: 1,
      logId,
      status: 'locked',
      actorUserId: 7,
    });
    await assert.rejects(
      () => new UpdateDailyLogUseCase(logs, clock).execute({ companyId: 1, logId, tempC: 30 }),
      DailyLogLockedError,
    );
  });

  it('kilitli günde satır silinemez', async () => {
    const e = await save().execute({ companyId: 1, logId, kind: 'note', description: 'not' });
    await new ChangeDailyLogStatusUseCase(logs, clock).execute({
      companyId: 1,
      logId,
      status: 'locked',
      actorUserId: 7,
    });
    await assert.rejects(
      () => new DeleteDailyLogEntryUseCase(logs).execute({ companyId: 1, entryId: e.id }),
      DailyLogLockedError,
    );
  });

  /**
   * REGRESYON — canlı duman testinde yakalandı.
   *
   * Doğrulama yalnız DailyLogEntry.create içinde yapılıyordu ve create ancak
   * DB'den okuma sırasında çağrıldığı için sıra şuydu: geçersiz satır INSERT
   * edilir, geri okunurken doğrulama patlar, istemci 400 alır ama SATIR DB'DE
   * KALIR. Kalan satır o günün TÜM okumalarını kalıcı olarak 400'e düşürüyordu —
   * tek bir yazım hatası günü kullanılamaz hale getiriyordu.
   *
   * Bu test repo'ya HİÇ yazılmadığını doğrular (fake repo doğrulama yapmaz,
   * yani hata geri gelirse burada yakalanır).
   */
  it('geçersiz satır repoya HİÇ yazılmaz (yazmadan önce doğrulanır)', async () => {
    const inserts: unknown[] = [];
    const spy = {
      ...logs,
      findById: logs.findById.bind(logs),
      insertEntry: async (input: unknown) => {
        inserts.push(input);
        throw new Error('bu çağrı hiç olmamalıydı');
      },
    } as unknown as InMemoryDailyLogRepository;

    const uc = new SaveDailyLogEntryUseCase(spy, timesheets, machineLogs);
    await assert.rejects(
      () =>
        uc.execute({
          companyId: 1,
          logId,
          kind: 'note',
          description: 'not',
          headcount: 5,
        }),
      ConstructionValidationError,
    );
    assert.equal(inserts.length, 0, 'geçersiz satır için insertEntry çağrılmamalı');

    // Kaza kaydı şiddetsiz de yazma denemesi yapmamalı (DB CHECK'e düşüp 500
    // üretmesin diye)
    await assert.rejects(
      () => uc.execute({ companyId: 1, logId, kind: 'accident', description: 'Kayma' }),
      ConstructionValidationError,
    );
    assert.equal(inserts.length, 0);
  });

  it('kilitli günde YORUM yapılabilir (kilit veriyi dondurur, yazışmayı değil)', async () => {
    await new ChangeDailyLogStatusUseCase(logs, clock).execute({
      companyId: 1,
      logId,
      status: 'locked',
      actorUserId: 7,
    });
    const c = await new AddDailyLogCommentUseCase(logs).execute({
      companyId: 1,
      logId,
      body: 'Teknik ofis şerhi',
    });
    assert.equal(c.body, 'Teknik ofis şerhi');
  });

  it('başka güne ait satır id ile güncellenemez', async () => {
    const other = await new GetDailyLogDayUseCase(logs, projects).execute({
      companyId: 1,
      projectId,
      logDate: '2026-07-16',
      create: true,
    });
    const e = await save().execute({ companyId: 1, logId, kind: 'note', description: 'not' });
    await assert.rejects(
      () =>
        save().execute({
          companyId: 1,
          logId: other!.log.id,
          entryId: e.id,
          kind: 'note',
          description: 'ele geçirme denemesi',
        }),
      DailyLogEntryNotFoundError,
    );
  });

  it('imalat kayıtları keşif satırı bazında toplanır', async () => {
    await save().execute({
      companyId: 1,
      logId,
      kind: 'production',
      description: 'Shotcrete',
      qty: 300,
      unit: 'm3',
      boqLineId: 11,
    });
    const d2 = await new GetDailyLogDayUseCase(logs, projects).execute({
      companyId: 1,
      projectId,
      logDate: '2026-07-16',
      create: true,
    });
    await save().execute({
      companyId: 1,
      logId: d2!.log.id,
      kind: 'production',
      description: 'Shotcrete',
      qty: 120,
      unit: 'm3',
      boqLineId: 11,
    });

    const rows = await new GetProductionActualsUseCase(logs).execute({ companyId: 1, projectId });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.producedQty, 420);
    assert.equal(rows[0]!.entryCount, 2);
    assert.equal(rows[0]!.firstDate, '2026-07-15');
    assert.equal(rows[0]!.lastDate, '2026-07-16');
  });

  it('ay takvimi aralık içindeki günleri döner', async () => {
    const res = await new GetDailyLogMonthUseCase(logs).execute({
      companyId: 1,
      projectId,
      year: 2026,
      month: 7,
    });
    assert.equal(res.fromDate, '2026-07-01');
    assert.equal(res.toDate, '2026-07-31');
    assert.equal(res.days.length, 1);
    assert.equal(res.days[0]!.logDate, '2026-07-15');
  });

  it('iş gücü raporu çalışılan günü ve ortalama mevcudu hesaplar', async () => {
    // 15 Temmuz: 2 kendi personeli (8+7 saat) + taşeron 5 kişi 40 saat
    await save().execute({ companyId: 1, logId, kind: 'personnel', personnelId: 1, hours: 8 });
    await save().execute({ companyId: 1, logId, kind: 'personnel', personnelId: 2, hours: 7 });
    await save().execute({
      companyId: 1,
      logId,
      kind: 'subcontractor',
      vendorId: 3,
      headcount: 5,
      hours: 40,
    });
    // 16 Temmuz: çalışılmayan gün
    const d2 = await new GetDailyLogDayUseCase(logs, projects).execute({
      companyId: 1,
      projectId,
      logDate: '2026-07-16',
      create: true,
    });
    await new UpdateDailyLogUseCase(logs, clock).execute({
      companyId: 1,
      logId: d2!.log.id,
      workState: 'not_working',
      noWorkReason: 'Yağmur',
    });

    const rep = await new GetManpowerReportUseCase(logs).execute({
      companyId: 1,
      projectId,
      fromDate: '2026-07-01',
      toDate: '2026-07-31',
    });
    assert.equal(rep.totalOwnHours, 15);
    assert.equal(rep.totalSubHours, 40);
    assert.equal(rep.totalHours, 55);
    assert.equal(rep.workedDays, 1);
    assert.equal(rep.notWorkedDays, 1);
    // Çalışılan tek günde 2 kendi + 5 taşeron = 7 kişi
    assert.equal(rep.avgHeadcountPerWorkedDay, 7);
  });

  it('İSG özeti sıklık ve ağırlık oranını hesaplar', async () => {
    await save().execute({
      companyId: 1,
      logId,
      kind: 'subcontractor',
      vendorId: 3,
      headcount: 10,
      hours: 1000,
    });
    await save().execute({
      companyId: 1,
      logId,
      kind: 'accident',
      description: 'Kayma',
      severity: 'lost_time',
      lostDays: 5,
    });
    await save().execute({
      companyId: 1,
      logId,
      kind: 'accident',
      description: 'Malzeme düştü, kimse yoktu',
      severity: 'near_miss',
    });

    const s = await new GetSafetySummaryUseCase(logs).execute({
      companyId: 1,
      projectId,
      fromDate: '2026-07-01',
      toDate: '2026-07-31',
    });
    assert.equal(s.totalHours, 1000);
    assert.equal(s.accidentCount, 2);
    assert.equal(s.recordableAccidentCount, 1);
    assert.equal(s.nearMissCount, 1);
    assert.equal(s.lostDays, 5);
    // sıklık = 1 × 1.000.000 / 1000 = 1000 ; ağırlık = 5 × 1.000 / 1000 = 5
    assert.equal(s.frequencyRate, 1000);
    assert.equal(s.severityRate, 5);
  });
});

describe('buildSafetySummary', () => {
  it('çalışma saati 0 ise oranlar null (0 değil)', () => {
    const s = buildSafetySummary('2026-07-01', '2026-07-31', [], [], []);
    assert.equal(s.totalHours, 0);
    assert.equal(s.frequencyRate, null);
    assert.equal(s.severityRate, null);
  });
});

describe('monthRange', () => {
  it('artık yıl şubatını 29 gün sayar', () => {
    assert.deepEqual(monthRange(2028, 2), { from: '2028-02-01', to: '2028-02-29' });
  });
  it('normal yıl şubatı 28 gün', () => {
    assert.deepEqual(monthRange(2026, 2), { from: '2026-02-01', to: '2026-02-28' });
  });
  it('aralık ayını doğru sınırlar', () => {
    assert.deepEqual(monthRange(2026, 12), { from: '2026-12-01', to: '2026-12-31' });
  });
});

describe('buildDayDto', () => {
  it('satırları sortOrder sonra id ile sıralar', () => {
    const log = {
      id: 1,
      companyId: 1,
      projectId: 1,
      logDate: '2026-07-15',
      status: 'open' as const,
      workState: 'working' as const,
      tempC: null,
      weatherNote: null,
      noWorkReason: null,
      summary: null,
      lockedBy: null,
      lockedAt: null,
      createdAt: D.toISOString(),
      updatedAt: D.toISOString(),
      editable: true,
    };
    const mk = (id: number, sortOrder: number): ReturnType<typeof entryDto> =>
      entryDto(id, sortOrder);
    const day = buildDayDto(log, null, [mk(9, 2), mk(3, 1), mk(7, 1)], [], []);
    const notes = day.sections.find((s) => s.kind === 'note')!.entries;
    assert.deepEqual(
      notes.map((e) => e.id),
      [3, 7, 9],
    );
  });
});

function entryDto(
  id: number,
  sortOrder: number,
): {
  id: number;
  logId: number;
  kind: 'note';
  locationId: null;
  vendorId: null;
  personnelId: null;
  machineId: null;
  materialId: null;
  boqLineId: null;
  trackingItemId: null;
  crewName: null;
  personName: null;
  description: string;
  headcount: null;
  hours: null;
  idleHours: null;
  qty: null;
  unit: null;
  amount: null;
  currency: 'TRY';
  waybillNo: null;
  occurredAt: null;
  severity: null;
  lostDays: null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
} {
  return {
    id,
    logId: 1,
    kind: 'note',
    locationId: null,
    vendorId: null,
    personnelId: null,
    machineId: null,
    materialId: null,
    boqLineId: null,
    trackingItemId: null,
    crewName: null,
    personName: null,
    description: `not ${String(id)}`,
    headcount: null,
    hours: null,
    idleHours: null,
    qty: null,
    unit: null,
    amount: null,
    currency: 'TRY',
    waybillNo: null,
    occurredAt: null,
    severity: null,
    lostDays: null,
    sortOrder,
    createdAt: D.toISOString(),
    updatedAt: D.toISOString(),
  };
}

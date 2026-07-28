/**
 * SantiyeGunluguManager — Şantiye Günlüğü (FAZ 3).
 *
 * Dört sekme: Takvim / İş Gücü / İSG / İmalat.
 *
 * TAKVİM her günün toplamlarını hücrede gösterir (kişi-saat, kaza, kilit) ve
 * bir güne tıklayınca GÜN EKRANI açılır: 11 kayıt tipi kendi bölümünde, her
 * bölümde kendi form alanları.
 *
 * Form alanları SABİT DEĞİL — backend'in `/daily-log-kinds` ucundan gelen
 * `required`/`optional` listesine göre kurulur. Böylece kayıt tipi kuralları tek
 * yerde (DailyLogKind VO) durur ve arayüz onlarla kendiliğinden uyumlu kalır;
 * aksi halde iki liste zamanla ayrışır ve kullanıcı "zorunlu değil" sanıp
 * doldurmadığı alandan 400 yer.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';

import type {
  AccidentSeverity,
  DailyLogDayDto,
  DailyLogEntryDto,
  DailyLogTotalsDto,
  KindSpecDto,
  LocationDto,
  LogEntryKind,
  ManpowerReportDto,
  ProductionActualRowDto,
  ProjectDto,
  SafetySummaryDto,
  WorkState,
} from '../../application/dto/ConstructionDtos';
import type {
  ConstructionApi,
  SaveDailyLogEntryBody,
} from '../../application/ports/ConstructionApi';
import {
  accidentSeverityLabel,
  csT,
  logFieldLabel,
  logKindLabel,
  workStateLabel,
} from '../../i18n';
import { useProjects } from '../hooks/useProjects';

export interface SantiyeGunluguManagerProps {
  api: ConstructionApi;
  companyId: number;
  lang?: string | undefined;
  confirmAsync?: ((message: string) => Promise<boolean>) | undefined;
  /** Kilit açma yetkisi (yönetici). Yoksa düğme gösterilmez. */
  canUnlock?: boolean | undefined;
}

const box: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  padding: 12,
  background: '#fff',
};
const label: CSSProperties = { fontSize: 12, color: '#64748b', display: 'block', marginBottom: 2 };
const input: CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontSize: 13,
  boxSizing: 'border-box',
};
const btn: CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  background: '#f8fafc',
  cursor: 'pointer',
  fontSize: 12,
};
const btnPrimary: CSSProperties = {
  ...btn,
  background: '#2563eb',
  borderColor: '#2563eb',
  color: '#fff',
};
const errBox: CSSProperties = {
  border: '1px solid #fca5a5',
  background: '#fef2f2',
  color: '#b91c1c',
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 13,
};
const warnBox: CSSProperties = {
  ...errBox,
  border: '1px solid #fcd34d',
  background: '#fffbeb',
  color: '#b45309',
};
const okBox: CSSProperties = {
  ...errBox,
  border: '1px solid #86efac',
  background: '#f0fdf4',
  color: '#15803d',
};
const th: CSSProperties = {
  textAlign: 'left',
  padding: '6px 8px',
  fontSize: 12,
  color: '#475569',
  background: '#f8fafc',
  whiteSpace: 'nowrap',
};
const td: CSSProperties = { padding: '5px 8px', fontSize: 13, borderTop: '1px solid #f1f5f9' };

type Tab = 'calendar' | 'manpower' | 'safety' | 'production';

const SEVERITIES: AccidentSeverity[] = ['near_miss', 'first_aid', 'medical', 'lost_time', 'fatal'];
const WORK_STATES: WorkState[] = ['working', 'not_working', 'partial'];

const fmt = (n: number, digits = 2): string =>
  n.toLocaleString('tr-TR', { maximumFractionDigits: digits });

const todayIso = (): string => new Date().toISOString().slice(0, 10);

/** YYYY-MM-DD → o ayın 1'i, hafta pazartesi başlar. */
function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // getUTCDay: 0=Pazar → pazartesi-başlangıçlı indekse çevir
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${String(year)}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const WEEKDAY_KEYS = ['Pts', 'Sal', 'Çar', 'Per', 'Cum', 'Cts', 'Paz'];

const WORK_TINT: Record<WorkState, string> = {
  working: '#f0fdf4',
  not_working: '#fef2f2',
  partial: '#fffbeb',
};

export function SantiyeGunluguManager({
  api,
  companyId,
  lang,
  confirmAsync,
  canUnlock,
}: SantiyeGunluguManagerProps): JSX.Element {
  const { projects } = useProjects(api, companyId);
  const [projectId, setProjectId] = useState<number>(0);
  const [tab, setTab] = useState<Tab>('calendar');
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const [year, setYear] = useState<number>(now.getUTCFullYear());
  const [month, setMonth] = useState<number>(now.getUTCMonth() + 1);
  const [days, setDays] = useState<ReadonlyArray<DailyLogTotalsDto>>([]);
  const [openDate, setOpenDate] = useState<string>('');

  const t = useCallback(
    (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>) => csT(k, lang, vars),
    [lang],
  );

  const loadMonth = useCallback(async (): Promise<void> => {
    if (!(projectId > 0)) {
      setDays([]);
      return;
    }
    setError(null);
    try {
      const res = await api.getDailyLogMonth(projectId, companyId, year, month);
      setDays(res.days);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api, companyId, projectId, year, month]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  const byDate = useMemo(() => {
    const m = new Map<string, DailyLogTotalsDto>();
    for (const d of days) m.set(d.logDate, d);
    return m;
  }, [days]);

  const shiftMonth = (delta: number): void => {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth() + 1);
  };

  if (openDate !== '' && projectId > 0) {
    return (
      <GunEkrani
        api={api}
        companyId={companyId}
        projectId={projectId}
        logDate={openDate}
        lang={lang}
        confirmAsync={confirmAsync}
        canUnlock={canUnlock}
        onBack={() => {
          setOpenDate('');
          void loadMonth();
        }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <h3 style={{ margin: '0 0 2px', fontSize: 16 }}>{t('cs.dlog.title')}</h3>
        <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{t('cs.dlog.subtitle')}</p>
      </div>

      <div style={{ ...box, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 260 }}>
          <span style={label}>{t('cs.common.project')}</span>
          <select
            style={input}
            value={projectId === 0 ? '' : String(projectId)}
            onChange={(e) => setProjectId(e.target.value === '' ? 0 : Number(e.target.value))}
          >
            <option value="">{t('cs.common.selectProject')}</option>
            {projects.map((p: ProjectDto) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['calendar', 'manpower', 'safety', 'production'] as Tab[]).map((tb) => (
            <button
              key={tb}
              type="button"
              onClick={() => setTab(tb)}
              style={{
                ...btn,
                background: tab === tb ? '#eff6ff' : '#f8fafc',
                borderColor: tab === tb ? '#2563eb' : '#cbd5e1',
                fontWeight: tab === tb ? 600 : 400,
              }}
            >
              {t(`cs.dlog.rep.tab.${tb}`)}
            </button>
          ))}
        </div>
      </div>

      {error !== null && <div style={errBox}>{error}</div>}

      {projectId === 0 ? (
        <div style={{ ...box, color: '#64748b', fontSize: 13 }}>{t('cs.common.selectProject')}</div>
      ) : tab === 'calendar' ? (
        <div style={box}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 12,
              marginBottom: 10,
            }}
          >
            <button type="button" style={btn} onClick={() => shiftMonth(-1)}>
              ‹ {t('cs.dlog.prevMonth')}
            </button>
            <strong style={{ fontSize: 15, minWidth: 150, textAlign: 'center' }}>
              {new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(
                lang === 'en' ? 'en-GB' : lang === 'de' ? 'de-DE' : lang === 'ar' ? 'ar' : 'tr-TR',
                { month: 'long', year: 'numeric', timeZone: 'UTC' },
              )}
            </strong>
            <button type="button" style={btn} onClick={() => shiftMonth(1)}>
              {t('cs.dlog.nextMonth')} ›
            </button>
            <button
              type="button"
              style={btn}
              onClick={() => {
                const d = new Date();
                setYear(d.getUTCFullYear());
                setMonth(d.getUTCMonth() + 1);
              }}
            >
              {t('cs.dlog.today')}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {WEEKDAY_KEYS.map((w) => (
              <div
                key={w}
                style={{
                  textAlign: 'center',
                  fontSize: 11,
                  color: '#64748b',
                  padding: '4px 0',
                  fontWeight: 600,
                }}
              >
                {w}
              </div>
            ))}
            {monthGrid(year, month).map((date, i) => {
              if (date === null) return <div key={`e${String(i)}`} />;
              const tot = byDate.get(date);
              const dayNum = Number(date.slice(8, 10));
              const isToday = date === todayIso();
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setOpenDate(date)}
                  style={{
                    border: isToday ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    borderRadius: 6,
                    background: tot ? WORK_TINT[tot.workState] : '#fff',
                    minHeight: 72,
                    padding: '4px 6px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <span
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    <span>{dayNum}</span>
                    {tot?.status === 'locked' && <span title={t('cs.dlog.lock')}>🔒</span>}
                  </span>
                  {tot === undefined ? (
                    <span style={{ fontSize: 10, color: '#cbd5e1' }}>+</span>
                  ) : (
                    <>
                      {tot.workState === 'not_working' ? (
                        <span style={{ fontSize: 10, color: '#b91c1c' }}>
                          {workStateLabel(tot.workState, lang)}
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, color: '#334155' }}>
                          👷 {tot.ownHeadcount + tot.subHeadcount} · ⏱{' '}
                          {fmt(tot.ownHours + tot.subHours, 0)}
                        </span>
                      )}
                      {tot.accidentCount > 0 && (
                        <span style={{ fontSize: 10, color: '#b91c1c', fontWeight: 600 }}>
                          ⚠ {tot.accidentCount} {t('cs.dlog.tot.accidents')}
                        </span>
                      )}
                      {tot.productionCount > 0 && (
                        <span style={{ fontSize: 10, color: '#15803d' }}>
                          ⚒ {tot.productionCount}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : tab === 'manpower' ? (
        <IsGucuRaporu api={api} companyId={companyId} projectId={projectId} lang={lang} />
      ) : tab === 'safety' ? (
        <IsgRaporu api={api} companyId={companyId} projectId={projectId} lang={lang} />
      ) : (
        <ImalatRaporu api={api} companyId={companyId} projectId={projectId} lang={lang} />
      )}
    </div>
  );
}

// ===== GÜN EKRANI ===========================================================

interface GunEkraniProps {
  api: ConstructionApi;
  companyId: number;
  projectId: number;
  logDate: string;
  lang?: string | undefined;
  confirmAsync?: ((message: string) => Promise<boolean>) | undefined;
  canUnlock?: boolean | undefined;
  onBack: () => void;
}

/** Satır formu taslağı — tüm alanlar metin olarak tutulur, gönderirken çevrilir. */
type EntryDraft = Record<string, string>;

function GunEkrani({
  api,
  companyId,
  projectId,
  logDate,
  lang,
  confirmAsync,
  canUnlock,
  onBack,
}: GunEkraniProps): JSX.Element {
  const [day, setDay] = useState<DailyLogDayDto | null>(null);
  const [specs, setSpecs] = useState<ReadonlyArray<KindSpecDto>>([]);
  const [locations, setLocations] = useState<ReadonlyArray<LocationDto>>([]);
  const [exists, setExists] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Gün başlığı formu
  const [workState, setWorkState] = useState<WorkState>('working');
  const [tempC, setTempC] = useState('');
  const [weatherNote, setWeatherNote] = useState('');
  const [noWorkReason, setNoWorkReason] = useState('');
  const [summary, setSummary] = useState('');

  // Aktif satır formu
  const [formKind, setFormKind] = useState<LogEntryKind | ''>('');
  const [draft, setDraft] = useState<EntryDraft>({});
  const [editId, setEditId] = useState<number>(0);
  const [commentBody, setCommentBody] = useState('');

  const t = useCallback(
    (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>) => csT(k, lang, vars),
    [lang],
  );

  const confirm = useCallback(
    async (msg: string): Promise<boolean> => {
      if (confirmAsync) return confirmAsync(msg);
      return Promise.resolve(globalThis.confirm(msg));
    },
    [confirmAsync],
  );

  const load = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const res = await api.getDailyLogDay(projectId, companyId, logDate);
      setExists(res !== null);
      setDay(res);
      if (res) {
        setWorkState(res.log.workState);
        setTempC(res.log.tempC === null ? '' : String(res.log.tempC));
        setWeatherNote(res.log.weatherNote ?? '');
        setNoWorkReason(res.log.noWorkReason ?? '');
        setSummary(res.log.summary ?? '');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api, companyId, projectId, logDate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let off = false;
    void Promise.all([api.listDailyLogKinds(), api.listLocations(projectId, companyId)])
      .then(([k, l]) => {
        if (off) return;
        setSpecs(k.kinds);
        setLocations(l.locations);
      })
      .catch((e: unknown) => {
        if (!off) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      off = true;
    };
  }, [api, companyId, projectId]);

  const createDay = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.getDailyLogDay(projectId, companyId, logDate, true);
      setDay(res);
      setExists(res !== null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveHeader = async (): Promise<void> => {
    if (day === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await api.updateDailyLog(day.log.id, {
        companyId,
        workState,
        tempC: tempC.trim() === '' ? null : Number(tempC.replace(',', '.')),
        weatherNote: weatherNote.trim() === '' ? null : weatherNote.trim(),
        noWorkReason: noWorkReason.trim() === '' ? null : noWorkReason.trim(),
        summary: summary.trim() === '' ? null : summary.trim(),
      });
      await load();
      setInfo(t('cs.tpl.bodySaved'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleLock = async (): Promise<void> => {
    if (day === null) return;
    const locking = day.log.status === 'open';
    const msg = locking
      ? t('cs.dlog.lockConfirm', { date: logDate })
      : t('cs.dlog.unlockConfirm', { date: logDate });
    if (!(await confirm(msg))) return;
    setBusy(true);
    setError(null);
    try {
      await api.changeDailyLogStatus(day.log.id, {
        companyId,
        status: locking ? 'locked' : 'open',
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const specOf = (kind: LogEntryKind): KindSpecDto | undefined =>
    specs.find((s) => s.kind === kind);

  const openForm = (kind: LogEntryKind, entry?: DailyLogEntryDto): void => {
    setFormKind(kind);
    setEditId(entry?.id ?? 0);
    if (entry) {
      setDraft({
        locationId: entry.locationId === null ? '' : String(entry.locationId),
        vendorId: entry.vendorId === null ? '' : String(entry.vendorId),
        personnelId: entry.personnelId === null ? '' : String(entry.personnelId),
        machineId: entry.machineId === null ? '' : String(entry.machineId),
        materialId: entry.materialId === null ? '' : String(entry.materialId),
        boqLineId: entry.boqLineId === null ? '' : String(entry.boqLineId),
        trackingItemId: entry.trackingItemId === null ? '' : String(entry.trackingItemId),
        crewName: entry.crewName ?? '',
        personName: entry.personName ?? '',
        description: entry.description ?? '',
        headcount: entry.headcount === null ? '' : String(entry.headcount),
        hours: entry.hours === null ? '' : String(entry.hours),
        idleHours: entry.idleHours === null ? '' : String(entry.idleHours),
        qty: entry.qty === null ? '' : String(entry.qty),
        unit: entry.unit ?? '',
        amount: entry.amount === null ? '' : String(entry.amount),
        waybillNo: entry.waybillNo ?? '',
        occurredAt: entry.occurredAt ?? '',
        severity: entry.severity ?? '',
        lostDays: entry.lostDays === null ? '' : String(entry.lostDays),
      });
    } else {
      setDraft({});
    }
  };

  const submitEntry = async (): Promise<void> => {
    if (day === null || formKind === '') return;
    const spec = specOf(formKind);
    if (!spec) return;

    const num = (k: string): number | null => {
      const v = (draft[k] ?? '').trim();
      if (v === '') return null;
      const n = Number(v.replace(',', '.'));
      return Number.isFinite(n) ? n : null;
    };
    const str = (k: string): string | null => {
      const v = (draft[k] ?? '').trim();
      return v === '' ? null : v;
    };

    // Yalnız bu tipin taşıdığı alanlar gönderilir. Tipe uymayan alanı göndermek
    // backend'de reddedilir; formda gizli kalan bir alan hiç oluşmasın.
    const allowed = new Set([...spec.required, ...spec.optional]);
    const body: SaveDailyLogEntryBody = { companyId, kind: formKind };
    if (editId > 0) body.entryId = editId;
    if (allowed.has('locationId')) body.locationId = num('locationId');
    if (allowed.has('vendorId')) body.vendorId = num('vendorId');
    if (allowed.has('personnelId')) body.personnelId = num('personnelId');
    if (allowed.has('machineId')) body.machineId = num('machineId');
    if (allowed.has('materialId')) body.materialId = num('materialId');
    if (allowed.has('boqLineId')) body.boqLineId = num('boqLineId');
    if (allowed.has('trackingItemId')) body.trackingItemId = num('trackingItemId');
    if (allowed.has('crewName')) body.crewName = str('crewName');
    if (allowed.has('personName')) body.personName = str('personName');
    if (allowed.has('description')) body.description = str('description');
    if (allowed.has('headcount')) body.headcount = num('headcount');
    if (allowed.has('hours')) body.hours = num('hours');
    if (allowed.has('idleHours')) body.idleHours = num('idleHours');
    if (allowed.has('qty')) body.qty = num('qty');
    if (allowed.has('unit')) body.unit = str('unit');
    if (allowed.has('amount')) body.amount = num('amount');
    if (allowed.has('waybillNo')) body.waybillNo = str('waybillNo');
    if (allowed.has('occurredAt')) body.occurredAt = str('occurredAt');
    if (allowed.has('severity')) {
      const sv = str('severity');
      body.severity = sv === null ? null : (sv as AccidentSeverity);
    }
    if (allowed.has('lostDays')) body.lostDays = num('lostDays');

    setBusy(true);
    setError(null);
    try {
      await api.saveDailyLogEntry(day.log.id, body);
      setFormKind('');
      setDraft({});
      setEditId(0);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const deleteEntry = async (entry: DailyLogEntryDto): Promise<void> => {
    if (!(await confirm(t('cs.dlog.deleteEntryConfirm')))) return;
    setBusy(true);
    try {
      await api.deleteDailyLogEntry(entry.id, companyId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const addComment = async (): Promise<void> => {
    if (day === null || commentBody.trim() === '') return;
    setBusy(true);
    try {
      await api.addDailyLogComment(day.log.id, { companyId, body: commentBody.trim() });
      setCommentBody('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const locationPath = (id: number | null): string =>
    id === null ? '—' : (locations.find((l) => l.id === id)?.path ?? `#${String(id)}`);

  const header = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <button type="button" style={btn} onClick={onBack}>
        {t('cs.dlog.backToCalendar')}
      </button>
      <strong style={{ fontSize: 16 }}>{logDate}</strong>
      {day !== null && (
        <span style={{ fontSize: 12, color: '#64748b' }}>
          {workStateLabel(day.log.workState, lang)}
          {day.log.status === 'locked' && ' · 🔒'}
        </span>
      )}
    </div>
  );

  if (exists === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {header}
        <div style={box}>{t('cs.common.loading')}</div>
      </div>
    );
  }

  if (exists === false || day === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {header}
        {error !== null && <div style={errBox}>{error}</div>}
        <div style={{ ...box, display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#64748b' }}>{t('cs.dlog.noDay')}</span>
          <button type="button" style={btnPrimary} disabled={busy} onClick={() => void createDay()}>
            {t('cs.dlog.createDay')}
          </button>
        </div>
      </div>
    );
  }

  const editable = day.log.editable;
  const tot = day.totals;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {header}

      {!editable && (
        <div style={warnBox}>
          {t('cs.dlog.lockedBanner')}
          {day.log.lockedAt !== null && (
            <span style={{ marginLeft: 6, opacity: 0.8 }}>
              ({t('cs.dlog.lockedAt')}: {day.log.lockedAt.slice(0, 16).replace('T', ' ')})
            </span>
          )}
        </div>
      )}
      {error !== null && <div style={errBox}>{error}</div>}
      {info !== null && <div style={okBox}>{info}</div>}

      {/* Gün toplamları */}
      {tot !== null && (
        <div
          style={{
            ...box,
            display: 'flex',
            gap: 18,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <Metric label={t('cs.dlog.tot.ownHeadcount')} value={`${String(tot.ownHeadcount)}`} />
          <Metric label={t('cs.dlog.tot.subHeadcount')} value={`${String(tot.subHeadcount)}`} />
          <Metric label={t('cs.dlog.tot.hours')} value={fmt(tot.ownHours + tot.subHours, 1)} />
          <Metric label={t('cs.dlog.tot.equipHours')} value={fmt(tot.equipHours, 1)} />
          <Metric
            label={t('cs.dlog.tot.accidents')}
            value={String(tot.accidentCount)}
            danger={tot.accidentCount > 0}
          />
          <Metric label={t('cs.dlog.tot.production')} value={String(tot.productionCount)} />
          <Metric label={t('cs.dlog.tot.delivery')} value={String(tot.deliveryCount)} />
          <Metric label={t('cs.dlog.tot.entries')} value={String(tot.entryCount)} />
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {editable ? (
              <button type="button" style={btn} disabled={busy} onClick={() => void toggleLock()}>
                🔒 {t('cs.dlog.lock')}
              </button>
            ) : (
              canUnlock === true && (
                <button type="button" style={btn} disabled={busy} onClick={() => void toggleLock()}>
                  {t('cs.dlog.unlock')}
                </button>
              )
            )}
          </span>
        </div>
      )}

      {/* Gün başlığı: hava durumu / çalışma durumu / özet */}
      <div style={box}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 10,
            alignItems: 'end',
          }}
        >
          <div>
            <span style={label}>{t('cs.dlog.workState')}</span>
            <select
              style={input}
              value={workState}
              disabled={!editable}
              onChange={(e) => setWorkState(e.target.value as WorkState)}
            >
              {WORK_STATES.map((w) => (
                <option key={w} value={w}>
                  {workStateLabel(w, lang)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span style={label}>{t('cs.dlog.temp')}</span>
            <input
              style={input}
              value={tempC}
              disabled={!editable}
              onChange={(e) => setTempC(e.target.value)}
            />
          </div>
          <div>
            <span style={label}>{t('cs.dlog.weatherNote')}</span>
            <input
              style={input}
              value={weatherNote}
              disabled={!editable}
              onChange={(e) => setWeatherNote(e.target.value)}
            />
          </div>
          {workState === 'not_working' && (
            <div>
              <span style={label}>{t('cs.dlog.noWorkReason')} *</span>
              <input
                style={input}
                value={noWorkReason}
                disabled={!editable}
                onChange={(e) => setNoWorkReason(e.target.value)}
              />
            </div>
          )}
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={label}>{t('cs.dlog.summary')}</span>
            <textarea
              style={{ ...input, minHeight: 46, resize: 'vertical' }}
              value={summary}
              disabled={!editable}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>
        </div>
        {workState === 'not_working' && (
          <div style={{ ...label, marginTop: 6 }}>{t('cs.dlog.noWorkReasonRequired')}</div>
        )}
        {editable && (
          <button
            type="button"
            style={{ ...btnPrimary, marginTop: 10 }}
            disabled={busy}
            onClick={() => void saveHeader()}
          >
            {t('cs.dlog.saveHeader')}
          </button>
        )}
      </div>

      {/* 11 kayıt tipi bölümü */}
      {day.sections.map((sec) => {
        const spec = specOf(sec.kind);
        return (
          <div key={sec.kind} style={{ ...box, padding: 0 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '7px 10px',
                background: '#f1f5f9',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <strong style={{ fontSize: 13 }}>
                {logKindLabel(sec.kind, lang)}{' '}
                <span style={{ color: '#64748b', fontWeight: 400 }}>({sec.entries.length})</span>
                {spec?.bridge !== null && spec?.bridge !== undefined && (
                  <span
                    style={{ fontSize: 10, color: '#2563eb', marginLeft: 6 }}
                    title={spec.bridge === 'timesheet' ? 'cs_timesheets' : 'cs_machine_logs'}
                  >
                    ⇄
                  </span>
                )}
              </strong>
              {editable && (
                <button type="button" style={btn} onClick={() => openForm(sec.kind)}>
                  + {t('cs.dlog.addEntry')}
                </button>
              )}
            </div>

            {formKind === sec.kind && spec && (
              <EntryForm
                spec={spec}
                draft={draft}
                lang={lang}
                locations={locations}
                busy={busy}
                onChange={(k, v) => setDraft((p) => ({ ...p, [k]: v }))}
                onCancel={() => {
                  setFormKind('');
                  setEditId(0);
                }}
                onSubmit={() => void submitEntry()}
              />
            )}

            {sec.entries.length === 0 ? (
              <div style={{ padding: '8px 10px', fontSize: 12, color: '#94a3b8' }}>
                {t('cs.common.noRecords')}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {sec.entries.map((e) => (
                      <tr key={e.id}>
                        <td style={{ ...td, width: 150, color: '#475569', fontSize: 12 }}>
                          {locationPath(e.locationId)}
                        </td>
                        <td style={td}>
                          {e.description ?? e.personName ?? '—'}
                          {e.crewName !== null && (
                            <span style={{ fontSize: 11, color: '#7c3aed', marginLeft: 6 }}>
                              {e.crewName}
                            </span>
                          )}
                          {e.severity !== null && (
                            <span
                              style={{
                                fontSize: 11,
                                marginLeft: 6,
                                padding: '1px 6px',
                                borderRadius: 8,
                                background: e.severity === 'near_miss' ? '#e0f2fe' : '#fee2e2',
                                color: e.severity === 'near_miss' ? '#0369a1' : '#b91c1c',
                              }}
                            >
                              {accidentSeverityLabel(e.severity, lang)}
                            </span>
                          )}
                        </td>
                        <td style={{ ...td, width: 190, fontSize: 12, color: '#334155' }}>
                          {e.headcount !== null && <span>👷 {e.headcount} </span>}
                          {e.hours !== null && <span>⏱ {fmt(e.hours, 1)} </span>}
                          {e.idleHours !== null && (
                            <span style={{ color: '#94a3b8' }}>({fmt(e.idleHours, 1)}) </span>
                          )}
                          {e.qty !== null && (
                            <span>
                              ⚒ {fmt(e.qty, 3)} {e.unit ?? ''}{' '}
                            </span>
                          )}
                          {e.amount !== null && <span>₺ {fmt(e.amount)} </span>}
                          {e.lostDays !== null && e.lostDays > 0 && (
                            <span style={{ color: '#b91c1c' }}>−{e.lostDays}g </span>
                          )}
                        </td>
                        <td style={{ ...td, width: 110, fontSize: 12, color: '#64748b' }}>
                          {e.waybillNo !== null && <span>#{e.waybillNo} </span>}
                          {e.occurredAt !== null && <span>{e.occurredAt}</span>}
                        </td>
                        <td style={{ ...td, width: 110, textAlign: 'right' }}>
                          {editable && (
                            <>
                              <button
                                type="button"
                                style={{ ...btn, padding: '2px 6px' }}
                                onClick={() => openForm(sec.kind, e)}
                              >
                                {t('cs.common.edit')}
                              </button>{' '}
                              <button
                                type="button"
                                style={{ ...btn, padding: '2px 6px' }}
                                onClick={() => void deleteEntry(e)}
                              >
                                ×
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {/* Galeri */}
      <div style={box}>
        <strong style={{ fontSize: 13 }}>
          {t('cs.dlog.files')} ({day.files.length})
        </strong>
        {day.files.length === 0 ? (
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{t('cs.dlog.noFiles')}</div>
        ) : (
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12 }}>
            {day.files.map((f) => (
              <li key={f.id}>
                {f.title ?? f.fileUrl ?? `#${String(f.id)}`}{' '}
                <span style={{ color: '#94a3b8' }}>({f.fileKind})</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Yorumlar — kilitli günde de eklenebilir */}
      <div style={box}>
        <strong style={{ fontSize: 13 }}>
          {t('cs.dlog.comments')} ({day.comments.length})
        </strong>
        {day.comments.length === 0 ? (
          <div style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0' }}>
            {t('cs.dlog.noComments')}
          </div>
        ) : (
          <ul style={{ margin: '6px 0', paddingLeft: 18, fontSize: 12, color: '#334155' }}>
            {day.comments.map((cm) => (
              <li key={cm.id}>
                {cm.body}{' '}
                <span style={{ color: '#94a3b8' }}>
                  ({cm.createdAt.slice(0, 16).replace('T', ' ')})
                </span>
              </li>
            ))}
          </ul>
        )}
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <input
            style={input}
            value={commentBody}
            placeholder={t('cs.dlog.commentPlaceholder')}
            onChange={(e) => setCommentBody(e.target.value)}
          />
          <button
            type="button"
            style={btn}
            disabled={busy || commentBody.trim() === ''}
            onClick={() => void addComment()}
          >
            {t('cs.dlog.addComment')}
          </button>
        </div>
        {!editable && (
          <div style={{ ...label, marginTop: 4 }}>{t('cs.dlog.commentOnLockedHint')}</div>
        )}
      </div>
    </div>
  );
}

function Metric({
  label: lbl,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}): JSX.Element {
  return (
    <div>
      <span style={label}>{lbl}</span>
      <div
        style={{ fontSize: 16, fontWeight: 600, color: danger === true ? '#b91c1c' : '#0f172a' }}
      >
        {value}
      </div>
    </div>
  );
}

// ===== SATIR FORMU (spec'ten türetilir) =====================================

/** Sayısal alanlar — metin girdisi yerine number semantiği. */
const NUMERIC_FIELDS = new Set(['headcount', 'hours', 'idleHours', 'qty', 'amount', 'lostDays']);
/** Referans alanları — şimdilik id girişi; ilgili modül seçicileri sonraki fazda bağlanacak. */
const REF_FIELDS = new Set([
  'vendorId',
  'personnelId',
  'machineId',
  'materialId',
  'boqLineId',
  'trackingItemId',
]);

interface EntryFormProps {
  spec: KindSpecDto;
  draft: EntryDraft;
  lang?: string | undefined;
  locations: ReadonlyArray<LocationDto>;
  busy: boolean;
  onChange: (key: string, value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

function EntryForm({
  spec,
  draft,
  lang,
  locations,
  busy,
  onChange,
  onCancel,
  onSubmit,
}: EntryFormProps): JSX.Element {
  const t = (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>): string =>
    csT(k, lang, vars);

  const fields = [...spec.required, ...spec.optional];
  const missing = spec.required.filter((f) => (draft[f] ?? '').trim() === '');

  return (
    <div
      style={{
        padding: '10px 12px',
        background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 8,
        }}
      >
        {fields.map((f) => {
          const required = spec.required.includes(f);
          const value = draft[f] ?? '';
          return (
            <div key={f}>
              <span style={label}>
                {logFieldLabel(f, lang)}
                {required && <span style={{ color: '#b91c1c' }}> *</span>}
              </span>
              {f === 'locationId' ? (
                <select style={input} value={value} onChange={(e) => onChange(f, e.target.value)}>
                  <option value="">{t('cs.common.none')}</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.path}
                    </option>
                  ))}
                </select>
              ) : f === 'severity' ? (
                <select style={input} value={value} onChange={(e) => onChange(f, e.target.value)}>
                  <option value="">{t('cs.common.none')}</option>
                  {SEVERITIES.map((sv) => (
                    <option key={sv} value={sv}>
                      {accidentSeverityLabel(sv, lang)}
                    </option>
                  ))}
                </select>
              ) : f === 'occurredAt' ? (
                <input
                  type="time"
                  style={input}
                  value={value}
                  onChange={(e) => onChange(f, e.target.value)}
                />
              ) : f === 'description' ? (
                <textarea
                  style={{ ...input, minHeight: 34, resize: 'vertical' }}
                  value={value}
                  onChange={(e) => onChange(f, e.target.value)}
                />
              ) : (
                <input
                  style={input}
                  inputMode={NUMERIC_FIELDS.has(f) || REF_FIELDS.has(f) ? 'numeric' : 'text'}
                  value={value}
                  onChange={(e) => onChange(f, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>
      <div style={{ ...label, marginTop: 6 }}>{t('cs.dlog.reqFieldsHint')}</div>
      <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
        <button
          type="button"
          style={btnPrimary}
          disabled={busy || missing.length > 0}
          onClick={onSubmit}
        >
          {busy ? t('cs.common.loading') : t('cs.common.save')}
        </button>
        <button type="button" style={btn} onClick={onCancel}>
          {t('cs.common.cancel')}
        </button>
      </div>
    </div>
  );
}

// ===== RAPORLAR =============================================================

interface ReportProps {
  api: ConstructionApi;
  companyId: number;
  projectId: number;
  lang?: string | undefined;
}

/** Ayın ilk günü / bugün — rapor varsayılan aralığı. */
function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const from = `${String(now.getUTCFullYear())}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
  return { from, to: todayIso() };
}

function RangePicker({
  from,
  to,
  lang,
  onChange,
}: {
  from: string;
  to: string;
  lang?: string | undefined;
  onChange: (from: string, to: string) => void;
}): JSX.Element {
  const t = (k: Parameters<typeof csT>[0]): string => csT(k, lang);
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div>
        <span style={label}>{t('cs.dlog.rep.from')}</span>
        <input
          type="date"
          style={input}
          value={from}
          onChange={(e) => onChange(e.target.value, to)}
        />
      </div>
      <div>
        <span style={label}>{t('cs.dlog.rep.to')}</span>
        <input
          type="date"
          style={input}
          value={to}
          onChange={(e) => onChange(from, e.target.value)}
        />
      </div>
    </div>
  );
}

function IsGucuRaporu({ api, companyId, projectId, lang }: ReportProps): JSX.Element {
  const init = defaultRange();
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [rep, setRep] = useState<ManpowerReportDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const t = (k: Parameters<typeof csT>[0]): string => csT(k, lang);

  useEffect(() => {
    let off = false;
    api
      .getManpowerReport(projectId, companyId, from, to)
      .then((r) => {
        if (!off) setRep(r);
      })
      .catch((e: unknown) => {
        if (!off) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      off = true;
    };
  }, [api, companyId, projectId, from, to]);

  const maxHours = Math.max(1, ...(rep?.rows ?? []).map((r) => r.totalHours));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={box}>
        <strong style={{ fontSize: 14 }}>{t('cs.dlog.mp.title')}</strong>
        <div style={{ marginTop: 8 }}>
          <RangePicker
            from={from}
            to={to}
            lang={lang}
            onChange={(f, tt) => {
              setFrom(f);
              setTo(tt);
            }}
          />
        </div>
      </div>
      {error !== null && <div style={errBox}>{error}</div>}
      {rep === null ? (
        <div style={box}>{csT('cs.common.loading', lang)}</div>
      ) : (
        <>
          <div style={{ ...box, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <Metric label={t('cs.dlog.mp.ownHours')} value={fmt(rep.totalOwnHours, 1)} />
            <Metric label={t('cs.dlog.mp.subHours')} value={fmt(rep.totalSubHours, 1)} />
            <Metric label={t('cs.dlog.mp.totalHours')} value={fmt(rep.totalHours, 1)} />
            <Metric label={t('cs.dlog.mp.workedDays')} value={String(rep.workedDays)} />
            <Metric label={t('cs.dlog.mp.notWorkedDays')} value={String(rep.notWorkedDays)} />
            <Metric
              label={t('cs.dlog.mp.avgHeadcount')}
              value={
                rep.avgHeadcountPerWorkedDay === null ? '—' : fmt(rep.avgHeadcountPerWorkedDay, 1)
              }
            />
          </div>

          <div style={{ ...box, padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr>
                  <th style={th}>{t('cs.dlog.mp.date')}</th>
                  <th style={th}>{t('cs.dlog.workState')}</th>
                  <th style={{ ...th, textAlign: 'right' }}>{t('cs.dlog.tot.ownHeadcount')}</th>
                  <th style={{ ...th, textAlign: 'right' }}>{t('cs.dlog.tot.subHeadcount')}</th>
                  <th style={{ ...th, textAlign: 'right' }}>{t('cs.dlog.mp.ownHours')}</th>
                  <th style={{ ...th, textAlign: 'right' }}>{t('cs.dlog.mp.subHours')}</th>
                  <th style={th}>{t('cs.dlog.mp.totalHours')}</th>
                </tr>
              </thead>
              <tbody>
                {rep.rows.length === 0 ? (
                  <tr>
                    <td style={{ ...td, color: '#94a3b8' }} colSpan={7}>
                      {csT('cs.common.noRecords', lang)}
                    </td>
                  </tr>
                ) : (
                  rep.rows.map((r) => (
                    <tr key={r.logDate} style={{ background: WORK_TINT[r.workState] }}>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.logDate}</td>
                      <td style={{ ...td, fontSize: 12 }}>{workStateLabel(r.workState, lang)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{r.ownHeadcount}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{r.subHeadcount}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{fmt(r.ownHours, 1)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{fmt(r.subHours, 1)}</td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <div
                            style={{
                              height: 8,
                              borderRadius: 4,
                              background: '#2563eb',
                              width: `${String((r.totalHours / maxHours) * 100)}%`,
                              minWidth: r.totalHours > 0 ? 2 : 0,
                            }}
                          />
                          <span style={{ fontSize: 12 }}>{fmt(r.totalHours, 1)}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function IsgRaporu({ api, companyId, projectId, lang }: ReportProps): JSX.Element {
  const init = defaultRange();
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [sum, setSum] = useState<SafetySummaryDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const t = (k: Parameters<typeof csT>[0]): string => csT(k, lang);

  useEffect(() => {
    let off = false;
    api
      .getSafetySummary(projectId, companyId, from, to)
      .then((r) => {
        if (!off) setSum(r);
      })
      .catch((e: unknown) => {
        if (!off) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      off = true;
    };
  }, [api, companyId, projectId, from, to]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={box}>
        <strong style={{ fontSize: 14 }}>{t('cs.dlog.sf.title')}</strong>
        <div style={{ marginTop: 8 }}>
          <RangePicker
            from={from}
            to={to}
            lang={lang}
            onChange={(f, tt) => {
              setFrom(f);
              setTo(tt);
            }}
          />
        </div>
      </div>
      {error !== null && <div style={errBox}>{error}</div>}
      {sum === null ? (
        <div style={box}>{csT('cs.common.loading', lang)}</div>
      ) : (
        <>
          <div style={{ ...box, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <Metric label={t('cs.dlog.sf.totalHours')} value={fmt(sum.totalHours, 1)} />
            <Metric label={t('cs.dlog.sf.accidents')} value={String(sum.accidentCount)} />
            <Metric
              label={t('cs.dlog.sf.recordable')}
              value={String(sum.recordableAccidentCount)}
              danger={sum.recordableAccidentCount > 0}
            />
            <Metric label={t('cs.dlog.sf.nearMiss')} value={String(sum.nearMissCount)} />
            <Metric
              label={t('cs.dlog.sf.lostDays')}
              value={String(sum.lostDays)}
              danger={sum.lostDays > 0}
            />
          </div>

          <div style={{ ...box, display: 'flex', gap: 26, flexWrap: 'wrap' }}>
            <div>
              <span style={label}>{t('cs.dlog.sf.frequencyRate')}</span>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {sum.frequencyRate === null ? '—' : fmt(sum.frequencyRate, 2)}
              </div>
              <div style={{ ...label, marginTop: 2, maxWidth: 340 }}>
                {t('cs.dlog.sf.frequencyHint')}
              </div>
            </div>
            <div>
              <span style={label}>{t('cs.dlog.sf.severityRate')}</span>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {sum.severityRate === null ? '—' : fmt(sum.severityRate, 2)}
              </div>
              <div style={{ ...label, marginTop: 2, maxWidth: 340 }}>
                {t('cs.dlog.sf.severityHint')}
              </div>
            </div>
          </div>

          {sum.frequencyRate === null && <div style={warnBox}>{t('cs.dlog.sf.rateUndefined')}</div>}
        </>
      )}
    </div>
  );
}

function ImalatRaporu({ api, companyId, projectId, lang }: ReportProps): JSX.Element {
  const [rows, setRows] = useState<ReadonlyArray<ProductionActualRowDto>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const t = (k: Parameters<typeof csT>[0]): string => csT(k, lang);

  useEffect(() => {
    let off = false;
    api
      .getProductionActuals(projectId, companyId)
      .then((r) => {
        if (off) return;
        setRows(r.rows);
        setLoaded(true);
      })
      .catch((e: unknown) => {
        if (!off) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      off = true;
    };
  }, [api, companyId, projectId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={box}>
        <strong style={{ fontSize: 14 }}>{t('cs.dlog.pr.title')}</strong>
        <div style={{ ...label, marginTop: 4 }}>{t('cs.dlog.pr.hint')}</div>
      </div>
      {error !== null && <div style={errBox}>{error}</div>}
      {!loaded ? (
        <div style={box}>{csT('cs.common.loading', lang)}</div>
      ) : (
        <div style={{ ...box, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr>
                <th style={th}>{t('cs.dlog.pr.boqLine')}</th>
                <th style={{ ...th, textAlign: 'right' }}>{t('cs.dlog.pr.producedQty')}</th>
                <th style={th}>{t('cs.dlog.f.unit')}</th>
                <th style={{ ...th, textAlign: 'right' }}>{t('cs.dlog.pr.entryCount')}</th>
                <th style={th}>{t('cs.dlog.pr.firstDate')}</th>
                <th style={th}>{t('cs.dlog.pr.lastDate')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td style={{ ...td, color: '#94a3b8' }} colSpan={6}>
                    {csT('cs.common.noRecords', lang)}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.boqLineId}>
                    <td style={td}>#{r.boqLineId}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>
                      {fmt(r.producedQty, 3)}
                    </td>
                    <td style={td}>{r.unit ?? '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{r.entryCount}</td>
                    <td style={td}>{r.firstDate}</td>
                    <td style={td}>{r.lastDate}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

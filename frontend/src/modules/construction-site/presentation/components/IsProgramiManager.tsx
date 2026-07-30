/**
 * IsProgramiManager — İş Programı ekranı (FAZ 8).
 *
 * İki iç sekme:
 *  - GANTT: WBS girintili aktivite listesi + CSS çubukları. Planlanan çubuk
 *    zeminde, içindeki dolgu ilerleme yüzdesi, fiili aralık ince koyu çizgi,
 *    bugün dikey kırmızı çizgi. Kütüphane YOK — modülün geri kalanı gibi saf
 *    CSS; bağımlılık eklemek tek ekran için gövde şişirir.
 *  - S-EĞRİSİ: SVG polyline. Planlanan kesiksiz, fiili kalın; fiili çizgi
 *    yalnız bugüne kadar çizilir (backend gelecekte null döner) ve grafiğin
 *    altında bunun nedeni yazar — eğri "olacak"ı değil "oldu"yu gösterir.
 *
 * İLERLEME PANELİ: her kayıt günlüğe düşer (fiili eğrinin kaynağı), aynı güne
 * ikinci kayıt üzerine yazar, geleceğe kayıt backend'de 400. Bağlı fiziksel
 * takibi olan aktivitede "Takipten çek" düğmesi takip yüzdesini gösterir —
 * fark (drift) görünür, eşitleme tek tıkla ve KASITLIDIR.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';

import type {
  ActivityKind,
  ActivityProgressLogRowDto,
  ProjectScheduleDto,
  ScheduleActivityDto,
  ScheduleCurveDto,
  ProjectDto,
} from '../../application/dto/ConstructionDtos';
import type { ConstructionApi } from '../../application/ports/ConstructionApi';
import { activityKindLabel, csT } from '../../i18n';
import { useProjects } from '../hooks/useProjects';

export interface IsProgramiManagerProps {
  api: ConstructionApi;
  companyId: number;
  lang?: string | undefined;
  confirmAsync?: ((message: string) => Promise<boolean>) | undefined;
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
const okBox: CSSProperties = {
  ...errBox,
  border: '1px solid #86efac',
  background: '#f0fdf4',
  color: '#15803d',
};

const DAY = 86_400_000;
const toMs = (d: string): number => Date.parse(`${d}T00:00:00Z`);
const num = (v: number, digits = 1): string =>
  v.toLocaleString('tr-TR', { maximumFractionDigits: digits });

export function IsProgramiManager({
  api,
  companyId,
  lang,
  confirmAsync,
}: IsProgramiManagerProps): JSX.Element {
  const { projects } = useProjects(api, companyId);
  const [projectId, setProjectId] = useState(0);
  const [tab, setTab] = useState<'gantt' | 'curve'>('gantt');
  const [schedule, setSchedule] = useState<ProjectScheduleDto | null>(null);
  const [curve, setCurve] = useState<ScheduleCurveDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  /** İlerleme paneli açık olan aktivite. */
  const [progressFor, setProgressFor] = useState<ScheduleActivityDto | null>(null);
  const [progressLog, setProgressLog] = useState<ActivityProgressLogRowDto[]>([]);

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
    if (!(projectId > 0)) {
      setSchedule(null);
      setCurve(null);
      return;
    }
    try {
      const [sched, crv] = await Promise.all([
        api.getProjectSchedule(projectId, companyId),
        api.getProjectScheduleCurve(projectId, companyId),
      ]);
      setSchedule(sched);
      setCurve(crv);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api, companyId, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const flash = (msg: string): void => {
    setError(null);
    setInfo(msg);
  };

  const openProgress = async (a: ScheduleActivityDto): Promise<void> => {
    try {
      const res = await api.getScheduleProgressLog(a.id, companyId);
      setProgressFor(a);
      setProgressLog(res.log);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const removeActivity = async (a: ScheduleActivityDto): Promise<void> => {
    if (!(await confirm(t('cs.sch.deleteConfirm')))) return;
    try {
      await api.deactivateScheduleActivity(a.id, companyId);
      await load();
      flash(t('cs.qg.saved'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const activities = schedule?.activities ?? [];
  const summary = schedule?.summary ?? null;
  const groups = activities.filter((a) => a.kind === 'group');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <h3 style={{ margin: '0 0 2px', fontSize: 16 }}>{t('cs.sch.title')}</h3>
        <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{t('cs.sch.subtitle')}</p>
      </div>

      <div style={{ ...box, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 260 }}>
          <span style={label}>{t('cs.common.project')}</span>
          <select
            style={input}
            value={projectId === 0 ? '' : String(projectId)}
            onChange={(e) => {
              setProjectId(e.target.value === '' ? 0 : Number(e.target.value));
              setInfo(null);
              setError(null);
              setProgressFor(null);
            }}
          >
            <option value="">{t('cs.common.selectProject')}</option>
            {projects.map((p: ProjectDto) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.name}
              </option>
            ))}
          </select>
        </div>
        <button type="button" style={btn} onClick={() => void load()}>
          {t('cs.common.refresh')}
        </button>
        <button type="button" style={btn} onClick={() => setShowForm((v) => !v)}>
          {showForm ? t('cs.common.close') : t('cs.sch.new')}
        </button>
      </div>

      {error !== null && <div style={errBox}>{error}</div>}
      {info !== null && <div style={okBox}>{info}</div>}

      {projectId === 0 ? (
        <div style={{ ...box, color: '#64748b', fontSize: 13 }}>{t('cs.common.selectProject')}</div>
      ) : (
        <>
          {summary !== null && summary.taskCount > 0 && (
            <div style={{ ...box, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <Metric
                label={t('cs.sch.s.tasks')}
                value={String(summary.taskCount)}
                color="#334155"
              />
              <Metric
                label={t('cs.sch.s.done')}
                value={String(summary.doneCount)}
                color="#15803d"
              />
              <Metric
                label={t('cs.sch.s.overdue')}
                value={String(summary.overdueCount)}
                color="#b91c1c"
              />
              <Metric
                label={t('cs.sch.s.notStartedLate')}
                value={String(summary.notStartedLateCount)}
                color="#c2410c"
              />
              <Metric
                label={t('cs.sch.s.range')}
                value={`${summary.projectStart ?? '—'} → ${summary.projectEnd ?? '—'}`}
                color="#334155"
              />
            </div>
          )}

          {showForm && (
            <ActivityForm
              lang={lang}
              groups={groups}
              activities={activities}
              onSubmit={async (body) => {
                try {
                  await api.createScheduleActivity({ companyId, projectId, ...body });
                  setShowForm(false);
                  await load();
                  flash(t('cs.qg.saved'));
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              }}
            />
          )}

          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0' }}>
            {(
              [
                ['gantt', t('cs.sch.tab.gantt')],
                ['curve', t('cs.sch.tab.curve')],
              ] as ['gantt' | 'curve', string][]
            ).map(([tb, lbl]) => (
              <button
                key={tb}
                type="button"
                onClick={() => setTab(tb)}
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  borderBottom: tab === tb ? '2px solid #2563eb' : '2px solid transparent',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: tab === tb ? 600 : 400,
                  color: tab === tb ? '#1d4ed8' : '#475569',
                }}
              >
                {lbl}
              </button>
            ))}
          </div>

          {activities.length === 0 ? (
            <div style={{ ...box, color: '#64748b', fontSize: 13 }}>{t('cs.sch.empty')}</div>
          ) : tab === 'gantt' ? (
            <GanttPanel
              activities={activities}
              lang={lang}
              onProgress={(a) => void openProgress(a)}
              onDelete={(a) => void removeActivity(a)}
            />
          ) : (
            <CurvePanel curve={curve} lang={lang} />
          )}

          {progressFor !== null && (
            <ProgressPanel
              activity={progressFor}
              log={progressLog}
              lang={lang}
              onClose={() => setProgressFor(null)}
              onSubmit={async (body) => {
                try {
                  await api.recordScheduleProgress(progressFor.id, { companyId, ...body });
                  setProgressFor(null);
                  await load();
                  flash(t('cs.qg.saved'));
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// GANTT
// ============================================================================

function GanttPanel({
  activities,
  lang,
  onProgress,
  onDelete,
}: {
  activities: ScheduleActivityDto[];
  lang: string | undefined;
  onProgress: (a: ScheduleActivityDto) => void;
  onDelete: (a: ScheduleActivityDto) => void;
}): JSX.Element {
  const t = (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>): string =>
    csT(k, lang, vars);

  // WBS sırası: gruplar kendi sıralarında, çocuklar hemen altlarında girintili.
  const ordered = useMemo(() => {
    const roots = activities.filter((a) => a.parentId === null);
    const byParent = new Map<number, ScheduleActivityDto[]>();
    for (const a of activities) {
      if (a.parentId !== null) {
        const arr = byParent.get(a.parentId);
        if (arr) arr.push(a);
        else byParent.set(a.parentId, [a]);
      }
    }
    const out: { a: ScheduleActivityDto; depth: number }[] = [];
    const walk = (a: ScheduleActivityDto, depth: number): void => {
      out.push({ a, depth });
      for (const c of byParent.get(a.id) ?? []) walk(c, depth + 1);
    };
    for (const r of roots) walk(r, 0);
    return out;
  }, [activities]);

  // Zaman ekseni: en erken plan başlangıcı → en geç (plan bitişi | bugün).
  const today = new Date().toISOString().slice(0, 10);
  const minMs = Math.min(...activities.map((a) => toMs(a.plannedStart)));
  const maxMs = Math.max(...activities.map((a) => toMs(a.plannedEnd)), toMs(today));
  const span = Math.max(maxMs - minMs, DAY);
  const x = (d: string): number => ((toMs(d) - minMs) / span) * 100;

  return (
    <div style={{ ...box, padding: 0, overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1100 }}>
        <thead>
          <tr>
            <th style={thGantt(220)}>{t('cs.sch.c.name')}</th>
            <th style={thGantt(90)}>{t('cs.sch.c.progress')}</th>
            <th style={thGantt(0)}>
              <span style={{ display: 'flex', gap: 14, fontWeight: 400, color: '#64748b' }}>
                <Legend color="#bfdbfe" label={t('cs.sch.gantt.planned')} />
                <Legend color="#1d4ed8" label={t('cs.sch.c.progress')} />
                <Legend color="#166534" label={t('cs.sch.gantt.actual')} />
                <Legend color="#dc2626" label={t('cs.sch.gantt.today')} line />
              </span>
            </th>
            <th style={thGantt(170)} />
          </tr>
        </thead>
        <tbody>
          {ordered.map(({ a, depth }) => {
            const isGroup = a.kind === 'group';
            const late = a.daysOverdue !== null && a.daysOverdue > 0;
            const left = x(a.plannedStart);
            const width = Math.max(x(a.plannedEnd) - left, 0.6);
            return (
              <tr key={a.id} style={isGroup ? { background: '#f8fafc' } : undefined}>
                <td style={{ ...tdGantt, paddingLeft: 8 + depth * 18 }}>
                  <span style={{ fontWeight: isGroup ? 700 : 500 }}>
                    {a.kind === 'milestone' ? '◆ ' : ''}
                    {a.name}
                  </span>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>
                    {a.code} · {activityKindLabel(a.kind, lang)}
                    {late ? (
                      <span style={{ color: '#b91c1c', fontWeight: 700 }}>
                        {' '}
                        · {t('cs.qg.days', { n: a.daysOverdue ?? 0 })}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td style={tdGantt}>
                  {isGroup ? (
                    ''
                  ) : (
                    <span style={{ fontWeight: 600 }}>
                      %{num(a.progressPct, 0)}
                      {a.trackingPct !== null && Math.abs(a.trackingPct - a.progressPct) > 0.5 ? (
                        <span
                          style={{ color: '#7c3aed', fontSize: 10, display: 'block' }}
                          title={t('cs.sch.prog.fromTrackingHint')}
                        >
                          {t('cs.sch.trackingDrift', { pct: num(a.trackingPct) })}
                        </span>
                      ) : null}
                    </span>
                  )}
                </td>
                <td style={{ ...tdGantt, padding: '4px 0' }}>
                  <div style={{ position: 'relative', height: isGroup ? 10 : 20 }}>
                    {/* Bugün çizgisi */}
                    <div
                      style={{
                        position: 'absolute',
                        left: `${String(x(today))}%`,
                        top: -2,
                        bottom: -2,
                        width: 2,
                        background: '#dc2626',
                        opacity: 0.7,
                      }}
                      title={t('cs.sch.gantt.today')}
                    />
                    {a.kind === 'milestone' ? (
                      <div
                        style={{
                          position: 'absolute',
                          left: `calc(${String(left)}% - 6px)`,
                          top: 3,
                          width: 12,
                          height: 12,
                          transform: 'rotate(45deg)',
                          background: a.progressPct >= 100 ? '#166534' : '#1d4ed8',
                        }}
                        title={`${a.name} · ${a.plannedStart}`}
                      />
                    ) : (
                      <>
                        {/* Planlanan çubuk + ilerleme dolgusu */}
                        <div
                          style={{
                            position: 'absolute',
                            left: `${String(left)}%`,
                            width: `${String(width)}%`,
                            top: isGroup ? 2 : 2,
                            height: isGroup ? 6 : 12,
                            background: isGroup ? '#cbd5e1' : '#bfdbfe',
                            borderRadius: 3,
                            overflow: 'hidden',
                          }}
                          title={`${a.plannedStart} → ${a.plannedEnd}`}
                        >
                          {!isGroup && (
                            <div
                              style={{
                                width: `${String(a.progressPct)}%`,
                                height: '100%',
                                background: late ? '#b91c1c' : '#1d4ed8',
                              }}
                            />
                          )}
                        </div>
                        {/* Fiili aralık — ince koyu çizgi (başlangıç → bitiş|bugün) */}
                        {!isGroup && a.actualStart !== null && (
                          <div
                            style={{
                              position: 'absolute',
                              left: `${String(x(a.actualStart))}%`,
                              width: `${String(
                                Math.max(x(a.actualEnd ?? today) - x(a.actualStart), 0.4),
                              )}%`,
                              top: 16,
                              height: 3,
                              background: '#166534',
                              borderRadius: 2,
                            }}
                            title={`${t('cs.sch.gantt.actual')}: ${a.actualStart} → ${a.actualEnd ?? '…'}`}
                          />
                        )}
                      </>
                    )}
                  </div>
                </td>
                <td style={{ ...tdGantt, whiteSpace: 'nowrap' }}>
                  {!isGroup && (
                    <button
                      type="button"
                      style={{ ...btn, marginRight: 4 }}
                      onClick={() => onProgress(a)}
                    >
                      {t('cs.sch.prog.title')}
                    </button>
                  )}
                  <button type="button" style={btn} onClick={() => onDelete(a)}>
                    {t('cs.common.delete')}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const thGantt = (w: number): CSSProperties => ({
  padding: '5px 7px',
  fontSize: 11,
  color: '#334155',
  background: '#f8fafc',
  textAlign: 'left',
  borderBottom: '1px solid #e2e8f0',
  fontWeight: 600,
  ...(w > 0 ? { width: w } : {}),
});
const tdGantt: CSSProperties = {
  padding: '5px 7px',
  fontSize: 12,
  borderTop: '1px solid #f1f5f9',
  verticalAlign: 'middle',
};

function Legend({
  color,
  label: lbl,
  line,
}: {
  color: string;
  label: string;
  line?: boolean;
}): JSX.Element {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
      <span
        style={{
          width: line === true ? 2 : 14,
          height: line === true ? 12 : 8,
          background: color,
          borderRadius: 2,
          display: 'inline-block',
        }}
      />
      {lbl}
    </span>
  );
}

// ============================================================================
// S-EĞRİSİ
// ============================================================================

function CurvePanel({
  curve,
  lang,
}: {
  curve: ScheduleCurveDto | null;
  lang: string | undefined;
}): JSX.Element {
  const t = (k: Parameters<typeof csT>[0]): string => csT(k, lang);

  if (curve === null || curve.points.length === 0) {
    return <div style={{ ...box, color: '#64748b', fontSize: 13 }}>{t('cs.sch.curve.empty')}</div>;
  }

  const W = 860;
  const H = 300;
  const PAD = { left: 44, right: 16, top: 12, bottom: 28 };
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const n = curve.points.length;
  const px = (i: number): number => PAD.left + (n <= 1 ? 0 : (i / (n - 1)) * iw);
  const py = (pct: number): number => PAD.top + ih - (pct / 100) * ih;

  const plannedPath = curve.points.map((p, i) => `${String(px(i))},${String(py(p.plannedPct))}`);
  const actualPts = curve.points
    .map((p, i) => (p.actualPct === null ? null : `${String(px(i))},${String(py(p.actualPct))}`))
    .filter((v): v is string => v !== null);

  // X ekseni etiketi: en fazla ~6 tarih
  const tickEvery = Math.max(1, Math.floor(n / 6));

  return (
    <div style={{ ...box, display: 'grid', gap: 8 }}>
      <div style={{ fontSize: 11, color: '#64748b' }}>
        {curve.weightMode === 'explicit'
          ? t('cs.sch.curve.weightExplicit')
          : t('cs.sch.curve.weightDuration')}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <svg width={W} height={H} role="img" aria-label={t('cs.sch.tab.curve')}>
          {/* Izgara + Y etiketleri */}
          {[0, 25, 50, 75, 100].map((pct) => (
            <g key={pct}>
              <line
                x1={PAD.left}
                y1={py(pct)}
                x2={W - PAD.right}
                y2={py(pct)}
                stroke="#e2e8f0"
                strokeWidth={1}
              />
              <text x={PAD.left - 6} y={py(pct) + 4} fontSize={10} fill="#64748b" textAnchor="end">
                %{pct}
              </text>
            </g>
          ))}
          {/* X etiketleri */}
          {curve.points.map((p, i) =>
            i % tickEvery === 0 || i === n - 1 ? (
              <text
                key={p.date}
                x={px(i)}
                y={H - 8}
                fontSize={9}
                fill="#64748b"
                textAnchor="middle"
              >
                {p.date.slice(5)}
              </text>
            ) : null,
          )}
          {/* Planlanan */}
          <polyline
            points={plannedPath.join(' ')}
            fill="none"
            stroke="#94a3b8"
            strokeWidth={2}
            strokeDasharray="6 3"
          />
          {/* Fiili */}
          {actualPts.length > 1 && (
            <polyline points={actualPts.join(' ')} fill="none" stroke="#1d4ed8" strokeWidth={2.5} />
          )}
          {actualPts.length > 0 && (
            <circle
              cx={Number(actualPts[actualPts.length - 1]!.split(',')[0])}
              cy={Number(actualPts[actualPts.length - 1]!.split(',')[1])}
              r={4}
              fill="#1d4ed8"
            />
          )}
        </svg>
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#334155' }}>
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 18,
              borderTop: '2px dashed #94a3b8',
              marginRight: 4,
              verticalAlign: 'middle',
            }}
          />
          {t('cs.sch.gantt.planned')}
        </span>
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 18,
              borderTop: '3px solid #1d4ed8',
              marginRight: 4,
              verticalAlign: 'middle',
            }}
          />
          {t('cs.sch.gantt.actual')}
        </span>
      </div>
      <div style={{ fontSize: 10, color: '#94a3b8' }}>{t('cs.sch.curve.actualNote')}</div>
    </div>
  );
}

// ============================================================================
// İLERLEME PANELİ
// ============================================================================

function ProgressPanel({
  activity,
  log,
  lang,
  onClose,
  onSubmit,
}: {
  activity: ScheduleActivityDto;
  log: ActivityProgressLogRowDto[];
  lang: string | undefined;
  onClose: () => void;
  onSubmit: (body: {
    progressPct?: number;
    fromTracking?: boolean;
    asOf?: string;
    note?: string | null;
  }) => Promise<void>;
}): JSX.Element {
  const t = (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>): string =>
    csT(k, lang, vars);
  const [pct, setPct] = useState(String(activity.progressPct));
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  return (
    <div style={{ ...box, display: 'grid', gap: 8, borderColor: '#93c5fd' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          {t('cs.sch.prog.title')} — {activity.code} · {activity.name}
        </div>
        <button type="button" style={btn} onClick={onClose}>
          {t('cs.common.close')}
        </button>
      </div>
      <div style={{ fontSize: 11, color: '#64748b' }}>{t('cs.sch.prog.hint')}</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ width: 110 }}>
          <span style={label}>{t('cs.sch.c.progress')} %</span>
          <input style={input} value={pct} onChange={(e) => setPct(e.target.value)} />
        </div>
        <div style={{ width: 150 }}>
          <span style={label}>{t('cs.sch.prog.asOf')}</span>
          <input type="date" style={input} value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <span style={label}>{t('cs.common.note')}</span>
          <input style={input} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <button
          type="button"
          style={btnPrimary}
          onClick={() => {
            const v = Number(pct.replace(',', '.'));
            if (!Number.isFinite(v) || v < 0 || v > 100) {
              setLocalError(t('cs.common.required'));
              return;
            }
            setLocalError(null);
            void onSubmit({
              progressPct: v,
              asOf,
              note: note.trim() === '' ? null : note.trim(),
            });
          }}
        >
          {t('cs.common.save')}
        </button>
        {activity.trackingId !== null && activity.trackingPct !== null && (
          <button
            type="button"
            style={btn}
            title={t('cs.sch.prog.fromTrackingHint')}
            onClick={() => void onSubmit({ fromTracking: true, asOf })}
          >
            {t('cs.sch.prog.fromTracking', { pct: num(activity.trackingPct) })}
          </button>
        )}
      </div>
      {localError !== null && <div style={errBox}>{localError}</div>}

      {log.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            {t('cs.sch.prog.log')}
          </div>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#334155' }}>
            {log.map((l) => (
              <li key={l.id}>
                {l.asOf} · %{num(l.progressPct, 0)}
                {l.note === null ? '' : ` · ${l.note}`}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// AKTİVİTE FORMU
// ============================================================================

function ActivityForm({
  lang,
  groups,
  activities,
  onSubmit,
}: {
  lang: string | undefined;
  groups: ScheduleActivityDto[];
  activities: ScheduleActivityDto[];
  onSubmit: (body: {
    name: string;
    kind: ActivityKind;
    plannedStart: string;
    plannedEnd?: string;
    parentId?: number | null;
    dependsOn?: number | null;
    weightPct?: number;
    trackingId?: number | null;
  }) => Promise<void>;
}): JSX.Element {
  const t = (k: Parameters<typeof csT>[0]): string => csT(k, lang);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ActivityKind>('task');
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState('');
  const [parentId, setParentId] = useState(0);
  const [dependsOn, setDependsOn] = useState(0);
  const [weight, setWeight] = useState('');
  const [trackingId, setTrackingId] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const KINDS: ActivityKind[] = ['group', 'task', 'milestone'];

  return (
    <div style={{ ...box, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <span style={label}>{t('cs.sch.c.name')}</span>
        <input style={input} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div style={{ minWidth: 140 }}>
        <span style={label} title={t('cs.sch.milestoneHint')}>
          {t('cs.sch.c.kind')}
        </span>
        <select
          style={input}
          value={kind}
          onChange={(e) => setKind(e.target.value as ActivityKind)}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {activityKindLabel(k, lang)}
            </option>
          ))}
        </select>
      </div>
      <div style={{ width: 150 }}>
        <span style={label}>{t('cs.sch.c.plannedStart')}</span>
        <input type="date" style={input} value={start} onChange={(e) => setStart(e.target.value)} />
      </div>
      {kind !== 'milestone' && (
        <div style={{ width: 150 }}>
          <span style={label}>{t('cs.sch.c.plannedEnd')}</span>
          <input type="date" style={input} value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      )}
      {kind !== 'group' && (
        <>
          <div style={{ minWidth: 170 }}>
            <span style={label}>{t('cs.sch.c.parent')}</span>
            <select
              style={input}
              value={parentId === 0 ? '' : String(parentId)}
              onChange={(e) => setParentId(e.target.value === '' ? 0 : Number(e.target.value))}
            >
              <option value="">—</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.code} · {g.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: 170 }}>
            <span style={label}>{t('cs.sch.c.dependsOn')}</span>
            <select
              style={input}
              value={dependsOn === 0 ? '' : String(dependsOn)}
              onChange={(e) => setDependsOn(e.target.value === '' ? 0 : Number(e.target.value))}
            >
              <option value="">—</option>
              {activities
                .filter((a) => a.kind !== 'group')
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.name}
                  </option>
                ))}
            </select>
          </div>
          <div style={{ width: 100 }}>
            <span style={label} title={t('cs.sch.weightHint')}>
              {t('cs.sch.c.weight')}
            </span>
            <input style={input} value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
          <div style={{ width: 120 }}>
            <span style={label}>{t('cs.sch.c.tracking')}</span>
            <input
              style={input}
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value)}
            />
          </div>
        </>
      )}
      <button
        type="button"
        style={btnPrimary}
        onClick={() => {
          if (name.trim() === '' || start === '') {
            setLocalError(t('cs.common.required'));
            return;
          }
          setLocalError(null);
          void onSubmit({
            name: name.trim(),
            kind,
            plannedStart: start,
            ...(kind !== 'milestone' && end !== '' ? { plannedEnd: end } : {}),
            parentId: parentId > 0 ? parentId : null,
            dependsOn: dependsOn > 0 ? dependsOn : null,
            ...(weight.trim() === '' ? {} : { weightPct: Number(weight.replace(',', '.')) }),
            trackingId: trackingId.trim() === '' ? null : Number(trackingId),
          });
        }}
      >
        {t('cs.common.save')}
      </button>
      {localError !== null && <div style={errBox}>{localError}</div>}
    </div>
  );
}

// ============================================================================

function Metric({
  label: lbl,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}): JSX.Element {
  return (
    <div>
      <span style={label}>{lbl}</span>
      <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.1, color }}>{value}</div>
    </div>
  );
}

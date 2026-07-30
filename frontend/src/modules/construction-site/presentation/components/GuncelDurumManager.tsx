/**
 * GuncelDurumManager — Güncel Durum Takipleri + Saha Ekranı (FAZ 2).
 *
 * İki görünüm:
 *   liste → proje fiziksel ilerleme göstergesi + takip satırları (ilerleme /
 *           planlanan / sapma) + yeni takip formu
 *   saha  → seçili takibin lokasyon sekmeleri ve grup/iş matrisi; 4 durumlu
 *           radyo + kısmi yüzde + denetleyen tarihi
 *
 * Saha ekranı OPTİMİST DEĞİL, TOPLU kaydeder: şantiye şefi onlarca tik atar,
 * her tikte ağ isteği atmak hem yavaş hem de kısmi kayıt riski taşır. Bekleyen
 * değişiklikler yerelde tutulur, tek PUT ile gönderilir.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';

import type {
  ItemState,
  LocationDto,
  ProgressTemplateDto,
  ProjectDto,
  ProjectPhysicalProgressDto,
  TrackingBoardDto,
  TrackingListRowDto,
  TrackingStatus,
} from '../../application/dto/ConstructionDtos';
import type { ConstructionApi } from '../../application/ports/ConstructionApi';
import { csT, itemStateLabel, trackingStatusLabel, trackScopeLabel } from '../../i18n';
import { useProjects } from '../hooks/useProjects';

export interface GuncelDurumManagerProps {
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

const STATES: ItemState[] = ['not_started', 'in_progress', 'has_defects', 'completed'];

const STATE_TINT: Record<ItemState, string> = {
  not_started: '#f8fafc',
  in_progress: '#fef3c7',
  has_defects: '#fed7aa',
  completed: '#dcfce7',
};

const fmtPct = (n: number): string =>
  n.toLocaleString('tr-TR', { maximumFractionDigits: 2, minimumFractionDigits: 0 });

const todayIso = (): string => new Date().toISOString().slice(0, 10);

/** İlerleme çubuğu; planlanan varsa üstüne ince bir işaret koyar. */
function Bar({ pct, planned }: { pct: number; planned?: number | null }): JSX.Element {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      style={{
        position: 'relative',
        height: 10,
        background: '#e2e8f0',
        borderRadius: 5,
        overflow: 'hidden',
        minWidth: 90,
      }}
    >
      <div
        style={{
          width: `${String(clamped)}%`,
          height: '100%',
          background: clamped >= 100 ? '#16a34a' : '#2563eb',
        }}
      />
      {planned !== null && planned !== undefined && (
        <div
          style={{
            position: 'absolute',
            left: `${String(Math.max(0, Math.min(100, planned)))}%`,
            top: 0,
            bottom: 0,
            width: 2,
            background: '#b45309',
          }}
          title={`${fmtPct(planned)}%`}
        />
      )}
    </div>
  );
}

/** Sapma etiketi — pozitif önde, negatif geride, null "plan yok". */
function DeviationCell({
  deviation,
  lang,
}: {
  deviation: number | null;
  lang?: string | undefined;
}): JSX.Element {
  if (deviation === null) {
    return <span style={{ fontSize: 12, color: '#94a3b8' }}>—</span>;
  }
  const ahead = deviation > 0.005;
  const behind = deviation < -0.005;
  const color = behind ? '#b91c1c' : ahead ? '#15803d' : '#64748b';
  const suffix = behind
    ? csT('cs.trk.behindPlan', lang)
    : ahead
      ? csT('cs.trk.aheadOfPlan', lang)
      : csT('cs.trk.onPlan', lang);
  return (
    <span style={{ fontSize: 12, color, whiteSpace: 'nowrap' }}>
      {deviation > 0 ? '+' : ''}
      {fmtPct(deviation)} · {suffix}
    </span>
  );
}

export function GuncelDurumManager({
  api,
  companyId,
  lang,
  confirmAsync,
}: GuncelDurumManagerProps): JSX.Element {
  const { projects } = useProjects(api, companyId);
  const [projectId, setProjectId] = useState<number>(0);
  const [summary, setSummary] = useState<ProjectPhysicalProgressDto | null>(null);
  const [templates, setTemplates] = useState<ReadonlyArray<ProgressTemplateDto>>([]);
  const [openTrackingId, setOpenTrackingId] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);

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

  const loadSummary = useCallback(async (): Promise<void> => {
    if (!(projectId > 0)) {
      setSummary(null);
      return;
    }
    setError(null);
    try {
      const res = await api.getProjectPhysicalProgress(projectId, companyId);
      setSummary(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api, companyId, projectId]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    let off = false;
    api
      .listProgressTemplates(companyId)
      .then((r) => {
        if (!off) setTemplates(r.templates);
      })
      .catch((e: unknown) => {
        if (!off) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      off = true;
    };
  }, [api, companyId]);

  const changeStatus = async (id: number, status: TrackingStatus): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await api.changeTrackingStatus(id, { companyId, status });
      await loadSummary();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const syncTemplate = async (id: number): Promise<void> => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.syncTrackingWithTemplate(id, companyId);
      setInfo(t('cs.trk.syncDone', { n: res.addedItems }));
      await loadSummary();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (openTrackingId > 0) {
    return (
      <SahaEkrani
        api={api}
        companyId={companyId}
        trackingId={openTrackingId}
        lang={lang}
        confirmAsync={confirmAsync}
        onBack={() => {
          setOpenTrackingId(0);
          void loadSummary();
        }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <h3 style={{ margin: '0 0 2px', fontSize: 16 }}>{t('cs.trk.title')}</h3>
        <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{t('cs.trk.subtitle')}</p>
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
              setShowNew(false);
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
        <button type="button" style={btn} onClick={() => void loadSummary()}>
          {t('cs.common.refresh')}
        </button>
        {projectId > 0 && templates.length > 0 && (
          <button type="button" style={btnPrimary} onClick={() => setShowNew((v) => !v)}>
            + {t('cs.trk.new')}
          </button>
        )}
      </div>

      {error !== null && <div style={errBox}>{error}</div>}
      {info !== null && <div style={okBox}>{info}</div>}
      {projectId > 0 && templates.length === 0 && (
        <div style={warnBox}>{t('cs.trk.noTemplates')}</div>
      )}

      {showNew && projectId > 0 && (
        <YeniTakipFormu
          api={api}
          companyId={companyId}
          projectId={projectId}
          templates={templates}
          lang={lang}
          onDone={() => {
            setShowNew(false);
            void loadSummary();
          }}
          onError={setError}
          onCancel={() => setShowNew(false)}
        />
      )}

      {projectId === 0 ? (
        <div style={{ ...box, color: '#64748b', fontSize: 13 }}>{t('cs.common.selectProject')}</div>
      ) : summary === null ? (
        <div style={{ ...box, color: '#64748b', fontSize: 13 }}>{t('cs.common.loading')}</div>
      ) : (
        <>
          {/* Proje fiziksel ilerleme göstergesi */}
          <div style={box}>
            <div
              style={{
                display: 'flex',
                gap: 20,
                alignItems: 'center',
                flexWrap: 'wrap',
                marginBottom: summary.unmeasuredWeight > 0.005 ? 10 : 0,
              }}
            >
              <div>
                <span style={label}>{t('cs.pp.projectProgress')}</span>
                <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>
                  %{fmtPct(summary.progressPct)}
                </div>
              </div>
              <div style={{ minWidth: 220, flex: 1 }}>
                <Bar pct={summary.progressPct} />
              </div>
              <div>
                <span style={label}>{t('cs.pp.weightSum')}</span>
                <div style={{ fontSize: 14 }}>%{fmtPct(summary.weightSum)}</div>
              </div>
              <div>
                <span style={label}>{t('cs.pp.unmeasured')}</span>
                <div
                  style={{
                    fontSize: 14,
                    color: summary.unmeasuredWeight > 0.005 ? '#b45309' : '#64748b',
                  }}
                >
                  %{fmtPct(summary.unmeasuredWeight)}
                </div>
              </div>
              <div>
                <span style={label}>{t('cs.pp.trackingCount')}</span>
                <div style={{ fontSize: 14 }}>{summary.trackingCount}</div>
              </div>
            </div>
            {summary.unmeasuredWeight > 0.005 && (
              <div style={{ ...warnBox, padding: '6px 9px', fontSize: 12 }}>
                {t('cs.pp.unmeasuredWarn', { n: fmtPct(summary.unmeasuredWeight) })}
              </div>
            )}
          </div>

          {/* Takip listesi */}
          {summary.trackings.length === 0 ? (
            <div style={{ ...box, color: '#64748b', fontSize: 13 }}>{t('cs.trk.noTrackings')}</div>
          ) : (
            <div style={{ ...box, padding: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr>
                    <th style={th}>{t('cs.common.code')}</th>
                    <th style={th}>{t('cs.common.name')}</th>
                    <th style={th}>{t('cs.common.status')}</th>
                    <th style={{ ...th, textAlign: 'right' }}>{t('cs.trk.projectWeight')}</th>
                    <th style={th}>{t('cs.trk.progress')}</th>
                    <th style={{ ...th, textAlign: 'right' }}>{t('cs.trk.planned')}</th>
                    <th style={th}>{t('cs.trk.deviation')}</th>
                    <th style={{ ...th, textAlign: 'right' }}>{t('cs.pp.contribution')}</th>
                    <th style={{ ...th, textAlign: 'right' }}>{t('cs.trk.locationCount')}</th>
                    <th style={th}>{t('cs.common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.trackings.map((trk: TrackingListRowDto) => (
                    <tr key={trk.id}>
                      <td style={{ ...td, fontWeight: 600, whiteSpace: 'nowrap' }}>{trk.code}</td>
                      <td style={td}>{trk.name}</td>
                      <td style={td}>
                        <span
                          style={{
                            fontSize: 11,
                            padding: '2px 7px',
                            borderRadius: 10,
                            background:
                              trk.status === 'active'
                                ? '#dcfce7'
                                : trk.status === 'completed'
                                  ? '#dbeafe'
                                  : trk.status === 'cancelled'
                                    ? '#fee2e2'
                                    : '#f1f5f9',
                          }}
                        >
                          {trackingStatusLabel(trk.status, lang)}
                        </span>
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>%{fmtPct(trk.projectWeightPct)}</td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <Bar pct={trk.progressPct} planned={trk.plannedPct} />
                          <span style={{ fontSize: 12, minWidth: 46, textAlign: 'right' }}>
                            %{fmtPct(trk.progressPct)}
                          </span>
                        </div>
                      </td>
                      <td style={{ ...td, textAlign: 'right', color: '#64748b' }}>
                        {trk.plannedPct === null ? '—' : `%${fmtPct(trk.plannedPct)}`}
                      </td>
                      <td style={td}>
                        <DeviationCell deviation={trk.deviationPct} lang={lang} />
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        %{fmtPct((trk.progressPct * trk.projectWeightPct) / 100)}
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>{trk.locationCount}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        <button type="button" style={btn} onClick={() => setOpenTrackingId(trk.id)}>
                          {t('cs.trk.openBoard')}
                        </button>{' '}
                        {trk.status === 'draft' && (
                          <button
                            type="button"
                            style={btn}
                            disabled={busy}
                            onClick={() => void changeStatus(trk.id, 'active')}
                          >
                            {t('cs.trk.activate')}
                          </button>
                        )}
                        {trk.status === 'active' && (
                          <>
                            <button
                              type="button"
                              style={btn}
                              disabled={busy}
                              onClick={() => void changeStatus(trk.id, 'completed')}
                            >
                              {t('cs.trk.complete')}
                            </button>{' '}
                            <button
                              type="button"
                              style={btn}
                              disabled={busy}
                              onClick={() => void syncTemplate(trk.id)}
                            >
                              {t('cs.trk.syncTemplate')}
                            </button>
                          </>
                        )}
                        {trk.status === 'completed' && (
                          <button
                            type="button"
                            style={btn}
                            disabled={busy}
                            onClick={() => void changeStatus(trk.id, 'active')}
                          >
                            {t('cs.trk.reopen')}
                          </button>
                        )}
                        {(trk.status === 'draft' || trk.status === 'active') && (
                          <>
                            {' '}
                            <button
                              type="button"
                              style={btn}
                              disabled={busy}
                              onClick={() => {
                                void (async (): Promise<void> => {
                                  if (
                                    await confirm(t('cs.loc.deactivateConfirm', { name: trk.name }))
                                  ) {
                                    await changeStatus(trk.id, 'cancelled');
                                  }
                                })();
                              }}
                            >
                              {t('cs.trk.cancel')}
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
        </>
      )}
    </div>
  );
}

// ===== Yeni takip formu =====================================================

interface YeniTakipFormuProps {
  api: ConstructionApi;
  companyId: number;
  projectId: number;
  templates: ReadonlyArray<ProgressTemplateDto>;
  lang?: string | undefined;
  onDone: () => void;
  onError: (msg: string) => void;
  onCancel: () => void;
}

function YeniTakipFormu({
  api,
  companyId,
  projectId,
  templates,
  lang,
  onDone,
  onError,
  onCancel,
}: YeniTakipFormuProps): JSX.Element {
  const [templateId, setTemplateId] = useState<number>(templates[0]?.id ?? 0);
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('100');
  const [plannedStart, setPlannedStart] = useState('');
  const [plannedEnd, setPlannedEnd] = useState('');
  const [candidates, setCandidates] = useState<ReadonlyArray<LocationDto>>([]);
  const [picked, setPicked] = useState<ReadonlySet<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const t = (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>): string =>
    csT(k, lang, vars);

  const template = templates.find((x) => x.id === templateId) ?? null;

  /**
   * Kapsam adayları: şablonun scope'una uyan lokasyon tipleri. Backend
   * `scopeLocationKinds` ile hangi tiplerin geçerli olduğunu söylüyor; burada
   * her tip için ayrı sorgu atıp birleştiriyoruz.
   */
  useEffect(() => {
    if (template === null) {
      setCandidates([]);
      return;
    }
    let off = false;
    const kinds = template.scopeLocationKinds;
    void Promise.all(
      kinds.map((k) => api.listLocations(projectId, companyId, { kind: k as LocationDto['kind'] })),
    )
      .then((results) => {
        if (off) return;
        const merged = results.flatMap((r) => r.locations);
        merged.sort((a, b) => a.path.localeCompare(b.path, 'tr'));
        setCandidates(merged);
        setPicked(new Set());
      })
      .catch((e: unknown) => {
        if (!off) onError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      off = true;
    };
  }, [api, companyId, projectId, template, onError]);

  const submit = async (): Promise<void> => {
    if (templateId === 0 || name.trim() === '' || picked.size === 0) return;
    setBusy(true);
    try {
      await api.createTracking({
        companyId,
        projectId,
        templateId,
        name: name.trim(),
        projectWeightPct: Number(weight.replace(',', '.')) || 0,
        plannedStart: plannedStart === '' ? null : plannedStart,
        plannedEnd: plannedEnd === '' ? null : plannedEnd,
        locationIds: [...picked],
      });
      onDone();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ ...box, background: '#f8fafc' }}>
      <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>{t('cs.trk.new')}</h4>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 10,
        }}
      >
        <div>
          <span style={label}>{t('cs.trk.template')}</span>
          <select
            style={input}
            value={templateId === 0 ? '' : String(templateId)}
            onChange={(e) => setTemplateId(e.target.value === '' ? 0 : Number(e.target.value))}
          >
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name} ({trackScopeLabel(tpl.scope, lang)}, {tpl.itemCount})
              </option>
            ))}
          </select>
        </div>
        <div>
          <span style={label}>{t('cs.common.name')}</span>
          <input style={input} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <span style={label}>{t('cs.trk.projectWeight')}</span>
          <input style={input} value={weight} onChange={(e) => setWeight(e.target.value)} />
        </div>
        <div>
          <span style={label}>{t('cs.trk.plannedStart')}</span>
          <input
            type="date"
            style={input}
            value={plannedStart}
            onChange={(e) => setPlannedStart(e.target.value)}
          />
        </div>
        <div>
          <span style={label}>{t('cs.trk.plannedEnd')}</span>
          <input
            type="date"
            style={input}
            value={plannedEnd}
            onChange={(e) => setPlannedEnd(e.target.value)}
          />
        </div>
      </div>
      <div style={{ ...label, marginTop: 6 }}>{t('cs.trk.projectWeightHint')}</div>

      <div style={{ marginTop: 10 }}>
        <span style={label}>
          {t('cs.trk.scopeLocations')} ({picked.size})
        </span>
        <div style={{ ...label, marginBottom: 4 }}>{t('cs.trk.scopeHint')}</div>
        {candidates.length === 0 ? (
          <div style={{ fontSize: 13, color: '#64748b' }}>{t('cs.common.noRecords')}</div>
        ) : (
          <div
            style={{
              maxHeight: 200,
              overflowY: 'auto',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              background: '#fff',
              padding: 6,
            }}
          >
            {candidates.map((loc) => (
              <label
                key={loc.id}
                style={{
                  display: 'flex',
                  gap: 6,
                  alignItems: 'center',
                  fontSize: 13,
                  padding: '2px 0',
                }}
              >
                <input
                  type="checkbox"
                  checked={picked.has(loc.id)}
                  onChange={(e) => {
                    setPicked((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(loc.id);
                      else next.delete(loc.id);
                      return next;
                    });
                  }}
                />
                {loc.path}
              </label>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
        <button
          type="button"
          style={btnPrimary}
          disabled={busy || name.trim() === '' || picked.size === 0 || templateId === 0}
          onClick={() => void submit()}
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

// ===== Saha ekranı ==========================================================

interface SahaEkraniProps {
  api: ConstructionApi;
  companyId: number;
  trackingId: number;
  lang?: string | undefined;
  confirmAsync?: ((message: string) => Promise<boolean>) | undefined;
  onBack: () => void;
}

/** Bekleyen (kaydedilmemiş) tek satır değişikliği. */
interface PendingEdit {
  state: ItemState;
  overridePct: number | null;
  inspectedAt: string | null;
}

function SahaEkrani({
  api,
  companyId,
  trackingId,
  lang,
  confirmAsync,
  onBack,
}: SahaEkraniProps): JSX.Element {
  const [board, setBoard] = useState<TrackingBoardDto | null>(null);
  const [activeLoc, setActiveLoc] = useState<number>(0);
  const [pending, setPending] = useState<ReadonlyMap<number, PendingEdit>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [historyFor, setHistoryFor] = useState<number>(0);
  const [history, setHistory] = useState<ReadonlyArray<{ id: number; text: string }>>([]);

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
      const res = await api.getTrackingBoard(trackingId, companyId);
      setBoard(res);
      setPending(new Map());
      setActiveLoc((prev) =>
        res.locations.some((l) => l.trackingLocationId === prev)
          ? prev
          : (res.locations[0]?.trackingLocationId ?? 0),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api, companyId, trackingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loc = useMemo(
    () => board?.locations.find((l) => l.trackingLocationId === activeLoc) ?? null,
    [board, activeLoc],
  );

  const editable = board?.tracking.status === 'active';

  const setPendingFor = (
    itemId: number,
    patch: Partial<PendingEdit>,
    current: PendingEdit,
  ): void => {
    setPending((prev) => {
      const next = new Map(prev);
      next.set(itemId, { ...current, ...patch });
      return next;
    });
  };

  const saveAll = async (): Promise<void> => {
    if (pending.size === 0) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await api.setTrackingItemStates(trackingId, {
        companyId,
        updates: [...pending.entries()].map(([trackingItemId, p]) => ({
          trackingItemId,
          state: p.state,
          overridePct: p.overridePct,
          inspectedAt: p.inspectedAt,
        })),
      });
      await load();
      setInfo(t('cs.tpl.bodySaved'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const openHistory = async (itemId: number): Promise<void> => {
    setHistoryFor(itemId);
    setHistory([]);
    try {
      const res = await api.getTrackingItemHistory(itemId, companyId);
      setHistory(
        res.history.map((h) => ({
          id: h.id,
          text: `${h.changedAt.slice(0, 16).replace('T', ' ')} · ${
            h.fromState === null ? '—' : itemStateLabel(h.fromState, lang)
          } → ${itemStateLabel(h.toState, lang)} (%${fmtPct(h.toPct)})`,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const removeLocation = async (): Promise<void> => {
    if (loc === null) return;
    if (!(await confirm(t('cs.trk.removeLocationConfirm', { name: loc.locationPath })))) return;
    setBusy(true);
    try {
      await api.removeTrackingLocation(trackingId, loc.trackingLocationId, companyId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (board === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button type="button" style={btn} onClick={onBack}>
          {t('cs.trk.backToList')}
        </button>
        {error !== null ? (
          <div style={errBox}>{error}</div>
        ) : (
          <div style={box}>{t('cs.common.loading')}</div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" style={btn} onClick={onBack}>
          {t('cs.trk.backToList')}
        </button>
        <strong style={{ fontSize: 16 }}>{board.tracking.name}</strong>
        <span style={{ fontSize: 12, color: '#64748b' }}>
          {board.tracking.code} · {board.templateName} ·{' '}
          {trackingStatusLabel(board.tracking.status, lang)}
        </span>
      </div>

      {/* Takip özeti */}
      <div style={{ ...box, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <span style={label}>{t('cs.trk.progress')}</span>
          <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.1 }}>
            %{fmtPct(board.progressPct)}
          </div>
        </div>
        <div style={{ minWidth: 200, flex: 1 }}>
          <Bar pct={board.progressPct} planned={board.plannedPct} />
        </div>
        <div>
          <span style={label}>{t('cs.trk.planned')}</span>
          <div style={{ fontSize: 14 }}>
            {board.plannedPct === null ? '—' : `%${fmtPct(board.plannedPct)}`}
          </div>
        </div>
        <div>
          <span style={label}>{t('cs.trk.deviation')}</span>
          <div>
            <DeviationCell deviation={board.deviationPct} lang={lang} />
          </div>
        </div>
        <div>
          <span style={label}>{t('cs.trk.projectWeight')}</span>
          <div style={{ fontSize: 14 }}>%{fmtPct(board.tracking.projectWeightPct)}</div>
        </div>
      </div>

      {board.plannedPct === null && (
        <div style={{ ...warnBox, padding: '6px 9px', fontSize: 12 }}>
          {t('cs.trk.noPlanDates')}
        </div>
      )}
      {!editable && (
        <div style={{ ...warnBox, padding: '6px 9px', fontSize: 12 }}>
          {t('cs.board.notActive', { status: trackingStatusLabel(board.tracking.status, lang) })}
        </div>
      )}
      {error !== null && <div style={errBox}>{error}</div>}
      {info !== null && <div style={okBox}>{info}</div>}

      {board.locations.length === 0 ? (
        <div style={{ ...box, color: '#64748b', fontSize: 13 }}>{t('cs.board.emptyScope')}</div>
      ) : (
        <>
          {/* Lokasyon sekmeleri */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {board.locations.map((l) => (
              <button
                key={l.trackingLocationId}
                type="button"
                onClick={() => setActiveLoc(l.trackingLocationId)}
                style={{
                  ...btn,
                  background: l.trackingLocationId === activeLoc ? '#eff6ff' : '#f8fafc',
                  borderColor: l.trackingLocationId === activeLoc ? '#2563eb' : '#cbd5e1',
                  fontWeight: l.trackingLocationId === activeLoc ? 600 : 400,
                }}
              >
                {l.locationName} · %{fmtPct(l.progressPct)}
              </button>
            ))}
          </div>

          {loc !== null && (
            <div style={{ ...box, padding: 0 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  background: '#0f172a',
                  color: '#fff',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{loc.locationPath}</div>
                  <div style={{ fontSize: 11, opacity: 0.8 }}>
                    {loc.itemCount} {t('cs.board.itemCount')} · {loc.completedCount}{' '}
                    {t('cs.board.completedCount')} · {loc.defectCount} {t('cs.board.defectCount')} ·{' '}
                    {loc.inProgressCount} {t('cs.board.inProgressCount')} ·{' '}
                    {t('cs.board.locationWeight')}: {fmtPct(loc.weightPct)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>%{fmtPct(loc.progressPct)}</div>
                  <button
                    type="button"
                    style={btn}
                    disabled={busy}
                    onClick={() => void removeLocation()}
                  >
                    {t('cs.trk.removeLocation')}
                  </button>
                </div>
              </div>

              {/* Bekleyen değişiklikler şeridi */}
              {pending.size > 0 && (
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    padding: '7px 10px',
                    background: '#fffbeb',
                    borderBottom: '1px solid #fcd34d',
                    fontSize: 12,
                    color: '#b45309',
                  }}
                >
                  <span>{t('cs.board.pendingChanges', { n: pending.size })}</span>
                  <button
                    type="button"
                    style={btnPrimary}
                    disabled={busy}
                    onClick={() => void saveAll()}
                  >
                    {busy ? t('cs.common.loading') : t('cs.board.saveChanges')}
                  </button>
                  <button type="button" style={btn} onClick={() => setPending(new Map())}>
                    {t('cs.board.discardChanges')}
                  </button>
                </div>
              )}

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                  <thead>
                    <tr>
                      <th style={th}>{t('cs.board.workGroup')}</th>
                      <th style={{ ...th, textAlign: 'right' }}>{t('cs.board.groupWeight')}</th>
                      <th style={th}>{t('cs.board.work')}</th>
                      <th style={{ ...th, textAlign: 'right' }}>{t('cs.board.itemWeight')}</th>
                      <th style={th}>{t('cs.board.state')}</th>
                      <th style={{ ...th, textAlign: 'right' }}>{t('cs.board.override')}</th>
                      <th style={{ ...th, textAlign: 'right' }}>{t('cs.board.effectivePct')}</th>
                      <th style={th}>{t('cs.board.inspectedAt')}</th>
                      <th style={th} />
                    </tr>
                  </thead>
                  <tbody>
                    {loc.groups.map((g) =>
                      g.items.map((it, idx) => {
                        const p = pending.get(it.trackingItemId);
                        const current: PendingEdit = p ?? {
                          state: it.state,
                          overridePct: it.overridePct,
                          inspectedAt: it.inspectedAt,
                        };
                        const dirty = p !== undefined;
                        return (
                          <tr
                            key={it.trackingItemId}
                            style={{
                              background: dirty ? '#fffbeb' : STATE_TINT[current.state],
                            }}
                          >
                            {idx === 0 ? (
                              <>
                                <td
                                  style={{ ...td, fontWeight: 600, verticalAlign: 'top' }}
                                  rowSpan={g.items.length}
                                >
                                  {g.groupName}
                                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>
                                    %{fmtPct(g.progressPct)}
                                  </div>
                                </td>
                                <td
                                  style={{ ...td, textAlign: 'right', verticalAlign: 'top' }}
                                  rowSpan={g.items.length}
                                >
                                  {fmtPct(g.groupWeight)}
                                </td>
                              </>
                            ) : null}
                            <td style={td}>{it.itemName}</td>
                            <td style={{ ...td, textAlign: 'right' }}>{fmtPct(it.itemWeight)}</td>
                            <td style={td}>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {STATES.map((s) => (
                                  <label
                                    key={s}
                                    style={{
                                      display: 'flex',
                                      gap: 3,
                                      alignItems: 'center',
                                      fontSize: 11,
                                      whiteSpace: 'nowrap',
                                      opacity: editable ? 1 : 0.6,
                                    }}
                                  >
                                    <input
                                      type="radio"
                                      name={`st-${String(it.trackingItemId)}`}
                                      checked={current.state === s}
                                      disabled={!editable}
                                      onChange={() =>
                                        setPendingFor(it.trackingItemId, { state: s }, current)
                                      }
                                    />
                                    {itemStateLabel(s, lang)}
                                  </label>
                                ))}
                              </div>
                            </td>
                            <td style={{ ...td, textAlign: 'right' }}>
                              <input
                                style={{
                                  ...input,
                                  padding: '3px 5px',
                                  width: 62,
                                  textAlign: 'right',
                                }}
                                value={
                                  current.overridePct === null ? '' : String(current.overridePct)
                                }
                                disabled={!editable}
                                title={t('cs.board.overrideHint')}
                                onChange={(e) => {
                                  const v = e.target.value.trim();
                                  const n = v === '' ? null : Number(v.replace(',', '.'));
                                  setPendingFor(
                                    it.trackingItemId,
                                    { overridePct: n !== null && Number.isFinite(n) ? n : null },
                                    current,
                                  );
                                }}
                              />
                            </td>
                            <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>
                              {dirty ? '…' : `%${fmtPct(it.effectivePct)}`}
                            </td>
                            <td style={td}>
                              <input
                                type="date"
                                style={{ ...input, padding: '3px 5px', width: 132 }}
                                value={current.inspectedAt ?? ''}
                                disabled={!editable}
                                onChange={(e) =>
                                  setPendingFor(
                                    it.trackingItemId,
                                    { inspectedAt: e.target.value === '' ? null : e.target.value },
                                    current,
                                  )
                                }
                              />
                              {editable && current.inspectedAt === null && (
                                <button
                                  type="button"
                                  style={{ ...btn, padding: '2px 5px', marginLeft: 4 }}
                                  onClick={() =>
                                    setPendingFor(
                                      it.trackingItemId,
                                      { inspectedAt: todayIso() },
                                      current,
                                    )
                                  }
                                >
                                  ⏱
                                </button>
                              )}
                            </td>
                            <td style={td}>
                              <button
                                type="button"
                                style={{ ...btn, padding: '2px 6px' }}
                                onClick={() => void openHistory(it.trackingItemId)}
                              >
                                {t('cs.board.history')}
                              </button>
                            </td>
                          </tr>
                        );
                      }),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {historyFor > 0 && (
        <div style={box}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <strong style={{ fontSize: 13 }}>{t('cs.board.historyTitle')}</strong>
            <button type="button" style={btn} onClick={() => setHistoryFor(0)}>
              {t('cs.common.close')}
            </button>
          </div>
          {history.length === 0 ? (
            <div style={{ fontSize: 13, color: '#64748b' }}>{t('cs.board.noHistory')}</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#334155' }}>
              {history.map((h) => (
                <li key={h.id}>{h.text}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

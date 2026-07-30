/**
 * KaliteGuvenlikManager — Kalite & Güvenlik ekranı (FAZ 6).
 *
 * Beş sekme: Hasar-Eksiklik · Denetleme · Taşeron Karnesi · RFI · Görevlendirme.
 * Imperium'da bunlar dört ayrı menü; burada tek menü + iç sekme — kalite işi tek
 * kişinin (kalite/İSG mühendisi) masasıdır, ekran arasında gezinmek işi böler.
 *
 * ARAYÜZ KARARLARI:
 * - Durum düğmeleri backend'in `allowedTransitions` listesinden kurulur —
 *   geçersiz geçiş düğmesi hiç görünmez, kullanıcı 400 ile öğrenmez.
 * - Denetim cevap girişi TOPLU kaydeder (tek PUT) ve `live` puanı gösterir;
 *   kritik madde sıfırsa uyarı şeridi puanın yanında durur.
 * - Referans alanları (mekân/taşeron/kişi) şimdilik no girişi — `EntitySelect`
 *   bağlanması Faz 3'teki kararla birlikte ertelendi.
 */
import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

import type {
  AssignmentDto,
  AssignmentSource,
  AssignmentStatus,
  DefectDto,
  DefectHistoryRowDto,
  DefectKind,
  DefectSeverity,
  DefectStatus,
  DefectSummaryRowDto,
  InspectionDto,
  InspectionTemplateDto,
  InspectionTemplateKind,
  ProjectDto,
  QualityPriority,
  RfiDto,
  RfiStatus,
  RfiSummaryDto,
  VendorScorecardRowDto,
} from '../../application/dto/ConstructionDtos';
import type {
  ConstructionApi,
  InspectionAnswerBody,
  InspectionTemplateItemBody,
} from '../../application/ports/ConstructionApi';
import {
  assignmentSourceLabel,
  assignmentStatusLabel,
  csT,
  defectKindLabel,
  defectSeverityLabel,
  defectSourceLabel,
  defectStatusLabel,
  inspectionStatusLabel,
  inspectionTemplateKindLabel,
  qualityPriorityLabel,
  rfiDisciplineLabel,
  rfiStatusLabel,
} from '../../i18n';
import { useProjects } from '../hooks/useProjects';

const DEFECT_KINDS: DefectKind[] = [
  'workmanship',
  'missing_work',
  'material_damage',
  'dimensional',
  'plumbing',
  'electrical',
  'paint',
  'insulation',
  'cleaning',
  'safety',
  'other',
];
const SEVERITIES: DefectSeverity[] = ['very_low', 'low', 'medium', 'high', 'critical'];
const TPL_KINDS: InspectionTemplateKind[] = [
  'quality',
  'subcontractor_scorecard',
  'hse',
  'handover',
  'other',
];
const DISCIPLINES = [
  'architectural',
  'structural',
  'mechanical',
  'electrical',
  'infrastructure',
  'landscape',
  'geotechnical',
  'other',
] as const;
const PRIORITIES: QualityPriority[] = ['low', 'medium', 'high', 'urgent'];
const RFI_STATUSES: RfiStatus[] = ['open', 'answered', 'closed', 'cancelled'];
const ASG_STATUSES: AssignmentStatus[] = ['open', 'in_progress', 'done', 'cancelled'];
const ASG_SOURCES: AssignmentSource[] = ['defect', 'rfi', 'inspection', 'daily_log', 'tracking'];

export interface KaliteGuvenlikManagerProps {
  api: ConstructionApi;
  companyId: number;
  lang?: string | undefined;
  /** Denetim ONAYLAMA yetkisi (karneye işler); backend ayrıca denetler (403). */
  canApprove?: boolean | undefined;
}

// ---- ortak stiller (modüldeki diğer manager'larla aynı dil) ----
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
const warnBox: CSSProperties = {
  ...errBox,
  border: '1px solid #fcd34d',
  background: '#fffbeb',
  color: '#b45309',
};
const th: CSSProperties = {
  padding: '5px 7px',
  fontSize: 11,
  color: '#334155',
  background: '#f8fafc',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid #e2e8f0',
  fontWeight: 600,
};
const td: CSSProperties = {
  padding: '5px 7px',
  fontSize: 12,
  borderTop: '1px solid #f1f5f9',
  textAlign: 'left',
};

const SEV_COLOR: Record<DefectSeverity, string> = {
  very_low: '#94a3b8',
  low: '#0369a1',
  medium: '#b45309',
  high: '#c2410c',
  critical: '#b91c1c',
};
const DSTATUS_COLOR: Record<DefectStatus, string> = {
  open: '#b91c1c',
  in_progress: '#b45309',
  fixed: '#0369a1',
  verified: '#15803d',
  closed: '#64748b',
  rejected: '#94a3b8',
};

const dt = (v: string | null): string => (v === null ? '—' : new Date(v).toLocaleString('tr-TR'));
const num = (v: number | null, digits = 1): string =>
  v === null ? '—' : v.toLocaleString('tr-TR', { maximumFractionDigits: digits });

type QgTab = 'defects' | 'inspections' | 'scorecard' | 'rfi' | 'assignments';

export function KaliteGuvenlikManager({
  api,
  companyId,
  lang,
  canApprove,
}: KaliteGuvenlikManagerProps): JSX.Element {
  const { projects } = useProjects(api, companyId);
  const [projectId, setProjectId] = useState(0);
  const [tab, setTab] = useState<QgTab>('defects');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const t = useCallback(
    (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>) => csT(k, lang, vars),
    [lang],
  );

  const onError = useCallback((e: unknown) => {
    setError(e instanceof Error ? e.message : String(e));
  }, []);
  const flash = useCallback((msg: string) => {
    setError(null);
    setInfo(msg);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <h3 style={{ margin: '0 0 2px', fontSize: 16 }}>{t('cs.qg.title')}</h3>
        <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{t('cs.qg.subtitle')}</p>
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
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
        {(
          [
            ['defects', t('cs.qg.tab.defects')],
            ['inspections', t('cs.qg.tab.inspections')],
            ['scorecard', t('cs.qg.tab.scorecard')],
            ['rfi', t('cs.qg.tab.rfi')],
            ['assignments', t('cs.qg.tab.assignments')],
          ] as [QgTab, string][]
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

      {error !== null && <div style={errBox}>{error}</div>}
      {info !== null && <div style={okBox}>{info}</div>}

      {projectId === 0 ? (
        <div style={{ ...box, color: '#64748b', fontSize: 13 }}>{t('cs.common.selectProject')}</div>
      ) : (
        <>
          {tab === 'defects' && (
            <DefectsPanel
              api={api}
              companyId={companyId}
              projectId={projectId}
              lang={lang}
              onError={onError}
              flash={flash}
            />
          )}
          {tab === 'inspections' && (
            <InspectionsPanel
              api={api}
              companyId={companyId}
              projectId={projectId}
              lang={lang}
              canApprove={canApprove === true}
              onError={onError}
              flash={flash}
            />
          )}
          {tab === 'scorecard' && (
            <ScorecardPanel
              api={api}
              companyId={companyId}
              projectId={projectId}
              lang={lang}
              onError={onError}
            />
          )}
          {tab === 'rfi' && (
            <RfiPanel
              api={api}
              companyId={companyId}
              projectId={projectId}
              lang={lang}
              onError={onError}
              flash={flash}
            />
          )}
          {tab === 'assignments' && (
            <AssignmentsPanel
              api={api}
              companyId={companyId}
              projectId={projectId}
              lang={lang}
              onError={onError}
              flash={flash}
            />
          )}
        </>
      )}
    </div>
  );
}

interface PanelProps {
  api: ConstructionApi;
  companyId: number;
  projectId: number;
  lang: string | undefined;
  onError: (e: unknown) => void;
  flash: (msg: string) => void;
}

// ============================================================================
// HASAR-EKSİKLİK
// ============================================================================

function DefectsPanel({
  api,
  companyId,
  projectId,
  lang,
  onError,
  flash,
}: PanelProps): JSX.Element {
  const t = (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>): string =>
    csT(k, lang, vars);

  const [defects, setDefects] = useState<ReadonlyArray<DefectDto>>([]);
  const [summary, setSummary] = useState<DefectSummaryRowDto | null>(null);
  const [openOnly, setOpenOnly] = useState(true);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [fSeverity, setFSeverity] = useState<DefectSeverity | ''>('');
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<{
    defect: DefectDto;
    history: DefectHistoryRowDto[];
  } | null>(null);
  /** Durum değişimi notu — geçiş düğmesine basılınca sorulur. */
  const [pending, setPending] = useState<{ defect: DefectDto; to: DefectStatus } | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(async (): Promise<void> => {
    try {
      const [list, sum] = await Promise.all([
        api.listDefects(companyId, {
          projectId,
          ...(openOnly ? { openOnly: true } : {}),
          ...(overdueOnly ? { overdueOnly: true } : {}),
          ...(fSeverity === '' ? {} : { severity: fSeverity }),
        }),
        api.getDefectSummary(projectId, companyId),
      ]);
      setDefects(list.defects);
      setSummary(sum.rows[0] ?? null);
    } catch (e) {
      onError(e);
    }
  }, [api, companyId, projectId, openOnly, overdueOnly, fSeverity, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeStatus = async (): Promise<void> => {
    if (pending === null) return;
    try {
      await api.changeDefectStatus(pending.defect.id, {
        companyId,
        status: pending.to,
        note: note.trim() === '' ? null : note.trim(),
      });
      setPending(null);
      setNote('');
      await load();
      flash(t('cs.qg.saved'));
    } catch (e) {
      onError(e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {summary !== null && (
        <div style={{ ...box, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <Metric label={t('cs.qg.def.s.open')} value={String(summary.openCount)} color="#b91c1c" />
          <Metric
            label={t('cs.qg.def.s.awaitingVerify')}
            value={String(summary.awaitingVerify)}
            color="#0369a1"
          />
          <Metric
            label={t('cs.qg.def.s.closedCount')}
            value={String(summary.closedCount)}
            color="#15803d"
          />
          <Metric
            label={t('cs.qg.def.s.critical')}
            value={String(summary.criticalCount)}
            color="#b91c1c"
          />
          <Metric
            label={t('cs.qg.def.s.overdue')}
            value={String(summary.overdueCount)}
            color="#c2410c"
          />
          <Metric
            label={t('cs.qg.def.s.reopened')}
            value={String(summary.reopenedCount)}
            color="#7c3aed"
          />
          <Metric label={t('cs.qg.def.s.avgFix')} value={num(summary.avgFixDays)} color="#334155" />
        </div>
      )}

      <div style={{ ...box, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 150 }}>
          <span style={label}>{t('cs.qg.def.severity')}</span>
          <select
            style={input}
            value={fSeverity}
            onChange={(e) => setFSeverity(e.target.value as DefectSeverity | '')}
          >
            <option value="">{t('cs.qg.filter.all')}</option>
            {SEVERITIES.map((sv) => (
              <option key={sv} value={sv}>
                {defectSeverityLabel(sv, lang)}
              </option>
            ))}
          </select>
        </div>
        <label style={{ fontSize: 12, display: 'flex', gap: 5, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(e) => setOpenOnly(e.target.checked)}
          />
          {t('cs.qg.filter.openOnly')}
        </label>
        <label style={{ fontSize: 12, display: 'flex', gap: 5, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => setOverdueOnly(e.target.checked)}
          />
          {t('cs.qg.filter.overdueOnly')}
        </label>
        <button type="button" style={btn} onClick={() => void load()}>
          {t('cs.common.refresh')}
        </button>
        <button type="button" style={btn} onClick={() => setShowForm((v) => !v)}>
          {showForm ? t('cs.common.close') : t('cs.qg.def.new')}
        </button>
      </div>

      {showForm && (
        <DefectForm
          lang={lang}
          onSubmit={async (body) => {
            try {
              await api.createDefect({ companyId, projectId, ...body });
              setShowForm(false);
              await load();
              flash(t('cs.qg.saved'));
            } catch (e) {
              onError(e);
            }
          }}
        />
      )}

      <div style={{ ...box, padding: 0, overflowX: 'auto' }}>
        {defects.length === 0 ? (
          <div style={{ padding: 12, fontSize: 13, color: '#64748b' }}>{t('cs.qg.def.empty')}</div>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1000 }}>
            <thead>
              <tr>
                <th style={th}>{t('cs.qg.c.code')}</th>
                <th style={th}>{t('cs.qg.c.title')}</th>
                <th style={th}>{t('cs.qg.def.kind')}</th>
                <th style={th}>{t('cs.qg.def.severity')}</th>
                <th style={th}>{t('cs.common.status')}</th>
                <th style={th}>{t('cs.qg.c.vendor')}</th>
                <th style={th}>{t('cs.qg.c.dueDate')}</th>
                <th style={th}>{t('cs.qg.c.overdue')}</th>
                <th style={th}>{t('cs.qg.def.reopen')}</th>
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {defects.map((d) => {
                const late = d.daysOverdue !== null && d.daysOverdue > 0;
                return (
                  <tr key={d.id} style={late ? { background: '#fef2f2' } : undefined}>
                    <td style={{ ...td, fontWeight: 600 }}>{d.code}</td>
                    <td style={{ ...td, whiteSpace: 'normal', minWidth: 180 }}>{d.title}</td>
                    <td style={td}>{defectKindLabel(d.defectKind, lang)}</td>
                    <td style={{ ...td, color: SEV_COLOR[d.severity], fontWeight: 600 }}>
                      {defectSeverityLabel(d.severity, lang)}
                    </td>
                    <td style={{ ...td, color: DSTATUS_COLOR[d.status], fontWeight: 600 }}>
                      {defectStatusLabel(d.status, lang)}
                    </td>
                    <td style={td}>{d.vendorId === null ? '—' : `#${String(d.vendorId)}`}</td>
                    <td style={td}>{d.dueDate ?? '—'}</td>
                    <td style={{ ...td, color: '#b91c1c', fontWeight: 600 }}>
                      {late ? t('cs.qg.days', { n: d.daysOverdue ?? 0 }) : ''}
                    </td>
                    <td style={td}>
                      {d.reopenCount > 0 ? (
                        <span
                          style={{ color: '#7c3aed', fontWeight: 700 }}
                          title={t('cs.qg.def.reopenBadge', { n: d.reopenCount })}
                        >
                          ×{String(d.reopenCount)}
                        </span>
                      ) : (
                        ''
                      )}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {d.allowedTransitions.map((to) => (
                        <button
                          key={to}
                          type="button"
                          style={{ ...btn, marginRight: 4 }}
                          onClick={() => {
                            setPending({ defect: d, to });
                            setNote('');
                          }}
                        >
                          → {defectStatusLabel(to, lang)}
                        </button>
                      ))}
                      <button
                        type="button"
                        style={btn}
                        onClick={() => {
                          void api
                            .getDefect(d.id, companyId)
                            .then(setDetail)
                            .catch((e: unknown) => onError(e));
                        }}
                      >
                        {t('cs.qg.detail')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {pending !== null && (
        <div style={{ ...box, display: 'grid', gap: 8, borderColor: '#93c5fd' }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {pending.defect.code} · {defectStatusLabel(pending.defect.status, lang)} →{' '}
            {defectStatusLabel(pending.to, lang)}
          </div>
          <div>
            <span style={label}>{t('cs.qg.def.statusNote')}</span>
            <textarea
              style={{ ...input, minHeight: 48, resize: 'vertical' }}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" style={btn} onClick={() => setPending(null)}>
              {t('cs.common.cancel')}
            </button>
            <button type="button" style={btnPrimary} onClick={() => void changeStatus()}>
              {t('cs.common.save')}
            </button>
          </div>
        </div>
      )}

      {detail !== null && (
        <div style={{ ...box, display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {detail.defect.code} · {detail.defect.title}
            </div>
            <button type="button" style={btn} onClick={() => setDetail(null)}>
              {t('cs.common.close')}
            </button>
          </div>
          <div style={{ fontSize: 12, color: '#475569' }}>
            {defectSourceLabel(detail.defect.source, lang)} ·{' '}
            {defectKindLabel(detail.defect.defectKind, lang)}
            {detail.defect.description === null ? '' : ` · ${detail.defect.description}`}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              {t('cs.qg.def.history')}
            </div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#334155' }}>
              {detail.history.map((h) => (
                <li key={h.id} style={{ marginBottom: 2 }}>
                  <span style={{ fontWeight: 600 }}>
                    {h.fromStatus === null ? '' : `${defectStatusLabel(h.fromStatus, lang)} → `}
                    {defectStatusLabel(h.toStatus, lang)}
                  </span>
                  {' · '}
                  {h.actor === null ? '—' : t('cs.qg.user', { id: h.actor })}
                  {' · '}
                  <span style={{ color: '#64748b' }}>{dt(h.createdAt)}</span>
                  {h.note === null ? '' : ` · ${h.note}`}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

function DefectForm({
  lang,
  onSubmit,
}: {
  lang: string | undefined;
  onSubmit: (body: {
    title: string;
    defectKind: DefectKind;
    severity: DefectSeverity;
    description?: string | null;
    locationId?: number | null;
    vendorId?: number | null;
    dueDate?: string | null;
    costEstimate?: number;
  }) => Promise<void>;
}): JSX.Element {
  const t = (k: Parameters<typeof csT>[0]): string => csT(k, lang);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<DefectKind>('workmanship');
  const [severity, setSeverity] = useState<DefectSeverity>('medium');
  const [description, setDescription] = useState('');
  const [locationId, setLocationId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [cost, setCost] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  return (
    <div style={{ ...box, display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <span style={label}>{t('cs.qg.c.title')}</span>
          <input style={input} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div style={{ minWidth: 160 }}>
          <span style={label}>{t('cs.qg.def.kind')}</span>
          <select
            style={input}
            value={kind}
            onChange={(e) => setKind(e.target.value as DefectKind)}
          >
            {DEFECT_KINDS.map((k) => (
              <option key={k} value={k}>
                {defectKindLabel(k, lang)}
              </option>
            ))}
          </select>
        </div>
        <div style={{ minWidth: 130 }}>
          <span style={label}>{t('cs.qg.def.severity')}</span>
          <select
            style={input}
            value={severity}
            onChange={(e) => setSeverity(e.target.value as DefectSeverity)}
          >
            {SEVERITIES.map((sv) => (
              <option key={sv} value={sv}>
                {defectSeverityLabel(sv, lang)}
              </option>
            ))}
          </select>
        </div>
        <div style={{ width: 110 }}>
          <span style={label}>{t('cs.qg.c.location')}</span>
          <input style={input} value={locationId} onChange={(e) => setLocationId(e.target.value)} />
        </div>
        <div style={{ width: 110 }}>
          <span style={label}>{t('cs.qg.c.vendor')}</span>
          <input style={input} value={vendorId} onChange={(e) => setVendorId(e.target.value)} />
        </div>
        <div style={{ width: 150 }}>
          <span style={label} title={t('cs.qg.def.dueDateHint')}>
            {t('cs.qg.c.dueDate')}
          </span>
          <input
            type="date"
            style={input}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div style={{ width: 130 }}>
          <span style={label}>{t('cs.qg.def.costEstimate')}</span>
          <input style={input} value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>
      </div>
      <div>
        <span style={label}>{t('cs.qg.c.description')}</span>
        <textarea
          style={{ ...input, minHeight: 48, resize: 'vertical' }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      {localError !== null && <div style={errBox}>{localError}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          style={btnPrimary}
          onClick={() => {
            if (title.trim() === '') {
              setLocalError(t('cs.common.required'));
              return;
            }
            setLocalError(null);
            void onSubmit({
              title: title.trim(),
              defectKind: kind,
              severity,
              description: description.trim() === '' ? null : description.trim(),
              locationId: locationId.trim() === '' ? null : Number(locationId),
              vendorId: vendorId.trim() === '' ? null : Number(vendorId),
              dueDate: dueDate === '' ? null : dueDate,
              ...(cost.trim() === '' ? {} : { costEstimate: Number(cost.replace(',', '.')) }),
            });
          }}
        >
          {t('cs.common.save')}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// DENETLEME
// ============================================================================

function InspectionsPanel({
  api,
  companyId,
  projectId,
  lang,
  canApprove,
  onError,
  flash,
}: PanelProps & { canApprove: boolean }): JSX.Element {
  const t = (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>): string =>
    csT(k, lang, vars);

  const [templates, setTemplates] = useState<ReadonlyArray<InspectionTemplateDto>>([]);
  const [inspections, setInspections] = useState<ReadonlyArray<InspectionDto>>([]);
  const [selected, setSelected] = useState<InspectionDto | null>(null);
  const [showTplForm, setShowTplForm] = useState(false);
  const [showStart, setShowStart] = useState(false);
  /** Yerelde düzenlenen cevaplar (itemId → {score,isNa,note}); tek PUT ile gider. */
  const [draft, setDraft] = useState<ReadonlyMap<number, InspectionAnswerBody>>(new Map());

  const load = useCallback(async (): Promise<void> => {
    try {
      const [tpls, list] = await Promise.all([
        api.listInspectionTemplates(companyId),
        api.listInspections(companyId, { projectId }),
      ]);
      setTemplates(tpls.templates);
      setInspections(list.inspections);
    } catch (e) {
      onError(e);
    }
  }, [api, companyId, projectId, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const openInspection = async (id: number): Promise<void> => {
    try {
      setSelected(await api.getInspection(id, companyId));
      setDraft(new Map());
    } catch (e) {
      onError(e);
    }
  };

  const saveAnswers = async (): Promise<void> => {
    if (selected === null || draft.size === 0) return;
    try {
      const updated = await api.saveInspectionAnswers(selected.id, {
        companyId,
        answers: [...draft.values()],
      });
      setSelected(updated);
      setDraft(new Map());
      await load();
      flash(t('cs.qg.saved'));
    } catch (e) {
      onError(e);
    }
  };

  const changeStatus = async (status: InspectionDto['status']): Promise<void> => {
    if (selected === null) return;
    try {
      const updated = await api.changeInspectionStatus(selected.id, { companyId, status });
      setSelected(updated);
      await load();
      flash(t('cs.qg.saved'));
    } catch (e) {
      onError(e);
    }
  };

  const raiseDefect = async (itemId: number): Promise<void> => {
    if (selected === null) return;
    try {
      const res = await api.raiseDefectFromAnswer(selected.id, itemId, {
        companyId,
        defectKind: 'workmanship',
      });
      setSelected(res.inspection);
      flash(t('cs.qg.ins.defectLinked', { code: res.defect.code }));
    } catch (e) {
      onError(e);
    }
  };

  const live = selected?.live ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ ...box, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          {t('cs.qg.ins.templates')} ({templates.length})
        </div>
        <button type="button" style={btn} onClick={() => setShowTplForm((v) => !v)}>
          {showTplForm ? t('cs.common.close') : t('cs.qg.ins.newTemplate')}
        </button>
        <button type="button" style={btn} onClick={() => setShowStart((v) => !v)}>
          {showStart ? t('cs.common.close') : t('cs.qg.ins.new')}
        </button>
        <button type="button" style={btn} onClick={() => void load()}>
          {t('cs.common.refresh')}
        </button>
      </div>

      {showTplForm && (
        <TemplateForm
          lang={lang}
          onSubmit={async (body) => {
            try {
              await api.createInspectionTemplate({ companyId, ...body });
              setShowTplForm(false);
              await load();
              flash(t('cs.qg.saved'));
            } catch (e) {
              onError(e);
            }
          }}
        />
      )}

      {showStart && (
        <StartInspectionForm
          lang={lang}
          templates={templates}
          onSubmit={async (body) => {
            try {
              const created = await api.startInspection({ companyId, projectId, ...body });
              setShowStart(false);
              await load();
              setSelected(created);
              setDraft(new Map());
              flash(t('cs.qg.saved'));
            } catch (e) {
              onError(e);
            }
          }}
        />
      )}

      <div style={{ ...box, padding: 0, overflowX: 'auto' }}>
        {inspections.length === 0 ? (
          <div style={{ padding: 12, fontSize: 13, color: '#64748b' }}>{t('cs.qg.ins.empty')}</div>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 860 }}>
            <thead>
              <tr>
                <th style={th}>{t('cs.qg.c.code')}</th>
                <th style={th}>{t('cs.qg.ins.template')}</th>
                <th style={th}>{t('cs.qg.ins.date')}</th>
                <th style={th}>{t('cs.qg.c.vendor')}</th>
                <th style={th}>{t('cs.common.status')}</th>
                <th style={th}>{t('cs.qg.ins.score')}</th>
                <th style={th}>{t('cs.qg.ins.grade')}</th>
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {inspections.map((i) => (
                <tr
                  key={i.id}
                  style={selected?.id === i.id ? { background: '#eff6ff' } : undefined}
                >
                  <td style={{ ...td, fontWeight: 600 }}>{i.code}</td>
                  <td style={td}>
                    {templates.find((x) => x.id === i.templateId)?.name ??
                      `#${String(i.templateId)}`}
                  </td>
                  <td style={td}>{i.inspectionDate}</td>
                  <td style={td}>{i.vendorId === null ? '—' : `#${String(i.vendorId)}`}</td>
                  <td style={td}>{inspectionStatusLabel(i.status, lang)}</td>
                  <td style={{ ...td, fontWeight: 600 }}>
                    {i.scorePct === null ? t('cs.qg.ins.notMeasured') : `%${num(i.scorePct)}`}
                  </td>
                  <td
                    style={{
                      ...td,
                      fontWeight: 700,
                      color: i.passed === null ? '#94a3b8' : i.passed ? '#15803d' : '#b91c1c',
                    }}
                  >
                    {i.grade ?? '—'}
                    {i.passed === null
                      ? ''
                      : i.passed
                        ? ` · ${t('cs.qg.ins.passed')}`
                        : ` · ${t('cs.qg.ins.failed')}`}
                  </td>
                  <td style={td}>
                    <button type="button" style={btn} onClick={() => void openInspection(i.id)}>
                      {t('cs.qg.detail')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected !== null && (
        <div style={{ ...box, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>
              {selected.code} · {inspectionStatusLabel(selected.status, lang)}
            </div>
            {live !== null && (
              <>
                <Metric
                  label={t('cs.qg.ins.score')}
                  value={
                    live.scorePct === null ? t('cs.qg.ins.notMeasured') : `%${num(live.scorePct)}`
                  }
                  color={live.passed === null ? '#94a3b8' : live.passed ? '#15803d' : '#b91c1c'}
                />
                <Metric label={t('cs.qg.ins.grade')} value={live.grade ?? '—'} color="#334155" />
              </>
            )}
            {selected.editable && draft.size > 0 && (
              <button type="button" style={btnPrimary} onClick={() => void saveAnswers()}>
                {t('cs.qg.ins.saveAnswers')} ({String(draft.size)})
              </button>
            )}
            {selected.status === 'draft' && (
              <button type="button" style={btn} onClick={() => void changeStatus('completed')}>
                {t('cs.qg.ins.complete')}
              </button>
            )}
            {selected.status === 'completed' && (
              <>
                <button type="button" style={btn} onClick={() => void changeStatus('draft')}>
                  {t('cs.qg.ins.backToDraft')}
                </button>
                {canApprove && (
                  <button
                    type="button"
                    style={{ ...btnPrimary, background: '#16a34a', borderColor: '#16a34a' }}
                    title={t('cs.qg.ins.approveWarn')}
                    onClick={() => void changeStatus('approved')}
                  >
                    {t('cs.qg.ins.approve')}
                  </button>
                )}
              </>
            )}
            <button type="button" style={btn} onClick={() => setSelected(null)}>
              {t('cs.common.close')}
            </button>
          </div>

          {live !== null && live.criticalFailures > 0 && (
            <div style={warnBox}>{t('cs.qg.ins.criticalFail', { n: live.criticalFailures })}</div>
          )}
          {live !== null && live.unansweredCount > 0 && (
            <div style={{ fontSize: 12, color: '#64748b' }}>
              {t('cs.qg.ins.unanswered', { n: live.unansweredCount })}
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={th}>{t('cs.qg.ins.itemText')}</th>
                  <th style={th}>{t('cs.qg.ins.weight')}</th>
                  <th style={th}>{t('cs.qg.ins.score')}</th>
                  <th style={th} title={t('cs.qg.ins.naHint')}>
                    {t('cs.qg.ins.na')}
                  </th>
                  <th style={th}>{t('cs.qg.c.note')}</th>
                  <th style={th} />
                </tr>
              </thead>
              <tbody>
                {selected.answers.map((a) => {
                  const d = draft.get(a.itemId);
                  const isNa = d?.isNa ?? a.isNa;
                  const score = d?.score !== undefined ? d.score : a.score;
                  const setDraftFor = (patch: Partial<InspectionAnswerBody>): void => {
                    setDraft((prev) => {
                      const next = new Map(prev);
                      next.set(a.itemId, {
                        itemId: a.itemId,
                        score,
                        isNa,
                        note: d?.note ?? a.note,
                        ...patch,
                      });
                      return next;
                    });
                  };
                  return (
                    <tr key={a.id} style={isNa ? { opacity: 0.55 } : undefined}>
                      <td style={{ ...td, whiteSpace: 'normal', minWidth: 220 }}>
                        {a.isCritical ? (
                          <span
                            style={{ color: '#b91c1c', fontWeight: 700 }}
                            title={t('cs.qg.ins.criticalHint')}
                          >
                            ⚠{' '}
                          </span>
                        ) : null}
                        {a.itemText}
                      </td>
                      <td style={td}>{num(a.weight)}</td>
                      <td style={td}>
                        <input
                          style={{ ...input, width: 64, padding: '2px 4px', textAlign: 'right' }}
                          disabled={!selected.editable || isNa}
                          value={score === null ? '' : String(score)}
                          title={`0-${String(a.maxScore)}`}
                          onChange={(e) => {
                            const v = e.target.value.trim();
                            setDraftFor({ score: v === '' ? null : Number(v.replace(',', '.')) });
                          }}
                        />
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>
                          {' '}
                          / {num(a.maxScore, 0)}
                        </span>
                      </td>
                      <td style={td}>
                        <input
                          type="checkbox"
                          disabled={!selected.editable}
                          checked={isNa}
                          onChange={(e) => setDraftFor({ isNa: e.target.checked, score: null })}
                        />
                      </td>
                      <td style={td}>
                        <input
                          style={{ ...input, padding: '2px 4px', minWidth: 140 }}
                          disabled={!selected.editable}
                          value={d?.note ?? a.note ?? ''}
                          onChange={(e) =>
                            setDraftFor({ note: e.target.value === '' ? null : e.target.value })
                          }
                        />
                      </td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        {a.defectId !== null ? (
                          <span style={{ fontSize: 11, color: '#b45309', fontWeight: 600 }}>
                            {t('cs.qg.ins.defectLinked', { code: `#${String(a.defectId)}` })}
                          </span>
                        ) : (
                          <button
                            type="button"
                            style={btn}
                            onClick={() => void raiseDefect(a.itemId)}
                          >
                            {t('cs.qg.ins.raiseDefect')}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateForm({
  lang,
  onSubmit,
}: {
  lang: string | undefined;
  onSubmit: (body: {
    code: string;
    name: string;
    kind: InspectionTemplateKind;
    passPct: number;
    items: InspectionTemplateItemBody[];
  }) => Promise<void>;
}): JSX.Element {
  const t = (k: Parameters<typeof csT>[0]): string => csT(k, lang);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<InspectionTemplateKind>('quality');
  const [passPct, setPassPct] = useState('70');
  const [rows, setRows] = useState<
    { code: string; text: string; weight: string; isCritical: boolean }[]
  >([{ code: 'M1', text: '', weight: '1', isCritical: false }]);
  const [localError, setLocalError] = useState<string | null>(null);

  return (
    <div style={{ ...box, display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ width: 130 }}>
          <span style={label}>{t('cs.qg.c.code')}</span>
          <input style={input} value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <span style={label}>{t('cs.common.name')}</span>
          <input style={input} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div style={{ minWidth: 190 }}>
          <span style={label}>{t('cs.qg.ins.templateKind')}</span>
          <select
            style={input}
            value={kind}
            onChange={(e) => setKind(e.target.value as InspectionTemplateKind)}
          >
            {TPL_KINDS.map((k) => (
              <option key={k} value={k}>
                {inspectionTemplateKindLabel(k, lang)}
              </option>
            ))}
          </select>
        </div>
        <div style={{ width: 120 }}>
          <span style={label}>{t('cs.qg.ins.passPct')}</span>
          <input style={input} value={passPct} onChange={(e) => setPassPct(e.target.value)} />
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 600 }}>{t('cs.qg.ins.items')}</div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ width: 80 }}>
            <span style={label}>{t('cs.qg.c.code')}</span>
            <input
              style={input}
              value={r.code}
              onChange={(e) =>
                setRows((p) => p.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)))
              }
            />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <span style={label}>{t('cs.qg.ins.itemText')}</span>
            <input
              style={input}
              value={r.text}
              onChange={(e) =>
                setRows((p) => p.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
              }
            />
          </div>
          <div style={{ width: 80 }}>
            <span style={label}>{t('cs.qg.ins.weight')}</span>
            <input
              style={input}
              value={r.weight}
              onChange={(e) =>
                setRows((p) => p.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)))
              }
            />
          </div>
          <label style={{ fontSize: 12, display: 'flex', gap: 5, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={r.isCritical}
              onChange={(e) =>
                setRows((p) =>
                  p.map((x, j) => (j === i ? { ...x, isCritical: e.target.checked } : x)),
                )
              }
            />
            <span title={t('cs.qg.ins.criticalHint')}>{t('cs.qg.ins.critical')}</span>
          </label>
          {rows.length > 1 && (
            <button
              type="button"
              style={btn}
              onClick={() => setRows((p) => p.filter((_, j) => j !== i))}
            >
              {t('cs.common.delete')}
            </button>
          )}
        </div>
      ))}
      <div>
        <button
          type="button"
          style={btn}
          onClick={() =>
            setRows((p) => [
              ...p,
              { code: `M${String(p.length + 1)}`, text: '', weight: '1', isCritical: false },
            ])
          }
        >
          {t('cs.qg.ins.addItem')}
        </button>
      </div>

      {localError !== null && <div style={errBox}>{localError}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          style={btnPrimary}
          onClick={() => {
            const items = rows
              .filter((r) => r.text.trim() !== '')
              .map((r, i) => ({
                code: r.code.trim() || `M${String(i + 1)}`,
                text: r.text.trim(),
                weight: Number(r.weight.replace(',', '.')) || 1,
                isCritical: r.isCritical,
                sortOrder: i,
              }));
            if (code.trim() === '' || name.trim() === '' || items.length === 0) {
              setLocalError(t('cs.common.required'));
              return;
            }
            setLocalError(null);
            void onSubmit({
              code: code.trim(),
              name: name.trim(),
              kind,
              passPct: Number(passPct.replace(',', '.')) || 70,
              items,
            });
          }}
        >
          {t('cs.common.save')}
        </button>
      </div>
    </div>
  );
}

function StartInspectionForm({
  lang,
  templates,
  onSubmit,
}: {
  lang: string | undefined;
  templates: ReadonlyArray<InspectionTemplateDto>;
  onSubmit: (body: {
    templateId: number;
    inspectionDate: string;
    vendorId?: number | null;
    locationId?: number | null;
    periodLabel?: string | null;
  }) => Promise<void>;
}): JSX.Element {
  const t = (k: Parameters<typeof csT>[0]): string => csT(k, lang);
  const [templateId, setTemplateId] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [vendorId, setVendorId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [period, setPeriod] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const tpl = templates.find((x) => x.id === templateId) ?? null;

  return (
    <div style={{ ...box, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div style={{ minWidth: 220 }}>
        <span style={label}>{t('cs.qg.ins.template')}</span>
        <select
          style={input}
          value={templateId === 0 ? '' : String(templateId)}
          onChange={(e) => setTemplateId(e.target.value === '' ? 0 : Number(e.target.value))}
        >
          <option value="">—</option>
          {templates.map((x) => (
            <option key={x.id} value={x.id}>
              {x.code} · {x.name}
            </option>
          ))}
        </select>
      </div>
      <div style={{ width: 150 }}>
        <span style={label}>{t('cs.qg.ins.date')}</span>
        <input type="date" style={input} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div style={{ width: 110 }}>
        <span style={label}>
          {t('cs.qg.c.vendor')}
          {tpl?.requiresVendor === true ? ' *' : ''}
        </span>
        <input style={input} value={vendorId} onChange={(e) => setVendorId(e.target.value)} />
      </div>
      <div style={{ width: 110 }}>
        <span style={label}>{t('cs.qg.c.location')}</span>
        <input style={input} value={locationId} onChange={(e) => setLocationId(e.target.value)} />
      </div>
      <div style={{ width: 120 }}>
        <span style={label}>{t('cs.qg.ins.period')}</span>
        <input style={input} value={period} onChange={(e) => setPeriod(e.target.value)} />
      </div>
      <button
        type="button"
        style={btnPrimary}
        onClick={() => {
          if (templateId === 0 || date === '') {
            setLocalError(t('cs.common.required'));
            return;
          }
          if (tpl?.requiresVendor === true && vendorId.trim() === '') {
            setLocalError(t('cs.qg.ins.vendorRequired'));
            return;
          }
          setLocalError(null);
          void onSubmit({
            templateId,
            inspectionDate: date,
            vendorId: vendorId.trim() === '' ? null : Number(vendorId),
            locationId: locationId.trim() === '' ? null : Number(locationId),
            periodLabel: period.trim() === '' ? null : period.trim(),
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
// TAŞERON KARNESİ
// ============================================================================

function ScorecardPanel({
  api,
  companyId,
  projectId,
  lang,
  onError,
}: Omit<PanelProps, 'flash'>): JSX.Element {
  const t = (k: Parameters<typeof csT>[0]): string => csT(k, lang);
  const [rows, setRows] = useState<ReadonlyArray<VendorScorecardRowDto>>([]);

  useEffect(() => {
    let off = false;
    api
      .getVendorScorecard(companyId, { projectId })
      .then((r) => {
        if (!off) setRows(r.rows);
      })
      .catch((e: unknown) => {
        if (!off) onError(e);
      });
    return () => {
      off = true;
    };
  }, [api, companyId, projectId, onError]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{t('cs.qg.sc.subtitle')}</p>
      <div style={{ ...box, padding: 0, overflowX: 'auto' }}>
        {rows.length === 0 ? (
          <div style={{ padding: 12, fontSize: 13, color: '#64748b' }}>{t('cs.qg.sc.empty')}</div>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1000 }}>
            <thead>
              <tr>
                <th style={th}>{t('cs.qg.c.vendor')}</th>
                <th style={th}>{t('cs.qg.sc.inspections')}</th>
                <th style={th}>{t('cs.qg.sc.avgScore')}</th>
                <th style={th}>{t('cs.qg.sc.minScore')}</th>
                <th style={th}>{t('cs.qg.sc.failed')}</th>
                <th style={th}>{t('cs.qg.sc.defects')}</th>
                <th style={th}>{t('cs.qg.sc.open')}</th>
                <th style={th}>{t('cs.qg.def.s.overdue')}</th>
                <th style={th}>{t('cs.qg.sc.severe')}</th>
                <th style={th}>{t('cs.qg.def.reopen')}</th>
                <th style={th}>{t('cs.qg.def.s.avgFix')}</th>
                <th style={th}>{t('cs.qg.sc.lastInspection')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${String(r.vendorId)}-${String(r.projectId)}`}>
                  <td style={{ ...td, fontWeight: 600 }}>
                    {r.vendorName ?? `#${String(r.vendorId)}`}
                  </td>
                  <td style={td}>{String(r.inspectionCount)}</td>
                  <td
                    style={{
                      ...td,
                      fontWeight: 700,
                      color:
                        r.avgScorePct === null
                          ? '#94a3b8'
                          : r.avgScorePct >= 70
                            ? '#15803d'
                            : '#b91c1c',
                    }}
                  >
                    {r.avgScorePct === null ? '—' : `%${num(r.avgScorePct)}`}
                  </td>
                  <td style={td}>{r.minScorePct === null ? '—' : `%${num(r.minScorePct)}`}</td>
                  <td style={{ ...td, color: r.failedInspectionCount > 0 ? '#b91c1c' : undefined }}>
                    {String(r.failedInspectionCount)}
                  </td>
                  <td style={td}>{String(r.defectCount)}</td>
                  <td style={td}>{String(r.defectOpen)}</td>
                  <td style={{ ...td, color: r.defectOverdue > 0 ? '#b91c1c' : undefined }}>
                    {String(r.defectOverdue)}
                  </td>
                  <td style={td}>{String(r.defectSevere)}</td>
                  <td style={{ ...td, color: r.reopenTotal > 0 ? '#7c3aed' : undefined }}>
                    {String(r.reopenTotal)}
                  </td>
                  <td style={td}>{num(r.avgFixDays)}</td>
                  <td style={td}>{r.lastInspectionDate ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// RFI
// ============================================================================

function RfiPanel({ api, companyId, projectId, lang, onError, flash }: PanelProps): JSX.Element {
  const t = (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>): string =>
    csT(k, lang, vars);

  const [rfis, setRfis] = useState<ReadonlyArray<RfiDto>>([]);
  const [summary, setSummary] = useState<RfiSummaryDto | null>(null);
  const [fStatus, setFStatus] = useState<RfiStatus | ''>('open');
  const [showForm, setShowForm] = useState(false);
  const [answering, setAnswering] = useState<RfiDto | null>(null);
  const [answer, setAnswer] = useState('');

  const load = useCallback(async (): Promise<void> => {
    try {
      const [list, sum] = await Promise.all([
        api.listRfis(companyId, { projectId, ...(fStatus === '' ? {} : { status: fStatus }) }),
        api.getRfiSummary(projectId, companyId),
      ]);
      setRfis(list.rfis);
      setSummary(sum);
    } catch (e) {
      onError(e);
    }
  }, [api, companyId, projectId, fStatus, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitAnswer = async (): Promise<void> => {
    if (answering === null || answer.trim() === '') return;
    try {
      await api.answerRfi(answering.id, { companyId, answer: answer.trim() });
      setAnswering(null);
      setAnswer('');
      await load();
      flash(t('cs.qg.saved'));
    } catch (e) {
      onError(e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {summary !== null && (
        <div style={{ ...box, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <Metric label={t('cs.qg.rs.open')} value={String(summary.openCount)} color="#b91c1c" />
          <Metric
            label={t('cs.qg.rs.answered')}
            value={String(summary.answeredCount)}
            color="#15803d"
          />
          <Metric
            label={t('cs.qg.def.s.overdue')}
            value={String(summary.overdueCount)}
            color="#c2410c"
          />
          <Metric
            label={t('cs.qg.rfi.s.oldestOpen')}
            value={summary.oldestOpenDays === null ? '—' : String(summary.oldestOpenDays)}
            color="#334155"
          />
          <Metric
            label={t('cs.qg.rfi.s.avgAnswer')}
            value={num(summary.avgAnswerDays)}
            color="#334155"
          />
          <Metric
            label={t('cs.qg.rfi.s.impactTotal')}
            value={t('cs.qg.days', { n: summary.impactDaysTotal })}
            color="#7c3aed"
            hint={t('cs.qg.rfi.impactHint')}
          />
        </div>
      )}

      <div style={{ ...box, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 150 }}>
          <span style={label}>{t('cs.common.status')}</span>
          <select
            style={input}
            value={fStatus}
            onChange={(e) => setFStatus(e.target.value as RfiStatus | '')}
          >
            <option value="">{t('cs.qg.filter.all')}</option>
            {RFI_STATUSES.map((st) => (
              <option key={st} value={st}>
                {rfiStatusLabel(st, lang)}
              </option>
            ))}
          </select>
        </div>
        <button type="button" style={btn} onClick={() => void load()}>
          {t('cs.common.refresh')}
        </button>
        <button type="button" style={btn} onClick={() => setShowForm((v) => !v)}>
          {showForm ? t('cs.common.close') : t('cs.qg.rfi.new')}
        </button>
      </div>

      {showForm && (
        <RfiForm
          lang={lang}
          onSubmit={async (body) => {
            try {
              await api.createRfi({ companyId, projectId, ...body });
              setShowForm(false);
              await load();
              flash(t('cs.qg.saved'));
            } catch (e) {
              onError(e);
            }
          }}
        />
      )}

      <div style={{ ...box, padding: 0, overflowX: 'auto' }}>
        {rfis.length === 0 ? (
          <div style={{ padding: 12, fontSize: 13, color: '#64748b' }}>{t('cs.qg.rfi.empty')}</div>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 980 }}>
            <thead>
              <tr>
                <th style={th}>{t('cs.qg.c.code')}</th>
                <th style={th}>{t('cs.qg.rfi.subject')}</th>
                <th style={th}>{t('cs.qg.rfi.discipline')}</th>
                <th style={th}>{t('cs.qg.c.priority')}</th>
                <th style={th}>{t('cs.common.status')}</th>
                <th style={th}>{t('cs.qg.rfi.age')}</th>
                <th style={th}>{t('cs.qg.c.overdue')}</th>
                <th style={th}>{t('cs.qg.rfi.impactDays')}</th>
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {rfis.map((r) => {
                const late = r.daysOverdue !== null && r.daysOverdue > 0;
                return (
                  <tr key={r.id} style={late ? { background: '#fef2f2' } : undefined}>
                    <td style={{ ...td, fontWeight: 600 }}>{r.code}</td>
                    <td style={{ ...td, whiteSpace: 'normal', minWidth: 180 }} title={r.question}>
                      {r.subject}
                    </td>
                    <td style={td}>{rfiDisciplineLabel(r.discipline, lang)}</td>
                    <td style={td}>{qualityPriorityLabel(r.priority, lang)}</td>
                    <td style={td}>{rfiStatusLabel(r.status, lang)}</td>
                    <td style={td}>{t('cs.qg.days', { n: r.ageDays })}</td>
                    <td style={{ ...td, color: '#b91c1c', fontWeight: 600 }}>
                      {late ? t('cs.qg.days', { n: r.daysOverdue ?? 0 }) : ''}
                    </td>
                    <td style={td}>
                      {r.impactDays > 0 ? t('cs.qg.days', { n: r.impactDays }) : ''}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {r.status === 'open' && (
                        <button
                          type="button"
                          style={{ ...btnPrimary, marginRight: 4 }}
                          onClick={() => {
                            setAnswering(r);
                            setAnswer('');
                          }}
                        >
                          {t('cs.qg.rfi.writeAnswer')}
                        </button>
                      )}
                      {r.status === 'answered' && (
                        <>
                          <button
                            type="button"
                            style={{ ...btn, marginRight: 4 }}
                            title={r.answer ?? ''}
                            onClick={() =>
                              void api
                                .changeRfiStatus(r.id, { companyId, status: 'closed' })
                                .then(load)
                                .catch((e: unknown) => onError(e))
                            }
                          >
                            → {rfiStatusLabel('closed', lang)}
                          </button>
                          <button
                            type="button"
                            style={{ ...btn, marginRight: 4 }}
                            onClick={() =>
                              void api
                                .changeRfiStatus(r.id, { companyId, status: 'open' })
                                .then(load)
                                .catch((e: unknown) => onError(e))
                            }
                          >
                            → {rfiStatusLabel('open', lang)}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {answering !== null && (
        <div style={{ ...box, display: 'grid', gap: 8, borderColor: '#93c5fd' }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {answering.code} · {answering.subject}
          </div>
          <div style={{ fontSize: 12, color: '#475569' }}>{answering.question}</div>
          <div>
            <span style={label}>{t('cs.qg.rfi.answer')}</span>
            <textarea
              style={{ ...input, minHeight: 64, resize: 'vertical' }}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" style={btn} onClick={() => setAnswering(null)}>
              {t('cs.common.cancel')}
            </button>
            <button
              type="button"
              style={btnPrimary}
              onClick={() => {
                if (answer.trim() === '') {
                  onError(new Error(t('cs.qg.rfi.answerRequired')));
                  return;
                }
                void submitAnswer();
              }}
            >
              {t('cs.common.save')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RfiForm({
  lang,
  onSubmit,
}: {
  lang: string | undefined;
  onSubmit: (body: {
    subject: string;
    question: string;
    discipline: (typeof DISCIPLINES)[number];
    priority: QualityPriority;
    dueDate?: string | null;
    impactDays?: number;
    askedToUserId?: number | null;
  }) => Promise<void>;
}): JSX.Element {
  const t = (k: Parameters<typeof csT>[0]): string => csT(k, lang);
  const [subject, setSubject] = useState('');
  const [question, setQuestion] = useState('');
  const [discipline, setDiscipline] = useState<(typeof DISCIPLINES)[number]>('architectural');
  const [priority, setPriority] = useState<QualityPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [impactDays, setImpactDays] = useState('');
  const [askedTo, setAskedTo] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  return (
    <div style={{ ...box, display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <span style={label}>{t('cs.qg.rfi.subject')}</span>
          <input style={input} value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div style={{ minWidth: 150 }}>
          <span style={label}>{t('cs.qg.rfi.discipline')}</span>
          <select
            style={input}
            value={discipline}
            onChange={(e) => setDiscipline(e.target.value as (typeof DISCIPLINES)[number])}
          >
            {DISCIPLINES.map((d) => (
              <option key={d} value={d}>
                {rfiDisciplineLabel(d, lang)}
              </option>
            ))}
          </select>
        </div>
        <div style={{ minWidth: 120 }}>
          <span style={label}>{t('cs.qg.c.priority')}</span>
          <select
            style={input}
            value={priority}
            onChange={(e) => setPriority(e.target.value as QualityPriority)}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {qualityPriorityLabel(p, lang)}
              </option>
            ))}
          </select>
        </div>
        <div style={{ width: 150 }}>
          <span style={label}>{t('cs.qg.c.dueDate')}</span>
          <input
            type="date"
            style={input}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div style={{ width: 120 }}>
          <span style={label} title={t('cs.qg.rfi.impactHint')}>
            {t('cs.qg.rfi.impactDays')}
          </span>
          <input style={input} value={impactDays} onChange={(e) => setImpactDays(e.target.value)} />
        </div>
        <div style={{ width: 120 }}>
          <span style={label}>{t('cs.qg.rfi.askedTo')}</span>
          <input style={input} value={askedTo} onChange={(e) => setAskedTo(e.target.value)} />
        </div>
      </div>
      <div>
        <span style={label}>{t('cs.qg.rfi.question')}</span>
        <textarea
          style={{ ...input, minHeight: 56, resize: 'vertical' }}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
      </div>
      {localError !== null && <div style={errBox}>{localError}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          style={btnPrimary}
          onClick={() => {
            if (subject.trim() === '' || question.trim() === '') {
              setLocalError(t('cs.common.required'));
              return;
            }
            setLocalError(null);
            void onSubmit({
              subject: subject.trim(),
              question: question.trim(),
              discipline,
              priority,
              dueDate: dueDate === '' ? null : dueDate,
              ...(impactDays.trim() === '' ? {} : { impactDays: Number(impactDays) }),
              askedToUserId: askedTo.trim() === '' ? null : Number(askedTo),
            });
          }}
        >
          {t('cs.common.save')}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// GÖREVLENDİRME
// ============================================================================

function AssignmentsPanel({
  api,
  companyId,
  projectId,
  lang,
  onError,
  flash,
}: PanelProps): JSX.Element {
  const t = (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>): string =>
    csT(k, lang, vars);

  const [assignments, setAssignments] = useState<ReadonlyArray<AssignmentDto>>([]);
  const [openOnly, setOpenOnly] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    try {
      const res = await api.listAssignments(companyId, {
        projectId,
        ...(openOnly ? { openOnly: true } : {}),
      });
      setAssignments(res.assignments);
    } catch (e) {
      onError(e);
    }
  }, [api, companyId, projectId, openOnly, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (id: number, status: AssignmentStatus): Promise<void> => {
    try {
      await api.changeAssignmentStatus(id, { companyId, status });
      await load();
      flash(t('cs.qg.saved'));
    } catch (e) {
      onError(e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ ...box, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, display: 'flex', gap: 5, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(e) => setOpenOnly(e.target.checked)}
          />
          {t('cs.qg.filter.openOnly')}
        </label>
        <button type="button" style={btn} onClick={() => void load()}>
          {t('cs.common.refresh')}
        </button>
        <button type="button" style={btn} onClick={() => setShowForm((v) => !v)}>
          {showForm ? t('cs.common.close') : t('cs.qg.asg.new')}
        </button>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{t('cs.qg.asg.sourceHint')}</span>
      </div>

      {showForm && (
        <AssignmentForm
          lang={lang}
          onSubmit={async (body) => {
            try {
              await api.createAssignment({ companyId, projectId, ...body });
              setShowForm(false);
              await load();
              flash(t('cs.qg.saved'));
            } catch (e) {
              onError(e);
            }
          }}
        />
      )}

      <div style={{ ...box, padding: 0, overflowX: 'auto' }}>
        {assignments.length === 0 ? (
          <div style={{ padding: 12, fontSize: 13, color: '#64748b' }}>{t('cs.qg.asg.empty')}</div>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 960 }}>
            <thead>
              <tr>
                <th style={th}>{t('cs.qg.c.code')}</th>
                <th style={th}>{t('cs.qg.c.title')}</th>
                <th style={th}>{t('cs.qg.asg.assignedTo')}</th>
                <th style={th}>{t('cs.qg.c.priority')}</th>
                <th style={th}>{t('cs.common.status')}</th>
                <th style={th}>{t('cs.qg.asg.progress')}</th>
                <th style={th}>{t('cs.qg.c.dueDate')}</th>
                <th style={th}>{t('cs.qg.c.overdue')}</th>
                <th style={th}>{t('cs.qg.asg.source')}</th>
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => {
                const late = a.daysOverdue !== null && a.daysOverdue > 0;
                return (
                  <tr key={a.id} style={late ? { background: '#fef2f2' } : undefined}>
                    <td style={{ ...td, fontWeight: 600 }}>{a.code}</td>
                    <td style={{ ...td, whiteSpace: 'normal', minWidth: 180 }}>{a.title}</td>
                    <td style={td}>
                      {a.assignedToUserId === null
                        ? '—'
                        : t('cs.qg.user', { id: a.assignedToUserId })}
                    </td>
                    <td style={td}>{qualityPriorityLabel(a.priority, lang)}</td>
                    <td style={td}>{assignmentStatusLabel(a.status, lang)}</td>
                    <td style={{ ...td, fontWeight: 600 }} title={t('cs.qg.asg.done100')}>
                      %{num(a.progressPct, 0)}
                    </td>
                    <td style={td}>{a.dueDate ?? '—'}</td>
                    <td style={{ ...td, color: '#b91c1c', fontWeight: 600 }}>
                      {late ? t('cs.qg.days', { n: a.daysOverdue ?? 0 }) : ''}
                    </td>
                    <td style={td}>
                      {a.sourceKind === null
                        ? '—'
                        : `${assignmentSourceLabel(a.sourceKind, lang)} #${String(a.sourceId ?? 0)}`}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {ASG_STATUSES.filter(
                        (st) =>
                          st !== a.status &&
                          // geçiş kuralları backend'de; arayüz mantıklı olanları sunar
                          !(a.status === 'done' && (st === 'open' || st === 'cancelled')) &&
                          !(a.status === 'cancelled' && st !== 'open'),
                      ).map((st) => (
                        <button
                          key={st}
                          type="button"
                          style={{ ...btn, marginRight: 4 }}
                          onClick={() => void setStatus(a.id, st)}
                        >
                          → {assignmentStatusLabel(st, lang)}
                        </button>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function AssignmentForm({
  lang,
  onSubmit,
}: {
  lang: string | undefined;
  onSubmit: (body: {
    title: string;
    assignedToUserId?: number | null;
    priority: QualityPriority;
    dueDate?: string | null;
    sourceKind?: AssignmentSource | null;
    sourceId?: number | null;
  }) => Promise<void>;
}): JSX.Element {
  const t = (k: Parameters<typeof csT>[0]): string => csT(k, lang);
  const [title, setTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [priority, setPriority] = useState<QualityPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [sourceKind, setSourceKind] = useState<AssignmentSource | ''>('');
  const [sourceId, setSourceId] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  return (
    <div style={{ ...box, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 220 }}>
        <span style={label}>{t('cs.qg.c.title')}</span>
        <input style={input} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div style={{ width: 110 }}>
        <span style={label}>{t('cs.qg.asg.assignedTo')}</span>
        <input style={input} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} />
      </div>
      <div style={{ minWidth: 120 }}>
        <span style={label}>{t('cs.qg.c.priority')}</span>
        <select
          style={input}
          value={priority}
          onChange={(e) => setPriority(e.target.value as QualityPriority)}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {qualityPriorityLabel(p, lang)}
            </option>
          ))}
        </select>
      </div>
      <div style={{ width: 150 }}>
        <span style={label}>{t('cs.qg.c.dueDate')}</span>
        <input
          type="date"
          style={input}
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>
      <div style={{ minWidth: 150 }}>
        <span style={label}>{t('cs.qg.asg.source')}</span>
        <select
          style={input}
          value={sourceKind}
          onChange={(e) => setSourceKind(e.target.value as AssignmentSource | '')}
        >
          <option value="">—</option>
          {ASG_SOURCES.map((sk) => (
            <option key={sk} value={sk}>
              {assignmentSourceLabel(sk, lang)}
            </option>
          ))}
        </select>
      </div>
      <div style={{ width: 100 }}>
        <span style={label}>#</span>
        <input style={input} value={sourceId} onChange={(e) => setSourceId(e.target.value)} />
      </div>
      <button
        type="button"
        style={btnPrimary}
        onClick={() => {
          if (title.trim() === '') {
            setLocalError(t('cs.common.required'));
            return;
          }
          setLocalError(null);
          void onSubmit({
            title: title.trim(),
            assignedToUserId: assignedTo.trim() === '' ? null : Number(assignedTo),
            priority,
            dueDate: dueDate === '' ? null : dueDate,
            sourceKind: sourceKind === '' ? null : sourceKind,
            sourceId: sourceId.trim() === '' ? null : Number(sourceId),
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
  hint,
}: {
  label: string;
  value: string;
  color: string;
  hint?: string;
}): JSX.Element {
  return (
    <div>
      <span style={label} {...(hint === undefined ? {} : { title: hint })}>
        {lbl}
      </span>
      <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.1, color }}>{value}</div>
    </div>
  );
}

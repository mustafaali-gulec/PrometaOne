/**
 * TakipSablonManager — İlerleme Takip Şablonları (FAZ 2, şirket katmanı).
 *
 * Şablon = ölçüm cetveli: İş Grubu (İ.G. Oran) → İş (İ. Oran). Ağırlıklar
 * gruplarda ve grup içi işlerde %100'e tümlenmelidir; arayüz bunu ZORLAMAZ,
 * canlı uyarı gösterir (kaydı bloke etmek ara adımlarda veri girişini işkenceye
 * çevirir; rollup zaten ağırlık toplamına normalize eder).
 *
 * Gövde kaydı TAM-DEĞİŞTİRMEdir ve şablonu kullanan takiplerin girilmiş saha
 * tiklerini siler — bu yüzden kaydetmeden önce kaç takibin etkileneceği okunup
 * kullanıcıya açık onay sorulur.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';

import type { ProgressTemplateDto, TrackScope } from '../../application/dto/ConstructionDtos';
import type { ConstructionApi, TemplateBodyPayload } from '../../application/ports/ConstructionApi';
import { csT, trackScopeLabel } from '../../i18n';

export interface TakipSablonManagerProps {
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

const SCOPES: TrackScope[] = ['general', 'block', 'floor', 'unit'];

/** Düzenlenebilir gövde — ağırlıklar metin olarak tutulur (yazarken 0'a düşmesin). */
interface EditItem {
  code: string;
  name: string;
  weight: string;
}
interface EditGroup {
  code: string;
  name: string;
  weight: string;
  items: EditItem[];
}

const numOr0 = (s: string): number => {
  const n = Number(s.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const fmtPct = (n: number): string =>
  n.toLocaleString('tr-TR', { maximumFractionDigits: 2, minimumFractionDigits: 0 });

function toEditBody(tpl: ProgressTemplateDto): EditGroup[] {
  return tpl.groups.map((g) => ({
    code: g.code,
    name: g.name,
    weight: String(g.weightPct),
    items: g.items.map((i) => ({ code: i.code, name: i.name, weight: String(i.weightPct) })),
  }));
}

export function TakipSablonManager({
  api,
  companyId,
  lang,
  confirmAsync,
}: TakipSablonManagerProps): JSX.Element {
  const [templates, setTemplates] = useState<ReadonlyArray<ProgressTemplateDto>>([]);
  const [selectedId, setSelectedId] = useState<number>(0);
  const [body, setBody] = useState<EditGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);

  // Yeni şablon formu
  const [nName, setNName] = useState('');
  const [nScope, setNScope] = useState<TrackScope>('block');
  const [nInProgress, setNInProgress] = useState('50');
  const [nHasDefects, setNHasDefects] = useState('75');

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
      const res = await api.listProgressTemplates(companyId);
      setTemplates(res.templates);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api, companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => templates.find((x) => x.id === selectedId) ?? null,
    [templates, selectedId],
  );

  // Şablon seçimi değişince düzenleme gövdesini tazele
  useEffect(() => {
    setBody(selected ? toEditBody(selected) : []);
    setInfo(null);
  }, [selected]);

  const groupSum = body.reduce((s, g) => s + numOr0(g.weight), 0);
  const groupSumOk = body.length === 0 || Math.abs(groupSum - 100) < 0.005;

  const createTemplate = async (): Promise<void> => {
    if (nName.trim() === '') return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.createProgressTemplate({
        companyId,
        name: nName.trim(),
        scope: nScope,
        pctInProgress: numOr0(nInProgress),
        pctHasDefects: numOr0(nHasDefects),
      });
      setShowNew(false);
      setNName('');
      await load();
      setSelectedId(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveBody = async (): Promise<void> => {
    if (!selected) return;
    // Etkilenecek takip sayısı ekranda zaten okunuyor; yine de kaydetme anında
    // taze değeri almak için sunucudan tekrar sorulur (başka kullanıcı takip
    // eklemiş olabilir).
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const payload: TemplateBodyPayload = {
        groups: body.map((g, gi) => ({
          code: g.code.trim() === '' ? `G${String(gi + 1)}` : g.code.trim(),
          name: g.name.trim() === '' ? `Grup ${String(gi + 1)}` : g.name.trim(),
          weightPct: numOr0(g.weight),
          sortOrder: gi,
          items: g.items.map((i, ii) => ({
            code: i.code.trim() === '' ? `I${String(ii + 1)}` : i.code.trim(),
            name: i.name.trim() === '' ? `İş ${String(ii + 1)}` : i.name.trim(),
            weightPct: numOr0(i.weight),
            sortOrder: ii,
          })),
        })),
      };

      const affected = await api.listTrackings(companyId, { includeCancelled: false });
      const usingCount = affected.trackings.filter((x) => x.templateId === selected.id).length;
      if (usingCount > 0) {
        if (!(await confirm(t('cs.tpl.affectedWarn', { n: usingCount })))) {
          setBusy(false);
          return;
        }
      }

      const res = await api.saveTemplateBody(selected.id, { companyId, ...payload });
      await load();
      setInfo(
        res.affectedTrackings > 0
          ? `${t('cs.tpl.bodySaved')} ${t('cs.tpl.affected', { n: res.affectedTrackings })}`
          : t('cs.tpl.bodySaved'),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const setGroup = (gi: number, patch: Partial<EditGroup>): void => {
    setBody((prev) => prev.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  };
  const setItem = (gi: number, ii: number, patch: Partial<EditItem>): void => {
    setBody((prev) =>
      prev.map((g, i) =>
        i === gi
          ? { ...g, items: g.items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) }
          : g,
      ),
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <h3 style={{ margin: '0 0 2px', fontSize: 16 }}>{t('cs.tpl.title')}</h3>
        <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{t('cs.tpl.subtitle')}</p>
      </div>

      {error !== null && <div style={errBox}>{error}</div>}
      {info !== null && <div style={okBox}>{info}</div>}

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Sol: şablon listesi */}
        <div style={{ ...box, minWidth: 280, flex: '0 0 300px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>{t('cs.tpl.title')}</strong>
            <button type="button" style={btn} onClick={() => setShowNew((v) => !v)}>
              + {t('cs.tpl.new')}
            </button>
          </div>

          {showNew && (
            <div style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
              <div>
                <span style={label}>{t('cs.common.name')}</span>
                <input style={input} value={nName} onChange={(e) => setNName(e.target.value)} />
              </div>
              <div>
                <span style={label}>{t('cs.tpl.scope')}</span>
                <select
                  style={input}
                  value={nScope}
                  onChange={(e) => setNScope(e.target.value as TrackScope)}
                >
                  {SCOPES.map((s) => (
                    <option key={s} value={s}>
                      {trackScopeLabel(s, lang)}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ flex: 1 }}>
                  <span style={label}>{t('cs.tpl.pctInProgress')}</span>
                  <input
                    style={input}
                    value={nInProgress}
                    onChange={(e) => setNInProgress(e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={label}>{t('cs.tpl.pctHasDefects')}</span>
                  <input
                    style={input}
                    value={nHasDefects}
                    onChange={(e) => setNHasDefects(e.target.value)}
                  />
                </div>
              </div>
              <span style={label}>{t('cs.tpl.pctHint')}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  style={btnPrimary}
                  disabled={busy || nName.trim() === ''}
                  onClick={() => void createTemplate()}
                >
                  {t('cs.common.save')}
                </button>
                <button type="button" style={btn} onClick={() => setShowNew(false)}>
                  {t('cs.common.cancel')}
                </button>
              </div>
            </div>
          )}

          {templates.length === 0 ? (
            <div style={{ fontSize: 13, color: '#64748b' }}>{t('cs.common.noRecords')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setSelectedId(tpl.id)}
                  style={{
                    ...btn,
                    textAlign: 'left',
                    background: tpl.id === selectedId ? '#eff6ff' : '#fff',
                    borderColor: tpl.id === selectedId ? '#2563eb' : '#e2e8f0',
                    padding: '7px 9px',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{tpl.name}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {tpl.code} · {trackScopeLabel(tpl.scope, lang)} · {tpl.itemCount}{' '}
                    {t('cs.tpl.itemCount')}
                    {tpl.weightIssues.length > 0 && <span style={{ color: '#b45309' }}> · ⚠</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sağ: gövde editörü */}
        <div style={{ ...box, flex: 1, minWidth: 460 }}>
          {selected === null ? (
            <div style={{ fontSize: 13, color: '#64748b' }}>{t('cs.tpl.selectHint')}</div>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 8,
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div>
                  <strong style={{ fontSize: 14 }}>{selected.name}</strong>
                  <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>
                    {selected.code} · {trackScopeLabel(selected.scope, lang)} ·{' '}
                    {t('cs.tpl.pctInProgress')} %{fmtPct(selected.pctInProgress)} ·{' '}
                    {t('cs.tpl.pctHasDefects')} %{fmtPct(selected.pctHasDefects)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    style={btn}
                    onClick={() =>
                      setBody((prev) => [...prev, { code: '', name: '', weight: '0', items: [] }])
                    }
                  >
                    + {t('cs.tpl.addGroup')}
                  </button>
                  <button
                    type="button"
                    style={btnPrimary}
                    disabled={busy}
                    onClick={() => void saveBody()}
                  >
                    {busy ? t('cs.common.loading') : t('cs.tpl.saveBody')}
                  </button>
                </div>
              </div>

              {/* Ağırlık tutarlılığı — canlı, kaydı bloke etmez */}
              <div style={{ marginBottom: 10 }}>
                {!groupSumOk ? (
                  <div style={warnBox}>
                    {t('cs.tpl.weightWarnTemplate', { sum: fmtPct(groupSum) })}
                  </div>
                ) : (
                  body.length > 0 && (
                    <div style={{ ...okBox, padding: '5px 8px', fontSize: 12 }}>
                      {t('cs.tpl.weightOk')}
                    </div>
                  )
                )}
              </div>

              {body.length === 0 ? (
                <div style={{ fontSize: 13, color: '#64748b' }}>{t('cs.common.noRecords')}</div>
              ) : (
                body.map((g, gi) => {
                  const itemSum = g.items.reduce((s, i) => s + numOr0(i.weight), 0);
                  const itemSumOk = g.items.length === 0 || Math.abs(itemSum - 100) < 0.005;
                  return (
                    <div
                      key={gi}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: 6,
                        marginBottom: 8,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          gap: 6,
                          alignItems: 'flex-end',
                          padding: '8px 10px',
                          background: '#f1f5f9',
                        }}
                      >
                        <div style={{ width: 80 }}>
                          <span style={label}>{t('cs.common.code')}</span>
                          <input
                            style={input}
                            value={g.code}
                            onChange={(e) => setGroup(gi, { code: e.target.value })}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={label}>{t('cs.tpl.group')}</span>
                          <input
                            style={input}
                            value={g.name}
                            onChange={(e) => setGroup(gi, { name: e.target.value })}
                          />
                        </div>
                        <div style={{ width: 110 }}>
                          <span style={label}>{t('cs.tpl.groupWeight')}</span>
                          <input
                            style={input}
                            value={g.weight}
                            onChange={(e) => setGroup(gi, { weight: e.target.value })}
                          />
                        </div>
                        <button
                          type="button"
                          style={btn}
                          onClick={() =>
                            setGroup(gi, {
                              items: [...g.items, { code: '', name: '', weight: '0' }],
                            })
                          }
                        >
                          + {t('cs.tpl.addItem')}
                        </button>
                        <button
                          type="button"
                          style={btn}
                          onClick={() => setBody((prev) => prev.filter((_, i) => i !== gi))}
                        >
                          {t('cs.common.delete')}
                        </button>
                      </div>

                      {!itemSumOk && (
                        <div
                          style={{
                            ...warnBox,
                            margin: '6px 10px',
                            padding: '5px 8px',
                            fontSize: 12,
                          }}
                        >
                          {t('cs.tpl.weightWarnGroup', {
                            group: g.name === '' ? g.code : g.name,
                            sum: fmtPct(itemSum),
                          })}
                        </div>
                      )}

                      {g.items.length === 0 ? (
                        <div style={{ padding: '8px 10px', fontSize: 12, color: '#64748b' }}>
                          {t('cs.common.noRecords')}
                        </div>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', color: '#475569' }}>
                              <th style={{ textAlign: 'left', padding: '4px 8px', width: 80 }}>
                                {t('cs.common.code')}
                              </th>
                              <th style={{ textAlign: 'left', padding: '4px 8px' }}>
                                {t('cs.board.work')}
                              </th>
                              <th style={{ textAlign: 'right', padding: '4px 8px', width: 110 }}>
                                {t('cs.tpl.itemWeight')}
                              </th>
                              <th style={{ width: 60 }} />
                            </tr>
                          </thead>
                          <tbody>
                            {g.items.map((it, ii) => (
                              <tr key={ii} style={{ borderTop: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '3px 8px' }}>
                                  <input
                                    style={{ ...input, padding: '4px 6px' }}
                                    value={it.code}
                                    onChange={(e) => setItem(gi, ii, { code: e.target.value })}
                                  />
                                </td>
                                <td style={{ padding: '3px 8px' }}>
                                  <input
                                    style={{ ...input, padding: '4px 6px' }}
                                    value={it.name}
                                    onChange={(e) => setItem(gi, ii, { name: e.target.value })}
                                  />
                                </td>
                                <td style={{ padding: '3px 8px' }}>
                                  <input
                                    style={{ ...input, padding: '4px 6px', textAlign: 'right' }}
                                    value={it.weight}
                                    onChange={(e) => setItem(gi, ii, { weight: e.target.value })}
                                  />
                                </td>
                                <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                                  <button
                                    type="button"
                                    style={{ ...btn, padding: '2px 6px' }}
                                    onClick={() =>
                                      setGroup(gi, { items: g.items.filter((_, j) => j !== ii) })
                                    }
                                  >
                                    ×
                                  </button>
                                </td>
                              </tr>
                            ))}
                            <tr style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                              <td colSpan={2} style={{ padding: '4px 8px', color: '#475569' }}>
                                {t('cs.common.total')}
                              </td>
                              <td
                                style={{
                                  padding: '4px 8px',
                                  textAlign: 'right',
                                  fontWeight: 700,
                                  color: itemSumOk ? '#15803d' : '#b45309',
                                }}
                              >
                                %{fmtPct(itemSum)}
                              </td>
                              <td />
                            </tr>
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

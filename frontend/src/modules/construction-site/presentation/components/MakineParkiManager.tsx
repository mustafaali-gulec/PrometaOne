/**
 * MakineParkiManager — Makine Parkı ekranı (FAZ 9).
 *
 * Sol: makine listesi (sayaç, sahiplik, garanti/kiralama/bakım rozetleri).
 * Sağ: seçili makinenin kartı — detay düzenleme, sayaç okuma, bakım planları
 * (vadeleriyle) ve bakım kayıtları.
 *
 * ROZET DİLİ: vade geçmiş bakım KIRMIZI sayı, garanti bitmiş KIRMIZI etiket,
 * kira süresi ≤30 gün TURUNCU. "İlk bakım kaydı bekleniyor" ayrı gösterilir —
 * vadesi hesaplanamayan planı "vadesi yok" gibi göstermek kör nokta yaratır.
 *
 * SAYAÇ PANELİ: geriye gidiş normal akışta reddedilir; "sayaç değişti" kutusu
 * işaretlenirse not zorunlu olur ve panel bunu görünür kılar — backend kuralının
 * (MeterRollbackError) arayüzdeki karşılığı, kullanıcı 400 ile öğrenmesin.
 *
 * Makine OLUŞTURMA burada yok: makineler İş Gücü & Makine (SF-6) ekranında
 * açılır; park ekranı zenginleştirme katmanıdır. Boş liste bunu söyler.
 */
import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

import type {
  MachineMaintenanceDto,
  MachineParkDto,
  MaintenanceIntervalType,
  MeterType,
  RentalPeriod,
} from '../../application/dto/ConstructionDtos';
import type {
  ConstructionApi,
  UpdateMachineParkBody,
} from '../../application/ports/ConstructionApi';
import { csT, machineOwnershipLabel, maintenanceIntervalLabel, meterTypeLabel } from '../../i18n';

export interface MakineParkiManagerProps {
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

const num = (v: number, digits = 1): string =>
  v.toLocaleString('tr-TR', { maximumFractionDigits: digits });

export function MakineParkiManager({
  api,
  companyId,
  lang,
  confirmAsync,
}: MakineParkiManagerProps): JSX.Element {
  const [machines, setMachines] = useState<ReadonlyArray<MachineParkDto>>([]);
  const [selected, setSelected] = useState<MachineMaintenanceDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

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
    try {
      const res = await api.listMachinePark(companyId);
      setMachines(res.machines);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api, companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openMachine = async (id: number): Promise<void> => {
    try {
      setSelected(await api.getMachineMaintenance(id, companyId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const refreshSelected = async (): Promise<void> => {
    await load();
    if (selected !== null) {
      setSelected(await api.getMachineMaintenance(selected.machine.id, companyId));
    }
  };

  const flash = (msg: string): void => {
    setError(null);
    setInfo(msg);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <h3 style={{ margin: '0 0 2px', fontSize: 16 }}>{t('cs.mp.title')}</h3>
        <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{t('cs.mp.subtitle')}</p>
      </div>

      {error !== null && <div style={errBox}>{error}</div>}
      {info !== null && <div style={okBox}>{info}</div>}

      <div style={{ ...box, padding: 0, overflowX: 'auto' }}>
        {machines.length === 0 ? (
          <div style={{ padding: 12, fontSize: 13, color: '#64748b' }}>{t('cs.mp.empty')}</div>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1000 }}>
            <thead>
              <tr>
                <th style={th}>{t('cs.mp.c.machine')}</th>
                <th style={th}>{t('cs.mp.c.ownership')}</th>
                <th style={th}>{t('cs.mp.c.plate')}</th>
                <th style={th}>{t('cs.mp.c.brand')}</th>
                <th style={{ ...th, textAlign: 'right' }}>{t('cs.mp.c.meter')}</th>
                <th style={th}>{t('cs.mp.c.warranty')}</th>
                <th style={th}>{t('cs.mp.c.rental')}</th>
                <th style={th}>{t('cs.mp.c.maintenance')}</th>
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {machines.map((m) => (
                <tr
                  key={m.id}
                  style={selected?.machine.id === m.id ? { background: '#eff6ff' } : undefined}
                >
                  <td style={{ ...td, fontWeight: 600 }}>
                    {m.code} · {m.name}
                    {m.model !== null ? (
                      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400 }}>
                        {m.brand ?? ''} {m.model}
                        {m.modelYear !== null ? ` · ${String(m.modelYear)}` : ''}
                      </div>
                    ) : null}
                  </td>
                  <td style={td}>{machineOwnershipLabel(m.kind, lang)}</td>
                  <td style={td}>{m.plateNo ?? '—'}</td>
                  <td style={td}>{m.brand ?? '—'}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>
                    {num(m.currentMeter)} {meterTypeLabel(m.meterType, lang)}
                  </td>
                  <td style={td}>
                    <WarrantyBadge machine={m} lang={lang} />
                  </td>
                  <td style={td}>
                    <RentalBadge machine={m} lang={lang} />
                  </td>
                  <td style={td}>
                    {m.overduePlanCount > 0 ? (
                      <span style={{ color: '#b91c1c', fontWeight: 700 }}>
                        {t('cs.mp.plan.overdue')} ×{String(m.overduePlanCount)}
                      </span>
                    ) : m.plansWithoutBaseline > 0 ? (
                      <span style={{ color: '#7c3aed', fontSize: 11 }}>
                        {t('cs.mp.plan.noBaseline')}
                      </span>
                    ) : (
                      ''
                    )}
                  </td>
                  <td style={td}>
                    <button type="button" style={btn} onClick={() => void openMachine(m.id)}>
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
        <MachineCard
          data={selected}
          lang={lang}
          onClose={() => setSelected(null)}
          onError={(e) => setError(e instanceof Error ? e.message : String(e))}
          onSaved={async () => {
            await refreshSelected();
            flash(t('cs.qg.saved'));
          }}
          api={api}
          companyId={companyId}
          confirm={confirm}
        />
      )}
    </div>
  );
}

function WarrantyBadge({
  machine,
  lang,
}: {
  machine: MachineParkDto;
  lang: string | undefined;
}): JSX.Element {
  const t = (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>): string =>
    csT(k, lang, vars);
  const w = machine.warranty;
  if (w.inWarranty === null) {
    return <span style={{ color: '#94a3b8', fontSize: 11 }}>{t('cs.mp.warranty.none')}</span>;
  }
  if (!w.inWarranty) {
    return <span style={{ color: '#b91c1c', fontWeight: 600 }}>{t('cs.mp.warranty.out')}</span>;
  }
  const parts: string[] = [];
  if (w.daysLeft !== null) parts.push(t('cs.mp.warranty.daysLeft', { n: w.daysLeft }));
  if (w.meterLeft !== null)
    parts.push(
      t('cs.mp.warranty.meterLeft', {
        n: num(w.meterLeft),
        unit: meterTypeLabel(machine.meterType, lang),
      }),
    );
  return (
    <span style={{ color: '#15803d', fontWeight: 600 }} title={parts.join(' · ')}>
      {t('cs.mp.warranty.in')}
      <span style={{ fontSize: 10, display: 'block', color: '#64748b', fontWeight: 400 }}>
        {parts.join(' · ')}
      </span>
    </span>
  );
}

function RentalBadge({
  machine,
  lang,
}: {
  machine: MachineParkDto;
  lang: string | undefined;
}): JSX.Element {
  const t = (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>): string =>
    csT(k, lang, vars);
  if (machine.rentalDaysLeft === null) return <span>—</span>;
  if (machine.rentalDaysLeft < 0) {
    return <span style={{ color: '#b91c1c', fontWeight: 600 }}>{t('cs.mp.rentalExpired')}</span>;
  }
  return (
    <span style={{ color: machine.rentalDaysLeft <= 30 ? '#c2410c' : '#334155' }}>
      {t('cs.mp.rentalDaysLeft', { n: machine.rentalDaysLeft })}
    </span>
  );
}

// ============================================================================
// MAKİNE KARTI
// ============================================================================

function MachineCard({
  data,
  lang,
  api,
  companyId,
  confirm,
  onClose,
  onError,
  onSaved,
}: {
  data: MachineMaintenanceDto;
  lang: string | undefined;
  api: ConstructionApi;
  companyId: number;
  confirm: (msg: string) => Promise<boolean>;
  onClose: () => void;
  onError: (e: unknown) => void;
  onSaved: () => Promise<void>;
}): JSX.Element {
  const t = (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>): string =>
    csT(k, lang, vars);
  const m = data.machine;
  const unit = meterTypeLabel(m.meterType, lang);

  return (
    <div style={{ ...box, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>
          {m.code} · {m.name} — {num(m.currentMeter)} {unit}
        </div>
        <button type="button" style={btn} onClick={onClose}>
          {t('cs.common.close')}
        </button>
      </div>

      <DetailsForm
        machine={m}
        lang={lang}
        onSubmit={async (body) => {
          try {
            await api.updateMachineParkDetails(m.id, { companyId, ...body });
            await onSaved();
          } catch (e) {
            onError(e);
          }
        }}
      />

      <MeterPanel
        machine={m}
        lang={lang}
        log={data.meterLog}
        onSubmit={async (body) => {
          try {
            await api.recordMeterReading(m.id, { companyId, ...body });
            await onSaved();
          } catch (e) {
            onError(e);
          }
        }}
      />

      <MaintenancePanel
        data={data}
        lang={lang}
        unit={unit}
        onCreatePlan={async (body) => {
          try {
            await api.createMaintenancePlan(m.id, { companyId, ...body });
            await onSaved();
          } catch (e) {
            onError(e);
          }
        }}
        onDeletePlan={async (planId) => {
          if (!(await confirm(t('cs.mp.plan.deleteConfirm')))) return;
          try {
            await api.deactivateMaintenancePlan(planId, companyId);
            await onSaved();
          } catch (e) {
            onError(e);
          }
        }}
        onAddRecord={async (body) => {
          try {
            await api.addMaintenanceRecord(m.id, { companyId, ...body });
            await onSaved();
          } catch (e) {
            onError(e);
          }
        }}
      />
    </div>
  );
}

// ---- Detay formu -----------------------------------------------------------

function DetailsForm({
  machine,
  lang,
  onSubmit,
}: {
  machine: MachineParkDto;
  lang: string | undefined;
  onSubmit: (body: Omit<UpdateMachineParkBody, 'companyId'>) => Promise<void>;
}): JSX.Element {
  const t = (k: Parameters<typeof csT>[0]): string => csT(k, lang);
  const [brand, setBrand] = useState(machine.brand ?? '');
  const [model, setModel] = useState(machine.model ?? '');
  const [modelYear, setModelYear] = useState(
    machine.modelYear === null ? '' : String(machine.modelYear),
  );
  const [plateNo, setPlateNo] = useState(machine.plateNo ?? '');
  const [chassisNo, setChassisNo] = useState(machine.chassisNo ?? '');
  const [engineNo, setEngineNo] = useState(machine.engineNo ?? '');
  const [meterType, setMeterType] = useState<MeterType>(machine.meterType);
  const [rentalStart, setRentalStart] = useState(machine.rentalStart ?? '');
  const [rentalEnd, setRentalEnd] = useState(machine.rentalEnd ?? '');
  const [rentalCost, setRentalCost] = useState(
    machine.rentalCost > 0 ? String(machine.rentalCost) : '',
  );
  const [rentalPeriod, setRentalPeriod] = useState<RentalPeriod | ''>(machine.rentalPeriod ?? '');
  const [warrantyUntil, setWarrantyUntil] = useState(machine.warrantyUntil ?? '');
  const [warrantyMeter, setWarrantyMeter] = useState(
    machine.warrantyMeter === null ? '' : String(machine.warrantyMeter),
  );

  const METER_TYPES: MeterType[] = ['hour', 'km'];
  const PERIODS: RentalPeriod[] = ['daily', 'monthly'];

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{t('cs.mp.detailsPanel')}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Field label={t('cs.mp.c.brand')} value={brand} onChange={setBrand} w={130} />
        <Field label={t('cs.mp.c.model')} value={model} onChange={setModel} w={130} />
        <Field label={t('cs.mp.c.modelYear')} value={modelYear} onChange={setModelYear} w={90} />
        <Field label={t('cs.mp.c.plate')} value={plateNo} onChange={setPlateNo} w={110} />
        <Field label={t('cs.mp.c.chassis')} value={chassisNo} onChange={setChassisNo} w={140} />
        <Field label={t('cs.mp.c.engine')} value={engineNo} onChange={setEngineNo} w={120} />
        <div style={{ width: 110 }}>
          <span style={label}>{t('cs.mp.c.meterType')}</span>
          <select
            style={input}
            value={meterType}
            onChange={(e) => setMeterType(e.target.value as MeterType)}
          >
            {METER_TYPES.map((mt) => (
              <option key={mt} value={mt}>
                {meterTypeLabel(mt, lang)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ width: 150 }}>
          <span style={label}>{t('cs.mp.rentalStart')}</span>
          <input
            type="date"
            style={input}
            value={rentalStart}
            onChange={(e) => setRentalStart(e.target.value)}
          />
        </div>
        <div style={{ width: 150 }}>
          <span style={label}>{t('cs.mp.rentalEnd')}</span>
          <input
            type="date"
            style={input}
            value={rentalEnd}
            onChange={(e) => setRentalEnd(e.target.value)}
          />
        </div>
        <Field label={t('cs.mp.rentalCost')} value={rentalCost} onChange={setRentalCost} w={120} />
        <div style={{ width: 110 }}>
          <span style={label}>{t('cs.mp.c.rental')}</span>
          <select
            style={input}
            value={rentalPeriod}
            onChange={(e) => setRentalPeriod(e.target.value as RentalPeriod | '')}
          >
            <option value="">—</option>
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {csT(`cs.mp.rp.${p}`, lang)}
              </option>
            ))}
          </select>
        </div>
        <div style={{ width: 150 }}>
          <span style={label} title={t('cs.mp.warrantyHint')}>
            {t('cs.mp.warrantyUntil')}
          </span>
          <input
            type="date"
            style={input}
            value={warrantyUntil}
            onChange={(e) => setWarrantyUntil(e.target.value)}
          />
        </div>
        <Field
          label={t('cs.mp.warrantyMeter')}
          value={warrantyMeter}
          onChange={setWarrantyMeter}
          w={130}
          hint={t('cs.mp.warrantyHint')}
        />
        <button
          type="button"
          style={btnPrimary}
          onClick={() =>
            void onSubmit({
              brand: brand.trim() === '' ? null : brand.trim(),
              model: model.trim() === '' ? null : model.trim(),
              modelYear: modelYear.trim() === '' ? null : Number(modelYear),
              plateNo: plateNo.trim() === '' ? null : plateNo.trim(),
              chassisNo: chassisNo.trim() === '' ? null : chassisNo.trim(),
              engineNo: engineNo.trim() === '' ? null : engineNo.trim(),
              meterType,
              rentalStart: rentalStart === '' ? null : rentalStart,
              rentalEnd: rentalEnd === '' ? null : rentalEnd,
              ...(rentalCost.trim() === ''
                ? {}
                : { rentalCost: Number(rentalCost.replace(',', '.')) }),
              rentalPeriod: rentalPeriod === '' ? null : rentalPeriod,
              warrantyUntil: warrantyUntil === '' ? null : warrantyUntil,
              warrantyMeter:
                warrantyMeter.trim() === '' ? null : Number(warrantyMeter.replace(',', '.')),
            })
          }
        >
          {t('cs.common.save')}
        </button>
      </div>
    </div>
  );
}

// ---- Sayaç paneli -----------------------------------------------------------

function MeterPanel({
  machine,
  lang,
  log,
  onSubmit,
}: {
  machine: MachineParkDto;
  lang: string | undefined;
  log: MachineMaintenanceDto['meterLog'];
  onSubmit: (body: {
    meterValue: number;
    readAt?: string;
    isReset?: boolean;
    note?: string | null;
  }) => Promise<void>;
}): JSX.Element {
  const t = (k: Parameters<typeof csT>[0]): string => csT(k, lang);
  const [value, setValue] = useState('');
  const [readAt, setReadAt] = useState(new Date().toISOString().slice(0, 10));
  const [isReset, setIsReset] = useState(false);
  const [note, setNote] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const unit = meterTypeLabel(machine.meterType, lang);

  return (
    <div style={{ display: 'grid', gap: 8, borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{t('cs.mp.meterPanel.title')}</div>
      <div style={{ fontSize: 11, color: '#64748b' }}>{t('cs.mp.meterPanel.hint')}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ width: 140 }}>
          <span style={label}>
            {t('cs.mp.meterPanel.value')} ({unit})
          </span>
          <input style={input} value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div style={{ width: 150 }}>
          <span style={label}>{t('cs.sch.prog.asOf')}</span>
          <input
            type="date"
            style={input}
            value={readAt}
            onChange={(e) => setReadAt(e.target.value)}
          />
        </div>
        <label style={{ fontSize: 12, display: 'flex', gap: 5, alignItems: 'center' }}>
          <input type="checkbox" checked={isReset} onChange={(e) => setIsReset(e.target.checked)} />
          {t('cs.mp.meterPanel.isReset')}
        </label>
        <div style={{ flex: 1, minWidth: 160 }}>
          <span style={label}>
            {t('cs.common.note')}
            {isReset ? ' *' : ''}
          </span>
          <input style={input} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <button
          type="button"
          style={btnPrimary}
          onClick={() => {
            const v = Number(value.replace(',', '.'));
            if (!Number.isFinite(v) || v < 0) {
              setLocalError(t('cs.common.required'));
              return;
            }
            if (isReset && note.trim() === '') {
              setLocalError(t('cs.mp.meterPanel.hint'));
              return;
            }
            setLocalError(null);
            void onSubmit({
              meterValue: v,
              readAt,
              ...(isReset ? { isReset: true } : {}),
              note: note.trim() === '' ? null : note.trim(),
            });
          }}
        >
          {t('cs.common.save')}
        </button>
      </div>
      {localError !== null && <div style={errBox}>{localError}</div>}
      {log.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            {t('cs.mp.meterPanel.log')}
          </div>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#334155' }}>
            {log.slice(0, 8).map((l) => (
              <li key={l.id}>
                {l.readAt} · {num(l.meterValue)} {unit}
                {l.isReset ? (
                  <span style={{ color: '#b91c1c', fontWeight: 600 }}>
                    {' '}
                    · {t('cs.mp.meterPanel.isReset')}
                  </span>
                ) : null}
                {l.note === null ? '' : ` · ${l.note}`}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ---- Bakım paneli -----------------------------------------------------------

function MaintenancePanel({
  data,
  lang,
  unit,
  onCreatePlan,
  onDeletePlan,
  onAddRecord,
}: {
  data: MachineMaintenanceDto;
  lang: string | undefined;
  unit: string;
  onCreatePlan: (body: {
    name: string;
    intervalType: MaintenanceIntervalType;
    intervalValue: number;
    lastDoneMeter?: number | null;
    lastDoneDate?: string | null;
  }) => Promise<void>;
  onDeletePlan: (planId: number) => Promise<void>;
  onAddRecord: (body: {
    planId?: number | null;
    doneAt?: string;
    meterAt?: number | null;
    cost?: number;
    description: string;
  }) => Promise<void>;
}): JSX.Element {
  const t = (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>): string =>
    csT(k, lang, vars);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [showRecordForm, setShowRecordForm] = useState(false);

  return (
    <div style={{ display: 'grid', gap: 8, borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{t('cs.mp.plan.title')}</div>
        <button type="button" style={btn} onClick={() => setShowPlanForm((v) => !v)}>
          {showPlanForm ? t('cs.common.close') : t('cs.mp.plan.new')}
        </button>
        <button type="button" style={btn} onClick={() => setShowRecordForm((v) => !v)}>
          {showRecordForm ? t('cs.common.close') : t('cs.mp.rec.new')}
        </button>
      </div>

      {showPlanForm && <PlanForm lang={lang} unit={unit} onSubmit={onCreatePlan} />}
      {showRecordForm && (
        <RecordForm lang={lang} unit={unit} plans={data.plans} onSubmit={onAddRecord} />
      )}

      {data.plans.length > 0 && (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={th}>{t('cs.mp.plan.name')}</th>
              <th style={th}>{t('cs.mp.plan.intervalType')}</th>
              <th style={th}>{t('cs.mp.plan.intervalValue')}</th>
              <th style={th}>{t('cs.mp.plan.lastDone')}</th>
              <th style={th}>{t('cs.mp.plan.nextDue')}</th>
              <th style={th}>{t('cs.mp.plan.remaining')}</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {data.plans.map((p) => {
              const overdue = p.due.overdue === true;
              return (
                <tr key={p.id} style={overdue ? { background: '#fef2f2' } : undefined}>
                  <td style={{ ...td, fontWeight: 600 }}>{p.name}</td>
                  <td style={td}>{maintenanceIntervalLabel(p.intervalType, lang)}</td>
                  <td style={td}>
                    {num(p.intervalValue, 0)}{' '}
                    {p.intervalType === 'meter' ? unit : t('cs.qg.days', { n: '' })}
                  </td>
                  <td style={td}>
                    {p.intervalType === 'meter'
                      ? p.lastDoneMeter === null
                        ? '—'
                        : `${num(p.lastDoneMeter)} ${unit}`
                      : (p.lastDoneDate ?? '—')}
                  </td>
                  <td style={td}>
                    {p.due.nextDueMeter !== null
                      ? `${num(p.due.nextDueMeter)} ${unit}`
                      : (p.due.nextDueDate ?? '—')}
                  </td>
                  <td
                    style={{
                      ...td,
                      fontWeight: 700,
                      color: overdue ? '#b91c1c' : p.due.remaining === null ? '#7c3aed' : '#15803d',
                    }}
                  >
                    {p.due.remaining === null
                      ? t('cs.mp.plan.noBaseline')
                      : overdue
                        ? `${t('cs.mp.plan.overdue')} (${num(Math.abs(p.due.remaining), 0)})`
                        : num(p.due.remaining, 0)}
                  </td>
                  <td style={td}>
                    <button type="button" style={btn} onClick={() => void onDeletePlan(p.id)}>
                      {t('cs.common.delete')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {data.records.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            {t('cs.mp.rec.title')}
          </div>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#334155' }}>
            {data.records.slice(0, 8).map((r) => (
              <li key={r.id}>
                {r.doneAt} · {r.description}
                {r.meterAt === null ? '' : ` · ${num(r.meterAt)} ${unit}`}
                {r.cost > 0 ? ` · ${num(r.cost, 2)}` : ''}
                {r.planId !== null ? (
                  <span style={{ color: '#0369a1' }}> · {t('cs.mp.rec.plan')}</span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function PlanForm({
  lang,
  unit,
  onSubmit,
}: {
  lang: string | undefined;
  unit: string;
  onSubmit: (body: {
    name: string;
    intervalType: MaintenanceIntervalType;
    intervalValue: number;
    lastDoneMeter?: number | null;
    lastDoneDate?: string | null;
  }) => Promise<void>;
}): JSX.Element {
  const t = (k: Parameters<typeof csT>[0]): string => csT(k, lang);
  const [name, setName] = useState('');
  const [intervalType, setIntervalType] = useState<MaintenanceIntervalType>('meter');
  const [intervalValue, setIntervalValue] = useState('');
  const [lastDoneMeter, setLastDoneMeter] = useState('');
  const [lastDoneDate, setLastDoneDate] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <Field label={t('cs.mp.plan.name')} value={name} onChange={setName} w={180} />
      <div style={{ width: 130 }}>
        <span style={label}>{t('cs.mp.plan.intervalType')}</span>
        <select
          style={input}
          value={intervalType}
          onChange={(e) => setIntervalType(e.target.value as MaintenanceIntervalType)}
        >
          <option value="meter">{maintenanceIntervalLabel('meter', lang)}</option>
          <option value="days">{maintenanceIntervalLabel('days', lang)}</option>
        </select>
      </div>
      <Field
        label={`${t('cs.mp.plan.intervalValue')} (${intervalType === 'meter' ? unit : 'gün'})`}
        value={intervalValue}
        onChange={setIntervalValue}
        w={110}
      />
      {intervalType === 'meter' ? (
        <Field
          label={`${t('cs.mp.plan.lastDone')} (${unit})`}
          value={lastDoneMeter}
          onChange={setLastDoneMeter}
          w={120}
          hint={t('cs.mp.plan.baselineHint')}
        />
      ) : (
        <div style={{ width: 150 }}>
          <span style={label} title={t('cs.mp.plan.baselineHint')}>
            {t('cs.mp.plan.lastDone')}
          </span>
          <input
            type="date"
            style={input}
            value={lastDoneDate}
            onChange={(e) => setLastDoneDate(e.target.value)}
          />
        </div>
      )}
      <button
        type="button"
        style={btnPrimary}
        onClick={() => {
          const iv = Number(intervalValue.replace(',', '.'));
          if (name.trim() === '' || !Number.isFinite(iv) || iv <= 0) {
            setLocalError(t('cs.common.required'));
            return;
          }
          setLocalError(null);
          void onSubmit({
            name: name.trim(),
            intervalType,
            intervalValue: iv,
            lastDoneMeter:
              lastDoneMeter.trim() === '' ? null : Number(lastDoneMeter.replace(',', '.')),
            lastDoneDate: lastDoneDate === '' ? null : lastDoneDate,
          });
        }}
      >
        {t('cs.common.save')}
      </button>
      {localError !== null && <div style={errBox}>{localError}</div>}
    </div>
  );
}

function RecordForm({
  lang,
  unit,
  plans,
  onSubmit,
}: {
  lang: string | undefined;
  unit: string;
  plans: MachineMaintenanceDto['plans'];
  onSubmit: (body: {
    planId?: number | null;
    doneAt?: string;
    meterAt?: number | null;
    cost?: number;
    description: string;
  }) => Promise<void>;
}): JSX.Element {
  const t = (k: Parameters<typeof csT>[0]): string => csT(k, lang);
  const [planId, setPlanId] = useState(0);
  const [doneAt, setDoneAt] = useState(new Date().toISOString().slice(0, 10));
  const [meterAt, setMeterAt] = useState('');
  const [cost, setCost] = useState('');
  const [description, setDescription] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ fontSize: 11, color: '#64748b' }}>{t('cs.mp.rec.hint')}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 190 }}>
          <span style={label}>{t('cs.mp.rec.plan')}</span>
          <select
            style={input}
            value={planId === 0 ? '' : String(planId)}
            onChange={(e) => setPlanId(e.target.value === '' ? 0 : Number(e.target.value))}
          >
            <option value="">{t('cs.mp.rec.planNone')}</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ width: 150 }}>
          <span style={label}>{t('cs.mp.rec.doneAt')}</span>
          <input
            type="date"
            style={input}
            value={doneAt}
            onChange={(e) => setDoneAt(e.target.value)}
          />
        </div>
        <Field
          label={`${t('cs.mp.rec.meterAt')} (${unit})`}
          value={meterAt}
          onChange={setMeterAt}
          w={120}
        />
        <Field label={t('cs.mp.rec.cost')} value={cost} onChange={setCost} w={110} />
        <div style={{ flex: 1, minWidth: 180 }}>
          <span style={label}>{t('cs.qg.c.description')}</span>
          <input
            style={input}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <button
          type="button"
          style={btnPrimary}
          onClick={() => {
            if (description.trim() === '') {
              setLocalError(t('cs.common.required'));
              return;
            }
            setLocalError(null);
            void onSubmit({
              planId: planId > 0 ? planId : null,
              doneAt,
              meterAt: meterAt.trim() === '' ? null : Number(meterAt.replace(',', '.')),
              ...(cost.trim() === '' ? {} : { cost: Number(cost.replace(',', '.')) }),
              description: description.trim(),
            });
          }}
        >
          {t('cs.common.save')}
        </button>
      </div>
      {localError !== null && <div style={errBox}>{localError}</div>}
    </div>
  );
}

// ============================================================================

function Field({
  label: lbl,
  value,
  onChange,
  w,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  w: number;
  hint?: string;
}): JSX.Element {
  return (
    <div style={{ width: w }}>
      <span style={label} {...(hint === undefined ? {} : { title: hint })}>
        {lbl}
      </span>
      <input style={input} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

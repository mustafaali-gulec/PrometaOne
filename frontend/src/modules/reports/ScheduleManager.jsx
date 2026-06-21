/**
 * ScheduleManager — kayıtlı bir raporun zamanlanmış e-posta gönderimlerini
 * yönetir (P5). Backend: /v1/reports/schedules. Cron saatlik çalışıp vadesi
 * gelenleri xlsx ekiyle e-postalar (SMTP yoksa no-op → sunucu logu).
 */
import React, { useEffect, useState } from 'react';

const FREQ = [
  ['daily', { tr: 'Günlük', en: 'Daily' }],
  ['weekly', { tr: 'Haftalık', en: 'Weekly' }],
  ['monthly', { tr: 'Aylık', en: 'Monthly' }],
];
const DOW = [
  { tr: 'Pazar', en: 'Sun' },
  { tr: 'Pazartesi', en: 'Mon' },
  { tr: 'Salı', en: 'Tue' },
  { tr: 'Çarşamba', en: 'Wed' },
  { tr: 'Perşembe', en: 'Thu' },
  { tr: 'Cuma', en: 'Fri' },
  { tr: 'Cumartesi', en: 'Sat' },
];

export function ScheduleManager({ api, reportId, reportName, lang = 'tr', notify, onClose }) {
  const tr = lang !== 'en';
  const [list, setList] = useState([]);
  const [freq, setFreq] = useState('daily');
  const [dow, setDow] = useState(1);
  const [dom, setDom] = useState(1);
  const [time, setTime] = useState('08:00');
  const [recipients, setRecipients] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = () => api.listSchedules(reportId).then(setList).catch(() => {});
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  const add = async () => {
    const recs = recipients.split(',').map((s) => s.trim()).filter(Boolean);
    if (!recs.length) {
      setErr(tr ? 'En az bir e-posta adresi girin' : 'Enter at least one email');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await api.createSchedule({
        reportId,
        frequency: freq,
        dayOfWeek: freq === 'weekly' ? dow : null,
        dayOfMonth: freq === 'monthly' ? dom : null,
        timeOfDay: time,
        recipients: recs,
      });
      notify?.(tr ? 'Zamanlama eklendi' : 'Schedule added');
      setRecipients('');
      reload();
    } catch (e) {
      setErr(e.message || 'Hata');
    } finally {
      setBusy(false);
    }
  };

  const del = async (id) => {
    if (!confirm(tr ? 'Zamanlama silinsin mi?' : 'Delete schedule?')) return;
    await api.removeSchedule(id);
    reload();
  };
  const toggle = async (s) => {
    await api.updateSchedule(s.id, { enabled: !s.enabled });
    reload();
  };

  const freqLabel = (f) => {
    const e = FREQ.find(([v]) => v === f);
    return e ? (tr ? e[1].tr : e[1].en) : f;
  };
  const describe = (s) =>
    `${freqLabel(s.frequency)}${s.frequency === 'weekly' ? ' · ' + (tr ? DOW[s.dayOfWeek]?.tr : DOW[s.dayOfWeek]?.en) : ''}${s.frequency === 'monthly' ? ' · ' + (tr ? `ayın ${s.dayOfMonth}.` : `day ${s.dayOfMonth}`) : ''} · ${s.timeOfDay}`;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}
    >
      <div className="card p-3 space-y-3" style={{ width: 520, maxHeight: '85vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="font-bold">🕒 {tr ? 'Zamanlanmış Raporlar' : 'Scheduled Reports'} — {reportName}</div>
          <button className="btn" style={{ fontSize: 12 }} onClick={onClose}>✕</button>
        </div>

        {/* Mevcut zamanlamalar */}
        {list.length === 0 ? (
          <div className="text-xs" style={{ color: 'var(--ink-mute)' }}>
            {tr ? 'Henüz zamanlama yok.' : 'No schedules yet.'}
          </div>
        ) : (
          <div className="space-y-1">
            {list.map((s) => (
              <div key={s.id} className="card p-2 flex items-center justify-between" style={{ background: 'var(--bg-alt)', borderLeft: `3px solid ${s.enabled ? '#15803d' : '#9ca3af'}` }}>
                <div style={{ flex: 1 }}>
                  <div className="text-sm font-bold">{describe(s)}</div>
                  <div className="text-xs mono" style={{ color: 'var(--ink-mute)' }}>{(s.recipients || []).join(', ')}</div>
                  {s.lastRunAt && (
                    <div className="text-xs" style={{ color: 'var(--ink-mute)' }}>
                      {tr ? 'Son' : 'Last'}: {new Date(s.lastRunAt).toLocaleString('tr-TR')} ({s.lastStatus})
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <button className="btn" style={{ fontSize: 10 }} onClick={() => toggle(s)}>
                    {s.enabled ? (tr ? 'Duraklat' : 'Pause') : (tr ? 'Aktifleştir' : 'Enable')}
                  </button>
                  <button className="btn" style={{ fontSize: 10, color: '#b91c1c' }} onClick={() => del(s.id)}>{tr ? 'Sil' : 'Delete'}</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Yeni zamanlama */}
        <div className="card p-2 space-y-2" style={{ border: '1px dashed var(--line)' }}>
          <div className="text-xs font-bold" style={{ color: 'var(--ink-mute)' }}>{tr ? 'Yeni Zamanlama' : 'New Schedule'}</div>
          <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
            <select className="input" style={{ fontSize: 11, maxWidth: 120 }} value={freq} onChange={(e) => setFreq(e.target.value)}>
              {FREQ.map(([v, l]) => (<option key={v} value={v}>{tr ? l.tr : l.en}</option>))}
            </select>
            {freq === 'weekly' && (
              <select className="input" style={{ fontSize: 11, maxWidth: 120 }} value={dow} onChange={(e) => setDow(Number(e.target.value))}>
                {DOW.map((d, i) => (<option key={i} value={i}>{tr ? d.tr : d.en}</option>))}
              </select>
            )}
            {freq === 'monthly' && (
              <input className="input mono" type="number" min={1} max={31} style={{ fontSize: 11, maxWidth: 80 }} value={dom} onChange={(e) => setDom(Number(e.target.value))} />
            )}
            <input className="input mono" type="time" style={{ fontSize: 11, maxWidth: 110 }} value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <input className="input" style={{ width: '100%', fontSize: 11 }} placeholder={tr ? 'Alıcı e-postalar (virgülle)' : 'Recipient emails (comma)'} value={recipients} onChange={(e) => setRecipients(e.target.value)} />
          {err && <div className="text-xs" style={{ color: '#b91c1c' }}>⚠ {err}</div>}
          <button className="btn" disabled={busy} style={{ background: '#7c3aed', color: '#fff', fontWeight: 700 }} onClick={add}>
            {tr ? '+ Zamanlama Ekle' : '+ Add Schedule'}
          </button>
          <div className="text-xs" style={{ color: 'var(--ink-mute)' }}>
            {tr ? 'Rapor xlsx olarak e-posta ile gönderilir. (SMTP yapılandırılmamışsa sunucu loguna düşer.)' : 'Report is emailed as xlsx. (Logged to server if SMTP not configured.)'}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ScheduleManager — kayıtlı bir raporun zamanlanmış e-posta gönderimlerini
 * yönetir (P5). Backend: /v1/reports/schedules. Cron saatlik çalışıp vadesi
 * gelenleri xlsx ekiyle e-postalar (SMTP yoksa no-op → sunucu logu).
 */
import React, { useEffect, useState } from 'react';

import { confirmDialog } from '../../shared/feedback';

const FREQ = [
  ['daily', { tr: 'Günlük', en: 'Daily', de: 'Täglich', ar: 'يومي' }],
  ['weekly', { tr: 'Haftalık', en: 'Weekly', de: 'Wöchentlich', ar: 'أسبوعي' }],
  ['monthly', { tr: 'Aylık', en: 'Monthly', de: 'Monatlich', ar: 'شهري' }],
];
const DOW = [
  { tr: 'Pazar', en: 'Sun', de: 'Sonntag', ar: 'الأحد' },
  { tr: 'Pazartesi', en: 'Mon', de: 'Montag', ar: 'الاثنين' },
  { tr: 'Salı', en: 'Tue', de: 'Dienstag', ar: 'الثلاثاء' },
  { tr: 'Çarşamba', en: 'Wed', de: 'Mittwoch', ar: 'الأربعاء' },
  { tr: 'Perşembe', en: 'Thu', de: 'Donnerstag', ar: 'الخميس' },
  { tr: 'Cuma', en: 'Fri', de: 'Freitag', ar: 'الجمعة' },
  { tr: 'Cumartesi', en: 'Sat', de: 'Samstag', ar: 'السبت' },
];

export function ScheduleManager({ api, reportId, reportName, lang = 'tr', notify, onClose }) {
  const [list, setList] = useState([]);
  const [freq, setFreq] = useState('daily');
  const [dow, setDow] = useState(1);
  const [dom, setDom] = useState(1);
  const [time, setTime] = useState('08:00');
  const [recipients, setRecipients] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = () =>
    api
      .listSchedules(reportId)
      .then(setList)
      .catch(() => {});
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  const add = async () => {
    const recs = recipients
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!recs.length) {
      setErr(
        lang === 'en'
          ? 'Enter at least one email'
          : lang === 'de'
            ? 'Mindestens eine E-Mail-Adresse eingeben'
            : lang === 'ar'
              ? 'أدخل عنوان بريد إلكتروني واحدًا على الأقل'
              : 'En az bir e-posta adresi girin',
      );
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
      notify?.(
        lang === 'en'
          ? 'Schedule added'
          : lang === 'de'
            ? 'Zeitplan hinzugefügt'
            : lang === 'ar'
              ? 'تمت إضافة الجدولة'
              : 'Zamanlama eklendi',
      );
      setRecipients('');
      reload();
    } catch (e) {
      setErr(e.message || 'Hata');
    } finally {
      setBusy(false);
    }
  };

  const del = async (id) => {
    if (
      !(await confirmDialog({
        title:
          lang === 'en'
            ? 'Delete schedule?'
            : lang === 'de'
              ? 'Zeitplan löschen?'
              : lang === 'ar'
                ? 'حذف الجدولة؟'
                : 'Zamanlama silinsin mi?',
        tone: 'danger',
      }))
    )
      return;
    await api.removeSchedule(id);
    reload();
  };
  const toggle = async (s) => {
    await api.updateSchedule(s.id, { enabled: !s.enabled });
    reload();
  };

  const freqLabel = (f) => {
    const e = FREQ.find(([v]) => v === f);
    return e ? e[1][lang] || e[1].tr : f;
  };
  const describe = (s) => {
    const d = DOW[s.dayOfWeek];
    const dowLabel = d ? d[lang] || d.tr : '';
    const domLabel =
      lang === 'en'
        ? `day ${s.dayOfMonth}`
        : lang === 'de'
          ? `Tag ${s.dayOfMonth}`
          : lang === 'ar'
            ? `اليوم ${s.dayOfMonth}`
            : `ayın ${s.dayOfMonth}.`;
    return `${freqLabel(s.frequency)}${s.frequency === 'weekly' ? ' · ' + dowLabel : ''}${s.frequency === 'monthly' ? ' · ' + domLabel : ''} · ${s.timeOfDay}`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="card p-3 space-y-3"
        style={{ width: 520, maxHeight: '85vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="font-bold">
            🕒{' '}
            {lang === 'en'
              ? 'Scheduled Reports'
              : lang === 'de'
                ? 'Geplante Berichte'
                : lang === 'ar'
                  ? 'التقارير المجدولة'
                  : 'Zamanlanmış Raporlar'}{' '}
            — {reportName}
          </div>
          <button className="btn" style={{ fontSize: 12 }} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Mevcut zamanlamalar */}
        {list.length === 0 ? (
          <div className="text-xs" style={{ color: 'var(--ink-mute)' }}>
            {lang === 'en'
              ? 'No schedules yet.'
              : lang === 'de'
                ? 'Noch keine Zeitpläne.'
                : lang === 'ar'
                  ? 'لا توجد جدولات بعد.'
                  : 'Henüz zamanlama yok.'}
          </div>
        ) : (
          <div className="space-y-1">
            {list.map((s) => (
              <div
                key={s.id}
                className="card p-2 flex items-center justify-between"
                style={{
                  background: 'var(--bg-alt)',
                  borderLeft: `3px solid ${s.enabled ? '#15803d' : '#9ca3af'}`,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div className="text-sm font-bold">{describe(s)}</div>
                  <div className="text-xs mono" style={{ color: 'var(--ink-mute)' }}>
                    {(s.recipients || []).join(', ')}
                  </div>
                  {s.lastRunAt && (
                    <div className="text-xs" style={{ color: 'var(--ink-mute)' }}>
                      {lang === 'en'
                        ? 'Last'
                        : lang === 'de'
                          ? 'Zuletzt'
                          : lang === 'ar'
                            ? 'الأخير'
                            : 'Son'}
                      : {new Date(s.lastRunAt).toLocaleString('tr-TR')} ({s.lastStatus})
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <button className="btn" style={{ fontSize: 10 }} onClick={() => toggle(s)}>
                    {s.enabled
                      ? lang === 'en'
                        ? 'Pause'
                        : lang === 'de'
                          ? 'Pausieren'
                          : lang === 'ar'
                            ? 'إيقاف مؤقت'
                            : 'Duraklat'
                      : lang === 'en'
                        ? 'Enable'
                        : lang === 'de'
                          ? 'Aktivieren'
                          : lang === 'ar'
                            ? 'تفعيل'
                            : 'Aktifleştir'}
                  </button>
                  <button
                    className="btn"
                    style={{ fontSize: 10, color: '#b91c1c' }}
                    onClick={() => del(s.id)}
                  >
                    {lang === 'en'
                      ? 'Delete'
                      : lang === 'de'
                        ? 'Löschen'
                        : lang === 'ar'
                          ? 'حذف'
                          : 'Sil'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Yeni zamanlama */}
        <div className="card p-2 space-y-2" style={{ border: '1px dashed var(--line)' }}>
          <div className="text-xs font-bold" style={{ color: 'var(--ink-mute)' }}>
            {lang === 'en'
              ? 'New Schedule'
              : lang === 'de'
                ? 'Neuer Zeitplan'
                : lang === 'ar'
                  ? 'جدولة جديدة'
                  : 'Yeni Zamanlama'}
          </div>
          <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
            <select
              className="input"
              style={{ fontSize: 11, maxWidth: 120 }}
              value={freq}
              onChange={(e) => setFreq(e.target.value)}
            >
              {FREQ.map(([v, l]) => (
                <option key={v} value={v}>
                  {l[lang] || l.tr}
                </option>
              ))}
            </select>
            {freq === 'weekly' && (
              <select
                className="input"
                style={{ fontSize: 11, maxWidth: 120 }}
                value={dow}
                onChange={(e) => setDow(Number(e.target.value))}
              >
                {DOW.map((d, i) => (
                  <option key={i} value={i}>
                    {d[lang] || d.tr}
                  </option>
                ))}
              </select>
            )}
            {freq === 'monthly' && (
              <input
                className="input mono"
                type="number"
                min={1}
                max={31}
                style={{ fontSize: 11, maxWidth: 80 }}
                value={dom}
                onChange={(e) => setDom(Number(e.target.value))}
              />
            )}
            <input
              className="input mono"
              type="time"
              style={{ fontSize: 11, maxWidth: 110 }}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <input
            className="input"
            style={{ width: '100%', fontSize: 11 }}
            placeholder={
              lang === 'en'
                ? 'Recipient emails (comma)'
                : lang === 'de'
                  ? 'Empfänger-E-Mails (kommagetrennt)'
                  : lang === 'ar'
                    ? 'عناوين بريد المستلمين (بفواصل)'
                    : 'Alıcı e-postalar (virgülle)'
            }
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
          />
          {err && (
            <div className="text-xs" style={{ color: '#b91c1c' }}>
              ⚠ {err}
            </div>
          )}
          <button
            className="btn"
            disabled={busy}
            style={{ background: '#7c3aed', color: '#fff', fontWeight: 700 }}
            onClick={add}
          >
            {lang === 'en'
              ? '+ Add Schedule'
              : lang === 'de'
                ? '+ Zeitplan hinzufügen'
                : lang === 'ar'
                  ? '+ إضافة جدولة'
                  : '+ Zamanlama Ekle'}
          </button>
          <div className="text-xs" style={{ color: 'var(--ink-mute)' }}>
            {lang === 'en'
              ? 'Report is emailed as xlsx. (Logged to server if SMTP not configured.)'
              : lang === 'de'
                ? 'Der Bericht wird als xlsx per E-Mail gesendet. (Ohne SMTP-Konfiguration nur Server-Log.)'
                : lang === 'ar'
                  ? 'يُرسل التقرير بالبريد الإلكتروني بصيغة xlsx. (إذا لم يُهيأ SMTP يُسجل في سجل الخادم.)'
                  : 'Rapor xlsx olarak e-posta ile gönderilir. (SMTP yapılandırılmamışsa sunucu loguna düşer.)'}
          </div>
        </div>
      </div>
    </div>
  );
}

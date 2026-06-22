/* =====================================================================
   shared/feedback — Mesaj Kataloğu
   ---------------------------------------------------------------------
   "Daha anlamlı mesajlar" için tek merkez. Amaç: dağınık, jenerik ve
   tutarsız metinler ("Hata", "Birim adı zorunlu") yerine bağlamı olan,
   tutarlı ve çok dilli cümleler üretmek.

   Dil, App.jsx ile aynı mekanizmadan okunur: window.__PROMETA_LANG__.
   Böylece bu katalog React dışında da doğru dili verir.

   KULLANIM: katalogdaki her giriş bir FONKSİYONDUR ve çağrı anında
   dili okur. Asla `msg.x` referansını saklamayın; `msg.x()` çağırın.
       toast.warning(msg.validation.required("Birim adı"));
       await confirmDialog(msg.crud.deleteConfirm(ou.name, "Birim"));
===================================================================== */
import type { ConfirmOptions } from './types';

declare global {
  interface Window {
    __PROMETA_LANG__?: string;
  }
}

export type Lang = 'tr' | 'en' | 'de' | 'ar';

const SUPPORTED: readonly Lang[] = ['tr', 'en', 'de', 'ar'];

/** Aktif uygulama dilini döndürür (App.jsx ile aynı kaynak). */
export function currentLang(): Lang {
  const raw = typeof window !== 'undefined' ? window.__PROMETA_LANG__ : undefined;
  return raw && (SUPPORTED as readonly string[]).includes(raw) ? (raw as Lang) : 'tr';
}

/** En az TR içeren, diğer diller opsiyonel çok dilli metin. */
export type Variants = { tr: string } & Partial<Record<Lang, string>>;

/** Aktif dile göre metni seçer; eksikse TR'ye düşer. */
export function pick(v: Variants): string {
  const lang = currentLang();
  return v[lang] ?? v.tr;
}

/* =====================================================================
   Katalog
   Her alan, çağrı anında değerlendirilen bir fonksiyondur.
===================================================================== */
export const msg = {
  /* ---- Doğrulama ---- */
  validation: {
    required: (field: string): string =>
      pick({
        tr: `«${field}» alanı zorunludur.`,
        en: `“${field}” is required.`,
        de: `„${field}“ ist erforderlich.`,
        ar: `«${field}» مطلوب.`,
      }),
    selectOne: (field: string): string =>
      pick({
        tr: `Lütfen bir ${field} seçin.`,
        en: `Please select a ${field}.`,
        de: `Bitte ${field} auswählen.`,
        ar: `الرجاء اختيار ${field}.`,
      }),
    mustBePositive: (field: string): string =>
      pick({
        tr: `«${field}» sıfırdan büyük olmalıdır.`,
        en: `“${field}” must be greater than zero.`,
        de: `„${field}“ muss größer als null sein.`,
        ar: `«${field}» يجب أن يكون أكبر من صفر.`,
      }),
    selfParent: (): string =>
      pick({
        tr: 'Bir kayıt kendi üst öğesi olamaz.',
        en: 'A record cannot be its own parent.',
        de: 'Ein Datensatz kann nicht sein eigenes übergeordnetes Element sein.',
        ar: 'لا يمكن أن يكون السجل أصلاً لنفسه.',
      }),
  },

  /* ---- CRUD geri bildirimleri ---- */
  crud: {
    created: (entity: string): string =>
      pick({
        tr: `${entity} eklendi.`,
        en: `${entity} added.`,
        de: `${entity} hinzugefügt.`,
        ar: `تمت إضافة ${entity}.`,
      }),
    updated: (entity: string): string =>
      pick({
        tr: `${entity} güncellendi.`,
        en: `${entity} updated.`,
        de: `${entity} aktualisiert.`,
        ar: `تم تحديث ${entity}.`,
      }),
    deleted: (entity: string): string =>
      pick({
        tr: `${entity} silindi.`,
        en: `${entity} deleted.`,
        de: `${entity} gelöscht.`,
        ar: `تم حذف ${entity}.`,
      }),

    /** Yıkıcı silme onayı — `confirmDialog`'a doğrudan verilebilir. */
    deleteConfirm: (name: string, kind: string): ConfirmOptions => ({
      title: pick({
        tr: `${kind} silinsin mi?`,
        en: `Delete ${kind.toLowerCase()}?`,
        de: `${kind} löschen?`,
        ar: `حذف ${kind}؟`,
      }),
      description: pick({
        tr: `«${name}» kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
        en: `“${name}” will be permanently deleted. This action cannot be undone.`,
        de: `„${name}“ wird dauerhaft gelöscht. Dies kann nicht rückgängig gemacht werden.`,
        ar: `سيتم حذف «${name}» نهائيًا. لا يمكن التراجع عن هذا الإجراء.`,
      }),
      confirmLabel: pick({ tr: 'Sil', en: 'Delete', de: 'Löschen', ar: 'حذف' }),
      cancelLabel: pick({ tr: 'Vazgeç', en: 'Cancel', de: 'Abbrechen', ar: 'إلغاء' }),
      tone: 'danger',
    }),

    /** Bağlı kayıtlar yüzünden silinemiyor — neden(ler)i listeler. */
    cannotDelete: (name: string, reasons: string[]): string => {
      const list = reasons.join(', ');
      return pick({
        tr: `«${name}» silinemiyor — önce bağlı kayıtları kaldırın: ${list}.`,
        en: `“${name}” can’t be deleted — remove linked records first: ${list}.`,
        de: `„${name}“ kann nicht gelöscht werden — entfernen Sie zuerst verknüpfte Datensätze: ${list}.`,
        ar: `لا يمكن حذف «${name}» — أزِل السجلات المرتبطة أولاً: ${list}.`,
      });
    },

    saveFailed: (detail?: string): string => {
      const base = pick({
        tr: 'Kaydetme sırasında bir sorun oluştu. Lütfen tekrar deneyin.',
        en: 'Something went wrong while saving. Please try again.',
        de: 'Beim Speichern ist ein Problem aufgetreten. Bitte erneut versuchen.',
        ar: 'حدثت مشكلة أثناء الحفظ. يُرجى المحاولة مرة أخرى.',
      });
      return detail ? `${base} (${detail})` : base;
    },
  },

  /* ---- Genel ---- */
  common: {
    saved: (): string =>
      pick({
        tr: 'Değişiklikler kaydedildi.',
        en: 'Changes saved.',
        de: 'Änderungen gespeichert.',
        ar: 'تم حفظ التغييرات.',
      }),
    networkError: (): string =>
      pick({
        tr: 'Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.',
        en: 'Couldn’t reach the server. Check your connection and try again.',
        de: 'Server nicht erreichbar. Verbindung prüfen und erneut versuchen.',
        ar: 'تعذّر الوصول إلى الخادم. تحقق من اتصالك وحاول مجددًا.',
      }),
    unauthorized: (): string =>
      pick({
        tr: 'Bu işlem için yetkiniz yok.',
        en: 'You don’t have permission for this action.',
        de: 'Sie haben keine Berechtigung für diese Aktion.',
        ar: 'ليس لديك صلاحية لهذا الإجراء.',
      }),
    unexpected: (): string =>
      pick({
        tr: 'Beklenmeyen bir hata oluştu.',
        en: 'An unexpected error occurred.',
        de: 'Ein unerwarteter Fehler ist aufgetreten.',
        ar: 'حدث خطأ غير متوقع.',
      }),
  },
  /* ---- HR (bordro + puantaj) ---- */
  hr: {
    payroll: {
      overwriteConfirm: (): ConfirmOptions => ({
        title: pick({
          tr: 'Bu dönem için bordro var. Üzerine yazılsın mı?',
          en: 'A run for this period exists. Overwrite?',
          de: 'Für diesen Zeitraum existiert ein Lauf. Überschreiben?',
          ar: 'يوجد تشغيل لهذه الفترة. الكتابة فوقه؟',
        }),
        confirmLabel: pick({
          tr: 'Üzerine yaz',
          en: 'Overwrite',
          de: 'Überschreiben',
          ar: 'الكتابة فوقه',
        }),
        cancelLabel: pick({ tr: 'Vazgeç', en: 'Cancel', de: 'Abbrechen', ar: 'إلغاء' }),
      }),
      runConfirm: (): ConfirmOptions => ({
        title: pick({
          tr: 'Bordro onaylansın mı?',
          en: 'Confirm payroll run?',
          de: 'Lohnlauf bestätigen?',
          ar: 'تأكيد تشغيل الرواتب؟',
        }),
        description: pick({
          tr: 'Onayladıktan sonra düzenlenemez.',
          en: 'After confirmation it cannot be edited.',
          de: 'Nach der Bestätigung nicht mehr bearbeitbar.',
          ar: 'بعد التأكيد لا يمكن تعديله.',
        }),
        confirmLabel: pick({ tr: 'Onayla', en: 'Confirm', de: 'Bestätigen', ar: 'تأكيد' }),
        cancelLabel: pick({ tr: 'Vazgeç', en: 'Cancel', de: 'Abbrechen', ar: 'إلغاء' }),
      }),
      deleteConfirm: (): ConfirmOptions => ({
        title: pick({
          tr: 'Bordro silinsin mi?',
          en: 'Delete this payroll run?',
          de: 'Lohnlauf löschen?',
          ar: 'حذف تشغيل الرواتب؟',
        }),
        tone: 'danger',
        confirmLabel: pick({ tr: 'Sil', en: 'Delete', de: 'Löschen', ar: 'حذف' }),
        cancelLabel: pick({ tr: 'Vazgeç', en: 'Cancel', de: 'Abbrechen', ar: 'إلغاء' }),
      }),
      confirmedCannotDelete: (): string =>
        pick({
          tr: 'Onaylanmış bordro silinemez.',
          en: 'Confirmed runs cannot be deleted.',
          de: 'Bestätigte Läufe können nicht gelöscht werden.',
          ar: 'لا يمكن حذف التشغيلات المؤكدة.',
        }),
      saved: (): string =>
        pick({
          tr: 'Bordro kaydedildi, puantaj kilitlendi.',
          en: 'Payroll saved, attendance locked.',
          de: 'Lohnlauf gespeichert, Zeiterfassung gesperrt.',
          ar: 'تم حفظ الرواتب وقُفل الحضور.',
        }),
      confirmed: (): string =>
        pick({
          tr: 'Bordro onaylandı.',
          en: 'Payroll confirmed.',
          de: 'Lohnlauf bestätigt.',
          ar: 'تم تأكيد الرواتب.',
        }),
      deleted: (): string =>
        pick({
          tr: 'Bordro silindi.',
          en: 'Run deleted.',
          de: 'Lauf gelöscht.',
          ar: 'تم حذف التشغيل.',
        }),
    },
    attendance: {
      resetConfirm: (): ConfirmOptions => ({
        title: pick({
          tr: 'Tüm satırlar standart iş günlerine sıfırlansın mı?',
          en: 'Reset all rows to default work days?',
          de: 'Alle Zeilen auf Standardarbeitstage zurücksetzen?',
          ar: 'إعادة ضبط جميع الصفوف إلى أيام العمل الافتراضية؟',
        }),
        confirmLabel: pick({ tr: 'Sıfırla', en: 'Reset', de: 'Zurücksetzen', ar: 'إعادة ضبط' }),
        cancelLabel: pick({ tr: 'Vazgeç', en: 'Cancel', de: 'Abbrechen', ar: 'إلغاء' }),
      }),
      approveAllConfirm: (): ConfirmOptions => ({
        title: pick({
          tr: 'Bu dönemin tüm puantajları onaylansın mı?',
          en: 'Approve all sheets for this period?',
          de: 'Alle Blätter dieses Zeitraums genehmigen?',
          ar: 'اعتماد جميع كشوف هذه الفترة؟',
        }),
        confirmLabel: pick({ tr: 'Onayla', en: 'Confirm', de: 'Bestätigen', ar: 'تأكيد' }),
        cancelLabel: pick({ tr: 'Vazgeç', en: 'Cancel', de: 'Abbrechen', ar: 'إلغاء' }),
      }),
      saved: (count: number): string =>
        pick({
          tr: `${count} puantaj kaydedildi.`,
          en: `Saved ${count} sheets.`,
          de: `${count} Blätter gespeichert.`,
          ar: `تم حفظ ${count} كشفًا.`,
        }),
    },
  },
} as const;

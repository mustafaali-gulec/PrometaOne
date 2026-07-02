// =====================================================================
// Performans Yönetimi — modül-içi i18n (TR/EN/DE/AR)
// ---------------------------------------------------------------------
// Dil Ajanı kuralı: her metin baştan 4 dilde. pl(key, lang) erişimcisi
// eksik dil için tr'ye, eksik anahtar için key'in kendisine düşer.
// (expense/presentation/i18n.ts deseninin aynısı.)
// =====================================================================

export type Lang = 'tr' | 'en' | 'de' | 'ar';

type Row = Record<Lang, string>;

const DICT: Record<string, Row> = {
  // --- Başlık / gezinme ---
  title: {
    tr: 'Performans Yönetimi',
    en: 'Performance Management',
    de: 'Leistungsmanagement',
    ar: 'إدارة الأداء',
  },
  subtitle: {
    tr: 'Değerlendirme dönemleri, hedefler, yetkinlikler ve kalibrasyon tek yerden',
    en: 'Review cycles, goals, competencies and calibration in one place',
    de: 'Bewertungszyklen, Ziele, Kompetenzen und Kalibrierung an einem Ort',
    ar: 'دورات التقييم والأهداف والكفاءات والمعايرة في مكان واحد',
  },
  'tab.dashboard': { tr: 'Genel Bakış', en: 'Overview', de: 'Übersicht', ar: 'نظرة عامة' },
  'tab.cycles': { tr: 'Dönemler', en: 'Cycles', de: 'Zyklen', ar: 'الدورات' },
  'tab.reviews': { tr: 'Değerlendirmeler', en: 'Reviews', de: 'Bewertungen', ar: 'التقييمات' },
  'tab.calibration': { tr: 'Kalibrasyon', en: 'Calibration', de: 'Kalibrierung', ar: 'المعايرة' },

  // --- Döngü durumları ---
  'cstatus.draft': { tr: 'Taslak', en: 'Draft', de: 'Entwurf', ar: 'مسودة' },
  'cstatus.active': { tr: 'Aktif', en: 'Active', de: 'Aktiv', ar: 'نشط' },
  'cstatus.calibration': {
    tr: 'Kalibrasyon',
    en: 'Calibration',
    de: 'Kalibrierung',
    ar: 'المعايرة',
  },
  'cstatus.closed': { tr: 'Kapalı', en: 'Closed', de: 'Geschlossen', ar: 'مغلق' },

  // --- Değerlendirme durumları ---
  'rstatus.self_pending': {
    tr: 'Öz Değerlendirme Bekliyor',
    en: 'Self-Assessment Pending',
    de: 'Selbstbewertung ausstehend',
    ar: 'بانتظار التقييم الذاتي',
  },
  'rstatus.self_submitted': {
    tr: 'Öz Değ. Gönderildi',
    en: 'Self-Assessment Submitted',
    de: 'Selbstbewertung eingereicht',
    ar: 'تم إرسال التقييم الذاتي',
  },
  'rstatus.manager_pending': {
    tr: 'Yönetici Değerlendirmesi Bekliyor',
    en: 'Manager Review Pending',
    de: 'Managerbewertung ausstehend',
    ar: 'بانتظار تقييم المدير',
  },
  'rstatus.completed': { tr: 'Tamamlandı', en: 'Completed', de: 'Abgeschlossen', ar: 'مكتمل' },
  'rstatus.acknowledged': {
    tr: 'Çalışan Onayladı',
    en: 'Acknowledged',
    de: 'Bestätigt',
    ar: 'تم الإقرار',
  },

  // --- Dereceler ---
  'rating.outstanding': { tr: 'Üstün', en: 'Outstanding', de: 'Herausragend', ar: 'متميّز' },
  'rating.exceeds': {
    tr: 'Beklentinin Üzerinde',
    en: 'Exceeds Expectations',
    de: 'Übertrifft Erwartungen',
    ar: 'يفوق التوقعات',
  },
  'rating.meets': {
    tr: 'Beklentileri Karşılıyor',
    en: 'Meets Expectations',
    de: 'Erfüllt Erwartungen',
    ar: 'يلبي التوقعات',
  },
  'rating.partially': {
    tr: 'Kısmen Karşılıyor',
    en: 'Partially Meets',
    de: 'Teilweise erfüllt',
    ar: 'يلبي جزئياً',
  },
  'rating.below': {
    tr: 'Beklentinin Altında',
    en: 'Below Expectations',
    de: 'Unter den Erwartungen',
    ar: 'دون التوقعات',
  },

  // --- Varsayılan yetkinlikler ---
  'comp.job_knowledge': {
    tr: 'İş Bilgisi ve Uzmanlık',
    en: 'Job Knowledge & Expertise',
    de: 'Fachwissen',
    ar: 'المعرفة المهنية والخبرة',
  },
  'comp.quality': {
    tr: 'İş Kalitesi',
    en: 'Quality of Work',
    de: 'Arbeitsqualität',
    ar: 'جودة العمل',
  },
  'comp.productivity': {
    tr: 'Verimlilik',
    en: 'Productivity',
    de: 'Produktivität',
    ar: 'الإنتاجية',
  },
  'comp.communication': { tr: 'İletişim', en: 'Communication', de: 'Kommunikation', ar: 'التواصل' },
  'comp.teamwork': { tr: 'Takım Çalışması', en: 'Teamwork', de: 'Teamarbeit', ar: 'العمل الجماعي' },
  'comp.initiative': {
    tr: 'İnisiyatif ve Sorumluluk',
    en: 'Initiative & Ownership',
    de: 'Initiative & Verantwortung',
    ar: 'المبادرة والمسؤولية',
  },

  // --- Dönem formu ---
  cycle: { tr: 'Dönem', en: 'Cycle', de: 'Zyklus', ar: 'الدورة' },
  cycles: {
    tr: 'Değerlendirme Dönemleri',
    en: 'Review Cycles',
    de: 'Bewertungszyklen',
    ar: 'دورات التقييم',
  },
  newCycle: { tr: 'Yeni Dönem', en: 'New Cycle', de: 'Neuer Zyklus', ar: 'دورة جديدة' },
  editCycle: { tr: 'Dönem Düzenle', en: 'Edit Cycle', de: 'Zyklus bearbeiten', ar: 'تعديل الدورة' },
  cycleName: { tr: 'Dönem Adı', en: 'Cycle Name', de: 'Zyklusname', ar: 'اسم الدورة' },
  periodStart: { tr: 'Başlangıç', en: 'Start', de: 'Beginn', ar: 'البداية' },
  periodEnd: { tr: 'Bitiş', en: 'End', de: 'Ende', ar: 'النهاية' },
  period: { tr: 'Dönem', en: 'Period', de: 'Zeitraum', ar: 'الفترة' },
  selfAssessment: {
    tr: 'Öz Değerlendirme',
    en: 'Self-Assessment',
    de: 'Selbstbewertung',
    ar: 'التقييم الذاتي',
  },
  selfAssessmentHint: {
    tr: 'Çalışan önce kendini değerlendirir, sonra yönetici puanlar',
    en: 'Employee self-assesses first, then the manager scores',
    de: 'Mitarbeiter bewertet sich zuerst selbst, dann der Manager',
    ar: 'يقيّم الموظف نفسه أولاً ثم يقيّمه المدير',
  },
  competenciesEnabled: {
    tr: 'Yetkinlik Değerlendirmesi',
    en: 'Competency Assessment',
    de: 'Kompetenzbewertung',
    ar: 'تقييم الكفاءات',
  },
  scaleMax: {
    tr: 'Puan Skalası (1..N)',
    en: 'Rating Scale (1..N)',
    de: 'Bewertungsskala (1..N)',
    ar: 'مقياس التقييم (1..N)',
  },
  weightGoals: {
    tr: 'Hedef Ağırlığı (%)',
    en: 'Goals Weight (%)',
    de: 'Zielgewichtung (%)',
    ar: 'وزن الأهداف (%)',
  },
  weightCompetencies: {
    tr: 'Yetkinlik Ağırlığı (%)',
    en: 'Competencies Weight (%)',
    de: 'Kompetenzgewichtung (%)',
    ar: 'وزن الكفاءات (%)',
  },
  weightSumHint: {
    tr: 'Hedef + Yetkinlik ağırlıkları toplamı 100 olmalı',
    en: 'Goals + Competencies weights must total 100',
    de: 'Ziel- + Kompetenzgewichte müssen zusammen 100 ergeben',
    ar: 'يجب أن يكون مجموع أوزان الأهداف والكفاءات 100',
  },

  // --- Aksiyonlar ---
  activate: { tr: 'Başlat', en: 'Activate', de: 'Aktivieren', ar: 'تفعيل' },
  moveToCalibration: {
    tr: 'Kalibrasyona Al',
    en: 'Move to Calibration',
    de: 'Zur Kalibrierung',
    ar: 'نقل إلى المعايرة',
  },
  closeCycle: { tr: 'Dönemi Kapat', en: 'Close Cycle', de: 'Zyklus schließen', ar: 'إغلاق الدورة' },
  reopen: { tr: 'Yeniden Aç', en: 'Reopen', de: 'Wieder öffnen', ar: 'إعادة فتح' },
  save: { tr: 'Kaydet', en: 'Save', de: 'Speichern', ar: 'حفظ' },
  cancel: { tr: 'İptal', en: 'Cancel', de: 'Abbrechen', ar: 'إلغاء' },
  del: { tr: 'Sil', en: 'Delete', de: 'Löschen', ar: 'حذف' },
  edit: { tr: 'Düzenle', en: 'Edit', de: 'Bearbeiten', ar: 'تعديل' },
  view: { tr: 'Görüntüle', en: 'View', de: 'Ansehen', ar: 'عرض' },
  close: { tr: 'Kapat', en: 'Close', de: 'Schließen', ar: 'إغلاق' },
  required: { tr: 'Zorunlu', en: 'Required', de: 'Erforderlich', ar: 'مطلوب' },

  // --- Onaylar / mesajlar ---
  confirmActivate: {
    tr: 'Bu dönem başlatılsın mı? Tüm aktif çalışanlar için değerlendirme oluşturulur ve bildirim gönderilir.',
    en: 'Activate this cycle? Reviews will be generated for all active employees and notifications sent.',
    de: 'Diesen Zyklus aktivieren? Für alle aktiven Mitarbeiter werden Bewertungen erstellt und Benachrichtigungen gesendet.',
    ar: 'تفعيل هذه الدورة؟ سيتم إنشاء تقييمات لجميع الموظفين النشطين وإرسال إشعارات.',
  },
  confirmCalibration: {
    tr: 'Dönem kalibrasyon aşamasına alınsın mı?',
    en: 'Move this cycle to the calibration phase?',
    de: 'Diesen Zyklus in die Kalibrierungsphase versetzen?',
    ar: 'نقل هذه الدورة إلى مرحلة المعايرة؟',
  },
  confirmClose: {
    tr: 'Dönem kapatılsın mı? Sonuçlar çalışanlarla paylaşılır ve onay için bildirilir.',
    en: 'Close this cycle? Results will be shared with employees for acknowledgement.',
    de: 'Diesen Zyklus schließen? Die Ergebnisse werden den Mitarbeitern zur Bestätigung mitgeteilt.',
    ar: 'إغلاق هذه الدورة؟ ستتم مشاركة النتائج مع الموظفين للإقرار بها.',
  },
  confirmDeleteCycle: {
    tr: 'Bu dönem ve ona ait tüm değerlendirmeler silinsin mi?',
    en: 'Delete this cycle and all its reviews?',
    de: 'Diesen Zyklus und alle zugehörigen Bewertungen löschen?',
    ar: 'حذف هذه الدورة وجميع تقييماتها؟',
  },
  activatedMsg: {
    tr: 'Dönem başlatıldı',
    en: 'Cycle activated',
    de: 'Zyklus aktiviert',
    ar: 'تم تفعيل الدورة',
  },
  calibrationMsg: {
    tr: 'Dönem kalibrasyona alındı',
    en: 'Cycle moved to calibration',
    de: 'Zyklus zur Kalibrierung',
    ar: 'تم نقل الدورة إلى المعايرة',
  },
  closedMsg: {
    tr: 'Dönem kapatıldı',
    en: 'Cycle closed',
    de: 'Zyklus geschlossen',
    ar: 'تم إغلاق الدورة',
  },
  reviewsCreated: {
    tr: 'değerlendirme oluşturuldu',
    en: 'reviews created',
    de: 'Bewertungen erstellt',
    ar: 'تقييم تم إنشاؤه',
  },
  savedMsg: { tr: 'Kaydedildi', en: 'Saved', de: 'Gespeichert', ar: 'تم الحفظ' },
  submittedMsg: { tr: 'Gönderildi', en: 'Submitted', de: 'Eingereicht', ar: 'تم الإرسال' },
  nameRequired: {
    tr: 'Dönem adı zorunlu',
    en: 'Cycle name is required',
    de: 'Zyklusname ist erforderlich',
    ar: 'اسم الدورة مطلوب',
  },
  weightSumError: {
    tr: 'Ağırlıklar toplamı 100 olmalı',
    en: 'Weights must total 100',
    de: 'Gewichte müssen 100 ergeben',
    ar: 'يجب أن يكون مجموع الأوزان 100',
  },
  noActiveEmployees: {
    tr: 'Aktif çalışan yok',
    en: 'No active employees',
    de: 'Keine aktiven Mitarbeiter',
    ar: 'لا يوجد موظفون نشطون',
  },
  onlyDraftActivate: {
    tr: 'Yalnızca taslak dönem başlatılabilir',
    en: 'Only a draft cycle can be activated',
    de: 'Nur ein Entwurf kann aktiviert werden',
    ar: 'يمكن تفعيل الدورة المسودة فقط',
  },

  // --- Değerlendirmeler tablosu ---
  employee: { tr: 'Çalışan', en: 'Employee', de: 'Mitarbeiter', ar: 'الموظف' },
  reviewer: { tr: 'Değerlendiren', en: 'Reviewer', de: 'Bewerter', ar: 'المُقيِّم' },
  department: { tr: 'Departman', en: 'Department', de: 'Abteilung', ar: 'القسم' },
  status: { tr: 'Durum', en: 'Status', de: 'Status', ar: 'الحالة' },
  self: { tr: 'Öz', en: 'Self', de: 'Selbst', ar: 'ذاتي' },
  manager: { tr: 'Yönetici', en: 'Manager', de: 'Manager', ar: 'المدير' },
  overall: { tr: 'Genel Puan', en: 'Overall', de: 'Gesamt', ar: 'الإجمالي' },
  rating: { tr: 'Derece', en: 'Rating', de: 'Bewertung', ar: 'التقدير' },
  progress: { tr: 'İlerleme', en: 'Progress', de: 'Fortschritt', ar: 'التقدّم' },
  noReviews: {
    tr: 'Bu dönemde değerlendirme yok',
    en: 'No reviews in this cycle',
    de: 'Keine Bewertungen in diesem Zyklus',
    ar: 'لا توجد تقييمات في هذه الدورة',
  },
  openReview: {
    tr: 'Değerlendirmeyi Aç',
    en: 'Open Review',
    de: 'Bewertung öffnen',
    ar: 'فتح التقييم',
  },
  allStatuses: { tr: 'Tüm Durumlar', en: 'All Statuses', de: 'Alle Status', ar: 'كل الحالات' },
  allDepts: {
    tr: 'Tüm Departmanlar',
    en: 'All Departments',
    de: 'Alle Abteilungen',
    ar: 'كل الأقسام',
  },
  exportCsv: { tr: 'CSV Dışa Aktar', en: 'Export CSV', de: 'CSV exportieren', ar: 'تصدير CSV' },
  search: { tr: 'Ara...', en: 'Search...', de: 'Suchen...', ar: 'بحث...' },
  noReviewer: {
    tr: 'Yönetici atanmadı',
    en: 'No manager assigned',
    de: 'Kein Manager zugewiesen',
    ar: 'لا يوجد مدير معيّن',
  },
  selectCycle: { tr: 'Dönem seçin', en: 'Select a cycle', de: 'Zyklus wählen', ar: 'اختر دورة' },

  // --- Hedefler ---
  goals: { tr: 'Hedefler', en: 'Goals', de: 'Ziele', ar: 'الأهداف' },
  goal: { tr: 'Hedef', en: 'Goal', de: 'Ziel', ar: 'الهدف' },
  addGoal: { tr: 'Hedef Ekle', en: 'Add Goal', de: 'Ziel hinzufügen', ar: 'إضافة هدف' },
  goalTitle: { tr: 'Hedef Başlığı', en: 'Goal Title', de: 'Zieltitel', ar: 'عنوان الهدف' },
  goalDesc: {
    tr: 'Açıklama / Ölçüt',
    en: 'Description / Metric',
    de: 'Beschreibung / Messgröße',
    ar: 'الوصف / المقياس',
  },
  weight: { tr: 'Ağırlık (%)', en: 'Weight (%)', de: 'Gewicht (%)', ar: 'الوزن (%)' },
  noGoals: {
    tr: 'Henüz hedef eklenmedi',
    en: 'No goals added yet',
    de: 'Noch keine Ziele hinzugefügt',
    ar: 'لم تُضف أهداف بعد',
  },
  goalsHint: {
    tr: 'Bu dönem için ölçülebilir hedeflerinizi ekleyin ve kendinizi puanlayın',
    en: 'Add your measurable goals for this cycle and score yourself',
    de: 'Fügen Sie Ihre messbaren Ziele für diesen Zyklus hinzu und bewerten Sie sich',
    ar: 'أضف أهدافك القابلة للقياس لهذه الدورة وقيّم نفسك',
  },

  // --- Editör ---
  selfScore: { tr: 'Öz Puan', en: 'Self Score', de: 'Selbstbewertung', ar: 'التقييم الذاتي' },
  managerScore: {
    tr: 'Yönetici Puanı',
    en: 'Manager Score',
    de: 'Managerbewertung',
    ar: 'تقييم المدير',
  },
  selfComment: { tr: 'Öz Yorum', en: 'Self Comment', de: 'Selbstkommentar', ar: 'تعليق ذاتي' },
  managerComment: {
    tr: 'Yönetici Yorumu',
    en: 'Manager Comment',
    de: 'Managerkommentar',
    ar: 'تعليق المدير',
  },
  selfOverall: {
    tr: 'Genel Öz Değerlendirme',
    en: 'Overall Self-Assessment',
    de: 'Gesamt-Selbstbewertung',
    ar: 'التقييم الذاتي العام',
  },
  managerOverall: {
    tr: 'Genel Yönetici Değerlendirmesi',
    en: 'Overall Manager Assessment',
    de: 'Gesamtbewertung des Managers',
    ar: 'تقييم المدير العام',
  },
  submitSelf: {
    tr: 'Öz Değerlendirmeyi Gönder',
    en: 'Submit Self-Assessment',
    de: 'Selbstbewertung einreichen',
    ar: 'إرسال التقييم الذاتي',
  },
  submitManager: {
    tr: 'Değerlendirmeyi Tamamla',
    en: 'Complete Review',
    de: 'Bewertung abschließen',
    ar: 'إكمال التقييم',
  },
  acknowledge: {
    tr: 'Sonucu Onayla',
    en: 'Acknowledge Result',
    de: 'Ergebnis bestätigen',
    ar: 'الإقرار بالنتيجة',
  },
  acknowledgedMsg: {
    tr: 'Değerlendirme onaylandı',
    en: 'Review acknowledged',
    de: 'Bewertung bestätigt',
    ar: 'تم الإقرار بالتقييم',
  },
  notScored: { tr: 'Puanlanmadı', en: 'Not scored', de: 'Nicht bewertet', ar: 'لم يُقيَّم' },
  competencies: { tr: 'Yetkinlikler', en: 'Competencies', de: 'Kompetenzen', ar: 'الكفاءات' },
  scoreRequired: {
    tr: 'Lütfen tüm bölümleri puanlayın',
    en: 'Please score all sections',
    de: 'Bitte alle Abschnitte bewerten',
    ar: 'يرجى تقييم جميع الأقسام',
  },

  // --- Genel Bakış ---
  activeCycle: { tr: 'Aktif Dönem', en: 'Active Cycle', de: 'Aktiver Zyklus', ar: 'الدورة النشطة' },
  noActiveCycle: {
    tr: 'Aktif değerlendirme dönemi yok. Başlamak için bir dönem oluşturup başlatın.',
    en: 'No active review cycle. Create and activate one to start.',
    de: 'Kein aktiver Bewertungszyklus. Erstellen und aktivieren Sie einen.',
    ar: 'لا توجد دورة تقييم نشطة. أنشئ دورة وفعّلها للبدء.',
  },
  totalReviews: {
    tr: 'Toplam Değerlendirme',
    en: 'Total Reviews',
    de: 'Bewertungen gesamt',
    ar: 'إجمالي التقييمات',
  },
  completedCount: { tr: 'Tamamlanan', en: 'Completed', de: 'Abgeschlossen', ar: 'المكتملة' },
  completionRate: { tr: 'Tamamlanma', en: 'Completion', de: 'Abschlussquote', ar: 'نسبة الإكمال' },
  avgScore: { tr: 'Ortalama Puan', en: 'Average Score', de: 'Durchschnitt', ar: 'متوسط الدرجات' },
  ratingDistribution: {
    tr: 'Derece Dağılımı',
    en: 'Rating Distribution',
    de: 'Bewertungsverteilung',
    ar: 'توزيع التقديرات',
  },
  statusBreakdown: {
    tr: 'Durum Dağılımı',
    en: 'Status Breakdown',
    de: 'Status-Aufschlüsselung',
    ar: 'تفصيل الحالة',
  },

  // --- Kalibrasyon ---
  calibration: { tr: 'Kalibrasyon', en: 'Calibration', de: 'Kalibrierung', ar: 'المعايرة' },
  calibrationHint: {
    tr: 'Dereceleri gözden geçirin ve gerekirse ayarlayın. Aşağıda önerilen hedef dağılım vardır.',
    en: 'Review ratings and adjust if needed. A suggested target distribution is shown below.',
    de: 'Bewertungen prüfen und bei Bedarf anpassen. Unten eine empfohlene Zielverteilung.',
    ar: 'راجع التقديرات وعدّلها عند الحاجة. يوجد أدناه توزيع مستهدف مقترح.',
  },
  calibratedRating: {
    tr: 'Kalibre Derece',
    en: 'Calibrated Rating',
    de: 'Kalibrierte Bewertung',
    ar: 'التقدير المُعاير',
  },
  finalRating: {
    tr: 'Nihai Derece',
    en: 'Final Rating',
    de: 'Endbewertung',
    ar: 'التقدير النهائي',
  },
  targetDistribution: {
    tr: 'Önerilen Hedef Dağılım',
    en: 'Suggested Target Distribution',
    de: 'Empfohlene Zielverteilung',
    ar: 'التوزيع المستهدف المقترح',
  },
  calibrationOnly: {
    tr: "Kalibrasyon yalnızca dönem 'Kalibrasyon' veya 'Kapalı' durumundayken yapılabilir.",
    en: "Calibration is available when the cycle is in 'Calibration' or 'Closed'.",
    de: "Kalibrierung ist möglich, wenn der Zyklus 'Kalibrierung' oder 'Geschlossen' ist.",
    ar: "المعايرة متاحة عندما تكون الدورة في حالة 'المعايرة' أو 'مغلق'.",
  },
  saveCalibration: {
    tr: 'Kalibrasyonu Kaydet',
    en: 'Save Calibration',
    de: 'Kalibrierung speichern',
    ar: 'حفظ المعايرة',
  },
  onlyCompletedCalibrate: {
    tr: 'Yalnızca tamamlanmış değerlendirmeler kalibre edilir',
    en: 'Only completed reviews are calibrated',
    de: 'Nur abgeschlossene Bewertungen werden kalibriert',
    ar: 'تُعاير التقييمات المكتملة فقط',
  },

  // --- Self-servis ---
  myPerformance: { tr: 'Performansım', en: 'My Performance', de: 'Meine Leistung', ar: 'أدائي' },
  myReview: { tr: 'Değerlendirmem', en: 'My Review', de: 'Meine Bewertung', ar: 'تقييمي' },
  myGoals: { tr: 'Hedeflerim', en: 'My Goals', de: 'Meine Ziele', ar: 'أهدافي' },
  myTeam: { tr: 'Ekibim', en: 'My Team', de: 'Mein Team', ar: 'فريقي' },
  ssIntro: {
    tr: 'Aktif dönemdeki değerlendirmeniz, hedefleriniz ve geçmiş sonuçlarınız.',
    en: 'Your review, goals and past results for the active cycle.',
    de: 'Ihre Bewertung, Ziele und früheren Ergebnisse für den aktiven Zyklus.',
    ar: 'تقييمك وأهدافك ونتائجك السابقة للدورة النشطة.',
  },
  noMyReview: {
    tr: 'Aktif dönemde size ait bir değerlendirme yok.',
    en: 'You have no review in the active cycle.',
    de: 'Sie haben keine Bewertung im aktiven Zyklus.',
    ar: 'ليس لديك تقييم في الدورة النشطة.',
  },
  fillSelf: {
    tr: 'Öz Değerlendirmeyi Doldur',
    en: 'Fill Self-Assessment',
    de: 'Selbstbewertung ausfüllen',
    ar: 'املأ التقييم الذاتي',
  },
  awaitingManager: {
    tr: 'Yöneticinizin değerlendirmesi bekleniyor',
    en: "Awaiting your manager's review",
    de: 'Warten auf die Bewertung Ihres Managers',
    ar: 'بانتظار تقييم مديرك',
  },
  resultReady: {
    tr: 'Sonucunuz hazır',
    en: 'Your result is ready',
    de: 'Ihr Ergebnis ist bereit',
    ar: 'نتيجتك جاهزة',
  },
  teamIntro: {
    tr: 'Ekibinizdeki çalışanların değerlendirmelerini tamamlayın.',
    en: 'Complete reviews for your team members.',
    de: 'Bewertungen für Ihre Teammitglieder abschließen.',
    ar: 'أكمل تقييمات أعضاء فريقك.',
  },
  noTeamReviews: {
    tr: 'Değerlendirmeniz gereken bir ekip üyesi yok.',
    en: 'No team members to review.',
    de: 'Keine Teammitglieder zu bewerten.',
    ar: 'لا يوجد أعضاء فريق لتقييمهم.',
  },
  pastReviews: {
    tr: 'Geçmiş Değerlendirmeler',
    en: 'Past Reviews',
    de: 'Frühere Bewertungen',
    ar: 'التقييمات السابقة',
  },
  reviewFor: { tr: 'Değerlendirme', en: 'Review', de: 'Bewertung', ar: 'تقييم' },
  startSelf: {
    tr: 'Öz Değerlendirmeye Başla',
    en: 'Start Self-Assessment',
    de: 'Selbstbewertung beginnen',
    ar: 'ابدأ التقييم الذاتي',
  },
  score: { tr: 'Puan', en: 'Score', de: 'Punktzahl', ar: 'الدرجة' },

  // --- Özlük sekmesi ---
  ozlukTitle: {
    tr: 'Performans Değerlendirmeleri',
    en: 'Performance Reviews',
    de: 'Leistungsbewertungen',
    ar: 'تقييمات الأداء',
  },
  ozlukNone: {
    tr: 'Bu çalışan için performans değerlendirmesi bulunmuyor.',
    en: 'No performance reviews for this employee.',
    de: 'Keine Leistungsbewertungen für diesen Mitarbeiter.',
    ar: 'لا توجد تقييمات أداء لهذا الموظف.',
  },
  ozlukHint: {
    tr: 'Performans Yönetimi modülünden otomatik gösterilir (salt-görünüm).',
    en: 'Shown automatically from the Performance module (read-only).',
    de: 'Automatisch aus dem Leistungsmodul angezeigt (schreibgeschützt).',
    ar: 'يُعرض تلقائياً من وحدة الأداء (للعرض فقط).',
  },

  // --- Bildirimler ---
  notifSelfTitle: {
    tr: 'Öz değerlendirme zamanı',
    en: 'Time for self-assessment',
    de: 'Zeit für die Selbstbewertung',
    ar: 'حان وقت التقييم الذاتي',
  },
  notifManagerTitle: {
    tr: 'Değerlendirmeniz bekleniyor',
    en: 'A review awaits you',
    de: 'Eine Bewertung wartet auf Sie',
    ar: 'تقييم بانتظارك',
  },
  notifCompletedTitle: {
    tr: 'Değerlendirmeniz tamamlandı',
    en: 'Your review is complete',
    de: 'Ihre Bewertung ist abgeschlossen',
    ar: 'اكتمل تقييمك',
  },
  notifSelfDoneTitle: {
    tr: 'Öz değerlendirme gönderildi',
    en: 'Self-assessment submitted',
    de: 'Selbstbewertung eingereicht',
    ar: 'تم إرسال التقييم الذاتي',
  },
};

export function pl(key: string, lang: string): string {
  const row = DICT[key];
  if (!row) return key;
  return row[lang as Lang] || row.tr || key;
}

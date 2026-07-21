/**
 * ReportCatalog — raporlanabilir tablo/view ALLOWLIST'i (küratörlü).
 *
 * Yalnız buradaki ilişkiler kataloğa (GET /catalog) ve görsel sorgu kurucuya
 * (P2) çıkar. Kolonlar runtime'da information_schema'dan türetilir
 * (PgSchemaCatalogReader) — burada elle kolon tutulmaz (drift riski yok).
 *
 * GÜVENLİK: Hassas kaynaklar (users, sessions, password_resets, access_*,
 * einvoice_credentials, *_token/*_secret kolonları) buraya ASLA eklenmez ve
 * ham SQL tarafında da SqlGuard.BLOCKED_RELATIONS ile engellenir.
 *
 * Yeni bir ilişki eklerken: hassas veri içermediğinden emin ol; içeriyorsa
 * önce güvenli bir VIEW (örn. v_*_public) oluştur, onu allowlist'e ekle.
 */

export type RelationKind = 'table' | 'view';

export interface RelationDef {
  /** Görünen ad (TR). */
  label: string;
  kind: RelationKind;
  /** Katalog gruplaması (FE'de başlık). */
  group: string;
}

export const ALLOWED_RELATIONS: Readonly<Record<string, RelationDef>> = {
  // --- Finans ---
  invoices: { label: 'Faturalar', kind: 'table', group: 'Finans' },
  expense_cards: { label: 'Gider Kartları', kind: 'table', group: 'Finans' },
  invoice_payments: { label: 'Fatura Ödemeleri', kind: 'table', group: 'Finans' },
  banks: { label: 'Bankalar', kind: 'table', group: 'Finans' },
  bank_accounts: { label: 'Banka Hesapları', kind: 'table', group: 'Finans' },
  kasa_accounts: { label: 'Kasalar', kind: 'table', group: 'Finans' },
  kasa_entries: { label: 'Kasa Hareketleri', kind: 'table', group: 'Finans' },
  transfers: { label: 'Transferler', kind: 'table', group: 'Finans' },
  v_bank_balances: { label: 'Banka Bakiyeleri (görünüm)', kind: 'view', group: 'Finans' },
  v_kasa_balances: { label: 'Kasa Bakiyeleri (görünüm)', kind: 'view', group: 'Finans' },
  v_invoice_alerts: { label: 'Fatura Uyarıları (görünüm)', kind: 'view', group: 'Finans' },

  // --- Nakit Akış / Şirket ---
  companies: { label: 'Şirketler', kind: 'table', group: 'Genel' },
  categories: { label: 'Kategoriler', kind: 'table', group: 'Nakit Akış' },
  cells: { label: 'Nakit Akış Hücreleri', kind: 'table', group: 'Nakit Akış' },
  v_company_summary: { label: 'Şirket Özeti (görünüm)', kind: 'view', group: 'Nakit Akış' },

  // --- Cari ---
  finance_parties: { label: 'Cari Kartları', kind: 'table', group: 'Cari' },

  // --- HR ---
  employees: { label: 'Çalışanlar', kind: 'table', group: 'İK' },
  org_units: { label: 'Organizasyon Birimleri', kind: 'table', group: 'İK' },
  departments: { label: 'Departmanlar', kind: 'table', group: 'İK' },
  positions: { label: 'Pozisyonlar', kind: 'table', group: 'İK' },
  hr_payroll_runs: { label: 'Bordro Dönemleri', kind: 'table', group: 'İK' },
  hr_payroll_items: { label: 'Bordro Kalemleri', kind: 'table', group: 'İK' },
  hr_leave_requests: { label: 'İzin Talepleri', kind: 'table', group: 'İK' },
  hr_assets: { label: 'Zimmet / Varlıklar', kind: 'table', group: 'İK' },
  hr_perf_cycles: { label: 'Performans Dönemleri', kind: 'table', group: 'İK' },
  hr_perf_reviews: { label: 'Performans Değerlendirmeleri', kind: 'table', group: 'İK' },

  // --- Sabit Kıymet ---
  fixed_assets: { label: 'Sabit Kıymetler', kind: 'table', group: 'Sabit Kıymet' },
  fixed_asset_movements: {
    label: 'Sabit Kıymet Hareketleri',
    kind: 'table',
    group: 'Sabit Kıymet',
  },
  fixed_asset_depreciation_runs: {
    label: 'Amortisman Koşumları',
    kind: 'table',
    group: 'Sabit Kıymet',
  },

  // --- Şantiye ---
  construction_journal_entries: {
    label: 'Şantiye Yevmiye Fişleri',
    kind: 'table',
    group: 'Şantiye',
  },
  construction_journal_lines: {
    label: 'Şantiye Yevmiye Satırları',
    kind: 'table',
    group: 'Şantiye',
  },

  // --- Uygulama Aynası (app-state blob → SQL; 044_app_state_mirror.sql) ---
  // company_id TEXT'tir ('0' = global; aksi halde blob companyData anahtarı,
  // örn. "comp_promet"). Hassas anahtarlar projeksiyon sırasında silinir.
  app_state_entities: {
    label: 'Uygulama Durumu Aynası (ham JSONB)',
    kind: 'table',
    group: 'Uygulama Aynası',
  },
  v_hr_employees: { label: 'Çalışanlar (blob görünüm)', kind: 'view', group: 'Uygulama Aynası' },
  v_acc_journal_entries: {
    label: 'Yevmiye Fişleri (blob görünüm)',
    kind: 'view',
    group: 'Uygulama Aynası',
  },
  v_acc_journal_lines: {
    label: 'Yevmiye Satırları (blob görünüm)',
    kind: 'view',
    group: 'Uygulama Aynası',
  },
  v_blob_invoices: { label: 'Faturalar (blob görünüm)', kind: 'view', group: 'Uygulama Aynası' },
  v_bank_entries: {
    label: 'Banka Hareketleri (blob görünüm)',
    kind: 'view',
    group: 'Uygulama Aynası',
  },
  v_kasa_entries: {
    label: 'Kasa Hareketleri (blob görünüm)',
    kind: 'view',
    group: 'Uygulama Aynası',
  },
  v_loans: { label: 'Krediler (blob görünüm)', kind: 'view', group: 'Uygulama Aynası' },
  v_checks: { label: 'Çek/Senet (blob görünüm)', kind: 'view', group: 'Uygulama Aynası' },
  v_manual_payments: {
    label: 'Manuel Planlı Ödemeler (blob görünüm)',
    kind: 'view',
    group: 'Uygulama Aynası',
  },
  v_crm_deals: { label: 'CRM Fırsatları (blob görünüm)', kind: 'view', group: 'Uygulama Aynası' },
  v_tasks: { label: 'Görevler (blob görünüm)', kind: 'view', group: 'Uygulama Aynası' },
  v_purchase_requests: {
    label: 'Satınalma Talepleri (blob görünüm)',
    kind: 'view',
    group: 'Uygulama Aynası',
  },
  v_purchase_orders: {
    label: 'Satınalma Siparişleri (blob görünüm)',
    kind: 'view',
    group: 'Uygulama Aynası',
  },
  v_projects: { label: 'Projeler (blob görünüm)', kind: 'view', group: 'Uygulama Aynası' },
  v_users: {
    label: 'Kullanıcılar (blob görünüm, parolasız)',
    kind: 'view',
    group: 'Uygulama Aynası',
  },

  // --- Depo / Stok ---
  warehouses: { label: 'Depolar', kind: 'table', group: 'Depo' },
  materials: { label: 'Malzemeler', kind: 'table', group: 'Depo' },
  stock_movements: { label: 'Stok Hareketleri', kind: 'table', group: 'Depo' },
  material_groups: { label: 'Malzeme Grupları', kind: 'table', group: 'Depo' },
  units: { label: 'Birimler', kind: 'table', group: 'Depo' },

  // --- Üretim ---
  production_orders: { label: 'Üretim Emirleri', kind: 'table', group: 'Üretim' },
  production_boms: { label: 'Reçeteler (BOM)', kind: 'table', group: 'Üretim' },
  production_work_centers: { label: 'İş Merkezleri', kind: 'table', group: 'Üretim' },

  // --- Sistem ---
  audit_logs: { label: 'Denetim Kayıtları', kind: 'table', group: 'Sistem' },
};

/** Verilen ilişki (tablo/view) raporlanabilir allowlist'te mi? */
export function isReportableRelation(relation: string): boolean {
  return Object.prototype.hasOwnProperty.call(ALLOWED_RELATIONS, relation);
}

/** Allowlist'teki tüm ilişki adları (information_schema sorgusu için). */
export function listAllowedRelations(): string[] {
  return Object.keys(ALLOWED_RELATIONS);
}

/** Kolon bazında gizlenecek hassas isimler (kataloğa çıkmaz). */
export function isSensitiveColumn(column: string): boolean {
  return /(password|secret|token|hash|salt|api_key)/i.test(column);
}

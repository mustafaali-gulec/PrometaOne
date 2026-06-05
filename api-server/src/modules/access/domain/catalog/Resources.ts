/**
 * RESOURCES — backend mirror of the frontend `RESOURCES` catalog (App.jsx ~3789).
 *
 * Her resource bir modüle, etikete ve izin verilen aksiyon listesine sahiptir.
 * Permission string'leri `resource.action` formatındadır (örn 'hr.employees.view').
 *
 * NOT: Frontend katalogundaki `legacyPerm` alanı SADECE frontend'e özgü olduğu
 * için backend mirror'a TAŞINMAMIŞTIR (bkz. PermissionResolver sapma notu).
 */

export const ACTIONS = ['view', 'create', 'update', 'delete', 'export', 'approve'] as const;

export type Action = (typeof ACTIONS)[number];

export interface ResourceDef {
  module: string;
  label: string;
  actions: ReadonlyArray<Action>;
}

export const RESOURCES: Readonly<Record<string, ResourceDef>> = {
  // Finans
  'finance.dashboard': { module: 'Finans', label: 'Genel Bakış', actions: ['view'] },
  'finance.cashflow': {
    module: 'Finans',
    label: 'Nakit Akış Tablosu',
    actions: ['view', 'update', 'export'],
  },
  'finance.banks': {
    module: 'Finans',
    label: 'Bankalar',
    actions: ['view', 'create', 'update', 'delete', 'export'],
  },
  'finance.bank_entries': {
    module: 'Finans',
    label: 'Banka Hareketleri',
    actions: ['view', 'create', 'update', 'delete'],
  },
  'finance.kasa': {
    module: 'Finans',
    label: 'Kasa',
    actions: ['view', 'create', 'update', 'delete', 'export'],
  },
  'finance.loans': {
    module: 'Finans',
    label: 'Krediler',
    actions: ['view', 'create', 'update', 'delete'],
  },
  'finance.invoices': {
    module: 'Finans',
    label: 'Faturalar (Manuel)',
    actions: ['view', 'create', 'update', 'delete', 'export'],
  },
  'finance.einvoice': {
    module: 'Finans',
    label: 'e-Fatura (Logo eLogo)',
    actions: ['view', 'create', 'update'],
  },
  'finance.transfers': {
    module: 'Finans',
    label: 'Transferler',
    actions: ['view', 'create', 'update', 'delete'],
  },
  'finance.fx': {
    module: 'Finans',
    label: 'Kur Farkı Değerlemesi',
    actions: ['view', 'create', 'update', 'delete'],
  },
  'finance.ai_prediction': { module: 'Finans', label: 'AI Tahmin', actions: ['view'] },
  'finance.reports': { module: 'Finans', label: 'Raporlar', actions: ['view', 'export'] },
  'finance.categories': {
    module: 'Finans',
    label: 'Kategoriler',
    actions: ['view', 'create', 'update', 'delete'],
  },
  'finance.archives': {
    module: 'Finans',
    label: 'Arşivler',
    actions: ['view', 'create', 'delete'],
  },

  // HR
  'hr.organization': {
    module: 'HR',
    label: 'Organizasyon Birimleri',
    actions: ['view', 'create', 'update', 'delete'],
  },
  'hr.departments': {
    module: 'HR',
    label: 'Departmanlar',
    actions: ['view', 'create', 'update', 'delete'],
  },
  'hr.job_titles': {
    module: 'HR',
    label: 'Pozisyon Tanımları',
    actions: ['view', 'create', 'update', 'delete'],
  },
  'hr.employees': {
    module: 'HR',
    label: 'Çalışanlar',
    actions: ['view', 'create', 'update', 'delete', 'export'],
  },
  'hr.recruitment': { module: 'HR', label: 'İşe Alım Süreci', actions: ['view', 'update'] },
  'hr.positions': {
    module: 'HR',
    label: 'Açık Pozisyonlar',
    actions: ['view', 'create', 'update', 'delete'],
  },
  'hr.candidates': {
    module: 'HR',
    label: 'Adaylar',
    actions: ['view', 'create', 'update', 'delete'],
  },
  'hr.interviews': {
    module: 'HR',
    label: 'Mülakatlar',
    actions: ['view', 'create', 'update', 'delete'],
  },
  'hr.payroll': {
    module: 'HR',
    label: 'Bordro',
    actions: ['view', 'create', 'update', 'delete', 'export'],
  },
  // Faz B-1 / B-3 yeni dilimler — "RBAC RESOURCES sync" kuralı gereği eklendi
  'hr.leave': {
    module: 'HR',
    label: 'İzin Yönetimi',
    actions: ['view', 'create', 'update', 'delete'],
  },
  'hr.assets': {
    module: 'HR',
    label: 'Zimmet / Varlık',
    actions: ['view', 'create', 'update', 'delete'],
  },

  // Muhasebe
  'accounting.coa': {
    module: 'Muhasebe',
    label: 'Hesap Planı / Muhasebe',
    actions: ['view', 'create', 'update', 'delete', 'export'],
  },
  'accounting.journal': {
    module: 'Muhasebe',
    label: 'Yevmiye Fişleri',
    actions: ['view', 'create', 'update', 'delete', 'export'],
  },
  'accounting.parties': {
    module: 'Muhasebe',
    label: 'Cari Yönetimi (Cari/Tedarikçi)',
    actions: ['view', 'create', 'update', 'delete', 'export'],
  },
  'accounting.budget': {
    module: 'Muhasebe',
    label: 'Bütçe',
    actions: ['view', 'create', 'update', 'delete', 'export'],
  },

  // Satınalma
  'purchasing.vendors': {
    module: 'Satınalma',
    label: 'Tedarikçiler (Cari)',
    actions: ['view', 'create', 'update', 'delete'],
  },
  'purchasing.requests': {
    module: 'Satınalma',
    label: 'Satınalma Talepleri',
    actions: ['view', 'create', 'update', 'delete'],
  },
  'purchasing.orders': {
    module: 'Satınalma',
    label: 'Satınalma Siparişleri',
    actions: ['view', 'create', 'update', 'delete'],
  },

  // Şantiye Yönetim (Construction)
  'construction.projects': {
    module: 'Şantiye',
    label: 'Projeler & Şantiyeler',
    actions: ['view', 'create', 'update', 'delete'],
  },
  'construction.contracts': {
    module: 'Şantiye',
    label: 'Sözleşme & İhale',
    actions: ['view', 'create', 'update', 'delete', 'export'],
  },
  'construction.boq': {
    module: 'Şantiye',
    label: 'Keşif & Pursantaj',
    actions: ['view', 'create', 'update', 'delete', 'export'],
  },
  'construction.measurements': {
    module: 'Şantiye',
    label: 'Metraj / Yeşil Defter / Ataşman',
    actions: ['view', 'create', 'update', 'delete'],
  },
  'construction.progress': {
    module: 'Şantiye',
    label: 'Hakediş',
    actions: ['view', 'create', 'update', 'delete', 'export', 'approve'],
  },
  'construction.expenses': {
    module: 'Şantiye',
    label: 'Harcama & Finans',
    actions: ['view', 'create', 'update', 'delete', 'export'],
  },
  'construction.advances': {
    module: 'Şantiye',
    label: 'Avanslar',
    actions: ['view', 'create', 'update', 'delete'],
  },
  'construction.materials': {
    module: 'Şantiye',
    label: 'Malzeme & Depo / Stok',
    actions: ['view', 'create', 'update', 'delete', 'export'],
  },
  'construction.material_requests': {
    module: 'Şantiye',
    label: 'Malzeme Talebi',
    actions: ['view', 'create', 'update', 'delete', 'approve'],
  },
  'construction.timesheets': {
    module: 'Şantiye',
    label: 'Puantaj & İşgücü',
    actions: ['view', 'create', 'update', 'delete', 'export'],
  },
  'construction.machinery': {
    module: 'Şantiye',
    label: 'Makine Parkı',
    actions: ['view', 'create', 'update', 'delete', 'export'],
  },
  'construction.reports': {
    module: 'Şantiye',
    label: 'Şantiye Raporları & Analitik',
    actions: ['view', 'export'],
  },
  'construction.settings': {
    module: 'Şantiye',
    label: 'Poz Katalog / Fire / Ayar',
    actions: ['view', 'create', 'update', 'delete'],
  },

  // Sistem
  'system.users': {
    module: 'Sistem',
    label: 'Kullanıcılar',
    actions: ['view', 'create', 'update', 'delete'],
  },
  'system.roles': {
    module: 'Sistem',
    label: 'Roller ve İzinler',
    actions: ['view', 'create', 'update', 'delete'],
  },
  'system.approvals': {
    module: 'Sistem',
    label: 'Onaylar',
    actions: ['view', 'create', 'update', 'delete'],
  },
  'system.audit': { module: 'Sistem', label: 'Denetim Kayıtları', actions: ['view', 'export'] },
  'system.companies': {
    module: 'Sistem',
    label: 'Şirketler',
    actions: ['view', 'create', 'update', 'delete'],
  },
  'system.settings': { module: 'Sistem', label: 'Genel Ayarlar', actions: ['view', 'update'] },
  'system.notifications': {
    module: 'Sistem',
    label: 'Bildirim Ayarları',
    actions: ['view', 'update'],
  },
};

/** Verilen resource katalogda var mı? */
export function isKnownResource(resource: string): boolean {
  return Object.prototype.hasOwnProperty.call(RESOURCES, resource);
}

/** Verilen action, resource için izin verilen aksiyonlardan biri mi? */
export function isAllowedAction(resource: string, action: string): boolean {
  const def = RESOURCES[resource];
  if (def === undefined) return false;
  return (def.actions as ReadonlyArray<string>).includes(action);
}

/**
 * reconcileAppState — Yerel (localStorage) ile Uzak (backend /v1/app-state) veri
 * blob'unu UZLAŞTIRMA kararı veren SAF fonksiyon. Yan etki yok; çağıran uygular.
 *
 * NEDEN: 2026-06-29'da bir veri kaybı yaşandı — eski sync, girişte backend blob'unu
 * KOŞULSUZ benimseyip kullanıcının gerçek verisini tohum blob'la ezdi. Bu modül o
 * sınıf hatayı YAPISAL olarak imkânsız kılar.
 *
 * DEĞİŞMEZ KURAL (YEREL OTORİTER): Yerel blob GERÇEK kullanıcı verisi taşıyorsa
 * (computeRealScore > 0), uzak blob ne olursa olsun ASLA benimsenmez → push-local
 * (yerel kazanır; backend yereldeki veriyle güncellenir/onarılır). Uzak blob YALNIZCA
 * yerel boş/tohum (skor 0) iken benimsenir (meşru yeni cihaz / temiz başlangıç) — bu
 * durumda kaybedilecek gerçek veri yoktur. Cihazlar-arası SİLME/birleştirme otomatik
 * yayılmaz; bu, veri kaybını imkânsız kılmak için kabul edilen kayıpsız bir sınırlamadır.
 *
 * computeRealScore TASARIMI: allowlist KULLANMAZ. Her şirketteki TÜM dizi alanlarını
 * sayar (tohum-katalog alanları için bilinen tabanı düşerek). Böylece bir alanı
 * "unutmak" GÜVENLİ tarafa hata yapar (fazla-sayar → yerel korunur), allowlist'in
 * tehlikeli "az-sayar → yereli kaybet" davranışının tersine. Eski (companyData'sız)
 * düz-format blob'da kök seviyeyi tarar.
 */

// Tohumda DOLU gelen per-company alanlar ve DEFAULT_SEED taban sayıları.
// Yalnızca TABANDAN fazlası gerçek-veri sayılır. (DEFAULT_SEED değişirse güncelle;
// reconcileAppState.test.ts'teki "tohum skoru 0" testi sapmayı yakalar.)
const SEED_BASELINE = {
  inflows: 10,
  outflows: 23,
  nonPnlOutflows: 6,
  accChartOfAccounts: 326,
  kasaCategories: 12,
  kasaAccounts: 1, // createEmptyCompanyData 1 varsayılan 'Merkez Kasa' getirebilir
  hrDepartments: 8,
  hrPayrollComponents: 18,
  hrQuestions: 13,
  hrInterviewKits: 3,
  hrCompPolicies: 4,
  hrOrgUnits: 1,
};

export function isValidBlob(blob) {
  return !!(
    blob &&
    typeof blob === 'object' &&
    (blob.companyData || blob.companies || blob.activeCompanyId !== undefined)
  );
}

// Tek bir şirket nesnesinin gerçek-veri "hacmi".
function scoreCompany(co) {
  if (!co || typeof co !== 'object') return 0;
  let s = 0;
  for (const k of Object.keys(co)) {
    const v = co[k];
    if (Array.isArray(v)) {
      s += Math.max(0, v.length - (SEED_BASELINE[k] || 0));
    }
  }
  // cells: hesap tablosu hücreleri (obje) — gerçek kullanıcı verisidir
  if (co.cells && typeof co.cells === 'object' && !Array.isArray(co.cells)) {
    s += Object.keys(co.cells).length;
  }
  // openingCash: tohumda 0; girilmişse sinyal
  if (typeof co.openingCash === 'number' && co.openingCash !== 0) s += 1;
  return s;
}

/**
 * computeRealScore — blob'taki kullanıcı-üretimi veri "hacmi". TOHUM/BOŞ = 0.
 * Tüm şirketlerdeki TÜM dizi alanları (taban düşülerek) + cells + openingCash + (gerçek
 * veri varsa çoklu-şirket sinyali). Eski düz-format (companyData yok) için kök taranır.
 */
export function computeRealScore(blob) {
  if (!blob || typeof blob !== 'object') return 0;
  const cd = blob.companyData && typeof blob.companyData === 'object' ? blob.companyData : null;
  if (!cd) {
    // Legacy düz-format: per-company alanlar üst düzeyde
    return scoreCompany(blob);
  }
  let score = 0;
  for (const cid of Object.keys(cd)) {
    score += scoreCompany(cd[cid]);
  }
  // Birden fazla şirket YALNIZCA gerçek veri varsa ek sinyal (boş çoklu-şirket sayılmaz)
  if (Array.isArray(blob.companies) && blob.companies.length > 1 && score > 0) score += 1;
  return score;
}

/**
 * reconcileAppState — uzlaştırma kararı (YEREL OTORİTER).
 * @param {object|null} localValue  yereldeki (localStorage) blob — modern şemaya migrate edilmiş olmalı
 * @param {object|null} remoteValue backend blob'u — ÇAĞIRAN reconcile'dan ÖNCE migrate etmeli (legacy düz-format normalize)
 * @param {'ok'|'missing'|'error'|'offline'} remoteStatus  GET sonucu
 * @returns {{action:'seed-backend'|'adopt-remote'|'push-local'|'keep-local', reason:string, localScore:number, remoteScore:number}}
 *   - seed-backend : backend boş (404) → mevcut yereli yukarı yaz (kayıpsız tohumlama)
 *   - adopt-remote : uzak blob'u benimse (YALNIZCA yerel boş/tohum iken)
 *   - push-local   : yerel kazanır (gerçek veri var); backend'i yereldeki veriyle güncelle/onar
 *   - keep-local   : hiçbir şey yapma (uzak erişilemez/geçersiz veya iki taraf da boş/tohum)
 */
export function reconcileAppState(localValue, remoteValue, remoteStatus) {
  if (remoteStatus === 'missing') {
    return {
      action: 'seed-backend',
      reason: 'remote-404',
      localScore: computeRealScore(localValue),
      remoteScore: 0,
    };
  }
  if (remoteStatus !== 'ok' || !isValidBlob(remoteValue)) {
    return {
      action: 'keep-local',
      reason: 'remote-unavailable-or-invalid',
      localScore: computeRealScore(localValue),
      remoteScore: 0,
    };
  }

  const localValid = isValidBlob(localValue);
  const localScore = localValid ? computeRealScore(localValue) : 0;
  const remoteScore = computeRealScore(remoteValue);

  if (!localValid || localScore === 0) {
    // Yerel boş/tohum → kaybedilecek GERÇEK veri yok. Uzak gerçek veri taşıyorsa benimse
    // (meşru yeni cihaz / temiz başlangıç); uzak da boş/tohumsa yerelle kal.
    if (remoteScore > 0) {
      return {
        action: 'adopt-remote',
        reason: localValid ? 'local-seed-remote-richer' : 'no-local',
        localScore,
        remoteScore,
      };
    }
    return { action: 'keep-local', reason: 'both-empty-or-seed', localScore, remoteScore };
  }

  // Yerel GERÇEK veri taşıyor → ASLA sessizce ezme. Yerel otoriter: backend'i yereldeki
  // veriyle güncelle/onar (kota-bağımsız kalıcılık + bayat/tohum backend onarımı).
  return { action: 'push-local', reason: 'local-has-data-authoritative', localScore, remoteScore };
}

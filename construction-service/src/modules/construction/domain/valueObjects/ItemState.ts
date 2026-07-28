/**
 * ItemState — fiziksel takipte bir iş kaleminin saha durumu.
 * Tablo: cs_tracking_items.state (006_physical_progress.sql).
 *
 * Şantiye şefinin tik attığı 4 durum. Yüzde karşılıkları ŞABLONDA ayarlanabilir
 * (cs_progress_templates.pct_in_progress / pct_has_defects) çünkü firmalar
 * "devam ediyor" ifadesini farklı ağırlıklandırır: kimi %50, kimi %30 sayar.
 * 'not_started' her zaman 0, 'completed' her zaman 100 — bunlar sabit.
 *
 * 'has_defects' (Eksikleri Var) tamamlanmadan YÜKSEK bir yüzde taşır (varsayılan
 * %75) ve kasıtlıdır: iş fiilen bitmiştir, kalan sadece düzeltme kalemidir.
 * Hakediş ödemesi bu duruma göre yapılmaz — fiziksel ilerleme ölçüsüdür.
 */
export const ITEM_STATES = ['not_started', 'in_progress', 'has_defects', 'completed'] as const;
export type ItemState = (typeof ITEM_STATES)[number];

export function isItemState(v: unknown): v is ItemState {
  return typeof v === 'string' && (ITEM_STATES as readonly string[]).includes(v);
}

/** Şablonun durum→yüzde eşlemesi. */
export interface StatePctMap {
  inProgress: number;
  hasDefects: number;
}

export const DEFAULT_STATE_PCT: StatePctMap = { inProgress: 50, hasDefects: 75 };

/**
 * Durumun yüzde karşılığı. `overridePct` doluysa (kısmi imalat girişi) o kazanır.
 * DB'deki cs_v_tracking_item_pct view'ı ile AYNI mantık — biri değişirse diğeri
 * de değişmeli (rapor ile ekran birbirini tutmalı).
 */
export function itemStatePct(
  state: ItemState,
  map: StatePctMap = DEFAULT_STATE_PCT,
  overridePct?: number | null,
): number {
  if (overridePct !== null && overridePct !== undefined) return overridePct;
  switch (state) {
    case 'not_started':
      return 0;
    case 'in_progress':
      return map.inProgress;
    case 'has_defects':
      return map.hasDefects;
    case 'completed':
      return 100;
  }
}

/**
 * Ağırlıklı ilerleme hesabı — DB view'ının TypeScript ikizi.
 *
 *   ilerleme = Σ(yüzde × iş ağırlığı × grup ağırlığı) / Σ(iş ağırlığı × grup ağırlığı)
 *
 * Ağırlık toplamına bölmek, ağırlıkların tam 100'e tümlenmediği (eksik/fazla
 * girilmiş) şablonlarda da tutarlı sonuç verir. Ağırlık toplamı 0 ise 0 döner.
 */
export interface WeightedItem {
  pct: number;
  itemWeight: number;
  groupWeight: number;
}

export function rollupWeighted(items: ReadonlyArray<WeightedItem>): number {
  let num = 0;
  let den = 0;
  for (const it of items) {
    const w = it.itemWeight * it.groupWeight;
    num += it.pct * w;
    den += w;
  }
  return den === 0 ? 0 : num / den;
}

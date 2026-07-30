/**
 * Makine parkı değer nesneleri (FAZ 9) — saf fonksiyonlar, birim testli.
 *
 * BAKIM VADESİ iki tipten hesaplanır:
 *   meter : bir sonraki vade = son yapılan sayaç + aralık; kalan = vade − güncel sayaç
 *   days  : bir sonraki vade = son yapılan tarih + aralık gün; kalan = vade − bugün
 * Son yapılan kaydı YOKSA vade hesaplanamaz ve null döner — "hiç bakım
 * görmemiş" makineye uydurma vade yazmak yanlış güven verir; arayüz bunu
 * "ilk bakım kaydı bekleniyor" olarak gösterir.
 *
 * GARANTİ iki sınırlıdır (tarih VE sayaç): hangisi önce dolarsa biter — araç
 * garantisinin "2 yıl / 100.000 km" mantığı. İkisi de boşsa garanti bilgisi
 * YOK demektir (bitti değil).
 */

export const METER_TYPES = ['km', 'hour'] as const;
export type MeterType = (typeof METER_TYPES)[number];

export const MAINTENANCE_INTERVAL_TYPES = ['meter', 'days'] as const;
export type MaintenanceIntervalType = (typeof MAINTENANCE_INTERVAL_TYPES)[number];

export const RENTAL_PERIODS = ['daily', 'monthly'] as const;
export type RentalPeriod = (typeof RENTAL_PERIODS)[number];

const DAY = 86_400_000;
const toMs = (d: string): number => Date.parse(`${d}T00:00:00Z`);
const toDateStr = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export interface MaintenancePlanLike {
  intervalType: MaintenanceIntervalType;
  intervalValue: number;
  lastDoneMeter: number | null;
  lastDoneDate: string | null;
}

export interface MaintenanceDue {
  /** meter tipinde: vade sayacı; days tipinde null. */
  nextDueMeter: number | null;
  /** days tipinde: vade tarihi; meter tipinde null. */
  nextDueDate: string | null;
  /**
   * Kalan (meter: sayaç birimi, days: gün). NEGATİF = vade geçmiş.
   * Son yapılan kaydı yoksa null — vade hesaplanamaz.
   */
  remaining: number | null;
  /** Vade geçmiş mi; hesaplanamıyorsa null. */
  overdue: boolean | null;
}

/** Plan vadesi. `currentMeter` makinenin güncel sayacı, `today` YYYY-MM-DD. */
export function computeMaintenanceDue(
  plan: MaintenancePlanLike,
  currentMeter: number,
  today: string,
): MaintenanceDue {
  if (plan.intervalType === 'meter') {
    if (plan.lastDoneMeter === null) {
      return { nextDueMeter: null, nextDueDate: null, remaining: null, overdue: null };
    }
    const nextDueMeter = plan.lastDoneMeter + plan.intervalValue;
    const remaining = round1(nextDueMeter - currentMeter);
    return {
      nextDueMeter: round1(nextDueMeter),
      nextDueDate: null,
      remaining,
      overdue: remaining < 0,
    };
  }
  if (plan.lastDoneDate === null) {
    return { nextDueMeter: null, nextDueDate: null, remaining: null, overdue: null };
  }
  const nextMs = toMs(plan.lastDoneDate) + plan.intervalValue * DAY;
  const remaining = Math.round((nextMs - toMs(today)) / DAY);
  return {
    nextDueMeter: null,
    nextDueDate: toDateStr(nextMs),
    remaining,
    overdue: remaining < 0,
  };
}

export interface WarrantyStatus {
  /** true = garanti sürüyor; false = bitti; null = garanti bilgisi girilmemiş. */
  inWarranty: boolean | null;
  /** Tarihe göre kalan gün (sınır girilmişse); negatif = geçmiş. */
  daysLeft: number | null;
  /** Sayaca göre kalan (sınır girilmişse); negatif = aşılmış. */
  meterLeft: number | null;
}

/** İki sınırdan HANGİSİ ÖNCE DOLARSA garanti biter. */
export function computeWarrantyStatus(
  warrantyUntil: string | null,
  warrantyMeter: number | null,
  currentMeter: number,
  today: string,
): WarrantyStatus {
  const daysLeft =
    warrantyUntil === null ? null : Math.round((toMs(warrantyUntil) - toMs(today)) / DAY);
  const meterLeft = warrantyMeter === null ? null : round1(warrantyMeter - currentMeter);
  if (daysLeft === null && meterLeft === null) {
    return { inWarranty: null, daysLeft: null, meterLeft: null };
  }
  const dateOk = daysLeft === null || daysLeft >= 0;
  const meterOk = meterLeft === null || meterLeft >= 0;
  return { inWarranty: dateOk && meterOk, daysLeft, meterLeft };
}

/** Kiralamada kalan gün; kiralama bilgisi yoksa null. Negatif = süre dolmuş. */
export function rentalDaysLeft(rentalEnd: string | null, today: string): number | null {
  if (rentalEnd === null) return null;
  return Math.round((toMs(rentalEnd) - toMs(today)) / DAY);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

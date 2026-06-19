/**
 * Clock — deterministik zaman portu (test'lerde sabitlenebilir).
 *
 * Finance modülündeki Clock ile aynı kontrat (modüller arası bağımlılık
 * yaratmamak için kopyalanmıştır).
 */
export interface Clock {
  now(): Date;
}

export const SystemClock: Clock = {
  now: () => new Date(),
};

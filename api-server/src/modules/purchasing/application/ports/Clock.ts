/**
 * Clock — deterministik zaman portu (test'lerde sabitlenebilir).
 */
export interface Clock {
  now(): Date;
}

export const SystemClock: Clock = {
  now: () => new Date(),
};

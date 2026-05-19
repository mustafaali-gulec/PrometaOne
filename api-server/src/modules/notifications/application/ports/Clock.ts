/** Clock port'u — testte sabit zaman, prod'da `new Date()`. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

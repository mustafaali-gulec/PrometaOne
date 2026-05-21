/** Auth/Notifications modüllerindeki Clock ile aynı semantik. Test'te override edilebilir. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

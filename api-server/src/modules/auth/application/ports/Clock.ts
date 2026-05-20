/** Notifications modülündeki Clock ile aynı. Test'te override edilebilir. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

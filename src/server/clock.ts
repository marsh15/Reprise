export function createClock(override?: string) {
  return {
    now: (): Date => override ? new Date(override) : new Date(),
    isOverridden: (): boolean => override !== undefined,
  };
}

export type Clock = ReturnType<typeof createClock>;

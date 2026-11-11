import { expect, it, vi } from 'vitest';
import { createClock } from '../../src/server/clock';

it('uses real time unless an override was supplied', () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date('2026-11-11T08:30:00Z'));
    const clock = createClock();
    expect(clock.isOverridden()).toBe(false);
    expect(clock.now().toISOString()).toBe('2026-11-11T08:30:00.000Z');
  } finally {
    vi.useRealTimers();
  }
});

it('keeps the test instant fixed and returns independent Date objects', () => {
  const clock = createClock('2026-11-03T10:00:00+05:30');
  clock.now().setFullYear(2000);
  expect(clock.isOverridden()).toBe(true);
  expect(clock.now().toISOString()).toBe('2026-11-03T04:30:00.000Z');
});

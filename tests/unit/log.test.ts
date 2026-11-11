import { expect, it, vi } from 'vitest';
import { createClock } from '../../src/server/clock';
import { createLogger } from '../../src/server/log';

it('filters by severity and writes structured operational metadata', () => {
  const output = vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    const log = createLogger(createClock('2026-11-11T00:00:00Z'), 'warn');
    log('info', 'hidden');
    log('warn', 'clock.overridden', { traceId: 'trace-1' });
    expect(output).toHaveBeenCalledTimes(1);
    expect(JSON.parse(output.mock.calls[0][0])).toEqual({
      traceId: 'trace-1', ts: '2026-11-11T00:00:00.000Z', level: 'warn', event: 'clock.overridden',
    });
  } finally {
    output.mockRestore();
  }
});

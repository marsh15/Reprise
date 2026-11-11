import type { Clock } from './clock';
import type { Config } from './config';

type Level = Config['LOG_LEVEL'];
const severity: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

// Callers supply operational metadata only, never credentials or raw messages.
export function createLogger(clock: Clock, minimumLevel: Level) {
  return (level: Level, event: string, fields: Record<string, unknown> = {}) => {
    if (severity[level] < severity[minimumLevel]) return;
    console.log(JSON.stringify({ ...fields, ts: clock.now().toISOString(), level, event }));
  };
}

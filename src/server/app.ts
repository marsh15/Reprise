import { Hono } from 'hono';
import type { Config } from './config';
import type { Clock } from './clock';

export function createApp(config: Config, clock: Clock) {
  const app = new Hono();

  app.get('/api/health', (c) => c.json({
    ok: true,
    model: config.LLM_MODEL,
    searchProvider: 'tavily',
    clockOverridden: clock.isOverridden(),
    now: clock.now().toISOString(),
  }));

  app.notFound((c) => c.json({
    error: { code: 'not_found', message: 'API route not found.', retryable: false },
  }, 404));
  app.onError((_error, c) => c.json({
    error: { code: 'internal', message: 'An internal error occurred.', retryable: true },
  }, 500));
  return app;
}

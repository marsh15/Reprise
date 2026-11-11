import { expect, it } from 'vitest';
import { createApp } from '../../src/server/app';
import { createClock } from '../../src/server/clock';
import { parseConfig } from '../../src/server/config';

const config = parseConfig({ LLM_API_KEY: 'private-llm', TAVILY_API_KEY: 'private-search' });
const app = createApp(config, createClock('2026-11-11T08:30:00Z'));

it('returns the health contract without credentials', async () => {
  const response = await app.request('/api/health');
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    ok: true, model: 'gpt-6-luna', searchProvider: 'tavily',
    clockOverridden: true, now: '2026-11-11T08:30:00.000Z',
  });
});

it('returns a JSON API error for unknown routes', async () => {
  const response = await app.request('/api/missing');
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({
    error: { code: 'not_found', message: 'API route not found.', retryable: false },
  });
});

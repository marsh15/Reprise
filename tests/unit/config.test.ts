import { describe, expect, it } from 'vitest';
import { parseConfig } from '../../src/server/config';

const keys = { LLM_API_KEY: 'test-llm', TAVILY_API_KEY: 'test-search' };

describe('configuration boundary', () => {
  it('applies the run contract defaults and freezes the result', () => {
    const config = parseConfig(keys);
    expect(config).toMatchObject({ PORT: 5173, LLM_MODEL: 'gpt-6-luna', LOG_LEVEL: 'info', REPRISE_DB_PATH: './data/reprise.db' });
    expect(Object.isFrozen(config)).toBe(true);
  });

  it.each([
    { LLM_API_KEY: '' }, { TAVILY_API_KEY: '  ' }, { PORT: '0' },
    { PORT: '65536' }, { PORT: 'abc' }, { LLM_BASE_URL: 'invalid' },
    { LOG_LEVEL: 'verbose' }, { LLM_REASONING_EFFORT: 'max' },
    { REPRISE_NOW: 'tomorrow' }, { REPRISE_NOW: '2026-11-11T10:00:00' },
  ])('rejects invalid configuration %o', (invalid) => {
    expect(() => parseConfig({ ...keys, ...invalid })).toThrow(/set a valid/);
  });

  it('reports every invalid field without echoing supplied values', () => {
    expect(() => parseConfig({ ...keys, LLM_BASE_URL: 'secret-value', PORT: 'secret-port' }))
      .toThrow('LLM_BASE_URL: set a valid LLM_BASE_URL in .env (see .env.example).\nPORT: set a valid PORT in .env (see .env.example).');
  });
});

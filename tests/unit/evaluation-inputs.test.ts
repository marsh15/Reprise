import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { executeScenario } from '../../evals/execute';
import { cassetteSearch } from '../../evals/cassettes';
import { scenarios } from '../../evals/scenarios';
import { correctnessScenarios } from '../../evals/correctnessScenarios';
import { parseConfig } from '../../src/server/config';

it.each(['F2', 'C1', 'D1', 'R1', 'R2', 'R3'])('freezes actual %s request messages, including record/source IDs, and restores UUID generation', async id => {
  const scenario = [...scenarios, ...correctnessScenarios].find(s => s.id === id)!;
  const config = parseConfig({ LLM_API_KEY: 'mock', TAVILY_API_KEY: 'mock' });
  const run = async () => executeScenario(scenario, { mock: true, config, cassette: await cassetteSearch(`evals/search-cassettes/${scenario.cassette}.json`), codeHash: 'same' });
  const first = await run(); const second = await run();
  expect(first.trace.requests).toEqual(second.trace.requests);
  expect(first.inputHash).toBe(second.inputHash);
  expect(first.cassetteHash).toBe(second.cassetteHash);
  expect(randomUUID()).not.toMatch(/^00000000-0000-4000-8000-/);
});

import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { pricingScenarios } from '../../evals/pricingScenarios';
import { cassetteSearch } from '../../evals/cassettes';
import { openDatabase } from '../../src/server/db/db';
import { createRepo } from '../../src/server/db/repo';
import { createClock } from '../../src/server/clock';
import { parseConfig } from '../../src/server/config';
import { createRunTurn, type TurnResult } from '../../src/server/agent/runTurn';
import { createTurnService } from '../../src/server/turns/service';
import { scriptedLlm } from '../helpers/fakeLlm';
import type { RecallPacket } from '../../src/shared/memory';

const clock = createClock('2026-11-11T08:30:00Z');
const config = parseConfig({ LLM_API_KEY: 'fake', TAVILY_API_KEY: 'fake', LLM_MODEL: 'fake', LLM_BASE_URL: 'https://example.com/v1' });
async function execute(id: string) {
  const scenario = pricingScenarios.find(s => s.id === id)!;
  const store = openDatabase(':memory:');
  try {
    const repo = createRepo(store);
    const cassette = await cassetteSearch(`evals/search-cassettes/${scenario.cassette}.json`);
    const conversationId = scenario.setup?.(repo);
    let result!: TurnResult; let packet!: RecallPacket;
    const run = createRunTurn(scriptedLlm(scenario.script).llm, config, { search: cassette.search, now: clock.now });
    const service = createTurnService(repo, async input => { packet = input.packet; result = await run(input); return result; }, clock, 'fake');
    await service.prepare({ conversationId, clientMessageId: randomUUID(), text: scenario.text, timezone: 'Asia/Kolkata' }).run(async () => {});
    return { scenario, result, packet, misses: cassette.misses };
  } finally { store.close(); }
}

describe('synthetic pricing and announcement scenarios', () => {
  it.each(['K2', 'K3', 'T1'])('%s replays and passes its result and memory assertions', async id => {
    const { scenario, result, packet, misses } = await execute(id);
    expect(misses).toEqual([]);
    expect(scenario.priority).toBe('P1');
    expect(scenario.assert(result)).toEqual([]);
    expect(scenario.assertMemory?.(packet)).toEqual([]);
    expect(result.evidence?.sources.every(s => s.fixture)).toBe(true);
    expect(result.evidence?.citations.every(c => c.state !== 'invalid' && c.state !== 'unverified')).toBe(true);
  });
  it.each([
    ['K2', 'Aster is cheapest.'],
    ['K3', 'The prices are equivalent.'],
    ['T1', 'Atlas has shipped since the discussion.'],
  ])('%s rejects an unsupported conclusion even alongside the scripted caveats', async (id, claim) => {
    const { scenario, result } = await execute(id);
    expect(scenario.assert({ ...result, text: `${result.text} ${claim}` }).length).toBeGreaterThan(0);
  });
  it('K2 requires both currencies and a conversion or ranking limitation', async () => {
    const { scenario, result } = await execute('K2');
    expect(scenario.assert({ ...result, text: result.text.replace('€18 EUR', '18') })).toContain('currency distinction missing');
    expect(scenario.assert({ ...result, text: result.text.replace('no exchange rate is supplied, so I cannot convert or rank them', 'they are different') })).toContain('missing conversion or ranking limitation');
  });
  it('K3 requires units, commitment, introductory and standard terms, and minimum seats', async () => {
    const { scenario, result } = await execute('K3');
    for (const [from, to, failure] of [
      ['per user', 'total', 'price units missing'], ['annually', 'monthly', 'billing commitment missing'],
      ['introductory', 'special', 'introductory or standard rate missing'], ['standard', 'usual', 'introductory or standard rate missing'],
      ['minimum of 5', 'limit', 'minimum seats missing'],
    ]) expect(scenario.assert({ ...result, text: result.text.replaceAll(from, to) })).toContain(failure);
  });
  it('T1 distinguishes all four dates and retains the prior fixture before the new announcement', async () => {
    const { scenario, result, packet } = await execute('T1');
    expect(result.evidence?.sources.map(s => s.n)).toEqual([1, 2]);
    expect(result.evidence?.citations.map(c => c.marker)).toEqual([1, 2]);
    expect(result.evidence?.sources[1]).toMatchObject({ publishedAt: '2026-11-10T00:00:00Z', retrievedAt: '2026-11-11T08:30:00Z' });
    for (const date of ['9 November', '10 November', '11 November', '1 December']) {
      expect(scenario.assert({ ...result, text: result.text.replace(date, 'some day') })).toContain('discussion, publication, retrieval and rollout dates required');
    }
    expect(scenario.assertMemory?.({ ...packet, recalledTurns: [] })).toContain('dated fixture discussion or source missing');
    expect(scenario.assertMemory?.({ ...packet, carriedSources: [] })).toContain('dated fixture discussion or source missing');
  });
});

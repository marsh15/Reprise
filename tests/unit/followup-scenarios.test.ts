import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { followupScenarios } from '../../evals/followupScenarios';
import { cassetteSearch } from '../../evals/cassettes';
import { openDatabase } from '../../src/server/db/db';
import { createRepo } from '../../src/server/db/repo';
import { createClock } from '../../src/server/clock';
import { parseConfig } from '../../src/server/config';
import { createRunTurn, type TurnResult } from '../../src/server/agent/runTurn';
import { createTurnService } from '../../src/server/turns/service';
import { scriptedLlm } from '../helpers/fakeLlm';
import { stats } from '../helpers/memory';
import type { RecallPacket } from '../../src/shared/memory';

const clock = createClock('2026-11-11T08:30:00Z');
const config = parseConfig({ LLM_API_KEY: 'fake', TAVILY_API_KEY: 'fake', LLM_MODEL: 'fake', LLM_BASE_URL: 'https://example.com/v1' });
async function execute(id: string) {
  const scenario = followupScenarios.find(s => s.id === id)!;
  const store = openDatabase(':memory:');
  try {
    const repo = createRepo(store);
    const cassette = await cassetteSearch(`evals/search-cassettes/${scenario.cassette}.json`);
    let conversationId = scenario.setup?.(repo);
    for (const pair of scenario.history ?? []) {
      const input = { clientMessageId: randomUUID(), text: `[Demo evaluation] ${pair.user}`, timezone: 'Asia/Kolkata', now: clock.now() };
      const user = conversationId ? repo.insertUserMessage({ ...input, conversationId }) : repo.startConversation({ ...input, origin: 'fixture' });
      conversationId = user.conversationId;
      repo.insertAssistantTurn({ id: randomUUID(), user, text: `[Demo evaluation] ${pair.assistant}`, status: 'complete', now: clock.now(), model: 'fixture', stats });
    }
    let result!: TurnResult; let packet!: RecallPacket;
    const run = createRunTurn(scriptedLlm(scenario.script).llm, config, { search: cassette.search, now: clock.now });
    const service = createTurnService(repo, async input => { packet = input.packet; result = await run(input); return result; }, clock, 'fake');
    await service.prepare({ conversationId, clientMessageId: randomUUID(), text: scenario.text, timezone: 'Asia/Kolkata' }).run(async () => {});
    return { scenario, result, packet, misses: cassette.misses };
  } finally { store.close(); }
}

describe('isolated follow-up evaluation fixtures', () => {
  it.each(['B2', 'H2', 'J1', 'J2'])('%s exercises the scripted service and assertions', async id => {
    const { scenario, result, packet, misses } = await execute(id);
    expect(misses).toEqual([]);
    expect(scenario.assertMemory?.(packet)).toEqual([]);
    expect(scenario.assert(result)).toEqual([]);
  });
  it.each([
    ['B2', 'Demo: Kubernetes was discussed. Postgres hosting and Node versus Bun were discussed.'],
    ['H2', 'Demo: On 3 November the answer was Supabase.'],
    ['J1', 'Demo: HubSpot is cheaper than Pipedrive for 20 seats.'],
    ['J2', 'Demo: You chose Copper, with Close also mentioned.'],
    ['J2', 'Demo: Corrected to Close, previously recommended for $50.'],
  ])('%s rejects a meaningful bad answer', async (id, text) => {
    const { scenario, result } = await execute(id);
    expect(scenario.assert({ ...result, text }).length).toBeGreaterThan(0);
  });
  it('J1 uses distinct historical and current markers with synthetic evidence', async () => {
    const { result } = await execute('J1');
    expect(result.evidence?.sources.map(s => s.n)).toEqual([1, 2, 3]);
    expect(result.evidence?.sources.every(s => s.fixture)).toBe(true);
    expect(result.evidence?.citations.map(c => c.marker)).toEqual([1, 2, 3]);
  });
});

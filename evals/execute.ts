import crypto, { randomUUID, createHash } from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import type { Config } from '../src/server/config';
import type { RecallPacket } from '../src/shared/memory';
import type { TurnEvent } from '../src/shared/types';
import { createClock } from '../src/server/clock';
import { openDatabase } from '../src/server/db/db';
import { createRepo } from '../src/server/db/repo';
import { createRunTurn, type Llm, type TurnResult } from '../src/server/agent/runTurn';
import { createTurnService } from '../src/server/turns/service';
import { scriptedLlm } from '../tests/helpers/fakeLlm';
import type { cassetteSearch } from './cassettes';
import type { Scenario } from './scenarios';

export const frozen = '2026-11-11T08:30:00Z';
export type EvaluationRow = {
  id: string; priority: Scenario['priority']; failures: string[]; result: TurnResult; queries: string[]; text: string;
  inputHash: string; cassetteHash: string; provenance: string; memory: RecallPacket; trace: { requests: unknown[]; events: TurnEvent[] };
};
// Fingerprint code and fixture inputs, including setup functions and their imports.
export async function implementationHash() {
  const hash = createHash('sha256');
  for (const file of ['package.json', 'package-lock.json']) hash.update(file + '\0').update(await readFile(file));
  for (const root of ['src/server', 'src/shared', 'evals', 'scripts/fixtures', 'tests/helpers']) {
    const files = (await readdir(root, { recursive: true })).filter(f => /\.(?:ts|json|sql)$/.test(f) && !f.startsWith('results/') && !f.startsWith('search-cassettes/')).sort();
    for (const file of files) hash.update(root + '/' + file + '\0').update(await readFile(root + '/' + file));
  }
  return hash.digest('hex');
}
export async function executeScenario(scenario: Scenario, options: {
  mock: boolean; config: Config; cassette: Awaited<ReturnType<typeof cassetteSearch>>; llm?: Llm; providerTrace?: unknown[]; codeHash: string;
}): Promise<EvaluationRow> {
  const { mock, config, cassette } = options;
  const store = openDatabase(':memory:'); const clock = createClock(frozen);
  const fake = mock ? scriptedLlm(scenario.script) : undefined;
  const traceStart = options.providerTrace?.length ?? 0;
  // Scenarios run sequentially in isolated databases. Freeze opaque IDs too:
  // they appear in recall/tool context and must not vary between candidates.
  const originalUuid = crypto.randomUUID; let idSequence = 0;
  crypto.randomUUID = () => `00000000-0000-4000-8000-${String(++idSequence).padStart(12, '0')}`;
  syncBuiltinESMExports();
  try {
    const repo = createRepo(store);
    let conversationId = scenario.setup?.(repo);
    for (const pair of scenario.history ?? []) {
      const input = { clientMessageId: randomUUID(), text: '[Demo evaluation] ' + pair.user, timezone: 'Asia/Kolkata', now: clock.now() };
      const user = conversationId ? repo.insertUserMessage({ ...input, conversationId }) : repo.startConversation({ ...input, origin: 'fixture' });
      conversationId = user.conversationId;
      repo.insertAssistantTurn({ id: randomUUID(), user, text: '[Demo evaluation] ' + pair.assistant, status: 'complete', now: clock.now(), model: 'fixture',
        stats: { searches: 0, sources: 0, latencyMs: 0, ttftMs: null, inputTokens: 0, outputTokens: 0 } });
    }
    let result!: TurnResult; let memory!: RecallPacket; const events: TurnEvent[] = [];
    const run = createRunTurn(fake?.llm ?? options.llm!, config, { search: cassette.search, now: clock.now });
    const service = createTurnService(repo, async input => { memory = input.packet; result = await run(input); return result; }, clock, config.LLM_MODEL);
    const turn = service.prepare({ conversationId, clientMessageId: randomUUID(), text: scenario.text, timezone: 'Asia/Kolkata' });
    await turn.run(async event => { events.push(event); });
    await cassette.flush();
    const failures = [...scenario.assert(result), ...(scenario.assertMemory?.(memory) ?? []), ...cassette.misses.map(query => `cassette miss: ${query}`)];
    const cassetteHash = createHash('sha256').update(JSON.stringify(cassette.snapshot)).digest('hex');
    const inputHash = createHash('sha256').update(JSON.stringify({ code: options.codeHash, text: scenario.text, history: scenario.history, cassetteHash,
      frozen, timezone: 'Asia/Kolkata' })).digest('hex');
    return { id: scenario.id, priority: scenario.priority, failures, result, queries: [...cassette.queries], text: scenario.text,
      inputHash, cassetteHash, provenance: result.stats.searches ? cassette.snapshot.provenance : 'none', memory,
      trace: { requests: fake?.requests ?? options.providerTrace?.slice(traceStart) ?? [], events } };
  } finally { crypto.randomUUID = originalUuid; syncBuiltinESMExports(); store.close(); }
}

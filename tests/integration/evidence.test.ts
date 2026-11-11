import { afterEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../../src/server/db/db';
import { createRepo } from '../../src/server/db/repo';
import { createRunTurn } from '../../src/server/agent/runTurn';
import { createTurnService } from '../../src/server/turns/service';
import { createClock } from '../../src/server/clock';
import { parseConfig } from '../../src/server/config';
import { scriptedLlm } from '../helpers/fakeLlm';
import { fakeSearch } from '../helpers/fakeSearch';
import { conversationDetailSchema } from '../../src/shared/types';
const store = openDatabase(':memory:'); const repo = createRepo(store);
afterEach(() => { for (const c of repo.listConversations()) repo.deleteConversation(c.id); });
const config = parseConfig({ LLM_API_KEY: 'fake', TAVILY_API_KEY: 'fake' });
const now = new Date('2026-11-11T08:30:00Z'); const clock = createClock(now.toISOString());
const stats = { searches: 0, sources: 0, latencyMs: 1, ttftMs: 1, inputTokens: 1, outputTokens: 1 };
async function research() {
  const llm = scriptedLlm([{ calls: [{ args: '{"query":"pricing","freshness":"any"}' }] }, { text: ['Costs $90 [1].'] }]);
  const service = createTurnService(repo, createRunTurn(llm.llm, config, { search: fakeSearch().search, now: clock.now }), clock, 'fake');
  const turn = service.prepare({ clientMessageId: randomUUID(), text: 'Current price?', timezone: 'Asia/Kolkata' });
  await turn.run(async event => {
    if (event.type === 'citations' || event.type === 'turn.completed') expect(repo.getConversationMessages(turn.conversationId).at(-1)?.evidence?.citations[0].state).toBe('verified');
  });
  return repo.getConversationMessages(turn.conversationId);
}
it('persists exactly observed sources, queries, rounds, timings and citation mapping before terminal events', async () => {
  const messages = await research(); const answer = messages.at(-1)!;
  expect(answer.evidence?.sources[0]).toMatchObject({ excerpt: 'Costs $90 for 20 seats.', retrievedAt: now.toISOString(), publishedAt: null, fixture: false, n: 1 });
  expect(answer.evidence?.searches[0]).toMatchObject({ round: 1, query: 'pricing', status: 'ok', startedAt: now.toISOString() });
  expect(conversationDetailSchema.safeParse({ conversation: repo.getConversation(answer.conversationId), messages }).success).toBe(true);
  expect(repo.carriedSources(messages)).toHaveLength(1);
});
it('atomically rolls back assistant, ledger, FTS and conversation touch when source insert fails', async () => {
  const messages = await research(); const answer = messages.at(-1)!; const originalCount = messages.length;
  store.db.exec("CREATE TRIGGER reject_source BEFORE INSERT ON sources BEGIN SELECT RAISE(ABORT,'forced evidence failure'); END");
  try {
    const evidence = structuredClone(answer.evidence!); evidence.searches[0].id = randomUUID(); evidence.sources[0].searchId = evidence.searches[0].id; evidence.sources[0].sourceId = randomUUID();
    expect(() => repo.insertAssistantTurn({ id: randomUUID(), user: messages[0], text: 'Rollback', status: 'complete', now, model: 'fake', stats, evidence })).toThrow('forced evidence failure');
    expect(repo.getConversationMessages(answer.conversationId)).toHaveLength(originalCount);
    expect(store.db.prepare('SELECT COUNT(*) AS n FROM searches').get()!.n).toBe(1);
    expect(store.db.prepare("SELECT COUNT(*) AS n FROM messages_fts WHERE messages_fts MATCH 'Rollback'").get()!.n).toBe(0);
  } finally { store.db.exec('DROP TRIGGER reject_source'); }
});
it('carries cited evidence to the next turn without inventing a new retrieval', async () => {
  const messages = await research(); const source = messages.at(-1)!.evidence!.sources[0];
  const user = repo.insertUserMessage({ conversationId: messages[0].conversationId, clientMessageId: randomUUID(), text: 'Rephrase', timezone: 'UTC', now });
  const fake = scriptedLlm([{ text: ['It costs $90 [1].'] }]);
  const turn = createTurnService(repo, createRunTurn(fake.llm, config, { search: async () => { throw new Error('Should not search'); }, now: clock.now }), clock, 'fake')
    .prepare({ conversationId: user.conversationId, clientMessageId: user.clientMessageId!, text: user.content, timezone: 'UTC', retryOfUserMessageId: user.id });
  await turn.run(async () => {});
  const result = repo.getReply(user.id)!;
  expect(result.evidence?.sources[0]).toEqual(source); expect(result.evidence?.searches).toEqual([]);
  expect(result.evidence?.citations[0].sourceId).toBe(source.sourceId);
  expect(store.db.prepare('SELECT COUNT(*) AS n FROM sources').get()!.n).toBe(1);
});
it('carries every cited observation for a reused URL, including a newer excerpt supporting the answer', async () => {
  const fake = scriptedLlm([{ calls: ['old', 'new'].map(query => ({ args: JSON.stringify({ query, freshness: 'any' }) })) }, { text: ['The old snapshot shows $90 [1]; the new snapshot shows $95 [2].'] }]);
  const run = createRunTurn(fake.llm, config, { now: clock.now, search: async request => ({ status: 'ok', durationMs: 1,
    results: [{ url: 'https://example.com/pricing', title: null, content: request.query === 'old' ? '$90' : '$95', publishedAt: null }] }) });
  const service = createTurnService(repo, run, clock, 'fake');
  const turn = service.prepare({ clientMessageId: randomUUID(), text: 'Compare prices', timezone: 'UTC' });
  await turn.run(async () => {});
  const messages = repo.getConversationMessages(turn.conversationId);
  expect(messages.at(-1)?.evidence?.citations[0].state).toBe('verified');
  expect(repo.carriedSources(messages).map(s => s.excerpt)).toEqual(['$90', '$95']);
});
it('saves a new answer when its recalled source conversation is deleted during generation', async () => {
  const historical = await research();
  const source = historical.at(-1)!.evidence!.sources[0];
  const fake = scriptedLlm([{ text: ['The earlier observation was $90 [1].'] }]);
  const service = createTurnService(repo, createRunTurn(fake.llm, config, { now: clock.now }), clock, 'fake');
  const turn = service.prepare({ clientMessageId: randomUUID(), text: 'Recall the earlier price', timezone: 'UTC' });
  const events: import('../../src/shared/types').TurnEvent[] = [];
  await turn.run(async event => {
    events.push(event);
    if (event.type === 'answer.delta') await service.deleteConversation(historical[0].conversationId);
  });
  const answer = repo.getConversationMessages(turn.conversationId).at(-1)!;
  expect(answer).toMatchObject({ role: 'assistant', status: 'complete', content: 'The earlier observation was $90 [1].' });
  expect(answer.evidence?.sources).toEqual([]);
  expect(answer.evidence?.citations).toMatchObject([{ marker: 1, sourceId: null, state: 'unverified', detail: 'Source deleted or unavailable.' }]);
  expect(store.db.prepare('SELECT id FROM sources WHERE id=?').get(source.sourceId)).toBeUndefined();
  expect(events.find(event => event.type === 'citations')).toMatchObject({ sources: [], citations: answer.evidence?.citations });
  expect(events.at(-1)?.type).toBe('turn.completed');
});

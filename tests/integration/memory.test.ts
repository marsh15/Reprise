import { afterEach, beforeEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../../src/server/db/db';
import { createRepo } from '../../src/server/db/repo';
import { createRunTurn } from '../../src/server/agent/runTurn';
import { createTurnService } from '../../src/server/turns/service';
import { createClock } from '../../src/server/clock';
import { parseConfig } from '../../src/server/config';
import { scriptedLlm, type ScriptedStep } from '../helpers/fakeLlm';
import { fakeSearch } from '../helpers/fakeSearch';
import { pastTurn, historicalSource } from '../helpers/memory';
import type { TurnEvent } from '../../src/shared/types';
const clock = createClock('2026-11-11T08:30:00Z');
const config = parseConfig({ LLM_API_KEY: 'fake', TAVILY_API_KEY: 'fake' });
let store: ReturnType<typeof openDatabase>; let repo: ReturnType<typeof createRepo>;
beforeEach(() => { store = openDatabase(':memory:'); repo = createRepo(store); });
afterEach(() => store.close());
async function run(text: string, script: ScriptedStep[], conversationId?: string) {
  const fake = scriptedLlm(script); const search = fakeSearch(); const events: TurnEvent[] = [];
  const service = createTurnService(repo, createRunTurn(fake.llm, config, { search: search.search, now: clock.now }), clock, 'fake');
  const turn = service.prepare({ clientMessageId: randomUUID(), text, timezone: 'Asia/Kolkata', conversationId });
  await turn.run(async e => { events.push(e); });
  return { requests: fake.requests, search, events, reply: repo.getConversationMessages(turn.conversationId).at(-1)! };
}
it('recalls before invocation, gives local time/index/history start and persists navigation metadata', async () => {
  const old = pastTurn(repo, 'Postgres hosting?', undefined, { answer: 'I recommended Neon.', sources: [historicalSource()] });
  const result = await run('Last Tuesday I asked about Postgres hosting. What did you recommend?', [{ text: ['Demo answer from supplied records.'] }]);
  expect(result.events.slice(0, 2).map(e => e.type)).toEqual(['turn.started', 'recall']);
  const context = JSON.stringify(result.requests[0].messages);
  for (const text of ['2026-11-03', '2026-11-10', 'Postgres hosting?', 'I recommended Neon.', 'history_start', 'conversation_index', 'Asia/Kolkata', 'Old price $90']) expect(context).toContain(text);
  expect(result.reply.recall).toMatchObject([{ messageId: old.user.id, conversationId: old.user.conversationId, origin: 'live' }]);
  expect(result.search.calls).toEqual([]);
  expect((result.requests[0].tools as {function:{name:string}}[]).map(t => t.function.name)).toEqual(['web_search']);
});
it('pure memory with no records supplies truthful absence and makes no searches with a fake answer', async () => {
  const result = await run('What did I ask on 3 November? Is your answer still correct today?', [{ text: ['I have no record of that conversation. History starts on 2026-11-11.'] }]);
  const context = JSON.stringify(result.requests[0].messages);
  expect(context).toContain('no conversations on 2026-11-03'); expect(context).toContain('2026-11-11');
  expect(result.search.calls).toEqual([]); expect(context).not.toContain('task_hint'); expect(result.reply.recall).toEqual([]);
  // Scripted language validates context wiring, not a live model's honesty.
});
it('keeps missing history separate from current research without claiming a historical baseline', async () => {
  const result = await run('Last Tuesday I asked about Postgres hosting. Has any pricing changed?', [
    { calls: [{ args: '{"query":"Postgres pricing","freshness":"any"}' }] },
    { text: ['I have no record of the past answer; current evidence says $90 [1]. I cannot establish a change.'] },
  ]);
  expect(result.search.calls).toHaveLength(1); expect(result.reply.recall).toEqual([]);
  expect(result.reply.evidence?.sources[0].retrievedAt).toBe(clock.now().toISOString());
  expect(result.reply.evidence?.citations[0].state).toBe('verified');
});
it('registers historical then carried then fresh sources and remaps original citation numbers', async () => {
  const historical = historicalSource('https://example.com/historical');
  const current = historicalSource('https://example.com/current', 'Current chat $80');
  current.n = 8;
  const old = pastTurn(repo, 'Postgres hosting?', undefined, { answer: 'Choose the old host [1].', sources: [historical] });
  const chat = pastTurn(repo, 'Other topic', '2026-11-10', { sources: [current] });
  const result = await run('What changed for Postgres hosting since 3 November?', [
    { calls: [{ args: '{"query":"current pricing","freshness":"any"}' }] }, { text: ['Now $90 [3].'] },
  ], chat.user.conversationId);
  expect(result.reply.evidence?.sources.map(s => [s.sourceId, s.n]).slice(0, 2)).toEqual([[historical.sourceId, 1], [current.sourceId, 2]]);
  expect(result.reply.evidence?.sources.at(-1)?.n).toBe(3);
  expect(result.reply.evidence?.citations[0].state).toBe('verified');
  expect(JSON.stringify(result.requests[0].messages)).toContain('task_hint');
  expect(repo.getMessage(old.assistant.id)!.content).toBe('Choose the old host [1].');
  expect(store.db.prepare('SELECT COUNT(*) AS n FROM sources').get()!.n).toBe(3);
});
it('does not duplicate date-matched recent messages in the plain history and context', async () => {
  const chat = pastTurn(repo, 'Neon pricing?', '2026-11-11');
  const result = await run('What was the first thing I asked today?', [{ text: ['Neon pricing.'] }], chat.user.conversationId);
  const messages = result.requests[0].messages as { role: string; content: string }[];
  expect(messages).toHaveLength(2);
  expect(result.search.calls).toHaveLength(0);
});
it('bypasses the model with focused clarification when protected evidence cannot fit', async () => {
  for (let i=0; i<6; i++) pastTurn(repo, 'Original ' + 'x'.repeat(7900));
  const result = await run('What did I ask on 3 November?', []);
  expect(result.requests).toEqual([]); expect(result.reply.status).toBe('complete'); expect(result.reply.content).toContain('narrow');
  expect(result.reply.content).toContain('not included'); expect(result.search.calls).toEqual([]);
});
it('survives database restart with source provenance and recall pointers intact', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'reprise-memory-'));
  try {
    const file = join(dir, 'memory.db'); let disk = openDatabase(file); let db = createRepo(disk);
    const old = pastTurn(db, 'Postgres hosting?', undefined, { sources: [historicalSource()] });
    disk.close(); disk = openDatabase(file); db = createRepo(disk);
    const fake = scriptedLlm([{ text: ['The recorded answer.'] }]);
    const turn = createTurnService(db, createRunTurn(fake.llm, config, { now: clock.now }), clock, 'fake').prepare({ clientMessageId: randomUUID(), text: 'Postgres hosting before?', timezone: 'UTC' });
    await turn.run(async () => {});
    disk.close(); disk = openDatabase(file); db = createRepo(disk);
    const reply = db.getConversationMessages(turn.conversationId).at(-1)!;
    expect(reply.recall?.[0].messageId).toBe(old.user.id); expect(reply.evidence?.sources[0].sourceId).toBe(old.assistant.evidence!.sources[0].sourceId);
    disk.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
it('honors cancellation before a bounded-history clarification can emit text', async () => {
  const current = pastTurn(repo, 'Current');
  const packet = (await import('../../src/server/memory/recall')).recall(repo, { text: 'Current', conversationId: current.user.conversationId, now: clock.now(), tz: 'UTC' });
  packet.clarification = 'Please narrow the request.';
  const controller = new AbortController(); controller.abort();
  const fake = scriptedLlm([]); const events: TurnEvent[] = [];
  const result = await createRunTurn(fake.llm, config)({ packet, userText: 'Current', signal: controller.signal, emit: async e => { events.push(e); } });
  expect(result.status).toBe('interrupted'); expect(result.text).toBe(''); expect(events).toEqual([]); expect(fake.requests).toEqual([]);
});
it('retains distinct historical and fresh observations when a URL reuses its turn-local marker', async () => {
  const old = historicalSource('https://example.com/pricing', 'Past price $80');
  const t = pastTurn(repo, 'Postgres hosting', undefined, { sources: [old] });
  const result = await run('Postgres hosting pricing changed since 3 November?', [
    { calls: [{ args: '{"query":"current pricing","freshness":"any"}' }] }, { text: ['Current price $90 [1].'] },
  ]);
  const sources = result.reply.evidence!.sources;
  expect(sources).toHaveLength(2); expect(sources.map(s => s.n)).toEqual([1,1]); expect(sources[0].sourceId).toBe(old.sourceId);
  expect(sources[1].sourceId).not.toBe(old.sourceId); expect(sources[1].retrievedAt).toBe(clock.now().toISOString());
  expect(sources[0].retrievedAt).toBe(old.retrievedAt); expect(result.reply.evidence!.citations[0].state).toBe('verified');
  expect(repo.getMessage(t.assistant.id)!.evidence!.sources).toEqual([old]);
});

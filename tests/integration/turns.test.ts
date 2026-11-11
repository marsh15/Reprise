import { afterEach, beforeEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../../src/server/db/db';
import { createRepo } from '../../src/server/db/repo';
import { createTurnService } from '../../src/server/turns/service';
import { createRunTurn } from '../../src/server/agent/runTurn';
import { createClock } from '../../src/server/clock';
import { parseConfig } from '../../src/server/config';
import { createApp } from '../../src/server/app';
import { fakeLlm } from '../helpers/fakeLlm';
import { readEvents } from '../../src/client/api';
import type { TurnEvent, TurnRequest } from '../../src/shared/types';

const clock = createClock('2026-11-11T20:00:00Z');
const config = parseConfig({ LLM_API_KEY: 'fake', TAVILY_API_KEY: 'fake' });
let store: ReturnType<typeof openDatabase>;
let repo: ReturnType<typeof createRepo>;
let turns: ReturnType<typeof createTurnService>;
let app: ReturnType<typeof createApp>;
let fake: ReturnType<typeof fakeLlm>;
beforeEach(() => {
  store = openDatabase(':memory:'); repo = createRepo(store); fake = fakeLlm({ delay: 5 });
  turns = createTurnService(repo, createRunTurn(fake.llm, config), clock, config.LLM_MODEL);
  app = createApp(config, clock, { repo, turns });
});
afterEach(async () => { await turns.shutdown(); store.close(); });
const input = (): TurnRequest => ({ clientMessageId: randomUUID(), text: 'Hello', timezone: 'Asia/Kolkata' });
async function post(body: unknown) { return app.request('/api/turns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
async function collect(response: Response) { const events: TurnEvent[] = []; await readEvents(response.body!, event => events.push(event)); return events; }

it('serves CRUD and SSE, with final event emitted only after persistence', async () => {
  const events = await collect(await post(input()));
  expect(events.map(e => e.type)).toEqual(['turn.started', 'answer.delta', 'answer.delta', 'citations', 'turn.completed']);
  const conversation = repo.listConversations()[0];
  const detail = await (await app.request(`/api/conversations/${conversation.id}`)).json();
  expect(detail.messages.map((m: { content: string }) => m.content)).toEqual(['Hello', 'Hello world']);
  expect(detail.messages[0].localDate).toBe('2026-11-12');
  expect((await app.request('/api/conversations')).status).toBe(200);
  expect((await app.request(`/api/conversations/${conversation.id}`, { method: 'DELETE' })).status).toBe(204);
  expect((await app.request(`/api/conversations/${conversation.id}`)).status).toBe(404);
});
it('replays completed duplicate ids without creating rows, conversations, or model requests', async () => {
  const request = input(); const first = await collect(await post(request));
  const replay = await collect(await post(request));
  expect(replay.map(e => e.type)).toEqual(['turn.started', 'turn.completed']);
  expect(replay[0]).toMatchObject({ ...first[0], traceId: expect.any(String) });
  expect(repo.listConversations()).toHaveLength(1);
  expect(repo.getConversationMessages(repo.listConversations()[0].id)).toHaveLength(2);
  expect(fake.requests).toHaveLength(1);
});
it('rejects an active duplicate and a second request in the same conversation', async () => {
  const request = input(); const prepared = turns.prepare(request);
  expect((await post(request)).status).toBe(409);
  expect((await post({ ...input(), conversationId: prepared.conversationId })).status).toBe(409);
  await prepared.run(async () => {});
  expect(repo.getConversationMessages(prepared.conversationId)).toHaveLength(2);
});
it('allows independent conversations to stream concurrently', async () => {
  const first = turns.prepare(input()); const second = turns.prepare(input());
  await Promise.all([first.run(async () => {}), second.run(async () => {})]);
  expect(repo.listConversations()).toHaveLength(2);
  expect(repo.getConversationMessages(first.conversationId).map(m => m.seq)).toEqual([1, 2]);
  expect(repo.getConversationMessages(second.conversationId).map(m => m.seq)).toEqual([1, 2]);
});
it('cancels via endpoint, persists partial text, and retries without another user row', async () => {
  const request = input(); const events: TurnEvent[] = [];
  const response = await post(request);
  await readEvents(response.body!, event => {
    events.push(event);
    if (event.type === 'answer.delta') turns.cancel(repo.listConversations()[0].id);
  });
  const conversationId = repo.listConversations()[0].id;
  const messages = repo.getConversationMessages(conversationId);
  expect(messages[1]).toMatchObject({ content: 'Hello', status: 'interrupted' });
  expect(events.at(-1)).toMatchObject({ type: 'turn.error', code: 'cancelled' });
  expect((await collect(await post(request))).at(-1)).toMatchObject({ type: 'turn.error', code: 'cancelled' });
  const retry = { ...request, conversationId, retryOfUserMessageId: messages[0].id };
  expect((await collect(await post(retry))).at(-1)?.type).toBe('turn.completed');
  expect(repo.getConversationMessages(conversationId).map(m => m.role)).toEqual(['user', 'assistant', 'assistant']);
  const context = fake.requests[1].body.messages as { role: string; content: string }[];
  expect(context.filter(m => m.role === 'user')).toHaveLength(1);
  expect(context.at(-1)?.role).toBe('user');
  expect((await post({ ...retry, clientMessageId: randomUUID() })).status).toBe(409);
});
it('propagates a broken transport to the provider and releases the lock after persistence', async () => {
  const prepared = turns.prepare(input());
  await prepared.run(async event => { if (event.type === 'answer.delta') throw new Error('connection lost'); });
  const messages = repo.getConversationMessages(prepared.conversationId);
  expect(messages[1]).toMatchObject({ content: 'Hello', status: 'interrupted' });
  expect(fake.requests[0].signal!.aborted).toBe(true);
  expect(turns.cancel(prepared.conversationId)).toBe(false);
});
it('returns internal on failed assistant write and permits retry of the saved user', async () => {
  const prepared = turns.prepare(input()); const events: TurnEvent[] = [];
  store.db.exec("CREATE TRIGGER reject_assistant BEFORE INSERT ON messages WHEN new.role='assistant' BEGIN SELECT RAISE(ABORT,'forced'); END");
  await prepared.run(async event => { events.push(event); });
  expect(events.at(-1)).toMatchObject({ type: 'turn.error', code: 'internal' });
  expect(repo.getConversationMessages(prepared.conversationId)).toHaveLength(1);
  expect(turns.cancel(prepared.conversationId)).toBe(false);
  store.db.exec('DROP TRIGGER reject_assistant');
  const user = repo.getConversationMessages(prepared.conversationId)[0];
  await collect(await post({ ...input(), conversationId: prepared.conversationId, retryOfUserMessageId: user.id }));
  expect(repo.getConversationMessages(prepared.conversationId)).toHaveLength(2);
});
it('rejects stale retries and mismatched duplicate ids', async () => {
  const request = input(); await collect(await post(request));
  const conversationId = repo.listConversations()[0].id;
  expect((await post({ ...request, text: 'Different' })).status).toBe(409);
  expect((await post({ ...request, retryOfUserMessageId: randomUUID() })).status).toBe(409);
  const user = repo.getConversationMessages(conversationId)[0];
  await collect(await post({ ...input(), conversationId }));
  expect((await post({ ...input(), conversationId, retryOfUserMessageId: user.id })).status).toBe(409);
  expect((await post({ ...request, conversationId: randomUUID() })).status).toBe(409);
});
it.each([
  { ...input(), timezone: 'Mars/Nowhere' }, { ...input(), text: ' ' },
  { ...input(), text: 'x'.repeat(8001) }, { ...input(), conversationId: 'bad' }, {},
])('rejects invalid request %j', async request => { expect((await post(request)).status).toBe(400); expect(repo.listConversations()).toEqual([]); });
it('returns 404 for nonexistent conversations and inactive cancellation', async () => {
  expect((await post({ ...input(), conversationId: randomUUID() })).status).toBe(404);
  expect((await app.request(`/api/conversations/${randomUUID()}/cancel`, { method: 'POST' })).status).toBe(404);
});
it('shutdown aborts active turns, waits for persistence, and rejects new work', async () => {
  const prepared = turns.prepare(input());
  const running = prepared.run(async () => {});
  await turns.shutdown(); await running;
  expect(repo.getConversationMessages(prepared.conversationId)[1].status).toBe('interrupted');
  expect(() => turns.prepare(input())).toThrow('shutting down');
});
it('recovers the identity of an orphaned user after a crash without making another model request', async () => {
  const request = input();
  const user = repo.startConversation({ ...request, now: clock.now() });
  const events = await collect(await post(request));
  expect(events[0]).toMatchObject({ type: 'turn.started', conversationId: user.conversationId, userMessageId: user.id });
  expect(events.at(-1)).toMatchObject({ type: 'turn.error', code: 'cancelled' });
  expect(fake.requests).toHaveLength(0);
  await collect(await post({ ...request, conversationId: user.conversationId, retryOfUserMessageId: user.id }));
  expect(repo.getConversationMessages(user.conversationId)).toHaveLength(2);
});
it('persists model failures as failed and safely replays the failure', async () => {
  const failing = fakeLlm({ fail: true });
  const failedTurns = createTurnService(repo, createRunTurn(failing.llm, config), clock, config.LLM_MODEL);
  const request = input(); const prepared = failedTurns.prepare(request); const events: TurnEvent[] = [];
  await prepared.run(async event => { events.push(event); });
  expect(events.at(-1)).toMatchObject({ type: 'turn.error', code: 'llm_unavailable' });
  expect(repo.getConversationMessages(prepared.conversationId)[1].status).toBe('failed');
  await failedTurns.prepare(request).run(async () => {});
  expect(failing.requests).toHaveLength(1);
});
it('cancels through the HTTP endpoint and rejects new work during deletion', async () => {
  const prepared = turns.prepare(input());
  let cancelled: Response | undefined;
  const running = prepared.run(async event => {
    if (event.type === 'answer.delta') cancelled = await app.request(`/api/conversations/${prepared.conversationId}/cancel`, { method: 'POST' });
  });
  await running;
  expect(cancelled!.status).toBe(202);
  const next = turns.prepare({ ...input(), conversationId: prepared.conversationId });
  const nextRunning = next.run(async () => {});
  const deletion = turns.deleteConversation(prepared.conversationId);
  expect(() => turns.prepare({ ...input(), conversationId: prepared.conversationId })).toThrow('deleted');
  await Promise.all([deletion, nextRunning]);
  expect(repo.getConversation(prepared.conversationId)).toBeUndefined();
  expect(repo.getConversationMessages(prepared.conversationId)).toEqual([]);
});

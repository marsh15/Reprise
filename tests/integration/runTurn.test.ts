import { expect, it } from 'vitest';
import { createRunTurn } from '../../src/server/agent/runTurn';
import { parseConfig } from '../../src/server/config';
import { fakeLlm } from '../helpers/fakeLlm';
import type { TurnEvent } from '../../src/shared/types';
const config = parseConfig({ LLM_API_KEY: 'fake', TAVILY_API_KEY: 'fake', LLM_REASONING_EFFORT: 'low', LLM_MODEL: 'test-compatible-model' });
const messages = [{ id: 'user', role: 'user' as const, content: 'Hello', status: 'complete' as const, createdAt: '', localDate: '', seq: 1, replyTo: null }];
it('streams through the real SDK, exposes only web_search, records usage, and passes abort signal', async () => {
  const fake = fakeLlm(); const events: TurnEvent[] = [];
  const result = await createRunTurn(fake.llm, config)({ messages, signal: new AbortController().signal, emit: async e => { events.push(e); } });
  expect(result.status).toBe('complete'); expect(result.text).toBe('Hello world');
  expect(result.stats).toMatchObject({ inputTokens: 10, outputTokens: 2, searches: 0 });
  expect(events).toEqual([{ type: 'answer.delta', text: 'Hello' }, { type: 'answer.delta', text: ' world' }]);
  expect(fake.requests[0].body).toMatchObject({ stream: true, tool_choice: 'auto', stream_options: { include_usage: true }, reasoning_effort: 'low' });
  expect(fake.requests[0].body.tools).toEqual([expect.objectContaining({ function: expect.objectContaining({ name: 'web_search' }) })]);
  expect(fake.requests[0].signal).toBeDefined();
});
it('preserves partial text on cancellation', async () => {
  const fake = fakeLlm({ delay: 5 }); const controller = new AbortController();
  const result = await createRunTurn(fake.llm, config)({ messages, signal: controller.signal, emit: async () => { controller.abort(); } });
  expect(result.status).toBe('interrupted'); expect(result.text).toBe('Hello');
  expect(fake.requests[0].signal!.aborted).toBe(true);
});
it.each([{ finish: null }, { finish: 'length' }, { fail: true }])('marks truncated or rejected streams failed (%j)', async options => {
  const fake = fakeLlm(options);
  const result = await createRunTurn(fake.llm, config)({ messages, signal: new AbortController().signal, emit: async () => {} });
  expect(result.status).toBe('failed');
});
it('counts cumulative provider usage once per model request', async () => {
  const fake = fakeLlm({ repeatUsage: true });
  const result = await createRunTurn(fake.llm, config)({ messages, signal: new AbortController().signal, emit: async () => {} });
  expect(result.stats).toMatchObject({ inputTokens: 10, outputTokens: 2, modelCalls: 1, usageComplete: true });
});

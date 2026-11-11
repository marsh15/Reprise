import { expect, it } from 'vitest';
import { readEvents } from '../../src/client/api';
import { chatReducer, initialState } from '../../src/client/state';
import type { TurnEvent } from '../../src/shared/types';
const ids = { conversationId: '28c19009-e219-4219-a3fd-be6c58c97100', userMessageId: '28c19009-e219-4219-a3fd-be6c58c97101', assistantMessageId: '28c19009-e219-4219-a3fd-be6c58c97102', traceId: '28c19009-e219-4219-a3fd-be6c58c97103' };
const stats = { searches: 0, sources: 0, latencyMs: 0, ttftMs: null, inputTokens: 0, outputTokens: 0 };
function bytes(text: string, size: number) {
  const encoded = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({ start(controller) {
    for (let i = 0; i < encoded.length; i += size) controller.enqueue(encoded.slice(i, i + size));
    controller.close();
  } });
}
it.each([1, 2, 7, 1000])('parses CRLF, multiline JSON, heartbeats, and fragmented UTF-8 at size %s', async size => {
  const events: TurnEvent[] = [];
  await readEvents(bytes(': ping\r\n\r\nevent: answer.delta\r\ndata: {\r\ndata: "text":"Hi ↺ नमस्ते"}\r\n\r\nevent: turn.completed\r\ndata: ' + JSON.stringify({ assistantMessageId: ids.assistantMessageId, stats }) + '\r\n\r\n', size), event => events.push(event));
  expect(events[0]).toEqual({ type: 'answer.delta', text: 'Hi ↺ नमस्ते' });
  expect(events.at(-1)?.type).toBe('turn.completed');
});
it('rejects stream EOF without a terminal event and malformed payloads', async () => {
  await expect(readEvents(bytes('event: answer.delta\ndata: {"text":"partial"}\n\n', 1), () => {})).rejects.toThrow('Connection lost');
  await expect(readEvents(bytes('event: answer.delta\ndata: {"text":4}\n\n', 1), () => {})).rejects.toThrow();
});
it('reduces start, deltas, reset, and cancellation without duplicating the user', () => {
  let state = chatReducer(initialState, { type: 'begin', retry: false, user: { id: 'pending', role: 'user', content: 'Hi', status: 'complete', createdAt: '', localDate: '', seq: 1, replyTo: null } });
  state = chatReducer(state, { type: 'event', event: { type: 'turn.started', ...ids } });
  state = chatReducer(state, { type: 'event', event: { type: 'answer.delta', text: 'preamble' } });
  state = chatReducer(state, { type: 'event', event: { type: 'answer.reset' } });
  state = chatReducer(state, { type: 'event', event: { type: 'answer.delta', text: 'partial' } });
  state = chatReducer(state, { type: 'event', event: { type: 'turn.error', code: 'cancelled', message: 'Stopped', retryable: true } });
  expect(state.messages).toHaveLength(2);
  expect(state.messages[0].id).toBe(ids.userMessageId);
  expect(state.messages[1]).toMatchObject({ content: 'partial', status: 'interrupted' });
  expect(state.busy).toBe(false);
});

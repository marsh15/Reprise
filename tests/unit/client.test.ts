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
it('ignores duplicate starts and all events after completion or cancellation', () => {
  let state = chatReducer(initialState, { type: 'begin', retry: false, user: { id: 'pending', role: 'user', content: 'Hi', status: 'complete', createdAt: '', localDate: '', seq: 1, replyTo: null } });
  state = chatReducer(state, { type: 'event', event: { type: 'turn.started', ...ids } });
  expect(chatReducer(state, { type: 'event', event: { type: 'turn.started', ...ids, assistantMessageId: ids.traceId } })).toBe(state);
  expect(chatReducer(state, { type: 'event', event: { type: 'turn.completed', assistantMessageId: ids.traceId, stats } })).toBe(state);
  for (const terminal of [
    { type: 'turn.completed' as const, assistantMessageId: ids.assistantMessageId, stats },
    { type: 'turn.error' as const, code: 'cancelled' as const, message: 'Stopped', retryable: true },
  ]) {
    const done = chatReducer(state, { type: 'event', event: terminal });
    for (const event of [terminal, { type: 'answer.delta' as const, text: 'late' }, { type: 'answer.reset' as const }]) {
      expect(chatReducer(done, { type: 'event', event })).toBe(done);
    }
  }
});
it('keeps a dropped-stream partial visibly incomplete and resets the active answer before retry', () => {
  const partial = { id: ids.assistantMessageId, role: 'assistant' as const, content: 'Partial', status: 'complete' as const, createdAt: '', localDate: '', seq: 2, replyTo: ids.userMessageId };
  const state = chatReducer({ ...initialState, messages: [partial], assistantId: partial.id, busy: true }, { type: 'error', message: 'Connection lost' });
  expect(state.messages[0]).toMatchObject({ content: 'Partial', status: 'interrupted' });
  expect(chatReducer(state, { type: 'begin', retry: true, user: partial })).toMatchObject({ busy: true, assistantId: null, error: null, messages: [state.messages[0]] });
});
it('stops reading at the first terminal event even when late events share a chunk', async () => {
  const events: TurnEvent[] = [];
  await readEvents(bytes(`event: turn.completed\ndata: ${JSON.stringify({ assistantMessageId: ids.assistantMessageId, stats })}\n\nevent: answer.delta\ndata: {"text":"late"}\n\n`, 1000), event => events.push(event));
  expect(events.map(event => event.type)).toEqual(['turn.completed']);
});
it('replaces parser diagnostics and transport exceptions with recoverable messages', async () => {
  await expect(readEvents(bytes('event: answer.delta\ndata: {"text":4}\n\n', 1000), () => {})).rejects.toThrow('The response could not be read. Retry your saved message.');
  const broken = new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error('internal socket details')); } });
  await expect(readEvents(broken, () => {})).rejects.toThrow('Connection lost. Retry your saved message.');
});
it('clears a lost-terminal warning only when the authoritative active answer is complete', () => {
  const answer = { id: ids.assistantMessageId, role: 'assistant' as const, content: 'Saved answer', status: 'complete' as const, createdAt: '', localDate: '', seq: 2, replyTo: ids.userMessageId };
  const dropped = { ...initialState, assistantId: answer.id, error: 'Connection lost' };
  expect(chatReducer(dropped, { type: 'load', messages: [answer] }).error).toBeNull();
  expect(chatReducer(dropped, { type: 'load', messages: [{ ...answer, status: 'interrupted' }] }).error).toBe('Connection lost');
  expect(chatReducer(dropped, { type: 'load', messages: [{ ...answer, id: ids.traceId }] }).error).toBe('Connection lost');
});

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { Message } from '../../src/client/components/Message';
import { chatReducer, initialState, type ChatState } from '../../src/client/state';
import type { RecallItem } from '../../src/shared/memory';
import type { MessageDTO } from '../../src/shared/types';

const item: RecallItem = { conversationId: randomUUID(), messageId: randomUUID(), title: 'Database notes', localDate: '2026-11-03', origin: 'fixture' };
const assistant: MessageDTO = { id: randomUUID(), role: 'assistant', content: 'Answer', status: 'complete', createdAt: '', localDate: '', seq: 2, replyTo: null };

it('renders an accessible recall button with the title, date and demo label above research', () => {
  const html = renderToStaticMarkup(createElement(Message, { message: { ...assistant, recall: [item], evidence: { searches: [{ id: randomUUID(), query: 'database', round: 1, freshness: 'any', startedAt: '2026-11-11T00:00:00Z', durationMs: 100, status: 'ok' }], sources: [], citations: [] } } }));
  expect(html).toContain('<button type="button"');
  expect(html).toContain('Database notes'); expect(html).toContain('Nov 3'); expect(html).toContain('Demo');
  expect(html.indexOf('recall-chip')).toBeLessThan(html.indexOf('research-status'));
  const live = renderToStaticMarkup(createElement(Message, { message: { ...assistant, recall: [{ ...item, origin: 'live' }] } }));
  expect(live).not.toContain('recall-demo');
});

it('attaches streamed recall only to the active assistant and retains it through resets', () => {
  const other = { ...assistant, id: randomUUID() };
  let state: ChatState = { ...initialState, assistantId: assistant.id, messages: [other, assistant], busy: true };
  state = chatReducer(state, { type: 'event', event: { type: 'recall', items: [item], resolutions: [] } });
  state = chatReducer(state, { type: 'event', event: { type: 'answer.reset' } });
  expect(state.messages[0].recall).toBeUndefined();
  expect(state.messages[1].recall).toEqual([item]);
  state = chatReducer(state, { type: 'event', event: { type: 'recall', items: [], resolutions: [] } });
  expect(state.messages[1].recall).toEqual([]);
});

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { Sidebar } from '../../src/client/components/Sidebar';
import type { Conversation } from '../../src/shared/types';

const props = { selected: null, now: '2026-11-11T12:00:00Z', onSelect: () => {}, onNew: () => {}, onDelete: () => {} };

it('labels the drawer trigger and empty conversation history', () => {
  const html = renderToStaticMarkup(createElement(Sidebar, { ...props, conversations: [] }));
  expect(html).toContain('aria-expanded="false"');
  expect(html).toContain('aria-controls="sidebar"');
  expect(html).toContain('aria-label="Conversation history"');
  expect(html).toContain('No conversations yet.');
  expect(html).not.toContain('aria-modal="true"');
});

it('renders one navigation tree with a labeled options button and current conversation', () => {
  const conversation: Conversation = { id: 'one', title: 'A conversation', preview: 'Hello', origin: 'fixture', updatedAt: '2026-11-11T12:00:00Z', createdAt: '2026-11-11T12:00:00Z' };
  const html = renderToStaticMarkup(createElement(Sidebar, { ...props, conversations: [conversation], selected: 'one' }));
  expect(html.match(/<nav\b/g)).toHaveLength(1);
  expect(html).toContain('aria-current="page"');
  expect(html).toContain('aria-label="Options for A conversation"');
  expect(html).toContain('Demo · Hello');
  expect(html).not.toContain('No conversations yet.');
});
it.each(['loading', 'unavailable'] as const)('does not describe %s history as an empty database', historyState => {
  const html = renderToStaticMarkup(createElement(Sidebar, { ...props, conversations: [], historyState }));
  expect(html).not.toContain('No conversations yet.');
  expect(html).toContain(historyState === 'loading' ? 'Loading conversations…' : 'Conversation history unavailable.');
});

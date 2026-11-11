import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Message } from '../../src/client/components/Message';
import { ResearchStatus } from '../../src/client/components/ResearchStatus';
import { chatReducer, initialState, type ChatState } from '../../src/client/state';
import type { SourceRecord, SearchRecord } from '../../src/shared/research';
import type { MessageDTO } from '../../src/shared/types';
const source: SourceRecord = { sourceId: randomUUID(), searchId: randomUUID(), n: 1, rank: 1, url: 'https://example.com/pricing', title: 'Price evidence', excerpt: 'Costs $90', publishedAt: null, retrievedAt: '2026-11-11T08:30:00Z', fixture: true };
const search: SearchRecord = { id: source.searchId, query: 'Example pricing', round: 1, freshness: 'any', startedAt: source.retrievedAt, durationMs: 1200, status: 'ok' };
const message: MessageDTO = { id: randomUUID(), role: 'assistant', content: 'Costs $90 [1]. Unknown [2]. `code [1]`\n\n| Price |\n|---|\n| $90 [1] |', status: 'complete', createdAt: '', localDate: '', seq: 2, replyTo: null,
  evidence: { searches: [search], sources: [source], citations: [{ marker: 1, sourceId: source.sourceId, state: 'verified', detail: null }, { marker: 2, sourceId: null, state: 'invalid', detail: 'No source' }] } };
it('renders citations in prose and table cells, leaves code alone, and explains limited verification', () => {
  const html = renderToStaticMarkup(createElement(Message, { message }));
  expect(html).toContain('Price evidence'); expect(html).toContain('Numbers and dates found; meaning not checked.');
  expect(html).toContain('[?]'); expect(html).toContain('<code>code [1]</code>'); expect(html).toContain('noopener noreferrer');
  expect(html).toContain('Demo fixture'); expect(html).toContain('1 search');
});
it('blocks model-supplied executable URLs and never uses them for citation pills', () => {
  const html = renderToStaticMarkup(createElement(Message, { message: { ...message, content: '[bad](javascript:alert) [1]' } }));
  expect(html).not.toContain('javascript:'); expect(html).toContain('href="https://example.com/pricing"');
});
it('shows no research line for conversational turns and announces active queries politely', () => {
  expect(renderToStaticMarkup(createElement(ResearchStatus, { searches: [], sources: [], running: false }))).toBe('');
  expect(renderToStaticMarkup(createElement(ResearchStatus, { searches: [search], sources: [], running: true }))).toContain('aria-live="polite"');
});
it('does not sum parallel durations as elapsed research time', () => {
  const html = renderToStaticMarkup(createElement(ResearchStatus, { searches: [search, { ...search, id: randomUUID(), durationMs: 2000 }], sources: [], running: false }));
  expect(html).toContain('2.0 s'); expect(html).not.toContain('3.2 s');
});
it('keeps evidence across answer.reset and reconciles research events', () => {
  let state: ChatState = { ...initialState, assistantId: message.id, messages: [{ ...message, content: 'Draft', evidence: undefined }], busy: true };
  state = chatReducer(state, { type: 'event', event: { type: 'search.started', searches: [{ ...search, status: 'error', durationMs: 0 }] } });
  state = chatReducer(state, { type: 'event', event: { type: 'search.finished', search, sources: [source] } });
  state = chatReducer(state, { type: 'event', event: { type: 'answer.reset' } });
  expect(state.messages[0].content).toBe(''); expect(state.messages[0].evidence?.sources).toEqual([source]);
  state = chatReducer(state, { type: 'event', event: { type: 'citations', citations: message.evidence!.citations } });
  expect(state.messages[0].evidence?.citations).toHaveLength(2);
});
it('keeps published calendar dates stable across timezones and counts URL identities once', async () => {
  const { sourceDateLabel } = await import('../../src/client/sourceLabels');
  const date = sourceDateLabel('2026-11-12', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' });
  expect(date).toContain('12'); expect(date).not.toContain('11/11');
  const html = renderToStaticMarkup(createElement(ResearchStatus, { searches: [search], sources: [source, { ...source, sourceId: randomUUID() }], running: false }));
  expect(html).toContain('1 source');
});
it('counts only sources from this research turn, keeping remembered observations out of the fresh-search summary', () => {
  const historical = { ...source, sourceId: randomUUID(), searchId: randomUUID(), n: 2, title: 'Historical only' };
  const html = renderToStaticMarkup(createElement(ResearchStatus, { searches: [search], sources: [historical, source], running: false }));
  expect(html).toContain('1 source'); expect(html).not.toContain('2 sources'); expect(html).not.toContain('Historical only');
});
it('shows each dated observation without implying the canonical source date supports every claim', () => {
  const current = { ...source, sourceId: randomUUID(), searchId: randomUUID(), title: 'New observation', excerpt: 'Costs $95', retrievedAt: '2026-11-12T08:30:00Z', fixture: false };
  const html = renderToStaticMarkup(createElement(Message, { message: { ...message, evidence: {
    searches: [{ ...search, id: current.searchId }], sources: [current, source], citations: message.evidence!.citations,
  } } }));
  expect(html).toContain('2 dated observations of this URL');
  expect(html).toContain('does not identify which observation supports each claim');
  expect(html).toContain('Preserved from an earlier answer');
  expect(html).toContain('Searched for this answer');
  expect(html).toContain('Costs $95'); expect(html).toContain('Costs $90');
  expect(html).toContain('meaning and supporting date not checked');
  expect(html).not.toContain('Source deleted or unavailable');
});
it.each(['auth', 'quota'])('keeps %s failures visible in the collapsed research summary', error => {
  const html = renderToStaticMarkup(createElement(ResearchStatus, { searches: [{ ...search, status: 'error', error }], sources: [], running: false }));
  expect(html.split('</summary>')[0]).toContain(error === 'auth' ? 'Search unavailable (authentication)' : 'Search unavailable (quota)');
});
it('keeps active research feedback bounded while retaining the full query list after completion', () => {
  const searches = Array.from({ length: 5 }, (_, index) => ({ ...search, id: randomUUID(), status: 'error' as const, query: `${index} ${'long '.repeat(50)}` }));
  const running = renderToStaticMarkup(createElement(ResearchStatus, { searches, sources: [], running: true }));
  expect(running).toContain('+3 more'); expect(running.length).toBeLessThan(450);
  const done = renderToStaticMarkup(createElement(ResearchStatus, { searches: searches.map(item => ({ ...item, status: 'empty' as const })), sources: [], running: false }));
  for (const item of searches) expect(done).toContain(item.query);
});
it('gives the source card a safe link and group semantics for touch and keyboard access', () => {
  const html = renderToStaticMarkup(createElement(Message, { message }));
  expect(html).toContain('role="group" aria-label="Source 1 details"');
  expect(html).toContain('<strong><a href="https://example.com/pricing" target="_blank" rel="noopener noreferrer">Price evidence</a></strong>');
  expect(html).not.toContain('role="tooltip"');
});

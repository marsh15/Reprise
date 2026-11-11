import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../../src/server/db/db';
import { createRepo } from '../../src/server/db/repo';
import { recall } from '../../src/server/memory/recall';
import { renderRecallContext } from '../../src/server/memory/context';
import { topicTerms } from '../../src/server/memory/stopwords';
import { pastTurn, historicalSource } from '../helpers/memory';
let store: ReturnType<typeof openDatabase>; let repo: ReturnType<typeof createRepo>;
const now = new Date('2026-11-11T08:30:00Z');
beforeEach(() => { store = openDatabase(':memory:'); repo = createRepo(store); });
afterEach(() => store.close());
const read = (text: string, conversationId: string = randomUUID(), userMessageId?: string) => recall(repo, { text, conversationId, userMessageId, now, tz: 'Asia/Kolkata' });
it('retrieves all exact-date turns across conversations, excludes the adjacent date and preserves raw text', () => {
  pastTurn(repo, 'Postgres hosting?'); pastTurn(repo, 'Node or Bun?'); pastTurn(repo, 'Kubernetes?', '2026-11-04');
  const packet = read('What did I ask on 3 November?');
  expect(packet.recalledTurns.map(t => t.userMessage.content).sort()).toEqual(['Node or Bun?', 'Postgres hosting?']);
  expect(packet.recalledTurns.every(t => t.reason === 'date')).toBe(true);
  expect(packet.historyStart).toBe('2026-11-03'); expect(packet.index).toHaveLength(3);
});
it('selects the older Tuesday when only it matches the topic', () => {
  pastTurn(repo, 'Postgres hosting?'); pastTurn(repo, 'Weekend?', '2026-11-10');
  const packet = read('Last Tuesday I asked about Postgres hosting. What did you recommend?');
  expect(packet.resolutions[0].chosen).toBe('2026-11-03');
  expect(packet.resolutions[0].assumption).toContain('2026-11-10');
  expect(packet.recalledTurns[0].reason).toBe('date+topic');
});
it('selects most recent topic match and names the other Tuesday', () => {
  pastTurn(repo, 'Postgres hosting?'); pastTurn(repo, 'Postgres options?', '2026-11-10');
  const packet = read('Last Tuesday Postgres hosting?');
  expect(packet.resolutions[0].chosen).toBe('2026-11-10'); expect(packet.resolutions[0].note).toContain('2026-11-03');
});
it('uses most recent populated date when neither topic matches, with an explicit mismatch', () => {
  pastTurn(repo, 'Weekend?', '2026-11-10'); pastTurn(repo, 'Node?', '2026-11-03');
  const packet = read('Last Tuesday Postgres hosting?');
  expect(packet.resolutions[0].chosen).toBe('2026-11-10'); expect(packet.resolutions[0].note).toContain('No topic match');
});
it('uses the latest populated candidate with no topic terms', () => {
  pastTurn(repo, 'Node?', '2026-11-03');
  expect(read('What did I ask last Tuesday?').resolutions[0].chosen).toBe('2026-11-03');
});
it('reports both empty candidates rather than inventing a date', () => {
  const packet = read('Last Tuesday Postgres hosting?');
  expect(packet.resolutions[0]).toMatchObject({ chosen: null, note: 'no conversations on 2026-11-10 or 2026-11-03' });
  expect(packet.historyStart).toBeNull(); expect(packet.recalledTurns).toEqual([]);
});
it('includes multiple same-day conversations, ranks topic first and reports omitted counts', () => {
  for (let i=0; i<8; i++) pastTurn(repo, `Other topic ${i}`);
  pastTurn(repo, 'Postgres hosting?');
  const packet = read('What did I ask on 3 November about Postgres?');
  expect(packet.recalledTurns.filter(t => t.reason !== 'topic')).toHaveLength(6);
  expect(packet.recalledTurns[0].userMessage.content).toBe('Postgres hosting?'); expect(packet.resolutions[0].note).toContain('+3 more');
});
it('retrieves topic matches in assistant answers, with deduplication and cross-conversation recall', () => {
  const t = pastTurn(repo, 'What do you recommend?', '2026-11-03', { answer: 'Choose Postgres hosting.' });
  const packet = read('What did you recommend for Postgres hosting?');
  expect(packet.recalledTurns).toHaveLength(1); expect(packet.recalledTurns[0].assistantMessage?.id).toBe(t.assistant.id);
});
it('uses most recent last mention, excluding the current user row', () => {
  pastTurn(repo, 'Postgres hosting?', '2026-11-03'); const latest = pastTurn(repo, 'Postgres?', '2026-11-10');
  const current = repo.startConversation({ text: 'Last time we discussed Postgres?', clientMessageId: randomUUID(), timezone: 'UTC', now });
  const packet = read(current.content, current.conversationId, current.id);
  expect(packet.recalledTurns).toHaveLength(1); expect(packet.recalledTurns[0].userMessage.id).toBe(latest.user.id);
});
it('carries terms for pronoun references, but not for topicless date questions', () => {
  const t = pastTurn(repo, 'Postgres hosting?'); const other = pastTurn(repo, 'Postgres comparison?', '2026-11-04');
  const packet = read('What did you say about this before?', t.user.conversationId);
  expect(packet.recalledTurns[0].userMessage.id).toBe(other.user.id);
  expect(read('What did I ask last Tuesday?', t.user.conversationId).resolutions[0].chosen).toBe('2026-11-03');
});
it('excludes recent turns from topic recall without duplicating plain chat history', () => {
  const t = pastTurn(repo, 'Postgres hosting?');
  const packet = read('Postgres hosting?', t.user.conversationId);
  expect(packet.currentConversation).toHaveLength(2); expect(packet.recalledTurns).toEqual([]);
});
it('attaches immutable historical observations and marks fixture origin', () => {
  const source = historicalSource(); const t = pastTurn(repo, 'Postgres?', undefined, { sources: [source] });
  store.db.prepare("UPDATE conversations SET origin='fixture' WHERE id=?").run(t.user.conversationId);
  const packet = read('Postgres?');
  expect(packet.recalledTurns[0].sources[0]).toEqual(source); expect(packet.recalledTurns[0].origin).toBe('fixture');
  expect(renderRecallContext(packet, [source], 'Postgres?')).toContain('historical observation');
});
it('preserves correction chronology and original answers rather than extracting facts', () => {
  const first = pastTurn(repo, 'CRM shortlist Copper', '2026-11-03');
  pastTurn(repo, 'Actually CRM shortlist Close, not Copper', '2026-11-04', { conversationId: first.user.conversationId });
  const packet = read('CRM shortlist?');
  expect(packet.recalledTurns.map(t => t.userMessage.localDate)).toEqual(['2026-11-03', '2026-11-04']);
});
it('keeps stored calendar dates even if current timezone differs', () => {
  const t = pastTurn(repo, 'Boundary', '2026-11-03', { timezone: 'Pacific/Honolulu' });
  expect(t.user.localDate).toBe('2026-11-02');
  expect(read('2 November').recalledTurns[0].userMessage.id).toBe(t.user.id);
});
it('records trimming without dropping protected date user text', () => {
  for (let i=0; i<6; i++) pastTurn(repo, `User original ${i} ` + 'x'.repeat(500), '2026-11-03', { answer: 'a'.repeat(8000), sources: [historicalSource(`https://example.com/${i}`, 'e'.repeat(1500))] });
  const packet = read('3 November');
  expect(renderRecallContext(packet, [], '3 November').length).toBeLessThanOrEqual(24000);
  expect(packet.recalledTurns).toHaveLength(6); expect(packet.notes.join()).toContain('1500');
  expect(packet.recalledTurns[0].userMessage.content.length).toBeGreaterThan(500);
});
it('requests clarification when protected messages alone exceed the cap, leaving records intact', () => {
  for (let i=0; i<6; i++) pastTurn(repo, 'x'.repeat(7900));
  const packet = read('3 November');
  expect(packet.clarification).toContain('narrow'); expect(packet.notes.join()).toContain('Protected evidence');
  expect(packet.recalledTurns).toEqual([]); expect(repo.findTurnsByLocalDates([{ from: '2026-11-03', to: '2026-11-03' }])).toHaveLength(6);
});
it('fails closed with an unavailable note on database errors', () => {
  const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
  store.db.exec('DROP TABLE messages_fts');
  const packet = read('Postgres hosting?');
  expect(packet.notes).toEqual(['memory unavailable this turn']); expect(packet.recalledTurns).toEqual([]);
  expect(spy).toHaveBeenCalled(); spy.mockRestore();
});
it('drops dates/meta words, keeps two-letter uppercase acronyms, caps and deduplicates safe FTS terms', () => {
  expect(topicTerms('What did I ask last Tuesday 3 November about AI DB AI?')).toEqual(['ai', 'db']);
  expect(topicTerms('one two three four five six seven eight nine')).toHaveLength(8);
});
it('keeps BM25 selection bounded and breaks equal-rank ties by recency', () => {
  pastTurn(repo, 'Postgres host', '2026-11-03', { answer: 'Short answer.' });
  pastTurn(repo, 'Postgres host', '2026-11-10', { answer: 'Short answer.' });
  expect(repo.ftsTurns('"postgres"')[0].user.localDate).toBe('2026-11-10');
  for (let i=0; i<6; i++) pastTurn(repo, 'Postgres host', `2026-10-${String(10+i).padStart(2,'0')}`, { answer: 'Short answer.' });
  expect(read('Postgres host').recalledTurns).toHaveLength(4);
});
it('bounds the recent window, conversation index and cited carry, independent of other chats', () => {
  const first = pastTurn(repo, 'First topic');
  for (let i=0; i<12; i++) pastTurn(repo, `Topic ${i}`, '2026-11-03', { conversationId: first.user.conversationId, sources: [historicalSource('https://example.com/' + i)] });
  for (let i=0; i<32; i++) pastTurn(repo, `Other ${i}`, '2026-11-04');
  const packet = read('Hello', first.user.conversationId);
  expect(packet.currentConversation).toHaveLength(20); expect(packet.index).toHaveLength(30);
  expect(packet.carriedSources).toHaveLength(2); expect(packet.index.every(c => c.turns >= 1)).toBe(true);
});
it('prioritizes cited historical sources, caps at six, and uses stable original-marker ordering', () => {
  const sources = Array.from({ length: 8 }, (_, i) => ({ ...historicalSource(`https://example.com/${i}`), n: i+1 }));
  const t = pastTurn(repo, 'Postgres sources', undefined, { sources });
  store.db.prepare('DELETE FROM citations WHERE message_id=? AND marker<>8').run(t.assistant.id);
  const selected = repo.getSourcesForMessages([t.assistant.id], 6)[0];
  expect(selected).toHaveLength(6); expect(selected.map(s => s.n)).toEqual([8,1,2,3,4,5]);
});
it('does not substitute another date\'s topic match for an absent requested date', () => {
  pastTurn(repo, 'Postgres hosting', '2026-11-09');
  const packet = read('Last Tuesday Postgres hosting?');
  expect(packet.resolutions[0].chosen).toBeNull(); expect(packet.recalledTurns[0].userMessage.localDate).toBe('2026-11-09');
  expect(packet.recalledTurns[0].reason).toBe('topic');
});
it('pairs only the latest assistant attempt and does not retrieve an older failed attempt as the answer', () => {
  const t = pastTurn(repo, 'Postgres hosting', undefined, { answer: 'Old failedattemptword.' });
  repo.insertAssistantTurn({ id: randomUUID(), user: t.user, text: 'Actual latest answer.', status: 'interrupted', now, model: 'test', stats: { searches: 0, sources: 0, latencyMs: 0, ttftMs: null, inputTokens: 0, outputTokens: 0 } });
  expect(repo.ftsTurns('"failedattemptword"')).toEqual([]);
  const packet = read('Postgres'); expect(packet.recalledTurns[0].assistantMessage).toMatchObject({ content: 'Actual latest answer.', status: 'interrupted' });
});

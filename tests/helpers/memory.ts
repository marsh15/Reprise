import type { MessageDTO } from '../../src/shared/types';
import type { RecallPacket } from '../../src/shared/memory';
import { randomUUID } from 'node:crypto';
import type { Repo } from '../../src/server/db/repo';
import type { SourceRecord } from '../../src/shared/research';
export const stats = { searches: 0, sources: 0, latencyMs: 0, ttftMs: null, inputTokens: 0, outputTokens: 0 };
export function pastTurn(repo: Repo, text: string, date = '2026-11-03', options: { conversationId?: string; answer?: string; sources?: SourceRecord[]; timezone?: string } = {}) {
  const input = { clientMessageId: randomUUID(), text, timezone: options.timezone ?? 'Asia/Kolkata', now: new Date(date + 'T08:00:00Z') };
  const user = options.conversationId ? repo.insertUserMessage({ ...input, conversationId: options.conversationId }) : repo.startConversation(input);
  const sources = options.sources ?? [];
  const assistant = repo.insertAssistantTurn({ id: randomUUID(), user, text: options.answer ?? 'The recorded answer.', status: 'complete', now: input.now, model: 'test', stats,
    evidence: { sources, searches: sources.map(s => ({ id: s.searchId, round: 1, query: 'test snapshot', freshness: 'any', startedAt: s.retrievedAt, durationMs: 0, status: 'ok' })),
      citations: sources.map(s => ({ marker: s.n, sourceId: s.sourceId, state: 'unchecked', detail: null })) } });
  return { user, assistant };
}
export function historicalSource(url = 'https://example.com/old', excerpt = 'Old price $90'): SourceRecord {
  return { sourceId: randomUUID(), searchId: randomUUID(), n: 1, rank: 1, url, title: 'Historical source', excerpt, publishedAt: null, retrievedAt: '2026-11-03T08:00:00.000Z', fixture: false };
}

export function emptyPacket(messages: MessageDTO[] = []): RecallPacket {
  return { nowLocal: 'Wed 11 Nov 2026, 14:00 (Asia/Kolkata)', historyStart: null, resolutions: [], recalledTurns: [], index: [], currentConversation: messages, carriedSources: [], notes: [], clarification: null };
}

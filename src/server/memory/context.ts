import type { RecallPacket } from '../../shared/memory';
import type { SourceRecord } from '../../shared/research';

export const clipHistoricalText = (text: string, limit: number) => text.length > limit ? text.slice(0, limit - 12) + ' [truncated]' : text;
export function isHistoricalRecheck(packet: RecallPacket, text: string): boolean {
  const hasAnswer = packet.recalledTurns.some(turn => turn.assistantMessage?.content.trim())
    || packet.currentConversation.some(message => message.role === 'assistant' && message.content.trim());
  return hasAnswer && /\b(still (correct|true|accurate|valid)|changed?|since|any (updates?|news)|up to date|outdated|recheck|re-check|(?:previous|earlier|your|old) answer (?:correct|accurate))\b/i.test(text);
}
export function renderRecallContext(packet: RecallPacket, sources: SourceRecord[], userText: string): string {
  const observation = (source: SourceRecord) => ({ n: sources.find(s => s.sourceId === source.sourceId)?.n ?? 999999,
    cite: `[${sources.find(s => s.sourceId === source.sourceId)?.n ?? 999999}]`, sourceId: source.sourceId, historicalMarker: source.n, title: source.title, url: source.url, published: source.publishedAt,
    retrieved: source.retrievedAt, excerpt: clipHistoricalText(source.excerpt, 600), fixture: source.fixture, kind: 'historical observation' });
  const suppliedIds = new Set([...packet.recalledTurns.flatMap(t => t.sources), ...packet.carriedSources].map(s => s.sourceId));
  const context = {
    now: packet.nowLocal, history_start: packet.historyStart ?? 'none (no earlier conversations)',
    date_resolutions: packet.resolutions, notes: packet.notes, clarification: packet.clarification,
    recent_message_metadata: packet.currentConversation.map(message => ({ id: message.id, role: message.role,
      localDate: message.localDate, createdAt: message.createdAt, status: message.status, seq: message.seq,
      source_refs: (message.evidence?.sources ?? []).filter(s => suppliedIds.has(s.sourceId)).map(s => ({
        sourceId: s.sourceId, historicalMarker: s.n, n: sources.find(registered => registered.sourceId === s.sourceId)?.n ?? 999999,
      })),
    })),
    recalled: packet.recalledTurns.map(turn => ({ ...turn, sources: turn.sources.map(observation) })),
    conversation_index: packet.index, carried_sources: packet.carriedSources.map(observation),
    ...(isHistoricalRecheck(packet, userText)
      ? { task_hint: 'verify the checkable claims from the relevant recorded answer against current sources before answering; keep historical observations separate from current evidence. An incomplete answer or missing historical source is not a verified baseline.' } : {}),
  };
  // JSON escaping keeps original text intact while preventing data from closing the context delimiter.
  return '<context>\n' + JSON.stringify(context).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e') + '\n</context>';
}
export function boundRecallPacket(packet: RecallPacket, userText: string) {
  const size = () => renderRecallContext(packet, [], userText).length;
  const trim = (note: string, action: () => void) => { action(); packet.notes.push(note); };
  if (size() > 23900 && packet.index.length > 10) trim('Conversation index limited to 10 entries.', () => { packet.index = packet.index.slice(0, 10); });
  while (size() > 23900 && packet.recalledTurns.some(t => t.reason === 'topic')) trim('Topic turn omitted to fit context.', () => {
    const last = packet.recalledTurns.findLastIndex(t => t.reason === 'topic'); packet.recalledTurns.splice(last, 1);
  });
  while (size() > 23900 && packet.carriedSources.length) trim('Carried source omitted to fit context.', () => { packet.carriedSources.pop(); });
  if (size() > 23900 && packet.recalledTurns.some(t => t.sources.length > 3)) trim('Historical sources limited to 3 per turn.', () => {
    packet.recalledTurns.forEach(t => { t.sources = t.sources.slice(0, 3); });
  });
  if (size() > 23900 && packet.recalledTurns.some(t => (t.assistantMessage?.content.length ?? 0) > 1500)) trim('Historical assistant text limited to 1500 characters.', () => {
    packet.recalledTurns.forEach(t => { if (t.assistantMessage) t.assistantMessage.content = clipHistoricalText(t.assistantMessage.content, 1500); });
  });
  if (size() > 23900) {
    // The owner chose clarification over silently dropping protected date-matched user evidence.
    packet.clarification = 'The matching history is too large to include accurately, so I have not included those records in this answer. Please narrow the date range or name the topic or conversation.';
    packet.notes.push('Protected evidence exceeds the context budget; no historical evidence supplied. Raw messages remain stored unchanged.');
    packet.recalledTurns = []; packet.carriedSources = []; packet.index = []; packet.resolutions = [];
  }
  return packet;
}

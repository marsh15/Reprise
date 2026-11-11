import type { RecallPacket, RecalledTurn, ResolvedMemoryDate } from '../../shared/memory';
import type { Repo } from '../db/repo';
import { resolveDates, type DateCandidate } from '../time/resolve';
import { topicTerms, ftsQuery } from './stopwords';
import { boundRecallPacket, clipHistoricalText } from './context';
import { createLogger } from '../log';

type Input = { text: string; conversationId: string; now: Date; tz: string; userMessageId?: string };
type StoredTurn = ReturnType<Repo['findTurnsByLocalDates']>[number];
function chronological(a: StoredTurn, b: StoredTurn) {
  return a.user.createdAt.localeCompare(b.user.createdAt) || a.user.conversationId.localeCompare(b.user.conversationId) || a.user.seq - b.user.seq;
}
function recalled(turn: StoredTurn, sources: RecalledTurn['sources'], reason: RecalledTurn['reason']): RecalledTurn {
  return { conversationId: turn.conversation.id, conversationTitle: turn.conversation.title, origin: turn.conversation.origin,
    userMessage: { id: turn.user.id, content: turn.user.content, localDate: turn.user.localDate, createdAt: turn.user.createdAt },
    assistantMessage: turn.assistant ? { id: turn.assistant.id, content: clipHistoricalText(turn.assistant.content, 4000), status: turn.assistant.status } : null,
    sources, reason };
}
export function recall(repo: Repo, input: Input): RecallPacket {
  const packet: RecallPacket = { nowLocal: new Intl.DateTimeFormat('en-GB', { timeZone: input.tz, dateStyle: 'full', timeStyle: 'long' }).format(input.now) + ` (${input.tz})`,
    historyStart: null, resolutions: [], recalledTurns: [], index: [], currentConversation: [], carriedSources: [], notes: [], clarification: null };
  try {
    packet.currentConversation = repo.getConversationMessages(input.conversationId, 21, input.userMessageId)
      .filter(m => m.id !== input.userMessageId).slice(-20);
    const resolutions = resolveDates(input.text, input.now, input.tz);
    let terms = topicTerms(resolutions.reduce((text, r) => text.replace(r.phrase, ' '), input.text));
    if (terms.length < 3 && /\b(this|that|those|it|before|previous|then|them)\b/i.test(input.text)) {
      const previous = packet.currentConversation.findLast(m => m.role === 'user');
      terms = [...new Set([...terms, ...topicTerms(previous?.content ?? '')])].slice(0, 8);
    }
    const query = ftsQuery(terms);
    const excluded = input.userMessageId ? [input.userMessageId] : [];
    const selected = new Set<string>();
    const attach = (turn: StoredTurn, reason: RecalledTurn['reason']) => {
      if (selected.has(turn.user.id)) return;
      selected.add(turn.user.id);
      const sources = turn.assistant ? repo.getSourcesForMessages([turn.assistant.id], 6)[0] : [];
      packet.recalledTurns.push(recalled(turn, sources, reason));
    };
    for (const resolution of resolutions) {
      const resolved: ResolvedMemoryDate = { phrase: resolution.phrase, chosen: null, alternatives: [], assumption: null, note: null };
      packet.resolutions.push(resolved);
      if (resolution.kind === 'last_mention') {
        const latest = query ? repo.ftsTurns(query, { excludeIds: excluded, recent: true, limit: 1 })[0] : undefined;
        if (latest) { attach(latest, 'topic'); resolved.chosen = latest.user.localDate; }
        else resolved.note = 'No recorded topic match for the last discussion.';
        continue;
      }
      const candidates = resolution.candidates.map(candidate => ({ candidate,
        turns: repo.findTurnsByLocalDates([candidate], input.userMessageId),
        matches: query ? repo.ftsTurnsOnDates(query, [candidate], excluded) : [],
      }));
      const matching = candidates.filter(c => c.matches.length);
      const chosen = matching[0] ?? candidates.find(c => c.turns.length);
      if (!chosen) {
        resolved.note = `no conversations on ${resolution.candidates.map(c => c.from === c.to ? c.from : `${c.from} to ${c.to}`).join(' or ')}`;
        continue;
      }
      const date: DateCandidate = chosen.candidate;
      resolved.chosen = date.from === date.to ? date.from : { from: date.from, to: date.to };
      resolved.alternatives = resolution.candidates.filter(c => c !== date).map(c => c.from);
      if (resolution.ambiguous) {
        resolved.assumption = `${date.label} — ${chosen.matches.length ? 'the date with a recorded topic match' : 'the most recent candidate with recorded conversations'}; alternative: ${resolved.alternatives.join(', ')}`;
        if (matching.length > 1) resolved.note = `also discussed on ${matching.slice(1).map(c => c.candidate.from).join(', ')}`;
      }
      if (query && !chosen.matches.length) resolved.note = 'No topic match on the selected date; these records do not establish that the requested topic was discussed.';
      const matchingIds = new Set(chosen.matches.map(t => t.user.id));
      const turns = chosen.turns.sort((a, b) => Number(matchingIds.has(b.user.id)) - Number(matchingIds.has(a.user.id)) || chronological(a, b));
      turns.slice(0, 6).forEach(turn => attach(turn, matchingIds.has(turn.user.id) ? 'date+topic' : 'date'));
      if (turns.length > 6) resolved.note = [resolved.note, `+${turns.length - 6} more turns in this date range`].filter(Boolean).join('; ');
    }
    const recentIds = packet.currentConversation.flatMap(m => [m.id, ...(m.replyTo ? [m.replyTo] : [])]);
    if (query && !resolutions.some(r => r.kind === 'last_mention')) {
      repo.ftsTurns(query, { excludeIds: [...excluded, ...selected, ...recentIds], limit: 4 }).sort(chronological).forEach(t => attach(t, 'topic'));
    }
    packet.index = repo.conversationIndex(30);
    packet.historyStart = repo.historyStart();
    packet.carriedSources = repo.carriedSources(packet.currentConversation);
    return boundRecallPacket(packet, input.text);
  } catch {
    createLogger({ now: () => input.now, isOverridden: () => false }, 'error')('error', 'recall.failed', { conversationId: input.conversationId });
    // Do not expose partially assembled memory after retrieval failure.
    return { ...packet, historyStart: null, resolutions: [], recalledTurns: [], index: [], currentConversation: [], carriedSources: [], notes: ['memory unavailable this turn'] };
  }
}

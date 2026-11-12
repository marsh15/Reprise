import { randomUUID } from 'node:crypto';
import type { SQLInputValue, StatementSync } from 'node:sqlite';
import type { Conversation, MessageDTO, TurnStats } from '../../shared/types';
import type { Evidence, SourceRecord, SearchRecord, CitationRecord } from '../../shared/research';
import type { Store } from './db';
import type { RecallItem, RecallPacket } from '../../shared/memory';

type UserInput = { conversationId: string; clientMessageId: string; text: string; timezone: string; now: Date };
export type StoredMessage = MessageDTO & { conversationId: string; clientMessageId: string | null; timezone: string; meta: string | null };
type MessageRow = { id: string; conversation_id: string; seq: number; role: MessageDTO['role']; content: string; status: MessageDTO['status']; created_at: string; local_date: string; tz: string; reply_to: string | null; client_message_id: string | null; meta: string | null };

export function createRepo(store: Store) {
  // Statements belong to a connection; tests and multiple stores never share them.
  const statements = new Map<string, StatementSync>();
  function sql(query: string) {
    let statement = statements.get(query);
    if (!statement) { statement = store.db.prepare(query); statements.set(query, statement); }
    return statement;
  }
  function toMessage(row: MessageRow): StoredMessage {
    return { id: row.id, conversationId: row.conversation_id, seq: row.seq, role: row.role,
      content: row.content, status: row.status, createdAt: row.created_at, localDate: row.local_date,
      timezone: row.tz, replyTo: row.reply_to, clientMessageId: row.client_message_id, meta: row.meta, ...(row.meta ? { recall: JSON.parse(row.meta).recall } : {}), ...(row.role === 'assistant' ? { evidence: getEvidence(row.id, row.meta) } : {}) };
  }
  function message(query: string, ...params: SQLInputValue[]): StoredMessage | undefined {
    const row = sql(query).get(...params) as MessageRow | undefined;
    return row && toMessage(row);
  }
  const conversationSelect = `SELECT id, title, origin, created_at AS createdAt, updated_at AS updatedAt,
    COALESCE((SELECT substr(content,1,100) FROM messages WHERE conversation_id=conversations.id ORDER BY seq DESC LIMIT 1),'') AS preview FROM conversations`;
  function getConversation(id: string) { return sql(`${conversationSelect} WHERE id=?`).get(id) as Conversation | undefined; }
  function touchConversation(id: string, now: Date) { sql('UPDATE conversations SET updated_at=? WHERE id=?').run(now.toISOString(), id); }
  function createConversation(text: string, now: Date, origin: 'live' | 'fixture' = 'live') {
    const id = randomUUID();
    let title = text.replace(/\s+/g, ' ').trim();
    if (title.length > 60) title = (title.slice(0, 60).replace(/\s+\S*$/, '') || title.slice(0, 60)) + '…';
    sql('INSERT INTO conversations(id,title,origin,created_at,updated_at) VALUES(?,?,?,?,?)').run(id, title, origin, now.toISOString(), now.toISOString());
    return getConversation(id)!;
  }
  function insertMessage(input: { id: string; conversationId: string; role: MessageDTO['role']; text: string; status: MessageDTO['status']; timezone: string; now: Date; replyTo?: string; clientMessageId?: string; meta?: string }) {
    const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: input.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(input.now);
    sql(`INSERT INTO messages(id,conversation_id,seq,role,content,status,created_at,local_date,tz,reply_to,client_message_id,meta)
      VALUES(?,?,(SELECT COALESCE(MAX(seq),0)+1 FROM messages WHERE conversation_id=?),?,?,?,?,?,?,?,?,?)`)
      .run(input.id, input.conversationId, input.conversationId, input.role, input.text, input.status,
        input.now.toISOString(), localDate, input.timezone, input.replyTo ?? null, input.clientMessageId ?? null, input.meta ?? null);
    touchConversation(input.conversationId, input.now);
    return getMessage(input.id)!;
  }
  function getMessage(id: string) { return message('SELECT * FROM messages WHERE id=?', id); }
  function findClientMessage(id: string) { return message('SELECT * FROM messages WHERE client_message_id=?', id); }
  function getReply(id: string) { return message('SELECT * FROM messages WHERE reply_to=? ORDER BY seq DESC LIMIT 1', id); }
  function getConversationMessages(id: string, limit?: number, excludeRepliesTo?: string): StoredMessage[] {
    const rows = sql('SELECT * FROM messages WHERE conversation_id=? AND (reply_to IS NULL OR reply_to<>?) ORDER BY seq DESC LIMIT ?').all(id, excludeRepliesTo ?? '', limit ?? -1) as MessageRow[];
    return rows.reverse().map(toMessage);
  }
  function getEvidence(id: string, meta: string | null): Evidence {
    const refs = (meta ? JSON.parse(meta).sourceRefs : undefined) as { sourceId: string; n: number }[] | undefined;
    const searches = sql(`SELECT id,round,query,freshness,started_at AS startedAt,duration_ms AS durationMs,status,error
      FROM searches WHERE message_id=? ORDER BY round,started_at,id`).all(id) as SearchRecord[];
    const citations = sql('SELECT marker,source_id AS sourceId,state,detail FROM citations WHERE message_id=? ORDER BY marker').all(id) as CitationRecord[];
    const sources: SourceRecord[] = [];
    for (const ref of refs ?? []) {
      const source = sql(`SELECT id AS sourceId,search_id AS searchId,rank,url,title,excerpt,published_at AS publishedAt,
        retrieved_at AS retrievedAt,fixture FROM sources WHERE id=?`).get(ref.sourceId) as Omit<SourceRecord, 'n'> | undefined;
      if (source) sources.push({ ...source, n: ref.n, fixture: Boolean(source.fixture) });
    }
    return { searches: searches.map(search => ({ ...search, error: search.error ?? undefined })), sources, citations };
  }
  function saveEvidence(id: string, evidence: Evidence) {
    const ownSearches = new Set(evidence.searches.map(search => search.id));
    for (const search of evidence.searches) sql(`INSERT INTO searches(id,message_id,round,query,freshness,started_at,duration_ms,status,error)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(search.id, id, search.round, search.query, search.freshness, search.startedAt, search.durationMs, search.status, search.error ?? null);
    for (const source of evidence.sources) if (ownSearches.has(source.searchId)) sql(`INSERT INTO sources(id,search_id,rank,url,title,excerpt,published_at,retrieved_at,fixture)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(source.sourceId, source.searchId, source.rank, source.url, source.title, source.excerpt, source.publishedAt, source.retrievedAt, Number(source.fixture));
    for (const citation of evidence.citations) {
      // A recalled source may have been deleted while this answer was streaming. Do not resurrect it or lose the answer.
      const missing = citation.sourceId !== null && !sql('SELECT id FROM sources WHERE id=?').get(citation.sourceId);
      sql('INSERT INTO citations(message_id,marker,source_id,state,detail) VALUES(?,?,?,?,?)')
        .run(id, citation.marker, missing ? null : citation.sourceId, missing ? 'unverified' : citation.state, missing ? 'Source deleted or unavailable.' : citation.detail);
    }
  }
  function carriedSources(messages: MessageDTO[]): SourceRecord[] {
    const assistants = messages.filter(message => message.role === 'assistant').slice(-2);
    const sources = assistants.flatMap(message => {
      const cited = new Set(message.evidence?.citations.filter(c => c.sourceId !== null).map(c => c.marker));
      return message.evidence?.sources.filter(s => cited.has(s.n)) ?? [];
    });
    return [...new Map(sources.map(source => [source.sourceId, source])).values()].slice(-8);
  }
  function turn(id: string) {
    const user = getMessage(id)!;
    return { user, assistant: getReply(id) ?? null, conversation: getConversation(user.conversationId)! };
  }
  /** Chronological user-turn keys only; callers hydrate the few turns they keep. */
  function turnKeysByLocalDates(ranges: { from: string; to: string }[], excludeUserId = '') {
    if (!ranges.length) return [];
    const where = ranges.map(() => '(local_date BETWEEN ? AND ?)').join(' OR ');
    return sql(`SELECT id, created_at AS createdAt, conversation_id AS conversationId, seq FROM messages WHERE role='user' AND id<>? AND (${where}) ORDER BY created_at,conversation_id,seq,id`)
      .all(excludeUserId, ...ranges.flatMap(r => [r.from, r.to])) as { id: string; createdAt: string; conversationId: string; seq: number }[];
  }
  function findTurnsByLocalDates(ranges: { from: string; to: string }[], excludeUserId = '') {
    return turnKeysByLocalDates(ranges, excludeUserId).map(row => turn(row.id));
  }
  function ftsTurns(query: string, options: { ranges?: { from: string; to: string }[]; excludeIds?: string[]; limit?: number; recent?: boolean } = {}) {
    return ftsTurnIds(query, options).map(id => turn(id));
  }
  function ftsTurnIds(query: string, options: { ranges?: { from: string; to: string }[]; excludeIds?: string[]; limit?: number; recent?: boolean } = {}) {
    const ranges = options.ranges ?? [];
    const exclude = options.excludeIds ?? [];
    const dateFilter = ranges.length ? `AND (${ranges.map(() => '(u.local_date BETWEEN ? AND ?)').join(' OR ')})` : '';
    const excluded = exclude.length ? `AND u.id NOT IN (${exclude.map(() => '?').join(',')})` : '';
    const rows = sql(`WITH hits AS MATERIALIZED (
      SELECT CASE WHEN m.role='user' THEN m.id ELSE m.reply_to END AS user_id, bm25(messages_fts) AS score
      FROM messages_fts JOIN messages m ON m.rowid_alias=messages_fts.rowid WHERE messages_fts MATCH ?
      AND (m.role='user' OR m.id=(SELECT id FROM messages WHERE reply_to=m.reply_to ORDER BY seq DESC LIMIT 1)))
      SELECT u.id, MIN(h.score) AS score FROM hits h JOIN messages u ON u.id=h.user_id
      WHERE 1=1 ${dateFilter} ${excluded} GROUP BY u.id
      ORDER BY ${options.recent ? '' : 'score,'} u.created_at DESC,u.conversation_id,u.seq DESC,u.id LIMIT ?`)
      .all(query, ...ranges.flatMap(r => [r.from, r.to]), ...exclude, options.limit ?? 4) as { id: string }[];
    return rows.map(row => row.id);
  }
  function getSourcesForMessages(ids: string[], perMessage: number) {
    return ids.map(id => {
      const evidence = getMessage(id)?.evidence;
      const cited = new Set(evidence?.citations.filter(c => c.sourceId).map(c => c.marker));
      return (evidence?.sources ?? [])
        .sort((a, b) => Number(cited.has(b.n)) - Number(cited.has(a.n)) || a.rank - b.rank || a.n - b.n || a.sourceId.localeCompare(b.sourceId)).slice(0, perMessage);
    });
  }
  function conversationIndex(limit: number): RecallPacket['index'] {
    return sql(`SELECT c.id AS conversationId,c.title,c.origin,MIN(m.local_date) AS firstLocalDate,COUNT(*) AS turns
      FROM conversations c JOIN messages m ON m.conversation_id=c.id AND m.role='user'
      GROUP BY c.id ORDER BY c.updated_at DESC,c.id LIMIT ?`).all(limit) as RecallPacket['index'];
  }
  function seedFixtures(fixtures: { title: string; user: string; assistant: string; now: Date; timezone: string; sources: { url: string; title: string; excerpt: string }[] }[], reset = false) {
    return store.transaction(() => {
      const existing = sql("SELECT id FROM conversations WHERE origin='fixture'").all();
      if (existing.length && !reset) throw new Error('Demo fixtures already exist. Use --reset-fixtures to replace only demo conversations.');
      if (reset) sql("DELETE FROM conversations WHERE origin='fixture'").run();
      return fixtures.map(fixture => {
        const conversation = createConversation(fixture.title, fixture.now, 'fixture');
        const user = insertMessage({ id: randomUUID(), conversationId: conversation.id, role: 'user', text: fixture.user, status: 'complete', timezone: fixture.timezone, now: fixture.now, clientMessageId: randomUUID() });
        const searches: SearchRecord[] = fixture.sources.map(source => ({ id: randomUUID(), round: 1, query: `[Demo fixture] ${source.title}`, freshness: 'any', startedAt: fixture.now.toISOString(), durationMs: 0, status: 'ok' }));
        const sources: SourceRecord[] = fixture.sources.map((source, i) => ({ ...source, sourceId: randomUUID(), searchId: searches[i].id, rank: 1, n: i+1, publishedAt: null, retrievedAt: fixture.now.toISOString(), fixture: true }));
        const assistant = insertMessage({ id: randomUUID(), conversationId: conversation.id, role: 'assistant', text: fixture.assistant, status: 'complete', timezone: fixture.timezone, now: fixture.now, replyTo: user.id,
          meta: JSON.stringify({ model: 'demo-fixture', sourceRefs: sources.map(({ sourceId, n }) => ({ sourceId, n })) }) });
        saveEvidence(assistant.id, { searches, sources, citations: sources.map(source => ({ marker: source.n, sourceId: source.sourceId, state: 'unchecked', detail: 'Illustrative demo fixture; not live verification.' })) });
        return getConversation(conversation.id)!;
      });
    });
  }
  return {
    getConversation,
    startConversation: (input: Omit<UserInput, 'conversationId'> & { origin?: 'live' | 'fixture' }) => store.transaction(() => {
      const conversation = createConversation(input.text, input.now, input.origin);
      return insertMessage({ ...input, conversationId: conversation.id, id: randomUUID(), role: 'user', status: 'complete' });
    }),
    listConversations: () => sql(`${conversationSelect} ORDER BY updated_at DESC, id`).all() as Conversation[],
    deleteConversation: (id: string) => store.transaction(() => sql('DELETE FROM conversations WHERE id=?').run(id).changes > 0),
    getMessage, findClientMessage, getReply, getConversationMessages, carriedSources,
    turn, findTurnsByLocalDates, turnKeysByLocalDates, ftsTurns, getSourcesForMessages, conversationIndex, seedFixtures,
    ftsTurnIdsOnDates: (query: string, ranges: { from: string; to: string }[], excludeIds: string[] = []) => ftsTurnIds(query, { ranges, excludeIds, limit: -1 }),
    historyStart: () => (sql("SELECT MIN(local_date) AS date FROM messages").get() as {date: string | null}).date,
    insertUserMessage: (input: UserInput) => store.transaction(() => findClientMessage(input.clientMessageId) ?? insertMessage({ ...input, id: randomUUID(), role: 'user', status: 'complete' })),
    insertAssistantTurn: (input: { id: string; user: StoredMessage; text: string; status: MessageDTO['status']; now: Date; model: string; stats: TurnStats; evidence?: Evidence; recall?: RecallItem[]; assumptions?: unknown; clientMessageId?: string }) => store.transaction(() => {
      insertMessage({ id: input.id, conversationId: input.user.conversationId, role: 'assistant', text: input.text,
        status: input.status, timezone: input.user.timezone, now: input.now, replyTo: input.user.id, clientMessageId: input.clientMessageId,
        meta: JSON.stringify({ model: input.model, ...input.stats, recall: input.recall, assumptions: input.assumptions,
          sourceRefs: input.evidence?.sources.map(({ sourceId, n }) => ({ sourceId, n })) ?? [] }),
      });
      if (input.evidence) saveEvidence(input.id, input.evidence);
      return getMessage(input.id)!;
    }),
  };
}
export type Repo = ReturnType<typeof createRepo>;

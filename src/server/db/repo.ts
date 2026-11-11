import { randomUUID } from 'node:crypto';
import type { SQLInputValue, StatementSync } from 'node:sqlite';
import type { Conversation, MessageDTO, TurnStats } from '../../shared/types';
import type { Evidence, SourceRecord, SearchRecord, CitationRecord } from '../../shared/research';
import type { Store } from './db';

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
      timezone: row.tz, replyTo: row.reply_to, clientMessageId: row.client_message_id, meta: row.meta, ...(row.role === 'assistant' ? { evidence: getEvidence(row.id, row.meta) } : {}) };
  }
  function message(query: string, ...params: SQLInputValue[]): StoredMessage | undefined {
    const row = sql(query).get(...params) as MessageRow | undefined;
    return row && toMessage(row);
  }
  const conversationSelect = `SELECT id, title, origin, created_at AS createdAt, updated_at AS updatedAt,
    COALESCE((SELECT substr(content,1,100) FROM messages WHERE conversation_id=conversations.id ORDER BY seq DESC LIMIT 1),'') AS preview FROM conversations`;
  function getConversation(id: string) { return sql(`${conversationSelect} WHERE id=?`).get(id) as Conversation | undefined; }
  function touchConversation(id: string, now: Date) { sql('UPDATE conversations SET updated_at=? WHERE id=?').run(now.toISOString(), id); }
  function createConversation(text: string, now: Date) {
    const id = randomUUID();
    let title = text.replace(/\s+/g, ' ').trim();
    if (title.length > 60) title = (title.slice(0, 60).replace(/\s+\S*$/, '') || title.slice(0, 60)) + '…';
    sql('INSERT INTO conversations(id,title,created_at,updated_at) VALUES(?,?,?,?)').run(id, title, now.toISOString(), now.toISOString());
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
    for (const citation of evidence.citations) sql('INSERT INTO citations(message_id,marker,source_id,state,detail) VALUES(?,?,?,?,?)')
      .run(id, citation.marker, citation.sourceId, citation.state, citation.detail);
  }
  function carriedSources(messages: StoredMessage[]): SourceRecord[] {
    const assistants = messages.filter(message => message.role === 'assistant').slice(-2);
    const sources = assistants.flatMap(message => {
      const cited = new Set(message.evidence?.citations.filter(c => c.sourceId !== null).map(c => c.marker));
      return message.evidence?.sources.filter(s => cited.has(s.n)) ?? [];
    });
    return [...new Map(sources.map(source => [source.sourceId, source])).values()].slice(-8);
  }
  return {
    createConversation, getConversation, touchConversation,
    startConversation: (input: Omit<UserInput, 'conversationId'>) => store.transaction(() => {
      const conversation = createConversation(input.text, input.now);
      return insertMessage({ ...input, conversationId: conversation.id, id: randomUUID(), role: 'user', status: 'complete' });
    }),
    listConversations: () => sql(`${conversationSelect} ORDER BY updated_at DESC, id`).all() as Conversation[],
    deleteConversation: (id: string) => store.transaction(() => sql('DELETE FROM conversations WHERE id=?').run(id).changes > 0),
    getMessage, findClientMessage, getReply, getConversationMessages, carriedSources,
    historyStart: () => (sql("SELECT MIN(local_date) AS date FROM messages").get() as {date: string | null}).date,
    insertUserMessage: (input: UserInput) => store.transaction(() => findClientMessage(input.clientMessageId) ?? insertMessage({ ...input, id: randomUUID(), role: 'user', status: 'complete' })),
    insertAssistantTurn: (input: { id: string; user: StoredMessage; text: string; status: MessageDTO['status']; now: Date; model: string; stats: TurnStats; evidence?: Evidence }) => store.transaction(() => {
      insertMessage({ id: input.id, conversationId: input.user.conversationId, role: 'assistant', text: input.text,
        status: input.status, timezone: input.user.timezone, now: input.now, replyTo: input.user.id,
        meta: JSON.stringify({ model: input.model, ...input.stats,
          sourceRefs: input.evidence?.sources.map(({ sourceId, n }) => ({ sourceId, n })) ?? [] }),
      });
      if (input.evidence) saveEvidence(input.id, input.evidence);
      return getMessage(input.id)!;
    }),
  };
}
export type Repo = ReturnType<typeof createRepo>;

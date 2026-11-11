import { randomUUID } from 'node:crypto';
import type { SQLInputValue, StatementSync } from 'node:sqlite';
import type { Conversation, MessageDTO, TurnStats } from '../../shared/types';
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
  function message(query: string, ...params: SQLInputValue[]): StoredMessage | undefined {
    const row = sql(query).get(...params) as MessageRow | undefined;
    if (!row) return;
    return { id: row.id, conversationId: row.conversation_id, seq: row.seq, role: row.role,
      content: row.content, status: row.status, createdAt: row.created_at, localDate: row.local_date,
      timezone: row.tz, replyTo: row.reply_to, clientMessageId: row.client_message_id, meta: row.meta };
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
    const rows = sql('SELECT id FROM messages WHERE conversation_id=? AND (reply_to IS NULL OR reply_to<>?) ORDER BY seq DESC LIMIT ?').all(id, excludeRepliesTo ?? '', limit ?? -1) as { id: string }[];
    return rows.reverse().map(row => getMessage(row.id)!);
  }
  return {
    transaction: store.transaction, createConversation, getConversation, touchConversation,
    startConversation: (input: Omit<UserInput, 'conversationId'>) => store.transaction(() => {
      const conversation = createConversation(input.text, input.now);
      return insertMessage({ ...input, conversationId: conversation.id, id: randomUUID(), role: 'user', status: 'complete' });
    }),
    listConversations: () => sql(`${conversationSelect} ORDER BY updated_at DESC, id`).all() as Conversation[],
    deleteConversation: (id: string) => store.transaction(() => sql('DELETE FROM conversations WHERE id=?').run(id).changes > 0),
    getMessage, findClientMessage, getReply, getConversationMessages,
    insertUserMessage: (input: UserInput) => store.transaction(() => findClientMessage(input.clientMessageId) ?? insertMessage({ ...input, id: randomUUID(), role: 'user', status: 'complete' })),
    insertAssistantTurn: (input: { id: string; user: StoredMessage; text: string; status: MessageDTO['status']; now: Date; model: string; stats: TurnStats }) => store.transaction(() => insertMessage({
      id: input.id, conversationId: input.user.conversationId, role: 'assistant', text: input.text,
      status: input.status, timezone: input.user.timezone, now: input.now, replyTo: input.user.id,
      meta: JSON.stringify({ model: input.model, ...input.stats }),
    })),
  };
}
export type Repo = ReturnType<typeof createRepo>;

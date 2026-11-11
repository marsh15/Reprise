import { afterEach, beforeEach, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../../src/server/db/db';
import { createRepo } from '../../src/server/db/repo';

let store: ReturnType<typeof openDatabase>;
let repo: ReturnType<typeof createRepo>;
const now = new Date('2026-11-11T20:00:00Z');
beforeEach(() => { store = openDatabase(':memory:'); repo = createRepo(store); });
afterEach(() => store.close());
function user() { return repo.startConversation({ clientMessageId: randomUUID(), text: 'Running databases', timezone: 'Asia/Kolkata', now }); }
const stats = { searches: 0, sources: 0, latencyMs: 30, ttftMs: 10, inputTokens: 5, outputTokens: 2 };

it('migrates once, enables foreign keys, and assigns ordered messages and local dates', () => {
  expect(store.db.prepare('PRAGMA user_version').get()!.user_version).toBe(1);
  expect(store.db.prepare('PRAGMA foreign_keys').get()!.foreign_keys).toBe(1);
  const first = user();
  expect(first.localDate).toBe('2026-11-12');
  repo.insertAssistantTurn({ id: randomUUID(), user: first, text: 'SQLite answer', status: 'complete', now, model: 'fake', stats });
  repo.insertUserMessage({ conversationId: first.conversationId, clientMessageId: randomUUID(), text: 'Next', timezone: 'UTC', now });
  expect(repo.getConversationMessages(first.conversationId).map(m => m.seq)).toEqual([1, 2, 3]);
  expect(repo.getConversationMessages(first.conversationId, 2).map(m => m.seq)).toEqual([2, 3]);
});
it('returns an existing user row on duplicate client id without a sequence gap', () => {
  const first = user();
  const duplicate = repo.insertUserMessage({ conversationId: first.conversationId, clientMessageId: first.clientMessageId!, text: first.content, timezone: first.timezone, now });
  expect(duplicate).toEqual(first);
  expect(repo.getConversationMessages(first.conversationId)).toHaveLength(1);
});
it('synchronizes FTS insert, update, and cascade delete', () => {
  const first = user();
  const fts = (term: string) => store.db.prepare('SELECT rowid FROM messages_fts WHERE messages_fts MATCH ?').all(term);
  expect(fts('run')).toHaveLength(1);
  store.db.prepare('UPDATE messages SET content=? WHERE id=?').run('Changed text', first.id);
  expect(fts('run')).toHaveLength(0);
  expect(fts('changed')).toHaveLength(1);
  repo.deleteConversation(first.conversationId);
  expect(fts('changed')).toHaveLength(0);
  expect(repo.getMessage(first.id)).toBeUndefined();
});
it('rolls back failed user creation including conversation and FTS entries', () => {
  store.db.exec("CREATE TRIGGER reject_message BEFORE INSERT ON messages BEGIN SELECT RAISE(ABORT,'forced write failure'); END");
  expect(user).toThrow('forced write failure');
  expect(repo.listConversations()).toEqual([]);
  expect(store.db.prepare('SELECT count(*) AS n FROM messages_fts').get()!.n).toBe(0);
});
it('rolls back assistant insertion and conversation touch on write failure', () => {
  const first = user();
  store.db.exec("CREATE TRIGGER reject_assistant AFTER INSERT ON messages WHEN new.role='assistant' BEGIN SELECT RAISE(ABORT,'forced'); END");
  expect(() => repo.insertAssistantTurn({ id: randomUUID(), user: first, text: 'partial', status: 'interrupted', now: new Date('2026-11-12'), model: 'fake', stats })).toThrow();
  expect(repo.getConversationMessages(first.conversationId)).toHaveLength(1);
  expect(repo.getConversation(first.conversationId)!.updatedAt).toBe(now.toISOString());
});
it('cascades the ledger and nulls citations from other conversations', () => {
  const first = user(); const second = user();
  const assistant = repo.insertAssistantTurn({ id: randomUUID(), user: first, text: 'answer', status: 'complete', now, model: 'fake', stats });
  store.db.prepare("INSERT INTO searches(id,message_id,round,query,freshness,started_at,status) VALUES('search',?,1,'q','any',?,'ok')").run(assistant.id, now.toISOString());
  store.db.prepare("INSERT INTO sources(id,search_id,rank,url,excerpt,retrieved_at) VALUES('source','search',1,'https://example.com','e',?)").run(now.toISOString());
  store.db.prepare("INSERT INTO citations(message_id,marker,source_id,state) VALUES(?,1,'source','verified')").run(second.id);
  repo.deleteConversation(first.conversationId);
  expect(store.db.prepare('SELECT * FROM searches').all()).toEqual([]);
  expect(store.db.prepare('SELECT * FROM sources').all()).toEqual([]);
  expect(store.db.prepare('SELECT source_id FROM citations').get()!.source_id).toBeNull();
});
it('survives reopening a file and does not rerun migrations', () => {
  const dir = mkdtempSync(join(tmpdir(), 'reprise-db-'));
  try {
    const path = join(dir, 'db.sqlite');
    let disk = openDatabase(path); const diskRepo = createRepo(disk);
    const first = diskRepo.startConversation({ clientMessageId: randomUUID(), text: 'First', timezone: 'UTC', now });
    diskRepo.startConversation({ clientMessageId: randomUUID(), text: 'Second', timezone: 'UTC', now });
    disk.close(); disk = openDatabase(path);
    expect(createRepo(disk).listConversations()).toHaveLength(2);
    expect(createRepo(disk).getMessage(first.id)!.content).toBe('First');
    expect(disk.db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    disk.close();
    writeFileSync(path, 'corrupt file');
    expect(() => openDatabase(path)).toThrow('Back up');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
it('rejects asynchronous transactions without committing writes', () => {
  expect(() => store.transaction(() => Promise.resolve())).toThrow('synchronous');
});

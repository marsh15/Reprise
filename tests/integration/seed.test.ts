import { beforeEach, afterEach, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase } from '../../src/server/db/db';
import { createRepo } from '../../src/server/db/repo';
import { seedDemo } from '../../scripts/seed-demo';
import { recall } from '../../src/server/memory/recall';
import { pastTurn } from '../helpers/memory';
const now = new Date('2026-11-11T08:30:00Z');
let store: ReturnType<typeof openDatabase>; let repo: ReturnType<typeof createRepo>;
beforeEach(() => { store = openDatabase(':memory:'); repo = createRepo(store); });
afterEach(() => store.close());
it('creates four relative labelled conversations, nine labelled sources and date ambiguity fixtures', () => {
  const fixtures = seedDemo(repo, now, 'Asia/Kolkata');
  expect(fixtures).toHaveLength(4); expect(fixtures.every(c => c.origin === 'fixture' && c.title.startsWith('[Demo]'))).toBe(true);
  const all = fixtures.flatMap(c => repo.getConversationMessages(c.id));
  expect(all.every(m => m.content.startsWith('[Demo conversation'))).toBe(true);
  expect(all.filter(m => m.role === 'user').map(m => m.localDate)).toEqual(['2026-11-09', '2026-11-03', '2026-11-03', '2026-11-10']);
  const sources = all.flatMap(m => m.evidence?.sources ?? []);
  expect(sources).toHaveLength(9); expect(sources.every(s => s.fixture && s.excerpt.startsWith('[Demo fixture'))).toBe(true);
  const packet = recall(repo, { text: 'Last Tuesday I asked about Postgres hosting. What did you say?', conversationId: 'none', now, tz: 'Asia/Kolkata' });
  expect(packet.resolutions[0].chosen).toBe('2026-11-03'); expect(packet.recalledTurns[0].origin).toBe('fixture');
});
it('refuses duplicates without mutation, and reset deletes only demo conversations and sources', () => {
  const real = pastTurn(repo, 'My genuine history');
  const first = seedDemo(repo, now, 'UTC');
  expect(() => seedDemo(repo, now, 'UTC')).toThrow('already exist');
  expect(repo.listConversations()).toHaveLength(5);
  seedDemo(repo, now, 'UTC', true);
  expect(repo.listConversations()).toHaveLength(5); expect(repo.getMessage(real.user.id)?.content).toBe('My genuine history');
  expect(first.every(c => !repo.getConversation(c.id))).toBe(true);
  expect(store.db.prepare('SELECT COUNT(*) AS n FROM sources').get()!.n).toBe(9);
});
it('rolls back targeted reset and inserts together on failure', () => {
  const first = seedDemo(repo, now, 'UTC');
  store.db.exec("CREATE TRIGGER reject_fixture BEFORE INSERT ON sources BEGIN SELECT RAISE(ABORT,'forced'); END");
  expect(() => seedDemo(repo, now, 'UTC', true)).toThrow('forced');
  expect(first.every(c => repo.getConversation(c.id))).toBe(true);
});
it.each(['2026-11-01T08:30:00Z', '2026-11-03T08:30:00Z', '2027-01-02T08:30:00Z'])('seeds relative dates correctly around boundaries at %s', instant => {
  const current = new Date(instant); const fixtures = seedDemo(repo, current, 'UTC');
  const node = repo.getConversationMessages(fixtures[2].id)[0];
  expect((current.getTime() - new Date(node.createdAt).getTime()) / 86400000).toBeGreaterThan(7);
  const postgres = repo.getConversationMessages(fixtures[1].id)[0];
  const age = (current.getTime() - new Date(postgres.createdAt).getTime()) / 86400000;
  expect(age).toBeGreaterThanOrEqual(7.9); expect(age).toBeLessThanOrEqual(14);
});
it('runs seed:demo in an isolated file and preserves it across reopen without API credentials', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'reprise-seed-')); const path = join(dir, 'demo.db');
  try {
    const env = { ...process.env, REPRISE_DB_PATH: path, REPRISE_NOW: now.toISOString(), LLM_API_KEY: '', TAVILY_API_KEY: '' };
    const exec = promisify(execFile);
    const { stdout } = await exec(process.execPath, ['--import', 'tsx', 'scripts/seed-demo.ts', '--tz', 'Asia/Kolkata'], { env });
    expect(stdout).toContain('4 labelled demo');
    await expect(exec(process.execPath, ['--import', 'tsx', 'scripts/seed-demo.ts', '--tz', 'Asia/Kolkata'], { env })).rejects.toMatchObject({ code: 1 });
    const disk = openDatabase(path); expect(createRepo(disk).listConversations()).toHaveLength(4); disk.close();
    await exec(process.execPath, ['--import', 'tsx', 'scripts/seed-demo.ts', '--tz', 'Asia/Kolkata', '--reset-fixtures'], { env });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 15000);

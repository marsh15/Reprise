import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../../src/server/db/db';
import { createRepo, type Repo } from '../../src/server/db/repo';
import { recall, MAX_DATE_RESOLUTIONS } from '../../src/server/memory/recall';
import { pastTurn } from '../helpers/memory';

let store: ReturnType<typeof openDatabase>; let repo: Repo;
beforeEach(() => { store = openDatabase(':memory:'); repo = createRepo(store); });
afterEach(() => store.close());

const watched = ['turn', 'turnKeysByLocalDates', 'ftsTurnIdsOnDates', 'findTurnsByLocalDates', 'ftsTurns'] as const;
function counted() {
  const counts: Record<string, number> = Object.fromEntries(watched.map(k => [k, 0]));
  const proxy = new Proxy(repo, { get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    if (typeof prop !== 'string' || !(watched as readonly string[]).includes(prop) || typeof value !== 'function') return value;
    return (...args: unknown[]) => { counts[prop]++; return value(...args); };
  } });
  return { proxy, counts };
}
const run = (text: string, tz: string, now: Date) => {
  const { proxy, counts } = counted();
  return { packet: recall(proxy, { text, conversationId: randomUUID(), now, tz }), counts };
};
const utc = new Date('2026-11-12T10:00:00Z');
const seed = (n: number, date: string, prefix = 'Entry') => { for (let i = 0; i < n; i++) pastTurn(repo, `${prefix} ${i}`, date, { timezone: 'UTC' }); };
const summary = (p: ReturnType<typeof recall>) => p.recalledTurns.map(t => [t.userMessage.content, t.reason]);

describe('recall work bounds', () => {
  it('never lets the date cap drop a "last time we discussed" topic lookup, and bounds its repeats', () => {
    pastTurn(repo, 'How do I upgrade kubernetes clusters safely?', '2026-09-01', { timezone: 'UTC' });
    const dates = Array.from({ length: 8 }, (_, i) => `${i + 1} days ago`).join(', ');
    const { packet } = run(`${dates}, last time we discussed kubernetes`, 'UTC', utc);
    expect(packet.recalledTurns.some(t => t.userMessage.content.includes('kubernetes'))).toBe(true);
    const once = run('last time we discussed kubernetes', 'UTC', utc);
    const many = run(Array(100).fill('last time we discussed kubernetes').join('. '), 'UTC', utc);
    expect(many.counts.ftsTurns).toBe(once.counts.ftsTurns); expect(many.packet.resolutions).toHaveLength(1);
  });
  it('keeps the first phrase the user typed when phrases resolve identically', () => {
    seed(1, '2026-11-12');
    expect(run('today and this morning', 'UTC', utc).packet.resolutions.map(r => r.phrase)).toEqual(['today']);
  });
  it('repeating one date phrase costs no extra retrieval work', () => {
    seed(100, '2026-11-12');
    const runs = [1, 10, 100, 1333].map(n => run(Array(n).fill('today').join(' '), 'UTC', utc));
    const base = runs[0];
    expect(base.packet.resolutions).toHaveLength(1);
    expect(base.packet.recalledTurns.length).toBeGreaterThan(0);
    for (const r of runs) {
      expect(r.packet.resolutions).toHaveLength(1);
      expect(r.counts.turnKeysByLocalDates).toBe(base.counts.turnKeysByLocalDates);
      expect(r.counts.turn).toBe(base.counts.turn);
      expect(r.counts.turn).toBeLessThanOrEqual(6 + 4);
      expect(r.counts.findTurnsByLocalDates).toBe(0);
      expect(r.packet.recalledTurns.length).toBe(base.packet.recalledTurns.length);
    }
  });

  it('caps distinct date references and says so', () => {
    seed(5, '2026-11-12');
    const text = Array.from({ length: 20 }, (_, i) => `${i + 1} days ago`).join(', ');
    const { packet, counts } = run(text, 'UTC', utc);
    expect(counts.turnKeysByLocalDates).toBeLessThanOrEqual(MAX_DATE_RESOLUTIONS * 2);
    expect(packet.resolutions.length).toBeLessThanOrEqual(MAX_DATE_RESOLUTIONS);
    expect(packet.notes.join(' ')).toMatch(new RegExp(`${MAX_DATE_RESOLUTIONS} distinct date references`));
  });

  it('keeps recall correct for a long message and repeated phrases', () => {
    pastTurn(repo, 'Yesterday topic', '2026-11-11', { timezone: 'UTC' });
    pastTurn(repo, 'Tuesday topic', '2026-11-10', { timezone: 'UTC' });
    pastTurn(repo, 'Older Tuesday topic', '2026-11-03', { timezone: 'UTC' });
    const short = run('yesterday and last Tuesday', 'UTC', utc).packet;
    const prose = 'Ordinary planning prose without anything special in it. '.repeat(Math.ceil(6000 / 55));
    const text = (prose.slice(0, 3000) + ' yesterday and last Tuesday ' + prose.slice(0, 3000)).slice(0, 6000);
    expect(text.length).toBeGreaterThanOrEqual(5900);
    const long = run(text, 'UTC', utc).packet;
    expect(short.recalledTurns.length).toBeGreaterThan(0);
    expect(summary(long).filter(([, r]) => r !== 'topic')).toEqual(summary(short).filter(([, r]) => r !== 'topic'));
    expect(long.resolutions.map(r => r.chosen)).toEqual(short.resolutions.map(r => r.chosen));
    const tuesday = short.resolutions.find(r => /tuesday/i.test(r.phrase))!;
    expect(typeof tuesday.assumption).toBe('string');
    expect(long.resolutions.find(r => /tuesday/i.test(r.phrase))!.assumption).toBe(tuesday.assumption);
  });

  it("treats 'today today' like 'today'", () => {
    seed(3, '2026-11-12');
    expect(summary(run('today today', 'UTC', utc).packet)).toEqual(summary(run('today', 'UTC', utc).packet));
  });

  it('resolves today in Asia/Kolkata near a date boundary', () => {
    pastTurn(repo, 'Kolkata morning', '2026-11-12', { timezone: 'Asia/Kolkata' });
    pastTurn(repo, 'UTC date turn', '2026-11-11', { timezone: 'UTC' });
    const { packet } = run('today', 'Asia/Kolkata', new Date('2026-11-11T20:00:00Z'));
    expect(packet.resolutions[0].chosen).toBe('2026-11-12');
    expect(packet.recalledTurns.map(t => t.userMessage.content)).toEqual(['Kolkata morning']);
  });
});

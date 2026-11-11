import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { createSourceRegistry } from '../../src/server/agent/sourceRegistry';
const observation = (url: string, excerpt: string) => ({ sourceId: randomUUID(), searchId: randomUUID(), rank: 1, url, title: null, excerpt, publishedAt: null, retrievedAt: '2026-11-11T08:30:00Z', fixture: false });
it('reuses URL numbers while retaining each immutable observation and source reference', () => {
  const registry = createSourceRegistry();
  const first = registry.register(observation('https://EXAMPLE.com/pricing?utm_campaign=x#part', 'Old $90'));
  const second = registry.register(observation('https://example.com/pricing', 'New $95'));
  expect(first.n).toBe(1); expect(second.n).toBe(1); expect(second.sourceId).not.toBe(first.sourceId);
  expect(registry.sources.map(s => s.excerpt)).toEqual(['Old $90', 'New $95']);
  expect(registry.entries.get(1)).toEqual({ sourceId: first.sourceId, text: 'Old $90\nNew $95' });
});
it('assigns carried sources first, normalizes URLs and rejects unsafe addresses', () => {
  const carried = { ...observation('https://example.com/old', '$90'), n: 7 };
  const registry = createSourceRegistry([carried]);
  expect(registry.sources[0].n).toBe(1);
  expect(registry.register(observation('https://example.com/new', '$95')).n).toBe(2);
  expect(carried.n).toBe(7);
  expect(() => registry.register(observation('javascript:x', 'bad'))).toThrow('Unsafe');
});

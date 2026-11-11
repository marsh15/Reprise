import { expect, it } from 'vitest';
import { createSourceRegistry } from '../../src/server/agent/sourceRegistry';
import { checkCitations } from '../../src/server/agent/citations';
import { randomUUID } from 'node:crypto';
const source = (vendor: string, excerpt: string, retrievedAt = '2026-11-11T08:30:00Z') => ({
  sourceId: randomUUID(), searchId: randomUUID(), rank: 1, url: `https://${vendor.toLowerCase()}.com/pricing`,
  title: `${vendor} pricing`, excerpt, publishedAt: null, retrievedAt, fixture: false,
});
it('rejects a different known vendor even when its excerpt contains every claimed number', () => {
  const registry = createSourceRegistry();
  registry.register(source('Aster', 'Aster costs $25 for 20 seats.'));
  registry.register(source('Birch', 'Birch costs $25 for 20 seats.'));
  expect(checkCitations('Aster costs $25 for 20 seats [2].', registry.entries)[0]).toMatchObject({ state: 'unverified' });
  expect(checkCitations('Aster costs $25 for 20 seats [1].', registry.entries)[0]).toMatchObject({ state: 'verified' });
});
it('checks independently cited vendor clauses without pooling their prices', () => {
  const registry = createSourceRegistry();
  registry.register(source('Aster', 'Aster costs $25.'));
  registry.register(source('Birch', 'Birch costs $35.'));
  const text = 'Aster costs $35 [2]; Birch costs $25 [1].';
  expect(checkCitations(text, registry.entries).every(c => c.state === 'unverified')).toBe(true);
});
it('does not merge historical and current support just because observations share a URL', () => {
  const registry = createSourceRegistry();
  const old = registry.register(source('Aster', 'Aster cost $25.', '2026-11-03T08:30:00Z'));
  const fresh = registry.register(source('Aster', 'Aster costs $35.'));
  expect(fresh.n).not.toBe(old.n);
  expect(checkCitations(`Aster costs $35 [${old.n}].`, registry.entries)[0].state).toBe('unverified');
  expect(checkCitations(`Aster costs $35 [${fresh.n}].`, registry.entries)[0].state).toBe('verified');
  expect(registry.sources.map(s => s.retrievedAt)).toEqual(['2026-11-03T08:30:00Z', '2026-11-11T08:30:00Z']);
});
it('matches equivalent calendar dates and keeps different dates unsupported', () => {
  const registry = new Map([[1, { sourceId: 'a', text: 'Effective 2026-11-10. Future rollout 2026-12-01.' }]]);
  expect(checkCitations('Effective November 10, 2026 [1].', registry)[0].state).toBe('verified');
  expect(checkCitations('Effective 10 Nov 2026 [1].', registry)[0].state).toBe('verified');
  expect(checkCitations('Effective November 11, 2026 [1].', registry)[0].state).toBe('unverified');
});
it('recognizes explicit publication and retrieval dates only in their respective roles', () => {
  const registry = createSourceRegistry();
  registry.register({ ...source('Aster', 'Aster rollout is planned for 2026-12-01.'), publishedAt: '2026-11-10T00:00:00Z' });
  expect(checkCitations('Published November 10, 2026 [1]. Retrieved 11 Nov 2026 [1].', registry.entries)[0].state).toBe('verified');
  expect(checkCitations('Published November 11, 2026 [1].', registry.entries)[0].state).toBe('unverified');
  expect(checkCitations('Rollout happened November 11, 2026 [1].', registry.entries)[0].state).toBe('unverified');
});
it('rejects an unrelated source on a multi-product claim even if the same price is present', () => {
  const registry = createSourceRegistry();
  registry.register(source('Aster', 'Aster costs $25.'));
  registry.register(source('Birch', 'Birch costs $25.'));
  registry.register(source('Cedar', 'Cedar costs $25.'));
  expect(checkCitations('Aster and Birch cost $25 [3].', registry.entries)[0].state).toBe('unverified');
  expect(checkCitations('Aster costs $25 [1]; Birch costs $25 [2].', registry.entries).every(c => c.state === 'verified')).toBe(true);
});
it('keeps each comparison-table cell with its reference despite explanatory semicolons', () => {
  const registry = createSourceRegistry();
  registry.register(source('Aster', 'Aster cost $20.', '2026-11-03T08:30:00Z'));
  registry.register(source('Aster', 'Aster costs $25.'));
  const text = '| Aster | $20; old observation [1] | $25; new observation [2] | Observed difference |';
  expect(checkCitations(text, registry.entries)).toMatchObject([{ marker: 1, state: 'verified' }, { marker: 2, state: 'verified' }]);
  expect(checkCitations(text.replace('$25;', '$35;'), registry.entries).find(c => c.marker === 2)?.state).toBe('unverified');
});
it('compares complete release versions without matching a trailing decimal or a different patch', () => {
  const registry = new Map([[1, { sourceId: 'a', text: 'Released 2026-10-28: Node.js 26.13.0 (LTS).' }]]);
  expect(checkCitations('The release is v26.13.0 [1].', registry)[0].state).toBe('verified');
  expect(checkCitations('The release is v26.13.1 [1].', registry)[0].state).toBe('unverified');
  expect(checkCitations('The release is v24.13.0 [1].', registry)[0].state).toBe('unverified');
});
it('checks publication dates returned in Tavily RFC format without treating publication as rollout', () => {
  const registry = createSourceRegistry();
  registry.register({ ...source('Aster', 'Aster rollout starts 2026-12-01.'), publishedAt: 'Tue, 10 Nov 2026 00:00:00 GMT' });
  expect(checkCitations('Published November 10, 2026 [1].', registry.entries)[0].state).toBe('verified');
  expect(checkCitations('Published November 11, 2026 [1].', registry.entries)[0].state).toBe('unverified');
  expect(checkCitations('Rollout started November 10, 2026 [1].', registry.entries)[0].state).toBe('unverified');
});

import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { cassetteSearch } from '../../evals/cassettes';
import { fakeSearch } from '../helpers/fakeSearch';
it('replays frozen synthetic evidence and reports exact query misses without fallback', async () => {
  const cassette = await cassetteSearch('evals/search-cassettes/D1.json');
  const outcome = await cassette.search({ query: ' Node.js  LATEST LTS version ', freshness: 'any' }, new AbortController().signal);
  expect(outcome.results[0]).toMatchObject({ fixture: true, retrievedAt: '2026-11-11T08:30:00Z' });
  outcome.results[0].content = 'mutated';
  expect((await cassette.search({ query: 'Node.js latest LTS version', freshness: 'any' }, new AbortController().signal)).results[0].content).not.toBe('mutated');
  expect((await cassette.search({ query: 'different', freshness: 'any' }, new AbortController().signal)).error).toBe('cassette_miss');
  expect(cassette.misses).toEqual(['different|any']);
});
it('rejects non-normalized fixture keys immediately instead of silently missing every query', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'reprise-cassette-')); const path = join(dir, 'bad.json');
  try {
    await writeFile(path, JSON.stringify({ version: 1, provenance: 'synthetic', note: 'test', entries: { 'UPPER|any': { status: 'empty', results: [], durationMs: 0 } } }));
    await expect(cassetteSearch(path)).rejects.toThrow('normalized');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
it('runs live search without requiring a frozen cassette file and never writes one', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'reprise-live-')); const path = join(dir, 'missing.json');
  try {
    const live = fakeSearch(); const cassette = await cassetteSearch(path, { live: live.search });
    await cassette.search({ query: 'test live transport with a fake', freshness: 'any' }, new AbortController().signal);
    expect(live.calls).toHaveLength(1); await cassette.flush();
    await expect(readFile(path, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
it('records to a new path, strips secrets by persisting only outcomes, and preserves capture time on replay', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'reprise-cassette-')); const path = join(dir, 'new.json');
  try {
    const recorder = await cassetteSearch(path, { record: fakeSearch().search });
    const outcome = await recorder.search({ query: 'price', freshness: 'any' }, new AbortController().signal);
    await recorder.flush();
    expect((await readFile(path, 'utf8'))).not.toContain('apiKey');
    const replay = await cassetteSearch(path);
    expect(await replay.search({ query: 'price', freshness: 'any' }, new AbortController().signal)).toEqual(outcome);
    expect(outcome.results[0].fixture).toBe(false); expect(outcome.results[0].retrievedAt).toBeTruthy();
  } finally { await rm(dir, { recursive: true, force: true }); }
});
it('timestamps live observations at retrieval rather than inheriting the frozen scenario clock', async () => {
  const cassette = await cassetteSearch('unused-live.json', { live: fakeSearch().search });
  const before = Date.now();
  const outcome = await cassette.search({ query: 'live retrieval', freshness: 'any' }, new AbortController().signal);
  const retrieved = Date.parse(outcome.results[0].retrievedAt!);
  expect(retrieved).toBeGreaterThanOrEqual(before);
  expect(retrieved).toBeLessThanOrEqual(Date.now());
  expect(outcome.results[0].fixture).toBe(false);
});

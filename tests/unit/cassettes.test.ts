import { mkdtemp, rm, readFile } from 'node:fs/promises';
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

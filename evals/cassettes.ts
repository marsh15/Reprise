import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import { searchOutcomeSchema, type Search, type SearchOutcome } from '../src/shared/research';
import { normalizeQuery } from '../src/server/search/sanitize';
import { createClock } from '../src/server/clock';
export const cassetteSchema = z.object({
  version: z.literal(1), provenance: z.enum(['synthetic', 'recorded', 'mixed']), note: z.string(),
  entries: z.record(z.string(), searchOutcomeSchema),
});
export async function cassetteSearch(path: string, options: { record?: Search; live?: Search } = {}) {
  if (options.record && options.live) throw new Error('Choose recording or live search, not both');
  let cassette: z.infer<typeof cassetteSchema>;
  try { cassette = options.live ? { version: 1, provenance: 'recorded', note: 'Unrecorded live search', entries: {} }
    : cassetteSchema.parse(JSON.parse(await readFile(path, 'utf8'))); }
  catch (error) {
    if (!options.record || !(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error;
    cassette = { version: 1, provenance: 'recorded', note: 'Live Tavily capture', entries: {} };
  }
  for (const key of Object.keys(cassette.entries)) {
    const separator = key.lastIndexOf('|');
    if (separator < 0 || key.slice(0, separator) !== normalizeQuery(key.slice(0, separator))) throw new Error('Cassette keys must use normalized query|freshness');
  }
  const misses: string[] = []; const queries: string[] = [];
  const search: Search = async (request, signal) => {
    const key = `${normalizeQuery(request.query)}|${request.freshness}`;
    queries.push(key);
    if (options.live) return options.live(request, signal);
    if (!options.record) {
      signal.throwIfAborted();
      const outcome = cassette.entries[key];
      if (!outcome) { misses.push(key); return { status: 'error', results: [], durationMs: 0, error: 'cassette_miss' }; }
      return structuredClone(outcome);
    }
    const outcome = await options.record(request, signal);
    const retrievedAt = createClock().now().toISOString();
    const recorded: SearchOutcome = { ...outcome, results: outcome.results.map(result => ({ ...result, retrievedAt, fixture: false })) };
    cassette.entries[key] = recorded;
    return recorded;
  };
  return { search, misses, queries, get snapshot() { return structuredClone(cassette); }, flush: async () => {
    if (!options.record) return;
    cassette.provenance = Object.values(cassette.entries).some(entry => entry.results.some(result => result.fixture)) ? 'mixed' : 'recorded'; cassette.note = 'Recorded Tavily outcomes. Retrieval times are capture times, not replay times.';
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(cassette, null, 2) + '\n');
  } };
}

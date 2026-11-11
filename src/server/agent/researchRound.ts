import { randomUUID } from 'node:crypto';
import { searchRequestSchema, searchOutcomeSchema, type Evidence, type Search, type SearchOutcome, type SearchRecord } from '../../shared/research';
import type { Emit, TurnStats } from '../../shared/types';
import { BUDGET } from './budget';
import type { ToolCall } from './modelStep';
import { dedupeByUrl, normalizeQuery, toExcerpt } from '../search/sanitize';
import type { createSourceRegistry } from './sourceRegistry';

export type ResearchBudget = { [K in keyof typeof BUDGET]: number };
export async function researchRound(input: {
  calls: ToolCall[]; round: number; budget: ResearchBudget; seen: Set<string>; searches: Evidence['searches'];
  registry: ReturnType<typeof createSourceRegistry>; search: Search; signal: AbortSignal; emit: Emit; now: () => Date; stats: TurnStats;
}) {
  const { calls, round, budget, seen, searches, registry, search, signal, emit, now } = input;
  const pending = calls.map((call, index) => {
    let args: unknown;
    try { args = JSON.parse(call.function.arguments); } catch { /* Invalid JSON receives a tool result. */ }
    const parsed = searchRequestSchema.safeParse(args);
    if (call.function.name !== 'web_search' || !parsed.success) {
      input.stats.invalidToolCalls = (input.stats.invalidToolCalls ?? 0) + 1;
      return { call, error: 'invalid_arguments' };
    }
    const request = parsed.data;
    const key = normalizeQuery(request.query);
    const exhausted = index >= budget.maxQueriesPerRound || seen.size >= budget.maxQueriesPerTurn || signal.aborted;
    const error = exhausted ? 'budget_exceeded' : seen.has(key) ? 'duplicate' : undefined;
    const record: SearchRecord = { id: randomUUID(), round, ...request, startedAt: now().toISOString(), durationMs: 0,
      status: error === 'budget_exceeded' ? 'skipped_budget' as const : 'error' as const, ...(error ? { error } : {}) };
    searches.push(record);
    if (!error) seen.add(key);
    return { call, request, record, error };
  });
  const executable = pending.filter(p => p.record && !p.error).map(p => p.record!);
  if (executable.length) await emit({ type: 'search.started', searches: executable });
  return Promise.all(pending.map(async item => {
    const { call, request, record } = item;
    if (!request || !record) return { role: 'tool' as const, tool_call_id: call.id, content: JSON.stringify({ status: 'error', error: item.error }) };
    let outcome: SearchOutcome = { status: 'error', results: [], durationMs: 0, error: item.error };
    const started = performance.now();
    if (!item.error) {
      const bounded = AbortSignal.any([signal, AbortSignal.timeout(budget.searchTimeoutMs)]);
      try {
        // Enforce the bound even for a replacement search that fails to honour its signal.
        outcome = searchOutcomeSchema.parse(await abortable(search(request, bounded), bounded));
      } catch {
        outcome = { status: bounded.aborted && !signal.aborted ? 'timeout' : 'error', results: [], durationMs: 0,
          error: signal.aborted ? 'cancelled_or_deadline' : bounded.aborted ? 'timeout' : 'search_failed' };
      }
      record.durationMs = Math.round(performance.now() - started);
      record.status = outcome.status; record.error = outcome.error;
    }
    const sources = dedupeByUrl(outcome.status === 'ok' ? outcome.results : []).slice(0, budget.resultsPerQuery).map((result, rank) => registry.register({
      sourceId: randomUUID(), searchId: record.id, rank: rank + 1, url: result.url,
      title: result.title === null ? null : toExcerpt(result.title, 300), excerpt: toExcerpt(result.content, budget.excerptChars),
      publishedAt: result.publishedAt, retrievedAt: result.retrievedAt ?? now().toISOString(), fixture: result.fixture ?? false,
    }));
    if (record.status === 'ok' && sources.length === 0) record.status = 'empty';
    await emit({ type: 'search.finished', search: record, sources });
    return { role: 'tool' as const, tool_call_id: call.id, content: JSON.stringify({ query: request.query,
      status: item.error ? 'error' : record.status, ...(record.error ? { error: record.error } : {}),
      results: sources.map(s => ({ cite: `[${s.n}]`, n: s.n, kind: 'new search observation', url: s.url, title: s.title, published: s.publishedAt, retrieved: s.retrievedAt, excerpt: s.excerpt, fixture: s.fixture })) }) };
  }));
}
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(signal.reason); };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

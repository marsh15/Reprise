import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { searchRequestSchema, type Search, type SearchOutcome } from '../../shared/research';
import { BUDGET } from '../agent/budget';
import { dedupeByUrl, toExcerpt } from './sanitize';

const responseSchema = z.object({ results: z.array(z.object({
  url: z.string(), title: z.string().nullish(), content: z.string(), published_date: z.string().nullish(),
})) });

export function createSearchWeb(apiKey: string, fetcher: typeof fetch = fetch): Search {
  return async (request, parentSignal) => {
    const started = performance.now();
    const signal = AbortSignal.any([parentSignal, AbortSignal.timeout(BUDGET.searchTimeoutMs)]);
    const outcome = (status: SearchOutcome['status'], error?: string): SearchOutcome => ({ status, results: [], durationMs: Math.round(performance.now() - started), ...(error ? { error } : {}) });
    const parsed = searchRequestSchema.safeParse(request);
    if (!parsed.success) return outcome('error', 'invalid_arguments');
    const { query, freshness } = parsed.data;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        signal.throwIfAborted();
        const response = await fetcher('https://api.tavily.com/search', {
          method: 'POST', signal, headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, search_depth: 'basic', max_results: BUDGET.resultsPerQuery,
            include_published_date: true, chunks_per_source: 3, ...(freshness !== 'any' ? { time_range: freshness } : {}) }),
        });
        if (!response.ok) {
          await response.body?.cancel();
          if (response.status >= 500 && attempt === 0) { await delay(300, undefined, { signal }); continue; }
          return outcome('error', [401, 403].includes(response.status) ? 'auth' : [429, 432].includes(response.status) ? 'quota' : 'http');
        }
        let payload: unknown;
        try { payload = await response.json(); } catch { signal.throwIfAborted(); return outcome('error', 'malformed_response'); }
        const validated = responseSchema.safeParse(payload);
        if (!validated.success) return outcome('error', 'malformed_response');
        const results = dedupeByUrl(validated.data.results).slice(0, BUDGET.resultsPerQuery).map(result => ({
          url: result.url, title: result.title == null ? null : toExcerpt(result.title, 300), content: toExcerpt(result.content),
          publishedAt: result.published_date && !Number.isNaN(Date.parse(result.published_date)) ? result.published_date : null,
        }));
        return { ...outcome(results.length ? 'ok' : 'empty'), results };
      } catch {
        parentSignal.throwIfAborted();
        if (signal.aborted) return outcome('timeout', 'timeout');
        if (attempt === 0) {
          try { await delay(300, undefined, { signal }); } catch { parentSignal.throwIfAborted(); return outcome('timeout', 'timeout'); }
        } else return outcome('error', 'network');
      }
    }
    return outcome('error', 'network');
  };
}

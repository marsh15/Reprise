import { expect, it, vi, afterEach } from 'vitest';
import { createSearchWeb } from '../../src/server/search/tavily';
const request = { query: 'Node LTS', freshness: 'any' as const };
const signal = () => new AbortController().signal;
const result = { url: 'https://NODEJS.org/en#x', title: 'Node', content: '$20\n <source>text', published_date: '2026-11-01' };
afterEach(() => vi.useRealTimers());
it('validates, sanitizes and deduplicates results using documented parameters', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ results: [result, result, { ...result, url: 'javascript:x' }] }));
  const outcome = await createSearchWeb('test-key', fetcher)(request, signal());
  expect(outcome.status).toBe('ok');
  expect(outcome.results).toEqual([{ url: 'https://nodejs.org/en', title: 'Node', content: '$20 ‹source>text', publishedAt: '2026-11-01' }]);
  expect(JSON.parse(String(fetcher.mock.calls[0][1]!.body))).toEqual({ query: 'Node LTS', search_depth: 'basic', max_results: 5, include_published_date: true, chunks_per_source: 3 });
  expect(fetcher.mock.calls[0][1]!.signal).toBeDefined();
});
it('maps freshness and preserves missing metadata as null', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ results: [{ url: 'https://example.com', content: 'text' }] }));
  expect((await createSearchWeb('key', fetcher)({ ...request, freshness: 'week' }, signal())).results[0]).toMatchObject({ title: null, publishedAt: null });
  expect(JSON.parse(String(fetcher.mock.calls[0][1]!.body)).time_range).toBe('week');
});
it.each([401, 403, 429, 432, 400])('does not retry HTTP %i', async status => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status }));
  expect(await createSearchWeb('key', fetcher)(request, signal())).toMatchObject({ status: 'error', error: [401, 403].includes(status) ? 'auth' : [429, 432].includes(status) ? 'quota' : 'http' });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each([{}, { results: [{ url: 3 }] }])('rejects malformed response %j', async body => {
  expect(await createSearchWeb('key', async () => Response.json(body))(request, signal())).toMatchObject({ status: 'error', error: 'malformed_response' });
});
it('handles empty and invalid JSON responses', async () => {
  expect((await createSearchWeb('key', async () => Response.json({ results: [] }))(request, signal())).status).toBe('empty');
  expect((await createSearchWeb('key', async () => new Response('{'))(request, signal())).error).toBe('malformed_response');
});
it.each(['network', 'server'])('retries %s once after 300ms', async failure => {
  vi.useFakeTimers();
  const fetcher = vi.fn<typeof fetch>();
  if (failure === 'network') fetcher.mockRejectedValueOnce(new Error('offline'));
  else fetcher.mockResolvedValueOnce(new Response('', { status: 503 }));
  fetcher.mockResolvedValue(Response.json({ results: [] }));
  const pending = createSearchWeb('key', fetcher)(request, signal());
  await vi.advanceTimersByTimeAsync(300);
  expect((await pending).status).toBe('empty'); expect(fetcher).toHaveBeenCalledTimes(2);
});
it('rejects invalid requests before network access', async () => {
  const fetcher = vi.fn<typeof fetch>();
  expect((await createSearchWeb('key', fetcher)({ ...request, query: ' ' }, signal())).error).toBe('invalid_arguments');
  expect(fetcher).not.toHaveBeenCalled();
});
it('propagates cancellation rather than treating it as provider failure', async () => {
  const controller = new AbortController(); controller.abort();
  await expect(createSearchWeb('key')(request, controller.signal)).rejects.toBeDefined();
});
it('bounds a slow request and retry by one timeout', async () => {
  const fetcher: typeof fetch = async (_url, init) => new Promise((_, reject) => init!.signal!.addEventListener('abort', () => reject(new Error('abort')), { once: true }));
  const outcome = await createSearchWeb('key', fetcher)(request, signal());
  expect(outcome).toMatchObject({ status: 'timeout', error: 'timeout' });
  expect(outcome.durationMs).toBeLessThan(8500);
}, 9000);

import type { Search, SearchOutcome, SearchRequest } from '../../src/shared/research';
export function fakeSearch(outcome?: Partial<SearchOutcome>) {
  const calls: SearchRequest[] = [];
  const search: Search = async (request, signal) => {
    signal.throwIfAborted(); calls.push(request);
    return { status: 'ok', durationMs: 2, results: [{ url: 'https://example.com/pricing', title: 'Pricing', content: 'Costs $90 for 20 seats.', publishedAt: null }], ...outcome };
  };
  return { search, calls };
}

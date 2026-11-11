import { expect, it } from 'vitest';
import { compareReports } from '../../evals/comparison';

function report(model = 'gpt-6-luna', p0 = 1, latency: number | null = 200, cost: number | null = .001) {
  return { version: 2, model, provider: 'configured endpoint', baseURL: 'https://api.openai.com/v1', category: 'synthetic_search_live_llm', mode: 'replay', codeHash: 'same',
    blocked: null, fullSuite: true, humanReview: 'pending', untested: [], metrics: { p0PassRate: p0, p1PassRate: .75, medianTtftMs: 100, medianLatencyMs: latency,
      inputTokens: 100, outputTokens: 50, medianEstimatedUsdPerTurn: cost, toolCallReliability: {}, citationIntegrity: {} },
    rows: [{ id: 'D1', priority: 'P0', inputHash: 'input', cassetteHash: 'cassette', outcome: 'pass' }] };
}
it('applies P0 before latency and latency before cost, without selecting a default', () => {
  const result = compareReports([report(), report('gpt-6.1-terra', .9, 100, .0001)]);
  expect(result.ranked[0].model).toBe('gpt-6-luna'); expect(result.ownerApproval).toBe('required'); expect(result.defaultModelChanged).toBe(false);
  expect(compareReports([report(), report('gpt-6.1-terra', 1, 100, .01)]).ranked[0].model).toBe('gpt-6.1-terra');
  expect(compareReports([report(), report('gpt-6.1-terra', 1, 200, .0001)]).ranked[0].model).toBe('gpt-6.1-terra');
});
it('leaves a tie unresolved rather than treating unknown latency/cost as zero', () => {
  expect(compareReports([report(), report('gpt-6.1-terra', 1, null, .0001)]).ranked[0].model).toBe('gpt-6-luna');
});
it.each(['codeHash', 'category'])('refuses different %s inputs', field => {
  expect(() => compareReports([report(), { ...report('gpt-6.1-terra'), [field]: 'different' }])).toThrow('Different implementation');
});
it('refuses changed cassettes, subsets, mocked results, blocked access and unplanned models', () => {
  const other = report('gpt-6.1-terra'); other.rows[0].cassetteHash = 'different';
  expect(() => compareReports([report(), other])).toThrow('Different scenario');
  for (const change of [{ fullSuite: false }, { mode: 'mock' }, { blocked: 'HTTP 402' }, { untested: ['D1'] }]) {
    expect(() => compareReports([report(), { ...report('gpt-6.1-terra'), ...change }])).toThrow();
  }
  expect(() => compareReports([report(), report('unplanned')])).toThrow('Unplanned');
  expect(() => compareReports([report(), report()])).toThrow('Duplicate');
});

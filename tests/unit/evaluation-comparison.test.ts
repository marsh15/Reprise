import { expect, it } from 'vitest';
import { compareReports } from '../../evals/comparison';
import { scenarios } from '../../evals/scenarios';

function report(model = 'gpt-6-luna', p0 = 11, latency: number | null = 200, cost: number | null = .001) {
  return { version: 2, model, provider: 'configured endpoint', baseURL: 'https://api.openai.com/v1', category: 'synthetic_search_live_llm', mode: 'replay', codeHash: 'same',
    blocked: null, fullSuite: true, humanReview: 'pending', untested: [], metrics: { p0: { planned: 11, attempted: 11, passed: p0, passRate: p0 / 11 }, p1: { planned: 12, attempted: 12, passed: 12, passRate: 1 }, p0PassRate: p0 / 11, p1PassRate: 1, medianTtftMs: 100, medianLatencyMs: latency,
      inputTokens: 100, outputTokens: 50, medianEstimatedUsdPerTurn: cost, toolCallReliability: {}, citationIntegrity: {} },
    rows: scenarios.map((s, index) => ({ id: s.id, priority: s.priority, inputHash: 'input-' + s.id, cassetteHash: 'cassette-' + s.cassette,
      outcome: s.priority === 'P0' && scenarios.slice(0, index + 1).filter(s => s.priority === 'P0').length > p0 ? 'fail' : 'pass',
      trace: { requests: [{ model, messages: [{ role: 'user', content: 'same input' }], stream: true, reasoning_effort: 'none', max_completion_tokens: 1536 }] } })) };
}
it('applies P0 before latency and latency before cost, without selecting a default', () => {
  const result = compareReports([report(), report('gpt-6.1-terra', 10, 100, .0001)]);
  expect(result.ranked[0].model).toBe('gpt-6-luna'); expect(result.ownerApproval).toBe('required'); expect(result.defaultModelChanged).toBe(false);
  expect(compareReports([report(), report('gpt-6.1-terra', 11, 100, .01)]).ranked[0].model).toBe('gpt-6.1-terra');
  expect(compareReports([report(), report('gpt-6.1-terra', 11, 200, .0001)]).ranked[0].model).toBe('gpt-6.1-terra');
});
it('leaves a tie unresolved rather than treating unknown latency/cost as zero', () => {
  expect(compareReports([report(), report('gpt-6.1-terra', 11, null, .0001)]).ranked[0].model).toBe('gpt-6-luna');
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

it('accepts only the newly approved exact Sol identity and retains P0-first ranking', () => {
  expect(compareReports([report(), report('gpt-6-sol', 10, 50)]).ranked[0].model).toBe('gpt-6-luna');
  expect(compareReports([report('gpt-6-luna', 10), report('gpt-6-sol')]).ranked[0].model).toBe('gpt-6-sol');
  for (const change of [{ baseURL: 'https://other.example/v1' }, { provider: 'other' }]) {
    expect(() => compareReports([report(), { ...report('gpt-6-sol'), ...change }])).toThrow('Unplanned');
  }
  expect(() => compareReports([report(), report('gpt-6.1-sol')])).toThrow('Unplanned');
});
it('rejects missing, duplicated, extra, wrong-priority rows and empty or mismatched hashes', () => {
  for (const mutate of [
    (r: ReturnType<typeof report>) => r.rows.pop(),
    (r: ReturnType<typeof report>) => r.rows.push(r.rows[0]),
    (r: ReturnType<typeof report>) => { r.rows[0].id = 'unknown'; },
    (r: ReturnType<typeof report>) => { r.rows[0].priority = r.rows[0].priority === 'P0' ? 'P1' : 'P0'; },
    (r: ReturnType<typeof report>) => { r.rows[0].inputHash = ''; },
    (r: ReturnType<typeof report>) => { r.rows[0].inputHash = 'different'; },
    (r: ReturnType<typeof report>) => { r.rows[0].cassetteHash = ''; },
    (r: ReturnType<typeof report>) => { r.metrics.p0PassRate = .9; },
    (r: ReturnType<typeof report>) => { r.metrics.p1PassRate = .5; },
    (r: ReturnType<typeof report>) => { r.metrics.p0.attempted = 10; },
    (r: ReturnType<typeof report>) => { r.metrics.p1.passed = 11; },
  ]) {
    const other = report('gpt-6-sol'); mutate(other);
    expect(() => compareReports([report(), other])).toThrow();
  }
});
it('rejects missing request evidence, substituted models and omitted or incompatible reasoning settings', () => {
  for (const mutate of [
    (r: ReturnType<typeof report>) => { r.rows[0].trace.requests = []; },
    (r: ReturnType<typeof report>) => { r.rows[0].trace.requests[0].model = 'gpt-6.1-sol'; },
    (r: ReturnType<typeof report>) => { r.rows[0].trace.requests[0].reasoning_effort = 'low'; },
    (r: ReturnType<typeof report>) => { r.rows[0].trace.requests[0].reasoning_effort = ''; },
    (r: ReturnType<typeof report>) => { r.rows[0].trace.requests[0].messages[0].content = 'different'; },
    (r: ReturnType<typeof report>) => { r.rows[0].trace.requests[0].max_completion_tokens = 2048; },
    (r: ReturnType<typeof report>) => { r.rows[0].trace.requests.push({ ...r.rows[0].trace.requests[0], max_completion_tokens: 2048 }); },
  ]) {
    const other = report('gpt-6-sol'); mutate(other);
    expect(() => compareReports([report(), other])).toThrow();
  }
});

import { expect, it } from 'vitest';
import { buildReport, markdownReport, median } from '../../evals/report';
import type { EvaluationRow } from '../../evals/execute';
import { scenarios } from '../../evals/scenarios';
import { emptyPacket } from '../helpers/memory';

function row(id: string, priority: 'P0' | 'P1' = 'P0'): EvaluationRow {
  return { id, priority, failures: [], text: 'Question', queries: [], provenance: 'synthetic', inputHash: 'hash', cassetteHash: 'cassette', memory: emptyPacket(),
    trace: { requests: [], events: [] }, result: { status: 'complete', text: 'Answer', stats: { searches: 0, sources: 0, ttftMs: 100, latencyMs: 500,
      inputTokens: 1000, outputTokens: 100, usageComplete: true, modelCalls: 1, toolCalls: 0 } } };
}
const input = { mode: 'replay' as const, model: 'gpt-6-luna', provider: 'configured endpoint', baseURL: 'https://api.openai.com/v1', selected: scenarios, blocked: null, codeHash: 'code' };
it('withholds mock scores, cost and timing even when the script returns token counts', () => {
  const report = buildReport({ ...input, mode: 'mock', rows: [row('D1')] });
  expect(report.metrics).toBeNull(); expect(report.automatedTargetsMet).toBeNull();
  expect(report.rows[0].measurements).toMatchObject({ ttftMs: null, latencyMs: null, inputTokens: null, outputTokens: null, estimatedUsd: null, measuredUsd: null });
});
it('keeps provider rejection untested with no model latency, denominator, or price', () => {
  const failed = row('D1'); failed.result.status = 'failed'; failed.result.error = 'llm_http_402'; failed.result.stats.usageComplete = false;
  const report = buildReport({ ...input, blocked: 'provider access', rows: [failed] });
  expect(report.rows[0].outcome).toBe('untested'); expect(report.metrics!.p0).toMatchObject({ attempted: 0, passRate: null });
  expect(report.metrics!.medianLatencyMs).toBeNull(); expect(report.untested).toContain('D1'); expect(report.rows[0].measurements.estimatedUsd).toBeNull();
  expect(report.rows[0].measurements.latencyMs).toBeNull();
});
it('uses separate P0/P1 denominators and refuses to accept an incomplete suite', () => {
  const p1 = row('E2', 'P1'); p1.failures = ['wrong arithmetic'];
  const report = buildReport({ ...input, rows: [row('D1'), p1] });
  expect(report.metrics!.p0.passRate).toBe(1); expect(report.metrics!.p1.passRate).toBe(0);
  expect(report.automatedTargetsMet).toBeNull();
  const subset = buildReport({ ...input, selected: scenarios.filter(s => s.id === 'D1' || s.id === 'E2'), rows: [row('D1'), row('E2', 'P1')] });
  expect(subset.fullSuite).toBe(false); expect(subset.automatedTargetsMet).toBeNull();
});
it('estimates only with complete usage and an exact provider, model and endpoint match', () => {
  const report = buildReport({ ...input, rows: [row('D1')] });
  expect(report.rows[0].measurements.estimatedUsd).toBeCloseTo(.00015);
  expect(report.rows[0].measurements.measuredUsd).toBeNull();
  expect(buildReport({ ...input, baseURL: 'https://other.example/v1', rows: [row('D1')] }).rows[0].measurements.estimatedUsd).toBeNull();
  const incomplete = row('D1'); incomplete.result.stats.usageComplete = false;
  expect(buildReport({ ...input, rows: [incomplete] }).rows[0].measurements.inputTokens).toBeNull();
  expect(buildReport({ ...input, rows: [incomplete] }).rows[0].measurements.estimatedUsd).toBeNull();
});
it('distinguishes synthetic, mixed, recorded and live model/search categories', () => {
  const recorded = row('D1'); recorded.provenance = 'recorded';
  expect(buildReport({ ...input, rows: [row('D1')] }).category).toBe('synthetic_search_live_llm');
  expect(buildReport({ ...input, rows: [recorded] }).category).toBe('recorded_search_live_llm');
  expect(buildReport({ ...input, rows: [recorded, row('D1')] }).category).toBe('mixed_search_live_llm');
  expect(buildReport({ ...input, mode: 'live', rows: [recorded] }).category).toBe('fully_live');
  expect(markdownReport(buildReport({ ...input, rows: [recorded] }))).toContain('Human review: pending');
});
it('computes medians without converting missing timing into zero', () => {
  expect(median([])).toBeNull(); expect(median([1, 6, 4])).toBe(4); expect(median([1, 4])).toBe(2.5);
});
it('does not mark missing, duplicate or wrong-priority result rows as a complete suite', () => {
  const complete = scenarios.map(s => row(s.id, s.priority));
  expect(buildReport({ ...input, rows: complete }).fullSuite).toBe(true);
  expect(buildReport({ ...input, rows: complete.slice(1) }).fullSuite).toBe(false);
  expect(buildReport({ ...input, rows: [...complete.slice(1), complete[1]] }).fullSuite).toBe(false);
  const wrong = complete.map(r => ({ ...r })); wrong[0].priority = wrong[0].priority === 'P0' ? 'P1' : 'P0';
  expect(buildReport({ ...input, rows: wrong }).fullSuite).toBe(false);
});

it('uses verified Sol rates only for its exact endpoint, leaving measured bills unknown', () => {
  const report = buildReport({ ...input, model: 'gpt-6-sol', rows: [row('D1')] });
  expect(report.rows[0].measurements.estimatedUsd).toBeCloseTo(.003);
  expect(report.rows[0].measurements.measuredUsd).toBeNull();
  expect(buildReport({ ...input, model: 'gpt-6.1-sol', rows: [row('D1')] }).rows[0].measurements.estimatedUsd).toBeNull();
});

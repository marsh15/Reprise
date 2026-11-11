import type { EvaluationRow } from './execute';
import { scenarios, type Scenario } from './scenarios';
import prices from './prices.json';

export type Mode = 'mock' | 'replay' | 'record' | 'live';
export function median(values: number[]) {
  const sorted = values.toSorted((a, b) => a - b); const middle = Math.floor(sorted.length / 2);
  return sorted.length ? sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2 : null;
}
export function buildReport(input: {
  model: string; provider: string; baseURL: string; mode: Mode; blocked: string | null; selected: Scenario[]; rows: EvaluationRow[]; codeHash: string;
}) {
  const { rows, selected, mode, model, provider, baseURL } = input; const mock = mode === 'mock';
  const price = prices.models.find(p => p.model === model && p.provider === provider && p.baseURL === baseURL);
  const cost = (r: EvaluationRow) => !mock && r.result.stats.usageComplete && (r.result.stats.modelCalls ?? 0) > 0 && price?.input != null && price.output != null
    ? (r.result.stats.inputTokens * price.input + r.result.stats.outputTokens * price.output) / 1e6 : null;
  const tested = rows.filter(r => !r.result.error?.startsWith('llm_http_'));
  const complete = tested.filter(r => r.result.status === 'complete');
  const rate = (priority: Scenario['priority']) => {
    const attempted = tested.filter(r => r.priority === priority); const passed = attempted.filter(r => !r.failures.length).length;
    return { planned: selected.filter(s => s.priority === priority).length, attempted: attempted.length, passed, passRate: attempted.length ? passed / attempted.length : null };
  };
  const p0 = rate('P0'); const p1 = rate('P1');
  const fullSuite = selected.length === scenarios.length && rows.length === scenarios.length
    && new Set(rows.map(r => r.id)).size === scenarios.length
    && scenarios.every(s => selected.some(p => p.id === s.id) && rows.some(r => r.id === s.id && r.priority === s.priority));
  const provenance = [...new Set(rows.map(r => r.provenance).filter(p => p !== 'none'))];
  const category = mock ? 'mock_agent_integration' : !rows.length ? 'unexecuted' : mode === 'live' ? 'fully_live'
    : mode === 'record' ? 'live_llm_search_recording' : provenance.length === 1 && provenance[0] === 'recorded' ? 'recorded_search_live_llm'
    : provenance.length === 1 && provenance[0] === 'synthetic' ? 'synthetic_search_live_llm' : !provenance.length ? 'no_search_live_llm' : 'mixed_search_live_llm';
  const usageComplete = rows.length > 0 && rows.every(r => r.result.stats.usageComplete);
  const metrics = mock ? null : {
    p0, p1, p0PassRate: p0.passRate, p1PassRate: p1.passRate,
    medianTtftMs: median(complete.flatMap(r => r.result.stats.ttftMs === null ? [] : [r.result.stats.ttftMs])),
    medianLatencyMs: median(complete.map(r => r.result.stats.latencyMs)), usageComplete,
    inputTokens: usageComplete ? rows.reduce((n, r) => n + r.result.stats.inputTokens, 0) : null,
    outputTokens: usageComplete ? rows.reduce((n, r) => n + r.result.stats.outputTokens, 0) : null,
    medianEstimatedUsdPerTurn: median(complete.flatMap(r => cost(r) === null ? [] : [cost(r)!])),
    costMethod: 'Estimate: usage × exact endpoint/model price table, ignoring cache discounts and search credits. Never a measured bill.',
    toolCallReliability: tested.length ? { calls: tested.reduce((n, r) => n + (r.result.stats.toolCalls ?? 0), 0),
      invalidCalls: tested.reduce((n, r) => n + (r.result.stats.invalidToolCalls ?? 0), 0),
      duplicateQueries: tested.reduce((n, r) => n + (r.result.evidence?.searches.filter(s => s.error === 'duplicate').length ?? 0), 0),
      researchScenarios: tested.filter(r => r.result.stats.searches > 0).length,
      completedWithCitations: complete.filter(r => r.result.stats.searches > 0 && r.result.evidence?.citations.length).length } : null,
    citationIntegrity: { invalid: tested.flatMap(r => r.result.evidence?.citations ?? []).filter(c => c.state === 'invalid').length,
      unverified: tested.flatMap(r => r.result.evidence?.citations ?? []).filter(c => c.state === 'unverified').length },
  };
  const warnings = ['Automatic assertions are lexical and structural checks, not a semantic verifier. Human review is required.',
    'Publication, retrieval and effective dates are distinct; numerical citation checks do not prove factual accuracy.',
    ...(mock ? ['Scripted model behavior and timings are not model-quality or provider-performance measurements.'] : []),
    ...(provenance.includes('synthetic') || provenance.includes('mixed') ? ['Search inputs include synthetic evidence; this is not a recorded-web correctness result.'] : []),
    ...(mode === 'live' || mode === 'record' ? ['Historical fixtures and scenario clock remain frozen. Actual search retrieval times are contemporary; inspect this temporal gap.'] : [])];
  return { version: 2, model: mock ? 'scripted fake (not a model benchmark)' : model, provider, baseURL, mode, category,
    frozen: '2026-11-11T08:30:00Z', codeHash: input.codeHash, blocked: input.blocked, metrics, warnings, humanReview: 'pending',
    fullSuite, automatedTargetsMet: mock || input.blocked || !fullSuite || p0.attempted !== p0.planned || p1.attempted !== p1.planned ? null
      : p0.planned > 0 && p1.planned > 0 && p0.passRate === 1 && p1.passRate !== null && p1.passRate >= .75,
    untested: selected.filter(s => !tested.some(r => r.id === s.id)).map(s => s.id),
    rows: rows.map(r => ({ ...r, outcome: r.result.error?.startsWith('llm_http_') ? 'untested' : r.failures.length ? 'fail' : 'pass',
      model: mock ? 'scripted fake' : model, citations: r.result.evidence?.citations ?? [],
      measurements: { ttftMs: mock || r.result.error?.startsWith('llm_http_') ? null : r.result.stats.ttftMs, latencyMs: mock || r.result.error?.startsWith('llm_http_') ? null : r.result.stats.latencyMs,
        inputTokens: !mock && r.result.stats.usageComplete ? r.result.stats.inputTokens : null,
        outputTokens: !mock && r.result.stats.usageComplete ? r.result.stats.outputTokens : null,
        estimatedUsd: cost(r), measuredUsd: null, priceBasis: mock ? null : price ?? null },
      warnings: [...(!r.result.stats.usageComplete ? ['Provider usage incomplete; cost unknown.'] : []),
        ...(!mock && cost(r) === null ? ['Cost unknown: missing usage or exact endpoint price.'] : []),
        ...(r.result.evidence?.citations.some(c => c.state === 'unverified') ? ['Numerical citation mismatch; inspect claim and evidence.'] : []),
        ...(r.result.evidence?.sources.some(s => s.fixture) ? ['Contains synthetic historical or search evidence.'] : [])],
    })) };
}
export type EvaluationReport = ReturnType<typeof buildReport>;
const cell = (value: unknown) => value === null || value === undefined ? 'unknown' : String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
export function markdownReport(report: EvaluationReport) {
  const table = '| Scenario | Priority | Result | TTFT ms | Total ms | Input / output tokens | Estimated USD |\n|---|---|---|---:|---:|---:|---:|\n'
    + report.rows.map(r => `| ${r.id} | ${r.priority} | ${r.outcome} | ${cell(r.measurements.ttftMs)} | ${cell(r.measurements.latencyMs)} | ${cell(r.measurements.inputTokens)} / ${cell(r.measurements.outputTokens)} | ${cell(r.measurements.estimatedUsd)} |`).join('\n');
  return `# Reprise evaluation\n\nMode: ${report.mode}; category: ${report.category}; model: ${report.model}; provider: ${report.provider}\n\n`
    + `${report.blocked ? 'Blocked: ' + report.blocked : 'Completed selected scenarios.'}\n\n${report.warnings.map(w => '- ' + w).join('\n')}\n\n`
    + `Untested: ${report.untested.join(', ') || 'none'}. Human review: ${report.humanReview}.\n\n${report.metrics ? '```json\n' + JSON.stringify(report.metrics, null, 2) + '\n```' : 'No model score: mock harness only.'}\n\n${table}\n\n`
    + report.rows.map(r => `## ${r.id} (${r.priority}): ${r.outcome}\n\nQuestion: ${r.text}\n\nFailures: ${r.failures.join('; ') || 'none'}\n\n${r.result.text}\n\n`
      + `Queries: ${r.queries.map(cell).join('; ') || 'none'}\n\nCitations: ${r.citations.map(c => `[${c.marker}] ${c.state}: ${c.detail ?? ''}`).join('; ') || 'none'}\n\n`
      + `Warnings: ${r.warnings.join('; ') || 'none'}\n\nInput SHA-256: ${r.inputHash}; cassette SHA-256: ${r.cassetteHash}\n\n`
      + `Full requests, stream events, recall packet and evidence ledger are in the companion JSON.\n`).join('\n');
}

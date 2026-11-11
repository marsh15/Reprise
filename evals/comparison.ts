import { z } from 'zod';
import { scenarios } from './scenarios';

const metric = z.number().nonnegative().nullable();
const rate = z.object({ planned: z.number().int(), attempted: z.number().int(), passed: z.number().int(), passRate: z.number().min(0).max(1).nullable() });
const reportSchema = z.object({
  version: z.literal(2), model: z.string(), provider: z.string(), baseURL: z.string(), mode: z.literal('replay'), codeHash: z.string().min(1),
  category: z.string(), blocked: z.null(), fullSuite: z.literal(true), humanReview: z.string(), untested: z.array(z.string()).length(0),
  metrics: z.object({ p0: rate, p1: rate, p0PassRate: metric, p1PassRate: metric, medianTtftMs: metric, medianLatencyMs: metric,
    inputTokens: metric, outputTokens: metric, medianEstimatedUsdPerTurn: metric, toolCallReliability: z.unknown(), citationIntegrity: z.unknown() }),
  rows: z.array(z.object({ id: z.string(), inputHash: z.string().min(1), cassetteHash: z.string().min(1), priority: z.enum(['P0', 'P1']), outcome: z.enum(['pass', 'fail']),
    trace: z.object({ requests: z.array(z.object({ model: z.string(), messages: z.array(z.unknown()).min(1), stream: z.literal(true), reasoning_effort: z.string().optional() }).passthrough()).min(1) }) })),
});
const candidates = new Set([
  'gpt-6-luna|configured endpoint|https://api.openai.com/v1',
  'gpt-6-sol|configured endpoint|https://api.openai.com/v1',
  'gpt-6.1-terra|configured endpoint|https://api.openai.com/v1',
  'deepseek/deepseek-v4.1-flash|fireworks/us|https://openrouter.ai/api/v1',
]);
export function compareReports(values: unknown[]) {
  if (values.length < 2) throw new Error('Provide at least two complete real-model replay reports');
  const reports = values.map(value => reportSchema.parse(value));
  const identity = (r: typeof reports[number]) => `${r.model}|${r.provider}|${r.baseURL}`;
  if (new Set(reports.map(identity)).size !== reports.length) throw new Error('Duplicate candidate report');
  for (const r of reports) {
    if (!candidates.has(identity(r))) throw new Error('Unplanned candidate or endpoint; disclose and obtain owner approval before substituting');
    if (r.rows.length !== scenarios.length || new Set(r.rows.map(row => row.id)).size !== scenarios.length
      || scenarios.some(s => !r.rows.some(row => row.id === s.id && row.priority === s.priority))) throw new Error('Incomplete or inconsistent scenario coverage');
    for (const priority of ['P0', 'P1'] as const) {
      const rows = r.rows.filter(row => row.priority === priority);
      const passed = rows.filter(row => row.outcome === 'pass').length; const field = priority === 'P0' ? 'p0' : 'p1';
      if (r.metrics[field].planned !== rows.length || r.metrics[field].attempted !== rows.length || r.metrics[field].passed !== passed
        || r.metrics[field].passRate !== passed / rows.length || r.metrics[priority === 'P0' ? 'p0PassRate' : 'p1PassRate'] !== passed / rows.length) throw new Error('Pass rate disagrees with scenario outcomes');
    }
    for (const request of r.rows.flatMap(row => row.trace.requests)) {
      if (request.model !== r.model || (['gpt-6-luna', 'gpt-6-sol'].includes(r.model) && request.reasoning_effort !== 'none')) throw new Error('Mismatched model or reasoning request evidence');
    }
    if (['gpt-6-luna', 'gpt-6-sol'].includes(r.model)) for (const row of r.rows) {
      const parameters = ({ messages: _messages, tool_choice: _choice, ...rest }: typeof row.trace.requests[number]) => JSON.stringify(rest);
      if (row.trace.requests.some(request => parameters(request) !== parameters(row.trace.requests[0]))) throw new Error('Runtime parameters changed between model calls');
    }
    if (r.codeHash !== reports[0].codeHash || r.category !== reports[0].category) throw new Error('Different implementation or evaluation category; rerun identical inputs');
    const signature = (report: typeof r) => report.rows.map(row => `${row.id}:${row.priority}:${row.inputHash}:${row.cassetteHash}`).sort().join('|');
    if (signature(r) !== signature(reports[0])) throw new Error('Different scenario/cassette inputs; comparison refused');
    for (const row of r.rows) {
      const first = row.trace.requests[0]; const baseline = reports[0].rows.find(other => other.id === row.id)!.trace.requests[0];
      if (JSON.stringify(first.messages) !== JSON.stringify(baseline.messages)) throw new Error('Different initial request context; comparison refused');
      if ([r.model, reports[0].model].every(model => ['gpt-6-luna', 'gpt-6-sol'].includes(model))) {
        const parameters = ({ model: _model, messages: _messages, ...rest }: typeof first) => JSON.stringify(rest);
        if (parameters(first) !== parameters(baseline)) throw new Error('Different runtime request parameters; comparison refused');
      }
    }
    if (r.metrics.p0PassRate === null) throw new Error('Missing P0 results');
  }
  const ranked = reports.toSorted((a, b) => {
    const p0 = b.metrics.p0PassRate! - a.metrics.p0PassRate!; if (p0) return p0;
    const latencyA = a.metrics.medianLatencyMs; const latencyB = b.metrics.medianLatencyMs;
    if (latencyA === null || latencyB === null) return 0;
    if (latencyA !== latencyB) return latencyA - latencyB;
    const costA = a.metrics.medianEstimatedUsdPerTurn; const costB = b.metrics.medianEstimatedUsdPerTurn;
    return costA === null || costB === null ? 0 : costA - costB;
  });
  return { decisionRule: 'Highest P0 rate, then lower median total latency, then lower estimated cost. Missing tie-break metrics leave ties unresolved.',
    defaultModelChanged: false, ownerApproval: 'required', humanReview: 'pending',
    warnings: ['Numerical and lexical checks are not semantic correctness; review transcripts, memory, dates, tool traces and conversational quality.',
      'Costs are rate-table estimates, not measured bills. Unavailable candidates must be disclosed separately.'],
    ranked: ranked.map(r => ({ model: r.model, provider: r.provider, category: r.category, ...r.metrics })) };
}

import { z } from 'zod';

const metric = z.number().nonnegative().nullable();
const reportSchema = z.object({
  version: z.literal(2), model: z.string(), provider: z.string(), baseURL: z.string(), mode: z.literal('replay'), codeHash: z.string().min(1),
  category: z.string(), blocked: z.null(), fullSuite: z.literal(true), humanReview: z.string(), untested: z.array(z.string()).length(0),
  metrics: z.object({ p0PassRate: metric, p1PassRate: metric, medianTtftMs: metric, medianLatencyMs: metric,
    inputTokens: metric, outputTokens: metric, medianEstimatedUsdPerTurn: metric, toolCallReliability: z.unknown(), citationIntegrity: z.unknown() }),
  rows: z.array(z.object({ id: z.string(), inputHash: z.string(), cassetteHash: z.string(), priority: z.enum(['P0', 'P1']), outcome: z.enum(['pass', 'fail']) })),
});
const candidates = new Set([
  'gpt-6-luna|configured endpoint|https://api.openai.com/v1',
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
    if (r.codeHash !== reports[0].codeHash || r.category !== reports[0].category) throw new Error('Different implementation or evaluation category; rerun identical inputs');
    const signature = (report: typeof r) => report.rows.map(row => `${row.id}:${row.priority}:${row.inputHash}:${row.cassetteHash}`).sort().join('|');
    if (signature(r) !== signature(reports[0])) throw new Error('Different scenario/cassette inputs; comparison refused');
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

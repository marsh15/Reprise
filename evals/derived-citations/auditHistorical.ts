// Explicit offline diagnostic entrypoint. Reads immutable local reports; never imports
// a model/search client or changes original scores. The output directory is ignored.
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { sourceSchema } from '../../src/shared/research';
import { evaluateDerivedCitation } from './evaluate';
import { historicalGold } from './historicalGold';
import { observationSchema } from './contract';

const reportSchema = z.object({ rows: z.array(z.object({ id: z.string(), failures: z.array(z.string()),
  result: z.object({ text: z.string(), evidence: z.object({ sources: z.array(sourceSchema) }) }),
})) });
const audits = [];
for (const model of ['luna', 'sol']) {
  const path = `evals/results/model-comparison/${model}-frozen-first.json`;
  const original = await readFile(path);
  const hash = createHash('sha256').update(original).digest('hex');
  const report = reportSchema.parse(JSON.parse(original.toString()));
  for (const id of ['R2', 'R3'] as const) {
    const row = report.rows.find(r => r.id === id);
    if (!row) throw new Error(`Missing ${id} in ${path}`);
    const gold = historicalGold(id);
    const observations = row.result.evidence.sources.map(source => {
      const reviewed = gold.observations.find(o => o.source.sourceId === source.sourceId);
      if (!reviewed) throw new Error(`Unreviewed observation UUID in ${id}`);
      // Check fixed gold against actual observations even when raw prose is unsupported.
      const actual = observationSchema.parse({ ...reviewed, source });
      if (JSON.stringify(actual) !== JSON.stringify(observationSchema.parse(reviewed)))
        throw new Error(`Original ${id} observation differs from the fixed reviewed snapshot`);
      return actual;
    });
    const diagnostic = evaluateDerivedCitation({ answer: row.result.text, observations, bindings: gold.bindings });
    audits.push({ model, id, originalPath: path, originalSha256: hash,
      originalAutomaticFailures: row.failures, diagnostic });
    console.log(`${model} ${id}: ${diagnostic.outcome}; arithmetic ${diagnostic.arithmetic}; ${diagnostic.diagnostics.map(d => d.code).join(', ')}`);
  }
  if (createHash('sha256').update(await readFile(path)).digest('hex') !== hash) throw new Error('Original report changed during audit');
}
await mkdir('evals/results/derived-citation-prototype', { recursive: true });
await writeFile('evals/results/derived-citation-prototype/historical-diagnostics.json', JSON.stringify({
  operation: 'New deterministic offline diagnostics; no model performance reassessment or generation', audits,
}, null, 2) + '\n');

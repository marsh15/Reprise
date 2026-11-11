import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { compareReports } from './comparison';

try {
  const paths = process.argv.slice(2);
  const result = compareReports(await Promise.all(paths.map(async path => JSON.parse(await readFile(path, 'utf8')))));
  const prefix = `evals/results/comparison-${new Date().toISOString().replaceAll(':', '-')}`;
  await mkdir('evals/results', { recursive: true });
  await writeFile(prefix + '.json', JSON.stringify(result, null, 2) + '\n');
  const table = '| Model | P0 | P1 | Median TTFT ms | Median total ms | Estimated USD/turn |\n|---|---:|---:|---:|---:|---:|\n'
    + result.ranked.map(r => `| ${r.model} | ${r.p0PassRate ?? 'unknown'} | ${r.p1PassRate ?? 'unknown'} | ${r.medianTtftMs ?? 'unknown'} | ${r.medianLatencyMs ?? 'unknown'} | ${r.medianEstimatedUsdPerTurn ?? 'unknown'} |`).join('\n');
  await writeFile(prefix + '.md', `# Model comparison\n\n${result.decisionRule}\n\n${table}\n\n${result.warnings.join('\n\n')}\n\nHuman review pending. Owner approval required; default model unchanged.\n`);
  console.log(`Comparison: ${prefix}.{json,md}. Default model unchanged; owner approval required.`);
} catch {
  console.error('Comparison blocked: use complete, unblocked, version-2 real-model replay reports for distinct planned candidates, identical implementation, scenarios and cassettes.');
  process.exitCode = 2;
}

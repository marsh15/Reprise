import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, realpath } from 'node:fs/promises';
import { loadEnvFile } from 'node:process';
import { randomUUID } from 'node:crypto';
import { parseConfig } from '../src/server/config';
import { createSearchWeb } from '../src/server/search/tavily';
import { chatToolParameters } from '../src/server/llm/client';
import { cassetteSearch } from './cassettes';
import { evaluationLlm } from './provider';
import { scenarios } from './scenarios';
import { executeScenario, implementationHash, type EvaluationRow } from './execute';
import { buildReport, markdownReport, type Mode } from './report';

if (existsSync('.env')) loadEnvFile('.env');
const args = process.argv.slice(2);
const option = (name: string) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const mock = args.includes('--mock'); const record = args.includes('--record'); const live = args.includes('--live');
const mode: Mode = mock ? 'mock' : live ? 'live' : record ? 'record' : 'replay';
const model = option('--model') || process.env.LLM_MODEL || 'gpt-6-luna';
const baseURL = option('--base-url') || process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
const selected = scenarios.filter(s => !option('--only') || option('--only')!.split(',').includes(s.id));
const rows: EvaluationRow[] = []; let blocked: string | null = null; let provider = mock ? 'mock' : 'unconfigured';
let codeHash = '';
try {
  const flags = new Set(['--mock', '--record', '--live']); const options = new Set(['--model', '--base-url', '--only', '--cassette-dir', '--provider', '--output-prefix']);
  for (let i = 0; i < args.length; i++) {
    if (flags.has(args[i])) continue;
    if (!options.has(args[i])) throw new Error('Unknown evaluation argument');
    if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error('Evaluation option requires a value');
    i++;
  }
  if ([mock, record, live].filter(Boolean).length > 1) throw new Error('--mock, --record and --live are separate modes');
  if (option('--only')?.split(',').some(id => !scenarios.some(s => s.id === id))) throw new Error('Unknown scenario ID; no scenarios executed');
  if (!selected.length) throw new Error('No matching scenarios selected');
  const endpoint = new URL(baseURL);
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error('Use an endpoint URL without credentials, query or fragment');
  if (record && !option('--cassette-dir')) throw new Error('--record requires --cassette-dir');
  const cassetteDir = option('--cassette-dir') || 'evals/search-cassettes';
  // Canonical-path checks also reject a symlink back into the frozen inputs.
  if (record && existsSync(cassetteDir) && await realpath(cassetteDir) === await realpath('evals/search-cassettes')) throw new Error('Record into a separate directory; checked-in cassettes are frozen');
  if ((live || record) && !process.env.TAVILY_API_KEY?.trim()) throw new Error('TAVILY_API_KEY absent; live search/recording unavailable');
  // Injected config values are never sent as keys: the real client/search owns authentication.
  const configured = mock ? undefined : evaluationLlm(baseURL, model, option('--provider'));
  if (configured) provider = configured.provider;
  const config = parseConfig({ LLM_API_KEY: 'injected-client', TAVILY_API_KEY: 'injected-search', LLM_MODEL: model, LLM_BASE_URL: baseURL,
    ...(process.env.LLM_REASONING_EFFORT ? { LLM_REASONING_EFFORT: process.env.LLM_REASONING_EFFORT } : {}) });
  chatToolParameters(config);
  codeHash = await implementationHash();
  for (const scenario of selected) {
    const cassette = await cassetteSearch(`${cassetteDir}/${scenario.cassette}.json`, {
      ...(record ? { record: createSearchWeb(process.env.TAVILY_API_KEY!) } : {}),
      ...(live ? { live: createSearchWeb(process.env.TAVILY_API_KEY!) } : {}),
    });
    const row = await executeScenario(scenario, { mock, config, cassette, llm: configured?.llm, providerTrace: configured?.trace, codeHash });
    rows.push(row);
    const providerBlocked = row.result.error?.startsWith('llm_http_');
    console.log(`${mode.toUpperCase()} ${scenario.id}: ${providerBlocked ? 'UNTESTED (provider blocked)' : row.failures.length ? 'FAIL: ' + row.failures.join('; ') : 'PASS'}`);
    if (providerBlocked) { blocked = `Provider rejected request: ${row.result.error}. Remaining scenarios untested.`; break; }
  }
} catch (error) { blocked = error instanceof Error ? error.message : 'evaluation unavailable'; }
const report = buildReport({ model, provider, baseURL: safeEndpoint(baseURL), mode, blocked, selected, rows, codeHash });
const filename = option('--output-prefix') || `evals/results/${new Date().toISOString().replaceAll(':', '-')}-${mock ? 'mock' : model.replaceAll(/[^a-zA-Z0-9._-]/g, '-')}-${randomUUID().slice(0, 8)}`;
await mkdir(resolve(filename, '..'), { recursive: true });
await writeFile(filename + '.json', JSON.stringify(report, null, 2) + '\n');
await writeFile(filename + '.md', markdownReport(report));
console.log(`${blocked ? 'BLOCKED: ' + blocked + '\n' : ''}Report: ${filename}.{json,md}`);
if (blocked) process.exitCode = 2;
else if (rows.some(row => row.failures.length)) process.exitCode = 1;
function safeEndpoint(value: string) {
  try { const url = new URL(value); return url.origin + url.pathname; } catch { return 'invalid endpoint'; }
}

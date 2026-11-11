import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { loadEnvFile } from 'node:process';
import { randomUUID, createHash } from 'node:crypto';
import { openDatabase } from '../src/server/db/db';
import { createRepo } from '../src/server/db/repo';
import { createClock } from '../src/server/clock';
import { parseConfig } from '../src/server/config';
import { createRunTurn, type TurnResult } from '../src/server/agent/runTurn';
import { createTurnService } from '../src/server/turns/service';
import { createSearchWeb } from '../src/server/search/tavily';
import { scriptedLlm } from '../tests/helpers/fakeLlm';
import { cassetteSearch } from './cassettes';
import { evaluationLlm } from './provider';
import type { RecallPacket } from '../src/shared/memory';
import { scenarios, deferred } from './scenarios';
import prices from './prices.json';
if (existsSync('.env')) loadEnvFile('.env');
const args = process.argv.slice(2);
const option = (name: string) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const mock = args.includes('--mock'); const record = args.includes('--record'); const live = args.includes('--live');
const model = option('--model') || process.env.LLM_MODEL || 'gpt-6-luna';
const baseURL = option('--base-url') || process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
const selected = scenarios.filter(s => !option('--only') || option('--only')!.split(',').includes(s.id));
const frozen = '2026-11-11T08:30:00Z';
const clock = createClock(frozen);
const rows: { id: string; priority: string; failures: string[]; result: TurnResult; queries: string[]; text: string; inputHash: string; memory: RecallPacket }[] = [];
let blocked: string | null = null; let provider = 'mock';
let llm: ReturnType<typeof evaluationLlm>['llm'] | undefined;
try {
  if (live && record) throw new Error('--live and --record are separate modes');
  if (record && option('--cassette-dir') && resolve(option('--cassette-dir')!) === resolve('evals/search-cassettes')) throw new Error('Record into a separate directory; checked-in cassettes are frozen');
  if (mock && (live || record)) throw new Error('--mock cannot be combined with live or record');
  if (!selected.length) throw new Error('No matching implemented scenarios selected');
  if ((live || record) && !process.env.TAVILY_API_KEY?.trim()) throw new Error('TAVILY_API_KEY absent; live search/recording unavailable');
  if (record && !option('--cassette-dir')) throw new Error('--record requires --cassette-dir; frozen checked-in inputs must not be overwritten');
  if (!mock) { const selectedProvider = evaluationLlm(baseURL, model, option('--provider')); llm = selectedProvider.llm; provider = selectedProvider.provider; }
  for (const scenario of selected) {
    const store = openDatabase(':memory:');
    try {
      const repo = createRepo(store);
      const cassettePath = `${option('--cassette-dir') || 'evals/search-cassettes'}/${scenario.cassette}.json`;
      const cassette = await cassetteSearch(cassettePath, {
        ...(record ? { record: createSearchWeb(process.env.TAVILY_API_KEY!) } : {}),
        ...(live ? { live: createSearchWeb(process.env.TAVILY_API_KEY!) } : {}),
      });
      const llmForTurn = mock ? scriptedLlm(scenario.script).llm : llm!;
      const config = parseConfig({ LLM_API_KEY: 'not-used-client-already-configured', TAVILY_API_KEY: 'not-used-injected-search', LLM_MODEL: model,
        LLM_BASE_URL: baseURL, ...(process.env.LLM_REASONING_EFFORT ? { LLM_REASONING_EFFORT: process.env.LLM_REASONING_EFFORT } : {}) });
      let conversationId = scenario.setup?.(repo);
      for (const pair of scenario.history ?? []) {
        const user = conversationId ? repo.insertUserMessage({ conversationId, clientMessageId: randomUUID(), text: '[Demo evaluation] ' + pair.user, timezone: 'Asia/Kolkata', now: clock.now() })
          : repo.startConversation({ clientMessageId: randomUUID(), text: '[Demo evaluation] ' + pair.user, timezone: 'Asia/Kolkata', now: clock.now(), origin: 'fixture' });
        conversationId = user.conversationId;
        repo.insertAssistantTurn({ id: randomUUID(), user, text: '[Demo evaluation] ' + pair.assistant, status: 'complete', now: clock.now(), model: 'fixture', stats: { searches: 0, sources: 0, latencyMs: 0, ttftMs: null, inputTokens: 0, outputTokens: 0 } });
      }
      let result!: TurnResult; let memory!: RecallPacket;
      const run = createRunTurn(llmForTurn, config, { search: cassette.search, now: clock.now });
      const service = createTurnService(repo, async input => { memory = input.packet; result = await run(input); return result; }, clock, model);
      const turn = service.prepare({ conversationId, clientMessageId: randomUUID(), text: scenario.text, timezone: 'Asia/Kolkata' });
      await turn.run(async () => {});
      await cassette.flush();
      const failures = [...scenario.assert(result), ...(scenario.assertMemory?.(memory) ?? []), ...cassette.misses.map(q => `cassette miss: ${q}`)];
      const inputHash = createHash('sha256').update(scenario.text + JSON.stringify(scenario.history) + await readFile('scripts/fixtures/demo.json', 'utf8') + await readFile(cassettePath, 'utf8')).digest('hex');
      rows.push({ id: scenario.id, priority: scenario.priority, failures, result, queries: cassette.queries, text: scenario.text, inputHash, memory });
      console.log(`${mock ? 'MOCK' : live ? 'LIVE' : record ? 'RECORD' : 'REPLAY'} ${scenario.id}: ${failures.length ? 'FAIL: ' + failures.join('; ') : 'PASS'}`);
      if (result.error?.startsWith('llm_http_')) { blocked = `Provider rejected request: ${result.error}. Remaining scenarios untested.`; break; }
    } finally { store.close(); }
  }
} catch (error) { blocked = error instanceof Error ? error.message : 'evaluation unavailable'; }
function median(values: number[]) { const sorted = values.toSorted((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length ? (sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2) : null; }
const completed = rows.filter(row => row.result.status === 'complete');
const tested = rows.filter(row => !row.result.error?.startsWith('llm_http_'));
const p0 = tested.filter(row => row.priority === 'P0');
const price = prices.models.find(price => price.model === model && price.provider === provider);
const cost = (result: TurnResult) => !mock && result.stats.usageComplete && price?.input != null && price.output != null
  ? (result.stats.inputTokens * price.input + result.stats.outputTokens * price.output) / 1e6 : null;
const usageComplete = rows.length > 0 && rows.every(row => row.result.stats.usageComplete);
const metrics = mock ? null : {
  p0PassRate: p0.length ? p0.filter(row => !row.failures.length).length / p0.length : null, p0Passed: p0.filter(row => !row.failures.length).length, p0Attempted: p0.length, p0Planned: selected.filter(s => s.priority === 'P0').length,
  medianTtftMs: median(completed.flatMap(row => row.result.stats.ttftMs === null ? [] : [row.result.stats.ttftMs])),
  medianLatencyMs: median(completed.map(row => row.result.stats.latencyMs)),
  usageComplete, inputTokens: usageComplete ? rows.reduce((n, row) => n + row.result.stats.inputTokens, 0) : null, outputTokens: usageComplete ? rows.reduce((n, row) => n + row.result.stats.outputTokens, 0) : null,
  medianEstimatedUsdPerTurn: median(completed.flatMap(row => cost(row.result) === null ? [] : [cost(row.result)!])),
  costMethod: 'Usage × pinned endpoint price; ignores cache discounts. Missing usage/price => unknown. Excludes search credits.',
  toolCallReliability: !tested.length ? null : { calls: rows.reduce((n, row) => n + (row.result.stats.toolCalls ?? 0), 0), invalidCalls: rows.reduce((n, row) => n + (row.result.stats.invalidToolCalls ?? 0), 0), duplicateQueries: rows.reduce((n, row) => n + (row.result.evidence?.searches.filter(s => s.error === 'duplicate').length ?? 0), 0), researchScenarios: rows.filter(row => row.result.stats.searches > 0).length,
    completedWithCitations: rows.filter(row => row.result.stats.searches > 0 && row.result.status === 'complete' && row.result.evidence?.citations.length).length },
};
const report = { model: mock ? 'scripted fake (not a model benchmark)' : model, provider, baseURL, frozen, mode: mock ? 'mock' : live ? 'live' : record ? 'record' : 'replay', blocked, metrics, deferredToM4: deferred, untested: selected.filter(s => !tested.some(r => r.id === s.id)).map(s => s.id), rows };
await mkdir('evals/results', { recursive: true });
const filename = `evals/results/${createClock().now().toISOString().replaceAll(':', '-')}-${mock ? 'mock' : model.replaceAll('/', '-')}`;
await writeFile(filename + '.json', JSON.stringify(report, null, 2) + '\n');
await writeFile(filename + '.md', `# Reprise evaluation\n\nMode: ${report.mode}; model: ${report.model}; provider: ${provider}\n\n${blocked ? 'Blocked: ' + blocked : 'Completed selected scenarios.'}\n\n${mock ? 'Scripted assertions validate the harness, not model quality.' : JSON.stringify(metrics, null, 2)}\n\n` + rows.map(row => `## ${row.id}: ${row.result.error?.startsWith('llm_http_') ? 'UNTESTED (provider blocked)' : row.failures.length ? 'FAIL' : 'PASS'}\n\n${row.failures.join('; ')}\n\n${row.result.text}\n\nInput SHA-256: ${row.inputHash}\n`).join('\n'));
console.log(`${blocked ? 'BLOCKED: ' + blocked + '\n' : ''}Report: ${filename}.{json,md}`);
if (blocked) process.exitCode = 2;
else if (rows.some(row => row.failures.length)) process.exitCode = 1;

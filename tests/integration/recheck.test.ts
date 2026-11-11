import { expect, it } from 'vitest';
import { parseConfig } from '../../src/server/config';
import { cassetteSearch } from '../../evals/cassettes';
import { executeScenario } from '../../evals/execute';
import { recheckScenarios } from '../../evals/recheckScenarios';
import { undatedChangeClaims } from '../../evals/assertions';

const config = parseConfig({ LLM_API_KEY: 'test', TAVILY_API_KEY: 'test' });
const execute = async (id: string) => {
  const scenario = recheckScenarios.find(s => s.id === id)!;
  const cassette = await cassetteSearch(`evals/search-cassettes/${scenario.cassette}.json`);
  return executeScenario(scenario, { mock: true, config, cassette, codeHash: 'test' });
};
it.each(['C1', 'C2', 'C3'])('%s runs historical research through the actual service/ledger with a scripted model', async id => {
  const row = await execute(id);
  expect(row.failures).toEqual([]); expect(row.result.status).toBe('complete');
  expect(JSON.stringify(row.trace.requests[0])).toContain('task_hint');
  expect(row.result.evidence?.citations.some(c => c.state === 'invalid')).toBe(false);
  expect(row.trace.events.some(e => e.type === 'answer.reset')).toBe(true);
});
it('keeps old and new observations of the same pricing URL with distinct times/IDs', async () => {
  const row = await execute('C1'); const sources = row.result.evidence!.sources;
  expect(row.result.stats.searches).toBe(5); expect(sources).toHaveLength(10);
  expect(new Set(sources.map(s => s.sourceId)).size).toBe(10);
  const hubspot = sources.filter(s => s.url.includes('hubspot'));
  expect(hubspot.map(s => s.n)).toEqual([1, 1]);
  expect(hubspot[0].retrievedAt).toContain('2026-11-09'); expect(hubspot[1].retrievedAt).toContain('2026-11-11');
  expect(hubspot[0].excerpt).toContain('$20'); expect(hubspot[1].excerpt).toContain('$24');
  expect(row.memory.recalledTurns[0].sources[0].excerpt).toContain('$20');
});
it('uses an answer without sources as a reported claim, without inventing historical evidence', async () => {
  const row = await execute('C2');
  expect(row.memory.recalledTurns[0].sources).toEqual([]);
  expect(row.result.evidence!.sources.every(s => s.retrievedAt.startsWith('2026-11-11'))).toBe(true);
});
it('does not force live CRM evidence to demonstrate the synthetic fixture changes', async () => {
  const row = await execute('C1'); const scenario = recheckScenarios.find(s => s.id === 'C1')!;
  const text = 'Demo history: HubSpot, Pipedrive, Zoho, Salesforce and Close. Unable to verify a dated change from these current sources [1].';
  expect(scenario.assert({ ...row.result, text }).length).toBeGreaterThan(0); // Controlled fixture expectations apply.
  const evidence = row.result.evidence!;
  const sources = evidence.sources.map(s => evidence.searches.some(q => q.id === s.searchId) ? { ...s, fixture: false } : s);
  expect(scenario.assert({ ...row.result, text, evidence: { ...evidence, sources } })).toEqual([]);
});
it.each([
  ['C1', 'Demo: all five CRMs changed pricing on 2026-11-11.'],
  ['C2', 'Demo: Neon, Supabase, RDS and Railway are all still accurate and pricing unchanged [1].'],
  ['C3', 'Demo: Neon has reduced Launch retention. It is incorrect now [1].'],
])('%s rejects a selected misleading verdict', async (id, text) => {
  const row = await execute(id); const scenario = recheckScenarios.find(s => s.id === id)!;
  expect(scenario.assert({ ...row.result, text }).length).toBeGreaterThan(0);
});
it('rejects a dated change attributed only to a current pricing page', async () => {
  const row = await execute('C1');
  expect(undatedChangeClaims({ ...row.result, text: 'HubSpot changed pricing on 2026-11-10 [1].' })).toHaveLength(1);
  expect(undatedChangeClaims({ ...row.result, text: 'Pipedrive increased pricing on 2026-11-10 [2].' })).toEqual([]);
  expect(undatedChangeClaims({ ...row.result, text: 'Pipedrive increased pricing on 2026-11-11 [2].' })).toHaveLength(1);
});

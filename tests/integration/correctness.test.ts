import { expect, it } from 'vitest';
import { correctnessScenarios } from '../../evals/correctnessScenarios';
import { cassetteSearch } from '../../evals/cassettes';
import { executeScenario } from '../../evals/execute';
import { parseConfig } from '../../src/server/config';
import { citationIntegrity } from '../../evals/assertions';
const config = parseConfig({ LLM_API_KEY: 'fake', TAVILY_API_KEY: 'fake' });
async function run(id: string) {
  const scenario = correctnessScenarios.find(s => s.id === id)!;
  const cassette = await cassetteSearch(`evals/search-cassettes/${scenario.cassette}.json`);
  const row = await executeScenario(scenario, { mock: true, config, cassette, codeHash: 'test' });
  return { scenario, row };
}
it.each(['R1', 'R2', 'R3'])('%s exercises the real service, source presentation and ledger', async id => {
  const { row } = await run(id);
  expect(row.failures).toEqual([]);
  const requests = row.trace.requests as { tools: { function: { name: string } }[]; messages: { role: string; content: string }[] }[];
  expect(requests.every(r => r.tools.length === 1 && r.tools[0].function.name === 'web_search')).toBe(true);
  expect(JSON.stringify(requests.at(-1)?.messages)).toContain('Citation index');
  expect(row.result.evidence?.citations.every(c => c.state !== 'unverified' && c.state !== 'invalid')).toBe(true);
});
it('rejects stale release conclusions while retaining the contradictory source for inspection', async () => {
  const { scenario, row } = await run('R1');
  expect(scenario.assert({ ...row.result, text: 'The current stable release is 7.9 [1].' })).toContain('new authoritative release omitted');
  expect(row.result.evidence?.sources.map(s => s.publishedAt)).toEqual(['2026-07-01', '2026-11-10']);
});
it('rejects reconstructed product-order numbers and matching prices on the wrong vendor', async () => {
  const { row } = await run('R2');
  expect(citationIntegrity({ ...row.result, text: 'Aster costs $25 [1]; Birch costs $35 [2]; Cedar costs $25 [3].' })).toContain('unverified citation');
  expect(citationIntegrity({ ...row.result, text: 'Aster costs $25 [4].' })).toContain('unverified citation');
  expect(citationIntegrity({ ...row.result, text: 'Aster costs $25. A separate disclaimer follows [2].' })).toContain('uncited numerical source claim');
});
it('rejects an invented effective date and a current price cited to the old observation', async () => {
  const { scenario, row } = await run('R3');
  expect(scenario.assert({ ...row.result, text: row.result.text + ' Aster changed pricing on 2026-11-11 [2].' })).toContain('dated change claim lacks cited explicit change evidence');
  expect(citationIntegrity({ ...row.result, text: 'Aster costs $25 [1].' })).toContain('unverified citation');
  expect(row.result.evidence?.sources.map(s => s.n)).toEqual([1, 2]);
});
it('accepts a labelled correct difference of separately supported same-product prices, and rejects wrong arithmetic', async () => {
  const { row } = await run('R3');
  const sources = row.result.evidence!.sources;
  const before = sources[0].excerpt.match(/\$(\d+)/)![1];
  const after = sources[1].excerpt.match(/\$(\d+)/)![1];
  const prefix = `Historical Aster price $${before}/month [1], while the current Aster price is $${after}/month [2]. `;
  expect(citationIntegrity({ ...row.result, text: prefix + `The observed difference is $${Number(after) - Number(before)}/month.` })).toEqual([]);
  expect(citationIntegrity({ ...row.result, text: prefix + `The observed difference is $${Number(after) - Number(before) + 1}/month.` })).toContain('uncited numerical source claim');
  expect(citationIntegrity({ ...row.result, text: prefix + 'The current price is $99/month.' })).toContain('uncited numerical source claim');
});
it('checks a labelled comparison difference without accepting a wrong direction or unsupported price', async () => {
  const { row } = await run('R2');
  const prefix = 'Birch costs $35/month [3]; Cedar costs $25/month [4]. ';
  expect(citationIntegrity({ ...row.result, text: prefix + 'Birch is $10 more per month.' })).toEqual([]);
  expect(citationIntegrity({ ...row.result, text: prefix + 'Birch is $10 less per month.' })).toContain('uncited numerical source claim');
  expect(citationIntegrity({ ...row.result, text: prefix + 'The difference is €10/month.' })).toContain('uncited numerical source claim');
  expect(citationIntegrity({ ...row.result, text: prefix + 'Birch costs $10/month.' })).toContain('uncited numerical source claim');
});

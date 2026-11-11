import { expect, it } from 'vitest';
import { scenarios } from '../../evals/scenarios';
import { cassetteSearch } from '../../evals/cassettes';
import { executeScenario } from '../../evals/execute';
import { parseConfig } from '../../src/server/config';
const config = parseConfig({ LLM_API_KEY: 'fake', TAVILY_API_KEY: 'fake' });
async function example(id: string) {
  const scenario = scenarios.find(s => s.id === id)!;
  const cassette = await cassetteSearch(`evals/search-cassettes/${scenario.cassette}.json`);
  const row = await executeScenario(scenario, { config, cassette, mock: true, codeHash: 'test' });
  return { scenario, result: row.result };
}
it.each(["I don’t have a record", "I don't have a record", 'There is no record', 'I have no earlier conversation', 'I have no conversation record'])('F1 accepts equivalent honest abstention: %s', async disclosure => {
  const { scenario, result } = await example('F1');
  expect(scenario.assert({ ...result, text: `${disclosure} for 3 November. History starts on 11 November 2026.` })).toEqual([]);
  expect(scenario.assert({ ...result, text: 'You asked about buying servers on 3 November.' })).not.toEqual([]);
});
it('F2 accepts equivalent baseline abstention while still requiring current research and citations', async () => {
  const { scenario, result } = await example('F2');
  expect(scenario.assert({ ...result, text: 'I don’t have a record of that conversation; history starts on 2026-11-11. I can’t compare the price with last Tuesday. Current synthetic Supabase pricing is $25 [1].' })).toEqual([]);
  expect(scenario.assert({ ...result, text: 'I don’t have that conversation; please provide it.', evidence: { searches: [], sources: [], citations: [] } })).toContain('current pricing needs valid citations');
  expect(scenario.assert({ ...result, text: result.text + ' I previously recommended the $25 plan.' })).toContain('possible invented past answer');
});
it.each(['feature not shipped yet', 'feature has not shipped', 'feature is not available', 'that is not evidence it is available now', 'it wasn’t yet available', 'we cannot establish current availability'])('C1 accepts negative availability phrasing: %s', async wording => {
  const { scenario, result } = await example('C1');
  const text = result.text.replace('so I cannot say it shipped since Monday', `so ${wording}`);
  expect(scenario.assert({ ...result, text })).toEqual([]);
  expect(scenario.assert({ ...result, text: text + ' Salesforce has shipped the feature.' })).toContain('announcement treated as availability');
});
it('T1 accepts negated evidence language but still rejects an affirmative shipped claim and missing date roles', async () => {
  const { scenario, result } = await example('T1');
  const text = result.text.replace('we cannot establish current availability', 'it does not indicate that Atlas has shipped or establish current availability');
  expect(scenario.assert({ ...result, text })).toEqual([]);
  expect(scenario.assert({ ...result, text: text + ' Atlas has shipped.' })).toContain('unsupported shipped claim');
  expect(scenario.assert({ ...result, text: 'Demo: Atlas has not shipped.' })).toContain('temporal roles missing');
});
it('I2 recognizes an honest malformed-response disclosure with curly punctuation and rejects unsupported certainty', async () => {
  const { scenario, result } = await example('I2');
  expect(scenario.assert({ ...result, text: 'I couldn’t check availability: the search failed with a malformed response.' })).toEqual([]);
  expect(scenario.assert({ ...result, text: 'The service is available.' })).toContain('failure not disclosed');
});
it('F2 rejects fabricated history even alongside an honest current-research answer', async () => {
  const { scenario, result } = await example('F2');
  expect(scenario.assert({ ...result, text: result.text + ' We discussed Supabase last Tuesday.' })).toContain('possible invented past answer');
  expect(scenario.assert({ ...result, text: 'I have no record and cannot identify what we discussed then; history starts on 2026-11-11. I cannot compare prices then and now. Synthetic current Supabase price $25 [1].' })).toEqual([]);
});
it('D1 specifies both exact replay fields; reasonable unrecorded freshness still misses visibly', async () => {
  expect(scenarios.find(s => s.id === 'D1')!.text).toMatch(/freshness any/i);
  const cassette = await cassetteSearch('evals/search-cassettes/D1.json');
  const outcome = await cassette.search({ query: 'Node.js latest LTS version', freshness: 'week' }, new AbortController().signal);
  expect(outcome.error).toBe('cassette_miss');
  expect(outcome.results).toEqual([]);
  expect(cassette.misses).toEqual(['node.js latest lts version|week']);
});

it('C1 accepts an explained comparability gap but still rejects a confident unsupported change', async () => {
  const { scenario, result } = await example('C1');
  const text = result.text.replaceAll('unable to verify', 'not a verified change because prior terms are undocumented');
  expect(scenario.assert({ ...result, text })).toEqual([]);
  expect(scenario.assert({ ...result, text: 'Demo: HubSpot, Pipedrive, Zoho, Salesforce and Close all changed their prices on 2026-11-11 [1].' })).not.toEqual([]);
});

it('C1 rejects affirmative availability even if another sentence discloses uncertainty', async () => {
  const { scenario, result } = await example('C1');
  expect(scenario.assert({ ...result, text: result.text + ' The feature is now available.' })).toContain('announcement treated as availability');
});

import { expect, it } from 'vitest';
import { limitation, noRecord, affirmativeShipment, negativeAvailability, changeDateUncertainty } from '../../evals/assertions';
import { correctnessScenarios } from '../../evals/correctnessScenarios';
import { scenarios } from '../../evals/scenarios';
import { executeScenario } from '../../evals/execute';
import { cassetteSearch } from '../../evals/cassettes';
import { parseConfig } from '../../src/server/config';

it.each([
  'I cannot identify the plans you discussed or establish whether their prices changed.',
  'The previous plans or prices are unavailable.',
  'A historical price change cannot be established without an earlier baseline.',
  'Current observations cannot be compared reliably with the missing historical record.',
  'There are no earlier source observations.',
  'The historical billing terms are missing.',
])('recognizes a specific historical comparison gap: %s', text => {
  expect(limitation(text)).toEqual([]);
});
it.each(['I cannot establish that.', 'There is uncertainty.', 'Current research evidence is unavailable.', 'The current price is unknown.', 'I cannot compare current prices.', 'Historical prices are available.'])('rejects a generic or affirmative substitute for a historical gap: %s', text => {
  expect(limitation(text)).toContain('historical baseline limitation missing');
});
it.each(['No previous conversation is recorded.', 'The previous conversation is not recorded.', 'No earlier conversation was saved.'])('recognizes passive missing-history wording: %s', text => {
  expect(noRecord(text)).toBe(true);
});
it.each(['The previous prices are unavailable.', 'Historical source evidence is missing.', 'Historical billing terms are missing.', 'No current conversation is recorded.'])('does not confuse evidence or terms with missing past conversation: %s', text => {
  expect(noRecord(text)).toBe(false);
});
it.each([
  'The observations differ, but the effective change date is unknown.',
  'Neither source establishes when the change occurred.',
  'The recorded observations do not establish a precise date of change.',
  'They don’t establish when the underlying price changed. Neither source gives an effective change date.',
  'The evidence cannot establish when a price change occurred.',
])('recognizes change-date uncertainty beyond one word order: %s', text => {
  expect(changeDateUncertainty(text)).toBe(true);
});
it.each(['The current price is unknown.', 'The effective change date is known.', 'Neither source discusses refunds.', 'Neither source establishes when refunds arrive.', 'The observations differ.', 'I cannot establish the current price.'])('does not accept unrelated uncertainty: %s', text => {
  expect(changeDateUncertainty(text)).toBe(false);
});
it.each(['The feature is announced.', 'The feature is planned.', 'The feature has not shipped.', 'The feature is not yet generally available.', 'There is no evidence that Atlas has released.', 'It does not indicate that Atlas has shipped.'])('keeps announcements and negation separate from affirmative release: %s', text => {
  expect(affirmativeShipment(text)).toBe(false);
});
it.each(['Atlas has released.', 'The feature is released.', 'Salesforce is available to eligible customers.', 'The feature is generally available.', 'The feature has shipped.'])('detects unsupported affirmative availability: %s', text => {
  expect(affirmativeShipment(text)).toBe(true);
});
it('recognizes a negative release without accepting the opposite claim', () => {
  expect(negativeAvailability('The feature is not yet released.')).toBe(true);
  expect(affirmativeShipment('The feature is not yet released, but it is now available.')).toBe(true);
});

const config = parseConfig({ LLM_API_KEY: 'fake', TAVILY_API_KEY: 'fake' });
it('F2 accepts the demonstrated baseline wording while retaining research and fabrication failures', async () => {
  const scenario = scenarios.find(s => s.id === 'F2')!;
  const cassette = await cassetteSearch('evals/search-cassettes/F2.json');
  const { result } = await executeScenario(scenario, { config, cassette, mock: true, codeHash: 'test' });
  const text = 'No previous conversation is recorded. History starts on 11 November 2026, so I cannot identify the plans you discussed or establish whether their prices changed. Synthetic Supabase Pro price $25 per project per month [1].';
  expect(scenario.assert({ ...result, text })).toEqual([]);
  expect(scenario.assert({ ...result, text, stats: { ...result.stats, searches: 0 } })).toContain('no current research');
  expect(scenario.assert({ ...result, text: text + ' We discussed Supabase last Tuesday.' })).toContain('possible invented past answer');
});
it('R3 accepts an equivalent uncertainty statement but rejects invented effective dates despite its caveat', async () => {
  const scenario = correctnessScenarios.find(s => s.id === 'R3')!;
  const cassette = await cassetteSearch('evals/search-cassettes/R3.json');
  const { result } = await executeScenario(scenario, { config, cassette, mock: true, codeHash: 'test' });
  const text = result.text.replace('the evidence cannot establish when a price change occurred', 'neither source establishes when the change occurred');
  expect(scenario.assert({ ...result, text })).toEqual([]);
  for (const date of ['2026-11-03', '2026-11-11', 'November 11, 2026']) {
    expect(scenario.assert({ ...result, text: text + ` Aster definitely changed on ${date} [2].` })).toContain('dated change claim lacks cited explicit change evidence');
  }
  expect(scenario.assert({ ...result, text: text.replace('neither source establishes when the change occurred', 'the current price is unknown') })).toContain('missing change-date uncertainty');
});

it('C1 keeps released and eligible-availability claims strict despite an announcement caveat', async () => {
  const scenario = scenarios.find(s => s.id === 'C1')!;
  const cassette = await cassetteSearch('evals/search-cassettes/C1.json');
  const { result } = await executeScenario(scenario, { config, cassette, mock: true, codeHash: 'test' });
  for (const claim of ['The feature is released.', 'Salesforce is available to eligible customers.', 'The feature is generally available.']) {
    expect(scenario.assert({ ...result, text: result.text + ' ' + claim })).toContain('announcement treated as availability');
  }
});

it.each([
  'Historical pricing shows no change since then.',
  'The earlier plans had no price change.',
  'No problem: the previous prices were $20 and $25.',
])('does not mistake a no-change assertion for a missing baseline: %s', text => {
  expect(limitation(text)).toContain('historical baseline limitation missing');
});
it.each([
  "I can't establish whether any pricing changed.",
  "I can't establish what providers or prices you asked about then, or whether any pricing changed.",
])('accepts a bounded inability to determine a pricing change: %s', text => {
  expect(limitation(text)).toEqual([]);
});
it.each([
  'We cannot date an underlying price change.',
  'Neither establishes when the price changed.',
  'Neither establishes when the change took effect.',
  'The evidence does not establish when the price changed.',
  "The evidence doesn't establish when the price changed.",
])('retains truthful change-date forms found in saved answers: %s', text => {
  expect(changeDateUncertainty(text)).toBe(true);
});
it('does not treat releasing an announcement as releasing the feature', () => {
  expect(affirmativeShipment('Salesforce released an announcement that Atlas is planned.')).toBe(false);
  expect(affirmativeShipment('Salesforce released the feature.')).toBe(true);
});
it.each(['F2', 'C2'])('%s does not accept an invented no-change claim as a historical limitation', async id => {
  const scenario = scenarios.find(s => s.id === id)!;
  const cassette = await cassetteSearch(`evals/search-cassettes/${scenario.cassette}.json`);
  const { result } = await executeScenario(scenario, { config, cassette, mock: true, codeHash: 'test' });
  const text = result.text
    .replace('I cannot establish a change without historical evidence.', 'Historical pricing shows no change since then.')
    .replace('but has no earlier source observations. I cannot establish a change or verify that the old numbers were correct.', 'and historical pricing shows no change since then.');
  expect(scenario.assert({ ...result, text })).toContain('historical baseline limitation missing');
});

it.each([
  "I can't establish what prices you saw then or whether they changed.",
  "I can't identify which Postgres hosts or prices you meant, so I can't compare them with current pricing.",
])('retains an explicitly unresolved historical referent: %s', text => {
  expect(limitation(text)).toEqual([]);
});

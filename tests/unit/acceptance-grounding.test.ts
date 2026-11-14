import { expect, it } from 'vitest';
import { uncertaintyDisclosure, originalErrorNotLaterChange } from '../../evals/assertions';
import { scenarios } from '../../evals/scenarios';
import { executeScenario } from '../../evals/execute';
import { cassetteSearch } from '../../evals/cassettes';
import { parseConfig } from '../../src/server/config';
import { createSourceRegistry } from '../../src/server/agent/sourceRegistry';
import { checkCitations } from '../../src/server/agent/citations';
import { randomUUID } from 'node:crypto';

const config = parseConfig({ LLM_API_KEY: 'fake', TAVILY_API_KEY: 'fake' });
const mockResult = async (id: string) => {
  const scenario = scenarios.find(s => s.id === id)!;
  const cassette = await cassetteSearch(`evals/search-cassettes/${scenario.cassette}.json`);
  return { scenario, result: (await executeScenario(scenario, { config, cassette, mock: true, codeHash: 'test' })).result };
};

// Saved gpt-6-luna answers from the 14 November 2026 acceptance run (evals/results/final-acceptance/*, not committed).
// They are regression examples for the evaluation language only; no code special-cases them.
const LUNA_C1 = "**One pricing change is explicitly documented: Pipedrive Essential.** Salesforce announced a reporting feature, but the evidence says it is planned—not yet available. The search results are synthetic fixtures, not live vendor observations, so treat these as illustrative findings rather than verified real-world updates.\n\n| CRM | Monday observation (Nov 9) | Current search observation (retrieved Nov 11) | Verdict |\n|---|---|---|---|\n| HubSpot Sales Hub Starter | $20 per seat/month, illustrative only [1] | Standard $24 per seat/month, monthly billing [6] | **Observed difference** in the fixtures; no effective change date is established, and the current result says annual terms differ. |\n| Pipedrive Essential | $15 per seat/month, illustrative only [2] | $18 per seat/month; fixture says increase effective Nov 10, same packaging, for new and renewing customers [7] | **Verified change within the synthetic evidence:** increase effective Nov 10. |\n| Zoho CRM Standard | $14 per seat/month, illustrative only [3] | $14 per seat/month; commitment unspecified [8] | **No established change** in the checked price; this does not rule out changes between observations. |\n| Salesforce Starter Suite | $25 per seat/month, illustrative only [4] | $25 per seat/month, monthly billing; reporting feature announced Nov 10, planned for eligible accounts from Dec 1 [9] | **No established change** in the checked price. The feature is announced, not shown as shipped or available yet. |\n| Close Startup | $49 per seat/month, illustrative only [5] | Standard $59 per seat/month, monthly billing, no introductory discount; no dated change stated [10] | **Observed difference** in the fixtures; timing and cause are not established, and prior promotional terms may not be comparable. |\n\nThe Monday prices and today’s observations are all fixture data, not verified vendor pricing. For Zoho and Salesforce, matching price observations support only the checked price—not a guarantee that nothing changed in between.";
const LUNA_C3 = "No. The recorded answer said Launch includes 30 days, but the historical demo observation says Launch included **1 day** on November 3, 2026; Scale included 30 days [1]. The current search fixture also reports **1 day** for Launch and says it matches the November 3 observation [2].\n\n**Verdict: OBSERVED DIFFERENCE** between the answer and both observations—the answer appears incorrect, not evidence of a plan change. These are synthetic demo fixtures, not verified live Neon information.";

// C1: "cannot be established" has a passive form that the original assertion did not recognise.
it.each([
  'The effective change date is not established.',
  'No effective change date is established.',
  'Timing and cause are not established.',
  'Prior promotional terms are not established.',
  'The price change is not yet established.',
  'The billing commitment was not established.',
])('accepts a passive uncertainty about the change, its timing or the terms: %s', text => {
  expect(uncertaintyDisclosure(text)).toBe(true);
});
it.each([
  'The current price is not established.',
  'The latest release is not established.',
  'No change is established.',
  'The change is established.',
  'The price change is clearly established.',
  'Pipedrive raised its price on 2026-11-10.',
  'Everything is well established.',
])('rejects unrelated, affirmative or category-conflating wording: %s', text => {
  expect(uncertaintyDisclosure(text)).toBe(false);
});
it('C1 accepts the saved Luna answer on its demonstrated uncertainty wording and nothing else', async () => {
  const { scenario, result } = await mockResult('C1');
  expect(scenario.assert({ ...result, text: LUNA_C1 })).toEqual([]);
  // Reassessment only: the original wording requirement is unchanged for every other category.
  expect(scenario.assert({ ...result, text: LUNA_C1.replaceAll('are not established', 'are shown').replaceAll('is established', 'is shown') })).toContain('uncertainty category missing');
  expect(scenario.assert({ ...result, text: LUNA_C1.replaceAll('Observed difference', 'Different') })).toContain('observation distinction missing');
});
it('C1 still rejects a fabricated effective date or a shipped announcement despite the new wording', async () => {
  const { scenario, result } = await mockResult('C1');
  expect(scenario.assert({ ...result, text: LUNA_C1 + ' Zoho definitely changed on 2026-11-10 [8].' })).toContain('dated change claim lacks cited explicit change evidence');
  expect(scenario.assert({ ...result, text: LUNA_C1 + ' The reporting feature is released.' })).toContain('announcement treated as availability');
});

// C3: negating a later vendor change separates an original error from a change, but only with the historical baseline.
it.each([
  'The old answer was incorrect; the historical observation shows 1 day, so this is not evidence of a plan change.',
  'The stored source already says 1 day; the answer was wrong, not a later vendor change.',
  'The earlier documentation limited Launch to 1 day, so there is no evidence of a later plan change.',
])('accepts an original error that is explicitly not a later change: %s', text => {
  expect(originalErrorNotLaterChange(text)).toBe(true);
});
it.each([
  'The answer is incorrect, not evidence of a plan change [2].',
  'The historical observation shows 1 day, and the plan changed afterwards.',
  'The recorded source says 1 day. This is evidence of a plan change.',
  'The answer was incorrect because the plan changed.',
  'The answer is incorrect.',
])('rejects current-only, affirmative or contradictory wording: %s', text => {
  expect(originalErrorNotLaterChange(text)).toBe(false);
});
it('C3 accepts the saved Luna answer while keeping the correction and vendor-change controls', async () => {
  const { scenario, result } = await mockResult('C3');
  expect(scenario.assert({ ...result, text: LUNA_C3 })).toEqual([]);
  expect(scenario.assert({ ...result, text: LUNA_C3.replace('not evidence of a plan change', 'evidence of a plan change').replace(/the historical demo observation/i, 'the current plan page') })).toContain('original error not distinguished from later change');
  expect(scenario.assert({ ...result, text: LUNA_C3.replace('No. The recorded answer', 'Yes. The recorded answer').replace('appears incorrect', 'appears fine') })).toContain('incorrect historical answer not corrected');
  expect(scenario.assert({ ...result, text: LUNA_C3 + ' Neon has reduced Launch retention.' })).toContain('original error presented as vendor change');
});

// L6: "captured <date>" is the observation's retrieval time, and nothing else.
const observed = (vendor: string, excerpt: string, retrievedAt: string, publishedAt: string | null = null) => ({
  sourceId: randomUUID(), searchId: randomUUID(), rank: 1, url: `https://${vendor.toLowerCase()}.com/pricing`,
  title: `${vendor} pricing`, excerpt, publishedAt, retrievedAt, fixture: false,
});
const registry = () => {
  const r = createSourceRegistry();
  r.register(observed('Aster', 'Aster costs $20 per seat per month. Price change effective 2026-11-12.', '2026-11-09T10:00:00.000+05:30', '2026-11-01T00:00:00Z'));
  r.register(observed('Birch', 'Birch costs $15 per seat per month.', '2026-11-10T08:00:00Z'));
  return r.entries;
};
const first = (text: string, entries = registry()) => checkCitations(text, entries).find(c => c.marker === 1)?.state;
it.each([
  'Aster costs $20, captured Nov 9 [1].',
  'Aster costs $20 per seat (captured on 9 November 2026) [1].',
  'Aster costs $20, captured 2026-11-09 [1].',
  'Aster costs $20, captured Nov 9, 2026 [1].',
  '| Aster | **$20/seat/month**, explicitly invented and unverified; captured Nov 9.[1] |',
])('verifies a capture date equal to the cited observation retrieval date: %s', text => {
  expect(first(text)).toBe('verified');
});
it.each([
  ['a different day', 'Aster costs $20, captured Nov 10 [1].'],
  ['a different year', 'Aster costs $20, captured Nov 9, 2025 [1].'],
  ['the publication date', 'Aster costs $20, captured Nov 1 [1].'],
  ['a wrong price', 'Aster costs $25, captured Nov 9 [1].'],
  ['a second unsupported date in the same sentence', 'Aster costs $20, captured Nov 9 and updated Nov 9 [1].'],
  ['a wrong source', 'Aster costs $20, captured Nov 9 [2].'],
  ['a different source retrieval date', 'Birch costs $15, captured Nov 9 [2].'],
])('does not verify a capture date for %s: %s', (_name, text) => {
  expect(checkCitations(text, registry())[0].state).toBe('unverified');
});
it.each(['announced', 'effective', 'updated', 'published', 'changed', 'seen'])('does not treat "%s" as a retrieval-date expression', word => {
  expect(first(`Aster costs $20, ${word} Nov 9 [1].`)).toBe('unverified');
});
it('requires the date to follow the word directly and the source to record a retrieval time', () => {
  expect(first('Aster captured the market on Nov 9 and costs $20 [1].')).toBe('unverified');
  expect(first('Aster costs $20, captured Nov 9 [1].', new Map([[1, { sourceId: 'a', text: 'Aster costs $20.' }]]))).toBe('unverified');
});
it('keeps the explicit retrieval and publication roles unchanged', () => {
  expect(first('Retrieved Nov 9 [1].')).toBe('verified');
  expect(first('Published Nov 1 [1].')).toBe('verified');
  expect(first('Published Nov 9 [1].')).toBe('unverified');
});

// L5. Neon [19]: the amount appears only in the page title, which the model sees but the checker does not read.
it('L5: a title-only amount stays unverified, and the warning names the excerpt rather than the whole source', () => {
  const titleOnly = new Map([[1, { sourceId: 'a', text: 'Compute is $0.106 per CU-hour.' }]]);
  const [record] = checkCitations('Neon still says typical spend is $15 per month [1].', titleOnly);
  expect(record.state).toBe('unverified');
  expect(record.detail).toBe('not found in cited excerpt: $15');
});

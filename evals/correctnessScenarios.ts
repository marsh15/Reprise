import type { Scenario } from './scenarios';
import { fixtureDisclosure, grounded, mentions, undatedChangeClaims, changeDateUncertainty } from './assertions';
const call = (query: string) => ({ args: JSON.stringify({ query, freshness: 'any' }) });
// Opt-in regressions: the canonical 11-P0/12-P1 acceptance denominator is unchanged.
export const correctnessScenarios: Scenario[] = [
  { id: 'R1', priority: 'P0', cassette: 'R1',
    text: 'Within this synthetic example, what is the latest stable Orchid release today? Resolve contradictory sources. Use freshness any and the exact query: Orchid current stable release',
    script: [{ calls: [call('Orchid current stable release')] }, { text: ['The synthetic official release notice establishes Orchid 8.2 as stable on 2026-11-10 [2]. The older 7.9 listing describes an earlier state [1].'] }],
    assert: r => [...grounded(r), ...fixtureDisclosure(r.text),
      ...(!/8\.2/.test(r.text) ? ['new authoritative release omitted'] : []),
      ...(/(?:latest|current)[^.\n]{0,30}7\.9|7\.9[^.\n]{0,30}(?:is|remains) (?:the )?(?:latest|current)/i.test(r.text) ? ['stale latest conclusion'] : []),
      ...(!r.evidence?.citations.some(c => r.evidence?.sources.some(s => s.sourceId === c.sourceId && /release\/8\.2/.test(s.url))) ? ['new primary evidence not cited'] : [])] },
  { id: 'R2', priority: 'P0', cassette: 'R2',
    setup: repo => repo.seedFixtures([{ title: '[Demo] Pine subscription', user: '[Demo] Pine subscription price?', assistant: '[Demo] Pine costs $25 monthly [1].',
      now: new Date('2026-11-03T08:00Z'), timezone: 'Asia/Kolkata', sources: [{ url: 'https://pine.example/pricing', title: '[Demo] Pine pricing', excerpt: '[Synthetic] Pine costs $25 monthly.' }] }])[0].id,
    text: 'Within the synthetic evidence, compare current Aster, Birch and Cedar subscription prices, separately citing each vendor. Use these exact independent queries with freshness any: Aster pricing; Birch pricing; Cedar pricing',
    script: [{ calls: ['Aster pricing', 'Birch pricing', 'Cedar pricing'].map(call) }, { text: ['The synthetic prices are Aster at $25 monthly [2]; Birch at $35 monthly [3]; Cedar at $25 monthly [4].'] }],
    assert: r => [...grounded(r), ...fixtureDisclosure(r.text), ...mentions(r.text, ['Aster', 'Birch', 'Cedar']),
      ...(r.stats.searches !== 3 ? ['three independent product searches required'] : []),
      ...['aster', 'birch', 'cedar'].flatMap(vendor => r.evidence?.citations.some(c => r.evidence?.sources.some(s => s.sourceId === c.sourceId && new URL(s.url).hostname === `${vendor}.example`)) ? [] : [`missing vendor citation: ${vendor}`]) ] },
  { id: 'R3', priority: 'P0', cassette: 'R3',
    setup: repo => repo.seedFixtures([{ title: '[Demo] Aster observed price', user: '[Demo] Aster price?', assistant: '[Demo] Aster costs $20 monthly [1].',
      now: new Date('2026-11-03T08:00Z'), timezone: 'Asia/Kolkata', sources: [{ url: 'https://aster.example/pricing', title: '[Demo] Aster pricing', excerpt: '[Synthetic] Aster standard monthly price $20 on 2026-11-03.' }] }])[0].id,
    text: 'Within this synthetic example, recheck your earlier Aster answer. What differs between the historical and current observations? Can we date an underlying price change? Use freshness any and the exact query: Aster current pricing',
    script: [{ calls: [call('Aster current pricing')] }, { text: ['The synthetic historical Aster observation is $20 on 2026-11-03 [1]; the current observation is $25 on 2026-11-11 [2]. This is an observed difference; the evidence cannot establish when a price change occurred.'] }],
    assert: r => [...grounded(r), ...fixtureDisclosure(r.text), ...undatedChangeClaims(r),
      ...(!/observed difference/i.test(r.text) ? ['observation distinction missing'] : []),
      ...(!changeDateUncertainty(r.text) ? ['missing change-date uncertainty'] : []),
      ...(![1, 2].every(marker => r.evidence?.citations.some(c => c.marker === marker)) ? ['both observation references required'] : [])] },
];

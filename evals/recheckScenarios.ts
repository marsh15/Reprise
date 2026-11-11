import type { Scenario } from './scenarios';
import demo from '../scripts/fixtures/demo.json';
import { grounded, fixtureDisclosure, mentions, limitation, undatedChangeClaims, hasSyntheticSearchEvidence, negativeAvailability, affirmativeShipment, uncertaintyDisclosure } from './assertions';

const crms = ['HubSpot', 'Pipedrive', 'Zoho', 'Salesforce', 'Close'];
const queries = ['HubSpot Sales Hub Starter pricing', 'Pipedrive Essential pricing change', 'Zoho CRM Standard pricing', 'Salesforce Starter Suite pricing release', 'Close Startup standard pricing'];
const call = (query: string) => ({ args: JSON.stringify({ query, freshness: 'any' }) });
const seed = (key: string, sources = true) => (repo: Parameters<NonNullable<Scenario['setup']>>[0]) => {
  const row = demo.find(d => d.key === key)!;
  repo.seedFixtures([{ ...row, now: new Date(key === 'crm' ? '2026-11-09T08:00Z' : '2026-11-03T08:00Z'), timezone: 'Asia/Kolkata', sources: sources ? row.sources : [] }]);
  return undefined;
};

export const recheckScenarios: Scenario[] = [
  { id: 'C1', priority: 'P0', cassette: 'C1', setup: seed('crm'),
    text: `Has any of the five CRMs changed pricing or shipped something big since Monday? For reproducibility use these exact independent queries (freshness any): ${queries.join('; ')}`,
    script: [{ calls: queries.map(call) }, { text: [
      'Using the demo CRM discussion from 9 November:\n' +
      '- HubSpot: observed difference. The stored Starter observation was $20 per seat per month [1]; the current synthetic page shows $24 for monthly billing [6]. The historical billing commitment was not recorded, so this does not establish a price change.\n' +
      '- Pipedrive: verified change in this fixture. The vendor notice explicitly changed Essential from $15 to $18 per seat per month, effective 2026-11-10 [7].\n' +
      '- Zoho: no established change for the checked Standard price, still $14 per seat per month [8]. This is not a complete change history.\n' +
      '- Salesforce: no established price change for Starter Suite at $25 per seat monthly [9]. The feature was announced, with future availability, so I cannot say it shipped since Monday [9].\n' +
      '- Close: unable to verify a comparable change. The old $49 observation lacks discount terms [5]; the current $59 standard rate excludes introductory offers [10].',
    ] }],
    assertMemory: p => p.recalledTurns.some(t => t.origin === 'fixture' && t.userMessage.localDate === '2026-11-09' && /CRMs/i.test(t.userMessage.content) && t.sources.length === 5)
      ? [] : ['CRM baseline or historical sources missing'],
    assert: r => [...grounded(r), ...fixtureDisclosure(r.text), ...mentions(r.text, crms), ...undatedChangeClaims(r),
      ...(r.stats.searches < 3 ? ['fewer than three searches'] : []),
      // The controlled fixture supplies each category. Live pages need not prove a change.
      ...(hasSyntheticSearchEvidence(r) ? [
      ...(!/observed difference/i.test(r.text) ? ['observation distinction missing'] : []),
      ...(!/verified change|(?:one|an?) explicit (?:price )?change|a change is stated in the fixture|(?:notice|source|fixture)[^.|\n]{0,100}(?:states?|says|reports?)[^.|\n]{0,100}(?:increase|rose|change)[^.|\n]{0,100}effective/i.test(r.text) ? ['explicit change evidence not distinguished'] : []),
      ...(!/no established change|no (?:price )?change established/i.test(r.text) ? ['no-established-change category missing'] : []),
      ...(!uncertaintyDisclosure(r.text) ? ['uncertainty category missing'] : []),
      ...(!/announc/i.test(r.text) || !negativeAvailability(r.text) || affirmativeShipment(r.text) ? ['announcement treated as availability'] : [])] : [])] },
  { id: 'C2', priority: 'P0', cassette: 'C2', setup: seed('postgres', false),
    text: 'Was your Postgres hosting recommendation still accurate? Has any pricing changed since then? Use the exact search query (freshness any): Postgres hosting pricing plans units',
    script: [{ calls: [call('Postgres hosting pricing plans units')] }, { text: [
      'The demo answer listed Neon, Supabase, Amazon RDS and Railway, but has no earlier source observations. I cannot establish a change or verify that the old numbers were correct. Current synthetic sources list Neon Launch at $19 per project monthly [1], Supabase Pro at $25 per project monthly [2], Amazon RDS at $18 per instance monthly before storage [3], and Railway Hobby at $5 per workspace monthly plus usage [4]. These units and inclusions differ, so the old recommendation needs workload and usage assumptions; a flat price ranking would be misleading.',
    ] }],
    assertMemory: p => p.recalledTurns.some(t => /Postgres/.test(t.userMessage.content) && !t.sources.length) ? [] : ['source-free Postgres baseline missing'],
    assert: r => [...grounded(r), ...fixtureDisclosure(r.text), ...limitation(r.text), ...mentions(r.text, ['Neon', 'Supabase', 'RDS', 'Railway']),
      ...(!/unit|per instance|per workspace/i.test(r.text) || !/usage|workload/i.test(r.text) ? ['hosting comparability caveat missing'] : []),
      ...(/(?:prices? |pricing )(?:has |have )?(?:not changed|unchanged)|all.*still (?:correct|accurate)/i.test(r.text) ? ['unsupported unchanged claim'] : [])] },
  { id: 'C3', priority: 'P1', cassette: 'C3',
    setup: repo => repo.seedFixtures([{ title: '[Demo] Managed Postgres backups', user: '[Demo] Does the Launch plan include long backup retention?',
      assistant: '[Demo] Launch includes 30 days of backup retention, so it suits your recovery requirement [1].',
      now: new Date('2026-11-03T08:00Z'), timezone: 'Asia/Kolkata', sources: [{ url: 'https://neon.com/docs/introduction/plans', title: '[Demo] Plans',
        excerpt: '[Synthetic fixture, not a real vendor observation] Launch includes 1 day of backup retention; Scale includes 30 days. These were the terms on 2026-11-03.' }] }])[0].id,
    text: 'Is your answer still correct? Recheck the backup claim. Use the exact search query (freshness any): Neon Launch backup retention plan',
    script: [{ calls: [call('Neon Launch backup retention plan')] }, { text: [
      'My demo answer was incorrect: I attributed 30 days of backup retention to Launch. The historical source already limited Launch to 1 day and assigned 30 days to Scale [1]. The current synthetic plan documentation agrees [2]. No established change: this was an original error, not evidence of a later product change. The recommendation does not meet your recovery requirement.',
    ] }],
    assertMemory: p => p.currentConversation.some(m => /30 days/.test(m.content)) && p.carriedSources.length === 1 ? [] : ['old answer/evidence missing'],
    assert: r => [...grounded(r), ...fixtureDisclosure(r.text),
      ...(!/incorrect|wrong|inaccurate|no longer/i.test(r.text) ? ['incorrect historical answer not corrected'] : []),
      ...(!/original error|already|at the time|never (?:correct|included)/i.test(r.text) ? ['original error not distinguished from later change'] : []),
      ...(/(?:vendor|Launch|Neon) (?:has )?(?:changed|reduced|dropped)/i.test(r.text) ? ['original error presented as vendor change'] : [])] },
];

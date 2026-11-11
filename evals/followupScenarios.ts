import type { Scenario } from './scenarios';

const fixture = (title: string, user: string, assistant: string, date: string) => ({
  title: `[Demo] ${title}`, user: `[Demo] ${user}`, assistant: `[Demo] ${assistant}`,
  now: new Date(`${date}T08:00:00Z`), timezone: 'Asia/Kolkata', sources: [],
});
const complete: Scenario['assert'] = r => r.status === 'complete' ? [] : ['turn incomplete'];
const noSearch: Scenario['assert'] = r => [...complete(r), ...(r.stats.searches ? ['unexpected search'] : [])];
const demo = (text: string) => /demo|fixture|synthetic/i.test(text);
const dates = (text: string, day: string) => new RegExp(`(?:${day}\\s*(?:Nov|November)|(?:Nov|November)\\s*${day}|2026-11-${day})`, 'i').test(text);
const query = 'HubSpot Sales Hub and Pipedrive CRM pricing per seat billing';
const call = { args: JSON.stringify({ query, freshness: 'any' }) };

export const followupScenarios: Scenario[] = [
  { id: 'B2', priority: 'P1', text: 'What did I ask on 3 November about Kubernetes?', cassette: 'E1',
    setup: repo => { repo.seedFixtures([
      fixture('Postgres hosting', 'Compare Postgres hosting.', 'Neon and Supabase are options.', '2026-11-03'),
      fixture('Node versus Bun', 'Node versus Bun for an API?', 'Consider compatibility.', '2026-11-03'),
      fixture('Weekend', 'Weekend plans?', 'Take a walk.', '2026-11-04'),
    ]); return undefined; },
    script: [{ text: ['The demo records contain no Kubernetes discussion on 3 November. They cover Postgres hosting and Node versus Bun.'] }],
    assert: r => [...noSearch(r), ...(!demo(r.text) ? ['fixture not acknowledged'] : []),
      ...(!/(?:no|not|never|absent|could not find|couldn't find|no record)[^.\n]{0,100}kubernetes|kubernetes[^.\n]{0,100}(?:not|no record|absent|wasn.t discussed)/i.test(r.text) ? ['missing Kubernetes abstention'] : []),
      ...(!/postgres/i.test(r.text) || !/node/i.test(r.text) || !/bun/i.test(r.text) ? ['missing recorded topics'] : [])],
    assertMemory: p => p.recalledTurns.length === 2 && p.recalledTurns.every(t => t.origin === 'fixture' && t.userMessage.localDate === '2026-11-03') &&
      p.recalledTurns.some(t => /postgres/i.test(t.userMessage.content)) && p.recalledTurns.some(t => /node.*bun/i.test(t.userMessage.content))
      ? [] : ['wrong date or topics in recall'] },
  { id: 'H2', priority: 'P1', text: 'Last Tuesday I asked about Postgres hosting — what did you say?', cassette: 'E1',
    setup: repo => { repo.seedFixtures([
      fixture('Older Postgres', 'Compare Postgres hosting.', 'The older demo answer mentioned Neon.', '2026-11-03'),
      fixture('Recent Postgres', 'Compare Postgres hosting.', 'The newer demo answer mentioned Supabase.', '2026-11-10'),
    ]); return undefined; },
    script: [{ text: ['Assuming 10 November, the demo answer mentioned Supabase. Postgres was also discussed on 3 November.'] }],
    assert: r => [...noSearch(r), ...(!demo(r.text) ? ['fixture not acknowledged'] : []),
      ...(!dates(r.text, '10') || !dates(r.text, '3') ? ['both Tuesday dates required'] : []),
      ...(!/supabase/i.test(r.text) ? ['missing newer answer'] : [])],
    assertMemory: p => p.resolutions[0]?.chosen === '2026-11-10' && p.recalledTurns.some(t => t.userMessage.localDate === '2026-11-10' && /supabase/i.test(t.assistantMessage?.content ?? '')) &&
      /2026-11-03|3 Nov/i.test(JSON.stringify(p.resolutions[0])) ? [] : ['wrong Tuesday selection or missing alternative'] },
  { id: 'J1', priority: 'P1', text: `Which of those is cheaper for 20 seats? Use freshness any and the exact search query: ${query}`, cassette: 'J1',
    setup: repo => repo.seedFixtures([{ ...fixture('CRM shortlist', 'Compare HubSpot Sales Hub and Pipedrive CRM.', 'The demo shortlist is HubSpot and Pipedrive [1].', '2026-11-09'),
      sources: [{ url: 'https://www.hubspot.com/products/sales', title: '[Demo] CRM shortlist', excerpt: '[Synthetic fixture, no real observation] HubSpot and Pipedrive were shortlisted.' }] }])[0].id,
    history: [{ user: 'Keep those two CRMs on the shortlist.', assistant: 'The demo shortlist contains HubSpot and Pipedrive.' }],
    script: [{ calls: [call] }, { text: ['The demo shortlist contains HubSpot and Pipedrive [1]. The synthetic fixture lists HubSpot at $20 per seat monthly [2] and Pipedrive at $15 per seat per month billed annually [3]. These billing terms differ, so the prices are not like-for-like for 20 seats.'] }],
    assert: r => [...complete(r), ...(!demo(r.text) ? ['fixture not acknowledged'] : []),
      ...(!/hubspot/i.test(r.text) || !/pipedrive/i.test(r.text) ? ['missing CRM name'] : []),
      ...(!/annual/i.test(r.text) || !/month/i.test(r.text) || !/differ|not (?:directly |like.for.like|comparable)|cannot compare|can.t compare/i.test(r.text) ? ['billing comparability caveat missing'] : []),
      ...(!r.stats.searches ? ['missing search'] : []),
      ...(!r.evidence?.citations.some(c => c.state === 'verified') || r.evidence.citations.some(c => c.state === 'invalid' || c.state === 'unverified') ? ['missing verified or invalid/unverified citation'] : []),
      ...(r.evidence?.sources[0]?.fixture && /shortlist/i.test(r.evidence.sources[0].title ?? '') && r.evidence.sources.slice(1).some(s => /pricing/i.test(s.title ?? '')) ? [] : ['historical source must precede search sources'])],
    assertMemory: p => p.currentConversation.some(m => /hubspot/i.test(m.content ?? '') && /pipedrive/i.test(m.content ?? '')) && p.carriedSources.some(s => s.fixture) ? [] : ['CRM chat or historical source missing'] },
  { id: 'J2', priority: 'P1', text: 'Which CRM did I settle on?', cassette: 'E1',
    history: [{ user: 'For this demo I chose Copper as the CRM.', assistant: 'The demo choice is Copper.' },
      { user: 'Correction: I chose Close, not Copper.', assistant: 'Understood: the demo choice is Close.' }],
    script: [{ text: ['In this demo you corrected the choice to Close; the earlier choice was Copper.'] }],
    assert: r => [...noSearch(r), ...(!demo(r.text) ? ['fixture not acknowledged'] : []),
      ...(!/close/i.test(r.text) || !/correct|instead|rather|updated|later/i.test(r.text) ? ['corrected choice missing'] : []),
      ...(/(?:chose|selected|settled on|choice is)\s+copper\b/i.test(r.text) && !/(?:not|rather than)\s+copper/i.test(r.text) ? ['old choice presented as current'] : []),
      ...(/\b(?:price|\$\d|previously recommended|last year)\b/i.test(r.text) ? ['unsupported historical claim'] : [])],
    assertMemory: p => { const messages = p.currentConversation.filter(m => m.role === 'user');
      return messages.length >= 2 && /copper/i.test(messages[0].content) && /correction.*close/i.test(messages[1].content) ? [] : ['correction history missing or out of order']; } },
];

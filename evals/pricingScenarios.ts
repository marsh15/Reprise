import { affirmativeShipment } from './assertions';
import type { Scenario } from './scenarios';

const queries = {
  K2: 'Aster and Birch subscription pricing currencies',
  K3: 'Cedar and Dune subscription pricing billing terms',
  T1: 'Example Atlas feature announcement rollout',
};
const call = (query: string) => ({ args: JSON.stringify({ query, freshness: 'any' }) });
const demo = (text: string) => /demo|fixture|synthetic/i.test(text);
const date = (text: string, iso: string, month: string, day: string) =>
  new RegExp(`${iso}|${day}\\s+${month}|${month}\\s+${day}`, 'i').test(text);
const grounded: Scenario['assert'] = r => [
  ...(r.status !== 'complete' ? ['turn incomplete'] : []),
  ...(!r.stats.searches ? ['missing search'] : []),
  ...(!demo(r.text) ? ['fixture not acknowledged'] : []),
  ...(!r.evidence?.citations.some(c => c.state === 'verified') ? ['missing verified citation'] : []),
  ...(r.evidence?.citations.some(c => c.state === 'invalid' || c.state === 'unverified') ? ['invalid or unverified citation'] : []),
];
const emptyMemory: NonNullable<Scenario['assertMemory']> = p =>
  p.recalledTurns.length === 0 && p.carriedSources.length === 0 ? [] : ['unexpected historical evidence'];

export const pricingScenarios: Scenario[] = [
  { id: 'K2', priority: 'P1', cassette: 'K2',
    text: `In this demo, which subscription is cheapest? Use the exact search query: ${queries.K2} and freshness any.`,
    script: [{ calls: [call(queries.K2)] }, { text: ['The synthetic fixture lists Aster at $20 USD per month [1] and Birch at €18 EUR per month [2]. The currencies differ and no exchange rate is supplied, so I cannot convert or rank them.'] }],
    assert: r => [...grounded(r),
      ...(!/aster/i.test(r.text) || !/birch/i.test(r.text) ? ['missing offer'] : []),
      ...(!/(?:usd|\$)/i.test(r.text) || !/(?:eur|€)/i.test(r.text) ? ['currency distinction missing'] : []),
      ...(!/(?:cannot|can.t|unable to|no|without)[^.\n]{0,100}(?:convert|exchange rate|rank|compar)/i.test(r.text) ? ['missing conversion or ranking limitation'] : []),
      ...(/\b(?:aster|birch)\s+is\s+(?:the\s+)?(?:cheapest|cheaper)\b/i.test(r.text) ? ['unsupported cheapest conclusion'] : [])],
    assertMemory: emptyMemory },
  { id: 'K3', priority: 'P1', cassette: 'K3',
    text: `In this demo, are these subscription prices equivalent? Use the exact search query: ${queries.K3} and freshness any.`,
    script: [{ calls: [call(queries.K3)] }, { text: ['The synthetic Cedar offer is $10 per user per month equivalent, billed annually, as an introductory rate; its standard rate is $15 [1]. Dune is $40 per month flat with a minimum of 5 seats [2]. The units, commitment and introductory terms differ, so these are not equivalent.'] }],
    assert: r => [...grounded(r),
      ...(!/cedar/i.test(r.text) || !/dune/i.test(r.text) ? ['missing offer'] : []),
      ...(!/per (?:user|seat)/i.test(r.text) || !/flat/i.test(r.text) ? ['price units missing'] : []),
      ...(!/annual/i.test(r.text) || !/month/i.test(r.text) ? ['billing commitment missing'] : []),
      ...(!/introductory|intro|promotion|discount/i.test(r.text) || !/standard|regular/i.test(r.text) ? ['introductory or standard rate missing'] : []),
      ...(!/minimum|min\.?/i.test(r.text) || !/\b5\b|five/i.test(r.text) ? ['minimum seats missing'] : []),
      ...(!/not equivalent|not (?:directly |like.for.like )?comparable|differ/i.test(r.text) ? ['comparability caveat missing'] : []),
      ...(/\b(?:are|prices are)\s+(?:exactly\s+)?(?:equivalent|identical|the same)\b/i.test(r.text) ? ['false equivalence'] : [])],
    assertMemory: emptyMemory },
  { id: 'T1', priority: 'P1', cassette: 'T1',
    text: `Since our 9 November demo discussion, has Example Atlas shipped? Use the exact search query: ${queries.T1} and freshness any.`,
    setup: repo => repo.seedFixtures([{ title: '[Demo] Atlas discussion', user: '[Demo] Tell me about the planned Example Atlas feature.',
      assistant: '[Demo] Atlas was discussed as a planned feature [1].', now: new Date('2026-11-09T08:00:00Z'), timezone: 'Asia/Kolkata',
      sources: [{ url: 'https://example.com/atlas-discussion', title: '[Demo] Atlas discussion', excerpt: '[Synthetic fixture, no real observation] Atlas was discussed as a planned feature on 9 November 2026.' }] }])[0].id,
    script: [{ calls: [call(queries.T1)] }, { text: ['In the demo discussion on 9 November 2026 Atlas was planned [1]. The synthetic official announcement was published 10 November 2026 and says rollout begins 1 December 2026 [2]. Retrieved 11 November 2026, it announces a future rollout, so we cannot establish current availability from this evidence.'] }],
    assert: r => [...grounded(r),
      ...(!date(r.text, '2026-11-09', 'Nov(?:ember)?', '9') || !date(r.text, '2026-11-10', 'Nov(?:ember)?', '10') ||
        !date(r.text, '2026-11-11', 'Nov(?:ember)?', '11') || !date(r.text, '2026-12-01', 'Dec(?:ember)?', '1') ? ['discussion, publication, retrieval and rollout dates required'] : []),
      ...(!/announc/i.test(r.text) || !/publish/i.test(r.text) || !/retriev/i.test(r.text) || !/rollout|roll.out/i.test(r.text) ? ['temporal roles missing'] : []),
      ...(!/(?:not|rather than|does not|doesn.t|cannot|can.t|future)[^.\n]{0,100}(?:available|availability|shipped|rollout)/i.test(r.text) ? ['announcement versus availability distinction missing'] : []),
      ...(affirmativeShipment(r.text) ? ['unsupported shipped claim'] : []),
      ...(r.evidence?.sources[0]?.fixture && /discussion/i.test(r.evidence.sources[0].title ?? '') && /announcement/i.test(r.evidence.sources[1]?.title ?? '') ? [] : ['historical source must precede announcement'])],
    assertMemory: p => p.recalledTurns.some(t => t.origin === 'fixture' && t.userMessage.localDate === '2026-11-09' && /atlas/i.test(t.userMessage.content)) &&
      p.carriedSources.some(s => s.fixture && /discussion/i.test(s.title ?? '')) ? [] : ['dated fixture discussion or source missing'] },
];

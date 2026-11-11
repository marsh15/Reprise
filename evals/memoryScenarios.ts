import type { Scenario } from './scenarios';
import { seedDemo } from '../scripts/seed-demo';
const noSearch = (r: Parameters<Scenario['assert']>[0]) => [
  ...(r.status !== 'complete' ? ['turn incomplete'] : []), ...(r.stats.searches ? ['unexpected memory search'] : []),
];
export const memoryScenarios: Scenario[] = [
  { id: 'A1', priority: 'P0', text: 'What was the first thing I asked today?', cassette: 'E1',
    history: [{ user: 'What does Neon pricing look like?', assistant: 'We discussed Neon pricing.' },
      { user: 'Tell me a joke.', assistant: 'A brief joke.' }, { user: 'What is a palindrome?', assistant: 'A word reading the same both ways.' }],
    script: [{ text: ['In the demo history, you first asked about Neon pricing today.'] }],
    assert: r => [...noSearch(r), ...(!/Neon/i.test(r.text) ? ['missing first topic Neon'] : [])],
    assertMemory: p => p.recalledTurns.some(t => /Neon/.test(t.userMessage.content)) ? [] : ['first turn absent from recall'] },
  { id: 'B1', priority: 'P0', text: 'What did I ask you on 3 November?', cassette: 'E1',
    setup: repo => {
      repo.seedFixtures([
        { title: '[Demo] Postgres hosting', user: '[Demo] Compare Postgres hosting.', assistant: '[Demo] Neon and Supabase.', now: new Date('2026-11-03T08:00Z'), timezone: 'Asia/Kolkata', sources: [] },
        { title: '[Demo] Node versus Bun', user: '[Demo] Node versus Bun for an API?', assistant: '[Demo] Prefer compatibility.', now: new Date('2026-11-03T09:00Z'), timezone: 'Asia/Kolkata', sources: [] },
        { title: '[Demo] Weekend', user: '[Demo] Weekend plans?', assistant: '[Demo] Take a walk.', now: new Date('2026-11-04T08:00Z'), timezone: 'Asia/Kolkata', sources: [] },
      ]);
      return undefined;
    }, script: [{ text: ['On 3 November the demo conversations covered Postgres hosting and Node versus Bun.'] }],
    assert: r => [...noSearch(r), ...(!/Postgres/i.test(r.text) || !/Node.*Bun/is.test(r.text) ? ['missing one of the recorded topics'] : [])],
    assertMemory: p => p.recalledTurns.length === 2 && p.recalledTurns.every(t => t.userMessage.localDate === '2026-11-03') ? [] : ['wrong date turns'] },
  { id: 'F2', priority: 'P0', text: 'Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then? If researching current prices, use the exact query: Postgres hosting current pricing', cassette: 'F2',
    script: [{ calls: [{ args: '{"query":"Postgres hosting current pricing","freshness":"any"}' }] },
      { text: ["I have no record of that past conversation; history starts on 2026-11-11. Current demo pricing shows Supabase Pro at $25 per project per month [1]. I cannot establish a change without historical evidence."] }],
    assert: r => [...(r.status !== 'complete' ? ['turn incomplete'] : []), ...(!/no record|don't have|no (earlier|previous) conversation/i.test(r.text) ? ['missing no-record disclosure'] : []),
      ...(!/cannot establish|can't establish|no historical|without historical/i.test(r.text) ? ['historical baseline limitation missing'] : []),
      ...(!r.evidence?.citations.length || r.evidence.citations.some(c => c.state === 'invalid') ? ['current pricing needs valid citations'] : []),
      ...(/(?:I|we) (?:previously )?(?:recommended|told you|discussed)|you (?:asked|said).*\$\d/i.test(r.text) ? ['possible invented past answer'] : [])],
    assertMemory: p => p.recalledTurns.length === 0 && p.resolutions[0].chosen === null ? [] : ['invented historical recall'] },
  { id: 'H1', priority: 'P0', text: 'Last Tuesday I asked about Postgres hosting — what did you say?', cassette: 'E1',
    setup: repo => { seedDemo(repo, new Date('2026-11-11T08:30Z'), 'Asia/Kolkata'); return undefined; },
    script: [{ text: ['Assuming Tue 3 Nov, the Tuesday with the Postgres demo conversation, the illustrative options were Neon, Supabase, RDS and Railway.'] }],
    assert: r => [...noSearch(r), ...(!/3 Nov|November 3/.test(r.text) ? ['missing date assumption'] : []), ...(!/demo|fixture/i.test(r.text) ? ['fixture not acknowledged'] : [])],
    assertMemory: p => p.resolutions[0].chosen === '2026-11-03' && p.recalledTurns.some(t => /Postgres/.test(t.userMessage.content)) ? [] : ['wrong Tuesday selection'] },
];

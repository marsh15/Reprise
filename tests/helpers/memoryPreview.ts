import { createServer } from 'node:http';
import { getRequestListener } from '@hono/node-server';
import { createServer as createViteServer } from 'vite';
import { createApp } from '../../src/server/app';
import { parseConfig } from '../../src/server/config';
import { createClock } from '../../src/server/clock';
import { openDatabase } from '../../src/server/db/db';
import { createRepo } from '../../src/server/db/repo';
import { createTurnService } from '../../src/server/turns/service';
import { createRunTurn } from '../../src/server/agent/runTurn';
import { scriptedLlm } from './fakeLlm';
import { seedDemo } from '../../scripts/seed-demo';
const config = parseConfig({ LLM_API_KEY: 'fake', TAVILY_API_KEY: 'fake' });
const clock = createClock('2026-11-11T08:30:00Z');
const store = openDatabase(':memory:'); const repo = createRepo(store);
seedDemo(repo, clock.now(), 'Asia/Kolkata');
const turns = createTurnService(repo, input => {
  const research = /changed|current/i.test(input.userText);
  const urls = [...new Set([...input.packet.recalledTurns.flatMap(t => t.sources), ...input.packet.carriedSources].map(s => s.url))];
  const freshMarker = urls.includes('https://example.com/current') ? urls.indexOf('https://example.com/current') + 1 : urls.length + 1;
  const fake = scriptedLlm(research ? [{ calls: [{ args: '{"query":"pricing","freshness":"any"}' }] },
    { text: [`Demo history is recorded on 3 November. Current illustrative evidence: $95 [${freshMarker}].`], delay: 80 }]
    : [{ text: ['Using the demo conversation on Tue 3 Nov: the recorded Postgres options were Neon, Supabase, RDS and Railway.'], delay: 80 }]);
  return createRunTurn(fake.llm, config, { now: clock.now, search: async () => ({ status: 'ok', durationMs: 100, results: [{ url: 'https://example.com/current', title: '[Demo] current evidence', content: '[Demo] Current illustrative price $95.', publishedAt: null, fixture: true }] }) })(input);
}, clock, 'browser-fake-only');
const server = createServer();
const vite = await createViteServer({ server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
const api = getRequestListener(createApp(config, clock, { repo, turns }).fetch);
server.on('request', (req, res) => { if (req.url?.startsWith('/api/')) void api(req, res); else vite.middlewares(req, res); });
server.listen(5173, '127.0.0.1', () => console.log('Memory browser fixture ready at http://localhost:5173'));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { server.close(); void turns.shutdown().then(() => vite.close()).then(() => store.close()); });

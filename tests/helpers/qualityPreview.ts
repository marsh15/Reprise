// Offline browser fixture: real API, agent loop and SQLite; scripted providers only.
import { createServer } from 'node:http';
import { getRequestListener } from '@hono/node-server';
import { createServer as createViteServer } from 'vite';
import { createApp } from '../../src/server/app';
import { createGuard } from '../../src/server/requestPolicy';
import { parseConfig } from '../../src/server/config';
import { createClock } from '../../src/server/clock';
import { openDatabase } from '../../src/server/db/db';
import { createRepo } from '../../src/server/db/repo';
import { createTurnService } from '../../src/server/turns/service';
import { createRunTurn } from '../../src/server/agent/runTurn';
import { scriptedLlm } from './fakeLlm';
const config = parseConfig({ LLM_API_KEY: 'fake', TAVILY_API_KEY: 'fake' });
const clock = createClock('2026-11-11T08:30:00Z');
const store = openDatabase(':memory:'); const repo = createRepo(store);
const turns = createTurnService(repo, input => {
  const slow = /slow/i.test(input.userText);
  const research = /research|quota|auth|empty/i.test(input.userText);
  const failure = /fail/i.test(input.userText);
  const steps = research ? [{ calls: [{ args: '{"query":"Fixture pricing","freshness":"any"}' }] },
    { text: /quota|auth/.test(input.userText) ? ['Search is unavailable. I could not verify current pricing.'] : /empty/.test(input.userText) ? ['No results were found. I could not verify current pricing.'] : ['This is illustrative evidence, not real pricing. ', 'The fixture costs $95 [1]. Unsupported $99 [1]. Unknown [99].\n\n| Item | Price |\n|---|---|\n| Fixture | $95 [1] |'], delay: slow ? 1200 : 150 }]
    : [{ text: ['This is a scripted browser answer. ', 'It is saved locally. ', 'You can follow up or start another conversation.'], delay: slow ? 1200 : 80, fail: failure }];
  return createRunTurn(scriptedLlm(steps).llm, config, { now: clock.now, search: async (_request, signal) => {
    await new Promise(resolve => setTimeout(resolve, slow ? 5000 : 500)); signal.throwIfAborted();
    const error = /quota/.test(input.userText) ? 'quota' : /auth/.test(input.userText) ? 'auth' : undefined;
    return { status: error ? 'error' : /empty/.test(input.userText) ? 'empty' : 'ok', durationMs: 500, error,
      results: error || /empty/.test(input.userText) ? [] : [{ url: 'https://example.com/pricing', title: '[Demo] pricing observation', content: '[Demo] Costs $95.', publishedAt: '2026-11-10', retrievedAt: input.packet.carriedSources.length ? clock.now().toISOString() : '2026-11-10T08:30:00Z', fixture: true }] };
  } })(input);
}, clock, 'scripted-browser-only');
const server = createServer();
const vite = await createViteServer({ server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
const api = getRequestListener(createApp(config, clock, { repo, turns }).fetch);
const admitted = createGuard(5173);
server.on('request', (req, res) => { if (!admitted(req, res)) return; if (req.url?.startsWith('/api/')) void api(req, res); else vite.middlewares(req, res); });
server.listen(5173, '127.0.0.1', () => console.log('Quality fixture ready at http://localhost:5173'));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { server.close(); void turns.shutdown().then(() => vite.close()).then(() => store.close()); });

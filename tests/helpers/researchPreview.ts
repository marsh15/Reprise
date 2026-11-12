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
import type { Search } from '../../src/shared/research';
const config = parseConfig({ LLM_API_KEY: 'fake', TAVILY_API_KEY: 'fake' });
const clock = createClock('2026-11-11T08:30:00Z');
const store = openDatabase(':memory:'); const repo = createRepo(store);
const search: Search = async (request, signal) => {
  await new Promise(resolve => setTimeout(resolve, 350)); signal.throwIfAborted();
  return { status: 'ok', durationMs: 350, results: [{ url: request.query === 'price' ? 'https://example.com/pricing' : 'https://example.org/releases', title: `Fixture ${request.query}`, content: 'Demo fixture: price $90. Released 12 November 2026.', publishedAt: '2026-11-12', fixture: true }] };
};
const turns = createTurnService(repo, input => {
  const llm = scriptedLlm([{ text: ['Draft that must disappear'], calls: ['price', 'release'].map(query => ({ args: JSON.stringify({ query, freshness: 'any' }) })) },
    { text: ['The fixture costs $90 [1]. ', 'The unsupported price $99 [2] needs checking. ', 'Unknown source [99].\n\n`code [1]`'], delay: 100 }]).llm;
  return createRunTurn(llm, config, { search, now: clock.now })(input);
}, clock, 'scripted-browser-fixture');
const server = createServer();
const vite = await createViteServer({ server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
const api = getRequestListener(createApp(config, clock, { repo, turns }).fetch);
const admitted = createGuard(5173);
server.on('request', (req, res) => { if (!admitted(req, res)) return; if (req.url?.startsWith('/api/')) void api(req, res); else vite.middlewares(req, res); });
server.listen(5173, '127.0.0.1', () => console.log('Research fixture ready at http://localhost:5173'));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { server.close(); void turns.shutdown().then(() => vite.close()).then(() => store.close()); });

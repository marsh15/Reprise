import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { getRequestListener } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { createApp } from './app';
import { loadConfig } from './config';
import { createClock } from './clock';
import { createLogger } from './log';
import { openDatabase } from './db/db';
import { createRepo } from './db/repo';
import { createLlm } from './llm/client';
import { createRunTurn } from './agent/runTurn';
import { createTurnService } from './turns/service';

async function main() {
  const config = loadConfig();
  const clock = createClock(config.REPRISE_NOW);
  const log = createLogger(clock, config.LOG_LEVEL);
  const store = openDatabase(config.REPRISE_DB_PATH);
  const repo = createRepo(store);
  const turns = createTurnService(repo, createRunTurn(createLlm(config), config), clock, config.LLM_MODEL);
  const apiListener = getRequestListener(createApp(config, clock, { repo, turns }).fetch);
  const production = process.env.NODE_ENV === 'production';
  const httpServer = createServer();
  let vite: import('vite').ViteDevServer | undefined;

  if (production) {
    if (!existsSync('dist/index.html')) throw new Error('Build the client first: npm run build.');
    const web = new Hono();
    web.use('*', serveStatic({ root: './dist' }));
    web.use('*', async (c, next) => {
      if (!c.req.header('accept')?.includes('text/html')) return c.notFound();
      await serveStatic({ path: './dist/index.html' })(c, next);
      return c.res;
    });
    const webListener = getRequestListener(web.fetch);
    httpServer.on('request', (req, res) => {
      if (isApi(req.url)) void apiListener(req, res);
      else void webListener(req, res);
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server: httpServer } },
      appType: 'spa',
    });
    httpServer.on('request', (req, res) => {
      if (isApi(req.url)) void apiListener(req, res);
      else vite!.middlewares(req, res);
    });
  }

  httpServer.on('error', (error: NodeJS.ErrnoException) => {
    log('error', 'server.failed', {
      code: error.code,
      message: error.code === 'EADDRINUSE' ? `Port ${config.PORT} is in use. Stop the other server or change PORT in .env.` : 'HTTP server failed.',
    });
    void vite?.close();
    void turns.shutdown().then(() => store.close());
    process.exitCode = 1;
  });
  httpServer.listen(config.PORT, '127.0.0.1', () => {
    log('info', 'server.listening', { url: `http://localhost:${config.PORT}` });
    if (clock.isOverridden()) {
      log('warn', 'clock.overridden', { message: 'Test clock active. Unset REPRISE_NOW for real conversations.', now: clock.now().toISOString() });
    }
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      httpServer.close();
      void turns.shutdown().then(async () => {
        await vite?.close();
        store.close();
      });
    });
  }
}

function isApi(url = '/') {
  const path = url.split('?')[0];
  return path === '/api' || path.startsWith('/api/');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Could not start Reprise.');
  process.exitCode = 1;
});

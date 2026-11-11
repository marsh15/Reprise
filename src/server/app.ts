import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { turnRequestSchema } from '../shared/types';
import type { Repo } from './db/repo';
import { TurnError, type TurnService } from './turns/service';
import type { Config } from './config';
import type { Clock } from './clock';

export function createApp(config: Config, clock: Clock, services?: { repo: Repo; turns: TurnService }) {
  const app = new Hono();

  app.get('/api/health', (c) => c.json({
    ok: true,
    model: config.LLM_MODEL,
    searchProvider: 'tavily',
    clockOverridden: clock.isOverridden(),
    now: clock.now().toISOString(),
  }));

  if (services) {
    const { repo, turns } = services;
    const validId = (id: string) => z.uuid().safeParse(id).success;
    app.get('/api/conversations', c => c.json({ conversations: repo.listConversations() }));
    app.get('/api/conversations/:id', c => {
      const id = c.req.param('id');
      const conversation = validId(id) ? repo.getConversation(id) : undefined;
      if (!conversation) return c.json({ error: { code: 'not_found', message: 'Conversation not found.', retryable: false } }, 404);
      return c.json({ conversation, messages: repo.getConversationMessages(id) });
    });
    app.delete('/api/conversations/:id', async c => {
      const id = c.req.param('id');
      if (!validId(id) || !repo.getConversation(id)) return c.json({ error: { code: 'not_found', message: 'Conversation not found.', retryable: false } }, 404);
      await turns.deleteConversation(id);
      return c.body(null, 204);
    });
    app.post('/api/conversations/:id/cancel', c => {
      if (!turns.cancel(c.req.param('id'))) return c.json({ error: { code: 'not_found', message: 'No answer is running.', retryable: false } }, 404);
      return c.body(null, 202);
    });
    app.post('/api/turns', async c => {
      let body: unknown;
      try { body = await c.req.json(); } catch { return c.json({ error: { code: 'invalid_request', message: 'Expected a JSON request body.', retryable: false } }, 400); }
      const parsed = turnRequestSchema.safeParse(body);
      if (!parsed.success) return c.json({ error: { code: 'invalid_request', message: 'Supply a request id, 1–8000 characters, and a timezone.', retryable: false } }, 400);
      try { new Intl.DateTimeFormat('en', { timeZone: parsed.data.timezone }); }
      catch { return c.json({ error: { code: 'invalid_timezone', message: 'Supply a valid IANA timezone.', retryable: false } }, 400); }
      const turn = turns.prepare(parsed.data);
      c.header('Cache-Control', 'no-cache, no-transform');
      c.header('X-Accel-Buffering', 'no');
      return streamSSE(c, async stream => {
        const abort = () => turn.abort();
        stream.onAbort(abort);
        c.req.raw.signal.addEventListener('abort', abort, { once: true });
        if (c.req.raw.signal.aborted) abort();
        const heartbeat = setInterval(() => { void stream.write(': ping\n\n').catch(abort); }, 15_000);
        try {
          await turn.run(async event => {
            const { type, ...payload } = event;
            await stream.writeSSE({ event: type, data: JSON.stringify(payload) });
          });
        } finally {
          clearInterval(heartbeat);
          c.req.raw.signal.removeEventListener('abort', abort);
        }
      });
    });
  }

  app.notFound((c) => c.json({
    error: { code: 'not_found', message: 'API route not found.', retryable: false },
  }, 404));
  app.onError((error, c) => {
    if (error instanceof TurnError) return c.json({ error: { code: error.code, message: error.message, retryable: error.status === 409 } }, error.status);
    return c.json({
    error: { code: 'internal', message: 'An internal error occurred.', retryable: true },
  }, 500);
  });
  return app;
}

import { createServer } from 'node:http';

// Test-only OpenAI-compatible endpoint. No production code can enable it.
export async function startFakeProvider() {
  const requests: Record<string, unknown>[] = [];
  let disconnects = 0;
  const server = createServer(async (req, res) => {
    const buffers: Buffer[] = [];
    for await (const chunk of req) buffers.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(buffers).toString()); requests.push(body);
    const text = String(body.messages?.at(-1)?.content ?? '');
    if (text.includes('provider-failure')) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end('{"error":{"message":"fixture rejection"}}'); return; }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const slow = text.toLowerCase().includes('slow');
    const parts = slow ? Array.from({ length: 60 }, (_, i) => `word${i} `) : ['This is a **mocked** ', 'streaming answer.'];
    let index = 0;
    const timer = setInterval(() => {
      if (index < parts.length) res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: parts[index++] }, finish_reason: null }] })}\n\n`);
      else {
        clearInterval(timer);
        res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`);
        res.write(`data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 } })}\n\ndata: [DONE]\n\n`);
        res.end();
      }
    }, slow ? 100 : 10);
    res.on('close', () => { clearInterval(timer); if (index < parts.length) disconnects++; });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing provider port');
  return { server, url: `http://127.0.0.1:${address.port}/v1`, requests, disconnects: () => disconnects,
    close: () => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }) };
}

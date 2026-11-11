import { expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { startFakeProvider } from '../helpers/fakeProvider';
import { readEvents } from '../../src/client/api';
import type { TurnEvent } from '../../src/shared/types';

it('runs the real process, aborts on socket loss, persists across restart, and serves the SPA', async () => {
  const provider = await startFakeProvider();
  const dir = mkdtempSync(join(tmpdir(), 'reprise-server-'));
  const reserve = createServer(); await new Promise<void>(resolve => reserve.listen(0, '127.0.0.1', resolve));
  const address = reserve.address(); if (!address || typeof address === 'string') throw new Error('port');
  const port = address.port; await new Promise<void>(resolve => reserve.close(() => resolve()));
  const url = `http://127.0.0.1:${port}`;
  let child: ChildProcess | undefined;
  async function start() {
    child = spawn(process.execPath, ['--import', 'tsx', 'src/server/main.ts'], { env: { ...process.env,
      LLM_API_KEY: 'fake', TAVILY_API_KEY: 'fake', LLM_BASE_URL: provider.url, PORT: String(port),
      REPRISE_DB_PATH: join(dir, 'reprise.db'), NODE_ENV: process.env.REPRISE_TEST_PRODUCTION ? 'production' : 'test', REPRISE_NOW: '2026-11-11T20:00:00Z' }, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise<void>((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => reject(new Error(`Server startup timed out: ${output}`)), 8_000);
      const capture = (data: Buffer) => {
        output += String(data);
        if (output.includes('server.listening')) { clearTimeout(timeout); resolve(); }
      };
      child!.stdout?.on('data', capture); child!.stderr?.on('data', capture);
      child!.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited ${code}: ${output}`)); });
    });
  }
  async function stop() {
    if (!child || child.exitCode !== null) return;
    const exited = new Promise<void>(resolve => child!.once('exit', () => resolve()));
    child.kill('SIGTERM'); await exited;
  }
  async function post(text: string) {
    return fetch(`${url}/api/turns`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientMessageId: randomUUID(), text, timezone: 'Asia/Kolkata' }) });
  }
  async function list() { return (await (await fetch(`${url}/api/conversations`)).json()).conversations as { id: string }[]; }
  async function messages(id: string) { return (await (await fetch(`${url}/api/conversations/${id}`)).json()).messages as { content: string; status: string }[]; }
  try {
    await start();
    expect(await (await fetch(url)).text()).toContain('<div id="root">');
    await readEvents((await post('normal')).body!, () => {});
    const slow = await post('slow answer'); let conversationId = '';
    // Cancel the actual response reader after receiving one provider delta.
    const reader = slow.body!.getReader(); const decoder = new TextDecoder(); let received = '';
    while (!received.includes('event: answer.delta')) { const chunk = await reader.read(); received += decoder.decode(chunk.value); }
    const started = received.match(/data: (\{[^\n]+\})/)!;
    conversationId = JSON.parse(started[1]).conversationId;
    await reader.cancel();
    await waitFor(async () => (await messages(conversationId)).some(m => m.status === 'interrupted'));
    expect((await messages(conversationId))[1].content).toContain('word0');
    await waitFor(async () => provider.disconnects() > 0);
    expect(await list()).toHaveLength(2);
    await stop(); await start();
    expect(await list()).toHaveLength(2);
    expect((await messages(conversationId))[1].status).toBe('interrupted');
    // Graceful shutdown also interrupts an active provider stream and drains persistence.
    const response = await post('slow shutdown'); const events: TurnEvent[] = [];
    const reading = readEvents(response.body!, event => {
      events.push(event); if (event.type === 'answer.delta') child!.kill('SIGTERM');
    });
    await reading; await stop(); await start();
    const shutdownId = (events[0] as Extract<TurnEvent, { type: 'turn.started' }>).conversationId;
    expect((await messages(shutdownId))[1].status).toBe('interrupted');
  } finally { await stop(); await provider.close(); rmSync(dir, { recursive: true, force: true }); }
}, 20_000);

async function waitFor(check: () => Promise<boolean>) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('Timed out waiting for the server state.');
}

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startFakeProvider } from './fakeProvider';

const provider = await startFakeProvider();
const dir = mkdtempSync(join(tmpdir(), 'reprise-preview-'));
const child = spawn(process.execPath, ['--import', 'tsx', 'src/server/main.ts'], { stdio: 'inherit', env: {
  ...process.env, LLM_API_KEY: 'mock-browser-only', TAVILY_API_KEY: 'mock-browser-only', LLM_BASE_URL: provider.url,
  REPRISE_DB_PATH: join(dir, 'reprise.db'), PORT: '5173',
} });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { child.kill(signal); void provider.close(); });
child.on('exit', () => { void provider.close(); rmSync(dir, { recursive: true, force: true }); });

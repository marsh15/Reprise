import { spawn } from 'node:child_process';
import { startFakeProvider } from './fakeProvider';

const provider = await startFakeProvider();
const child = spawn(process.execPath, ['--import', 'tsx', 'src/server/main.ts'], { stdio: 'inherit', env: {
  ...process.env, LLM_API_KEY: 'mock-browser-only', TAVILY_API_KEY: 'mock-browser-only', LLM_BASE_URL: provider.url,
  REPRISE_DB_PATH: '/tmp/reprise-m1-browser.db', PORT: '5173',
} });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { child.kill(signal); void provider.close(); });
child.on('exit', () => { void provider.close(); });

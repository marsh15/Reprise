import { mkdtempSync, copyFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, expect, it } from 'vitest';

const directories: string[] = [];
const root = process.cwd();

function runPreflight(contents?: string) {
  const cwd = mkdtempSync(join(tmpdir(), 'reprise-preflight-'));
  directories.push(cwd);
  copyFileSync(resolve(root, '.env.example'), join(cwd, '.env.example'));
  if (contents !== undefined) writeFileSync(join(cwd, '.env'), contents);
  const env = { ...process.env };
  for (const name of Object.keys(env)) {
    if (/^(LLM_|TAVILY_|REPRISE_|PORT$|LOG_LEVEL$)/.test(name)) delete env[name];
  }
  return { cwd, result: spawnSync(process.execPath, [
    resolve(root, 'node_modules/tsx/dist/cli.mjs'), resolve(root, 'scripts/preflight.ts'),
  ], { cwd, env, encoding: 'utf8' }) };
}

afterEach(() => directories.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

it('creates a template and fails with actionable missing-key messages', () => {
  const { cwd, result } = runPreflight();
  expect(result.status).toBe(1);
  expect(readFileSync(join(cwd, '.env'), 'utf8')).toBe(readFileSync('.env.example', 'utf8'));
  expect(result.stderr).toContain('Created .env');
  expect(result.stderr).toContain('LLM_API_KEY: set a valid');
  expect(result.stderr).toContain('TAVILY_API_KEY: set a valid');
});

it('rejects a missing Tavily key with a single actionable line', () => {
  const { result } = runPreflight('LLM_API_KEY=test-only\n');
  expect(result.status).toBe(1);
  expect(result.stderr.trim()).toBe('TAVILY_API_KEY: set a valid TAVILY_API_KEY in .env (see .env.example).');
});

it('passes local prerequisites without contacting API providers', () => {
  const { result } = runPreflight('LLM_API_KEY=test-only\nTAVILY_API_KEY=test-only\n');
  expect(result.status).toBe(0);
});

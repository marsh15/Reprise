import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, rm } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { scenarios } from '../../evals/scenarios';
const exec = promisify(execFile);
it('runs the reproducible mock harness while explicitly withholding model scores', async () => {
  const { stdout } = await exec(process.execPath, ['--import', 'tsx', 'evals/run.ts', '--mock']);
  const path = stdout.match(/Report: (.+)\.\{json,md\}/)![1];
  try {
    const report = JSON.parse(await readFile(path + '.json', 'utf8'));
    expect(report.mode).toBe('mock'); expect(report.metrics).toBeNull(); expect(report.blocked).toBeNull();
    expect(report.rows).toHaveLength(scenarios.length); expect(report.rows.every((row: { failures: unknown[] }) => row.failures.length === 0)).toBe(true);
    expect(report.rows.find((row: {id:string}) => row.id === 'D1').result.evidence.sources[0].fixture).toBe(true);
    expect(report.rows[0].inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(report.automatedTargetsMet).toBeNull(); expect(report.humanReview).toBe('pending');
    expect(report.category).toBe('mock_agent_integration');
    expect(report.rows.find((row: {id:string}) => row.id === 'C1').trace.requests).toHaveLength(2);
    expect(report.rows[0].measurements).toMatchObject({ ttftMs: null, latencyMs: null, estimatedUsd: null, measuredUsd: null });
    const markdown = await readFile(path + '.md', 'utf8');
    expect(markdown).toContain('| Scenario | Priority | Result | TTFT ms | Total ms |');
    expect(markdown).toContain('Queries:'); expect(markdown).toContain('Warnings:');
  } finally { await Promise.all([rm(path + '.json'), rm(path + '.md')]); }
}, 15000);
it.each([
  [['--mock', '--live'], 'separate modes'],
  [['--mock', '--only', 'D1,typo'], 'Unknown scenario'],
  [['--record'], 'requires --cassette-dir'],
  [['--model'], 'requires a value'],
])('rejects invalid CLI selection %j before running any scenario', async (args, reason) => {
  let stdout = '';
  try { await exec(process.execPath, ['--import', 'tsx', 'evals/run.ts', ...args]); throw new Error('Expected blocked evaluation'); }
  catch (error) { expect(error).toMatchObject({ code: 2 }); stdout = (error as { stdout: string }).stdout; }
  const path = stdout.match(/Report: (.+)\.\{json,md\}/)![1];
  try {
    const report = JSON.parse(await readFile(path + '.json', 'utf8'));
    expect(report.blocked).toContain(reason); expect(report.rows).toEqual([]); expect(report.automatedTargetsMet).toBeNull();
  } finally { await Promise.all([rm(path + '.json'), rm(path + '.md')]); }
}, 15000);
it('reports absent credentials as untested with unknown usage and cost, not a zero score', async () => {
  let stdout = '';
  try {
    await exec(process.execPath, ['--import', 'tsx', 'evals/run.ts'], { env: { ...process.env, LLM_API_KEY: '', LLM_BASE_URL: 'https://api.openai.com/v1', LLM_MODEL: 'gpt-6-luna' } });
    throw new Error('Expected blocked evaluation');
  } catch (error) { expect(error).toMatchObject({ code: 2 }); stdout = (error as { stdout: string }).stdout; }
  const path = stdout.match(/Report: (.+)\.\{json,md\}/)![1];
  try {
    const report = JSON.parse(await readFile(path + '.json', 'utf8'));
    expect(report.blocked).toContain('LLM_API_KEY absent');
    expect(report.metrics).toMatchObject({ p0PassRate: null, inputTokens: null, outputTokens: null, medianEstimatedUsdPerTurn: null, toolCallReliability: null });
    expect(report.untested).toHaveLength(scenarios.length);
  } finally { await Promise.all([rm(path + '.json'), rm(path + '.md')]); }
}, 15000);

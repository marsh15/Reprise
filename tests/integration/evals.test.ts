import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, rm } from 'node:fs/promises';
import { expect, it } from 'vitest';
const exec = promisify(execFile);
it('runs the reproducible mock harness while explicitly withholding model scores', async () => {
  const { stdout } = await exec(process.execPath, ['--import', 'tsx', 'evals/run.ts', '--mock']);
  const path = stdout.match(/Report: (.+)\.\{json,md\}/)![1];
  try {
    const report = JSON.parse(await readFile(path + '.json', 'utf8'));
    expect(report.mode).toBe('mock'); expect(report.metrics).toBeNull(); expect(report.blocked).toBeNull();
    expect(report.rows).toHaveLength(13); expect(report.rows.every((row: { failures: unknown[] }) => row.failures.length === 0)).toBe(true);
    expect(report.rows.find((row: {id:string}) => row.id === 'D1').result.evidence.sources[0].fixture).toBe(true);
    expect(report.rows[0].inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(report.deferredToM4).toContain('C1');
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
    expect(report.untested).toHaveLength(13);
  } finally { await Promise.all([rm(path + '.json'), rm(path + '.md')]); }
}, 15000);

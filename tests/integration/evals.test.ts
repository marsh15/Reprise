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
    expect(report.rows).toHaveLength(9); expect(report.rows.every((row: { failures: unknown[] }) => row.failures.length === 0)).toBe(true);
    expect(report.rows[0].result.evidence.sources[0].fixture).toBe(true);
    expect(report.rows[0].inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(report.deferredToM3).toContain('C1');
  } finally { await Promise.all([rm(path + '.json'), rm(path + '.md')]); }
});

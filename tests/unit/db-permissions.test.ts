import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chmodSync, closeSync, mkdtempSync, openSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../../src/server/db/db';

const mode = (p: string) => statSync(p).mode & 0o777;
let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'reprise-perm-')); });
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe.skipIf(process.platform === 'win32')('database file permissions', () => {
  it('creates a private directory, database and WAL sidecars', () => {
    const dir = join(root, 'nested', 'data');
    const path = join(dir, 'reprise.db');
    const store = openDatabase(path);
    store.db.exec('CREATE TABLE t_perm (x)');
    store.db.exec('INSERT INTO t_perm VALUES (1)');
    expect(mode(dir)).toBe(0o700);
    for (const p of [path, `${path}-wal`, `${path}-shm`]) expect(mode(p)).toBe(0o600);
    store.close();
  });

  it('leaves a pre-existing database file mode alone', () => {
    const path = join(root, 'reprise.db');
    closeSync(openSync(path, 'w'));
    chmodSync(path, 0o644);
    openDatabase(path).close();
    expect(mode(path)).toBe(0o644);
  });
});

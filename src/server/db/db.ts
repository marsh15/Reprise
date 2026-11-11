import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { migrations } from './schema';

export function openDatabase(path: string) {
  let db: DatabaseSync | undefined;
  try {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    db = new DatabaseSync(path);
    db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000;');
    const connection = db;
    function transaction<T>(fn: () => T): T {
      connection.exec('BEGIN IMMEDIATE');
      try {
        const result = fn();
        if (result instanceof Promise) throw new Error('SQLite transactions must be synchronous.');
        connection.exec('COMMIT');
        return result;
      } catch (error) {
        connection.exec('ROLLBACK');
        throw error;
      }
    }
    transaction(() => {
      const version = Number(connection.prepare('PRAGMA user_version').get()!.user_version);
      if (version > migrations.length) throw new Error('Database is newer than this application.');
      for (let i = version; i < migrations.length; i++) {
        connection.exec(migrations[i]);
        connection.exec(`PRAGMA user_version=${i + 1}`);
      }
    });
    return { db, transaction, close: () => connection.close() };
  } catch (error) {
    db?.close();
    throw new Error(`Could not open database at ${path}. Back up the file before deleting or replacing it. Check permissions and application version.`, { cause: error });
  }
}
export type Store = ReturnType<typeof openDatabase>;

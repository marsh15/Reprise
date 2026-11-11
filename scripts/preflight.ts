import { copyFileSync, existsSync, constants } from 'node:fs';
import { loadConfig } from '../src/server/config';

async function preflight() {
  if (Number(process.versions.node.split('.')[0]) < 24) {
    throw new Error('Node 24 or newer is required. Run nvm install 24 && nvm use 24.');
  }
  let sqlite;
  try {
    sqlite = await import('node:sqlite');
  } catch {
    throw new Error('node:sqlite is unavailable. Install an official Node 24+ build.');
  }
  const db = new sqlite.DatabaseSync(':memory:');
  try {
    db.exec('CREATE VIRTUAL TABLE t USING fts5(x)');
  } catch {
    throw new Error('SQLite FTS5 is unavailable. Install an official Node 24+ build.');
  } finally {
    db.close();
  }
  if (!existsSync('.env')) {
    copyFileSync('.env.example', '.env', constants.COPYFILE_EXCL);
    console.error('Created .env from .env.example. Fill in LLM_API_KEY and TAVILY_API_KEY.');
  }
  loadConfig();
}

try {
  await preflight();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Preflight failed. Check your Node installation and .env.');
  process.exitCode = 1;
}

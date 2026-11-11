import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { pathToFileURL } from 'node:url';
import { TZDate } from '@date-fns/tz';
import { z } from 'zod';
import fixtures from './fixtures/demo.json';
import { createClock } from '../src/server/clock';
import { resolveDates } from '../src/server/time/resolve';
import { openDatabase } from '../src/server/db/db';
import { createRepo, type Repo } from '../src/server/db/repo';

const label = '[Demo conversation — illustrative testing data]';
const fixtureSchema = z.array(z.object({ key: z.enum(['crm', 'postgres', 'node', 'weekend']), title: z.string().startsWith('[Demo] '),
  user: z.string().startsWith(label), assistant: z.string().startsWith(label), sources: z.array(z.object({
    url: z.url().refine(url => /^https?:\/\//.test(url)), title: z.string().startsWith('[Demo] '),
    excerpt: z.string().startsWith('[Demo fixture — illustrative data captured for testing]'),
  })) }));
export function seedDemo(repo: Repo, now: Date, tz: string, reset = false) {
  const data = fixtureSchema.parse(fixtures);
  const day = (phrase: string) => resolveDates(phrase, now, tz)[0].candidates[0].from;
  const local = new TZDate(now.getTime(), tz);
  const third = new TZDate(local.getFullYear(), local.getMonth(), 3, 10, 0, 0, tz);
  const dates = { crm: day('on Monday'), postgres: resolveDates('last Tuesday', now, tz)[0].candidates[1].from,
    node: third.getDate() < local.getDate() ? day('3 ' + new Intl.DateTimeFormat('en', { timeZone: tz, month: 'long' }).format(now)) : day('8 days ago'), weekend: day('yesterday') };
  return repo.seedFixtures(data.map(fixture => {
    const [year, month, date] = dates[fixture.key].split('-').map(Number);
    return { ...fixture, timezone: tz, now: new TZDate(year, month - 1, date, 10, 0, 0, tz) };
  }), reset);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (existsSync('.env')) loadEnvFile('.env');
  const args = process.argv.slice(2);
  const tzIndex = args.indexOf('--tz');
  const tz = tzIndex < 0 ? Intl.DateTimeFormat().resolvedOptions().timeZone : args[tzIndex + 1];
  let store: ReturnType<typeof openDatabase> | undefined;
  try {
    if (!tz || args.some((arg, i) => arg !== '--tz' && arg !== '--reset-fixtures' && !(tzIndex >= 0 && i === tzIndex + 1))) throw new Error('Usage: npm run seed:demo -- [--tz IANA_TIMEZONE] [--reset-fixtures]');
    new Intl.DateTimeFormat('en', { timeZone: tz });
    const clock = createClock(process.env.REPRISE_NOW);
    if (clock.isOverridden()) console.warn('Test clock active: ' + clock.now().toISOString());
    store = openDatabase(process.env.REPRISE_DB_PATH || './data/reprise.db');
    const conversations = seedDemo(createRepo(store), clock.now(), tz, args.includes('--reset-fixtures'));
    console.log(`Created ${conversations.length} labelled demo conversations in ${tz}. Illustrative data, not genuine user history.`);
  } catch (error) { console.error(error instanceof Error ? error.message : 'Could not seed demo data.'); process.exitCode = 1; }
  finally { store?.close(); }
}

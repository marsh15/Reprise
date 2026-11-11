import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { z } from 'zod';

const configSchema = z.object({
  LLM_API_KEY: z.string().trim().min(1, 'set LLM_API_KEY in .env'),
  LLM_BASE_URL: z.url().default('https://api.openai.com/v1'),
  LLM_MODEL: z.string().trim().min(1).default('gpt-6-luna'),
  LLM_REASONING_EFFORT: z.enum(['none', 'low', 'medium', 'high']).optional(),
  TAVILY_API_KEY: z.string().trim().min(1, 'set TAVILY_API_KEY in .env'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5173),
  REPRISE_DB_PATH: z.string().trim().min(1).default('./data/reprise.db'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  REPRISE_NOW: z.iso.datetime({ offset: true }).optional(),
});

export type Config = Readonly<z.infer<typeof configSchema>>;

export function parseConfig(env: NodeJS.ProcessEnv): Config {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    // Report field names and fixes, never the supplied values (which may be secrets).
    throw new Error(result.error.issues.map((issue) => {
      const name = String(issue.path[0]);
      return `${name}: set a valid ${name} in .env (see .env.example).`;
    }).join('\n'));
  }
  return Object.freeze(result.data);
}

export function loadConfig(): Config {
  if (existsSync('.env')) loadEnvFile('.env');
  return parseConfig(process.env);
}

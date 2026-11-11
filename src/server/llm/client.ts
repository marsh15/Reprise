import OpenAI from 'openai';
import type { Config } from '../config';

export function createLlm(config: Config) {
  return new OpenAI({ apiKey: config.LLM_API_KEY, baseURL: config.LLM_BASE_URL, maxRetries: 2, timeout: 60_000 });
}

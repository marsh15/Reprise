import OpenAI from 'openai';
import type { Config } from '../config';

export function createLlm(config: Config) {
  return new OpenAI({ apiKey: config.LLM_API_KEY, baseURL: config.LLM_BASE_URL, maxRetries: 2, timeout: 60_000 });
}

// Only documented, demonstrated differences belong here; unknown compatible APIs
// keep the standard parameters rather than inheriting speculative restrictions.
export function chatToolParameters(config: Pick<Config, 'LLM_BASE_URL' | 'LLM_MODEL' | 'LLM_REASONING_EFFORT'>) {
  const host = new URL(config.LLM_BASE_URL).hostname;
  if (host === 'api.openai.com' && config.LLM_MODEL === 'gpt-6.1-terra') {
    throw new Error('gpt-6.1-terra requires Responses API tool calling; Reprise uses Chat Completions. Choose a compatible model explicitly.');
  }
  if (host === 'api.openai.com' && ['gpt-6-luna', 'gpt-6-sol'].includes(config.LLM_MODEL)) {
    if (config.LLM_REASONING_EFFORT && config.LLM_REASONING_EFFORT !== 'none') {
      throw new Error(`${config.LLM_MODEL} Chat Completions tool calling requires LLM_REASONING_EFFORT=none.`);
    }
    return { reasoning_effort: 'none' as const, parallel_tool_calls: true };
  }
  return {
    // The pinned OpenRouter DeepSeek US endpoint rejects this explicit parameter.
    ...(host === 'openrouter.ai' && config.LLM_MODEL === 'deepseek/deepseek-v4.1-flash' ? {} : { parallel_tool_calls: true }),
    ...(config.LLM_REASONING_EFFORT ? { reasoning_effort: config.LLM_REASONING_EFFORT } : {}),
  };
}

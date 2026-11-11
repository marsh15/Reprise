import { expect, it } from 'vitest';
import { chatToolParameters } from '../../src/server/llm/client';
const config = { LLM_BASE_URL: 'https://api.openai.com/v1', LLM_MODEL: 'gpt-6-luna' };
it.each(['gpt-6-luna', 'gpt-6-sol'])('applies documented %s Chat tool compatibility without substituting models', model => {
  const candidate = { ...config, LLM_MODEL: model };
  expect(chatToolParameters(candidate)).toEqual({ reasoning_effort: 'none', parallel_tool_calls: true });
  expect(chatToolParameters({ ...candidate, LLM_REASONING_EFFORT: 'none' })).toEqual({ reasoning_effort: 'none', parallel_tool_calls: true });
  for (const effort of ['low', 'medium', 'high'] as const) expect(() => chatToolParameters({ ...candidate, LLM_REASONING_EFFORT: effort })).toThrow('requires LLM_REASONING_EFFORT=none');
});
it('rejects Terra tool calling on this architecture explicitly', () => {
  expect(() => chatToolParameters({ ...config, LLM_MODEL: 'gpt-6.1-terra' })).toThrow('requires Responses');
});
it('keeps generic API settings and omits the rejected DeepSeek OpenRouter parallel flag', () => {
  expect(chatToolParameters({ ...config, LLM_BASE_URL: 'https://example.com/v1', LLM_REASONING_EFFORT: 'low' })).toEqual({ parallel_tool_calls: true, reasoning_effort: 'low' });
  expect(chatToolParameters({ ...config, LLM_BASE_URL: 'https://openrouter.ai/api/v1', LLM_MODEL: 'deepseek/deepseek-v4.1-flash' })).toEqual({});
});

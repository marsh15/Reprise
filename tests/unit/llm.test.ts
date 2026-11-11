import { expect, it } from 'vitest';
import { chatToolParameters } from '../../src/server/llm/client';
const config = { LLM_BASE_URL: 'https://api.openai.com/v1', LLM_MODEL: 'gpt-6-luna' };
it('applies documented Luna Chat tool compatibility without substituting models', () => {
  expect(chatToolParameters(config)).toEqual({ reasoning_effort: 'none', parallel_tool_calls: true });
  expect(() => chatToolParameters({ ...config, LLM_REASONING_EFFORT: 'low' })).toThrow('requires LLM_REASONING_EFFORT=none');
});
it('rejects Terra tool calling on this architecture explicitly', () => {
  expect(() => chatToolParameters({ ...config, LLM_MODEL: 'gpt-6.1-terra' })).toThrow('requires Responses');
});
it('keeps generic API settings and omits the rejected DeepSeek OpenRouter parallel flag', () => {
  expect(chatToolParameters({ ...config, LLM_BASE_URL: 'https://example.com/v1', LLM_REASONING_EFFORT: 'low' })).toEqual({ parallel_tool_calls: true, reasoning_effort: 'low' });
  expect(chatToolParameters({ ...config, LLM_BASE_URL: 'https://openrouter.ai/api/v1', LLM_MODEL: 'deepseek/deepseek-v4.1-flash' })).toEqual({});
});

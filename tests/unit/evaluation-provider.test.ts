import { afterEach, expect, it, vi } from 'vitest';
import { evaluationLlm } from '../../evals/provider';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('captures provider request bodies without credentials and pins the intended US endpoint', async () => {
  vi.stubEnv('OPENROUTER_API_KEY', 'test-private-sentinel');
  const fetch = vi.fn(async () => new Response('data: {"choices":[{"index":0,"delta":{"content":"OK"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } }));
  vi.stubGlobal('fetch', fetch);
  const { llm, trace } = evaluationLlm('https://openrouter.ai/api/v1', 'deepseek/deepseek-v4.1-flash', 'fireworks/us');
  const stream = await llm.chat.completions.create({ model: 'deepseek/deepseek-v4.1-flash', stream: true, messages: [{ role: 'user', content: 'Reply OK' }] });
  for await (const _chunk of stream) { /* drain SDK stream */ }
  expect(fetch).toHaveBeenCalledOnce();
  expect(trace).toMatchObject([{ provider: { only: ['fireworks/us'], allow_fallbacks: false, require_parameters: true } }]);
  expect(JSON.stringify(trace)).not.toContain('test-private-sentinel'); expect(JSON.stringify(trace)).not.toContain('authorization');
});
it('rejects credential-bearing URLs and non-US pinning without issuing a request', () => {
  vi.stubEnv('OPENROUTER_API_KEY', 'test');
  expect(() => evaluationLlm('https://openrouter.ai/api/v1?key=private', 'model')).toThrow('without credentials');
  expect(() => evaluationLlm('https://openrouter.ai/api/v1', 'model', 'fireworks')).toThrow('US endpoint');
});
it('applies an explicit evaluation-only output cap to captured and transmitted requests without retries', async () => {
  vi.stubEnv('LLM_API_KEY', 'test-private-sentinel');
  const fetch = vi.fn(async (_url: unknown, _init?: RequestInit) => new Response('data: {"choices":[{"index":0,"delta":{"content":"OK"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } }));
  vi.stubGlobal('fetch', fetch);
  const { llm, trace } = evaluationLlm('https://api.openai.com/v1', 'gpt-6-sol', undefined, 1536);
  expect(llm.maxRetries).toBe(0);
  const stream = await llm.chat.completions.create({ model: 'gpt-6-sol', stream: true, messages: [{ role: 'user', content: 'OK' }] });
  for await (const _chunk of stream) { /* drain SDK stream */ }
  expect(trace).toMatchObject([{ model: 'gpt-6-sol', max_completion_tokens: 1536 }]);
  expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toMatchObject({ max_completion_tokens: 1536 });
  for (const cap of [0, -1, 1.5, NaN, 16385]) expect(() => evaluationLlm('https://api.openai.com/v1', 'gpt-6-sol', undefined, cap)).toThrow('output cap');
});

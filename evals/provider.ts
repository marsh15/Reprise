import OpenAI from 'openai';

// Evaluation-only provider pinning. The application default is never changed here.
export function evaluationLlm(baseURL: string, model: string, provider = 'fireworks/us') {
  const openRouter = new URL(baseURL).hostname === 'openrouter.ai';
  const apiKey = openRouter ? process.env.OPENROUTER_API_KEY : process.env.LLM_API_KEY;
  if (!apiKey?.trim()) throw new Error(openRouter ? 'OPENROUTER_API_KEY absent' : 'LLM_API_KEY absent');
  if (openRouter && !/^[a-z0-9-]+(?:\/[a-z0-9-]+)*\/us$/.test(provider)) throw new Error('OpenRouter evaluations require an explicit US endpoint slug');
  const llm = new OpenAI({ apiKey, baseURL, maxRetries: 2, timeout: 60_000,
    ...(openRouter ? { fetch: (async (url, init) => {
      const body = JSON.parse(String(init?.body));
      return fetch(url, { ...init, body: JSON.stringify({ ...body, provider: { only: [provider], allow_fallbacks: false, require_parameters: true } }) });
    }) as typeof fetch } : {}),
  });
  return { llm, model, provider: openRouter ? provider : 'configured endpoint' };
}

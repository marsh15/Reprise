import OpenAI from 'openai';

// Evaluation-only provider pinning. The application default is never changed here.
export function evaluationLlm(baseURL: string, model: string, provider = 'fireworks/us') {
  const endpoint = new URL(baseURL);
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error('Use an endpoint URL without credentials, query or fragment');
  const openRouter = endpoint.hostname === 'openrouter.ai';
  const apiKey = openRouter ? process.env.OPENROUTER_API_KEY : process.env.LLM_API_KEY;
  if (!apiKey?.trim()) throw new Error(openRouter ? 'OPENROUTER_API_KEY absent' : 'LLM_API_KEY absent');
  if (openRouter && !/^[a-z0-9-]+(?:\/[a-z0-9-]+)*\/us$/.test(provider)) throw new Error('OpenRouter evaluations require an explicit US endpoint slug');
  const trace: unknown[] = [];
  const llm = new OpenAI({ apiKey, baseURL, maxRetries: 2, timeout: 60_000,
    fetch: (async (url, init) => {
      const body = JSON.parse(String(init?.body));
      const request = openRouter ? { ...body, provider: { only: [provider], allow_fallbacks: false, require_parameters: true } } : body;
      // Request body only. Never capture headers, credentials, or raw provider errors.
      trace.push(request);
      return fetch(url, { ...init, body: JSON.stringify(request) });
    }) as typeof fetch,
  });
  return { llm, model, provider: openRouter ? provider : 'configured endpoint', trace };
}

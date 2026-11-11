import OpenAI from 'openai';

export function fakeLlm(options: { text?: string[]; delay?: number; finish?: string | null; fail?: boolean } = {}) {
  const requests: { body: Record<string, unknown>; signal: AbortSignal | null | undefined }[] = [];
  let aborted = false;
  const llm = new OpenAI({ apiKey: 'fake', maxRetries: 0, fetch: async (_url, init) => {
    requests.push({ body: JSON.parse(String(init?.body)), signal: init?.signal });
    if (options.fail) return new Response('{}', { status: 503 });
    const encoder = new TextEncoder();
    const chunks: { choices: { index: number; delta: { content: string }; finish_reason: string | null }[] }[] = (options.text ?? ['Hello', ' world']).map(content => ({ choices: [{ index: 0, delta: { content }, finish_reason: null }] }));
    if (options.finish !== null) chunks.push({ choices: [{ index: 0, delta: { content: '' }, finish_reason: options.finish ?? 'stop' }] });
    const payloads: unknown[] = [...chunks, { choices: [], usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 } }];
    const signal = init?.signal;
    return new Response(new ReadableStream({
      async start(controller) {
        try {
          for (const payload of payloads) {
            if (options.delay) await new Promise(resolve => setTimeout(resolve, options.delay));
            if (signal?.aborted) { aborted = true; controller.error(new Error('aborted')); return; }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n')); controller.close();
        } catch { aborted = true; }
      },
      cancel() { aborted = true; },
    }), { headers: { 'Content-Type': 'text/event-stream' } });
  } });
  return { llm, requests, wasAborted: () => aborted };
}

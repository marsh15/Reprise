import OpenAI from 'openai';

export function fakeLlm(options: { text?: string[]; delay?: number; finish?: string | null; fail?: boolean; repeatUsage?: boolean } = {}) {
  const requests: { body: Record<string, unknown>; signal: AbortSignal | null | undefined }[] = [];
  let aborted = false;
  const llm = new OpenAI({ apiKey: 'fake', maxRetries: 0, fetch: async (_url, init) => {
    requests.push({ body: JSON.parse(String(init?.body)), signal: init?.signal });
    if (options.fail) return new Response('{}', { status: 503 });
    const encoder = new TextEncoder();
    const chunks: { choices: { index: number; delta: { content: string }; finish_reason: string | null }[] }[] = (options.text ?? ['Hello', ' world']).map(content => ({ choices: [{ index: 0, delta: { content }, finish_reason: null }] }));
    if (options.finish !== null) chunks.push({ choices: [{ index: 0, delta: { content: '' }, finish_reason: options.finish ?? 'stop' }] });
    const payloads: unknown[] = [...chunks, ...(options.repeatUsage ? [{ choices: [], usage: { prompt_tokens: 9, completion_tokens: 1, total_tokens: 10 } }] : []), { choices: [], usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 } }];
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

export type ScriptedStep = { text?: string[]; calls?: { name?: string; args: string; id?: string }[]; delay?: number; finish?: string; fail?: boolean };
export function scriptedLlm(steps: ScriptedStep[]) {
  const requests: Record<string, unknown>[] = [];
  const llm = new OpenAI({ apiKey: 'fake', maxRetries: 0, fetch: async (_url, init) => {
    const step = steps[requests.length];
    requests.push(JSON.parse(String(init?.body)));
    if (!step || step.fail) return new Response('{}', { status: 503 });
    const chunks: unknown[] = (step.text ?? []).map(content => ({ choices: [{ index: 0, delta: { content }, finish_reason: null }] }));
    // Interleave tool argument fragments to exercise accumulation by index.
    for (let part = 0; part < 2; part++) chunks.push({ choices: [{ index: 0, delta: { tool_calls: (step.calls ?? []).map((call, index) => ({
      index, ...(part === 0 ? { id: call.id ?? `call_${index}`, type: 'function' } : {}),
      function: { ...(part === 0 ? { name: call.name ?? 'web_search' } : {}), arguments: part === 0 ? call.args.slice(0, 5) : call.args.slice(5) },
    })) }, finish_reason: null }] });
    chunks.push({ choices: [{ index: 0, delta: {}, finish_reason: step.finish ?? (step.calls?.length ? 'tool_calls' : 'stop') }] });
    chunks.push({ choices: [], usage: { prompt_tokens: 10, completion_tokens: 2 } });
    const encoder = new TextEncoder();
    return new Response(new ReadableStream({ async start(controller) {
      try {
        for (const chunk of chunks) {
          if (step.delay) await new Promise(resolve => setTimeout(resolve, step.delay));
          if (init?.signal?.aborted) { controller.error(new Error('aborted')); return; }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n')); controller.close();
      } catch { /* Consumer cancelled. */ }
    } }), { headers: { 'Content-Type': 'text/event-stream' } });
  } });
  return { llm, requests };
}

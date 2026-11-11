import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import OpenAI from 'openai';

if (existsSync('.env')) loadEnvFile('.env');
if (!process.env.LLM_API_KEY?.trim()) {
  console.log('SKIPPED: LLM_API_KEY is absent. No live provider compatibility has been verified.');
  process.exitCode = 1;
} else {
  const llm = new OpenAI({ apiKey: process.env.LLM_API_KEY, baseURL: process.env.LLM_BASE_URL || 'https://api.openai.com/v1', maxRetries: 0, timeout: 20_000 });
  const model = process.env.LLM_MODEL || 'gpt-6-luna';
  const probes = [
    { name: 'M1 streaming, usage, and tool_choice none', parameters: { tool_choice: 'none' as const } },
    { name: 'parallel_tool_calls with disabled web_search declaration', parameters: {
      tool_choice: 'none' as const, parallel_tool_calls: true,
      tools: [{ type: 'function' as const, function: { name: 'web_search', description: 'Search the web', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } }],
    } },
    { name: 'configured reasoning effort (low when unset)', parameters: { reasoning_effort: (process.env.LLM_REASONING_EFFORT || 'low') as 'low' } },
    { name: 'mid-conversation system note', parameters: {} },
  ];
  for (const probe of probes) {
    try {
      const stream = await llm.chat.completions.create({
        model, stream: true, stream_options: { include_usage: true },
        messages: [{ role: 'system', content: 'Answer briefly.' }, { role: 'user', content: 'Hello' },
          ...(probe.name === 'mid-conversation system note' ? [{ role: 'system' as const, content: 'Reply with OK.' }] : [])],
        ...probe.parameters,
      });
      let text = false; let usage = false; let finish = false;
      for await (const chunk of stream) { text ||= Boolean(chunk.choices[0]?.delta.content); usage ||= Boolean(chunk.usage); finish ||= chunk.choices[0]?.finish_reason === 'stop'; }
      const passed = text && usage && finish;
      console.log(`${passed ? 'PASS' : 'FAIL'}: ${probe.name}; text=${text}, usage=${usage}, finish=${finish}`);
      if (!passed) process.exitCode = 1;
    } catch (error) {
      // API error bodies can echo inputs. Report only the safe status and type.
      console.log(`FAIL: ${probe.name}; ${error instanceof OpenAI.APIError ? `HTTP ${error.status}` : 'network or SDK error'}`);
      process.exitCode = 1;
    }
  }
}

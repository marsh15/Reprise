import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import OpenAI from 'openai';
import type { ChatCompletionCreateParamsStreaming, ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { parseConfig } from '../src/server/config';
import { searchRequestSchema } from '../src/shared/research';
import { evaluationLlm } from '../evals/provider';
import { chatToolParameters } from '../src/server/llm/client';
import { WEB_SEARCH_TOOL } from '../src/server/agent/modelStep';
if (existsSync('.env')) loadEnvFile('.env');
const args = process.argv.slice(2);
const option = (name: string) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const baseURL = option('--base-url') || process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
const model = option('--model') || process.env.LLM_MODEL || 'gpt-6-luna';
try {
  const config = parseConfig({ LLM_API_KEY: 'client-handles-key', TAVILY_API_KEY: 'unused', LLM_BASE_URL: baseURL, LLM_MODEL: model, ...(process.env.LLM_REASONING_EFFORT ? { LLM_REASONING_EFFORT: process.env.LLM_REASONING_EFFORT } : {}) });
  const toolParameters = chatToolParameters(config);
  const { llm, provider } = evaluationLlm(baseURL, model, option('--provider'));
  llm.maxRetries = 0;
  console.log(JSON.stringify({ model, baseURL, provider }));
  const tools = [WEB_SEARCH_TOOL];
  const probes: { name: string; parameters: Partial<ChatCompletionCreateParamsStreaming>; toolCount?: number; systemNote?: boolean }[] = [
    { name: 'Chat Completions streaming, usage, tool_choice none', parameters: { tools, tool_choice: 'none' } },
    { name: 'forced web_search and tool-result continuation', parameters: { tools, tool_choice: { type: 'function', function: { name: 'web_search' } } }, toolCount: 1 },
    { name: 'parallel web_search calls', parameters: { tools, tool_choice: 'required', parallel_tool_calls: true }, toolCount: 2 },
    { name: 'compatible reasoning effort', parameters: { reasoning_effort: config.LLM_REASONING_EFFORT ?? toolParameters.reasoning_effort ?? 'low' } },
    { name: 'mid-conversation system note', parameters: {}, systemNote: true },
  ];
  for (const probe of probes) {
    try {
      const messages: ChatCompletionMessageParam[] = [{ role: 'system', content: 'Follow the request briefly.' },
        { role: 'user', content: probe.toolCount === 2 ? 'Call web_search twice in the same response, for Node.js LTS and PostgreSQL latest release, freshness any.' : probe.toolCount ? 'Search for Node.js LTS, freshness any.' : 'Reply OK.' },
        ...(probe.systemNote ? [{ role: 'system' as const, content: 'Reply OK.' }] : [])];
      const stream = await llm.chat.completions.create({ model, stream: true, stream_options: { include_usage: true }, messages, ...toolParameters, ...probe.parameters }, { signal: AbortSignal.timeout(20_000) });
      let text = false; let usage = false; let finish: string | null = null;
      const calls = new Map<number, { id: string; type: 'function'; function: { name: string; arguments: string } }>();
      for await (const chunk of stream) {
        text ||= Boolean(chunk.choices[0]?.delta.content); usage ||= Boolean(chunk.usage); finish = chunk.choices[0]?.finish_reason ?? finish;
        for (const delta of chunk.choices[0]?.delta.tool_calls ?? []) {
          const call = calls.get(delta.index) ?? { id: '', type: 'function', function: { name: '', arguments: '' } };
          call.id += delta.id ?? ''; call.function.name += delta.function?.name ?? ''; call.function.arguments += delta.function?.arguments ?? ''; calls.set(delta.index, call);
        }
      }
      let continuation = true;
      if (probe.toolCount && calls.size) {
        messages.push({ role: 'assistant', tool_calls: [...calls.values()] });
        for (const call of calls.values()) messages.push({ role: 'tool', tool_call_id: call.id, content: '{"status":"empty","results":[]}' });
        const final = await llm.chat.completions.create({ model, messages, tools, ...toolParameters, tool_choice: 'none', stream: true, stream_options: { include_usage: true } }, { signal: AbortSignal.timeout(20_000) });
        let finalText = false; let finalStop = false; let finalUsage = false;
        for await (const chunk of final) { finalText ||= Boolean(chunk.choices[0]?.delta.content); finalStop ||= chunk.choices[0]?.finish_reason === 'stop'; finalUsage ||= Boolean(chunk.usage); }
        continuation = finalText && finalStop && finalUsage;
      }
      const validCalls = [...calls.values()].every(call => { try { const args = JSON.parse(call.function.arguments); return call.id && call.function.name === 'web_search' && searchRequestSchema.safeParse(args).success; } catch { return false; } });
      const passed = usage && continuation && (probe.toolCount ? calls.size >= probe.toolCount && finish === 'tool_calls' && validCalls : text && finish === 'stop');
      console.log(JSON.stringify({ probe: probe.name, passed, text, usage, finish, toolCalls: calls.size, continuation }));
      if (!passed) process.exitCode = 1;
    } catch (error) {
      console.log(JSON.stringify({ probe: probe.name, passed: false, error: error instanceof OpenAI.APIError ? `HTTP ${error.status}` : 'network, timeout or SDK error' }));
      process.exitCode = 1;
    }
  }
} catch (error) {
  console.log(`SKIPPED: ${error instanceof Error ? error.message : 'provider configuration unavailable'}. No live compatibility established.`);
  process.exitCode = 1;
}

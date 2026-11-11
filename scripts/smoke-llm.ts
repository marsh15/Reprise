import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import OpenAI from 'openai';
import type { ChatCompletionCreateParamsStreaming, ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { parseConfig } from '../src/server/config';
import { searchRequestSchema } from '../src/shared/research';
import { evaluationLlm } from '../evals/provider';
import { chatToolParameters } from '../src/server/llm/client';
import { WEB_SEARCH_TOOL } from '../src/server/agent/modelStep';
import prices from '../evals/prices.json';
if (existsSync('.env')) loadEnvFile('.env');
const args = process.argv.slice(2);
const option = (name: string) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const baseURL = option('--base-url') || process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
const model = option('--model') || process.env.LLM_MODEL || 'gpt-6-luna';
const records: unknown[] = []; let inputTokens = 0; let outputTokens = 0; let usageComplete = true;
const price = prices.models.find(p => p.model === model && p.baseURL === baseURL && p.provider === 'configured endpoint');
const usage = (value: { prompt_tokens: number; completion_tokens: number } | null | undefined) => {
  if (!value || !Number.isInteger(value.prompt_tokens) || !Number.isInteger(value.completion_tokens) || value.prompt_tokens < 0 || value.completion_tokens < 0) return false;
  inputTokens += value.prompt_tokens; outputTokens += value.completion_tokens; return true;
};
const record = (value: unknown) => { records.push(structuredClone(value)); console.log(JSON.stringify(value)); };
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
    { name: 'compatible reasoning effort', parameters: { tools, tool_choice: 'none', reasoning_effort: config.LLM_REASONING_EFFORT ?? toolParameters.reasoning_effort ?? 'low' } },
    { name: 'mid-conversation system note', parameters: { tools, tool_choice: 'none' }, systemNote: true },
  ];
  for (const probe of probes) {
    const started = Date.now();
    try {
      const messages: ChatCompletionMessageParam[] = [{ role: 'system', content: 'Follow the request briefly.' },
        { role: 'user', content: probe.toolCount === 2 ? 'Call web_search twice in the same response, for Node.js LTS and PostgreSQL latest release, freshness any.' : probe.toolCount ? 'Search for Node.js LTS, freshness any.' : 'Reply OK.' },
        ...(probe.systemNote ? [{ role: 'system' as const, content: 'Reply OK.' }] : [])];
      const parameters = { model, stream: true as const, stream_options: { include_usage: true }, max_completion_tokens: 256, messages, ...toolParameters, ...probe.parameters };
      const stream = await llm.chat.completions.create(parameters, { signal: AbortSignal.timeout(20_000) });
      let text = false; let usage = false; let finish: string | null = null;
      let answer = ''; let tokens: { prompt_tokens: number; completion_tokens: number } | null = null;
      const calls = new Map<number, { id: string; type: 'function'; function: { name: string; arguments: string } }>();
      for await (const chunk of stream) {
        text ||= Boolean(chunk.choices[0]?.delta.content); usage ||= Boolean(chunk.usage); finish = chunk.choices[0]?.finish_reason ?? finish;
        answer += chunk.choices[0]?.delta.content ?? ''; if (chunk.usage) tokens = chunk.usage;
        for (const delta of chunk.choices[0]?.delta.tool_calls ?? []) {
          const call = calls.get(delta.index) ?? { id: '', type: 'function', function: { name: '', arguments: '' } };
          call.id += delta.id ?? ''; call.function.name += delta.function?.name ?? ''; call.function.arguments += delta.function?.arguments ?? ''; calls.set(delta.index, call);
        }
      }
      const validUsage = accountUsage(tokens);
      const validCalls = [...calls.values()].every(call => { try { const args = JSON.parse(call.function.arguments); return call.id && call.function.name === 'web_search' && searchRequestSchema.safeParse(args).success; } catch { return false; } });
      const initialPassed = validUsage && (probe.toolCount ? calls.size >= probe.toolCount && finish === 'tool_calls' && validCalls : text && finish === 'stop' && !calls.size);
      record({ probe: probe.name, stage: 'initial', passed: initialPassed, parameters, answer, finish, tokens, calls: [...calls.values()], latencyMs: Date.now() - started });
      if (!initialPassed) { process.exitCode = 1; break; }
      let continuation = true;
      if (probe.toolCount && calls.size) {
        messages.push({ role: 'assistant', tool_calls: [...calls.values()] });
        for (const call of calls.values()) messages.push({ role: 'tool', tool_call_id: call.id, content: '{"status":"empty","results":[]}' });
        const continuationStarted = Date.now();
        const final = await llm.chat.completions.create({ model, messages, tools, ...toolParameters, tool_choice: 'none', stream: true, stream_options: { include_usage: true }, max_completion_tokens: 256 }, { signal: AbortSignal.timeout(20_000) });
        let finalText = false; let finalStop = false; let finalUsage = false;
        let finalAnswer = ''; let finalTokens: typeof tokens = null; let finalCalls = false;
        for await (const chunk of final) { finalText ||= Boolean(chunk.choices[0]?.delta.content); finalStop ||= chunk.choices[0]?.finish_reason === 'stop'; finalUsage ||= Boolean(chunk.usage);
          finalAnswer += chunk.choices[0]?.delta.content ?? ''; if (chunk.usage) finalTokens = chunk.usage; finalCalls ||= Boolean(chunk.choices[0]?.delta.tool_calls?.length); }
        const validFinalUsage = accountUsage(finalTokens);
        continuation = finalText && finalStop && finalUsage && validFinalUsage && !finalCalls;
        record({ probe: probe.name, stage: 'continuation', passed: continuation, answer: finalAnswer, tokens: finalTokens, latencyMs: Date.now() - continuationStarted });
      }
      const passed = usage && continuation && (probe.toolCount ? calls.size >= probe.toolCount && finish === 'tool_calls' && validCalls : text && finish === 'stop');
      console.log(JSON.stringify({ probe: probe.name, passed, text, usage, finish, toolCalls: calls.size, continuation }));
      if (!passed) { process.exitCode = 1; break; }
    } catch (error) {
      usageComplete = false;
      record({ probe: probe.name, passed: false, error: error instanceof OpenAI.APIError ? { status: error.status, code: error.code, type: error.type, param: error.param } : 'network, timeout or SDK error' });
      process.exitCode = 1;
      break;
    }
  }
} catch (error) {
  usageComplete = false;
  console.log(`SKIPPED: ${error instanceof Error ? error.message : 'provider configuration unavailable'}. No live compatibility established.`);
  process.exitCode = 1;
}
const summary = { model, baseURL, passed: process.exitCode !== 1, inputTokens, outputTokens, usageComplete,
  estimatedUsd: usageComplete && price ? (inputTokens * price.input + outputTokens * price.output) / 1e6 : null, measuredUsd: null };
console.log(JSON.stringify(summary));
if (option('--output-prefix')) {
  const filename = option('--output-prefix') + '.json'; await mkdir(dirname(filename), { recursive: true });
  await writeFile(filename, JSON.stringify({ ...summary, records }, null, 2) + '\n');
}
function accountUsage(value: Parameters<typeof usage>[0]) { const valid = usage(value); usageComplete &&= valid; return valid; }

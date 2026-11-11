import type OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { Emit, MessageDTO, TurnStats } from '../../shared/types';
import type { Config } from '../config';

export type Llm = Pick<OpenAI, 'chat'>;
export type TurnResult = { text: string; status: MessageDTO['status']; stats: TurnStats };
export type RunTurn = (input: { messages: MessageDTO[]; signal: AbortSignal; emit: Emit }) => Promise<TurnResult>;

export function createRunTurn(llm: Llm, config: Config): RunTurn {
  return async ({ messages, signal, emit }) => {
    const started = performance.now();
    const stats: TurnStats = { searches: 0, sources: 0, latencyMs: 0, ttftMs: null, inputTokens: 0, outputTokens: 0 };
    let text = '';
    let status: MessageDTO['status'] = 'complete';
    try {
      signal.throwIfAborted();
      const context: ChatCompletionMessageParam[] = [
        { role: 'system', content: 'You are Reprise, a helpful conversational assistant. Web search and cross-conversation recall are not available in this milestone. Do not claim to have searched or recalled other conversations.' },
        ...messages.map(({ role, content }) => ({ role, content })),
      ];
      const stream = await llm.chat.completions.create({
        model: config.LLM_MODEL, messages: context, stream: true,
        stream_options: { include_usage: true }, tool_choice: 'none',
        ...(config.LLM_REASONING_EFFORT ? { reasoning_effort: config.LLM_REASONING_EFFORT } : {}),
      }, { signal });
      let finished = false;
      for await (const chunk of stream) {
        signal.throwIfAborted();
        const choice = chunk.choices[0];
        if (choice?.delta.tool_calls?.length) throw new Error('Unexpected tool call with tools disabled.');
        if (choice?.delta.content) {
          stats.ttftMs ??= Math.round(performance.now() - started);
          text += choice.delta.content;
          await emit({ type: 'answer.delta', text: choice.delta.content });
        }
        if (chunk.usage) {
          stats.inputTokens = chunk.usage.prompt_tokens;
          stats.outputTokens = chunk.usage.completion_tokens;
        }
        if (choice?.finish_reason) {
          if (choice.finish_reason !== 'stop') throw new Error('Model did not finish its answer.');
          finished = true;
        }
      }
      if (!finished || !text.trim()) throw new Error('Model stream ended without a complete answer.');
      signal.throwIfAborted();
    } catch {
      status = signal.aborted ? 'interrupted' : 'failed';
    }
    stats.latencyMs = Math.round(performance.now() - started);
    return { text, status, stats };
  };
}

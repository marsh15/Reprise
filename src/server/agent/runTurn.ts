import type OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { Emit, MessageDTO, TurnStats } from '../../shared/types';
import type { Evidence, Search, SourceRecord } from '../../shared/research';
import { clipHistoricalText } from '../memory/context';
import type { RecallPacket } from '../../shared/memory';
import type { Config } from '../config';
import { chatToolParameters } from '../llm/client';
import { createSearchWeb } from '../search/tavily';
import { createClock } from '../clock';
import { BUDGET } from './budget';
import { assembleMessages, buildContextBlock } from './prompt';
import { createSourceRegistry } from './sourceRegistry';
import { checkCitations } from './citations';
import { modelStep } from './modelStep';
import { researchRound, type ResearchBudget } from './researchRound';

export type Llm = Pick<OpenAI, 'chat'>;
export type TurnResult = { text: string; status: MessageDTO['status']; stats: TurnStats; evidence?: Evidence; error?: string };
export type RunTurn = (input: { messages: MessageDTO[]; signal: AbortSignal; emit: Emit;
  timezone?: string; historyStart?: string | null; carriedSources?: SourceRecord[]; packet?: RecallPacket }) => Promise<TurnResult>;
const FINAL_NOTE = 'Research budget reached. Answer now using the evidence above; say clearly what you could not verify.';
export function createRunTurn(llm: Llm, config: Config, options: {
  search?: Search; now?: () => Date; budget?: Partial<ResearchBudget>;
} = {}): RunTurn {
  chatToolParameters(config);
  const search = options.search ?? createSearchWeb(config.TAVILY_API_KEY);
  const now = options.now ?? createClock(config.REPRISE_NOW).now;
  const budget = { ...BUDGET, ...options.budget };
  return async ({ messages, signal, emit, timezone = 'UTC', historyStart = null, carriedSources = [], packet }) => {
    const started = performance.now();
    const stats: TurnStats = { searches: 0, sources: 0, latencyMs: 0, ttftMs: null, inputTokens: 0, outputTokens: 0, usageComplete: true, modelCalls: 0, toolCalls: 0, invalidToolCalls: 0 };
    const userText = messages.at(-1)?.content ?? '';
    const memory: RecallPacket = packet ?? { nowLocal: new Intl.DateTimeFormat('en-GB', { timeZone: timezone, dateStyle: 'full', timeStyle: 'long' }).format(now()) + ` (${timezone})`,
      historyStart, resolutions: [], recalledTurns: [], index: [], currentConversation: messages.slice(0, -1), carriedSources, notes: [], clarification: null };
    const initialSources = [...memory.recalledTurns.flatMap(t => t.sources), ...memory.carriedSources];
    const registry = createSourceRegistry(initialSources.map(source => ({ ...source, excerpt: clipHistoricalText(source.excerpt, 600) })));
    const evidence: Evidence = { searches: [], sources: registry.sources, citations: [] };
    const seen = new Set<string>();
    const researchSignal = AbortSignal.any([signal, AbortSignal.timeout(budget.researchDeadlineMs)]);
    const recalledIds = new Set(memory.recalledTurns.flatMap(t => [t.userMessage.id, ...(t.assistantMessage ? [t.assistantMessage.id] : [])]));
    const recent = memory.currentConversation.filter(message => !recalledIds.has(message.id));
    const context: ChatCompletionMessageParam[] = assembleMessages([...recent, messages.at(-1)!], buildContextBlock(memory, registry.sources, userText));
    let text = ''; let errorCode: string | undefined; let status: MessageDTO['status'] = 'complete';
    try {
      if (memory.clarification) { text = memory.clarification; await emit({ type: 'answer.delta', text }); }
      for (let round = 1; !memory.clarification && round <= budget.maxRounds + 1; round++) {
        signal.throwIfAborted();
        const toolsAllowed = round <= budget.maxRounds && !researchSignal.aborted && seen.size < budget.maxQueriesPerTurn;
        if (!toolsAllowed) context.push({ role: 'system', content: FINAL_NOTE });
        let calls;
        try {
          calls = await modelStep({ llm, config, messages: context, signal: toolsAllowed ? researchSignal : signal,
            toolsAllowed, emit, stats, started, onText: draft => { text = draft; }, onReset: () => { text = ''; } });
        } catch (error) {
          if (toolsAllowed && researchSignal.aborted && !signal.aborted) {
            text = ''; stats.ttftMs = null; stats.usageComplete = false;
            await emit({ type: 'answer.reset' });
            // A truncated model step has no complete tool-call message to replay.
            context.push({ role: 'system', content: FINAL_NOTE });
            await modelStep({ llm, config, messages: context, signal, toolsAllowed: false, emit, stats, started,
              onText: draft => { text = draft; }, onReset: () => { text = ''; } });
            break;
          }
          throw error;
        }
        if (!calls.length) break;
        stats.toolCalls = (stats.toolCalls ?? 0) + calls.length;
        context.push({ role: 'assistant', content: null, tool_calls: calls });
        const results = await researchRound({ calls, round, budget, seen, searches: evidence.searches,
          registry, search, signal: researchSignal, emit, now, stats });
        context.push(...results);
      }
      signal.throwIfAborted();
    } catch (error) {
      status = signal.aborted ? 'interrupted' : 'failed'; stats.usageComplete = false;
      errorCode = signal.aborted ? 'cancelled' : error && typeof error === 'object' && 'status' in error && typeof error.status === 'number' ? `llm_http_${error.status}` : 'model_or_stream_failure';
    }
    evidence.citations = checkCitations(text, registry.entries);
    stats.searches = seen.size; stats.sources = registry.entries.size;
    stats.latencyMs = Math.round(performance.now() - started);
    return { text, status, stats, evidence, ...(errorCode ? { error: errorCode } : {}) };
  };
}

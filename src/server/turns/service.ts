import { randomUUID } from 'node:crypto';
import type { Emit, TurnRequest, TurnStats } from '../../shared/types';
import type { Clock } from '../clock';
import type { Repo, StoredMessage } from '../db/repo';
import { recall } from '../memory/recall';
import { recallItems } from '../../shared/memory';
import type { RunTurn } from '../agent/runTurn';

export class TurnError extends Error {
  constructor(public code: string, message: string, public status: 404 | 409) { super(message); }
}

export function createTurnService(repo: Repo, runTurn: RunTurn, clock: Clock, model: string) {
  const active = new Map<string, { controller: AbortController; done: Promise<void> }>();
  const deleting = new Set<string>();
  let closing = false;
  function prepare(input: TurnRequest) {
    if (closing) throw new TurnError('shutting_down', 'Server is shutting down. Retry shortly.', 409);
    const existing = repo.findClientMessage(input.clientMessageId);
    if (existing && (input.conversationId && existing.conversationId !== input.conversationId || existing.content !== input.text || input.retryOfUserMessageId && input.retryOfUserMessageId !== existing.id)) {
      throw new TurnError('idempotency_conflict', 'This request id belongs to a different message.', 409);
    }
    let user: StoredMessage;
    if (existing && deleting.has(existing.conversationId)) throw new TurnError('conversation_deleting', 'Conversation is being deleted.', 409);
    if (existing) {
      const reply = repo.getReply(existing.id);
      if (active.has(existing.conversationId)) throw new TurnError('turn_in_progress', 'An answer is already running.', 409);
      if (reply?.status === 'complete') return replay(existing, reply);
      if (!input.retryOfUserMessageId) return replay(existing, reply);
    }
    const conversationId = input.conversationId ?? existing?.conversationId;
    if (conversationId && !repo.getConversation(conversationId)) throw new TurnError('not_found', 'Conversation not found.', 404);
    if (conversationId && deleting.has(conversationId)) throw new TurnError('conversation_deleting', 'Conversation is being deleted.', 409);
    if (conversationId && active.has(conversationId)) throw new TurnError('turn_in_progress', 'An answer is already running.', 409);
    if (input.retryOfUserMessageId) {
      const original = repo.getMessage(input.retryOfUserMessageId);
      if (!original || original.role !== 'user' || original.conversationId !== conversationId || original.content !== input.text || existing && existing.id !== original.id) {
        throw new TurnError('invalid_retry', 'Retry must refer to the saved user message in this conversation.', 409);
      }
      const latestUser = repo.getConversationMessages(conversationId!).filter(m => m.role === 'user').at(-1);
      if (latestUser?.id !== original.id || repo.getReply(original.id)?.status === 'complete') {
        throw new TurnError('invalid_retry', 'Only the latest unanswered or incomplete user message can be retried.', 409);
      }
      user = original;
    } else {
      const fields = { clientMessageId: input.clientMessageId, text: input.text, timezone: input.timezone, now: clock.now() };
      user = conversationId ? repo.insertUserMessage({ ...fields, conversationId }) : repo.startConversation(fields);
    }
    const controller = new AbortController();
    const assistantMessageId = randomUUID();
    const traceId = randomUUID();
    let finish!: () => void;
    const done = new Promise<void>(resolve => { finish = resolve; });
    active.set(user.conversationId, { controller, done });
    return {
      conversationId: user.conversationId,
      abort: () => controller.abort(),
      run: async (emit: Emit) => {
        // A broken response must never prevent the result from being persisted.
        const send: Emit = async event => {
          if (controller.signal.aborted) return;
          try { await emit(event); } catch { controller.abort(); }
        };
        try {
          await send({ type: 'turn.started', conversationId: user.conversationId, userMessageId: user.id, assistantMessageId, traceId });
          const packet = recall(repo, { text: user.content, conversationId: user.conversationId, userMessageId: user.id, now: clock.now(), tz: input.timezone });
          const items = recallItems(packet);
          await send({ type: 'recall', items, resolutions: packet.resolutions });
          const result = await runTurn({ packet, userText: user.content, signal: controller.signal, emit: send });
          if (controller.signal.aborted) result.status = 'interrupted';
          repo.insertAssistantTurn({ id: assistantMessageId, user, ...result, recall: items, assumptions: packet.resolutions, now: clock.now(), model });
          if (result.evidence) await send({ type: 'citations', citations: result.evidence.citations, sources: result.evidence.sources });
          // Cancellation via endpoint keeps SSE connected, so its terminal event still reaches the client.
          const terminal = result.status === 'complete'
            ? { type: 'turn.completed' as const, assistantMessageId, stats: result.stats }
            : { type: 'turn.error' as const, code: result.status === 'interrupted' ? 'cancelled' as const : 'llm_unavailable' as const,
              message: result.status === 'interrupted' ? 'Answer stopped.' : "I couldn't finish this answer — the model didn't respond.", retryable: true };
          await emit(terminal);
        } catch {
          try { await emit({ type: 'turn.error', code: 'internal', message: 'Could not save the answer. Your message is saved; retry it.', retryable: true }); } catch { /* Disconnected client. */ }
        } finally {
          active.delete(user.conversationId);
          finish();
        }
      },
    };
  }
  function replay(user: StoredMessage, reply?: StoredMessage) {
    return {
      conversationId: user.conversationId, abort: () => {},
      run: async (emit: Emit) => {
        await emit({ type: 'turn.started', conversationId: user.conversationId, userMessageId: user.id, assistantMessageId: reply?.id ?? randomUUID(), traceId: randomUUID() });
        if (reply?.status === 'complete') {
          const stats = JSON.parse(reply.meta!) as TurnStats;
          await emit({ type: 'turn.completed', assistantMessageId: reply.id, stats });
        } else {
          await emit({ type: 'turn.error', code: reply?.status === 'failed' ? 'llm_unavailable' : 'cancelled',
            message: 'The previous attempt did not finish. Retry the saved user message.', retryable: true });
        }
      },
    };
  }
  function cancel(id: string) { const turn = active.get(id); turn?.controller.abort(); return Boolean(turn); }
  async function cancelAndWait(id: string) { const turn = active.get(id); turn?.controller.abort(); await turn?.done; }
  async function deleteConversation(id: string) {
    deleting.add(id);
    try { await cancelAndWait(id); repo.deleteConversation(id); }
    finally { deleting.delete(id); }
  }
  return { prepare, cancel, deleteConversation, shutdown: async () => {
    closing = true;
    for (const turn of active.values()) turn.controller.abort();
    await Promise.all([...active.values()].map(turn => turn.done));
  } };
}
export type TurnService = ReturnType<typeof createTurnService>;

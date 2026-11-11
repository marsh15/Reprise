import { z } from 'zod';

export const turnRequestSchema = z.object({
  conversationId: z.uuid().optional(),
  clientMessageId: z.uuid(),
  text: z.string().trim().min(1).max(8000),
  timezone: z.string().min(1).max(100),
  retryOfUserMessageId: z.uuid().optional(),
});
export type TurnRequest = z.infer<typeof turnRequestSchema>;
export const statsSchema = z.object({
  searches: z.number(), sources: z.number(), latencyMs: z.number(), ttftMs: z.number().nullable(),
  inputTokens: z.number(), outputTokens: z.number(),
});
export type TurnStats = z.infer<typeof statsSchema>;
export const messageSchema = z.object({
  id: z.uuid(), role: z.enum(['user', 'assistant']), content: z.string(),
  status: z.enum(['complete', 'interrupted', 'failed']), createdAt: z.string(),
  localDate: z.string(), seq: z.number().int(), replyTo: z.string().nullable(),
});
export type MessageDTO = z.infer<typeof messageSchema>;
export const conversationSchema = z.object({
  id: z.uuid(), title: z.string(), origin: z.enum(['live', 'fixture']),
  createdAt: z.string(), updatedAt: z.string(), preview: z.string(),
});
export type Conversation = z.infer<typeof conversationSchema>;
export const conversationDetailSchema = z.object({ conversation: conversationSchema, messages: z.array(messageSchema) });
export const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string(), retryable: z.boolean() }) });

// M1 events only. Search, recall, and citations enter with their owning milestones.
export const turnEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('turn.started'), conversationId: z.uuid(), userMessageId: z.uuid(), assistantMessageId: z.uuid(), traceId: z.uuid() }),
  z.object({ type: z.literal('answer.delta'), text: z.string() }),
  z.object({ type: z.literal('answer.reset') }),
  z.object({ type: z.literal('turn.completed'), assistantMessageId: z.uuid(), stats: statsSchema }),
  z.object({ type: z.literal('turn.error'), code: z.enum(['llm_unavailable', 'cancelled', 'internal']), message: z.string(), retryable: z.boolean() }),
]);
export type TurnEvent = z.infer<typeof turnEventSchema>;
export type Emit = (event: TurnEvent) => Promise<void>;

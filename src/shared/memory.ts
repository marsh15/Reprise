import { z } from 'zod';
import type { SourceRecord } from './research';
import type { MessageDTO } from './types';

export const recallItemSchema = z.object({
  conversationId: z.uuid(), messageId: z.uuid(), localDate: z.string(), title: z.string(), origin: z.enum(['live', 'fixture']),
});
export type RecallItem = z.infer<typeof recallItemSchema>;
export const resolutionSchema = z.object({
  phrase: z.string(), chosen: z.union([z.string(), z.object({ from: z.string(), to: z.string() })]).nullable(),
  alternatives: z.array(z.string()), assumption: z.string().nullable(), note: z.string().nullable(),
});
export type ResolvedMemoryDate = z.infer<typeof resolutionSchema>;
export type RecalledTurn = {
  conversationId: string; conversationTitle: string; origin: 'live' | 'fixture';
  userMessage: { id: string; content: string; localDate: string; createdAt: string };
  assistantMessage: { id: string; content: string; status: string } | null;
  sources: SourceRecord[]; reason: 'date' | 'topic' | 'date+topic';
};
export type RecallPacket = {
  nowLocal: string; historyStart: string | null; resolutions: ResolvedMemoryDate[]; recalledTurns: RecalledTurn[];
  index: { conversationId: string; title: string; firstLocalDate: string; origin: 'live' | 'fixture'; turns: number }[];
  currentConversation: MessageDTO[]; carriedSources: SourceRecord[]; notes: string[];
  clarification: string | null;
};
export function recallItems(packet: RecallPacket): RecallItem[] {
  return packet.recalledTurns.map(turn => ({ conversationId: turn.conversationId, messageId: turn.userMessage.id,
    localDate: turn.userMessage.localDate, title: turn.conversationTitle, origin: turn.origin }));
}

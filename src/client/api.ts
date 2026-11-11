import { z } from 'zod';
import { conversationSchema, conversationDetailSchema, errorSchema, turnEventSchema } from '../shared/types';
import type { TurnEvent, TurnRequest } from '../shared/types';

async function checked(response: Response) {
  if (response.ok) return response;
  const parsed = errorSchema.safeParse(await response.json().catch(() => null));
  throw new Error(parsed.success ? parsed.data.error.message : `Request failed (${response.status}).`);
}
export const listConversations = async () => z.object({ conversations: z.array(conversationSchema) }).parse(await (await checked(await fetch('/api/conversations'))).json()).conversations;
export const getConversation = async (id: string) => conversationDetailSchema.parse(await (await checked(await fetch(`/api/conversations/${id}`))).json());
export const deleteConversation = async (id: string) => { await checked(await fetch(`/api/conversations/${id}`, { method: 'DELETE' })); };
export const cancelTurn = async (id: string) => {
  const response = await fetch(`/api/conversations/${id}/cancel`, { method: 'POST' });
  if (response.status !== 404) await checked(response);
};

// POST needs fetch rather than EventSource. Frames and UTF-8 characters can span reads.
export async function readEvents(body: ReadableStream<Uint8Array>, onEvent: (event: TurnEvent) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let event = '';
  let data: string[] = [];
  let terminal = false;
  function line(value: string) {
    if (!value) {
      if (data.length) {
        const parsed = turnEventSchema.parse({ ...JSON.parse(data.join('\n')), type: event });
        onEvent(parsed);
        terminal = parsed.type === 'turn.completed' || parsed.type === 'turn.error';
      }
      event = ''; data = [];
    } else if (value.startsWith('event:')) event = value.slice(6).trim();
    else if (value.startsWith('data:')) data.push(value.slice(5).replace(/^ /, ''));
  }
  try {
    while (!terminal) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        line(buffer.slice(0, newline).replace(/\r$/, ''));
        buffer = buffer.slice(newline + 1);
        if (terminal) break;
      }
      if (done) break;
    }
    if (!terminal) throw new Error('Connection lost before the answer was saved. Retry the saved message.');
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export async function sendTurn(input: TurnRequest, signal: AbortSignal, onEvent: (event: TurnEvent) => void) {
  const response = await checked(await fetch('/api/turns', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal,
  }));
  if (!response.headers.get('content-type')?.includes('text/event-stream') || !response.body) throw new Error('Expected an event stream.');
  await readEvents(response.body, onEvent);
}

import type { MessageDTO, TurnEvent } from '../shared/types';
export type ChatState = { messages: MessageDTO[]; busy: boolean; assistantId: string | null; error: string | null };
export const initialState: ChatState = { messages: [], busy: false, assistantId: null, error: null };
type Action = { type: 'load'; messages: MessageDTO[] } | { type: 'begin'; user: MessageDTO; retry: boolean } | { type: 'event'; event: TurnEvent } | { type: 'error'; message: string } | { type: 'idle' };
export function chatReducer(state: ChatState, action: Action): ChatState {
  switch (action.type) {
    case 'load': return { ...state, messages: action.messages };
    case 'begin': return { ...state, busy: true, error: null, messages: action.retry ? state.messages : [...state.messages, action.user] };
    case 'idle': return { ...state, busy: false };
    case 'error': return { ...state, busy: false, error: action.message };
    case 'event': {
      const event = action.event;
      switch (event.type) {
        case 'turn.started': {
          const messages = state.messages.map(m => m.id === 'pending' ? { ...m, id: event.userMessageId } : m);
          if (!messages.some(m => m.id === event.assistantMessageId)) messages.push({ id: event.assistantMessageId, role: 'assistant', content: '', status: 'complete', createdAt: new Date().toISOString(), localDate: '', seq: messages.length + 1, replyTo: event.userMessageId });
          return { ...state, messages, assistantId: event.assistantMessageId };
        }
        case 'recall': return { ...state, messages: state.messages.map(message => message.id === state.assistantId ? { ...message, recall: event.items } : message) };
        case 'search.started':
        case 'search.finished':
        case 'citations': return { ...state, messages: state.messages.map(message => {
          if (message.id !== state.assistantId) return message;
          const evidence = message.evidence ?? { searches: [], sources: [], citations: [] };
          if (event.type === 'search.started') return { ...message, evidence: {
            ...evidence, searches: [...evidence.searches, ...event.searches],
          } };
          if (event.type === 'search.finished') return { ...message, evidence: {
            ...evidence, searches: [...evidence.searches.filter(search => search.id !== event.search.id), event.search],
            sources: [...evidence.sources, ...event.sources],
          } };
          return { ...message, evidence: { ...evidence, sources: event.sources ?? evidence.sources, citations: event.citations } };
        }) };
        case 'answer.delta': return { ...state, messages: state.messages.map(m => m.id === state.assistantId ? { ...m, content: m.content + event.text } : m) };
        case 'answer.reset': return { ...state, messages: state.messages.map(m => m.id === state.assistantId ? { ...m, content: '' } : m) };
        case 'turn.completed': return { ...state, busy: false };
        case 'turn.error': return { ...state, busy: false, error: event.message, messages: state.messages.map(m => m.id === state.assistantId ? { ...m, status: event.code === 'cancelled' ? 'interrupted' : 'failed' } : m) };
      }
    }
  }
}

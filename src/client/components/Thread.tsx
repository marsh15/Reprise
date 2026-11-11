import { useEffect, useReducer, useRef, useState } from 'react';
import { cancelTurn, getConversation, sendTurn } from '../api';
import { chatReducer, initialState } from '../state';
import { turnRequestSchema, type MessageDTO, type TurnRequest } from '../../shared/types';
import { Message } from './Message';
import { Composer } from './Composer';

export function Thread({ conversationId, onCreated, onChange }: { conversationId: string | null; onCreated: (id: string) => void; onChange: () => void }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const [loading, setLoading] = useState(Boolean(conversationId));
  const id = useRef(conversationId);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const unacknowledged = useRef<TurnRequest | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    mounted.current = true;
    if (!conversationId) {
      try {
        const saved = turnRequestSchema.safeParse(JSON.parse(sessionStorage.getItem('reprise.pending') ?? 'null'));
        if (saved.success && !saved.data.conversationId) {
          unacknowledged.current = saved.data;
          dispatch({ type: 'load', messages: [pendingUser(saved.data.text)] });
          dispatch({ type: 'error', message: 'The last request was not acknowledged. Retry it safely with the same request id.' });
        }
      } catch { sessionStorage.removeItem('reprise.pending'); }
    }
    if (conversationId) void getConversation(conversationId).then(detail => {
      if (mounted.current) dispatch({ type: 'load', messages: detail.messages });
    }).catch(error => { if (mounted.current) dispatch({ type: 'error', message: error.message }); })
      .finally(() => { if (mounted.current) setLoading(false); });
    return () => { mounted.current = false; request.current?.abort(); };
  }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [state.messages]);
  async function send(text: string, retry?: MessageDTO) {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller;
    const recovering = retry?.id === 'pending' && unacknowledged.current;
    const input: TurnRequest = recovering || { conversationId: id.current ?? undefined, clientMessageId: crypto.randomUUID(), text,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, retryOfUserMessageId: retry?.id };
    unacknowledged.current = input;
    sessionStorage.setItem('reprise.pending', JSON.stringify(input));
    dispatch({ type: 'begin', retry: Boolean(retry), user: pendingUser(text) });
    try {
      await sendTurn(input, controller.signal, event => {
        if (!mounted.current) return;
        if (event.type === 'turn.started') {
          unacknowledged.current = null; sessionStorage.removeItem('reprise.pending');
          id.current = event.conversationId; onCreated(event.conversationId);
        }
        dispatch({ type: 'event', event });
      });
    } catch (error) {
      if (mounted.current) dispatch({ type: 'error', message: error instanceof Error ? error.message : 'Connection lost. Retry your message.' });
    } finally {
      request.current = null;
      if (mounted.current) {
        // The DB is authoritative, including completed-request replay and failed attempts.
        if (id.current) {
          try { const detail = await getConversation(id.current); dispatch({ type: 'load', messages: detail.messages }); }
          catch { /* Keep the visible transcript and connection error. */ }
        }
        dispatch({ type: 'idle' }); onChange();
      }
    }
  }
  function stop() {
    if (id.current) void cancelTurn(id.current).catch(() => request.current?.abort());
    else request.current?.abort();
  }
  const lastUser = state.messages.findLast(message => message.role === 'user');
  const reply = lastUser && state.messages.findLast(message => message.replyTo === lastUser.id);
  const retryable = lastUser && (!reply || reply.status !== 'complete');
  return <main className="chat">
    <div className="thread" aria-busy={state.busy}>
      {loading ? <p>Loading conversation…</p> : state.messages.length === 0 ? <div className="empty">
        <p className="eyebrow">A conversation worth coming back to</p><h1>Ask me anything.</h1>
        <p>I search the web when it helps and cite what I find. Your chats and sources are saved on this device.</p>
        {["What's new in the latest Postgres release?", 'Compare Neon and Supabase pricing for a small team', 'What makes a good API?'].map(text => <button key={text} onClick={() => void send(text)}>{text}</button>)}
      </div> : state.messages.map(message => <Message key={message.id} message={message} running={state.busy && message.id === state.assistantId} />)}
      {state.busy && <p role="status">Writing…</p>}
      {state.error && <p role="alert" className="error">{state.error}</p>}
      {!state.busy && retryable && <button onClick={() => void send(lastUser.content, lastUser)}>Retry answer</button>}
      <div ref={bottom} />
    </div>
    <Composer busy={state.busy} disabled={loading || Boolean(unacknowledged.current) && !state.busy} onSend={send} onStop={stop} />
  </main>;
}

function pendingUser(text: string): MessageDTO {
  return { id: 'pending', role: 'user', content: text, status: 'complete', createdAt: new Date().toISOString(), localDate: '', seq: 0, replyTo: null };
}

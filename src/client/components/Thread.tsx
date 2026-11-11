import { useEffect, useReducer, useRef, useState } from 'react';
import { cancelTurn, getConversation, sendTurn } from '../api';
import { chatReducer, initialState } from '../state';
import { turnRequestSchema, type MessageDTO, type TurnRequest } from '../../shared/types';
import { Message } from './Message';
import { Composer } from './Composer';
import type { RecallItem } from '../../shared/memory';

export function Thread({ conversationId, onCreated, onChange, historyEmpty = false, target, onRecall, onTargetHandled }: { conversationId: string | null; onCreated: (id: string) => void; onChange: () => void; historyEmpty?: boolean; target: RecallItem | null; onRecall: (item: RecallItem) => void; onTargetHandled: () => void }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loading, setLoading] = useState(Boolean(conversationId));
  const [loadError, setLoadError] = useState(false);
  const following = useRef(true);
  const id = useRef(conversationId);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const unacknowledged = useRef<TurnRequest | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  async function load() {
    setLoading(true); setLoadError(false);
    try {
      const detail = await getConversation(conversationId!);
      if (!mounted.current) return;
      const pending = unacknowledged.current;
      const lastUser = detail.messages.findLast(message => message.role === 'user');
      dispatch({ type: 'load', messages: pending && lastUser?.content !== pending.text ? [...detail.messages, pendingUser(pending.text)] : detail.messages });
    } catch { if (mounted.current) setLoadError(true); }
    finally { if (mounted.current) setLoading(false); }
  }
  useEffect(() => {
    mounted.current = true;
    try {
      const saved = turnRequestSchema.safeParse(JSON.parse(sessionStorage.getItem('reprise.pending') ?? 'null'));
      if (saved.success && (saved.data.conversationId ?? null) === conversationId) {
        unacknowledged.current = saved.data;
        dispatch({ type: 'load', messages: [pendingUser(saved.data.text)] });
        dispatch({ type: 'error', message: 'The last request was not acknowledged. Retry to recover your saved message.' });
      }
    } catch { /* Storage may be unavailable; the server still retains acknowledged messages. */ }
    if (conversationId) void load();
    return () => { mounted.current = false; request.current?.abort(); if (highlightTimer.current) clearTimeout(highlightTimer.current); };
  }, []);
  useEffect(() => { if (following.current && !target && !highlighted) bottom.current?.scrollIntoView({ block: 'end' }); }, [state.messages]);
  useEffect(() => {
    if (!target || loading) return;
    if (loadError) { onTargetHandled(); return; }
    const message = state.messages.find(item => item.id === target.messageId && item.role === 'user');
    const element = message && document.getElementById(`message-${message.id}`);
    if (element && message) {
      setNavigationError(null);
      element.scrollIntoView({ block: 'center' }); element.focus({ preventScroll: true });
      setHighlighted(message.id);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      highlightTimer.current = setTimeout(() => setHighlighted(null), 2000);
    } else {
      setNavigationError('The recalled conversation or message could not be found. It may have been deleted.');
    }
    onTargetHandled();
  }, [target, loading, loadError, state.messages, onTargetHandled]);
  async function send(text: string, retry?: MessageDTO) {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller;
    const recovering = retry && unacknowledged.current;
    const input: TurnRequest = recovering || { conversationId: id.current ?? undefined, clientMessageId: crypto.randomUUID(), text,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, retryOfUserMessageId: retry?.id };
    unacknowledged.current = input;
    try { sessionStorage.setItem('reprise.pending', JSON.stringify(input)); } catch { /* Sending works without browser storage. */ }
    following.current = true; setNavigationError(null);
    dispatch({ type: 'begin', retry: Boolean(retry), user: pendingUser(text) });
    try {
      await sendTurn(input, controller.signal, event => {
        if (!mounted.current || request.current !== controller) return;
        if (event.type === 'turn.started') {
          unacknowledged.current = null;
          try { sessionStorage.removeItem('reprise.pending'); } catch { /* Browser storage is optional. */ }
          id.current = event.conversationId; onCreated(event.conversationId);
        }
        dispatch({ type: 'event', event });
      });
    } catch (error) {
      if (mounted.current) dispatch({ type: 'error', message: controller.signal.aborted ? 'Answer interrupted. Retry your saved message.' : error instanceof Error ? error.message : 'Connection lost. Retry your saved message.' });
    } finally {
      if (mounted.current) {
        // The DB is authoritative, including completed-request replay and failed attempts.
        if (id.current && !unacknowledged.current) {
          try { const detail = await getConversation(id.current, AbortSignal.timeout(5000)); if (mounted.current) dispatch({ type: 'load', messages: detail.messages }); }
          catch { if (mounted.current) setNavigationError('Could not refresh this conversation. Reopen it from the conversation list to load saved messages.'); }
        }
        if (mounted.current) { request.current = null; dispatch({ type: 'idle' }); onChange(); }
      }
    }
  }
  function stop() {
    const controller = request.current;
    if (id.current && !unacknowledged.current) void cancelTurn(id.current).catch(() => controller?.abort());
    else controller?.abort();
  }
  const lastUser = state.messages.findLast(message => message.role === 'user');
  const reply = lastUser && state.messages.findLast(message => message.replyTo === lastUser.id);
  const retryable = lastUser && (unacknowledged.current || !reply || reply.status !== 'complete');
  const active = state.messages.find(message => message.id === state.assistantId);
  const searching = active?.evidence?.searches.some(search => search.status === 'error' && !search.error);
  const status = !state.busy ? '' : !state.assistantId ? 'Sending…' : searching ? 'Researching…' : active?.content ? 'Writing answer…' : 'Thinking…';
  return <main id="chat" className="chat" tabIndex={-1} aria-label="Conversation">
    <div className="thread" aria-busy={loading} onScroll={event => {
      const element = event.currentTarget; following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    }}>
      {loading ? <p role="status">Loading conversation…</p> : loadError ? <div role="alert" className="error"><p>Could not load this conversation. It may be unavailable or deleted.</p><button onClick={() => void load()}>Try loading again</button></div> : state.messages.length === 0 ? <div className="empty">
        <p className="eyebrow">A conversation worth coming back to</p><h1>Ask me anything.</h1>
        <p>I search the web when it helps, cite what I find, and remember our past conversations. Conversations are saved on this device.</p>
        {["What's new in the latest Postgres release?", 'Compare Neon and Supabase pricing for a small team', 'What did we talk about yesterday?'].map(text => <button key={text} onClick={() => void send(text)}>{text}</button>)}
        {historyEmpty && <p className="research-muted">Tip: run <code>npm run seed:demo</code> to add labelled demo history.</p>}
      </div> : state.messages.map(message => <Message key={message.id} message={message} running={state.busy && message.id === state.assistantId} onRecall={onRecall} highlighted={message.id === highlighted} />)}
      <p className="turn-status" role="status" aria-live="polite" aria-atomic="true">{status || (state.assistantId && active?.status === 'complete' ? 'Answer complete.' : '')}</p>
      {navigationError && <p role="alert" className="error">{navigationError}</p>}
      {state.error && <p role="alert" className="error">{state.error}</p>}
      {!loading && !loadError && !state.busy && !request.current && retryable && <button onClick={() => void send(lastUser.content, lastUser)}>Retry answer</button>}
      <div ref={bottom} />
    </div>
    <Composer busy={state.busy} disabled={loading || loadError || !state.busy && Boolean(request.current || unacknowledged.current)} onSend={send} onStop={stop} />
  </main>;
}

function pendingUser(text: string): MessageDTO {
  return { id: 'pending', role: 'user', content: text, status: 'complete', createdAt: new Date().toISOString(), localDate: '', seq: 0, replyTo: null };
}

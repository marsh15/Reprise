import { useEffect, useReducer, useRef, useState } from 'react';
import { cancelTurn, getConversation, sendTurn } from '../api';
import { chatReducer, initialState } from '../state';
import { turnRequestSchema, type MessageDTO, type TurnRequest } from '../../shared/types';
import { Message } from './Message';
import { Composer } from './Composer';
import { DemoTag, IconArrowRight, IconReturn, IconWarning, Mark } from './Glyphs';
import type { RecallItem } from '../../shared/memory';
import type { Conversation } from '../../shared/types';

const startingPoints = [
  { text: "What's new in the latest Postgres release?", kind: 'current' as const },
  { text: 'Compare Neon and Supabase pricing for a small team', kind: 'current' as const },
  { text: 'What did we talk about yesterday?', kind: 'historical' as const },
];

export function Thread({ conversationId, title = null, origin, onCreated, onChange, historyEmpty = false, target, onRecall, onTargetHandled }: { conversationId: string | null; title?: string | null; origin?: Conversation['origin']; onCreated: (id: string) => void; onChange: () => void; historyEmpty?: boolean; target: RecallItem | null; onRecall: (item: RecallItem) => void; onTargetHandled: () => void }) {
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
  const stopRequested = useRef(false); // presentation only: tells a user-initiated Stop from a failure
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
  useEffect(() => { if (following.current && !target && !highlighted && state.messages.length) bottom.current?.scrollIntoView({ block: 'end' }); }, [state.messages]); // no messages: nothing to follow, so the empty state stays at the top on short screens
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
    const controller = new AbortController(); request.current = controller; stopRequested.current = false;
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
    const controller = request.current; stopRequested.current = true;
    if (id.current && !unacknowledged.current) void cancelTurn(id.current).catch(() => controller?.abort());
    else controller?.abort();
  }
  const lastUser = state.messages.findLast(message => message.role === 'user');
  const reply = lastUser && state.messages.findLast(message => message.replyTo === lastUser.id);
  const retryable = lastUser && (unacknowledged.current || !reply || reply.status !== 'complete');
  const active = state.messages.find(message => message.id === state.assistantId);
  const searching = active?.evidence?.searches.some(search => search.status === 'error' && !search.error);
  const status = !state.busy ? '' : !state.assistantId ? 'Sending…' : searching ? 'Researching…' : active?.content ? 'Writing answer…' : 'Thinking…';
  const empty = !loading && !loadError && state.messages.length === 0;
  // A user Stop that ended the reply reads as a warning, not an error. Failures and transport errors stay errors.
  const stopped = reply?.status === 'interrupted' && stopRequested.current;
  // The date line is shown once per local calendar day; the time is always shown.
  let previousDay: string | null = null;
  const showDate = state.messages.map(message => {
    const day = message.localDate ? new Date(message.createdAt).toDateString() : null;
    const first = day !== null && day !== previousDay;
    if (day) previousDay = day;
    return first;
  });
  const showRetry = !loading && !loadError && !state.busy && !request.current && retryable;
  const Title = empty || !conversationId ? 'p' : 'h1';
  return <main id="chat" className="chat" tabIndex={-1} aria-label="Conversation">
    <div className="context-bar">
      <Title className={`context-title${conversationId ? '' : ' is-placeholder'}`} title={conversationId ? title ?? undefined : undefined}>{conversationId ? title || 'Untitled conversation' : 'New conversation'}</Title>
      {conversationId && origin === 'fixture' && <DemoTag />}
    </div>
    <div className="thread" aria-busy={loading} onScroll={event => {
      const element = event.currentTarget; following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    }}>
      <div className={`thread-column${empty ? ' is-empty' : ''}${navigationError || state.error || showRetry ? ' has-recovery' : ''}`}>
        {loading ? <p className="loading-state" role="status"><span className="spinner" aria-hidden="true" />Loading conversation…</p> : loadError ? <div role="alert" className="notice is-error">
          <IconWarning /><p>Could not load this conversation. It may be unavailable or deleted.</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void load()}>Try loading again</button>
        </div> : empty ? <section className="empty" aria-label="Start a conversation">
          <h1 className="empty-statement"><span>What we discussed then.</span><span>What we can verify now.</span></h1>
          <p className="empty-lede">I search the web when it helps, cite what I find, and remember our past conversations. Conversations are saved on this device.</p>
          <ul className="starts">{startingPoints.map(point => <li key={point.text}><button type="button" className="start-row" onClick={() => void send(point.text)}><Mark kind={point.kind} /><span>{point.text}</span><IconArrowRight className="start-arrow" /></button></li>)}</ul>
          <p className="legend"><span><Mark kind="current" />Searched for an answer</span><span><Mark kind="historical" />From earlier conversations</span></p>
          {historyEmpty && <p className="empty-tip">Tip: run <code>npm run seed:demo</code> to add labelled demo history.</p>}
        </section> : state.messages.map((message, index) => <Message key={message.id} message={message} showDate={showDate[index]} running={state.busy && message.id === state.assistantId} onRecall={onRecall} highlighted={message.id === highlighted} />)}
        <p className="turn-status" role="status" aria-live="polite" aria-atomic="true">{status ? <><span className="status-dot" aria-hidden="true" />{status}</> : state.assistantId && active?.status === 'complete' ? <span className="visually-hidden">Answer complete.</span> : ''}</p>
        {(navigationError || state.error || showRetry) && <div className="recovery">
          {navigationError && <p role="alert" className="notice is-error"><IconWarning /><span>{navigationError}</span></p>}
          {state.error && <p role="alert" className={`notice ${stopped ? 'is-warning' : 'is-error'}`}><IconWarning /><span>{state.error}</span></p>}
          {showRetry && <button type="button" className="btn btn-secondary retry" onClick={() => void send(lastUser.content, lastUser)}><IconReturn />Retry answer</button>}
        </div>}
        <div ref={bottom} />
      </div>
    </div>
    <Composer busy={state.busy} disabled={loading || loadError || !state.busy && Boolean(request.current || unacknowledged.current)} onSend={send} onStop={stop} />
  </main>;
}

function pendingUser(text: string): MessageDTO {
  return { id: 'pending', role: 'user', content: text, status: 'complete', createdAt: new Date().toISOString(), localDate: '', seq: 0, replyTo: null };
}

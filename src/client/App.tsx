import { useEffect, useState } from 'react';
import { z } from 'zod';
import type { RecallItem } from '../shared/memory';
import type { Conversation } from '../shared/types';
import { deleteConversation, listConversations } from './api';
import { Sidebar } from './components/Sidebar';
import { Thread } from './components/Thread';

export function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(() => { try { return localStorage.getItem('reprise.conversation'); } catch { return null; } });
  const [threadKey, setThreadKey] = useState(0);
  const [target, setTarget] = useState<RecallItem | null>(null);
  const [error, setError] = useState('');
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [clock, setClock] = useState<string | null>(null);
  async function refresh() {
    try { setConversations(await listConversations()); setHistoryLoaded(true); setError(''); } catch { setError('Could not load conversations. Please try again.'); }
  }
  useEffect(() => {
    void refresh();
    void fetch('/api/health').then(r => r.json()).then(data => {
      const health = z.object({ clockOverridden: z.boolean(), now: z.string() }).parse(data);
      if (health.clockOverridden) setClock(health.now);
    }).catch(() => {});
  }, []);
  function select(id: string | null) {
    setTarget(null); setSelected(id); setThreadKey(key => key + 1); setError('');
    remember(id);
  }
  function navigateRecall(item: RecallItem) {
    if (item.conversationId !== selected) {
      setSelected(item.conversationId); setThreadKey(key => key + 1);
      remember(item.conversationId);
    }
    setError(''); setTarget(item);
  }
  function created(id: string) { setSelected(id); remember(id); void refresh(); }
  async function remove(id: string) {
    if (!window.confirm("Delete conversation and its sources? This can\'t be undone.")) return;
    try {
      await deleteConversation(id); if (selected === id) select(null); await refresh();
      document.querySelector<HTMLButtonElement>('.new-chat')?.focus();
    }
    catch { setError('Could not delete the conversation. Try again from its options menu.'); }
  }
  return <>
    <a className="skip-link" href="#chat">Skip to conversation</a>
    {clock && <div className="clock-banner" role="status">Test clock active: now = {clock}</div>}
    {error && <div className="error app-error" role="alert">{error} <button onClick={() => void refresh()}>Reload conversations</button></div>}
    <div className="app-shell">
      <Sidebar historyState={historyLoaded ? 'ready' : error ? 'unavailable' : 'loading'} conversations={conversations} selected={selected} now={clock ?? undefined} onSelect={id => select(id)} onNew={() => select(null)} onDelete={id => void remove(id)} />
      <Thread key={threadKey} conversationId={selected} onCreated={created} onChange={() => void refresh()} historyEmpty={historyLoaded && conversations.length === 0} target={target} onRecall={navigateRecall} onTargetHandled={() => setTarget(null)} />
    </div>
  </>;
}

function remember(id: string | null) {
  try { if (id) localStorage.setItem('reprise.conversation', id); else localStorage.removeItem('reprise.conversation'); } catch { /* Navigation works without browser storage. */ }
}

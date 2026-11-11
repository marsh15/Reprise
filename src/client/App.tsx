import { useEffect, useState } from 'react';
import { z } from 'zod';
import type { Conversation } from '../shared/types';
import { deleteConversation, listConversations } from './api';
import { Sidebar } from './components/Sidebar';
import { Thread } from './components/Thread';

export function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(localStorage.getItem('reprise.conversation'));
  const [threadKey, setThreadKey] = useState(0);
  const [error, setError] = useState('');
  const [clock, setClock] = useState<string | null>(null);
  async function refresh() {
    try { setConversations(await listConversations()); } catch (error) { setError(error instanceof Error ? error.message : 'Could not load conversations.'); }
  }
  useEffect(() => {
    void refresh();
    void fetch('/api/health').then(r => r.json()).then(data => {
      const health = z.object({ clockOverridden: z.boolean(), now: z.string() }).parse(data);
      if (health.clockOverridden) setClock(health.now);
    }).catch(() => {});
  }, []);
  function select(id: string | null) {
    setSelected(id); setThreadKey(key => key + 1); setError('');
    if (id) localStorage.setItem('reprise.conversation', id); else localStorage.removeItem('reprise.conversation');
  }
  function created(id: string) { setSelected(id); localStorage.setItem('reprise.conversation', id); void refresh(); }
  async function remove(id: string) {
    if (!window.confirm("Delete conversation and its sources? This can\'t be undone.")) return;
    try { await deleteConversation(id); if (selected === id) select(null); await refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not delete conversation.'); }
  }
  return <>
    {clock && <div className="clock-banner" role="status">Test clock active: now = {clock}</div>}
    {error && <div className="error" role="alert">{error}</div>}
    <div className="app-shell">
      <Sidebar conversations={conversations} selected={selected} now={clock ?? undefined} onSelect={id => select(id)} onNew={() => select(null)} onDelete={id => void remove(id)} />
      <Thread key={threadKey} conversationId={selected} onCreated={created} onChange={() => void refresh()} />
    </div>
  </>;
}

import { useState } from 'react';
import type { Conversation } from '../../shared/types';

export function Sidebar({ conversations, selected, now, onSelect, onNew, onDelete }: {
  conversations: Conversation[]; selected: string | null; now?: string; onSelect: (id: string) => void; onNew: () => void; onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const today = localDay(now ?? new Date().toISOString());
  const groups = ['Today', 'Yesterday', 'Previous 7 days', 'Earlier'].map(label => ({ label,
    items: conversations.filter(conversation => {
      const days = Math.round((today - localDay(conversation.updatedAt)) / 86_400_000);
      const group = days === 0 ? 'Today' : days === 1 ? 'Yesterday' : days > 1 && days <= 7 ? 'Previous 7 days' : 'Earlier';
      return group === label;
    }),
  }));
  return <>
    <button className="drawer-toggle" aria-expanded={open} aria-controls="sidebar" onClick={() => setOpen(!open)}>Conversations</button>
    {open && <button className="drawer-backdrop" aria-label="Close conversations" onClick={() => setOpen(false)} />}
    <aside id="sidebar" className={open ? 'open' : ''} aria-label="Conversations">
      <a className="wordmark" href="/">Reprise ↺</a>
      <button className="new-chat" onClick={() => { onNew(); setOpen(false); }}>New chat</button>
      <nav>{groups.filter(group => group.items.length).map(group => <section key={group.label}>
        <h2>{group.label}</h2>
        {group.items.map(conversation => <div className="conversation" key={conversation.id}>
          <button aria-current={selected === conversation.id ? 'page' : undefined} onClick={() => { onSelect(conversation.id); setOpen(false); }}>
            <strong>{conversation.title}</strong>
            <span>{conversation.origin === 'fixture' ? 'Demo · ' : ''}{conversation.preview}</span>
          </button>
          <button className="options" aria-label={`Options for ${conversation.title}`} aria-expanded={menu === conversation.id} onClick={() => setMenu(menu === conversation.id ? null : conversation.id)}>⋯</button>
          {menu === conversation.id && <button className="delete-menu" onClick={() => { onDelete(conversation.id); setMenu(null); }}>Delete conversation</button>}
        </div>)}
      </section>)}</nav>
      <p className="local-note">Conversations stay on this device.</p>
    </aside>
  </>;
}
function localDay(instant: string) {
  const date = new Date(instant);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

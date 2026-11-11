import { useEffect, useRef, useState } from 'react';
import type { Conversation } from '../../shared/types';

export function Sidebar({ conversations, selected, now, historyState = 'ready', onSelect, onNew, onDelete }: {
  conversations: Conversation[]; selected: string | null; now?: string; historyState?: 'loading' | 'ready' | 'unavailable'; onSelect: (id: string) => void; onNew: () => void; onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const sidebar = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuContainer = useRef<HTMLDivElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const closeDrawer = () => {
    setMenu(null);
    restoreFocus.current = true;
    setOpen(false);
  };

  useEffect(() => {
    if (!open) {
      if (restoreFocus.current) trigger.current?.focus();
      restoreFocus.current = false;
      return;
    }
    const panel = sidebar.current;
    if (!panel) return;
    const background = Array.from(panel.parentElement?.children ?? []).filter((element): element is HTMLElement =>
      element instanceof HTMLElement && element !== panel && !element.classList.contains('drawer-backdrop'));
    const previousInert = background.map(element => element.inert);
    background.forEach(element => { element.inert = true; });
    panel.querySelector<HTMLButtonElement>('.drawer-close')?.focus();
    const focusable = () => Array.from(panel.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), [tabindex]:not([tabindex="-1"])'));
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) { event.preventDefault(); panel.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    const keepFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !panel.contains(event.target)) focusable()[0]?.focus();
    };
    const desktop = window.matchMedia('(min-width: 768px)');
    const onResize = () => { if (desktop.matches) { setMenu(null); setOpen(false); } };
    document.addEventListener('keydown', trapFocus, true);
    document.addEventListener('focusin', keepFocus);
    desktop.addEventListener('change', onResize);
    onResize();
    return () => {
      document.removeEventListener('keydown', trapFocus, true);
      document.removeEventListener('focusin', keepFocus);
      desktop.removeEventListener('change', onResize);
      background.forEach((element, index) => { element.inert = previousInert[index]; });
    };
  }, [open]);

  useEffect(() => {
    if (!open && !menu) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (menu) { setMenu(null); menuTrigger.current?.focus(); }
      else closeDrawer();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (menu && event.target instanceof Node && !menuContainer.current?.contains(event.target)) setMenu(null);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (menu && event.target instanceof Node && !menuContainer.current?.contains(event.target)) setMenu(null);
    };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [open, menu]);

  const today = localDay(now ?? new Date().toISOString());
  const groups = ['Today', 'Yesterday', 'Previous 7 days', 'Earlier'].map(label => ({ label,
    items: conversations.filter(conversation => {
      const days = Math.round((today - localDay(conversation.updatedAt)) / 86_400_000);
      const group = days === 0 ? 'Today' : days === 1 ? 'Yesterday' : days > 1 && days <= 7 ? 'Previous 7 days' : 'Earlier';
      return group === label;
    }),
  }));
  return <>
    <button ref={trigger} className="drawer-toggle" aria-expanded={open} aria-controls="sidebar" onClick={() => open ? closeDrawer() : setOpen(true)}>Conversations</button>
    {open && <button className="drawer-backdrop" aria-label="Close conversations" tabIndex={-1} onClick={closeDrawer} />}
    <aside ref={sidebar} id="sidebar" className={open ? 'open' : ''} role={open ? 'dialog' : undefined} aria-modal={open ? true : undefined} aria-label="Conversations" tabIndex={open ? -1 : undefined}>
      {open && <button className="drawer-close" onClick={closeDrawer}>Close conversations</button>}
      <a className="wordmark" href="/">Reprise ↺</a>
      <button className="new-chat" onClick={() => { onNew(); if (open) closeDrawer(); else setMenu(null); }}>New chat</button>
      <nav aria-label="Conversation history">{conversations.length === 0 && <p role={historyState === 'loading' ? 'status' : undefined}>{historyState === 'loading' ? 'Loading conversations…' : historyState === 'unavailable' ? 'Conversation history unavailable.' : 'No conversations yet.'}</p>}{groups.filter(group => group.items.length).map(group => <section key={group.label} aria-label={group.label}>
        <h2>{group.label}</h2>
        {group.items.map(conversation => <div className="conversation" key={conversation.id} ref={menu === conversation.id ? menuContainer : undefined}>
          <button aria-current={selected === conversation.id ? 'page' : undefined} onClick={() => { onSelect(conversation.id); if (open) closeDrawer(); else setMenu(null); }}>
            <strong>{conversation.title}</strong>
            <span>{conversation.origin === 'fixture' ? 'Demo · ' : ''}{conversation.preview}</span>
          </button>
          <button ref={menu === conversation.id ? menuTrigger : undefined} className="options" aria-label={`Options for ${conversation.title}`} aria-expanded={menu === conversation.id} onClick={() => setMenu(menu === conversation.id ? null : conversation.id)}>⋯</button>
          {menu === conversation.id && <button className="delete-menu" onClick={() => { onDelete(conversation.id); setMenu(null); }}>Delete conversation</button>}
        </div>)}
      </section>)}</nav>
      <p className="local-note">Conversations are saved on this device.</p>
    </aside>
  </>;
}
function localDay(instant: string) {
  const date = new Date(instant);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

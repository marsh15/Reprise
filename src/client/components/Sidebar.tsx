import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { Conversation } from '../../shared/types';
import { fixedOrigin } from '../floating';
import { BrandMark, DemoTag, IconClose, IconMenu, IconMore, IconPlus, IconTrash } from './Glyphs';
import { ThemeControl } from './ThemeControl';

const UNTITLED = 'Untitled conversation';

export function Sidebar({ conversations, selected, now, historyState = 'ready', context, onSelect, onNew, onDelete }: {
  conversations: Conversation[]; selected: string | null; now?: string; historyState?: 'loading' | 'ready' | 'unavailable';
  /** Title and origin of the open conversation, shown in the mobile top bar. */
  context?: { title: string | null; origin?: Conversation['origin'] };
  onSelect: (id: string) => void; onNew: () => void; onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const menuPanel = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const confirmId = useId();
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

  useEffect(() => { if (!menu) setConfirming(false); }, [menu]);
  // Inline confirmation: Cancel takes focus first, so Enter cannot delete by accident.
  useEffect(() => { if (confirming) cancel.current?.focus(); }, [confirming]);
  // The menu is fixed-positioned from its button so the scrolling history list cannot clip it.
  useLayoutEffect(() => {
    const panel = menuPanel.current; const anchor = menuTrigger.current;
    if (!menu || !panel || !anchor) return;
    const origin = fixedOrigin(panel);
    const rect = anchor.getBoundingClientRect();
    const width = panel.offsetWidth; const height = panel.offsetHeight;
    const left = Math.min(Math.max(rect.right - width, 8), window.innerWidth - 8 - width);
    const top = rect.bottom + 4 + height > window.innerHeight - 8 ? Math.max(8, rect.top - 4 - height) : rect.bottom + 4;
    panel.style.left = `${left - origin.x}px`; panel.style.top = `${top - origin.y}px`;
  }, [menu, confirming]);

  const today = localDay(now ?? new Date().toISOString());
  const groups = ['Today', 'Yesterday', 'Previous 7 days', 'Earlier'].map(label => ({ label,
    items: conversations.filter(conversation => {
      const days = Math.round((today - localDay(conversation.updatedAt)) / 86_400_000);
      const group = days === 0 ? 'Today' : days === 1 ? 'Yesterday' : days > 1 && days <= 7 ? 'Previous 7 days' : 'Earlier';
      return group === label;
    }),
  }));
  return <>
    <header className="topbar">
      <button ref={trigger} type="button" className="drawer-toggle" aria-label="Conversations" aria-expanded={open} aria-controls="sidebar" onClick={() => open ? closeDrawer() : setOpen(true)}><IconMenu /></button>
      <div className="topbar-title">{context?.title ? <><h1 className="topbar-name" title={context.title}>{context.title}</h1>{context.origin === 'fixture' && <DemoTag />}</> : <span className="wordmark"><BrandMark /><span>Reprise</span></span>}</div>
    </header>
    <button type="button" className={`drawer-backdrop${open ? ' is-open' : ''}`} aria-label="Close conversations" tabIndex={-1} onClick={closeDrawer} />
    <aside ref={sidebar} id="sidebar" className={open ? 'open' : ''} role={open ? 'dialog' : undefined} aria-modal={open ? true : undefined} aria-label="Conversations" tabIndex={open ? -1 : undefined}>
      <div className="sidebar-head">
        <a className="wordmark" href="/"><BrandMark /><span>Reprise</span></a>
        {open && <button type="button" className="drawer-close" aria-label="Close conversations" onClick={closeDrawer}><IconClose /></button>}
      </div>
      <button type="button" className="btn btn-secondary new-chat" onClick={() => { onNew(); if (open) closeDrawer(); else setMenu(null); }}><IconPlus />New conversation</button>
      <nav aria-label="Conversation history" onScroll={() => { if (menu) setMenu(null); }}>{conversations.length === 0 && <p className="nav-state" role={historyState === 'loading' ? 'status' : undefined}>{historyState === 'loading' ? 'Loading conversations…' : historyState === 'unavailable' ? 'Conversation history unavailable.' : 'No conversations yet.'}</p>}{groups.filter(group => group.items.length).map(group => <section key={group.label} aria-label={group.label}>
        <h2>{group.label}</h2>
        {group.items.map(conversation => <div className="conversation" key={conversation.id} data-selected={selected === conversation.id ? '' : undefined} ref={menu === conversation.id ? menuContainer : undefined}>
          <button type="button" className="conversation-open" aria-current={selected === conversation.id ? 'page' : undefined} onClick={() => { onSelect(conversation.id); if (open) closeDrawer(); else setMenu(null); }}>
            <strong>{conversation.title || UNTITLED}</strong>
            <span>{conversation.origin === 'fixture' ? 'Demo · ' : ''}{conversation.preview}</span>
          </button>
          <button type="button" ref={menu === conversation.id ? menuTrigger : undefined} className="options" aria-label={`Options for ${conversation.title || UNTITLED}`} aria-expanded={menu === conversation.id} onClick={() => setMenu(menu === conversation.id ? null : conversation.id)}><IconMore /></button>
          {menu === conversation.id && <div className="options-menu" ref={menuPanel} role="group" aria-label={`Delete ${conversation.title || UNTITLED}`} aria-describedby={confirming ? confirmId : undefined}>
            {confirming ? <>
              <p id={confirmId}>Delete conversation and its sources? This can't be undone.</p>
              <div className="confirm-actions">
                <button type="button" ref={cancel} className="btn btn-secondary btn-sm" onClick={() => { setMenu(null); menuTrigger.current?.focus(); }}>Cancel</button>
                <button type="button" className="btn btn-destructive btn-sm" onClick={() => { const id = conversation.id; menuTrigger.current?.focus(); setMenu(null); onDelete(id); }}>Delete</button>
              </div>
            </> : <button type="button" className="menu-item" onClick={() => setConfirming(true)}><IconTrash />Delete conversation</button>}
          </div>}
        </div>)}
      </section>)}</nav>
      <div className="sidebar-foot">
        <ThemeControl />
        <p className="local-note">Conversations are saved on this device.</p>
      </div>
    </aside>
  </>;
}
function localDay(instant: string) {
  const date = new Date(instant);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

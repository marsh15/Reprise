import { useState } from 'react';
import type { RecallItem } from '../../shared/memory';
import { DemoTag, Mark } from './Glyphs';

export function RecallChip({ item, onNavigate }: { item: RecallItem; onNavigate?: (item: RecallItem) => void }) {
  const date = new Date(`${item.localDate}T00:00:00Z`);
  const label = Number.isNaN(date.valueOf()) ? item.localDate : new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date);
  return <button type="button" className="recall-chip" onClick={() => onNavigate?.(item)}>
    <Mark kind="historical" />
    <span className="recall-text"><span className="recall-from">From</span>{' '}<span className="recall-title" title={item.title || undefined}>{item.title || 'our conversation'}</span>{' '}<span className="recall-date">· <span className="tnum">{label}</span></span></span>
    {item.origin === 'fixture' && <DemoTag className="recall-demo">Demo</DemoTag>}
  </button>;
}

const VISIBLE_WHEN_COLLAPSED = 3; // retrieval can return up to ten turns; beyond five, the rest sit behind a toggle

/** The recall chips above an answer. Long lists collapse so the answer is never pushed far down the page. */
export function RecallRow({ items, onNavigate }: { items: RecallItem[]; onNavigate?: (item: RecallItem) => void }) {
  const [expanded, setExpanded] = useState(false);
  const collapsible = items.length > VISIBLE_WHEN_COLLAPSED + 2;
  const shown = collapsible && !expanded ? items.slice(0, VISIBLE_WHEN_COLLAPSED) : items;
  return <div className="recall-row">
    {shown.map((item, index) => <RecallChip key={`${item.conversationId}-${item.messageId}-${index}`} item={item} onNavigate={onNavigate} />)}
    {collapsible && <button type="button" className="recall-more" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Show fewer' : `Show ${items.length - VISIBLE_WHEN_COLLAPSED} more`}</button>}
  </div>;
}

import type { RecallItem } from '../../shared/memory';
import '../recall.css';

export function RecallChip({ item, onNavigate }: { item: RecallItem; onNavigate?: (item: RecallItem) => void }) {
  const date = new Date(`${item.localDate}T00:00:00Z`);
  const label = Number.isNaN(date.valueOf()) ? item.localDate : new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date);
  return <button type="button" className="recall-chip" onClick={() => onNavigate?.(item)}>
    <span aria-hidden="true">↺ </span>From {item.title || 'our conversation'} · {label}{item.origin === 'fixture' && <span className="recall-demo">Demo</span>}
  </button>;
}

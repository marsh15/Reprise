import { useId, useState } from 'react';
import type { CitationRecord, SourceRecord } from '../../shared/research';
import '../research.css';

function safeUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch { return null; }
}

function dateLabel(value: string | null): string {
  if (!value) return 'Date unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unknown' : date.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function Citation({ marker, citation, source }: { marker: number; citation?: CitationRecord; source?: SourceRecord }) {
  const [dismissed, setDismissed] = useState(false);
  const cardId = useId();
  const matches = !!citation && citation.marker === marker && !!source && citation.sourceId === source.sourceId && source.n === marker;
  const invalid = citation?.state === 'invalid' || !citation || citation.marker !== marker;
  const deleted = !invalid && !matches;
  const url = !invalid && matches && source ? safeUrl(source.url) : null;
  const pill = invalid ? '[?]' : `[${marker}]`;
  const props = { className: `citation-pill${citation?.state === 'unverified' ? ' citation-unverified' : ''}`, 'aria-describedby': cardId };
  return <span className={`citation${dismissed ? ' citation-dismissed' : ''}`}
    onMouseEnter={() => setDismissed(false)} onMouseLeave={() => setDismissed(false)}
    onFocus={() => setDismissed(false)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDismissed(false); }}
    onKeyDown={event => { if (event.key === 'Escape') { setDismissed(true); event.stopPropagation(); } }}>
    {url ? <a {...props} href={url.href} target="_blank" rel="noopener noreferrer">{pill}</a> : <button {...props} type="button">{pill}</button>}
    <span className="citation-card" id={cardId} role="tooltip">
      {invalid ? 'No matching source.' : deleted ? 'Source deleted or unavailable.' : <>
        <strong>{source?.title || url?.hostname || 'Source'}</strong>
        <span>{url?.hostname || 'Invalid source address'}</span>
        <span>Published: {dateLabel(source?.publishedAt ?? null)}</span>
        <span>Retrieved: {dateLabel(source?.retrievedAt ?? null)}</span>
        {source?.fixture && <span>Demo fixture</span>}
        {citation?.state === 'verified' && <span>Numbers and dates found; meaning not checked.</span>}
        {citation?.state === 'unchecked' && <span>No numbers or dates checked.</span>}
        {citation?.state === 'unverified' && <span>Token not found in source{citation.detail ? `: ${citation.detail.replace(/^not found in source:\s*/i, '')}` : '.'}</span>}
      </>}
    </span>
  </span>;
}

import { useId, useState } from 'react';
import type { CitationRecord, SourceRecord } from '../../shared/research';
import '../research.css';
import { safeSourceUrl, sourceDateLabel } from '../sourceLabels';

export function Citation({ marker, citation, source, observations = source ? [source] : [], searchIds = [] }: { marker: number; citation?: CitationRecord; source?: SourceRecord; observations?: SourceRecord[]; searchIds?: string[] }) {
  const [dismissed, setDismissed] = useState(false);
  const cardId = useId();
  const matches = !!citation && citation.marker === marker && !!source && citation.sourceId === source.sourceId && source.n === marker;
  const invalid = citation?.state === 'invalid' || !citation || citation.marker !== marker;
  const deleted = !invalid && !matches;
  const url = !invalid && matches && source ? safeSourceUrl(source.url) : null;
  const pill = invalid ? '[?]' : `[${marker}]`;
  const props = { 'aria-label': `Source ${marker}${invalid ? ': no matching source' : citation?.state === 'unverified' ? ': unverified numbers or dates' : ''}`, className: `citation-pill${citation?.state === 'unverified' ? ' citation-unverified' : ''}`, 'aria-describedby': cardId };
  return <span className={`citation${dismissed ? ' citation-dismissed' : ''}`}
    onMouseEnter={() => setDismissed(false)} onMouseLeave={() => setDismissed(false)}
    onFocus={() => setDismissed(false)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDismissed(false); }}
    onKeyDown={event => { if (event.key === 'Escape') { (event.currentTarget.firstElementChild as HTMLElement)?.focus(); setDismissed(true); event.stopPropagation(); } }}>
    {url ? <a {...props} href={url.href} target="_blank" rel="noopener noreferrer">{pill}</a> : <button {...props} type="button">{pill}</button>}
    <span className="citation-card" id={cardId} role="group" aria-label={`Source ${marker} details`} tabIndex={0}>
      {invalid ? 'No matching source.' : deleted ? 'Source deleted or unavailable.' : <>
        <strong>{url ? <a href={url.href} target="_blank" rel="noopener noreferrer">{source?.title || url.hostname}</a> : source?.title || 'Source'}</strong>
        <span>{url?.hostname || 'Invalid source address'}</span>
        {observations.length > 1 && <span className="observation-note">{observations.length} dated observations of this URL. This marker does not identify which observation supports each claim.</span>}
        {observations.map(observation => <span className="source-observation" key={observation.sourceId}>
          <span>{searchIds.includes(observation.searchId) ? 'Searched for this answer' : 'Preserved from an earlier answer'}</span>
          <span>Published: {sourceDateLabel(observation.publishedAt, { dateStyle: 'medium' })}</span>
          <span>Retrieved: {sourceDateLabel(observation.retrievedAt, { dateStyle: 'medium', timeStyle: 'short' })}</span>
          {observation.fixture && <span>Demo fixture</span>}
          {observations.length > 1 && <span>Excerpt: {observation.excerpt.slice(0, 180)}{observation.excerpt.length > 180 ? '…' : ''}</span>}
        </span>)}
        {citation?.state === 'verified' && <span>{observations.length > 1 ? 'Numbers and dates found across these observations; meaning and supporting date not checked.' : 'Numbers and dates found; meaning not checked.'}</span>}
        {citation?.state === 'unchecked' && <span>No numbers or dates checked.</span>}
        {citation?.state === 'unverified' && <span>Token not found in source{citation.detail ? `: ${citation.detail.replace(/^not found in source:\s*/i, '')}` : '.'}</span>}
      </>}
    </span>
  </span>;
}

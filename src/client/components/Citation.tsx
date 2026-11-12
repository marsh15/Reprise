import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { CitationRecord, SourceRecord } from '../../shared/research';
import { fixedOrigin, placeCard, placeSheet } from '../floating';
import { safeSourceUrl, sourceDateLabel } from '../sourceLabels';
import { DemoTag, IconCheck, IconDash, IconWarning, Mark } from './Glyphs';

const OPEN_DELAY_MS = 80; // hover intent: a pointer crossing the paragraph does not flash cards
const CLOSE_GRACE_MS = 120; // lets the pointer travel from the marker into the card

// One card at a time: the marker activated most recently (hover, focus or tap) wins. Each marker
// subscribes here; when another one claims, it dismisses its own card without moving focus.
const claimListeners = new Set<(claimant: string) => void>();
const claim = (claimant: string) => claimListeners.forEach(listener => listener(claimant));

export function Citation({ marker, citation, source, observations = source ? [source] : [], searchIds = [] }: { marker: number; citation?: CitationRecord; source?: SourceRecord; observations?: SourceRecord[]; searchIds?: string[] }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const card = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardId = useId();
  const open = (hovered || focused) && !dismissed;
  const matches = !!citation && citation.marker === marker && !!source && citation.sourceId === source.sourceId && source.n === marker;
  const invalid = citation?.state === 'invalid' || !citation || citation.marker !== marker;
  const deleted = !invalid && !matches;
  const url = !invalid && matches && source ? safeSourceUrl(source.url) : null;
  const label = invalid ? '[?]' : `[${marker}]`;
  const state = invalid ? 'is-invalid' : deleted ? 'is-unavailable' : citation?.state === 'unverified' ? 'is-unverified' : '';
  const props = { 'aria-label': `Source ${marker}${invalid ? ': no matching source' : citation?.state === 'unverified' ? ': unverified numbers or dates' : ''}`, className: `citation-marker${state ? ` ${state}` : ''}`, 'aria-describedby': cardId };

  const stopTimer = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => stopTimer, []);
  useEffect(() => {
    const yieldTo = (claimant: string) => { if (claimant !== cardId) setDismissed(true); };
    claimListeners.add(yieldTo);
    return () => { claimListeners.delete(yieldTo); };
  }, [cardId]);

  // The open card is `position: fixed`, placed from the marker's rect, so a table's overflow
  // container cannot clip it and the paragraph never reflows. Recomputed while open.
  useLayoutEffect(() => {
    if (!open) return;
    const element = card.current;
    const anchor = root.current?.firstElementChild as HTMLElement | null;
    if (!element || !anchor) return;
    const place = () => {
      element.style.maxHeight = ''; element.style.width = '';
      const origin = fixedOrigin(element);
      const thread = anchor.closest('.thread')?.getBoundingClientRect();
      const viewport = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
      const bounds = thread ? { left: thread.left, top: thread.top, right: thread.right, bottom: thread.bottom } : viewport;
      let rect = anchor.getBoundingClientRect();
      const size = { width: element.offsetWidth, height: element.offsetHeight };
      const sheet = window.matchMedia('(max-width: 767px)').matches;
      const composer = anchor.closest('.chat')?.querySelector('.composer')?.getBoundingClientRect();
      let placement = sheet && composer
        ? placeSheet({ ...bounds, left: viewport.left, right: viewport.right }, composer.top, size)
        : placeCard(rect, size, bounds);
      if (sheet && composer && thread && rect.bottom + 8 > placement.top && rect.top < placement.top + placement.height) {
        // WCAG 2.4.11: the sheet must not hide the marker that has focus. Scroll the marker clear of it;
        // if the thread cannot scroll far enough, rest the sheet at the top of the thread instead.
        const scroller = anchor.closest('.thread');
        if (scroller) scroller.scrollTop += rect.bottom + 8 - placement.top;
        rect = anchor.getBoundingClientRect();
        if (rect.bottom + 8 > placement.top && bounds.top + 8 + placement.height < rect.top - 8) placement = { ...placement, top: bounds.top + 8 };
      }
      element.style.left = `${placement.left - origin.x}px`;
      element.style.top = `${placement.top - origin.y}px`;
      element.style.width = `${placement.width}px`;
      element.style.maxHeight = placement.maxHeight === null ? '' : `${placement.maxHeight}px`;
      element.toggleAttribute('data-offscreen', rect.bottom < bounds.top || rect.top > bounds.bottom);
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); };
  }, [open]);

  return <span ref={root} className={`citation${open ? ' is-open' : ''}`}
    onMouseEnter={() => { stopTimer(); timer.current = setTimeout(() => { claim(cardId); setDismissed(false); setHovered(true); }, hovered ? 0 : OPEN_DELAY_MS); }}
    onMouseLeave={() => { stopTimer(); timer.current = setTimeout(() => setHovered(false), CLOSE_GRACE_MS); }}
    onFocus={() => { claim(cardId); setFocused(true); setDismissed(false); }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
    onKeyDown={event => { if (event.key === 'Escape') { (event.currentTarget.firstElementChild as HTMLElement)?.focus(); setDismissed(true); event.stopPropagation(); } }}>
    {url ? <a {...props} href={url.href} target="_blank" rel="noopener noreferrer">{label}</a> : <button {...props} type="button">{label}</button>}
    <span ref={card} className="citation-card" id={cardId} role="group" aria-label={`Source ${marker} details`} tabIndex={0}>
      {invalid ? <span className="card-note">No matching source.</span> : deleted ? <span className="card-note">Source deleted or unavailable.</span> : <>
        <strong>{url ? <a href={url.href} target="_blank" rel="noopener noreferrer">{source?.title || url.hostname}</a> : source?.title || 'Source'}</strong>
        <span className="card-domain">{url?.hostname || 'Invalid source address'}</span>
        {observations.length > 1 && <span className="observation-note">{observations.length} dated observations of this URL. This marker does not identify which observation supports each claim.</span>}
        <span className="observation-rail">{observations.map(observation => {
          const current = searchIds.includes(observation.searchId);
          return <span className="source-observation" key={observation.sourceId}>
            <span className="observation-label"><Mark kind={current ? 'current' : 'historical'} />{current ? 'Searched for this answer' : 'Preserved from an earlier answer'}{observation.fixture && <DemoTag>Demo fixture</DemoTag>}</span>
            <span className="observation-dates tnum">
              <span className="observation-key">Published</span><span>{sourceDateLabel(observation.publishedAt, { dateStyle: 'medium' })}</span>
              <span className="observation-key">Retrieved</span><span>{sourceDateLabel(observation.retrievedAt, { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </span>
            {observations.length > 1 && <span className="observation-excerpt">Excerpt: {observation.excerpt.slice(0, 180)}{observation.excerpt.length > 180 ? '…' : ''}</span>}
          </span>;
        })}</span>
        {citation?.state === 'verified' && <span className="card-check is-verified"><IconCheck />{observations.length > 1 ? 'Numbers and dates found across these observations; meaning and supporting date not checked.' : 'Numbers and dates found; meaning not checked.'}</span>}
        {citation?.state === 'unchecked' && <span className="card-check is-unchecked"><IconDash />No numbers or dates checked.</span>}
        {citation?.state === 'unverified' && <span className="card-check is-unverified"><IconWarning />Token not found in source{citation.detail ? `: ${citation.detail.replace(/^not found in source:\s*/i, '')}` : '.'}</span>}
      </>}
    </span>
  </span>;
}

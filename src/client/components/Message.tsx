import { createContext, useContext } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Citation } from './Citation';
import { IconStop, IconWarning } from './Glyphs';
import { ResearchStatus } from './ResearchStatus';
import { RecallRow } from './RecallChip';
import type { RecallItem } from '../../shared/memory';
import { citationMarkdown } from '../citationMarkdown';
import { sourceDateLabel } from '../sourceLabels';
import type { MessageDTO } from '../../shared/types';

// An image inside a link renders as text, so a second link is never nested in the first.
const InsideLink = createContext(false);
const dateOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

export function Message({ message, running = false, onRecall, highlighted = false, showDate = true }: { message: MessageDTO; running?: boolean; onRecall?: (item: RecallItem) => void; highlighted?: boolean; showDate?: boolean }) {
  const user = message.role === 'user';
  const date = message.localDate ? sourceDateLabel(message.createdAt, dateOptions) : '';
  const time = message.localDate ? sourceDateLabel(message.createdAt, timeOptions) : '';
  return <article id={`message-${message.id}`} tabIndex={user ? -1 : undefined} className={`message ${message.role}${highlighted ? ' recall-highlight' : ''}`} aria-label={user ? 'Your message' : 'Reprise answer'}>
    <div className="message-label">{user ? 'You' : 'Reprise'}{message.localDate && <time className="message-time" dateTime={message.createdAt}> · {showDate ? `${date}, ${time}` : time}</time>}</div>
    {message.localDate && <time className="dateline tnum" dateTime={message.createdAt}>{showDate && <span>{date}</span>}<span>{time}</span></time>}
    <div className="message-main">
      {!user && !!message.recall?.length && <RecallRow items={message.recall} onNavigate={onRecall} />}
      {!user && message.evidence && <ResearchStatus searches={message.evidence.searches} sources={message.evidence.sources} running={running && message.evidence.searches.some(s => s.status === 'error' && !s.error)} />}
      {user ? <div className="message-bubble"><p>{message.content}</p></div> : <div className="prose"><Markdown remarkPlugins={[remarkGfm, citationMarkdown]} urlTransform={url => /^(https?:\/\/|#citation-\d+$)/i.test(url) ? url : ''} components={{ img: ({ src, alt }) => {
        const insideLink = useContext(InsideLink);
        const url = typeof src === 'string' && /^https?:\/\//i.test(src) ? src : '';
        let host = ''; try { host = url ? new URL(url).hostname : ''; } catch { /* inert below */ }
        if (!host) return <span className="blocked-image">Image removed{alt ? `: ${alt}` : ''}</span>;
        if (insideLink) return <span className="blocked-image">Image not loaded: {alt || host}</span>;
        return <a className="blocked-image" href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={`Image not loaded: ${alt || host}. Opens external image in a new tab`}>Image not loaded: {alt || host}</a>;
      }, table: ({ children, node: _node, ...props }) => <div className="table-scroll" role="region" aria-label="Table" tabIndex={0}><table {...props}>{children}</table></div>, a: ({ href, children, node: _node, ...props }) => {
        const marker = href?.match(/^#citation-(\d+)$/);
        if (!marker) return <a {...props} href={href} target="_blank" rel="noopener noreferrer"><InsideLink.Provider value>{children}</InsideLink.Provider></a>;
        const n = Number(marker[1]);
        const observations = message.evidence?.sources.filter(source => source.n === n) ?? [];
        const record = message.evidence?.citations.find(c => c.marker === n);
        const source = observations.find(source => source.sourceId === record?.sourceId) ?? observations[0];
        const citation = record ?? (running && source ? { marker: n, sourceId: source.sourceId, state: 'unchecked' as const, detail: null } : undefined);
        if (!citation && running) return <span className="citation-marker is-pending">[{n}]</span>;
        return <Citation marker={n} citation={citation} source={source} observations={observations} searchIds={message.evidence?.searches.map(search => search.id)} />;
      } }}>{message.content}</Markdown></div>}
      {message.status !== 'complete' && <p className={`outcome ${message.status === 'interrupted' ? 'is-interrupted' : 'is-failed'}`}>{message.status === 'interrupted' ? <IconStop /> : <IconWarning />}<span>{message.status === 'interrupted' ? 'Stopped · This answer is incomplete.' : 'Answer failed · This answer is incomplete.'}</span></p>}
    </div>
  </article>;
}

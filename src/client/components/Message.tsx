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
      {user ? <div className="message-bubble"><p>{message.content}</p></div> : <div className="prose"><Markdown remarkPlugins={[remarkGfm, citationMarkdown]} urlTransform={url => /^(https?:\/\/|#citation-\d+$)/i.test(url) ? url : ''} components={{ table: ({ children, node: _node, ...props }) => <div className="table-scroll" role="region" aria-label="Table" tabIndex={0}><table {...props}>{children}</table></div>, a: ({ href, children, node: _node, ...props }) => {
        const marker = href?.match(/^#citation-(\d+)$/);
        if (!marker) return <a {...props} href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
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

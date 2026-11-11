import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Citation } from './Citation';
import { ResearchStatus } from './ResearchStatus';
import { RecallChip } from './RecallChip';
import type { RecallItem } from '../../shared/memory';
import { citationMarkdown } from '../citationMarkdown';
import { sourceDateLabel } from '../sourceLabels';
import type { MessageDTO } from '../../shared/types';

export function Message({ message, running = false, onRecall, highlighted = false }: { message: MessageDTO; running?: boolean; onRecall?: (item: RecallItem) => void; highlighted?: boolean }) {
  return <article id={`message-${message.id}`} tabIndex={message.role === 'user' ? -1 : undefined} className={`message ${message.role}${highlighted ? ' recall-highlight' : ''}`} aria-label={message.role === 'user' ? 'Your message' : 'Reprise answer'}>
    <div className="message-label">{message.role === 'user' ? 'You' : 'Reprise'}{message.localDate && <time dateTime={message.createdAt}> · {sourceDateLabel(message.createdAt, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>}</div>
    {message.role === 'assistant' && message.recall?.map((item, index) => <RecallChip key={`${item.conversationId}-${item.messageId}-${index}`} item={item} onNavigate={onRecall} />)}
    {message.role === 'assistant' && message.evidence && <ResearchStatus searches={message.evidence.searches} sources={message.evidence.sources} running={running && message.evidence.searches.some(s => s.status === 'error' && !s.error)} />}
    {message.role === 'user' ? <p>{message.content}</p> : <Markdown remarkPlugins={[remarkGfm, citationMarkdown]} urlTransform={url => /^(https?:\/\/|#citation-\d+$)/i.test(url) ? url : ''} components={{ table: ({ children, node: _node, ...props }) => <div className="table-scroll" role="region" aria-label="Table" tabIndex={0}><table {...props}>{children}</table></div>, a: ({ href, children, node: _node, ...props }) => {
      const marker = href?.match(/^#citation-(\d+)$/);
      if (!marker) return <a {...props} href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
      const n = Number(marker[1]);
      const observations = message.evidence?.sources.filter(source => source.n === n) ?? [];
      const record = message.evidence?.citations.find(c => c.marker === n);
      const source = observations.find(source => source.sourceId === record?.sourceId) ?? observations[0];
      const citation = record ?? (running && source ? { marker: n, sourceId: source.sourceId, state: 'unchecked' as const, detail: null } : undefined);
      if (!citation && running) return <span className="citation-pill">[{n}]</span>;
      return <Citation marker={n} citation={citation} source={source} observations={observations} searchIds={message.evidence?.searches.map(search => search.id)} />;
    } }}>{message.content}</Markdown>}
    {message.status !== 'complete' && <small className="answer-outcome">{message.status === 'interrupted' ? 'Stopped · This answer is incomplete.' : 'Answer failed · This answer is incomplete.'}</small>}
  </article>;
}

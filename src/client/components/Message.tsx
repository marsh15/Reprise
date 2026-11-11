import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { MessageDTO } from '../../shared/types';

export function Message({ message }: { message: MessageDTO }) {
  return <article className={`message ${message.role}`} aria-label={message.role === 'user' ? 'Your message' : 'Reprise answer'}>
    <div className="message-label">{message.role === 'user' ? 'You' : 'Reprise'}</div>
    {message.role === 'user' ? <p>{message.content}</p> : <Markdown remarkPlugins={[remarkGfm]} components={{ a: props => <a {...props} target="_blank" rel="noopener noreferrer" /> }}>{message.content}</Markdown>}
    {message.status !== 'complete' && <small>{message.status === 'interrupted' ? 'Stopped' : 'Answer failed'}</small>}
  </article>;
}

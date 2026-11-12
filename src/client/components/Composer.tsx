import { useEffect, useId, useRef, useState } from 'react';
import { IconArrowUp, IconStop } from './Glyphs';

export function Composer({ busy, disabled, onSend, onStop }: { busy: boolean; disabled: boolean; onSend: (text: string) => Promise<void>; onStop: () => void }) {
  const hintId = useId();
  const [text, setText] = useState('');
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const input = textarea.current!;
    input.style.height = 'auto';
    input.style.height = `${input.scrollHeight}px`; // CSS max-height (--composer-max-height) caps it and the field scrolls
  }, [text]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && busy && !event.defaultPrevented) onStop(); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [busy, onStop]);
  function submit() {
    if (busy || disabled || !text.trim()) return;
    const value = text.trim(); setText(''); void onSend(value);
  }
  return <form className="composer" onSubmit={event => { event.preventDefault(); submit(); }}>
    <div className="composer-field">
      <textarea ref={textarea} aria-label="Message" aria-describedby={hintId} placeholder="Message Reprise…" value={text} maxLength={8000} rows={1}
        onChange={event => setText(event.target.value)} onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); }
        }} />
      {busy
        ? <button type="button" className="composer-stop" onClick={onStop}><IconStop /><span>Stop</span></button>
        : <button type="submit" className="composer-send" aria-label="Send" disabled={disabled || !text.trim()}><IconArrowUp /></button>}
    </div>
    <small id={hintId} className="composer-hint"><kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for a new line{busy ? <> · <kbd>Esc</kbd> to stop</> : ''}</small>
  </form>;
}

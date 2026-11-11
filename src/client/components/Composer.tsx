import { useEffect, useId, useRef, useState } from 'react';

export function Composer({ busy, disabled, onSend, onStop }: { busy: boolean; disabled: boolean; onSend: (text: string) => Promise<void>; onStop: () => void }) {
  const hintId = useId();
  const [text, setText] = useState('');
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const input = textarea.current!;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight + 2, 218)}px`;
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
    <textarea ref={textarea} aria-label="Message" aria-describedby={hintId} placeholder="Message Reprise…" value={text} maxLength={8000} rows={2}
      onChange={event => setText(event.target.value)} onKeyDown={event => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); }
      }} />
    {busy ? <button type="button" onClick={onStop}>Stop</button> : <button disabled={disabled || !text.trim()}>Send</button>}
    <small id={hintId}>Enter to send · Shift+Enter for a new line{busy ? ' · Esc to stop' : ''}</small>
  </form>;
}

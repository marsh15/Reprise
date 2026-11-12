import type { ReactNode } from 'react';

/*
 * The whole icon vocabulary of the client. Every icon is an inline SVG in a 16px box with a 1.5px
 * stroke, round caps and joins, and `currentColor`, so colour and size come from CSS. Icons are
 * decorative (aria-hidden); meaning is always carried by adjacent text or an accessible name.
 */
function Icon({ className, children, fill = false }: { className?: string; children: ReactNode; fill?: boolean }) {
  return <svg className={`icon${className ? ` ${className}` : ''}`} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"
    fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
type P = { className?: string };
export const IconPlus = ({ className }: P) => <Icon className={className}><path d="M8 3.5v9M3.5 8h9" /></Icon>;
export const IconMenu = ({ className }: P) => <Icon className={className}><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" /></Icon>;
export const IconClose = ({ className }: P) => <Icon className={className}><path d="M4 4l8 8M12 4l-8 8" /></Icon>;
export const IconMore = ({ className }: P) => <Icon className={className} fill><circle cx="3.5" cy="8" r="1.25" /><circle cx="8" cy="8" r="1.25" /><circle cx="12.5" cy="8" r="1.25" /></Icon>;
export const IconArrowUp = ({ className }: P) => <Icon className={className}><path d="M8 13V3.5M3.75 7.5L8 3.25l4.25 4.25" /></Icon>;
export const IconArrowRight = ({ className }: P) => <Icon className={className}><path d="M3 8h10M8.75 3.75L13 8l-4.25 4.25" /></Icon>;
export const IconStop = ({ className }: P) => <Icon className={className} fill><rect x="4" y="4" width="8" height="8" rx="1.5" /></Icon>;
export const IconChevron = ({ className }: P) => <Icon className={className}><path d="M4.5 6.5L8 10l3.5-3.5" /></Icon>;
export const IconExternal = ({ className }: P) => <Icon className={className}><path d="M9.5 3H13v3.5M13 3L7.5 8.5M11 9.5V12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2.5" /></Icon>;
export const IconWarning = ({ className }: P) => <Icon className={className}><path d="M8 2.5l6 10.5H2z" /><path d="M8 6.75v2.75M8 11.5v.01" /></Icon>;
export const IconCheck = ({ className }: P) => <Icon className={className}><path d="M3.5 8.5l3 3 6-7" /></Icon>;
export const IconDash = ({ className }: P) => <Icon className={className}><path d="M4 8h8" /></Icon>;
export const IconReturn = ({ className }: P) => <Icon className={className}><path d="M6 3L3 6l3 3" /><path d="M3 6h6.5a3.5 3.5 0 0 1 0 7H7" /></Icon>;
export const IconClock = ({ className }: P) => <Icon className={className}><circle cx="8" cy="8" r="5.5" /><path d="M8 4.75V8l2.25 1.5" /></Icon>;
export const IconTrash = ({ className }: P) => <Icon className={className}><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.5 8h6l.5-8" /></Icon>;

/** Ring-and-dot brand mark: a hollow ring (from earlier) beside a filled dot (searched now). */
export function BrandMark({ className }: P) {
  return <svg className={`brand-mark${className ? ` ${className}` : ''}`} viewBox="0 0 22 16" width="22" height="16" aria-hidden="true" focusable="false">
    <circle className="brand-mark-ring" cx="7" cy="8" r="5.25" fill="none" strokeWidth="1.75" />
    <circle className="brand-mark-dot" cx="16" cy="8" r="3.25" />
  </svg>;
}

export type ProvenanceKind = 'current' | 'historical' | 'demo';
/**
 * Provenance marks. filled dot = searched for this answer, hollow ring = from earlier,
 * dashed square = demo fixture. Shape carries the meaning; colour is a redundant third cue.
 */
export function Mark({ kind, className }: { kind: ProvenanceKind; className?: string }) {
  return <svg className={`mark mark-${kind}${className ? ` ${className}` : ''}`} viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" focusable="false">
    {kind === 'current' && <circle cx="5" cy="5" r="3.75" />}
    {kind === 'historical' && <circle cx="5" cy="5" r="3.1" fill="none" strokeWidth="1.5" />}
    {kind === 'demo' && <rect x="1.25" y="1.25" width="7.5" height="7.5" rx="1" fill="none" strokeWidth="1.25" strokeDasharray="2 1.5" />}
  </svg>;
}

/** The small DEMO tag: a dashed outline plus the word, never colour alone. */
export function DemoTag({ className, children = 'Demo' }: { className?: string; children?: ReactNode }) {
  return <span className={`demo-tag${className ? ` ${className}` : ''}`}>{children}</span>;
}

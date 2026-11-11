import type { CitationRecord } from '../../shared/research';
import type { CitationSource } from './sourceRegistry';

export const MARKERS = /\[(\d{1,3}(?:\s*,\s*\d{1,3})*)\]/g;
export function citationMarkers(text: string): number[] {
  return [...text.matchAll(MARKERS)].flatMap(match => match[1].split(',').map(Number));
}
const month = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const tokenPattern = new RegExp(`[$€£₹]\\s?\\d[\\d,]*(?:\\.\\d+)?|\\d[\\d,]*(?:\\.\\d+)?\\s?(?:USD|EUR|GBP|INR)\\b|\\d+(?:\\.\\d+)?%|\\bv?\\d+(?:\\.\\d+){2,}\\b|\\b\\d{4}-\\d{2}-\\d{2}(?=T|\\b)|\\b\\d{1,2} ${month}(?: \\d{4})?\\b|\\b${month} \\d{1,2}(?:, \\d{4})?\\b|\\b\\d[\\d,]*(?:\\.\\d+)?\\b`, 'gi');
type Token = { raw: string; normalized: string };
function tokens(text: string): Token[] {
  const clean = text.replace(MARKERS, '');
  return [...clean.matchAll(tokenPattern)].flatMap(([raw]) => {
    if (/^\d[\d,.]*$/.test(raw) && raw.replace(/[^1-9]/g, '').length < 2 && Number(raw.replaceAll(',', '')) < 10) return [];
    if (/^v?\d+(?:\.\d+){2,}$/i.test(raw)) return [{ raw, normalized: 'version:' + raw.replace(/^v/i, '').split('.').map(Number).join('.') }];
    let normalized = raw.toLowerCase().replace(/\b(january|february|march|april|june|july|august|september|october|november|december)\b/g, m => m.slice(0, 3));
    normalized = normalized.replaceAll(',', '').replace(/\d+(?:\.\d+)?/g, n => String(Number(n))).replace(/\s+/g, ' ').trim();
    normalized = normalized.replace(/\b(usd|eur|gbp|inr)\b/g, currency => ({ usd: '$', eur: '€', gbp: '£', inr: '₹' })[currency]!);
    const money = normalized.match(/^(?:([$€£₹])\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*([$€£₹]))$/);
    if (money) normalized = `${money[1] ?? money[4]}${money[2] ?? money[3]}`;
    const date = normalized.match(/^(?:(\d{4})-(\d{1,2})-(\d{1,2})|(\d{1,2}) ([a-z]{3})(?: (\d{4}))?|([a-z]{3}) (\d{1,2})(?: (\d{4}))?)$/);
    if (date) {
      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const year = date[1] ?? date[6] ?? date[9];
      const monthNumber = date[2] ? Number(date[2]) : months.indexOf(date[5] ?? date[7]) + 1;
      const day = Number(date[3] ?? date[4] ?? date[8]);
      normalized = `date:${year ?? '*'}-${monthNumber}-${day}`;
    }
    // A bare number may match the numeric part of a money/date token too.
    return [{ raw, normalized }];
  });
}
function supported(token: Token, evidence: Token[]): boolean {
  if (evidence.some(t => t.normalized === token.normalized)) return true;
  if (token.normalized.startsWith('date:*-')) return evidence.some(t => t.normalized.startsWith('date:') && t.normalized.split('-').slice(1).join('-') === token.normalized.split('-').slice(1).join('-'));
  if (/^\d+(?:\.\d+)?$/.test(token.normalized)) {
    return evidence.some(t => [...t.normalized.matchAll(/\d+(?:\.\d+)?/g)].some(([n]) => n === token.normalized));
  }
  return false;
}
const severity = { unchecked: 0, verified: 1, unverified: 2, invalid: 3 };
export function checkCitations(text: string, registry: Map<number, CitationSource>): CitationRecord[] {
  const checked = new Map<number, CitationRecord>();
  const subjects = [...new Set([...registry.values()].flatMap(s => s.subject ? [s.subject] : []))];
  for (const sentence of citationStatements(text)) {
    const markers = [...new Set(citationMarkers(sentence))];
    const required = tokens(sentence);
    const evidence = markers.flatMap(n => {
      const source = registry.get(n);
      const publication = /\bpublish/i.test(sentence) ? source?.publishedAt : '';
      const retrieval = /\bretriev/i.test(sentence) ? source?.retrievedAt : '';
      const dates = tokens([publication, retrieval].filter(Boolean).join(' ')).filter(t => t.normalized.startsWith('date:'));
      return [...tokens(source?.text ?? ''), ...dates];
    });
    const missing = required.filter(token => !supported(token, evidence));
    for (const marker of markers) {
      const source = registry.get(marker);
      const named = subjects.filter(subject => sentence.match(/\b[A-Z][a-zA-Z]+\b/g)?.some(word => word.toLowerCase() === subject.toLowerCase()));
      const mismatched = source?.identity && named.length > 0 && !named.some(subject => new RegExp(`\\b${subject}\\b`, 'i').test(source.identity!));
      const state = !source ? 'invalid' : mismatched ? 'unverified' : missing.length ? 'unverified' : required.length ? 'verified' : 'unchecked';
      const record: CitationRecord = { marker, sourceId: source?.sourceId ?? null, state,
        detail: !source ? 'No matching source.' : mismatched ? `Cited observation does not name ${named.join(' or ')}; check attribution.` : missing.length ? `not found in source: ${[...new Set(missing.map(t => t.raw))].join(', ')}` : null };
      if (!checked.has(marker) || severity[state] > severity[checked.get(marker)!.state]) checked.set(marker, record);
    }
  }
  return [...checked.values()];
}

export function citationStatements(text: string): string[] {
  // A marker after sentence punctuation still cites that sentence, not the next one.
  const attached = text.replace(/([.!?])([*_`]+)(?=\s|$)/g, '$2$1')
    .replace(/([.!?])[ \t]*((?:\[\d{1,3}(?:\s*,\s*\d{1,3})*\][ \t]*)+)/g, '$2$1 ');
  return attached.split('\n').flatMap(line => {
    // Table cells are independent claims; retain the row subject for attribution.
    const cells = line.trim().startsWith('|') ? line.split(/(?<!\\)\|/).slice(1, -1) : [line];
    return cells.flatMap((cell, index) => {
      const claim = cells.length > 1 && index > 0 ? `${cells[0]}: ${cell}` : cell;
      return claim.split(/(?<=\]);\s*|(?<=\]),\s*|(?<=\])\s+(?:and|while|versus)\s+|(?<=[.!?])\s+(?=[*_`]*[A-Z0-9"“(])/);
    });
  });
}

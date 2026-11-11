import type { CitationRecord } from '../../shared/research';

export const MARKERS = /\[(\d{1,3}(?:\s*,\s*\d{1,3})*)\]/g;
export function citationMarkers(text: string): number[] {
  return [...text.matchAll(MARKERS)].flatMap(match => match[1].split(',').map(Number));
}
const month = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const tokenPattern = new RegExp(`[$€£₹]\\s?\\d[\\d,]*(?:\\.\\d+)?|\\d[\\d,]*(?:\\.\\d+)?\\s?(?:USD|EUR|GBP|INR)\\b|\\d+(?:\\.\\d+)?%|\\b\\d{4}-\\d{2}-\\d{2}\\b|\\b\\d{1,2} ${month}(?: \\d{4})?\\b|\\b${month} \\d{1,2}(?:, \\d{4})?\\b|\\b\\d[\\d,]*(?:\\.\\d+)?\\b`, 'gi');
type Token = { raw: string; normalized: string };
function tokens(text: string): Token[] {
  const clean = text.replace(MARKERS, '');
  return [...clean.matchAll(tokenPattern)].flatMap(([raw]) => {
    if (/^\d[\d,.]*$/.test(raw) && raw.replace(/[^1-9]/g, '').length < 2 && Number(raw.replaceAll(',', '')) < 10) return [];
    let normalized = raw.toLowerCase().replace(/\b(january|february|march|april|june|july|august|september|october|november|december)\b/g, m => m.slice(0, 3));
    normalized = normalized.replaceAll(',', '').replace(/\d+(?:\.\d+)?/g, n => String(Number(n))).replace(/\s+/g, ' ').trim();
    normalized = normalized.replace(/\b(usd|eur|gbp|inr)\b/g, currency => ({ usd: '$', eur: '€', gbp: '£', inr: '₹' })[currency]!);
    const money = normalized.match(/^(?:([$€£₹])\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*([$€£₹]))$/);
    if (money) normalized = `${money[1] ?? money[4]}${money[2] ?? money[3]}`;
    // A bare number may match the numeric part of a money/date token too.
    return [{ raw, normalized }];
  });
}
function supported(token: Token, evidence: Token[]): boolean {
  if (evidence.some(t => t.normalized === token.normalized)) return true;
  if (/^\d+(?:\.\d+)?$/.test(token.normalized)) {
    return evidence.some(t => [...t.normalized.matchAll(/\d+(?:\.\d+)?/g)].some(([n]) => n === token.normalized));
  }
  return false;
}
const severity = { unchecked: 0, verified: 1, unverified: 2, invalid: 3 };
export function checkCitations(text: string, registry: Map<number, { sourceId: string; text: string }>): CitationRecord[] {
  const checked = new Map<number, CitationRecord>();
  const sentences = text.split(/\n|(?<=[.!?])\s+(?=[A-Z0-9"“(])/);
  for (const sentence of sentences) {
    const markers = [...new Set(citationMarkers(sentence))];
    const required = tokens(sentence);
    const evidence = tokens(markers.map(n => registry.get(n)?.text ?? '').join('\n'));
    const missing = required.filter(token => !supported(token, evidence));
    for (const marker of markers) {
      const source = registry.get(marker);
      const state = !source ? 'invalid' : missing.length ? 'unverified' : required.length ? 'verified' : 'unchecked';
      const record: CitationRecord = { marker, sourceId: source?.sourceId ?? null, state,
        detail: !source ? 'No matching source.' : missing.length ? `not found in source: ${[...new Set(missing.map(t => t.raw))].join(', ')}` : null };
      if (!checked.has(marker) || severity[state] > severity[checked.get(marker)!.state]) checked.set(marker, record);
    }
  }
  return [...checked.values()];
}

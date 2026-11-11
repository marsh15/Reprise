import { BUDGET } from '../agent/budget';

export function toExcerpt(content: string, limit: number = BUDGET.excerptChars): string {
  const clean = content.replace(/[\x00-\x1f\x7f-\x9f]/g, ' ')
    .replace(/<(\/?)(source|context|recalled|user_message)\b/gi, '‹$1$2').replace(/\s+/g, ' ').trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit - 1);
  return ((/\s/.test(clean[limit - 1] ?? '') ? cut.trimEnd() : cut.replace(/\s+\S*$/, '')) || cut) + '…';
}
export function normalizeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (/^utm_/i.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    return url.href;
  } catch { return null; }
}
export function dedupeByUrl<T extends { url: string }>(results: T[]): T[] {
  const seen = new Set<string>();
  return results.flatMap(result => {
    const url = normalizeUrl(result.url);
    if (!url || seen.has(url)) return [];
    seen.add(url);
    return [{ ...result, url }];
  });
}
export function normalizeQuery(query: string) { return query.trim().replace(/\s+/g, ' ').toLowerCase(); }

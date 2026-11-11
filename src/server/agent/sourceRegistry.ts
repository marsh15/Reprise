import type { SourceRecord } from '../../shared/research';
import { normalizeUrl } from '../search/sanitize';

export function createSourceRegistry(initial: SourceRecord[] = []) {
  const entries = new Map<number, { sourceId: string; text: string }>();
  const numbers = new Map<string, number>();
  const sources: SourceRecord[] = [];
  function register(source: Omit<SourceRecord, 'n'>): SourceRecord {
    const url = normalizeUrl(source.url);
    if (!url) throw new Error('Unsafe source URL');
    const n = numbers.get(url) ?? numbers.size + 1;
    numbers.set(url, n);
    const observation = { ...source, url, n };
    // Keep every observation; reusing a URL must never rewrite historical evidence.
    sources.push(observation);
    const previous = entries.get(n);
    entries.set(n, { sourceId: previous?.sourceId ?? source.sourceId,
      text: previous ? previous.text + '\n' + source.excerpt : source.excerpt });
    return observation;
  }
  initial.forEach(register);
  return { register, entries, sources };
}

import type { TurnResult } from '../src/server/agent/runTurn';

// These are transparent lexical/ledger checks, not a semantic correctness oracle.
export const completed = (r: TurnResult) => r.status === 'complete' ? [] : ['turn did not complete'];
export const noSearch = (r: TurnResult) => [...completed(r), ...(r.stats.searches ? ['unnecessary search'] : [])];
export const grounded = (r: TurnResult) => [...completed(r), ...(r.stats.searches < 1 ? ['no search'] : []),
  ...(!r.evidence?.citations.length ? ['no citations'] : []),
  ...(r.evidence?.citations.some(c => c.state === 'invalid') ? ['invalid citation'] : [])];
export const fixtureDisclosure = (text: string) => /demo|fixture|synthetic/i.test(text) ? [] : ['fixture not acknowledged'];
export const mentions = (text: string, names: string[]) => names.filter(name => !text.toLowerCase().includes(name.toLowerCase())).map(name => `missing product: ${name}`);
export const limitation = (text: string) => /cannot establish|can.t establish|no (?:earlier|historical|past) (?:source|observation|evidence)|without (?:earlier|historical)|unable to establish/i.test(text)
  ? [] : ['historical baseline limitation missing'];
export function hasSyntheticSearchEvidence(r: TurnResult) {
  const fresh = r.evidence?.sources.filter(s => r.evidence?.searches.some(search => search.id === s.searchId)) ?? [];
  return fresh.length > 0 && fresh.every(s => s.fixture);
}

export function undatedChangeClaims(r: TurnResult): string[] {
  const failures: string[] = [];
  for (const line of r.text.split(/\n|(?<=[.!?])\s+/)) {
    if (!/\b(?:changed|increased|raised|reduced|dropped)\s+(?:\S+\s+){0,5}on\b/i.test(line)) continue;
    const markers = [...line.matchAll(/\[(\d{1,3})\]/g)].map(m => Number(m[1]));
    const claimedDate = line.match(/\bon\s+(20\d{2}-\d{2}-\d{2})\b/i)?.[1];
    // A date elsewhere in a page is insufficient: require explicit change/effective wording.
    const dated = r.evidence?.sources.some(s => markers.includes(s.n)
      && /\b(?:effective|changed|increased|raised|reduced|dropped)\b/i.test(s.excerpt)
      && /\b20\d{2}-\d{2}-\d{2}\b/.test(s.excerpt)
      && (!claimedDate || s.excerpt.includes(claimedDate)));
    if (!dated) failures.push('dated change claim lacks cited explicit change evidence');
  }
  return failures;
}

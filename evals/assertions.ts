import { checkCitations, citationMarkers, citationStatements } from '../src/server/agent/citations';
import { createSourceRegistry } from '../src/server/agent/sourceRegistry';
import type { TurnResult } from '../src/server/agent/runTurn';

// These are transparent lexical/ledger checks, not a semantic correctness oracle.
export const completed = (r: TurnResult) => r.status === 'complete' ? [] : ['turn did not complete'];
export const noSearch = (r: TurnResult) => [...completed(r), ...(r.stats.searches ? ['unnecessary search'] : [])];
export const grounded = (r: TurnResult) => [...completed(r), ...(r.stats.searches < 1 ? ['no search'] : []),
  ...(!r.evidence?.citations.length ? ['no citations'] : []),
  ...citationIntegrity(r)];
export const fixtureDisclosure = (text: string) => /demo|fixture|synthetic/i.test(text) ? [] : ['fixture not acknowledged'];
export const mentions = (text: string, names: string[]) => names.filter(name => !text.toLowerCase().includes(name.toLowerCase())).map(name => `missing product: ${name}`);
export function limitation(text: string): string[] {
  // Bind absence to historical information, not an unrelated "no" in the same clause.
  const found = normalizeLanguage(text).split(/[.!?;\n]/).some(clause =>
    /\b(?:no|without|missing)\s+(?:\w+\s+){0,2}(?:earlier|previous|prior|historical|past)\s+(?:\w+\s+){0,2}(?:sources?|observations?|evidence|baseline|record|plans?|prices?|pricing|terms|commitment)\b/i.test(clause)
    || /\b(?:earlier|previous|prior|historical|past)\s+(?:\w+\s+){0,3}(?:sources?|observations?|evidence|baseline|record|plans?|prices?|pricing|terms|commitment)\s+(?:is|are|was|were)\s+(?:missing|unavailable|undocumented|unspecified|not (?:recorded|documented))\b/i.test(clause)
    || /\b(?:cannot|can't|unable to)\s+compar(?:e|ed)\b[^.]{0,80}\b(?:past|then|earlier|historical|last)\b/i.test(clause)
    || /\b(?:cannot|can't|unable to)\s+(?:identify\b[^.]{0,60}\bor\s+)?(?:establish|tell|determine|say|verify)\b[^.]{0,80}\b(?:whether|if)\b[^.]{0,40}\b(?:pric\w*|plans?)\b[^.]{0,20}\bchanged\b/i.test(clause)
    || /\b(?:cannot|can't) identify\b[^.]{0,80}\b(?:plans?|providers?|hosts?|prices?)\b[^.]{0,40}\b(?:discussed|meant|asked)\b/i.test(clause)
    || /\b(?:cannot|can't) establish what\b[^.]{0,40}\bprices?\b[^.]{0,40}\bthen\b[^.]{0,30}\bwhether they changed\b/i.test(clause)
    || /\b(?:price|pricing|historical) change cannot be established\b/i.test(clause));
  return found ? [] : ['historical baseline limitation missing'];
}
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
      && /\b(?:effective|changed|increased|raised|reduced|dropped)\b[^.!?;]{0,150}\b20\d{2}-\d{2}-\d{2}\b/i.test(s.excerpt)
      && !/\b(?:no|not) (?:dated |price |effective )?(?:change|increase|reduction|date)\b/i.test(s.excerpt)
      && (!claimedDate || s.excerpt.includes(claimedDate)));
    if (!dated) failures.push('dated change claim lacks cited explicit change evidence');
  }
  return failures;
}

export const normalizeLanguage = (text: string) => text.replace(/[‘’]/g, "'").replace(/[*_`]/g, '');
export const noRecord = (text: string) => /\bno (?:(?:conversation|saved|stored|historical|earlier|past) )?record\b|\bdon't have\b[^.\n]{0,40}\b(?:record|history|conversation)\b|\bno (?:(?:earlier|previous) )?conversations?|\b(?:previous|earlier|past) conversation is not (?:recorded|saved|stored)\b/i.test(normalizeLanguage(text));

export function changeDateUncertainty(text: string): boolean {
  // Bounded timing disclosures, not unrelated uncertainty elsewhere in the answer.
  return normalizeLanguage(text).split(/[.!?;\n]/).some(clause =>
    /\b(?:cannot|can't|do not|don't|does not|doesn't|did not|didn't)\s+(?:establish|say|show|determine|tell|indicate)\b[^.]{0,70}\b(?:when|date)\b[^.]{0,70}\b(?:chang(?:e|ed)|took effect)\b/i.test(clause)
    || /\bneither (?:source |observation |one )?(?:establishes|gives|shows|says)\b[^.]{0,70}\b(?:when|date)\b[^.]{0,70}\b(?:chang(?:e|ed)|took effect)\b/i.test(clause)
    || /\bneither (?:source |observation |one )?(?:establishes|gives|shows|says)\b[^.]{0,70}\beffective change date\b/i.test(clause)
    || /\b(?:cannot|can't)\s+date\s+(?:an?|the)\s+(?:underlying\s+)?(?:price\s+)?change\b/i.test(clause)
    || /\b(?:effective change date|date of change) (?:is )?unknown\b/i.test(clause)
    || /\bno effective change date\b/i.test(clause));
}
export const historyStart = (text: string) => /2026-11-11|11\s+Nov(?:ember)?(?:\s+2026)?|Nov(?:ember)?\s+11(?:,?\s+2026)?|history (?:starts|begins)[^.\n]{0,20}today/i.test(text);
export function affirmativeShipment(text: string): boolean {
  // A bounded lexical guard for these controlled availability cases, not a semantic judge.
  return normalizeLanguage(text).split(/[.!?;\n]|\bbut\b|\bhowever\b/i).some(clause => {
    const claim = /\b(?:atlas|salesforce|it|feature)\s+(?:(?:has|is|was)\s+)?(?:(?:now|already|generally)\s+)?(?:shipped|released(?!\s+(?:(?:an?|the|its|their)\s+)?(?:announcement|statement|notice)\b)|launched|available)\b/i.exec(clause);
    if (!claim) return false;
    const prefix = clause.slice(0, claim.index);
    return !/\b(?:not|no|cannot|can't|couldn't)\b[^;]{0,70}\b(?:evidence|indicate|establish|confirm|say|show|mean|prove|support)\b/i.test(prefix);
  });
}
export const negativeAvailability = (text: string) => /future|planned|\b(?:not|cannot|can't|couldn't|wasn't|isn't|hasn't|doesn't)\b[^.\n|]{0,80}\b(?:shipped|released|available|availability)\b/i.test(normalizeLanguage(text));

export function inventedPast(text: string): boolean {
  return normalizeLanguage(text).split(/[.!?;\n]/).some(clause => {
    const claim = /\b(?:I|we) (?:previously )?(?:recommended|told you|discussed)|\byou (?:asked|said)[^$]{0,80}\$\d/i.exec(clause);
    if (!claim) return false;
    return !/\b(?:no|not|cannot|can't|couldn't)\b[^;]{0,100}(?:compare|identify|know|tell|record|establish)/i.test(clause.slice(0, claim.index));
  });
}

export function citationIntegrity(r: TurnResult): string[] {
  const registry = createSourceRegistry(r.evidence?.sources ?? []);
  const checked = checkCitations(r.text, registry.entries);
  const statements = citationStatements(r.text);
  return [
    ...(checked.some(c => c.state === 'invalid') ? ['invalid citation'] : []),
    ...(checked.some(c => c.state === 'unverified') ? ['unverified citation'] : []),
    ...(statements.some((line, index) => /[$€£₹]\s*\d|\d\s*(?:USD|EUR|GBP|INR)\b/i.test(line) && !citationMarkers(line).length && !supportedDifference(statements, index, registry.entries))
      ? ['uncited numerical source claim'] : []),
  ];
}

export const uncertaintyDisclosure = (text: string) => /unable to verify|cannot verify|(?:cannot|can't) (?:be )?establish(?:ed)?/i.test(normalizeLanguage(text))
  || /\b(?:prior|historical|earlier) (?:\w+\s+){0,5}(?:terms|packaging|baseline|evidence)[^|\n]{0,100}(?:missing|incomplete|unspecified|undocumented|not (?:recorded|documented)|aren't documented)/i.test(normalizeLanguage(text))
  // The passive form of "cannot be established", bound to the change, its timing or cause, or the historical terms.
  // "No change is established" stays a separate category, and an unrelated "current price is not established" does not count.
  || normalizeLanguage(text).split(/[.!?;\n]/).some(clause =>
    /\b(?:changes?|differences?|increase|timing|cause|date|terms|packaging|baseline|history|commitment)\b[^|]{0,40}\b(?:is|are|was|were) not (?:yet )?established\b/i.test(clause)
    || /\bno (?:\w+\s+){0,3}(?:date|timing|cause) is established\b/i.test(clause));

// C3 asks the answer to separate an original error from a later vendor change. Negating the change counts only when the
// historical baseline is also named, so a contradiction by current evidence alone is not enough.
export function originalErrorNotLaterChange(text: string): boolean {
  const normalized = normalizeLanguage(text);
  return /\b(?:not|isn't|wasn't|rather than|no evidence of)\s+(?:evidence\s+of\s+|due\s+to\s+|caused\s+by\s+|because\s+of\s+)?(?:an?\s+|any\s+)?(?:later\s+|subsequent\s+|actual\s+)?(?:plan\s+|vendor\s+|product\s+|pricing\s+)?(?:change|update)\b/i.test(normalized)
    && /\b(?:historical|earlier|stored|recorded|original)\b[^.]{0,60}\b(?:observation|source|evidence|terms|page|documentation)\b/i.test(normalized);
}

function supportedDifference(statements: string[], index: number, registry: ReturnType<typeof createSourceRegistry>['entries']) {
  // Evaluation-only arithmetic: do not treat a labelled derived difference as a vendor quote.
  const money = (text: string) => [...text.matchAll(/([$€£₹])\s*(\d+(?:\.\d+)?)/g)];
  const line = statements[index];
  if (!/\b(?:difference|more|less)\b/i.test(line) || money(line).length !== 1) return false;
  const operands = statements.slice(0, index).filter(s => money(s).length === 1 && citationMarkers(s).length === 1).slice(-2);
  if (operands.length !== 2) return false;
  const observations = operands.map(s => registry.get(citationMarkers(s)[0]));
  if (!observations.every(s => s?.subject && money(s.text).length === 1)) return false;
  const subjects = observations.map(s => s!.subject!);
  const named = subjects.map(subject => new RegExp(`\\b${subject}\\b`, 'i').test(line));
  if (subjects[0] !== subjects[1] && !named.some(Boolean)) return false;
  if (operands.some(s => checkCitations(s, registry).some(c => c.state !== 'verified'))) return false;
  const values = [...operands, line].map(s => money(s)[0]);
  const unit = (text: string) => text.match(/(?:per\s+|\/)(month|year|seat|user|project)\b|\b(month)ly\b|\b(year)ly\b/i)?.slice(1).find(Boolean)?.toLowerCase();
  const units = observations.map(s => unit(s!.text));
  if (operands.some((s, i) => unit(s) && unit(s) !== units[i])) return false;
  if (!units[0] || units[0] !== units[1] || (unit(line) && unit(line) !== units[0]) || !values.every(v => v[1] === values[0][1])) return false;
  if (/\b(?:more|less)\b/i.test(line)) {
    if (named.filter(Boolean).length !== 1) return false;
    const target = named[0] ? 0 : 1;
    const delta = Number(values[target][2]) - Number(values[1 - target][2]);
    if (/\bmore\b/i.test(line) ? delta <= 0 : delta >= 0) return false;
  }
  return Math.abs(Math.abs(Number(values[1][2]) - Number(values[0][2])) - Number(values[2][2])) < 1e-9;
}

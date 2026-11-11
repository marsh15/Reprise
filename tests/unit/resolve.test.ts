import { describe, expect, it } from 'vitest';
import { resolveDates } from '../../src/server/time/resolve';

type Kind = 'day' | 'range' | 'since' | 'last_mention';
type Case = {
  text: string;
  phrase: string;
  kind: Kind;
  dates: [string, string][];
  ambiguous?: boolean;
  now?: string;
  tz?: string;
};

const defaultNow = '2026-11-11T08:30:00Z';
const defaultTz = 'Asia/Kolkata';
const cases: Case[] = [
  { text: 'today', phrase: 'today', kind: 'day', dates: [['2026-11-11', '2026-11-11']] },
  { text: 'earlier today', phrase: 'earlier today', kind: 'day', dates: [['2026-11-11', '2026-11-11']] },
  { text: 'this morning', phrase: 'this morning', kind: 'day', dates: [['2026-11-11', '2026-11-11']] },
  { text: 'THIS AFTERNOON', phrase: 'THIS AFTERNOON', kind: 'day', dates: [['2026-11-11', '2026-11-11']] },
  { text: 'yesterday', phrase: 'yesterday', kind: 'day', dates: [['2026-11-10', '2026-11-10']] },
  { text: 'day before yesterday', phrase: 'day before yesterday', kind: 'day', dates: [['2026-11-09', '2026-11-09']] },
  { text: '3 days ago', phrase: '3 days ago', kind: 'day', dates: [['2026-11-08', '2026-11-08']] },
  { text: '12 days ago', phrase: '12 days ago', kind: 'day', dates: [['2026-10-30', '2026-10-30']] },
  { text: '2 days ago', phrase: '2 days ago', kind: 'day', dates: [['2025-12-31', '2025-12-31']], now: '2026-01-02T12:00:00Z', tz: 'UTC' },
  { text: '1 week ago', phrase: '1 week ago', kind: 'range', dates: [['2026-11-01', '2026-11-07']] },
  { text: '3 weeks ago', phrase: '3 weeks ago', kind: 'range', dates: [['2026-10-18', '2026-10-24']] },
  { text: '2 weeks ago', phrase: '2 weeks ago', kind: 'range', dates: [['2025-12-20', '2025-12-26']], now: '2026-01-06T12:00:00Z', tz: 'UTC' },
  { text: 'on Monday', phrase: 'on Monday', kind: 'day', dates: [['2026-11-09', '2026-11-09']] },
  { text: 'on Wednesday', phrase: 'on Wednesday', kind: 'day', dates: [['2026-11-04', '2026-11-04']] },
  { text: 'on Thursday', phrase: 'on Thursday', kind: 'day', dates: [['2026-11-05', '2026-11-05']] },
  { text: 'on Sunday', phrase: 'on Sunday', kind: 'day', dates: [['2026-11-08', '2026-11-08']] },
  { text: 'last Tuesday', phrase: 'last Tuesday', kind: 'day', dates: [['2026-11-10', '2026-11-10'], ['2026-11-03', '2026-11-03']], ambiguous: true },
  { text: 'last Wednesday', phrase: 'last Wednesday', kind: 'day', dates: [['2026-11-04', '2026-11-04'], ['2026-10-28', '2026-10-28']], ambiguous: true },
  { text: 'last Friday', phrase: 'last Friday', kind: 'day', dates: [['2026-11-06', '2026-11-06'], ['2026-10-30', '2026-10-30']], ambiguous: true },
  { text: 'this week', phrase: 'this week', kind: 'range', dates: [['2026-11-09', '2026-11-11']] },
  { text: 'last week', phrase: 'last week', kind: 'range', dates: [['2026-11-02', '2026-11-08']] },
  { text: 'last week', phrase: 'last week', kind: 'range', dates: [['2026-11-02', '2026-11-08']], now: '2026-11-09T12:00:00Z', tz: 'UTC' },
  { text: 'this week', phrase: 'this week', kind: 'range', dates: [['2026-11-09', '2026-11-09']], now: '2026-11-09T12:00:00Z', tz: 'UTC' },
  { text: 'last week', phrase: 'last week', kind: 'range', dates: [['2025-12-22', '2025-12-28']], now: '2026-01-01T12:00:00Z', tz: 'UTC' },
  { text: 'this month', phrase: 'this month', kind: 'range', dates: [['2026-11-01', '2026-11-11']] },
  { text: 'last month', phrase: 'last month', kind: 'range', dates: [['2026-10-01', '2026-10-31']] },
  { text: 'last month', phrase: 'last month', kind: 'range', dates: [['2025-12-01', '2025-12-31']], now: '2026-01-01T12:00:00Z', tz: 'UTC' },
  { text: 'last month', phrase: 'last month', kind: 'range', dates: [['2024-02-01', '2024-02-29']], now: '2024-03-15T12:00:00Z', tz: 'UTC' },
  { text: '3 November', phrase: '3 November', kind: 'day', dates: [['2026-11-03', '2026-11-03']] },
  { text: 'November 3rd', phrase: 'November 3rd', kind: 'day', dates: [['2026-11-03', '2026-11-03']] },
  { text: '28 December', phrase: '28 December', kind: 'day', dates: [['2025-12-28', '2025-12-28']] },
  { text: '11 Nov', phrase: '11 Nov', kind: 'day', dates: [['2026-11-11', '2026-11-11']] },
  { text: '12 Nov', phrase: '12 Nov', kind: 'day', dates: [['2025-11-12', '2025-11-12']] },
  { text: '3 November 2024', phrase: '3 November 2024', kind: 'day', dates: [['2024-11-03', '2024-11-03']] },
  { text: 'February 29th 2024', phrase: 'February 29th 2024', kind: 'day', dates: [['2024-02-29', '2024-02-29']] },
  { text: 'since last week', phrase: 'since last week', kind: 'since', dates: [['2026-11-02', '2026-11-11']] },
  { text: 'since yesterday', phrase: 'since yesterday', kind: 'since', dates: [['2026-11-10', '2026-11-11']] },
  { text: 'since 3 November', phrase: 'since 3 November', kind: 'since', dates: [['2026-11-03', '2026-11-11']] },
  { text: 'since this month', phrase: 'since this month', kind: 'since', dates: [['2026-11-01', '2026-11-11']] },
  { text: 'since 2 weeks ago', phrase: 'since 2 weeks ago', kind: 'since', dates: [['2026-10-25', '2026-11-11']] },
  { text: 'last time we talked', phrase: 'last time we talked', kind: 'last_mention', dates: [] },
  { text: 'last time we discussed', phrase: 'last time we discussed', kind: 'last_mention', dates: [] },
  { text: 'last time I asked', phrase: 'last time I asked', kind: 'last_mention', dates: [] },
  { text: 'since we spoke', phrase: 'since we spoke', kind: 'last_mention', dates: [] },
  { text: 'since we last talked', phrase: 'since we last talked', kind: 'last_mention', dates: [] },
  { text: 'What did we discuss on Monday about hosting?', phrase: 'on Monday', kind: 'day', dates: [['2026-11-09', '2026-11-09']] },
  { text: 'yesterday', phrase: 'yesterday', kind: 'day', dates: [['2026-11-11', '2026-11-11']], now: '2026-11-11T20:00:00Z' },
  { text: 'yesterday', phrase: 'yesterday', kind: 'day', dates: [['2026-10-31', '2026-10-31']], now: '2026-11-02T03:30:00Z', tz: 'America/New_York' },
  { text: 'yesterday', phrase: 'yesterday', kind: 'day', dates: [['2026-03-07', '2026-03-07']], now: '2026-03-09T03:30:00Z', tz: 'America/New_York' },
  { text: 'today', phrase: 'today', kind: 'day', dates: [['2027-01-01', '2027-01-01']], now: '2026-12-31T10:30:00Z', tz: 'Pacific/Kiritimati' },
  { text: 'today', phrase: 'today', kind: 'day', dates: [['2025-12-31', '2025-12-31']], now: '2026-01-01T09:30:00Z', tz: 'Pacific/Honolulu' },
];

describe('resolveDates', () => {
  it.each(cases)('resolves $text (now=$now, tz=$tz)', ({ text, phrase, kind, dates, ambiguous, now, tz }) => {
    const result = resolveDates(text, new Date(now ?? defaultNow), tz ?? defaultTz);
    expect(result).toHaveLength(1);
    expect(result[0].phrase.toLowerCase()).toBe(phrase.toLowerCase());
    expect(result[0].kind).toBe(kind);
    expect(result[0].ambiguous).toBe(ambiguous ?? false);
    expect(result[0].candidates.map(({ from, to }) => [from, to])).toEqual(dates);
    for (const candidate of result[0].candidates) expect(typeof candidate.label).toBe('string');
  });

  it.each([
    'may I ask a question?', 'march forward', 'a second opinion',
    '3/11', '11/3/2026', '31 February 2026', 'February 30th 2024',
    '29 February 2025', '31 April 2026', 'no date here',
  ])('ignores invalid or unsupported text: %s', (text) => {
    expect(resolveDates(text, new Date(defaultNow), defaultTz)).toEqual([]);
  });

  it('finds separate phrases in text order without overlapping matches', () => {
    const results = resolveDates('Compare yesterday with 3 November.', new Date(defaultNow), defaultTz);
    expect(results.map(({ phrase, candidates }) => ({
      phrase: phrase.toLowerCase(), dates: candidates.map(({ from, to }) => [from, to]),
    }))).toEqual([
      { phrase: 'yesterday', dates: [['2026-11-10', '2026-11-10']] },
      { phrase: '3 november', dates: [['2026-11-03', '2026-11-03']] },
    ]);
  });
});

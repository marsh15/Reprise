import { describe, expect, it } from 'vitest';
import { dedupeByUrl, normalizeQuery, normalizeUrl, toExcerpt } from '../../src/server/search/sanitize';

describe('toExcerpt', () => {
  it.each([
    ['  alpha\t\n beta\r\n gamma  ', 'alpha beta gamma'],
    ['a\x00b\x1fc\x7fd\x85e\x9ff', 'a b c d e f'],
    [' <source id="1">x</source> ', '‹source id="1">x‹/source>'],
    ['<SOURCE>x</SoUrCe> <CoNtExT>y</CONTEXT> <ReCaLlEd>z</rEcAlLeD>',
      '‹SOURCE>x‹/SoUrCe> ‹CoNtExT>y‹/CONTEXT> ‹ReCaLlEd>z‹/rEcAlLeD>'],
    ['<user_message>x</USER_MESSAGE>', '‹user_message>x‹/USER_MESSAGE>'],
    ['<sourceful> and <contextual>', '<sourceful> and <contextual>'],
  ])('sanitizes %j', (input, expected) => {
    expect(toExcerpt(input)).toBe(expected);
  });

  it('truncates at a word boundary within the default limit', () => {
    const excerpt = toExcerpt(`${'word '.repeat(400)}tail`);
    expect(excerpt.length).toBeLessThanOrEqual(1500);
    expect(excerpt).toBe(`${'word '.repeat(300).trimEnd()}…`);
  });

  it('bounds a single unbroken word and honors a custom limit', () => {
    expect(toExcerpt('x'.repeat(2000))).toBe(`${'x'.repeat(1499)}…`);
    expect(toExcerpt('alpha beta gamma', 11)).toBe('alpha beta…');
    expect(toExcerpt('short', 5)).toBe('short');
  });
});

describe('normalizeUrl', () => {
  it.each([
    ['HTTPS://EXAMPLE.COM/path?utm_source=a&b=2&UTM_medium=x&a=1#section', 'https://example.com/path?a=1&b=2'],
    ['http://EXAMPLE.com:80', 'http://example.com/'],
    ['https://example.com/?z=2&a=hello%20world', 'https://example.com/?a=hello+world&z=2'],
    ['javascript:alert(1)', null],
    ['data:text/html,hello', null],
    ['ftp://example.com/file', null],
    ['https://user@example.com/', null],
    ['https://user:password@example.com/', null],
    ['https://:password@example.com/', null],
    ['not a url', null],
  ])('normalizes %j', (input, expected) => {
    expect(normalizeUrl(input)).toBe(expected);
  });
});

describe('dedupeByUrl', () => {
  it('deduplicates canonical URLs while retaining the first result provenance', () => {
    const results = [
      { url: 'https://EXAMPLE.com/article?b=2&utm_source=x&a=1#part', published_at: null, retrieved_at: '2026-11-01', title: 'first' },
      { url: 'https://example.com/article?a=1&b=2', published_at: '2026-10-01', retrieved_at: '2026-11-02', title: 'duplicate' },
      { url: 'https://example.com/article?a=2&b=2', published_at: '2026-10-02', retrieved_at: '2026-11-03', title: 'distinct' },
      { url: 'https://user@example.com/', published_at: null, retrieved_at: '2026-11-04', title: 'unsafe' },
    ];
    expect(dedupeByUrl(results)).toEqual([
      { ...results[0], url: 'https://example.com/article?a=1&b=2' },
      { ...results[2], url: 'https://example.com/article?a=2&b=2' },
    ]);
    expect(results[0].url).toContain('utm_source');
  });
});

describe('normalizeQuery', () => {
  it.each([
    ['  Latest\tNEWS\n today  ', 'latest news today'],
    ['MIXED   Case', 'mixed case'],
    [' \n\t ', ''],
  ])('normalizes %j', (input, expected) => {
    expect(normalizeQuery(input)).toBe(expected);
  });

  it('makes whitespace and case variants of a query equal', () => {
    expect(normalizeQuery('  Recent   PRICING\nChanges ')).toBe(normalizeQuery('recent pricing changes'));
  });
});

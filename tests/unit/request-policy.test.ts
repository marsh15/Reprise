import { describe, expect, it } from 'vitest';
import { admit, allowedHosts, isApiPath } from '../../src/server/requestPolicy';

const hosts = allowedHosts(5173);
type H = Record<string, string | string[] | undefined>;
const id = '3f2b8c1e-0d4a-4b5e-9a7c-1e2d3c4b5a69';
const same: H = { host: 'localhost:5173', origin: 'http://localhost:5173', 'sec-fetch-site': 'same-origin' };
const json: H = { ...same, 'content-type': 'application/json', 'content-length': '50' };
const call = (method: string, url: string, headers: H) => admit({ method, url, headers }, hosts);
const deny = (status: 400 | 403 | 404 | 415, code: string) => ({ status, code });
const turns = '/api/turns';

describe('request admission policy', () => {
  it.each<[string, string, string, H]>([
    ['same-origin JSON POST', 'POST', turns, json],
    ['JSON with charset', 'POST', turns, { ...json, 'content-type': 'application/json; charset=utf-8' }],
    ['JSON media type is case-insensitive', 'POST', turns, { ...json, 'content-type': 'Application/JSON' }],
    ['127.0.0.1 host and origin', 'POST', turns, { ...json, host: '127.0.0.1:5173', origin: 'http://127.0.0.1:5173' }],
    ['non-browser JSON POST (no origin, no fetch metadata)', 'POST', turns, { host: 'localhost:5173', 'content-type': 'application/json', 'content-length': '50' }],
    ['bodyless same-origin cancel', 'POST', `/api/conversations/${id}/cancel`, same],
    ['same-origin DELETE', 'DELETE', `/api/conversations/${id}`, same],
    ['GET same-origin', 'GET', '/api/conversations', same],
    ['GET navigation (sec-fetch-site none)', 'GET', '/api/conversations', { host: 'localhost:5173', 'sec-fetch-site': 'none' }],
    ['GET with no metadata', 'GET', '/api/conversations', { host: 'localhost:5173' }],
    ['non-API page is not origin-restricted', 'GET', '/', { host: 'localhost:5173', 'sec-fetch-site': 'cross-site' }],
    ['non-API asset is not origin-restricted', 'GET', '/src/main.tsx', { host: 'localhost:5173', 'sec-fetch-site': 'cross-site' }],
    ['host is case-insensitive', 'GET', '/', { host: 'LOCALHOST:5173' }],
  ])('admits %s', (_name, method, url, headers) => {
    expect(call(method, url, headers)).toBeNull();
  });

  const badHosts: [string, string | string[] | undefined][] = [
    ['foreign name', 'attacker.example:5173'], ['other port', 'localhost:5174'], ['no port', 'localhost'],
    ['trailing dot', 'localhost.:5173'], ['IPv6 loopback', '[::1]:5173'], ['127.0.0.1 no port', '127.0.0.1'],
    ['0.0.0.0', '0.0.0.0:5173'], ['127.0.0.2', '127.0.0.2:5173'], ['missing', undefined],
    ['array', ['localhost:5173', 'localhost:5173']], ['userinfo-style', 'localhost:5173@evil'],
  ];
  describe.each([['API path', 'GET', turns], ['API POST', 'POST', turns], ['non-API path', 'GET', '/@fs/x']])('%s', (_label, method, url) => {
    it.each(badHosts)('rejects Host: %s', (_name, host) => {
      expect(call(method, url, { ...json, host })).toEqual(expect.objectContaining(deny(403, 'forbidden_host')));
    });
  });

  it.each<[string, string, string, H]>([
    ['cross-site text/plain POST', 'POST', turns, { host: 'localhost:5173', origin: 'https://evil.example', 'sec-fetch-site': 'cross-site', 'content-type': 'text/plain' }],
    ['same-site POST from another localhost port', 'POST', turns, { ...json, origin: 'http://localhost:3000', 'sec-fetch-site': 'same-site' }],
    ['null origin', 'POST', turns, { ...json, origin: 'null' }],
    ['other-port origin without fetch metadata', 'POST', turns, { host: 'localhost:5173', origin: 'http://localhost:3000', 'content-type': 'application/json' }],
    ['scheme mismatch', 'POST', turns, { ...json, origin: 'https://localhost:5173' }],
    ['origin suffix attack', 'POST', turns, { ...json, origin: 'http://localhost:5173.evil.example' }],
    ['origin list', 'POST', turns, { ...json, origin: 'http://localhost:5173, https://evil.example' }],
    ['valid origin but cross-site metadata', 'POST', turns, { ...json, 'sec-fetch-site': 'cross-site' }],
    ['127.0.0.1 origin against localhost host', 'POST', turns, { ...json, origin: 'http://127.0.0.1:5173' }],
    ['preflight from evil origin', 'OPTIONS', turns, { host: 'localhost:5173', origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }],
    ['preflight from valid origin', 'OPTIONS', turns, same],
    ['GET cross-site', 'GET', '/api/conversations', { host: 'localhost:5173', 'sec-fetch-site': 'cross-site' }],
    ['GET same-site', 'GET', '/api/conversations', { host: 'localhost:5173', 'sec-fetch-site': 'same-site' }],
    ['POST with sec-fetch-site none', 'POST', turns, { ...json, 'sec-fetch-site': 'none' }],
  ])('rejects %s as forbidden_origin', (_name, method, url, headers) => {
    expect(call(method, url, headers)).toEqual(expect.objectContaining(deny(403, 'forbidden_origin')));
  });

  it.each<[string, string, string, H]>([
    ['text/plain', 'POST', turns, { ...same, 'content-type': 'text/plain', 'content-length': '50' }],
    ['urlencoded form', 'POST', turns, { ...same, 'content-type': 'application/x-www-form-urlencoded', 'content-length': '50' }],
    ['multipart form', 'POST', turns, { ...same, 'content-type': 'multipart/form-data; boundary=x', 'content-length': '50' }],
    ['missing content-type', 'POST', turns, { ...same, 'content-length': '50' }],
    ['application/jsonx', 'POST', turns, { ...same, 'content-type': 'application/jsonx', 'content-length': '50' }],
    ['application/json-patch+json', 'POST', turns, { ...same, 'content-type': 'application/json-patch+json', 'content-length': '50' }],
    ['non-browser text/plain', 'POST', turns, { host: 'localhost:5173', 'content-type': 'text/plain', 'content-length': '50' }],
    ['DELETE with text/plain body', 'DELETE', `/api/conversations/${id}`, { ...same, 'content-type': 'text/plain', 'content-length': '5' }],
    ['chunked POST without content-type', 'POST', '/api/other', { ...same, 'transfer-encoding': 'chunked' }],
  ])('rejects %s as unsupported_media_type', (_name, method, url, headers) => {
    expect(call(method, url, headers)).toEqual(expect.objectContaining(deny(415, 'unsupported_media_type')));
  });

  describe('editor launcher route', () => {
    it.each(['/__open-in-editor?file=README.md', '/__OPEN-IN-EDITOR?file=x', '/__open-in-editor/x'])('hides %s behind 404 for a valid host', (url) => {
      expect(call('GET', url, same)).toEqual(expect.objectContaining(deny(404, 'not_found')));
    });
    it.each(['/__open-in-editor?file=README.md', '/__OPEN-IN-EDITOR?file=x', '/__open-in-editor/x'])('reports forbidden_host for %s with a bad host', (url) => {
      expect(call('GET', url, { ...same, host: 'attacker.example:5173' })).toEqual(expect.objectContaining(deny(403, 'forbidden_host')));
    });
    // Vite's router reads the pathname of absolute-form targets, which browsers never send.
    it.each(['http://localhost:5173/__open-in-editor?file=README.md', 'HTTP://LOCALHOST:5173/__OPEN-IN-EDITOR?file=x',
      'http://evil.example/__open-in-editor?file=x', 'https://localhost:5173/__open-in-editor', 'http://localhost:5173/x/../__open-in-editor?file=x',
      'http://localhost:5173/./__open-in-editor', 'http://localhost:5173\\__open-in-editor?file=x', 'http://user@localhost:5173/__open-in-editor?file=x',
      'http://localhost:5173/?next=/__open-in-editor'])('hides absolute-form %s behind 404', (url) => {
      expect(call('GET', url, same)).toEqual(expect.objectContaining(deny(404, 'not_found')));
    });
    it.each(['*', 'localhost:5173/__open-in-editor', 'file:///etc/hosts', 'http://localhost:5173:99/__open-in-editor', 'javascript:alert(1)'])('rejects unparseable or non-HTTP target %s', (url) => {
      expect(call('GET', url, same)).toEqual(expect.objectContaining(deny(400, 'bad_request')));
    });
    it('still admits ordinary absolute-form and origin-form paths', () => {
      expect(call('GET', 'http://localhost:5173/main.tsx', same)).toBeNull();
      expect(call('GET', '/main.tsx?import', same)).toBeNull();
      expect(call('GET', '/?q=__open-in-editor', same)).toBeNull();
    });
  });

  it('recognises only /api and /api/* as API paths', () => {
    expect(isApiPath('/api')).toBe(true); expect(isApiPath('/api/x')).toBe(true);
    expect(isApiPath('/apix')).toBe(false); expect(isApiPath('/x/api')).toBe(false);
  });
});

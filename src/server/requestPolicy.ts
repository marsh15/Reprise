import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';

export type Denial = { status: 403 | 404 | 415; code: string; message: string };
type Request = { method?: string; url?: string; headers: IncomingHttpHeaders };

const readMethods = new Set(['GET', 'HEAD']);
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? undefined : value);

/** The listener binds 127.0.0.1 only, so these are the only names a legitimate browser tab can use. */
export function allowedHosts(port: number) {
  const hosts = [`localhost:${port}`, `127.0.0.1:${port}`];
  return new Set(port === 80 ? [...hosts, 'localhost', '127.0.0.1'] : hosts);
}

export const isApiPath = (path: string) => path === '/api' || path.startsWith('/api/');

/**
 * Admission for every HTTP request, checked before Hono or Vite sees it.
 * Browser-origin protection only: a native process on this machine can send any headers,
 * so this does not separate local OS users (see docs/SECURITY-HARDENING.md).
 */
export function admit(req: Request, hosts: Set<string>): Denial | null {
  const method = (req.method ?? 'GET').toUpperCase();
  const path = (req.url ?? '/').split('?')[0];
  const host = one(req.headers.host)?.toLowerCase();
  // DNS rebinding: a foreign name resolving to 127.0.0.1 still carries its own Host.
  if (!host || !hosts.has(host)) return { status: 403, code: 'forbidden_host', message: 'Unexpected Host header.' };
  // Vite's editor launcher is not needed by Reprise and any page could trigger it.
  if (path.toLowerCase().startsWith('/__open-in-editor')) return { status: 404, code: 'not_found', message: 'Not found.' };
  if (!isApiPath(path)) return null;

  const read = readMethods.has(method);
  const site = one(req.headers['sec-fetch-site']);
  const origin = req.headers.origin;
  if (method === 'OPTIONS') return { status: 403, code: 'forbidden_origin', message: 'Cross-origin requests are not allowed.' };
  // same-site is not same-origin: another localhost port is same-site.
  if (site !== undefined && site !== 'same-origin' && !(read && site === 'none')) {
    return { status: 403, code: 'forbidden_origin', message: 'Cross-origin requests are not allowed.' };
  }
  // Exact scheme, host and port; rejects "null", lists and other localhost ports.
  if (origin !== undefined && origin !== `http://${host}`) return { status: 403, code: 'forbidden_origin', message: 'Cross-origin requests are not allowed.' };
  if (read) return null;
  // Browsers attach Origin and Sec-Fetch-Site to every cross-origin POST/DELETE. A mutation with
  // neither comes from a non-browser client, which this check cannot (and does not try to) restrict.
  const hasBody = Number(one(req.headers['content-length']) ?? 0) > 0 || req.headers['transfer-encoding'] !== undefined;
  const type = one(req.headers['content-type'])?.split(';')[0].trim().toLowerCase();
  if ((hasBody || path === '/api/turns') && type !== 'application/json') {
    return { status: 415, code: 'unsupported_media_type', message: 'Send application/json.' };
  }
  return null;
}

/** Request handler prefix: answers rejected requests and returns false; returns true when the request may proceed. */
export function createGuard(port: number) {
  const hosts = allowedHosts(port);
  return (req: IncomingMessage, res: ServerResponse) => {
    const denial = admit(req, hosts);
    if (!denial) return true;
    const api = isApiPath((req.url ?? '/').split('?')[0]);
    res.writeHead(denial.status, { 'Content-Type': api ? 'application/json' : 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(api ? JSON.stringify({ error: { code: denial.code, message: denial.message, retryable: false } }) : denial.message);
    return false;
  };
}

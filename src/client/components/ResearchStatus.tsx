import type { SearchRecord, SourceRecord } from '../../shared/research';
import '../research.css';

function safeUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch { return null; }
}

function dateLabel(value: string | null, options: Intl.DateTimeFormatOptions): string {
  if (!value) return 'date unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'date unknown' : date.toLocaleString(undefined, options);
}

function statusLabel(status: SearchRecord['status']): string {
  switch (status) {
    case 'ok': return '✓';
    case 'empty': return 'No results';
    case 'error': return 'Failed';
    case 'timeout': return 'Timed out';
    case 'skipped_budget': return 'Skipped (search budget reached)';
  }
}

export function ResearchStatus({ searches, sources, running }: { searches: SearchRecord[]; sources: SourceRecord[]; running: boolean }) {
  if (!searches.length) return null;
  if (running) return <div className="research-running" role="status" aria-live="polite">
    <span className="research-spinner" aria-hidden="true" />
    <span>Searching · {searches.map(search => search.query).join(' · ')}…</span>
  </div>;
  const starts = searches.map(search => Date.parse(search.startedAt));
  const duration = Math.max(...searches.map((search, i) => starts[i] + search.durationMs)) - Math.min(...starts);
  return <details className="research-status">
    <summary>{searches.length} {searches.length === 1 ? 'search' : 'searches'} · {sources.length} {sources.length === 1 ? 'source' : 'sources'} · {(duration / 1000).toFixed(1)} s</summary>
    <ul className="research-queries">{searches.map(search => <li key={search.id}>
      <div><strong>{search.query}</strong> <span className="research-muted">· {statusLabel(search.status)}</span></div>
      {search.error && <div className="research-error">{({ auth: 'Search unavailable (authentication)', quota: 'Search unavailable (quota)', timeout: 'Search timed out', duplicate: 'Query already searched', budget_exceeded: 'Search budget reached', cancelled_or_deadline: 'Research stopped or deadline reached', malformed_response: 'Search returned an unreadable response' } as Record<string, string>)[search.error] ?? 'Search unavailable'}</div>}
      <ul className="research-sources">{sources.filter(source => source.searchId === search.id).map(source => {
        const url = safeUrl(source.url);
        return <li key={source.sourceId}>
          {url ? <a href={url.href} target="_blank" rel="noopener noreferrer">{source.title || url.hostname}</a> : <span>{source.title || 'Source unavailable'}</span>}
          <div className="research-muted">{url?.hostname || 'Invalid source address'} · {source.publishedAt ? `Published ${dateLabel(source.publishedAt, { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Date unknown'} · Retrieved {dateLabel(source.retrievedAt, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}{source.fixture ? ' · Demo' : ''}</div>
        </li>;
      })}</ul>
    </li>)}</ul>
  </details>;
}

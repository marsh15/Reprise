import type { SearchRecord, SourceRecord } from '../../shared/research';
import { safeSourceUrl, sourceDateLabel } from '../sourceLabels';
import { DemoTag, IconCheck, IconChevron, IconWarning, Mark } from './Glyphs';

function statusLabel(status: SearchRecord['status']) {
  switch (status) {
    case 'ok': return <><IconCheck /><span className="visually-hidden">Results found</span></>;
    case 'empty': return 'No results';
    case 'error': return 'Failed';
    case 'timeout': return 'Timed out';
    case 'skipped_budget': return 'Skipped (search budget reached)';
  }
}

export function ResearchStatus({ searches, sources, running }: { searches: SearchRecord[]; sources: SourceRecord[]; running: boolean }) {
  if (!searches.length) return null;
  const pending = searches.filter(search => search.status === 'error' && !search.error);
  const visibleQueries = (pending.length ? pending : searches).slice(0, 2);
  if (running) return <div className="research-running" role="status" aria-live="polite">
    <span className="spinner" aria-hidden="true" />
    <span>Searching · {visibleQueries.map(search => search.query.length > 64 ? search.query.slice(0, 64) + '…' : search.query).join(' · ')}{pending.length > 2 ? ` · +${pending.length - 2} more` : ''}…</span>
  </div>;
  const starts = searches.map(search => Date.parse(search.startedAt));
  const searchIds = new Set(searches.map(search => search.id));
  const sourceCount = new Set(sources.filter(source => searchIds.has(source.searchId)).map(source => source.n)).size;
  const duration = Math.max(...searches.map((search, i) => starts[i] + search.durationMs)) - Math.min(...starts);
  const failures = searches.filter(search => ['auth', 'quota'].includes(search.error ?? ''));
  const warning = failures.some(search => search.error === 'auth') ? 'Search unavailable (authentication)' : failures.length ? 'Search unavailable (quota)' : '';
  return <details className="research-status">
    <summary>
      <Mark kind="current" />
      <span className="research-summary-text"><span className="tnum">{searches.length} {searches.length === 1 ? 'search' : 'searches'} · {sourceCount} {sourceCount === 1 ? 'source' : 'sources'} · {(duration / 1000).toFixed(1)} s</span>{warning && <> · <span className="research-warning"><IconWarning />{warning}</span></>}</span>
      <IconChevron className="chevron" />
    </summary>
    <ul className="research-queries">{searches.map(search => <li key={search.id}>
      <div className="research-query"><strong>{search.query}</strong> <span className="research-status-word">{statusLabel(search.status)}</span></div>
      {search.error && <div className="research-error"><IconWarning />{({ auth: 'Search unavailable (authentication)', quota: 'Search unavailable (quota)', timeout: 'Search timed out', duplicate: 'Query already searched', budget_exceeded: 'Search budget reached', cancelled_or_deadline: 'Research stopped or deadline reached', malformed_response: 'Search returned an unreadable response' } as Record<string, string>)[search.error] ?? 'Search unavailable'}</div>}
      <ul className="research-sources">{sources.filter(source => source.searchId === search.id).map(source => {
        const url = safeSourceUrl(source.url);
        return <li key={source.sourceId}>
          {url ? <a href={url.href} target="_blank" rel="noopener noreferrer">{source.title || url.hostname}</a> : <span>{source.title || 'Source unavailable'}</span>}
          <div className="research-meta tnum">{url?.hostname || 'Invalid source address'} · {source.publishedAt ? `Published ${sourceDateLabel(source.publishedAt, { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Date unknown'} · Retrieved {sourceDateLabel(source.retrievedAt, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}{source.fixture && <> · <DemoTag /></>}</div>
        </li>;
      })}</ul>
    </li>)}</ul>
  </details>;
}

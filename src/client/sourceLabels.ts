export function safeSourceUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url : null;
  } catch { return null; }
}
export function sourceDateLabel(value: string | null, options: Intl.DateTimeFormatOptions): string {
  if (!value) return 'Date unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unknown';
  // A published calendar date is not a UTC instant: never shift it to yesterday.
  return date.toLocaleString(undefined, { ...options, ...(/^\d{4}-\d{2}-\d{2}$/.test(value) ? { timeZone: 'UTC' } : {}) });
}

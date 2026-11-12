// Theme preference: local presentation state only (DESIGN-UI.md section 6, PRODUCT.md non-goals).
// "system" means no data-theme attribute, so tokens.css follows prefers-color-scheme by itself and
// reacts to OS changes with no JavaScript. Explicit light/dark write data-theme on <html>.
// All browser access is guarded: render must stay safe in Node (renderToStaticMarkup) and storage may throw.
import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'system' | 'dark';
export const THEME_KEY = 'reprise.theme';
export const themeOptions: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' }, { value: 'system', label: 'System' }, { value: 'dark', label: 'Dark' },
];

export function readTheme(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch { return 'system'; }
}

function writeTheme(preference: ThemePreference) {
  try {
    if (preference === 'system') localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, preference);
  } catch { /* The choice still applies for this page view without storage. */ }
}

/**
 * Keeps the browser chrome colour in step with the page. index.html ships one theme-color meta per
 * OS scheme (media-qualified). With an explicit choice that differs from the OS, both metas are
 * pointed at the active canvas colour and their media query is dropped; System restores them.
 */
function syncThemeColor(preference: ThemePreference) {
  const metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
  for (const meta of metas) {
    meta.dataset.originalContent ??= meta.content;
    meta.dataset.originalMedia ??= meta.getAttribute('media') ?? '';
    if (preference === 'system') {
      meta.content = meta.dataset.originalContent;
      if (meta.dataset.originalMedia) meta.setAttribute('media', meta.dataset.originalMedia);
    } else {
      meta.content = getComputedStyle(document.documentElement).getPropertyValue('--color-canvas').trim() || meta.dataset.originalContent;
      meta.removeAttribute('media');
    }
  }
}

export function applyTheme(preference: ThemePreference) {
  const root = document.documentElement;
  if (preference === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', preference);
  syncThemeColor(preference);
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(() => typeof document === 'undefined' ? 'system' : readTheme());
  useEffect(() => { applyTheme(preference); }, [preference]);
  useEffect(() => {
    // Another tab changed the preference.
    const onStorage = (event: StorageEvent) => { if (event.key === THEME_KEY || event.key === null) setPreference(readTheme()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const choose = useCallback((next: ThemePreference) => { writeTheme(next); setPreference(next); }, []);
  return [preference, choose] as const;
}

// Builds the editable Excalidraw scene and its SVG/PNG exports from architecture.scene.mjs.
// Usage: [PLAYWRIGHT_CORE=<path>] [CHROME_PATH=<chrome>] node docs/diagrams/build.mjs <excalidraw-tool-dir>
// <excalidraw-tool-dir> is a scratch folder (outside this repo) holding `bundle.js`: @excalidraw/excalidraw@0.18.1
// bundled with esbuild so that `window.ExLib` exposes convertToExcalidrawElements, serializeAsJSON, exportToSvg,
// exportToBlob and restore. Nothing is added to Reprise's own dependencies.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import skeleton, { groups } from './architecture.scene.mjs';

const toolDir = process.argv[2];
if (!toolDir) throw new Error('Pass the excalidraw tool directory (contains bundle.js).');
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
// Excalidraw fetches its hand-drawn fonts (Excalifont) by URL. Serve them from the installed package so the export
// is offline and the SVG embeds the real face instead of a fallback.
const fontRoot = join(toolDir, 'node_modules/@excalidraw/excalidraw/dist/prod/fonts');
async function openPage(fontCss = '') {
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('pageerror:', e.message.slice(0, 400)));
  await page.route(/\/fonts\/.+\.woff2/, route => {
    const rel = new URL(route.request().url()).pathname.split('/fonts/')[1];
    try { route.fulfill({ body: readFileSync(join(fontRoot, rel)), contentType: 'font/woff2', headers: { 'access-control-allow-origin': '*' } }); }
    catch { console.error('missing font', rel); route.abort(); }
  });
  await page.setContent(`<html><head><style>${fontCss}</style></head><body style="margin:0"></body></html>`);
  await page.addScriptTag({ content: readFileSync(join(toolDir, 'bundle.js'), 'utf8') });
  return page;
}

// Pass 1 only harvests the embedded Excalifont @font-face. Excalidraw measures and caches text widths on first use, so
// a page that measures before the face is loaded keeps fallback-font widths for the whole run; pass 2 starts with
// the face already loaded.
const probe = await openPage();
const fontCss = await probe.evaluate(async skeleton => {
  const L = window.ExLib;
  const svg = await L.exportToSvg({ elements: L.convertToExcalidrawElements(skeleton, { regenerateIds: false }), appState: {}, files: {} });
  return svg.querySelector('style.style-fonts')?.textContent ?? '';
}, skeleton);
if (!fontCss.includes('Excalifont')) throw new Error('Excalifont was not embedded by the probe export');
await probe.close();

const page = await openPage(fontCss);
await page.evaluate(() => document.fonts.load('20px Excalifont'));
const result = await page.evaluate(async ({ skeleton, groups }) => {
  const L = window.ExLib;
  const elements = L.convertToExcalidrawElements(skeleton, { regenerateIds: false });
  // Group each box with its bound title and its body text so a box moves as one object.
  for (const g of groups) {
    for (const el of elements) {
      if (el.id === g || el.id === `${g}-title` || el.id === `${g}-body` || el.containerId === g) el.groupIds = [`grp-${g}`];
    }
  }
  const appState = { viewBackgroundColor: '#f7f6f2', exportBackground: true, exportWithDarkMode: false, exportEmbedScene: false, gridSize: null };
  const files = {};
  const json = L.serializeAsJSON(elements, appState, files, 'local');
  const svg = await L.exportToSvg({ elements, appState, files, exportPadding: 36 });
  const svgText = new XMLSerializer().serializeToString(svg);
  const blob = await L.exportToBlob({ elements, appState, files, mimeType: 'image/png', exportPadding: 36,
    getDimensions: (w, h) => ({ width: w * 2, height: h * 2, scale: 2 }) });
  const png = Array.from(new Uint8Array(await blob.arrayBuffer()));
  return { json, svgText, png, count: elements.length, types: elements.reduce((m, e) => (m[e.type] = (m[e.type] ?? 0) + 1, m), {}) };
}, { skeleton, groups });

const scene = JSON.parse(result.json);
scene.source = 'https://excalidraw.com';
writeFileSync(join(here, 'reprise-architecture.excalidraw'), JSON.stringify(scene, null, 2) + '\n');
// Excalidraw writes only "Helvetica, Segoe UI Emoji"; add generic fallbacks so Linux viewers do not drop to a serif face.
const svgText = result.svgText.replaceAll('font-family="Helvetica, Segoe UI Emoji"', 'font-family="Helvetica, Arial, \'Liberation Sans\', sans-serif"');
writeFileSync(join(here, '..', 'assets', 'reprise-architecture.svg'), svgText);
writeFileSync(join(here, '..', 'assets', 'reprise-architecture.png'), Buffer.from(result.png));
console.log('elements', result.count, JSON.stringify(result.types));
await browser.close();
